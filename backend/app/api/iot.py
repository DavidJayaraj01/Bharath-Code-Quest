"""
IoT router — dispenser device management and event retrieval.
"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.models import User, Patient, DispenserDevice, DispenserEvent
from app.schemas.schemas import DispenserDeviceOut, DispenserEventOut
from app.core.deps import get_current_user, require_role
from app.core.security import decode_access_token
from app.core.ws_manager import manager

router = APIRouter(prefix="/api/iot", tags=["iot"])


@router.get("/devices", response_model=List[DispenserDeviceOut])
def get_devices(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return db.query(DispenserDevice).filter(DispenserDevice.patient_id == patient.id).all()


@router.get("/admin/devices")
def get_admin_devices(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("health_worker", "doctor", "admin")),
):
    """Get all dispenser devices with calculated adherence rate for surveillance."""
    from app.models.models import Patient
    devices = db.query(DispenserDevice).all()
    out = []
    for d in devices:
        patient = db.query(Patient).filter(Patient.id == d.patient_id).first()
        p_user = db.query(User).filter(User.id == patient.user_id).first() if patient else None
        
        # Calculate adherence rate
        events = db.query(DispenserEvent).filter(DispenserEvent.device_id == d.id).all()
        taken_count = sum(1 for e in events if e.event_type == "dose_taken")
        missed_count = sum(1 for e in events if e.event_type == "dose_missed" or e.to_state == "missed")
        total_adherence_events = taken_count + missed_count
        
        adherence_rate = 100.0
        if total_adherence_events > 0:
            adherence_rate = round((taken_count / total_adherence_events) * 100.0, 1)
            
        last_event = (
            db.query(DispenserEvent)
            .filter(DispenserEvent.device_id == d.id)
            .order_by(DispenserEvent.created_at.desc())
            .first()
        )
        last_event_time = last_event.created_at.isoformat() if last_event else None
        
        # Calculate age
        age = None
        if patient and patient.date_of_birth:
            from datetime import datetime, timezone
            age = (datetime.now(timezone.utc) - patient.date_of_birth.replace(tzinfo=timezone.utc)).days // 365
            
        out.append({
            "device_id": d.id,
            "device_name": d.device_name,
            "patient_name": p_user.full_name if p_user else "Unknown Patient",
            "patient_age": age,
            "patient_gender": patient.gender if patient else None,
            "patient_city": patient.city if patient else None,
            "medication_name": d.medication_name,
            "dosage": d.dosage,
            "state": d.state,
            "adherence_rate": adherence_rate,
            "last_event_time": last_event_time,
            "is_simulated": d.is_simulated,
        })
    return out


@router.get("/devices/{device_id}/events", response_model=List[DispenserEventOut])
def get_device_events(
    device_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    device = db.query(DispenserDevice).filter(DispenserDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    return (
        db.query(DispenserEvent)
        .filter(DispenserEvent.device_id == device_id)
        .order_by(DispenserEvent.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/devices/{device_id}/take-dose")
async def manual_take_dose(
    device_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually trigger a dose-taken event (for demo/hackathon presentations)."""
    device = db.query(DispenserDevice).filter(DispenserDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    from datetime import datetime, timezone

    # Record dose_taken event
    event = DispenserEvent(
        device_id=device.id,
        event_type="dose_taken",
        from_state=device.state,
        to_state="dispensed",
        payload={
            "medication": device.medication_name,
            "dosage": device.dosage,
            "trigger": "manual",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    device.state = "dispensed"
    db.add(event)
    db.commit()

    # Broadcast to WebSocket
    await manager.broadcast(f"iot:{device.id}", {
        "type": "dispenser_event",
        "event": {
            "id": event.id,
            "device_id": event.device_id,
            "event_type": "dose_taken",
            "from_state": event.from_state,
            "to_state": "dispensed",
            "payload": event.payload,
            "created_at": event.created_at.isoformat(),
        },
    })

    # Calculate adherence
    events_list = db.query(DispenserEvent).filter(DispenserEvent.device_id == device.id).all()
    taken = sum(1 for e in events_list if e.event_type == "dose_taken")
    missed = sum(1 for e in events_list if e.event_type == "dose_missed" or e.to_state == "missed")
    total = taken + missed
    rate = round((taken / total) * 100, 1) if total > 0 else 100.0

    await manager.broadcast("surveillance", {
        "type": "dispenser_state_change",
        "device_id": device.id,
        "to_state": "dispensed",
        "adherence_rate": rate,
        "last_event_time": event.created_at.isoformat(),
    })

    return {"status": "ok", "event_type": "dose_taken", "adherence_rate": rate}


@router.post("/devices/{device_id}/miss-dose")
async def manual_miss_dose(
    device_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually trigger a dose-missed event (for demo/hackathon presentations)."""
    device = db.query(DispenserDevice).filter(DispenserDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    from datetime import datetime, timezone

    event = DispenserEvent(
        device_id=device.id,
        event_type="dose_missed",
        from_state=device.state,
        to_state="missed",
        payload={
            "medication": device.medication_name,
            "dosage": device.dosage,
            "trigger": "manual",
            "alert_type": "missed_dose",
            "message": f"Missed dose of {device.medication_name} ({device.dosage})",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    device.state = "missed"
    db.add(event)
    db.commit()

    await manager.broadcast(f"iot:{device.id}", {
        "type": "dispenser_event",
        "event": {
            "id": event.id,
            "device_id": event.device_id,
            "event_type": "dose_missed",
            "from_state": event.from_state,
            "to_state": "missed",
            "payload": event.payload,
            "created_at": event.created_at.isoformat(),
        },
    })

    await manager.broadcast(f"iot:{device.id}", {
        "type": "missed_dose_alert",
        "device_id": device.id,
        "medication": device.medication_name,
        "dosage": device.dosage,
    })

    # Send real WhatsApp notification
    try:
        from app.services.communication import send_twilio_message
        patient = db.query(Patient).filter(Patient.id == device.patient_id).first()
        p_user = db.query(User).filter(User.id == patient.user_id).first() if patient else None
        if patient and patient.phone:
            name = p_user.full_name if p_user else "Patient"
            msg_body = (
                f"VITALBRIDGE ALERT: {name} has missed their scheduled dose of {device.medication_name} ({device.dosage}). "
                f"Please check in on them."
            )
            send_twilio_message(to_phone=patient.phone, body=msg_body, is_whatsapp=True)
    except Exception as e:
        print(f"[Twilio Missed Dose Notification Error] {e}")

    events_list = db.query(DispenserEvent).filter(DispenserEvent.device_id == device.id).all()
    taken = sum(1 for e in events_list if e.event_type == "dose_taken")
    missed_count = sum(1 for e in events_list if e.event_type == "dose_missed" or e.to_state == "missed")
    total = taken + missed_count
    rate = round((taken / total) * 100, 1) if total > 0 else 100.0

    await manager.broadcast("surveillance", {
        "type": "dispenser_state_change",
        "device_id": device.id,
        "to_state": "missed",
        "adherence_rate": rate,
        "last_event_time": event.created_at.isoformat(),
    })

    return {"status": "ok", "event_type": "dose_missed", "adherence_rate": rate}


@router.post("/devices/{device_id}/reset")
async def manual_reset_device(
    device_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reset the dispenser to locked state (for demo resets)."""
    device = db.query(DispenserDevice).filter(DispenserDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    from datetime import datetime, timezone

    event = DispenserEvent(
        device_id=device.id,
        event_type="state_change",
        from_state=device.state,
        to_state="locked",
        payload={
            "medication": device.medication_name,
            "trigger": "manual_reset",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    device.state = "locked"
    db.add(event)
    db.commit()

    await manager.broadcast(f"iot:{device.id}", {
        "type": "dispenser_event",
        "event": {
            "id": event.id,
            "device_id": event.device_id,
            "event_type": "state_change",
            "from_state": event.from_state,
            "to_state": "locked",
            "payload": event.payload,
            "created_at": event.created_at.isoformat(),
        },
    })

    return {"status": "ok", "state": "locked"}


@router.websocket("/ws/{device_id}")
async def iot_ws(websocket: WebSocket, device_id: str):
    """WebSocket for live dispenser event streaming."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, f"iot:{device_id}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket, f"iot:{device_id}")

