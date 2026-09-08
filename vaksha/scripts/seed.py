import os
import sys
import json
import logging

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import engine, SessionLocal, Base
from app.models import User, Person, Voiceprint, Call, AuditLog
from app.services.audio import load_audio_from_bytes
from app.services.speaker import extract_embedding
from app.services.audit import record_audit_event

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vaksha.seed")

def seed_database():
    logger.info("Initializing clean database schema...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Seed core system admin user if missing
        admin = db.query(User).filter(User.email == "security.admin@unionbank.in").first()
        if not admin:
            admin = User(name="Security Admin", email="security.admin@unionbank.in", role="admin")
            db.add(admin)
            db.commit()
        logger.info("Clean database schema ready.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
