"""
Risk Score Service — computes a 0–100 health risk score per patient
based on recent triage outcomes, vital readings, medication adherence, and demographics.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import (
    Patient, User, TriageConversation, DispenserEvent, DispenserDevice,
    VitalReading,
)

# ── Weights ──────────────────────────────────────────────────
WEIGHTS = {
    "high_severity_triage_7d": 30,
    "medium_severity_triage_7d": 15,
    "missed_doses_7d": 4,          # per missed dose (max contribution: 28)
    "abnormal_vital_7d": 8,        # per abnormal vital (max: 24)
    "age_over_60_chronic": 10,
    "no_visit_90d": 8,
}

DEDUCTIONS = {
    "perfect_adherence_7d": -10,
    "normal_vitals_streak_7d": -8,
}

# Score bands
BAND_GREEN = (0, 30)
BAND_AMBER = (31, 65)
BAND_RED = (66, 100)

# ── Vital normal ranges ─────────────────────────────────────
VITAL_RANGES = {
    "heart_rate": (60, 100),
    "temperature": (36.1, 37.2),
    "spo2": (95, 100),
    "bp_systolic": (90, 140),
    "bp_diastolic": (60, 90),
}


def _is_abnormal_vital(reading_type: str, value: float) -> bool:
    rng = VITAL_RANGES.get(reading_type)
    if not rng:
        return False
    return value < rng[0] or value > rng[1]


def compute_risk_score(patient_id: str, db: Session) -> dict:
    """
    Compute a 0–100 risk score for the given patient.
    Returns: { score, band, signals, computed_at }
    """
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    ninety_days_ago = now - timedelta(days=90)

    signals: list[str] = []
    raw_score = 0

    # ── 1. Recent triage severity ────────────────────────────
    recent_triages = (
        db.query(TriageConversation)
        .filter(
            TriageConversation.patient_id == patient_id,
            TriageConversation.created_at >= seven_days_ago,
        )
        .all()
    )

    high_count = sum(1 for t in recent_triages if t.severity == "high")
    medium_count = sum(1 for t in recent_triages if t.severity == "medium")

    if high_count:
        contrib = WEIGHTS["high_severity_triage_7d"]
        raw_score += contrib
        signals.append(f"{high_count} high-severity triage in the last 7 days (+{contrib})")
    if medium_count:
        contrib = WEIGHTS["medium_severity_triage_7d"]
        raw_score += contrib
        signals.append(f"{medium_count} medium-severity triage in the last 7 days (+{contrib})")

    # ── 2. Missed doses ──────────────────────────────────────
    patient_devices = db.query(DispenserDevice).filter(DispenserDevice.patient_id == patient_id).all()
    device_ids = [d.id for d in patient_devices]

    missed_doses = 0
    if device_ids:
        missed_doses = (
            db.query(DispenserEvent)
            .filter(
                DispenserEvent.device_id.in_(device_ids),
                DispenserEvent.created_at >= seven_days_ago,
                DispenserEvent.event_type.in_(["dose_missed", "state_change"]),
                DispenserEvent.to_state == "missed",
            )
            .count()
        )

    if missed_doses > 0:
        contrib = min(28, missed_doses * WEIGHTS["missed_doses_7d"])
        raw_score += contrib
        signals.append(f"{missed_doses} missed dose(s) this week (+{contrib})")

    # ── 3. Abnormal vitals ───────────────────────────────────
    recent_vitals = (
        db.query(VitalReading)
        .filter(
            VitalReading.patient_id == patient_id,
            VitalReading.recorded_at >= seven_days_ago,
        )
        .all()
    )

    abnormal_count = sum(1 for v in recent_vitals if _is_abnormal_vital(v.reading_type, v.value))
    if abnormal_count > 0:
        contrib = min(24, abnormal_count * WEIGHTS["abnormal_vital_7d"])
        raw_score += contrib
        signals.append(f"{abnormal_count} abnormal vital reading(s) in the last 7 days (+{contrib})")

    # ── 4. Age > 60 + chronic condition ──────────────────────
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if patient:
        age = None
        if patient.date_of_birth:
            dob = patient.date_of_birth.replace(tzinfo=None) if patient.date_of_birth.tzinfo else patient.date_of_birth
            age = (now.replace(tzinfo=None) - dob).days // 365
        has_chronic = bool(patient.chronic_conditions and len(patient.chronic_conditions) > 0)
        if age and age > 60 and has_chronic:
            raw_score += WEIGHTS["age_over_60_chronic"]
            signals.append(f"Age {age} with chronic condition(s) (+{WEIGHTS['age_over_60_chronic']})")

    # ── 5. No visit in 90 days ───────────────────────────────
    last_visit = (
        db.query(TriageConversation)
        .filter(TriageConversation.patient_id == patient_id)
        .order_by(TriageConversation.created_at.desc())
        .first()
    )
    if not last_visit or last_visit.created_at.replace(tzinfo=timezone.utc) < ninety_days_ago:
        raw_score += WEIGHTS["no_visit_90d"]
        signals.append(f"No triage visit in the last 90 days (+{WEIGHTS['no_visit_90d']})")

    # ── Deductions ───────────────────────────────────────────
    if missed_doses == 0 and device_ids:
        raw_score += DEDUCTIONS["perfect_adherence_7d"]
        signals.append(f"Perfect medication adherence this week ({DEDUCTIONS['perfect_adherence_7d']})")

    if recent_vitals and abnormal_count == 0:
        raw_score += DEDUCTIONS["normal_vitals_streak_7d"]
        signals.append(f"All vitals normal for 7 days ({DEDUCTIONS['normal_vitals_streak_7d']})")

    # ── Final score ──────────────────────────────────────────
    score = max(0, min(100, raw_score))

    if score <= BAND_GREEN[1]:
        band = "low"
    elif score <= BAND_AMBER[1]:
        band = "moderate"
    else:
        band = "high"

    # Persist to patient record
    if patient:
        patient.last_risk_score = score
        patient.last_risk_band = band
        try:
            db.commit()
        except Exception:
            db.rollback()

    return {
        "score": score,
        "band": band,
        "signals": signals,
        "computed_at": now.isoformat(),
    }


async def update_and_broadcast_risk_score(patient_id: str, db: Session):
    from app.core.ws_manager import manager
    try:
        result = compute_risk_score(patient_id, db)
        await manager.broadcast(f"risk:{patient_id}", {
            "type": "risk_update",
            "patient_id": patient_id,
            "score": result["score"],
            "band": result["band"],
            "signals": result["signals"],
            "computed_at": result["computed_at"],
        })
    except Exception as e:
        print(f"[Risk WS Broadcast] Failed: {e}")

