"""
user_router.py — All end-user endpoints for SmartBot V2

Endpoints:
  POST /user/register          — create account (email+password)
  POST /user/login             — login → JWT token
  POST /user/phone/send-otp    — send OTP to phone (console for now)
  POST /user/phone/verify      — verify OTP → JWT token
  GET  /user/me                — get own profile
  PATCH /user/me               — update profile (name, password)
  PATCH /user/me/preferences   — update preferences (theme, language)
  GET  /user/me/sessions       — get own chat sessions
  DELETE /user/me/sessions/{id} — delete own session
  DELETE /user/me              — delete own account
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .database import get_db
from .models import EndUser, ChatSession, ChatLog
from .user_auth import (
    hash_password, verify_password,
    create_user_token, require_user, get_current_user,
    generate_phone_otp, verify_phone_otp, send_phone_otp
)

router = APIRouter(prefix="/user", tags=["users"])


# ─────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────
class RegisterRequest(BaseModel):
    full_name: str
    email:     EmailStr
    password:  str


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class PhoneSendOtpRequest(BaseModel):
    phone: str


class PhoneVerifyRequest(BaseModel):
    phone:     str
    otp:       str
    full_name: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    full_name:    Optional[str] = None
    new_password: Optional[str] = None
    old_password: Optional[str] = None


class UpdatePreferencesRequest(BaseModel):
    language:      Optional[str]  = None
    theme:         Optional[str]  = None
    notifications: Optional[bool] = None
    memory_depth:  Optional[int]  = None   # 0=off, 2-20 messages


# ─────────────────────────────────────────────
# Register — email + password
# ─────────────────────────────────────────────
@router.post("/register")
def user_register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new end user with email and password."""
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(EndUser).filter(EndUser.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = EndUser(
        full_name=body.full_name,
        email=str(body.email),
        hashed_password=hash_password(body.password),
        auth_provider="email",
        is_active=True,
        is_verified=True,
        preferences={"language": "en", "theme": "dark", "notifications": True}
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Phase 4 — welcome + admin alert notifications
    from .notifications import notify_welcome, notify_admin_new_user
    notify_welcome(str(user.email), user.full_name)
    notify_admin_new_user(str(user.email), user.full_name, "email")

    token = create_user_token(str(user.id), str(user.email))
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": _user_dict(user)
    }


# ─────────────────────────────────────────────
# Login — email + password
# ─────────────────────────────────────────────
@router.post("/login")
def user_login(body: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password."""
    user = db.query(EndUser).filter(
        EndUser.email == str(body.email),
        EndUser.auth_provider == "email"
    ).first()

    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Contact support.")

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    token = create_user_token(str(user.id), str(user.email))
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": _user_dict(user)
    }


# ─────────────────────────────────────────────
# Phone OTP — Step 1: Send OTP
# ─────────────────────────────────────────────
@router.post("/phone/send-otp")
def send_otp(body: PhoneSendOtpRequest, db: Session = Depends(get_db)):
    """Send OTP to phone number (console for now, swap for Twilio later)."""
    phone = body.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")

    otp = generate_phone_otp(phone)
    send_phone_otp(phone, otp)

    return {"message": "OTP sent. Check terminal (console) for the code."}


# ─────────────────────────────────────────────
# Phone OTP — Step 2: Verify OTP + login/register
# ─────────────────────────────────────────────
@router.post("/phone/verify")
def verify_otp(body: PhoneVerifyRequest, db: Session = Depends(get_db)):
    """Verify phone OTP. Creates account if new user, logs in if existing."""
    if not verify_phone_otp(body.phone, body.otp):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    user = db.query(EndUser).filter(EndUser.phone == body.phone).first()

    if not user:
        # New user — create account
        user = EndUser(
            full_name=body.full_name or f"User {body.phone[-4:]}",
            phone=body.phone,
            auth_provider="phone",
            is_active=True,
            is_verified=True,
            preferences={"language": "en", "theme": "dark", "notifications": True}
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        # Phase 4 — admin alert for phone registration
        from .notifications import notify_admin_new_user
        notify_admin_new_user(body.phone, user.full_name, "phone")
    else:
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account deactivated. Contact support.")
        user.last_login = datetime.now(timezone.utc)
        db.commit()

    token = create_user_token(str(user.id), user.email or user.phone)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": _user_dict(user)
    }


# ─────────────────────────────────────────────
# Get current user profile
# ─────────────────────────────────────────────
@router.get("/me")
def get_profile(user: EndUser = Depends(require_user)):
    """Get current user's profile."""
    return _user_dict(user)


# ─────────────────────────────────────────────
# Update profile
# ─────────────────────────────────────────────
@router.patch("/me")
def update_profile(
    body: UpdateProfileRequest,
    db: Session = Depends(get_db),
    user: EndUser = Depends(require_user)
):
    """Update name and/or password."""
    if body.full_name:
        user.full_name = body.full_name.strip()

    if body.new_password:
        if len(body.new_password) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
        if user.hashed_password:
            if not body.old_password:
                raise HTTPException(status_code=400, detail="Current password required to set a new one")
            if not verify_password(body.old_password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.hashed_password = hash_password(body.new_password)

    db.commit()
    db.refresh(user)
    return {"message": "Profile updated successfully", "user": _user_dict(user)}


# ─────────────────────────────────────────────
# Update preferences
# ─────────────────────────────────────────────
@router.patch("/me/preferences")
def update_preferences(
    body: UpdatePreferencesRequest,
    db: Session = Depends(get_db),
    user: EndUser = Depends(require_user)
):
    """Update user preferences (language, theme, notifications)."""
    prefs = dict(user.preferences or {})

    if body.language is not None:
        allowed_languages = ["en", "ar", "hi", "ta", "fr", "es", "de"]
        if body.language not in allowed_languages:
            raise HTTPException(status_code=400, detail=f"Language must be one of: {', '.join(allowed_languages)}")
        prefs["language"] = body.language

    if body.theme is not None:
        if body.theme not in ("light", "dark", "system"):
            raise HTTPException(status_code=400, detail="Theme must be: light, dark, or system")
        prefs["theme"] = body.theme

    if body.notifications is not None:
        prefs["notifications"] = body.notifications

    if body.memory_depth is not None:
        if body.memory_depth < 0 or body.memory_depth > 20:
            raise HTTPException(status_code=400, detail="Memory depth must be between 0 and 20")
        prefs["memory_depth"] = body.memory_depth

    user.preferences = prefs
    db.commit()
    return {"message": "Preferences updated", "preferences": prefs}


# ─────────────────────────────────────────────
# Get own sessions
# ─────────────────────────────────────────────
@router.get("/me/sessions")
def get_my_sessions(
    db: Session = Depends(get_db),
    user: EndUser = Depends(require_user)
):
    """Get all chat sessions belonging to the current user."""
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [
        {
            "id":            str(s.id),
            "title":         s.title,
            "created_at":    s.created_at.isoformat(),
            "updated_at":    s.updated_at.isoformat() if s.updated_at else None,
            "message_count": len(s.messages)
        }
        for s in sessions
    ]


# ─────────────────────────────────────────────
# Delete own session
# ─────────────────────────────────────────────
@router.delete("/me/sessions/{session_id}")
def delete_my_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: EndUser = Depends(require_user)
):
    """Delete one of the user's own sessions."""
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


# ─────────────────────────────────────────────
# Delete own account
# ─────────────────────────────────────────────
@router.delete("/me")
def delete_account(
    db: Session = Depends(get_db),
    user: EndUser = Depends(require_user)
):
    """Permanently delete the user's account and all their data."""
    db.delete(user)
    db.commit()
    return {"message": "Account deleted successfully"}


# ─────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────
def _user_dict(user: EndUser) -> dict:
    return {
        "id":           str(user.id),
        "full_name":    user.full_name,
        "email":        user.email,
        "phone":        user.phone,
        "auth_provider": user.auth_provider,
        "is_verified":  user.is_verified,
        "preferences":  user.preferences or {},
        "created_at":   user.created_at.isoformat(),
        "last_login":   user.last_login.isoformat() if user.last_login else None,
    }
