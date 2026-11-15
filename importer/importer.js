/*
 * Salik importer: turns scene timings from other projects into Salik's format.
 *
 *   parseMCF(text, meta)        MovieContentFilter (.mcf, WebVTT-based)   https://www.moviecontentfilter.com/specification
 *   parseVideoSkip(text, meta)  VideoSkip skip files (.skp)                https://videoskip.herokuapp.com/exchange/howto/edit
 *   SkipitAdapter               placeholder, disabled until Skipit's developer gives permission
 *
 * Every parser returns the same "unified" import (see makeUnified). toSalikFilters / mergeIntoItem then write it
 * into a library item (library/<key>.json). Imported scenes are verified:false: apps only use them when the
 * viewer turns on "unreviewed community timings", until someone reviews them (importer/review.html).
 *
 * Parsers only read text you give them (files you downloaded yourself); nothing here fetches or scrapes a site.
 * Plain ES module, no dependencies: runs in Node (CLI, tests) and in the browser (review page).
 */

export const CATEGORIES = ["sex", "nudity", "violence", "gore", "profanity", "drugs", "other"];
export const SEVERITIES = ["low", "medium", "high"];
export const ACTIONS = ["skip", "mute", "blur"];
export const SOURCES = ["mcf", "videoskip", "skipit", "manual"];

/* ---------- category mapping ---------- */

/* MovieContentFilter: every category (and its parent) -> Salik category. Spec 1.1.0. */
export const MCF_CATEGORY_MAP = (() => {
    const groups = {
        sex: ["sex", "adultery", "analSex", "coitus", "kissing", "masturbation", "objectification", "oralSex", "premaritalSex", "promiscuity", "prostitution"],
        nudity: ["nudity", "bareButtocks", "exposedGenitalia", "fullNudity", "toplessness"],
        violence: ["violence", "choking", "crueltyToAnimals", "culturalViolence", "desecration", "emotionalViolence", "kicking", "massacre",
            "murder", "punching", "rape", "slapping", "slavery", "stabbing", "torture", "warfare", "weapons"],
        profanity: ["language", "blasphemy", "nameCalling", "swearing", "vulgarity"],
        drugs: ["drugs", "alcohol", "antipsychotics", "cigarettes", "depressants", "hallucinogens", "stimulants"],
        gore: ["hemophobia", "emetophobia"],
        other: ["commercial", "advertBreak", "consumerism", "productPlacement",
            "discrimination", "adultism", "antisemitism", "genderism", "homophobia", "misandry", "misogyny", "racism", "sexism", "supremacism", "transphobia", "xenophobia",
            "dispensable", "idiocy", "tedious", "gambling",
            "fear", "accident", "acrophobia", "aliens", "arachnophobia", "astraphobia", "aviophobia", "chemophobia", "claustrophobia", "coulrophobia",
            "cynophobia", "death", "dentophobia", "enochlophobia", "explosion", "fire", "gerascophobia", "ghosts", "grave", "hylophobia",
            "melissophobia", "misophonia", "musophobia", "mysophobia", "nosocomephobia", "nyctophobia", "siderodromophobia", "thalassophobia", "vampires"]
    };
    const map = {};
    for (const [cat, names] of Object.entries(groups)) for (const n of names) map[n] = cat;
    map.sexualDialogue = "sex"; // spoken: muted, see actionFor
    return map;
})();

/*
 * VideoSkip: one label per skip, the IMDb Parents Guide sections ("sex", "violence", "profanity", "alcohol", "frightening"…).
 * VideoSkip accepts the first three letters, so the match is on the prefix.
 */
export const VIDEOSKIP_CATEGORY_MAP = [
    ["nud", "nudity"], ["nak", "nudity"],
    ["sex", "sex"], ["kis", "sex"],
    ["gor", "gore"], ["blo", "gore"],
    ["vio", "violence"], ["fig", "violence"], ["gun", "violence"], ["kil", "violence"],
    ["pro", "profanity"], ["cur", "profanity"], ["swe", "profanity"], ["lan", "profanity"], ["wor", "profanity"], ["bla", "profanity"],
    ["alc", "drugs"], ["dru", "drugs"], ["smo", "drugs"], ["cig", "drugs"], ["sub", "drugs"],
    ["fri", "other"], ["int", "other"], ["sca", "other"], ["oth", "other"]
];

export function videoSkipCategory(label) {
    const l = String(label || "").toLowerCase();
    for (const [prefix, cat] of VIDEOSKIP_CATEGORY_MAP) if (l.startsWith(prefix)) return cat;
    return "other";
}

