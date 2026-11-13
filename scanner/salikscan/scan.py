"""One scan: download -> frames -> visual scores -> speech -> scenes.json in scans/<date>-<title>/"""
import json
import shutil
import time
from datetime import datetime
from pathlib import Path

import numpy as np

from . import media
from .categories import CATEGORIES

ROOT = Path(__file__).resolve().parent.parent
SCANS = ROOT / "scans"


def run(source, every=1.0, threshold=0.35, whisper="small", language=None, speech=True, extra_words=()):
    t0 = time.time()
    tmp = SCANS / f"_incoming-{int(t0)}"
    video, info = media.fetch(source, tmp)
    folder = SCANS / f"{datetime.now():%Y-%m-%d_%H%M}-{media.slug(info['title'])}"
    folder.mkdir(parents=True, exist_ok=True)
    if video.parent == tmp:
        target = folder / ("video" + video.suffix)
        shutil.move(str(video), target)
        video = target
        shutil.rmtree(tmp, ignore_errors=True)
    else:
        shutil.rmtree(tmp, ignore_errors=True)
    info.update({"video": video.name if video.parent == folder else str(video), "created": datetime.now().isoformat(timespec="seconds"),
                 "every": every, "threshold": threshold})

    frames = media.extract_frames(video, folder / "frames", every=every)
    times = np.array([t for _, t in frames])
    from .visual import Scorer, scenes_from_scores
    scorer = Scorer()
    scores, embs = scorer.score([p for p, _ in frames])
    np.save(folder / "embeddings.npy", embs)
    np.savez_compressed(folder / "scores.npz", times=times, **scores)
    scenes = scenes_from_scores(times, scores, threshold=threshold)
    for s in scenes:
        s["image"] = f"frames/{frames[s['peak_index']][0].name}"
        s["strip"] = [f"frames/{frames[i][0].name}" for i in pick(s["frames"], 5)]

    if speech:
        from . import speech as sp
        wav = folder / "audio.wav"
        media.extract_audio(video, wav)
        words, lang = sp.transcribe(wav, whisper, language)
        info["language"] = lang
        (folder / "transcript.json").write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
        for h in sp.find_bad_words(words, sp.load_lists(extra_words)):
            i = int(np.clip(np.searchsorted(times, (h["start"] + h["end"]) / 2), 0, len(frames) - 1)) if len(frames) else 0
            h["image"] = f"frames/{frames[i][0].name}" if frames else ""
            h["frames"] = [i]
            scenes.append(h)
        wav.unlink(missing_ok=True)

    scenes.sort(key=lambda s: (s["start"], s["category"]))
    for n, s in enumerate(scenes, 1):
        s["id"] = n
    info["seconds"] = round(time.time() - t0)
    (folder / "info.json").write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    (folder / "scenes.json").write_text(json.dumps(scenes, ensure_ascii=False, indent=1), encoding="utf-8")
    if not (folder / "labels.json").exists():
        (folder / "labels.json").write_text("{}", encoding="utf-8")
    summary(folder, scenes)
    return folder


def pick(items, k):
    if len(items) <= k:
        return items
    return [items[round(i * (len(items) - 1) / (k - 1))] for i in range(k)]


def summary(folder, scenes):
    from .categories import ALL_LABELS
    counts = {}
    for s in scenes:
        counts[s["category"]] = counts.get(s["category"], 0) + 1
    print(f"\n✅ done: {folder}")
    for k, v in ALL_LABELS.items():
        if counts.get(k):
            print(f"   {v}: {counts[k]}")
    if not scenes:
        print("   nothing flagged")


def latest():
    scans = sorted(p for p in SCANS.glob("*") if p.is_dir() and not p.name.startswith("_"))
    return scans[-1] if scans else None
