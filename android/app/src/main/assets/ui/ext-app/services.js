import "../../shared/filter-core.js";

export const SUPPORTED_PLATFORMS = ["netflix", "amazon", "osnplus", "yango", "disney", "shahid", "appletv", "watchit", "tod", "youtube", "starzplay", "jawwy", "stctv", "dailymotion", "beinconnect", "stremio"];

let _libraryCache = {};

export function getUrlForPlatform(item, platform) {
    if (item && item.platforms && item.platforms[platform] && item.platforms[platform].url) {
        return item.platforms[platform].url;
    }
    return null;
}

export async function getCurrentTabInfo() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return { movieId: null, platform: "unknown" };

    const url = tabs[0].url || "";

    try {
        const liveInfo = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: "NAZAFA_GET_CURRENT_ITEM" }, (response) => {
                if (chrome.runtime.lastError || !response) { resolve(null); return; }
                resolve(response);
            });
        });
        if (liveInfo && liveInfo.movieId && liveInfo.platform && liveInfo.platform !== "unknown") {
            return { platform: liveInfo.platform, movieId: liveInfo.movieId };
        }
    } catch (e) {}

    const imdbMatch = url.match(/(tt\d{7,8})/i);
    if (imdbMatch && imdbMatch[1] && url.includes("stremio.com")) {
        return { platform: "stremio", movieId: imdbMatch[1] };
    }

    let pathname = "";
    try { pathname = new URL(url).pathname; } catch (e) {}

    const platformConfigs = {
        "shahid": { regex: /(?:movie|series|id)-(\d+)/ },
        "tod": { regex: /-(\d+)\/?$/ },
        "watchit": { regex: /\/(?:movies|series)\/(?:\d+\/)*(\d+)/ },
        "netflix": { regex: /\/(?:title|watch)\/(\d+)/ },
        "amazon": { regex: /\/(?:title|detail)\/([a-zA-Z0-9_-]{10,40})|gti=([^&]+)/i },
        "disney": { regex: /\/play\/([a-f0-9-]{36})|entity-([a-f0-9-]{36})|\/movies\/[^\/]+\/([a-z0-9]+)/i },
        "appletv": { regex: /(umc\.cmc\.[a-z0-9]+)/i },
        "osnplus": { regex: /\/(?:movie|series|episode)\/[^\/]+-(\d+)/ },
        "yango": { regex: /\b([a-f0-9]{24,40})\b/i },
        "youtube": { regex: /(?:[?&]v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{6,15})/i },
        "dailymotion": { regex: /(?:dailymotion\.com\/video\/|dai\.ly\/|[?&]video=)([a-zA-Z0-9]+)/i }
    };

    let detectedPlatform = "unknown";
    for (const [platform, config] of Object.entries(platformConfigs)) {
        const hostMatches = url.includes(platform)
            || (platform === "dailymotion" && url.includes("dai.ly"))
            || (platform === "appletv" && url.includes("tv.apple.com"))
            || (platform === "amazon" && url.includes("primevideo"));
        if (hostMatches) {
            const match = url.match(config.regex);
            const capturedId = match && (match[1] || match[2] || match[3]);
            if (capturedId) {
                return { platform: platform, movieId: capturedId };
            }
            detectedPlatform = platform;
            break;
        }
    }

    if (detectedPlatform === "unknown") {
        const genericHosts = { "starzplay": "starzplay", "jawwy": "jawwy", "stctv": "stctv", "bein": "beinconnect" };
        for (const key in genericHosts) {
            if (url.includes(key)) { detectedPlatform = genericHosts[key]; break; }
        }
    }

    if (detectedPlatform !== "unknown") {
        const hashMatch = url.match(/\/([a-f0-9]{24,40})\b/i);
        const titleMatch = pathname.match(/\/title\/([a-zA-Z0-9_-]+)/i);
        const watchMatch = pathname.match(/(?:watch|video|play|series|movie|vod)\/(\d+)/i);
        const dashIdMatch = pathname.match(/(?:movie|series|id)-(\d+)/i);
        const trailingIdMatch = pathname.match(/\/([a-zA-Z0-9_-]{4,40})\/?$/);
        const NON_ID_TRAILING_WORDS = new Set(["watch", "play", "player", "details", "detail", "stream", "streaming", "view", "index", "home", "movies", "movie", "series", "shows", "show", "search", "browse", "explore", "discover", "live", "kids", "categories", "category", "genres", "genre", "profile", "profiles", "account", "settings", "login", "signin", "signup", "subscribe", "favorites", "watchlist", "mylist", "my-list", "library", "channels", "sports", "news", "originals"]);
        const safeTrailingIdMatch = (trailingIdMatch && !NON_ID_TRAILING_WORDS.has(trailingIdMatch[1].toLowerCase())) ? trailingIdMatch : null;
        const generic = hashMatch || titleMatch || watchMatch || dashIdMatch || safeTrailingIdMatch;
        if (generic && generic[1]) {
            return { platform: detectedPlatform, movieId: generic[1] };
        }
    }

    return { movieId: null, platform: detectedPlatform };
}

