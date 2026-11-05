#!/usr/bin/env node
/*
 * The extension (repo root) is the only source of the files the Android app shares with it.
 *
 *   node scripts/sync-android.js          copy them into android/
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
    ["subtitle-censor-core.js", "ext/subtitle-censor-core.js"],
    ["subtitles.script.js", "ext/subtitles.script.js"],
    ["app/services.js", "ui/ext-app/services.js"],
    ["app/i18n.js", "ui/ext-app/i18n.js"],
    ["library.json", "data/library.json"]
];

function compare() {
    return FILES.map(([src, dst]) => {
        const a = fs.readFileSync(path.join(ROOT, src));
        const dstPath = path.join(ASSETS, dst);
        const b = fs.existsSync(dstPath) ? fs.readFileSync(dstPath) : null;
        return { src, dst, same: !!b && a.equals(b) };
    });
}

function main(argv) {
    const check = argv.includes("--check");
    const rows = compare();
    if (check) {
        const bad = rows.filter((r) => !r.same);
        for (const r of bad) console.error("out of sync: " + r.src + " -> android/app/src/main/assets/" + r.dst);
        if (bad.length) { console.error("Run: node scripts/sync-android.js"); return 1; }
        console.log("android/ is in sync (" + rows.length + " files)");
        return 0;
    }
    for (const r of rows) {
        if (r.same) continue;
        const dstPath = path.join(ASSETS, r.dst);
        fs.mkdirSync(path.dirname(dstPath), { recursive: true });
        fs.copyFileSync(path.join(ROOT, r.src), dstPath);
        console.log("copied " + r.src + " -> " + r.dst);
    }
    return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { FILES, compare };
