console.log("🧠 Nazafa Engine: Isolated Brain Active.");

/* Sent with every NAZAFA_* message so main.script.js can tell our messages from the page's. */
const NAZAFA_NONCE = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID()
    : (Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2));

function broadcastToAllFrames(message) {
    const signed = Object.assign({}, message, { nonce: NAZAFA_NONCE });
    window.postMessage(signed, "*");
    document.querySelectorAll('iframe').forEach(f => {
        try { f.contentWindow.postMessage(signed, "*"); } catch (e) {}
    });
}

function nazafaSendHello() {
    try { window.postMessage({ type: "NAZAFA_HELLO", nonce: NAZAFA_NONCE }, "*"); } catch (e) {}
}
window.addEventListener("message", (event) => {
    if (event.source === window && event.data && event.data.type === "NAZAFA_MAIN_READY") nazafaSendHello();
});
nazafaSendHello();

/* After the extension is updated or removed, this copy is orphaned: chrome.runtime.id disappears. */
function nazafaContextAlive() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
}

window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "NAZAFA_SYNC_FILTERS") return;
    window.activeFilters = event.data.filters || [];
    currentLibraryKey = event.data.libraryKey || currentLibraryKey;
    disabledFilterIds = event.data.disabledFilterIds || disabledFilterIds;
    currentItemPlatforms = event.data.platforms || currentItemPlatforms;
});

let disneyPlayheadSeconds = null;
let disneyPlayheadReceivedAt = null;
let disneyPlayheadVideoTimeAtReceipt = null;
let nazafaLoggedFirstDisneyPlayhead = false;
let nazafaLoggedNoActiveFilters = false;
let nazafaLoggedNoDisneyPlayheadYet = false;
const nazafaScriptStartedAt = Date.now();
window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "NAZAFA_DISNEY_PLAYHEAD") return;
    disneyPlayheadSeconds = event.data.seconds;
    disneyPlayheadReceivedAt = Date.now();
    nazafaLoggedFirstDisneyPlayhead = true;
    try {
        const v = getActiveVideoElement();
        disneyPlayheadVideoTimeAtReceipt = v ? v.currentTime : null;
    } catch (e) {
        disneyPlayheadVideoTimeAtReceipt = null;
    }
});

let disneyLivePositionSeconds = null;
let disneyLivePositionReceivedAt = null;
window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "NAZAFA_DISNEY_LIVE_POSITION") return;
    disneyLivePositionSeconds = event.data.seconds;
    disneyLivePositionReceivedAt = Date.now();
});

let amazonLiveEpisodeId = null;
window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "NAZAFA_AMAZON_LIVE_EPISODE_ID") return;
    if (event.data.id && event.data.id !== amazonLiveEpisodeId) {
        amazonLiveEpisodeId = event.data.id;
        currentMovieId = null;
    }
});

let appleTVLiveEpisodeId = null;
window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "NAZAFA_APPLETV_LIVE_EPISODE_ID") return;
    if (event.data.id && event.data.id !== appleTVLiveEpisodeId) {
        appleTVLiveEpisodeId = event.data.id;
        currentMovieId = null;
        console.log("🍎 Nazafa AppleTV: اتلقط externalId حي للحلقة (من main.script.js):", event.data.id);
    }
});

chrome.runtime.onMessage.addListener((request) => {
    if (request.type !== "NAZAFA_APPLETV_LIVE_EPISODE_ID_FROM_BG") return;
    if (request.id && request.id !== appleTVLiveEpisodeId) {
        appleTVLiveEpisodeId = request.id;
        currentMovieId = null;
        console.log("🍎 Nazafa AppleTV: اتلقط externalId حي للحلقة (من الـ background):", request.id);
    }
});

