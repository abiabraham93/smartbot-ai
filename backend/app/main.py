"""
main.py — SmartBot V2 FastAPI application

Phase 1: Security & Compliance
  POST /admin/login                        — step 1: verify password, send OTP
  POST /admin/verify-otp                   — step 2: verify OTP, return JWT
  GET  /admin/stats                        — dashboard stats
  GET  /admin/sessions                     — list all sessions
  GET  /admin/chatlogs                     — paired Q&A logs
  DELETE /admin/sessions/{id}              — delete session
  DELETE /admin/chatlogs                   — clear all logs
  GET  /admin/files                        — list uploaded documents
  GET  /admin/files/download/{filename}    — download document
  DELETE /admin/files/{filename}           — delete + re-ingest
  GET  /admin/logs/app|error|info          — log file viewer
  DELETE /admin/logs/app|error             — clear log files
  GET  /admin/audit                        — audit trail
  GET  /admin/users                        — list admin users (super_admin)
  POST /admin/users                        — create admin user (super_admin)
  PATCH /admin/users/{id}/role             — change role (super_admin)
  PATCH /admin/users/{id}/deactivate       — deactivate (super_admin)
  PATCH /admin/users/{id}/activate         — reactivate (super_admin)
  PATCH /admin/users/{id}/reset-password   — reset password (super_admin)

Phase 2: User Management
  POST /sessions                           — create chat session (links to user)
  GET  /sessions/{id}/messages             — load session messages
  POST /chat                               — send message to AI
  POST /upload                             — upload document (admin only)
  GET/PATCH /user/*                        — end user profile, preferences, sessions
  GET  /admin/end-users                    — list chat users
  PATCH /admin/end-users/{id}/deactivate   — deactivate chat user
  PATCH /admin/end-users/{id}/activate     — reactivate chat user

Phase 3: Analytics & Reporting
  GET  /admin/analytics/overview           — sessions/messages/registrations per day
  GET  /admin/analytics/peak-hours         — message count by hour heatmap
  GET  /admin/analytics/top-questions      — top conversation topics
  GET  /admin/analytics/export             — export as CSV or JSON

Phase 4: Enterprise Integrations
  POST /api/chat                           — external REST API (API key auth)
  GET  /api/health                         — API health check (API key auth)
  GET  /admin/api-keys                     — list API keys
  POST /admin/api-keys                     — create API key
  PATCH /admin/api-keys/{id}/deactivate    — deactivate key
  PATCH /admin/api-keys/{id}/activate      — reactivate key
  DELETE /admin/api-keys/{id}              — delete key (super_admin)
  POST /admin/notifications/daily-summary  — trigger daily summary to Teams
  POST /admin/notifications/test           — send test notification to Teams
"""

import os
import json
import shutil
import time
import re
from typing import Optional

from datetime import datetime, timezone, timedelta

from sqlalchemy import func, cast, Date, extract
from sqlalchemy.orm import Session

from fastapi import (
    FastAPI, Depends, HTTPException, UploadFile, File,
    Request, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .audit import log_action
from .auth import (
    hash_password, authenticate_admin,
    create_access_token, get_current_admin,
    require_super_admin, require_admin_or_above,
    generate_otp, verify_otp, send_otp
)
from .config import (
    DOCUMENTS_DIR, APP_NAME, ENVIRONMENT,
    ALLOWED_ORIGINS, ADMIN_DEFAULT_EMAIL, ADMIN_DEFAULT_PASSWORD,
    LLM_MODEL
)
from .database import get_db, engine, check_db_connection, get_vectorstore
from .models import Base, AdminUser, ChatSession, ChatLog, AuditLog, EndUser
from .user_auth import get_current_user
from .user_router import router as user_router
from .ingestion import ingest_file
from .rag import get_qa_chain
from .utils import sanitize_input, sources_to_json, json_to_sources, auto_title_from_message
from .logger import get_logger
from .language_detect import inject_language_instruction, detect_language
from .notifications import (
    notify_welcome, notify_admin_new_user,
    notify_admin_error, notify_daily_summary
)
from .api_keys import ApiKey, generate_api_key, verify_api_key

logger = get_logger("smartbot.api")

# ─────────────────────────────────────────────
# App init
# ─────────────────────────────────────────────
os.makedirs(DOCUMENTS_DIR, exist_ok=True)

Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=f"{APP_NAME} API",
    version="2.0.0",
    description="Secure Banking AI Chatbot Backend"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)


# ─────────────────────────────────────────────
# Logging middleware
# ─────────────────────────────────────────────
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        start  = time.time()
        method = request.method
        path   = request.url.path
        try:
            response = await call_next(request)
            duration = round((time.time() - start) * 1000, 2)
            code     = response.status_code
            if code >= 400:
                logger.warning(f"{method} {path} → {code} ({duration}ms)")
            else:
                logger.info(f"{method} {path} → {code} ({duration}ms)")
            return response
        except Exception as e:
            duration = round((time.time() - start) * 1000, 2)
            logger.error(f"{method} {path} → ERROR ({duration}ms): {e}")
            raise


app.add_middleware(LoggingMiddleware)
app.include_router(user_router)


# ─────────────────────────────────────────────
# Startup helpers
# ─────────────────────────────────────────────
def seed_admin(db: Session):
    exists = db.query(AdminUser).filter(
        AdminUser.email == ADMIN_DEFAULT_EMAIL
    ).first()
    if not exists:
        admin = AdminUser(
            email=ADMIN_DEFAULT_EMAIL,
            full_name="System Administrator",
            hashed_password=hash_password(ADMIN_DEFAULT_PASSWORD),
            is_active=True,
            role="super_admin"
        )
        db.add(admin)
        db.commit()
        print(f"[SmartBot] Default super admin created: {ADMIN_DEFAULT_EMAIL}")


