import os
import http.client
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlsplit


RENDER_URL = os.getenv("RENDER_URL", "").strip().rstrip("/")


class handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_error(self, status, message):
        body = message.encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        try:
            self.wfile.write(body)
        except Exception:
            pass

    def _proxy(self):
        conn = None

        try:
            if not RENDER_URL:
                self._send_error(
                    500,
                    "RAGORA gateway is not configured. "
                    "Set RENDER_URL in Vercel environment variables."
                )
                return

            target = urlsplit(RENDER_URL)

            if target.scheme not in ("http", "https") or not target.netloc:
                self._send_error(
                    500,
                    "Invalid RENDER_URL configuration."
                )
                return

            incoming = urlsplit(self.path)

            # Read request body.
            body = b""

            content_length = self.headers.get("Content-Length")

            if content_length:
                try:
                    length = int(content_length)
                except ValueError:
                    length = 0

                if length > 0:
                    body = self.rfile.read(length)

            # Forward safe request headers.
            headers = {}

            hop_by_hop = {
                "host",
                "connection",
                "content-length",
                "transfer-encoding",
                "accept-encoding",
            }

            for key, value in self.headers.items():
                if key.lower() not in hop_by_hop:
                    headers[key] = value

            headers["Host"] = target.netloc
            headers["Accept-Encoding"] = "identity"

            # Build destination path.
            path = incoming.path or "/"

            if incoming.query:
                path += "?" + incoming.query

            # Create HTTP/HTTPS connection.
            if target.scheme == "https":
                conn = http.client.HTTPSConnection(
                    target.netloc,
                    timeout=55,
                )
            else:
                conn = http.client.HTTPConnection(
                    target.netloc,
                    timeout=55,
                )

            conn.request(
                self.command,
                path,
                body=body,
                headers=headers,
            )

            response = conn.getresponse()

            response_body = response.read()

            self.send_response(response.status)

            render_origin = (
                target.scheme + "://" + target.netloc
            )

            for key, value in response.getheaders():
                lower_key = key.lower()

                if lower_key in {
                    "connection",
                    "transfer-encoding",
                    "content-length",
                }:
                    continue

                # Keep redirects on the Vercel domain instead of exposing
                # the Render backend URL to the browser.
                if lower_key == "location":
                    if value.startswith(render_origin):
                        value = value[len(render_origin):]

                        if not value:
                            value = "/"

                self.send_header(key, value)

            self.send_header(
                "Content-Length",
                str(len(response_body)),
            )

            self.send_header(
                "Cache-Control",
                "no-store",
            )

            self.end_headers()

            if response_body:
                self.wfile.write(response_body)

        except TimeoutError:
            self._send_error(
                504,
                "RAGORA backend timed out. Please try again."
            )

        except Exception as exc:
            # Do not expose internal exception details to the browser.
            self._send_error(
                502,
                "RAGORA gateway could not reach the AI service."
            )

        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

    def do_GET(self):
        self._proxy()

    def do_POST(self):
        self._proxy()

    def do_PUT(self):
        self._proxy()

    def do_PATCH(self):
        self._proxy()

    def do_DELETE(self):
        self._proxy()

    def do_OPTIONS(self):
        self._proxy()