let currentMovieId = null;
let currentLibraryKey = null;
let currentItemPlatforms = {};
let currentEpisodeNumber = 1;
let activeFilters = [];
let disabledFilterIds = {};
let isExecutingAction = false;
let lastCheckTime = 0;
let nazafaNearFilter = false;
const NAZAFA_ACTION_LEAD_S = 0.3;
/* Profanity timings already include padding, so mutes start closer to the word. */
const NAZAFA_MUTE_LEAD_S = 0.1;
const NAZAFA_NEAR_WINDOW_S = 3;
let nazafaLastMatchedFilterId = null;

let isPremium = true;
let lastSubscriptionCheckTime = 0;
const SUBSCRIPTION_RECHECK_INTERVAL_MS = 5 * 60 * 1000;

function refreshLocalSubscriptionFlag() {
    chrome.runtime.sendMessage({ type: "GET_SUBSCRIPTION_STATUS" }, (response) => {
        if (chrome.runtime.lastError) return;
        const wasPremium = isPremium;
        isPremium = true;
        if (wasPremium && !isPremium) {
            window.activeFilters = [];
            broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "unmute" });
            broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "unblur" });
            console.warn("🔒 Nazafa: انتهت صلاحية الاشتراك، تم إيقاف الفلترة.");
        }
    });
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "SUBSCRIPTION_STATUS_CHANGED") {
        isPremium = true;
        if (!isPremium) {
            window.activeFilters = [];
            broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "unmute" });
            broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "unblur" });
        }
    }
});

const NazafaCore = globalThis.SalikFilterCore;

function nazafaShouldFilterItem(filterItem) {
    return NazafaCore.shouldFilter(filterItem, filterSettings);
}

function nazafaBuildDefaultFilterSettings() {
    return NazafaCore.buildDefaultSettings();
}

let filterSettings = nazafaBuildDefaultFilterSettings();
let userSettings = { nudity: true, violence: true, language: true, substance: true };

let nazafaSubtitleCensorEnabled = true;
let nazafaYtAutoMuteEnabled = true;

function broadcastSubtitleCensorSetting() {
    const insultsEnabled = !!(filterSettings.language && filterSettings.language.enabled !== false && filterSettings.language.subs && filterSettings.language.subs.insults !== false);
    const groups = {};
    const subs = {};
    Object.keys(filterSettings).forEach((g) => {
        groups[g] = filterSettings[g].enabled !== false;
        subs[g] = Object.assign({}, filterSettings[g].subs || {});
    });
    broadcastToAllFrames({ type: "NAZAFA_SUBTITLE_CENSOR_SETTING", enabled: nazafaSubtitleCensorEnabled, insultsEnabled, ytAutoMute: nazafaYtAutoMuteEnabled, groups, subs });
}

chrome.storage.sync.get(['nazafaSubtitleCensorEnabled', 'nazafaYtAutoMuteEnabled'], (res) => {
    if (res.nazafaSubtitleCensorEnabled !== undefined) nazafaSubtitleCensorEnabled = res.nazafaSubtitleCensorEnabled;
    if (res.nazafaYtAutoMuteEnabled !== undefined) nazafaYtAutoMuteEnabled = res.nazafaYtAutoMuteEnabled;
    broadcastSubtitleCensorSetting();
});

chrome.storage.sync.get(['nazafaFilterSettings', 'filter_nudity', 'filter_violence', 'filter_language', 'filter_substance'], (res) => {
    if (res.nazafaFilterSettings) {
        for (const groupKey of Object.keys(filterSettings)) {
            const g = res.nazafaFilterSettings[groupKey];
            if (!g) continue;
            if (g.enabled !== undefined) filterSettings[groupKey].enabled = g.enabled;
            if (g.subs) Object.assign(filterSettings[groupKey].subs, g.subs);
        }
    } else {
        if (res.filter_nudity !== undefined) filterSettings.nudity.enabled = res.filter_nudity;
        if (res.filter_violence !== undefined) filterSettings.violence.enabled = res.filter_violence;
        if (res.filter_language !== undefined) filterSettings.language.enabled = res.filter_language;
        if (res.filter_substance !== undefined) filterSettings.substance.enabled = res.filter_substance;
    }
    for (const groupKey of Object.keys(filterSettings)) userSettings[groupKey] = filterSettings[groupKey].enabled;
    userSettings.insults = !!(filterSettings.language && filterSettings.language.subs && filterSettings.language.subs.insults !== false);
    broadcastSubtitleCensorSetting();
});

