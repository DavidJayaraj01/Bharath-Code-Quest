"""
VitalBridge -- FastAPI application entry point.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.session import engine, Base

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev convenience; prod uses Alembic)
    Base.metadata.create_all(bind=engine)

    # Start IoT simulators
    try:
        from app.services.iot_simulator import start_all_simulators
        await start_all_simulators()
    except Exception as e:
        print(f"[IoT] Simulator startup skipped: {e}")

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
from app.api.auth import router as auth_router
from app.api.triage import router as triage_router
from app.api.passport import router as passport_router
from app.api.doctor import router as doctor_router
from app.api.surveillance import router as surveillance_router
from app.api.iot import router as iot_router

app.include_router(auth_router)
app.include_router(triage_router)
app.include_router(passport_router)
app.include_router(doctor_router)
app.include_router(surveillance_router)
app.include_router(iot_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": settings.APP_VERSION}
