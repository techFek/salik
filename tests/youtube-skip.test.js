"use strict";
/* YouTube skip (SponsorBlock): conversion, privacy, settings, and the engine skipping on YouTube. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const nodeCrypto = require("crypto");
const H = require("./helpers.js");
const Core = H.quietCore();

const VID = "abcdefghijk";
const ANSWER = [
    { videoID: "zzzzzzzzzzz", segments: [{ category: "sponsor", segment: [1, 50], UUID: "other", actionType: "skip" }] },
    { videoID: VID, segments: [
        { category: "sponsor", segment: [60, 90], UUID: "s1", actionType: "skip" },
        { category: "interaction", segment: [120, 128], UUID: "i1", actionType: "skip" },
        { category: "selfpromo", segment: [300, 310], UUID: "p1", actionType: "skip" },
        { category: "intro", segment: [0, 12], UUID: "in1", actionType: "skip" },
        { category: "outro", segment: [590, 600], UUID: "out1", actionType: "skip" },
        { category: "sponsor", segment: [400, 410], UUID: "m1", actionType: "mute" },
        { category: "music_offtopic", segment: [200, 220], UUID: "x1", actionType: "skip" }
    ] }
];

test("yt-skip: only this video's segments, only enabled options, skip actions only", () => {
    const all = Core.sponsorBlockToFilters(ANSWER, VID, Core.defaultYtSkip());
    assert.deepEqual(all.map((f) => f.id), ["sb-in1", "sb-s1", "sb-i1", "sb-p1", "sb-out1"]);
    assert.ok(all.every((f) => f.action_type === "skip" && f.source === "sponsorblock"));
    const noIntro = Core.sponsorBlockToFilters(ANSWER, VID, { introOutro: false, interaction: false });
    assert.deepEqual(noIntro.map((f) => f.id), ["sb-s1", "sb-p1"]);
    assert.deepEqual(Core.sponsorBlockToFilters(ANSWER, "nothere0000", Core.defaultYtSkip()), []);
});

test("yt-skip: the request carries only a 4-char hash prefix, never the video id", () => {
    const url = Core.sponsorBlockUrl("ab12", Core.ytSkipCategories());
    assert.match(url, /^https:\/\/sponsor\.ajay\.app\/api\/skipSegments\/ab12\?/);
    assert.ok(!url.includes(VID));
    const iso = fs.readFileSync(path.join(H.ROOT, "isolated.script.js"), "utf8");
    assert.match(iso, /crypto\.subtle\.digest\("SHA-256"/);
    assert.match(iso, /slice\(0, 2\)/, "2 bytes = 4 hex chars");
});

test("yt-skip: SponsorBlock segments do not depend on the library groups", () => {
    const s = Core.buildDefaultSettings();
    for (const g of Core.GROUP_KEYS) s[g].enabled = false;
    const f = Core.sponsorBlockToFilters(ANSWER, VID, Core.defaultYtSkip());
    assert.equal(Core.resolveActiveFilters(f, 70, { settings: s }).skip.id, "sb-s1");
});

function youtubePage(answer) {
    const video = H.fakeVideo({ duration: 600 });
    const sent = [];
    const page = H.makePage({
        videos: [video], hostname: "www.youtube.com", href: "https://www.youtube.com/watch?v=" + VID,
        globals: { crypto: nodeCrypto.webcrypto },
        onRuntimeMessage: (msg, cb) => {
            sent.push(msg);
            if (msg.type === "FETCH_SPONSORBLOCK") setTimeout(() => cb({ success: true, data: answer }), 0);
            else if (msg.type === "FETCH_FILTERS_BACKGROUND") setTimeout(() => cb({ success: false, error: "Not Found" }), 0);
            else cb && cb({});
        }
    });
    page.ctx.location.pathname = "/watch";
    page.ctx.location.search = "?v=" + VID;
    page.run(H.CORE_PATH);
    page.run(path.join(H.ROOT, "isolated.script.js"));
    page.ctx.chrome.runtime.id = "x";
    return { page, video, sent };
}

const settle = () => new Promise((r) => setTimeout(r, 30));

test("yt-skip: on a YouTube video that is not in the library, the sponsor is skipped", async () => {
    const { page, video, sent } = youtubePage(ANSWER);
    page.eval("brainLoop(1000)");
    await settle();
    const req = sent.find((m) => m.type === "FETCH_SPONSORBLOCK");
    assert.ok(req, "asked for SponsorBlock data");
    assert.equal(req.prefix, nodeCrypto.createHash("sha256").update(VID).digest("hex").slice(0, 4));
    page.posted.length = 0;
    video.currentTime = 65;
    page.eval("isExecutingAction = false; processActiveFilters()");
    const skip = page.posted.find((m) => m && m.type === "NAZAFA_EXECUTE_ACTION" && m.action === "skip");
    assert.ok(skip, "skip sent");
    assert.equal(skip.targetTime, 90);
});

test("yt-skip: turning an option off in settings stops that skip right away", async () => {
    const { page, video } = youtubePage(ANSWER);
    page.eval("brainLoop(1000)");
    await settle();
    const listeners = page.runtimeListeners;
    listeners.forEach((fn) => fn({ type: "UPDATE_YT_SKIP_SETTING", value: { sponsor: false } }, {}, () => {}));
    page.posted.length = 0;
    video.currentTime = 65;
    page.eval("isExecutingAction = false; processActiveFilters()");
    assert.ok(!page.posted.some((m) => m && m.action === "skip"));
    video.currentTime = 122;
    page.eval("isExecutingAction = false; processActiveFilters()");
    assert.ok(page.posted.some((m) => m && m.action === "skip" && m.targetTime === 128), "interaction still skipped");
});

test("yt-skip: settings UI, Background, Android bridge and attribution are wired", () => {
    const svc = fs.readFileSync(path.join(H.ROOT, "app/services.js"), "utf8");
    assert.match(svc, /export async function getYtSkip/);
    assert.match(svc, /UPDATE_YT_SKIP_SETTING/);
    const popup = fs.readFileSync(path.join(H.ROOT, "app/popup-app.js"), "utf8");
    assert.match(popup, /YouTubeSkipCard/);
    assert.match(popup, /SponsorBlock/);
    const bg = fs.readFileSync(path.join(H.ROOT, "Background.js"), "utf8");
    assert.match(bg, /FETCH_SPONSORBLOCK/);
    const kt = fs.readFileSync(path.join(H.ROOT, "android/app/src/main/java/com/salik/tv/ExtensionBridge.kt"), "utf8");
    assert.match(kt, /"FETCH_SPONSORBLOCK" -> backend\.fetchSponsorBlock/);
    const ui = fs.readFileSync(path.join(H.ANDROID_ASSETS, "ui/app.js"), "utf8");
    assert.match(ui, /data-yt-skip=/);
    assert.match(ui, /SponsorBlock \(CC BY-NC-SA 4\.0\)/);
    const manifest = JSON.parse(fs.readFileSync(path.join(H.ROOT, "manifest.json"), "utf8"));
    assert.ok(!(manifest.host_permissions || []).some((h) => /ajay/.test(h)), "no new permission needed (CORS allowed)");
});
