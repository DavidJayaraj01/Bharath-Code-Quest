"""
Auth router — registration & login with real password hashing and JWT.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import User, Patient, Doctor
from app.schemas.schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut
from app.core.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate email
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role=req.role.value,
    )
    db.add(user)
    db.flush()

    # Auto-create profile based on role
    if req.role == "patient":
        db.add(Patient(user_id=user.id))
    elif req.role == "doctor":
        db.add(Doctor(user_id=user.id, specialty="General Medicine"))

    db.commit()
    db.refresh(user)

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