/* Salik category -> library "category" (shared/filter-core.js groups); "other" has no group and is not exported. */
export const SALIK_LIBRARY_CATEGORY = {
    sex: "nudity", nudity: "nudity", violence: "violence", gore: "violence", profanity: "language", drugs: "substance abuse"
};

/* What hides it: sound only -> mute; picture only -> blur; both -> skip. */
export function actionFor(channel) {
    if (channel === "audio") return "mute";
    if (channel === "video") return "blur";
    return "skip";
}

/* ---------- time ---------- */

/* "01:02:03.5", "1:02:03,500", "02:03.5", "75.2" -> seconds */
export function parseTime(s) {
    const t = String(s).trim().replace(",", ".");
    if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return NaN;
    return t.split(":").reduce((acc, part) => acc * 60 + parseFloat(part), 0);
}

const round2 = (n) => Math.round(n * 100) / 100;

/* ---------- unified import ---------- */

export function makeUnified(meta = {}) {
    return {
        imdb: normalizeImdb(meta.imdb) || null,
        season: meta.season != null && meta.season !== "" ? Number(meta.season) : null,
        episode: meta.episode != null && meta.episode !== "" ? Number(meta.episode) : null,
        source: meta.source || "manual",
        platformVersion: meta.platformVersion || "unknown",
        runtimeSec: meta.runtimeSec != null && meta.runtimeSec !== "" ? Number(meta.runtimeSec) : null,
        reference: meta.reference || null,   // {time, desc}: a moment to sync on (MCF START, VideoSkip screenshot)
        attribution: meta.attribution || null,
        title: meta.title || null,
        segments: []
    };
}

export function normalizeImdb(v) {
    const m = String(v || "").match(/tt\d{6,10}/);
    return m ? m[0] : null;
}

/* Problems that make an import unusable (empty list = OK). */
export function validateUnified(u) {
    const errors = [];
    if (!u || typeof u !== "object") return ["not an object"];
    if (u.imdb !== null && !/^tt\d{6,10}$/.test(u.imdb || "")) errors.push("imdb must look like tt1234567");
    if (!SOURCES.includes(u.source)) errors.push(`source must be one of ${SOURCES.join(", ")}`);
    if (u.runtimeSec !== null && !(u.runtimeSec > 0)) errors.push("runtimeSec must be a positive number");
    (u.segments || []).forEach((s, i) => {
        const at = `segment ${i + 1}`;
        if (!(s.start >= 0) || !(s.end > s.start)) errors.push(`${at}: needs 0 <= start < end`);
        if (!CATEGORIES.includes(s.category)) errors.push(`${at}: unknown category ${s.category}`);
        if (!SEVERITIES.includes(s.severity)) errors.push(`${at}: unknown severity ${s.severity}`);
        if (!ACTIONS.includes(s.action)) errors.push(`${at}: unknown action ${s.action}`);
    });
    return errors;
}

/* ---------- MovieContentFilter ---------- */

export function parseMCF(text, meta = {}) {
    const lines = String(text).replace(/^﻿/, "").replace(/\r/g, "").split("\n");
    if (!/^WEBVTT\b/.test(lines[0] || "")) throw new Error("Not a MovieContentFilter file (first line must start with WEBVTT)");
    const u = makeUnified({ ...meta, source: "mcf" });
    const info = {};
    const warnings = [];
    let i = 1;
    while (i < lines.length) {
        const line = lines[i];
        const cue = line.match(/^\s*(\S+)\s+-->\s+(\S+)/);
        if (cue) {
            const start = parseTime(cue[1]), end = parseTime(cue[2]);
            i++;
            const spans = [];
            while (i < lines.length && lines[i].trim() !== "") spans.push(lines[i++]);
            if (!(end > start)) { warnings.push(`line ${i}: bad cue time ${line.trim()}`); continue; }
            for (const raw of spans) {
                const [body, ...comment] = raw.split(" # ");
                const [cat, severity = "medium", channel = "both"] = body.trim().split("=");
                const category = MCF_CATEGORY_MAP[cat];
                if (!category) { warnings.push(`unknown MCF category "${cat}" at ${cue[1]}`); continue; }
                const ch = cat === "sexualDialogue" ? "audio" : channel;
                u.segments.push({
                    start: round2(start), end: round2(end), category,
                    severity: SEVERITIES.includes(severity) ? severity : "medium",
                    action: category === "profanity" ? "mute" : actionFor(ch),
                    verified: false,
                    note: [cat, comment.join(" # ").trim()].filter(Boolean).join(": ")
                });
            }
            continue;
        }
        const kv = line.match(/^(TITLE|YEAR|TYPE|SEASON|EPISODE|SOURCE|IMDB|RELEASE|COMMENT|START|END)\s+(.*)$/);
        if (kv) info[kv[1]] = kv[2].trim();
        i++;
    }
    if (!u.imdb) u.imdb = normalizeImdb(info.IMDB);
    if (u.season == null && info.SEASON) u.season = Number(info.SEASON);
    if (u.episode == null && info.EPISODE) u.episode = Number(info.EPISODE);
    if (!u.title && info.TITLE) u.title = info.TITLE;
    if (!u.reference && info.START) u.reference = { time: round2(parseTime(info.START)), desc: "Start of the film itself (after the opening logos)" };
    u.mcf = { start: info.START ? parseTime(info.START) : null, end: info.END ? parseTime(info.END) : null, release: info.RELEASE || null, sourceUrl: info.SOURCE || null };
    u.attribution = u.attribution || {
        source: "MovieContentFilter", url: info.SOURCE || "https://www.moviecontentfilter.com/",
        license: meta.license || "unknown — check the source before publishing", importedAt: new Date().toISOString().slice(0, 10)
    };
    u.segments.sort((a, b) => a.start - b.start);
    u.warnings = warnings;
    return u;
}

