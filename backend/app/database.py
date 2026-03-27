"""
database.py — SmartBot V2
PostgreSQL + ChromaDB with proper collection-level reset
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
# ChromaDB — collection-level reset (no folder delete)
# ─────────────────────────────────────────────
COLLECTION_NAME  = "smartbot_docs"
_chroma_client   = None
_vectorstore_instance = None


def _get_embeddings():
    import os
    hf_key = os.getenv("HUGGINGFACE_API_KEY", "")
    if hf_key:
        try:
            from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
            return HuggingFaceInferenceAPIEmbeddings(
                api_key=hf_key,
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
        except Exception as e:
            print(f"[SmartBot] HuggingFace API embedding error: {e}")
    print("[SmartBot] WARNING: Using FakeEmbeddings — RAG will not work!")
    from langchain_community.embeddings import FakeEmbeddings
    return FakeEmbeddings(size=384)


def _get_chroma_client():
    """Returns a singleton ChromaDB persistent client."""
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client

    import chromadb
    from chromadb.config import Settings

    os.makedirs(VECTOR_DB_DIR, exist_ok=True)

    # Fix permissions on Mac
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


def get_vectorstore():
    """Returns cached Chroma vectorstore instance."""
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


def reset_vectorstore():
    """
    Deletes and recreates the collection without touching the folder.
    This avoids all filesystem permission issues on Mac.
    """
    global _vectorstore_instance, _chroma_client

    # Clear cached vectorstore
    _vectorstore_instance = None

    try:
        client = _get_chroma_client()

        # Delete the collection if it exists
        existing = [c.name for c in client.list_collections()]
        if COLLECTION_NAME in existing:
            client.delete_collection(COLLECTION_NAME)
            print(f"[SmartBot] Collection '{COLLECTION_NAME}' deleted.")

        # Recreate empty collection immediately
        client.create_collection(COLLECTION_NAME)
        print(f"[SmartBot] Collection '{COLLECTION_NAME}' recreated fresh.")

    except Exception as e:
        print(f"[SmartBot] Reset error: {e}")
        # Last resort — reset entire client
        try:
            _chroma_client.reset()
            _chroma_client = None
            print("[SmartBot] Full client reset done.")
        except Exception as e2:
            print(f"[SmartBot] Full reset also failed: {e2}")