def auto_ingest_documents():
    if not os.path.exists(DOCUMENTS_DIR):
        logger.info("Documents folder not found — skipping ingestion.")
        return

    allowed = {".pdf", ".txt", ".docx", ".doc", ".xlsx", ".xls", ".csv"}
    files = [
        f for f in os.listdir(DOCUMENTS_DIR)
        if not f.startswith(".")
        and os.path.splitext(f)[1].lower() in allowed
    ]

    if not files:
        logger.info("No documents found to ingest.")
        return

    try:
        vectordb       = get_vectorstore()
        existing_count = vectordb._collection.count()
    except Exception:
        existing_count = 0

    if existing_count > 0:
        logger.info(f"Vectorstore already has {existing_count} chunks — skipping re-ingestion.")
        return

    logger.info(f"Auto-ingesting {len(files)} document(s)...")
    for fname in sorted(files):
        fpath = os.path.join(DOCUMENTS_DIR, fname)
        try:
            ingest_file(fpath)
            logger.info(f"Ingested: {fname}")
        except Exception as e:
            logger.error(f"Failed to ingest {fname}: {e}")
    logger.info("Auto-ingestion complete.")


def _warm_model():
    try:
        logger.info(f"Warming up model: {LLM_MODEL}...")
        from .rag import _get_llm
        llm = _get_llm()
        llm.invoke("hi")
        logger.info("Model ready.")
    except Exception as e:
        logger.warning(f"Model warm-up skipped: {e}")


@app.on_event("startup")
def on_startup():
    logger.info("=" * 50)
    logger.info(f"SmartBot V2 starting up — env: {ENVIRONMENT}")
    db = next(get_db())
    try:
        seed_admin(db)
    finally:
        db.close()
    auto_ingest_documents()
    _warm_model()
    logger.info("SmartBot V2 startup complete.")


# ─────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────
class ChatRequest(BaseModel):
    session_id:    str
    question:      str
    internet:      bool = False
    user_language: Optional[str] = None   # profile language preference


class NewSessionRequest(BaseModel):
    title: str = ""


class CreateAdminRequest(BaseModel):
    email:     str
    full_name: str
    password:  str
    role:      str = "admin"


class ResetPasswordRequest(BaseModel):
    new_password: str


class CreateApiKeyRequest(BaseModel):
    name:        str
    description: str = ""


class ApiChatRequest(BaseModel):
    question:   str
    internet:   bool = False
    session_id: Optional[str] = None


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":      "ok",
        "app":         APP_NAME,
        "version":     "2.0.0",
        "environment": ENVIRONMENT,
        "database":    "connected" if check_db_connection() else "error"
    }


# ─────────────────────────────────────────────
# Sessions
# ─────────────────────────────────────────────
@app.post("/sessions")
def create_session(
    body:         NewSessionRequest,
    request:      Request,
    db:           Session = Depends(get_db),
    current_user            = Depends(get_current_user)
):
    session = ChatSession(
        title=body.title or "New Chat",
        ip_address=request.client.host if request.client else None,
        user_id=current_user.id if current_user else None
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": str(session.id), "title": session.title}


@app.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = []
    for log in session.messages:
        messages.append({
            "role":       log.role,
            "content":    log.content,
            "sources":    json_to_sources(log.sources),
            "created_at": log.created_at.isoformat()
        })
    return {"session_id": session_id, "title": session.title, "messages": messages}


# ─────────────────────────────────────────────
# Chat
# ─────────────────────────────────────────────
@app.post("/chat")
@limiter.limit("30/minute")
def chat(request: Request, body: ChatRequest, db: Session = Depends(get_db)):
    question = sanitize_input(body.question)
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    session = db.query(ChatSession).filter(ChatSession.id == body.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.title in ("New Chat", "", None):
        session.title = auto_title_from_message(question)
        db.commit()

    # Phase 6 — detect language and inject instruction
    detected_lang, lang_question = inject_language_instruction(question, body.user_language)

    try:
        chain, retriever = get_qa_chain(internet=body.internet)
        if body.internet:
            answer      = chain(lang_question)
            source_docs = retriever.invoke(question)
        else:
            source_docs = retriever.invoke(question)
            answer      = chain(lang_question)

        # Extract content from ChatGroq response object
        if hasattr(answer, 'content'):
            answer = answer.content

        if not answer:
            answer = "I could not generate a response."

        sources = []
        for doc in source_docs[:6]:
            metadata   = getattr(doc, "metadata", {})
            raw_source = metadata.get("source") or metadata.get("title") or "Unknown"
            sources.append({"source": os.path.basename(raw_source), "page": metadata.get("page")})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    client_ip = request.client.host if request.client else None
    db.add(ChatLog(session_id=session.id, role="user",      content=question, sources=None,                   ip_address=client_ip))
    db.add(ChatLog(session_id=session.id, role="assistant", content=answer,   sources=sources_to_json(sources)))
    session.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"answer": answer, "sources": sources, "session_id": str(session.id), "detected_lang": detected_lang}


# ─────────────────────────────────────────────
# Document Upload (admin only)
# ─────────────────────────────────────────────
@app.post("/upload")
async def upload_file(
    file:  UploadFile = File(...),
    db:    Session    = Depends(get_db),
    admin             = Depends(get_current_admin)
):
    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    allowed = {".pdf", ".txt", ".docx", ".doc", ".xlsx", ".xls", ".csv"}
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(allowed)}")

    dest = os.path.join(DOCUMENTS_DIR, os.path.basename(filename))
    try:
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        ingest_file(dest)
    except Exception as e:
        if os.path.exists(dest):
            os.remove(dest)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

    return {"message": "File uploaded and ingested successfully", "filename": filename}


