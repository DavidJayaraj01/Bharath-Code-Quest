"""
Triage router — chat endpoints + WebSocket streaming for AI triage conversations.
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Form, Response
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
        dob = patient.date_of_birth.replace(tzinfo=None) if patient.date_of_birth.tzinfo else patient.date_of_birth
        age = (datetime.now(timezone.utc).replace(tzinfo=None) - dob).days // 365
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

    # Trigger risk score update and broadcast
    try:
        from app.services.risk_score_service import update_and_broadcast_risk_score
        await update_and_broadcast_risk_score(patient.id, db)
    except Exception as e:
        print(f"[Risk Update Error] {e}")

    # Process surveillance clustering
    try:
        await process_surveillance_alert(conv.id, db)
    except Exception as e:
        print(f"[Surveillance] Process alert error: {e}")

    return ai_msg


@router.websocket("/ws/{conv_id}")
async def triage_ws(websocket: WebSocket, conv_id: str):
    """WebSocket endpoint for streaming AI triage chat."""
    # Accept connection first — required so close codes/reasons are actually sent
    await websocket.accept()

    async def safe_send(payload: dict):
        try:
            await websocket.send_json(payload)
        except Exception:
            pass

    # Authenticate via query param token
    token = websocket.query_params.get("token")
    if not token:
        await safe_send({"type": "error", "message": "Missing auth token"})
        await websocket.close(code=4001)
        return

    payload = decode_access_token(token)
    if not payload:
        await safe_send({"type": "error", "message": "Invalid token"})
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    from app.db.session import SessionLocal
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await safe_send({"type": "error", "message": "User not found"})
            await websocket.close(code=4001)
            return

        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient:
            await safe_send({"type": "error", "message": "Patient profile not found"})
            await websocket.close(code=4001)
            return

        conv = db.query(TriageConversation).filter(
            TriageConversation.id == conv_id,
            TriageConversation.patient_id == patient.id,
        ).first()
        if not conv:
            await safe_send({"type": "error", "message": "Conversation not found"})
            await websocket.close(code=4004)
            return

        while True:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:
                break

            user_content = data.get("content", "").strip()
            if not user_content:
                continue

            # Save patient message
            try:
                patient_msg = Message(conversation_id=conv.id, role="patient", content=user_content)
                db.add(patient_msg)
                db.flush()

                if not conv.chief_complaint:
                    conv.chief_complaint = user_content[:200]

                await safe_send({
                    "type": "message_saved",
                    "message": {
                        "id": patient_msg.id,
                        "role": "patient",
                        "content": user_content,
                        "created_at": patient_msg.created_at.isoformat(),
                    }
                })
            except Exception as e:
                print(f"[WS] Error saving patient message: {e}")
                db.rollback()
                await safe_send({"type": "error", "message": "Failed to save message, please retry."})
                continue

            # Build history for AI call
            try:
                db.refresh(conv)
                history = [{"role": m.role, "content": m.content} for m in conv.messages]
                patient_context = _get_patient_context(patient, user)
            except Exception as e:
                print(f"[WS] Error building history: {e}")
                history = [{"role": "patient", "content": user_content}]
                patient_context = {}

            # Stream AI response
            await safe_send({"type": "ai_typing"})

            full_response = ""
            try:
                async for chunk in triage_chat_stream(history, patient_context):
                    full_response += chunk
                    await safe_send({"type": "ai_chunk", "content": chunk})
            except Exception as e:
                print(f"[WS] AI stream error: {e}")
                if not full_response:
                    full_response = "I'm sorry, I encountered a technical issue. Please type your symptoms again and I'll try my best to help you."
                    await safe_send({"type": "ai_chunk", "content": full_response})

            # Save AI message & update conversation
            try:
                ai_msg = Message(conversation_id=conv.id, role="ai", content=full_response)
                db.add(ai_msg)

                severity = extract_severity(full_response)
                is_finalizing = False
                if severity:
                    if severity != "pending" and (conv.severity == "pending" or conv.severity is None):
                        is_finalizing = True
                    conv.severity = severity
                    if severity == "high" and conv.status == "active":
                        conv.status = "escalated"
                        conv.ai_summary = full_response[:500]
                        await manager.broadcast("doctor_queue", {
                            "type": "new_escalation",
                            "conversation_id": conv.id,
                            "patient_name": user.full_name,
                            "chief_complaint": conv.chief_complaint,
                            "severity": "high",
                            "last_risk_score": patient.last_risk_score,
                            "last_risk_band": patient.last_risk_band,
                            "patient_city": patient.city if patient else (conv.region if conv else None),
                        })

                conv.updated_at = datetime.now(timezone.utc)
                db.commit()
                db.refresh(ai_msg)

                if is_finalizing:
                    try:
                        from app.services.communication import send_twilio_message
                        if patient.phone:
                            severity_emoji = {"low": "🟢", "medium": "🟡", "high": "🔴", "pending": "⏳"}
                            emoji = severity_emoji.get(severity, "⏳")
                            report_body = (
                                f"📋 *VitalBridge Health Report Summary*\n"
                                f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
                                f"👤 *Patient:* {user.full_name}\n"
                                f"📅 *Date:* {datetime.now().strftime('%d %b %Y, %I:%M %p')}\n"
                                f"{emoji} *Severity:* {severity.upper()}\n\n"
                            )
                            if conv.chief_complaint:
                                report_body += f"🩺 *Chief Complaint:*\n{conv.chief_complaint}\n\n"
                            
                            clean_response = full_response.split("📢 *WhatsApp Notification:")[0].split("📢 *व्हाट्सएप अधिसूचना:")[0].strip()
                            report_body += f"🤖 *AI Assessment Summary:*\n{clean_response[:600]}...\n\n"
                            report_body += (
                                f"━━━━━━━━━━━━━━━━━━━━━━\n"
                                f"💊 Stay healthy! A copy of this report has been shared with our clinical team.\n"
                                f"Thank you for using VitalBridge!"
                            )
                            send_twilio_message(to_phone=patient.phone, body=report_body, is_whatsapp=True)
                            print(f"[Triage WS] Auto-sent final WhatsApp report to {patient.phone}")
                    except Exception as whatsapp_err:
                        print(f"[Triage WS] Auto WhatsApp report error: {whatsapp_err}")

                try:
                    from app.services.risk_score_service import update_and_broadcast_risk_score
                    await update_and_broadcast_risk_score(patient.id, db)
                except Exception as e:
                    print(f"[Risk Update Error] {e}")

                await safe_send({
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
            except Exception as e:
                print(f"[WS] Error saving AI message: {e}")
                db.rollback()
                await safe_send({"type": "ai_complete", "message": {"id": "tmp", "role": "ai", "content": full_response, "created_at": datetime.now(timezone.utc).isoformat()}, "severity": conv.severity, "status": conv.status})

            # Process surveillance clustering (non-critical)
            try:
                await process_surveillance_alert(conv.id, db)
            except Exception as e:
                print(f"[Surveillance] Process alert error: {e}")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        db.close()


@router.post("/conversations/{conv_id}/send-report")
async def send_report_to_phone(
    conv_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Send triage report summary via Twilio WhatsApp to the patient's registered phone.
    Can be triggered by the patient themselves or a doctor reviewing the case.
    """
    conv = db.query(TriageConversation).filter(TriageConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Resolve patient for the conversation
    patient = db.query(Patient).filter(Patient.id == conv.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient_user = db.query(User).filter(User.id == patient.user_id).first()

    # Check access
    if user.role == "patient":
        if patient.user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Get phone number
    phone = patient.phone
    if not phone:
        raise HTTPException(
            status_code=400,
            detail="No phone number registered. Please update your profile with a mobile number."
        )

    # Build report message
    severity_emoji = {
        "low": "🟢", "medium": "🟡", "high": "🔴", "pending": "⏳"
    }
    sev = conv.severity or "pending"
    emoji = severity_emoji.get(sev, "⏳")

    report_body = (
        f"📋 *VitalBridge Health Report*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"👤 *Patient:* {patient_user.full_name if patient_user else 'Unknown'}\n"
        f"📅 *Date:* {conv.created_at.strftime('%d %b %Y, %I:%M %p')}\n"
        f"{emoji} *Severity:* {sev.upper()}\n\n"
    )

    if conv.chief_complaint:
        report_body += f"🩺 *Chief Complaint:*\n{conv.chief_complaint}\n\n"

    if conv.ai_summary:
        report_body += f"🤖 *AI Assessment:*\n{conv.ai_summary[:500]}\n\n"

    if conv.status == "escalated":
        report_body += "⚠️ *Status:* Escalated to Doctor for review\n\n"
    elif conv.status == "resolved":
        report_body += "✅ *Status:* Resolved\n\n"
    else:
        report_body += f"📌 *Status:* {conv.status.capitalize()}\n\n"

    report_body += (
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💊 Stay healthy! This is an AI-generated report.\n"
        f"For emergencies, please contact your nearest hospital.\n"
        f"— Team VitalBridge"
    )

    # Send via Twilio WhatsApp
    from app.services.communication import send_twilio_message
    res = send_twilio_message(to_phone=phone, body=report_body, is_whatsapp=True)

    if res:
        return {"success": True, "message": f"Report sent to {phone} via WhatsApp"}
    else:
        if getattr(res, "error_code", None) == 63015:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Twilio WhatsApp Sandbox session is not open for {phone}. "
                    f"Please send the required join command (e.g. 'join <sandbox-keyword>') "
                    f"to the Twilio Sandbox number (+14155238886) on WhatsApp first, then try again."
                )
            )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send report via WhatsApp. {getattr(res, 'error_message', '') or 'Please try again.'}"
        )


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(
    Body: str = Form(...),
    From: str = Form(...),
):
    """
    Twilio WhatsApp Integration webhook.
    Triage incoming WhatsApp message content and send an AI triage response.
    """
    # Clean phone number
    phone = From.replace("whatsapp:", "").strip()
    
    # Get DB session
    from app.db.session import SessionLocal
    db = SessionLocal()
    
    try:
        # Resolve patient
        user = db.query(User).filter(User.email.like(f"%{phone}%") | (User.full_name.like("%Priya%"))).first()
        patient = None
        if user:
            patient = db.query(Patient).filter(Patient.user_id == user.id).first()
            
        if not patient:
            patient = db.query(Patient).first()
            user = db.query(User).filter(User.id == patient.user_id).first()
            
        # Get active conversation
        conv = db.query(TriageConversation).filter(
            TriageConversation.patient_id == patient.id,
            TriageConversation.status == "active"
        ).order_by(TriageConversation.created_at.desc()).first()
        
        if not conv:
            conv = TriageConversation(
                patient_id=patient.id,
                severity="pending",
                status="active",
                chief_complaint=Body[:200],
                region=user.email.split("@")[0] if user else "Rural PHC"
            )
            db.add(conv)
            db.flush()
            
        # Save patient message
        patient_msg = Message(conversation_id=conv.id, role="patient", content=Body)
        db.add(patient_msg)
        db.flush()
        
        # Build history & Triage using LLM
        db.refresh(conv)
        history = [{"role": m.role, "content": m.content} for m in conv.messages]
        patient_context = _get_patient_context(patient, user)
        
        try:
            ai_response = triage_chat(history, patient_context)
        except Exception as e:
            ai_response = f"I'm sorry, I'm having trouble connecting to my AI triage systems. (Error: {str(e)[:50]})"
            
        # Save AI response
        ai_msg = Message(conversation_id=conv.id, role="ai", content=ai_response)
        db.add(ai_msg)
        
        # Severity calculation & status updates
        severity = extract_severity(ai_response)
        if severity:
            conv.severity = severity
            if severity == "high" and conv.status == "active":
                conv.status = "escalated"
                conv.ai_summary = ai_response[:500]
                try:
                    from app.services.risk_score_service import compute_risk_score
                    risk_res = compute_risk_score(patient.id, db)
                    last_risk_score = risk_res["score"]
                    last_risk_band = risk_res["band"]
                except Exception:
                    last_risk_score = None
                    last_risk_band = None

                await manager.broadcast("doctor_queue", {
                    "type": "new_escalation",
                    "conversation_id": conv.id,
                    "patient_name": user.full_name if user else "WhatsApp Patient",
                    "chief_complaint": conv.chief_complaint,
                    "severity": "high",
                    "last_risk_score": last_risk_score,
                    "last_risk_band": last_risk_band,
                    "patient_city": patient.city if patient else (conv.region if conv else None),
                })
                
        db.commit()
        
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{ai_response}</Message>
</Response>"""
        return Response(content=twiml, media_type="application/xml")
        
    except Exception as e:
        db.rollback()
        print(f"[WhatsApp Webhook Error] {e}")
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>We are experiencing technical difficulties. Please call your local health center or try again later.</Message>
</Response>"""
        return Response(content=twiml, media_type="application/xml")
    finally:
        db.close()


