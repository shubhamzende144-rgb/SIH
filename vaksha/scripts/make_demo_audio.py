import os
import numpy as np
import scipy.io.wavfile as wav

SAMPLE_RATE = 16000
DURATION = 3.5  # seconds

def generate_speech_like_wave(f0=140.0, harmonic_weights=[1.0, 0.6, 0.4, 0.2], jitter=0.02, noise_level=0.01):
    t = np.linspace(0, DURATION, int(SAMPLE_RATE * DURATION), endpoint=False)
    
    # Envelope (speech rhythm / cadence modulation)
    envelope = 0.5 * (1.0 + np.sin(2 * np.pi * 2.5 * t))
    envelope = np.clip(envelope, 0.1, 1.0)
    
    # Pitch jitter
    jitter_signal = f0 * (1.0 + jitter * np.random.randn(len(t)))
    phase = 2 * np.pi * np.cumsum(jitter_signal) / SAMPLE_RATE
    
    signal = np.zeros_like(t)
    for i, w in enumerate(harmonic_weights, start=1):
        signal += w * np.sin(i * phase)
        
    signal = signal * envelope
    # Add noise
    signal += noise_level * np.random.randn(len(t))
    
    # Normalize to int16 range
    signal = signal / np.max(np.abs(signal)) * 0.8
    return (signal * 32767).astype(np.int16)

def generate_clone_wave(f0=140.0):
    t = np.linspace(0, DURATION, int(SAMPLE_RATE * DURATION), endpoint=False)
    
    # Perfectly flat f0 (robotic smooth pitch)
    phase = 2 * np.pi * f0 * t / SAMPLE_RATE
    
    # Neural vocoder phase discontinuities / metallic harmonics
    signal = np.sin(phase) + 0.5 * np.sin(2 * phase) + 0.3 * np.sin(3.5 * phase) + 0.25 * np.sin(7 * phase)
    
    # High spectral flatness (synthetic noise floor)
    synthetic_noise = 0.08 * np.random.uniform(-1, 1, len(t))
    signal += synthetic_noise
    
    # Speech envelope
    envelope = 0.5 * (1.0 + np.sin(2 * np.pi * 2.5 * t))
    signal = signal * envelope
    
    signal = signal / np.max(np.abs(signal)) * 0.8
    return (signal * 32767).astype(np.int16)

def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "samples")
    os.makedirs(out_dir, exist_ok=True)
    
    cfo_real_path = os.path.join(out_dir, "cfo_real.wav")
    cfo_clone_path = os.path.join(out_dir, "cfo_clone.wav")
    impostor_path = os.path.join(out_dir, "impostor.wav")
    
    # 1. Real CFO Audio (f0 ~140Hz, natural jitter, rich harmonics)
    real_audio = generate_speech_like_wave(f0=140.0, jitter=0.03, noise_level=0.005)
    wav.write(cfo_real_path, SAMPLE_RATE, real_audio)
    print(f"Generated: {cfo_real_path}")
    
    # 2. Cloned CFO Audio (f0 ~140Hz matching CFO, but robotic phase & synthetic artifacts)
    clone_audio = generate_clone_wave(f0=140.0)
    wav.write(cfo_clone_path, SAMPLE_RATE, clone_audio)
    print(f"Generated: {cfo_clone_path}")
    
    # 3. Impostor Audio (f0 ~230Hz, different voice profile)
    impostor_audio = generate_speech_like_wave(f0=230.0, jitter=0.02, noise_level=0.005)
    wav.write(impostor_path, SAMPLE_RATE, impostor_audio)
    print(f"Generated: {impostor_path}")

if __name__ == "__main__":
    main()
