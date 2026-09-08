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
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Users
        users_data = [
            {"name": "Priya Nair", "email": "priya.nair@unionbank.in", "role": "agent"},
            {"name": "Kavita Rao", "email": "kavita.rao@unionbank.in", "role": "hr"},
            {"name": "Arjun Mehta", "email": "arjun.mehta@unionbank.in", "role": "soc"},
            {"name": "Nisha Patel", "email": "nisha.patel@unionbank.in", "role": "admin"},
        ]
        
        users_map = {}
        for u in users_data:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                existing = User(**u)
                db.add(existing)
                db.commit()
                db.refresh(existing)
            users_map[u["role"]] = existing
        logger.info("Users seeded successfully.")

        # 2. Seed People
        people_data = [
            {
                "person_code": "VS-00182",
                "name": "Arjun Mehta",
                "role_title": "Chief Financial Officer",
                "org": "Union Bank Demo",
                "official_callback": "+91 98200 00182",
                "consent": "GRANTED",
                "status": "ACTIVE"
            },
            {
                "person_code": "VS-00147",
                "name": "Sarah Lin",
                "role_title": "Chief Executive Officer",
                "org": "Union Bank Demo",
                "official_callback": "+91 98200 00147",
                "consent": "GRANTED",
                "status": "ACTIVE"
            },
            {
                "person_code": "VS-00209",
                "name": "Marcus Reed",
                "role_title": "VP, Treasury Operations",
                "org": "Union Bank Demo",
                "official_callback": "+91 98200 00209",
                "consent": "GRANTED",
                "status": "ACTIVE"
            },
            {
                "person_code": "VS-00094",
                "name": "Julia Park",
                "role_title": "Head of Customer Trust",
                "org": "Union Bank Demo",
                "official_callback": "+91 98200 00094",
                "consent": "GRANTED",
                "status": "REVIEW"
            },
            {
                "person_code": "UB-CFO-0192",
                "name": "Rahul Sharma",
                "role_title": "Chief Financial Officer",
                "org": "Union Bank Demo",
                "official_callback": "+91 22 2262 1100",
                "consent": "GRANTED",
                "status": "ACTIVE"
            }
        ]

        people_map = {}
        for p in people_data:
            existing = db.query(Person).filter(Person.person_code == p["person_code"]).first()
            if not existing:
                existing = Person(**p)
                db.add(existing)
                db.commit()
                db.refresh(existing)
            people_map[p["person_code"]] = existing
        logger.info("People seeded successfully.")

        # 3. Seed Voiceprint for CFO Rahul Sharma
        cfo = people_map["UB-CFO-0192"]
        voiceprint_exists = db.query(Voiceprint).filter(Voiceprint.person_id == cfo.id).first()
        
        if not voiceprint_exists:
            sample_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "samples", "cfo_real.wav")
            if os.path.exists(sample_file):
                with open(sample_file, "rb") as f:
                    y, sr, duration = load_audio_from_bytes(f.read())
                emb = extract_embedding(y, sr)
            else:
                # Mock embedding fallback if file not pre-generated
                emb = [0.05 * (i % 7) for i in range(192)]
                duration = 3.5

            vp = Voiceprint(
                person_id=cfo.id,
                embedding_json=json.dumps(emb),
                quality_score=99.2,
                duration_sec=duration
            )
            db.add(vp)
            db.commit()
            db.refresh(vp)
            
            record_audit_event(
                db,
                event_type="ENROLL",
                ref_id=cfo.person_code,
                payload={"person_code": cfo.person_code, "name": cfo.name, "enrolled_by": "SYSTEM"}
            )
            logger.info(f"Enrolled voiceprint for {cfo.name}")

        # 4. Seed Canonical Demo Calls (VK-4419 BLOCK, VK-4420 ALLOW)
        call_19 = db.query(Call).filter(Call.call_ref == "VK-4419").first()
        if not call_19:
            c19 = Call(
                call_ref="VK-4419",
                claimed_person_id=cfo.id,
                agent_id=users_map["agent"].id,
                caller_number="+91 98200 88123",
                intent="High-Value Fund Transfer (₹2.5 Crore)",
                amount_inr=25000000.0,
                ai_fake_score=91.0,
                speaker_match=84.0,
                risk=88.0,
                trust=12.0,
                decision="BLOCK",
                reasons=json.dumps(["synthetic_artifacts", "enrolled_speaker_match_high", "pitch_too_smooth"])
            )
            db.add(c19)
            db.commit()
            record_audit_event(
                db,
                event_type="DETECT",
                ref_id="VK-4419",
                payload={"call_ref": "VK-4419", "decision": "BLOCK", "risk": 88.0, "ai_fake": 91.0}
            )
            logger.info("Seeded canonical call VK-4419 (BLOCK).")

        call_20 = db.query(Call).filter(Call.call_ref == "VK-4420").first()
        if not call_20:
            c20 = Call(
                call_ref="VK-4420",
                claimed_person_id=cfo.id,
                agent_id=users_map["agent"].id,
                caller_number="+91 22 2262 1100",
                intent="Routine Beneficiary Update",
                amount_inr=50000.0,
                ai_fake_score=12.0,
                speaker_match=92.0,
                risk=14.0,
                trust=86.0,
                decision="ALLOW",
                reasons=json.dumps(["enrolled_speaker_match_high", "normal_acoustic_profile"])
            )
            db.add(c20)
            db.commit()
            record_audit_event(
                db,
                event_type="DETECT",
                ref_id="VK-4420",
                payload={"call_ref": "VK-4420", "decision": "ALLOW", "risk": 14.0, "ai_fake": 12.0}
            )
            logger.info("Seeded canonical call VK-4420 (ALLOW).")

        logger.info("Database seeding completed cleanly.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
