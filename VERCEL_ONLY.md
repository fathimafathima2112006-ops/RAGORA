# RAGORA — Vercel-only deployment

This version runs the Flask app directly on Vercel. It does not use Render, RENDER_URL, or a Render proxy.

Vercel's current Flask deployment supports zero-configuration Flask apps. The app entrypoint is the root `app.py` containing the Flask `app` object.

## Required Vercel environment variables
- GROQ_API_KEY
- GROQ_MODEL=openai/gpt-oss-20b
- LLM_MODEL=openai/gpt-oss-20b
- LLM_FALLBACK_MODEL=openai/gpt-oss-20b
- WEB_MODEL=openai/gpt-oss-20b
- SECRET_KEY
- PRODUCTION=1
- COOKIE_SECURE=1
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI=https://ragora-nine.vercel.app/auth/callback

Do not add `RENDER_URL`.

## Deploy
Import/upload this project to the Vercel project and redeploy from the project root. Do not set a custom Root Directory such as `ragora` unless that is actually where these files live.
