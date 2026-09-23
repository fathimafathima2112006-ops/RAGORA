"""
RAGORA - Vercel entrypoint

This file runs the RAGORA Flask application directly on Vercel.

IMPORTANT:
- Vercel does NOT proxy to Render.
- Vercel does NOT redirect to Render.
- Render and Vercel are separate deployments.
"""

from app import app


# Vercel's Python runtime looks for a WSGI application named `app`.
# The Flask application is imported directly from the project's app.py.
#
# No proxy.
# No redirect.
# No RENDER_URL.
# No external backend forwarding.
