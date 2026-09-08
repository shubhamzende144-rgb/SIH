import os
import json
import logging
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import settings
from app.db import engine, Base
from app.routers import enroll, detect, calls, audit
from app.services import detector_ai, speaker
from app.services.detector_ai import init_ai_detector, predict_ai_fake
from app.services.speaker import init_speaker_engine
from app.services.fusion import fuse_risk_and_decision
from fastapi import HTTPException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vaksha.main")

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Real-Time Voice Integrity & Anti-Deepfake Authentication Platform (SIH26104)",
    version="1.0.0"
)

# Enable CORS for local demo and frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(enroll.router)
app.include_router(detect.router)
app.include_router(calls.router)
app.include_router(audit.router)

@app.on_event("startup")
def startup_event():
    logger.info("Initializing Vaksha ML Engines...")
    init_ai_detector()
    init_speaker_engine()
    logger.info(f"Vaksha Application ready. ML Models: Engine A={detector_ai._model_loaded}, Engine B={speaker._speaker_model_loaded}")

@app.get("/health")
def health_check():
    """
    Health check endpoint reporting ML engine status.
    Returns {"mock": false, "ai": true, "speaker": true}. If models fail when mock is false, returns 503.
    """
    ai_status = detector_ai._model_loaded
    speaker_status = speaker._speaker_model_loaded
    mock_status = settings.MOCK_ENGINES
    
    if not mock_status:
        if not ai_status or not speaker_status:
            raise HTTPException(
                status_code=503,
                detail=f"ML Engine Failure: Engine A (ai)={ai_status}, Engine B (speaker)={speaker_status}"
            )
            
    return {
        "mock": mock_status,
        "ai": ai_status,
        "speaker": speaker_status
    }

# Live Streaming WebSocket Endpoint
@app.websocket("/v1/live/{session_id}")
async def live_audio_stream(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time live call streaming.
    Receives raw audio chunk bytes and pushes updated integrity risk JSON every chunk.
    """
    await websocket.accept()
    logger.info(f"WebSocket live session connected: {session_id}")
    chunk_counter = 0

    try:
        while True:
            data = await websocket.receive_bytes()
            chunk_counter += 1
            
            # Simple chunk evaluation (simulating real-time streaming risk updates)
            # In production, accumulates audio buffer or processes stream slice
            ai_score = min(95.0, max(10.0, float(30.0 + (chunk_counter * 5) % 60)))
            spk_match = 85.0
            fusion = fuse_risk_and_decision(ai_score, spk_match, has_enrollment=True, person_name="Rahul Sharma")

            response_payload = {
                "session_id": session_id,
                "chunk": chunk_counter,
                "ai_fake_score": ai_score,
                "speaker_match": spk_match,
                "risk": fusion["risk"],
                "trust": fusion["trust"],
                "decision": fusion["decision"],
                "meaning": fusion["meaning"],
                "reasons": ["realtime_stream_chunk", "synthetic_artifacts" if ai_score > 60 else "normal_pitch"]
            }
            await websocket.send_json(response_payload)
    except WebSocketDisconnect:
        logger.info(f"WebSocket live session disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error ({e})")
        await websocket.close()

# Static files & SPA UI serving
static_dir = os.path.join(os.path.dirname(__file__), "static")
samples_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "samples")

if os.path.exists(samples_dir):
    app.mount("/data/samples", StaticFiles(directory=samples_dir), name="samples")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"message": "Vaksha API is active. Front-end static assets coming up."})
