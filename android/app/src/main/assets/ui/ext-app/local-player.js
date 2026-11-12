/*
 * Salik local player: plays a video file from the device (or a direct video link) with a library
 * title's filters: skip, mute, and a full blur for blurred scenes. Shared by the extension page
 * (player.html) and the Android app (catalog route "player"), so the rules stay in one place
 * (shared/filter-core.js).
 *
 *   const stop = mountLocalPlayer(root, { library, settings, disabledStore, lang, onExit });
 *   stop();   // pauses and frees the video when the page or route closes
 */

const STR = {
    title: ["شغّل فيلمًا من جهازك مع فلاتر سالك", "Play a film from your device with Salik's filters"],
    hint: ["اختر ملف الفيديو، ثم العمل من المكتبة. الفلاتر متظبطة على نسخة معيّنة من كل عمل؛ لو جاء الكتم قبل الكلمة أو بعدها، اضبطه من أزرار التوقيت أثناء التشغيل.",
        "Pick the video file, then the title from the library. Filters are timed to one release of each title; if mutes land early or late, adjust them with the timing buttons while playing."],
    file: ["اختيار ملف فيديو", "Choose a video file"],
    orLink: ["أو رابط فيديو مباشر (http)", "or a direct video link (http)"],
    sub: ["ترجمة (اختياري): ملف srt أو vtt", "Subtitles (optional): .srt or .vtt"],
    pick: ["العمل", "Title"],
    search: ["ابحث عن فيلم أو حلقة", "Search a film or episode"],
    guessed: ["اقتراح من اسم الملف", "Suggested from the file name"],
    play: ["تشغيل مع الفلاتر", "Play with filters"],
    needFile: ["اختر ملفًا أو اكتب رابطًا أولًا", "Choose a file or enter a link first"],
    needTitle: ["اختر العمل من القائمة", "Pick the title from the list"],
    back: ["رجوع", "Back"],
    timing: ["توقيت الفلاتر", "Filter timing"],
    earlier: ["أبكر ½ ث", "½ s earlier"],
    later: ["أبطأ ½ ث", "½ s later"],
    scenes: ["{n} مشهدًا يُفلتر", "{n} scenes filtered"],
    muted: ["🔇 كتم", "🔇 Muted"],
    skipped: ["⏩ تخطي مشهد", "⏩ Scene skipped"],
    hidden: ["🛡️ سالك: تم حجب هذا المشهد", "🛡️ Salik: scene hidden"],
    cantPlay: ["المتصفح لا يستطيع تشغيل هذا الملف (غالبًا صيغة الصوت أو الفيديو). جرّب نسخة MP4 (H.264 / AAC).",
        "This browser can't play this file (usually its audio or video codec). Try an MP4 (H.264 / AAC) version."],
    noPicker: ["هذا الجهاز لا يفتح منتقي الملفات؛ ثبّت مدير ملفات أو استخدم رابطًا مباشرًا.", "This device has no file picker; install a file manager or use a direct link."],
    noFilters: ["لا مشاهد تُفلتر لهذا العمل بإعداداتك الحالية.", "Nothing is filtered for this title with your current settings."]
};

