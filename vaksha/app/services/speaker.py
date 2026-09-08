import os
import json
import logging
import numpy as np
import librosa
from app.config import settings
from app.services.audio import save_temp_wav

logger = logging.getLogger("vaksha.speaker")

# Check network connectivity at module load time to avoid 30s HF hub retry delays when offline
try:
    import socket
    socket.create_connection(("1.1.1.1", 53), timeout=0.5)
except Exception:
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"

_spk_classifier = None
_speaker_model_loaded = False

def init_speaker_engine():
    global _spk_classifier, _speaker_model_loaded
    if settings.MOCK_ENGINES:
        logger.info("MOCK_ENGINES=1 enabled in config. Using MFCC acoustic embedding speaker engine.")
        _speaker_model_loaded = False
        return

    try:
        from speechbrain.inference.speaker import EncoderClassifier
        logger.info("Initializing Engine B model: speechbrain/spkrec-ecapa-voxceleb")
        _spk_classifier = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir=os.path.expanduser("~/.cache/speechbrain/spkrec-ecapa-voxceleb")
        )
        _speaker_model_loaded = True
        logger.info("Engine B (ECAPA-TDNN Speaker Recognition) loaded successfully.")
    except Exception as e:
        logger.warning(f"Engine B SpeechBrain load skipped/deferred ({e}). Using MFCC acoustic embedding engine.")
        _speaker_model_loaded = False

def extract_embedding(y: np.ndarray, sr: int = 16000) -> list[float]:
    """
    Extracts a feature vector embedding representing speaker vocal characteristics from raw audio y.
    """
    global _spk_classifier, _speaker_model_loaded
    
    if _speaker_model_loaded and _spk_classifier is not None:
        try:
            tmp_wav = save_temp_wav(y, sr)
            signal = _spk_classifier.load_audio(tmp_wav)
            embeddings = _spk_classifier.encode_batch(signal)
            if os.path.exists(tmp_wav):
                os.remove(tmp_wav)
                
            emb_vector = embeddings.squeeze().cpu().numpy().tolist()
            return [float(x) for x in emb_vector]
        except Exception as ex:
            logger.warning(f"SpeechBrain extraction error ({ex}); extracting MFCC vocal vector.")

    # 40-dim acoustic MFCC vocal feature embedding:
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean = np.mean(mfccs, axis=1)
    mfcc_std = np.std(mfccs, axis=1)
    combined = np.concatenate([mfcc_mean, mfcc_std])
    norm = np.linalg.norm(combined)
    if norm > 0:
        combined = combined / norm
    return [float(x) for x in combined.tolist()]

def compute_cosine_similarity(emb1: list[float], emb2: list[float]) -> float:
    """
    Computes cosine similarity between candidate embedding and enrolled embedding.
    Returns score from 0.0 to 100.0.
    """
    v1 = np.array(emb1, dtype=np.float32)
    v2 = np.array(emb2, dtype=np.float32)
    
    min_dim = min(len(v1), len(v2))
    v1 = v1[:min_dim]
    v2 = v2[:min_dim]
    
    dot = np.dot(v1, v2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
        
    cos_sim = dot / (norm1 * norm2)
    match_score = max(0.0, min(1.0, cos_sim)) * 100.0
    return round(float(match_score), 1)
