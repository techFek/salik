
(function () {
    "use strict";
    const NAZAFA_SUBS_VER = "1.1.0";
    if (window.__salikSubsVer === NAZAFA_SUBS_VER) return;
    window.__salikSubsVer = NAZAFA_SUBS_VER;
    const nazafaSubsAlive = () => window.__salikSubsVer === NAZAFA_SUBS_VER && (typeof nazafaContextAlive !== "function" || nazafaContextAlive());
    const setInterval = (fn, ms, ...args) => {
        const id = window.setInterval(() => { if (!nazafaSubsAlive()) { window.clearInterval(id); return; } fn(...args); }, ms);
        return id;
    };

    const nazafaIsStremio = window.location.hostname.includes("stremio");

    const nazafaIsAmazon = window.location.hostname.includes("primevideo") || window.location.hostname.includes("amazon");

    const nazafaCoreCensorText = window.NazafaCensor.censorText;
    const nazafaCoreContainsBlacklistMatch = window.NazafaCensor.containsBlacklistMatch;


    const CHARS_PER_SECOND = 15;
    const MIN_LINE_DURATION_MS = 700;
    const MAX_LINE_DURATION_MS = 6000;
    const MUTE_PADDING_MS = 220;

    let scheduledUnmuteAt = 0;
    let unmuteTimer = null;

    function startMuteWindow(durationMs) {
        try {
            if (typeof broadcastToAllFrames !== "function") return;
            broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "mute", source: "subs" });
            const endsAt = Date.now() + durationMs;
            if (endsAt > scheduledUnmuteAt) {
                scheduledUnmuteAt = endsAt;
                if (unmuteTimer) clearTimeout(unmuteTimer);
                unmuteTimer = setTimeout(() => {
                    broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "unmute", source: "subs" });
                    unmuteTimer = null;
                    scheduledUnmuteAt = 0;
                }, durationMs);
            }
        } catch (e) { /* تجاهل */ }
    }

    function scheduleWordMute(delayMs, durationMs) {
        if (delayMs <= 0) startMuteWindow(durationMs);
        else setTimeout(() => startMuteWindow(durationMs), delayMs);
    }

    const MIN_WORD_CHAR_UNITS = 3;
    const WORD_GAP_UNITS = 1;

    function tokenizeWordsWithOffsets(text) {
        const words = [];
        const re = /\S+/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            words.push({ start: m.index, end: m.index + m[0].length });
        }
        return words;
    }

    function buildWordTimeline(text, estimatedLineDurationMs) {
        const words = tokenizeWordsWithOffsets(text);
        if (!words.length) return [];
        const weights = words.map(w => Math.max(MIN_WORD_CHAR_UNITS, (w.end - w.start)) + WORD_GAP_UNITS);
        const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
        let cursorMs = 0;
        return words.map((w, i) => {
            const durationMs = (weights[i] / totalWeight) * estimatedLineDurationMs;
            const entry = { start: w.start, end: w.end, startMs: cursorMs, endMs: cursorMs + durationMs };
            cursorMs += durationMs;
            return entry;
        });
    }

    function scheduleAutoMuteForMatches(original, mergedRanges) {
        const lineLength = original.length;
        if (!mergedRanges.length || !lineLength) return;
        const estimatedLineDurationMs = Math.min(
            MAX_LINE_DURATION_MS,
            Math.max(MIN_LINE_DURATION_MS, (lineLength / CHARS_PER_SECOND) * 1000)
        );
        const timeline = buildWordTimeline(original, estimatedLineDurationMs);
        if (!timeline.length) return;

        mergedRanges.forEach(([s, e]) => {
            const overlapping = timeline.filter(w => w.end > s && w.start < e);
            if (!overlapping.length) return;
            const startMs = Math.min(...overlapping.map(w => w.startMs));
            const endMs = Math.max(...overlapping.map(w => w.endMs));
            const delay = Math.max(0, startMs - MUTE_PADDING_MS);
            const duration = Math.max(300, (endMs - startMs) + MUTE_PADDING_MS * 2);
            scheduleWordMute(delay, duration);
        });
    }

    const SUBTITLE_SELECTORS = [
        ".player-timedtext",
        ".ytp-caption-window-container",
        ".captions-display",
        ".shaka-text-container",
        ".vjs-text-track-display",
        ".bmpui-subtitle-label",
        ".jw-captions",
        ".plyr__captions",
        ".vp-captions",
        "[class*='timedtext']",
        "[class*='caption']",
        "[class*='subtitle']",
        "[class*='cue']",
        "[class*='track-display']",
        "[aria-live]"
    ].join(", ");

    const observedContainers = new WeakSet();

    function getPlayerRootContainers() {
        const roots = [];
        try {
            const videos = Array.from(document.querySelectorAll("video"));
            videos.forEach((video) => {
                let node = video;
                for (let i = 0; i < 4 && node.parentElement; i++) {
                    node = node.parentElement;
                }
                if (node && node.nodeType === Node.ELEMENT_NODE) roots.push(node);
            });
        } catch (e) { /* تجاهل */ }
        return roots;
    }

    function collectTextNodes(root) {
        const nodes = [];
        try {
            if (root.nodeType === Node.TEXT_NODE) { nodes.push(root); return nodes; }
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
            let n;
            while ((n = walker.nextNode())) nodes.push(n);
        } catch (e) { /* تجاهل */ }
        return nodes;
    }

    function collectLineGroups(container) {
        const textNodes = collectTextNodes(container);
        if (!textNodes.length) return [];
        const groups = [];
        let current = [];
        let lastTop = null;
        for (const node of textNodes) {
            let top = null;
            try {
                const el = node.parentElement;
                const rect = el ? el.getBoundingClientRect() : null;
                if (rect && rect.height > 0) top = rect.top;
            } catch (e) { /* تجاهل */ }
            if (top === null) top = lastTop;
            if (lastTop !== null && top !== null && Math.abs(top - lastTop) > 4 && current.length) {
                groups.push(current);
                current = [];
            }
            lastTop = top;
            current.push(node);
        }
        if (current.length) groups.push(current);
        return groups;
    }

    const nazafaIsYoutube = /(^|\.)youtube\.com$/i.test(window.location.hostname);
    const NAZAFA_YT_BLEEP_RE = /\[\s*_+\s*\]/;
    let nazafaYtCaptionMuted = false;
    let nazafaYtTimedActive = false;
    window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data || event.data.type !== "NAZAFA_YT_TIMED_ACTIVE") return;
        nazafaYtTimedActive = !!event.data.active;
    });
    function nazafaYtAutoMuteOn() { return typeof nazafaYtAutoMuteEnabled === "undefined" || !!nazafaYtAutoMuteEnabled; }
    function nazafaYtMuteNow(lineLength) {
        if (!nazafaIsYoutube || nazafaYtTimedActive || !nazafaYtAutoMuteOn()) return;
        const durationMs = Math.min(MAX_LINE_DURATION_MS, Math.max(MIN_LINE_DURATION_MS, (lineLength / CHARS_PER_SECOND) * 1000));
        nazafaYtCaptionMuted = true;
        startMuteWindow(durationMs);
    }
    function nazafaYtUnmuteNow() {
        if (!nazafaIsYoutube || !nazafaYtCaptionMuted || nazafaYtTimedActive) return;
        nazafaYtCaptionMuted = false;
        try {
            if (unmuteTimer) clearTimeout(unmuteTimer);
            unmuteTimer = null;
            scheduledUnmuteAt = 0;
            broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "unmute", source: "subs" });
        } catch (e) { /* تجاهل */ }
    }

    /* YouTube writes a word it hides itself as "[ __ ]": it is muted, and the marker is taken off the line. */
    const NAZAFA_YT_BLEEP_ALL_RE = /\s*\[\s*_+\s*\]/g;
    function nazafaStripYtBleep(textNodes) {
        if (typeof nazafaSubtitleCensorEnabled !== "undefined" && !nazafaSubtitleCensorEnabled) return;
        textNodes.forEach((n) => {
            const v = n.nodeValue || "";
            if (!NAZAFA_YT_BLEEP_RE.test(v)) return;
            const out = v.replace(NAZAFA_YT_BLEEP_ALL_RE, "");
            if (out !== v) n.nodeValue = out;
        });
    }

    /*
     * Any other site: the line on screen (the platform's own subtitles, embedded ones, a translation) mutes the bad
     * word in it. The line has just appeared, so the word's moment is estimated from where it sits in the line.
     */
    const nazafaLineSeen = new Map();   // text -> when it was first seen (a line is re-rendered many times)
    function nazafaMuteFromShownLine(censoredLine) {
        if (nazafaIsYoutube || !nazafaYtAutoMuteOn()) return;
        const now = Date.now();
        const seen = nazafaLineSeen.get(censoredLine);
        if (seen && now - seen < 8000) return;
        nazafaLineSeen.set(censoredLine, now);
        if (nazafaLineSeen.size > 200) nazafaLineSeen.delete(nazafaLineSeen.keys().next().value);
        const ranges = [];
        let at = censoredLine.indexOf("*&^");
        while (at !== -1) { ranges.push([at, at + 3]); at = censoredLine.indexOf("*&^", at + 3); }
        scheduleAutoMuteForMatches(censoredLine, ranges);
    }

    function processTextNodeGroup(textNodes) {
        if (!textNodes.length) return;
        const combined = textNodes.map((n) => n.nodeValue).join("");
        if (!combined || !combined.trim() || combined.length > 500) return;
        const censored = nazafaCoreCensorText(combined);
        if (censored === combined) {
            if (nazafaIsYoutube && NAZAFA_YT_BLEEP_RE.test(combined)) {
                nazafaYtMuteNow(combined.length);
                nazafaStripYtBleep(textNodes);
                return;
            }
            // already censored on the way in (subtitle file) or by an earlier pass
            if (combined.indexOf("*&^") !== -1) { nazafaYtMuteNow(combined.length); nazafaMuteFromShownLine(combined); return; }
            nazafaYtUnmuteNow();
            return;
        }
        nazafaYtMuteNow(combined.length);
        nazafaMuteFromShownLine(censored);
        if (typeof nazafaSubtitleCensorEnabled !== "undefined" && !nazafaSubtitleCensorEnabled) return;

        const perNodeCensored = textNodes.map((n) => nazafaCoreCensorText(n.nodeValue));
        if (perNodeCensored.join("") === censored) {
            textNodes.forEach((n, i) => { n.nodeValue = perNodeCensored[i]; });
        } else {
            textNodes[0].nodeValue = censored;
            for (let i = 1; i < textNodes.length; i++) textNodes[i].nodeValue = "";
        }
    }

    function processContainer(container) {
        try {
            const censorOn = typeof nazafaSubtitleCensorEnabled === "undefined" || !!nazafaSubtitleCensorEnabled;
            if (!censorOn && !nazafaYtAutoMuteOn()) return;
            const groups = collectLineGroups(container);
            if (!groups.length) nazafaYtUnmuteNow();
            for (const group of groups) processTextNodeGroup(group);
        } catch (e) { /* تجاهل أي خطأ فردي عشان ميوقفش باقي المراقبة */ }
    }

    function isPlausibleSubtitleContainer(container) {
        try {
            if (container.querySelector('button, a[href], input, select, [role="button"], [role="menu"], [role="menuitem"], [role="tablist"]')) {
                return false;
            }
        } catch (e) { /* تجاهل */ }
        return true;
    }

    function attachObserverTo(container) {
        if (observedContainers.has(container)) return;
        if (!isPlausibleSubtitleContainer(container)) return;
        observedContainers.add(container);

        processContainer(container);

        const observer = new MutationObserver(() => {
            if (!isPlausibleSubtitleContainer(container)) return;
            processContainer(container);
        });
        observer.observe(container, { childList: true, subtree: true, characterData: true });
    }

    function scanForSubtitleContainers() {
        try {
            document.querySelectorAll(SUBTITLE_SELECTORS).forEach(attachObserverTo);
            getPlayerRootContainers().forEach(attachObserverTo);
        } catch (e) { /* تجاهل */ }
    }

    if (!nazafaIsAmazon) {
        scanForSubtitleContainers();
        setInterval(scanForSubtitleContainers, 1500);
    }

    /*
     * Subtitles the browser draws itself (a <track>, a track inside the video file or the stream): they are not in
     * the page, so they are read from video.textTracks. Each cue has its own start and end, so the bad word's moment
     * is placed inside the cue's real time. Every track being shown is censored and mutes; a hidden English track
     * (switched on in the background) only mutes, so an Arabic or translated subtitle on screen still gets the
     * English words' timing.
     */
    const watchedTextTracks = new WeakSet();
    const handledCues = new WeakSet();
    const originalCueText = new WeakMap();

    function findEnglishTextTrack(video) {
        try {
            if (!video || !video.textTracks) return null;
            for (let i = 0; i < video.textTracks.length; i++) {
                const track = video.textTracks[i];
                if (track.kind !== "subtitles" && track.kind !== "captions") continue;
                const lang = (track.language || "").toLowerCase();
                const label = (track.label || "").toLowerCase();
                if (lang.startsWith("en") || label.includes("english") || label.includes("انجلي") || label.includes("إنجلي")) {
                    return track;
                }
            }
        } catch (e) { /* تجاهل */ }
        return null;
    }

    function muteInsideCue(cue, censoredText, video) {
        const ranges = [];
        let at = censoredText.indexOf("*&^");
        while (at !== -1) { ranges.push([at, at + 3]); at = censoredText.indexOf("*&^", at + 3); }
        if (!ranges.length) return;
        const cueMs = Math.max(MIN_LINE_DURATION_MS, (cue.endTime - cue.startTime) * 1000);
        const timeline = buildWordTimeline(censoredText, cueMs);
        const intoCueMs = Math.max(0, (video.currentTime - cue.startTime) * 1000);
        const rate = video.playbackRate || 1;
        ranges.forEach(([s, e]) => {
            const words = timeline.filter((w) => w.end > s && w.start < e);
            if (!words.length) return;
            const startMs = Math.min(...words.map((w) => w.startMs)), endMs = Math.max(...words.map((w) => w.endMs));
            if (endMs + MUTE_PADDING_MS < intoCueMs) return;   // already said
            const delay = Math.max(0, (startMs - MUTE_PADDING_MS - intoCueMs) / rate);
            const duration = Math.max(300, (endMs + MUTE_PADDING_MS - Math.max(intoCueMs, startMs - MUTE_PADDING_MS)) / rate);
            scheduleWordMute(delay, duration);
        });
    }

    function handleTrackCues(track, video, showing) {
        try {
            const activeCues = track.activeCues;
            if (!activeCues || !activeCues.length) return;
            const censorOn = typeof nazafaSubtitleCensorEnabled === "undefined" || !!nazafaSubtitleCensorEnabled;
            for (let i = 0; i < activeCues.length; i++) {
                const cue = activeCues[i];
                if (handledCues.has(cue)) continue;
                handledCues.add(cue);
                const raw = String(originalCueText.has(cue) ? originalCueText.get(cue) : (cue.text || ""));
                const plain = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                if (!plain) continue;
                let censored = nazafaCoreCensorText(plain);
                if (nazafaIsYoutube && NAZAFA_YT_BLEEP_RE.test(plain)) censored = plain.replace(NAZAFA_YT_BLEEP_ALL_RE, " *&^");
                if (censored === plain && plain.indexOf("*&^") === -1) continue;
                if (nazafaYtAutoMuteOn() && !(nazafaIsYoutube && nazafaYtTimedActive)) muteInsideCue(cue, censored, video);
                if (showing && censorOn && "text" in cue) {
                    try { originalCueText.set(cue, raw); cue.text = nazafaCoreCensorText(raw).replace(NAZAFA_YT_BLEEP_ALL_RE, ""); } catch (e) { /* read-only cue */ }
                }
            }
        } catch (e) { /* تجاهل */ }
    }

    function watchTrack(track, video) {
        if (watchedTextTracks.has(track)) return;
        watchedTextTracks.add(track);
        track.addEventListener("cuechange", () => handleTrackCues(track, video, track.mode === "showing"));
    }

    function ensureTextTrackWatchers() {
        try {
            const video = (typeof getActiveVideoElement === "function" ? getActiveVideoElement() : null) || document.querySelector("video");
            if (!video || !video.textTracks) return;
            for (let i = 0; i < video.textTracks.length; i++) {
                const t = video.textTracks[i];
                if ((t.kind === "subtitles" || t.kind === "captions") && t.mode === "showing") watchTrack(t, video);
            }
            const english = findEnglishTextTrack(video);
            if (english && !nazafaIsStremio) {
                if (english.mode === "disabled") english.mode = "hidden";
                watchTrack(english, video);
            }
        } catch (e) { /* تجاهل */ }
    }

    if (!nazafaIsAmazon) {
        ensureTextTrackWatchers();
        setInterval(ensureTextTrackWatchers, 2000);
    }

    if (nazafaIsAmazon) {
        console.log("🎬 Nazafa Amazon: قسم 7 بدأ التشغيل، NazafaCensor متاح؟", typeof nazafaCoreCensorText === "function");
        const AMAZON_CAPTIONS_SELECTOR = ".atvwebplayersdk-captions-text";
        const lastProcessedValue = new WeakMap();

        function censorAmazonCaptionElement(el) {
            try {
                if (typeof nazafaSubtitleCensorEnabled !== "undefined" && !nazafaSubtitleCensorEnabled) return;
                if (typeof nazafaCoreCensorText !== "function") {
                    console.warn("⚠️ Nazafa Amazon: nazafaCoreCensorText مش موجودة، مش هينفّذ تشفير.");
                    return;
                }
                Array.from(el.childNodes).forEach((node) => {
                    if (node.nodeType !== Node.TEXT_NODE) return;
                    const original = node.nodeValue || "";
                    if (!original.trim()) return;
                    if (lastProcessedValue.get(node) === original) return;
                    const censored = nazafaCoreCensorText(original);
                    if (censored !== original) {
                        node.nodeValue = censored;
                        lastProcessedValue.set(node, censored);
                        console.log("🔒 Nazafa Amazon: اتشفّر سطر ترجمة:", original, "→", censored);
                    } else {
                        lastProcessedValue.set(node, original);
                    }
                });
            } catch (e) {
                console.error("❌ Nazafa Amazon: خطأ أثناء محاولة تشفير الترجمة:", e);
            }
        }

        const amazonCaptionsObserver = new MutationObserver((mutations) => {
            try {
                mutations.forEach((m) => {
                    m.addedNodes && m.addedNodes.forEach((n) => {
                        if (n.nodeType === Node.ELEMENT_NODE) {
                            if (n.matches && n.matches(AMAZON_CAPTIONS_SELECTOR)) censorAmazonCaptionElement(n);
                            n.querySelectorAll && n.querySelectorAll(AMAZON_CAPTIONS_SELECTOR).forEach(censorAmazonCaptionElement);
                        } else if (n.nodeType === Node.TEXT_NODE && n.parentElement) {
                            const el = n.parentElement.closest(AMAZON_CAPTIONS_SELECTOR);
                            if (el) censorAmazonCaptionElement(el);
                        }
                    });
                    if (m.type === "characterData" && m.target && m.target.parentElement) {
                        const el = m.target.parentElement.closest(AMAZON_CAPTIONS_SELECTOR);
                        if (el) censorAmazonCaptionElement(el);
                    }
                });
            } catch (e) {
                console.error("❌ Nazafa Amazon: خطأ جوه الـ MutationObserver:", e);
            }
        });
        amazonCaptionsObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

        document.querySelectorAll(AMAZON_CAPTIONS_SELECTOR).forEach(censorAmazonCaptionElement);
    }
})();
