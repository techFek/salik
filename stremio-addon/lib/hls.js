"use strict";
/*
 * On-demand HLS: the playlist is known up front (duration minus skipped parts, cut in 6 s segments),
 * each segment is encoded by FFmpeg the first time it is asked for, kept on disk, and the next ones are
 * prepared in the background so playback stays ahead.
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFile } = require("child_process");
const Plan = require("./plan.js");

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const JOBS = Math.max(1, Number(process.env.SALIK_JOBS) || Math.max(1, Math.floor(os.cpus().length / 4)));
const envNumber = (name, dflt) => { const v = Number(process.env[name]); return process.env[name] !== undefined && process.env[name] !== "" && isFinite(v) ? v : dflt; };
const PREFETCH = Math.max(0, envNumber("SALIK_PREFETCH", 3));
const KEEP_HOURS = envNumber("SALIK_CACHE_HOURS", 24);

function headerString(h) {
    if (!h || typeof h !== "object") return "";
    return Object.entries(h).filter(([k, v]) => /^[\w-]+$/.test(k) && typeof v === "string" && !/[\r\n]/.test(v)).map(([k, v]) => k + ": " + v + "\r\n").join("");
}

function probe(url, headers) {
    const args = ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json"];
    const hs = headerString(headers);
    if (hs) args.push("-headers", hs);
    args.push(url);
    return new Promise((resolve, reject) => {
        execFile(FFPROBE, args, { timeout: 60000, maxBuffer: 1 << 22 }, (err, stdout) => {
            if (err) return reject(new Error("ffprobe failed: " + (err.message || err)));
            try {
                const j = JSON.parse(stdout);
                const duration = Number(j.format && j.format.duration);
                if (!isFinite(duration) || duration <= 0) throw new Error("unknown duration");
                const streams = (j.streams || []).map((s) => s.codec_type);
                resolve({ duration, hasVideo: streams.includes("video"), hasAudio: streams.includes("audio") });
            } catch (e) { reject(e); }
        });
    });
}

class Limiter {
    constructor(n) { this.n = n; this.running = 0; this.queue = []; }
    run(fn, urgent) {
        return new Promise((resolve, reject) => {
            const task = () => { this.running++; fn().then(resolve, reject).finally(() => { this.running--; this.next(); }); };
            if (urgent) this.queue.unshift(task); else this.queue.push(task);
            this.next();
        });
    }
    next() { while (this.running < this.n && this.queue.length) this.queue.shift()(); }
}

class HlsService {
    constructor(opts) {
        this.cacheDir = opts.cacheDir;
        this.encodeOpts = opts.encodeOpts || {};
        this.limiter = new Limiter(opts.jobs || JOBS);
        this.jobs = new Map();
        this.inflight = new Map();
        fs.mkdirSync(this.cacheDir, { recursive: true });
        this.cleanup();
        this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 60 * 1000);
        this.cleanupTimer.unref();
    }

    /* job = { id, dir, plan, url, headers, opts } for one (source url, library item, settings). */
    async job(payload, resolveItem) {
        const id = crypto.createHash("sha1").update(JSON.stringify([payload.u, payload.k, payload.g, payload.m])).digest("hex").slice(0, 20);
        if (this.jobs.has(id)) return this.jobs.get(id);
        const p = (async () => {
            const dir = path.join(this.cacheDir, id);
            fs.mkdirSync(dir, { recursive: true });
            const planFile = path.join(dir, "plan.json");
            let saved = null;
            try { saved = JSON.parse(fs.readFileSync(planFile, "utf8")); } catch (e) {}
            if (!saved) {
                const [info, found] = await Promise.all([probe(payload.u, payload.h), resolveItem(payload)]);
                if (!found) throw new Error("title not in the library");
                const plan = Plan.buildPlan(found.item, found.settings, found.offset, info.duration);
                saved = { plan, hasAudio: info.hasAudio };
                fs.writeFileSync(planFile, JSON.stringify(saved));
            }
            fs.utimesSync(dir, new Date(), new Date());
            return { id, dir, plan: saved.plan, hasAudio: saved.hasAudio, url: payload.u, headers: payload.h, maxHeight: payload.m };
        })();
        this.jobs.set(id, p);
        p.catch(() => this.jobs.delete(id));
        return p;
    }

    playlist(job, segmentUrl) { return Plan.playlist(job.plan, segmentUrl); }

    segmentFile(job, k) { return path.join(job.dir, k + ".ts"); }

    /* Path of a ready segment file (encodes it first when needed), and starts preparing the next ones. */
    async segment(job, k) {
        const seg = job.plan.segments[k];
        if (!seg) throw Object.assign(new Error("no such segment"), { status: 404 });
        const file = await this.ensure(job, k, true);
        for (let i = 1; i <= PREFETCH; i++) if (job.plan.segments[k + i]) this.ensure(job, k + i, false).catch(() => {});
        return file;
    }

    ensure(job, k, urgent) {
        const file = this.segmentFile(job, k);
        if (fs.existsSync(file)) return Promise.resolve(file);
        const key = job.id + ":" + k;
        if (this.inflight.has(key)) return this.inflight.get(key);
        const p = this.limiter.run(() => this.encode(job, k, file), urgent).finally(() => this.inflight.delete(key));
        this.inflight.set(key, p);
        return p;
    }

    encode(job, k, file) {
        if (fs.existsSync(file)) return Promise.resolve(file);
        const seg = job.plan.segments[k];
        const args = Plan.segmentArgs(job.plan, seg, job.url, Object.assign({}, this.encodeOpts, {
            noAudio: !job.hasAudio, maxHeight: job.maxHeight, inputHeaders: headerString(job.headers) || undefined
        }));
        const tmp = file + ".part";
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const ff = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
            const out = fs.createWriteStream(tmp);
            let err = "";
            out.on("error", (e) => { ff.kill(); reject(new Error("cannot write segment " + k + ": " + e.message)); });
            ff.stdout.pipe(out);
            ff.stderr.on("data", (d) => { if (err.length < 4000) err += d; });
            ff.on("error", (e) => reject(new Error("ffmpeg could not start: " + e.message)));
            ff.on("close", (code) => {
                out.close(() => {
                    if (!fs.existsSync(tmp)) return reject(new Error("segment " + k + " was removed while encoding"));
                    if (code !== 0) { fs.rmSync(tmp, { force: true }); return reject(new Error("ffmpeg failed on segment " + k + ": " + err.trim().split("\n").slice(-3).join(" | "))); }
                    fs.renameSync(tmp, file);
                    const took = (Date.now() - started) / 1000;
                    if (took > job.plan.segmentS) console.warn("[hls] segment " + k + " took " + took.toFixed(1) + " s (longer than it plays): lower the quality or set FFMPEG_VCODEC");
                    resolve(file);
                });
            });
        });
    }

    cleanup() {
        const limit = Date.now() - KEEP_HOURS * 3600 * 1000;
        let names = [];
        try { names = fs.readdirSync(this.cacheDir); } catch (e) { return; }
        for (const n of names) {
            const d = path.join(this.cacheDir, n);
            try { if (fs.statSync(d).mtimeMs < limit) { fs.rmSync(d, { recursive: true, force: true }); this.jobs.delete(n); } } catch (e) {}
        }
    }

    close() { clearInterval(this.cleanupTimer); }
}

module.exports = { HlsService, probe, headerString };