export function idAppearsAsWholeSegment(url, id) {
    if (!url || !id) return false;
    if (String(id).length < 3) return false;
    const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(^|[^0-9A-Za-z])' + escaped + '($|[^0-9A-Za-z])');
    return re.test(String(url));
}

export function findMovieByPlatformId(library, platform, urlId) {
    if (!library || !urlId) return null;
    if (library[urlId]) return { key: urlId, item: library[urlId] };
    for (let id in library) {
        const item = library[id];
        if (!item) continue;
        if (String(id) === String(urlId)) return { key: id, item };
        const platformEntry = item.platforms && item.platforms[platform];
        if (platformEntry && (
            String(platformEntry.id) === String(urlId) ||
            (platformEntry.url && idAppearsAsWholeSegment(platformEntry.url, urlId))
        )) {
            return { key: id, item };
        }
    }
    return null;
}

export async function fetchLibrary() {
    if (_libraryCache && Object.keys(_libraryCache).length > 0) {
        return _libraryCache;
    }
    try {
        const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "FETCH_LIBRARY_DATA" }, (res) => {
                resolve(chrome.runtime.lastError ? { success: false, error: chrome.runtime.lastError.message } : res);
            });
        });
        _libraryCache = (result && result.success && result.data) ? result.data : {};
    } catch (e) {
        console.error("Error fetching unified library:", e);
        _libraryCache = {};
    }
    return _libraryCache;
}

export function getDisabledFiltersStore() {
    return new Promise(resolve => {
        chrome.storage.local.get(['disabledFilters'], (res) => {
            resolve(res.disabledFilters || {});
        });
    });
}

export async function getDisabledFiltersMap(itemKey) {
    if (!itemKey) return {};
    const all = await getDisabledFiltersStore();
    return all[itemKey] || {};
}

export async function setFilterEnabled(itemKey, filterId, enabled) {
    if (!itemKey) return;
    const all = await getDisabledFiltersStore();
    if (!all[itemKey]) all[itemKey] = {};

    if (enabled) {
        delete all[itemKey][filterId];
        if (Object.keys(all[itemKey]).length === 0) delete all[itemKey];
    } else {
        all[itemKey][filterId] = true;
    }

    chrome.storage.local.set({ disabledFilters: all });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: "UPDATE_DISABLED_FILTERS",
                itemKey: itemKey,
                filterId: filterId,
                enabled: enabled
            }, () => {
                void chrome.runtime.lastError;
            });
        }
    });
}

export function getPlatformLabel(p) {
    const labels = { "netflix": "نتفليكس", "amazon": "أمازون", "yango": "يانجو", "osnplus": "OSN+", "disney": "ديزني+", "shahid": "شاهد", "watchit": "واتش ات", "tod": "تود", "youtube": "يوتيوب", "starzplay": "Starzplay", "jawwy": "Jawwy TV", "stctv": "STC tv", "dailymotion": "Dailymotion", "beinconnect": "beIN Connect", "stremio": "Stremio" };
    return labels[p] || p;
}

const Core = globalThis.SalikFilterCore;

export const SUBCATEGORY_SCHEMA = Core.SUBCATEGORY_SCHEMA;
export const OTHER_SUBKEY = Core.OTHER_SUBKEY;
export const categorizeFilters = Core.categorizeFilters;
export const normalizeToGroupKey = Core.normalizeToGroupKey;
export const matchSubcategory = Core.matchSubcategory;
export const matchAllSubcategories = Core.matchAllSubcategories;
export const classifyFilter = Core.classify;
export const shouldFilter = Core.shouldFilter;
export const categorizeFiltersDetailed = Core.categorizeFiltersDetailed;
export const titleGroupStates = Core.titleGroupStates;
export const toggleTitleGroupStore = Core.toggleTitleGroupStore;

