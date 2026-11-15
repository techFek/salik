"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers.js");

const FIX = path.join(__dirname, "fixtures", "importer");
const load = () => import("../importer/importer.js");
const read = (f) => fs.readFileSync(path.join(FIX, f), "utf8");

test("MCF: cues, categories, severities and channels become unified segments", async () => {
    const I = await load();
    const u = I.parseMCF(read("example.mcf"), { runtimeSec: 6860.5, platformVersion: "stremio", license: "CC BY-SA 4.0" });
    assert.equal(u.source, "mcf");
    assert.equal(u.imdb, "tt0111161");
    assert.equal(u.title, "Example Movie");
    assert.equal(u.runtimeSec, 6860.5);
    assert.deepEqual(u.reference, { time: 4.02, desc: "Start of the film itself (after the opening logos)" });
    assert.equal(u.attribution.source, "MovieContentFilter");
    assert.equal(u.attribution.license, "CC BY-SA 4.0");
    const at = (t, c) => u.segments.find((s) => s.start === t && s.category === c);
    assert.deepEqual(I.validateUnified(u), []);
    assert.deepEqual(
        (({ start, end, category, severity, action, verified }) => ({ start, end, category, severity, action, verified }))(at(10.5, "violence")),
        { start: 10.5, end: 12.75, category: "violence", severity: "low", action: "skip", verified: false });
    assert.equal(at(181, "profanity").action, "mute");                 // audio -> mute
    assert.equal(at(181, "profanity").severity, "high");
    assert.equal(at(374, "drugs").action, "blur");                     // video -> blur
    assert.equal(at(374, "sex").action, "skip");                       // both -> skip
    assert.equal(at(374, "other").note, "gambling: Some comment");     // gambling has no Salik group
    assert.equal(at(420, "sex").action, "mute");                       // sexual dialogue is heard, not seen
    assert.equal(u.segments.length, 6);
    assert.ok(u.warnings.some((w) => /notACategory/.test(w)));
});

test("MCF: rejects a file that is not WebVTT", async () => {
    const I = await load();
    assert.throws(() => I.parseMCF("hello"), /WEBVTT/);
});

test("VideoSkip: screenshot reference, labels by prefix, levels and handling words", async () => {
    const I = await load();
    const u = I.parseVideoSkip(read("example.skp"), { imdb: "tt0111161", runtimeSec: 6860 });
    assert.equal(u.source, "videoskip");
    assert.deepEqual(u.reference, { time: 5.2, desc: "Studio logo fades to the city at night" });
    assert.deepEqual(I.validateUnified(u), []);
    const s = u.segments.map(({ start, end, category, severity, action }) => [start, end, category, severity, action]);
    assert.deepEqual(s, [
        [848.27, 854, "nudity", "low", "blur"],          // "image" = blank the picture, keep the sound
        [1201.5, 1202.3, "profanity", "medium", "mute"],
        [1870, 1885, "violence", "high", "skip"],
        [2400, 2404, "drugs", "low", "blur"],
        [2700, 2702, "sex", "medium", "blur"]
    ]);
    assert.equal(u.segments[0].note, "nude: male, from behind");
    assert.deepEqual(u.segments[4].blurBox, [0.25, 0.1, 0.5, 0.6]);
});

test("Skipit stays disabled until its developer agrees", async () => {
    const I = await load();
    assert.equal(I.ADAPTERS.skipit.ENABLED, false);
    assert.throws(() => I.ADAPTERS.skipit.parse("x"), /disabled/);
});

test("format detection and time parsing", async () => {
    const I = await load();
    assert.equal(I.detectFormat(read("example.mcf"), "x.txt"), "mcf");
    assert.equal(I.detectFormat("0:01:00 --> 0:01:02 sex", "a.skp"), "videoskip");
    assert.equal(I.parseTime("01:02:03.5"), 3723.5);
    assert.equal(I.parseTime("0:14:14"), 854);
    assert.equal(I.parseTime("2:03,25"), 123.25);
    assert.ok(Number.isNaN(I.parseTime("abc")));
});

