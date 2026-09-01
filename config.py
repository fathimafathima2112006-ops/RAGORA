import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")

    # Google OAuth
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/callback"
    )

    # Groq
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", os.getenv("LLM_API_KEY", ""))
    GROQ_BASE_URL = os.getenv(
        "GROQ_BASE_URL", "https://api.groq.com/openai/v1"
    )
    # Compound gives RAGORA automatic real-time web search using the same Groq key.
    GROQ_MODEL = "openai/gpt-oss-20b"  # hard safety default; stale .env values are ignored
    # Backward-compatible alias used by the RAG engine.
    LLM_API_KEY = GROQ_API_KEY
    LLM_MODEL = "openai/gpt-oss-20b"  # never allow stale 120B config to return
    # Web-only model. Compound Mini uses Groq built-in web search without a separate search API key.
    WEB_MODEL = os.getenv("WEB_MODEL", "groq/compound-mini")
    # Small-model fallback prevents a large-model TPM/request-size failure from
    # taking down the chat. It is only used automatically when Groq rejects a
    # request because it is too large or rate-limited.
    LLM_FALLBACK_MODEL = "openai/gpt-oss-20b"
    LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "90"))
    MAX_OUTPUT_TOKENS = min(int(os.getenv("MAX_OUTPUT_TOKENS", "220")), 220)
    MAX_HISTORY_MESSAGES = min(int(os.getenv("MAX_HISTORY_MESSAGES", "4")), 4)

    # Storage
    # In production (Render/Railway/etc.), point these to persistent storage.
    DB_PATH = os.getenv("DB_PATH", os.path.join(BASE_DIR, "instance", "ragora.db"))
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(BASE_DIR, "uploads"))

    MAX_CONTENT_LENGTH = 25 * 1024 * 1024
    ALLOWED_EXTENSIONS = {
        "pdf", "docx", "txt", "md", "csv", "xlsx", "json",
        "py", "js", "ts", "java", "c", "cpp", "html", "css", "sql"
    }

    # Retrieval
    CHUNK_SIZE = 900
    CHUNK_OVERLAP = 120
    TOP_K_CHUNKS = 3
    RETRIEVAL_MIN_SCORE = float(os.getenv("RETRIEVAL_MIN_SCORE", "0.16"))
