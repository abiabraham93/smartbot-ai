"""
database.py — SmartBot V2
PostgreSQL + env-driven vectorstore:
  - PINECONE_API_KEY set → Pinecone (Railway/demo/cloud)
  - PINECONE_API_KEY blank → ChromaDB local (secure/local)

Embedding selection:
  - HUGGINGFACE_API_KEY set → HuggingFace Inference API (lightweight, no torch)
  - HUGGINGFACE_API_KEY blank → local sentence-transformers
  - Neither available → FakeEmbeddings (dev only, RAG won't work)
"""

import os
from typing import List
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
# Lightweight HuggingFace Embeddings (no torch!)
# Calls the new router.huggingface.co endpoint
# ─────────────────────────────────────────────
from langchain_core.embeddings import Embeddings


class HuggingFaceAPIEmbeddings(Embeddings):
    """
    Lightweight embeddings class that calls HuggingFace Inference API directly.
    No torch/sentence-transformers needed — just uses HTTP requests.
    Uses the new router.huggingface.co endpoint (old api-inference.huggingface.co is dead).
    Returns float32 values for Pinecone compatibility.
    """

    def __init__(self, api_key: str, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.api_key = api_key
        self.model_name = model_name
        self.api_url = f"https://router.huggingface.co/hf-inference/pipeline/feature-extraction/{model_name}"

    def _to_float32(self, embeddings: List[List[float]]) -> List[List[float]]:
        """Convert float64 values to float32 for Pinecone compatibility."""
        return [[float(v) for v in emb] for emb in embeddings]

    def _call_api(self, texts: List[str]) -> List[List[float]]:
        """Call HuggingFace API and return embeddings as float32."""
        import requests
        import time

        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {"inputs": texts}

        for attempt in range(3):
            resp = requests.post(self.api_url, headers=headers, json=payload, timeout=30)

            if resp.status_code == 200:
                result = resp.json()
                # API returns list of embeddings (each is a list of floats)
                if isinstance(result, list) and len(result) > 0:
                    # Batch response: list of list of floats
                    if isinstance(result[0], list) and isinstance(result[0][0], float):
                        return self._to_float32(result)
                    # Single text: list of floats
                    if isinstance(result[0], float):
                        return self._to_float32([result])
                raise ValueError(f"Unexpected API response format: {type(result)}")

            elif resp.status_code == 503:
                # Model loading — wait and retry
                wait_time = resp.json().get("estimated_time", 10)
                print(f"[SmartBot] Model loading, waiting {wait_time:.0f}s...")
                time.sleep(min(wait_time, 30))
                continue

            else:
                raise ValueError(
                    f"HuggingFace API error {resp.status_code}: {resp.text}"
                )

        raise ValueError("HuggingFace API failed after 3 retries")

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents."""
        if not texts:
            return []
        # Process in batches of 32 to avoid API limits
        all_embeddings = []
        batch_size = 32
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = self._call_api(batch)
            all_embeddings.extend(embeddings)
        return all_embeddings

    def embed_query(self, text: str) -> List[float]:
        """Embed a single query."""
        result = self._call_api([text])
        return result[0]


# ─────────────────────────────────────────────
# Embeddings — env-driven selection
# ─────────────────────────────────────────────
_embeddings_instance = None


def _get_embeddings():
    """
    Priority:
    1. HuggingFace Inference API (lightweight, if HUGGINGFACE_API_KEY set) — for Railway
    2. Local sentence-transformers — for local dev
    3. FakeEmbeddings fallback — dev only, RAG won't work
    """
    global _embeddings_instance
    if _embeddings_instance is not None:
        return _embeddings_instance

    hf_key = os.getenv("HUGGINGFACE_API_KEY", "")

    # Option 1: Lightweight HuggingFace API (no torch needed — perfect for Railway)
    if hf_key:
        try:
            emb = HuggingFaceAPIEmbeddings(
                api_key=hf_key,
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
            # Verify it works
            test = emb.embed_query("test")
            if isinstance(test, list) and len(test) == 384:
                print(f"[SmartBot] Using HuggingFace API embeddings (dimension: {len(test)})")
                _embeddings_instance = emb
                return _embeddings_instance
            else:
                print(f"[SmartBot] HuggingFace API returned unexpected dimension: {len(test) if isinstance(test, list) else 'N/A'}")
        except Exception as e:
            print(f"[SmartBot] HuggingFace API embedding error: {e}")

    # Option 2: Local sentence-transformers (for local dev)
    try:
        from langchain_community.embeddings import SentenceTransformerEmbeddings
        print("[SmartBot] Using local SentenceTransformer embeddings")
        _embeddings_instance = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
        return _embeddings_instance
    except ImportError:
        pass

    try:
        from langchain_huggingface import HuggingFaceEmbeddings
        print("[SmartBot] Using local HuggingFaceEmbeddings")
        _embeddings_instance = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        return _embeddings_instance
    except ImportError:
        pass

    # Option 3: FakeEmbeddings — RAG will NOT work
    print("[SmartBot] WARNING: Using FakeEmbeddings — RAG will not work!")
    from langchain_community.embeddings import FakeEmbeddings
    _embeddings_instance = FakeEmbeddings(size=384)
    return _embeddings_instance


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
            "pip install pinecone-client langchain-pinecone"
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
    global _vectorstore_instance, _pinecone_store, _embeddings_instance

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
