from fastapi import APIRouter

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/health")
def reports_health():
    return {"status": "ok"}
