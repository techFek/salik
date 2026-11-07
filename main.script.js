(function () {
const NAZAFA_MAIN_VER = "1.1.0";
if (window.__salikMainVer === NAZAFA_MAIN_VER) return;
window.__salikMainVer = NAZAFA_MAIN_VER;
/* A newer copy injected after an update takes over; this one stops its timers and listeners. */
const nazafaIsCurrent = () => window.__salikMainVer === NAZAFA_MAIN_VER;
const setInterval = (fn, ms, ...args) => {
    const id = window.setInterval(() => { if (!nazafaIsCurrent()) { window.clearInterval(id); return; } fn(...args); }, ms);
    return id;
};

/*
 * NAZAFA_* commands are accepted only from isolated.script.js: same window with the nonce it sent in
 * NAZAFA_HELLO, or the parent frame (whose isolated script drives players in iframes).
 */
let NAZAFA_NONCE = null;
window.addEventListener("message", (event) => {
    const d = event.data;
    if (event.source !== window || !d || d.type !== "NAZAFA_HELLO" || NAZAFA_NONCE || typeof d.nonce !== "string") return;
    NAZAFA_NONCE = d.nonce;
});
function nazafaTrusted(event) {
    if (!nazafaIsCurrent() || !event || !event.data) return false;
    if (event.source === window) return !!NAZAFA_NONCE && event.data.nonce === NAZAFA_NONCE;
    try { return window.parent !== window && event.source === window.parent; } catch (e) { return false; }
}
try { window.postMessage({ type: "NAZAFA_MAIN_READY" }, "*"); } catch (e) {}

console.log("💪 Nazafa Engine: Main Executor Ready.");

let isSystemMute = false;

let nazafaSubtitleCensorEnabled = true;
let nazafaInsultsEnabled = true;
let nazafaYtAutoMuteEnabled = true;
let nazafaLanguageEnabled = true;
let nazafaGroupEnabled = { nudity: true, violence: true, language: true, substance: true };
let nazafaSubSettings = {};
window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "NAZAFA_SUBTITLE_CENSOR_SETTING" || !nazafaTrusted(event)) return;
    nazafaSubtitleCensorEnabled = !!event.data.enabled;
    if (event.data.insultsEnabled !== undefined) nazafaInsultsEnabled = !!event.data.insultsEnabled;
    if (event.data.ytAutoMute !== undefined) nazafaYtAutoMuteEnabled = !!event.data.ytAutoMute;
    if (event.data.groups && typeof event.data.groups === "object") {
        nazafaGroupEnabled = Object.assign({}, nazafaGroupEnabled, event.data.groups);
        nazafaLanguageEnabled = nazafaGroupEnabled.language !== false;
    }
    if (event.data.subs && typeof event.data.subs === "object") nazafaSubSettings = event.data.subs;
});

let nazafaMuteVideo = null;
let nazafaMutePlatform = undefined;
function nazafaMuteIsNetflix() {
    return nazafaMutePlatform === "netflix" || (!nazafaMutePlatform && typeof netflix !== "undefined");
}
function nazafaMuteTarget() {
    const v = (typeof getActiveVideoElement === "function" && getActiveVideoElement()) || nazafaMuteVideo;
    if (v) nazafaMuteVideo = v;
    return v;
}
const nazafaMute = globalThis.SalikFilterCore.createMuteArbiter({
    isMuted() { const v = nazafaMuteTarget(); return v ? nazafaIsSilenced(v, nazafaMutePlatform) : false; },
    mute() {
        const v = nazafaMuteTarget(); if (!v) return;
        isSystemMute = true;
        nazafaSilence(v, nazafaMutePlatform);
        if (nazafaMuteIsNetflix()) setNetflixMuted(true);
        setTimeout(() => { isSystemMute = false; }, 300);
    },
    unmute() {
        const v = nazafaMuteTarget(); if (!v) return;
        isSystemMute = true;
        nazafaUnsilence(v, nazafaMutePlatform);
        if (nazafaMuteIsNetflix()) setNetflixMuted(false);
        setTimeout(() => { isSystemMute = false; }, 50);
    }
});
function nazafaMuteContext(video, platform) {
    if (video) nazafaMuteVideo = video;
    nazafaMutePlatform = platform;
}

let nazafaLastPlayingAt = 0;
let nazafaPointerDown = false;
let nazafaPointerUpAt = 0;
if (window.location.hostname.includes("disneyplus.com")) {
    setInterval(() => {
        try { const v = getActiveVideoElement(); if (v && !v.paused) nazafaLastPlayingAt = Date.now(); } catch (e) {}
    }, 250);
    const down = () => { nazafaPointerDown = true; };
    const up = () => { nazafaPointerDown = false; nazafaPointerUpAt = Date.now(); };
    ["pointerdown", "touchstart", "mousedown"].forEach((t) => window.addEventListener(t, down, true));
    ["pointerup", "pointercancel", "touchend", "touchcancel", "mouseup"].forEach((t) => window.addEventListener(t, up, true));
}
function nazafaDisneyResumeIfNeeded(dPlayer, video, wasPlaying) {
    if (!wasPlaying) return;
    let checks = 0;
    const timer = setInterval(() => {
        checks++;
        if (nazafaPointerDown && checks < 100) return;
        if (Date.now() - nazafaPointerUpAt < 600 && checks < 100) return;
        clearInterval(timer);
        const v = getActiveVideoElement() || video;
        if (v && v.paused) {
            try { if (dPlayer && dPlayer.mediaPlayer && typeof dPlayer.mediaPlayer.play === "function") dPlayer.mediaPlayer.play(); else v.play().catch(() => {}); }
            catch (e) { try { v.play().catch(() => {}); } catch (e2) {} }
        }
    }, 100);
}

const nazafaIsDisney = window.location.hostname.includes("disneyplus.com");

const NAZAFA_DISNEY_API_HOST_RE = /(^|\.)(bamgrid\.com|dssott\.com|disneyplus\.com|disney-plus\.net|bam-sdk\.com|bamtech\.co)$/i;
function nazafaIsDisneySessionCandidateUrl(urlStr) {
    if (!urlStr) return false;
    if (/\.vtt|\.m3u8|\/dust\b/i.test(urlStr)) return false;
    let u;
    try {
        u = new URL(urlStr, location.href);
    } catch (e) {
        return false;
    }
    if (!NAZAFA_DISNEY_API_HOST_RE.test(u.hostname)) return false;
    return /\/(session|scenarios?|playback)(\/|$)/i.test(u.pathname);
}

