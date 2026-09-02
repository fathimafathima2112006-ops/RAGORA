import os
import secrets
import time
from functools import wraps
from urllib.parse import urlencode

import requests
from flask import (
    Flask, render_template, redirect, url_for, session,
    request, jsonify, Response
)
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix

from config import Config
import db
import rag_engine

app = Flask(__name__)
# Trust the reverse proxy used by production hosts so HTTPS redirects/callbacks work.
if os.getenv("PRODUCTION", "0") == "1":
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY
if os.getenv("PRODUCTION", "0") == "1" and Config.SECRET_KEY == "change-me-in-production":
    raise RuntimeError("SECRET_KEY must be set in production.")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "0") == "1",
    PERMANENT_SESSION_LIFETIME=3600,
)
os.makedirs(Config.UPLOAD_DIR, exist_ok=True)
db.init_db()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
_STATE_TTL_SECONDS = 600
_pending_states = {}


def _cleanup_expired_states():
    now = time.time()
    for state, created in list(_pending_states.items()):
        if now - created > _STATE_TTL_SECONDS:
            _pending_states.pop(state, None)


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "not_authenticated"}), 401
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return wrapper


def allowed_file(filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in Config.ALLOWED_EXTENSIONS


# ---------------- Google OAuth ----------------
@app.route("/login")
def login_page():
    if "user_id" in session:
        return redirect(url_for("index"))
    return render_template("login.html")


@app.route("/auth/google")
def auth_google():
    if not Config.GOOGLE_CLIENT_ID or not Config.GOOGLE_CLIENT_SECRET:
        return render_template(
            "login.html",
            error="Google OAuth credentials are missing in .env.",
        ), 500

    _cleanup_expired_states()
    state = secrets.token_urlsafe(32)
    _pending_states[state] = time.time()

    params = {
        "client_id": Config.GOOGLE_CLIENT_ID,
        "redirect_uri": Config.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@app.route("/auth/google/callback")
@app.route("/auth/callback")
def auth_callback():
    _cleanup_expired_states()

    error = request.args.get("error")
    if error:
        return render_template(
            "login.html",
            error=f"Google sign-in was cancelled or failed: {error}",
        ), 400

    state = request.args.get("state")
    code = request.args.get("code")
    if not state or state not in _pending_states:
        return render_template(
            "login.html",
            error="Google login expired. Please click Sign in with Google again.",
        ), 400
    _pending_states.pop(state, None)

    if not code:
        return render_template(
            "login.html",
            error="Google did not return an authorization code.",
        ), 400

    try:
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
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise RuntimeError("Google did not return an access token.")

        userinfo_resp = requests.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()

        google_id = userinfo.get("sub")
        email = userinfo.get("email", "")
        if not google_id or not email:
            raise RuntimeError("Google profile did not contain the required identity fields.")

        name = userinfo.get("name") or email.split("@")[0]
        picture = userinfo.get("picture", "")

        user = db.get_or_create_user(google_id, email, name, picture)

        session.clear()
        session.permanent = True
        session["user_id"] = user["id"]
        session["name"] = user["name"]
        session["picture"] = user["picture"]
        return redirect(url_for("index"))

    except requests.HTTPError:
        return render_template(
            "login.html",
            error="Google sign-in failed while exchanging the login code. Check your Client ID, Client Secret and Redirect URI.",
        ), 400
    except Exception:
        return render_template(
            "login.html",
            error="Google sign-in failed. Check the OAuth settings and try again.",
        ), 400


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))


# ---------------- Main ----------------
@app.route("/health")
def health():
    return jsonify({"ok": True, "service": "RAGORA", "groq_configured": bool(Config.GROQ_API_KEY)})


@app.route("/")
@login_required
def index():
    return render_template(
        "chat.html",
        name=session.get("name"),
        picture=session.get("picture"),
    )


# ---------------- Conversations ----------------
@app.route("/api/conversations", methods=["GET"])
@login_required
def api_list_conversations():
    return jsonify(db.list_conversations(session["user_id"]))


@app.route("/api/conversations", methods=["POST"])
@login_required
def api_create_conversation():
    conv_id = db.create_conversation(session["user_id"])
    return jsonify({"id": conv_id, "title": "New Chat"})


@app.route("/api/conversations/<int:conv_id>", methods=["DELETE"])
@login_required
def api_delete_conversation(conv_id):
    db.delete_conversation(conv_id, session["user_id"])
    return jsonify({"ok": True})


