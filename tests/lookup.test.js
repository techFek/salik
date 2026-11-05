"use strict";
/* Group 4: finding the playing title in the library. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers.js");
const Core = H.quietCore();
const LIB = H.loadLibrary();

function movieIdFor(href) {
    const u = new URL(href);
    const page = H.makePage({ hostname: u.hostname, href });
    page.ctx.location.pathname = u.pathname;
    page.ctx.location.origin = u.origin;
    page.run(H.CORE_PATH);
    page.run(path.join(H.ROOT, "isolated.script.js"));
    return { id: page.eval("getMovieId()"), platform: page.eval("detectPlatform()") };
}

test("4: watchit /movies/79 -> 3asal-eswed; another platform ending in /79 -> nothing", () => {
    const w = movieIdFor("https://www.watchit.com/#/details/movies/79");
    assert.deepEqual(w, { id: "79", platform: "watchit" });
    assert.equal(Core.findLibraryItem(LIB, w.id, w.platform)._libraryKey, "3asal-eswed");
    const n = movieIdFor("https://www.netflix.com/browse/79");
    assert.equal(Core.findLibraryItem(LIB, n.id || "79", n.platform), null);
    assert.equal(Core.findLibraryItem(LIB, "79", "shahid"), null);
});

test("4: the library key is never used, and no platform -> no match", () => {
    assert.equal(Core.findLibraryItem(LIB, "3asal-eswed", "watchit"), null);
    assert.equal(Core.findLibraryItem(LIB, "79", ""), null);
    assert.equal(Core.findLibraryItem(LIB, "79", "general"), null);
});

test("4: a numeric id on two platforms returns each platform's own title", () => {
    const lib = {
        a: { type: "movie", platforms: { netflix: { id: 81234567 } } },
        b: { type: "movie", platforms: { shahid: { id: "81234567" } } }
    };
    assert.equal(Core.findLibraryItem(lib, "81234567", "netflix")._libraryKey, "a");
    assert.equal(Core.findLibraryItem(lib, "81234567", "shahid")._libraryKey, "b");
    assert.equal(Core.findLibraryItem(lib, "81234567", "disney"), null);
});

test("4: episodes sharing an id are told apart by episode number, then page url", () => {
    const lib = {
        s: { type: "series", platforms: { osnplus: { id: "68999" } } },
        e12: { type: "episode", episode: 12, platforms: { osnplus: { id: "68999", url: "https://osnplus.com/en/series/the-middle-68999/s1/e12" } } },
        e8: { type: "episode", episode: 8, platforms: { osnplus: { id: "68999", url: "https://osnplus.com/en/series/the-middle-68999/s2/e8" } } }
    };
    assert.equal(Core.findLibraryItem(lib, "68999", "osnplus", { episode: 12 })._libraryKey, "e12");
    assert.equal(Core.findLibraryItem(lib, "68999", "osnplus", { episode: 8 })._libraryKey, "e8");
    assert.equal(Core.findLibraryItem(lib, "68999", "osnplus", { pageUrl: "https://osnplus.com/en/series/the-middle-68999/s2/e8" })._libraryKey, "e8");
});

test("4: stremio ids are exact and only on stremio", () => {
    assert.equal(Core.findLibraryItem(LIB, "tt1375666", "stremio")._libraryKey, "inception");
    assert.equal(Core.findLibraryItem(LIB, "tt1375666", "netflix"), null);
    assert.equal(Core.findLibraryItem(LIB, "tt1375666:1:2", "stremio"), null);
});

test("4: every platform id in the real library resolves to its own title", () => {
    const bad = [];
    let n = 0;
    for (const [key, item] of Object.entries(LIB)) {
        if (!item || item.type === "series") continue;
        for (const [p, e] of Object.entries(item.platforms || {})) {
            if (!e || e.id == null || e.id === "") continue;
            n++;
            const got = Core.findLibraryItem(LIB, String(e.id), p, { episode: item.episode, pageUrl: e.url });
            if (!got || got._libraryKey !== key) bad.push(p + ":" + e.id + " -> " + (got && got._libraryKey) + " (expected " + key + ")");
        }
    }
    assert.ok(n > 600);
    assert.deepEqual(bad, []);
});

test("4: generic URL fallbacks run only on a known platform", () => {
    assert.equal(movieIdFor("https://example.com/watch-stuff/12345").id, null);
    assert.equal(movieIdFor("https://example.com/videos/some-slug").id, null);
});

test("4: Background.js and the popup use the shared matcher with the platform", () => {
    const bg = fs.readFileSync(path.join(H.ROOT, "Background.js"), "utf8");
    assert.match(bg, /importScripts\([^)]*shared\/filter-core\.js/);
    assert.match(bg, /findLibraryItem\(library, movieId, request\.platform/);
    assert.doesNotMatch(bg, /library\[movieId\]/);
    const iso = fs.readFileSync(path.join(H.ROOT, "isolated.script.js"), "utf8");
    assert.match(iso, /FETCH_FILTERS_BACKGROUND", movieId: movieId, episode: episodeNumber,\s*platform: detectPlatform\(\)/);
    const popup = fs.readFileSync(path.join(H.ROOT, "app/popup-app.js"), "utf8");
    assert.doesNotMatch(popup, /lib\[tabInfo\.movieId\]/);
    const kt = fs.readFileSync(path.join(H.ROOT, "android/app/src/main/java/com/salik/tv/LibraryMatcher.kt"), "utf8");
    assert.doesNotMatch(kt, /findAnyPlatform|lib\.optJSONObject\(movieId\)/);
    assert.match(fs.readFileSync(path.join(H.ROOT, "android/app/src/main/java/com/salik/tv/ExtensionBridge.kt"), "utf8"), /msg\.opt\("episode"\)/);
});
