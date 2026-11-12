"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { FILES, compare } = require("../scripts/sync-android.js");
const H = require("./helpers.js");

test("0: every shared file in android/ is byte-identical to the root copy", () => {
    const { SNAPSHOTS } = require("../scripts/sync-android.js");
    const bad = compare().filter((r) => !r.same && !SNAPSHOTS.has(r.src)).map((r) => r.src);
    assert.deepEqual(bad, []);
});

test("0: the sync list covers the duplicated files", () => {
    const srcs = FILES.map(([s]) => s);
    for (const f of ["isolated.script.js", "subtitle-censor-core.js", "app/services.js", "app/i18n.js", "library.json", "shared/filter-core.js"]) assert.ok(srcs.includes(f), f);
});

test("0: root keeps the newer extension changes", () => {
    const iso = fs.readFileSync(path.join(H.ROOT, "isolated.script.js"), "utf8");
    assert.match(iso, /chrome\.runtime\.lastError[\s\S]{0,120}setTimeout/);
    assert.match(iso, /function extractStremioId/);
    const svc = fs.readFileSync(path.join(H.ROOT, "app/services.js"), "utf8");
    assert.match(svc, /export function isPlatformHidden/);
    assert.match(svc, /15000/);
    const sub = fs.readFileSync(path.join(H.ROOT, "subtitle-censor-core.js"), "utf8");
    assert.match(sub, /"مثيرة جنسيا"/);
    assert.doesNotMatch(sub, /"مثيرة",/);
    for (const god of ["إيزيس", "أوزوريس", "أنوبيس", "أودين", "لوكي"]) assert.ok(!sub.includes('"' + god + '"'), god);
});

test("0: shared core is loaded before the scripts that use it", () => {
    const m = JSON.parse(fs.readFileSync(path.join(H.ROOT, "manifest.json"), "utf8"));
    const [iso, main] = m.content_scripts;
    assert.equal(iso.js[0], "shared/filter-core.js");
    assert.equal(main.world, "MAIN");
    assert.equal(main.js[0], "shared/filter-core.main.js", "Chrome injects a file once per page: MAIN world needs its own copy");
    assert.match(fs.readFileSync(path.join(H.ROOT, "popup.html"), "utf8"), /shared\/filter-core\.js[\s\S]*popup-app\.js/);
    assert.match(fs.readFileSync(path.join(H.ANDROID_ASSETS, "ui/index.html"), "utf8"), /\.\.\/shared\/filter-core\.js[\s\S]*app\.js/);
});