const LEAD_S = 0.3;
const MUTE_LEAD_S = 0.1;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
const norm = (s) => String(s || "").toLowerCase()
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/* Titles that have filters, episodes labelled with their series. */
export function playableTitles(library) {
    const out = [];
    for (const [key, it] of Object.entries(library || {})) {
        if (!it || typeof it !== "object" || it.type === "series" || !Array.isArray(it.filters) || !it.filters.length) continue;
        let label = it.title || key;
        if (it.type === "episode") {
            const series = library[it.parent_series_id]?.title || it.parent_series_id || "";
            if (series && !norm(label).includes(norm(series))) label = `${series} · ${label}`;
        }
        out.push({ key, item: it, label, n: norm(label + " " + key) });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

/* Best library title for a file name like "Backrooms.2025.1080p.WEB-DL.mkv" or "Lanterns.S01E02.mkv". */
export function guessTitle(fileName, titles) {
    const base = String(fileName || "").replace(/\.[a-z0-9]{2,4}$/i, "");
    const ep = base.match(/s(\d{1,2})[ ._-]?e(\d{1,3})/i);
    const words = norm(base.replace(/s\d{1,2}[ ._-]?e\d{1,3}.*$/i, "").replace(/\b(19|20)\d{2}\b.*$/, ""))
        .split(" ").filter((w) => w.length > 1 && !/^(\d{3,4}p|web|dl|bluray|x264|x265|hevc|hdr|aac)$/.test(w));
    if (!words.length) return null;
    let best = null, bestScore = 0;
    for (const t of titles) {
        if (ep && !(t.item.type === "episode" && Number(t.item.season) === Number(ep[1]) && Number(t.item.episode) === Number(ep[2]))) continue;
        if (!ep && t.item.type === "episode") continue;
        const tw = new Set(t.n.split(" "));
        const hit = words.filter((w) => tw.has(w)).length;
        const score = hit / Math.max(words.length, 1) - Math.abs(tw.size - words.length) * 0.01;
        if (hit && score > bestScore) { best = t; bestScore = score; }
    }
    return bestScore >= 0.5 ? best : null;
}

/* .srt -> WebVTT text, optionally cleaned with the subtitle censor. */
function toVtt(text, censor) {
    let s = String(text).replace(/\r/g, "").replace(/^\uFEFF/, "");
    if (!/^WEBVTT/.test(s)) s = "WEBVTT\n\n" + s.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2");
    if (!censor) return s;
    return s.split("\n").map((line) => (/-->/.test(line) || /^\d+$/.test(line) || /^WEBVTT/.test(line)) ? line : censor(line)).join("\n");
}

export function mountLocalPlayer(root, opts) {
    const o = opts || {};
    const Core = globalThis.SalikFilterCore;
    const EN = o.lang === "en";
    const T = (k, vars) => {
        let s = (STR[k] || [k, k])[EN ? 1 : 0];
        for (const [a, b] of Object.entries(vars || {})) s = s.replaceAll(`{${a}}`, b);
        return s;
    };
    const titles = playableTitles(o.library);
    const state = { file: null, url: "", subFile: null, chosen: null, q: "", guessed: null };
    let video = null, raf = 0, objectUrl = "", subUrl = "", destroyed = false;

    root.classList.add("salik-lp");
    injectStyle();

    function renderSetup() {
        stopVideo();
        root.innerHTML = `
          <div class="lp-setup">
            <h1>${T("title")}</h1>
            <p class="lp-hint">${T("hint")}</p>
            <div class="lp-row">
              <label class="lp-btn lp-primary" tabindex="0" data-nav data-fid="lp-file">📁 ${T("file")}<input type="file" id="lp-file" accept="video/*,.mkv,.mp4,.webm,.m4v,.mov,.avi" hidden></label>
              <span class="lp-name" id="lp-file-name">${esc(state.file ? state.file.name : "")}</span>
            </div>
            <input class="lp-input" id="lp-url" type="url" dir="ltr" data-nav data-fid="lp-url" placeholder="${T("orLink")}" value="${esc(state.url)}">
            <div class="lp-row">
              <label class="lp-btn" tabindex="0" data-nav data-fid="lp-sub">💬 ${T("sub")}<input type="file" id="lp-sub" accept=".srt,.vtt,text/vtt" hidden></label>
              <span class="lp-name" id="lp-sub-name">${esc(state.subFile ? state.subFile.name : "")}</span>
            </div>
            <h2>${T("pick")}</h2>
            <input class="lp-input" id="lp-q" type="search" data-nav data-fid="lp-q" placeholder="${T("search")}" value="${esc(state.q)}" autocomplete="off">
            <div class="lp-list" id="lp-list"></div>
            <button class="lp-btn lp-primary lp-play" id="lp-play" data-nav data-fid="lp-play">▶ ${T("play")}</button>
            ${o.onExit ? `<button class="lp-btn" id="lp-exit" data-nav data-fid="lp-exit">${T("back")}</button>` : ""}
          </div>`;
        const list = root.querySelector("#lp-list");
        const drawList = () => {
            const q = norm(state.q);
            let rows = titles.filter((t) => !q || t.n.includes(q));
            if (state.guessed && !q) rows = [state.guessed, ...rows.filter((t) => t !== state.guessed)];
            list.innerHTML = rows.slice(0, 60).map((t) => `<button class="lp-item ${state.chosen === t ? "on" : ""}" data-nav data-fid="lp-t-${esc(t.key)}" data-key="${esc(t.key)}">
                <span>${esc(t.label)}</span>${t === state.guessed ? `<small>${T("guessed")}</small>` : ""}</button>`).join("");
        };
        drawList();
        root.querySelector("#lp-file").addEventListener("change", (e) => {
            state.file = e.target.files[0] || null;
            root.querySelector("#lp-file-name").textContent = state.file ? state.file.name : "";
            state.guessed = state.file ? guessTitle(state.file.name, titles) : null;
            if (state.guessed && !state.chosen) state.chosen = state.guessed;
            drawList();
        });
        root.querySelector("#lp-file").addEventListener("click", (e) => {
            if (o.canPickFiles === false) { e.preventDefault(); toast(T("noPicker")); }
        });
        root.querySelector("#lp-sub").addEventListener("change", (e) => {
            state.subFile = e.target.files[0] || null;
            root.querySelector("#lp-sub-name").textContent = state.subFile ? state.subFile.name : "";
        });
        root.querySelector("#lp-url").addEventListener("input", (e) => {
            state.url = e.target.value.trim();
            const name = decodeURIComponent(state.url.split(/[?#]/)[0].split("/").pop() || "");
            const g = guessTitle(name, titles);
            if (g) { state.guessed = g; if (!state.chosen) state.chosen = g; drawList(); }
        });
        root.querySelector("#lp-q").addEventListener("input", (e) => { state.q = e.target.value; drawList(); });
        list.addEventListener("click", (e) => {
            const b = e.target.closest("[data-key]");
            if (!b) return;
            state.chosen = titles.find((t) => t.key === b.dataset.key) || null;
            drawList();
            root.querySelector("#lp-play").focus();
        });
        root.querySelector("#lp-play").addEventListener("click", () => {
            if (!state.file && !/^https?:\/\//i.test(state.url)) { toast(T("needFile")); return; }
            if (!state.chosen) { toast(T("needTitle")); return; }
            renderPlayer();
        });
        root.querySelector("#lp-exit")?.addEventListener("click", () => o.onExit && o.onExit());
        root.querySelectorAll("label.lp-btn").forEach((l) => l.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); l.querySelector("input").click(); }
        }));
    }

    async function renderPlayer() {
        const t = state.chosen;
        const disabled = (o.disabledStore || {})[t.key] || {};
        const filters = (t.item.filters || []).filter((f) => !disabled[f.id] && Core.timing(f) && Core.shouldFilter(f, o.settings || null));
        let offset = Number(t.item.platforms?.stremio?.offset_seconds) || 0;
        const src = state.file ? (objectUrl = URL.createObjectURL(state.file)) : state.url;

        root.innerHTML = `
          <div class="lp-stage">
            <video id="lp-video" controls autoplay playsinline src="${esc(src)}"></video>
            <div class="lp-cover" id="lp-cover" hidden><b>${T("hidden")}</b><span id="lp-cover-desc"></span></div>
            <div class="lp-badge" id="lp-badge" hidden></div>
            <div class="lp-bar">
              <button class="lp-btn" id="lp-back" data-nav data-fid="lp-back">← ${T("back")}</button>
              <span class="lp-title">${esc(t.label)} · ${filters.length ? T("scenes", { n: filters.length }) : T("noFilters")}</span>
              <span class="lp-timing">${T("timing")}: <b id="lp-off">${offset.toFixed(1)}</b>
                <button class="lp-btn" id="lp-earlier" data-nav data-fid="lp-earlier">${T("earlier")}</button>
                <button class="lp-btn" id="lp-later" data-nav data-fid="lp-later">${T("later")}</button></span>
            </div>
          </div>`;
        video = root.querySelector("#lp-video");
        if (state.subFile) {
            const text = await state.subFile.text();
            if (destroyed) return;
            if (o.settings) globalThis.filterSettings = o.settings;
            const censor = globalThis.NazafaCensor ? (line) => globalThis.NazafaCensor.censorText(line) : null;
            subUrl = URL.createObjectURL(new Blob([toVtt(text, censor)], { type: "text/vtt" }));
            const track = document.createElement("track");
            Object.assign(track, { kind: "subtitles", src: subUrl, default: true, label: "Subtitles" });
            video.appendChild(track);
        }
        const cover = root.querySelector("#lp-cover"), badge = root.querySelector("#lp-badge");
        let userMuted = false, weMuted = false, lastSkip = { id: null, at: 0 }, badgeTimer = 0;
        const flash = (text) => { badge.textContent = text; badge.hidden = false; clearTimeout(badgeTimer); badgeTimer = setTimeout(() => { badge.hidden = true; }, 1500); };
        video.addEventListener("volumechange", () => { if (!weMuted) userMuted = video.muted; });
        video.addEventListener("error", () => toast(T("cantPlay")));

        const tick = () => {
            if (destroyed || !video) return;
            const time = video.currentTime + offset;
            const r = Core.resolveActiveFilters(filters, time, { settings: o.settings || null, lead: LEAD_S, muteLead: MUTE_LEAD_S });
            if (r.skip && !video.paused) {
                const now = performance.now();
                if (lastSkip.id !== r.skip.id || now - lastSkip.at > 3000) {
                    lastSkip = { id: r.skip.id, at: now };
                    video.currentTime = Core.timing(r.skip).end - offset + 0.05;
                    flash(T("skipped"));
                }
            }
            const mute = !!r.mute && !r.skip;
            if (mute !== weMuted) {
                weMuted = mute;
                video.muted = mute || userMuted;
                if (mute) flash(T("muted"));
            }
            const blur = r.blur && !r.skip;
            video.classList.toggle("lp-blurred", !!blur);
            cover.hidden = !blur;
            if (blur) root.querySelector("#lp-cover-desc").textContent = blur.original_description || "";
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        const setOffset = (d) => { offset = Math.round((offset + d) * 10) / 10; root.querySelector("#lp-off").textContent = offset.toFixed(1); };
        // "earlier" = filters act sooner = the video is ahead of the library timing
        root.querySelector("#lp-earlier").addEventListener("click", () => setOffset(+0.5));
        root.querySelector("#lp-later").addEventListener("click", () => setOffset(-0.5));
        root.querySelector("#lp-back").addEventListener("click", () => renderSetup());
        root.addEventListener("keydown", onKey);
        video.focus();
    }

    function onKey(e) {
        if (!video || e.target.closest("input")) return;
        if (e.target.closest("button") && (e.key === "Enter" || e.key === " ")) return;
        if (e.key === " " || e.key === "Enter" || e.key === "MediaPlayPause") { e.preventDefault(); video.paused ? video.play() : video.pause(); }
        else if (e.key === "ArrowRight" && e.target === video) { e.preventDefault(); video.currentTime += 10; }
        else if (e.key === "ArrowLeft" && e.target === video) { e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); }
    }

    function stopVideo() {
        cancelAnimationFrame(raf);
        root.removeEventListener("keydown", onKey);
        if (video) { video.pause(); video.removeAttribute("src"); video.load(); video = null; }
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ""; }
        if (subUrl) { URL.revokeObjectURL(subUrl); subUrl = ""; }
    }

    function toast(msg) {
        let el = root.querySelector(".lp-toast");
        if (!el) { el = document.createElement("div"); el.className = "lp-toast"; root.appendChild(el); }
        el.textContent = msg; el.hidden = false;
        clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4000);
    }

    renderSetup();
    return () => { destroyed = true; stopVideo(); root.innerHTML = ""; root.classList.remove("salik-lp"); };
}