const LEGACY_FLAT_KEYS = { nudity: "filter_nudity", violence: "filter_violence", language: "filter_language", substance: "filter_substance" };
const SETTINGS_STORAGE_KEY = "nazafaFilterSettings";

function buildDefaultSettings() {
    return Core.buildDefaultSettings();
}

export async function getFilterSettings() {
    const stored = await new Promise((resolve) => {
        chrome.storage.sync.get([SETTINGS_STORAGE_KEY, ...Object.values(LEGACY_FLAT_KEYS)], resolve);
    });
    const defaults = buildDefaultSettings();
    const existing = stored[SETTINGS_STORAGE_KEY];
    if (existing) {
        for (const groupKey of Object.keys(defaults)) {
            const g = existing[groupKey];
            if (!g) continue;
            defaults[groupKey].enabled = g.enabled !== undefined ? g.enabled : defaults[groupKey].enabled;
            if (g.subs) {
                for (const subKey of Object.keys(defaults[groupKey].subs)) {
                    if (g.subs[subKey] !== undefined) defaults[groupKey].subs[subKey] = g.subs[subKey];
                }
            }
        }
        return defaults;
    }
    for (const [groupKey, flatKey] of Object.entries(LEGACY_FLAT_KEYS)) {
        if (stored[flatKey] !== undefined) defaults[groupKey].enabled = stored[flatKey];
    }
    return defaults;
}

export async function setGroupEnabled(groupKey, enabled) {
    const settings = await getFilterSettings();
    settings[groupKey].enabled = enabled;
    chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settings, [LEGACY_FLAT_KEYS[groupKey]]: enabled });
    return settings;
}

export async function setSubcategoryEnabled(groupKey, subKey, enabled) {
    const settings = await getFilterSettings();
    settings[groupKey].subs[subKey] = enabled;
    chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settings });
    return settings;
}

export const SEVERITY_META = {
    none: { color: "#94a3b8", bg: "#f1f5f9", label: "لا يوجد" },
    light: { color: "#10b981", bg: "#ecfdf5", label: "خفيف" },
    moderate: { color: "#f59e0b", bg: "#fffbeb", label: "متوسط" },
    heavy: { color: "#ef4444", bg: "#fef2f2", label: "كثيف" }
};

export function getSeverityLevel(count, durationMinutes) {
    if (!count) return "none";
    if (durationMinutes && durationMinutes > 0) {
        const perHour = count / (durationMinutes / 60);
        if (perHour < 2) return "light";
        if (perHour < 6) return "moderate";
        return "heavy";
    }
    if (count <= 2) return "light";
    if (count <= 6) return "moderate";
    return "heavy";
}

const SUBTITLE_CENSOR_STORAGE_KEY = "nazafaSubtitleCensorEnabled";

const YT_AUTOMUTE_STORAGE_KEY = "nazafaYtAutoMuteEnabled";

export async function getYtAutoMuteEnabled() {
    const res = await new Promise((resolve) => chrome.storage.sync.get([YT_AUTOMUTE_STORAGE_KEY], resolve));
    return res[YT_AUTOMUTE_STORAGE_KEY] !== undefined ? res[YT_AUTOMUTE_STORAGE_KEY] : true;
}

export async function setYtAutoMuteEnabled(enabled) {
    chrome.storage.sync.set({ [YT_AUTOMUTE_STORAGE_KEY]: enabled });
    chrome.tabs.query({}, (tabs) => {
        (tabs || []).forEach((tab) => {
            if (tab.url && /youtube\.com/i.test(tab.url)) {
                chrome.tabs.sendMessage(tab.id, { type: "UPDATE_YT_AUTOMUTE_SETTING", enabled }, () => { void chrome.runtime.lastError; });
            }
        });
    });
}

export async function getSubtitleCensorEnabled() {
    const res = await new Promise((resolve) => chrome.storage.sync.get([SUBTITLE_CENSOR_STORAGE_KEY], resolve));
    return res[SUBTITLE_CENSOR_STORAGE_KEY] !== undefined ? res[SUBTITLE_CENSOR_STORAGE_KEY] : true;
}

export async function setSubtitleCensorEnabled(enabled) {
    chrome.storage.sync.set({ [SUBTITLE_CENSOR_STORAGE_KEY]: enabled });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "UPDATE_SUBTITLE_CENSOR_SETTING", enabled }, () => {
                void chrome.runtime.lastError;
            });
        }
    });
}

export async function getStoredVideoDurationMinutes() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["nazafaVideoDurationMinutes"], (res) => {
            resolve(res.nazafaVideoDurationMinutes || null);
        });
    });
}

