"""
audit.py — Audit trail for SmartBot V2
Records every admin action to the database.
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from .models import AuditLog


def log_action(
    db: Session,
    admin_email: str,
    action: str,
    resource: str = None,
    detail: str = None,
    ip_address: str = None
):
    """
    Record an admin action to the audit trail.

    Examples:
        log_action(db, "admin@x.com", "LOGIN", detail="Successful login")
        log_action(db, "admin@x.com", "DELETE_SESSION", resource="session:abc123")
        log_action(db, "admin@x.com", "UPLOAD_FILE", resource="file:report.pdf")
        log_action(db, "admin@x.com", "CLEAR_LOGS", detail="Cleared all chat logs")
        log_action(db, "admin@x.com", "CREATE_ADMIN", resource="user:new@x.com")
    """
    try:
        entry = AuditLog(
            admin_email=admin_email,
            action=action,
            resource=resource,
            detail=detail,
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc)
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        print(f"[SmartBot] Audit log error: {e}")
        db.rollback()