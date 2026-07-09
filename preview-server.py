#!/usr/bin/env python3
"""Static site server with approved-review API."""

from __future__ import annotations

import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
REVIEWS_FILE = ROOT / "assets" / "data" / "approved-reviews.json"
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8765"))


def read_reviews() -> list:
    if not REVIEWS_FILE.exists():
        return []
    try:
        data = json.loads(REVIEWS_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and isinstance(data.get("approved"), list):
            return data["approved"]
    except Exception:
        pass
    return []


def write_reviews(reviews: list) -> None:
    REVIEWS_FILE.parent.mkdir(parents=True, exist_ok=True)
    REVIEWS_FILE.write_text(
        json.dumps(reviews, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


class ReuseHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")

    def _json(self, status: int, payload) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/api/reviews", "/api/reviews/"):
            self._json(200, {"approved": read_reviews()})
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path not in ("/api/reviews", "/api/reviews/", "/api/reviews/approve"):
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            self._json(400, {"ok": False, "error": "Invalid JSON"})
            return

        review = payload.get("review") if isinstance(payload, dict) else None
        if not isinstance(review, dict):
            review = payload if isinstance(payload, dict) else None

        if not review or not review.get("name") or not review.get("text") or not review.get("rating"):
            self._json(400, {"ok": False, "error": "Missing review fields"})
            return

        reviews = read_reviews()
        rid = str(review.get("id") or "")
        cleaned = {
            "id": rid or f"r_{os.urandom(4).hex()}",
            "name": str(review.get("name", "")).strip(),
            "email": str(review.get("email", "")).strip().lower(),
            "rating": int(float(review.get("rating", 0))),
            "text": str(review.get("text", "")).strip(),
            "date": str(review.get("date") or ""),
            "verified": True,
            "source": "site",
            "approvedAt": str(review.get("approvedAt") or ""),
        }

        exists = False
        for i, item in enumerate(reviews):
            if item.get("id") == cleaned["id"]:
                reviews[i] = cleaned
                exists = True
                break
        if not exists:
            reviews.insert(0, cleaned)

        write_reviews(reviews)
        self._json(200, {"ok": True, "approved": reviews, "review": cleaned})

    def log_message(self, fmt: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


def main() -> None:
    if not REVIEWS_FILE.exists():
        write_reviews([])
    try:
        server = ReuseHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        print(f"ERROR: Could not start on {HOST}:{PORT} — {exc}")
        print("Another preview server may already be running. Close it or run:")
        print("  Get-NetTCPConnection -LocalPort 8765 | Stop-Process -Id {OwningProcess} -Force")
        raise SystemExit(1) from exc
    print(f"Serving {ROOT}")
    print(f"http://{HOST}:{PORT}/")
    print("API: GET/POST /api/reviews")
    server.serve_forever()


if __name__ == "__main__":
    main()
