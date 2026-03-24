"""
api_keys.py — REST API key management for SmartBot V2 (Phase 4)

API keys allow external applications to query SmartBot programmatically.
Keys are stored in PostgreSQL, hashed like passwords.

Usage:
  curl -X POST http://localhost:8000/api/chat \\
    -H "X-API-Key: sk-smb-xxxxxxxxxxxxxxxx" \\
    -H "Content-Type: application/json" \\
    -d '{"question": "What are the loan rates?"}'
"""

import os
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session
import uuid

from .database import get_db
from .models import Base
from .logger import get_logger

logger = get_logger("smartbot.api_keys")

# ─────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────
def _now():
    return datetime.now(timezone.utc)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(100), nullable=False)
    key_hash    = Column(String(64),  nullable=False, unique=True, index=True)
    key_prefix  = Column(String(12),  nullable=False)
    is_active   = Column(Boolean, default=True, nullable=False)
    created_by  = Column(String(255), nullable=False)
    last_used   = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=_now, nullable=False)
    description = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ApiKey name={self.name} prefix={self.key_prefix}>"


# ─────────────────────────────────────────────
# Key generation & hashing
# ─────────────────────────────────────────────
def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.
    Returns (full_key, key_hash, key_prefix)
    Full key format: sk-smb-<32 random hex chars>
    Only the hash is stored — the full key is shown ONCE to the user.
    """
    raw      = secrets.token_hex(16)          # 32 hex chars
    full_key = f"sk-smb-{raw}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    prefix   = full_key[:12]                  # "sk-smb-xxxx" for display
    return full_key, key_hash, prefix


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


# ─────────────────────────────────────────────
# FastAPI security scheme
# ─────────────────────────────────────────────
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(
    api_key: str = Security(api_key_header),
    db: Session  = Depends(get_db)
) -> ApiKey:
    """
    Dependency — verifies X-API-Key header against DB.
    Updates last_used on success.
    Raises 401 if missing or invalid.
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Provide X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"}
        )

    key_hash = hash_key(api_key)
    record   = db.query(ApiKey).filter(
        ApiKey.key_hash == key_hash,
        ApiKey.is_active == True
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key.",
            headers={"WWW-Authenticate": "ApiKey"}
        )

    # Update last_used timestamp
    record.last_used = datetime.now(timezone.utc)
    db.commit()

    logger.info(f"API key used: {record.key_prefix}... (name: {record.name})")
    return record
