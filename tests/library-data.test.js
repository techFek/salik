"use strict";
/* Group 5: library data checks. */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const H = require("./helpers.js");
const { validate, load } = require("../scripts/validate-library.js");
const { build } = require("../scripts/build-library.js");

test("5: validate-library passes on library.json and on library/ (after the fixes)", () => {
    for (const t of [H.LIBRARY_PATH, path.join(H.ROOT, "library")]) {
        const r = validate(load(t));
        assert.deepEqual(r.errors, [], t);
    }
});

test("5: each rule fails on bad data", () => {
    const f = (o) => Object.assign({ id: 1, start: 1, end: 2, category: "language", action_type: "mute" }, o);
    const cases = [
        [{ a: { filters: [f(), f()] } }, /duplicate id/],
        [{ a: { filters: [f({ start: "1" })] } }, /start is not a number/],
        [{ a: { filters: [f({ end: null })] } }, /end is not a number/],
        [{ a: { filters: [f({ start: 5, end: 2 })] } }, /end < start/],
        [{ a: { filters: [f({ category: "horror" })] } }, /unknown category/],
        [{ a: { platforms: { osnplus: { id: 68999 } } }, b: { platforms: { osnplus: { id: "68999" } } } }, /same osnplus id 68999 on two titles/]
    ];
    for (const [lib, re] of cases) assert.ok(validate(lib).errors.some((e) => re.test(e)), re + " " + JSON.stringify(validate(lib).errors));
    const long = validate({ a: { filters: [f({ start: 0, end: 601 })] } });
    assert.deepEqual(long.errors, []);
    assert.ok(long.warnings.some((w) => /601 s long/.test(w)));
    assert.deepEqual(validate({ s: { type: "series", platforms: { shahid: { id: 1 } } }, e: { type: "episode", platforms: { shahid: { id: 1 } } } }).errors, [], "a series and its episode may share an id");
});

test("5: build-library leaves out titles with no filters and series with no filtered episode", () => {
    const fl = [{ id: 1, start: 1, end: 2, category: "language", action_type: "mute" }];
    const { out, skipped } = build({
        m1: { type: "movie", filters: fl }, m2: { type: "movie", filters: "" }, m3: { type: "movie" },
        s1: { type: "series" }, e1: { type: "episode", parent_series_id: "s1", filters: fl },
        s2: { type: "series" }, e2: { type: "episode", parent_series_id: "s2", filters: [] }
    });
    assert.deepEqual(Object.keys(out).sort(), ["e1", "m1", "s1"]);
    assert.deepEqual(skipped.sort(), ["e2", "m2", "m3", "s2"]);
});

test("5: OSN ids of The Middle are no longer shared between episodes", () => {
    const lib = H.loadLibrary();
    const byId = {};
    for (const [k, v] of Object.entries(lib)) {
        if (!k.startsWith("the-middle")) continue;
        const e = v.platforms && v.platforms.osnplus;
        if (e) (byId[e.id] = byId[e.id] || []).push(k);
    }
    for (const [id, keys] of Object.entries(byId)) assert.equal(keys.length, 1, id + ": " + keys.join(", "));
});
