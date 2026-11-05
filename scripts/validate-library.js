#!/usr/bin/env node
/*
 * Checks the library. Exit code 1 when there is an error (warnings do not fail).
 *
 *   node scripts/validate-library.js [library.json | library/]   (default: library.json)
 *
 * Errors: duplicate filter id in one title, start/end not numbers, end < start, unknown category,
 *         the same (platform, id) on two different titles.
 * Warnings: a filter longer than 600 s, an action the engine does not know.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const Core = require(path.join(__dirname, "..", "shared", "filter-core.js"));

const MAX_FILTER_S = 600;
const KNOWN_ACTIONS = new Set(["mute", "skip", "blur", "partial_blur"]);

function load(target) {
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) return JSON.parse(fs.readFileSync(target, "utf8"));
    const out = {};
    for (const f of fs.readdirSync(target).filter((x) => x.endsWith(".json")).sort()) out[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(target, f), "utf8"));
    return out;
}

function validate(lib) {
    const errors = [];
    const warnings = [];
    if (!lib || typeof lib !== "object" || Array.isArray(lib)) return { errors: ["root is not an object"], warnings };
    const owners = new Map();
    const origWarn = console.warn;
    console.warn = () => {};
    try {
        for (const [key, item] of Object.entries(lib)) {
            if (!item || typeof item !== "object" || Array.isArray(item)) { errors.push(key + ": item is not an object"); continue; }
            const label = key + (item.title ? " (" + item.title + ")" : "");

            if (item.type !== "series") {
                for (const [p, e] of Object.entries(item.platforms || {})) {
                    if (!e || typeof e !== "object" || e.id == null || e.id === "") continue;
                    const k = p.toLowerCase() + ":" + String(e.id);
                    const prev = owners.get(k);
                    if (prev && prev !== key) errors.push("same " + p + " id " + e.id + " on two titles: " + prev + " and " + key);
                    else owners.set(k, key);
                }
            }

            const filters = item.filters;
            if (filters === undefined || filters === null || filters === "") continue;
            if (!Array.isArray(filters)) { errors.push(label + ": filters is not an array"); continue; }
            const seen = new Set();
            filters.forEach((f, i) => {
                const where = label + " #" + i + (f && f.id !== undefined ? " id=" + f.id : "");
                if (!f || typeof f !== "object") { errors.push(where + ": filter is not an object"); return; }
                if (f.id === undefined || f.id === null || f.id === "") errors.push(where + ": missing id");
                else if (seen.has(String(f.id))) errors.push(where + ": duplicate id");
                else seen.add(String(f.id));
                const okS = typeof f.start === "number" && isFinite(f.start);
                const okE = typeof f.end === "number" && isFinite(f.end);
                if (!okS) errors.push(where + ": start is not a number (" + JSON.stringify(f.start) + ")");
                if (!okE) errors.push(where + ": end is not a number (" + JSON.stringify(f.end) + ")");
                if (okS && okE && f.end < f.start) errors.push(where + ": end < start (" + f.start + " -> " + f.end + ")");
                if (okS && okE && f.end - f.start > MAX_FILTER_S) warnings.push(where + ": " + Math.round(f.end - f.start) + " s long (" + f.start + " -> " + f.end + ") " + (f.original_description || ""));
                if (!Core.groupsOf(f).length) errors.push(where + ": unknown category " + JSON.stringify(f.category));
                const a = Core.actionOf(f);
                if (!KNOWN_ACTIONS.has(a)) warnings.push(where + ": unknown action " + JSON.stringify(a) + " (ignored by the engine)");
            });
        }
    } finally { console.warn = origWarn; }
    return { errors, warnings };
}

function main(argv) {
    const target = argv.find((a) => !a.startsWith("--")) || path.join(__dirname, "..", "library.json");
    const lib = load(target);
    const { errors, warnings } = validate(lib);
    console.log("Library: " + path.relative(process.cwd(), target) + " (" + Object.keys(lib).length + " titles)");
    for (const w of warnings) console.log("  warning: " + w);
    for (const e of errors) console.log("  ERROR: " + e);
    console.log(errors.length ? errors.length + " error(s), " + warnings.length + " warning(s)" : "OK (" + warnings.length + " warning(s))");
    return errors.length ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { validate, load, MAX_FILTER_S };
