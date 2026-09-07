import io
import os
import tempfile
import numpy as np
import librosa
import soundfile as sf

TARGET_SR = 16000

def load_audio_from_bytes(audio_bytes: bytes) -> tuple[np.ndarray, int, float]:
    """
    Loads raw audio bytes, resamples to 16kHz mono PCM, returns (y_mono, sr, duration_sec).
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        y, sr = librosa.load(tmp_path, sr=TARGET_SR, mono=True)
        duration_sec = float(librosa.get_duration(y=y, sr=sr))
        return y, sr, duration_sec
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

def save_temp_wav(y: np.ndarray, sr: int = TARGET_SR) -> str:
    """
    Saves audio numpy array to a temporary 16kHz mono WAV file and returns the path.
    Caller must delete the file when done.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(tmp.name, y, sr, subtype='PCM_16')
    return tmp.name
