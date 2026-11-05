
const DICT = {
    "التحكم": "Filters", "المنصات": "Platforms", "الحساب": "Account",
    "نتفليكس": "Netflix", "أمازون": "Prime Video", "يانجو": "Yango Play", "ديزني+": "Disney+", "شاهد": "Shahid",
    "واتش ات": "Watch It", "تود": "Tod", "يوتيوب": "YouTube",
    "لا يوجد": "None", "لا يوجد مشاهد من هذا النوع حالياً": "No scenes of this type",
    "مشهد محجوب": "Filtered scene", "كتم الألفاظ التلقائي على يوتيوب": "Auto-mute bad language on YouTube", "يكتم الصوت لحظة نطق اللفظ الخارج في فيديوهات يوتيوب اعتماداً على ترجمتها": "Mutes the moment a bad word is spoken in YouTube videos, using their captions", "تشفير الترجمة النصية": "Subtitle censoring",
    "يستبدل الألفاظ الممنوعة في نص الترجمة المعروض على الشاشة بالرموز": "Replaces inappropriate words in the on-screen subtitles with symbols",
    "مشاهد أخرى غير مصنّفة": "Other uncategorized scenes", "الكل": "All",
    "ابحث عن فيلم أو مسلسل مدعوم...": "Search a supported movie or series...",
    "الأعمال المدعومة والمفلترة هنا:": "Supported & filtered titles:",
    "لا توجد أعمال مدعومة مضافة حالياً.": "No supported titles yet.",
    "من فضلك اكتب اسم العمل ووصف المشكلة.": "Please enter the title and describe the issue.",
    "مراجعة مشهد لم يُحجب": "Report a missed scene",
    "شاهدت مشهداً كان ينبغي حجبه ولم يُحجب؟ بلّغنا عنه وسيراجعه الفريق.": "Saw a scene that should have been filtered? Report it and we'll review it.",
    "اسم العمل (فيلم/مسلسل)": "Title (movie/series)",
    "إرسال البلاغ": "Submit report",
    "حدث خطأ أثناء الإرسال، حاول مرة أخرى.": "Something went wrong, please try again.",
    "هذا العمل غير موجود في القائمة بعد": "This title isn't in the list yet",
    "هل تقترح إضافته؟": "Suggest adding it?",
    "نعم، اقترحه": "Yes, suggest it", "لا": "No",
    "وصلنا اقتراحك، شكراً لك!": "Thanks, we got your suggestion!",
    "سبق أن اقترحت هذا العمل": "You already suggested this title",
    "سنراجعه وسيُضاف إلى المكتبة قريباً.": "We'll review it and add it soon.",
    "اقتراحك لدى فريق المراجعة بالفعل.": "Your suggestion is already with the team.",
    "جارٍ الإرسال...": "Sending...", "إغلاق": "Close", "حدّث الآن": "Update now", "جارٍ الفحص...": "Checking...",
    "يتوفر إصدار أحدث من سالك": "A newer version of Salik is available",
    "المنصة (اختياري)": "Platform (optional)", "منصة أخرى": "Other platform",
    "من فضلك اكتب اسم العمل المقترح.": "Please enter the suggested title.",
    "اقتراح فيلم أو مسلسل جديد للفلترة": "Suggest a new movie or series",
    "لم تجد عملاً معيناً في المكتبة؟ اقترحه علينا وسنضيفه إلى قائمة المراجعة.": "Can't find a title? Suggest it and we'll add it to the review queue.",
    "ملاحظات إضافية (اختياري)": "Additional notes (optional)",
    "مثال: رابط العمل أو سبب الاقتراح": "e.g. a link to the title or why",
    "إرسال الاقتراح": "Submit suggestion",
    "سالك مجاني ومفتوح المصدر": "Salik is free & open source",
    "إن نفعك فادعُ لنا، وإن شئت فساهم في استمراره.": "If it helped you, please pray for us — and support it if you wish.",
    "☕ صبّح علينا بجنيه": "☕ Buy me a coffee",
    "الشيفرة المصدرية على GitHub": "Source code on GitHub",
    "منصة تصفح": "Browsing platform",
    "حمّل سالك على أجهزتك الأخرى": "Get Salik on your other devices",
    "حمّله من": "Get it on", "حمّل نسخة أندرويد تي في من GitHub": "Get the Android TV version on GitHub",
    "جاري الفحص والربط مع قاعدة البيانات...": "Checking the library...",
    "لم يتم العثور على فلاتر لهذا العمل": "No filters found for this title",
    "لا يوجد عمل نشط حالياً": "No active title right now",
    "جاري التحميل...": "Loading...",
    "عري": "Nudity", "مشاهد رومانسية": "Romantic scenes",
    "مشهد": "Scene", "ألفاظ": "Language", "المشاهد الحساسة": "Sensitive scenes",
    "قبلات ومشاهد رومانسية": "Kissing & romantic scenes",
    "علاقات جنسية وزنا": "Sexual relations",
    "عري وإيحاءات جنسية": "Nudity & sexual content",
    "ملابس كاشفة وتلميحات": "Revealing clothing & innuendo",
    "لقطات عنيفة أو مقززة": "Violent or disgusting shots",
    "أسلحة وقتل": "Weapons & killing", "إيذاء جسدي": "Physical harm",
    "مشاهد مقززة": "Disgusting scenes", "عنف مفرط ودماء": "Extreme violence & gore",
    "الألفاظ الخارجة": "Profanity", "إساءة للمقدسات": "Blasphemy",
    "سوء أدب مع الله": "Disrespect to God", "شتائم": "Insults",
    "ألفاظ بذيئة": "Vulgar words", "إهانات بسيطة": "Mild insults",
    "ألفاظ جنسية": "Sexual language", "ألفاظ تعاطي": "Substance-related words",
    "لقطات تعاطي ومسكرات": "Substance use scenes", "تدخين": "Smoking",
    "كحول وخمور": "Alcohol", "مخدرات": "Drugs", "قمار ومراهنات": "Gambling",
    "خفيف": "Light", "متوسط": "Medium", "كثيف": "Heavy",
    "اللغة / Language": "Language / اللغة"
};

