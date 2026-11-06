#!/usr/bin/env node
"use strict";
/*
 * Salik for Stremio: an addon that wraps another addon's streams and plays them through FFmpeg with
 * Salik's library applied (mute, skip, blur). Works on any Stremio, including Samsung (Tizen) TVs.
 *
 *   node server.js            (PORT=7000 by default; see README.md)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const Core = require("../shared/filter-core.js");
const Cfg = require("./lib/config.js");
const Library = require("./lib/library.js");
const Subs = require("./lib/subtitles.js");
const { HlsService } = require("./lib/hls.js");
const pkg = require("./package.json");

const PORT = Number(process.env.PORT) || 7000;
const DATA_DIR = process.env.SALIK_DATA_DIR || path.join(__dirname, "data");
const SECRET = Cfg.loadSecret(DATA_DIR);
const MAX_STREAMS = 8;

function manifest(configured) {
    return {
        id: "com.techfek.salik",
        version: pkg.version,
        name: "Salik • سالك",
        description: "يشغّل الأفلام والحلقات اللي في مكتبة سالك بعد الفلترة: كتم الألفاظ، وتخطي وتغبيش المشاهد. محتاج addon مصدر بروابط مباشرة (http).",
        logo: "https://raw.githubusercontent.com/techFek/salik/main/images/icon128.png",
        resources: ["stream", "subtitles"],
        types: ["movie", "series"],
        idPrefixes: ["tt"],
        catalogs: [],
        behaviorHints: { configurable: true, configurationRequired: !configured }
    };
}

function publicBase(req) {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, "");
    const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() || (req.socket.encrypted ? "https" : "http");
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:" + PORT).split(",")[0].trim();
    return proto + "://" + host;
}

function send(res, status, body, type, extra) {
    res.writeHead(status, Object.assign({
        "Content-Type": type || "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
    }, extra || {}));
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function getJson(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
    } finally { clearTimeout(timer); }
}

async function getBuffer(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return Buffer.from(await r.arrayBuffer());
    } finally { clearTimeout(timer); }
}

const hls = new HlsService({
    cacheDir: path.join(DATA_DIR, "cache"),
    encodeOpts: { vcodec: process.env.FFMPEG_VCODEC || undefined, preset: process.env.FFMPEG_PRESET || undefined }
});

async function resolveForPayload(p) {
    const found = await Library.findByKey(p.k);
    if (!found) return null;
    return Object.assign(found, { settings: Cfg.filterSettings(Core, { groups: p.g }) });
}

/* ---------- routes ---------- */

async function streams(cfg, type, id, base) {
    const found = await Library.findByStremioId(id);
    if (!found || !cfg.src) return { streams: [] };
    let src;
    try { src = await getJson(cfg.src + "/stream/" + type + "/" + encodeURIComponent(id) + ".json"); }
    catch (e) { console.warn("[stream] source addon failed:", e.message); return { streams: [] }; }
    const out = [];
    for (const s of (src && Array.isArray(src.streams) ? src.streams : [])) {
        if (out.length >= MAX_STREAMS) break;
        if (!s || typeof s.url !== "string" || !/^https?:\/\//.test(s.url)) continue;
        const headers = s.behaviorHints && s.behaviorHints.proxyHeaders && s.behaviorHints.proxyHeaders.request;
        const token = Cfg.signToken(SECRET, { u: s.url, h: headers || undefined, k: found.key, g: cfg.groups, m: cfg.maxh });
        const label = [s.name, s.title || s.description].filter(Boolean).join(" • ").replace(/\s+/g, " ").slice(0, 160);
        out.push({
            name: "🛡️ سالك",
            title: "🛡️ " + (found.item.title || id) + "\n" + label,
            url: base + "/hls/" + token + "/index.m3u8",
            behaviorHints: { notWebReady: false, bingeGroup: "salik-" + cfg.maxh }
        });
    }
    return { streams: out, cacheMaxAge: 600 };
}

async function subtitles(cfg, type, id, extra, base) {
    const found = await Library.findByStremioId(id);
    if (!found || !cfg.subs) return { subtitles: [] };
    let list;
    try { list = await getJson(cfg.subs + "/subtitles/" + type + "/" + encodeURIComponent(id) + (extra ? "/" + extra : "") + ".json"); }
    catch (e) { console.warn("[subtitles] subtitles addon failed:", e.message); return { subtitles: [] }; }
    return {
        subtitles: (list && Array.isArray(list.subtitles) ? list.subtitles : []).filter((s) => s && /^https?:\/\//.test(s.url)).slice(0, 30).map((s, i) => ({
            id: "salik-" + (s.id || i),
            lang: s.lang,
            url: base + "/sub/" + Cfg.signToken(SECRET, { u: s.url, k: found.key, g: cfg.groups }) + ".vtt"
        })),
        cacheMaxAge: 3600
    };
}

