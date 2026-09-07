import json
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Person, Voiceprint
from app.schemas import EnrollResponse
from app.services.audio import load_audio_from_bytes
from app.services.speaker import extract_embedding
from app.services.audit import record_audit_event

router = APIRouter(prefix="/v1", tags=["Enrollment"])

@router.post("/enroll", response_model=EnrollResponse)
async def enroll_person_voice(
    person_code: str = Form(...),
    name: str = Form(...),
    role_title: str = Form("Executive"),
    org: str = Form("Union Bank"),
    official_callback: str = Form(...),
    audio: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Enrolls a trusted person by extracting their speaker voiceprint embedding.
    Raw audio is processed in memory and never stored on disk.
    """
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file provided.")

    try:
        y, sr, duration_sec = load_audio_from_bytes(audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process audio file: {str(e)}")

    if duration_sec < 1.0:
        raise HTTPException(status_code=400, detail="Audio duration must be at least 1 second.")

    # Extract 1D speaker embedding vector
    embedding = extract_embedding(y, sr)
    embedding_json = json.dumps(embedding)

    # Fetch or create Person
    person = db.query(Person).filter(Person.person_code == person_code).first()
    if not person:
        person = Person(
            person_code=person_code,
            name=name,
            role_title=role_title,
            org=org,
            official_callback=official_callback,
            consent="GRANTED",
            status="ACTIVE"
        )
        db.add(person)
        db.commit()
        db.refresh(person)
    else:
        # Update details if person exists
        person.name = name
        person.role_title = role_title
        person.official_callback = official_callback
        db.commit()

    # Save voiceprint record
    voiceprint = Voiceprint(
        person_id=person.id,
        embedding_json=embedding_json,
        quality_score=98.5,
        duration_sec=round(duration_sec, 2)
    )
    db.add(voiceprint)
    db.commit()
    db.refresh(voiceprint)

    # Record cryptographic audit hash
    audit_payload = {
        "person_code": person.person_code,
        "name": person.name,
        "role_title": person.role_title,
        "duration_sec": voiceprint.duration_sec,
        "embedding_len": len(embedding)
    }
    audit_entry = record_audit_event(db, event_type="ENROLL", ref_id=person.person_code, payload=audit_payload)

    return EnrollResponse(
        person_id=person.id,
        person_code=person.person_code,
        name=person.name,
        quality_score=voiceprint.quality_score,
        duration_sec=voiceprint.duration_sec,
        audit_hash=audit_entry.payload_hash
    )
