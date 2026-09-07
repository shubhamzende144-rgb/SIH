from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class UserSchema(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PersonSchema(BaseModel):
    id: int
    person_code: str
    name: str
    role_title: str
    org: str
    official_callback: str
    consent: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class VoiceprintSchema(BaseModel):
    id: int
    person_id: int
    quality_score: float
    duration_sec: float
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class EnrollResponse(BaseModel):
    person_id: int
    person_code: str
    name: str
    quality_score: float
    duration_sec: float
    audit_hash: str

class ScoreBreakdown(BaseModel):
    ai_fake_score: float
    speaker_match: float
    meaning: str

class DetectResponse(BaseModel):
    call_ref: str
    person_claimed: Optional[str] = "Unknown / Unenrolled"
    final_decision: str  # ALLOW, STEP_UP, BLOCK
    risk: float
    trust: float
    breakdown: ScoreBreakdown
    reasons: List[str]
    action: str
    official_callback: Optional[str] = None

class ActionRequest(BaseModel):
    action: str  # ALLOW, STEP_UP, BLOCK
    actor_email: str
    note: Optional[str] = None

class ActionResponse(BaseModel):
    id: int
    call_ref: str
    action: str
    actor_email: str
    audit_hash: str
    created_at: datetime

class CallSchema(BaseModel):
    id: int
    call_ref: str
    person_claimed: Optional[str] = None
    caller_number: Optional[str] = None
    intent: Optional[str] = None
    amount_inr: float
    ai_fake_score: float
    speaker_match: float
    risk: float
    trust: float
    decision: str
    reasons: List[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AuditLogSchema(BaseModel):
    id: int
    event_type: str
    ref_id: str
    payload_hash: str
    actor: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
