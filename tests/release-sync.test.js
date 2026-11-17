"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../shared/filter-core.js");

const NTSC = 24000 / 1001;

test("release formats: Blu-ray, WEB-DL and NTSC DVD share one speed; PAL runs 25/23.976 faster", () => {
    assert.equal(Core.releaseScale("bluray", "webdl"), 1);
    assert.equal(Core.releaseScale("webdl", "dvd_ntsc"), 1);
    assert.ok(Math.abs(Core.releaseScale("webdl", "dvd_pal") - 25 / NTSC) < 1e-12);
    assert.ok(Math.abs(Core.releaseScale("dvd_pal", "bluray") - NTSC / 25) < 1e-12);
    assert.ok(Math.abs(Core.releaseScale("bluray", "bluray24") - 24 / NTSC) < 1e-12);
});

test("a scene at 1:00:00 of the timings lands at 57:32 of a PAL copy", () => {
    const k = Core.releaseScale("webdl", "dvd_pal");           // timing = player × k + offset
    const playerTime = 3600 / k;
    assert.equal(Math.round(playerTime), 3453);                 // 57:33 → 57 min 33 s
});

test("release names from stream titles", () => {
    assert.equal(Core.normalizeRelease("Oppenheimer.2023.1080p.BluRay.x264"), "bluray");
    assert.equal(Core.normalizeRelease("WEB-DL 2160p"), "webdl");
    assert.equal(Core.normalizeRelease("DVD PAL"), "dvd_pal");
    assert.equal(Core.normalizeRelease("DVDRip"), "dvd_ntsc");
    assert.equal(Core.normalizeRelease(undefined), "webdl");
    assert.equal(Core.normalizeRelease("dvd_pal"), "dvd_pal");
});

test("a PAL copy is recognised from its length, and the speed fixes the mismatch", () => {
    const runtime = 7200, pal = runtime * NTSC / 25;
    assert.equal(Core.syncDecision(pal, runtime).status, "mismatch");
    assert.equal(Core.guessRelease(pal, runtime, "webdl"), "dvd_pal");
    assert.equal(Core.syncDecision(pal, runtime, false, Core.releaseScale("webdl", "dvd_pal")).status, "ok");
    assert.equal(Core.guessRelease(7230, runtime, "webdl"), null);   // 30 s apart: logos, not speed
    assert.equal(Core.guessRelease(5000, runtime, "webdl"), null);   // another cut altogether
    assert.equal(Core.guessRelease(NaN, runtime, "webdl"), null);
});