let nazafaDisneyPlayheadCapturedOnce = false;
function nazafaExtractDisneyPlaybackApiPlayhead(urlStr, bodyText) {
    if (!nazafaIsDisney) return;
    if (nazafaDisneyPlayheadCapturedOnce) return;
    if (!/\/playback\//i.test(urlStr) && !/scenario/i.test(urlStr)) return;
    try {
        const parsed = JSON.parse(bodyText);
        const pos = parsed && parsed.playhead && parsed.playhead.position;
        if (typeof pos === "number" && pos >= 0) {
            nazafaDisneyPlayheadCapturedOnce = true;
            window.postMessage({ type: "NAZAFA_DISNEY_PLAYHEAD", seconds: pos }, "*");
        }
    } catch (e) {}
}

function nazafaLogDisneySessionResponse(urlStr, bodyText) {
    if (!nazafaIsDisney) return;
    if (!bodyText) return;
    if (!nazafaIsDisneySessionCandidateUrl(urlStr)) return;
    nazafaExtractDisneyPlaybackApiPlayhead(urlStr, bodyText);
}

let nazafaDisneyStoreSubscribed = false;
function nazafaTryAttachDisneyStore() {
    if (!nazafaIsDisney) return;
    if (nazafaDisneyStoreSubscribed) return;
    const player = document.querySelector("disney-web-player");
    if (!player || !player.stateStore || typeof player.stateStore.subscribe !== "function") return;
    nazafaDisneyStoreSubscribed = true;
    let lastMs = null;
    try {
        player.stateStore.subscribe(() => {
            try {
                const state = player.stateStore.getState();
                const ms = state && state.player && state.player.core && state.player.core.timeline &&
                    state.player.core.timeline.timeline && state.player.core.timeline.timeline.playheadPositionMs;
                if (typeof ms === "number" && isFinite(ms) && ms !== lastMs) {
                    lastMs = ms;
                    window.postMessage({ type: "NAZAFA_DISNEY_LIVE_POSITION", seconds: ms / 1000 }, "*");
                }
            } catch (e) {}
        });
    } catch (e) {
        nazafaDisneyStoreSubscribed = false;
    }
}
if (nazafaIsDisney) {
    const nazafaDisneyStoreAttachInterval = setInterval(() => {
        nazafaTryAttachDisneyStore();
        if (nazafaDisneyStoreSubscribed) clearInterval(nazafaDisneyStoreAttachInterval);
    }, 500);
}

const nazafaIsAmazon = /(^|\.)(primevideo\.com|amazon\.[a-z.]+)$/i.test(window.location.hostname);
const NAZAFA_AMAZON_PLAYBACK_RESOURCES_RE = /\/playback\/prs\/GetVodPlaybackResources/i;
function nazafaExtractAmazonLiveEpisodeId(urlStr) {
    if (!nazafaIsAmazon) return;
    if (!NAZAFA_AMAZON_PLAYBACK_RESOURCES_RE.test(urlStr)) return;
    try {
        const u = new URL(urlStr, location.href);
        const titleId = u.searchParams.get("titleId");
        if (titleId) {
            window.postMessage({ type: "NAZAFA_AMAZON_LIVE_EPISODE_ID", id: titleId }, "*");
        }
    } catch (e) {}
}

const nazafaIsAppleTV = /(^|\.)tv\.apple\.com$/i.test(window.location.hostname);
const NAZAFA_APPLETV_PLAYMETADATA_RE = /\/api\/uts\/v3\/contents\/play-metadata\/vod/i;
function nazafaExtractAppleTVLiveEpisodeId(urlStr) {
    if (!nazafaIsAppleTV) return;
    if (!NAZAFA_APPLETV_PLAYMETADATA_RE.test(urlStr)) return;
    try {
        const u = new URL(urlStr, location.href);
        const externalId = u.searchParams.get("externalId");
        if (externalId) {
            window.postMessage({ type: "NAZAFA_APPLETV_LIVE_EPISODE_ID", id: externalId }, "*");
        }
    } catch (e) {}
}

const NazafaCensorCore = (function () {
    "use strict";

    const DIACRITICS_RE = /[ً-ٰٕۖ-ۭـ]/;

    function normalizeText(text) {
        let normalized = "";
        const map = [];
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (DIACRITICS_RE.test(ch)) continue;
            let nch = ch;
            if (ch === "أ" || ch === "إ" || ch === "آ" || ch === "ٱ") nch = "ا";
            else if (ch === "ى") nch = "ي";
            else if (ch === "ة") nch = "ه";
            else nch = ch.toLowerCase();
            normalized += nch;
            map.push(i);
        }
        return { normalized, map };
    }

    const NAZAFA_SUBTITLE_BLACKLIST = {
        explicit: [
            "الاستمناء", "استمنى", "لاعق القضبان", "زير النساء", "خصية", "تعري", "ضاجعت", "داعر", "الداعر", "نهود", "شاذ", "الشاذ",
            "اغتصب", "اغتصبت", "اغتصبوا", "اغتصبو", "يغتصب", "تغتصب", "نغتصب", "اغتصاب", "مغتصب", "مغتصبة", "مغتصبين", "مغتصبون", "rape", "raped", "raping", "rapist", "rapists",
            "نيك", "ينيك", "متناك", "منيوك", "كس", "طيز", "زب", "عارية",
            "عاهره", "قحبه", "شرموطه", "لحس", "جماع", "مؤخرات", "مؤخرة", "مثيرة","سافلة","زير نساء","تنام مع","السفلة","عاشر","يعاشر","تعاشر","مثيرات","جذّابة","فاتنة","عشيقة",
            "العلاقة الجنسية", "العلاقات الجنسية", "المشاهد الجنسية", "الأفعال الجنسية", "الممارسة الجنسية", "الأمور الجنسية", "الاعتداء الجنسي", "التحرش الجنسي", "ممارسة الجنس", "لممارسة الجنس", "يمارس الجنس", "يمارسون الجنس", "يمارسان الجنس", "تمارس الجنس", "تمارسون الجنس", "مارس الجنس", "مارسوا الجنس", "مارست الجنس", "مارسا الجنس", "نمارس الجنس", "أمارس الجنس", "المداعبة", "يضاجع", "اضاجع", "ضاجع", "المؤخرة", "مؤخرتك", "مؤخرتي", "جنسية", "العلاقة الحميمة","الخلاعية", "الخصيتان", "العاهرة","عاهرة",            "fuck", "fucking", "fucked", "fucker", "motherfucker", "pussy", "dick", "cock",
            "cunt", "blowjob", "handjob", "porn", "horny", "nude", "naked", "boobs", "orgasm",
            "خرا", "خره", "قحاب", "شراميط", "زق", "جنسي", "عاري", "سكس", "فاجرة",
            "fucks", "fuckin", "fuckin'", "fuckers", "fuckup", "fuckups", "motherfuckers",
            "fuckface", "fuckwit", "fuckhead", "fuckery", "fucktard",
            "dicks", "dickhead", "dickheads", "cocks", "cocksucker", "pussies",
            "whore", "whores", "whorish", "slut", "sluts", "slutty",
            "sex", "sexy", "sexual", "nudity", "breasts", "condoms", "penis", "vagina",
            "butt", "butts", "hot",
            "قضيب", "ثدي", "واقي ذكري",
            "sleeping with", "sleep with",
            "كسمك", "كسمين", "زبر", "زانية", "زاني", "دعارة","غبي", "كس اخت","بدين","الساقطة",
            "اباحي", "افلام اباحية", "فحش", "فاحشة", "شبق", "مخنث", "المخنثين",
            "cockhead", "cockblock", "pecker", "whorehouse", "hooker", "hookers", "skank",
            "vaginal", "pornography", "cum", "jizz", "dildo", "vibrator", "semen", "testicle",
            "testicles", "scrotum", "rimjob", "gangbang", "threesome", "foursome", "orgy",
            "masturbate", "jackoff", "jerkoff", "fellatio", "cunnilingus", "muff", "مزز", "مزة"
        ],
        profanity: [
            "بن الجزمة", "ابن الجزمة", "يخربيت امك", "يا نهار اسود", "يانهار اسود", "نهارك اسود", "يا نهارك اسود", "يا نهار ازرق", "motherfucher",
            "الخراء", "خراء", "وغدا", "متعاليا",
            "اغتصب", "اغتصبت", "اغتصبوا", "اغتصبو", "يغتصب", "تغتصب", "نغتصب", "اغتصاب", "مغتصب", "مغتصبة", "مغتصبين", "مغتصبون", "rape", "raped", "raping", "rapist", "rapists",
            "ابن الكلب", "يا كلب", "حقير", "وسخ", "خول",
            "ابن الحرام", "يلعن", "لعنه الله", "جعة", "مضاجعة", "الجعة", "لعينة","يلعن","ينعل","الوساخة",
            "اللعينة", "اللعنة", "اللعين", "لعين","غبي","ابن الرب","حثالة","قبّلني","السافل","متعجرف","ابول","آلهة","تبول",
            "تفو عليك", "يا حيوان", "روح انقلع", "يشخو", "يا غبي", "الحقير", "يسوع", "المسيح", "الوغد", "وغد", "فحل" , "الفحل","الخرقى","باست","هانومان",
            "bitch", "asshole", "bastard", "shit", "bullshit",
            "damn", "goddamn", "jerk", "scumbag", "dumbass", "prick", "douche", "loser",
            "حيوان", "جبان","الجبناء",
            "معفن", "معفنة", "نذل", "تافه", "زبالة", "خنزير", "كلب", "كلاب","جحيم",
            "لعنة", "ملعون", "ملاعين",
            "effing", "effin", "effin'", "freaking", "freakin", "freakin'", "frigging", "friggin", "friggin'",
            "shits", "shitty", "shitting", "shittin'", "shithead", "shitheads", "bullshitting",
            "horseshit", "shitfaced", "shite",
            "ass", "asses", "assholes", "jackass", "jackasses", "dumbasses", "badass", "hardass",
            "asswipe", "arse", "arsehole",
            "bitches", "bitchy", "bitching", "bitchin'",
            "bastards",
            "damned", "damnit", "dammit", "damning", "goddammit", "goddamnit", "hell", "helluva",
            "godawful", "jesus", "christ", "lord",
            "pisses", "pissed", "pissing", "pissy", "pissin'", "piss",
            "crap", "craps", "crappy",
            "pricks", "twat", "twats", "wank", "wanker", "wankers", "wanking", "wankin'",
            "douchebag", "douchebags",
            "bloody", "bugger", "buggered", "bollocks", "tosser", "git", "minger", "plonker",
            "wtf", "stfu", "gtfo", "omfg", "af",
            "jerks", "losers",
            "freak", "freaks", "pathetic", "lame", "lowlife", "creep",
            "حثالة", "فاشل", "منحرف", "هراء",
            "عرص", "عرصة", "قواد", "ديوث", "ابن الزانية", "بنت الزانية","فساء","براز","غائط",
            "يلعن أبوك", "العن أبوك", "الله يخرب بيتك", "يخرب بيتك", "تيس", "زفت", "طظ",
            "قرف", "مقرف", "مقرفة", "خرابيط", "معتوه", "معتوهة",
            "سمج", "سمجة", "فاجر", "وسخة","بهيمة", "وقح", "وقحة","غباء", "التبويل",
            "قليل الأدب", "عديم الأدب",
            "والنبي", "بجاه النبي", "بحق النبي",
            "وحياتك", "وحياتي", "وحياته", "وحياتها", "وحياتنا", "وحياتكم",
            "وحياة أمي", "وحياة ابويا", "وحياة ماما", "وحياة بابا",
            "وشرفي", "وشرفك", "وشرفه", "وأمانة",
            "بحق السماء", "بحق الجحيم",
            "shitface", "shitcan", "shitfit", "asshat", "assclown", "assmonkey", "assmunch", "fugly",
            "حولة", "ندل", "سافل", "جبان", "جبانة",
            "أوسخ", "وساخة", "الوساخة",
            "ياللهوي", "والنعمة", "بالذمة", "بذمتك", "بزمتك",
            "يا نهار اسود", "يا يوم اسود", "نهارك اسود", "نهار ابوك اسود", "يا لهوي",
            "وحياة امك", "وحياة ابوك", "وحياة ابني", "ورحمة ابويا",
            "يارب ياخدك", "ربنا ياخدك", "روح امك", "بتاع النسوان",
            "يا دون", "ابن الدون", "ابن دون", "ولاد الجزمة",
            "سفلة", "يخربيتك", "يحرقك",
            "shithole", "shitholes", "shitload", "shitloads", "shitstorm", "shitshow", "shitshows",
            "shitless", "batshit", "dogshit", "chickenshit", "apeshit", "shitbag", "shitbags",
            "shitlist", "shitton", "holyshit", "shitpost", "shitposting", "shitstain",
            "قبيح", "قبيحة","تبول","التبول","بائس","بلطجي",
            "كريشنا", "فيشنو", "شيفا", "براهما", "غانيش", "هانومان", "كالي", "لاكشمي", "دورغا", "إندرا", "راما", "سرسواتي",
            "رع", "إيزيس", "أوزوريس", "أنوبيس", "حورس", "باستت", "باست", "آمون", "تحوت",
            "زيوس", "بوسيدون", "أثينا", "أبولو", "أرتميس", "آريس", "أفروديت", "هيرمس", "ديونيسوس", "هاديس", "هيرا",
            "جوبيتر", "جونو", "نبتون", "ميركوري", "مينرفا", "فينوس",
            "أودين", "لوكي", "فريا", "بالدر",
            "اللات", "العزى", "مناة", "هبل"
        ],
        insults: [
            "ابن المجنونة", "ابن الصرمة", "ابن الشمامة", "واطي", "واطية", "نجس", "scum",
            "idiot", "stupid", "moron", "idiots", "idiotic", "stupidity", "morons", "moronic",
            "dumb", "dumber", "dumbest", "dummy", "dummies", "retard", "retarded", "imbecile",
            "imbeciles", "fool", "fools", "foolish", "dope", "dopes", "nitwit", "nitwits",
            "twit", "twits",
            "غبي", "غبية", "اغبياء", "احمق", "حمقاء", "حمار", "حمير", "عبيط", "عبيطة", "عبطاء",
            "حمقى", "هبلة", "اهبل", "أهبل", "بله", "ابله", "بلهاء", "أخرق", "متخلف", "متخلفة",
            "غبيا", "ساذج", "ساذجة"
        ],
        substance: [
            "سجائر",
            "مخدرات", "المخدرات", "حشيش", "الحشيش", "كوكايين", "هيروين", "حبوب مخدره","الخمور","المنشطات","شامبانيا",
            "مسكرات", "خمر", "كحول", "بيره", "سكران", "ثمل", "نخب", "مخدر", "نشوة", "جرعة زايده",
            "cocaine", "heroin", "marijuana", "weed", "meth", "drugs", "overdose",
            "alcohol", "whiskey", "vodka", "drunk", "cannabis", "narcotics", "cocaine high",
            "beer",
            "بانجو", "استروكس", "ترامادول", "فودكا", "نبيذ", "ويسكي", "حشاش",
            "wine", "whisky", "rum", "tequila", "gin", "hashish", "opium", "ecstasy", "lsd",
            "cigarette", "cigarettes", "cigs", "narcotic", "stoned", "junkie", "addict", "addicts",
            "خمور", "طرشة", "مسطول", "مسطولة", "مبرشم", "مبرشمة",
            "شمبانيا", "براندي", "كونياك", "موهيتو", "مارتيني", "بوربون", "ليكيور", "سيدر", "مشروب روحي",
            "مارجوانا", "ماريغوانا", "افيون", "اكستاسي", "امفيتامين", "ميثامفيتامين",
            "كريستال ميث", "شبو", "قنب"
        ]
    };

    function escapeRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    const WORD_BOUNDARY_BEFORE = "(?<![\\p{L}\\p{N}])";
    const WORD_BOUNDARY_AFTER = "(?![\\p{L}\\p{N}])";

    const ARABIC_ATTACHED_SUFFIXES =
        "(?:كما|هما|كم|كن|هم|هن|ني|ها|نا|تها|تهم|تكم|تنا|تي|تك|ية|ات|ون|ين|ان|ة|ك|ه|ي|ا)?";
    const ARABIC_ATTACHED_PREFIX_FULL = "(?:[وفبلك])?(?:ال)?";
    const ARABIC_ATTACHED_PREFIX_NO_AL = "(?:[وفبلك])?";

    function normalizeArabicTerm(t) {
        let out = "";
        for (let i = 0; i < t.length; i++) {
            const ch = t[i];
            if (DIACRITICS_RE.test(ch)) continue;
            if (ch === "أ" || ch === "إ" || ch === "آ" || ch === "ٱ") out += "ا";
            else if (ch === "ى") out += "ي";
            else if (ch === "ة") out += "ه";
            else out += ch.toLowerCase();
        }
        return out;
    }

    const ARABIC_ATTACHED_SUFFIXES_MANDATORY = ARABIC_ATTACHED_SUFFIXES.replace(/\?$/, "");

    const NO_SUFFIX_TERMS = new Set(["جماع", "نخب", "تيس"].map(normalizeArabicTerm))
    const NOT_BEFORE_LAM_TERMS = new Set(["مثيرة"].map(normalizeArabicTerm));
    const NOT_BEFORE_LAM_LOOKAHEAD = "(?!\\s*ل[\\p{L}])";
    const NOT_AFTER_AL_TERMS = new Set(["عاشر"].map(normalizeArabicTerm));
    const NOT_AFTER_AL_STRICT_TERMS = new Set(["جنسي", "جنسية"].map(normalizeArabicTerm));
    const NOT_AFTER_AL_STRICT_SUFFIXES = "(?:ات|ين|ون|ان|ا|ه|ة)?";
    const REQUIRE_YA_TERMS = new Set(["أثينا", "نبتون", "حيوان", "كلب", "كلاب"].map(normalizeArabicTerm))
    const REQUIRE_YA_LOOKBEHIND = "(?<=يا\\s)";
    const NO_PREFIX_TERMS = new Set(["اريس"].map(normalizeArabicTerm));

    const ARABIC_ATTACHED_PREFIX_NO_KAF = "(?:[وفبل])?(?:ال)?";
    const NOT_WITH_KAF_TERMS = new Set(["بيره"].map(normalizeArabicTerm));

    const CATEGORY_REGEX = {};
    Object.keys(NAZAFA_SUBTITLE_BLACKLIST).forEach((cat) => {
        const rawTerms = NAZAFA_SUBTITLE_BLACKLIST[cat].map((t) => normalizeArabicTerm(t));
        const originalTerms = new Set(rawTerms);
        const tExpandedTerms = new Set();
        rawTerms.forEach((t) => {
            if (t.length > 2 && t.endsWith("ه") && !NO_SUFFIX_TERMS.has(t) && !NOT_AFTER_AL_STRICT_TERMS.has(t)) tExpandedTerms.add(t.slice(0, -1) + "ت");
        });
        const sortDesc = (arr) => Array.from(arr).sort((a, b) => b.length - a.length);
        const notBeforeLamList = sortDesc(new Set(Array.from(originalTerms).filter((t) => NOT_BEFORE_LAM_TERMS.has(t))));
        const notAfterAlList = sortDesc(new Set(Array.from(originalTerms).filter((t) => NOT_AFTER_AL_TERMS.has(t))));
        const requireYaList = sortDesc(new Set(Array.from(originalTerms).filter((t) => REQUIRE_YA_TERMS.has(t))));
        const noPrefixList = sortDesc(new Set(Array.from(originalTerms).filter((t) => NO_PREFIX_TERMS.has(t))));
        const notWithKafList = sortDesc(new Set(Array.from(originalTerms).filter((t) => NOT_WITH_KAF_TERMS.has(t))));
        const strictNoAlList = sortDesc(new Set(Array.from(originalTerms).filter((t) => NOT_AFTER_AL_STRICT_TERMS.has(t))));
        const originalList = sortDesc(new Set(Array.from(originalTerms).filter((t) => !NOT_AFTER_AL_STRICT_TERMS.has(t) && !NO_SUFFIX_TERMS.has(t) && !NOT_BEFORE_LAM_TERMS.has(t) && !NOT_AFTER_AL_TERMS.has(t) && !REQUIRE_YA_TERMS.has(t) && !NO_PREFIX_TERMS.has(t) && !NOT_WITH_KAF_TERMS.has(t))));
        const noSuffixList = sortDesc(new Set(Array.from(originalTerms).filter((t) => NO_SUFFIX_TERMS.has(t))));
        const expandedList = sortDesc(tExpandedTerms);
        if (!originalList.length && !strictNoAlList.length && !noSuffixList.length && !expandedList.length && !notBeforeLamList.length && !notAfterAlList.length && !requireYaList.length && !noPrefixList.length && !notWithKafList.length) { CATEGORY_REGEX[cat] = null; return; }

        const branches = [];
        if (originalList.length) {
            branches.push(`${ARABIC_ATTACHED_PREFIX_FULL}(?:${originalList.map(escapeRegex).join("|")})${ARABIC_ATTACHED_SUFFIXES}`);
        }
        if (strictNoAlList.length) {
            branches.push(`${ARABIC_ATTACHED_PREFIX_NO_AL}(?:${strictNoAlList.map(escapeRegex).join("|")})${NOT_AFTER_AL_STRICT_SUFFIXES}`);
        }
        if (noSuffixList.length) {
            branches.push(`${ARABIC_ATTACHED_PREFIX_FULL}(?:${noSuffixList.map(escapeRegex).join("|")})`);
        }
        if (notBeforeLamList.length) {
            branches.push(`${ARABIC_ATTACHED_PREFIX_FULL}(?:${notBeforeLamList.map(escapeRegex).join("|")})${ARABIC_ATTACHED_SUFFIXES}${NOT_BEFORE_LAM_LOOKAHEAD}`);
        }
        if (notAfterAlList.length) {
            branches.push(`${ARABIC_ATTACHED_PREFIX_NO_AL}(?:${notAfterAlList.map(escapeRegex).join("|")})${ARABIC_ATTACHED_SUFFIXES}`);
        }
        if (requireYaList.length) {
            branches.push(`${REQUIRE_YA_LOOKBEHIND}(?:${requireYaList.map(escapeRegex).join("|")})`);
        }
        if (noPrefixList.length) {
            branches.push(`(?:${noPrefixList.map(escapeRegex).join("|")})${ARABIC_ATTACHED_SUFFIXES}`);
        }
        if (notWithKafList.length) {
            branches.push(`${ARABIC_ATTACHED_PREFIX_NO_KAF}(?:${notWithKafList.map(escapeRegex).join("|")})${ARABIC_ATTACHED_SUFFIXES}`);
        }
        if (expandedList.length) {
            branches.push(`${ARABIC_ATTACHED_PREFIX_FULL}(?:${expandedList.map(escapeRegex).join("|")})${ARABIC_ATTACHED_SUFFIXES_MANDATORY}`);
        }
        CATEGORY_REGEX[cat] = new RegExp(
            `${WORD_BOUNDARY_BEFORE}(?:${branches.join("|")})${WORD_BOUNDARY_AFTER}`,
            "gu"
        );
    });

    function isCategoryEnabled(category) {
        const langSubs = Object.assign({}, nazafaSubSettings.language || {});
        if (nazafaInsultsEnabled === false) langSubs.insults = false;
        return globalThis.SalikFilterCore.subtitleCategoryEnabled(category, { language: { enabled: nazafaLanguageEnabled, subs: langSubs } });
    }

    const EXCEPTION_DOG_ADJECTIVES = ["جيد", "صالح", "وفي", "لطيف", "اليف", "مطيع"].map(normalizeArabicTerm);
    const EXCEPTION_REGEX = new RegExp(
        `(?<![\\p{L}\\p{N}])(?:[وفبلك])?(?:ال)?(?:كلب|كلاب)(?:ه|ها|ي|ك|نا|هم)?\\s+(?:ال)?(?:${EXCEPTION_DOG_ADJECTIVES.join("|")})(?:ه|ة|ان|ين|ون|ات)?(?![\\p{L}\\p{N}])`,
        "gu"
    );
    const EXCEPTION_USURPED_NOUNS = ["اراضي", "ارض", "حقوق", "حق", "اموال", "ممتلكات", "املاك", "اوطان", "وطن", "بلاد", "ديار", "بيوت", "فلسطين", "قدس"].map(normalizeArabicTerm);
    const EXCEPTION_USURPED_REGEX = new RegExp(
        `(?<![\\p{L}\\p{N}])(?:[وفبلك])?(?:ال)?(?:${EXCEPTION_USURPED_NOUNS.join("|")})(?:ه|ها|هم|نا|ي)?\\s+(?:ال)?مغتصب(?:ه|ين|ون|ات)?(?![\\p{L}\\p{N}])`,
        "gu"
    );
    const NAZAFA_IS_YOUTUBE_HOST = /(^|\.)youtube\.com$/i.test((typeof location !== "undefined" && location.hostname) || "");
    const EXCEPTION_RELIGIOUS_PHRASES = [
        "كاسيات عاريات", "كاسيات عاريات مميلات مائلات",
        "لعن الله", "لعن الله الخمر",
        "الخمر والميسر",
        "لا تقربوا الزنا", "ولا تقربوا الزنا"
    ].sort((x, y) => y.length - x.length)
      .map((p) => normalizeArabicTerm(p).split(/\s+/).map(escapeRegex).join("\\s+"));
    const EXCEPTION_RELIGIOUS_REGEX = new RegExp(
        `(?<![\\p{L}\\p{N}])(?:[وفبلك])?(?:${EXCEPTION_RELIGIOUS_PHRASES.join("|")})(?![\\p{L}\\p{N}])`,
        "gu"
    );
    const EXCEPTION_ROD_WORDS = ["معدني", "معدنية", "معدن", "حديد", "حديدي", "حديدية", "فولاذ", "فولاذي", "خشبي", "خشب", "نحاسي", "نحاس", "المنيوم", "ستارة", "ستائر", "الستارة", "الستائر", "السكة", "سكة", "القطار", "مقوى", "مقوي", "رفيع", "طويل", "اسمنت", "خرسانة", "وقود", "الوقود", "تحكم", "التحكم", "نووي", "النووي"].map(normalizeArabicTerm);
    const EXCEPTION_ROD_REGEX = new RegExp(
        `(?<![\\p{L}\\p{N}])(?:[وفبلك])?(?:ال)?قضيب(?:ه)?\\s+(?:من\\s+)?(?:ال)?(?:${EXCEPTION_ROD_WORDS.join("|")})(?![\\p{L}\\p{N}])`,
        "gu"
    );
    function getExceptionRanges(normalized) {
        const out = [];
        const EXCEPTION_FARJ_REGEX = /(?<![\p{L}\p{N}])[وفبل]?فرجك(?![\p{L}\p{N}])/gu;
        const exceptionRegexes = NAZAFA_IS_YOUTUBE_HOST ? [EXCEPTION_REGEX, EXCEPTION_USURPED_REGEX, EXCEPTION_ROD_REGEX, EXCEPTION_FARJ_REGEX, EXCEPTION_RELIGIOUS_REGEX] : [EXCEPTION_REGEX, EXCEPTION_USURPED_REGEX, EXCEPTION_ROD_REGEX, EXCEPTION_FARJ_REGEX];
        exceptionRegexes.forEach((re) => {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(normalized)) !== null) {
                if (m[0].length === 0) { re.lastIndex++; continue; }
                out.push([m.index, m.index + m[0].length]);
            }
        });
        return out;
    }
    function insideException(exRanges, s, e) {
        return exRanges.some(([a, b]) => s >= a && e <= b);
    }

    function censorText(original) {
        if (!original || typeof original !== "string" || !original.trim()) return original;

        const { normalized, map } = normalizeText(original);
        if (!normalized) return original;

        const ranges = [];
        const exRanges = getExceptionRanges(normalized);
        Object.keys(CATEGORY_REGEX).forEach((cat) => {
            const re = CATEGORY_REGEX[cat];
            if (!re || !isCategoryEnabled(cat)) return;
            re.lastIndex = 0;
            let match;
            while ((match = re.exec(normalized)) !== null) {
                if (match[0].length === 0) { re.lastIndex++; continue; }
                const normStart = match.index;
                const normEnd = normStart + match[0].length;
                if (exRanges.length && insideException(exRanges, normStart, normEnd)) continue;
                const origStart = map[normStart];
                const origEnd = normEnd < map.length ? map[normEnd] : (map[map.length - 1] + 1);
                ranges.push([origStart, origEnd]);
            }
        });

        if (!ranges.length) return original;

        ranges.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const r of ranges) {
            const last = merged[merged.length - 1];
            if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
            else merged.push(r.slice());
        }

        let out = "";
        let cursor = 0;
        for (const [s, e] of merged) {
            out += original.slice(cursor, s);
            out += "*&^%#";
            cursor = e;
        }
        out += original.slice(cursor);

        return out;
    }

    return { censorText, normalizeText, normalizeArabicTerm };
})();

