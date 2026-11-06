"use strict";
/* Salik's library from GitHub (same file the app and the extension use), checked before use, cached. */
const fs = require("fs");
const path = require("path");
const Core = require(path.join(__dirname, "..", "..", "shared", "filter-core.js"));

const LIBRARY_URL = process.env.SALIK_LIBRARY_URL || "https://raw.githubusercontent.com/techFek/salik/main/library.json";
const LOCAL_COPY = path.join(__dirname, "..", "..", "library.json");
const TTL_MS = 30 * 60 * 1000;

let cache = null;
let inflight = null;

function quiet(fn) {
    const w = console.warn; console.warn = () => {};
    try { return fn(); } finally { console.warn = w; }
}

async function fetchOnline() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
        const res = await fetch(LIBRARY_URL, { signal: ctrl.signal, headers: { "cache-control": "no-cache" } });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const lib = await res.json();
        const v = quiet(() => Core.validateLibrary(lib));
        if (!v.ok) throw new Error("library rejected: " + v.errors.slice(0, 3).join("; "));
        return lib;
    } finally { clearTimeout(timer); }
}

function loadLocal() {
    try { return JSON.parse(fs.readFileSync(LOCAL_COPY, "utf8")); } catch (e) { return {}; }
}

async function getLibrary() {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.lib;
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const lib = await fetchOnline();
            cache = { at: Date.now(), lib, source: "online" };
        } catch (e) {
            console.warn("[library] online copy unavailable (" + e.message + "), using " + (cache ? "the last good copy" : "the local library.json"));
            if (!cache) cache = { at: Date.now(), lib: loadLocal(), source: "local" };
            else cache.at = Date.now() - TTL_MS + 5 * 60 * 1000;
        } finally { inflight = null; }
        return cache.lib;
    })();
    return inflight;
}

/* The library item for a Stremio id ("tt1375666" for a film, "tt1442464:1:12" for an episode). */
async function findByStremioId(id) {
    const lib = await getLibrary();
    const item = quiet(() => Core.findLibraryItem(lib, id, "stremio"));
    if (!item) return null;
    const st = (item.platforms && (item.platforms.stremio || item.platforms.Stremio)) || {};
    return { key: item._libraryKey, item, offset: Number(st.offset_seconds) || 0 };
}

async function findByKey(key) {
    const lib = await getLibrary();
    const item = lib[key];
    if (!item) return null;
    const st = (item.platforms && (item.platforms.stremio || item.platforms.Stremio)) || {};
    return { key, item, offset: Number(st.offset_seconds) || 0 };
}

module.exports = { getLibrary, findByStremioId, findByKey, LIBRARY_URL };
