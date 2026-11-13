"""Turns your reviews into better detection.

Every scan keeps a CLIP embedding for each frame. Frames of scenes you confirmed (✓) are positives for that category;
scenes you rejected (✗) are the hard negatives, and a sample of frames nothing was flagged in are ordinary negatives.
A small classifier per category is trained on those (seconds, on any PC) and saved to model/heads.joblib; the next
scans use it automatically. The confirmed images are also copied to dataset/ (one folder per category, yes/no) for
training a bigger model later.
"""
import csv
import json
import random
import shutil
from pathlib import Path

import numpy as np

from .categories import CATEGORIES
from .scan import SCANS, ROOT
from .visual import HEADS_FILE

MIN_EACH = 8


def collect():
    data = {c: {"X": [], "y": []} for c in CATEGORIES}
    rows = []
    rng = random.Random(7)
    for folder in sorted(SCANS.glob("*")):
        lf, sf, ef = folder / "labels.json", folder / "scenes.json", folder / "embeddings.npy"
        if not (lf.exists() and sf.exists() and ef.exists()):
            continue
        labels = json.loads(lf.read_text(encoding="utf-8"))
        if not labels:
            continue
        scenes = {str(s["id"]): s for s in json.loads(sf.read_text(encoding="utf-8"))}
        emb = np.load(ef)
        flagged = set()
        for sid, lab in labels.items():
            s = scenes.get(sid)
            if not s or s.get("source") != "visual":
                continue
            flagged.update(s["frames"])
            cat = lab.get("category") or s["category"]
            verdict = lab.get("verdict")
            if verdict not in ("yes", "no") or cat not in data:
                continue
            for i in s["frames"]:
                if i < len(emb):
                    data[cat]["X"].append(emb[i])
                    data[cat]["y"].append(1 if verdict == "yes" else 0)
                    rows.append((folder.name, i, cat, verdict))
            if verdict == "yes":  # a confirmed scene is a negative for the other categories
                for other in data:
                    if other != cat:
                        for i in s["frames"][:3]:
                            data[other]["X"].append(emb[i]); data[other]["y"].append(0)
        free = [i for i in range(len(emb)) if i not in flagged]
        for i in rng.sample(free, min(len(free), 30)):
            for c in data:
                data[c]["X"].append(emb[i]); data[c]["y"].append(0)
    return data, rows


def export_dataset(rows):
    out = ROOT / "dataset"
    n = 0
    out.mkdir(exist_ok=True)
    with open(out / "labels.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["scan", "frame", "category", "verdict", "image"])
        for scan, i, cat, verdict in rows:
            src = SCANS / scan / "frames" / f"f_{i + 1:06d}.jpg"
            if not src.exists():
                continue
            dst = out / cat / verdict / f"{scan}_{i + 1:06d}.jpg"
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists():
                shutil.copy2(src, dst)
            w.writerow([scan, i, cat, verdict, str(dst.relative_to(out))])
            n += 1
    return out, n


def run():
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import cross_val_score
    import joblib
    data, rows = collect()
    heads = {}
    for c, d in data.items():
        y = np.array(d["y"])
        pos, neg = int(y.sum()), int(len(y) - y.sum())
        if pos < MIN_EACH or neg < MIN_EACH:
            print(f"   {CATEGORIES[c]['ar']}: {pos} ✓ / {neg} ✗, need at least {MIN_EACH} of each — skipped")
            continue
        X = np.stack(d["X"])
        clf = LogisticRegression(C=2.0, class_weight="balanced", max_iter=3000)
        folds = min(5, pos, neg)
        acc = cross_val_score(clf, X, y, cv=folds, scoring="balanced_accuracy").mean() if folds >= 2 else float("nan")
        clf.fit(X, y)
        heads[c] = clf
        print(f"   {CATEGORIES[c]['ar']}: {pos} ✓ / {neg} ✗ → accuracy ≈ {acc:.0%}")
    if heads:
        HEADS_FILE.parent.mkdir(exist_ok=True)
        joblib.dump(heads, HEADS_FILE)
        print(f"✅ saved {HEADS_FILE} — the next scans use it.")
    else:
        print("Nothing trained yet: review more scenes first (✓ and ✗).")
    out, n = export_dataset(rows)
    print(f"📦 dataset: {n} labelled frames in {out}")