@app.route("/api/conversations/<int:conv_id>/messages", methods=["GET"])
@login_required
def api_get_messages(conv_id):
    if not db.get_conversation(conv_id, session["user_id"]):
        return jsonify({"error": "not_found"}), 404
    return jsonify(db.list_messages(conv_id))


@app.route("/api/conversations/<int:conv_id>/export", methods=["GET"])
@login_required
def api_export_conversation(conv_id):
    conv = db.get_conversation(conv_id, session["user_id"])
    if not conv:
        return jsonify({"error": "not_found"}), 404
    lines = [f"RAGORA Chat Export - {conv['title']}", "=" * 40, ""]
    for m in db.list_messages(conv_id):
        speaker = "You" if m["role"] == "user" else "RAGORA"
        lines.append(f"{speaker}: {m['content']}\n")
    return Response(
        "\n".join(lines),
        mimetype="text/plain",
        headers={"Content-Disposition": f"attachment; filename=ragora_chat_{conv_id}.txt"},
    )


# ---------------- Documents ----------------
@app.route("/api/documents", methods=["GET"])
@login_required
def api_list_documents():
    conv_id = request.args.get("conversation_id", type=int)
    return jsonify(db.list_documents(session["user_id"], conv_id))


@app.route("/api/documents/upload", methods=["POST"])
@login_required
def api_upload_document():
    # Uploads go into the user's permanent Knowledge base. A conversation id
    # is accepted for backward compatibility, but is not required.
    conv_id = request.form.get("conversation_id", type=int)
    if conv_id and not db.get_conversation(conv_id, session["user_id"]):
        return jsonify({"error": "invalid conversation_id"}), 400

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "no file selected"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "unsupported file type"}), 400

    filename = secure_filename(file.filename)
    if not filename:
        return jsonify({"error": "invalid filename"}), 400

    user_dir = os.path.join(Config.UPLOAD_DIR, str(session["user_id"]))
    os.makedirs(user_dir, exist_ok=True)
    filepath = os.path.join(user_dir, filename)
    file.save(filepath)

    ext = filename.rsplit(".", 1)[-1].lower()
    text = rag_engine.extract_text(filepath, ext)
    if text.startswith("[Document extraction error:"):
        try:
            os.remove(filepath)
        except OSError:
            pass
        return jsonify({"error": text}), 400

    chunks = rag_engine.chunk_text(text)
    if not chunks:
        return jsonify({"error": "The document contains no readable text."}), 400

    doc_id = db.add_document(session["user_id"], None, filename, filepath)
    db.add_chunks(doc_id, chunks)
    return jsonify({
        "id": doc_id,
        "filename": filename,
        "chunks": len(chunks),
        "message": f"{filename} uploaded successfully",
    })


@app.route("/api/documents/<int:doc_id>", methods=["DELETE"])
@login_required
def api_delete_document(doc_id):
    db.delete_document(doc_id, session["user_id"])
    return jsonify({"ok": True})


import evaluation

# ---------------- Knowledge / analytics APIs ----------------
@app.route("/api/stats", methods=["GET"])
@login_required
def api_stats():
    return jsonify(db.global_stats(session["user_id"]))

@app.route("/api/documents/<int:doc_id>/chunks", methods=["GET"])
@login_required
def api_document_chunks(doc_id):
    docs = [d for d in db.list_documents(session["user_id"]) if d["id"] == doc_id]
    if not docs:
        return jsonify({"error": "not_found"}), 404
    rows = db.get_document_chunks(doc_id, session["user_id"])
    for r in rows:
        import re
        m = re.search(r"\[Page (\d+)\]", r["chunk_text"])
        r["page"] = int(m.group(1)) if m else None
        r["tokens"] = max(1, round(len(r["chunk_text"]) / 4))
    return jsonify(rows)

