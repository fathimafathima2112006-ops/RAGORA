# RAGORA — Render + Vercel

## Render
Render runs the Streamlit application using `streamlit_app.py`. Set `GROQ_API_KEY`. The persistent disk stores the SQLite database and uploaded PDFs.

## Vercel
Vercel is a lightweight gateway. Set the Vercel environment variable `RENDER_URL` to the full Render service URL (for example `https://your-ragora.onrender.com`). The Vercel Python function redirects requests to Render.

Do not configure Vercel to treat `app.py` as a Flask application. RAGORA is a Streamlit app.
