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
        # The Vercel rewrite sends every request to this function.
        # The gateway itself should forward to the Render root, not /api/index.py.
        target_path = "/" if incoming.path in ("/api/index", "/api/index.py") else (incoming.path or "/")
        target = RENDER_URL + target_path
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