function injectStyle() {
    if (document.getElementById("salik-lp-style")) return;
    const st = document.createElement("style");
    st.id = "salik-lp-style";
    st.textContent = `
.salik-lp { --lp-accent: #1f8a5c; font-family: inherit; }
.salik-lp .lp-setup { max-width: 760px; margin: 0 auto; padding: 24px 16px 40px; display: flex; flex-direction: column; gap: 12px; }
.salik-lp h1 { font-size: 1.5rem; margin: 0; }
.salik-lp h2 { font-size: 1.1rem; margin: 10px 0 0; }
.salik-lp .lp-hint { margin: 0; opacity: .75; line-height: 1.7; }
.salik-lp .lp-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.salik-lp .lp-name { opacity: .8; word-break: break-all; }
.salik-lp .lp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 10px; border: 1px solid rgba(127,127,127,.35); background: rgba(127,127,127,.1); color: inherit; font: inherit; cursor: pointer; }
.salik-lp .lp-btn:focus, .salik-lp .lp-item:focus, .salik-lp .lp-input:focus { outline: 3px solid #2f7fd8; outline-offset: 2px; }
.salik-lp .lp-primary { background: var(--lp-accent); border-color: var(--lp-accent); color: #fff; font-weight: 700; }
.salik-lp .lp-play { align-self: flex-start; margin-top: 6px; }
.salik-lp .lp-input { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(127,127,127,.35); background: rgba(127,127,127,.06); color: inherit; font: inherit; }
.salik-lp .lp-list { display: flex; flex-direction: column; gap: 6px; max-height: 42vh; overflow: auto; padding: 2px; }
.salik-lp .lp-item { display: flex; justify-content: space-between; gap: 10px; text-align: start; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(127,127,127,.25); background: transparent; color: inherit; font: inherit; cursor: pointer; }
.salik-lp .lp-item.on { border-color: var(--lp-accent); background: rgba(31,138,92,.12); font-weight: 700; }
.salik-lp .lp-item small { opacity: .7; }
.salik-lp .lp-stage { position: fixed; inset: 0; background: #000; z-index: 9999; display: flex; flex-direction: column; }
.salik-lp video { flex: 1; width: 100%; min-height: 0; background: #000; }
.salik-lp video.lp-blurred { filter: blur(48px) brightness(.6); }
.salik-lp .lp-cover { position: absolute; inset: 0 0 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #ddd; font-size: 1.3rem; text-align: center; pointer-events: none; }
.salik-lp .lp-badge { position: absolute; top: 16px; inset-inline-start: 16px; background: rgba(0,0,0,.7); color: #fff; padding: 6px 12px; border-radius: 8px; pointer-events: none; }
.salik-lp .lp-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px; background: #111; color: #eee; font-size: .9rem; }
.salik-lp .lp-title { flex: 1; min-width: 160px; }
.salik-lp .lp-timing { display: inline-flex; align-items: center; gap: 6px; }
.salik-lp .lp-bar .lp-btn { padding: 6px 10px; color: #eee; }
.salik-lp .lp-toast { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: #222; color: #fff; padding: 10px 16px; border-radius: 10px; z-index: 10000; max-width: 90vw; text-align: center; }
`;
    document.head.appendChild(st);
}
