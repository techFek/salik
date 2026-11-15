#!/usr/bin/env node
/*
 * Salik importer CLI.
 *
 *   node importer/cli.mjs <file.mcf|file.skp> [options]
 *
 *   --format mcf|videoskip      default: from the file
 *   --imdb tt1234567            IMDb id (MCF files may already say it)
 *   --season N --episode N      for an episode
 *   --runtime 7265.4            length in seconds of the release the file was made on
 *   --platform stremio          platformVersion (netflix, shahid, stremio, unknown…)
 *   --license "CC BY-SA 4.0"    the file's license, as the source states it
 *   --source-url URL            where the file came from
 *   --shift -1.5                move every time by N seconds
 *   --out file.json             write the unified import (default: print it)
 *   --merge [--key KEY] [--title "Title"]
 *                               add the scenes to library/<KEY>.json (found by IMDb id when --key is left out) as
 *                               verified:false, then rebuild library.json
 *
 * Only reads files you downloaded yourself; it never fetches anything.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { ADAPTERS, detectFormat, findKeyByImdb, mergeIntoItem, shiftUnified, validateUnified } from "./importer.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function args(argv) {
    const o = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--")) {
            const k = a.slice(2);
            const next = argv[i + 1];
            if (next === undefined || next.startsWith("--")) o[k] = true; else { o[k] = next; i++; }
        } else o._.push(a);
    }
    return o;
}

function slug(s) {
    return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/^-+|-+$/g, "") || "title";
}

function main() {
    const a = args(process.argv.slice(2));
    const file = a._[0];
    if (!file || a.help) {
        console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#!.*\n\/\*/, "").replace(/^ \* ?/gm, ""));
        return file ? 0 : 1;
    }
    const text = fs.readFileSync(file, "utf8");
    const format = a.format || detectFormat(text, file);
    const adapter = ADAPTERS[format];
    if (!adapter) { console.error("unknown format " + format); return 1; }
    if (!adapter.ENABLED) { console.error(adapter.name + " import is disabled."); return 1; }
    let u = adapter.parse(text, {
        imdb: a.imdb, season: a.season, episode: a.episode, runtimeSec: a.runtime, platformVersion: a.platform,
        license: a.license, sourceUrl: a["source-url"]
    });
    if (a["source-url"] && u.attribution) u.attribution.url = a["source-url"];
    if (a.shift) u = shiftUnified(u, Number(a.shift));
    for (const w of u.warnings || []) console.error("warning: " + w);
    const errors = validateUnified(u);
    if (errors.length) { errors.forEach((e) => console.error("error: " + e)); return 1; }
    const json = JSON.stringify(u, null, 2);
    if (a.out) fs.writeFileSync(a.out, json + "\n"); else if (!a.merge) console.log(json);
    console.error(`${u.segments.length} scene(s) from ${adapter.name}${u.imdb ? " for " + u.imdb : ""}`);

    if (a.merge) {
        const require = createRequire(import.meta.url);
        const library = JSON.parse(fs.readFileSync(path.join(ROOT, "library.json"), "utf8"));
        const key = a.key || (u.imdb && findKeyByImdb(library, u.imdb, u.season, u.episode)) || slug(a.title || u.title || u.imdb);
        const itemFile = path.join(ROOT, "library", key + ".json");
        const existing = fs.existsSync(itemFile) ? JSON.parse(fs.readFileSync(itemFile, "utf8")) : null;
        if (!existing && !a.title && !u.title) { console.error("new title: give --title (or --key of an existing one)"); return 1; }
        const { item, added, skipped } = mergeIntoItem(existing || { addedAt: Date.now() }, u, { title: a.title });
        fs.writeFileSync(itemFile, JSON.stringify(item, null, 2) + "\n");
        console.error(`library/${key}.json: +${added} unreviewed scene(s)${skipped ? `, ${skipped} skipped (already covered)` : ""}`);
        const build = require(path.join(ROOT, "scripts", "build-library.js"));
        const all = {};
        const dir = path.join(ROOT, "library");
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) all[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        fs.writeFileSync(path.join(ROOT, "library.json"), JSON.stringify(build.build(all).out));
        console.error("library.json rebuilt. Review the new scenes in importer/review.html before publishing.");
    }
    return 0;
}

process.exitCode = main();
