import uuid
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.models import (
    User, Patient, Doctor, TriageConversation, Message,
    Prescription, VitalReading, DispenserDevice, DispenserEvent, AccessGrant
)

def seed_patient_passport(db: Session):
    # Find user Priya
    user = db.query(User).filter(User.email == "priya.sharma@demo.vitalbridge.in").first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email="priya.sharma@demo.vitalbridge.in",
            hashed_password="hashed_placeholder",
            full_name="Priya Sharma",
            role="patient",
            created_at=datetime.now(timezone.utc)
        )
        db.add(user)
        db.flush()

    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        patient = Patient(
            id=str(uuid.uuid4()),
            user_id=user.id,
            gender="Female",
            phone="+91-98201-XXXXX",
            city="Chennai",
            state="Tamil Nadu",
            blood_group="B+",
            allergies=["Penicillin"],
            chronic_conditions=["Type 2 Diabetes"]
        )
        db.add(patient)
        db.flush()

    # Ensure profile values are correct for Chennai/B+
    patient.city = "Chennai"
    patient.state = "Tamil Nadu"
    patient.blood_group = "B+"
    db.flush()

    # Check if there are vitals
    vitals_count = db.query(VitalReading).filter(VitalReading.patient_id == patient.id).count()
    if vitals_count > 0:
        print("[seed_passport] Priya already has vitals. Skipping seed.")
        return

    print("[seed_passport] Seeding Priya's passport data...")
    now = datetime.now(timezone.utc)

    # 1. 14 days of heart rate readings (65–95 bpm)
    # 2. 14 days of SpO2 readings (94–99%)
    # 3. 14 days of blood pressure (systolic 110–140, diastolic 70–90)
    for day in range(14, -1, -1):
        dt = now - timedelta(days=day)
        # Heart rate
        db.add(VitalReading(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            reading_type="heart_rate",
            value=round(random.uniform(65, 95), 1),
            unit="bpm",
            source="wearable",
            recorded_at=dt
        ))
        # SpO2
        db.add(VitalReading(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            reading_type="spo2",
            value=round(random.uniform(94, 99), 1),
            unit="%",
            source="wearable",
            recorded_at=dt
        ))
        # BP Systolic
        db.add(VitalReading(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            reading_type="bp_systolic",
            value=round(random.uniform(110, 140), 1),
            unit="mmHg",
            source="wearable",
            recorded_at=dt
        ))
        # BP Diastolic
        db.add(VitalReading(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            reading_type="bp_diastolic",
            value=round(random.uniform(70, 90), 1),
            unit="mmHg",
            source="wearable",
            recorded_at=dt
        ))

    # 4. Dispenser device & events: 3 missed dose events in the last 7 days
    device = db.query(DispenserDevice).filter(DispenserDevice.patient_id == patient.id).first()
    if not device:
        device = DispenserDevice(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            device_name="SmartPill-001",
            medication_name="Metformin",
            dosage="500mg",
            schedule_times=["08:00", "20:00"],
            state="locked",
            is_simulated=True
        )
        db.add(device)
        db.flush()

    # Clear old events to have exactly 3 missed doses in last 7 days and some taken ones
    db.query(DispenserEvent).filter(DispenserEvent.device_id == device.id).delete()
    
    # 7 days, 2 doses per day = 14 doses. We want 3 missed doses and 11 taken doses.
    missed_days = [2, 4, 5]
    for day in range(7, 0, -1):
        for hour in [8, 20]:
            event_time = now - timedelta(days=day, hours=24-hour)
            is_missed = (day in missed_days and hour == 8)
            db.add(DispenserEvent(
                id=str(uuid.uuid4()),
                device_id=device.id,
                event_type="dose_missed" if is_missed else "dose_taken",
                from_state="dose_window_open",
                to_state="missed" if is_missed else "dispensed",
                payload={"medication": "Metformin", "scheduled_time": f"{hour:02d}:00"},
                created_at=event_time
            ))

    # 5. 2 prescriptions (Metformin 500mg twice daily, Amlodipine 5mg once daily)
    # Find doctor
    doctor = db.query(Doctor).first()
    if not doctor:
        doc_user = User(
            id=str(uuid.uuid4()),
            email="dr.ananya.iyer@demo.vitalbridge.in",
            hashed_password="hashed_placeholder",
            full_name="Dr. Ananya Iyer",
            role="doctor",
            created_at=now
        )
        db.add(doc_user)
        db.flush()
        doctor = Doctor(
            id=str(uuid.uuid4()),
            user_id=doc_user.id,
            specialty="General Medicine",
            hospital="Apollo Hospital",
            city="Chennai",
            state="Tamil Nadu",
            license_number="TN-MED-29384",
            years_experience=12,
            is_available=True
        )
        db.add(doctor)
        db.flush()

    # Create AccessGrant
    grant = db.query(AccessGrant).filter(AccessGrant.patient_id == patient.id, AccessGrant.doctor_id == doctor.id).first()
    if not grant:
        db.add(AccessGrant(id=str(uuid.uuid4()), patient_id=patient.id, doctor_id=doctor.id, granted_at=now))

    # Remove old prescriptions to avoid duplicate clutter
    db.query(Prescription).filter(Prescription.patient_id == patient.id).delete()
    
    prescription = Prescription(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        doctor_id=doctor.id,
        medications=[
            {"name": "Metformin", "dosage": "500mg", "frequency": "Twice daily", "duration": "Ongoing"},
            {"name": "Amlodipine", "dosage": "5mg", "frequency": "Once daily", "duration": "Ongoing"}
        ],
        diagnosis="Type 2 Diabetes & Mild Hypertension",
        notes="Monitor blood pressure and blood sugar daily. Check for interactions.",
        created_at=now - timedelta(days=5)
    )
    db.add(prescription)

    # 6. 1 high-severity triage conversation from 3 days ago
    db.query(TriageConversation).filter(TriageConversation.patient_id == patient.id).delete()
    
    triage_conv = TriageConversation(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        severity="high",
        status="escalated",
        chief_complaint="Severe chest pain, shortness of breath, and sweating",
        ai_summary="Patient reported acute substernal chest discomfort radiating to left arm. High risk of cardiovascular event. Escalated immediately.",
        region="Chennai",
        latitude=13.0827,
        longitude=80.2707,
        assigned_doctor_id=doctor.id,
        created_at=now - timedelta(days=3)
    )
    db.add(triage_conv)
    db.flush()

    db.add(Message(
        id=str(uuid.uuid4()),
        conversation_id=triage_conv.id,
        role="patient",
        content="I have a really bad pain in my chest, it feels like someone is squeezing it. I am also sweating a lot and breathing is hard.",
        created_at=triage_conv.created_at
    ))
    db.add(Message(
        id=str(uuid.uuid4()),
        conversation_id=triage_conv.id,
        role="ai",
        content="This sounds like a high-severity event. Squeezing chest pain with sweating and breathing difficulty could indicate an acute cardiac event. I am escalating your case to Dr. Ananya Iyer immediately. Please sit down, do not strain, and call 112 if pain worsens.",
        created_at=triage_conv.created_at + timedelta(minutes=2)
    ))

    db.commit()
    print("[seed_passport] Seeding complete!")