/* ---------- VideoSkip ---------- */

const VS_MUTE = ["audio", "word", "speech", "sound"];
const VS_BLANK = ["video", "image", "blank", "img"];

export function parseVideoSkip(text, meta = {}) {
    const blocks = String(text).replace(/^﻿/, "").replace(/\r/g, "").split(/\n\s*\n/);
    const u = makeUnified({ ...meta, source: "videoskip" });
    const warnings = [];
    for (const block of blocks) {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (!lines.length) continue;
        const cue = lines[0].match(/^(\S+)\s*-->\s*(\S+)\s*(.*)$/);
        if (!cue) {
            // screenshot entry: a time with its description under it -> sync reference
            const t = parseTime(lines[0]);
            if (!isNaN(t) && !u.reference) {
                u.reference = { time: round2(t), desc: (lines.slice(1).find((l) => !/^data:image/.test(l)) || "VideoSkip screenshot").slice(0, 200) };
            }
            continue;
        }
        const start = parseTime(cue[1]), end = parseTime(cue[2]);
        if (!(end > start)) { warnings.push(`bad skip time ${lines[0]}`); continue; }
        // label may be on the same line (as in VideoSkip's own example) or on the next one
        const labelLine = (cue[3] || lines[1] || "").trim();
        const note = (labelLine.match(/\(([^)]*)\)/) || [])[1] || "";
        const blur = labelLine.match(/\[([\d.\s,]+)\]/);
        const words = labelLine.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ").toLowerCase().split(/\s+/).filter(Boolean);
        const label = words.find((w) => !/^\d$/.test(w) && !VS_MUTE.includes(w) && !VS_BLANK.includes(w) && w !== "blur") || "other";
        const level = Number(words.find((w) => /^[123]$/.test(w)) || 1);
        const category = videoSkipCategory(label);
        let action = "skip";
        if (words.some((w) => VS_MUTE.includes(w))) action = "mute";
        else if (words.includes("blur") || words.some((w) => VS_BLANK.includes(w))) action = "blur";
        else if (category === "profanity") action = "mute";
        const seg = {
            start: round2(start), end: round2(end), category,
            severity: ["low", "medium", "high"][Math.min(3, Math.max(1, level)) - 1],
            action, verified: false, note: [label, note].filter(Boolean).join(": ")
        };
        if (blur) seg.blurBox = blur[1].trim().split(/[\s,]+/).map(Number);
        u.segments.push(seg);
    }
    // VideoSkip keeps the screenshot as a data URL in its own block near the end of the file
    const shot = String(text).match(/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/m);
    if (shot && u.reference) u.reference.image = shot[0];   // shown on the review page, not stored in the library
    u.attribution = u.attribution || {
        source: "VideoSkip exchange", url: meta.sourceUrl || "https://videoskip.herokuapp.com/exchange",
        license: meta.license || "unknown — check the source before publishing", importedAt: new Date().toISOString().slice(0, 10)
    };
    u.segments.sort((a, b) => a.start - b.start);
    u.warnings = warnings;
    return u;
}

/* ---------- Skipit (disabled) ---------- */

/*
 * Interface only. Skipit (getskipit.com) data is not used until its developer agrees; then fill in parse() for
 * whatever format they share, and flip ENABLED.
 */
