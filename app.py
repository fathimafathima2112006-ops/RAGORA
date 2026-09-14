import os
import re
import json
import hashlib
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv

from auth import create_user, authenticate_user
from database import (
    add_document,
    list_documents,
    delete_document,
    save_chat,
    list_chats,
    clear_chats,
    user_stats,
)

try:
    from PyPDF2 import PdfReader
except ImportError:
    PdfReader = None

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

try:
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    cosine_similarity = None

try:
    from groq import Groq
except ImportError:
    Groq = None


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DOC_ROOT = DATA_DIR / "documents"
DOC_ROOT.mkdir(parents=True, exist_ok=True)

st.set_page_config(
    page_title="RAG PRO • AI Workspace",
    page_icon="✦",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ============================================================
# SESSION
# ============================================================

defaults = {
    "logged_in": False,
    "user_id": None,
    "username": "",
    "page": "Home",
    "messages": [],
}

for key, value in defaults.items():
    if key not in st.session_state:
        st.session_state[key] = value


# ============================================================
# 3D / GLASSMORPHIC UI
# ============================================================

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

:root {
    --bg: #050612;
    --panel: rgba(15, 18, 38, .72);
    --line: rgba(255,255,255,.10);
    --text: #f7f8ff;
    --muted: #9ca6c5;
    --purple: #8b5cf6;
    --cyan: #22d3ee;
}

html, body, [class*="css"] {
    font-family: Inter, sans-serif;
}

.stApp {
    min-height: 100vh;
    background:
        radial-gradient(circle at 10% 10%, rgba(124,58,237,.20), transparent 28%),
        radial-gradient(circle at 90% 15%, rgba(34,211,238,.14), transparent 25%),
        radial-gradient(circle at 50% 100%, rgba(236,72,153,.10), transparent 30%),
        #050612;
    color: var(--text);
}

.stApp:before,
.stApp:after {
    content: "";
    position: fixed;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    filter: blur(55px);
    opacity: .20;
    pointer-events: none;
    z-index: 0;
    animation: floatOrb 9s ease-in-out infinite;
}

.stApp:before {
    background: #7c3aed;
    left: -100px;
    top: 30%;
}

.stApp:after {
    background: #06b6d4;
    right: -100px;
    top: 65%;
    animation-delay: -4s;
}

@keyframes floatOrb {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    50% { transform: translate3d(30px,-35px,0) scale(1.12); }
}

.block-container {
    max-width: 1320px;
    padding-top: 2rem !important;
    padding-bottom: 4rem !important;
    position: relative;
    z-index: 2;
}

section[data-testid="stSidebar"] {
    background: rgba(7, 9, 22, .92) !important;
    border-right: 1px solid var(--line);
    backdrop-filter: blur(24px);
}

section[data-testid="stSidebar"] * {
    color: var(--text) !important;
}

div[data-baseweb="input"],
div[data-baseweb="textarea"] {
    background: rgba(13,17,36,.90) !important;
    border: 1px solid rgba(139,92,246,.25) !important;
    border-radius: 14px !important;
}

div[data-baseweb="input"]:focus-within,
div[data-baseweb="textarea"]:focus-within {
    border-color: rgba(139,92,246,.85) !important;
    box-shadow: 0 0 22px rgba(139,92,246,.16) !important;
}

input, textarea {
    color: white !important;
    -webkit-text-fill-color: white !important;
}

button {
    transition: all .22s ease !important;
}

.stButton > button {
    border: 1px solid rgba(139,92,246,.35) !important;
    border-radius: 12px !important;
    background: linear-gradient(135deg, rgba(124,58,237,.85), rgba(6,182,212,.65)) !important;
    color: white !important;
    font-weight: 700 !important;
    box-shadow: 0 8px 30px rgba(124,58,237,.16);
}

.stButton > button:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 14px 38px rgba(124,58,237,.28);
}

