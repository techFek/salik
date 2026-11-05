"use strict";
/* Group 1: the group of a scene comes from f.category only. Run: node --test */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers.js");

const Core = H.quietCore();
const LIB = H.loadLibrary();
const ALL = H.allFilters(LIB);
const BY_TITLE = H.filtersByTitle(LIB);

function settings(over) {
    const s = Core.buildDefaultSettings();
    for (const [g, v] of Object.entries(over || {})) {
        if (typeof v === "boolean") s[g].enabled = v;
        else Object.assign(s[g], v, { subs: Object.assign({}, s[g].subs, v.subs || {}) });
    }
    return s;
}

test("1: lock language + substance, then unlock language: zero substance scenes filtered, substance never on (real library)", () => {
    const s = settings({ language: false, substance: false });
    s.language.enabled = true;
    const substanceOnly = ALL.filter((f) => Core.groupsOf(f).join() === "substance");
    assert.ok(substanceOnly.length > 500);
    const leaked = substanceOnly.filter((f) => Core.shouldFilter(f, s));
    assert.equal(leaked.length, 0, leaked.slice(0, 3).map((f) => f.__key + "#" + f.id).join(", "));
    const languageOnly = ALL.filter((f) => Core.groupsOf(f).join() === "language");
    assert.ok(languageOnly.every((f) => Core.shouldFilter(f, s)));
    for (const [key, filters] of Object.entries(BY_TITLE)) {
        const sub = Core.titleGroupStates(filters, {}, s).find((x) => x.g === "substance");
        assert.equal(sub.globalOn, false, key);
        for (const f of sub.items) assert.ok(Core.groupsOf(f).includes("substance"), key + "#" + f.id);
    }
});

test("1: case and wording of the category do not matter", () => {
    assert.equal(Core.normalizeToGroupKey("Language"), "language");
    assert.equal(Core.normalizeToGroupKey("Crude Language"), "language");
    assert.equal(Core.normalizeToGroupKey("VIOLENCE"), "violence");
    assert.equal(Core.normalizeToGroupKey("substance abuse"), "substance");
    assert.deepEqual(Core.groupsOf({ category: "nudity, substance abuse" }), ["nudity", "substance"]);
    assert.deepEqual(Core.groupsOf({ category: "Nudity،Violence" }), ["nudity", "violence"]);
});

test("1: unknown category -> null and logged, never 'substance'", () => {
    const warned = [];
    const orig = console.warn; console.warn = (...a) => warned.push(a.join(" "));
    try {
        assert.equal(Core.normalizeToGroupKey("horror-stuff"), null);
        assert.equal(Core.normalizeToGroupKey(""), null);
        assert.equal(Core.shouldFilter({ id: 9, category: "horror-stuff" }, settings()), false);
    } finally { console.warn = orig; }
    assert.ok(warned.some((w) => /horror-stuff/.test(w)));
});

test("1: keywords pick the sub-category inside the scene's own group only", () => {
    const f = { id: 1, category: "language", original_description: "ذكر نوع مخدر" };
    assert.deepEqual(Core.matchAllSubcategories(f).map((m) => m.groupKey), ["language"]);
    assert.equal(Core.shouldFilter(f, settings({ substance: false })), true);
    const kiss = { id: 3, category: "nudity", original_description: "رجل يقبل امرأة" };
    assert.equal(Core.shouldFilter(kiss, settings({ nudity: { subs: { kissing: false } } })), false);
    assert.equal(Core.shouldFilter({ id: 4, category: "nudity", original_description: "امرأة عارية" }, settings({ nudity: { subs: { kissing: false } } })), true);
});

test("1: every scene is counted in its own group(s) only, and toggling one group of a title leaves the others", () => {
    const d = Core.categorizeFiltersDetailed(ALL);
    for (const g of Core.GROUP_KEYS) assert.equal(d[g].items.length, ALL.filter((f) => Core.groupsOf(f).includes(g)).length, g);
    for (const [key, filters] of Object.entries(BY_TITLE)) {
        const before = Core.titleGroupStates(filters, {}, null);
        for (const g of Core.GROUP_KEYS) {
            const after = Core.titleGroupStates(filters, Core.toggleTitleGroupStore(filters, {}, g, false), null);
            for (const other of Core.GROUP_KEYS) {
                if (other === g) continue;
                const shared = filters.some((f) => { const gs = Core.groupsOf(f); return gs.includes(g) && gs.includes(other); });
                if (!shared) assert.equal(after.find((x) => x.g === other).on, before.find((x) => x.g === other).on, key + ": " + g + " changed " + other);
            }
        }
    }
});

test("1: popup turns scenes off only when they belong to that group / sub-category alone", () => {
    const src = fs.readFileSync(path.join(H.ROOT, "app/popup-app.js"), "utf8");
    assert.doesNotMatch(src, /matchAllSubcategories\(it\)\.length > 1/);
    assert.match(src, /belongsOnlyTo\(it, catKey\)/);
    assert.match(src, /belongsOnlyTo\(it, catKey, subKey\)/);
    const both = { id: 1, category: "nudity, substance abuse", original_description: "رقص فتاة ليل مع تعاطي مخدرات" };
    assert.equal(Core.belongsOnlyTo(both, "nudity"), false);
    const kiss = { id: 2, category: "nudity", original_description: "رجل يقبل امرأة" };
    assert.equal(Core.belongsOnlyTo(kiss, "nudity"), true);
    assert.equal(Core.belongsOnlyTo(kiss, "nudity", "kissing"), true);
    assert.equal(Core.belongsOnlyTo(kiss, "nudity", "exposure"), false);
    assert.equal(Core.belongsOnlyTo({ id: 3, category: "nudity", original_description: "حضن وتقبيل وعري" }, "nudity", "kissing"), false);
});

test("1: no copy of the schema or the old includes() matching is left", () => {
    for (const f of ["isolated.script.js", "app/services.js", "app/popup-app.js"]) {
        const src = fs.readFileSync(path.join(H.ROOT, f), "utf8");
        assert.doesNotMatch(src, /keywords:\s*\[/, f);
        assert.doesNotMatch(src, /\.includes\(nazafaNormalizeArabic|haystack\.includes\(/, f);
        assert.doesNotMatch(src, /return "substance";/, f);
    }
});

test("report: scenes per group before (old logic) and after", () => {
    const before = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "before-counts.json"), "utf8"));
    const d = Core.categorizeFiltersDetailed(ALL);
    const rows = Core.GROUP_KEYS.map((g) => ({ group: g, before: before.detailed[g].items, after: d[g].items.length, "other (no sub-category)": d[g].otherItems.length }));
    console.log("\nScenes per group (" + ALL.length + " scenes now, " + before.total + " before the data fixes):");
    console.table(rows);
});
