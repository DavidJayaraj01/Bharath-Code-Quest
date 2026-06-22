"""
Auth router — registration & login with real password hashing, JWT, and
Twilio WhatsApp OTP phone verification.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
import re

from app.db.session import get_db
from app.models.models import User, Patient, Doctor
from app.schemas.schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut
from app.core.security import hash_password, verify_password, create_access_token
from app.services.otp_service import send_otp, verify_otp

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _normalize_indian_phone(phone: str) -> str:
    """
    Normalize an Indian phone number to E.164 format (+91XXXXXXXXXX).
    Accepts:  9876543210  |  09876543210  |  +919876543210  |  919876543210
    Returns:  +919876543210
    """
    digits = re.sub(r"[^0-9]", "", phone)
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    # Already has + prefix in original
    if phone.strip().startswith("+") and len(digits) == 12:
        return f"+{digits}"
    return phone.strip()


# ─── OTP Schemas ──────────────────────────────────────────────────────────────

class SendOTPRequest(BaseModel):
    phone: str = Field(description="Indian mobile number — 10 digits e.g. 9876543210")

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str

class OTPResponse(BaseModel):
    success: bool
    message: str

# ─── Extended Register Request ─────────────────────────────────────────────────

class RegisterWithPhoneRequest(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    role: str = "patient"
    phone: Optional[str] = None
    otp: Optional[str] = None
    city: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/otp/send", response_model=OTPResponse)
def request_otp(req: SendOTPRequest):
    """Send a WhatsApp OTP to the given phone number for verification."""
    phone = _normalize_indian_phone(req.phone)

    # Validate — must be +91 followed by exactly 10 digits
    if not re.match(r"^\+91\d{10}$", phone):
        raise HTTPException(
            status_code=400,
            detail="Invalid phone number. Enter your 10-digit Indian mobile number."
        )
    result = send_otp(phone)
    return OTPResponse(**result)


@router.post("/otp/verify", response_model=OTPResponse)
def confirm_otp(req: VerifyOTPRequest):
    """Verify an OTP without completing registration (use for frontend step validation)."""
    phone = _normalize_indian_phone(req.phone)
    ok = verify_otp(phone, req.otp, consume=False)
    return OTPResponse(
        success=ok,
        message="OTP verified successfully" if ok else "Invalid or expired OTP"
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterWithPhoneRequest, db: Session = Depends(get_db)):
    """Register a new user. If phone + OTP are provided, they are verified first."""
    # Check duplicate email
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Normalize phone
    normalized_phone = None
    if req.phone:
        normalized_phone = _normalize_indian_phone(req.phone)
        if not req.otp:
            raise HTTPException(
                status_code=400,
                detail="OTP is required when a phone number is provided"
            )
        if not verify_otp(normalized_phone, req.otp):
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired OTP. Please request a new one."
            )

    # Validate role
    valid_roles = ["patient", "doctor", "health_worker", "admin"]
    if req.role not in valid_roles:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role=req.role,
    )
    db.add(user)
    db.flush()

    # Auto-create profile based on role
    if req.role == "patient":
        db.add(Patient(user_id=user.id, phone=normalized_phone, city=req.city))
    elif req.role == "doctor":
        db.add(Doctor(user_id=user.id, specialty="General Medicine", city=req.city))

    db.commit()
    db.refresh(user)

    # Send welcome WhatsApp message if phone given
    if normalized_phone:
        try:
            from app.services.communication import send_twilio_message
            welcome = (
                f"Welcome to VitalBridge, {req.full_name}! "
                f"Your account has been created successfully. "
                f"You can now access AI-powered health triage and your digital health passport. "
                f"Stay healthy! - Team VitalBridge"
            )
            send_twilio_message(to_phone=normalized_phone, body=welcome, is_whatsapp=False)
        except Exception as e:
            print(f"[Twilio] Welcome message failed: {e}")

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def get_me(db: Session = Depends(get_db), user: User = Depends(__import__("app.core.deps", fromlist=["get_current_user"]).get_current_user)):
    return UserOut.model_validate(user)
