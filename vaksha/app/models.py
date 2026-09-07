from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from app.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, nullable=False)  # agent, hr, soc, admin
    created_at = Column(DateTime, default=datetime.utcnow)

class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True, index=True)
    person_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    role_title = Column(String, nullable=False)
    org = Column(String, nullable=False)
    official_callback = Column(String, nullable=False)
    consent = Column(String, default="GRANTED")
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)

    voiceprints = relationship("Voiceprint", back_populates="person", cascade="all, delete-orphan")

class Voiceprint(Base):
    __tablename__ = "voiceprints"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("people.id"), nullable=False)
    embedding_json = Column(Text, nullable=False)  # JSON string array of embedding floats
    quality_score = Column(Float, default=100.0)
    duration_sec = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    person = relationship("Person", back_populates="voiceprints")

class Call(Base):
    __tablename__ = "calls"

    id = Column(Integer, primary_key=True, index=True)
    call_ref = Column(String, unique=True, index=True, nullable=False)
    claimed_person_id = Column(Integer, ForeignKey("people.id"), nullable=True)
    agent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    caller_number = Column(String, nullable=True)
    intent = Column(String, nullable=True)
    amount_inr = Column(Float, default=0.0)
    ai_fake_score = Column(Float, nullable=False)
    speaker_match = Column(Float, nullable=False)
    risk = Column(Float, nullable=False)
    trust = Column(Float, nullable=False)
    decision = Column(String, nullable=False)  # ALLOW, STEP_UP, BLOCK
    reasons = Column(Text, nullable=False)  # JSON array string or comma-separated
    created_at = Column(DateTime, default=datetime.utcnow)

    claimed_person = relationship("Person")
    agent = relationship("User")
    actions = relationship("Action", back_populates="call", cascade="all, delete-orphan")

class Action(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(Integer, ForeignKey("calls.id"), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)  # ALLOW, STEP_UP, BLOCK
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    call = relationship("Call", back_populates="actions")
    actor = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)  # ENROLL, DETECT, ACTION
    ref_id = Column(String, nullable=False)
    payload_hash = Column(String, nullable=False)
    actor = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