@app.route("/api/retrieval", methods=["POST"])
@login_required
def api_retrieval():
    data=request.get_json(silent=True) or {}
    question=(data.get("question") or "").strip()
    if not question: return jsonify({"error":"question required"}),400
    top_k=max(1,min(int(data.get("top_k") or Config.TOP_K_CHUNKS),8))
    rows=db.get_chunks_for_user(session["user_id"])
    selected=rag_engine.retrieve_relevant_chunks(question,rows,top_k=top_k,return_scores=True)
    results=[]; context=[]
    for row,score in selected:
        import re
        m=re.search(r"\[Page (\d+)\]",row["chunk_text"])
        snippet=re.sub(r"\[Page \d+\]","",row["chunk_text"]).strip()
        results.append({"filename":row["filename"],"chunk_index":row.get("chunk_index"),"page":int(m.group(1)) if m else None,"score":round(max(0,min(1,score))*100),"snippet":snippet[:360]})
        context.append(f"[{len(context)+1}] ({row['filename']})\n{row['chunk_text'][:900]}")
    return jsonify({"question":question,"results":results,"context":"\n\n---\n\n".join(context)})

@app.route("/api/evaluation", methods=["GET"])
@login_required
def api_evaluation():
    # Read-only status endpoint. It never invents scores.
    return jsonify({"available":False,"summary":None,"results":[]})

@app.route("/api/evaluation/run", methods=["POST"])
@login_required
def api_evaluation_run():
    dataset_path=os.path.join(os.path.dirname(__file__),"eval_dataset.json")
    if not os.path.exists(dataset_path): return jsonify({"error":"eval_dataset.json not found"}),404
    try:
        dataset=evaluation.load_dataset(dataset_path)
        results=evaluation.evaluate_retrieval(session["user_id"],dataset)
        scored=[r for r in results if r["hit"] is not None]
        hit=round(sum(1 for r in scored if r["hit"])/len(scored)*100,1) if scored else None
        precisions=[r["precision"] for r in scored if r["precision"] is not None]
        precision=round(sum(precisions)/len(precisions)*100,1) if precisions else None
        mrr=round(sum(r["reciprocal_rank"] for r in scored)/len(scored),3) if scored else None
        avg=round(sum(r["match_percent"] for r in results)/len(results),1) if results else 0
        return jsonify({"summary":{"hit_rate":hit,"precision":precision,"mrr":mrr,"avg_match":avg},"results":results})
    except SystemExit:
        return jsonify({"error":"Upload at least one document and configure eval_dataset.json with real ground truth."}),400
    except Exception as exc:
        return jsonify({"error":str(exc)}),400