const PATTERNS = [
    [/^تم تحديث سالك إلى الإصدار\s*(.*)$/, "Salik was updated to version $1"],
    [/^إصدارك\s*(.*)$/, "Your version $1"],
    [/^(\d+)\s*مشهد(?:\s*محجوب)?$/, "$1 scene(s)"],
    [/^(\d+)\s*مشاهد$/, "$1 scenes"]
];

export let LANG = "ar";
try {
    const r = await chrome.storage.local.get(["salikLang"]);
    if (r.salikLang === "en" || r.salikLang === "ar") LANG = r.salikLang;
    else LANG = (chrome.i18n.getUILanguage() || "ar").toLowerCase().startsWith("ar") ? "ar" : "en";
} catch (e) { /* ignore */ }

export async function setLang(l) {
    await chrome.storage.local.set({ salikLang: l });
    location.reload();
}

export function t(s) {
    if (LANG !== "en" || typeof s !== "string") return s;
    const k = s.trim();
    if (DICT[k]) return s.replace(k, DICT[k]);
    const m = k.match(/^([^\u0600-\u06FFA-Za-z0-9]+)(.+)$/);
    if (m && DICT[m[2].trim()]) return s.replace(k, m[1] + DICT[m[2].trim()]);
    for (const [re, rep] of PATTERNS) if (re.test(k)) return s.replace(k, k.replace(re, rep));
    return s;
}

export function localizeLibrary(lib) {
    if (LANG !== "en" || !lib || typeof lib !== "object") return lib;
    for (const key of Object.keys(lib)) {
        const it = lib[key];
        if (!it || typeof it !== "object") continue;
        if (it.title_en) it.title = it.title_en;
        if (it.description_en) it.description = it.description_en;
        const fl = Array.isArray(it.filters) ? it.filters : (it.filters ? Object.values(it.filters) : []);
        fl.forEach((f) => { if (f && f.description_en) f.original_description = f.description_en; });
    }
    return lib;
}

function translateNode(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
        const v = n.nodeValue;
        if (v && /[؀-ۿ]/.test(v)) {
            const nv = t(v);
            if (nv !== v) n.nodeValue = nv;
        }
    }
    if (root.querySelectorAll) {
        root.querySelectorAll("[placeholder],[title]").forEach((el) => {
            ["placeholder", "title"].forEach((a) => {
                const v = el.getAttribute(a);
                if (v && /[؀-ۿ]/.test(v)) { const nv = t(v); if (nv !== v) el.setAttribute(a, nv); }
            });
        });
    }
}

export function initI18n() {
    document.documentElement.lang = LANG;
    document.documentElement.dir = LANG === "en" ? "ltr" : "rtl";
    if (LANG !== "en") return;
    document.body.classList.add("lang-en");
    const style = document.createElement("style");
    style.textContent = "body.lang-en, body.lang-en * { direction: ltr; } body.lang-en { text-align: left; }";
    document.head.appendChild(style);
    translateNode(document.body);
    new MutationObserver((muts) => {
        for (const m of muts) {
            if (m.type === "characterData") { const v = m.target.nodeValue; if (/[؀-ۿ]/.test(v)) { const nv = t(v); if (nv !== v) m.target.nodeValue = nv; } }
            m.addedNodes && m.addedNodes.forEach((x) => { if (x.nodeType === 1) translateNode(x); else if (x.nodeType === 3) { const nv = t(x.nodeValue); if (nv !== x.nodeValue) x.nodeValue = nv; } });
        }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
