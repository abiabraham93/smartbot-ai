"""
notifications.py — SmartBot V2 notification system (Phase 4)

Handles:
  - Email notifications (console now, SMTP-ready)
  - Microsoft Teams webhook notifications

To enable real email later, set in .env:
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=you@gmail.com
  SMTP_PASS=your_app_password
  SMTP_FROM=SmartBot <you@gmail.com>

To enable Teams, set in .env:
  TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
"""

import os
import json
import smtplib
import threading
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from .logger import get_logger

logger = get_logger("smartbot.notifications")

# ─────────────────────────────────────────────
# Config — read from environment
# ─────────────────────────────────────────────
SMTP_HOST        = os.getenv("SMTP_HOST", "")
SMTP_PORT        = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER        = os.getenv("SMTP_USER", "")
SMTP_PASS        = os.getenv("SMTP_PASS", "")
SMTP_FROM        = os.getenv("SMTP_FROM", "SmartBot <noreply@smartbot.com>")
TEAMS_WEBHOOK    = os.getenv("TEAMS_WEBHOOK_URL", "")
APP_NAME         = os.getenv("APP_NAME", "SmartBot")


# ─────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────
def _send_in_thread(fn, *args, **kwargs):
    """Run a notification in a background thread so it never blocks the API."""
    t = threading.Thread(target=fn, args=args, kwargs=kwargs, daemon=True)
    t.start()


def _console_email(to: str, subject: str, body: str):
    """Print email to console (development mode)."""
    print(f"\n{'='*55}")
    print(f"[{APP_NAME} EMAIL — console mode]")
    print(f"  To:      {to}")
    print(f"  Subject: {subject}")
    print(f"  ---")
    for line in body.strip().split("\n"):
        print(f"  {line}")
    print(f"{'='*55}\n")


def _smtp_email(to: str, subject: str, html_body: str, text_body: str):
    """Send real email via SMTP."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = SMTP_FROM
        msg["To"]      = to
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, to, msg.as_string())

        logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.error(f"Email failed to {to}: {e}")


def _send_email(to: str, subject: str, html_body: str, text_body: str):
    """Route email to SMTP or console depending on config."""
    if SMTP_HOST and SMTP_USER and SMTP_PASS:
        _smtp_email(to, subject, html_body, text_body)
    else:
        _console_email(to, subject, text_body)


def _teams_post(title: str, message: str, color: str = "0078D4"):
    """Post a message to Microsoft Teams via incoming webhook."""
    if not TEAMS_WEBHOOK:
        logger.debug("Teams webhook not configured — skipping notification")
        return
    try:
        import urllib.request
        payload = {
            "@type":      "MessageCard",
            "@context":   "http://schema.org/extensions",
            "themeColor": color,
            "summary":    title,
            "sections": [{
                "activityTitle":    f"**{title}**",
                "activitySubtitle": datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC"),
                "text":             message,
                "markdown":         True
            }]
        }
        data = json.dumps(payload).encode("utf-8")
        req  = urllib.request.Request(
            TEAMS_WEBHOOK,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info(f"Teams notification sent: {title} (status {resp.status})")
    except Exception as e:
        logger.error(f"Teams notification failed: {e}")


# ─────────────────────────────────────────────
# Public notification functions
# ─────────────────────────────────────────────

def notify_welcome(user_email: str, user_name: str):
    """
    Send welcome email to new end user after registration.
    Fires asynchronously — does not block the register endpoint.
    """
    subject   = f"Welcome to {APP_NAME}!"
    text_body = f"""Hi {user_name},

Welcome to {APP_NAME} — your secure banking AI assistant.

You can now:
  • Ask banking questions anytime
  • View your chat history in your profile
  • Manage your preferences

Start chatting at: http://localhost:5173

Best regards,
The {APP_NAME} Team
"""
    html_body = f"""
<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
  <h2 style="color:#4F46E5;">Welcome to {APP_NAME}!</h2>
  <p>Hi <strong>{user_name}</strong>,</p>
  <p>Your account is ready. You can now ask banking questions, view your chat history, and manage your preferences.</p>
  <a href="http://localhost:5173" style="display:inline-block;margin:16px 0;padding:10px 24px;background:#4F46E5;color:white;text-decoration:none;border-radius:8px;">Start chatting</a>
  <p style="color:#6B7280;font-size:13px;">The {APP_NAME} Team</p>
</div>
"""
    _send_in_thread(_send_email, user_email, subject, html_body, text_body)
    logger.info(f"Welcome notification queued for: {user_email}")


def notify_admin_new_user(user_email: str, user_name: str, auth_provider: str):
    """
    Notify Teams and log when a new end user registers.
    """
    message = (
        f"**Name:** {user_name}  \n"
        f"**Email:** {user_email}  \n"
        f"**Login method:** {auth_provider}  \n"
        f"**Time:** {datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M UTC')}"
    )
    _send_in_thread(_teams_post, f"New user registered on {APP_NAME}", message, "1D9E75")
    logger.info(f"Admin new-user notification queued for: {user_email}")


def notify_admin_error(error_summary: str, endpoint: str):
    """
    Notify Teams when a critical backend error occurs.
    """
    message = (
        f"**Endpoint:** {endpoint}  \n"
        f"**Error:** {error_summary}  \n"
        f"**Time:** {datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M UTC')}"
    )
    _send_in_thread(_teams_post, f"⚠️ {APP_NAME} backend error", message, "D85A30")
    logger.warning(f"Admin error notification queued: {error_summary}")


def notify_daily_summary(
    total_sessions: int,
    total_messages: int,
    new_users: int,
    period: str = "today"
):
    """
    Post daily summary to Teams channel.
    Called by the /admin/notifications/daily-summary endpoint.
    """
    message = (
        f"**Sessions:** {total_sessions}  \n"
        f"**Messages:** {total_messages}  \n"
        f"**New users:** {new_users}  \n"
        f"**Period:** {period}"
    )
    _send_in_thread(_teams_post, f"{APP_NAME} daily summary", message, "534AB7")
    logger.info("Daily summary notification queued")
