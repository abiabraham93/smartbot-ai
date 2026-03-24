import os
from app.ingestion import ingest_file
from app.config import DOCUMENTS_DIR

ALLOWED_EXTENSIONS = [".pdf", ".txt", ".docx", ".doc", ".xlsx", ".xls", ".csv"]

def ingest_all_documents():
    if not os.path.exists(DOCUMENTS_DIR):
        print("Documents folder not found:", DOCUMENTS_DIR)
        return

    files = sorted(os.listdir(DOCUMENTS_DIR))
    if not files:
        print("No documents to ingest in:", DOCUMENTS_DIR)
        return

    for fname in files:
        if fname.startswith("."):
            # skip hidden files like .DS_Store
            print("Skipping hidden file:", fname)
            continue
        ext = os.path.splitext(fname)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            print("Skipping unsupported file:", fname)
            continue
        path = os.path.join(DOCUMENTS_DIR, fname)
        if os.path.isfile(path):
            print("Ingesting:", fname)
            try:
                ingest_file(path)
            except Exception as e:
                print("Failed to ingest", fname, "-", e)

if __name__ == "__main__":
    ingest_all_documents()
    print("Done.")