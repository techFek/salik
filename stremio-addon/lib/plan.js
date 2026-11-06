"use strict";
/*
 * Pure planning for one filtered stream (no I/O, so it is unit-tested):
 *  - which library filters apply (settings + valid times), moved to the stream's own clock by offset_seconds
 *  - skipped ranges are cut out, so the output timeline is shorter than the source
 *  - the output is cut into fixed HLS segments; each segment maps back to source pieces
 *  - the FFmpeg filter graph for one segment (blur / partial blur / mute on the source clock, then the cut)
 */
const path = require("path");
const Core = require(path.join(__dirname, "..", "..", "shared", "filter-core.js"));

const SEGMENT_S = 6;
const EPS = 1e-6;

function round3(n) { return Math.round(n * 1000) / 1000; }

/* Library filters that apply, on the stream clock. Library time = stream time + offset_seconds. */
function applicableFilters(item, settings, offsetSeconds) {
    const off = Number(offsetSeconds) || 0;
    const out = [];
    for (const f of (item && Array.isArray(item.filters) ? item.filters : [])) {
        const tm = Core.timing(f);
        if (!tm || !Core.shouldFilter(f, settings || null)) continue;
        let action = Core.actionOf(f);
        if (action !== "skip" && action !== "mute" && action !== "blur" && action !== "partial_blur") continue;
        const r = f.blur_region;
        if (action === "partial_blur" && !(r && [r.x, r.y, r.width, r.height].every((v) => typeof v === "number" && isFinite(v)))) action = "blur";
        const start = Math.max(0, tm.start - off);
        const end = tm.end - off;
        if (end <= start) continue;
        out.push({ id: f.id, action, start: round3(start), end: round3(end), region: action === "partial_blur" ? clampRegion(r) : null });
    }
    return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

function clampRegion(r) {
    const c = (v) => Math.min(1, Math.max(0, v));
    const x = c(r.x), y = c(r.y);
    return { x, y, width: Math.max(0.01, Math.min(1 - x, c(r.width))), height: Math.max(0.01, Math.min(1 - y, c(r.height))) };
}

function mergeRanges(ranges) {
    const sorted = ranges.map((r) => [r.start, r.end]).sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const [s, e] of sorted) {
        const last = out[out.length - 1];
        if (last && s <= last[1] + EPS) last[1] = Math.max(last[1], e);
        else out.push([s, e]);
    }
    return out;
}

/* Source pieces that are kept (the complement of the skip ranges inside [0, duration]). */
function keptPieces(filters, duration) {
    const skips = mergeRanges(filters.filter((f) => f.action === "skip"))
        .map(([s, e]) => [Math.max(0, s), Math.min(duration, e)]).filter(([s, e]) => e - s > EPS);
    const kept = [];
    let t = 0;
    for (const [s, e] of skips) {
        if (s - t > EPS) kept.push([t, s]);
        t = Math.max(t, e);
    }
    if (duration - t > EPS) kept.push([t, duration]);
    return { kept, skips };
}

function buildPlan(item, settings, offsetSeconds, duration, segmentS) {
    const seg = segmentS || SEGMENT_S;
    const filters = applicableFilters(item, settings, offsetSeconds);
    const { kept, skips } = keptPieces(filters, duration);
    const outDuration = kept.reduce((s, [a, b]) => s + (b - a), 0);
    const segments = [];
    for (let o = 0, k = 0; o < outDuration - EPS; o += seg, k++) {
        const o1 = Math.min(outDuration, o + seg);
        segments.push({ index: k, outStart: round3(o), outEnd: round3(o1), pieces: outToSource(kept, o, o1) });
    }
    return { duration, outDuration: round3(outDuration), segmentS: seg, filters, skips, kept, segments };
}

/* Source pieces that make up output time [o0, o1). */
function outToSource(kept, o0, o1) {
    const pieces = [];
    let acc = 0;
    for (const [a, b] of kept) {
        const len = b - a;
        const from = Math.max(o0, acc), to = Math.min(o1, acc + len);
        if (to - from > EPS) pieces.push([round3(a + (from - acc)), round3(a + (to - acc))]);
        acc += len;
        if (acc >= o1) break;
    }
    return pieces;
}

/* Output (filtered) time for a source time; null when that moment is cut out. */
function sourceToOut(kept, t) {
    let acc = 0;
    for (const [a, b] of kept) {
        if (t < a - EPS) return null;
        if (t <= b + EPS) return round3(acc + Math.min(t, b) - a);
        acc += b - a;
    }
    return null;
}

const between = (a, b) => "between(t\\," + a + "\\," + b + ")";
/* Radius follows the picture size (boxblur rejects a radius larger than the plane), strong enough to hide detail. */
const BLUR = "boxblur=lr='min(w\\,h)/12':lp=3:cr='min(cw\\,ch)/12':cp=3";

/*
 * FFmpeg filter graph for one segment. Every source piece of the segment is its own input (read with
 * -ss and -copyts, so `t` is the source time): blur and mute are applied on that clock, frames outside
 * the piece are dropped, the pieces are joined, and timestamps restart at segment.outStart.
 */