.hero {
    position: relative;
    overflow: hidden;
    padding: 44px;
    border-radius: 30px;
    border: 1px solid var(--line);
    background:
        linear-gradient(135deg, rgba(20,24,53,.88), rgba(8,10,24,.76));
    box-shadow:
        0 30px 80px rgba(0,0,0,.35),
        inset 0 1px 0 rgba(255,255,255,.08);
    transform: perspective(1000px) rotateX(.6deg);
    animation: heroIn .8s ease both;
}

.hero:before {
    content: "";
    position: absolute;
    width: 240px;
    height: 240px;
    right: -70px;
    top: -90px;
    border-radius: 50%;
    background: linear-gradient(135deg,#8b5cf6,#22d3ee);
    filter: blur(12px);
    opacity: .22;
    animation: spinGlow 8s linear infinite;
}

@keyframes spinGlow {
    to { transform: rotate(360deg) translateX(20px); }
}

@keyframes heroIn {
    from { opacity: 0; transform: perspective(1000px) translateY(25px) rotateX(3deg); }
    to { opacity: 1; transform: perspective(1000px) translateY(0) rotateX(.6deg); }
}

.eyebrow {
    color: #a78bfa;
    font-size: 12px;
    letter-spacing: 2.5px;
    font-weight: 800;
    text-transform: uppercase;
}

.hero h1 {
    margin: 10px 0 8px;
    font-size: clamp(38px, 5vw, 68px);
    line-height: .98;
    letter-spacing: -3px;
    background: linear-gradient(90deg,#fff,#c4b5fd,#67e8f9);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.hero p {
    color: var(--muted);
    max-width: 720px;
    font-size: 16px;
    line-height: 1.7;
}

.badge {
    display: inline-flex;
    padding: 8px 13px;
    border-radius: 999px;
    background: rgba(34,211,238,.08);
    border: 1px solid rgba(34,211,238,.25);
    color: #a5f3fc;
    font-size: 12px;
    font-weight: 700;
}

.card {
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 24px;
    background: linear-gradient(145deg, rgba(18,22,47,.82), rgba(9,11,27,.78));
    box-shadow: 0 20px 55px rgba(0,0,0,.22);
    transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease;
}

.card:hover {
    transform: translateY(-5px) rotateX(1deg);
    border-color: rgba(139,92,246,.38);
    box-shadow: 0 28px 65px rgba(0,0,0,.30);
}

.metric-number {
    font-size: 34px;
    font-weight: 800;
    margin-top: 5px;
}

.metric-label {
    color: var(--muted);
    font-size: 13px;
}

.doc-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 18px;
    margin: 10px 0;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: rgba(12,15,32,.72);
    transition: all .25s ease;
}

.doc-card:hover {
    transform: translateX(5px);
    border-color: rgba(34,211,238,.30);
}

.doc-title {
    font-weight: 700;
    color: #fff;
}

.doc-meta {
    color: var(--muted);
    font-size: 12px;
    margin-top: 4px;
}

.auth-wrap {
    max-width: 520px;
    margin: 5vh auto 0;
}

.auth-logo {
    width: 92px;
    height: 92px;
    margin: 0 auto 20px;
    border-radius: 28px;
    display: grid;
    place-items: center;
    font-size: 42px;
    background: linear-gradient(135deg,#7c3aed,#06b6d4);
    box-shadow: 0 25px 65px rgba(124,58,237,.30);
    transform: perspective(600px) rotateY(-8deg) rotateX(5deg);
    animation: logoFloat 3.5s ease-in-out infinite;
}

@keyframes logoFloat {
    0%,100% { transform: perspective(600px) translateY(0) rotateY(-8deg) rotateX(5deg); }
    50% { transform: perspective(600px) translateY(-9px) rotateY(8deg) rotateX(-2deg); }
}

.auth-title {
    text-align: center;
    font-size: 38px;
    font-weight: 800;
    letter-spacing: -1.5px;
}

.auth-sub {
    text-align: center;
    color: var(--muted);
    margin: 8px 0 25px;
}

.small-note {
    color: var(--muted);
    font-size: 12px;
}

.chat-source {
    color: #93c5fd;
    font-size: 12px;
    margin-top: 8px;
}

div[data-testid="stChatMessage"] {
    background: rgba(12,15,32,.45);
    border: 1px solid rgba(255,255,255,.06);
    border-radius: 18px;
    padding: 10px;
}

[data-testid="stFileUploader"] {
    background: rgba(12,15,32,.70);
    border: 1px dashed rgba(139,92,246,.45);
    border-radius: 18px;
}

hr {
    border-color: rgba(255,255,255,.08) !important;
}

/* ============================================================
   FINAL POLISHED UI
   ============================================================ */

:root{
    --bg0:#050816;
    --bg1:#0a1024;
    --panel:#0d1530;
    --panel2:#111b3b;
    --line:rgba(148,163,184,.16);
    --white:#f8fafc;
    --muted:#9aa8c7;
    --primary:#6366f1;
    --primary2:#8b5cf6;
    --cyan:#22d3ee;
}

/* Better global background */
.stApp{
    background:
        radial-gradient(circle at 8% 5%, rgba(99,102,241,.18), transparent 25%),
        radial-gradient(circle at 92% 12%, rgba(34,211,238,.10), transparent 23%),
        radial-gradient(circle at 50% 100%, rgba(139,92,246,.10), transparent 30%),
        linear-gradient(135deg,var(--bg0),var(--bg1)) !important;
}

/* Sidebar */
section[data-testid="stSidebar"]{
    background:linear-gradient(180deg,#070b1b 0%,#0a1024 100%) !important;
    border-right:1px solid rgba(129,140,248,.16) !important;
}
section[data-testid="stSidebar"] *{
    color:#e8edff !important;
}
section[data-testid="stSidebar"] .stButton > button{
    text-align:left !important;
    justify-content:flex-start !important;
    min-height:44px !important;
    background:rgba(17,27,59,.72) !important;
    border:1px solid rgba(129,140,248,.12) !important;
}
section[data-testid="stSidebar"] .stButton > button:hover{
    background:linear-gradient(135deg,rgba(99,102,241,.28),rgba(139,92,246,.22)) !important;
    border-color:rgba(129,140,248,.35) !important;
}

/* Inputs: dark blue box, white typing */
div[data-baseweb="input"],
div[data-baseweb="textarea"]{
    background:#101a38 !important;
    border:1px solid rgba(99,102,241,.42) !important;
    border-radius:13px !important;
}
div[data-baseweb="input"]:focus-within,
div[data-baseweb="textarea"]:focus-within{
    border-color:#818cf8 !important;
    box-shadow:0 0 0 3px rgba(99,102,241,.12) !important;
}
div[data-baseweb="input"] input,
div[data-baseweb="textarea"] textarea,
input, textarea{
    background:#101a38 !important;
    color:#ffffff !important;
    -webkit-text-fill-color:#ffffff !important;
    caret-color:#ffffff !important;
}
div[data-baseweb="input"] input::placeholder,
div[data-baseweb="textarea"] textarea::placeholder,
input::placeholder, textarea::placeholder{
    color:#8fa0c2 !important;
    -webkit-text-fill-color:#8fa0c2 !important;
    opacity:1 !important;
}
label{
    color:#dbe5ff !important;
}

/* Upload */
section[data-testid="stFileUploader"]{
    background:linear-gradient(145deg,#101a38,#0c142d) !important;
    border:1px dashed rgba(129,140,248,.62) !important;
    border-radius:18px !important;
    padding:16px !important;
}
section[data-testid="stFileUploader"] *{
    color:#f8fafc !important;
}
section[data-testid="stFileUploader"] small{
    color:#93a4c7 !important;
}
section[data-testid="stFileUploader"] button{
    background:linear-gradient(135deg,#4f46e5,#7c3aed) !important;
    color:#fff !important;
    border:0 !important;
}

/* Main cards */
.final-card{
    background:linear-gradient(145deg,rgba(17,27,59,.94),rgba(9,15,34,.94));
    border:1px solid rgba(129,140,248,.17);
    border-radius:22px;
    padding:24px;
    box-shadow:0 18px 55px rgba(0,0,0,.22);
}
.final-card:hover{
    border-color:rgba(129,140,248,.34);
}

/* Hero */
.final-hero{
    position:relative;
    overflow:hidden;
    padding:42px;
    border-radius:28px;
    border:1px solid rgba(129,140,248,.18);
    background:
        radial-gradient(circle at 88% 25%,rgba(34,211,238,.14),transparent 20%),
        linear-gradient(135deg,rgba(21,30,65,.96),rgba(8,13,30,.96));
    box-shadow:0 25px 75px rgba(0,0,0,.30);
}
.final-hero-title{
    font-size:clamp(34px,5vw,62px);
    font-weight:850;
    line-height:1;
    letter-spacing:-2.8px;
    background:linear-gradient(90deg,#fff,#c7d2fe,#67e8f9);
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
}
.final-hero-sub{
    max-width:760px;
    color:#a5b2cf;
    font-size:15px;
    line-height:1.7;
    margin-top:13px;
}
.final-pill{
    display:inline-flex;
    margin-top:20px;
    padding:8px 13px;
    border-radius:999px;
    background:rgba(34,211,238,.08);
    border:1px solid rgba(34,211,238,.25);
    color:#a5f3fc;
    font-size:12px;
    font-weight:750;
}

/* Stats */
.final-stat{
    background:linear-gradient(145deg,#111b3b,#0c142d);
    border:1px solid rgba(129,140,248,.16);
    border-radius:18px;
    padding:20px;
    min-height:125px;
}
.final-stat-icon{font-size:25px}
.final-stat-number{
    color:#fff;
    font-size:30px;
    font-weight:850;
    margin-top:7px;
}
.final-stat-label{
    color:#91a0c0;
    font-size:12px;
    margin-top:3px;
}

/* Document list */
.final-doc{
    display:flex;
    align-items:center;
    gap:15px;
    padding:17px;
    margin:10px 0;
    border-radius:17px;
    background:#0d1732;
    border:1px solid rgba(129,140,248,.15);
}
.final-doc-icon{
    width:45px;height:45px;
    border-radius:13px;
    display:grid;place-items:center;
    background:linear-gradient(135deg,#4f46e5,#7c3aed);
    font-size:22px;
}
.final-doc-name{
    color:#fff;
    font-weight:700;
}
.final-doc-meta{
    color:#91a0c0;
    font-size:12px;
    margin-top:4px;
}

/* Chat */
.final-chat-header{
    display:flex;
    align-items:center;
    gap:13px;
    margin-bottom:18px;
}
.final-chat-icon{
    width:48px;height:48px;
    border-radius:15px;
    display:grid;place-items:center;
    background:linear-gradient(135deg,#4f46e5,#8b5cf6);
    box-shadow:0 10px 30px rgba(99,102,241,.24);
    font-size:24px;
}
.final-chat-title{
    color:#fff;
    font-size:27px;
    font-weight:800;
}
.final-chat-sub{
    color:#8fa0c2;
    font-size:13px;
    margin-top:3px;
}
div[data-testid="stChatMessage"]{
    background:rgba(13,23,50,.78) !important;
    border:1px solid rgba(129,140,248,.12) !important;
    border-radius:18px !important;
    padding:10px 13px !important;
    margin:8px 0 !important;
}
div[data-testid="stChatMessage"] p{
    color:#f4f7ff !important;
    line-height:1.65 !important;
}
div[data-testid="stChatInput"]{
    background:#101a38 !important;
    border:1px solid rgba(129,140,248,.48) !important;
    border-radius:18px !important;
    box-shadow:0 12px 35px rgba(0,0,0,.25) !important;
}
div[data-testid="stChatInput"] textarea{
    background:#101a38 !important;
    color:#fff !important;
    -webkit-text-fill-color:#fff !important;
}
div[data-testid="stChatInput"] textarea::placeholder{
    color:#8fa0c2 !important;
    -webkit-text-fill-color:#8fa0c2 !important;
}
div[data-testid="stChatInput"] button{
    background:linear-gradient(135deg,#4f46e5,#7c3aed) !important;
    color:#fff !important;
    border-radius:12px !important;
}
.final-source{
    margin-top:8px;
    padding:8px 11px;
    border-radius:10px;
    background:rgba(34,211,238,.055);
    border:1px solid rgba(34,211,238,.12);
    color:#93c5fd;
    font-size:11px;
}

/* Buttons */
.stButton > button{
    color:#fff !important;
    border:1px solid rgba(129,140,248,.25) !important;
    border-radius:11px !important;
    background:linear-gradient(135deg,#4f46e5,#7c3aed) !important;
    font-weight:700 !important;
}
.stButton > button:hover{
    transform:translateY(-1px) !important;
    box-shadow:0 10px 28px rgba(99,102,241,.22) !important;
}

/* Auth */
.final-auth{
    max-width:540px;
    margin:4vh auto 0;
    padding:34px;
    border-radius:28px;
    background:linear-gradient(145deg,rgba(17,27,59,.96),rgba(8,14,31,.96));
    border:1px solid rgba(129,140,248,.18);
    box-shadow:0 30px 90px rgba(0,0,0,.36);
}
.final-auth-logo{
    width:78px;height:78px;
    margin:0 auto 16px;
    display:grid;place-items:center;
    border-radius:22px;
    background:linear-gradient(135deg,#4f46e5,#8b5cf6);
    font-size:35px;
    box-shadow:0 16px 40px rgba(99,102,241,.26);
}
.final-auth-title{
    text-align:center;
    color:#fff;
    font-size:34px;
    font-weight:850;
}
.final-auth-sub{
    text-align:center;
    color:#91a0c0;
    font-size:13px;
    margin:7px 0 23px;
}

/* Mobile */
@media(max-width:800px){
    .block-container{padding-left:1rem !important;padding-right:1rem !important}
    .final-hero{padding:27px}
    .final-auth{margin:2vh auto;padding:22px}
}

</style>
""", unsafe_allow_html=True)


# ============================================================
# HELPERS
# ============================================================

def user_doc_dir(user_id):
    path = DOC_ROOT / str(user_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def safe_filename(name):
    name = Path(name).name
    name = re.sub(r"[^a-zA-Z0-9._ -]", "_", name)
    return name[:180]


def extract_pdf(path):
    if PdfReader is None:
        return []

    pages = []
    try:
        reader = PdfReader(str(path))

        for index, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            text = re.sub(r"\s+", " ", text).strip()

            if text:
                pages.append({
                    "page": index,
                    "text": text,
                })
    except Exception:
        return []

    return pages


def chunk_pages(pages, filename, size=1000, overlap=150):
    chunks = []

    for page in pages:
        text = page["text"]
        start = 0

        while start < len(text):
            end = min(start + size, len(text))
            part = text[start:end].strip()

            if part:
                chunks.append({
                    "text": part,
                    "source": filename,
                    "page": page["page"],
                })

            if end >= len(text):
                break

            start = max(start + 1, end - overlap)

    return chunks


@st.cache_resource(show_spinner=False)
def embedding_model():
    if SentenceTransformer is None:
        return None

    try:
        return SentenceTransformer(
            "sentence-transformers/all-MiniLM-L6-v2"
        )
    except Exception:
        return None


def search_chunks(question, chunks, top_k=5):
    if not chunks:
        return []

    model = embedding_model()

    if model is not None and cosine_similarity is not None:
        try:
            q = model.encode([question])
            texts = [c["text"] for c in chunks]
            vectors = model.encode(texts)

            scores = cosine_similarity(q, vectors)[0]

            ranked = sorted(
                zip(scores, chunks),
                key=lambda x: x[0],
                reverse=True,
            )

            return [
                dict(item, score=float(score))
                for score, item in ranked[:top_k]
            ]
        except Exception:
            pass

    # Keyword fallback
    words = {
        w.lower()
        for w in re.findall(r"[A-Za-z0-9]{3,}", question)
    }

    scored = []

    for chunk in chunks:
        text_words = set(
            re.findall(r"[A-Za-z0-9]{3,}", chunk["text"].lower())
        )
        score = len(words.intersection(text_words))
        scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        dict(chunk, score=float(score))
        for score, chunk in scored[:top_k]
    ]


def generate_answer(question, results):
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key or Groq is None:
        if not results:
            return "I couldn't find relevant content in your documents."

        return (
            "Groq API key is not configured. "
            "Relevant document passages were found, but an AI-generated "
            "answer cannot be produced yet."
        )

    context = "\n\n".join(
        f"[{r['source']} | page {r['page']}]\n{r['text']}"
        for r in results
    )

    client = Groq(api_key=api_key)

    prompt = f"""
You are RAG PRO, a helpful document assistant.

Answer the user's question using ONLY the provided document context.
If the context does not contain enough information, clearly say so.
Do not invent facts.

Question:
{question}

Document context:
{context}
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": "You answer questions from provided documents.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
        max_tokens=900,
    )

    return response.choices[0].message.content


def load_user_chunks(user_id):
    chunks = []

    for document in list_documents(user_id):
        path = user_doc_dir(user_id) / document["filename"]

        if not path.exists():
            continue

        pages = extract_pdf(path)
        chunks.extend(
            chunk_pages(
                pages,
                document["filename"],
            )
        )

    return chunks


def login(user):
    st.session_state.logged_in = True
    st.session_state.user_id = user["id"]
    st.session_state.username = user["username"]
    st.session_state.page = "Home"
    st.session_state.messages = list_chats(user["id"])


def logout():
    st.session_state.logged_in = False
    st.session_state.user_id = None
    st.session_state.username = ""
    st.session_state.page = "Home"
    st.session_state.messages = []


# ============================================================
# AUTH SCREEN
# ============================================================

def auth_screen():
    st.markdown('<div class="auth-wrap">', unsafe_allow_html=True)

    st.markdown(
        '<div class="final-auth-logo">🤖</div>',
        unsafe_allow_html=True,
    )

    st.markdown(
        '<div class="final-auth-title">RAG AI Assistant</div>',
        unsafe_allow_html=True,
    )

    st.markdown(
        '<div class="final-auth-sub">Intelligent document question-answering workspace</div>',
        unsafe_allow_html=True,
    )

    login_tab, signup_tab = st.tabs(
        ["🔐 Sign In", "✨ Create Account"]
    )

    with login_tab:
        username = st.text_input(
            "Username",
            key="login_username",
            placeholder="Enter your username",
        )

        password = st.text_input(
            "Password",
            type="password",
            key="login_password",
            placeholder="Enter your password",
        )

        if st.button(
            "Enter Workspace →",
            key="login_btn",
            use_container_width=True,
        ):
            user = authenticate_user(username, password)

            if user:
                login(user)
                st.rerun()
            else:
                st.error("Invalid username or password.")

    with signup_tab:
        username = st.text_input(
            "Choose username",
            key="signup_username",
            placeholder="Minimum 3 characters",
        )

        password = st.text_input(
            "Create password",
            type="password",
            key="signup_password",
            placeholder="Minimum 6 characters",
        )

        confirm = st.text_input(
            "Confirm password",
            type="password",
            key="signup_confirm",
        )

        if st.button(
            "Create My Account ✨",
            key="signup_btn",
            use_container_width=True,
        ):
            if password != confirm:
                st.error("Passwords do not match.")
            else:
                ok, message = create_user(username, password)

                if ok:
                    user = authenticate_user(username, password)
                    login(user)
                    st.success("Account created.")
                    st.rerun()
                else:
                    st.error(message)

    st.markdown(
        '<p class="small-note" style="text-align:center;margin-top:20px;">'
        'Your account is stored locally in the app database.'
        '</p>',
        unsafe_allow_html=True,
    )

    st.markdown('</div>', unsafe_allow_html=True)


# ============================================================
# SIDEBAR
# ============================================================

def sidebar():
    with st.sidebar:
        st.markdown("## ✦ RAG PRO")
        st.caption("3D AI Document Workspace")

        st.divider()

        st.markdown(
            f"**👤 {st.session_state.username}**"
        )

        pages = {
            "⌂ Home": "Home",
            "📚 Documents": "Documents",
            "💬 AI Chat": "Chat",
            "🕘 History": "History",
        }

        for label, page in pages.items():
            if st.button(
                label,
                key=f"nav_{page}",
                use_container_width=True,
            ):
                st.session_state.page = page
                st.rerun()

        st.divider()

        if st.button(
            "🚪 Logout",
            key="logout",
            use_container_width=True,
        ):
            logout()
            st.rerun()


# ============================================================
# HOME
# ============================================================

def home_page():
    docs, messages = user_stats(st.session_state.user_id)
    chunks_count = len(load_user_chunks(st.session_state.user_id))

    st.markdown("""
    <div class="final-hero">
        <div style="color:#a78bfa;font-size:11px;letter-spacing:2.5px;font-weight:800;">
            PRIVATE RAG WORKSPACE
        </div>
        <div class="final-hero-title" style="margin-top:11px;">
            RAG AI Assistant
        </div>
        <div class="final-hero-sub">
            Upload your documents, search their content intelligently,
            and ask questions with answers grounded in your PDFs.
        </div>
        <div class="final-pill">● AI SYSTEM ONLINE</div>
    </div>
    """, unsafe_allow_html=True)

    st.write("")

    c1, c2, c3, c4 = st.columns(4)

    cards = [
        ("📚", docs, "Documents"),
        ("🧩", chunks_count, "Chunks"),
        ("💬", messages, "Chat messages"),
        ("🔐", "PRIVATE", "User workspace"),
    ]

    for col, (icon, value, label) in zip(
        [c1, c2, c3, c4],
        cards,
    ):
        with col:
            st.markdown(
                f"""
                <div class="final-stat">
                    <div class="final-stat-icon">{icon}</div>
                    <div class="final-stat-number">{value}</div>
                    <div class="final-stat-label">{label}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.write("")
    st.markdown("### ⚡ Quick Start")

    q1, q2 = st.columns(2)

    with q1:
        st.markdown(
            """
            <div class="card">
                <h3>📄 Upload Knowledge</h3>
                <p style="color:#9ca6c5">
                Add PDF files to create your private searchable knowledge base.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with q2:
        st.markdown(
            """
            <div class="card">
                <h3>🧠 Ask AI</h3>
                <p style="color:#9ca6c5">
                Ask natural-language questions and receive answers with page sources.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.write("")

    if st.button(
        "Open Documents →",
        use_container_width=False,
    ):
        st.session_state.page = "Documents"
        st.rerun()


# ============================================================
# DOCUMENTS
# ============================================================

def documents_page():
    st.markdown("""
    <div class="final-card" style="margin-bottom:18px;">
        <div style="font-size:28px;font-weight:850;color:#fff;">📚 Your Documents</div>
        <div style="color:#91a0c0;margin-top:6px;">
            Build your private knowledge base by uploading PDF files.
        </div>
    </div>
    """, unsafe_allow_html=True)

    uploaded = st.file_uploader(
        "Upload PDF files",
        type=["pdf"],
        accept_multiple_files=True,
    )

    if uploaded:
        if st.button(
            "⬆️ Save Documents",
            use_container_width=True,
        ):
            saved = 0

            for file in uploaded:
                filename = safe_filename(file.name)
                path = user_doc_dir(
                    st.session_state.user_id
                ) / filename

                path.write_bytes(file.getbuffer())

                pages = extract_pdf(path)

                add_document(
                    st.session_state.user_id,
                    filename,
                    len(pages),
                )

                saved += 1

            st.success(f"{saved} document(s) saved.")
            st.rerun()

    st.divider()

    documents = list_documents(
        st.session_state.user_id
    )

    if not documents:
        st.markdown("""
    <div class="final-card" style="text-align:center;padding:42px 20px;">
        <div style="font-size:48px;">📄</div>
        <div style="font-size:20px;font-weight:800;color:#fff;margin-top:8px;">
            Your knowledge base is empty
        </div>
        <div style="color:#91a0c0;margin-top:7px;">
            Choose a PDF above and save it to start asking questions.
        </div>
    </div>
    """, unsafe_allow_html=True)
        return

    for doc in documents:
        c1, c2 = st.columns([5, 1])

        with c1:
            st.markdown(
                f"""
                <div class="final-doc">
                    <div class="final-doc-icon">📄</div>
                    <div>
                        <div class="final-doc-name">{doc["filename"]}</div>
                        <div class="final-doc-meta">
                            {doc["pages"]} pages • uploaded {doc["uploaded_at"]}
                        </div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        with c2:
            if st.button(
                "Delete",
                key=f"delete_{doc['id']}",
            ):
                path = user_doc_dir(
                    st.session_state.user_id
                ) / doc["filename"]

                if path.exists():
                    path.unlink()

                delete_document(
                    st.session_state.user_id,
                    doc["filename"],
                )

                st.rerun()


# ============================================================
# CHAT
# ============================================================

def chat_page():
    st.markdown("""
    <div class="final-chat-header">
        <div class="final-chat-icon">🤖</div>
        <div>
            <div class="final-chat-title">Ask your documents</div>
            <div class="final-chat-sub">
                Search your PDFs and get grounded answers with page sources.
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    chunks = load_user_chunks(
        st.session_state.user_id
    )

    if not chunks:
        st.warning(
            "Upload a PDF first from the Documents page."
        )
        return

    for message in st.session_state.messages:
        with st.chat_message(message["role"], avatar="👤" if message["role"] == "user" else "🤖"):
            st.markdown(message["content"])

            sources = message.get("sources", "")

            if sources:
                st.markdown(
                    f'<div class="final-source">📚 {sources}</div>',
                    unsafe_allow_html=True,
                )

    question = st.chat_input(
        "Ask something about your documents..."
    )

    if not question:
        return

    save_chat(
        st.session_state.user_id,
        "user",
        question,
    )

    st.session_state.messages.append({
        "role": "user",
        "content": question,
        "sources": "",
    })

    with st.chat_message("user", avatar="👤"):
        st.markdown(question)

    with st.chat_message("assistant", avatar="🤖"):
        with st.spinner("Searching your knowledge base..."):
            results = search_chunks(
                question,
                chunks,
                top_k=5,
            )

        with st.spinner("Generating answer..."):
            answer = generate_answer(
                question,
                results,
            )

        source_names = []

        for result in results:
            source_names.append(
                f'{result["source"]} • page {result["page"]}'
            )

        source_text = " | ".join(
            dict.fromkeys(source_names)
        )

        st.markdown(answer)

        if source_text:
            st.markdown(
                f'<div class="final-source">📚 {source_text}</div>',
                unsafe_allow_html=True,
            )

    save_chat(
        st.session_state.user_id,
        "assistant",
        answer,
        source_text,
    )

    st.session_state.messages.append({
        "role": "assistant",
        "content": answer,
        "sources": source_text,
    })


# ============================================================
# HISTORY
# ============================================================

def history_page():
    st.markdown("## 🕘 Chat History")

    history = list_chats(
        st.session_state.user_id,
        limit=200,
    )

    if not history:
        st.info("No conversations yet.")
        return

    if st.button(
        "🗑 Clear My Chat History",
        use_container_width=False,
    ):
        clear_chats(
            st.session_state.user_id
        )
        st.session_state.messages = []
        st.rerun()

    st.divider()

    for item in history:
        with st.chat_message(item["role"]):
            st.markdown(item["content"])

            if item["sources"]:
                st.caption(
                    f'📚 {item["sources"]}'
                )


# ============================================================
# APP
# ============================================================

if not st.session_state.logged_in:
    auth_screen()
else:
    sidebar()

    if st.session_state.page == "Home":
        home_page()
    elif st.session_state.page == "Documents":
        documents_page()
    elif st.session_state.page == "Chat":
        chat_page()
    elif st.session_state.page == "History":
        history_page()