export function resolveDisplayItem(item, library) {
    if (item && item.type === "episode" && item.parent_series_id && library[item.parent_series_id]) {
        return library[item.parent_series_id];
    }
    return item;
}

export function compressImageToDataUrl(url, targetWidth, targetHeight) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                const dpr = Math.min(window.devicePixelRatio || 1, 3);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(targetWidth * dpr);
                canvas.height = Math.round(targetHeight * dpr);
                const ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "medium";

                const srcRatio = img.naturalWidth / img.naturalHeight;
                const targetRatio = targetWidth / targetHeight;
                let sx = 0, sy = 0, sWidth = img.naturalWidth, sHeight = img.naturalHeight;
                if (srcRatio > targetRatio) {
                    sWidth = img.naturalHeight * targetRatio;
                    sx = (img.naturalWidth - sWidth) / 2;
                } else {
                    sHeight = img.naturalWidth / targetRatio;
                    sy = (img.naturalHeight - sHeight) / 2;
                }
                ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.92));
            } catch (e) { reject(e); }
        };
        img.onerror = () => reject(new Error("تعذر تحميل الصورة"));
        img.src = url;
    });
}

export async function getSession() {
    const sessionData = await new Promise(resolve => chrome.storage.local.get(['nazafaSession'], resolve));
    return sessionData.nazafaSession || null;
}

export async function getSubscriptionStatus() {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: "GET_SUBSCRIPTION_STATUS" }, (res) => {
            resolve(chrome.runtime.lastError ? { isPremium: false } : res);
        });
    });
}


export async function getActiveTabMeta() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) return { title: tabs[0].title || "", url: tabs[0].url || "" };
    } catch (e) {}
    return { title: "", url: "" };
}

export function cleanWorkTitle(raw) {
    let t = String(raw || "").trim();
    const brands = /(netflix|prime video|amazon|disney\+?|disney plus|apple tv\+?|shahid|osn\+?|watch ?it|yango|starzplay|stc ?tv|jawwy|tod|bein|stremio|شاهد|نتفليكس|ديزني)/i;
    t = t.replace(/^(watch|watching|مشاهدة|شاهد)\s+/i, "");
    const parts = t.split(/\s+[|\-–—•]\s+/);
    if (parts.length > 1) {
        const kept = parts.filter((p) => !brands.test(p));
        if (kept.length) t = kept.join(" - ");
    }
    return t.replace(/\s+/g, " ").trim().slice(0, 150);
}

const SUGGESTED_WORKS_KEY = "nazafaSuggestedWorks";

export async function isWorkSuggested(platform, movieId) {
    const data = await new Promise((resolve) => chrome.storage.local.get([SUGGESTED_WORKS_KEY], resolve));
    return !!(data[SUGGESTED_WORKS_KEY] && data[SUGGESTED_WORKS_KEY][`${platform}:${movieId}`]);
}

export async function markWorkSuggested(platform, movieId) {
    const data = await new Promise((resolve) => chrome.storage.local.get([SUGGESTED_WORKS_KEY], resolve));
    const map = data[SUGGESTED_WORKS_KEY] || {};
    map[`${platform}:${movieId}`] = Date.now();
    await new Promise((resolve) => chrome.storage.local.set({ [SUGGESTED_WORKS_KEY]: map }, resolve));
}

export function compareVersions(a, b) {
    const pa = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
    const pb = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d < 0 ? -1 : 1;
    }
    return 0;
}

export async function getBannerState() {
    const data = await new Promise((resolve) => chrome.storage.local.get(["nazafaAppStatus", "nazafaJustUpdated", "nazafaDismissedBanners"], resolve));
    return {
        current: chrome.runtime.getManifest().version,
        status: data.nazafaAppStatus || null,
        justUpdated: data.nazafaJustUpdated || null,
        dismissed: data.nazafaDismissedBanners || {}
    };
}

export async function dismissBanner(key) {
    const data = await new Promise((resolve) => chrome.storage.local.get(["nazafaDismissedBanners"], resolve));
    const map = data.nazafaDismissedBanners || {};
    map[key] = Date.now();
    await new Promise((resolve) => chrome.storage.local.set({ nazafaDismissedBanners: map }, resolve));
}

export function requestExtensionUpdate() {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ type: "NAZAFA_REQUEST_UPDATE" }, (res) => {
                resolve(chrome.runtime.lastError || !res ? "error" : res.status);
            });
        } catch (e) { resolve("error"); }
    });
}
