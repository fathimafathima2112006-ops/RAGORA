import os
import secrets
import time
from functools import wraps
from urllib.parse import urlencode

import requests
from flask import (
    Flask,
    render_template,
    redirect,
    url_for,
    session,
    request,
    jsonify,
    Response,
)
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
from itsdangerous import (
    URLSafeTimedSerializer,
    BadSignature,
    BadTimeSignature,
)

from config import Config
import db
import rag_engine


# ============================================================
# APP CONFIGURATION
# ============================================================

app = Flask(__name__)

# Production / hosted environment detection
_production = os.getenv("PRODUCTION", "0").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

_hosted = bool(os.getenv("VERCEL")) or bool(os.getenv("RENDER"))


# Trust reverse proxy on Render / Vercel
if _production or _hosted:
    app.wsgi_app = ProxyFix(
        app.wsgi_app,
        x_for=1,
        x_proto=1,
        x_host=1,
    )


app.config.from_object(Config)

app.secret_key = Config.SECRET_KEY


# Production secret key validation
if (
    (_production or _hosted)
    and Config.SECRET_KEY == "change-me-in-production"
):
    raise RuntimeError("SECRET_KEY must be set in production.")


# Session configuration
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=(
        os.getenv("COOKIE_SECURE", "").strip().lower()
        in {"1", "true", "yes", "on"}
        if os.getenv("COOKIE_SECURE") is not None
        else (_production or _hosted)
    ),
    PERMANENT_SESSION_LIFETIME=3600,
)


# Make upload directory
os.makedirs(Config.UPLOAD_DIR, exist_ok=True)


# Initialize database
db.init_db()


# ============================================================
# GOOGLE OAUTH CONFIGURATION
# ============================================================

GOOGLE_AUTH_URL = (
    "https://accounts.google.com/o/oauth2/v2/auth"
)

GOOGLE_TOKEN_URL = (
    "https://oauth2.googleapis.com/token"
)

GOOGLE_USERINFO_URL = (
    "https://www.googleapis.com/oauth2/v3/userinfo"
)

_STATE_TTL_SECONDS = 600

_STATE_SALT = "ragora-google-oauth-state-v2"


def _state_serializer():
    """
    Creates a signed serializer for Google OAuth state.

    This keeps OAuth state serverless-safe because the state is
    cryptographically signed using SECRET_KEY.
    """

    return URLSafeTimedSerializer(
        Config.SECRET_KEY,
        salt=_STATE_SALT,
    )


def _cleanup_expired_states():
    """
    Reserved for OAuth state cleanup.

    State is currently signed and time-limited, so no server-side
    storage cleanup is required.
    """

    return


# ============================================================
# AUTHENTICATION DECORATOR
# ============================================================

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):

        if "user_id" not in session:

            # API request
            if request.path.startswith("/api/"):
                return jsonify({
                    "error": "not_authenticated"
                }), 401

            # Browser request
            return redirect(
                url_for("login_page")
            )

        return f(*args, **kwargs)

    return wrapper


# ============================================================
# FILE VALIDATION
# ============================================================

def allowed_file(filename):

    ext = (
        filename.rsplit(".", 1)[-1].lower()
        if "." in filename
        else ""
    )

    return ext in Config.ALLOWED_EXTENSIONS


# ============================================================
# GOOGLE LOGIN
# ============================================================

@app.route("/login")
def login_page():

    if "user_id" in session:
        return redirect(url_for("index"))

    return render_template("login.html")


@app.route("/auth/google")
def auth_google():

    # Check Google credentials
    if (
        not Config.GOOGLE_CLIENT_ID
        or not Config.GOOGLE_CLIENT_SECRET
    ):
        return render_template(
            "login.html",
            error=(
                "Google OAuth credentials are missing in .env."
            ),
        ), 500


    _cleanup_expired_states()


    # Generate nonce
    nonce = secrets.token_urlsafe(32)


    # Signed OAuth state
    state = _state_serializer().dumps({
        "nonce": nonce
    })


    params = {
        "client_id": Config.GOOGLE_CLIENT_ID,
        "redirect_uri": Config.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }


    return redirect(
        f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    )


# ============================================================
# GOOGLE CALLBACK
# ============================================================

