from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AuditLog
from app.schemas import AuditLogSchema

router = APIRouter(prefix="/v1", tags=["Audit Log"])

@router.get("/audit", response_model=List[AuditLogSchema])
def get_audit_trail(db: Session = Depends(get_db)):
    """
    Returns signed cryptographic event audit trail.
    """
    return db.query(AuditLog).order_by(AuditLog.id.desc()).all()
