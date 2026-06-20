"""
SQLAlchemy models for VitalBridge.

Tables:
  - users           (base auth: email, hashed_password, role)
  - patients        (1:1 with user, demographics + medical info)
  - doctors         (1:1 with user, specialty + license)
  - triage_conversations  (chat sessions between patient & AI)
  - messages        (individual messages within a conversation)
  - prescriptions   (doctor → patient)
  - vital_readings  (patient vitals: BP, temp, SpO2, etc.)
  - surveillance_reports  (aggregated region-level symptom data)
  - dispenser_devices     (virtual IoT pill dispensers)
  - dispenser_events      (state-machine event log)
  - access_grants         (patient grants doctor access)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime,
    ForeignKey, Enum as SAEnum, JSON,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


import base64
import hashlib
from cryptography.fernet import Fernet
from sqlalchemy.types import TypeDecorator, String as SAString

class EncryptedString(TypeDecorator):
    """SQLAlchemy custom type that transparently encrypts and decrypts values using AES-256 (Fernet)."""
    impl = SAString

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from app.core.config import get_settings
        settings = get_settings()
        secret_bytes = settings.SECRET_KEY.encode()
        derived_key = hashlib.sha256(secret_bytes).digest()
        self.fernet = Fernet(base64.urlsafe_b64encode(derived_key))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        # Encrypt the plaintext string
        encrypted_bytes = self.fernet.encrypt(value.encode())
        return encrypted_bytes.decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            # Decrypt the ciphertext string
            decrypted_bytes = self.fernet.decrypt(value.encode())
            return decrypted_bytes.decode()
        except Exception:
            # Fallback to plain value if not encrypted (e.g. legacy seed data)
            return value

# ── Users ────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(SAEnum("patient", "doctor", "health_worker", "admin", name="user_role"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    patient_profile = relationship("Patient", back_populates="user", uselist=False)
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False)


# ── Patient ──────────────────────────────────────────────────

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=new_uuid)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    date_of_birth = Column(DateTime, nullable=True)
    gender = Column(String, nullable=True)
    phone = Column(EncryptedString, nullable=True)
    address = Column(EncryptedString, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    pin_code = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    allergies = Column(JSON, default=list)  # list of strings
    chronic_conditions = Column(JSON, default=list)  # list of strings
    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(EncryptedString, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    user = relationship("User", back_populates="patient_profile")
    triage_conversations = relationship("TriageConversation", back_populates="patient")
    prescriptions = relationship("Prescription", back_populates="patient")
    vital_readings = relationship("VitalReading", back_populates="patient")
    dispenser_devices = relationship("DispenserDevice", back_populates="patient")
    access_grants = relationship("AccessGrant", back_populates="patient")


# ── Doctor ───────────────────────────────────────────────────

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(String, primary_key=True, default=new_uuid)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    specialty = Column(String, nullable=False)
    license_number = Column(String, nullable=True)
    hospital = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    years_experience = Column(Integer, nullable=True)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    user = relationship("User", back_populates="doctor_profile")
    assigned_conversations = relationship("TriageConversation", back_populates="assigned_doctor")
    prescriptions = relationship("Prescription", back_populates="doctor")
    access_grants = relationship("AccessGrant", back_populates="doctor")


# ── Triage Conversations ────────────────────────────────────

class TriageConversation(Base):
    __tablename__ = "triage_conversations"

    id = Column(String, primary_key=True, default=new_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    severity = Column(SAEnum("low", "medium", "high", "pending", name="severity_level"), default="pending")
    status = Column(SAEnum("active", "escalated", "resolved", "closed", name="conversation_status"), default="active")
    chief_complaint = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    assigned_doctor_id = Column(String, ForeignKey("doctors.id"), nullable=True)
    region = Column(String, nullable=True)  # for surveillance aggregation
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="triage_conversations")
    assigned_doctor = relationship("Doctor", back_populates="assigned_conversations")
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")


# ── Messages ─────────────────────────────────────────────────

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=new_uuid)
    conversation_id = Column(String, ForeignKey("triage_conversations.id"), nullable=False)
    role = Column(SAEnum("patient", "ai", "doctor", name="message_role"), nullable=False)
    content = Column(Text, nullable=False)
    metadata_ = Column("metadata", JSON, nullable=True)  # severity scores, follow-up flags, etc.
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    conversation = relationship("TriageConversation", back_populates="messages")


# ── Prescriptions ────────────────────────────────────────────

class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String, primary_key=True, default=new_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(String, ForeignKey("doctors.id"), nullable=False)
    conversation_id = Column(String, ForeignKey("triage_conversations.id"), nullable=True)
    medications = Column(JSON, nullable=False)  # list of {name, dosage, frequency, duration}
    diagnosis = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="prescriptions")
    doctor = relationship("Doctor", back_populates="prescriptions")


# ── Vital Readings ───────────────────────────────────────────

class VitalReading(Base):
    __tablename__ = "vital_readings"

    id = Column(String, primary_key=True, default=new_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    reading_type = Column(String, nullable=False)  # bp_systolic, bp_diastolic, temperature, spo2, heart_rate, weight
    value = Column(Float, nullable=False)
    unit = Column(String, nullable=False)  # mmHg, °C, %, bpm, kg
    source = Column(String, default="manual")  # manual, iot_simulator
    recorded_at = Column(DateTime, default=utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="vital_readings")


# ── Surveillance Reports ────────────────────────────────────

class SurveillanceReport(Base):
    __tablename__ = "surveillance_reports"

    id = Column(String, primary_key=True, default=new_uuid)
    region = Column(String, nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    symptom_category = Column(String, nullable=False)  # respiratory, gastrointestinal, fever, etc.
    case_count = Column(Integer, default=0)
    risk_score = Column(Float, default=0.0)  # 0.0 – 1.0
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    alert_level = Column(SAEnum("normal", "watch", "warning", "critical", name="alert_level"), default="normal")
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)


# ── IoT Dispenser ────────────────────────────────────────────

class DispenserDevice(Base):
    __tablename__ = "dispenser_devices"

    id = Column(String, primary_key=True, default=new_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    device_name = Column(String, nullable=False)
    medication_name = Column(String, nullable=False)
    dosage = Column(String, nullable=False)
    schedule_times = Column(JSON, nullable=False)  # list of "HH:MM" strings
    state = Column(
        SAEnum("locked", "dose_window_open", "dispensed", "missed", name="dispenser_state"),
        default="locked",
    )
    is_simulated = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="dispenser_devices")
    events = relationship("DispenserEvent", back_populates="device", order_by="DispenserEvent.created_at")


class DispenserEvent(Base):
    __tablename__ = "dispenser_events"

    id = Column(String, primary_key=True, default=new_uuid)
    device_id = Column(String, ForeignKey("dispenser_devices.id"), nullable=False)
    event_type = Column(String, nullable=False)  # state_change, dose_taken, dose_missed, alert
    from_state = Column(String, nullable=True)
    to_state = Column(String, nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    # Relationships
    device = relationship("DispenserDevice", back_populates="events")


# ── Access Grants ────────────────────────────────────────────

class AccessGrant(Base):
    __tablename__ = "access_grants"

    id = Column(String, primary_key=True, default=new_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(String, ForeignKey("doctors.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    granted_at = Column(DateTime, default=utcnow)
    revoked_at = Column(DateTime, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="access_grants")
    doctor = relationship("Doctor", back_populates="access_grants")
