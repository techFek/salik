"use strict";
/* User settings travel inside the addon URL (Stremio's way); play links are signed so the server is not an open proxy. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const GROUPS = ["nudity", "violence", "language", "substance"];

function b64urlEncode(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64urlDecode(s) { return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64"); }

function normalizeConfig(raw) {
    const c = raw && typeof raw === "object" ? raw : {};
    const src = typeof c.src === "string" ? c.src.trim().replace(/\/manifest\.json$/, "").replace(/\/+$/, "") : "";
    const subs = typeof c.subs === "string" ? c.subs.trim().replace(/\/manifest\.json$/, "").replace(/\/+$/, "") : "";
    const groups = {};
    for (const g of GROUPS) groups[g] = !(c.groups && c.groups[g] === false);
    const maxh = [480, 720, 1080].includes(Number(c.maxh)) ? Number(c.maxh) : 1080;
    return { src: /^https?:\/\//.test(src) ? src : "", subs: /^https?:\/\//.test(subs) ? subs : "", groups, maxh };
}

function encodeConfig(c) { return b64urlEncode(JSON.stringify(normalizeConfig(c))); }

function decodeConfig(s) {
    try { return normalizeConfig(JSON.parse(b64urlDecode(s).toString("utf8"))); } catch (e) { return null; }
}

/* Filter settings in SalikFilterCore's shape, from the group switches. */
function filterSettings(Core, c) {
    const s = Core.buildDefaultSettings();
    for (const g of GROUPS) if (s[g]) s[g].enabled = c.groups[g] !== false;
    return s;
}

function loadSecret(dataDir) {
    const f = path.join(dataDir, "secret.key");
    try { const k = fs.readFileSync(f, "utf8").trim(); if (k.length >= 32) return k; } catch (e) {}
    const k = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(f, k, { mode: 0o600 });
    return k;
}

function signToken(secret, payload) {
    const body = b64urlEncode(JSON.stringify(payload));
    const mac = b64urlEncode(crypto.createHmac("sha256", secret).update(body).digest()).slice(0, 22);
    return body + "." + mac;
}

function verifyToken(secret, token) {
    const [body, mac] = String(token || "").split(".");
    if (!body || !mac) return null;
    const want = b64urlEncode(crypto.createHmac("sha256", secret).update(body).digest()).slice(0, 22);
    if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
    try { return JSON.parse(b64urlDecode(body).toString("utf8")); } catch (e) { return null; }
}

module.exports = { GROUPS, normalizeConfig, encodeConfig, decodeConfig, filterSettings, loadSecret, signToken, verifyToken };