function configurePage(base, cfg) {
    const c = cfg || Cfg.normalizeConfig({});
    const groupNames = { nudity: "المشاهد الحساسة", violence: "العنف", language: "الألفاظ", substance: "التعاطي" };
    const html = fs.readFileSync(path.join(__dirname, "configure.html"), "utf8")
        .replace("__BASE__", JSON.stringify(base))
        .replace("__CONFIG__", JSON.stringify(c))
        .replace("__GROUPS__", JSON.stringify(groupNames));
    return html;
}

async function handle(req, res) {
    const url = new URL(req.url, "http://x");
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const base = publicBase(req);
    if (req.method === "OPTIONS") return send(res, 204, "");

    if (parts.length === 0 || (parts.length === 1 && parts[0] === "configure")) return send(res, 200, configurePage(base, null), "text/html; charset=utf-8");
    if (parts.length === 1 && parts[0] === "manifest.json") return send(res, 200, manifest(false));
    if (parts[0] === "health") return send(res, 200, { ok: true, version: pkg.version });

    if (parts[0] === "hls" && parts.length >= 3) {
        const payload = Cfg.verifyToken(SECRET, parts[1]);
        if (!payload) return send(res, 403, { error: "bad link" });
        const job = await hls.job(payload, resolveForPayload);
        if (parts[2] === "index.m3u8") {
            return send(res, 200, hls.playlist(job, (i) => "seg/" + i + ".ts"), "application/vnd.apple.mpegurl", { "Cache-Control": "no-cache" });
        }
        if (parts[2] === "seg" && /^\d+\.ts$/.test(parts[3] || "")) {
            const file = await hls.segment(job, parseInt(parts[3], 10));
            const buf = fs.readFileSync(file);
            return send(res, 200, buf, "video/mp2t", { "Content-Length": buf.length, "Cache-Control": "max-age=86400" });
        }
        return send(res, 404, { error: "not found" });
    }

    if (parts[0] === "sub" && parts.length === 2 && parts[1].endsWith(".vtt")) {
        const payload = Cfg.verifyToken(SECRET, parts[1].slice(0, -4));
        if (!payload) return send(res, 403, "bad link", "text/plain");
        const found = await resolveForPayload(payload);
        if (!found) return send(res, 404, "not found", "text/plain");
        const buf = await getBuffer(payload.u);
        const censor = Subs.loadCensor(found.settings);
        return send(res, 200, Subs.filterSubtitle(buf, found.item, found.settings, found.offset, found.settings.language.enabled !== false ? censor : null), "text/vtt; charset=utf-8");
    }

    const cfg = Cfg.decodeConfig(parts[0]);
    if (!cfg) return send(res, 404, { error: "not found" });
    const rest = parts.slice(1);
    if (rest[0] === "configure") return send(res, 200, configurePage(base, cfg), "text/html; charset=utf-8");
    if (rest[0] === "manifest.json") return send(res, 200, manifest(!!cfg.src));
    if (rest[0] === "stream" && rest.length === 3) return send(res, 200, await streams(cfg, rest[1], rest[2].replace(/\.json$/, ""), base));
    if (rest[0] === "subtitles" && (rest.length === 3 || rest.length === 4)) {
        const id = (rest.length === 3 ? rest[2] : rest[2]).replace(/\.json$/, "");
        const extra = rest.length === 4 ? rest[3].replace(/\.json$/, "") : "";
        return send(res, 200, await subtitles(cfg, rest[1], id, extra, base));
    }
    return send(res, 404, { error: "not found" });
}

function createServer() {
    return http.createServer((req, res) => {
        handle(req, res).catch((e) => {
            console.error("[" + req.method + " " + req.url.slice(0, 80) + "]", e.message);
            if (!res.headersSent) send(res, e.status || 500, { error: e.message });
            else res.end();
        });
    });
}

if (require.main === module) {
    const server = createServer();
    server.listen(PORT, () => {
        console.log("Salik for Stremio " + pkg.version + " on http://localhost:" + PORT);
        console.log("Open http://localhost:" + PORT + "/configure through your https tunnel address to install it.");
    });
}

module.exports = { createServer, manifest, hls };