# ---------------- Chat ----------------
def _answer_for_conversation(conv_id, user_id, user_message):
    history = db.list_messages(conv_id)
    rows = db.get_chunks_for_user(user_id)
    selected = rag_engine.retrieve_relevant_chunks(user_message, rows, return_scores=True)
    # Queries such as "summarize the uploaded document" do not contain the
    # document's vocabulary, so lexical retrieval can be empty. In that case
    # use a few chunks only for explicit document-intent queries; ordinary
    # unrelated questions still go to the web path.
    if not selected and rows:
        q = user_message.lower()
        document_intent = any(term in q for term in (
            "document", "uploaded", "upload", "file", "pdf", "notes",
            "இந்த document", "டாக்குமெண்ட்", "file-la", "document-la",
            "summarize this", "summary of this", "explain this file"
        ))
        if document_intent:
            selected = [(row, 0.0) for row in rows[:Config.TOP_K_CHUNKS]]
    # Keep the prompt deliberately small. This is the main fix for Groq's
    # 8K tokens/minute / request-size failures when history + RAG context grow.
    doc_context = None
    match_percent = 0
    citations = []
    if selected:
        pieces = []
        used_chars = 0
        # Number each piece [1], [2]... in the same order build_citations()
        # uses, so the model's inline citation markers line up with the
        # source chips the UI renders.
        for i, (c, score) in enumerate(selected, start=1):
            if used_chars >= 3200:
                break
            remaining = 3200 - used_chars
            text = c["chunk_text"][:min(850, remaining)]
            pieces.append(f"[{i}] ({c['filename']})\n{text}")
            used_chars += len(text)
        doc_context = "\n\n---\n\n".join(pieces)
        # This is retrieval match, not a claim that the answer is objectively
        # correct. It gives the UI a useful, honest percentage indicator.
        best_score = selected[0][1]
        match_percent = max(0, min(99, round(best_score * 150)))
        citations = rag_engine.build_citations(selected)
        for citation, (row, _score) in zip(citations, selected):
            citation["chunk_index"] = row.get("chunk_index")

    started = time.perf_counter()
    result = rag_engine.generate_answer(history, user_message[:2000], doc_context)
    result["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
    result["match_percent"] = match_percent
    result["knowledge_docs"] = db.user_document_stats(user_id)["documents"]
    result["knowledge_chunks"] = db.user_document_stats(user_id)["chunks"]
    # Only attach document citations when the answer actually used the
    # document path (not the web-search fallback), so citation chips never
    # get shown next to a web-sourced answer.
    result["citations"] = citations if (citations and not result.get("used_web")) else []
    return result


@app.route("/api/chat", methods=["POST"])
@login_required
def api_chat():
    data = request.get_json(silent=True) or {}
    conv_id = data.get("conversation_id")
    message = (data.get("message") or "").strip()

    if not conv_id or not message:
        return jsonify({"error": "conversation_id and message required"}), 400

    conv = db.get_conversation(conv_id, session["user_id"])
    if not conv:
        return jsonify({"error": "not_found"}), 404

    result = _answer_for_conversation(conv_id, session["user_id"], message)
    db.add_message(conv_id, "user", message)
    db.add_message(conv_id, "assistant", result["answer"], used_web=int(result["used_web"]))

    if conv["title"] == "New Chat":
        db.rename_conversation(conv_id, rag_engine.generate_title(message))

    return jsonify({
        "answer": result["answer"],
        "used_web": bool(result["used_web"]),
        "sources": result.get("sources", []),
        "citations": result.get("citations", []),
        "used_docs": bool(db.get_chunks_for_user(session["user_id"])),
        "match_percent": result.get("match_percent", 0),
        "elapsed_ms": result.get("elapsed_ms", 0),
        "knowledge_docs": result.get("knowledge_docs", 0),
        "knowledge_chunks": result.get("knowledge_chunks", 0),
    })


@app.route("/api/chat/regenerate", methods=["POST"])
@login_required
def api_regenerate():
    data = request.get_json(silent=True) or {}
    conv_id = data.get("conversation_id")
    conv = db.get_conversation(conv_id, session["user_id"])
    if not conv:
        return jsonify({"error": "not_found"}), 404

    history = db.list_messages(conv_id)
    if not history or history[-1]["role"] != "assistant":
        return jsonify({"error": "nothing to regenerate"}), 400

    last_user = next(
        (m["content"] for m in reversed(history[:-1]) if m["role"] == "user"),
        None,
    )
    if not last_user:
        return jsonify({"error": "no user message found"}), 400

    db.delete_last_assistant_message(conv_id)
    result = _answer_for_conversation(conv_id, session["user_id"], last_user)
    db.add_message(conv_id, "assistant", result["answer"], used_web=int(result["used_web"]))
    return jsonify({
        "answer": result["answer"],
        "used_web": bool(result["used_web"]),
        "sources": result.get("sources", []),
        "citations": result.get("citations", []),
        "match_percent": result.get("match_percent", 0),
        "elapsed_ms": result.get("elapsed_ms", 0),
        "knowledge_docs": result.get("knowledge_docs", 0),
        "knowledge_chunks": result.get("knowledge_chunks", 0),
    })


# ---------------- AI Chat (friendly companion side-panel) ----------------
@app.route("/api/companion/messages", methods=["GET"])
@login_required
def api_companion_messages():
    return jsonify(db.list_companion_messages(session["user_id"]))


@app.route("/api/companion/stats", methods=["GET"])
@login_required
def api_companion_stats():
    return jsonify(db.user_document_stats(session["user_id"]))


@app.route("/api/companion/chat", methods=["POST"])
@login_required
def api_companion_chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message required"}), 400

    history = db.list_companion_messages(session["user_id"])
    stats = db.user_document_stats(session["user_id"])
    result = rag_engine.generate_companion_answer(history, message, stats)

    db.add_companion_message(session["user_id"], "user", message)
    db.add_companion_message(session["user_id"], "assistant", result["answer"])

    return jsonify({"answer": result["answer"], "stats": stats})


@app.route("/api/companion/messages", methods=["DELETE"])
@login_required
def api_companion_clear():
    db.clear_companion_messages(session["user_id"])
    return jsonify({"ok": True})


@app.errorhandler(500)
def internal_error(_):
    return jsonify({"error": "Server-la unexpected problem vandhudhu. RAGORA restart pannitu retry pannunga."}), 500


@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "File is too large. Maximum size is 25 MB."}), 413


if __name__ == "__main__":
    app.run(
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
        use_reloader=False,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
    )