/* ---------- YouTube: skip sponsor / subscribe reminders / intro-outro (SponsorBlock data) ---------- */
let nazafaYtSkip = NazafaCore.defaultYtSkip();
let nazafaSbVideoId = null;
let nazafaSbAnswer = null;
let nazafaSbFilters = [];
let nazafaCaptionSkips = { videoId: null, segments: [] };

function nazafaRebuildSbFilters() {
    const sb = nazafaSbAnswer ? NazafaCore.sponsorBlockToFilters(nazafaSbAnswer, nazafaSbVideoId, nazafaYtSkip) : [];
    const caps = nazafaCaptionSkips.videoId && nazafaCaptionSkips.videoId === nazafaSbVideoId
        ? NazafaCore.captionReminderFilters(nazafaCaptionSkips.segments, nazafaYtSkip) : [];
    nazafaSbFilters = sb.concat(caps);
}

/* Subscribe / like requests that main.script.js found in the video's captions. */
window.addEventListener("message", (event) => {
    const d = event.data;
    if (event.source !== window || !d || d.type !== "NAZAFA_YT_CAPTION_SKIPS" || typeof d.videoId !== "string" || !Array.isArray(d.segments)) return;
    nazafaCaptionSkips = { videoId: d.videoId, segments: d.segments.slice(0, 50).map((s) => ({ start: Number(s.start), end: Number(s.end), text: String(s.text || "") })) };
    nazafaRebuildSbFilters();
});

async function nazafaSha256Prefix(text) {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(d)).slice(0, 2).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nazafaLoadSponsorBlock(videoId) {
    if (videoId === nazafaSbVideoId) return;
    nazafaSbVideoId = videoId;
    nazafaSbAnswer = null;
    nazafaRebuildSbFilters();
    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return;
    nazafaSha256Prefix(videoId).then((prefix) => {
        chrome.runtime.sendMessage({ type: "FETCH_SPONSORBLOCK", prefix, categories: NazafaCore.ytSkipCategories(NazafaCore.defaultYtSkip()) }, (res) => {
            if (chrome.runtime.lastError || !res || !res.success || nazafaSbVideoId !== videoId) return;
            nazafaSbAnswer = res.data;
            nazafaRebuildSbFilters();
            if (nazafaSbFilters.length) console.log("⏭️ Salik: " + nazafaSbFilters.length + " YouTube segment(s) to skip (SponsorBlock)");
        });
    }).catch(() => {});
}

chrome.storage.sync.get(['nazafaYtSkip'], (res) => {
    if (res && res.nazafaYtSkip) nazafaYtSkip = Object.assign(NazafaCore.defaultYtSkip(), res.nazafaYtSkip);
    nazafaRebuildSbFilters();
});

chrome.runtime.onMessage.addListener((request) => {
    if (request.type !== "UPDATE_YT_SKIP_SETTING") return;
    nazafaYtSkip = Object.assign(NazafaCore.defaultYtSkip(), request.value || {});
    nazafaRebuildSbFilters();
});

let lastReportedDurationMinutes = null;
function reportVideoDurationIfChanged(video) {
    try {
        if (!video || !isFinite(video.duration) || video.duration <= 0) return;
        const minutes = Math.round((video.duration / 60) * 10) / 10;
        if (minutes === lastReportedDurationMinutes) return;
        lastReportedDurationMinutes = minutes;
        chrome.storage.local.set({ nazafaVideoDurationMinutes: minutes });
    } catch (e) {}
}

