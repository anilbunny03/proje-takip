#!/usr/bin/env python3
"""Proje Takip Uygulaması için güvenli yerel statik sunucu.

- Varsayılan olarak yalnızca 127.0.0.1:8000 adresine bağlanır.
- Yalnızca GET ve HEAD kabul edilir.
- Yalnızca uygulama dosyaları (index.html, vendor/, assets/) sunulur;
  proje verileri, yedekler, kaynak dosyalar ve nokta ile başlayan dosyalar sunulmaz.
- Dizin listesi yoktur.
"""
import argparse
import mimetypes
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000

ROOT_FILES = {"index.html"}
ALLOWED_DIRS = ("vendor", "assets")
ALLOWED_EXT = {
    ".html", ".js", ".css", ".json", ".svg", ".png", ".jpg", ".jpeg", ".gif",
    ".webp", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".txt", ".webmanifest",
}
MIME = {
    ".js": "text/javascript; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
}


def resolve_request(root, raw_target):
    """İstek yolunu izinli bir dosya yoluna çevirir; izinli değilse None döner."""
    root = Path(root).resolve()
    path = urlsplit(raw_target).path
    if "\\" in path or "\x00" in path:
        return None
    path = unquote(path)
    if "\\" in path or "\x00" in path or not path.startswith("/"):
        return None
    if path == "/":
        path = "/index.html"
    parts = path.split("/")[1:]
    if any(p in ("", ".", "..") or p.startswith(".") for p in parts):
        return None
    if len(parts) == 1:
        if parts[0] not in ROOT_FILES:
            return None
    elif parts[0] not in ALLOWED_DIRS:
        return None
    candidate = root.joinpath(*parts)
    if candidate.suffix.lower() not in ALLOWED_EXT:
        return None
    try:
        real = candidate.resolve(strict=True)
    except (OSError, RuntimeError):
        return None
    if not real.is_file():
        return None
    base = root if len(parts) == 1 else root / parts[0]
    try:
        real.relative_to(base.resolve())
    except ValueError:
        return None
    return real


class Handler(BaseHTTPRequestHandler):
    server_version = "ProjeTakip"
    sys_version = ""
    root = Path(__file__).resolve().parent

    def _send(self, code, body=b"", ctype="text/plain; charset=utf-8", head=False, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def _serve(self, head):
        target = resolve_request(self.root, self.path)
        if target is None:
            return self._send(404, b"404 Bulunamadi", head=head)
        try:
            data = target.read_bytes()
        except OSError:
            return self._send(404, b"404 Bulunamadi", head=head)
        ext = target.suffix.lower()
        ctype = MIME.get(ext) or mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self._send(200, data, ctype, head)

    def do_GET(self):
        self._serve(False)

    def do_HEAD(self):
        self._serve(True)

    def _reject(self):
        self._send(405, b"405 Yontem desteklenmiyor", extra={"Allow": "GET, HEAD"})

    do_POST = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = _reject

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def make_server(host=DEFAULT_HOST, port=DEFAULT_PORT, root=None):
    root = Path(root or Path(__file__).resolve().parent).resolve()
    handler = type("BoundHandler", (Handler,), {"root": root})
    return ThreadingHTTPServer((host, port), handler)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Proje Takip Uygulaması yerel sunucusu")
    ap.add_argument("--host", default=DEFAULT_HOST, help="Bağlanılacak adres (varsayılan 127.0.0.1)")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port (varsayılan 8000)")
    ap.add_argument("--open", action="store_true", help="Sunucu başlayınca varsayılan tarayıcıyı aç")
    args = ap.parse_args(argv)
    try:
        srv = make_server(args.host, args.port)
    except OSError as e:
        print(f"[HATA] {args.host}:{args.port} adresine bağlanılamadı: {e}")
        print("Port başka bir uygulama tarafından kullanılıyor olabilir. Farklı port için: --port 8001")
        return 1
    if args.host not in ("127.0.0.1", "localhost", "::1"):
        print("[UYARI] Sunucu yalnızca bu bilgisayara değil, ağa açık bir adrese bağlandı.")
    url = f"http://{'localhost' if args.host == DEFAULT_HOST else args.host}:{srv.server_address[1]}/"
    print(f"Proje Takip Uygulaması çalışıyor: {url}")
    print("Durdurmak için Ctrl+C tuşlarına basın veya bu pencereyi kapatın.")
    if args.open:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu durduruldu.")
    finally:
        srv.server_close()
    return 0


if __name__ == "__main__":
    # Keep Turkish messages readable in redirected Windows/CI consoles.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
