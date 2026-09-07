# Vaksha (वाक्-क्षा) — Real-Time Voice Integrity Platform

**Smart India Hackathon 2026 · Problem Statement SIH26104**  
*Organization:* AICTE Cyber Security Cell  
*Theme:* Blockchain & Cybersecurity | *Category:* Software  

---

## 📌 Executive Summary

**Vaksha** (derived from Sanskrit *Vāk-Kṣā*, meaning "Voice Protection / Voice Integrity Guard") is an enterprise-grade, real-time voice authentication and AI voice-cloning detection platform. Designed specifically for financial institutions, VoIP customer desks, and sensitive enterprise communications, Vaksha operates during active calls to continuously verify caller voiceprints and detect synthetic/cloned speech artifacts.

### Key Capabilities
- **Engine A (AI Deepfake Detection):** Pretrained Hugging Face Wav2Vec2 audio classification model (`garystafford/wav2vec2-deepfake-voice-detector`).
- **Engine B (Speaker Voiceprint Recognition):** ECAPA-TDNN 192-dimensional embedding extraction (`speechbrain/spkrec-ecapa-voxceleb`) with cosine similarity verification.
- **Risk Fusion Engine:** Combines AI fake probability and speaker verification scores into a single risk score (0–100) and actionable call decision (`ALLOW`, `STEP_UP`, `BLOCK`).
- **Cryptographic Audit Trail:** Generates immutable SHA-256 payload hashes stored in SQLite for every enrollment, call inspection, and SOC action.
- **Privacy First:** Raw audio buffer is processed in memory / temporary storage and purged immediately after feature extraction. Only embeddings and audit metadata are stored.

---

## ⚖ Product Risk Fusion Matrix

A sophisticated voice clone can MATCH the enrolled speaker's voice frequencies AND still be an AI-generated fake. Vaksha enforces strict fusion rules:

| AI Fake | Speaker Match | Situation & Meaning | Final Decision |
| :--- | :--- | :--- | :--- |
| **Low (<60%)** | **High (≥70%)** | Authentic enrolled person | **`ALLOW`** (Risk 0–39) |
| **High (≥60%)** | **High (≥70%)** | **AI Clone of Enrolled Person** | **`BLOCK`** (Risk 70–100) |
| **Low (<60%)** | **Low (<50%)** | Impostor / Different human | **`STEP_UP`** (Risk 40–69) |
| **High (≥60%)** | **Low (<50%)** | Synthetic stranger / Fake voice | **`BLOCK`** (Risk 70–100) |
| **Any** | **No Enrollment** | Unknown identity | **`WARN`** + AI Score |

$$\text{Risk Score} = 0.55 \times \text{AI\_Fake\_Score} + 0.45 \times \text{Situation\_Bonus}$$

- $\text{Situation\_Bonus} = 100$ if $\text{Match} \ge 70$ and $\text{AI\_Fake} \ge 60$ (Enrolled Person Clone)
- $\text{Situation\_Bonus} = 80$ if $\text{Match} < 50$ (Impostor)
- $\text{Situation\_Bonus} = 20$ otherwise

---

## 🛠 Installation & Execution Guide

### 1. Environment Setup
```bash
# Clone the repository and enter directory
cd vaksha

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Generate Demo Audio & Seed Database
```bash
# Generate synthetic demo audio samples (cfo_real.wav, cfo_clone.wav, impostor.wav)
python scripts/make_demo_audio.py

# Initialize SQLite schema and seed Rahul Sharma (CFO), Priya Nair (Agent), and demo calls
python scripts/seed.py
```

### 3. Launch Vaksha Server & UI
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Then open your browser at **[http://localhost:8000](http://localhost:8000)**.

---

## 🤖 Models & Downloads

On first launch, Vaksha automatically fetches pretrained weights from Hugging Face into `~/.cache`:
- **Engine A:** `garystafford/wav2vec2-deepfake-voice-detector`
- **Engine B:** `speechbrain/spkrec-ecapa-voxceleb`

> **Note on `HF_TOKEN` & Mock Mode:**  
> `HF_TOKEN` in `.env` is optional (used if accessing gated HF repos). If internet access is unavailable or `MOCK_ENGINES=1` is set, Vaksha automatically uses a fast acoustic spectral heuristic engine so all UI flows, REST endpoints, and jury demonstrations continue without interruption.

---

## 🎯 Jury 3-Minute Demo Workflow

1. Open `http://localhost:8000` (defaults to **Union Bank · Demo** with active CFO **Rahul Sharma**).
2. Click **Play Real Voice (Rahul Sharma)** → Decision **`ALLOW`**, Risk ~14.
3. Click **Play AI Clone of CFO** → Decision **`BLOCK`**, Risk ~88 (Speaker match High + AI fake High). Red banner triggers: *"Voice Clone Suspected! Do not approve funds."*
4. Click **Play Impostor Voice** → Decision **`STEP_UP`**, Risk ~54. Yellow banner triggers: *"Speaker does not match enrolled profile."*
5. Switch to **Security Desk (SOC)** tab to view real-time incident queue and KPI metrics.
6. Switch to **Audit & Policy Trail** tab to inspect immutable SHA-256 event log hashes.

---

## 🔒 Privacy & Honest Limits

- **Privacy:** Raw audio is NEVER written to the database. Only 192-dim numerical embeddings, scores, and SHA-256 hashes are persisted in `data/vaksha.db`.
- **Honest Limits:** Unseen generative speech architectures or novel vocoders can temporarily degrade Engine A classification. Therefore, Vaksha's security policy enforces mandatory out-of-band MFA and callback step-ups on all high-value transactions (≥ ₹5,00,000) regardless of voice score.

---

## 🏢 SIH26104 Requirements Alignment

| SIH26104 Requirement | Vaksha Implementation |
| :--- | :--- |
| Real-time deepfake voice scoring | FastAPI + WebSockets + Wav2Vec2 Engine A |
| Speaker voiceprint enrollment & matching | ECAPA-TDNN 192-dim embeddings + Cosine Similarity Engine B |
| Single risk score & clear decision | Risk Fusion Equation (0–100) -> `ALLOW`, `STEP_UP`, `BLOCK` |
| Off-disk audio privacy | In-memory stream processing; embedding & score storage only |
| Immutable audit hash log | Cryptographic SHA-256 event hashing stored in SQLite |
| Bank / SOC Enterprise UI | Dark fintech UI with active call workspace & jury demo controls |
