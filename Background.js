// سالك - Service Worker
// كل البيانات من GitHub (مكتبة الأعمال + حالة التحديثات)، ومفيش Firebase ولا حسابات.
importScripts('app-config.js', 'shared/filter-core.js');

let __salikLibMem = null;
let __salikLibInflight = null;
const SALIK_FETCH_TIMEOUT_MS = 10000;

async function fetchAuthenticatedLibrary() {
    const maxAge = (SALIK_CONFIG.LIBRARY_CACHE_MINUTES || 360) * 60 * 1000;
    if (__salikLibMem && Date.now() - __salikLibMem.at < maxAge) {
        return { success: true, data: __salikLibMem.data };
    }
    const stored = (await chrome.storage.local.get(["salikLibraryCache"])).salikLibraryCache;
    if (stored && stored.data && Date.now() - stored.at < maxAge) {
        __salikLibMem = stored;
        return { success: true, data: stored.data };
    }
    // لو فيه طلب شغال بالفعل (من فريمات/تابات كتير) استنى نفس الطلب بدل ما تبعت طلبات متكررة
    if (__salikLibInflight) return __salikLibInflight;

    __salikLibInflight = (async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), SALIK_FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(SALIK_CONFIG.LIBRARY_URL, { cache: "no-cache", signal: ctrl.signal });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();
            const entry = { at: Date.now(), data };
            __salikLibMem = entry;
            chrome.storage.local.set({ salikLibraryCache: entry }).catch(() => {});
            return { success: true, data };
        } catch (e) {
            const msg = e && e.name === "AbortError" ? "timeout" : (e && e.message) || String(e);
            if (stored && stored.data) return { success: true, data: stored.data, stale: true };
            return { success: false, error: msg };
        } finally {
            clearTimeout(timer);
            __salikLibInflight = null;
        }
    })();
    return __salikLibInflight;
}


// ===== حالة التطبيق (إصدار أحدث / إصدار أدنى / إشعار) من GitHub =====
const NAZAFA_APP_STATUS_ALARM = "nazafa-app-status";
const NAZAFA_STATUS_MIN_GAP_MS = 60 * 60 * 1000;

async function nazafaCheckAppStatus(force) {
    try {
        if (!SALIK_CONFIG.STATUS_URL) return;
        if (!force) {
            const prev = (await chrome.storage.local.get(["nazafaAppStatus"])).nazafaAppStatus;
            if (prev && prev.checkedAt && Date.now() - prev.checkedAt < NAZAFA_STATUS_MIN_GAP_MS) return;
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), SALIK_FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(SALIK_CONFIG.STATUS_URL, { cache: "no-cache", signal: ctrl.signal });
            if (!res.ok) return;
            const data = await res.json();
            await chrome.storage.local.set({
                nazafaAppStatus: { latest: data.latest || null, minVersion: data.minVersion || null, notice: data.notice || null, checkedAt: Date.now() }
            });
        } finally { clearTimeout(timer); }
    } catch (e) { /* تجاهل: مفيش إنترنت أو الملف مش موجود */ }
}

function nazafaEnsureAlarm() {
    try { chrome.alarms.create(NAZAFA_APP_STATUS_ALARM, { periodInMinutes: 360, delayInMinutes: 1 }); } catch (e) {}
}
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === NAZAFA_APP_STATUS_ALARM) nazafaCheckAppStatus(true);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // محتوى السكربتات لسه بيسأل عن الاشتراك: دايماً مفعّل (التطبيق مجاني)
    if (request.type === "GET_SUBSCRIPTION_STATUS") {
        sendResponse({ success: true, isPremium: true, status: "free", checkedAt: Date.now() });
        return;
    }

