import os
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# Base paths
# ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DOCUMENTS_DIR = os.path.join(BASE_DIR, "storage", "documents")
VECTOR_DB_DIR = os.path.join(BASE_DIR, "storage", "vectordb")

# ─────────────────────────────────────────────
# Ollama / LLM models
# ─────────────────────────────────────────────
LLM_MODEL = "llama3.2:1b"  # very fast, good for simple queries
EMBED_MODEL = "nomic-embed-text"

# ─────────────────────────────────────────────
# PostgreSQL
# ─────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/smartbot_v2"
)

# ─────────────────────────────────────────────
# JWT / Auth
# ─────────────────────────────────────────────
JWT_SECRET_KEY    = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production")
JWT_ALGORITHM     = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12   # 12 hours instead of 8

# ─────────────────────────────────────────────
# Default admin (created on first startup)
# ─────────────────────────────────────────────
ADMIN_DEFAULT_EMAIL    = os.getenv("ADMIN_DEFAULT_EMAIL",    "admin@smartbot.com")
ADMIN_DEFAULT_PASSWORD = os.getenv("ADMIN_DEFAULT_PASSWORD", "Admin@SmartBot2025!")

# ─────────────────────────────────────────────
# App / CORS
# ─────────────────────────────────────────────
APP_NAME = os.getenv("APP_NAME", "SmartBot")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _origins_raw.split(",")]