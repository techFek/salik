"use strict";
/* Group 7: Android config checks (the Kotlin logic itself is covered by JUnit under android/). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers.js");
const A = path.join(H.ROOT, "android");
const read = (p) => fs.readFileSync(path.join(A, p), "utf8");

test("7: engine origins are https only", () => {
    const cfg = read("app/src/main/java/com/salik/tv/SalikConfig.kt");
    const block = cfg.slice(cfg.indexOf("val PLATFORM_ORIGINS"), cfg.indexOf(")", cfg.indexOf("val PLATFORM_ORIGINS")));
    assert.doesNotMatch(block, /"http:\/\//);
    const eng = cfg.slice(cfg.indexOf("fun engineOrigins"), cfg.indexOf("fun cleartextAllowed"));
    assert.match(eng, /\.filter \{ it\.startsWith\("https:\/\/"\) \}/);
    assert.doesNotMatch(cfg, /isAllowedHttpOrigin/);
});

test("7: plain http is refused except for the user's own LAN Stremio server", () => {
    const main = read("app/src/main/java/com/salik/tv/MainActivity.kt");
    assert.match(main, /override fun shouldInterceptRequest[\s\S]{0,200}SalikConfig\.cleartextAllowed/);
    assert.match(main, /shouldOverrideUrlLoading[\s\S]{0,600}SalikConfig\.cleartextAllowed/);
    const cfg = read("app/src/main/java/com/salik/tv/SalikConfig.kt");
    assert.match(cfg, /server\.host\.equals\(h, ignoreCase = true\) && isPrivateLanHost\(h\)/);
});

test("7: release builds need the key and a matching version", () => {
    const g = read("app/build.gradle.kts");
    assert.match(g, /preReleaseBuild[\s\S]*Release signing key not found/);
    assert.match(g, /does not match versionName/);
    assert.match(g, /versionName = salikVersionName/);
    const v = read("version.properties");
    assert.match(v, /^versionName=\d+\.\d+\.\d+$/m);
    assert.match(v, /^versionCode=\d+$/m);
});

test("7: the library downloaded from GitHub is validated with the same rules", () => {
    const be = read("app/src/main/java/com/salik/tv/SalikBackend.kt");
    assert.match(be, /LibraryValidator\.validate\(body\)/);
    assert.match(be, /throw IllegalStateException\("invalid library"\)/);
});
