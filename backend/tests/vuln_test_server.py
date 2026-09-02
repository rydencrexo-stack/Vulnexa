"""Tiny intentionally-vulnerable test server (validation only, localhost).

Endpoints:
  /xss?q=          reflected XSS (unsafe attribute + body echo)
  /redirect?url=   302 Location: <url>            -> open redirect
  /jsredirect?url= 200 JS redirect (window.location) -> open redirect
  /fetch?url=      server-side fetch + reflect    -> SSRF sink
  /search?q=       reflects q                     -> generic param (sqlmap/ssti no-op)

Only for local validation. Do not expose outside localhost.
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
import urllib.request


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = {key: values[0] for key, values in parse_qs(parsed.query).items()}

        if path == "/xss":
            q = params.get("q", "")
            body = f"""<!DOCTYPE html><html><body><h1>Search</h1>
<form><input name="q" value="{q}"></form>
<p>You searched for: {q}</p>
</body></html>""".encode("utf-8")
            self.send_response(200)
        elif path == "/redirect":
            url = params.get("url", "/")
            self.send_response(302)
            self.send_header("Location", url)
            body = b""
        elif path == "/jsredirect":
            url = params.get("url", "/")
            body = f"""<!DOCTYPE html><html><body>
<script>window.location = "{url}";</script>
</body></html>""".encode("utf-8")
            self.send_response(200)
        elif path == "/fetch":
            url = params.get("url", "http://127.0.0.1:1/")
            try:
                with urllib.request.urlopen(url, timeout=3) as resp:
                    fetched = resp.read(2000).decode("utf-8", errors="replace")
                body = f"Fetched: {fetched}".encode("utf-8")
            except Exception as exc:  # noqa: BLE001
                body = f"Fetch error: {exc}".encode("utf-8")
            self.send_response(200)
        elif path == "/search":
            q = params.get("q", "")
            body = f"Result for {q}".encode("utf-8")
            self.send_response(200)
        else:
            body = b"not found"
            self.send_response(404)

        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 8899), Handler)
    print("vulnerable test server on http://127.0.0.1:8899")
    server.serve_forever()