from fastapi import APIRouter

router = APIRouter(prefix="/api/verify", tags=["verify"])

@router.get("/health")
def verify_health():
    return {"status": "ok"}