@app.route("/auth/google/callback")
@app.route("/auth/callback")
def auth_callback():

    _cleanup_expired_states()


    # Google returned an error
    error = request.args.get("error")

    if error:
        return render_template(
            "login.html",
            error=(
                "Google sign-in was cancelled or failed: "
                f"{error}"
            ),
        ), 400


    state = request.args.get("state")

    code = request.args.get("code")


    # Missing state
    if not state:
        return render_template(
            "login.html",
            error=(
                "Google login expired. Please click "
                "Sign in with Google again."
            ),
        ), 400


    # Validate signed state
    try:

        _state_serializer().loads(
            state,
            max_age=_STATE_TTL_SECONDS,
        )

    except (
        BadSignature,
        BadTimeSignature,
    ):

        return render_template(
            "login.html",
            error=(
                "Google login expired. Please click "
                "Sign in with Google again."
            ),
        ), 400


    # Missing authorization code
    if not code:

        return render_template(
            "login.html",
            error=(
                "Google did not return an authorization code."
            ),
        ), 400


    try:

        # ----------------------------------------------------
        # Exchange Google authorization code for token
        # ----------------------------------------------------

        token_resp = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": Config.GOOGLE_CLIENT_ID,
                "client_secret": Config.GOOGLE_CLIENT_SECRET,
                "redirect_uri": Config.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )


        token_resp.raise_for_status()


        access_token = (
            token_resp.json().get("access_token")
        )


        if not access_token:
            raise RuntimeError(
                "Google did not return an access token."
            )


        # ----------------------------------------------------
        # Get Google user information
        # ----------------------------------------------------

        userinfo_resp = requests.get(
            GOOGLE_USERINFO_URL,
            headers={
                "Authorization":
                    f"Bearer {access_token}"
            },
            timeout=15,
        )


        userinfo_resp.raise_for_status()


        userinfo = userinfo_resp.json()


        google_id = userinfo.get("sub")

        email = userinfo.get("email", "")


        if not google_id or not email:

            raise RuntimeError(
                "Google profile did not contain the "
                "required identity fields."
            )


        name = (
            userinfo.get("name")
            or email.split("@")[0]
        )


        picture = userinfo.get(
            "picture",
            "",
        )


        # ----------------------------------------------------
        # Create / get user
        # ----------------------------------------------------

        user = db.get_or_create_user(
            google_id,
            email,
            name,
            picture,
        )


        # ----------------------------------------------------
        # Create session
        # ----------------------------------------------------

        session.clear()

        session.permanent = True

        session["user_id"] = user["id"]

        session["name"] = user["name"]

        session["picture"] = user["picture"]


        return redirect(
            url_for("index")
        )


    except requests.HTTPError:

        return render_template(
            "login.html",
            error=(
                "Google sign-in failed while exchanging "
                "the login code. Check your Client ID, "
                "Client Secret and Redirect URI."
            ),
        ), 400


    except Exception:

        return render_template(
            "login.html",
            error=(
                "Google sign-in failed. Check the OAuth "
                "settings and try again."
            ),
        ), 400


# ============================================================
# LOGOUT
# ============================================================

