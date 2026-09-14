# RAGORA SUPER AI 2.0

RAGORA is a multilingual AI knowledge workspace with document RAG, research, study, coding, agent-style task planning, vision input, diagrams, voice playback and mobile-first UX.

## Features
- AI modes: Auto, Fast, Research, Study, Code, Explain, Agent
- PDF/DOCX/TXT/CSV/XLSX/JSON and source-code ingestion
- Hybrid retrieval: TF-IDF + BM25 + keyword fusion + reranking
- Traceable document citations and Chunk Explorer
- Image questions with vision-model support
- Mermaid diagrams
- Browser speech playback
- Local browser-only AI preferences
- Conversation delete/history/export
- Google OAuth

## Setup
1. Copy `.env.example` to `.env`.
2. Set `SECRET_KEY`, Google OAuth values and `GROQ_API_KEY`.
3. Install: `pip install -r requirements.txt`
4. Run: `python app.py`

Never commit `.env`, API keys, OAuth secrets, database files, uploads or `__pycache__`.

## Production upload note
The app-side upload limit is 1 GB, but a serverless host can impose a much smaller request limit. For true 1 GB uploads, use direct object storage and background ingestion.
