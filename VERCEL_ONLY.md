# RAGORA — Vercel Only

This build runs the Flask app directly as a Vercel Python Function. It does **not** proxy to Render and does not use `RENDER_URL`.

## Vercel environment variables

Required:
- `GROQ_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=https://<your-project>.vercel.app/auth/callback`
- `SECRET_KEY`

Recommended:
- `GROQ_MODEL=openai/gpt-oss-20b`
- `LLM_MODEL=openai/gpt-oss-20b`
- `LLM_FALLBACK_MODEL=openai/gpt-oss-20b`
- `WEB_MODEL=openai/gpt-oss-20b`
- `PRODUCTION=1`
- `COOKIE_SECURE=1`

## Important Vercel storage/upload note

Vercel Functions accept a maximum request payload of 4.5 MB. This build therefore defaults its app-level upload limit to 4 MB on Vercel. Large-file uploads need direct object storage (for example Vercel Blob) rather than sending the whole file through the Flask function. SQLite and `/tmp` are not durable application storage on Vercel.

## Google OAuth

Add the exact callback URI to Google Cloud OAuth credentials:
`https://<your-project>.vercel.app/auth/callback`

No Render environment variable is required.
