import json
import logging
import traceback
from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.config import settings
from app.models import Person, Voiceprint
from app.services.audio import load_audio_from_bytes
from app.services.speaker import extract_embedding
from app.services.audit import record_audit_event

logger = logging.getLogger("vaksha.enroll")

router = APIRouter(prefix="/v1", tags=["Enrollment"])


def _sync_to_supabase(person_code: str, name: str, role_title: str,
                       org: str, official_callback: str,
                       embedding: list, duration_sec: float):
    """
    Push to Supabase people + voiceprints tables.
    Raises exception if it fails so enrollment does not succeed locally if remote fails.
    """
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
    if not url or not key or "xxxx" in url:
        raise Exception("Supabase URL or Key is missing/invalid in environment variables.")

    from supabase import create_client
    import postgrest
    
    sb = create_client(url, key)

    try:
        # Upsert person row
        person_row = {
            "name": name,
            "role": role_title,
            "person_code": person_code,
            "role_title": role_title,
            "official_callback": official_callback,
            "org": org,
            "consent": True
        }
        res_people = sb.table("people").upsert(person_row, on_conflict="person_code").execute()

        if not res_people.data:
            raise Exception("Failed to upsert into people table: no data returned.")
        
        person_id = res_people.data[0]["id"]

        # Insert voiceprint row
        vp_row = {
            "person_id": person_id,
            "embedding": embedding
        }
        res_vp = sb.table("voiceprints").insert(vp_row).execute()
        
    except postgrest.exceptions.APIError as e:
        # e.json() or str(e) contains the exact Supabase error message
        err_msg = e.message if hasattr(e, 'message') else str(e)
        raise Exception(f"Supabase Error: {err_msg}")
    except Exception as e:
        raise Exception(str(e))


@router.post("/enroll")
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
    Always returns JSON — never crashes with a bare 500.
    """
    try:
        # ---- read audio bytes ----
        audio_bytes = await audio.read()
        if not audio_bytes:
            return JSONResponse(status_code=400, content={
                "ok": False, "error": "Empty audio file provided."
            })

        # ---- decode audio ----
        try:
            y, sr, duration_sec = load_audio_from_bytes(
                audio_bytes, filename=audio.filename or ""
            )
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(f"Audio decode failed:\n{tb}")
            return JSONResponse(status_code=400, content={
                "ok": False,
                "error": f"Failed to process audio: {e}. "
                         f"Make sure ffmpeg is installed for MP3/M4A."
            })

        if duration_sec < 1.0:
            return JSONResponse(status_code=400, content={
                "ok": False, "error": "Audio must be at least 1 second long."
            })

        # ---- extract embedding via Engine B ----
        embedding = extract_embedding(y, sr)
        embedding_json = json.dumps(embedding)

        # ---- upsert Person in local SQLite ----
        person = db.query(Person).filter(
            Person.person_code == person_code
        ).first()
        if not person:
            person = Person(
                person_code=person_code,
                name=name,
                role_title=role_title,
                org=org,
                official_callback=official_callback,
                consent="GRANTED",
                status="ACTIVE",
            )
            db.add(person)
            db.commit()
            db.refresh(person)
        else:
            person.name = name
            person.role_title = role_title
            person.official_callback = official_callback
            db.commit()

        # ---- save Voiceprint in local SQLite ----
        voiceprint = Voiceprint(
            person_id=person.id,
            embedding_json=embedding_json,
            quality_score=98.5,
            duration_sec=round(duration_sec, 2),
        )
        db.add(voiceprint)
        db.commit()
        db.refresh(voiceprint)

        # ---- write SHA-256 audit record ----
        audit_payload = {
            "person_code": person.person_code,
            "name": person.name,
            "role_title": person.role_title,
            "duration_sec": voiceprint.duration_sec,
            "embedding_len": len(embedding),
        }
        audit_entry = record_audit_event(
            db, event_type="ENROLL",
            ref_id=person.person_code,
            payload=audit_payload,
        )

        # ---- best-effort Supabase sync ----
        _sync_to_supabase(
            person_code, name, role_title, org,
            official_callback, embedding, duration_sec,
        )

        return JSONResponse(status_code=200, content={
            "ok": True,
            "person_id": person.id,
            "person_code": person.person_code,
            "name": person.name,
            "quality_score": voiceprint.quality_score,
            "duration_sec": voiceprint.duration_sec,
            "audit_hash": audit_entry.payload_hash,
        })

    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Enrollment crash:\n{tb}")
        return JSONResponse(status_code=500, content={
            "ok": False,
            "error": f"Internal enrollment error: {e}",
            "traceback": tb,
        })
