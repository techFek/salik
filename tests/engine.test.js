"use strict";
/* Group 3: running the filters (isolated.script.js + main.script.js in a fake page). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const H = require("./helpers.js");
const Core = H.quietCore();

function settings(over) {
    const s = Core.buildDefaultSettings();
    for (const [g, v] of Object.entries(over || {})) s[g].enabled = v;
    return s;
}

function engine(filters, opts) {
    const video = H.fakeVideo();
    const page = H.makePage({ videos: [video] });
    page.run(H.CORE_PATH);
    page.run(path.join(H.ROOT, "isolated.script.js"));
    page.ctx.__f = filters;
    page.eval("window.activeFilters = __f; disabledFilterIds = {}; currentItemPlatforms = {};");
    if (opts && opts.settings) { page.ctx.__s = opts.settings; page.eval("filterSettings = __s;"); }
    page.posted.length = 0;
    const exec = () => page.posted.filter((m) => m && m.type === "NAZAFA_EXECUTE_ACTION");
    return {
        page, video,
        tick(t) { video.currentTime = t; page.eval("isExecutingAction = false; processActiveFilters()"); },
        actions: () => exec().map((m) => m.action),
        last: () => exec().slice(-1)[0]
    };
}

function player(over) {
    const video = H.fakeVideo(over);
    video.parentElement = H.fakeElement();
    const page = H.makePage({ videos: [video] });
    page.run(H.CORE_PATH);
    page.run(path.join(H.ROOT, "main.script.js"));
    page.post({ type: "NAZAFA_HELLO", nonce: "test-nonce" });
    return { page, video, send: (action, extra) => page.post(Object.assign({ type: "NAZAFA_EXECUTE_ACTION", action, nonce: "test-nonce" }, extra || {})) };
}

const mute = (id, s, e, cat) => ({ id, category: cat || "language", original_description: "يلعن", start: s, end: e, action_type: "mute" });

test("3: language mute (locked) overlapping a nudity skip (open): the skip runs", () => {
    const e = engine([mute(1, 100, 110), { id: 2, category: "nudity", original_description: "امرأة عارية", start: 102, end: 120, action_type: "skip" }],
        { settings: settings({ language: false }) });
    e.tick(105);
    assert.equal(e.last().action, "skip");
    assert.equal(e.last().targetTime, 120);
});

test("3: a locked scene that starts first does not hide an allowed one", () => {
    const e = engine([{ id: 1, category: "violence", original_description: "ضرب", start: 50, end: 70, action_type: "skip" }, mute(2, 55, 56)],
        { settings: settings({ violence: false }) });
    e.tick(55.5);
    assert.deepEqual(e.actions(), ["mute"]);
});

test("3: priority skip > blur > mute; blur and mute run together", () => {
    const blur = { id: 1, category: "nudity", original_description: "ملابس كاشفة", start: 10, end: 20, action_type: "blur" };
    const pblur = { id: 4, category: "nudity", original_description: "عري", start: 10, end: 20, action_type: "partial_blur", blur_region: { x: 0, y: 0, width: 0.5, height: 0.5 } };
    const skip = { id: 3, category: "violence", original_description: "قتل", start: 13, end: 30, action_type: "skip" };
    const e = engine([blur, mute(2, 12, 14)]);
    e.tick(12.5);
    assert.deepEqual(e.actions().sort(), ["blur", "mute"]);
    const e2 = engine([blur, mute(2, 12, 14), skip]);
    e2.tick(13.5);
    assert.deepEqual(e2.actions(), ["skip"]);
    assert.equal(Core.resolveActiveFilters([pblur, blur], 11, {}).blur, blur, "full blur beats partial");
    assert.equal(Core.resolveActiveFilters([pblur], 11, {}).blur, pblur);
});

test("3: unmute/unblur are sent once when the state changes, not every 300 ms", () => {
    const e = engine([mute(1, 10, 11), { id: 2, category: "nudity", original_description: "عارية", start: 10, end: 11, action_type: "blur" }]);
    for (let t = 0; t < 5; t += 0.3) e.tick(t);
    assert.deepEqual(e.actions(), []);
    e.tick(10.5);
    for (let t = 11.5; t < 20; t += 0.3) e.tick(t);
    const a = e.actions();
    assert.equal(a.filter((x) => x === "unmute").length, 1);
    assert.equal(a.filter((x) => x === "unblur").length, 1);
});

test("3: locking the group mid-scene releases our mute once", () => {
    const e = engine([mute(1, 10, 20)]);
    e.tick(12);
    e.page.eval("filterSettings.language.enabled = false");
    e.tick(12.3); e.tick(12.6);
    assert.deepEqual(e.actions(), ["mute", "unmute"]);
});

test("3: a filter whose end is missing, not a number, or before start is ignored", () => {
    for (const end of [undefined, null, "", "abc", 5]) {
        for (const action_type of ["skip", "mute", "blur"]) {
            const e = engine([{ id: 1, category: "violence", original_description: "قتل", start: 10, end, action_type }]);
            e.tick(10.2);
            assert.deepEqual(e.actions(), [], action_type + " ran with end=" + JSON.stringify(end));
        }
    }
    assert.equal(Core.timing({ start: 10, end: 9 }), null);
    assert.deepEqual(Core.timing({ start: 10, end: 12 }), { start: 10, end: 12, endValid: true });
});

test("3: getActiveVideoElement keeps a 60 s title video, drops <30 s previews and ad videos", () => {
    const short = H.fakeVideo({ duration: 60 });
    assert.deepEqual(Core.titleVideoCandidates([short]), [short]);
    assert.deepEqual(Core.titleVideoCandidates([H.fakeVideo({ duration: 15 })]), []);
    assert.deepEqual(Core.titleVideoCandidates([H.fakeVideo({ duration: 400, closest: (s) => (/ad-showing/.test(s) ? {} : null) })]), []);
    for (const f of ["isolated.script.js", "main.script.js"]) assert.doesNotMatch(fs.readFileSync(path.join(H.ROOT, f), "utf8"), /duration\s*<\s*300/, f);
});

test("3: unblur restores only the filter we replaced", () => {
    const p = player();
    p.video.style.filter = "contrast(1.1)";
    p.send("blur", { description: "x" });
    assert.match(p.video.style.filter, /blur/);
    p.send("unblur");
    assert.equal(p.video.style.filter, "contrast(1.1)");
    const q = player();
    q.video.style.filter = "brightness(0.9)";
    q.send("unblur");
    assert.equal(q.video.style.filter, "brightness(0.9)", "not cleared when we never blurred");
});

test("3: mute sources: unmuted only when all release; the user's own mute is kept", () => {
    const v = { muted: false };
    const io = { isMuted: () => v.muted, mute: () => { v.muted = true; }, unmute: () => { v.muted = false; } };
    const a = Core.createMuteArbiter(io);
    a.acquire("library"); a.acquire("yt-subs"); a.release("library");
    assert.equal(v.muted, true);
    a.release("yt-subs");
    assert.equal(v.muted, false);
    const b = Core.createMuteArbiter(io);
    v.muted = true; b.userChanged(true); b.acquire("library"); b.release("library");
    assert.equal(v.muted, true);

    const p = player();
    p.send("mute"); assert.equal(p.video.muted, true);
    p.send("unmute"); assert.equal(p.video.muted, false);
    const u = player({ muted: true });
    (u.page.docListeners.volumechange || []).forEach((fn) => fn({ target: u.video }));
    u.send("mute"); u.send("unmute");
    assert.equal(u.video.muted, true, "user mute survives our unmute");
});

test("3: main.script.js uses the mute sources, no shared owner flags", () => {
    const src = fs.readFileSync(path.join(H.ROOT, "main.script.js"), "utf8");
    for (const s of ['acquire("library")', 'release("library")', 'acquire("yt-subs")', 'release("yt-subs")']) assert.ok(src.includes("nazafaMute." + s), s);
    assert.doesNotMatch(src, /nazafaYtTimedHolding|nazafaMuteOwner/);
});

test("mutes start with their own (shorter) lead; skips keep the general lead", () => {
    const skip = { id: 9, category: "nudity", original_description: "x", start: 20, end: 25, action_type: "skip" };
    const fs2 = [mute(1, 10, 11), skip];
    const opts = { lead: 0.3, muteLead: 0.1 };
    assert.equal(Core.resolveActiveFilters(fs2, 9.8, opts).mute, null);
    assert.equal(Core.resolveActiveFilters(fs2, 9.95, opts).mute.id, 1);
    assert.equal(Core.resolveActiveFilters(fs2, 19.75, opts).skip.id, 9);
    assert.equal(Core.resolveActiveFilters(fs2, 9.8, { lead: 0.3 }).mute.id, 1);
});
