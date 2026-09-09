import io
import os
import tempfile
import numpy as np
import librosa
import soundfile as sf

TARGET_SR = 16000

def load_audio_from_bytes(audio_bytes: bytes, filename: str = "") -> tuple[np.ndarray, int, float]:
    """
    Loads raw audio bytes, resamples to 16kHz mono PCM, returns (y_mono, sr, duration_sec).
    """
    # Determine suffix from filename or magic bytes
    suffix = ".wav"
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        if ext in (".mp3", ".m4a", ".ogg", ".flac", ".webm"):
            suffix = ext
    elif audio_bytes[:3] == b'ID3' or audio_bytes[:2] == b'\xff\xfb':
        suffix = ".mp3"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        if suffix != ".wav":
            wav_path = tmp_path + ".wav"
            import subprocess
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path, "-ar", str(TARGET_SR), "-ac", "1", wav_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            if os.path.exists(wav_path):
                os.remove(tmp_path)
                tmp_path = wav_path

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