const looksLikeSubtitleUrl = (url) => {
    if (/\.(vtt|ttml|dfxp|srt|xml)(\?|$)/i.test(url)) return true;
    let pathOnly = url;
    try {
        pathOnly = new URL(url, location.href).pathname;
    } catch (e) {
        pathOnly = String(url).split(/[?#]/)[0];
    }
    if (/\.(mp4|m4s|m4v|m4a|m4f|cmft|cmfv|cmfa|ts|aac|mpd|m3u8|f4m|ism|isml)$/i.test(pathOnly)) return false;
    return /subtitle|caption|sidecar|webvtt|timedtext/i.test(pathOnly);
};

const nazafaLooksBinary = (buf) => {
    try {
        const bytes = new Uint8Array(buf, 0, Math.min(buf.byteLength, 512));
        for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0) return true;
    } catch (e) {}
    return false;
};

function censorVttPayload(vttText, sourceLabel) {
    if (!vttText || typeof vttText !== "string") return vttText;
    if (!nazafaSubtitleCensorEnabled) return vttText;
    try {
        const lines = vttText.split(/\r\n|\n|\r/);
        let inNonTextBlock = false;
        let changedCount = 0;
        let dialogueLineCount = 0;
        const out = lines.map((line) => {
            const trimmed = line.trim();
            if (trimmed === "") { inNonTextBlock = false; return line; }
            if (/^WEBVTT/i.test(trimmed)) return line;
            if (/^(STYLE|REGION|NOTE)\b/i.test(trimmed)) { inNonTextBlock = true; return line; }
            if (inNonTextBlock) return line;
            if (trimmed.includes("-->")) return line;
            if (/^\d+$/.test(trimmed)) return line;
            if (/^[0-9a-fA-F-]{8,}$/.test(trimmed)) return line;

            dialogueLineCount++;
            const censored = NazafaCensorCore.censorText(line);
            if (censored !== line) changedCount++;
            return censored;
        });
        return out.join("\n");
    } catch (e) {
        console.warn(`⚠️ Nazafa: خطأ أثناء تنقية ملف VTT [${sourceLabel || "?"}]:`, e);
        return vttText;
    }
}

const originalFetch = window.fetch;
if (typeof originalFetch === "function") {
    window.fetch = function (...args) {
        if (!nazafaIsCurrent()) return originalFetch.apply(this, args);
        try {
            const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
            if (nazafaIsDisneySessionCandidateUrl(url)) {
                return originalFetch.apply(this, args).then((response) => {
                    try {
                        response.clone().text().then((text) => {
                            nazafaLogDisneySessionResponse(url, text);
                        }).catch(() => {});
                    } catch (e) {}
                    return response;
                });
            }
            nazafaExtractAmazonLiveEpisodeId(url);
            nazafaExtractAppleTVLiveEpisodeId(url);
            if (looksLikeSubtitleUrl(url)) {
                return originalFetch.apply(this, args).then((response) => {
                    try {
                        return response.clone().text().then((text) => {
                            try { if (typeof window.__nazafaYtCapture === "function") window.__nazafaYtCapture(url, text); } catch (e) {}
                            const censoredText = censorVttPayload(text, "fetch:" + url);
                            return new Response(censoredText, {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.headers
                            });
                        });
                    } catch (e) {
                        console.warn("⚠️ Nazafa: فشل اعتراض رد fetch لملف ترجمة:", e);
                        return response;
                    }
                });
            }
        } catch (e) {}
        return originalFetch.apply(this, args);
    };
}

const OriginalXHR = window.XMLHttpRequest;
const originalOpen = OriginalXHR.prototype.open;
const originalSend = OriginalXHR.prototype.send;
OriginalXHR.prototype.open = function (method, url, ...rest) {
    if (!nazafaIsCurrent()) return originalOpen.call(this, method, url, ...rest);
    try {
        const urlStr = typeof url === "string" ? url : "";
        this.__nazafaIsSubtitle = looksLikeSubtitleUrl(urlStr);
        this.__nazafaIsSession = nazafaIsDisneySessionCandidateUrl(urlStr);
        this.__nazafaUrl = urlStr;
        nazafaExtractAmazonLiveEpisodeId(urlStr);
        nazafaExtractAppleTVLiveEpisodeId(urlStr);
        if (this.__nazafaIsSession) {
            this.addEventListener("load", () => {
                try {
                    nazafaLogDisneySessionResponse(urlStr, this.responseText);
                } catch (e) {}
            });
        }
    } catch (e) {}
    return originalOpen.call(this, method, url, ...rest);
};
OriginalXHR.prototype.send = function (body) {
    return originalSend.call(this, body);
};

if (!window.__nazafaXhrResponsePatched) {
    window.__nazafaXhrResponsePatched = true;
    const nativeResponseTextDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "responseText");
    const nativeResponseDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "response");

    const getCensoredFor = function (xhr, rawValue) {
        if (!xhr.__nazafaIsSubtitle) return rawValue;

        if (typeof rawValue === "string") {
            if (xhr.__nazafaCensoredSource !== rawValue) {
                xhr.__nazafaCensoredSource = rawValue;
                try { if (typeof window.__nazafaYtCapture === "function") window.__nazafaYtCapture(xhr.__nazafaUrl, rawValue); } catch (e) {}
                xhr.__nazafaCensoredCache = censorVttPayload(rawValue, "xhr:" + xhr.__nazafaUrl);
            }
            return xhr.__nazafaCensoredCache;
        }

        if (rawValue instanceof ArrayBuffer) {
            if (nazafaLooksBinary(rawValue)) return rawValue;
            if (xhr.__nazafaCensoredSource !== rawValue) {
                xhr.__nazafaCensoredSource = rawValue;
                try {
                    const decoded = new TextDecoder("utf-8").decode(rawValue);
                    const censoredText = censorVttPayload(decoded, "xhr-arraybuffer:" + xhr.__nazafaUrl);
                    xhr.__nazafaCensoredCache = censoredText === decoded
                        ? rawValue
                        : new TextEncoder().encode(censoredText).buffer;
                } catch (e) {
                    console.warn(`⚠️ Nazafa VTT: فشل فك/تنقية ملف ترجمة ArrayBuffer [${xhr.__nazafaUrl}]:`, e);
                    xhr.__nazafaCensoredCache = rawValue;
                }
            }
            return xhr.__nazafaCensoredCache;
        }

        if (!xhr.__nazafaLoggedNonString) {
            xhr.__nazafaLoggedNonString = true;
            const typeLabel = rawValue && rawValue.constructor ? rawValue.constructor.name : typeof rawValue;
            console.warn(`⚠️ Nazafa VTT: ملف ترجمة [${xhr.__nazafaUrl}] نوعه ${typeLabel} — منقدرش ننقّيه لسه.`);
        }
        return rawValue;
    };

    if (nativeResponseTextDesc && nativeResponseTextDesc.get) {
        Object.defineProperty(XMLHttpRequest.prototype, "responseText", {
            configurable: true,
            enumerable: nativeResponseTextDesc.enumerable,
            get: function () {
                const real = nativeResponseTextDesc.get.call(this);
                try { return getCensoredFor(this, real); } catch (e) { return real; }
            }
        });
    }
    if (nativeResponseDesc && nativeResponseDesc.get) {
        Object.defineProperty(XMLHttpRequest.prototype, "response", {
            configurable: true,
            enumerable: nativeResponseDesc.enumerable,
            get: function () {
                const real = nativeResponseDesc.get.call(this);
                try { return getCensoredFor(this, real); } catch (e) { return real; }
            }
        });
    }
}

