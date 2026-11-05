#!/usr/bin/env node
/*
 * Builds library.json from library/*.json, then validates it (exit 1 on errors).
 * Left out: titles with no filters, and series that have no episode with filters.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { validate } = require("./validate-library.js");

const dir = path.join(__dirname, "..", "library");
const outFile = path.join(__dirname, "..", "library.json");

function hasFilters(item) { return !!item && Array.isArray(item.filters) && item.filters.length > 0; }

function build(all) {
    const seriesWithFilters = new Set();
    for (const item of Object.values(all)) if (item && item.parent_series_id && hasFilters(item)) seriesWithFilters.add(item.parent_series_id);
    const out = {};
    const skipped = [];
    for (const [key, item] of Object.entries(all)) {
        const keep = item && item.type === "series" ? seriesWithFilters.has(key) : hasFilters(item);
        if (keep) out[key] = item; else skipped.push(key);
    }
    return { out, skipped };
}

function main() {
    const all = {};
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) all[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const { out, skipped } = build(all);
    fs.writeFileSync(outFile, JSON.stringify(out));
    console.log("library.json rebuilt: " + Object.keys(out).length + " titles" + (skipped.length ? " (left out, no filters: " + skipped.join(", ") + ")" : ""));
    const { errors, warnings } = validate(out);
    for (const w of warnings) console.log("  warning: " + w);
    for (const e of errors) console.log("  ERROR: " + e);
    if (errors.length) { console.log(errors.length + " error(s): fix them in library/ and rebuild."); return 1; }
    return 0;
}

if (require.main === module) process.exit(main());
module.exports = { build, hasFilters };
