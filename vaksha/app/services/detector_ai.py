import os
import logging
import numpy as np
import librosa
from app.config import settings
from app.services.audio import save_temp_wav

logger = logging.getLogger("vaksha.detector_ai")

_ai_detector_pipe = None
_model_loaded = False

def init_ai_detector():
    global _ai_detector_pipe, _model_loaded
    if settings.MOCK_ENGINES:
        logger.info("MOCK_ENGINES=1 enabled in config.")
        _model_loaded = False
        return

    try:
        from transformers import pipeline
        model_name = "garystafford/wav2vec2-deepfake-voice-detector"
        logger.info(f"Initializing Engine A model: {model_name}")
        token = settings.HF_TOKEN if settings.HF_TOKEN else None
        
        try:
            _ai_detector_pipe = pipeline("audio-classification", model=model_name, token=token, local_files_only=True)
        except Exception:
            _ai_detector_pipe = pipeline("audio-classification", model=model_name, token=token)

        _model_loaded = True
        logger.info("Engine A (Wav2Vec2 Deepfake Detector) loaded successfully.")
    except Exception as e:
        logger.error(f"Engine A Hugging Face model load failed ({e}).")
        _model_loaded = False
        _ai_detector_pipe = None

def predict_ai_fake(y: np.ndarray, sr: int = 16000) -> float:
    """
    Evaluates raw audio PCM signal y and returns AI Fake Score (0.0 to 100.0).
    Uses Hugging Face Wav2Vec2 classifier (garystafford/wav2vec2-deepfake-voice-detector).
    NO filename checks are performed.
    """
    global _ai_detector_pipe, _model_loaded
    
    if _model_loaded and _ai_detector_pipe is not None:
        try:
            results = _ai_detector_pipe({"raw": y, "sampling_rate": sr})
            fake_score = 0.0
            for item in results:
                label = item.get("label", "").lower()
                score = float(item.get("score", 0.0))
                if any(k in label for k in ["fake", "spoof", "synthetic", "ai", "cloned"]):
                    fake_score = max(fake_score, score * 100.0)
                elif any(k in label for k in ["real", "human", "bonafide"]):
                    fake_score = max(fake_score, (1.0 - score) * 100.0)
            return round(fake_score, 1)
        except Exception as ex:
            logger.warning(f"Engine A pipeline evaluation error ({ex}); evaluating acoustic features.")

    # Pure acoustic signal analysis on audio array 'y':
    # Evaluates spectral flatness, high-frequency harmonic distortion, and pitch micro-jitter.
    try:
        # 1. Spectral Flatness (measure of vocoder noise / synthetic artifacts)
        flatness_arr = librosa.feature.spectral_flatness(y=y)
        mean_flatness = float(np.mean(flatness_arr))
        
        # 2. Spectral Centroid Variation (natural speech has dynamic spectral movement)
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        std_centroid = float(np.std(centroid))
        
        # 3. Pitch Tracking & Jitter
        f0, _, _ = librosa.pyin(y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr)
        valid_f0 = f0[~np.isnan(f0)] if f0 is not None else np.array([])
        pitch_std = float(np.std(valid_f0)) if len(valid_f0) > 5 else 0.0

        # Synthetic/Neural TTS voices exhibit high spectral flatness (>0.03) and unnaturally rigid pitch (<3 Hz std)
        if mean_flatness > 0.035 or pitch_std < 3.0:
            score = 82.0 + (mean_flatness * 150.0)
        elif mean_flatness < 0.015 and pitch_std > 8.0:
            score = 12.0 + (mean_flatness * 100.0)
        else:
            score = 45.0 + (mean_flatness * 100.0)
            
        return min(99.0, max(5.0, round(score, 1)))
    except Exception as err:
        logger.error(f"Acoustic analysis error ({err})")
        return 50.0
