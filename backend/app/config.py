import os
from dotenv import load_dotenv

load_dotenv(override=False)

# ─────────────────────────────────────────────
# Base paths
# ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DOCUMENTS_DIR = os.path.join(BASE_DIR, "storage", "documents")
VECTOR_DB_DIR = os.path.join(BASE_DIR, "storage", "vectordb")

# ─────────────────────────────────────────────
# LLM
# Groq (if GROQ_API_KEY set)  → Railway/demo
# Ollama (fallback)            → local/secure
# ─────────────────────────────────────────────
LLM_MODEL    = os.getenv("LLM_MODEL",    "llama-3.1-8b-instant")
EMBED_MODEL  = os.getenv("EMBED_MODEL",  "all-MiniLM-L6-v2")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ─────────────────────────────────────────────
# Vector DB
# Pinecone (if PINECONE_API_KEY set) → Railway/demo
# ChromaDB (fallback)                → local/secure
# ─────────────────────────────────────────────
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX   = os.getenv("PINECONE_INDEX",   "smartbot-docs")

# ─────────────────────────────────────────────
# PostgreSQL
# ─────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set!")

# ─────────────────────────────────────────────
# JWT / Auth
# ─────────────────────────────────────────────
JWT_SECRET_KEY              = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production")
JWT_ALGORITHM               = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12   # 12 hours

# ─────────────────────────────────────────────
# Default admin
# ─────────────────────────────────────────────
ADMIN_DEFAULT_EMAIL    = os.getenv("ADMIN_DEFAULT_EMAIL",    "admin@smartbot.com")
ADMIN_DEFAULT_PASSWORD = os.getenv("ADMIN_DEFAULT_PASSWORD", "Admin@SmartBot2025!")

# ─────────────────────────────────────────────
# App / CORS
# ─────────────────────────────────────────────
APP_NAME    = os.getenv("APP_NAME",    "SmartBot")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _origins_raw.split(",")]
