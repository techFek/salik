#!/usr/bin/env python3
"""Salik Scan — count sexual, violent, gory, substance and bad-language moments in a video, with screenshots.

  python salik_scan.py scan "https://www.youtube.com/watch?v=..."   analyse a link (or a video file path)
  python salik_scan.py review [folder]                              reopen a scan's review page (latest by default)
  python salik_scan.py train                                        learn from your ✓/✗ reviews
  python salik_scan.py list                                         list scans
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser(description="Salik Scan")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("scan", help="analyse a YouTube link or a video file")
    s.add_argument("source")
    s.add_argument("--every", type=float, default=1.0, help="seconds between screenshots (default 1)")
    s.add_argument("--threshold", type=float, default=0.35, help="0..1, lower finds more (and more false alarms)")
    s.add_argument("--whisper", default="small", help="tiny / base / small / medium (bigger = more accurate, slower)")
    s.add_argument("--lang", default=None, help="audio language, e.g. ar or en (default: detect)")
    s.add_argument("--no-speech", action="store_true", help="skip the audio (bad language)")
    s.add_argument("--word", action="append", default=[], help="extra word to count as bad language (repeatable)")
    s.add_argument("--whisper-anyway", action="store_true", help="listen with Whisper even when YouTube captions exist")
    s.add_argument("--cookies-from-browser", default=None, help="e.g. chrome, if YouTube asks to sign in")
    s.add_argument("--no-review", action="store_true", help="don't open the review page at the end")
    r = sub.add_parser("review", help="open the review page")
    r.add_argument("folder", nargs="?")
    r.add_argument("--port", type=int, default=8777)
    sub.add_parser("train", help="train on your reviews")
    sub.add_parser("list", help="list scans")
    a = ap.parse_args()

    from salikscan import scan as S
    if a.cmd == "scan":
        folder = S.run(a.source, every=a.every, threshold=a.threshold, whisper=a.whisper, language=a.lang,
                       speech=not a.no_speech, extra_words=a.word, cookies_from=a.cookies_from_browser,
                       force_whisper=a.whisper_anyway)
        if not a.no_review:
            from salikscan.review import serve
            serve(folder)
    elif a.cmd == "review":
        folder = Path(a.folder) if a.folder else S.latest()
        if not folder or not (folder / "scenes.json").exists():
            sys.exit("No scan found. Run: python salik_scan.py scan <link>")
        from salikscan.review import serve
        serve(folder, port=a.port)
    elif a.cmd == "train":
        from salikscan.train import run
        run()
    elif a.cmd == "list":
        import json
        for f in sorted(S.SCANS.glob("*")):
            if (f / "scenes.json").exists():
                n = len(json.loads((f / "scenes.json").read_text(encoding="utf-8")))
                r = len(json.loads((f / "labels.json").read_text(encoding="utf-8"))) if (f / "labels.json").exists() else 0
                print(f"{f.name}   {n} flagged, {r} reviewed")


if __name__ == "__main__":
    main()