# ─────────────────────────────────────────────
# Admin — Step 1: password → OTP
# ─────────────────────────────────────────────
@app.post("/admin/login")
@limiter.limit("10/minute")
def admin_login(
    request:   Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db:        Session = Depends(get_db)
):
    admin = authenticate_admin(form_data.username, form_data.password, db)
    if not admin:
        log_action(db, form_data.username, "LOGIN_FAILED",
                   detail="Wrong password",
                   ip_address=request.client.host if request.client else None)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    otp = generate_otp(admin.email)
    send_otp(admin.email, otp)
    logger.info(f"OTP sent for: {admin.email}")
    return {"message": "OTP sent. Please check your terminal (console)."}


# ─────────────────────────────────────────────
# Admin — Step 2: OTP → JWT
# ─────────────────────────────────────────────
@app.post("/admin/verify-otp")
@limiter.limit("10/minute")
def admin_verify_otp(
    request:   Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db:        Session = Depends(get_db)
):
    email = form_data.username
    otp   = form_data.password

    if not verify_otp(email, otp):
        log_action(db, email, "OTP_FAILED",
                   detail="Wrong or expired OTP",
                   ip_address=request.client.host if request.client else None)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP. Please try again.")

    admin = db.query(AdminUser).filter(AdminUser.email == email, AdminUser.is_active == True).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    admin.last_login = datetime.now(timezone.utc)
    db.commit()

    log_action(db, email, "LOGIN_SUCCESS",
               detail=f"Role: {admin.role}",
               ip_address=request.client.host if request.client else None)

    token = create_access_token(data={"sub": admin.email, "role": admin.role})
    return {
        "access_token": token,
        "token_type":   "bearer",
        "admin_name":   admin.full_name or admin.email,
        "role":         admin.role
    }


