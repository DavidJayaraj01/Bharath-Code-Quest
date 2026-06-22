"""
Disease Surveillance Service — runs outbreak clustering and risk calculations.
Calculates risk scores based on geographic density of similar symptom reports.
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
import math

from app.models.models import TriageConversation, SurveillanceReport
from app.core.ws_manager import manager

# Simple distance formula (Haversine approximation)
def get_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Earth radius in km
    R = 6371.0
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def classify_symptom_category(complaint: str) -> str:
    """Categorize chief complaint into standard surveillance categories."""
    text = (complaint or "").lower()
    
    # Respiratory keywords
    if any(k in text for k in ["cough", "breath", "lung", "throat", "asthma", "wheez", "chest pain", "pneumonia"]):
        return "respiratory"
    # Gastrointestinal keywords
    if any(k in text for k in ["stomach", "vomit", "diarrhea", "nausea", "abdomen", "loose motion", "cramp"]):
        return "gastrointestinal"
    # Fever keywords
    if any(k in text for k in ["fever", "temp", "chill", "sweat", "typhoid", "malaria", "dengue"]):
        return "fever"
    # Neurological keywords
    if any(k in text for k in ["headache", "dizz", "migraine", "seizure", "stroke", "paraly", "numb"]):
        return "neurological"
    # Dermatological keywords
    if any(k in text for k in ["rash", "skin", "itch", "allergy", "hives", "burn"]):
        return "dermatological"
        
    return "fever"  # Default fallback category

async def process_surveillance_alert(conv_id: str, db: Session):
    """
    Called when a triage conversation is completed.
    Computes/updates surveillance reports for the region.
    """
    conv = db.query(TriageConversation).filter(TriageConversation.id == conv_id).first()
    if not conv or not conv.latitude or not conv.longitude or not conv.chief_complaint:
        return
        
    symptom_cat = classify_symptom_category(conv.chief_complaint)
    
    # Define clustering window: past 48 hours, within 50 km
    time_limit = datetime.now(timezone.utc) - timedelta(hours=48)
    
    # Find all recent conversations
    recent_convs = db.query(TriageConversation).filter(
        TriageConversation.created_at >= time_limit,
        TriageConversation.latitude.isnot(None),
        TriageConversation.longitude.isnot(None)
    ).all()
    
    # Filter by distance and symptom match
    matching_cases = 0
    for rc in recent_convs:
        # Check if symptom category is matching
        rc_cat = classify_symptom_category(rc.chief_complaint)
        if rc_cat != symptom_cat:
            continue
            
        dist = get_distance_km(conv.latitude, conv.longitude, rc.latitude, rc.longitude)
        if dist <= 50.0:
            matching_cases += 1
            
    # Calculate risk score: N matching cases / 10, capped at 1.0
    risk_score = min(1.0, matching_cases / 10.0)
    
    # Determine alert level
    if matching_cases >= 8:
        alert_level = "critical"
    elif matching_cases >= 5:
        alert_level = "warning"
    elif matching_cases >= 3:
        alert_level = "watch"
    else:
        alert_level = "normal"
        
    # Get or create SurveillanceReport for this region + category
    # Let's find one for this region/category created within the last 24h
    period_start = datetime.now(timezone.utc) - timedelta(hours=24)
    report = db.query(SurveillanceReport).filter(
        SurveillanceReport.region == (conv.region or "Unknown"),
        SurveillanceReport.symptom_category == symptom_cat,
        SurveillanceReport.created_at >= period_start
    ).first()
    
    if not report:
        report = SurveillanceReport(
            region=conv.region or "Unknown",
            latitude=conv.latitude,
            longitude=conv.longitude,
            symptom_category=symptom_cat,
            case_count=matching_cases,
            risk_score=risk_score,
            alert_level=alert_level,
            period_start=datetime.now(timezone.utc) - timedelta(hours=24),
            period_end=datetime.now(timezone.utc)
        )
        db.add(report)
    else:
        # Update existing report
        report.case_count = max(report.case_count, matching_cases)
        report.risk_score = max(report.risk_score, risk_score)
        # Higher alert level wins
        levels = ["normal", "watch", "warning", "critical"]
        if levels.index(alert_level) > levels.index(report.alert_level):
            report.alert_level = alert_level
        report.period_end = datetime.now(timezone.utc)
        
    # Calculate probability
    alert_mult = {"critical": 1.0, "warning": 0.8, "watch": 0.5, "normal": 0.2}.get(report.alert_level, 0.2)
    prob = 0.4 * min(1.0, report.case_count / 15.0) + 0.4 * report.risk_score + 0.2 * alert_mult
    prob = round(max(0.0, min(1.0, prob)), 4)
    
    # Store hourly OutbreakSnapshot
    from app.models.models import OutbreakSnapshot
    now = datetime.now(timezone.utc)
    current_hour = now.replace(minute=0, second=0, microsecond=0)
    
    snapshot = db.query(OutbreakSnapshot).filter(
        OutbreakSnapshot.region == report.region,
        OutbreakSnapshot.symptom_category == report.symptom_category,
        OutbreakSnapshot.timestamp == current_hour
    ).first()
    
    if not snapshot:
        snapshot = OutbreakSnapshot(
            region=report.region,
            latitude=report.latitude,
            longitude=report.longitude,
            symptom_category=report.symptom_category,
            probability=prob,
            case_count=report.case_count,
            timestamp=current_hour
        )
        db.add(snapshot)
    else:
        snapshot.probability = prob
        snapshot.case_count = report.case_count
        snapshot.latitude = report.latitude
        snapshot.longitude = report.longitude
        
    db.commit()
    
    # Broadcast to surveillance channel via WebSockets
    await manager.broadcast("surveillance", {
        "type": "surveillance_update",
        "region": report.region,
        "category": report.symptom_category,
        "case_count": report.case_count,
        "risk_score": report.risk_score,
        "alert_level": report.alert_level,
        "outbreak_probability": prob,
    })
