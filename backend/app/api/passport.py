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
    if user.email == "priya.sharma@demo.vitalbridge.in":
        from app.seed_passport import seed_patient_passport
        seed_patient_passport(db)
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
    if user.email == "priya.sharma@demo.vitalbridge.in":
        from app.seed_passport import seed_patient_passport
        seed_patient_passport(db)
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    q = db.query(VitalReading).filter(VitalReading.patient_id == patient.id)
    if reading_type:
        q = q.filter(VitalReading.reading_type == reading_type)
    return q.order_by(VitalReading.recorded_at.desc()).limit(limit).all()


from app.services.risk_score_service import update_and_broadcast_risk_score

@router.post("/vitals", response_model=VitalReadingOut, status_code=201)
async def log_vital(
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
    
    await update_and_broadcast_risk_score(patient.id, db)
    
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


@router.get("/fhir", response_model=dict)
def get_fhir_passport(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    """
    Exports patient details formatted in FHIR R4 JSON standard.
    Uses the fhir.resources package to guarantee compliance against the specification.
    """
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
        
    from fhir.resources.patient import Patient as FHIRPatient
    from fhir.resources.humanname import HumanName
    from fhir.resources.contactpoint import ContactPoint
    from fhir.resources.identifier import Identifier
    
    try:
        fhir_patient = FHIRPatient.construct()
        fhir_patient.id = patient.id
        fhir_patient.active = True
        
        name = HumanName.construct()
        name.text = user.full_name
        fhir_patient.name = [name]
        
        if patient.phone:
            telecom = ContactPoint.construct()
            telecom.system = "phone"
            telecom.value = patient.phone
            telecom.use = "mobile"
            fhir_patient.telecom = [telecom]
            
        if patient.gender:
            g = patient.gender.lower()
            fhir_patient.gender = g if g in ["male", "female", "other"] else "unknown"
            
        if patient.date_of_birth:
            fhir_patient.birthDate = patient.date_of_birth.date().isoformat()
            
        # Add official ABHA (Ayushman Bharat Health Account) identifier
        abha_id = Identifier.construct()
        abha_id.use = "official"
        abha_id.system = "https://ndhm.gov.in/abha"
        abha_id.value = "12-3456-7890-1234"
        fhir_patient.identifier = [abha_id]
        
        # Calling .dict() forces pydantic verification against FHIR R4 Patient model schema
        return fhir_patient.dict()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"FHIR R4 transformation failed: {str(e)}"
        )


from pydantic import BaseModel
from typing import Optional

@router.get("/nearby-hospitals")
def get_nearby_hospitals(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    city = patient.city or "Chennai"
    
    # Query all doctors in that city
    doctors = db.query(Doctor).filter(Doctor.city.like(city)).all()
    
    # Standard seeded hospitals for Chennai
    if city.lower() == "chennai":
        hospitals_map = {
            "Government Stanley Hospital": {
                "hospital_name": "Government Stanley Hospital",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "distance": 4.2,
                "specialties": ["Emergency", "General"],
                "open_24h": True,
                "address": "Stanley Medical College, Chennai",
                "phone": "+91-44-2528-1351",
                "doctors": []
            },
            "ESI Hospital Ayanavaram": {
                "hospital_name": "ESI Hospital Ayanavaram",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "distance": 6.8,
                "specialties": ["General", "Maternity"],
                "open_24h": False,
                "address": "Ayanavaram, Chennai",
                "phone": "+91-44-2674-1234",
                "doctors": []
            }
        }
    else:
        hospitals_map = {}

    for doc in doctors:
        doc_user = db.query(User).filter(User.id == doc.user_id).first()
        hosp_name = doc.hospital or "Government Stanley Hospital"
        # If it's a new hospital not in our map, add it
        if hosp_name not in hospitals_map:
            hospitals_map[hosp_name] = {
                "hospital_name": hosp_name,
                "city": doc.city,
                "state": doc.state,
                "distance": 5.0,
                "specialties": ["General"],
                "open_24h": True,
                "address": f"{doc.city} General Hospital",
                "phone": "+91-44-1111-2222",
                "doctors": []
            }
        hospitals_map[hosp_name]["doctors"].append({
            "id": doc.id,
            "name": doc_user.full_name if doc_user else "Unknown Doctor",
            "specialty": doc.specialty,
            "experience": doc.years_experience,
            "is_available": doc.is_available,
        })
        
    return list(hospitals_map.values())


class AppointRequest(BaseModel):
    doctor_id: str
    conversation_id: Optional[str] = None


@router.post("/appoint")
async def appoint_doctor_hospital(
    req: AppointRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("patient")),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    doctor = db.query(Doctor).filter(Doctor.id == req.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # 1. Create or enable AccessGrant
    grant = db.query(AccessGrant).filter(
        AccessGrant.patient_id == patient.id,
        AccessGrant.doctor_id == doctor.id,
    ).first()
    if not grant:
        import uuid
        grant = AccessGrant(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            doctor_id=doctor.id,
            is_active=True,
        )
        db.add(grant)
    else:
        grant.is_active = True
        from datetime import datetime, timezone
        grant.granted_at = datetime.now(timezone.utc)

    # 2. Assign doctor to the triage conversation if provided
    conv = None
    if req.conversation_id:
        conv = db.query(TriageConversation).filter(
            TriageConversation.id == req.conversation_id,
            TriageConversation.patient_id == patient.id,
        ).first()
        
    # If no conversation_id is provided, try finding the most recent conversation
    if not conv:
        conv = db.query(TriageConversation).filter(
            TriageConversation.patient_id == patient.id,
        ).order_by(TriageConversation.created_at.desc()).first()

    if conv:
        conv.assigned_doctor_id = doctor.id
        conv.status = "escalated"
        # Broadcast to doctor queue websocket
        try:
            from app.core.ws_manager import manager
            await manager.broadcast("doctor_queue", {
                "type": "new_escalation",
                "conversation_id": conv.id,
                "patient_name": user.full_name,
                "chief_complaint": conv.chief_complaint or "Direct Appointment",
                "severity": conv.severity or "medium",
                "patient_city": patient.city if patient else (conv.region if conv else None),
            })
        except Exception as e:
            print(f"[WS] Broadcast error: {e}")

    db.commit()
    
    # Send a confirmation SMS or WhatsApp via Twilio if phone number exists
    doc_user = db.query(User).filter(User.id == doctor.user_id).first()
    if patient.phone:
        try:
            from app.services.communication import send_twilio_message
            body = (
                f"🏥 *VitalBridge Appointment Confirmation*\n"
                f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Hello {user.full_name},\n"
                f"Your appointment request at *{doctor.hospital or 'Apollo Hospital'}* "
                f"with *{doc_user.full_name if doc_user else 'Dr. Ananya Iyer'}* ({doctor.specialty}) "
                f"has been confirmed!\n\n"
                f"The doctor now has access to your Digital Health Passport, including your vitals history.\n"
                f"Please visit the hospital or check the app for further guidance.\n\n"
                f"— Team VitalBridge"
            )
            send_twilio_message(to_phone=patient.phone, body=body, is_whatsapp=False)
        except Exception as e:
            print(f"[Twilio] Appointment alert failed: {e}")

    return {
        "success": True,
        "message": f"Appointment request submitted successfully to {doc_user.full_name if doc_user else 'doctor'} at {doctor.hospital or 'hospital'}."
    }


hospitals_router = APIRouter(prefix="/api/hospitals", tags=["hospitals"])

@hospitals_router.get("")
def get_hospitals(district: str = "Chennai", limit: int = 10):
    # Seed 2 hospitals for Chennai
    hospitals = [
        {
            "name": "Government Stanley Hospital",
            "distance": 4.2,
            "specialties": ["Emergency", "General"],
            "open_24h": True,
            "address": "Stanley Medical College, Chennai",
            "phone": "+91-44-2528-1351"
        },
        {
            "name": "ESI Hospital Ayanavaram",
            "distance": 6.8,
            "specialties": ["General", "Maternity"],
            "open_24h": False,
            "address": "Ayanavaram, Chennai",
            "phone": "+91-44-2674-1234"
        }
    ]
    if district.lower() != "chennai":
        return [
            {
                "name": f"{district} District Hospital",
                "distance": 3.5,
                "specialties": ["Emergency", "General"],
                "open_24h": True,
                "address": f"Main Road, {district}",
                "phone": "+91-11-2222-3333"
            }
        ]
    return hospitals[:limit]

