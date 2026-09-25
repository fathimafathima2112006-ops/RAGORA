# RAGORA on Vercel

## Permanent import-crash fix

The previous Vercel 500 was caused by an environment variable named `LLM_TIMEOUT` existing with an empty value. `config.py` used `int(os.getenv(...))`, so the empty string crashed the Flask import before the app could start.

This version parses numeric environment variables defensively and uses Vercel's writable `/tmp` directory for SQLite/uploads.

## Vercel environment variables

Set these in **Project Settings → Environment Variables**:

- `SECRET_KEY` — a long random secret
- `GROQ_API_KEY` — your Groq API key
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `GOOGLE_REDIRECT_URI` — `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/callback`

Optional variables can be omitted; the app has safe defaults for numeric settings. If `LLM_TIMEOUT`, `MAX_OUTPUT_TOKENS`, `MAX_HISTORY_MESSAGES`, or `RETRIEVAL_MIN_SCORE` already exist in Vercel, they may be deleted or left blank because this version handles blanks safely.

## Important storage note

Vercel function storage is ephemeral. `/tmp` prevents startup/file-write errors, but SQLite data and uploaded files are **not durable across all function instances**. For a genuinely persistent production knowledge base, keep the RAG backend on Render (with its persistent disk) or move the database/files to a managed external store.

## Deploy

Push the project files to GitHub and redeploy the Vercel project. No secret values belong in Git.