# ─────────────────────────────────────────────
# Admin — Dashboard stats
# ─────────────────────────────────────────────
@app.get("/admin/stats")
def admin_stats(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    total_sessions = db.query(ChatSession).count()
    total_messages = db.query(ChatLog).count()
    total_admins   = db.query(AdminUser).filter(AdminUser.is_active == True).count()
    total_docs     = len([f for f in os.listdir(DOCUMENTS_DIR) if not f.startswith(".")]) if os.path.exists(DOCUMENTS_DIR) else 0
    return {
        "total_sessions":  total_sessions,
        "total_messages":  total_messages,
        "total_admins":    total_admins,
        "total_documents": total_docs,
        "database":        "connected" if check_db_connection() else "error"
    }


# ─────────────────────────────────────────────
# Admin — List sessions
# ─────────────────────────────────────────────
@app.get("/admin/sessions")
def admin_list_sessions(limit: int = 50, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    sessions = db.query(ChatSession).order_by(ChatSession.updated_at.desc()).limit(limit).all()
    return [
        {
            "id":            str(s.id),
            "title":         s.title,
            "ip_address":    s.ip_address,
            "created_at":    s.created_at.isoformat(),
            "updated_at":    s.updated_at.isoformat() if s.updated_at else None,
            "message_count": len(s.messages),
            "user_id":       str(s.user_id) if s.user_id else None,
            "user_name":     s.user.full_name if s.user else "Anonymous",
            "user_email":    s.user.email if s.user else None,
        }
        for s in sessions
    ]


# ─────────────────────────────────────────────
# Admin — All chat logs
# ─────────────────────────────────────────────
@app.get("/admin/chatlogs")
def admin_get_logs(limit: int = 100, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    sessions    = db.query(ChatSession).order_by(ChatSession.updated_at.desc()).limit(limit).all()
    paired_rows = []
    for session in sessions:
        messages = sorted(session.messages, key=lambda m: m.created_at)
        i = 0
        while i < len(messages):
            user_msg = messages[i]   if i < len(messages)   and messages[i].role == "user"      else None
            bot_msg  = messages[i+1] if i+1 < len(messages) and messages[i+1].role == "assistant" else None
            if user_msg:
                paired_rows.append({
                    "session_id":    str(session.id),
                    "session_title": session.title,
                    "question":      user_msg.content if user_msg else "",
                    "answer":        bot_msg.content  if bot_msg  else "—",
                    "ip_address":    user_msg.ip_address if user_msg else None,
                    "question_time": user_msg.created_at.isoformat() if user_msg else None,
                    "answer_time":   bot_msg.created_at.isoformat()  if bot_msg  else None,
                    "user_id":       str(session.user_id) if session.user_id else None,
                    "user_name":     session.user.full_name if session.user else "Anonymous",
                })
            i += 2
    return paired_rows


# ─────────────────────────────────────────────
# Admin — Delete single session
# ─────────────────────────────────────────────
@app.delete("/admin/sessions/{session_id}")
def admin_delete_session(session_id: str, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": f"Session {session_id} deleted"}


# ─────────────────────────────────────────────
# Admin — Clear ALL logs
# ─────────────────────────────────────────────
@app.delete("/admin/chatlogs")
def admin_clear_all_logs(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    deleted_logs     = db.query(ChatLog).delete()
    deleted_sessions = db.query(ChatSession).delete()
    db.commit()
    return {"message": "All logs cleared", "deleted_messages": deleted_logs, "deleted_sessions": deleted_sessions}


# ─────────────────────────────────────────────
# Admin — List uploaded documents
# ─────────────────────────────────────────────
@app.get("/admin/files")
def admin_list_files(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    allowed = {".pdf", ".txt", ".docx", ".doc", ".xlsx", ".xls", ".csv"}
    files   = []
    if os.path.exists(DOCUMENTS_DIR):
        for fname in sorted(os.listdir(DOCUMENTS_DIR)):
            if fname.startswith("."):
                continue
            ext = os.path.splitext(fname)[1].lower()
            if ext not in allowed:
                continue
            fpath = os.path.join(DOCUMENTS_DIR, fname)
            st    = os.stat(fpath)
            files.append({
                "name":        fname,
                "size_kb":     round(st.st_size / 1024, 1),
                "extension":   ext,
                "uploaded_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
            })
    return files


@app.get("/admin/files/download/{filename}")
def admin_download_file(filename: str, admin=Depends(get_current_admin)):
    from fastapi.responses import FileResponse
    safe_name = os.path.basename(filename)
    fpath     = os.path.join(DOCUMENTS_DIR, safe_name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=fpath, filename=safe_name, media_type="application/octet-stream")


# ─────────────────────────────────────────────
# Admin — Delete document + re-ingest
# ─────────────────────────────────────────────
@app.delete("/admin/files/{filename}")
def admin_delete_file(filename: str, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    from .database import reset_vectorstore

    safe_name = os.path.basename(filename)
    fpath     = os.path.join(DOCUMENTS_DIR, safe_name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="File not found")

    os.remove(fpath)
    reset_vectorstore()
    time.sleep(0.5)

    allowed   = {".pdf", ".txt", ".docx", ".doc", ".xlsx", ".xls", ".csv"}
    remaining = [
        f for f in os.listdir(DOCUMENTS_DIR)
        if not f.startswith(".") and os.path.splitext(f)[1].lower() in allowed
    ]
    ingested, failed = 0, []
    for fname in remaining:
        try:
            ingest_file(os.path.join(DOCUMENTS_DIR, fname))
            ingested += 1
        except Exception as e:
            failed.append(fname)

    msg = f"'{safe_name}' deleted. {ingested}/{len(remaining)} file(s) re-ingested."
    if failed:
        msg += f" Failed: {', '.join(failed)}"
    return {"message": msg, "remaining_files": len(remaining), "ingested": ingested, "failed": failed}


# ─────────────────────────────────────────────
# Admin — Log file viewer
# ─────────────────────────────────────────────
@app.get("/admin/logs/app")
def admin_get_app_log(minutes: int = 30, admin=Depends(get_current_admin)):
    from .logger import APP_LOG_FILE
    return _read_log_recent(APP_LOG_FILE, minutes)


@app.get("/admin/logs/error")
def admin_get_error_log(minutes: int = 30, admin=Depends(get_current_admin)):
    from .logger import ERROR_LOG_FILE
    return _read_log_recent(ERROR_LOG_FILE, minutes)


@app.delete("/admin/logs/app")
def admin_clear_app_log(admin=Depends(get_current_admin)):
    from .logger import APP_LOG_FILE
    try:
        open(APP_LOG_FILE, "w").close()
        logger.info(f"app.log cleared by admin: {admin.email}")
        return {"message": "app.log cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/logs/error")
def admin_clear_error_log(admin=Depends(get_current_admin)):
    from .logger import ERROR_LOG_FILE
    try:
        open(ERROR_LOG_FILE, "w").close()
        logger.info(f"error.log cleared by admin: {admin.email}")
        return {"message": "error.log cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/logs/info")
def admin_log_info(admin=Depends(get_current_admin)):
    from .logger import APP_LOG_FILE, ERROR_LOG_FILE
    def file_info(path):
        if not os.path.exists(path):
            return {"exists": False, "size_kb": 0, "lines": 0}
        size = os.path.getsize(path)
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            lines = sum(1 for _ in f)
        return {"exists": True, "size_kb": round(size / 1024, 1), "lines": lines, "path": path}
    return {"app_log": file_info(APP_LOG_FILE), "error_log": file_info(ERROR_LOG_FILE)}


def _read_log_recent(path: str, minutes: int = 30) -> dict:
    if not os.path.exists(path):
        return {"lines": [], "total": 0, "shown": 0, "file": path, "minutes": minutes}
    try:
        cutoff  = datetime.now() - timedelta(minutes=minutes)
        pattern = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            all_lines = f.readlines()
        total  = len(all_lines)
        recent = []
        for line in all_lines:
            line = line.rstrip()
            if not line:
                continue
            m = pattern.match(line)
            if m:
                try:
                    ts = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S")
                    if ts >= cutoff:
                        recent.append(line)
                except Exception:
                    recent.append(line)
            else:
                if recent:
                    recent.append(line)
        if not recent and all_lines:
            recent = [l.rstrip() for l in all_lines[-50:] if l.strip()]
            return {"lines": recent, "total": total, "shown": len(recent), "file": path, "minutes": minutes,
                    "note": "No recent logs found — showing last 50 lines instead"}
        return {"lines": recent, "total": total, "shown": len(recent), "file": path, "minutes": minutes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read log: {e}")


# ─────────────────────────────────────────────
# Admin — Audit Trail
# ─────────────────────────────────────────────
@app.get("/admin/audit")
def admin_get_audit(limit: int = 100, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id":          str(l.id),
            "admin_email": l.admin_email,
            "action":      l.action,
            "resource":    l.resource,
            "detail":      l.detail,
            "ip_address":  l.ip_address,
            "created_at":  l.created_at.isoformat()
        }
        for l in logs
    ]


# ─────────────────────────────────────────────
# Admin — List admin users
# ─────────────────────────────────────────────
@app.get("/admin/users")
def admin_list_users(db: Session = Depends(get_db), admin=Depends(require_super_admin)):
    users = db.query(AdminUser).order_by(AdminUser.created_at).all()
    return [
        {
            "id":         str(u.id),
            "email":      u.email,
            "full_name":  u.full_name,
            "role":       u.role,
            "is_active":  u.is_active,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "created_at": u.created_at.isoformat()
        }
        for u in users
    ]


# ─────────────────────────────────────────────
# Admin — Create admin user
# ─────────────────────────────────────────────
@app.post("/admin/users")
def admin_create_user(body: CreateAdminRequest, request: Request, db: Session = Depends(get_db), admin=Depends(require_super_admin)):
    if db.query(AdminUser).filter(AdminUser.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    new_admin = AdminUser(
        email=body.email, full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role, is_active=True
    )
    db.add(new_admin)
    db.commit()
    log_action(db, admin.email, "CREATE_ADMIN",
               resource=f"user:{body.email}", detail=f"Role: {new_admin.role}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"Admin {body.email} created with role: {new_admin.role}"}


# ─────────────────────────────────────────────
# Admin — Update user role
# ─────────────────────────────────────────────
@app.patch("/admin/users/{user_id}/role")
def admin_update_role(user_id: str, request: Request, role: str = "admin", db: Session = Depends(get_db), admin=Depends(require_super_admin)):
    if role not in ("super_admin", "admin", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role. Use: super_admin, admin, viewer")
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old_role  = user.role
    user.role = role
    db.commit()
    log_action(db, admin.email, "UPDATE_ROLE", resource=f"user:{user.email}",
               detail=f"Changed from {old_role} to {role}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"Role updated to {role} for {user.email}"}


# ─────────────────────────────────────────────
# Admin — Deactivate admin user
# ─────────────────────────────────────────────
@app.patch("/admin/users/{user_id}/deactivate")
def admin_deactivate_user(user_id: str, request: Request, db: Session = Depends(get_db), admin=Depends(require_super_admin)):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email == admin.email:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.is_active = False
    db.commit()
    log_action(db, admin.email, "DEACTIVATE_USER", resource=f"user:{user.email}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"User {user.email} deactivated"}


# ─────────────────────────────────────────────
# Admin — Reactivate admin user
# ─────────────────────────────────────────────
@app.patch("/admin/users/{user_id}/activate")
def admin_activate_user(user_id: str, request: Request, db: Session = Depends(get_db), admin=Depends(require_super_admin)):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    log_action(db, admin.email, "ACTIVATE_USER", resource=f"user:{user.email}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"User {user.email} reactivated"}


# ─────────────────────────────────────────────
# Admin — Reset admin user password
# ─────────────────────────────────────────────
@app.patch("/admin/users/{user_id}/reset-password")
def admin_reset_password(user_id: str, body: ResetPasswordRequest, request: Request, db: Session = Depends(get_db), admin=Depends(require_super_admin)):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    log_action(db, admin.email, "RESET_PASSWORD", resource=f"user:{user.email}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"Password reset for {user.email}"}


# ─────────────────────────────────────────────
# Admin — List end users (chat users)
# ─────────────────────────────────────────────
@app.get("/admin/end-users")
def admin_list_end_users(limit: int = 100, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    users = db.query(EndUser).order_by(EndUser.created_at.desc()).limit(limit).all()
    return [
        {
            "id":            str(u.id),
            "full_name":     u.full_name,
            "email":         u.email,
            "phone":         u.phone,
            "auth_provider": u.auth_provider,
            "is_active":     u.is_active,
            "is_verified":   u.is_verified,
            "preferences":   u.preferences or {},
            "created_at":    u.created_at.isoformat(),
            "last_login":    u.last_login.isoformat() if u.last_login else None,
        }
        for u in users
    ]


# ─────────────────────────────────────────────
# Admin — Deactivate end user
# ─────────────────────────────────────────────
@app.patch("/admin/end-users/{user_id}/deactivate")
def admin_deactivate_end_user(user_id: str, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin_or_above)):
    user = db.query(EndUser).filter(EndUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    log_action(db, admin.email, "DEACTIVATE_END_USER",
               resource=f"end_user:{user.email or user.phone}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"User {user.email or user.phone} deactivated"}


# ─────────────────────────────────────────────
# Admin — Reactivate end user
# ─────────────────────────────────────────────
@app.patch("/admin/end-users/{user_id}/activate")
def admin_activate_end_user(user_id: str, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin_or_above)):
    user = db.query(EndUser).filter(EndUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    log_action(db, admin.email, "ACTIVATE_END_USER",
               resource=f"end_user:{user.email or user.phone}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"User {user.email or user.phone} reactivated"}


# ─────────────────────────────────────────────
# Admin — Analytics: Overview (Phase 3)
# ─────────────────────────────────────────────
@app.get("/admin/analytics/overview")
def analytics_overview(days: int = 30, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    sessions_by_day = (
        db.query(func.date(ChatSession.created_at).label("day"), func.count(ChatSession.id).label("count"))
        .filter(ChatSession.created_at >= cutoff)
        .group_by(func.date(ChatSession.created_at))
        .order_by(func.date(ChatSession.created_at))
        .all()
    )
    messages_by_day = (
        db.query(func.date(ChatLog.created_at).label("day"), func.count(ChatLog.id).label("count"))
        .filter(ChatLog.created_at >= cutoff, ChatLog.role == "user")
        .group_by(func.date(ChatLog.created_at))
        .order_by(func.date(ChatLog.created_at))
        .all()
    )
    registrations_by_day = (
        db.query(func.date(EndUser.created_at).label("day"), func.count(EndUser.id).label("count"))
        .filter(EndUser.created_at >= cutoff)
        .group_by(func.date(EndUser.created_at))
        .order_by(func.date(EndUser.created_at))
        .all()
    )
    return {
        "sessions_by_day":      [{"day": str(r.day), "count": r.count} for r in sessions_by_day],
        "messages_by_day":      [{"day": str(r.day), "count": r.count} for r in messages_by_day],
        "registrations_by_day": [{"day": str(r.day), "count": r.count} for r in registrations_by_day],
        "days": days
    }


# ─────────────────────────────────────────────
# Admin — Analytics: Peak Hours (Phase 3)
# ─────────────────────────────────────────────
@app.get("/admin/analytics/peak-hours")
def analytics_peak_hours(days: int = 30, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(extract("hour", ChatLog.created_at).label("hour"), func.count(ChatLog.id).label("count"))
        .filter(ChatLog.created_at >= cutoff, ChatLog.role == "user")
        .group_by(extract("hour", ChatLog.created_at))
        .order_by(extract("hour", ChatLog.created_at))
        .all()
    )
    hour_map = {int(r.hour): r.count for r in rows}
    return {"hours": [{"hour": h, "count": hour_map.get(h, 0)} for h in range(24)], "days": days}


# ─────────────────────────────────────────────
# Admin — Analytics: Top Questions (Phase 3)
# ─────────────────────────────────────────────
@app.get("/admin/analytics/top-questions")
def analytics_top_questions(days: int = 30, limit: int = 10, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(ChatSession.title, func.count(ChatSession.id).label("count"))
        .filter(ChatSession.created_at >= cutoff, ChatSession.title != "New Chat", ChatSession.title != None)
        .group_by(ChatSession.title)
        .order_by(func.count(ChatSession.id).desc())
        .limit(limit)
        .all()
    )
    return {"questions": [{"title": r.title, "count": r.count} for r in rows], "days": days}


# ─────────────────────────────────────────────
# Admin — Analytics: Export (Phase 3)
# ─────────────────────────────────────────────
@app.get("/admin/analytics/export")
def analytics_export(format: str = "csv", days: int = 30, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    from fastapi.responses import StreamingResponse
    import csv
    import io as _io

    cutoff   = datetime.now(timezone.utc) - timedelta(days=days)
    sessions = db.query(ChatSession).filter(ChatSession.created_at >= cutoff).order_by(ChatSession.created_at.desc()).all()

    rows = []
    for session in sessions:
        messages = sorted(session.messages, key=lambda m: m.created_at)
        i = 0
        while i < len(messages):
            user_msg = messages[i]   if i < len(messages)   and messages[i].role == "user"      else None
            bot_msg  = messages[i+1] if i+1 < len(messages) and messages[i+1].role == "assistant" else None
            if user_msg:
                rows.append({
                    "session_id":    str(session.id),
                    "session_title": session.title or "",
                    "user_name":     session.user.full_name if session.user else "Anonymous",
                    "user_email":    session.user.email     if session.user else "",
                    "question":      user_msg.content,
                    "answer":        bot_msg.content if bot_msg else "",
                    "ip_address":    user_msg.ip_address or "",
                    "question_time": user_msg.created_at.isoformat(),
                    "answer_time":   bot_msg.created_at.isoformat() if bot_msg else "",
                })
            i += 2

    if format == "json":
        content = json.dumps(rows, indent=2)
        return StreamingResponse(
            _io.StringIO(content),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=smartbot_export_{days}days.json"}
        )

    output = _io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    else:
        output.write("No data found for the selected period.\n")
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=smartbot_export_{days}days.csv"}
    )


# ─────────────────────────────────────────────
# Phase 4 — REST API endpoints (API key auth)
# ─────────────────────────────────────────────
@app.post("/api/chat")
@limiter.limit("60/minute")
def api_chat(
    request: Request,
    body:    ApiChatRequest,
    db:      Session = Depends(get_db),
    api_key: ApiKey  = Depends(verify_api_key)
):
    """External REST API chat endpoint. Requires X-API-Key header."""
    question = sanitize_input(body.question)
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    if body.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == body.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(
            title=auto_title_from_message(question),
            ip_address=request.client.host if request.client else None
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    try:
        chain, retriever = get_qa_chain(internet=body.internet)
        if body.internet:
            answer      = chain(question)
            source_docs = retriever.invoke(question)
        else:
            source_docs = retriever.invoke(question)
            answer      = chain(lang_question)

        if hasattr(answer, 'content'):
            answer = answer.content
        if not answer:
            answer = "I could not generate a response."

        sources = []
        for doc in source_docs[:6]:
            metadata   = getattr(doc, "metadata", {})
            raw_source = metadata.get("source") or metadata.get("title") or "Unknown"
            sources.append({"source": os.path.basename(raw_source), "page": metadata.get("page")})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    client_ip = request.client.host if request.client else None
    db.add(ChatLog(session_id=session.id, role="user",      content=question, ip_address=client_ip))
    db.add(ChatLog(session_id=session.id, role="assistant", content=answer,   sources=sources_to_json(sources)))
    session.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "answer":     answer,
        "sources":    sources,
        "session_id": str(session.id),
        "api_key":    api_key.key_prefix + "..."
    }


@app.get("/api/health")
def api_health(api_key: ApiKey = Depends(verify_api_key)):
    return {"status": "ok", "app": APP_NAME, "version": "2.0.0"}


# ─────────────────────────────────────────────
# Phase 4 — API key management (admin only)
# ─────────────────────────────────────────────
@app.get("/admin/api-keys")
def admin_list_api_keys(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    keys = db.query(ApiKey).order_by(ApiKey.created_at.desc()).all()
    return [
        {
            "id":          str(k.id),
            "name":        k.name,
            "description": k.description,
            "key_prefix":  k.key_prefix + "...",
            "is_active":   k.is_active,
            "created_by":  k.created_by,
            "created_at":  k.created_at.isoformat(),
            "last_used":   k.last_used.isoformat() if k.last_used else None,
        }
        for k in keys
    ]


@app.post("/admin/api-keys")
def admin_create_api_key(
    body:    CreateApiKeyRequest,
    request: Request,
    db:      Session = Depends(get_db),
    admin            = Depends(require_admin_or_above)
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Key name is required")

    full_key, key_hash, prefix = generate_api_key()
    key = ApiKey(
        name=body.name.strip(),
        description=body.description,
        key_hash=key_hash,
        key_prefix=prefix,
        created_by=admin.email,
        is_active=True
    )
    db.add(key)
    db.commit()
    db.refresh(key)

    log_action(db, admin.email, "CREATE_API_KEY",
               resource=f"api_key:{body.name}",
               ip_address=request.client.host if request.client else None)
    logger.info(f"API key created: {body.name} by {admin.email}")

    return {
        "message": "API key created. Copy it now — it will not be shown again.",
        "id":      str(key.id),
        "name":    key.name,
        "api_key": full_key,
        "prefix":  prefix + "..."
    }


@app.patch("/admin/api-keys/{key_id}/deactivate")
def admin_deactivate_api_key(key_id: str, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin_or_above)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    db.commit()
    log_action(db, admin.email, "DEACTIVATE_API_KEY", resource=f"api_key:{key.name}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"API key '{key.name}' deactivated"}


@app.patch("/admin/api-keys/{key_id}/activate")
def admin_activate_api_key(key_id: str, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin_or_above)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = True
    db.commit()
    log_action(db, admin.email, "ACTIVATE_API_KEY", resource=f"api_key:{key.name}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"API key '{key.name}' reactivated"}


@app.delete("/admin/api-keys/{key_id}")
def admin_delete_api_key(key_id: str, request: Request, db: Session = Depends(get_db), admin=Depends(require_super_admin)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    db.delete(key)
    db.commit()
    log_action(db, admin.email, "DELETE_API_KEY", resource=f"api_key:{key.name}",
               ip_address=request.client.host if request.client else None)
    return {"message": f"API key '{key.name}' permanently deleted"}


# ─────────────────────────────────────────────
# Phase 4 — Notification triggers (admin only)
# ─────────────────────────────────────────────
@app.post("/admin/notifications/daily-summary")
def trigger_daily_summary(db: Session = Depends(get_db), admin=Depends(require_admin_or_above)):
    """Manually trigger daily summary notification to Teams."""
    cutoff    = datetime.now(timezone.utc) - timedelta(hours=24)
    sessions  = db.query(ChatSession).filter(ChatSession.created_at >= cutoff).count()
    messages  = db.query(ChatLog).filter(ChatLog.created_at >= cutoff, ChatLog.role == "user").count()
    new_users = db.query(EndUser).filter(EndUser.created_at >= cutoff).count()

    notify_daily_summary(sessions, messages, new_users, "last 24 hours")
    return {"message": "Daily summary notification sent", "sessions": sessions, "messages": messages, "new_users": new_users}


@app.post("/admin/notifications/test")
def test_notification(db: Session = Depends(get_db), admin=Depends(require_admin_or_above)):
    """Send test notification to verify Teams webhook is working."""
    from .notifications import _teams_post
    _teams_post(
        f"{APP_NAME} — test notification",
        f"This is a test notification from {APP_NAME} admin dashboard.  \n"
        f"**Sent by:** {admin.email}  \n"
        f"**Time:** {datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M UTC')}",
        "534AB7"
    )
    return {"message": "Test notification sent to Teams"}


# ─────────────────────────────────────────────
# Phase 5 — Streaming chat endpoint (SSE)
# ─────────────────────────────────────────────
from fastapi.responses import StreamingResponse as FastAPIStreaming
from .models import MessageFeedback


@app.post("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, body: ChatRequest, db: Session = Depends(get_db)):
    """
    Streaming chat endpoint using Server-Sent Events.
    Sends answer word-by-word. Saves full message to DB after streaming.
    Supports conversation memory and multi-language (Phase 6).
    """
    import asyncio

    question = sanitize_input(body.question)
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    session = db.query(ChatSession).filter(ChatSession.id == body.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.title in ("New Chat", "", None):
        session.title = auto_title_from_message(question)
        db.commit()

    client_ip = request.client.host if request.client else None

    # Save user message immediately
    user_log = ChatLog(
        session_id=session.id,
        role="user",
        content=question,
        ip_address=client_ip
    )
    db.add(user_log)
    db.commit()
    db.refresh(user_log)

    async def generate():
        full_answer = ""
        sources     = []

        try:
            # Phase 5 — Build conversation memory context
            history  = []
            from sqlalchemy.orm import joinedload
            session = db.query(ChatSession).options(joinedload(ChatSession.messages)).filter(ChatSession.id == body.session_id).first()
            messages = sorted(session.messages, key=lambda m: m.created_at)
            # Determine memory depth from user preferences (default 6)
            mem_depth = 6
            if session.user and session.user.preferences:
                mem_depth = session.user.preferences.get("memory_depth", 6)
            recent = messages[-mem_depth:] if len(messages) > mem_depth else messages
            for msg in recent:
                if msg.id != user_log.id:
                    history.append({"role": msg.role, "content": msg.content})

            # Phase 6 — Detect language and inject instruction
            detected_lang, lang_question = inject_language_instruction(
                question, getattr(body, "user_language", None)
            )

            # Build context-aware question with memory
            if history:
                context_lines = []
                for h in history:
                    prefix = "User" if h["role"] == "user" else "Assistant"
                    context_lines.append(f"{prefix}: {h['content'][:300]}")
                context_str   = "\n".join(context_lines)
                full_question = f"Previous conversation:\n{context_str}\n\nCurrent question: {lang_question}"
            else:
                full_question = lang_question

            chain, retriever = get_qa_chain(internet=body.internet)

            if body.internet:
                source_docs = retriever.invoke(question)
                answer      = chain(full_question)
            else:
                source_docs = retriever.invoke(question)
                answer      = chain(full_question)

            if hasattr(answer, 'content'):
                answer = answer.content

            # Extract content from ChatGroq response object
            if hasattr(answer, 'content'):
                answer = answer.content

            for doc in source_docs[:6]:
                metadata   = getattr(doc, "metadata", {})
                raw_source = metadata.get("source") or metadata.get("title") or "Unknown"
                sources.append({
                    "source": os.path.basename(raw_source),
                    "page":   metadata.get("page")
                })
            # Internet chain sometimes returns a dict with 'result' key
            if isinstance(answer, dict):
                answer = answer.get("result") or answer.get("answer") or answer.get("output_text") or ""
            if not answer or not str(answer).strip():
                answer = "I could not generate a response."
            answer = str(answer).strip()

            # Stream word by word
            words = answer.split(" ")
            for i, word in enumerate(words):
                chunk        = word + (" " if i < len(words) - 1 else "")
                full_answer += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                await asyncio.sleep(0.02)

            # Save bot message
            bot_log = ChatLog(
                session_id=session.id,
                role="assistant",
                content=full_answer,
                sources=sources_to_json(sources)
            )
            db.add(bot_log)
            session.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(bot_log)

            # Generate follow-up suggestions
            suggestions = _generate_suggestions(question, full_answer)

            yield f"data: {json.dumps({'type': 'done', 'sources': sources, 'message_id': str(bot_log.id), 'suggestions': suggestions, 'detected_lang': detected_lang})}\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return FastAPIStreaming(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )


def _generate_suggestions(question: str, answer: str) -> list:
    """Generate 3 follow-up question suggestions based on the Q&A."""
    templates = [
        "What documents do I need for {topic}?",
        "What are the eligibility requirements for {topic}?",
        "How long does {topic} typically take?",
        "What are the fees associated with {topic}?",
        "Can you explain {topic} in more detail?",
        "What is the process to apply for {topic}?",
        "Are there any alternatives to {topic}?",
        "What are the benefits of {topic}?",
    ]
    stop_words = {"what","how","when","where","why","is","are","the","a","an","i",
                  "can","do","does","will","my","me","about","tell","explain",
                  "give","please","get","for"}
    words = [w.lower().strip("?.,!") for w in question.split()
             if w.lower().strip("?.,!") not in stop_words and len(w) > 3]
    topic = " ".join(words[:3]) if words else "this topic"

    import random
    selected = random.sample(templates, min(3, len(templates)))
    return [t.format(topic=topic) for t in selected]


# ─────────────────────────────────────────────
# Phase 5 — Message Feedback endpoints
# ─────────────────────────────────────────────
class FeedbackRequest(BaseModel):
    message_id: str
    rating:     int
    comment:    str = ""


@app.post("/feedback")
def submit_feedback(body: FeedbackRequest, db: Session = Depends(get_db)):
    """Submit thumbs up / down on a bot message."""
    if body.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="Rating must be 1 or -1")

    message = db.query(ChatLog).filter(
        ChatLog.id   == body.message_id,
        ChatLog.role == "assistant"
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    existing = db.query(MessageFeedback).filter(
        MessageFeedback.message_id == body.message_id
    ).first()
    if existing:
        existing.rating  = body.rating
        existing.comment = body.comment
    else:
        db.add(MessageFeedback(
            message_id=body.message_id,
            rating=body.rating,
            comment=body.comment
        ))
    db.commit()
    return {"message": "Feedback saved", "rating": body.rating}


@app.get("/admin/feedback")
def admin_get_feedback(
    limit: int = 50,
    db:    Session = Depends(get_db),
    admin          = Depends(get_current_admin)
):
    feedbacks = (
        db.query(MessageFeedback)
        .order_by(MessageFeedback.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":         str(f.id),
            "message_id": str(f.message_id),
            "rating":     f.rating,
            "comment":    f.comment,
            "answer":     f.message.content[:200],
            "created_at": f.created_at.isoformat()
        }
        for f in feedbacks
    ]


@app.get("/admin/feedback/stats")
def admin_feedback_stats(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    total    = db.query(MessageFeedback).count()
    positive = db.query(MessageFeedback).filter(MessageFeedback.rating ==  1).count()
    negative = db.query(MessageFeedback).filter(MessageFeedback.rating == -1).count()
    return {
        "total":    total,
        "positive": positive,
        "negative": negative,
        "score":    round(positive / total * 100, 1) if total > 0 else 0
    }