function nazafaGetOverlayMountPoint(video) {
    const fsEl = document.fullscreenElement;
    if (fsEl && fsEl !== video) return fsEl;
    return document.body;
}

let blurOverlayEl = null;
let blurOverlayRepositionId = null;

function ensureBlurOverlay(mountPoint) {
    if (blurOverlayEl && blurOverlayEl.parentElement === mountPoint) return blurOverlayEl;
    if (blurOverlayEl) blurOverlayEl.remove();
    blurOverlayEl = document.createElement("div");
    blurOverlayEl.id = "nazafa-blur-overlay";
    blurOverlayEl.style.cssText = `
        position: fixed;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 16px;
        background: rgba(15, 23, 42, 0.55);
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.6;
        z-index: 2147483647;
        pointer-events: none;
        direction: rtl;
        box-sizing: border-box;
    `;
    const desc = document.createElement("div");
    desc.className = "nazafa-blur-desc";
    const sub = document.createElement("div");
    sub.className = "nazafa-blur-subtitle";
    sub.setAttribute("dir", "auto");
    sub.style.cssText = `
        position: absolute; left: 5%; right: 5%; bottom: 8%;
        text-align: center; font-size: clamp(16px, 2.6vw, 34px); font-weight: 600; line-height: 1.35;
        color: #fff; text-shadow: 0 0 4px #000, 0 2px 3px #000; white-space: pre-line; display: none;
    `;
    blurOverlayEl.appendChild(desc);
    blurOverlayEl.appendChild(sub);
    mountPoint.appendChild(blurOverlayEl);
    return blurOverlayEl;
}