@app.route("/logout")
def logout():

    session.clear()

    return redirect(
        url_for("login_page")
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health")
def health():

    return jsonify({
        "ok": True,
        "service": "RAGORA",
        "groq_configured": bool(
            Config.GROQ_API_KEY
        ),
    })


# ============================================================
# MAIN PAGE
# ============================================================

@app.route("/")
@login_required
def index():

    return render_template(
        "chat.html",
        name=session.get("name"),
        picture=session.get("picture"),
    )


# ============================================================
# CONVERSATIONS
# ============================================================

@app.route(
    "/api/conversations",
    methods=["GET"],
)
@login_required
def api_list_conversations():

    return jsonify(
        db.list_conversations(
            session["user_id"]
        )
    )


@app.route(
    "/api/conversations",
    methods=["POST"],
)
@login_required
def api_create_conversation():

    conv_id = db.create_conversation(
        session["user_id"]
    )

    return jsonify({
        "id": conv_id,
        "title": "New Chat",
    })


@app.route(
    "/api/conversations/<int:conv_id>",
    methods=["DELETE"],
)
@login_required
def api_delete_conversation(conv_id):

    db.delete_conversation(
        conv_id,
        session["user_id"],
    )

    return jsonify({
        "ok": True
    })


@app.route(
    "/api/conversations/<int:conv_id>/messages",
    methods=["GET"],
)
@login_required
def api_get_messages(conv_id):

    if not db.get_conversation(
        conv_id,
        session["user_id"],
    ):
        return jsonify({
            "error": "not_found"
        }), 404


    return jsonify(
        db.list_messages(conv_id)
    )


@app.route(
    "/api/conversations/<int:conv_id>/export",
    methods=["GET"],
)
@login_required
def api_export_conversation(conv_id):

    conv = db.get_conversation(
        conv_id,
        session["user_id"],
    )


    if not conv:

        return jsonify({
            "error": "not_found"
        }), 404


    lines = [
        f"RAGORA Chat Export - {conv['title']}",
        "=" * 40,
        "",
    ]


    for message in db.list_messages(
        conv_id
    ):

        speaker = (
            "You"
            if message["role"] == "user"
            else "RAGORA"
        )


        lines.append(
            f"{speaker}: "
            f"{message['content']}\n"
        )


    return Response(
        "\n".join(lines),
        mimetype="text/plain",
        headers={
            "Content-Disposition":
                (
                    "attachment; "
                    f"filename=ragora_chat_{conv_id}.txt"
                )
        },
    )


# ============================================================
# DOCUMENTS
# ============================================================

@app.route(
    "/api/documents",
    methods=["GET"],
)
@login_required
def api_list_documents():

    conv_id = request.args.get(
        "conversation_id",
        type=int,
    )


    return jsonify(
        db.list_documents(
            session["user_id"],
            conv_id,
        )
    )


# ============================================================
# DOCUMENT UPLOAD
# ============================================================

@app.route(
    "/api/documents/upload",
    methods=["POST"],
)
@login_required
def api_upload_document():

    # Uploads go into the user's permanent knowledge base.
    # Conversation ID is optional and retained for compatibility.

    conv_id = request.form.get(
        "conversation_id",
        type=int,
    )


    if (
        conv_id
        and not db.get_conversation(
            conv_id,
            session["user_id"],
        )
    ):
        return jsonify({
            "error": "invalid conversation_id"
        }), 400


    # Get uploaded file
    file = request.files.get("file")


    if not file or not file.filename:

        return jsonify({
            "error": "no file selected"
        }), 400


    # Validate extension
    if not allowed_file(file.filename):

        return jsonify({
            "error": "unsupported file type"
        }), 400


    # Secure filename
    filename = secure_filename(
        file.filename
    )


    if not filename:

        return jsonify({
            "error": "invalid filename"
        }), 400


    # User-specific upload folder
    user_dir = os.path.join(
        Config.UPLOAD_DIR,
        str(session["user_id"]),
    )


    os.makedirs(
        user_dir,
        exist_ok=True,
    )


    filepath = os.path.join(
        user_dir,
        filename,
    )


    # Save file
    file.save(filepath)


    # Extract extension
    ext = filename.rsplit(
        ".",
        1,
    )[-1].lower()


    # Extract document text
    text = rag_engine.extract_text(
        filepath,
        ext,
    )


    # Extraction error
    if text.startswith(
        "[Document extraction error:"
    ):

        try:
            os.remove(filepath)
        except OSError:
            pass


        return jsonify({
            "error": text
        }), 400


    # Create chunks
    chunks = rag_engine.chunk_text(
        text
    )


    if not chunks:

        return jsonify({
            "error":
                "The document contains no readable text."
        }), 400


    # Store document
    doc_id = db.add_document(
        session["user_id"],
        None,
        filename,
        filepath,
    )


    # Store chunks
    db.add_chunks(
        doc_id,
        chunks,
    )


    return jsonify({
        "id": doc_id,
        "filename": filename,
        "chunks": len(chunks),
        "message":
            f"{filename} uploaded successfully",
    })


# ============================================================
# DELETE DOCUMENT
# ============================================================

@app.route(
    "/api/documents/<int:doc_id>",
    methods=["DELETE"],
)
@login_required
def api_delete_document(doc_id):

    db.delete_document(
        doc_id,
        session["user_id"],
    )


    return jsonify({
        "ok": True
    })


# ============================================================
# EVALUATION MODULE
# ============================================================

import evaluation


# ============================================================
# KNOWLEDGE / ANALYTICS
# ============================================================

@app.route(
    "/api/stats",
    methods=["GET"],
)
@login_required
def api_stats():

    return jsonify(
        db.global_stats(
            session["user_id"]
        )
    )


# ============================================================
# DOCUMENT CHUNKS
# ============================================================

@app.route(
    "/api/documents/<int:doc_id>/chunks",
    methods=["GET"],
)
@login_required
def api_document_chunks(doc_id):

    # First verify that the document belongs
    # to the logged-in user.

    docs = [
        d
        for d in db.list_documents(
            session["user_id"]
        )
        if d["id"] == doc_id
    ]


    if not docs:

        return jsonify({
            "error": "not_found"
        }), 404


    # IMPORTANT:
    # This function must exist in db.py.
    rows = db.get_document_chunks(
        doc_id,
        session["user_id"],
    )


    # Add page number + estimated token count
    for row in rows:

        import re

        match = re.search(
            r"\[Page (\d+)\]",
            row["chunk_text"],
        )


        row["page"] = (
            int(match.group(1))
            if match
            else None
        )


        # Approximate token count
        row["tokens"] = max(
            1,
            round(
                len(row["chunk_text"]) / 4
            ),
        )


    return jsonify(rows)


# ============================================================
# RETRIEVAL TEST API
# ============================================================

@app.route(
    "/api/retrieval",
    methods=["POST"],
)
@login_required
def api_retrieval():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    question = (
        data.get("question")
        or ""
    ).strip()


    if not question:

        return jsonify({
            "error": "question required"
        }), 400


    top_k = max(
        1,
        min(
            int(
                data.get("top_k")
                or Config.TOP_K_CHUNKS
            ),
            8,
        ),
    )


    # Get all user chunks
    rows = db.get_chunks_for_user(
        session["user_id"]
    )


    # Retrieve relevant chunks
    selected = (
        rag_engine.retrieve_relevant_chunks(
            question,
            rows,
            top_k=top_k,
            return_scores=True,
        )
    )


    results = []

    context = []


    for row, score in selected:

        import re


        match = re.search(
            r"\[Page (\d+)\]",
            row["chunk_text"],
        )


        snippet = re.sub(
            r"\[Page \d+\]",
            "",
            row["chunk_text"],
        ).strip()


        results.append({
            "filename":
                row["filename"],

            "chunk_index":
                row.get("chunk_index"),

            "page":
                (
                    int(match.group(1))
                    if match
                    else None
                ),

            "score":
                round(
                    max(
                        0,
                        min(1, score)
                    ) * 100
                ),

            "snippet":
                snippet[:360],
        })


        context.append(
            f"[{len(context) + 1}] "
            f"({row['filename']})\n"
            f"{row['chunk_text'][:900]}"
        )


    return jsonify({
        "question": question,
        "results": results,
        "context":
            "\n\n---\n\n".join(context),
    })


# ============================================================
# EVALUATION
# ============================================================

@app.route(
    "/api/evaluation",
    methods=["GET"],
)
@login_required
def api_evaluation():

    # Read-only endpoint.
    # It never invents evaluation scores.

    return jsonify({
        "available": False,
        "summary": None,
        "results": [],
    })


@app.route(
    "/api/evaluation/run",
    methods=["POST"],
)
@login_required
def api_evaluation_run():

    dataset_path = os.path.join(
        os.path.dirname(__file__),
        "eval_dataset.json",
    )


    if not os.path.exists(
        dataset_path
    ):

        return jsonify({
            "error":
                "eval_dataset.json not found"
        }), 404


    try:

        dataset = evaluation.load_dataset(
            dataset_path
        )


        results = evaluation.evaluate_retrieval(
            session["user_id"],
            dataset,
        )


        # Only scored results
        scored = [
            result
            for result in results
            if result["hit"] is not None
        ]


        # Hit rate
        hit = (
            round(
                sum(
                    1
                    for result in scored
                    if result["hit"]
                )
                / len(scored)
                * 100,
                1,
            )
            if scored
            else None
        )


        # Precision
        precisions = [
            result["precision"]
            for result in scored
            if result["precision"] is not None
        ]


        precision = (
            round(
                sum(precisions)
                / len(precisions)
                * 100,
                1,
            )
            if precisions
            else None
        )


        # MRR
        mrr = (
            round(
                sum(
                    result["reciprocal_rank"]
                    for result in scored
                )
                / len(scored),
                3,
            )
            if scored
            else None
        )


        # Average match
        avg = (
            round(
                sum(
                    result["match_percent"]
                    for result in results
                )
                / len(results),
                1,
            )
            if results
            else 0
        )


        return jsonify({
            "summary": {
                "hit_rate": hit,
                "precision": precision,
                "mrr": mrr,
                "avg_match": avg,
            },
            "results": results,
        })


    except SystemExit:

        return jsonify({
            "error":
                (
                    "Upload at least one document and "
                    "configure eval_dataset.json with "
                    "real ground truth."
                )
        }), 400


    except Exception as exc:

        return jsonify({
            "error": str(exc)
        }), 400


# ============================================================
# CHAT ANSWER ENGINE
# ============================================================

def _answer_for_conversation(
    conv_id,
    user_id,
    user_message,
):

    # Conversation history
    history = db.list_messages(
        conv_id
    )


    # User knowledge chunks
    rows = db.get_chunks_for_user(
        user_id
    )


    # Retrieve relevant chunks
    selected = (
        rag_engine.retrieve_relevant_chunks(
            user_message,
            rows,
            return_scores=True,
        )
    )


    # --------------------------------------------------------
    # Document-intent fallback
    # --------------------------------------------------------

    if not selected and rows:

        q = user_message.lower()


        document_intent = any(
            term in q
            for term in (
                "document",
                "uploaded",
                "upload",
                "file",
                "pdf",
                "notes",
                "இந்த document",
                "டாக்குமெண்ட்",
                "file-la",
                "document-la",
                "summarize this",
                "summary of this",
                "explain this file",
            )
        )


        if document_intent:

            selected = [
                (row, 0.0)
                for row in rows[
                    :Config.TOP_K_CHUNKS
                ]
            ]


    # --------------------------------------------------------
    # Prepare RAG context
    # --------------------------------------------------------

    doc_context = None

    match_percent = 0

    citations = []


    if selected:

        pieces = []

        used_chars = 0


        # Number context pieces [1], [2], etc.
        for i, (chunk, score) in enumerate(
            selected,
            start=1,
        ):

            if used_chars >= 3200:
                break


            remaining = (
                3200 - used_chars
            )


            text = chunk[
                "chunk_text"
            ][
                :min(
                    850,
                    remaining,
                )
            ]


            pieces.append(
                f"[{i}] "
                f"({chunk['filename']})\n"
                f"{text}"
            )


            used_chars += len(text)


        doc_context = (
            "\n\n---\n\n".join(pieces)
        )


        # Retrieval score indicator
        best_score = selected[0][1]


        match_percent = max(
            0,
            min(
                99,
                round(
                    best_score * 150
                ),
            ),
        )


        # Build document citations
        citations = (
            rag_engine.build_citations(
                selected
            )
        )


        for citation, (
            row,
            _score,
        ) in zip(
            citations,
            selected,
        ):

            citation["chunk_index"] = (
                row.get("chunk_index")
            )


    # --------------------------------------------------------
    # Generate AI answer
    # --------------------------------------------------------

    started = time.perf_counter()


    result = rag_engine.generate_answer(
        history,
        user_message[:2000],
        doc_context,
    )


    result["elapsed_ms"] = round(
        (
            time.perf_counter()
            - started
        ) * 1000
    )


    result["match_percent"] = (
        match_percent
    )


    stats = db.user_document_stats(
        user_id
    )


    result["knowledge_docs"] = (
        stats["documents"]
    )


    result["knowledge_chunks"] = (
        stats["chunks"]
    )


    # Document citations are shown only
    # when answer did not use web search.

    result["citations"] = (
        citations
        if (
            citations
            and not result.get("used_web")
        )
        else []
    )


    return result


# ============================================================
# MAIN CHAT API
# ============================================================

@app.route(
    "/api/chat",
    methods=["POST"],
)
@login_required
def api_chat():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    conv_id = data.get(
        "conversation_id"
    )


    message = (
        data.get("message")
        or ""
    ).strip()


    if not conv_id or not message:

        return jsonify({
            "error":
                "conversation_id and message required"
        }), 400


    # Verify conversation ownership
    conv = db.get_conversation(
        conv_id,
        session["user_id"],
    )


    if not conv:

        return jsonify({
            "error": "not_found"
        }), 404


    # Generate answer
    result = _answer_for_conversation(
        conv_id,
        session["user_id"],
        message,
    )


    # Save user message
    db.add_message(
        conv_id,
        "user",
        message,
    )


    # Save assistant message
    db.add_message(
        conv_id,
        "assistant",
        result["answer"],
        used_web=int(
            result["used_web"]
        ),
    )


    # Automatically generate conversation title
    if conv["title"] == "New Chat":

        db.rename_conversation(
            conv_id,
            rag_engine.generate_title(
                message
            ),
        )


    return jsonify({
        "answer":
            result["answer"],

        "used_web":
            bool(result["used_web"]),

        "sources":
            result.get(
                "sources",
                [],
            ),

        "citations":
            result.get(
                "citations",
                [],
            ),

        "used_docs":
            bool(
                db.get_chunks_for_user(
                    session["user_id"]
                )
            ),

        "match_percent":
            result.get(
                "match_percent",
                0,
            ),

        "elapsed_ms":
            result.get(
                "elapsed_ms",
                0,
            ),

        "knowledge_docs":
            result.get(
                "knowledge_docs",
                0,
            ),

        "knowledge_chunks":
            result.get(
                "knowledge_chunks",
                0,
            ),
    })


# ============================================================
# REGENERATE CHAT ANSWER
# ============================================================

@app.route(
    "/api/chat/regenerate",
    methods=["POST"],
)
@login_required
def api_regenerate():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    conv_id = data.get(
        "conversation_id"
    )


    conv = db.get_conversation(
        conv_id,
        session["user_id"],
    )


    if not conv:

        return jsonify({
            "error": "not_found"
        }), 404


    history = db.list_messages(
        conv_id
    )


    if (
        not history
        or history[-1]["role"]
        != "assistant"
    ):

        return jsonify({
            "error":
                "nothing to regenerate"
        }), 400


    # Find latest user question
    last_user = next(
        (
            message["content"]
            for message in reversed(
                history[:-1]
            )
            if message["role"] == "user"
        ),
        None,
    )


    if not last_user:

        return jsonify({
            "error":
                "no user message found"
        }), 400


    # Delete previous assistant answer
    db.delete_last_assistant_message(
        conv_id
    )


    # Generate new answer
    result = _answer_for_conversation(
        conv_id,
        session["user_id"],
        last_user,
    )


    # Save regenerated answer
    db.add_message(
        conv_id,
        "assistant",
        result["answer"],
        used_web=int(
            result["used_web"]
        ),
    )


    return jsonify({
        "answer":
            result["answer"],

        "used_web":
            bool(result["used_web"]),

        "sources":
            result.get(
                "sources",
                [],
            ),

        "citations":
            result.get(
                "citations",
                [],
            ),

        "match_percent":
            result.get(
                "match_percent",
                0,
            ),

        "elapsed_ms":
            result.get(
                "elapsed_ms",
                0,
            ),

        "knowledge_docs":
            result.get(
                "knowledge_docs",
                0,
            ),

        "knowledge_chunks":
            result.get(
                "knowledge_chunks",
                0,
            ),
    })


# ============================================================
# AI COMPANION
# ============================================================

@app.route(
    "/api/companion/messages",
    methods=["GET"],
)
@login_required
def api_companion_messages():

    return jsonify(
        db.list_companion_messages(
            session["user_id"]
        )
    )


@app.route(
    "/api/companion/stats",
    methods=["GET"],
)
@login_required
def api_companion_stats():

    return jsonify(
        db.user_document_stats(
            session["user_id"]
        )
    )


@app.route(
    "/api/companion/chat",
    methods=["POST"],
)
@login_required
def api_companion_chat():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    message = (
        data.get("message")
        or ""
    ).strip()


    if not message:

        return jsonify({
            "error":
                "message required"
        }), 400


    # Companion history
    history = (
        db.list_companion_messages(
            session["user_id"]
        )
    )


    # Knowledge statistics
    stats = db.user_document_stats(
        session["user_id"]
    )


    # Generate companion answer
    result = (
        rag_engine.generate_companion_answer(
            history,
            message,
            stats,
        )
    )


    # Save conversation
    db.add_companion_message(
        session["user_id"],
        "user",
        message,
    )


    db.add_companion_message(
        session["user_id"],
        "assistant",
        result["answer"],
    )


    return jsonify({
        "answer":
            result["answer"],

        "stats":
            stats,
    })


# ============================================================
# CLEAR COMPANION CHAT
# ============================================================

@app.route(
    "/api/companion/messages",
    methods=["DELETE"],
)
@login_required
def api_companion_clear():

    db.clear_companion_messages(
        session["user_id"]
    )


    return jsonify({
        "ok": True
    })


# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(500)
def internal_error(_):

    return jsonify({
        "error":
            (
                "Server-la unexpected problem "
                "vandhudhu. RAGORA restart pannitu "
                "retry pannunga."
            )
    }), 500


@app.errorhandler(413)
def too_large(_):

    return jsonify({
        "error":
            "File is too large. Maximum size is 25 MB."
    }), 413


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    app.run(
        debug=(
            os.getenv(
                "FLASK_DEBUG",
                "0",
            ) == "1"
        ),

        use_reloader=False,

        host="0.0.0.0",

        port=int(
            (
                os.getenv("PORT")
                or "5000"
            ).strip()
            or "5000"
        ),
    )