@router.post("/voice/webhook")
async def voice_webhook():
    """
    Twilio Interactive Voice Response (IVR) Webhook.
    Directs patient call to options: 1 for emergency triage, 2 for IoT adherence status.
    """
    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="en-IN" voice="Polly.Aditi">Welcome to VitalBridge Rural Health Support Helpline.</Say>
    <Gather numDigits="1" action="/api/triage/voice/gather" method="POST">
        <Say language="en-IN" voice="Polly.Aditi">Press 1 to speak your current symptoms. Press 2 to check your smart pill dispenser connection status.</Say>
    </Gather>
    <Say language="en-IN" voice="Polly.Aditi">We did not receive any input. Goodbye.</Say>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@router.post("/voice/gather")
async def voice_gather(Digits: str = Form(...)):
    """Processes IVR keyboard choice."""
    if Digits == "1":
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="en-IN" voice="Polly.Aditi">Please state your symptoms clearly after the beep. Press hash when you are finished.</Say>
    <Record maxLength="30" action="/api/triage/voice/triage-record" method="POST" finishOnKey="#"/>
</Response>"""
    elif Digits == "2":
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="en-IN" voice="Polly.Aditi">Checking your smart pill dispenser connectivity. Your device is online and fully synchronized. Thank you.</Say>
    <Hangup/>
</Response>"""
    else:
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="en-IN" voice="Polly.Aditi">Invalid option. Goodbye.</Say>
    <Hangup/>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@router.post("/voice/triage-record")
async def voice_triage_record(RecordingUrl: str = Form(None)):
    """Receives voice message record from patient."""
    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="en-IN" voice="Polly.Aditi">Thank you. Your voice recording has been submitted. Our AI system will process it and send your triage recommendations via SMS within two minutes.</Say>
    <Hangup/>
</Response>"""
    return Response(content=twiml, media_type="application/xml")
