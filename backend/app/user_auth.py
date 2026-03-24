"""
user_auth.py — JWT authentication for end users (chat users)
Completely separate from admin auth.
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

from .config import JWT_SECRET_KEY, JWT_ALGORITHM
from .database import get_db
from .models import EndUser

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────
USER_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for end users

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
# Phone OTP store (in-memory, swap for Redis later)
# ─────────────────────────────────────────────
_phone_otp_store: dict = {}


def generate_phone_otp(phone: str) -> str:
    """Generate 6-digit OTP for phone verification."""
    otp = "".join(random.choices(string.digits, k=6))
    _phone_otp_store[phone] = {
        "otp":     otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    return otp


def verify_phone_otp(phone: str, otp: str) -> bool:
    """Verify phone OTP — returns True if valid."""
    record = _phone_otp_store.get(phone)
    if not record:
        return False
    if datetime.now(timezone.utc) > record["expires"]:
        del _phone_otp_store[phone]
        return False
    if record["otp"] != otp.strip():
        return False
    del _phone_otp_store[phone]
    return True


def send_phone_otp(phone: str, otp: str):
    """
    Send OTP to phone.
    Currently prints to console — swap for Twilio when ready.
    """
    print(f"\n{'='*50}")
    print(f"[SmartBot User OTP] Phone: {phone}")
    print(f"[SmartBot User OTP] Code:  {otp}")
    print(f"[SmartBot User OTP] Valid for 5 minutes")
    print(f"{'='*50}\n")


# ─────────────────────────────────────────────
# JWT tokens
# ─────────────────────────────────────────────
class UserTokenData(BaseModel):
    user_id: Optional[str] = None
    email:   Optional[str] = None


def create_user_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=USER_TOKEN_EXPIRE_MINUTES)
    data   = {"sub": user_id, "email": email, "type": "user", "exp": expire}
    return jwt.encode(data, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_user_token(token: str) -> UserTokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate user credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "user":
            raise credentials_exception
        user_id: str = payload.get("sub")
        email:   str = payload.get("email")
        if user_id is None:
            raise credentials_exception
        return UserTokenData(user_id=user_id, email=email)
    except JWTError:
        raise credentials_exception


# ─────────────────────────────────────────────
# OAuth2 scheme for end users
# ─────────────────────────────────────────────
user_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/user/login", auto_error=False)


def get_current_user(
    token: str = Depends(user_oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[EndUser]:
    """
    Returns current end user from JWT.
    Returns None if no token (anonymous access allowed).
    """
    if not token:
        return None
    try:
        token_data = decode_user_token(token)
        user = db.query(EndUser).filter(
            EndUser.id == token_data.user_id,
            EndUser.is_active == True
        ).first()
        return user
    except Exception:
        return None


def require_user(
    token: str = Depends(user_oauth2_scheme),
    db: Session = Depends(get_db)
) -> EndUser:
    """
    Returns current end user. Raises 401 if not logged in.
    Use this for endpoints that require authentication.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please log in to access this feature",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token_data = decode_user_token(token)
    user = db.query(EndUser).filter(
        EndUser.id == token_data.user_id,
        EndUser.is_active == True
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated"
        )
    return user
