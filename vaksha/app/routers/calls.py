import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Person, Call, User, Action
from app.schemas import PersonSchema, CallSchema, ActionRequest, ActionResponse
from app.services.audit import record_audit_event

router = APIRouter(prefix="/v1", tags=["Calls & People"])

@router.get("/people", response_model=List[PersonSchema])
def list_enrolled_people(db: Session = Depends(get_db)):
    """
    Returns list of enrolled individuals.
    """
    return db.query(Person).order_by(Person.id.desc()).all()

@router.get("/calls", response_model=List[CallSchema])
def list_calls_history(db: Session = Depends(get_db)):
    """
    Returns call verification history.
    """
    calls = db.query(Call).order_by(Call.id.desc()).all()
    results = []
    for c in calls:
        person_name = c.claimed_person.name if c.claimed_person else "Unknown"
        reasons_list = []
        if c.reasons:
            try:
                reasons_list = json.loads(c.reasons) if c.reasons.startswith("[") else c.reasons.split(",")
            except Exception:
                reasons_list = [c.reasons]

        results.append(CallSchema(
            id=c.id,
            call_ref=c.call_ref,
            person_claimed=person_name,
            caller_number=c.caller_number,
            intent=c.intent,
            amount_inr=c.amount_inr,
            ai_fake_score=c.ai_fake_score,
            speaker_match=c.speaker_match,
            risk=c.risk,
            trust=c.trust,
            decision=c.decision,
            reasons=reasons_list,
            created_at=c.created_at
        ))
    return results

@router.post("/calls/{call_ref}/action", response_model=ActionResponse)
def submit_call_action(
    call_ref: str,
    req: ActionRequest,
    db: Session = Depends(get_db)
):
    """
    Registers an agent/SOC action decision on a call session and logs an immutable audit hash.
    """
    call = db.query(Call).filter(Call.call_ref == call_ref).first()
    if not call:
        raise HTTPException(status_code=404, detail=f"Call reference '{call_ref}' not found.")

    actor = db.query(User).filter(User.email == req.actor_email).first()
    actor_id = actor.id if actor else None

    action_record = Action(
        call_id=call.id,
        actor_id=actor_id,
        action=req.action,
        note=req.note
    )
    db.add(action_record)
    
    # Update call decision override if explicit action taken
    call.decision = req.action
    db.commit()
    db.refresh(action_record)

    # Record SHA-256 Audit Log Event
    audit_payload = {
        "call_ref": call.call_ref,
        "action": req.action,
        "actor_email": req.actor_email,
        "note": req.note
    }
    audit_entry = record_audit_event(
        db,
        event_type="ACTION",
        ref_id=call.call_ref,
        payload=audit_payload,
        actor=req.actor_email
    )

    return ActionResponse(
        id=action_record.id,
        call_ref=call.call_ref,
        action=action_record.action,
        actor_email=req.actor_email,
        audit_hash=audit_entry.payload_hash,
        created_at=action_record.created_at
    )