function segmentFilterGraph(plan, segment, opts) {
    const o = opts || {};
    const parts = [];
    const joinV = [], joinA = [];
    let n = 0;
    const next = (p) => p + (++n);
    segment.pieces.forEach(([from, to], i) => {
        const touches = (f) => f.end > from && f.start < to;
        let label = i + ":v:0";
        if (o.maxHeight) { const l = next("v"); parts.push("[" + label + "]scale=-2:'min(ih\\," + o.maxHeight + ")'[" + l + "]"); label = l; }
        for (const f of plan.filters.filter((x) => x.action === "blur" && touches(x))) {
            const l = next("v");
            parts.push("[" + label + "]" + BLUR + ":enable='" + between(f.start, f.end) + "'[" + l + "]");
            label = l;
        }
        for (const f of plan.filters.filter((x) => x.action === "partial_blur" && touches(x))) {
            const r = f.region;
            const base = next("v"), tmp = next("v"), bl = next("v"), out = next("v");
            parts.push("[" + label + "]split[" + base + "][" + tmp + "]");
            parts.push("[" + tmp + "]crop=iw*" + r.width + ":ih*" + r.height + ":iw*" + r.x + ":ih*" + r.y + "," + BLUR + "[" + bl + "]");
            parts.push("[" + base + "][" + bl + "]overlay=main_w*" + r.x + ":main_h*" + r.y + ":enable='" + between(f.start, f.end) + "'[" + out + "]");
            label = out;
        }
        const keep = "between(t\\," + from + "\\," + (to - 0.0005).toFixed(4) + ")";
        const vp = next("p");
        parts.push("[" + label + "]select='" + keep + "',setpts=PTS-STARTPTS[" + vp + "]");
        joinV.push(vp);
        if (o.noAudio) return;
        let aLabel = i + ":a:0";
        const mutes = plan.filters.filter((x) => x.action === "mute" && touches(x));
        if (mutes.length) {
            const l = next("a");
            parts.push("[" + aLabel + "]volume=0:enable='" + mutes.map((f) => between(f.start, f.end)).join("+") + "'[" + l + "]");
            aLabel = l;
        }
        const ap = next("q");
        parts.push("[" + aLabel + "]aselect='" + keep + "',asetpts=PTS-STARTPTS[" + ap + "]");
        joinA.push(ap);
    });
    const count = segment.pieces.length;
    let vJoined = joinV[0], aJoined = o.noAudio ? null : joinA[0];
    if (count > 1) {
        const ins = segment.pieces.map((_, i) => "[" + joinV[i] + "]" + (o.noAudio ? "" : "[" + joinA[i] + "]")).join("");
        vJoined = "vj"; aJoined = o.noAudio ? null : "aj";
        parts.push(ins + "concat=n=" + count + ":v=1:a=" + (o.noAudio ? 0 : 1) + "[vj]" + (o.noAudio ? "" : "[aj]"));
    }
    parts.push("[" + vJoined + "]setpts=N/FRAME_RATE/TB+" + segment.outStart + "/TB[vout]");
    if (!o.noAudio) parts.push("[" + aJoined + "]asetpts=N/SR/TB+" + segment.outStart + "/TB[aout]");
    return { graph: parts.join(";"), videoLabel: "vout", audioLabel: o.noAudio ? null : "aout" };
}

function segmentArgs(plan, segment, input, opts) {
    const o = opts || {};
    const g = segmentFilterGraph(plan, segment, o);
    const args = ["-hide_banner", "-loglevel", "error", "-nostdin"];
    for (const [from, to] of segment.pieces) {
        const seekTo = Math.max(0, from - 1);
        if (o.inputHeaders) args.push("-headers", o.inputHeaders);
        args.push("-ss", String(round3(seekTo)), "-t", String(round3(to - seekTo + 0.5)), "-copyts", "-i", input);
    }
    args.push("-filter_complex", g.graph, "-map", "[" + g.videoLabel + "]");
    if (g.audioLabel) args.push("-map", "[" + g.audioLabel + "]");
    args.push("-c:v", o.vcodec || "libx264");
    if (!o.vcodec || o.vcodec === "libx264") args.push("-preset", o.preset || "veryfast", "-crf", String(o.crf || 21));
    args.push("-pix_fmt", "yuv420p", "-force_key_frames", "expr:eq(n,0)", "-g", "9999");
    if (g.audioLabel) args.push("-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000");
    args.push("-muxdelay", "0", "-muxpreload", "0", "-f", "mpegts", "pipe:1");
    return args;
}

function playlist(plan, segmentUrl) {
    const lines = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-PLAYLIST-TYPE:VOD", "#EXT-X-TARGETDURATION:" + Math.ceil(plan.segmentS), "#EXT-X-MEDIA-SEQUENCE:0"];
    for (const s of plan.segments) {
        lines.push("#EXTINF:" + (s.outEnd - s.outStart).toFixed(3) + ",");
        lines.push(segmentUrl(s.index));
    }
    lines.push("#EXT-X-ENDLIST");
    return lines.join("\n") + "\n";
}

module.exports = { SEGMENT_S, applicableFilters, keptPieces, buildPlan, outToSource, sourceToOut, segmentFilterGraph, segmentArgs, playlist, mergeRanges };
