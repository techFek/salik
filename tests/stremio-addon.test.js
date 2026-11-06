"use strict";
/* Stremio addon end to end: fake source addon + fake library + the real server (+ FFmpeg when installed). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFileSync, spawnSync } = require("child_process");

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "salik-addon-"));
const LIB = {
    "test-film": {
        type: "movie", title: "Test Film",
        platforms: { stremio: { id: "tt0000001", url: "https://web.stremio.com/#/detail/movie/tt0000001" } },
        filters: [
            { id: 1, category: "violence", original_description: "قتل", start: 10, end: 20, action_type: "skip" },
            { id: 2, category: "language", original_description: "يلعن", start: 3, end: 4, action_type: "mute" },
            { id: 3, category: "nudity", original_description: "امرأة عارية", start: 25, end: 28, action_type: "blur" }
        ]
    }
};
const SRT = "1\n00:00:01,000 --> 00:00:02,000\nhello\n\n2\n00:00:12,000 --> 00:00:13,000\ninside the skipped part\n\n3\n00:00:21,000 --> 00:00:22,500\nwhat the fuck is this\n";

let fixtures, server, base, Cfg;

function listen(srv) { return new Promise((r) => srv.listen(0, "127.0.0.1", () => r("http://127.0.0.1:" + srv.address().port))); }
async function get(url) { const r = await fetch(url); return { status: r.status, type: r.headers.get("content-type"), buf: Buffer.from(await r.arrayBuffer()) }; }
async function json(url) { const r = await get(url); return JSON.parse(r.buf.toString()); }

test.before(async () => {
    if (hasFfmpeg) execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "40", "-c:v", "libx264", "-preset", "ultrafast", "-g", "50", "-c:a", "aac", "-shortest", path.join(dir, "src.mp4")]);
    let fixturesBase = "";
    fixtures = http.createServer((req, res) => {
        if (req.url === "/library.json") return res.end(JSON.stringify(LIB));
        if (req.url.startsWith("/src/stream/movie/tt0000001")) {
            return res.end(JSON.stringify({ streams: [
                { name: "Src", title: "1080p WEB", url: fixturesBase + "/video.mp4" },
                { name: "Torrent", infoHash: "0123456789abcdef0123456789abcdef01234567" }
            ] }));
        }
        if (req.url.startsWith("/subs/subtitles/movie/tt0000001")) return res.end(JSON.stringify({ subtitles: [{ id: "en1", lang: "eng", url: fixturesBase + "/sub.srt" }] }));
        if (req.url === "/sub.srt") return res.end(SRT);
        if (req.url === "/video.mp4") {
            const f = path.join(dir, "src.mp4");
            const size = fs.statSync(f).size;
            const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
            if (m) {
                const a = Number(m[1]), b = m[2] ? Number(m[2]) : size - 1;
                res.writeHead(206, { "Content-Range": "bytes " + a + "-" + b + "/" + size, "Accept-Ranges": "bytes", "Content-Length": b - a + 1, "Content-Type": "video/mp4" });
                return fs.createReadStream(f, { start: a, end: b }).pipe(res);
            }
            res.writeHead(200, { "Content-Length": size, "Accept-Ranges": "bytes", "Content-Type": "video/mp4" });
            return fs.createReadStream(f).pipe(res);
        }
        res.writeHead(404); res.end();
    });
    fixturesBase = await listen(fixtures);
    process.env.SALIK_LIBRARY_URL = fixturesBase + "/library.json";
    process.env.SALIK_DATA_DIR = path.join(dir, "data");
    process.env.SALIK_PREFETCH = "0";
    process.env.FFMPEG_PRESET = "ultrafast";
    Cfg = require("../stremio-addon/lib/config.js");
    const { createServer } = require("../stremio-addon/server.js");
    server = createServer();
    base = await listen(server);
    test.cfg = Cfg.encodeConfig({ src: fixturesBase + "/src/manifest.json", subs: fixturesBase + "/subs/manifest.json", maxh: 720 });
});

test.after(() => {
    server && server.close();
    fixtures && fixtures.close();
    require("../stremio-addon/server.js").hls.close();
    fs.rmSync(dir, { recursive: true, force: true });
});

test("addon: manifest asks for configuration until a source addon is set", async () => {
    const m = await json(base + "/manifest.json");
    assert.equal(m.behaviorHints.configurationRequired, true);
    assert.deepEqual(m.resources, ["stream", "subtitles"]);
    const m2 = await json(base + "/" + test.cfg + "/manifest.json");
    assert.equal(m2.behaviorHints.configurationRequired, false);
    const page = await get(base + "/configure");
    assert.match(page.buf.toString(), /سالك لـ Stremio/);
});

test("addon: library titles get wrapped http streams; others and torrents get nothing", async () => {
    const r = await json(base + "/" + test.cfg + "/stream/movie/tt0000001.json");
    assert.equal(r.streams.length, 1, "only the http stream is wrapped");
    assert.match(r.streams[0].url, /\/hls\/[^/]+\/index\.m3u8$/);
    assert.match(r.streams[0].title, /Test Film/);
    const none = await json(base + "/" + test.cfg + "/stream/movie/tt9999999.json");
    assert.deepEqual(none.streams, []);
});

test("addon: play links are signed", async () => {
    const r = await get(base + "/hls/" + Cfg.signToken("wrong-secret", { u: "http://evil/x.mp4", k: "test-film" }) + "/index.m3u8");
    assert.equal(r.status, 403);
});

test("addon: subtitles are retimed after skips and cleaned", async () => {
    const r = await json(base + "/" + test.cfg + "/subtitles/movie/tt0000001.json");
    assert.equal(r.subtitles.length, 1);
    const vtt = (await get(r.subtitles[0].url)).buf.toString();
    assert.match(vtt, /^WEBVTT/);
    assert.match(vtt, /00:00:01\.000 --> 00:00:02\.000\nhello/);
    assert.doesNotMatch(vtt, /inside the skipped part/);
    assert.match(vtt, /00:00:11\.000 --> 00:00:12\.500/, "source 21 s -> output 11 s");
    assert.doesNotMatch(vtt, /fuck/i);
});

test("addon: playlist + first segment from a real FFmpeg run", { skip: !hasFfmpeg && "ffmpeg not installed" }, async () => {
    const r = await json(base + "/" + test.cfg + "/stream/movie/tt0000001.json");
    const m3u = await get(r.streams[0].url);
    assert.equal(m3u.status, 200);
    const text = m3u.buf.toString();
    assert.equal((text.match(/#EXTINF/g) || []).length, 5, "40 s - 10 s skipped = 30 s = 5 segments");
    const seg = await get(r.streams[0].url.replace("index.m3u8", "seg/1.ts"));
    assert.equal(seg.status, 200);
    assert.equal(seg.type, "video/mp2t");
    const f = path.join(dir, "s1.ts");
    fs.writeFileSync(f, seg.buf);
    const frames = Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", f]).toString().trim().split(/[,\n]/)[0]);
    assert.equal(frames, 150);
});