export const SkipitAdapter = {
    id: "skipit",
    ENABLED: false,
    name: "Skipit",
    url: "https://getskipit.com/",
    parse(/* text, meta */) {
        throw new Error("Skipit import is disabled until Skipit's developer gives permission.");
    }
};

export const ADAPTERS = {
    mcf: { id: "mcf", name: "MovieContentFilter", ENABLED: true, parse: parseMCF, extensions: [".mcf", ".txt", ".vtt"] },
    videoskip: { id: "videoskip", name: "VideoSkip", ENABLED: true, parse: parseVideoSkip, extensions: [".skp", ".txt"] },
    skipit: SkipitAdapter
};

/* Picks the parser from the file name / first line. */
export function detectFormat(text, fileName = "") {
    if (/\.skp$/i.test(fileName)) return "videoskip";
    if (/^﻿?WEBVTT/.test(String(text))) return "mcf";
    return "videoskip";
}

/* ---------- into the Salik library ---------- */

/* Shift all times (e.g. after syncing an import made on another release). */
export function shiftUnified(u, seconds) {
    return { ...u, segments: u.segments.map((s) => ({ ...s, start: round2(Math.max(0, s.start + seconds)), end: round2(Math.max(0, s.end + seconds)) })),
        reference: u.reference ? { ...u.reference, time: round2(u.reference.time + seconds) } : null };
}

/* Unified segments -> library filters. "other" has no Salik group and is left out. */
export function toSalikFilters(u, { startId = 1 } = {}) {
    let id = startId;
    const out = [];
    for (const s of u.segments) {
        const category = SALIK_LIBRARY_CATEGORY[s.category];
        if (!category) continue;
        const f = {
            id: id++, start: s.start, end: s.end, category,
            original_description: s.note || s.category,
            action_type: s.action,
            severity: s.severity, source: u.source, verified: s.verified === true
        };
        out.push(f);
    }
    return out;
}

/*
 * Adds an import to a library item (a copy is returned). Existing filters are kept; imported ones that overlap an
 * existing filter of the same category are dropped as duplicates. Sync data and attribution are recorded on the item.
 */
export function mergeIntoItem(item, u, { title } = {}) {
    const out = JSON.parse(JSON.stringify(item || {}));
    if (!out.title) out.title = title || u.title || u.imdb || "Untitled";
    if (!out.type) out.type = u.episode != null ? "episode" : "movie";
    if (u.season != null) out.season = u.season;
    if (u.episode != null) out.episode = u.episode;
    out.filters = Array.isArray(out.filters) ? out.filters : [];
    out.platforms = out.platforms || {};
    if (u.imdb && !out.platforms.stremio) out.platforms.stremio = { id: u.imdb, url: `https://web.stremio.com/#/detail/${out.type === "episode" ? "series" : "movie"}/${u.imdb}/${u.imdb}` };
    const nextId = out.filters.reduce((m, f) => Math.max(m, Number(f.id) || 0), 0) + 1;
    const overlaps = (a, b) => a.start < b.end && b.start < a.end;
    const added = toSalikFilters(u, { startId: nextId }).filter((f) => !out.filters.some((g) => g.category === f.category && overlaps(f, g)));
    out.filters = out.filters.concat(added).sort((a, b) => a.start - b.start);
    if (u.runtimeSec && !(out.sync && out.sync.runtimeSec)) {
        const ref = u.reference ? { time: u.reference.time, desc: u.reference.desc } : null;
        out.sync = { runtimeSec: u.runtimeSec, platformVersion: u.platformVersion, ...(ref ? { reference: ref } : {}) };
    }
    if (u.attribution) {
        out.attribution = Array.isArray(out.attribution) ? out.attribution : [];
        if (!out.attribution.some((a) => a.source === u.attribution.source && a.url === u.attribution.url)) out.attribution.push(u.attribution);
    }
    return { item: out, added: added.length, skipped: toSalikFilters(u).length - added.length };
}

/* Finds the library key of an IMDb id (platforms.stremio.id, or imdb on the item). */
export function findKeyByImdb(library, imdb, season = null, episode = null) {
    for (const [key, it] of Object.entries(library || {})) {
        if (!it || typeof it !== "object") continue;
        const id = it.imdb || (it.platforms && it.platforms.stremio && it.platforms.stremio.id) || "";
        if (!String(id).startsWith(imdb)) continue;
        if (season == null) { if (it.type !== "episode") return key; continue; }
        if (Number(it.season) === season && Number(it.episode) === episode) return key;
    }
    return null;
}
