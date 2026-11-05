
(function () {
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
            "اغتصب", "اغتصبت", "اغتصبوا", "اغتصبو", "يغتصب", "تغتصب", "نغتصب", "اغتصاب", "مغتصب", "مغتصبة", "مغتصبين", "مغتصبون", "rape", "raped", "raping", "rapist", "rapists",
            "ينيك", "متناك", "منيوك", "طيز", "زب", "عارية","الاستمناء","استمنى","لاعق القضبان","مثيرة جنسيا",
            "عاهره", "قحبه", "شرموطه", "لحس", "جماع", "مؤخرات", "مؤخرة","سافلة","زير نساء","تنام مع","السفلة","عاشر","يعاشر","تعاشر","مثيرات","جذّابة","فاتنة","عشيقة","زير النساء",
            "العلاقة الجنسية", "العلاقات الجنسية", "المشاهد الجنسية", "الأفعال الجنسية", "الممارسة الجنسية", "الأمور الجنسية", "الاعتداء الجنسي", "التحرش الجنسي", "ممارسة الجنس", "لممارسة الجنس", "يمارس الجنس", "يمارسون الجنس", "يمارسان الجنس", "تمارس الجنس", "تمارسون الجنس", "مارس الجنس", "مارسوا الجنس", "مارست الجنس", "مارسا الجنس", "نمارس الجنس", "أمارس الجنس", "المداعبة", "يضاجع", "اضاجع", "ضاجع", "المؤخرة", "مؤخرتك", "مؤخرتي", "جنسية", "العلاقة الحميمة","الخلاعية", "الخصيتان", "العاهرة","عاهرة","خصية","تعري","ضاجعت","داعر", "الداعر",
            "fuck", "fucking", "fucked", "fucker", "motherfucker", "pussy", "dick", "cock",
            "cunt", "blowjob", "handjob", "porn", "horny", "nude", "naked", "boobs", "orgasm",
            "خرا", "خره", "قحاب", "شراميط", "زق", "جنسي", "عاري", "سكس", "فاجرة",
            "fucks", "fuckin", "fuckin'", "fuckers", "fuckup", "fuckups", "motherfuckers",
            "fuckface", "fuckwit", "fuckhead", "fuckery", "fucktard",
            "dicks", "dickhead", "dickheads", "cocks", "cocksucker", "pussies",
            "whore", "whores", "whorish", "slut", "sluts", "slutty",
            "sex", "sexy", "sexual", "nudity", "breasts", "condoms", "penis", "vagina",
            "butt", "butts", "hot","نهود",
            "قضيب", "ثدي", "واقي ذكري","شاذ","الشاذ",
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
            "اغتصب", "اغتصبت", "اغتصبوا", "اغتصبو", "يغتصب", "تغتصب", "نغتصب", "اغتصاب", "مغتصب", "مغتصبة", "مغتصبين", "مغتصبون", "rape", "raped", "raping", "rapist", "rapists",
            "ابن الكلب", "يا كلب", "حقير", "وسخ", "خول",
            "ابن الحرام", "يلعن", "لعنه الله", "جعة", "مضاجعة", "الجعة", "لعينة","يلعن","ينعل","الوساخة","الخراء","خراء",
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
            "عرص", "عرصة", "قواد", "ديوث", "ابن الزانية", "بنت الزانية","فساء","براز","غائط","وغدا","متعاليا",
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
              "تحوت",
            "زيوس", "بوسيدون", "أثينا", "أبولو", "أرتميس", "آريس", "أفروديت", "هيرمس", "ديونيسوس", "هاديس", "هيرا",
            "جوبيتر", "جونو", "نبتون", "ميركوري", "مينرفا", "فينوس",
             "فريا", "بالدر",
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
        youtubeExtra: [
            "ابن الوسخه", "ابن الوسخ", "بن الوسخه", "ولاد الوسخه", "ولاد الوسخ", "اولاد الوسخه",
            "أولاد الوسخه", "ولد الوسخه", "بنت الوسخه", "بنات الوسخه", "ابو الوسخه", "الوسخه",
            "فشخ", "فشخت", "يفشخ", "فشخه"
        ],
        substance: [
             "حشيش", "الحشيش", "كوكايين", "هيروين", "حبوب مخدره","الخمور","المنشطات","شامبانيا","سجائر",
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
        try {
            if (category === "youtubeExtra" && !/(^|\.)youtube\.com$/i.test(location.hostname)) return false;
            if (typeof filterSettings === "undefined" || !globalThis.SalikFilterCore) return true;
            return globalThis.SalikFilterCore.subtitleCategoryEnabled(category, filterSettings);
        } catch (e) { /* تجاهل */ }
        if (category === "youtubeExtra") return /(^|\.)youtube\.com$/i.test(location.hostname);
        return true;
    }

    const EXCEPTION_DOG_ADJECTIVES = ["جيد", "صالح", "وفي", "لطيف", "اليف", "مطيع"].map(normalizeArabicTerm);
    const EXCEPTION_FARJ_REGEX = /(?<![\p{L}\p{N}])[وفبل]?فرجك(?![\p{L}\p{N}])/gu;
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
            out += "*&^";
            cursor = e;
        }
        out += original.slice(cursor);

        return out;
    }

    function containsBlacklistMatch(text) {
        if (!text) return false;
        const { normalized } = normalizeText(text);
        if (!normalized) return false;
        const exRanges = getExceptionRanges(normalized);
        return Object.keys(CATEGORY_REGEX).some((cat) => {
            const re = CATEGORY_REGEX[cat];
            if (!re || !isCategoryEnabled(cat)) return false;
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(normalized)) !== null) {
                if (m[0].length === 0) { re.lastIndex++; continue; }
                if (!exRanges.length || !insideException(exRanges, m.index, m.index + m[0].length)) return true;
            }
            return false;
        });
    }

    window.NazafaCensor = {
        censorText,
        containsBlacklistMatch,
        normalizeText,
        normalizeArabicTerm,
        isCategoryEnabled
    };
})();
