# RAGORA Professional 2.0

This build fixes the recurring Groq 120B TPM problem by **hard-locking normal RAG/companion traffic to `openai/gpt-oss-20b`** and never honoring stale `openai/gpt-oss-120b` or retired Llama 3.1 8B values from older `.env` files.

## Routing
- Strong document match -> compact GPT-OSS 20B RAG request.
- No document match / current question -> `groq/compound-mini` live web route.
- If the 20B request hits 429/413/5xx -> no repeated retry storm; a local document-evidence fallback is returned.
- If web summarization is unavailable -> lightweight DuckDuckGo snippet fallback is used.
- GPT-OSS uses `reasoning_effort=low` to reduce unnecessary reasoning tokens.
- Prompt/history/context are deliberately capped for the user's 8K TPM environment.

## Important
Groq rate limits are organization-level. A code change cannot raise an 8K TPM account limit. This build is designed to avoid wasteful token usage and to fail gracefully instead of showing raw Groq errors.

## Run
1. Extract this folder.
2. Copy `.env.example` to `.env` and set `GROQ_API_KEY`.
3. If you have an old `.env`, it is safe to leave an old model value there; RAGORA ignores it and uses the safe model selection.
4. Run the same startup command you used for the previous build.

## Production note
Use persistent storage for `DB_PATH` and `UPLOAD_DIR` on hosted platforms.

## RAGORA Final-Year Project Edition

RAGORA is a Flask-based Retrieval-Augmented Question & Answer platform with a premium dark-first UI and a transparent technical demonstration layer.

### What is included
- Document ingestion for PDF, DOCX, TXT, CSV, XLSX and source/code formats
- Text extraction and chunking with overlap
- Hybrid retrieval: TF-IDF similarity + BM25 + keyword overlap + reciprocal-rank fusion + reranking
- Grounded LLM answers with numbered source citations
- Source Viewer and Chunk Explorer
- Retrieval Explorer showing query → retrieval → Top-K → context → LLM flow
- Analytics & Evaluation using `eval_dataset.json` with Hit Rate@K, Precision@K, MRR and average retrieval confidence
- Chat history, export, responsive mobile navigation and theme toggle
- Google OAuth and existing Groq/Compound web-search integration preserved

### Honest evaluation
The Analytics screen does not invent scores. Until you run an evaluation against a real `eval_dataset.json` and indexed documents, metrics are shown as unavailable. The starter dataset should be edited with the actual filenames that are relevant to your project questions.

### Run locally
1. Create a virtual environment and install `requirements.txt`.
2. Copy `.env.example` to `.env` and add your own credentials.
3. Run `python app.py`.
4. Open the local Flask URL shown in the terminal.

Never commit your real `.env` or API credentials.
