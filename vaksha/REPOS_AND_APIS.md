# Vaksha — Repositories, ML Models, and API Audit Matrix

**Product:** Vaksha — Real-Time Voice Integrity Platform  
**Hackathon Event:** Smart India Hackathon 2026 (Problem Statement SIH26104)  
**Organization:** AICTE Cyber Security Cell  

---

## 1. External ML Models Downloaded

Quoted directly from `app/services/detector_ai.py` and `app/services/speaker.py`:

- **Engine A (AI vs Human Voice Detector):**
  - **Exact Model ID String in Code:** `"garystafford/wav2vec2-deepfake-voice-detector"`
  - **Source Code Location:** [detector_ai.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/services/detector_ai.py#L22-L25)
  - **Invocation:**
    ```python
    from transformers import pipeline
    _ai_detector_pipe = pipeline("audio-classification", model="garystafford/wav2vec2-deepfake-voice-detector", token=token)
    ```
  - **Mode Behavior:** Attempted when `MOCK_ENGINES=0`. If `MOCK_ENGINES=1` or if Hugging Face model download fails/times out (e.g. offline sandbox), Engine A gracefully falls back to real-time `librosa` acoustic spectral analysis (spectral flatness, spectral centroid variance, `pyin` F0 pitch micro-jitter).

- **Engine B (Speaker Voiceprint Recognition):**
  - **Exact Model ID String in Code:** `"speechbrain/spkrec-ecapa-voxceleb"`
  - **Source Code Location:** [speaker.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/services/speaker.py#L23-L27)
  - **Invocation:**
    ```python
    from speechbrain.inference.speaker import EncoderClassifier
    _spk_classifier = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir="~/.cache/speechbrain/spkrec-ecapa-voxceleb"
    )
    ```
  - **Mode Behavior:** Attempted when `MOCK_ENGINES=0`. If `MOCK_ENGINES=1` or if SpeechBrain model download fails, Engine B gracefully falls back to a 40-dimensional normalized MFCC vocal feature embedding vector with cosine similarity matching.

---

## 2. Python Packages Used

Quoted directly from [requirements.txt](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/requirements.txt):

1. `fastapi>=0.100.0` — REST and WebSocket web application framework
2. `uvicorn[standard]>=0.22.0` — High-performance ASGI web server
3. `sqlalchemy>=2.0.0` — Database ORM for SQLite
4. `python-multipart>=0.0.6` — Multipart form-data parser for audio uploads
5. `pydantic>=2.0.0` — Data validation and settings management
6. `pydantic-settings>=2.0.0` — Environment settings configuration
7. `python-dotenv>=1.0.0` — `.env` file loader
8. `librosa>=0.10.0` — Audio feature extraction (MFCCs, spectral flatness, centroid, pitch)
9. `soundfile>=0.12.1` — Sound file I/O reader/writer
10. `numpy>=1.24.0` — Numerical matrix computations
11. `scipy>=1.10.0` — Signal processing and audio file I/O
12. `torch>=2.0.0` — PyTorch ML inference engine
13. `transformers>=4.30.0` — Hugging Face transformers model runner
14. `speechbrain>=0.5.14` — SpeechBrain ECAPA-TDNN speaker verification toolkit
15. `websockets>=11.0` — Real-time live call streaming protocol

---

## 3. Our FastAPI Routes

Implemented in `app/main.py` and `app/routers/`:

| Method | Route Path | File Location | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | [main.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/main.py#L51-L63) | Health check reporting AI engine status, speaker engine status, and `mock` flag |
| `GET` | `/` | [main.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/main.py#L115-L120) | Serves single-page dark fintech SOC UI |
| `POST` | `/v1/enroll` | [enroll.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/routers/enroll.py#L13-L77) | Enrolls trusted voiceprint embedding, writes audit hash, purges raw WAV |
| `POST` | `/v1/detect` | [detect.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/routers/detect.py#L17-L125) | Evaluates audio against Engine A + Engine B, fuses risk, logs call & SHA-256 audit hash |
| `GET` | `/v1/people` | [calls.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/routers/calls.py#L12-L17) | Lists enrolled individuals |
| `GET` | `/v1/calls` | [calls.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/routers/calls.py#L19-L50) | Lists verification call history |
| `POST` | `/v1/calls/{call_ref}/action` | [calls.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/routers/calls.py#L52-L96) | Registers manual agent/SOC action decision override and writes audit hash |
| `GET` | `/v1/audit` | [audit.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/routers/audit.py#L10-L16) | Returns immutable SHA-256 signed event audit log trail |
| `WS` | `/v1/live/{session_id}` | [main.py](file:///Users/shubhamzende/Downloads/dineup-beta/git/tom%20tom/sih/vaksha/app/main.py#L66-L103) | Real-time WebSocket streaming endpoint for live audio chunk scoring |

---

## 4. Repositories Referenced in Code vs. Documentation Only

### Repositories / Models Actually Imported & Executed in Code:
1. `garystafford/wav2vec2-deepfake-voice-detector` (Loaded via `transformers` in `app/services/detector_ai.py`)
2. `speechbrain/spkrec-ecapa-voxceleb` (Loaded via `speechbrain` in `app/services/speaker.py`)

### Repositories Mentioned in Docs / Prompts ONLY (NOT IN CODE):
1. `koyelog/deepfake-voice-detector-sota` — **NOT IN CODE**
2. `Srv99x/voice-detection-ai` — **NOT IN CODE** (Architectural reference only)
3. `imsoumya18/audio_deepfake_detector` — **NOT IN CODE** (Architectural reference only)
4. `clovaai/aasist` — **NOT IN CODE**
5. `TakHemlata/SSL_Anti-spoofing` — **NOT IN CODE**
6. `resemble-ai/Resemblyzer` — **NOT IN CODE**
7. `YannickJadoul/Parselmouth` — **NOT IN CODE**
8. `snakers4/silero-vad` — **NOT IN CODE**

---

## 5. Paid Voice APIs Confirmation

> **CONFIRMATION:** Vaksha does **NOT** call ElevenLabs, OpenAI, Pindrop, Hiya, Resemble Detect, or any paid voice API.  
> 
> All ML models, feature extractors, signal analyzers, and database engines operate 100% locally and open-source using PyTorch, Hugging Face Transformers, SpeechBrain, Librosa, FastAPI, and SQLite.

---

## 6. Environment Variables

Defined in `app/config.py` and `.env.example`:

- `HF_TOKEN`: *(Optional)* Hugging Face access token for fetching gated repositories. Defaults to `""`.
- `MOCK_ENGINES`: *(Optional)* Boolean flag (`0` or `1`). Controls whether ML engines run full model weights (`0`) or acoustic signal fallback mode (`1`). Defaults to `0`.
- `DATABASE_URL`: *(Required)* SQLite database connection URL. Defaults to `sqlite:///./data/vaksha.db`.

---

## 7. PPT Cheat Sheet (Slide Summary)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VAKSHA (वाक्-क्षा) — PPT CHEAT SHEET                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Product Name:     Vaksha — Real-Time Voice Integrity Platform             │
│ • SIH Event:        Smart India Hackathon 2026 (Problem Statement SIH26104)  │
│                                                                             │
│ • Engine A:         garystafford/wav2vec2-deepfake-voice-detector           │
│                     (AI vs Human classification | Fake score 0–100%)      │
│                                                                             │
│ • Engine B:         speechbrain/spkrec-ecapa-voxceleb                       │
│                     (ECAPA-TDNN 192-dim embedding + Cosine match 0–100%)    │
│                                                                             │
│ • Feature Engine:   Librosa spectral flatness, centroid std, pyin pitch f0  │
│                     (Reasons: synthetic_artifacts, enrolled_speaker_match)  │
│                                                                             │
│ • Risk Fusion:      Risk = 0.55 * AI_Fake + 0.45 * Situation_Bonus          │
│                     Decisions: ALLOW (0-39) | STEP_UP (40-69) | BLOCK (70-100)│
│                                                                             │
│ • Backend & DB:     Python 3.11/3.14, FastAPI, Uvicorn, WebSockets, SQLite  │
│ • Audit Logging:    Cryptographic SHA-256 event payload hashes stored in DB  │
│ • Paid Voice APIs:  NONE (100% Open Source Models)                          │
└─────────────────────────────────────────────────────────────────────────────┘
```
