# RAGORA — Render + Vercel

## Architecture
- Render runs the real Streamlit application (`streamlit_app.py`).
- Vercel provides a public gateway/domain and redirects requests to the Render app.
- This avoids trying to run Streamlit as a Vercel Flask/WSGI app.

## Render
Use the included `render.yaml`, or set:
- Build: `pip install -r requirements.txt`
- Start: `streamlit run streamlit_app.py --server.address 0.0.0.0 --server.port $PORT --server.headless true`
- `GROQ_API_KEY`: your Groq key
- `GROQ_MODEL`: `llama-3.1-8b-instant`
- `DB_PATH`: `/var/data/ragora.db`
- `UPLOAD_DIR`: `/var/data/uploads`

After Render is Live, copy the Render URL, e.g. `https://ragora-xxxx.onrender.com`.

## Vercel
Deploy this same repository as a Vercel project.
Add an Environment Variable:
- Name: `RENDER_URL`
- Value: your live Render URL, without a trailing slash.

Then redeploy Vercel.
Opening the Vercel URL will redirect to the live RAGORA app on Render.

## Important
Do not change `streamlit_app.py` back to `app.py` for this dual deployment package. Keeping the Streamlit entrypoint outside the Vercel `api/` directory prevents Vercel from treating it as a Flask/WSGI function.
