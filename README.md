# RAGORA — Professional AI Document Assistant

A polished Streamlit Retrieval-Augmented Generation (RAG) workspace for private PDF question answering.

## Features

- Secure local username/password authentication with salted PBKDF2 hashing
- Multi-user document isolation
- PDF upload and page extraction
- Semantic search with `sentence-transformers`
- Keyword fallback when embeddings are unavailable
- Grounded answers through Groq
- Source filename + page references
- Persistent SQLite chat history
- Document management and delete controls
- Professional dark blue / purple glass UI
- Render-ready configuration with persistent disk

## 1. Run locally

Use Python 3.11 or 3.12.

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` and add your Groq key.

```powershell
Copy-Item .env.example .env
```

Then start:

```powershell
python -m streamlit run app.py
```

## 2. GitHub upload

Keep these files/folders in the repository root:

- `app.py`
- `auth.py`
- `db.py`
- `config.py`
- `requirements.txt`
- `render.yaml`
- `.env.example`
- `.gitignore`
- `.streamlit/config.toml`
- `README.md`

Do **not** upload `.env`, your virtual environment, or the local SQLite database.

## 3. Render deployment

Create a Render Web Service from the GitHub repository. The included `render.yaml` starts Streamlit correctly:

```text
streamlit run app.py --server.address 0.0.0.0 --server.port $PORT --server.headless true
```

Add `GROQ_API_KEY` as a secret environment variable in Render. The included persistent disk stores the SQLite database and uploaded PDFs.

## Important

This project is a Streamlit application. Do not use `gunicorn app:app` or configure it as a Flask application.
