"""
Risk Score router — patient risk stratification endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import User, Patient, Doctor, AccessGrant
from app.core.deps import get_current_user
from app.services.risk_score_service import compute_risk_score

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/{patient_id}")
def get_risk_score(
    patient_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get the risk score for a patient.
    - Patients can access their own score.
    - Doctors can access any patient they have an access grant for.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Access check
    if user.role == "patient":
        if patient.user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if doctor:
            grant = db.query(AccessGrant).filter(
                AccessGrant.patient_id == patient_id,
                AccessGrant.doctor_id == doctor.id,
                AccessGrant.is_active == True,
            ).first()
            if not grant:
                raise HTTPException(status_code=403, detail="No access grant for this patient")
        else:
            raise HTTPException(status_code=403, detail="Doctor profile not found")

    result = compute_risk_score(patient_id, db)
    return result


@router.get("/my/score")
def get_my_risk_score(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the current patient's own risk score."""
    if user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can access this endpoint")

    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    return compute_risk_score(patient.id, db)


from fastapi import WebSocket, WebSocketDisconnect
from app.core.security import decode_access_token
from app.core.ws_manager import manager

@router.websocket("/ws/{patient_id}")
async def risk_ws(websocket: WebSocket, patient_id: str):
    """WebSocket for real-time risk score updates of a patient."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, f"risk:{patient_id}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket, f"risk:{patient_id}")