test("merge into a library item: unverified filters, no duplicates, sync and attribution kept", async () => {
    const I = await load();
    const u = I.parseMCF(read("example.mcf"), { runtimeSec: 6860.5, platformVersion: "stremio" });
    const existing = { title: "Example Movie", type: "movie", platforms: {}, filters: [
        { id: 1, start: 10, end: 13, category: "violence", original_description: "punch", action_type: "skip" }] };
    const { item, added, skipped } = I.mergeIntoItem(existing, u);
    assert.equal(skipped, 1);                                   // the punch overlaps the existing violence filter
    assert.equal(added, 4);                                     // 6 segments - 1 "other" - 1 duplicate
    assert.equal(item.filters.length, 5);
    assert.ok(item.filters.filter((f) => f.id !== 1).every((f) => f.verified === false && f.source === "mcf"));
    assert.deepEqual([...new Set(item.filters.map((f) => f.id))].length, 5);
    assert.equal(item.sync.runtimeSec, 6860.5);
    assert.equal(item.sync.reference.time, 4.02);
    assert.equal(item.attribution[0].source, "MovieContentFilter");
    assert.equal(item.platforms.stremio.id, "tt0111161");
    // still a valid library
    const Core = H.quietCore();
    assert.deepEqual(Core.validateLibrary({ "example-movie": item }).errors, []);
    // shift moves times and the reference
    const shifted = I.shiftUnified(u, -2);
    assert.equal(shifted.segments[0].start, 8.5);
    assert.equal(shifted.reference.time, 2.02);
});

test("unverified filters are used only when the viewer allows community timings", () => {
    const Core = H.quietCore();
    const f = { id: 1, start: 1, end: 2, category: "violence", original_description: "punch", action_type: "skip", verified: false };
    const reviewed = { ...f, verified: undefined };
    const settings = Core.buildDefaultSettings();
    assert.equal(Core.shouldFilter(f, settings), false);
    assert.equal(Core.shouldFilter(f, null), false);
    assert.equal(Core.shouldFilter(reviewed, settings), true);
    Core.withCommunityFlag(settings, true);
    assert.equal(Core.shouldFilter(f, settings), true);
    assert.ok(!Object.keys(settings).includes("communityUnverified"));   // not one of the groups
    assert.equal(Core.resolveActiveFilters([f], 1.5, { settings }).skip.id, 1);
    Core.withCommunityFlag(settings, false);
    assert.equal(Core.resolveActiveFilters([f], 1.5, { settings }).skip, null);
});

test("sync decision: within 2 s ok, up to 60 s offer, beyond that a different cut", () => {
    const Core = H.quietCore();
    assert.equal(Core.syncDecision(7265.4, 7266.9).status, "ok");
    assert.deepEqual(Core.syncDecision(7275, 7265.4), { status: "offer", diff: 9.6 });
    assert.equal(Core.syncDecision(7265.4, 7400).status, "mismatch");
    assert.equal(Core.syncDecision(7265.4, 7400, true).status, "ok");          // the viewer already synced
    assert.equal(Core.syncDecision(NaN, 7265.4).status, "ok");                 // duration unknown
    assert.equal(Core.syncDecision(7265.4, undefined).status, "ok");           // no runtime recorded
});

test("credits list the static sources and every imported attribution", () => {
    const { collectCredits } = require("../shared/credits.js");
    const c = collectCredits({ a: { attribution: [{ source: "MovieContentFilter", license: "X" }] }, b: { attribution: [{ source: "New Source", url: "u" }] } });
    assert.equal(c.find((x) => x.source === "MovieContentFilter").titles, 1);
    assert.equal(c.find((x) => x.source === "MovieContentFilter").license, "X");
    assert.equal(c.find((x) => x.source === "New Source").titles, 1);
    assert.ok(c.find((x) => x.source === "TMDB"));
});
