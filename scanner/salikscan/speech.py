"""Bad language (and sexual / drug talk) from the audio: Whisper word timings + Salik's own word lists
(subtitle-censor-core.js in the repo root, the same lists the extension and app use)."""
import re
from pathlib import Path

LISTS_FILE = Path(__file__).resolve().parents[2] / "subtitle-censor-core.js"
LIST_TO_LABEL = {"profanity": "language", "insults": "language", "youtubeExtra": "language",
                 "explicit": "language", "substance": "speech_substance"}
PROCLITICS = ["بال", "كال", "فال", "وال", "ال", "و", "ف", "ب", "ل", "ك"]
SUFFIXES = ["ين", "ون", "ات", "ها", "هم", "كم", "نا", "ه", "ة", "ك", "ي", "s", "es", "ed", "ing", "in", "er", "ers"]


def norm(w):
    w = w.lower()
    w = re.sub(r"[ً-ٰٟۖ-ۭـ]", "", w)
    w = re.sub(r"[إأآٱ]", "ا", w).replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"[^\w']", "", w).strip("'")


def load_lists(extra_words=()):
    """{normalized word or phrase: label}"""
    text = LISTS_FILE.read_text(encoding="utf-8")
    words = {}
    for name, label in LIST_TO_LABEL.items():
        m = re.search(name + r"\s*:\s*\[(.*?)\]", text, re.S)
        if not m:
            continue
        for item in re.findall(r'"([^"]+)"', m.group(1)):
            k = " ".join(norm(x) for x in item.split())
            if k:
                words.setdefault(k, label)
    for w in extra_words:
        words[" ".join(norm(x) for x in w.split())] = "language"
    return words


def match_word(token, single):
    if token in single:
        return single[token]
    for p in PROCLITICS:
        if token.startswith(p) and len(token) - len(p) >= 2 and token[len(p):] in single:
            return single[token[len(p):]]
    for s in SUFFIXES:
        if token.endswith(s) and len(token) - len(s) >= 3 and token[:-len(s)] in single:
            return single[token[:-len(s)]]
    return None


def from_youtube_captions(json3_path):
    """Words with times from YouTube's json3 captions. Automatic captions give each word's start
    (tStartMs + tOffsetMs); a word ends where the next one starts, capped so pauses aren't counted."""
    import json
    d = json.loads(Path(json3_path).read_text(encoding="utf-8"))
    raw = []
    for ev in d.get("events", []):
        segs = ev.get("segs")
        if not segs or "tStartMs" not in ev:
            continue
        start = ev["tStartMs"] / 1000
        line_end = start + ev.get("dDurationMs", 0) / 1000
        line = "".join(s.get("utf8", "") for s in segs).replace("\n", " ").strip()
        timed = any("tOffsetMs" in s for s in segs)
        if not timed:  # manual captions: one time per line, words spread by length
            words = line.split()
            total = sum(len(w) for w in words) or 1
            t = start
            for w in words:
                dur = (line_end - start) * len(w) / total
                raw.append({"w": w, "start": t, "end": t + dur, "line": line, "exact": False})
                t += dur
            continue
        for s in segs:
            w = s.get("utf8", "").strip()
            if w:
                raw.append({"w": w, "start": start + s.get("tOffsetMs", 0) / 1000, "end": None, "line": line, "line_end": line_end, "exact": True})
    raw.sort(key=lambda x: x["start"])
    for i, w in enumerate(raw):
        if w["end"] is None:
            nxt = raw[i + 1]["start"] if i + 1 < len(raw) else w["start"] + 0.6
            cap = w["start"] + max(0.25, min(0.9, 0.08 * len(w["w"]) + 0.15))
            w["end"] = max(w["start"] + 0.15, min(nxt, cap, w.get("line_end") or nxt))
        w["start"], w["end"] = round(w["start"], 2), round(w["end"], 2)
        w.pop("line_end", None)
    return raw


def caption_language(json3_path):
    m = re.search(r"\.([a-zA-Z-]+)\.json3$", str(json3_path))
    return m.group(1) if m else ""


def transcribe(wav, model_size="small", language=None):
    from faster_whisper import WhisperModel
    print(f"🎧 listening to the audio (Whisper {model_size})…", flush=True)
    m = WhisperModel(model_size, device="auto", compute_type="int8")
    segs, info = m.transcribe(str(wav), language=language, word_timestamps=True, vad_filter=True,
                              condition_on_previous_text=False)
    words = []
    for s in segs:
        for w in s.words:
            words.append({"w": w.word.strip(), "start": round(w.start, 2), "end": round(w.end, 2), "line": s.text.strip()})
        print(f"\r   {int(s.end)} s heard", end="", flush=True)
    print(flush=True)
    return words, info.language


def find_bad_words(words, lists, pad=0.05):
    single = {k: v for k, v in lists.items() if " " not in k}
    phrases = [(k.split(), v) for k, v in lists.items() if " " in k]
    toks = [norm(w["w"]) for w in words]
    hits, used = [], set()
    for parts, label in phrases:
        n = len(parts)
        for i in range(len(toks) - n + 1):
            if toks[i:i + n] == parts and not used.intersection(range(i, i + n)):
                used.update(range(i, i + n))
                hits.append((i, i + n - 1, label))
    for i, t in enumerate(toks):
        if i in used or not t:
            continue
        # YouTube's automatic captions write swear words as "[ __ ]"
        label = "language" if set(t) == {"_"} else match_word(t, single)
        if label:
            hits.append((i, i, label))
    out = []
    for a, b, label in sorted(hits):
        out.append({"category": label, "start": round(max(0, words[a]["start"] - pad), 2), "end": round(words[b]["end"] + pad, 2),
                    "word": " ".join(w["w"] for w in words[a:b + 1]), "line": words[a]["line"], "source": "speech"})
    return out
