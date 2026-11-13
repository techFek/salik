"""Local review page: http://localhost:8777 — every flagged moment with its screenshots, ✓ / ✗, and the right
category if the guess was wrong. Each click is saved straight into the scan's labels.json."""
import json
import mimetypes
import os
import threading
import webbrowser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from .categories import ALL_LABELS, CATEGORIES, LANGUAGE, SPEECH_SEXUAL, SPEECH_SUBSTANCE

PAGE = Path(__file__).resolve().parent / "review.html"
LIB = {**{k: (v["library"], v["action"]) for k, v in CATEGORIES.items()}, "language": (LANGUAGE["library"], LANGUAGE["action"]),
       "speech_sexual": (SPEECH_SEXUAL["library"], SPEECH_SEXUAL["action"]),
       "speech_substance": (SPEECH_SUBSTANCE["library"], SPEECH_SUBSTANCE["action"])}


def salik_filters(scenes, labels):
    """Confirmed scenes as Salik library filters (library/<title>.json "filters")."""
    out = []
    for s in scenes:
        lab = labels.get(str(s["id"]), {})
        if lab.get("verdict") != "yes":
            continue
        cat = lab.get("category") or s["category"]
        lib_cat, action = LIB.get(cat, ("violence", "skip"))
        out.append({"id": len(out) + 1, "start": s["start"], "end": s["end"], "category": lib_cat,
                    "original_description": lab.get("note") or s.get("word") or ALL_LABELS.get(cat, cat), "action_type": action})
    return out


def serve(folder: Path, port=8777, open_browser=True):
    folder = folder.resolve()

    class H(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(folder), **kw)

        def log_message(self, *a):
            pass

        def _json(self, obj, code=200):
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path in ("/", "/index.html"):
                body = PAGE.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if self.path == "/api/scan":
                read = lambda n, d: json.loads((folder / n).read_text(encoding="utf-8")) if (folder / n).exists() else d
                return self._json({"info": read("info.json", {}), "scenes": read("scenes.json", []), "labels": read("labels.json", {}),
                                   "names": ALL_LABELS})
            if self.path == "/api/filters":
                scenes = json.loads((folder / "scenes.json").read_text(encoding="utf-8"))
                labels = json.loads((folder / "labels.json").read_text(encoding="utf-8"))
                return self._json(salik_filters(scenes, labels))
            if self.path.startswith("/video"):
                return self._range()
            return super().do_GET()

        def _range(self):
            info = json.loads((folder / "info.json").read_text(encoding="utf-8"))
            p = Path(info.get("video", ""))
            p = p if p.is_absolute() else folder / p
            if not p.exists():
                return self.send_error(404)
            size = p.stat().st_size
            start, end = 0, size - 1
            rng = self.headers.get("Range")
            if rng and rng.startswith("bytes="):
                a, _, b = rng[6:].partition("-")
                start = int(a) if a else 0
                end = int(b) if b else size - 1
            end = min(end, size - 1)
            self.send_response(206 if rng else 200)
            self.send_header("Content-Type", mimetypes.guess_type(p.name)[0] or "video/mp4")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(end - start + 1))
            if rng:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.end_headers()
            with open(p, "rb") as f:
                f.seek(start)
                left = end - start + 1
                try:
                    while left > 0:
                        chunk = f.read(min(1 << 16, left))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        left -= len(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        def do_POST(self):
            if self.path != "/api/label":
                return self.send_error(404)
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            lf = folder / "labels.json"
            labels = json.loads(lf.read_text(encoding="utf-8")) if lf.exists() else {}
            sid = str(body.get("id"))
            entry = {k: body[k] for k in ("verdict", "category", "note") if body.get(k)}
            if entry:
                labels[sid] = entry
            else:
                labels.pop(sid, None)
            tmp = lf.with_suffix(".tmp")
            tmp.write_text(json.dumps(labels, ensure_ascii=False, indent=1), encoding="utf-8")
            os.replace(tmp, lf)
            return self._json({"ok": True, "reviewed": len(labels)})

    httpd = ThreadingHTTPServer(("127.0.0.1", port), H)
    url = f"http://localhost:{port}/"
    print(f"🔎 review: {url}   (Ctrl+C to stop)")
    if open_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
