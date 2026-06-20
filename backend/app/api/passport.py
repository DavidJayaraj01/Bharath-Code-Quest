"""
Health Passport router — patient profile, vitals, prescriptions, visit history.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.models import User, Patient, VitalReading, Prescription, TriageConversation
from app.schemas.schemas import (
    PatientOut, PatientUpdate, VitalReadingOut, VitalReadingCreate,
    PrescriptionOut, ConversationSummary,
)
from app.core.deps import get_current_user, require_role

router = APIRouter(prefix="/api/passport", tags=["passport"])


@router.get("/profile", response_model=PatientOut)
def get_profile(db: Session = Depends(get_db), user: User = Depends(require_role("patient"))):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return patient


@router.patch("/profile", response_model=PatientOut)
def update_profile(
    updates: PatientUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return patient


@router.get("/vitals", response_model=List[VitalReadingOut])
def get_vitals(
    reading_type: str = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    q = db.query(VitalReading).filter(VitalReading.patient_id == patient.id)
    if reading_type:
        q = q.filter(VitalReading.reading_type == reading_type)
    return q.order_by(VitalReading.recorded_at.desc()).limit(limit).all()


@router.post("/vitals", response_model=VitalReadingOut, status_code=201)
def log_vital(
    reading: VitalReadingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    vital = VitalReading(
        patient_id=patient.id,
        reading_type=reading.reading_type,
        value=reading.value,
        unit=reading.unit,
        source="manual",
    )
    db.add(vital)
    db.commit()
    db.refresh(vital)
    return vital


@router.get("/prescriptions", response_model=List[PrescriptionOut])
def get_prescriptions(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient.id)
        .order_by(Prescription.created_at.desc())
        .all()
    )


@router.get("/history", response_model=List[ConversationSummary])
def get_visit_history(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return (
        db.query(TriageConversation)
        .filter(TriageConversation.patient_id == patient.id)
        .order_by(TriageConversation.created_at.desc())
        .all()
    )
