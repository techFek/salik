#!/usr/bin/env node
/*
 * The extension (repo root) is the only source of the files the Android app shares with it.
 *
 *   node scripts/sync-android.js          copy them into android/ (and shared/filter-core.main.js)
 *   node scripts/sync-android.js --check  exit 1 if any copy differs (used by CI)
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "android", "app", "src", "main", "assets");

const FILES = [
    ["shared/filter-core.js", "shared/filter-core.js"],
    ["isolated.script.js", "ext/isolated.script.js"],
    ["main.script.js", "ext/main.script.js"],
    ["subtitle-censor-core.js", "ext/subtitle-censor-core.js"],
    ["subtitles.script.js", "ext/subtitles.script.js"],
    ["app/services.js", "ui/ext-app/services.js"],
    ["app/i18n.js", "ui/ext-app/i18n.js"],
    ["app/local-player.js", "ui/ext-app/local-player.js"],
    ["library.json", "data/library.json"]
];

/*
 * The app downloads the latest library from GitHub; its bundled copy is only a fallback and is refreshed
 * whenever an APK is built (run this script first). So a newer root library.json is not an error in --check,
 * which lets the title tool push library updates without touching android/.
 */
const SNAPSHOTS = new Set(["library.json"]);

/*
 * Copies inside the extension itself. Chrome injects a file only once per page, so the MAIN world
 * gets the shared core under a second name.
 */
const ROOT_COPIES = [
    ["shared/filter-core.js", "shared/filter-core.main.js"]
];

function compare() {
    const rows = FILES.map(([src, dst]) => ({ src, dst, base: ASSETS, label: "android/app/src/main/assets/" + dst }))
        .concat(ROOT_COPIES.map(([src, dst]) => ({ src, dst, base: ROOT, label: dst })));
    return rows.map(({ src, dst, base, label }) => {
        const a = fs.readFileSync(path.join(ROOT, src));
        const dstPath = path.join(base, dst);
        const b = fs.existsSync(dstPath) ? fs.readFileSync(dstPath) : null;
        return { src, dst, dstPath, label, same: !!b && a.equals(b) };
    });
}

function main(argv) {
    const check = argv.includes("--check");
    const rows = compare();
    if (check) {
        const stale = rows.filter((r) => !r.same && SNAPSHOTS.has(r.src));
        for (const r of stale) console.log("note: " + r.label + " is older than " + r.src + " (refreshed when the APK is built)");
        const bad = rows.filter((r) => !r.same && !SNAPSHOTS.has(r.src));
        for (const r of bad) console.error("out of sync: " + r.src + " -> " + r.label);
        if (bad.length) { console.error("Run: node scripts/sync-android.js"); return 1; }
        console.log("copies are in sync (" + rows.length + " files)");
        return 0;
    }
    for (const r of rows) {
        if (r.same) continue;
        fs.mkdirSync(path.dirname(r.dstPath), { recursive: true });
        fs.copyFileSync(path.join(ROOT, r.src), r.dstPath);
        console.log("copied " + r.src + " -> " + r.label);
    }
    return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { FILES, ROOT_COPIES, SNAPSHOTS, compare };
