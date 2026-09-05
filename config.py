import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _env_text(name, default=""):
    """Return a non-empty environment value, falling back safely.

    Hosting dashboards can define a variable with an empty value. Calling
    int()/float() directly on that empty string caused the Vercel import crash.
    """
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip()
    return value if value else default


def _env_int(name, default, minimum=None, maximum=None):
    raw = _env_text(name, str(default))
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = int(default)
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def _env_float(name, default, minimum=None, maximum=None):
    raw = _env_text(name, str(default))
    try:
        value = float(raw)
    except (TypeError, ValueError):
        value = float(default)
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


class Config:
    SECRET_KEY = _env_text("SECRET_KEY", "change-me-in-production")

    # Google OAuth
    GOOGLE_CLIENT_ID = _env_text("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = _env_text("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI = _env_text(
        "GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/callback"
    )

    # Groq
    GROQ_API_KEY = _env_text("GROQ_API_KEY", _env_text("LLM_API_KEY"))
    GROQ_BASE_URL = _env_text(
        "GROQ_BASE_URL", "https://api.groq.com/openai/v1"
    )
    GROQ_MODEL = "openai/gpt-oss-20b"
    LLM_API_KEY = GROQ_API_KEY
    LLM_MODEL = "openai/gpt-oss-20b"
    WEB_MODEL = _env_text("WEB_MODEL", "groq/compound-mini")
    LLM_FALLBACK_MODEL = "openai/gpt-oss-20b"

    # All numeric environment values are parsed defensively. This is important
    # on Vercel because an environment variable may exist but contain "".
    LLM_TIMEOUT = _env_int("LLM_TIMEOUT", 90, minimum=5, maximum=180)
    MAX_OUTPUT_TOKENS = _env_int("MAX_OUTPUT_TOKENS", 220, minimum=32, maximum=220)
    MAX_HISTORY_MESSAGES = _env_int("MAX_HISTORY_MESSAGES", 4, minimum=1, maximum=4)

    # Storage
    # Vercel Functions have an ephemeral writable /tmp directory. Do not try to
    # create instance/ or uploads/ inside the deployed application bundle.
    if _env_text("VERCEL") == "1":
        DB_PATH = _env_text("DB_PATH", "/tmp/ragora.db")
        UPLOAD_DIR = _env_text("UPLOAD_DIR", "/tmp/ragora_uploads")
    else:
        DB_PATH = _env_text("DB_PATH", os.path.join(BASE_DIR, "instance", "ragora.db"))
        UPLOAD_DIR = _env_text("UPLOAD_DIR", os.path.join(BASE_DIR, "uploads"))

    MAX_CONTENT_LENGTH = 25 * 1024 * 1024
    ALLOWED_EXTENSIONS = {
        "pdf", "docx", "txt", "md", "csv", "xlsx", "json",
        "py", "js", "ts", "java", "c", "cpp", "html", "css", "sql"
    }

    # Retrieval
    CHUNK_SIZE = 900
    CHUNK_OVERLAP = 120
    TOP_K_CHUNKS = 3
    RETRIEVAL_MIN_SCORE = _env_float("RETRIEVAL_MIN_SCORE", 0.16, minimum=0.0, maximum=1.0)
