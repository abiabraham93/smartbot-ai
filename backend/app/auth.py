"""
auth.py — JWT authentication + OTP + role checking for SmartBot V2
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import random
import string

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .config import JWT_SECRET_KEY, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from .database import get_db
from .models import AdminUser


# ─────────────────────────────────────────────
# Password hashing
# ─────────────────────────────────────────────
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12
)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─────────────────────────────────────────────
# OTP — 6 digit code, valid for 5 minutes
# ─────────────────────────────────────────────
# Store OTPs in memory: {email: {"otp": "123456", "expires": datetime}}
_otp_store: dict = {}


def generate_otp(email: str) -> str:
    """Generate a 6-digit OTP for the given email. Valid for 5 minutes."""
    otp = "".join(random.choices(string.digits, k=6))
    _otp_store[email] = {
        "otp":     otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    return otp


def verify_otp(email: str, otp: str) -> bool:
    """Verify OTP. Returns True if valid, False if expired or wrong."""
    record = _otp_store.get(email)
    if not record:
        return False
    if datetime.now(timezone.utc) > record["expires"]:
        del _otp_store[email]
        return False
    if record["otp"] != otp.strip():
        return False
    del _otp_store[email]
    return True


def send_otp(email: str, otp: str):
    """
    Send OTP to the admin.
    Currently prints to console — swap for email when SMTP is ready.
    """
    print(f"\n{'='*50}")
    print(f"[SmartBot OTP] Email: {email}")
    print(f"[SmartBot OTP] Code:  {otp}")
    print(f"[SmartBot OTP] Valid for 5 minutes")
    print(f"{'='*50}\n")


# ─────────────────────────────────────────────
# JWT tokens
# ─────────────────────────────────────────────
class TokenData(BaseModel):
    email: Optional[str] = None
    role:  Optional[str] = None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire    = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        role:  str = payload.get("role", "admin")
        if email is None:
            raise credentials_exception
        return TokenData(email=email, role=role)
    except JWTError:
        raise credentials_exception


# ─────────────────────────────────────────────
# OAuth2 scheme
# ─────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/login")


def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> AdminUser:
    """Returns current admin user from JWT. Any valid role allowed."""
    token_data = decode_token(token)
    admin = db.query(AdminUser).filter(
        AdminUser.email == token_data.email,
        AdminUser.is_active == True
    ).first()
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account not found or deactivated"
        )
    return admin


def require_super_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> AdminUser:
    """Only allows super_admin role. Use on sensitive endpoints."""
    admin = get_current_admin(token, db)
    if admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required for this action"
        )
    return admin


def require_admin_or_above(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> AdminUser:
    """Allows admin and super_admin. Blocks viewer."""
    admin = get_current_admin(token, db)
    if admin.role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required. Viewers have read-only access."
        )
    return admin


# ─────────────────────────────────────────────
# Authenticate
# ─────────────────────────────────────────────
def authenticate_admin(email: str, password: str, db: Session) -> Optional[AdminUser]:
    admin = db.query(AdminUser).filter(AdminUser.email == email).first()
    if not admin:
        return None
    if not verify_password(password, admin.hashed_password):
        return None
    return admin