function nazafaActiveSubtitleText(video) {
    let text = "";
    try {
        const tracks = video.textTracks || [];
        for (let i = 0; i < tracks.length && !text; i++) {
            const t = tracks[i];
            if (t.mode !== "showing" || !t.activeCues) continue;
            const parts = [];
            for (let j = 0; j < t.activeCues.length; j++) {
                const c = t.activeCues[j];
                if (c && typeof c.text === "string") parts.push(c.text.replace(/<[^>]+>/g, ""));
            }
            text = parts.join("\n").trim();
        }
    } catch (e) { /* تجاهل */ }
    if (!text) {
        try {
            let best = null, bestArea = Infinity;
            for (const el of nazafaQueryAllDeep(NAZAFA_SUBTITLE_CONTAINER_SELECTORS)) {
                if (el.closest && (el.closest("#nazafa-blur-overlay") || el.closest("#nazafa-partial-blur-overlay"))) continue;
                const r = el.getBoundingClientRect();
                const tx = (el.innerText || el.textContent || "").trim();
                if (r.width <= 0 || r.height <= 0 || !tx) continue;
                if (r.width * r.height < bestArea) { bestArea = r.width * r.height; best = tx; }
            }
            if (best) text = best;
        } catch (e) { /* تجاهل */ }
    }
    if (text && nazafaSubtitleCensorEnabled) {
        try { text = NazafaCensorCore.censorText(text); } catch (e) { /* تجاهل */ }
    }
    return text;
}