function loadDisabledFiltersForCurrentItem() {
    if (!currentLibraryKey) { disabledFilterIds = {}; return; }
    chrome.storage.local.get(['disabledFilters'], (res) => {
        const all = res.disabledFilters || {};
        disabledFilterIds = all[currentLibraryKey] || {};
    });
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "UPDATE_FILTER_SETTINGS") {
        userSettings[request.category] = request.enabled;
        if (filterSettings[request.category]) filterSettings[request.category].enabled = request.enabled;
        broadcastSubtitleCensorSetting();
    }
    if (request.type === "UPDATE_SUBCATEGORY_SETTINGS" && filterSettings[request.category]) {
        filterSettings[request.category].subs[request.subKey] = request.enabled;
        if (request.category === "language" && request.subKey === "insults") userSettings.insults = !!request.enabled;
        broadcastSubtitleCensorSetting();
    }
    if (request.type === "UPDATE_SUBTITLE_CENSOR_SETTING") {
        nazafaSubtitleCensorEnabled = !!request.enabled;
        broadcastSubtitleCensorSetting();
    }
    if (request.type === "UPDATE_YT_AUTOMUTE_SETTING") {
        nazafaYtAutoMuteEnabled = !!request.enabled;
        broadcastSubtitleCensorSetting();
    }
    if (request.type === "UPDATE_DISABLED_FILTERS" && request.itemKey === currentLibraryKey) {
        if (request.enabled) {
            delete disabledFilterIds[request.filterId];
        } else {
            disabledFilterIds[request.filterId] = true;
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type !== "NAZAFA_GET_CURRENT_ITEM") return;
    sendResponse({ movieId: currentMovieId, platform: detectPlatform() });
});

function detectPlatform() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("netflix")) return "netflix";
    if (host.includes("osnplus") || host.includes("osn")) return "osnplus";
    if (host.includes("yango")) return "yango";
    if (host.includes("disneyplus") || host.includes("disney")) return "disney";
    if (host.includes("primevideo") || host.includes("amazon")) return "amazon";
    if (host.includes("shahid")) return "shahid";
    if (host.includes("watchit")) return "watchit";
    if (host.includes("youtube")) return "youtube";
    if (host.includes("starzplay")) return "starzplay";
    if (host.includes("jawwy")) return "jawwy";
    if (host.includes("stctv")) return "stctv";
    if (host.includes("dailymotion") || host.includes("dai.ly")) return "dailymotion";
    if (host.includes("tod.tv")) return "tod";
    if (host.includes("beinconnect") || host.includes("bein")) return "beinconnect";
    if (host.includes("tv.apple.com")) return "appletv";
    if (host.includes("stremio")) return "stremio"; 
    try { if (window.__SALIK_STREMIO_ORIGIN && location.origin === window.__SALIK_STREMIO_ORIGIN) return "stremio"; } catch (e) {}
    return "general";
}

function extractStremioId(rawUrl) {
    const u = String(rawUrl || "").replace(/%3A/gi, ":");
    const m = u.match(/\/(?:movie|series)\/(tt\d{7,9})(?:\/(tt\d{7,9}(?::\d+:\d+)?))?/i);
    if (m) return m[2] || m[1];
    const ep = u.match(/(tt\d{7,9}:\d+:\d+)/i);
    if (ep) return ep[1];
    const t = u.match(/(tt\d{7,9})/i);
    return t ? t[1] : null;
}

