import hashlib
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import AuditLog

logger = logging.getLogger("vaksha.audit")

def compute_payload_hash(payload: dict) -> str:
    """
    Computes a deterministic SHA-256 hex string of the JSON payload.
    """
    canonical_json = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

def record_audit_event(
    db: Session,
    event_type: str,
    ref_id: str,
    payload: dict,
    actor: str = "SYSTEM"
) -> AuditLog:
    """
    Computes payload hash and writes an immutable audit record to the DB.
    """
    payload_hash = compute_payload_hash(payload)
    audit_entry = AuditLog(
        event_type=event_type,
        ref_id=ref_id,
        payload_hash=payload_hash,
        actor=actor,
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    logger.info(f"Audit log recorded: type={event_type}, ref_id={ref_id}, hash={payload_hash[:12]}...")
    return audit_entry
