import os
from dotenv import load_dotenv

# Load .env file when running locally.
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _env_text(name, default=""):
    """
    Safely read a text environment variable.

    Empty or whitespace-only values fall back to the supplied default.
    This prevents deployment/import crashes caused by empty environment values.
    """
    value = os.getenv(name)

    if value is None:
        return default

    value = value.strip()

    return value if value else default


def _env_int(name, default, minimum=None, maximum=None):
    """
    Safely read an integer environment variable.
    """
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
    """
    Safely read a floating-point environment variable.
    """
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
    # ============================================================
    # APPLICATION
    # ============================================================

    SECRET_KEY = _env_text(
        "SECRET_KEY",
        "change-me-in-production"
    )

    PRODUCTION = _env_text(
        "PRODUCTION",
        "0"
    ) == "1"

    COOKIE_SECURE = _env_text(
        "COOKIE_SECURE",
        "0"
    ) == "1"


    # ============================================================
    # GOOGLE OAUTH
    # ============================================================

    GOOGLE_CLIENT_ID = _env_text(
        "GOOGLE_CLIENT_ID"
    )

    GOOGLE_CLIENT_SECRET = _env_text(
        "GOOGLE_CLIENT_SECRET"
    )

    GOOGLE_REDIRECT_URI = _env_text(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:5000/auth/callback"
    )


    # ============================================================
    # GROQ / LLM
    # ============================================================

    GROQ_API_KEY = _env_text(
        "GROQ_API_KEY",
        _env_text("LLM_API_KEY")
    )

    GROQ_BASE_URL = _env_text(
        "GROQ_BASE_URL",
        "https://api.groq.com/openai/v1"
    )

    # Main model.
    #
    # Environment variable can override this:
    # GROQ_MODEL=openai/gpt-oss-20b
    GROQ_MODEL = _env_text(
        "GROQ_MODEL",
        "openai/gpt-oss-20b"
    )

    # Backward-compatible LLM API key.
    LLM_API_KEY = GROQ_API_KEY

    # Main LLM model.
    LLM_MODEL = _env_text(
        "LLM_MODEL",
        GROQ_MODEL
    )

    # Web/search model.
    #
    # IMPORTANT:
    # Do not default to groq/compound-mini because it can cause
    # model availability/request failures.
    WEB_MODEL = _env_text(
        "WEB_MODEL",
        GROQ_MODEL
    )

    # Fallback model.
    LLM_FALLBACK_MODEL = _env_text(
        "LLM_FALLBACK_MODEL",
        GROQ_MODEL
    )


    # ============================================================
    # LLM PERFORMANCE / LIMITS
    # ============================================================

    LLM_TIMEOUT = _env_int(
        "LLM_TIMEOUT",
        90,
        minimum=5,
        maximum=180
    )

    MAX_OUTPUT_TOKENS = _env_int(
        "MAX_OUTPUT_TOKENS",
        220,
        minimum=32,
        maximum=220
    )

    MAX_HISTORY_MESSAGES = _env_int(
        "MAX_HISTORY_MESSAGES",
        4,
        minimum=1,
        maximum=4
    )


    # ============================================================
    # STORAGE
    # ============================================================

    # Vercel functions have ephemeral writable storage.
    #
    # For Vercel:
    #   /tmp is writable but temporary.
    #
    # For Render/local:
    #   use persistent/local directories configured below.

    if _env_text("VERCEL") == "1":

        DB_PATH = _env_text(
            "DB_PATH",
            "/tmp/ragora.db"
        )

        UPLOAD_DIR = _env_text(
            "UPLOAD_DIR",
            "/tmp/ragora_uploads"
        )

    else:

        DB_PATH = _env_text(
            "DB_PATH",
            os.path.join(
                BASE_DIR,
                "instance",
                "ragora.db"
            )
        )

        UPLOAD_DIR = _env_text(
            "UPLOAD_DIR",
            os.path.join(
                BASE_DIR,
                "uploads"
            )
        )


    # ============================================================
    # FILE UPLOADS
    # ============================================================

    MAX_CONTENT_LENGTH = 25 * 1024 * 1024

    ALLOWED_EXTENSIONS = {
        "pdf",
        "docx",
        "txt",
        "md",
        "csv",
        "xlsx",
        "json",
        "py",
        "js",
        "ts",
        "java",
        "c",
        "cpp",
        "html",
        "css",
        "sql",
    }


    # ============================================================
    # RAG / RETRIEVAL
    # ============================================================

    CHUNK_SIZE = _env_int(
        "CHUNK_SIZE",
        900,
        minimum=200,
        maximum=4000
    )

    CHUNK_OVERLAP = _env_int(
        "CHUNK_OVERLAP",
        120,
        minimum=0,
        maximum=1000
    )

    TOP_K_CHUNKS = _env_int(
        "TOP_K_CHUNKS",
        3,
        minimum=1,
        maximum=10
    )

    RETRIEVAL_MIN_SCORE = _env_float(
        "RETRIEVAL_MIN_SCORE",
        0.16,
        minimum=0.0,
        maximum=1.0
    )
