"use strict";
/* Group 6: re-injection after updates, trusted messages, storage. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers.js");

const MANIFEST = JSON.parse(fs.readFileSync(path.join(H.ROOT, "manifest.json"), "utf8"));
const MAIN = path.join(H.ROOT, "main.script.js");

function mainPage() {
    const video = H.fakeVideo();
    video.parentElement = H.fakeElement();
    const page = H.makePage({ videos: [video] });
    page.run(H.CORE_PATH);
    page.run(MAIN);
    return { page, video };
}

test("6: main.script.js and subtitles.script.js can be injected twice without errors or double work", () => {
    const { page } = mainPage();
    assert.doesNotThrow(() => page.run(MAIN), "second injection of main.script.js");
    assert.equal(page.eval("window.__salikMainVer"), MANIFEST.version);
    const iso = H.makePage({});
    iso.ctx.NazafaCensor = { censorText: (t) => t, containsBlacklistMatch: () => false };
    iso.run(path.join(H.ROOT, "subtitles.script.js"));
    assert.doesNotThrow(() => iso.run(path.join(H.ROOT, "subtitles.script.js")));
    assert.equal(iso.eval("window.__salikSubsVer"), MANIFEST.version);
});

test("6: version constants follow manifest.json", () => {
    const main = fs.readFileSync(MAIN, "utf8");
    const subs = fs.readFileSync(path.join(H.ROOT, "subtitles.script.js"), "utf8");
    assert.ok(main.includes('const NAZAFA_MAIN_VER = "' + MANIFEST.version + '"'), "NAZAFA_MAIN_VER must equal manifest version " + MANIFEST.version);
    assert.ok(subs.includes('const NAZAFA_SUBS_VER = "' + MANIFEST.version + '"'), "NAZAFA_SUBS_VER must equal manifest version " + MANIFEST.version);
});

test("6: an older main.script.js copy stops when a newer one is injected", () => {
    const { page, video } = mainPage();
    page.post({ type: "NAZAFA_HELLO", nonce: "n1" });
    page.eval("window.__salikMainVer = 'newer'");
    page.post({ type: "NAZAFA_EXECUTE_ACTION", action: "mute", nonce: "n1" });
    assert.equal(video.muted, false, "old copy must ignore commands");
});

test("6: main.script.js ignores NAZAFA_* from the page (no nonce / wrong nonce / other source)", () => {
    const { page, video } = mainPage();
    page.post({ type: "NAZAFA_EXECUTE_ACTION", action: "mute" });
    assert.equal(video.muted, false, "before HELLO nothing is accepted");
    page.post({ type: "NAZAFA_HELLO", nonce: "good" });
    page.post({ type: "NAZAFA_HELLO", nonce: "evil" });
    page.post({ type: "NAZAFA_EXECUTE_ACTION", action: "mute", nonce: "evil" });
    assert.equal(video.muted, false, "a second HELLO cannot replace the nonce");
    page.post({ type: "NAZAFA_EXECUTE_ACTION", action: "mute", nonce: "good" }, { other: true });
    assert.equal(video.muted, false, "wrong source");
    page.post({ type: "NAZAFA_EXECUTE_ACTION", action: "mute", nonce: "good" });
    assert.equal(video.muted, true);
});

test("6: isolated.script.js signs its messages and sends HELLO", () => {
    const page = H.makePage({ videos: [H.fakeVideo()] });
    page.run(H.CORE_PATH);
    page.run(path.join(H.ROOT, "isolated.script.js"));
    const hello = page.posted.find((m) => m && m.type === "NAZAFA_HELLO");
    assert.ok(hello && typeof hello.nonce === "string" && hello.nonce.length >= 16);
    page.eval('broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "mute" })');
    assert.equal(page.posted.slice(-1)[0].nonce, hello.nonce);
});

test("6: isolated brainLoop stops once chrome.runtime.id is gone", () => {
    let frames = 0;
    const page = H.makePage({ videos: [H.fakeVideo()] });
    page.ctx.requestAnimationFrame = () => { frames++; return frames; };
    page.ctx.chrome.runtime.id = "abc";
    page.run(H.CORE_PATH);
    page.run(path.join(H.ROOT, "isolated.script.js"));
    const before = frames;
    page.eval("brainLoop(1000)");
    assert.equal(frames, before + 1, "alive: schedules next frame");
    delete page.ctx.chrome.runtime.id;
    page.eval("brainLoop(2000)");
    assert.equal(frames, before + 1, "orphaned: no next frame");
    const subs = fs.readFileSync(path.join(H.ROOT, "subtitles.script.js"), "utf8");
    assert.match(subs, /nazafaContextAlive\(\)/);
});

test("6: library cache has unlimitedStorage", () => {
    assert.ok(MANIFEST.permissions.includes("unlimitedStorage"));
});

test("6: the Android shim keeps chrome.runtime.id so the engine keeps running there", () => {
    const shim = fs.readFileSync(path.join(H.ANDROID_ASSETS, "salik/chrome-shim.js"), "utf8");
    assert.match(shim, /runtime:\s*\{\s*id:\s*"salik-tv"/);
});
