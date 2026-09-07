import logging
import numpy as np
import librosa

logger = logging.getLogger("vaksha.features")

def analyze_acoustic_reasons(
    y: np.ndarray,
    sr: int,
    ai_fake_score: float,
    speaker_match: float,
    amount_inr: float = 0.0,
    has_enrollment: bool = True
) -> list[str]:
    """
    Extracts acoustic features using librosa (and optional parselmouth) and returns human-understandable reason codes.
    """
    reasons = []

    try:
        # Spectral Flatness (measure of noise/synthetic artifacts)
        flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)))
        
        # Pitch tracking (F0 variation using librosa pyin)
        f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr)
        valid_f0 = f0[~np.isnan(f0)] if f0 is not None else np.array([])
        
        pitch_std = float(np.std(valid_f0)) if len(valid_f0) > 5 else 0.0
        
        # Reason rule mappings:
        if ai_fake_score >= 60.0 or flatness > 0.03:
            reasons.append("synthetic_artifacts")
            
        if len(valid_f0) > 5 and pitch_std < 8.0 and ai_fake_score >= 50.0:
            reasons.append("pitch_too_smooth")

    except Exception as e:
        logger.warning(f"Error during feature analysis ({e}); falling back to score-based reasons.")

    # Speaker match reasons
    if has_enrollment:
        if speaker_match >= 70.0:
            reasons.append("enrolled_speaker_match_high")
        elif speaker_match < 50.0:
            reasons.append("speaker_mismatch")
    else:
        reasons.append("unenrolled_identity")

    # High value transaction flag
    if amount_inr >= 500000.0:
        reasons.append("high_value_transaction")

    # Ensure at least one reason code exists
    if not reasons:
        reasons.append("normal_acoustic_profile")

    return list(dict.fromkeys(reasons))  # unique preserving order
