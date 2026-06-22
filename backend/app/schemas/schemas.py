"""
Pydantic v2 schemas for request/response validation.
"""
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    patient = "patient"
    doctor = "doctor"
    health_worker = "health_worker"
    admin = "admin"

class SeverityLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    pending = "pending"

class ConversationStatus(str, Enum):
    active = "active"
    escalated = "escalated"
    resolved = "resolved"
    closed = "closed"

class MessageRole(str, Enum):
    patient = "patient"
    ai = "ai"
    doctor = "doctor"

class AlertLevel(str, Enum):
    normal = "normal"
    watch = "watch"
    warning = "warning"
    critical = "critical"

class DispenserState(str, Enum):
    locked = "locked"
    dose_window_open = "dose_window_open"
    dispensed = "dispensed"
    missed = "missed"

# Auth
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    role: UserRole = UserRole.patient

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    city: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# Patient
class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: List[str] = []
    chronic_conditions: List[str] = []
    last_risk_score: Optional[int] = None
    last_risk_band: Optional[str] = None

class PatientUpdate(BaseModel):
    gender: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None

# Doctor
class DoctorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    specialty: str
    hospital: Optional[str] = None
    city: Optional[str] = None
    is_available: bool

# Messages
class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    conversation_id: str
    role: MessageRole
    content: str
    metadata_: Optional[dict] = None
    created_at: datetime

class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    severity: SeverityLevel
    status: ConversationStatus
    chief_complaint: Optional[str] = None
    ai_summary: Optional[str] = None
    assigned_doctor_id: Optional[str] = None
    region: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: List[MessageOut] = []

class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    severity: SeverityLevel
    status: ConversationStatus
    chief_complaint: Optional[str] = None
    created_at: datetime

class ChatMessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=4000)

class StartConversationRequest(BaseModel):
    region: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

# Prescriptions
class MedicationItem(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str

class PrescriptionCreate(BaseModel):
    patient_id: str
    conversation_id: Optional[str] = None
    medications: List[MedicationItem]
    diagnosis: Optional[str] = None
    notes: Optional[str] = None

class PrescriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    doctor_id: str
    medications: list
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

# Vitals
class VitalReadingCreate(BaseModel):
    reading_type: str
    value: float
    unit: str

class VitalReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    reading_type: str
    value: float
    unit: str
    source: str
    recorded_at: datetime

# Surveillance
class SurveillanceReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    region: str
    latitude: float
    longitude: float
    symptom_category: str
    case_count: int
    risk_score: float
    alert_level: AlertLevel
    created_at: datetime

# IoT
class DispenserDeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    device_name: str
    medication_name: str
    dosage: str
    schedule_times: list
    state: DispenserState
    is_simulated: bool

class DispenserEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    device_id: str
    event_type: str
    from_state: Optional[str] = None
    to_state: Optional[str] = None
    payload: Optional[dict] = None
    created_at: datetime

# Access grants
class AccessGrantCreate(BaseModel):
    doctor_id: str

class AccessGrantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    doctor_id: str
    is_active: bool
    granted_at: datetime

# Doctor queue
class DoctorQueueItem(BaseModel):
    conversation_id: str
    patient_name: str
    chief_complaint: Optional[str] = None
    severity: SeverityLevel
    created_at: datetime
    ai_summary: Optional[str] = None
    last_risk_score: Optional[int] = None
    last_risk_band: Optional[str] = None
    patient_city: Optional[str] = None