function nazafaUpdateBlurSubtitle(video) {
    if (!blurOverlayEl) return;
    const sub = blurOverlayEl.querySelector(".nazafa-blur-subtitle");
    if (!sub) return;
    const text = nazafaActiveSubtitleText(video);
    if (sub.textContent !== text) sub.textContent = text;
    sub.style.display = text ? "block" : "none";
}

function positionBlurOverlay(video) {
    if (!blurOverlayEl) return;
    const rect = video.getBoundingClientRect();
    blurOverlayEl.style.top = `${rect.top}px`;
    blurOverlayEl.style.left = `${rect.left}px`;
    blurOverlayEl.style.width = `${rect.width}px`;
    blurOverlayEl.style.height = `${rect.height}px`;
}

function showBlurOverlay(video, description) {
    const overlay = ensureBlurOverlay(nazafaGetOverlayMountPoint(video));
    overlay.querySelector(".nazafa-blur-desc").textContent = description || "محتوى غير مناسب";
    positionBlurOverlay(video);
    nazafaUpdateBlurSubtitle(video);

    if (blurOverlayRepositionId) cancelAnimationFrame(blurOverlayRepositionId);
    const loop = () => {
        if (!blurOverlayEl) return;
        const desc = blurOverlayEl.querySelector(".nazafa-blur-desc").textContent;
        ensureBlurOverlay(nazafaGetOverlayMountPoint(video));
        blurOverlayEl.querySelector(".nazafa-blur-desc").textContent = desc;
        positionBlurOverlay(video);
        nazafaUpdateBlurSubtitle(video);
        blurOverlayRepositionId = requestAnimationFrame(loop);
    };
    blurOverlayRepositionId = requestAnimationFrame(loop);
}

function hideBlurOverlay() {
    if (blurOverlayRepositionId) {
        cancelAnimationFrame(blurOverlayRepositionId);
        blurOverlayRepositionId = null;
    }
    if (blurOverlayEl) {
        blurOverlayEl.remove();
        blurOverlayEl = null;
    }
}

let partialBlurEl = null;
let partialBlurRepositionId = null;
let partialBlurRegion = null;

function ensurePartialBlurOverlay(mountPoint) {
    if (partialBlurEl && partialBlurEl.parentElement === mountPoint) return partialBlurEl;
    if (partialBlurEl) partialBlurEl.remove();
    partialBlurEl = document.createElement("div");
    partialBlurEl.id = "nazafa-partial-blur-overlay";
    partialBlurEl.style.cssText = `
        position: fixed;
        backdrop-filter: blur(22px);
        -webkit-backdrop-filter: blur(22px);
        background: rgba(255, 255, 255, 0.02);
        z-index: 50;
        pointer-events: none;
        box-sizing: border-box;
        border-radius: 6px;
    `;
    mountPoint.appendChild(partialBlurEl);
    return partialBlurEl;
}

const NAZAFA_SUBTITLE_CONTAINER_SELECTORS = [
    ".player-timedtext", ".ytp-caption-window-container", ".atvwebplayersdk-captions-text",
    ".shaka-text-container", ".vjs-text-track-display", ".bmpui-subtitle-label",
    ".jw-captions", ".plyr__captions", ".vp-captions",
    ".hive-subtitle-renderer-cue",
    "[class*='timedtext']", "[class*='caption']", "[class*='subtitle']"
].join(", ");

function nazafaQueryAllDeep(selector, root) {
    const results = [];
    function walk(node) {
        if (!node || !node.querySelectorAll) return;
        results.push(...node.querySelectorAll(selector));
        node.querySelectorAll("*").forEach((el) => {
            if (el.shadowRoot) walk(el.shadowRoot);
        });
    }
    walk(root || document);
    return results;
}

function findActiveSubtitleRect() {
    try {
        const candidates = nazafaQueryAllDeep(NAZAFA_SUBTITLE_CONTAINER_SELECTORS);
        let best = null;
        let bestArea = Infinity;
        for (const el of candidates) {
            if (el.id === "nazafa-partial-blur-overlay" || el.id === "nazafa-blur-overlay") continue;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            if (!el.textContent || !el.textContent.trim()) continue;
            const area = rect.width * rect.height;
            if (area < bestArea) {
                bestArea = area;
                best = rect;
            }
        }
        return best;
    } catch (e) { /* تجاهل */ }
    return null;
}

function nazafaVideoContentRect(video) {
    const r = video.getBoundingClientRect();
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh || !r.width || !r.height) return r;
    const fit = (getComputedStyle(video).objectFit || "contain").toLowerCase();
    if (fit === "fill") return r;
    const scale = fit === "cover" ? Math.max(r.width / vw, r.height / vh) : Math.min(r.width / vw, r.height / vh);
    const w = vw * scale, h = vh * scale;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
}

function positionPartialBlur(video, region) {
    if (!partialBlurEl || !region) return;
    const rect = nazafaVideoContentRect(video);
    let top = rect.top + region.y * rect.height;
    let left = rect.left + region.x * rect.width;
    let width = region.width * rect.width;
    let height = region.height * rect.height;

    const subRect = findActiveSubtitleRect();
    if (subRect) {
        const SAFETY_MARGIN_PX = 4;
        const overlapsHorizontally = left < subRect.right && (left + width) > subRect.left;
        const subtitleTop = subRect.top - SAFETY_MARGIN_PX;
        const wouldClip = overlapsHorizontally && (top + height) > subtitleTop && top < subRect.bottom;
        if (wouldClip) {
            height = Math.max(0, subtitleTop - top);
        }
    }

    if (height <= 0) {
        partialBlurEl.style.display = "none";
        return;
    }
    partialBlurEl.style.display = "";
    partialBlurEl.style.top = `${top}px`;
    partialBlurEl.style.left = `${left}px`;
    partialBlurEl.style.width = `${width}px`;
    partialBlurEl.style.height = `${height}px`;
}

function showPartialBlur(video, region) {
    if (!region) return;
    partialBlurRegion = region;
    ensurePartialBlurOverlay(nazafaGetOverlayMountPoint(video));
    positionPartialBlur(video, region);

    if (partialBlurRepositionId) cancelAnimationFrame(partialBlurRepositionId);
    const loop = () => {
        if (!partialBlurEl) return;
        ensurePartialBlurOverlay(nazafaGetOverlayMountPoint(video));
        positionPartialBlur(video, partialBlurRegion);
        partialBlurRepositionId = requestAnimationFrame(loop);
    };
    partialBlurRepositionId = requestAnimationFrame(loop);
}

function hidePartialBlur() {
    if (partialBlurRepositionId) {
        cancelAnimationFrame(partialBlurRepositionId);
        partialBlurRepositionId = null;
    }
    if (partialBlurEl) {
        partialBlurEl.remove();
        partialBlurEl = null;
    }
    partialBlurRegion = null;
}

function getActiveVideoElement() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;

    const realVideos = globalThis.SalikFilterCore.titleVideoCandidates(videos);
    return realVideos.length > 0 ? realVideos.sort((a, b) => b.currentTime - a.currentTime)[0] : null;
}

function getNetflixActivePlayer() {
    try {
        const playerAPI = netflix.appContext.state.playerApp.getAPI().videoPlayer;
        const playerSessionIds = playerAPI.getAllPlayerSessionIds ? playerAPI.getAllPlayerSessionIds() : [];
        if (!playerSessionIds.length) return null;
        const activePlayerId = playerSessionIds.find(id => id.includes("watch")) || playerSessionIds[0];
        return playerAPI.getVideoPlayerBySessionId(activePlayerId);
    } catch (err) { return null; }
}