function getMovieId() {
    const url = window.location.href;
    const hashIndex = url.indexOf('#');
    const pathname = hashIndex !== -1 ? url.slice(hashIndex + 1).split('?')[0] : window.location.pathname;
    let detectedId = null;
    if (window.location.hostname.toLowerCase().includes("stremio") || detectPlatform() === "stremio") {
        const sid = extractStremioId(url);
        if (sid) return sid;
    }
    try {
        if (detectPlatform() === "watchit") {
            const watchitEpisodeMatch = pathname.match(/\/(?:movies|series)\/(?:\d+\/)*(\d+)/i);
            if (watchitEpisodeMatch && watchitEpisodeMatch[1]) return watchitEpisodeMatch[1];
        }

        if (detectPlatform() === "shahid") {
            const shahidMatch = pathname.match(/(?:movie|series|show|episode|season|id)-(\d{5,})/i);
            return shahidMatch ? shahidMatch[1] : null;
        }

        const youtubeMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,15})/i)
            || url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,15})/i)
            || pathname.match(/\/shorts\/([a-zA-Z0-9_-]{6,15})/i);
        if (youtubeMatch && youtubeMatch[1]) return youtubeMatch[1];

        const dailymotionMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/i)
            || url.match(/dai\.ly\/([a-zA-Z0-9]+)/i)
            || url.match(/[?&]video=([a-zA-Z0-9]+)/i);
        if (dailymotionMatch && dailymotionMatch[1]) return dailymotionMatch[1];

        const disneyPlayMatch = pathname.match(/\/play\/([a-f0-9-]{36})/i);
        if (disneyPlayMatch && disneyPlayMatch[1]) return disneyPlayMatch[1];
        const disneyEntityMatch = pathname.match(/entity-([a-f0-9-]{36})/i);
        if (disneyEntityMatch && disneyEntityMatch[1]) return disneyEntityMatch[1];

        const hashMatch = url.match(/\/([a-f0-9]{24,40})\b/i);
        if (hashMatch && hashMatch[1]) return hashMatch[1].trim();
        const titleMatch = pathname.match(/\/title\/([a-zA-Z0-9_-]+)/i);
        if (titleMatch && titleMatch[1]) return titleMatch[1].trim();
        const watchMatch = pathname.match(/(?:watch|video|play|series|movie)\/(\d+)/i);
        if (watchMatch && watchMatch[1]) return watchMatch[1];
        const pluralIdMatch = pathname.match(/\/(?:movies|series)\/(\d+)(?:\/|$)/i);
        if (pluralIdMatch && pluralIdMatch[1]) return pluralIdMatch[1];
        const osnMatch = pathname.match(/\/(?:movie|series|episode)\/[^\/]+-(\d{4,})/i);
        if (osnMatch && osnMatch[1]) return osnMatch[1];
        const dashIdMatch = pathname.match(/(?:movie|series|id)-(\d+)/i);
        if (dashIdMatch && dashIdMatch[1]) return dashIdMatch[1];
        const trailingDashIdMatch = pathname.match(/-(\d+)\/?$/);
        if (trailingDashIdMatch && trailingDashIdMatch[1]) return trailingDashIdMatch[1];
        const amazonIdMatch = pathname.match(/\/(?:title|detail)\/([a-zA-Z0-9_-]{10,40})/i) || url.match(/gti=([^&]+)/);
        if (amazonIdMatch && amazonIdMatch[1]) return amazonIdMatch[1].trim();
        const appleMatch = url.match(/(umc\.cmc\.[a-z0-9]+)/i);
        if (appleMatch && appleMatch[1]) return appleMatch[1];
        const disneyMatch = pathname.match(/\/movies\/[^\/]+\/([a-z0-9]+)/i);
        if (disneyMatch && disneyMatch[1]) return disneyMatch[1];
        
        const stremioId = extractStremioId(url);
        if (stremioId) return stremioId;


        if (detectPlatform() === "general") return detectedId;

        const trailingIdMatch = pathname.match(/\/(\d+)\/?$/);
        if (trailingIdMatch && trailingIdMatch[1]) return trailingIdMatch[1];
        const genericNumericSegmentMatch = pathname.match(/\/(\d{6,})(?:\/|$)/);
        if (genericNumericSegmentMatch && genericNumericSegmentMatch[1]) return genericNumericSegmentMatch[1];
        const NON_ID_TRAILING_WORDS = new Set(["watch", "play", "player", "details", "detail", "stream", "streaming", "view", "index", "home", "movies", "movie", "series", "shows", "show", "search", "browse", "explore", "discover", "live", "kids", "categories", "category", "genres", "genre", "profile", "profiles", "account", "settings", "login", "signin", "signup", "subscribe", "favorites", "watchlist", "mylist", "my-list", "library", "channels", "sports", "news", "originals"]);
        const genericTrailingSlugMatch = pathname.match(/\/([a-zA-Z0-9_-]{4,40})\/?$/);
        if (genericTrailingSlugMatch && genericTrailingSlugMatch[1] && !NON_ID_TRAILING_WORDS.has(genericTrailingSlugMatch[1].toLowerCase())) {
            return genericTrailingSlugMatch[1];
        }
    } catch (e) { console.error("❌ Nazafa Brain: Error parsing URL for ID", e); }
    return detectedId;
}

