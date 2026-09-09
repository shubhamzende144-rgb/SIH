import json
import random
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Person, Voiceprint, Call
from app.schemas import DetectResponse, ScoreBreakdown
from app.services.audio import load_audio_from_bytes
from app.services.detector_ai import predict_ai_fake
from app.services.speaker import extract_embedding, compute_cosine_similarity
from app.services.features import analyze_acoustic_reasons
from app.services.fusion import fuse_risk_and_decision
from app.services.audit import record_audit_event

router = APIRouter(prefix="/v1", tags=["Detection"])

from fastapi.responses import JSONResponse

@router.post("/detect", response_model=None)
async def detect_voice_integrity(
    audio: UploadFile = File(...),
    person_code: Optional[str] = Form(None),
    person_id: Optional[int] = Form(None),
    intent: Optional[str] = Form("Fund Transfer"),
    amount_inr: float = Form(0.0),
    caller_number: Optional[str] = Form("+91 98200 12345"),
    db: Session = Depends(get_db)
):
    """
    Analyzes live audio sample against Engine A (AI deepfake detection) and Engine B (Speaker voiceprint matching).
    Fuses findings into a single risk score, decision, acoustic reasons, and action guidance.
    Writes cryptographic SHA-256 audit hash to SQLite.
    """
    audio_bytes = await audio.read()
    if not audio_bytes:
        return JSONResponse(status_code=400, content={"ok": False, "error": "audio too short"})

    try:
        y, sr, duration_sec = load_audio_from_bytes(audio_bytes, filename=audio.filename or "")
        if duration_sec < 1.0:
            return JSONResponse(status_code=400, content={"ok": False, "error": "audio too short"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": f"Failed to process audio file: {str(e)}"})

    # Engine A: AI vs Human Fake Score
    ai_fake_score = predict_ai_fake(y, sr)

    # Engine B: Speaker Match Score
    person = None
    if person_code:
        person = db.query(Person).filter(Person.person_code == person_code).first()
    elif person_id:
        person = db.query(Person).filter(Person.id == person_id).first()

    speaker_match = 0.0
    has_enrollment = False
    official_callback = None
    person_claimed_name = "Unknown / Unenrolled"

    candidate_emb = extract_embedding(y, sr)

    if person:
        person_claimed_name = person.name
        official_callback = person.official_callback
        voiceprint = db.query(Voiceprint).filter(Voiceprint.person_id == person.id).order_by(Voiceprint.id.desc()).first()
        if voiceprint and voiceprint.embedding_json:
            has_enrollment = True
            try:
                enrolled_emb = json.loads(voiceprint.embedding_json)
                speaker_match = compute_cosine_similarity(candidate_emb, enrolled_emb)
            except Exception:
                speaker_match = 0.0
    else:
        # 1-to-N Best Match Search across all enrolled voiceprints in Database
        all_voiceprints = db.query(Voiceprint).all()
        best_score = 0.0
        best_person = None
        for vp in all_voiceprints:
            if vp.embedding_json:
                try:
                    enrolled_emb = json.loads(vp.embedding_json)
                    score = compute_cosine_similarity(candidate_emb, enrolled_emb)
                    if score > best_score:
                        best_score = score
                        best_person = vp.person
                except Exception:
                    pass
        if best_person:
            person = best_person
            person_claimed_name = person.name
            official_callback = person.official_callback
            speaker_match = best_score
            has_enrollment = True

    # Feature Analysis & Explainability Reasons
    reasons = analyze_acoustic_reasons(
        y=y,
        sr=sr,
        ai_fake_score=ai_fake_score,
        speaker_match=speaker_match,
        amount_inr=amount_inr,
        has_enrollment=has_enrollment
    )

    # Fusion Engine
    fusion_result = fuse_risk_and_decision(
        ai_fake_score=ai_fake_score,
        speaker_match=speaker_match,
        has_enrollment=has_enrollment,
        person_name=person_claimed_name
    )

    # Create Call reference
    call_ref = f"VK-{random.randint(4000, 9999)}"
    
    call_record = Call(
        call_ref=call_ref,
        claimed_person_id=person.id if person else None,
        caller_number=caller_number,
        intent=intent,
        amount_inr=amount_inr,
        ai_fake_score=ai_fake_score,
        speaker_match=speaker_match,
        risk=fusion_result["risk"],
        trust=fusion_result["trust"],
        decision=fusion_result["decision"],
        reasons=json.dumps(reasons)
    )
    db.add(call_record)
    db.commit()
    db.refresh(call_record)

    # Write SHA-256 Audit Log Event
    audit_payload = {
        "call_ref": call_ref,
        "claimed_person": person_claimed_name,
        "ai_fake_score": ai_fake_score,
        "speaker_match": speaker_match,
        "risk": fusion_result["risk"],
        "decision": fusion_result["decision"],
        "reasons": reasons
    }
    record_audit_event(db, event_type="DETECT", ref_id=call_ref, payload=audit_payload)

    return DetectResponse(
        call_ref=call_ref,
        person_claimed=person_claimed_name,
        final_decision=fusion_result["decision"],
        risk=fusion_result["risk"],
        trust=fusion_result["trust"],
        breakdown=ScoreBreakdown(
            ai_fake_score=ai_fake_score,
            speaker_match=speaker_match,
            meaning=fusion_result["meaning"]
        ),
        reasons=reasons,
        action=fusion_result["action"],
        official_callback=official_callback
    )
