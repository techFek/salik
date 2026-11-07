/*
 * Salik filter core: the one copy of the category schema and scene-matching rules.
 * Loaded by the catalog UI (ui/ext-app/services.js), by the engine in the ISOLATED world
 * (isolated.script.js) and in the MAIN world (main.script.js), and by the Node tests.
 * Plain script, no imports: it publishes globalThis.SalikFilterCore (and module.exports under Node).
 */
(function (root) {
    "use strict";
    if (root && root.SalikFilterCore) {
        if (typeof module === "object" && module && module.exports) module.exports = root.SalikFilterCore;
        return;
    }

    const SCHEMA = {
        nudity: {
            label: "المشاهد الحساسة",
            icon: "🔞",
            unitLabel: "مشهد",
            verb: "حجب",
            noneLabel: "لا يوجد مشاهد",
            subcategories: [
                { key: "kissing", label: "قبلات ومشاهد رومانسية", keywords: ["يقبل", "تقبل", "تقبيل", "قبلة", "القبل", "بوس", "حضن", "تحضن", "عناق", "تعانق", "kiss"] },
                { key: "relations", label: "علاقات جنسية وزنا", keywords: ["زنا", "يزنون", "اباحي", "اباحية", "علاقة حميمية", "حميمية", "فتاة الليل", "يتضاجعان", "affair", "intimate"] },
                { key: "lgbtq", label: "LGBTQ", keywords: ["تشبه الرجال بالنساء", "رجل يلبس النقاب", "لبس رجل للنقاب", "رجل يلبس فستان", "متنكر كامرأة", "متنكر كمربية", "يرتدي ملابس نساء", "شاذ", "لوطي", "متحول جنسيا", "ظهور علم المثليين", "علم المثليين", "lgbtq"] },
                { key: "exposure", label: "عري وإيحاءات جنسية", keywords: ["عري", "عاري", "عارية", "عراة", "تعري", "يخلع", "خالع", "ملط", "تغري", "يغري", "اغراء", "إغراء", "ايحاء", "إيحاء", "ايحائي", "ايحائية", "إيحائي", "إيحائية", "اشارة جنسية", "إشارة جنسية", "تعليق جنسي", "تعليق عري", "نكتة اباحية", "تحرش", "متحرش", "مغازلة", "يغازل", "رقص اغرائي", "الراقصة", "وضع مخل", "ديسكو", "نساء يرقصن", "sexy", "naked", "nudity", "boobs"] },
                { key: "attire", label: "ملابس كاشفة وتلميحات", keywords: ["مكشوف", "مكشوفة", "تكشف", "ظاهرة", "ظاهر", "بارزة", "بارز", "بكيني", "ملابس", "مؤخرة", "مؤخرته", "مؤخرتها", "مؤخرتهم", "مؤخرات", "مؤخراتهم", "عورة", "عورته", "عورتها", "عورات", "مفاتن", "لبس مثير", "لبس كاشف", "يبرز", "فستان كاشف", "دمية تلبس حمالة صدر", "ظهور اسفل ظهر", "revealing", "panties"] }
            ]
        },
        violence: {
            label: "لقطات عنيفة أو مقززة",
            icon: "🩸",
            unitLabel: "مشهد",
            verb: "حجب",
            noneLabel: "لا يوجد مشاهد",
            subcategories: [
                { key: "weapons", label: "أسلحة وقتل", keywords: ["سلاح", "سيف", "سكين", "خنجر", "قتل", "مقتول", "مقتولة", "طلقة", "رصاصة", "قطع رأس", "شنق", "مشنوق", "مشنوقة", "ميت", "حرق", "حترق", "احتراق", "انفجار", "غرق", "جثة", "حرب عنيفة", "رقاب اشخاص", "gun", "weapon", "kill", "murder", "uzi"] },
                { key: "abuse", label: "إيذاء جسدي", keywords: ["ضرب", "صفع", "طعن", "تعذيب", "خنق", "ذبح", "جلد", "سحل", "إخصاء", "اجهاض", "كسر ذراع", "دهس", "مضاربة", "abuse", "torture", "beating"] },
                { key: "disturbing", label: "مشاهد مقززة", keywords: ["قيء", "تقيأ", "تكرع", "بصق", "تجشأ", "تغوط", "ضرطة", "ضراط", "يضرط", "غازات", "مقزز", "مقرف", "مقرفة", "فضلات", "مشوه", "مشوهة", "مفقوعة", "تبول", "يخرج من بطن", "نصف بشري", "disturbing", "vomit", "gross", "poop", "pee"] },
                { key: "gore", label: "عنف مفرط ودماء", keywords: ["دماء", "دم يخرج", "الدم", "دامي", "مضرج", "جرح", "أشلاء", "نزيف", "ينزف", "gore", "blood"] }
            ]
        },
        language: {
            label: "الألفاظ الخارجة",
            icon: "🤬",
            unitLabel: "لفظ",
            verb: "كتم",
            noneLabel: "لا يوجد ألفاظ",
            subcategories: [
                { key: "blasphemy", label: "إساءة للمقدسات", keywords: ["مقدس", "الإله", "إله", "الاله", "تهكم عن الله", "تهكم عن الاله", "استهزاء بالدين", "سخرية من الدين", "تلبس النقاب وتسرق", "hell", "goddamn", "jesus", "christ", "lord"] },
                { key: "impiety", label: "سوء أدب مع الله", keywords: ["والنبي", "وحياة", "وحيات", "وحياه", "والنعمة", "وشرف", "ورحمة", "بالذمة", "بذمتك", "بزمتك", "وديني", "روح امك", "نهار اسود", "الحلف بغير الله", "دعاء لغير الله", "بشرفي", "وشرفي", "ليه يارب مخلقتنيش ولد", "البقية في حياتك", "يا لهوي", "احيه", "شيء الله لا يستطيع فعله"] },
                { key: "curses", label: "شتائم", keywords: ["بن الجزمة", "ابن الحرام", "كلب", "كلاب", "بقف", "نطع", "يا نهار اسود", "يانهار اسود", "نهارك اسود", "يا نهار ابوك اسود", "يا نهار ازرق", "يا نهار اسود ومنيل", "يا نهارك اسود ومنيل", "الزفت", "زفت", "يخرب بيتك", "يخربيت امك", "يا روح امك", "يلعن", "شتائم", "screw", "screwing", "screwed", "bastard", "motherfucker", "motherfucher", "bitch", "fu*kinm"] },
                { key: "profanity", label: "ألفاظ بذيئة", keywords: ["بذيء", "fuck", "fucking", "fuckin", "shit", "bullshit", "ass", "asshole", "dick", "prick", "crap", "damn", "bloody", "pissed", "piss", "butt", "bollocks", "arse", "كلمة قبيحة", "نكتة قبيحة", "أفعال قبيحة"] },
                { key: "insults", label: "إهانات بسيطة", keywords: ["غبي", "جزمة", "عبيط", "زبالة", "متخلف", "حيوان", "واطي", "واطية", "العويل", "عويل", "حمار", "الحمير", "وسخ", "الوسخة", "وساخة", "حقير", "قذر", "قذرة", "هبل", "اهبل", "نجس", "جاموسة", "ابن المجنونة", "ابن الصرمة", "ابن الشمامة", "معفن", "معفنة", "المعفن", "يا سافلة", "احمق", "لطخ", "creep", "stupid", "idiot", "idiots", "dumb", "dope", "fool", "fools", "moron", "loser", "jerk", "pathetic", "freak", "lame", "bugger", "dummy", "ugly", "scum", "scumbag", "lowlife", "nitwit", "dummies", "douche", "douchebag", "imbecile"] },
                { key: "sexual", label: "ألفاظ جنسية", keywords: ["hot", "sex", "sexy", "naked", "horny", "pedo", "penis", "pussy", "cock", "cocksucker", "scrotum", "suck", "sucked", "sucking", "hump", "shag", "whore", "slut", "playboy", "porn", "nude", "hook up", "sleeping with", "sleep with", "prostitution", "المزة", "مزة", "مزز", "فاجرة", "الفاجرة", "فاجره", "الفاجره"] },
                { key: "substanceTalk", label: "ألفاظ تعاطي", keywords: [] }
            ]
        },
        substance: {
            label: "لقطات تعاطي ومسكرات",
            icon: "🚬",
            unitLabel: "مشهد",
            verb: "حجب",
            noneLabel: "لا يوجد مشاهد",
            subcategories: [
                { key: "smoking", label: "تدخين", keywords: ["سيجارة", "سجائر", "سجارة", "سيجار", "سيغار", "تدخين", "دخن", "شيشة", "أرجيلة", "الأرجيلة", "الغليون", "cigarette", "smoking", "cigarates"] },
                { key: "alcohol", label: "كحول وخمور", keywords: ["خمر", "خمور", "كحول", "بيرة", "بيره", "جعة", "سكران", "مخمور", "يترنح", "شامبانيا", "غيبسون", "مارغاريت", "مارجاريت", "تكيلا", "wine", "beer", "alcohol", "drunk", "rum", "whiskey", "vodka", "gin", "tequila"] },
                { key: "drugs", label: "مخدرات", keywords: ["مخدرات", "مخدر", "حشيش", "ترامادول", "كوكايين", "هروين", "استروكس", "بانجو", "بودرة", "حبوب", "حبة", "جوينت", "بودرجي", "drugs", "narcotic", "pcp", "weed", "joint", "cocaine", "pot", "crack"] },
                { key: "gambling", label: "قمار ومراهنات", keywords: ["قمار", "مقامرة", "يراهن", "مراهنة", "gambling"] }
            ]
        }
    };

    const GROUP_KEYS = Object.keys(SCHEMA);
    const OTHER_SUBKEY = "other";

    const CATEGORY_ALIASES = [
        { group: "nudity", words: ["nudity", "nude", "sex", "sexual"] },
        { group: "violence", words: ["violence", "violent", "blood", "gore"] },
        { group: "language", words: ["language", "profanity", "swearing"] },
        { group: "substance", words: ["substance", "drug", "drugs", "alcohol", "smoking", "tobacco"] }
    ];

    const loggedUnknown = new Set();
    function logUnknownCategory(raw) {
        const key = String(raw);
        if (loggedUnknown.has(key)) return;
        loggedUnknown.add(key);
        try { console.warn("[Salik] Unknown filter category, scene not assigned to any group:", JSON.stringify(raw)); } catch (e) {}
    }

    function normalizeToGroupKey(rawCategory) {
        const cat = String(rawCategory == null ? "" : rawCategory).trim().toLowerCase();
        if (!cat) { logUnknownCategory(rawCategory); return null; }
        if (SCHEMA[cat]) return cat;
        const tokens = cat.split(/[^a-z]+/).filter(Boolean);
        for (const { group, words } of CATEGORY_ALIASES) {
            if (tokens.some((t) => words.indexOf(t) !== -1)) return group;
        }
        logUnknownCategory(rawCategory);
        return null;
    }

    function groupsOf(filterItem) {
        if (!filterItem) return [];
        const out = [];
        String(filterItem.category == null ? "" : filterItem.category).split(/[,،]/).forEach((part) => {
            const g = normalizeToGroupKey(part);
            if (g && out.indexOf(g) === -1) out.push(g);
        });
        return out;
    }

    function normalizeArabic(str) {
        if (!str) return "";
        return String(str)
            .replace(/[ً-ٰٟ]/g, "")
            .replace(/[إأآٱ]/g, "ا")
            .replace(/ى/g, "ي")
            .replace(/ـ/g, "");
    }

    function buildHaystack(filterItem) {
        const raw = [filterItem.reason, filterItem.original_description].filter(Boolean).join(" ").toLowerCase();
        return normalizeArabic(raw);
    }

    const ARABIC_RE = /[؀-ۿ]/;
    /* Same boundaries as subtitle-censor-core.js: no letter or digit (any script) on either side. */
    const WORD_BOUNDARY_BEFORE = "(?<![\\p{L}\\p{N}])";
    const WORD_BOUNDARY_AFTER = "(?![\\p{L}\\p{N}])";
    const ARABIC_PREFIX = "(?:[وف]?(?:[بلك]?ال|لل|[بلك])?)";
    const NO_KAF_PREFIX = new Set(["بيرة", "بيره"].map(normalizeArabic));

    function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

    const regexCache = new Map();
    function keywordRegex(keyword) {
        const kw = normalizeArabic(String(keyword).toLowerCase()).trim();
        if (regexCache.has(kw)) return regexCache.get(kw);
        let re = null;
        if (kw) {
            const body = kw.split(/\s+/).map(escapeRegex).join("\\s+");
            if (ARABIC_RE.test(kw)) {
                const prefix = NO_KAF_PREFIX.has(kw) ? "(?:[وف]?(?:[بل]?ال|لل|[بل])?)" : ARABIC_PREFIX;
                re = new RegExp(WORD_BOUNDARY_BEFORE + prefix + body + WORD_BOUNDARY_AFTER, "u");
            } else {
                re = new RegExp("(?<![a-z0-9])" + body + "(?![a-z0-9])", "i");
            }
        }
        regexCache.set(kw, re);
        return re;
    }

    function keywordInText(haystack, keyword) {
        const re = keywordRegex(keyword);
        return !!re && re.test(haystack);
    }

    function keywordMatches(haystack, keywords) {
        return (keywords || []).some((kw) => keywordInText(haystack, kw));
    }

    function subKeysIn(groupKey, haystack) {
        const group = SCHEMA[groupKey];
        if (!group) return [];
        return group.subcategories.filter((s) => keywordMatches(haystack, s.keywords)).map((s) => s.key);
    }

    function matchSubcategory(groupKey, filterItem) {
        if (!filterItem) return OTHER_SUBKEY;
        const keys = subKeysIn(groupKey, buildHaystack(filterItem));
        return keys.length ? keys[0] : OTHER_SUBKEY;
    }

    function classify(filterItem) {
        if (!filterItem) return [];
        const haystack = buildHaystack(filterItem);
        return groupsOf(filterItem).map((groupKey) => {
            const subKeys = subKeysIn(groupKey, haystack);
            return { groupKey, subKey: subKeys.length ? subKeys[0] : OTHER_SUBKEY, subKeys };
        });
    }

    function matchAllSubcategories(filterItem) {
        return classify(filterItem).map(({ groupKey, subKey }) => ({ groupKey, subKey }));
    }

    /*
     * True when the scene belongs to groupKey only (and, with subKey, to that one sub-category only).
     * Used before turning a scene off for a whole group/sub-category, so scenes shared with another
     * group or sub-category are left alone.
     */
    function belongsOnlyTo(filterItem, groupKey, subKey) {
        const parts = classify(filterItem);
        if (parts.length !== 1 || parts[0].groupKey !== groupKey) return false;
        if (subKey === undefined) return true;
        const keys = parts[0].subKeys;
        return keys.length === 0 ? subKey === OTHER_SUBKEY : (keys.length === 1 && keys[0] === subKey);
    }

    function groupAllows(groupSettings, subKeys) {
        if (!groupSettings || groupSettings.enabled === false) return false;
        if (!subKeys.length) return true;
        const subs = groupSettings.subs || {};
        return subKeys.some((k) => subs[k] !== false);
    }

    function shouldFilter(filterItem, settings) {
        const parts = classify(filterItem);
        if (!parts.length) return false;
        if (!settings) return true;
        return parts.some(({ groupKey, subKeys }) => groupAllows(settings[groupKey], subKeys));
    }

    function buildDefaultSettings() {
        const defaults = {};
        GROUP_KEYS.forEach((groupKey) => {
            const subs = {};
            SCHEMA[groupKey].subcategories.forEach((s) => { subs[s.key] = true; });
            defaults[groupKey] = { enabled: true, subs };
        });
        return defaults;
    }

    function categorizeFiltersDetailed(filters) {
        const result = {};
        GROUP_KEYS.forEach((groupKey) => {
            const group = SCHEMA[groupKey];
            const bySub = {};
            group.subcategories.forEach((s) => { bySub[s.key] = []; });
            result[groupKey] = Object.assign({}, group, { items: [], bySub, otherItems: [] });
        });
        (filters || []).forEach((f) => {
            if (!f) return;
            classify(f).forEach(({ groupKey, subKey }) => {
                const bucket = result[groupKey];
                bucket.items.push(f);
                if (subKey === OTHER_SUBKEY) bucket.otherItems.push(f);
                else bucket.bySub[subKey].push(f);
            });
        });
        return result;
    }

    function categorizeFilters(filters) {
        const d = categorizeFiltersDetailed(filters);
        const out = {};
        GROUP_KEYS.forEach((g) => { out[g] = { label: SCHEMA[g].unitLabel, verb: SCHEMA[g].verb, items: d[g].items }; });
        return out;
    }

    /* Per-title group state. filters carry __key (the library key of the title/episode they belong to). */
    function titleGroupStates(filters, disabledStore, settings) {
        const detailed = categorizeFiltersDetailed(filters);
        const store = disabledStore || {};
        return GROUP_KEYS.map((g) => {
            const items = detailed[g].items;
            const offCount = items.filter((f) => (store[f.__key] || {})[f.id]).length;
            const globalOn = !settings || !settings[g] || settings[g].enabled !== false;
            return { g, items, offCount, on: items.length > 0 && offCount < items.length, globalOn };
        });
    }

    /* Turns a whole group on/off for one title. Only scenes of that group are touched. Returns the new store. */
    function toggleTitleGroupStore(filters, disabledStore, groupKey, enable) {
        const store = JSON.parse(JSON.stringify(disabledStore || {}));
        const grp = titleGroupStates(filters, store, null).find((x) => x.g === groupKey);
        if (!grp) return store;
        const turnOn = enable === undefined ? !grp.on : !!enable;
        grp.items.forEach((f) => {
            const m = store[f.__key] || (store[f.__key] = {});
            if (turnOn) delete m[f.id]; else m[f.id] = true;
            if (!Object.keys(m).length) delete store[f.__key];
        });
        return store;
    }

    /*
     * Subtitle cleaning and YouTube subtitle muting are language features: everything they act on is a
     * word. So the language group gates all of them, and each word list follows its language sub-key.
     * settings = filterSettings shape ({ language: { enabled, subs } }).
     */
    const SUBTITLE_CATEGORY_SUBS = {
        explicit: ["sexual"],
        substance: ["substanceTalk"],
        insults: ["insults"],
        profanity: ["profanity", "curses", "blasphemy", "impiety"],
        youtubeExtra: ["profanity", "curses", "blasphemy", "impiety", "insults", "sexual"]
    };

    function subtitleCategoryEnabled(category, settings) {
        if (!settings) return true;
        const lang = settings.language;
        if (!lang || lang.enabled === false) return false;
        const keys = SUBTITLE_CATEGORY_SUBS[category];
        if (!keys) return true;
        const subs = lang.subs || {};
        return keys.some((k) => subs[k] !== false);
    }

    /* ---------- Scene timing / overlap resolution (used by the engine) ---------- */

    function num(v) {
        if (v === null || v === undefined || v === "") return NaN;
        const n = typeof v === "number" ? v : parseFloat(v);
        return isFinite(n) ? n : NaN;
    }

    /* A scene whose start or end is not a valid number, or whose end is before its start, is ignored. */
    function timing(f) {
        const start = num(f.start_time !== undefined ? f.start_time : f.start);
        const end = num(f.end_time !== undefined ? f.end_time : f.end);
        if (!isFinite(start) || !isFinite(end) || end < start) return null;
        return { start, end, endValid: true };
    }

    function actionOf(f) {
        return String(f.action_type || f.action || "").toLowerCase().trim();
    }

    /*
     * Picks what should happen at `time`. Only scenes that are not disabled for this title and that the
     * settings allow are considered. Skip wins; otherwise blur (or partial_blur) and mute can both apply.
     */
    function resolveActiveFilters(filters, time, opts) {
        const o = opts || {};
        const disabled = o.disabledIds || {};
        const lead = o.lead || 0;
        const result = { skip: null, blur: null, mute: null, any: false, near: false };
        (filters || []).forEach((f) => {
            if (!f || disabled[f.id]) return;
            const tm = timing(f);
            if (!tm) return;
            /* SponsorBlock segments are switched on/off by their own YouTube options, not the library groups. */
            const allowed = f.source === "sponsorblock" || shouldFilter(f, o.settings);
            if (o.nearWindow && tm.start - time > -1 && tm.start - time < o.nearWindow && allowed) result.near = true;
            if (time < tm.start - lead || time > tm.end) return;
            if (!allowed) return;
            const a = actionOf(f);
            if (a === "skip") {
                if (tm.end > time && (!result.skip || tm.end > timing(result.skip).end)) result.skip = f;
            } else if (a === "blur" || a === "partial_blur") {
                if (!result.blur || (actionOf(result.blur) === "partial_blur" && a === "blur")) result.blur = f;
            } else if (a === "mute") {
                if (!result.mute) result.mute = f;
            }
        });
        result.any = !!(result.skip || result.blur || result.mute);
        if (result.any) result.near = true;
        return result;
    }

    /* ---------- YouTube: SponsorBlock segments (sponsor, subscribe reminders, intro/outro…) ---------- */

    /* User options -> SponsorBlock categories. Data: sponsor.ajay.app (CC BY-NC-SA 4.0). */
    const YT_SKIP_OPTIONS = [
        { key: "sponsor", sb: ["sponsor"], label: "إعلان مدفوع", labelEn: "Paid sponsor" },
        { key: "interaction", sb: ["interaction"], label: "تذكير بالاشتراك والإعجاب", labelEn: "Subscribe / like reminder" },
        { key: "selfpromo", sb: ["selfpromo"], label: "ترويج ذاتي", labelEn: "Self promotion" },
        { key: "introOutro", sb: ["intro", "outro"], label: "المقدمة والخاتمة", labelEn: "Intro and outro" }
    ];
    const SPONSORBLOCK_API = "https://sponsor.ajay.app/api/skipSegments/";

    function defaultYtSkip() {
        const o = {};
        YT_SKIP_OPTIONS.forEach((x) => { o[x.key] = true; });
        return o;
    }

    function ytSkipCategories(ytSkip) {
        const on = Object.assign(defaultYtSkip(), ytSkip || {});
        return YT_SKIP_OPTIONS.filter((x) => on[x.key] !== false).reduce((a, x) => a.concat(x.sb), []);
    }

    /* Privacy-preserving lookup: only the first 4 hex chars of sha256(videoId) leave the device. */
    function sponsorBlockUrl(hashPrefix, categories) {
        return SPONSORBLOCK_API + encodeURIComponent(hashPrefix) + "?categories=" + encodeURIComponent(JSON.stringify(categories)) + "&actionTypes=" + encodeURIComponent(JSON.stringify(["skip"]));
    }

    /* API answer (array of { videoID, segments }) -> engine filters for this video, enabled options only. */
    function sponsorBlockToFilters(answer, videoId, ytSkip) {
        const cats = new Set(ytSkipCategories(ytSkip));
        const entry = (Array.isArray(answer) ? answer : []).find((x) => x && x.videoID === videoId);
        const out = [];
        ((entry && entry.segments) || []).forEach((sg) => {
            if (!sg || !cats.has(sg.category) || (sg.actionType && sg.actionType !== "skip")) return;
            const seg = sg.segment || [];
            const start = Number(seg[0]), end = Number(seg[1]);
            if (!isFinite(start) || !isFinite(end) || end - start < 0.5) return;
            const opt = YT_SKIP_OPTIONS.find((x) => x.sb.indexOf(sg.category) !== -1);
            out.push({
                id: "sb-" + (sg.UUID || (sg.category + "-" + start)), start, end, action_type: "skip",
                category: "youtube", original_description: opt ? opt.label : sg.category, source: "sponsorblock"
            });
        });
        return out.sort((a, b) => a.start - b.start);
    }

    /* ---------- Which <video> is the title (ads and short previews are skipped) ---------- */

    const MIN_TITLE_DURATION_S = 30;
    const AD_CONTAINER_SELECTOR = ".ad-showing, .ad-interrupting, .ytp-ad-module, .ytp-ad-player-overlay, .video-ads, [class~='ad-container'], [id~='ad-container']";

    function isAdOrPreviewVideo(video) {
        try {
            const d = video.duration;
            if (typeof d === "number" && isFinite(d) && d > 0 && d < MIN_TITLE_DURATION_S) return true;
            if (typeof video.closest === "function" && video.closest(AD_CONTAINER_SELECTOR)) return true;
        } catch (e) {}
        return false;
    }

    function titleVideoCandidates(videos) {
        return Array.from(videos || []).filter((video) => {
            try {
                if (video.offsetWidth === 0 || video.offsetHeight === 0) return false;
                return !isAdOrPreviewVideo(video);
            } catch (e) { return false; }
        });
    }

    /* ---------- Mute ownership (MAIN world) ---------- */

    /*
     * Several sources may want the video muted at once ("library", "yt-subs", "skip"). The video is
     * unmuted only when every source has released it, and never if the user muted it themselves.
     * `io` = { isMuted(), mute(), unmute() } so the logic can be tested without a browser.
     */
    function createMuteArbiter(io) {
        const sources = new Set();
        let weMuted = false;
        let userMuted = false;
        return {
            acquire(src) {
                sources.add(src);
                if (!weMuted && !io.isMuted()) { io.mute(); weMuted = true; }
            },
            release(src) {
                sources.delete(src);
                if (sources.size === 0 && weMuted) {
                    weMuted = false;
                    if (!userMuted) io.unmute();
                }
            },
            reassert() {
                if (sources.size && weMuted && !io.isMuted()) io.mute();
            },
            userChanged(muted) {
                userMuted = !!muted;
                if (!muted && weMuted) weMuted = false;
            },
            holding(src) { return src ? sources.has(src) : sources.size > 0; },
            get weMuted() { return weMuted; },
            get userMuted() { return userMuted; }
        };
    }

    /* ---------- Finding the title that is playing (same rules as LibraryMatcher.kt) ---------- */

    /*
     * The id is matched only against item.platforms[platform] of the platform that is playing: its id,
     * or the id appearing as a whole segment of that platform's url. Never the library key, never another
     * platform's entry. Series entries are never returned. When several items share the id (episodes),
     * the episode number, then the page url, pick one. Stremio ids (tt…[:season:episode]) are exact.
     */
    const STREMIO_ID_RE = /^tt\d{7,9}(?::\d+:\d+)?$/i;
    const STREMIO_BARE_RE = /^tt\d{7,9}$/i;

    function normalizeId(raw) { return String(raw == null ? "" : raw).trim().replace(/%3A/gi, ":"); }

    function platformEntry(platforms, name) {
        if (!platforms || typeof platforms !== "object") return null;
        if (platforms[name] && typeof platforms[name] === "object") return platforms[name];
        const k = Object.keys(platforms).find((x) => x.toLowerCase() === name);
        return k && platforms[k] && typeof platforms[k] === "object" ? platforms[k] : null;
    }

    function idAppearsAsWholeSegment(url, id) {
        const s = String(id);
        if (!url || s.length < 3) return false;
        if (!/\d/.test(s) && s.length < 8) return false;
        return new RegExp("(^|[^0-9A-Za-z])" + escapeRegex(s) + "($|[^0-9A-Za-z])").test(String(url));
    }

    function urlTokens(url) {
        let u = String(url || "");
        try { u = decodeURIComponent(u); } catch (e) {}
        u = u.toLowerCase().replace(/^[a-z]+:\/\//, "");
        const slash = u.indexOf("/");
        u = slash === -1 ? "" : u.slice(slash + 1);
        return new Set(u.split(/[\/#?&=]/).filter((t) => t.length >= 2));
    }

    function findLibraryItem(lib, movieIdRaw, platformRaw, opts) {
        const o = opts || {};
        const movieId = normalizeId(movieIdRaw);
        const platform = String(platformRaw || "").trim().toLowerCase();
        if (!lib || typeof lib !== "object" || !movieId || !platform || platform === "general" || platform === "unknown") return null;
        const items = Object.keys(lib).map((key) => [key, lib[key]]).filter(([, it]) => it && typeof it === "object" && it.type !== "series");
        const withKey = ([key, it]) => Object.assign({}, it, { _libraryKey: key });

        if (platform === "stremio") {
            if (!STREMIO_ID_RE.test(movieId)) return null;
            const bare = STREMIO_BARE_RE.test(movieId);
            const hit = items.find(([, it]) => {
                if (bare && it.type === "episode") return false;
                const e = platformEntry(it.platforms, "stremio");
                return !!e && normalizeId(e.id).toLowerCase() === movieId.toLowerCase();
            });
            return hit ? withKey(hit) : null;
        }

        const onPlatform = items.filter(([, it]) => platformEntry(it.platforms, platform));
        let found = onPlatform.filter(([, it]) => { const e = platformEntry(it.platforms, platform); return e.id != null && String(e.id) === movieId; });
        if (!found.length) found = onPlatform.filter(([, it]) => { const e = platformEntry(it.platforms, platform); return !!e.url && idAppearsAsWholeSegment(e.url, movieId); });
        if (!found.length) return null;
        let pool = found;
        const ep = Number(o.episode);
        if (pool.length > 1 && ep > 0) {
            const same = pool.filter(([, it]) => Number(it.episode) === ep);
            if (same.length) pool = same;
        }
        if (pool.length > 1 && o.pageUrl) {
            const page = urlTokens(o.pageUrl);
            const scored = pool.map((c) => [c, Array.from(urlTokens(platformEntry(c[1].platforms, platform).url)).filter((t) => page.has(t)).length]);
            const best = Math.max.apply(null, scored.map((x) => x[1]));
            pool = scored.filter((x) => x[1] === best).map((x) => x[0]);
        }
        return withKey(pool[0]);
    }

    /* ---------- Library validation (same rules as SalikBackend.validateLibrary) ---------- */

    function validateLibrary(lib) {
        const errors = [];
        if (!lib || typeof lib !== "object" || Array.isArray(lib)) return { ok: false, errors: ["root is not an object"] };
        const keys = Object.keys(lib);
        if (!keys.length) errors.push("library is empty");
        keys.forEach((key) => {
            const item = lib[key];
            if (!item || typeof item !== "object" || Array.isArray(item)) { errors.push(key + ": item is not an object"); return; }
            if (item.filters === undefined || item.filters === null || item.filters === "") return;
            if (!Array.isArray(item.filters)) { errors.push(key + ": filters is not an array"); return; }
            const seen = new Set();
            item.filters.forEach((f, i) => {
                const where = key + "#" + i;
                if (!f || typeof f !== "object") { errors.push(where + ": filter is not an object"); return; }
                const id = f.id;
                if (id === undefined || id === null || id === "") errors.push(where + ": missing id");
                else if (seen.has(String(id))) errors.push(where + ": duplicate id " + id);
                else seen.add(String(id));
                const s = f.start, e = f.end;
                if (typeof s !== "number" || !isFinite(s)) errors.push(where + ": start is not a number");
                if (typeof e !== "number" || !isFinite(e)) errors.push(where + ": end is not a number");
                if (typeof s === "number" && typeof e === "number" && e < s) errors.push(where + ": end < start");
            });
        });
        return { ok: errors.length === 0, errors };
    }

    const api = {
        SUBCATEGORY_SCHEMA: SCHEMA, GROUP_KEYS, OTHER_SUBKEY,
        normalizeToGroupKey, groupsOf, normalizeArabic, buildHaystack,
        keywordInText, keywordMatches, matchSubcategory, classify, matchAllSubcategories, belongsOnlyTo,
        shouldFilter, buildDefaultSettings, categorizeFiltersDetailed, categorizeFilters,
        titleGroupStates, toggleTitleGroupStore, subtitleCategoryEnabled,
        timing, actionOf, resolveActiveFilters, createMuteArbiter, validateLibrary,
        isAdOrPreviewVideo, titleVideoCandidates,
        normalizeId, findLibraryItem, idAppearsAsWholeSegment,
        YT_SKIP_OPTIONS, defaultYtSkip, ytSkipCategories, sponsorBlockUrl, sponsorBlockToFilters
    };
    if (root) root.SalikFilterCore = api;
    if (typeof module === "object" && module && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
