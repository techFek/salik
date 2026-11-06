"use strict";
/* Stremio addon: timeline planning + FFmpeg segments. The FFmpeg test runs only when ffmpeg is installed. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const P = require("../stremio-addon/lib/plan.js");
const H = require("./helpers.js");
const Core = H.quietCore();

const ITEM = { filters: [
    { id: 1, category: "violence", original_description: "قتل", start: 10, end: 20, action_type: "skip" },
    { id: 2, category: "language", original_description: "يلعن", start: 3, end: 4, action_type: "mute" },
    { id: 3, category: "nudity", original_description: "امرأة عارية", start: 25, end: 28, action_type: "blur" },
    { id: 4, category: "nudity", original_description: "عري", start: 5, end: 7, action_type: "partial_blur", blur_region: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 } },
    { id: 5, category: "violence", original_description: "ضرب", start: 30, end: "x", action_type: "skip" }
] };

test("addon: skips are cut out of the timeline and segments map back to the source", () => {
    const p = P.buildPlan(ITEM, null, 0, 40, 6);
    assert.deepEqual(p.kept, [[0, 10], [20, 40]]);
    assert.equal(p.outDuration, 30);
    assert.deepEqual(p.segments.map((s) => s.pieces), [[[0, 6]], [[6, 10], [20, 22]], [[22, 28]], [[28, 34]], [[34, 40]]]);
    assert.equal(P.sourceToOut(p.kept, 20.5), 10.5);
    assert.equal(P.sourceToOut(p.kept, 15), null);
    assert.ok(!p.filters.some((f) => f.id === 5), "invalid end is ignored");
});

test("addon: settings and offset_seconds are applied", () => {
    const s = Core.buildDefaultSettings();
    s.violence.enabled = false;
    const p = P.buildPlan(ITEM, s, 0, 40, 6);
    assert.equal(p.outDuration, 40, "violence locked: nothing skipped");
    const shifted = P.buildPlan(ITEM, null, 2, 40, 6);
    assert.deepEqual(shifted.kept, [[0, 8], [18, 40]], "library time = stream time + offset");
    const bad = P.applicableFilters({ filters: [{ id: 1, category: "nudity", original_description: "عري", start: 1, end: 2, action_type: "partial_blur" }] }, null, 0);
    assert.equal(bad[0].action, "blur", "partial blur without a region becomes a full blur");
});

test("addon: overlapping skips merge; skip at the very start and end", () => {
    const item = { filters: [
        { id: 1, category: "violence", original_description: "قتل", start: 0, end: 5, action_type: "skip" },
        { id: 2, category: "violence", original_description: "قتل", start: 4, end: 8, action_type: "skip" },
        { id: 3, category: "violence", original_description: "قتل", start: 35, end: 50, action_type: "skip" }
    ] };
    const p = P.buildPlan(item, null, 0, 40, 6);
    assert.deepEqual(p.kept, [[8, 35]]);
    assert.equal(p.outDuration, 27);
});

test("addon: segment filter graph applies blur/mute on the source clock, one input per piece", () => {
    const p = P.buildPlan(ITEM, null, 0, 40, 6);
    const g = P.segmentFilterGraph(p, p.segments[1]);
    assert.match(g.graph, /concat=n=2:v=1:a=1/);
    assert.match(g.graph, /setpts=N\/FRAME_RATE\/TB\+6\/TB\[vout\]/);
    const args = P.segmentArgs(p, p.segments[1], "in.mp4");
    assert.equal(args.filter((a) => a === "-i").length, 2);
    const g0 = P.segmentFilterGraph(p, p.segments[0]);
    assert.match(g0.graph, /volume=0:enable='between\(t\\,3\\,4\)'/);
    assert.match(g0.graph, /crop=iw\*0\.3:ih\*0\.3:iw\*0\.1:ih\*0\.1/);
    const g2 = P.segmentFilterGraph(p, p.segments[2]);
    assert.match(g2.graph, /boxblur=.*enable='between\(t\\,25\\,28\)'/);
    assert.equal(P.segmentFilterGraph(p, p.segments[2], { noAudio: true }).audioLabel, null);
});

test("addon: HLS playlist lists every segment with its length", () => {
    const p = P.buildPlan(ITEM, null, 0, 40, 6);
    const m3u = P.playlist(p, (i) => "s/" + i + ".ts");
    assert.match(m3u, /#EXT-X-PLAYLIST-TYPE:VOD/);
    assert.equal((m3u.match(/#EXTINF:6\.000,/g) || []).length, 5);
    assert.match(m3u, /#EXT-X-ENDLIST\n$/);
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
test("addon: real FFmpeg output is muted, skipped and blurred where the library says", { skip: !hasFfmpeg && "ffmpeg not installed" }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "salik-hls-"));
    const src = path.join(dir, "src.mp4");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "40", "-c:v", "libx264", "-preset", "ultrafast", "-g", "50", "-c:a", "aac", "-shortest", src]);
    const p = P.buildPlan(ITEM, null, 0, 40, 6);
    const segs = p.segments.map((s) => {
        const f = path.join(dir, s.index + ".ts");
        fs.writeFileSync(f, execFileSync("ffmpeg", P.segmentArgs(p, s, src, { preset: "ultrafast" }), { maxBuffer: 1 << 30 }));
        return f;
    });
    const probe = (f, entry) => Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", entry, "-of", "csv=p=0", f]).toString().trim().split(/[,\n]/)[0]);
    const frames = segs.map((f) => Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", f]).toString().trim().split(/[,\n]/)[0]));
    assert.deepEqual(frames, [150, 150, 150, 150, 150], "6 s of 25 fps per segment");
    assert.ok(Math.abs(probe(segs[1], "stream=start_time") - 6) < 0.2, "segment 1 starts at output 6 s");
    const maxVol = (f, ss, t) => {
        const out = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(ss), "-t", String(t), "-i", f, "-vn", "-af", "volumedetect", "-f", "null", "-"]).stderr.toString();
        return Number((out.match(/max_volume: (-?[\d.]+) dB/) || [])[1]);
    };
    assert.ok(maxVol(segs[0], 3.2, 0.6) < -80, "muted between 3 and 4 s");
    assert.ok(maxVol(segs[0], 1.2, 0.6) > -40, "sound outside the mute");
    const sharpness = (f, n) => {
        const out = spawnSync("ffmpeg", ["-hide_banner", "-i", f, "-vf", "select='eq(n\\," + n + ")',edgedetect,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-frames:v", "1", "-f", "null", "-"]).stderr.toString();
        return Number((out.match(/YAVG=([\d.]+)/) || [])[1]);
    };
    assert.ok(sharpness(segs[2], 100) < sharpness(segs[3], 100) / 2, "output 16 s (source 26 s) is blurred, output 22 s is not");
    fs.rmSync(dir, { recursive: true, force: true });
});
