"""
Surveillance router — disease surveillance dashboard data.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.db.session import get_db
from app.models.models import User, SurveillanceReport, TriageConversation
from app.schemas.schemas import SurveillanceReportOut
from app.core.deps import require_role
from app.core.security import decode_access_token
from app.core.ws_manager import manager

router = APIRouter(prefix="/api/surveillance", tags=["surveillance"])


@router.get("/reports", response_model=List[SurveillanceReportOut])
def get_reports(
    region: str = None,
    alert_level: str = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("health_worker", "doctor", "admin")),
):
    """Get surveillance reports with optional filters."""
    q = db.query(SurveillanceReport)
    if region:
        q = q.filter(SurveillanceReport.region == region)
    if alert_level:
        q = q.filter(SurveillanceReport.alert_level == alert_level)
    return q.order_by(SurveillanceReport.created_at.desc()).limit(200).all()


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("health_worker", "doctor", "admin")),
):
    """Get aggregated surveillance summary for dashboard."""
    reports = db.query(SurveillanceReport).all()

    # Aggregate by region
    regions = {}
    for r in reports:
        if r.region not in regions:
            regions[r.region] = {
                "region": r.region,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "total_cases": 0,
                "max_risk_score": 0.0,
                "alert_level": "normal",
                "categories": {},
            }
        regions[r.region]["total_cases"] += r.case_count
        regions[r.region]["max_risk_score"] = max(regions[r.region]["max_risk_score"], r.risk_score)
        regions[r.region]["categories"][r.symptom_category] = r.case_count

        # Highest alert level wins
        levels = ["normal", "watch", "warning", "critical"]
        current = levels.index(regions[r.region]["alert_level"])
        new = levels.index(r.alert_level)
        if new > current:
            regions[r.region]["alert_level"] = r.alert_level

    # Overall stats
    total_cases = sum(r["total_cases"] for r in regions.values())
    critical_regions = sum(1 for r in regions.values() if r["alert_level"] == "critical")
    warning_regions = sum(1 for r in regions.values() if r["alert_level"] == "warning")

    # Recent triage count (last 24h)
    now = datetime.now(timezone.utc)
    recent_triages = db.query(TriageConversation).filter(
        TriageConversation.created_at >= now - timedelta(hours=24)
    ).count()

    return {
        "regions": list(regions.values()),
        "total_cases": total_cases,
        "critical_regions": critical_regions,
        "warning_regions": warning_regions,
        "recent_triages_24h": recent_triages,
        "total_regions": len(regions),
    }


@router.websocket("/ws")
async def surveillance_ws(websocket: WebSocket):
    """WebSocket for live surveillance dashboard updates."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, "surveillance")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket, "surveillance")
