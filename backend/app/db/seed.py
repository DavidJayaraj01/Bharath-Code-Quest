"""
Seed script — populates the database with realistic, clearly-fictional Indian demo data.
Run: python -m app.db.seed
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from datetime import datetime, timedelta, timezone
from app.db.session import engine, SessionLocal, Base
from app.models.models import (
    User, Patient, Doctor, TriageConversation, Message,
    Prescription, VitalReading, SurveillanceReport,
    DispenserDevice, DispenserEvent, AccessGrant,
)
from app.core.security import hash_password
import uuid, random, json

def uid():
    return str(uuid.uuid4())

def utcnow():
    return datetime.now(timezone.utc)

REGIONS = [
    {"name": "Mumbai", "lat": 19.076, "lon": 72.8777, "state": "Maharashtra"},
    {"name": "Delhi", "lat": 28.6139, "lon": 77.209, "state": "Delhi"},
    {"name": "Bengaluru", "lat": 12.9716, "lon": 77.5946, "state": "Karnataka"},
    {"name": "Chennai", "lat": 13.0827, "lon": 80.2707, "state": "Tamil Nadu"},
    {"name": "Kolkata", "lat": 22.5726, "lon": 88.3639, "state": "West Bengal"},
    {"name": "Hyderabad", "lat": 17.385, "lon": 78.4867, "state": "Telangana"},
    {"name": "Pune", "lat": 18.5204, "lon": 73.8567, "state": "Maharashtra"},
    {"name": "Jaipur", "lat": 26.9124, "lon": 75.7873, "state": "Rajasthan"},
]

def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed(db)
        db.commit()
        print("[OK] Database seeded successfully!")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seed failed: {e}")
        raise
    finally:
        db.close()

def _seed(db):
    now = utcnow()

    # ── Users ──
    patients_data = [
        {"email": "priya.sharma@demo.vitalbridge.in", "name": "Priya Sharma",
         "gender": "Female", "city": "Mumbai", "state": "Maharashtra", "blood": "B+",
         "allergies": ["Penicillin"], "conditions": ["Type 2 Diabetes"],
         "phone": "+91-98201-XXXXX", "dob": datetime(1988, 3, 15, tzinfo=timezone.utc)},
        {"email": "arjun.patel@demo.vitalbridge.in", "name": "Arjun Patel",
         "gender": "Male", "city": "Delhi", "state": "Delhi", "blood": "O+",
         "allergies": [], "conditions": ["Hypertension"],
         "phone": "+91-99100-XXXXX", "dob": datetime(1975, 7, 22, tzinfo=timezone.utc)},
        {"email": "meera.reddy@demo.vitalbridge.in", "name": "Meera Reddy",
         "gender": "Female", "city": "Hyderabad", "state": "Telangana", "blood": "A+",
         "allergies": ["Sulfa drugs", "Aspirin"], "conditions": [],
         "phone": "+91-94400-XXXXX", "dob": datetime(1995, 11, 8, tzinfo=timezone.utc)},
        {"email": "raj.kumar@demo.vitalbridge.in", "name": "Raj Kumar",
         "gender": "Male", "city": "Bengaluru", "state": "Karnataka", "blood": "AB+",
         "allergies": [], "conditions": ["Asthma", "Hypothyroidism"],
         "phone": "+91-98450-XXXXX", "dob": datetime(1962, 1, 30, tzinfo=timezone.utc)},
    ]

    doctors_data = [
        {"email": "dr.ananya.iyer@demo.vitalbridge.in", "name": "Dr. Ananya Iyer",
         "specialty": "General Medicine", "hospital": "Apollo Hospital", "city": "Chennai",
         "state": "Tamil Nadu", "license": "TN-MED-29384", "exp": 12},
        {"email": "dr.vikram.singh@demo.vitalbridge.in", "name": "Dr. Vikram Singh",
         "specialty": "Pulmonology", "hospital": "AIIMS", "city": "Delhi",
         "state": "Delhi", "license": "DL-MED-10293", "exp": 18},
    ]

    hw_data = [
        {"email": "sunita.devi@demo.vitalbridge.in", "name": "Sunita Devi (ASHA Worker)"},
    ]

    patient_users = []
    patient_profiles = []
    for p in patients_data:
        u = User(id=uid(), email=p["email"], hashed_password=hash_password("demo1234"),
                 full_name=p["name"], role="patient", created_at=now)
        db.add(u)
        patient_users.append(u)
        prof = Patient(
            id=uid(), user_id=u.id, date_of_birth=p["dob"], gender=p["gender"],
            phone=p["phone"], city=p["city"], state=p["state"], blood_group=p["blood"],
            allergies=p["allergies"], chronic_conditions=p["conditions"],
        )
        db.add(prof)
        patient_profiles.append(prof)

    doctor_users = []
    doctor_profiles = []
    for d in doctors_data:
        u = User(id=uid(), email=d["email"], hashed_password=hash_password("demo1234"),
                 full_name=d["name"], role="doctor", created_at=now)
        db.add(u)
        doctor_users.append(u)
        prof = Doctor(
            id=uid(), user_id=u.id, specialty=d["specialty"], hospital=d["hospital"],
            city=d["city"], state=d["state"], license_number=d["license"],
            years_experience=d["exp"],
        )
        db.add(prof)
        doctor_profiles.append(prof)

    for hw in hw_data:
        u = User(id=uid(), email=hw["email"], hashed_password=hash_password("demo1234"),
                 full_name=hw["name"], role="health_worker", created_at=now)
        db.add(u)

    # Admin
    admin = User(id=uid(), email="admin@demo.vitalbridge.in",
                 hashed_password=hash_password("admin1234"),
                 full_name="System Admin", role="admin", created_at=now)
    db.add(admin)

    db.flush()

    # ── Access Grants ──
    for pp in patient_profiles:
        for dp in doctor_profiles:
            db.add(AccessGrant(id=uid(), patient_id=pp.id, doctor_id=dp.id, granted_at=now))

    # ── Triage Conversations (seeded past visits) ──
    conversations = []
    conv_data = [
        {"patient_idx": 0, "region_idx": 0, "severity": "medium", "status": "resolved",
         "complaint": "Persistent headache and mild fever for 3 days",
         "summary": "Patient presented with tension-type headache and low-grade fever. Advised rest, hydration, and paracetamol.",
         "messages": [
             ("patient", "I've had a headache for 3 days now, and I think I have a slight fever too."),
             ("ai", "I understand you're experiencing a persistent headache along with a mild fever. Let me ask a few questions to better assess your condition.\n\n1. Can you describe the headache? Is it throbbing, dull, or sharp?\n2. Have you measured your temperature? If so, what was it?\n3. Are you experiencing any other symptoms like body aches, cough, or nausea?"),
             ("patient", "It's a dull ache, mostly at the back of my head. Temperature was 99.2°F. No cough but some body aches."),
             ("ai", "Based on your symptoms — a dull occipital headache, low-grade fever (99.2°F), and body aches lasting 3 days — this appears to be a **tension-type headache** possibly associated with a mild viral infection.\n\n**Severity: Medium**\n\n**Recommended home care:**\n- Rest adequately and stay hydrated\n- Take Paracetamol 500mg every 6 hours as needed\n- Apply a warm compress to the back of your neck\n- Monitor your temperature\n\n⚠️ Please seek immediate medical attention if: fever exceeds 101°F, headache becomes severe/sudden, or you develop neck stiffness or vision changes."),
         ]},
        {"patient_idx": 1, "region_idx": 1, "severity": "high", "status": "escalated",
         "complaint": "Severe chest pain and breathlessness",
         "summary": "62-year-old male with hypertension presenting with acute chest pain. Escalated to doctor queue immediately.",
         "doctor_idx": 0,
         "messages": [
             ("patient", "I'm having bad chest pain since this morning. It's hard to breathe."),
             ("ai", "I'm taking your symptoms very seriously. Chest pain combined with difficulty breathing requires urgent evaluation.\n\n**Severity: HIGH — Immediate medical attention recommended**\n\nI'm escalating your case to a doctor right now. While waiting:\n- Sit upright, do not lie flat\n- If you have prescribed nitroglycerin, take it as directed\n- Chew an aspirin (325mg) if you're not allergic\n- Call emergency services (112) if pain worsens\n\nA doctor will review your case within minutes."),
         ]},
    ]

    for cd in conv_data:
        pp = patient_profiles[cd["patient_idx"]]
        reg = REGIONS[cd["region_idx"]]
        conv = TriageConversation(
            id=uid(), patient_id=pp.id, severity=cd["severity"], status=cd["status"],
            chief_complaint=cd["complaint"], ai_summary=cd["summary"],
            region=reg["name"], latitude=reg["lat"], longitude=reg["lon"],
            assigned_doctor_id=doctor_profiles[cd.get("doctor_idx", 0)].id if cd["status"] == "escalated" else None,
            created_at=now - timedelta(days=random.randint(1, 14)),
        )
        db.add(conv)
        conversations.append(conv)
        for i, (role, content) in enumerate(cd["messages"]):
            db.add(Message(
                id=uid(), conversation_id=conv.id, role=role, content=content,
                created_at=conv.created_at + timedelta(minutes=i * 2),
            ))

    # ── Prescriptions ──
    db.add(Prescription(
        id=uid(), patient_id=patient_profiles[0].id, doctor_id=doctor_profiles[0].id,
        medications=[
            {"name": "Metformin", "dosage": "500mg", "frequency": "Twice daily", "duration": "Ongoing"},
            {"name": "Paracetamol", "dosage": "500mg", "frequency": "As needed", "duration": "5 days"},
        ],
        diagnosis="Tension headache with low-grade viral fever; ongoing Type 2 DM management",
        notes="Continue blood sugar monitoring. Follow-up in 2 weeks.",
        created_at=now - timedelta(days=5),
    ))

    db.add(Prescription(
        id=uid(), patient_id=patient_profiles[3].id, doctor_id=doctor_profiles[1].id,
        medications=[
            {"name": "Salbutamol Inhaler", "dosage": "2 puffs", "frequency": "As needed", "duration": "Ongoing"},
            {"name": "Levothyroxine", "dosage": "50mcg", "frequency": "Once daily (morning, empty stomach)", "duration": "Ongoing"},
        ],
        diagnosis="Bronchial asthma (controlled); Hypothyroidism",
        created_at=now - timedelta(days=30),
    ))

    # ── Vitals ──
    vital_types = [
        ("heart_rate", "bpm", 68, 85), ("temperature", "°C", 36.2, 37.0),
        ("spo2", "%", 95, 99), ("bp_systolic", "mmHg", 110, 135),
        ("bp_diastolic", "mmHg", 70, 88),
    ]
    for pp in patient_profiles:
        for day_offset in range(14, -1, -1):
            for vt, unit, lo, hi in vital_types:
                db.add(VitalReading(
                    id=uid(), patient_id=pp.id, reading_type=vt,
                    value=round(random.uniform(lo, hi), 1), unit=unit,
                    recorded_at=now - timedelta(days=day_offset, hours=random.randint(6, 10)),
                ))

    # ── Surveillance ──
    symptom_cats = ["respiratory", "gastrointestinal", "fever", "neurological", "dermatological"]
    for reg in REGIONS:
        for cat in symptom_cats:
            count = random.randint(2, 45)
            risk = min(1.0, count / 40)
            alert = "normal" if risk < 0.3 else ("watch" if risk < 0.5 else ("warning" if risk < 0.75 else "critical"))
            db.add(SurveillanceReport(
                id=uid(), region=reg["name"], latitude=reg["lat"], longitude=reg["lon"],
                symptom_category=cat, case_count=count, risk_score=round(risk, 2),
                period_start=now - timedelta(hours=24), period_end=now, alert_level=alert,
            ))

    # ── IoT Dispenser (for chronic patient Priya) ──
    dev = DispenserDevice(
        id=uid(), patient_id=patient_profiles[0].id,
        device_name="SmartPill-001", medication_name="Metformin",
        dosage="500mg", schedule_times=["08:00", "20:00"],
        state="locked", is_simulated=True,
    )
    db.add(dev)
    db.flush()

    # Seed some past dispenser events
    for day in range(3, 0, -1):
        for t_hour in [8, 20]:
            event_time = now - timedelta(days=day, hours=24 - t_hour)
            taken = random.random() > 0.15
            db.add(DispenserEvent(
                id=uid(), device_id=dev.id,
                event_type="dose_taken" if taken else "dose_missed",
                from_state="dose_window_open", to_state="dispensed" if taken else "missed",
                payload={"medication": "Metformin", "scheduled_time": f"{t_hour:02d}:00"},
                created_at=event_time,
            ))

    print(f"  Created {len(patients_data)} patients, {len(doctors_data)} doctors, 1 health worker, 1 admin")
    print(f"  Created {len(conv_data)} triage conversations with messages")
    print(f"  Created vitals, prescriptions, surveillance reports, and IoT events")
    print(f"\n  Login credentials (all demo accounts):")
    print(f"  Patients & Doctors: password = demo1234")
    print(f"  Admin: admin@demo.vitalbridge.in / admin1234")

if __name__ == "__main__":
    seed()
