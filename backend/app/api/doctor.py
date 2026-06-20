"""
Doctor router — queue, patient access, prescriptions.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.db.session import get_db
from app.models.models import (
    User, Doctor, Patient, TriageConversation, Prescription, AccessGrant,
    VitalReading, Message,
)
from app.schemas.schemas import (
    DoctorQueueItem, ConversationOut, PrescriptionCreate, PrescriptionOut,
    PatientOut, VitalReadingOut, AccessGrantOut,
)
from app.core.deps import get_current_user, require_role
from app.core.security import decode_access_token
from app.core.ws_manager import manager

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


@router.get("/queue", response_model=List[DoctorQueueItem])
def get_queue(db: Session = Depends(get_db), user: User = Depends(require_role("doctor"))):
    """Get all escalated cases in the doctor queue."""
    cases = (
        db.query(TriageConversation)
        .filter(TriageConversation.status == "escalated")
        .order_by(TriageConversation.created_at.desc())
        .all()
    )
    result = []
    for c in cases:
        patient = db.query(Patient).filter(Patient.id == c.patient_id).first()
        patient_user = db.query(User).filter(User.id == patient.user_id).first() if patient else None
        result.append(DoctorQueueItem(
            conversation_id=c.id,
            patient_name=patient_user.full_name if patient_user else "Unknown",
            chief_complaint=c.chief_complaint,
            severity=c.severity,
            created_at=c.created_at,
            ai_summary=c.ai_summary,
        ))
    return result


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient_record(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("doctor")),
):
    """View a patient's record (requires access grant)."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    grant = db.query(AccessGrant).filter(
        AccessGrant.patient_id == patient_id,
        AccessGrant.doctor_id == doctor.id,
        AccessGrant.is_active == True,
    ).first()
    if not grant:
        raise HTTPException(status_code=403, detail="No active access grant for this patient")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/patients/{patient_id}/vitals", response_model=List[VitalReadingOut])
def get_patient_vitals(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("doctor")),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    grant = db.query(AccessGrant).filter(
        AccessGrant.patient_id == patient_id,
        AccessGrant.doctor_id == doctor.id,
        AccessGrant.is_active == True,
    ).first()
    if not grant:
        raise HTTPException(status_code=403, detail="No access grant")

    return (
        db.query(VitalReading)
        .filter(VitalReading.patient_id == patient_id)
        .order_by(VitalReading.recorded_at.desc())
        .limit(100)
        .all()
    )


@router.get("/conversations/{conv_id}", response_model=ConversationOut)
def get_conversation_as_doctor(
    conv_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("doctor")),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    conv = db.query(TriageConversation).filter(TriageConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    grant = db.query(AccessGrant).filter(
        AccessGrant.patient_id == conv.patient_id,
        AccessGrant.doctor_id == doctor.id,
        AccessGrant.is_active == True,
    ).first()
    if not grant:
        raise HTTPException(status_code=403, detail="No access to this patient")

    return conv


@router.post("/prescriptions", response_model=PrescriptionOut, status_code=201)
def create_prescription(
    req: PrescriptionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("doctor")),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    grant = db.query(AccessGrant).filter(
        AccessGrant.patient_id == req.patient_id,
        AccessGrant.doctor_id == doctor.id,
        AccessGrant.is_active == True,
    ).first()
    if not grant:
        raise HTTPException(status_code=403, detail="No access to this patient")

    prescription = Prescription(
        patient_id=req.patient_id,
        doctor_id=doctor.id,
        conversation_id=req.conversation_id,
        medications=[m.model_dump() for m in req.medications],
        diagnosis=req.diagnosis,
        notes=req.notes,
    )
    db.add(prescription)

    # If linked to a conversation, mark it resolved
    if req.conversation_id:
        conv = db.query(TriageConversation).filter(
            TriageConversation.id == req.conversation_id
        ).first()
        if conv:
            conv.status = "resolved"

    db.commit()
    db.refresh(prescription)
    return prescription


@router.websocket("/ws/queue")
async def doctor_queue_ws(websocket: WebSocket):
    """WebSocket for real-time doctor queue updates."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_access_token(token)
    if not payload or payload.get("role") != "doctor":
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, "doctor_queue")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket, "doctor_queue")
