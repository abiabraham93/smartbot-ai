"""
database.py — SmartBot V2
PostgreSQL + env-driven vectorstore:
  - PINECONE_API_KEY set → Pinecone (Railway/demo/cloud)
  - PINECONE_API_KEY blank → ChromaDB local (secure/local)

Embedding selection:
  - HUGGINGFACE_API_KEY set → HuggingFace Inference API
  - HUGGINGFACE_API_KEY blank → local sentence-transformers
  - Neither available → FakeEmbeddings (dev only, RAG won't work)
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from .config import DATABASE_URL, VECTOR_DB_DIR, EMBED_MODEL


# ─────────────────────────────────────────────
# PostgreSQL
# ─────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


# ─────────────────────────────────────────────
# Embeddings — env-driven selection
# ─────────────────────────────────────────────
def _get_embeddings():
    """
    Priority:
    1. HuggingFace Inference API (if HUGGINGFACE_API_KEY set) — for Railway/demo
    2. Local sentence-transformers — for local/secure
    3. FakeEmbeddings fallback — dev only, RAG won't work
    """
    hf_key = os.getenv("HUGGINGFACE_API_KEY", "")

    if hf_key:
        try:
            from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
            print("[SmartBot] Using HuggingFace Inference API embeddings")
            return HuggingFaceInferenceAPIEmbeddings(
                api_key=hf_key,
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
        except Exception as e:
            print(f"[SmartBot] HuggingFace API embedding error: {e}")

    # Try local sentence-transformers
    try:
        from langchain_community.embeddings import SentenceTransformerEmbeddings
        print("[SmartBot] Using local SentenceTransformer embeddings")
        return SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
    except ImportError:
        pass

    try:
        from langchain_huggingface import HuggingFaceEmbeddings
        print("[SmartBot] Using local HuggingFaceEmbeddings")
        return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    except ImportError:
        pass

    print("[SmartBot] WARNING: Using FakeEmbeddings — RAG will not work!")
    from langchain_community.embeddings import FakeEmbeddings
    return FakeEmbeddings(size=384)


# ─────────────────────────────────────────────
# Pinecone vectorstore (Railway/demo)
# ─────────────────────────────────────────────
_pinecone_store = None

def _get_pinecone_vectorstore():
    """Connect to Pinecone cloud vectorstore."""
    global _pinecone_store
    if _pinecone_store is not None:
        return _pinecone_store

    pinecone_key   = os.getenv("PINECONE_API_KEY", "")
    pinecone_index = os.getenv("PINECONE_INDEX", "smartbot-docs")

    try:
        from pinecone import Pinecone
        from langchain_pinecone import PineconeVectorStore

        pc         = Pinecone(api_key=pinecone_key)
        embeddings = _get_embeddings()

        _pinecone_store = PineconeVectorStore(
            index=pc.Index(pinecone_index),
            embedding=embeddings,
            text_key="text"
        )
        print(f"[SmartBot] Connected to Pinecone index: {pinecone_index}")
        return _pinecone_store

    except ImportError:
        raise RuntimeError(
            "Pinecone packages not installed. Run: "
            "pip install pinecone langchain-pinecone"
        )
    except Exception as e:
        raise RuntimeError(f"Pinecone connection failed: {e}")


# ─────────────────────────────────────────────
# ChromaDB vectorstore (local/secure)
# ─────────────────────────────────────────────
COLLECTION_NAME       = "smartbot_docs"
_chroma_client        = None
_vectorstore_instance = None


def _get_chroma_client():
    """Returns a singleton ChromaDB persistent client."""
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client

    import chromadb
    from chromadb.config import Settings

    os.makedirs(VECTOR_DB_DIR, exist_ok=True)

    try:
        os.chmod(VECTOR_DB_DIR, 0o755)
        sqlite_path = os.path.join(VECTOR_DB_DIR, "chroma.sqlite3")
        if os.path.exists(sqlite_path):
            os.chmod(sqlite_path, 0o644)
    except Exception:
        pass

    _chroma_client = chromadb.PersistentClient(
        path=VECTOR_DB_DIR,
        settings=Settings(
            allow_reset=True,
            anonymized_telemetry=False
        )
    )
    return _chroma_client


def _get_chroma_vectorstore():
    """Returns cached ChromaDB vectorstore instance."""
    global _vectorstore_instance
    if _vectorstore_instance is not None:
        return _vectorstore_instance

    try:
        from langchain_chroma import Chroma
    except ImportError:
        from langchain_community.vectorstores import Chroma

    client     = _get_chroma_client()
    embeddings = _get_embeddings()

    _vectorstore_instance = Chroma(
        client=client,
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings
    )
    return _vectorstore_instance


# ─────────────────────────────────────────────
# Public API — auto-selects based on env vars
# ─────────────────────────────────────────────
def get_vectorstore():
    """
    Returns the appropriate vectorstore based on environment:
    - PINECONE_API_KEY set   → Pinecone (Railway/demo)
    - PINECONE_API_KEY blank → ChromaDB (local/secure)
    """
    if os.getenv("PINECONE_API_KEY", ""):
        return _get_pinecone_vectorstore()
    return _get_chroma_vectorstore()


def reset_vectorstore():
    """
    Reset vectorstore — behaviour depends on backend:
    - Pinecone: clears all vectors from the index
    - ChromaDB: deletes and recreates the collection
    """
    global _vectorstore_instance, _pinecone_store

    if os.getenv("PINECONE_API_KEY", ""):
        # Pinecone reset — delete all vectors
        _pinecone_store = None
        try:
            pinecone_key   = os.getenv("PINECONE_API_KEY", "")
            pinecone_index = os.getenv("PINECONE_INDEX", "smartbot-docs")
            from pinecone import Pinecone
            pc    = Pinecone(api_key=pinecone_key)
            index = pc.Index(pinecone_index)
            index.delete(delete_all=True)
            print(f"[SmartBot] Pinecone index '{pinecone_index}' cleared.")
        except Exception as e:
            print(f"[SmartBot] Pinecone reset error: {e}")
        return

    # ChromaDB reset — collection level
    _vectorstore_instance = None
    try:
        client = _get_chroma_client()
        existing = [c.name for c in client.list_collections()]
        if COLLECTION_NAME in existing:
            client.delete_collection(COLLECTION_NAME)
            print(f"[SmartBot] ChromaDB collection '{COLLECTION_NAME}' deleted.")
        client.create_collection(COLLECTION_NAME)
        print(f"[SmartBot] ChromaDB collection '{COLLECTION_NAME}' recreated.")
    except Exception as e:
        print(f"[SmartBot] ChromaDB reset error: {e}")
        try:
            global _chroma_client
            _chroma_client.reset()
            _chroma_client = None
            print("[SmartBot] Full ChromaDB client reset done.")
        except Exception as e2:
            print(f"[SmartBot] Full reset also failed: {e2}")
