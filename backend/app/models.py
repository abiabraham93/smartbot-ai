"""
models.py — SQLAlchemy table definitions for SmartBot V2
Tables:
  - admin_users    : admin login credentials + roles
  - end_users      : chat user accounts (Phase 2)
  - chat_sessions  : one row per conversation session
  - chat_logs      : every message stored here
  - audit_logs     : every admin action tracked here
  - message_feedback : thumbs up/down on bot answers (Phase 5)
"""

from datetime import datetime, timezone
import uuid

from sqlalchemy import (
    Column, String, Text, DateTime, Boolean,
    ForeignKey, Integer, JSON, SmallInteger
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


def _now():
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────
# Admin Users
# ─────────────────────────────────────────────
class AdminUser(Base):
    __tablename__ = "admin_users"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email           = Column(String(255), unique=True, nullable=False, index=True)
    full_name       = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(String(20),  nullable=False, default="admin")
    is_active       = Column(Boolean, default=True, nullable=False)
    otp_secret      = Column(String(64), nullable=True)
    otp_enabled     = Column(Boolean, default=False, nullable=False)
    created_at      = Column(DateTime(timezone=True), default=_now, nullable=False)
    last_login      = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<AdminUser email={self.email} role={self.role}>"


# ─────────────────────────────────────────────
# End Users (chat users — Phase 2)
# ─────────────────────────────────────────────
class EndUser(Base):
    __tablename__ = "end_users"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email           = Column(String(255), unique=True, nullable=True, index=True)
    phone           = Column(String(30),  unique=True, nullable=True, index=True)
    full_name       = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=True)
    is_active       = Column(Boolean, default=True, nullable=False)
    is_verified     = Column(Boolean, default=False, nullable=False)
    google_id       = Column(String(255), nullable=True, unique=True)
    auth_provider   = Column(String(30),  nullable=False, default="email")
    preferences     = Column(JSON, nullable=True, default=dict)
    created_at      = Column(DateTime(timezone=True), default=_now, nullable=False)
    last_login      = Column(DateTime(timezone=True), nullable=True)
    last_active     = Column(DateTime(timezone=True), nullable=True)

    sessions        = relationship(
        "ChatSession",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<EndUser email={self.email} name={self.full_name}>"


# ─────────────────────────────────────────────
# Chat Sessions
# ─────────────────────────────────────────────
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title      = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)
    is_active  = Column(Boolean, default=True, nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_id    = Column(
        UUID(as_uuid=True),
        ForeignKey("end_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    user       = relationship("EndUser", back_populates="sessions")
    messages   = relationship(
        "ChatLog",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatLog.created_at"
    )

    def __repr__(self):
        return f"<ChatSession id={self.id} title={self.title}>"


# ─────────────────────────────────────────────
# Chat Logs
# ─────────────────────────────────────────────
class ChatLog(Base):
    __tablename__ = "chat_logs"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    role       = Column(String(20),  nullable=False)
    content    = Column(Text,        nullable=False)
    sources    = Column(Text,        nullable=True)
    ip_address = Column(String(64),  nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    session    = relationship("ChatSession", back_populates="messages")
    feedback   = relationship(
        "MessageFeedback",
        back_populates="message",
        uselist=False,
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<ChatLog role={self.role} session={self.session_id}>"


# ─────────────────────────────────────────────
# Message Feedback (Phase 5)
# ─────────────────────────────────────────────
class MessageFeedback(Base):
    __tablename__ = "message_feedback"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_logs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,   # one feedback per message
        index=True
    )
    # 1 = thumbs up, -1 = thumbs down
    rating     = Column(SmallInteger, nullable=False)
    comment    = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    message    = relationship("ChatLog", back_populates="feedback")

    def __repr__(self):
        return f"<MessageFeedback message={self.message_id} rating={self.rating}>"


# ─────────────────────────────────────────────
# Audit Logs
# ─────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_email = Column(String(255), nullable=False, index=True)
    action      = Column(String(100), nullable=False)
    resource    = Column(String(255), nullable=True)
    detail      = Column(Text,        nullable=True)
    ip_address  = Column(String(64),  nullable=True)
    created_at  = Column(DateTime(timezone=True), default=_now, nullable=False)

    def __repr__(self):
        return f"<AuditLog admin={self.admin_email} action={self.action}>"