let nazafaNetflixPrevVolume = null;

function setNetflixMuted(muted) {
    try {
        const targetPlayer = getNetflixActivePlayer();
        if (!targetPlayer) return false;
        if (muted) {
            if (typeof targetPlayer.getVolume === "function") {
                const currentVolume = targetPlayer.getVolume();
                if (currentVolume > 0) nazafaNetflixPrevVolume = currentVolume;
            }
            if (typeof targetPlayer.setMuted === "function") targetPlayer.setMuted(true);
            if (typeof targetPlayer.setVolume === "function") targetPlayer.setVolume(0);
        } else {
            if (typeof targetPlayer.setMuted === "function") targetPlayer.setMuted(false);
            if (typeof targetPlayer.setVolume === "function") {
                targetPlayer.setVolume(nazafaNetflixPrevVolume > 0 ? nazafaNetflixPrevVolume : 100);
            }
        }
        return true;
    } catch (err) { console.warn("⚠️ Netflix Volume API failed."); return false; }
}

function nazafaIsSilenced(video, platform) {
    return platform === "appletv" ? video.volume === 0 : video.muted;
}
function nazafaSilence(video, platform) {
    if (platform === "appletv") {
        if (video.dataset.nazafaPrevVolume === undefined) {
            video.dataset.nazafaPrevVolume = String(video.volume);
        }
        video.volume = 0;
    } else {
        video.muted = true;
    }
}
function nazafaUnsilence(video, platform) {
    if (platform === "appletv") {
        const prev = parseFloat(video.dataset.nazafaPrevVolume);
        video.volume = (isFinite(prev) && prev > 0) ? prev : 1;
        delete video.dataset.nazafaPrevVolume;
    } else {
        video.muted = false;
    }
}

window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "NAZAFA_EXECUTE_ACTION" || !nazafaTrusted(event)) return;

    const { action, targetTime, disneyDelta, platform, description } = event.data;
    const video = getActiveVideoElement();
    if (!video) return;

    if (action === "skip") {
        let seekSuccessful = false;
        if (platform === "disney" && typeof disneyDelta === "number" && isFinite(disneyDelta) && disneyDelta > 0) {
            const beforeCt = video.currentTime;
            const target = beforeCt + disneyDelta;
            seekSuccessful = true;
            const runStepped = () => {
            const wasPlaying = !video.paused;
            video.pause();
            const prevOpacity = video.style.getPropertyValue("opacity");
            const prevOpacityPriority = video.style.getPropertyPriority("opacity");
            let revealed = false;
            let revealVideo = () => {
                if (revealed) return;
                revealed = true;
                setTimeout(() => {
                    if (prevOpacity) video.style.setProperty("opacity", prevOpacity, prevOpacityPriority);
                    else video.style.removeProperty("opacity");
                }, 80);
            };
            video.style.setProperty("opacity", "0", "important");
            nazafaMuteContext(video, platform);
            nazafaMute.acquire("skip-disney");
            const origRevealVideo = revealVideo;
            revealVideo = () => {
                origRevealVideo();
                setTimeout(() => { nazafaMuteContext(getActiveVideoElement() || video, platform); nazafaMute.release("skip-disney"); }, 150);
            };
            setTimeout(() => revealVideo(), 9000);
            const MAX_SAFE_SEEK_STEP = 11;
            const attemptSeek = (attemptNum, maxAttempts) => {
                const currentCt = video.currentTime;
                const remaining = target - currentCt;
                if (remaining <= 1) {
                    if (wasPlaying) video.play().catch(() => {});
                    revealVideo();
                    return;
                }
                const step = Math.min(remaining, MAX_SAFE_SEEK_STEP);
                video.currentTime = currentCt + step;
                if (attemptNum < maxAttempts) {
                    setTimeout(() => attemptSeek(attemptNum + 1, maxAttempts), 60);
                } else {
                    if (wasPlaying) video.play().catch(() => {});
                    revealVideo();
                }
            };
            attemptSeek(1, 60);
            };

            const dPlayer = document.querySelector("disney-web-player");
            const getDisneyPosMs = () => {
                try {
                    const ms = dPlayer.stateStore.getState().player.core.timeline.timeline.playheadPositionMs;
                    return (typeof ms === "number" && isFinite(ms)) ? ms : null;
                } catch (e) { return null; }
            };
            const startMs = getDisneyPosMs();
            const disneyWasPlaying = !video.paused || nazafaPointerDown || (Date.now() - nazafaLastPlayingAt) < 4000;
            if (dPlayer && dPlayer.mediaPlayer && typeof dPlayer.mediaPlayer.seek === "function" && startMs !== null) {
                const targetMs = startMs + disneyDelta * 1000;
                let seekCalled = true;
                try { dPlayer.mediaPlayer.seek(targetMs); } catch (e) { seekCalled = false; }
                if (!seekCalled) {
                    runStepped();
                } else {
                    let tries = 0;
                    const poll = setInterval(() => {
                        tries++;
                        const pos = getDisneyPosMs();
                        if (pos !== null && Math.abs(pos - targetMs) < 4000) { clearInterval(poll); nazafaDisneyResumeIfNeeded(dPlayer, video, disneyWasPlaying); return; }
                        if (tries >= 15) {
                            clearInterval(poll);
                            const p = getDisneyPosMs();
                            if (p !== null && Math.abs(p - startMs) > 20000 && Math.abs(p - targetMs) >= 4000) {
                                try { dPlayer.mediaPlayer.seek(startMs); } catch (e) {}
                            }
                            console.warn("⚠️ Nazafa Disney: seek اللحظي مانفعش، رجوع للخطوات القديمة");
                            runStepped();
                        }
                    }, 100);
                }
            } else {
                runStepped();
            }
        }
        if (!seekSuccessful && platform === "netflix") {
            try {
                const targetTimeMs = targetTime * 1000;
                const playerAPI = netflix.appContext.state.playerApp.getAPI().videoPlayer;
                const playerSessionIds = playerAPI.getAllPlayerSessionIds ? playerAPI.getAllPlayerSessionIds() : [];
                if (playerSessionIds.length > 0) {
                    const activePlayerId = playerSessionIds.find(id => id.includes("watch")) || playerSessionIds[0];
                    const targetPlayer = playerAPI.getVideoPlayerBySessionId(activePlayerId);
                    if (targetPlayer && typeof targetPlayer.seek === "function") {
                        targetPlayer.seek(targetTimeMs);
                        seekSuccessful = true;
                    }
                }
            } catch (err) { console.warn("⚠️ Netflix API failed."); }
        }

        if (!seekSuccessful) {
            video.currentTime = targetTime;
            seekSuccessful = true;
        }

        if (seekSuccessful) {
            nazafaMuteContext(video, platform);
            nazafaMute.acquire("skip");
            setTimeout(() => {
                nazafaMuteContext(getActiveVideoElement() || video, platform);
                nazafaMute.release("skip");
                setTimeout(() => {
                    const v = getActiveVideoElement() || video;
                    if (!nazafaMute.holding() && !nazafaMute.userMuted && nazafaIsSilenced(v, platform) && v.dataset.userMuted !== "true") {
                        console.warn(`⚠️ Nazafa: الصوت لسه مكتوم بعد التخطي رغم محاولة إعادة الفتح [platform=${platform}] — المشغّل بيرجّعه كتم بنفسه على الأغلب.`);
                        isSystemMute = true;
                        nazafaUnsilence(v, platform);
                        if (platform === "netflix") setNetflixMuted(false);
                        setTimeout(() => { isSystemMute = false; }, 50);
                    }
                }, 500);
            }, 600);
        }
    }
    else if (action === "mute") {
        nazafaMuteContext(video, platform);
        if (nazafaMute.holding("library")) {
            nazafaMute.reassert();
            if (nazafaMute.weMuted && nazafaMuteIsNetflix()) setNetflixMuted(true);
        } else nazafaMute.acquire("library");
    }
    else if (action === "unmute") {
        nazafaMuteContext(video, platform);
        nazafaMute.release("library");
    }
    else if (action === "blur") {
        if (video.dataset.nazafaBlurred !== "1") {
            video.dataset.nazafaPrevFilter = video.style.filter || "";
            video.dataset.nazafaBlurred = "1";
        }
        video.style.filter = "blur(40px)";
        showBlurOverlay(video, description);
    }
    else if (action === "partial_blur") {
        showPartialBlur(video, event.data.region);
    }
    else if (action === "unblur") {
        document.querySelectorAll("video[data-nazafa-blurred='1']").forEach((v) => {
            v.style.filter = v.dataset.nazafaPrevFilter || "";
            delete v.dataset.nazafaBlurred;
            delete v.dataset.nazafaPrevFilter;
        });
        hideBlurOverlay();
        hidePartialBlur();
    }
});

document.addEventListener('volumechange', (e) => {
    if (e.target.tagName === 'VIDEO') {
        if (isSystemMute) return;
        e.target.dataset.userMuted = e.target.muted ? "true" : "false";
        nazafaMute.userChanged(e.target.muted);
    }
}, true);

