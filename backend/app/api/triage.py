"""
Triage router — chat endpoints + WebSocket streaming for AI triage conversations.
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import User, Patient, TriageConversation, Message
from app.schemas.schemas import (
    ConversationOut, ConversationSummary, ChatMessageIn,
    StartConversationRequest, MessageOut,
)
from app.core.deps import get_current_user, require_role
from app.core.security import decode_access_token
from app.core.ws_manager import manager
from app.services.ai_service import triage_chat, triage_chat_stream, extract_severity
from app.services.surveillance_service import process_surveillance_alert

router = APIRouter(prefix="/api/triage", tags=["triage"])


def _get_patient_context(patient: Patient, user: User) -> dict:
    """Build patient context dict for AI service."""
    age = None
    if patient.date_of_birth:
        age = (datetime.now(timezone.utc) - patient.date_of_birth).days // 365
    return {
        "name": user.full_name,
        "age": age,
        "gender": patient.gender,
        "allergies": patient.allergies or [],
        "conditions": patient.chronic_conditions or [],
        "blood_group": patient.blood_group,
    }


@router.post("/conversations", response_model=ConversationOut, status_code=201)
def start_conversation(
    req: StartConversationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    """Start a new triage conversation."""
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    conv = TriageConversation(
        patient_id=patient.id,
        region=req.region,
        latitude=req.latitude,
        longitude=req.longitude,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    """List all triage conversations for the current patient."""
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    convs = (
        db.query(TriageConversation)
        .filter(TriageConversation.patient_id == patient.id)
        .order_by(TriageConversation.created_at.desc())
        .all()
    )
    return convs


@router.get("/conversations/{conv_id}", response_model=ConversationOut)
def get_conversation(
    conv_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific conversation with all messages."""
    conv = db.query(TriageConversation).filter(TriageConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Access check: patient owns it, or doctor has access grant
    if user.role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient or conv.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return conv


@router.post("/conversations/{conv_id}/messages", response_model=MessageOut)
async def send_message_sync(
    conv_id: str,
    msg: ChatMessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    """Send a message and get AI response synchronously (non-streaming fallback)."""
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    conv = db.query(TriageConversation).filter(
        TriageConversation.id == conv_id,
        TriageConversation.patient_id == patient.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save patient message
    patient_msg = Message(conversation_id=conv.id, role="patient", content=msg.content)
    db.add(patient_msg)
    db.flush()

    # Update chief complaint if first message
    if not conv.chief_complaint:
        conv.chief_complaint = msg.content[:200]

    # Build history for AI
    history = [{"role": m.role, "content": m.content} for m in conv.messages]
    patient_context = _get_patient_context(patient, user)

    # Call AI
    try:
        ai_response = triage_chat(history, patient_context)
    except Exception as e:
        ai_response = f"I apologize, but I'm having trouble processing your request right now. Please try again in a moment. (Error: {str(e)[:100]})"

    # Save AI message
    ai_msg = Message(conversation_id=conv.id, role="ai", content=ai_response)
    db.add(ai_msg)

    # Check severity
    severity = extract_severity(ai_response)
    if severity:
        conv.severity = severity
        if severity == "high" and conv.status == "active":
            conv.status = "escalated"
            conv.ai_summary = ai_response[:500]

    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ai_msg)

    # Process surveillance clustering
    try:
        await process_surveillance_alert(conv.id, db)
    except Exception as e:
        print(f"[Surveillance] Process alert error: {e}")

    return ai_msg


@router.websocket("/ws/{conv_id}")
async def triage_ws(websocket: WebSocket, conv_id: str):
    """WebSocket endpoint for streaming AI triage chat."""
    # Authenticate via query param token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing auth token")
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload.get("sub")
    db = next(get_db())

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=4001, reason="User not found")
            return

        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient:
            await websocket.close(code=4001, reason="Patient profile not found")
            return

        conv = db.query(TriageConversation).filter(
            TriageConversation.id == conv_id,
            TriageConversation.patient_id == patient.id,
        ).first()
        if not conv:
            await websocket.close(code=4004, reason="Conversation not found")
            return

        await websocket.accept()
        channel = f"chat:{conv_id}"

        while True:
            data = await websocket.receive_json()
            user_content = data.get("content", "").strip()
            if not user_content:
                continue

            # Save patient message
            patient_msg = Message(conversation_id=conv.id, role="patient", content=user_content)
            db.add(patient_msg)
            db.flush()

            if not conv.chief_complaint:
                conv.chief_complaint = user_content[:200]

            # Send confirmation of received message
            await websocket.send_json({
                "type": "message_saved",
                "message": {
                    "id": patient_msg.id,
                    "role": "patient",
                    "content": user_content,
                    "created_at": patient_msg.created_at.isoformat(),
                }
            })

            # Build history
            db.refresh(conv)
            history = [{"role": m.role, "content": m.content} for m in conv.messages]
            patient_context = _get_patient_context(patient, user)

            # Stream AI response
            await websocket.send_json({"type": "ai_typing"})

            full_response = ""
            try:
                async for chunk in triage_chat_stream(history, patient_context):
                    full_response += chunk
                    await websocket.send_json({"type": "ai_chunk", "content": chunk})
            except Exception as e:
                full_response = f"I apologize, but I'm experiencing a temporary issue. Please try again. (Error: {str(e)[:100]})"
                await websocket.send_json({"type": "ai_chunk", "content": full_response})

            # Save AI message
            ai_msg = Message(conversation_id=conv.id, role="ai", content=full_response)
            db.add(ai_msg)

            # Check severity
            severity = extract_severity(full_response)
            if severity:
                conv.severity = severity
                if severity == "high" and conv.status == "active":
                    conv.status = "escalated"
                    conv.ai_summary = full_response[:500]
                    # Broadcast to doctor queue
                    await manager.broadcast("doctor_queue", {
                        "type": "new_escalation",
                        "conversation_id": conv.id,
                        "patient_name": user.full_name,
                        "chief_complaint": conv.chief_complaint,
                        "severity": "high",
                    })

            conv.updated_at = datetime.now(timezone.utc)
            db.commit()

            # Process surveillance clustering
            try:
                await process_surveillance_alert(conv.id, db)
            except Exception as e:
                print(f"[Surveillance] Process alert error: {e}")

            await websocket.send_json({
                "type": "ai_complete",
                "message": {
                    "id": ai_msg.id,
                    "role": "ai",
                    "content": full_response,
                    "created_at": ai_msg.created_at.isoformat(),
                },
                "severity": conv.severity,
                "status": conv.status,
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        db.close()
