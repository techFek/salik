"""Bad language (and sexual / drug talk) from the audio: Whisper word timings + Salik's own word lists
(subtitle-censor-core.js in the repo root, the same lists the extension and app use)."""
import re
from pathlib import Path

LISTS_FILE = Path(__file__).resolve().parents[2] / "subtitle-censor-core.js"
LIST_TO_LABEL = {"profanity": "language", "insults": "language", "youtubeExtra": "language",
                 "explicit": "speech_sexual", "substance": "speech_substance"}
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
        label = match_word(t, single)
        if label:
            hits.append((i, i, label))
    out = []
    for a, b, label in sorted(hits):
        out.append({"category": label, "start": round(max(0, words[a]["start"] - pad), 2), "end": round(words[b]["end"] + pad, 2),
                    "word": " ".join(w["w"] for w in words[a:b + 1]), "line": words[a]["line"], "source": "speech"})
    return out