if (request.type === "FETCH_FILTERS_BACKGROUND") {
    const movieId = String(request.movieId || "").trim();
    const tabId = sender.tab ? sender.tab.id : null;

    (async () => {
        try {

            console.log(`🔍 البحث عن محتوى: ${movieId}...`);

            const libResult = await fetchAuthenticatedLibrary();
            if (!libResult.success) {
                console.warn("🔒 Nazafa: تعذر جلب المكتبة الموثّقة:", libResult.error);
                if (tabId !== null) chrome.action.setBadgeText({ text: "", tabId: tabId });
                sendResponse({ success: false, error: libResult.error });
                return;
            }
            const library = libResult.data;

            const foundItem = (library && typeof library === "object" && !library.error)
                ? SalikFilterCore.findLibraryItem(library, movieId, request.platform, {
                    episode: request.episode != null ? request.episode : request.domEpisode,
                    pageUrl: request.pageUrl || (sender.tab && sender.tab.url) || ""
                })
                : null;

            if (foundItem) {
                console.log(`✅ تم العثور على المحتوى: ${foundItem.title || movieId}`);
                if (tabId !== null) {
                    chrome.action.setBadgeText({ text: "ON", tabId: tabId });
                    chrome.action.setBadgeBackgroundColor({ color: "#10b981", tabId: tabId });
                }
                sendResponse({ success: true, data: foundItem });
            } else {
                console.warn("❌ لم يتم العثور على المحتوى في المكتبة الموحدة.");
                if (tabId !== null) chrome.action.setBadgeText({ text: "", tabId: tabId });
                sendResponse({ success: false, error: "Not Found" });
            }

        } catch (error) {
            console.error("🔥 خطأ في البحث:", error);
            if (tabId !== null) chrome.action.setBadgeText({ text: "", tabId: tabId });
            sendResponse({ success: false, error: error.message });
        }
    })();

    return true;
}

    if (request.type === "FETCH_LIBRARY_DATA") {
        (async () => {
            try {
                sendResponse(await fetchAuthenticatedLibrary());
            } catch (e) {
                sendResponse({ success: false, error: (e && e.message) || String(e) });
            }
        })();
        return true;
    }

    if (request.type === "UPDATE_BADGE_STATUS") {
        const tabId = sender.tab ? sender.tab.id : null;
        if (request.count > 0) {
            chrome.action.setBadgeText({ text: "ON", tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: "#10b981", tabId: tabId });
        } else {
            chrome.action.setBadgeText({ text: "", tabId: tabId });
        }
        sendResponse({ success: true });
        return;
    }

    if (request.type === "NAZAFA_REQUEST_UPDATE") {
        try {
            chrome.runtime.requestUpdateCheck((status) => {
                sendResponse({ status });
                if (status === "update_available") setTimeout(() => chrome.runtime.reload(), 300);
            });
        } catch (e) { sendResponse({ status: "error" }); }
        return true;
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        chrome.action.setBadgeText({ text: "", tabId: tabId });
    }
});

chrome.runtime.onInstalled.addListener((details) => {
    // تنظيف بقايا Firebase القديمة (جلسات / اشتراك / أفلييت)
    chrome.storage.local.remove(["nazafaSession", "nazafaSubscription", "nazafaAffiliate", "nazafaInstallInfo", "nazafaLastPlatform"]);
    try { chrome.runtime.setUninstallURL(""); } catch (e) {}
    if (details.reason === "update") {
        chrome.storage.local.set({ nazafaJustUpdated: { from: details.previousVersion || "", to: chrome.runtime.getManifest().version, at: Date.now() } });
    }
    nazafaEnsureAlarm();
    nazafaCheckAppStatus(true);
});
chrome.runtime.onStartup.addListener(() => { nazafaEnsureAlarm(); nazafaCheckAppStatus(false); });

chrome.runtime.onInstalled.addListener(async () => {
    try {
        const cs = chrome.runtime.getManifest().content_scripts || [];
        for (const entry of cs) {
            const tabs = await chrome.tabs.query({ url: entry.matches });
            for (const tab of tabs) {
                if (!tab.id || /^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) continue;
                const world = entry.world === "MAIN" ? "MAIN" : "ISOLATED";
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: !!entry.all_frames },
                        files: entry.js, world
                    });
                } catch (e) { /* تاب غير مسموح/لم يعد موجوداً */ }
            }
        }
    } catch (e) { console.warn("inject existing tabs failed", e); }
});

const NAZAFA_APPLETV_PLAYMETADATA_URL_FILTER = { urls: ["https://tv.apple.com/api/uts/v3/contents/play-metadata/vod*"] };
if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
    chrome.webRequest.onBeforeRequest.addListener(
        (details) => {
            try {
                if (!details.tabId || details.tabId < 0) return;
                const u = new URL(details.url);
                const externalId = u.searchParams.get("externalId");
                if (!externalId) return;
                chrome.tabs.sendMessage(details.tabId, {
                    type: "NAZAFA_APPLETV_LIVE_EPISODE_ID_FROM_BG",
                    id: externalId
                }, () => {
                    void chrome.runtime.lastError;
                });
            } catch (e) { /* تجاهل */ }
        },
        NAZAFA_APPLETV_PLAYMETADATA_URL_FILTER
    );
}