function extractEpisodeNumberFromDOM() {
    const n = nazafaDomEpisodeOrNull();
    return n !== null ? n : currentEpisodeNumber;
}

function nazafaDomEpisodeOrNull() {
    try {
        const selectors = ['.f1v67gbe', '.skip-text', '[data-automation-id="player-title"]', '.playback-title'];
        for (let selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
                const text = element.textContent.toLowerCase();
                const match = text.match(/(?:episode|ep|الحلقة|حلقة)\s*(\d+)/i) || text.match(/\be(\d+)\b/i);
                if (match && match[1]) return parseInt(match[1], 10);
            }
        }
    } catch (e) {}
    return null;
}

function getActiveVideoElement() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    const realVideos = NazafaCore.titleVideoCandidates(videos);
    if (realVideos.length === 0) return null;
    if (realVideos.length === 1) return realVideos[0];
    return realVideos.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight))[0];
}

function fetchFiltersFromBackground(movieId, episodeNumber) {
    chrome.runtime.sendMessage({
        type: "FETCH_FILTERS_BACKGROUND", movieId: movieId, episode: episodeNumber,
        platform: detectPlatform(), domEpisode: nazafaDomEpisodeOrNull(), pageUrl: location.href
    }, (response) => {
        if (chrome.runtime.lastError) {
            setTimeout(() => { if (currentMovieId === movieId) currentMovieId = null; }, 3000);
            return;
        }
        if (response && response.success) {
            window.activeFilters = response.data.filters || [];
            currentLibraryKey = response.data._libraryKey || movieId;
            currentItemPlatforms = response.data.platforms || {};
            loadDisabledFiltersForCurrentItem();
            broadcastToAllFrames({
                type: "NAZAFA_SYNC_FILTERS",
                filters: window.activeFilters,
                libraryKey: currentLibraryKey,
                disabledFilterIds: disabledFilterIds,
                platforms: currentItemPlatforms
            });
            broadcastSubtitleCensorSetting();
        } else if (response && response.error === "SUBSCRIPTION_REQUIRED") {
            window.activeFilters = [];
        } else {
            window.activeFilters = [];
            currentLibraryKey = null;
            currentItemPlatforms = {};
            disabledFilterIds = {};
            broadcastToAllFrames({
                type: "NAZAFA_SYNC_FILTERS",
                filters: [],
                libraryKey: null,
                disabledFilterIds: {},
                platforms: {}
            });
        }
    });
}

