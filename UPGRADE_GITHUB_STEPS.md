# RAGORA Upgrade — GitHub replacement map

This package changes answer generation so the response length follows the user's wording:

- normal question -> normal focused answer
- explicit short/brief/summary request -> short answer
- explicit detail/deep/step-by-step request -> detailed answer

## GitHub
Replace these files:

1. `streamlit_app.py` — replace completely
2. `db.py` — replace completely
3. `auth.py` — replace completely
4. `render.yaml` — replace completely
5. `vercel.json` — replace completely
6. `api/index.py` — replace completely
7. Create `render_requirements.txt`
8. Create `.vercelignore`

Delete these files:

- `app.py`
- `requirements.txt`

Keep the remaining project files unless you have a separate reason to remove them.

## Render
Build command: `pip install -r render_requirements.txt`
Start command: `streamlit run streamlit_app.py --server.address 0.0.0.0 --server.port $PORT --server.headless true`

## Vercel
Set `RENDER_URL` to your Render URL, for example `https://ragora.onrender.com` (without a trailing slash).