(function () {
    if (!/(^|\.)youtube\.com$/i.test(location.hostname)) return;

    const BLEEP_RE = /\[\s*_+\s*\]/;
    const EXTRA_RE = /(^|\s)((ابن|بن|ولاد|اولاد|ولد|بنت|بنات|ابو)\s+)?الوسخه(\s|$)|(^|\s)(ابن|بن|ولاد|اولاد|ولد|بنت|بنات|ابو)\s+الوسخ(\s|$)/;
    const EXTRA_FASHKH_RE = /(^|\s)(?:[وفبلك])?(?:ي|ت|ن|ا)?فشخ(?:ت|ه|ها|هم|ني|ك|نا|وا|ون)?(?=\s|$)/;
    const PAD_BEFORE_MS = 80, PAD_AFTER_MS = 30, MIN_WINDOW_MS = 200, MAX_WORD_MS = 700;

    let windows = [];
    let noTrackTries = 0, lastTriedVideoId = null;
    let loadedVideoId = null;
    let loadToken = 0;

    function post(active) {
        try { window.postMessage({ type: "NAZAFA_YT_TIMED_ACTIVE", active: !!active }, "*"); } catch (e) {}
    }

    function currentVideoId() {
        try {
            const u = new URL(location.href);
            return u.searchParams.get("v") || (u.pathname.match(/\/shorts\/([\w-]+)/) || [])[1] || (u.hash.match(/[?&]v=([\w-]+)/) || [])[1] || null;
        } catch (e) { return null; }
    }

    function textMatches(text) {
        if (!text) return false;
        if (BLEEP_RE.test(text)) return true;
        try {
            if (NazafaCensorCore.censorText(text) !== text) return true;
            const n = NazafaCensorCore.normalizeText(text).normalized;
            return EXTRA_RE.test(n) || EXTRA_FASHKH_RE.test(n);
        } catch (e) { return false; }
    }

    function buildWindows(json) {
        const out = [];
        (json.events || []).forEach((ev) => {
            if (!ev.segs || !ev.segs.length) return;
            const base = ev.tStartMs || 0;
            const evEnd = base + (ev.dDurationMs || 0);
            const items = ev.segs.map((sg, i) => {
                const s = base + (sg.tOffsetMs || 0);
                const next = ev.segs[i + 1];
                const e = next ? base + (next.tOffsetMs || 0) : evEnd;
                const txt = String(sg.utf8 || "");
                const estEnd = s + Math.min(MAX_WORD_MS, Math.max(200, txt.trim().length * 80));
                return { s, e: Math.min(e > s ? e : estEnd, estEnd), t: txt };
            });
            items.forEach((it, i) => {
                let hit = textMatches(it.t.trim());
                let from = it.s;
                if (!hit && i > 0 && textMatches((items[i - 1].t + " " + it.t).trim())) { hit = true; from = items[i - 1].s; }
                if (hit) out.push({ s: from - PAD_BEFORE_MS, e: it.e + PAD_AFTER_MS });
            });
        });
        out.sort((a, b) => a.s - b.s);
        const merged = [];
        out.forEach((w) => {
            if (w.e - w.s < MIN_WINDOW_MS) w.e = w.s + MIN_WINDOW_MS;
            const last = merged[merged.length - 1];
            if (last && w.s <= last.e) last.e = Math.max(last.e, w.e); else merged.push(w);
        });
        return merged;
    }

    /* Subscribe / like requests in the captions -> isolated.script.js skips them (YouTube "skip" options). */
    function postCaptionSkips(json, vid) {
        try {
            const segments = globalThis.SalikFilterCore.captionReminderSegments(json);
            window.postMessage({ type: "NAZAFA_YT_CAPTION_SKIPS", videoId: vid, segments }, "*");
            if (segments.length) console.log("⏭️ Salik YT: " + segments.length + " subscribe/like request(s) found in captions");
        } catch (e) {}
    }

    function pickTrack(tracks) {
        if (!tracks || !tracks.length) return null;
        return tracks.find((t) => t.kind === "asr") || tracks[0];
    }

    window.__nazafaYtCapture = function (url, text) {
        try {
            if (!/timedtext/i.test(url) || !text || text.charCodeAt(0) !== 123 /* { */) return;
            const vid = currentVideoId();
            if (vid && url.indexOf("v=" + vid) === -1) return;
            const json = JSON.parse(text);
            if (!json.events) return;
            const w = buildWindows(json);
            windows = windows.concat(w).sort((a, b) => a.s - b.s);
            postCaptionSkips(json, vid || currentVideoId());
            post(true);
            captured = true;
            console.log(`🎬 Nazafa YT: التقطنا ترجمة المشغّل — ${windows.length} نافذة كتم`);
        } catch (e) {}
    };
    let captured = false;

    function forcePlayerFetch(player, track, vid, token) {
        try {
            if (!player || !player.loadModule || !player.setOption) return;
            const wasOn = typeof player.isSubtitlesOn === "function" ? player.isSubtitlesOn() : false;
            if (wasOn) return;
            captured = false;
            const style = document.createElement("style");
            style.textContent = ".ytp-caption-window-container{visibility:hidden!important}";
            document.head.appendChild(style);
            player.loadModule("captions");
            player.setOption("captions", "track", { languageCode: track.languageCode });
            const startedAt = Date.now();
            const waiter = setInterval(() => {
                const done = captured || Date.now() - startedAt > 7000 || token !== loadToken;
                if (!done) return;
                clearInterval(waiter);
                try { player.unloadModule("captions"); } catch (e) {}
                setTimeout(() => style.remove(), 400);
                if (!captured) console.warn("Nazafa YT: ملقيناش رد الترجمة بعد ما شغّلناها برمجياً — الكتم هيعتمد على الترجمة المعروضة بس");
            }, 150);
        } catch (e) {
            console.warn("Nazafa YT: فشل تشغيل الترجمة برمجياً", e);
        }
    }

    async function loadForCurrentVideo() {
        const vid = currentVideoId();
        if (!vid || vid === loadedVideoId) return;
        if (vid !== lastTriedVideoId) { lastTriedVideoId = vid; noTrackTries = 0; }
        loadedVideoId = vid;
        windows = [];
        post(false);
        const token = ++loadToken;
        try {
            const player = document.getElementById("movie_player") || document.getElementById("ytlr-player__player-container-player");
            const resp = player && player.getPlayerResponse ? player.getPlayerResponse() : window.ytInitialPlayerResponse;
            if (resp && resp.videoDetails && resp.videoDetails.videoId && resp.videoDetails.videoId !== vid) { loadedVideoId = null; return; }
            const tracks = resp && resp.captions && resp.captions.playerCaptionsTracklistRenderer && resp.captions.playerCaptionsTracklistRenderer.captionTracks;
            const track = pickTrack(tracks);
            if (!track || !track.baseUrl) {
                if (++noTrackTries < 20) { loadedVideoId = null; return; }
                console.warn("Nazafa YT: مفيش ترجمة متاحة للفيديو ده"); return;
            }
            const url = track.baseUrl + (track.baseUrl.includes("?") ? "&" : "?") + "fmt=json3";
            const r = await (typeof originalFetch === "function" ? originalFetch : fetch).call(window, url, { credentials: "include" });
            const body = await r.text();
            if (token !== loadToken) return;
            if (!body || !body.trim().startsWith("{")) {
                console.warn("Nazafa YT: الجلب المباشر رجع فاضي (توكن pot) — هنخلي المشغّل نفسه يجيب الترجمة (مخفية) ونلتقطها");
                forcePlayerFetch(player, track, vid, token);
                return;
            }
            const json = JSON.parse(body);
            windows = buildWindows(json);
            postCaptionSkips(json, vid);
            post(true);
            console.log(`🎬 Nazafa YT: ${windows.length} نافذة كتم من ترجمة (${track.kind || "manual"}/${track.languageCode})`);
        } catch (e) {
            console.warn("Nazafa YT: فشل تحميل الترجمة", e);
        }
    }

    function tick() {
        try {
            const video = document.querySelector("video.html5-main-video") || document.querySelector("video");
            if (!video) return;
            const t = video.currentTime * 1000;
            const inside = nazafaYtAutoMuteEnabled && nazafaLanguageEnabled && windows.length && windows.some((w) => t >= w.s && t <= w.e);
            if (inside) {
                nazafaMuteContext(video, undefined);
                if (!nazafaMute.holding("yt-subs")) nazafaMute.acquire("yt-subs");
            } else if (nazafaMute.holding("yt-subs")) {
                nazafaMuteContext(video, undefined);
                nazafaMute.release("yt-subs");
            }
        } catch (e) {}
    }

    setInterval(tick, 30);
    setInterval(loadForCurrentVideo, 1500);
    window.addEventListener("yt-navigate-finish", () => { loadedVideoId = null; setTimeout(loadForCurrentVideo, 300); });
})();
})();