function brainLoop(timestamp) {
    if (!nazafaContextAlive()) {
        console.log("Nazafa: extension context gone (updated or removed), engine stopped in this copy.");
        return;
    }
    if (timestamp - lastCheckTime > 300) {
        lastCheckTime = timestamp;

        if (!isPremium) {
            if (timestamp - lastSubscriptionCheckTime > SUBSCRIPTION_RECHECK_INTERVAL_MS) {
                lastSubscriptionCheckTime = timestamp;
                refreshLocalSubscriptionFlag();
            }
            requestAnimationFrame(brainLoop);
            return;
        }

        const nazafaDetectedPlatformNow = detectPlatform();
        const detectedId = (nazafaDetectedPlatformNow === "amazon" && amazonLiveEpisodeId) ? amazonLiveEpisodeId
            : (nazafaDetectedPlatformNow === "appletv" && appleTVLiveEpisodeId) ? appleTVLiveEpisodeId
            : getMovieId();
        if (nazafaDetectedPlatformNow === "youtube") nazafaLoadSponsorBlock(detectedId);
        const detectedEpisode = extractEpisodeNumberFromDOM();
        if (detectedId && (detectedId !== currentMovieId || detectedEpisode !== currentEpisodeNumber)) {
            currentMovieId = detectedId;
            currentEpisodeNumber = detectedEpisode;
            fetchFiltersFromBackground(currentMovieId, currentEpisodeNumber);
        }
        processActiveFilters();
    } else if (nazafaNearFilter) {
        processActiveFilters();
    }
    requestAnimationFrame(brainLoop);
}


function processActiveFilters() {
    const nazafaFilters = nazafaSbFilters.length ? (window.activeFilters || []).concat(nazafaSbFilters) : window.activeFilters;
    if (!nazafaFilters || nazafaFilters.length === 0) {
        nazafaNearFilter = false;
        nazafaReleaseEngineState();
        return;
    }
    if (isExecutingAction) return;

    const video = getActiveVideoElement();
    if (!video) { nazafaReleaseEngineState(); return; }
    reportVideoDurationIfChanged(video);

    const platform = detectPlatform();
    const platformOffset = Number(currentItemPlatforms && currentItemPlatforms[platform] && currentItemPlatforms[platform].offset_seconds) || 0;

    const DISNEY_PLAYHEAD_MAX_AGE_MS = 6 * 60 * 60 * 1000;
    const hasFreshDisneyPlayhead = platform === "disney"
        && disneyPlayheadSeconds !== null
        && disneyPlayheadReceivedAt !== null
        && (Date.now() - disneyPlayheadReceivedAt) < DISNEY_PLAYHEAD_MAX_AGE_MS;

    const DISNEY_LIVE_POSITION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
    const hasLiveDisneyPosition = platform === "disney"
        && disneyLivePositionSeconds !== null
        && disneyLivePositionReceivedAt !== null
        && (Date.now() - disneyLivePositionReceivedAt) < DISNEY_LIVE_POSITION_MAX_AGE_MS;

    if (platform === "disney" && !hasLiveDisneyPosition && !hasFreshDisneyPlayhead
        && !nazafaLoggedNoDisneyPlayheadYet && (Date.now() - nazafaScriptStartedAt) > 45000) {
        nazafaLoggedNoDisneyPlayheadYet = true;
        console.warn("⚠️ Nazafa Disney: لسه مفيش أي قيمة موضع حقيقية وصلت (لا من stateStore ولا من الـ playback API) — شغالين بـ video.currentTime بس كـ fallback، وده ممكن يبقى غير دقيق.");
    }

    let time;
    if (hasLiveDisneyPosition) {
        time = disneyLivePositionSeconds + platformOffset;
    } else if (hasFreshDisneyPlayhead) {
        const videoTimeDelta = (disneyPlayheadVideoTimeAtReceipt !== null)
            ? (video.currentTime - disneyPlayheadVideoTimeAtReceipt)
            : null;
        const canUseVideoDelta = videoTimeDelta !== null && videoTimeDelta >= -1.5;

        if (canUseVideoDelta) {
            time = disneyPlayheadSeconds + Math.max(0, videoTimeDelta) + platformOffset;
        } else {
            const elapsedRealSeconds = (Date.now() - disneyPlayheadReceivedAt) / 1000;
            const rate = video.paused ? 0 : (video.playbackRate || 1);
            time = disneyPlayheadSeconds + (elapsedRealSeconds * rate) + platformOffset;
        }

        const DISNEY_TELEMETRY_LAG_COMPENSATION_SECONDS = 0;
        time += DISNEY_TELEMETRY_LAG_COMPENSATION_SECONDS;
    } else {
        time = video.currentTime + platformOffset;
    }


    const resolved = NazafaCore.resolveActiveFilters(nazafaFilters, time, {
        disabledIds: disabledFilterIds,
        settings: filterSettings,
        lead: NAZAFA_ACTION_LEAD_S,
        muteLead: NAZAFA_MUTE_LEAD_S,
        nearWindow: NAZAFA_NEAR_WINDOW_S
    });
    nazafaNearFilter = resolved.near;

    const primary = resolved.skip || resolved.blur || resolved.mute;
    if (primary && nazafaLastMatchedFilterId !== primary.id) { nazafaLastMatchedFilterId = primary.id; console.log("✅ Nazafa Brain: Match Found!"); }
    if (!primary) nazafaLastMatchedFilterId = null;

    if (resolved.skip) {
        const targetEnd = NazafaCore.timing(resolved.skip).end;
        isExecutingAction = true;
        const disneyDelta = (platform === "disney" ? targetEnd + 0.4 : targetEnd) - time;
        broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "skip", targetTime: targetEnd - platformOffset, disneyDelta: disneyDelta, platform: platform });

        if (platform === "disney") {
            disneyPlayheadSeconds = (targetEnd - platformOffset) + 0.75;
            disneyPlayheadReceivedAt = Date.now();
            disneyPlayheadVideoTimeAtReceipt = video.currentTime + disneyDelta;
            disneyLivePositionSeconds = (targetEnd - platformOffset) + 0.75;
            disneyLivePositionReceivedAt = Date.now();
        }

        setTimeout(() => { isExecutingAction = false; }, 1000);
        return;
    }

    nazafaApplyEngineState(resolved.mute, resolved.blur, platform);
}

