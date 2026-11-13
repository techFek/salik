"""Scores frames for each category: CLIP zero-shot prompts, a dedicated NSFW model for sexual content, and, once
you have reviewed some scans, the small classifiers trained on your own confirmations (train.py)."""
from pathlib import Path

import numpy as np

from .categories import CATEGORIES, NEUTRAL_PROMPTS

CLIP_MODEL = "openai/clip-vit-base-patch32"
NSFW_MODEL = "Falconsai/nsfw_image_detection"
HEADS_FILE = Path(__file__).resolve().parent.parent / "model" / "heads.joblib"


def _feat(x):
    """transformers 4 returns a tensor, 5 returns an output whose pooler_output is the projected embedding."""
    return x if hasattr(x, "norm") else x.pooler_output


class Scorer:
    def __init__(self, device=None):
        import torch
        from transformers import CLIPModel, CLIPProcessor, AutoImageProcessor, AutoModelForImageClassification
        self.torch = torch
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        print(f"🧠 loading models on {self.device} (first run downloads them)…", flush=True)
        self.clip = CLIPModel.from_pretrained(CLIP_MODEL).to(self.device).eval()
        self.proc = CLIPProcessor.from_pretrained(CLIP_MODEL)
        self.nsfw = AutoModelForImageClassification.from_pretrained(NSFW_MODEL).to(self.device).eval()
        self.nsfw_proc = AutoImageProcessor.from_pretrained(NSFW_MODEL)
        self.nsfw_idx = {v.lower(): int(k) for k, v in self.nsfw.config.id2label.items()}.get("nsfw", 1)
        # text side once
        self.labels, prompts = [], []
        for cat, c in CATEGORIES.items():
            for p in c["prompts"]:
                self.labels.append(cat)
                prompts.append(p)
        for p in NEUTRAL_PROMPTS:
            self.labels.append("neutral")
            prompts.append(p)
        with torch.no_grad():
            t = self.proc(text=prompts, return_tensors="pt", padding=True).to(self.device)
            te = _feat(self.clip.get_text_features(**t))
            self.text = (te / te.norm(dim=-1, keepdim=True))
        self.heads = None
        if HEADS_FILE.exists():
            import joblib
            self.heads = joblib.load(HEADS_FILE)
            print(f"   using your trained classifiers for: {', '.join(self.heads)}", flush=True)

    def score(self, image_paths, batch=32):
        """Returns (scores: {category: np.array}, embeddings: np.array [n, 512])."""
        from PIL import Image
        torch = self.torch
        cats = list(CATEGORIES)
        out = {c: [] for c in cats}
        embs = []
        n = len(image_paths)
        for i in range(0, n, batch):
            imgs = [Image.open(p).convert("RGB") for p in image_paths[i:i + batch]]
            with torch.no_grad():
                px = self.proc(images=imgs, return_tensors="pt").to(self.device)
                ie = _feat(self.clip.get_image_features(**px))
                ie = ie / ie.norm(dim=-1, keepdim=True)
                logits = 100.0 * ie @ self.text.T
                probs = logits.softmax(dim=-1).cpu().numpy()
                nx = self.nsfw_proc(images=imgs, return_tensors="pt").to(self.device)
                nsfw = self.nsfw(**nx).logits.softmax(dim=-1)[:, self.nsfw_idx].cpu().numpy()
            embs.append(ie.cpu().numpy())
            for c in cats:
                idx = [j for j, l in enumerate(self.labels) if l == c]
                s = probs[:, idx].sum(axis=1)
                if c == "sexual":
                    # the dedicated NSFW model is far more reliable than CLIP prompts for this one
                    s = np.maximum(nsfw, s * 0.7)
                out[c].append(s)
            print(f"\r   frames {min(i + batch, n)}/{n}", end="", flush=True)
        print(flush=True)
        embs = np.concatenate(embs) if embs else np.zeros((0, 512), np.float32)
        scores = {c: np.concatenate(v) if v else np.zeros(0) for c, v in out.items()}
        if self.heads:
            for c, head in self.heads.items():
                if c in scores and len(embs):
                    learned = head.predict_proba(embs)[:, 1]
                    # your own reviewed examples outweigh the generic prompts
                    scores[c] = 0.3 * scores[c] + 0.7 * learned
        return scores, embs.astype(np.float32)


def scenes_from_scores(times, scores, threshold=0.35, gap=2.5, min_frames=1):
    """Groups flagged frames into scenes per category: [{category, start, end, peak, peak_index, frames}]."""
    out = []
    step = (times[1] - times[0]) if len(times) > 1 else 1.0
    for cat, s in scores.items():
        flagged = np.where(s >= threshold)[0]
        if not len(flagged):
            continue
        groups = [[flagged[0]]]
        for i in flagged[1:]:
            if times[i] - times[groups[-1][-1]] <= gap:
                groups[-1].append(i)
            else:
                groups.append([i])
        for g in groups:
            if len(g) < min_frames:
                continue
            peak = max(g, key=lambda i: s[i])
            out.append({"category": cat, "start": round(max(0.0, times[g[0]] - step / 2), 2),
                        "end": round(times[g[-1]] + step / 2, 2), "peak": float(round(s[peak], 3)),
                        "peak_index": int(peak), "frames": [int(i) for i in g], "source": "visual"})
    return out
