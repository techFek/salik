"""Getting the video: a YouTube (or any yt-dlp) link, or a local file. Frames and audio come out through FFmpeg."""
import json
import os
import re
import shutil
import subprocess
from pathlib import Path


def need(tool):
    if not shutil.which(tool):
        raise SystemExit(f"'{tool}' is not installed or not on PATH. See scanner/README.md (install-windows.bat installs it).")


def slug(text):
    s = re.sub(r"[^\w؀-ۿ-]+", "-", text, flags=re.UNICODE).strip("-")
    return (s or "video")[:60]


def fetch(source, out_dir: Path):
    """Returns (video_path, info). `source` is a URL or a file path."""
    out_dir.mkdir(parents=True, exist_ok=True)
    if os.path.exists(source):
        p = Path(source)
        return p, {"title": p.stem, "source": str(p.resolve()), "duration": probe_duration(p)}
    need("yt-dlp")
    need("ffmpeg")
    js = []
    for rt in ("deno", "node"):
        if shutil.which(rt):
            js = ["--js-runtimes", rt]
            break
    cmd = ["yt-dlp", *js, "--no-playlist", "-f", "bv*[height<=480]+ba/b[height<=480]/bv*+ba/b",
           "--merge-output-format", "mp4", "-o", str(out_dir / "video.%(ext)s"), "--write-info-json", source]
    print("⬇  downloading…", flush=True)
    subprocess.run(cmd, check=True)
    video = next(p for p in out_dir.iterdir() if p.name.startswith("video.") and p.suffix != ".json")
    info_file = out_dir / "video.info.json"
    meta = json.loads(info_file.read_text(encoding="utf-8")) if info_file.exists() else {}
    info = {"title": meta.get("title") or video.stem, "source": source, "duration": meta.get("duration") or probe_duration(video),
            "uploader": meta.get("uploader"), "id": meta.get("id")}
    if info_file.exists():
        info_file.unlink()
    return video, info


def probe_duration(path):
    need("ffprobe")
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def extract_frames(video, frames_dir: Path, every=1.0, width=384):
    """One JPEG every `every` seconds; frame i is at i*every seconds."""
    need("ffmpeg")
    frames_dir.mkdir(parents=True, exist_ok=True)
    print("🖼  extracting frames…", flush=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf", f"fps=1/{every},scale={width}:-2",
                    "-q:v", "4", str(frames_dir / "f_%06d.jpg")], check=True)
    files = sorted(frames_dir.glob("f_*.jpg"))
    # ffmpeg's fps filter centres samples; frame n (1-based) shows time (n-1)*every + every/2
    return [(f, (i + 0.5) * every) for i, f in enumerate(files)]


def extract_audio(video, wav: Path):
    need("ffmpeg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(wav)], check=True)
    return wav