let nazafaEngineMuted = false;
let nazafaEngineBlurKey = null;
let nazafaLastKeepAliveAt = 0;
const NAZAFA_KEEPALIVE_MS = 300;

function nazafaBlurMessage(f) {
    if (NazafaCore.actionOf(f) === "partial_blur") {
        const region = f.blur_region;
        const validRegion = region && typeof region.x === "number" && typeof region.y === "number"
            && typeof region.width === "number" && typeof region.height === "number";
        if (validRegion) {
            return { type: "NAZAFA_EXECUTE_ACTION", action: "partial_blur", region: region, description: f.original_description || "تم تغبيش جزء من هذا المشهد" };
        }
        console.warn("⚠️ Nazafa: فلتر partial_blur من غير blur_region صالح — رجعنا للتغبيش الكامل كاحتياط:", f);
    }
    return { type: "NAZAFA_EXECUTE_ACTION", action: "blur", description: f.original_description || "تم تغبيش هذا المشهد" };
}

function nazafaApplyEngineState(muteFilter, blurFilter, platform) {
    const now = Date.now();
    const keepAlive = now - nazafaLastKeepAliveAt >= NAZAFA_KEEPALIVE_MS;

    if (muteFilter) {
        if (!nazafaEngineMuted || keepAlive) broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "mute" });
        nazafaEngineMuted = true;
    } else if (nazafaEngineMuted) {
        broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "unmute" });
        nazafaEngineMuted = false;
    }

    const blurKey = blurFilter ? (blurFilter.id + ":" + NazafaCore.actionOf(blurFilter)) : null;
    if (blurFilter) {
        if (blurKey !== nazafaEngineBlurKey || keepAlive) broadcastToAllFrames(nazafaBlurMessage(blurFilter));
        nazafaEngineBlurKey = blurKey;
    } else if (nazafaEngineBlurKey !== null) {
        broadcastToAllFrames({ type: "NAZAFA_EXECUTE_ACTION", action: "unblur" });
        nazafaEngineBlurKey = null;
    }

    if (keepAlive) nazafaLastKeepAliveAt = now;
}

function nazafaReleaseEngineState() {
    nazafaApplyEngineState(null, null, detectPlatform());
}
requestAnimationFrame(brainLoop);