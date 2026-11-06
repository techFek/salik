"use strict";
/*
 * Subtitles for the filtered stream: cues are moved to the shorter timeline (cues inside a skipped part
 * are dropped) and bad words are cleaned with the extension's own word lists (subtitle-censor-core.js).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Plan = require("./plan.js");

const ROOT = path.join(__dirname, "..", "..");

function loadCensor(filterSettings) {
    const ctx = { console, location: { hostname: "" }, filterSettings };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, "shared", "filter-core.js"), "utf8"), ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, "subtitle-censor-core.js"), "utf8"), ctx);
    return ctx.NazafaCensor;
}

function decodeText(buf) {
    const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
    try { return new TextDecoder("windows-1256").decode(buf); } catch (e) { return utf8; }
}

function parseTime(s) {
    const m = String(s).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/);
    if (!m) return NaN;
    return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}

function fmt(t) {
    const ms = Math.max(0, Math.round(t * 1000));
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    const p = (n, w) => String(n).padStart(w, "0");
    return p(h, 2) + ":" + p(m, 2) + ":" + p(s, 2) + "." + p(ms % 1000, 3);
}

/* SRT or WebVTT -> [{ start, end, text }] */
function parseCues(text) {
    const cues = [];
    for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
        const lines = block.split("\n").filter((l) => l.length);
        const i = lines.findIndex((l) => l.includes("-->"));
        if (i === -1) continue;
        const [a, b] = lines[i].split("-->");
        const start = parseTime(a), end = parseTime(String(b).trim().split(/\s+/)[0]);
        if (!isFinite(start) || !isFinite(end)) continue;
        cues.push({ start, end, text: lines.slice(i + 1).join("\n") });
    }
    return cues;
}

/* Cues on the filtered timeline. kept = source pieces kept by the plan. */
function retime(cues, kept) {
    const out = [];
    for (const c of cues) {
        for (const [a, b] of kept) {
            const s = Math.max(c.start, a), e = Math.min(c.end, b);
            if (e - s < 0.05) continue;
            out.push({ start: Plan.sourceToOut(kept, s), end: Plan.sourceToOut(kept, e), text: c.text });
        }
    }
    return out;
}

function toVtt(cues) {
    return "WEBVTT\n\n" + cues.map((c) => fmt(c.start) + " --> " + fmt(c.end) + "\n" + c.text).join("\n\n") + "\n";
}

/* item + settings + offset -> cleaned, retimed WebVTT */
function filterSubtitle(buf, item, settings, offset, censor) {
    const { kept } = Plan.keptPieces(Plan.applicableFilters(item, settings, offset), 1e7);
    const cues = parseCues(decodeText(buf)).map((c) => ({ start: c.start, end: c.end, text: censor ? censor.censorText(c.text) : c.text }));
    return toVtt(retime(cues, kept));
}

module.exports = { loadCensor, parseCues, retime, toVtt, filterSubtitle, decodeText };
