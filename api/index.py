import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlsplit

RENDER_URL = os.getenv("RENDER_URL", "").strip().rstrip("/")


class handler(BaseHTTPRequestHandler):

    def _redirect(self):
        if not RENDER_URL:
            self.send_response(500)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                b"RENDER_URL is not configured in Vercel Environment Variables."
            )
            return

        incoming = urlsplit(self.path)

        # Vercel root -> /api/index -> Render root
        if incoming.path in ("/api/index", "/api/index.py"):
            target = RENDER_URL + "/"
        else:
            target = RENDER_URL + (incoming.path or "/")

        if incoming.query:
            target += "?" + incoming.query

        self.send_response(307)
        self.send_header("Location", target)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_GET(self):
        self._redirect()

    def do_POST(self):
        self._redirect()

    def do_PUT(self):
        self._redirect()

    def do_PATCH(self):
        self._redirect()

    def do_DELETE(self):
        self._redirect()
