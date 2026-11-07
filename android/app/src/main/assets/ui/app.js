import {
  SUBCATEGORY_SCHEMA, shouldFilter, titleGroupStates, toggleTitleGroupStore,
  getFilterSettings, setGroupEnabled, setSubcategoryEnabled,
  getSubtitleCensorEnabled, setSubtitleCensorEnabled, getYtAutoMuteEnabled, setYtAutoMuteEnabled,
  getYtSkip, setYtSkipOption, YT_SKIP_OPTIONS,
  getDisabledFiltersStore, getUrlForPlatform,
  SEVERITY_META, getSeverityLevel
} from "./ext-app/services.js";
import { LANG, t as extT, localizeLibrary } from "./ext-app/i18n.js";
import { GUIDE } from "./guide.js";

const native = window.SalikApp || {
  openUrl: (u) => window.open(u), openExternal: (u) => window.open(u),
  setEngineEnabled() {}, setYoutubeTv() {}, setStremioServer() {}, setGenderBlur() {}, shareLog() {}, exitApp() {}
};

const EN = LANG === "en";
const GITHUB_REPO = "https://github.com/techFek/salik";
document.documentElement.lang = EN ? "en" : "ar";
document.documentElement.dir = EN ? "ltr" : "rtl";

const STR = {
  home: ["الرئيسية", "Home"],
  browse: ["تصفّح", "Browse"],
  settings: ["الإعدادات", "Settings"],
  newest: ["أُضيف حديثًا إلى سالك", "New on Salik"],
  watchFiltered: ["شاهد مع الفلترة", "Watch filtered"],
  details: ["التفاصيل", "Details"],
  platforms: ["المنصات", "Platforms"],
  platformsHint: ["افتح المنصة وسيعمل سالك تلقائيًا", "Open a platform and Salik works automatically"],
  globalFilters: ["الفلاتر العامة", "General filters"],
  globalHint: ["تُطبَّق على جميع الأعمال", "Apply to every title"],
  allCats: ["كل التصنيفات", "All categories"],
  off: ["متوقفة", "Off"],
  someCats: ["{on} من {total} تصنيفات", "{on} of {total} categories"],
  recent: ["شاهدتَه مؤخرًا", "Recently watched"],
  addedRecently: ["أُضيف حديثًا", "Recently added"],
  series: ["مسلسلات", "Series"],
  mute: ["كتم", "Mute"],
  skip: ["تخطي", "Skip"],
  blur: ["تمويه", "Blur"],
  noneActive: ["لا توجد مشاهد ستُفلتر وفق إعداداتك الحالية", "Nothing will be filtered with your current settings"],
  timelineLabel: ["مواضع تدخّل سالك في العمل", "Where Salik steps in"],
  search: ["ابحث عن فيلم أو مسلسل", "Search a movie or series"],
  all: ["الكل", "All"],
  movies: ["أفلام", "Movies"],
  allPlatforms: ["كل المنصات", "All platforms"],
  countTitles: ["{n} عمل", "{n} titles"],
  noResults: ["لا توجد نتائج لـ\"{q}\". جرّب اسمًا آخر أو ألغِ تحديد المنصة.", "No results for \"{q}\". Try another name or clear the platform."],
  seriesWord: ["مسلسل", "Series"],
  movieWord: ["فيلم", "Movie"],
  episodes: ["الحلقات", "Episodes"],
  episodesHint: ["اختر الحلقة ثم المنصة", "Pick an episode, then a platform"],
  season: ["الموسم {s}", "Season {s}"],
  noEpisodes: ["لا توجد حلقات مضافة بعد.", "No episodes added yet."],
  watchOn: ["شاهد على", "Watch on"],
  watchOnHint: ["سيفتح سالك المنصة ويطبّق الفلترة تلقائيًا", "Salik opens the platform and filters automatically"],
  noLink: ["لا يوجد رابط منصة لهذا العمل.", "No platform link for this title."],
  filteringHere: ["الفلترة في هذا العمل", "Filtering in this title"],
  scenesHere: ["{n} مشهدًا مسجّلًا. التغيير هنا يخص هذا العمل فقط.", "{n} scenes logged. Changes here apply to this title only."],
  noTimings: ["لا تتوفر توقيتات فلترة لهذا العمل بعد.", "No filter timings for this title yet."],
  notInTitle: ["لا يوجد في هذا العمل", "None in this title"],
  offGlobally: ["متوقفة من الإعدادات العامة", "Off in general settings"],
  units: ["{n} مشهد", "{n} scenes"],
  unitsWords: ["{n} لفظ", "{n} words"],
  pickPlatform: ["اختر المنصة التي ستشاهد عليها", "Choose where to watch"],
  groupOnAll: ["{g}: مفعّلة لجميع الأعمال", "{g}: on for every title"],
  groupOffAll: ["{g}: متوقفة لجميع الأعمال", "{g}: off for every title"],
  enableGroupFirst: ["فعّل الفئة أولًا", "Turn the category on first"],
  titleGroupOn: ["{g} في \"{t}\": ستُفلتر", "{g} in \"{t}\": will be filtered"],
  titleGroupOff: ["{g} في \"{t}\": لن تُفلتر", "{g} in \"{t}\": won't be filtered"],
  noDirectLink: ["لا يوجد رابط مباشر، ابحث عن \"{t}\" داخل {p}", "No direct link. Search for \"{t}\" in {p}"],
  noPlatform: ["لا توجد منصة مسجّلة لهذا العمل", "No platform listed for this title"],
  language: ["اللغة", "Language"],
  generalHint: ["تُطبَّق على جميع الأعمال، ويمكنك تعديلها لكل عمل من صفحته.", "They apply to every title. You can change them per title on its page."],
  showCats: ["التصنيفات التفصيلية", "Detailed categories"],
  hideCats: ["إخفاء التصنيفات", "Hide categories"],
  subCensor: ["تنقية الترجمة", "Clean subtitles"],
  subCensorHint: ["يُخفي الكلمات غير اللائقة من نص الترجمة", "Hides inappropriate words in subtitles"],
  hideFemale: ["حجب الظهور النسائي", "Hide women"],
  hideMale: ["حجب الظهور الرجالي", "Hide men"],
  experimental: ["تجريبي", "Experimental"],
  genderHint: ["يموّه الفيديو تلقائيًا عند ظهور الوجه. يعمل على يوتيوب وDailymotion وStremio فقط، وقد يخطئ أو يتأخر لحظة، ويستهلك البطارية", "Blurs the video automatically when a face appears. YouTube, Dailymotion & Stremio only; it can miss or lag a moment and uses more battery"],
  genderOn: ["{g}: مفعّل (تجريبي، يوتيوب وDailymotion وStremio فقط)", "{g}: on (experimental, YouTube, Dailymotion & Stremio only)"],
  genderOff: ["{g}: متوقف", "{g}: off"],
  ytMute: ["كتم الألفاظ التلقائي على يوتيوب", "Auto-mute bad language on YouTube"],
  ytMuteShort: ["كتم يوتيوب التلقائي", "YouTube auto-mute"],
  ytMuteHint: ["يكتم الصوت لحظة نطق اللفظ الخارج اعتمادًا على ترجمة الفيديو", "Mutes the moment a bad word is spoken, using the video's captions"],
  on: ["مفعّل", "On"],
  ytOnToast: ["كتم يوتيوب التلقائي: مفعّل", "YouTube auto-mute: on"],
  ytOffToast: ["كتم يوتيوب التلقائي: متوقف", "YouTube auto-mute: off"],
  ytSkip: ["تخطي على يوتيوب", "Skip on YouTube"],
  ytSkipHint: ["يتخطى هذه الأجزاء تلقائيًا. الأوقات من SponsorBlock (CC BY-NC-SA 4.0) ويضيفها المستخدمون، لذا قد لا تتوفر لبعض الفيديوهات", "Skips these parts automatically. Times come from SponsorBlock (CC BY-NC-SA 4.0), added by users, so some videos have none"],
  epShort: ["م{s} ح{e}", "S{s} E{e}"],
  subOffGlobally: ["التصنيف متوقف من الإعدادات العامة", "Category off in general settings"],
  filterOn: ["سيُطبَّق هذا المشهد", "This scene will be filtered"],
  filterOff: ["لن يُطبَّق هذا المشهد", "This scene won't be filtered"],
  removeRecent: ["إزالة من «شاهدتَه مؤخرًا»", "Remove from Recently watched"],
  removedRecent: ["أُزيل \"{t}\" من «شاهدتَه مؤخرًا»", "Removed \"{t}\" from Recently watched"],
  cancel: ["إلغاء", "Cancel"],
  holdHint: ["اضغط مطولًا على عمل لإزالته", "Long-press a title to remove it"],
  loginHint: ["افتح المنصة وسجّل الدخول بحسابك فيها مرة واحدة.", "Open each platform and sign in to it once."],
  openSignIn: ["فتح وتسجيل الدخول", "Open and sign in"],
  app: ["التطبيق", "App"],
  version: ["الإصدار {v}", "Version {v}"],
  libOnline: ["المكتبة محدّثة من الإنترنت", "Library updated online"],
  libSaved: ["آخر نسخة محفوظة من المكتبة", "Last saved library"],
  libBundled: ["نسخة المكتبة المرفقة مع التطبيق", "Library included with the app"],
  ytTv: ["يوتيوب بواجهة التلفزيون", "YouTube TV interface"],
  ytTvHint: ["تسجيل الدخول برمز من هاتفك (yt.be/activate) بدل جوجل، ويُفعَّل تلقائيًا عند محاولة الدخول", "Sign in with a code from your phone (yt.be/activate) instead of Google. Turns on by itself when you try to sign in"],
  stremioTitle: ["سيرفر Stremio", "Stremio server"],
  stremioHint: ["يحتاج Stremio إلى سيرفر يعمل طوال الوقت. إن كان تطبيق Stremio مفتوحًا على حاسوب في المنزل فاكتب عنوان الحاسوب، مثل 192.168.1.23 ، أو عنوان سيرفر Docker مع منفذه، مثل 192.168.1.10:8080", "Stremio needs a server that is always running. If the Stremio app is open on a computer at home, enter that computer's address, e.g. 192.168.1.23 , or a Docker server with its port, e.g. 192.168.1.10:8080"],
  stremioViaPc: ["البث عبر الحاسوب: {u}", "Streaming through the computer: {u}"],
  stremioViaDocker: ["مشغّل Stremio على السيرفر: {u}", "Stremio player on the server: {u}"],
  stremioPlaceholder: ["عنوان السيرفر (IP:المنفذ)", "Server address (IP:port)"],
  save: ["حفظ", "Save"],
  saved: ["تم الحفظ، افتح Stremio من المنصات", "Saved. Open Stremio from Platforms"],
  cleared: ["تم حذف عنوان السيرفر", "Server address removed"],
  stremioNone: ["لم يُضبط سيرفر بعد", "No server set yet"],
  guide: ["دليل ربط المنصات", "Platform guide"],
  guideHint: ["طريقة ربط كل منصة، وما يعمل، والمشكلات المعروفة وحلولها", "How each platform connects, what works, and known problems"],
  guideSub: ["كل ما تحتاج معرفته لتعمل المنصات مع سالك", "Everything you need to get the platforms working with Salik"],
  contribute: ["المساهمة والتواصل", "Feedback"],
  contributeHint: ["تُرسَل عبر GitHub، وتحتاج إلى حساب GitHub", "Sent through GitHub (needs a GitHub account)"],
  reportScene: ["مراجعة مشهد لم تتم معالجته", "Report an unfiltered scene"],
  reportSceneHint: ["شاهدتَ مشهدًا كان ينبغي كتمه أو تخطّيه ولم يحدث؟", "Saw a scene that should have been muted or skipped?"],
  suggestions: ["اقتراحات", "Suggestions"],
  suggestionsHint: ["اقترح عملًا جديدًا أو ميزة أو تحسينًا", "Suggest a title, a feature or an improvement"],
  sourceCode: ["الشيفرة المصدرية على GitHub", "Source code on GitHub"],
  rsTitle: ["اسم العمل", "Title"],
  rsPlatform: ["المنصة", "Platform"],
  rsTime: ["التوقيت (مثال: 1:12:30)", "Time (e.g. 1:12:30)"],
  rsDesc: ["صف المشهد باختصار", "Briefly describe the scene"],
  rsSend: ["فتح البلاغ على GitHub", "Open the report on GitHub"],
  rsNeed: ["اكتب اسم العمل ووصف المشهد", "Enter the title and describe the scene"],
  rsOpened: ["فُتحت صفحة البلاغ، اضغط Submit لإرساله. شكرًا لك", "The report page opened. Press Submit to send it. Thank you"],
  engine: ["محرك الفلترة", "Filtering engine"],
  engineHint: ["أوقفه فقط عند اختبار مشكلة في التشغيل", "Turn it off only to test a playback problem"],
  sendLog: ["إرسال سجل التشخيص", "Send diagnostic log"],
  exitApp: ["إغلاق التطبيق", "Exit app"],
  loading: ["جارٍ تجهيز المكتبة", "Preparing the library"],
  loadingHint: ["يستغرق ذلك ثواني في المرة الأولى فقط.", "This takes a few seconds the first time only."],
  loadFail: ["تعذّر تحميل المكتبة", "Couldn't load the library"],
  loadFailHint: ["تأكد من الاتصال بالإنترنت ثم أعد المحاولة.", "Check your internet connection and try again."],
  retry: ["إعادة المحاولة", "Try again"]
};
const T = (k, vars) => {
  let s = (STR[k] || [k, k])[EN ? 1 : 0];
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll(`{${a}}`, b);
  return s;
};

const PLATFORMS = {
  netflix: { name: "Netflix", ar: "نتفليكس", home: "https://www.netflix.com/", color: "#E50914" },
  amazon: { name: "Prime Video", ar: "برايم فيديو", home: "https://www.primevideo.com/", color: "#1A7FD6" },
  shahid: { name: "Shahid", ar: "شاهد", home: "https://shahid.mbc.net/ar", color: "#159A68" },
  disney: { name: "Disney+", ar: "ديزني+", home: "https://www.disneyplus.com/", color: "#113CCF" },
  osnplus: { name: "OSN+", ar: "OSN+", home: "https://www.osnplus.com/", color: "#00899A" },
  yango: { name: "Yango Play", ar: "يانغو بلاي", home: "https://play.yango.com/", color: "#6B33D6" },
  appletv: { name: "Apple TV", ar: "Apple TV", home: "https://tv.apple.com/", color: "#2B2B2B" },
  watchit: { name: "Watch It", ar: "واتش إت", home: "https://www.watchit.com/", color: "#C27C00" },
  starzplay: { name: "Starzplay", ar: "ستارزبلاي", home: "https://www.starzplay.com/", color: "#0B7A75" },
  youtube: { name: "YouTube", ar: "يوتيوب", home: "https://www.youtube.com/", color: "#E0002B" },
  stctv: { name: "STC tv", ar: "STC tv", home: "https://www.stctv.com/", color: "#4F008C" },
  dailymotion: { name: "Dailymotion", ar: "ديلي موشن", home: "https://www.dailymotion.com/", color: "#0D0D0D" },
  tod: { name: "Tod", ar: "تود", home: "https://www.tod.tv/", color: "#8A1538" },
  beinconnect: { name: "beIN Connect", ar: "beIN Connect", home: "https://connect.bein.com/", color: "#5B2C83" },
  stremio: { name: "Stremio", ar: "ستريميو", home: "https://web.stremio.com/", color: "#7A4D9C" },
};
const stremioOrigin = () => (S.app && S.app.stremioOrigin) || "";
const platformHome = (p) => (p === "stremio" && stremioOrigin() ? stremioOrigin() + "/" : PLATFORMS[p].home);
const pName = (p) => (EN ? PLATFORMS[p].name : PLATFORMS[p].ar);
const pMark = (p) => PLATFORMS[p].name;
const GROUP_NAMES = {
  nudity: ["مشاهد حساسة", "Sensitive scenes"],
  violence: ["مشاهد عنيفة أو مقززة", "Violent or disturbing"],
  language: ["ألفاظ خارجة", "Bad language"],
  substance: ["تعاطٍ ومسكرات", "Smoking, alcohol & drugs"]
};
const gName = (g) => GROUP_NAMES[g][EN ? 1 : 0];
const ACTION_COLORS = { mute: "var(--mute)", skip: "var(--skip)", blur: "var(--blur)" };

const S = {
  items: [], byKey: {}, titles: [], episodes: {}, settings: null, subtitleCensor: true, ytAutoMute: true, ytSkip: null,
  app: null, error: null, stack: [{ name: "home" }],
  browse: { q: "", platform: "all", type: "all" }
};

const $view = document.getElementById("view");
const $modalRoot = document.getElementById("modal-root");
const fmt = (n) => Number(n).toLocaleString("en-US");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").toLowerCase().replace(/[ً-ٰٟ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

function posterSrc(url, size) {
  if (!url) return "";
  return url.replace("/t/p/original/", `/t/p/${size}/`);
}

function prepare(lib) {
  localizeLibrary(lib);
  const items = [];
  for (const [key, raw] of Object.entries(lib || {})) {
    if (!raw || typeof raw !== "object" || !raw.title) continue;
    const platforms = {};
    for (const [p, v] of Object.entries(raw.platforms || {})) {
      const k = p.toLowerCase();
      if (!platforms[k]) platforms[k] = v || {};
    }
    items.push({ ...raw, key, platforms, filters: Array.isArray(raw.filters) ? raw.filters : [] });
  }
  S.items = items;
  S.byKey = Object.fromEntries(items.map((i) => [i.key, i]));
  S.episodes = {};
  for (const it of items) {
    if (it.type === "episode" && it.parent_series_id) (S.episodes[it.parent_series_id] ||= []).push(it);
  }
  for (const list of Object.values(S.episodes)) list.sort((a, b) => (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0));
  S.titles = items.filter((i) => i.type !== "episode");
}

function visiblePlatforms(platformMaps) {
  const keys = new Set();
  let hasOfficial = false;
  for (const map of platformMaps) {
    for (const [k, v] of Object.entries(map || {})) {
      if (!PLATFORMS[k]) continue;
      keys.add(k);
      if (k !== "stremio" && v && (v.url || v.id)) hasOfficial = true;
    }
  }
  if (hasOfficial) keys.delete("stremio");
  return [...keys];
}

function platformsOf(item) {
  const maps = [item.platforms];
  if (item.type === "series") for (const ep of S.episodes[item.key] || []) maps.push(ep.platforms);
  return visiblePlatforms(maps);
}

const filterTargets = (item) => (item.type === "series" ? (S.episodes[item.key] || []) : [item]);

function genresOf(item) {
  return String(item.genre || "").split(/[،,]/).map((g) => g.trim()).filter((g) => g && !/^[a-z\s-]+$/i.test(g));
}

function allowedBySettings(f) {
  const st = S.settings;
  return shouldFilter(f, st || null);
}

function actionKind(f) {
  const a = String(f.action_type || f.action || "").toLowerCase();
  return a.includes("blur") ? "blur" : (a === "skip" ? "skip" : "mute");
}
function clock(sec) {
  const t = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s2 = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s2}` : `${m}:${s2}`;
}
function timelineHTML(item, disabled) {
  const fs = (item.filters || []).filter((f) => typeof f.start === "number" || typeof f.start_time === "number");
  if (!fs.length) return "";
  const off = disabled[item.key] || {};
  const active = fs.filter((f) => !off[f.id] && allowedBySettings(f));
  const span = Math.max(...fs.map((f) => Number(f.end ?? f.end_time ?? f.start) || 0)) * 1.03 || 1;
  const counts = { mute: 0, skip: 0, blur: 0 };
  const marks = active.map((f) => {
    const a = String(f.action_type || f.action || "").toLowerCase();
    const kind = a.includes("blur") ? "blur" : (a === "skip" ? "skip" : "mute");
    counts[kind]++;
    const s = Number(f.start ?? f.start_time), e = Number(f.end ?? f.end_time ?? s + 1);
    return `<i class="tl-mark ${kind}" style="inset-inline-start:${(s / span * 100).toFixed(2)}%;width:${Math.max(0.25, (e - s) / span * 100).toFixed(2)}%"></i>`;
  }).join("");
  const legend = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `<span style="--c:${ACTION_COLORS[k]}">${T(k)}: ${fmt(n)}</span>`).join("");
  return `<div class="timeline" aria-label="${T("timelineLabel")}">
    <div class="tl-bar">${marks}</div>
    <div class="tl-legend">${legend || `<span style="--c:transparent">${T("noneActive")}</span>`}</div>
  </div>`;
}

function cardHTML(item, fid, recent) {
  const plats = platformsOf(item).map(pMark).slice(0, 2).join(", ");
  const sub = [item.year, plats].filter(Boolean).join(" · ");
  const img = item.poster_url
    ? `<img class="poster" loading="lazy" src="${esc(posterSrc(item.poster_url, "w342"))}" alt="" data-title="${esc(item.title)}">`
    : `<div class="poster poster-fallback">${esc(item.title)}</div>`;
  return `<button class="poster-card" data-nav data-fid="${esc(fid || "c-" + item.key)}" data-open="${esc(item.key)}"${recent ? ` data-recent="${esc(item.key)}"` : ""}>
    ${img}<div class="pc-title"><bdi>${esc(item.title)}</bdi></div><div class="pc-sub"><bdi>${esc(sub)}</bdi></div></button>`;
}

function rowHTML(id, title, items, hint, recent) {
  if (!items.length) return "";
  return `<section class="section page"><div class="section-head"><h2>${esc(title)}</h2>${hint ? `<p>${esc(hint)}</p>` : ""}</div>
    <div class="row">${items.map((i) => cardHTML(i, `c-${id}-${i.key}`, recent)).join("")}</div></section>`;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 2600);
}

function recentItems() {
  let keys = [];
  try { keys = JSON.parse(localStorage.getItem("salik.recent") || "[]"); } catch (e) {}
  return keys.map((k) => S.byKey[k]).filter(Boolean);
}

async function renderHome() {
  const disabled = await getDisabledFiltersStore();
  const withPosters = S.titles.filter((t) => t.poster_url);
  const newest = [...withPosters].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const hero = newest.find((t) => t.type !== "series" && (t.filters || []).length) || newest[0];

  const counts = {};
  for (const t of S.titles) for (const p of platformsOf(t)) counts[p] = (counts[p] || 0) + 1;
  const plats = Object.keys(PLATFORMS).sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

  const genreCount = {};
  for (const t of S.titles) for (const g of genresOf(t)) genreCount[g] = (genreCount[g] || 0) + 1;
  const topGenres = EN ? [] : Object.entries(genreCount).filter(([, n]) => n >= 6).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g]) => g);

  const heroHTML = hero ? `<section class="hero">
      <div class="hero-bg" style="background-image:url('${esc(posterSrc(hero.poster_url, "w780"))}')"></div>
      <div class="hero-body">
        <p class="hero-kicker">${T("newest")}</p>
        <h1 class="hero-title"><bdi>${esc(hero.title)}</bdi></h1>
        <div class="hero-meta">${[hero.year, hero.pg, genresOf(hero).slice(0, 2).join("، ")].filter(Boolean).map((m) => `<span><bdi>${esc(m)}</bdi></span>`).join("")}</div>
        <p class="hero-desc">${esc(hero.description || "")}</p>
        ${timelineHTML(hero, disabled)}
        <div class="btn-row">
          <button class="btn btn-primary" data-nav data-fid="hero-watch" data-watch="${esc(hero.key)}">${T("watchFiltered")}</button>
          <button class="btn btn-ghost" data-nav data-fid="hero-details" data-open="${esc(hero.key)}">${T("details")}</button>
        </div>
      </div>
      <img class="hero-poster" src="${esc(posterSrc(hero.poster_url, "w342"))}" alt="">
    </section>` : "";

  const switches = Object.keys(SUBCATEGORY_SCHEMA).map((g) => {
    const st = S.settings[g];
    const total = SUBCATEGORY_SCHEMA[g].subcategories.length;
    const on = Object.values(st.subs).filter(Boolean).length;
    const detail = !st.enabled ? T("off") : (on === total ? T("allCats") : T("someCats", { on: fmt(on), total: fmt(total) }));
    return `<button class="switch-card ${st.enabled ? "on" : ""}" data-nav data-fid="g-${g}" data-global="${g}">
      <span class="sc-name">${gName(g)}</span>
      <span class="sc-state"><span>${detail}</span><i class="toggle ${st.enabled ? "on" : ""}"></i></span></button>`;
  }).join("") + `<button class="switch-card ${S.ytAutoMute ? "on" : ""}" data-nav data-fid="g-yt" data-yt-mute>
      <span class="sc-name">${T("ytMuteShort")}</span>
      <span class="sc-state"><span>${S.ytAutoMute ? T("on") : T("off")}</span><i class="toggle ${S.ytAutoMute ? "on" : ""}"></i></span></button>`;

  $view.innerHTML = `${heroHTML}
    <section class="section page"><div class="section-head"><h2>${T("platforms")}</h2><p>${T("platformsHint")}</p></div>
      <div class="platform-row">${plats.map((p) => `<button class="plat" style="--pc:${PLATFORMS[p].color}" data-nav data-fid="p-${p}" data-platform-home="${p}"><bdi>${pMark(p)}</bdi></button>`).join("")}</div></section>
    <section class="section page"><div class="section-head"><h2>${T("globalFilters")}</h2><p>${T("globalHint")}</p></div>
      <div class="switch-grid">${switches}</div></section>
    ${rowHTML("recent", T("recent"), recentItems(), T("holdHint"), true)}
    ${rowHTML("new", T("addedRecently"), newest.slice(0, 20))}
    ${rowHTML("series", T("series"), S.titles.filter((t) => t.type === "series"))}
    ${topGenres.map((g, i) => rowHTML("g" + i, g, S.titles.filter((t) => genresOf(t).includes(g)).slice(0, 24))).join("")}`;
}

function browseResults() {
  const q = norm(S.browse.q.trim());
  return S.titles.filter((t) => {
    if (S.browse.type === "movie" && t.type === "series") return false;
    if (S.browse.type === "series" && t.type !== "series") return false;
    if (S.browse.platform !== "all" && !platformsOf(t).includes(S.browse.platform)) return false;
    if (!q) return true;
    return norm(t.title).includes(q) || norm(t.genre).includes(q) || norm(t.category).includes(q);
  }).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

function renderBrowseGrid() {
  const res = browseResults();
  document.getElementById("grid").innerHTML = res.length
    ? res.map((t) => cardHTML(t, "b-" + t.key)).join("")
    : `<p class="empty">${esc(T("noResults", { q: S.browse.q }))}</p>`;
  document.getElementById("count").textContent = T("countTitles", { n: fmt(res.length) });
}

function renderBrowse() {
  const present = Object.keys(PLATFORMS).filter((p) => S.titles.some((t) => platformsOf(t).includes(p)));
  const chip = (attr, val, label, cur) => `<button class="chip ${cur === val ? "on" : ""}" data-nav data-fid="${attr}-${val}" data-${attr}="${val}"><bdi>${esc(label)}</bdi></button>`;
  $view.innerHTML = `<div class="page">
    <div class="browse-head">
      <input id="search" class="search" type="search" data-nav data-fid="search" placeholder="${T("search")}" value="${esc(S.browse.q)}" autocomplete="off">
      <div class="chips">${chip("type", "all", T("all"), S.browse.type)}${chip("type", "movie", T("movies"), S.browse.type)}${chip("type", "series", T("series"), S.browse.type)}</div>
      <div class="chips">${chip("plat", "all", T("allPlatforms"), S.browse.platform)}${present.map((p) => chip("plat", p, pMark(p), S.browse.platform)).join("")}</div>
    </div>
    <div class="section-head"><p id="count"></p></div>
    <div id="grid" class="grid"></div></div>`;
  renderBrowseGrid();
  document.getElementById("search").addEventListener("input", (e) => { S.browse.q = e.target.value; renderBrowseGrid(); });
}

async function perTitleState(item) {
  const disabled = await getDisabledFiltersStore();
  const all = filterTargets(item).flatMap((t) => (t.filters || []).map((f) => ({ ...f, __key: t.key })));
  const maxEnd = Math.max(0, ...all.map((f) => Number(f.end ?? f.end_time) || 0));
  const minutes = item.type === "series" ? null : maxEnd / 60;
  const groups = titleGroupStates(all, disabled, S.settings)
    .map((x) => ({ ...x, sev: getSeverityLevel(x.items.length, minutes) }));
  return { groups, disabled, total: all.length, all };
}

async function renderDetails(key) {
  const item = S.byKey[key];
  if (!item) { goHome(); return; }
  const { groups, disabled, total } = await perTitleState(item);
  const plats = platformsOf(item);
  const isSeries = item.type === "series";
  const eps = S.episodes[item.key] || [];
  const seasons = [...new Set(eps.map((e) => e.season || 1))];
  const curSeason = current().season || seasons[0];

  const openG = current().openGroup || "";
  const epLabel = (k) => {
    const e = S.byKey[k];
    return isSeries && e ? T("epShort", { s: fmt(e.season || 1), e: fmt(e.episode || "") }) : "";
  };
  const groupRows = groups.map(({ g, items, on, globalOn, sev }) => {
    const meta = SEVERITY_META[sev];
    const sub = !items.length ? T("notInTitle") : !globalOn ? T("offGlobally") : T(g === "language" ? "unitsWords" : "units", { n: fmt(items.length) });
    const shown = on && globalOn;
    const isOpen = openG === g && items.length > 0;
    const head = `<div class="tg-head ${shown ? "on" : ""}">
        <button class="tg-open ${items.length ? "" : "disabled-row"}" data-nav data-fid="t-${g}" ${items.length ? `data-expand-title="${g}" aria-expanded="${isOpen}"` : ""}>
          <span class="gr-main"><span class="gr-name">${gName(g)}</span><br><span class="gr-sub">${sub}</span></span>
          ${items.length ? `<span class="sev" style="--sc:${meta.color};--sb:${meta.bg}">${extT(meta.label)}</span><i class="chev ${isOpen ? "up" : ""}" aria-hidden="true"></i>` : ""}
        </button>
        ${items.length && globalOn ? `<button class="tg-switch" data-nav data-fid="ts-${g}" data-title-group="${g}" aria-label="${gName(g)}"><i class="toggle ${shown ? "on" : ""}"></i></button>` : ""}
      </div>`;
    if (!isOpen) return `<div class="tg">${head}</div>`;
    const rows = [...items].sort((a, b) => (a.__key === b.__key ? 0 : String(a.__key).localeCompare(String(b.__key))) || (Number(a.start ?? a.start_time) - Number(b.start ?? b.start_time))).map((f) => {
      const off = !!(disabled[f.__key] || {})[f.id];
      const allowed = globalOn && allowedBySettings(f);
      const active = !off && allowed;
      const kind = actionKind(f);
      const desc = f.original_description || f.description || "";
      const ep = epLabel(f.__key);
      return `<button class="fl-row ${active ? "on" : ""} ${allowed ? "" : "disabled-row"}" data-nav data-fid="f-${esc(f.__key)}-${esc(f.id)}" ${allowed ? `data-filter="${esc(f.__key)}|${esc(f.id)}"` : ""}>
          <span class="fl-time"><bdi>${clock(f.start ?? f.start_time)}</bdi></span>
          <span class="fl-act" style="--c:${ACTION_COLORS[kind]}">${T(kind)}</span>
          <span class="fl-desc">${ep ? `<em>${ep}</em> ` : ""}<bdi>${esc(desc)}</bdi>${allowed ? "" : `<small>${T("subOffGlobally")}</small>`}</span>
          <i class="toggle ${active ? "on" : ""}"></i></button>`;
    }).join("");
    return `<div class="tg open">${head}<div class="fl-list">${rows}</div></div>`;
  }).join("");

  const watchPanel = isSeries
    ? `<div class="panel"><h3>${T("episodes")}</h3><p class="hint">${T("episodesHint")}</p>
        ${seasons.length > 1 ? `<div class="season-tabs">${seasons.map((s) => `<button class="chip ${s === curSeason ? "on" : ""}" data-nav data-fid="s-${s}" data-season="${s}">${T("season", { s: fmt(s) })}</button>`).join("")}</div>` : ""}
        ${eps.filter((e) => (e.season || 1) === curSeason).map((e) => `<button class="ep" data-nav data-fid="e-${esc(e.key)}" data-watch="${esc(e.key)}">
          <b>${fmt(e.episode || "")}</b><span><bdi>${esc(e.title)}</bdi></span><em><bdi>${esc(visiblePlatforms([e.platforms]).map(pMark).join(", "))}</bdi></em></button>`).join("") || `<p class="hint">${T("noEpisodes")}</p>`}
      </div>`
    : `<div class="panel"><h3>${T("watchOn")}</h3><p class="hint">${T("watchOnHint")}</p>
        <div class="watch-list">${plats.map((p, i) => `<button class="watch-btn" data-nav data-fid="w-${p}" data-watch="${esc(item.key)}" data-platform="${p}">
          <span><bdi>${esc(pName(p))}</bdi></span><small>${i === 0 ? T("watchFiltered") : ""}</small></button>`).join("") || `<p class="hint">${T("noLink")}</p>`}</div></div>`;

  $view.innerHTML = `<div class="details">
    <section class="hero">
      <div class="hero-bg" style="background-image:url('${esc(posterSrc(item.poster_url, "w780"))}')"></div>
      <div class="hero-body">
        <h1 class="hero-title"><bdi>${esc(item.title)}</bdi></h1>
        <div class="hero-meta">${[item.year, item.pg, T(isSeries ? "seriesWord" : "movieWord"), genresOf(item).join("، ")].filter(Boolean).map((m) => `<span><bdi>${esc(m)}</bdi></span>`).join("")}</div>
        <p class="hero-desc" style="-webkit-line-clamp:4">${esc(item.description || "")}</p>
        ${isSeries ? "" : timelineHTML(item, disabled)}
      </div>
      ${item.poster_url ? `<img class="hero-poster" src="${esc(posterSrc(item.poster_url, "w342"))}" alt="">` : ""}
    </section>
    <div class="page d-grid">
      ${watchPanel}
      <div class="panel"><h3>${T("filteringHere")}</h3><p class="hint">${total ? T("scenesHere", { n: fmt(total) }) : T("noTimings")}</p>${groupRows}</div>
    </div></div>`;
}

async function renderSettings() {
  if (!S.app) S.app = await fetch("/data/app.json").then((r) => r.json()).catch(() => ({}));
  const a = S.app || {};
  const open = current().open || "";

  const groups = Object.keys(SUBCATEGORY_SCHEMA).map((g) => {
    const st = S.settings[g];
    const subs = SUBCATEGORY_SCHEMA[g].subcategories.map((s) => `<button class="sub-row ${st.subs[s.key] && st.enabled ? "on" : ""} ${st.enabled ? "" : "disabled-row"}" data-nav data-fid="sub-${g}-${s.key}" data-sub="${g}:${s.key}">
      <span>${esc(extT(s.label))}</span><i class="toggle ${st.subs[s.key] && st.enabled ? "on" : ""}"></i></button>`).join("");
    return `<button class="group-row ${st.enabled ? "on" : ""}" data-nav data-fid="ag-${g}" data-global="${g}">
        <span class="gr-main"><span class="gr-name">${gName(g)}</span></span><i class="toggle ${st.enabled ? "on" : ""}"></i></button>
      <button class="sub-row" data-nav data-fid="more-${g}" data-expand="${g}"><span class="gr-sub">${open === g ? T("hideCats") : T("showCats")}</span></button>
      <div class="subs ${open === g ? "open" : ""}">${subs}</div>`;
  }).join("");

  const source = { online: "libOnline", saved: "libSaved", bundled: "libBundled" }[a.librarySource] || "libBundled";

  $view.innerHTML = `<div class="page">
    <div class="acc-head"><div><h1>${T("settings")}</h1></div></div>
    <div class="acc-grid">
      <div class="panel"><h3>${T("globalFilters")}</h3><p class="hint">${T("generalHint")}</p>
        ${groups}
        <button class="group-row ${S.subtitleCensor ? "on" : ""}" data-nav data-fid="subs-censor" data-subtitle-censor>
          <span class="gr-main"><span class="gr-name">${T("subCensor")}</span><br><span class="gr-sub">${T("subCensorHint")}</span></span>
          <i class="toggle ${S.subtitleCensor ? "on" : ""}"></i></button>
        <button class="group-row ${S.ytAutoMute ? "on" : ""}" data-nav data-fid="yt-mute" data-yt-mute>
          <span class="gr-main"><span class="gr-name">${T("ytMute")}</span><br><span class="gr-sub">${T("ytMuteHint")}</span></span>
          <i class="toggle ${S.ytAutoMute ? "on" : ""}"></i></button>
        <p class="hint" style="margin-top:14px">${T("ytSkip")}: ${T("ytSkipHint")}</p>
        ${YT_SKIP_OPTIONS.map((o) => { const on = S.ytSkip && S.ytSkip[o.key] !== false; return `<button class="group-row ${on ? "on" : ""}" data-nav data-fid="ytskip-${o.key}" data-yt-skip="${o.key}">
          <span class="gr-main"><span class="gr-name">⏭️ ${esc(EN ? o.labelEn : o.label)}</span></span>
          <i class="toggle ${on ? "on" : ""}"></i></button>`; }).join("")}
        ${["hideFemale", "hideMale"].map((k) => `<button class="group-row ${a[k] ? "on" : ""}" data-nav data-fid="${k}" data-gender="${k}">
          <span class="gr-main"><span class="gr-name">${T(k)} <span class="beta">${T("experimental")}</span></span><br><span class="gr-sub">${T("genderHint")}</span></span>
          <i class="toggle ${a[k] ? "on" : ""}"></i></button>`).join("")}
      </div>
      <div>
        <div class="panel"><h3>${T("language")}</h3>
          <div class="btn-row" style="margin-top:10px">
            <button class="chip ${EN ? "" : "on"}" data-nav data-fid="lang-ar" data-lang="ar">العربية</button>
            <button class="chip ${EN ? "on" : ""}" data-nav data-fid="lang-en" data-lang="en">English</button>
          </div></div>
        <div class="panel" style="margin-top:20px">
          <button class="group-row" data-nav data-fid="open-guide" data-route-guide>
            <span class="gr-main"><span class="gr-name">${T("guide")}</span><br><span class="gr-sub">${T("guideHint")}</span></span></button>
        </div>
        <div class="panel" style="margin-top:20px"><h3>${T("contribute")}</h3><p class="hint">${T("contributeHint")}</p>
          <button class="group-row" data-nav data-fid="report-scene" data-report-scene>
            <span class="gr-main"><span class="gr-name">${T("reportScene")}</span><br><span class="gr-sub">${T("reportSceneHint")}</span></span></button>
          <button class="group-row" data-nav data-fid="suggest" data-suggest>
            <span class="gr-main"><span class="gr-name">${T("suggestions")}</span><br><span class="gr-sub">${T("suggestionsHint")}</span></span></button>
          <button class="group-row" data-nav data-fid="source" data-source>
            <span class="gr-main"><span class="gr-name">${T("sourceCode")}</span><br><span class="gr-sub" dir="ltr">github.com/techFek/salik</span></span></button>
        </div>
        <div class="panel" style="margin-top:20px"><h3>${T("platforms")}</h3><p class="hint">${T("loginHint")}</p>
          <div class="link-list">${Object.keys(PLATFORMS).map((p) => `<button class="link-row" style="--pc:${PLATFORMS[p].color}" data-nav data-fid="lp-${p}" data-platform-home="${p}"><b><bdi>${pMark(p)}</bdi></b><span>${T("openSignIn")}</span></button>`).join("")}</div>
        </div>
        <div class="panel" style="margin-top:20px"><h3>${T("app")}</h3><p class="hint">${T("version", { v: esc(a.appVersion || "") })} · ${T(source)}</p>
          <button class="group-row ${a.engineEnabled !== false ? "on" : ""}" data-nav data-fid="engine" data-engine>
            <span class="gr-main"><span class="gr-name">${T("engine")}</span><br><span class="gr-sub">${T("engineHint")}</span></span>
            <i class="toggle ${a.engineEnabled !== false ? "on" : ""}"></i></button>
          <div class="stremio-box">
            <span class="gr-name">${T("stremioTitle")}</span><br><span class="gr-sub">${T("stremioHint")}</span>
            <div class="stremio-row">
              <input id="stremio-server" class="search" type="text" inputmode="url" dir="ltr" data-nav data-fid="stremio-input" placeholder="${T("stremioPlaceholder")}" value="${esc(a.stremioServer || "")}" autocomplete="off">
              <button class="chip on" data-nav data-fid="stremio-save" data-stremio-save>${T("save")}</button>
            </div>
            <span class="gr-sub">${a.stremioStreaming ? `${T("stremioViaPc", { u: `<bdi dir="ltr">${esc(a.stremioStreaming)}</bdi>` })}` : a.stremioOrigin ? `${T("stremioViaDocker", { u: `<bdi dir="ltr">${esc(a.stremioOrigin)}</bdi>` })}` : T("stremioNone")}</span>
          </div>
          <button class="group-row ${a.youtubeTv ? "on" : ""}" data-nav data-fid="yt-tv" data-yt-tv>
            <span class="gr-main"><span class="gr-name">${T("ytTv")}</span><br><span class="gr-sub">${T("ytTvHint")}</span></span>
            <i class="toggle ${a.youtubeTv ? "on" : ""}"></i></button>
          <button class="group-row" data-nav data-fid="log" data-share-log><span class="gr-main"><span class="gr-name">${T("sendLog")}</span></span></button>
          <button class="group-row" data-nav data-fid="exit" data-exit><span class="gr-main"><span class="gr-name">${T("exitApp")}</span></span></button>
        </div>
      </div>
    </div></div>`;
}

function renderGuide() {
  const L = EN ? 1 : 0;
  $view.innerHTML = `<div class="page guide">
    <div class="acc-head"><div><h1>${T("guide")}</h1><p>${T("guideSub")}</p></div></div>
    ${GUIDE.map((sec) => `<section class="panel guide-sec" data-nav data-fid="gd-${sec.id}" tabindex="0">
      <h3>${esc(sec.title[L])}${sec.tag ? ` <span class="beta">${esc(sec.tag[L])}</span>` : ""}</h3>
      <ul>${sec.points.map((pt) => `<li>${esc(pt[L])}</li>`).join("")}</ul>
    </section>`).join("")}
  </div>`;
}

function renderState(title, text, actions) {
  $view.innerHTML = `<div class="state"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="btn-row" style="justify-content:center">${actions || ""}</div></div>`;
}

const current = () => S.stack[S.stack.length - 1];

async function rerender(restoreFid) {
  const fid = restoreFid ?? document.activeElement?.dataset?.fid;
  const scr = current();
  const railRoute = scr.name === "guide" ? "settings" : scr.name === "details" ? (S.stack.find((x) => x.name !== "details")?.name || "home") : scr.name;
  document.querySelectorAll(".rail-item").forEach((b) => b.classList.toggle("active", b.dataset.route === railRoute));
  if (S.error && scr.name !== "settings") {
    renderState(T("loadFail"), T("loadFailHint"), `<button class="btn btn-primary" data-nav data-fid="retry" data-retry>${T("retry")}</button>`);
  } else if (scr.name === "home") await renderHome();
  else if (scr.name === "browse") renderBrowse();
  else if (scr.name === "details") await renderDetails(scr.key);
  else if (scr.name === "settings") await renderSettings();
  else if (scr.name === "guide") renderGuide();
  if (restoreFid === null) $view.scrollTo({ top: 0, behavior: "instant" });
  const target = (fid && $view.querySelector(`[data-fid="${CSS.escape(fid)}"]`)) || $view.querySelector("[data-nav]");
  if (target && !$modalRoot.firstChild) focusEl(target, true);
}

function go(screen) {
  if (current().name === screen.name && screen.name !== "details") { rerender(); return; }
  current().fid = document.activeElement?.dataset?.fid;
  if (screen.name === "guide") S.stack = [{ name: "home" }, { name: "settings", fid: "open-guide" }];
  else if (screen.name !== "details") S.stack = [{ name: "home" }];
  if (screen.name !== "home" || S.stack.length > 1) S.stack.push(screen);
  $view.scrollTo({ top: 0, behavior: "instant" });
  rerender(null);
}
function goHome() { S.stack = [{ name: "home" }]; $view.scrollTo({ top: 0, behavior: "instant" }); rerender(null); }

window.salikBack = function () {
  if ($modalRoot.firstChild) { closeModal(); return true; }
  if (S.stack.length > 1) { S.stack.pop(); rerender(current().fid || null); return true; }
  return false;
};
window.salikResume = function () {
  if (current().name === "home" && !$modalRoot.firstChild) rerender();
};

function watchUrl(item, p) {
  let url = getUrlForPlatform(item, p) || item.platforms?.[p]?.url;
  const m = url && p === "netflix" && url.match(/netflix\.com\/title\/(\d+)/);
  if (m) url = `https://www.netflix.com/watch/${m[1]}`;
  if (url && p === "stremio" && stremioOrigin()) url = url.replace(/^https?:\/\/(web\.)?stremio\.com/i, stremioOrigin());
  return url;
}

function startWatch(item, p) {
  const url = watchUrl(item, p);
  const rememberKey = item.type === "episode" && item.parent_series_id && S.byKey[item.parent_series_id] ? item.parent_series_id : item.key;
  try {
    const recent = JSON.parse(localStorage.getItem("salik.recent") || "[]").filter((k) => k !== rememberKey);
    recent.unshift(rememberKey);
    localStorage.setItem("salik.recent", JSON.stringify(recent.slice(0, 20)));
  } catch (e) {}
  if (url) native.openUrl(url, `${item.title} @ ${p}`);
  else { toast(T("noDirectLink", { t: item.title, p: pName(p) })); native.openUrl(platformHome(p), p); }
}

function watch(key, platform) {
  const item = S.byKey[key];
  if (!item) return;
  const plats = visiblePlatforms([item.platforms]);
  if (platform || plats.length === 1) { startWatch(item, platform || plats[0]); return; }
  if (!plats.length) { toast(T("noPlatform")); return; }
  openModal(`<h3><bdi>${esc(item.title)}</bdi></h3><p>${T("pickPlatform")}</p>
    <div class="watch-list">${plats.map((p) => `<button class="watch-btn" data-nav data-fid="m-${p}" data-watch="${esc(key)}" data-platform="${p}"><span><bdi>${esc(pName(p))}</bdi></span></button>`).join("")}</div>`);
}

function deviceLine() {
  return `\n\n---\nSalik ${S.app?.appVersion || ""} · ${navigator.userAgent.includes("TV") ? "TV" : ""} ${EN ? "en" : "ar"}`;
}
function openIssue(title, body, label) {
  native.openExternal(`${GITHUB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(label)}`);
}
function openSceneReport() {
  const last = recentItems()[0];
  const plats = last ? platformsOf(last) : [];
  const options = Object.keys(PLATFORMS).map((p) => `<option value="${p}" ${plats[0] === p ? "selected" : ""}>${esc(pName(p))}</option>`).join("");
  openModal(`<h3>${T("reportScene")}</h3><p>${T("reportSceneHint")}</p>
    <div class="form">
      <input id="rs-title" class="search" type="text" data-nav data-fid="rs-title" placeholder="${T("rsTitle")}" value="${esc(last ? last.title : "")}">
      <select id="rs-platform" class="search" data-nav data-fid="rs-platform" aria-label="${T("rsPlatform")}">${options}</select>
      <input id="rs-time" class="search" type="text" dir="ltr" inputmode="numeric" data-nav data-fid="rs-time" placeholder="${T("rsTime")}">
      <textarea id="rs-desc" class="search" rows="3" data-nav data-fid="rs-desc" placeholder="${T("rsDesc")}"></textarea>
      <button class="watch-btn" data-nav data-fid="rs-send" data-send-report><span>${T("rsSend")}</span></button>
    </div>`);
}
function sendSceneReport() {
  const v = (id) => (document.getElementById(id)?.value || "").trim();
  const title = v("rs-title"), desc = v("rs-desc"), time = v("rs-time"), plat = v("rs-platform");
  if (!title || !desc) { toast(T("rsNeed")); return; }
  const item = S.titles.find((t) => norm(t.title) === norm(title));
  const body = EN
    ? `**Title:** ${title}\n**Platform:** ${PLATFORMS[plat]?.name || plat}\n**Time:** ${time || "-"}${item ? `\n**Library key:** ${item.key}` : ""}\n\n**Scene:**\n${desc}`
    : `**العمل:** ${title}\n**المنصة:** ${PLATFORMS[plat]?.name || plat}\n**التوقيت:** ${time || "-"}${item ? `\n**المعرّف في المكتبة:** ${item.key}` : ""}\n\n**المشهد:**\n${desc}`;
  openIssue(`${EN ? "[Scene report]" : "[بلاغ مشهد]"} ${title}`, body + deviceLine(), "scene-report");
  closeModal();
  toast(T("rsOpened"));
}

function openModal(html) {
  const lastFid = document.activeElement?.dataset?.fid;
  $modalRoot.innerHTML = `<div class="modal-back" data-close-modal><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  $modalRoot.dataset.returnFid = lastFid || "";
  focusEl($modalRoot.querySelector("[data-nav]"), true);
}
function closeModal() {
  const fid = $modalRoot.dataset.returnFid;
  $modalRoot.innerHTML = "";
  const el = fid && document.querySelector(`[data-fid="${CSS.escape(fid)}"]`);
  if (el) focusEl(el, true);
}

document.addEventListener("click", async (e) => {
  const el = e.target.closest("button, [data-close-modal]");
  if (!el) return;
  if (el.matches("[data-close-modal]") && e.target === el) { closeModal(); return; }
  const d = el.dataset;
  if (d.route) { go({ name: d.route }); return; }
  if (d.open) {
    if (suppressClickUntil > Date.now()) return;
    go({ name: "details", key: d.open }); return;
  }
  if (d.watch) { closeModal(); watch(d.watch, d.platform); return; }
  if (d.platformHome) { native.openUrl(platformHome(d.platformHome), d.platformHome); return; }
  if (d.retry !== undefined) { await load(true); return; }
  if (d.season) { current().season = Number(d.season); rerender(el.dataset.fid); return; }
  if (d.type) { S.browse.type = d.type; rerender(el.dataset.fid); return; }
  if (d.plat) { S.browse.platform = d.plat; rerender(el.dataset.fid); return; }
  if (d.lang) {
    if ((d.lang === "en") !== EN) { await chrome.storage.local.set({ salikLang: d.lang }); sessionStorage.setItem("salik.route", "settings"); location.reload(); }
    return;
  }
  if (d.global) {
    S.settings = await setGroupEnabled(d.global, !S.settings[d.global].enabled);
    toast(T(S.settings[d.global].enabled ? "groupOnAll" : "groupOffAll", { g: gName(d.global) }));
    rerender(el.dataset.fid); return;
  }
  if (d.sub) {
    const [g, s] = d.sub.split(":");
    if (!S.settings[g].enabled) { toast(T("enableGroupFirst")); return; }
    S.settings = await setSubcategoryEnabled(g, s, !S.settings[g].subs[s]);
    rerender(el.dataset.fid); return;
  }
  if (d.expand) { const c = current(); c.open = c.open === d.expand ? "" : d.expand; rerender(el.dataset.fid); return; }
  if (d.ytSkip) {
    S.ytSkip = await setYtSkipOption(d.ytSkip, !(S.ytSkip && S.ytSkip[d.ytSkip] !== false));
    rerender(el.dataset.fid); return;
  }
  if (d.ytMute !== undefined) {
    S.ytAutoMute = !S.ytAutoMute; setYtAutoMuteEnabled(S.ytAutoMute);
    toast(T(S.ytAutoMute ? "ytOnToast" : "ytOffToast")); rerender(el.dataset.fid); return;
  }
  if (d.removeRecent) { removeRecent(d.removeRecent); return; }
  if (d.closeBtn !== undefined) { closeModal(); return; }
  if (d.subtitleCensor !== undefined) { S.subtitleCensor = !S.subtitleCensor; setSubtitleCensorEnabled(S.subtitleCensor); rerender(el.dataset.fid); return; }
  if (d.expandTitle) { const c = current(); c.openGroup = c.openGroup === d.expandTitle ? "" : d.expandTitle; rerender(el.dataset.fid); return; }
  if (d.filter) {
    const [k, id] = d.filter.split("|");
    const store = await getDisabledFiltersStore();
    const m = store[k] || (store[k] = {});
    const nowOff = !m[id];
    if (nowOff) m[id] = true; else delete m[id];
    if (!Object.keys(m).length) delete store[k];
    await chrome.storage.local.set({ disabledFilters: store });
    toast(T(nowOff ? "filterOff" : "filterOn"));
    rerender(el.dataset.fid); return;
  }
  if (d.titleGroup) { await toggleTitleGroup(current().key, d.titleGroup); rerender(el.dataset.fid); return; }
  if (d.engine !== undefined) { const on = !(S.app?.engineEnabled !== false); native.setEngineEnabled(on); S.app = { ...(S.app || {}), engineEnabled: on }; rerender(el.dataset.fid); return; }
  if (d.stremioSave !== undefined) {
    const v = (document.getElementById("stremio-server")?.value || "").trim();
    native.setStremioServer(v);
    S.app = await fetch("/data/app.json").then((r) => r.json()).catch(() => S.app);
    toast(T(v ? "saved" : "cleared")); rerender(el.dataset.fid); return;
  }
  if (d.ytTv !== undefined) { const on = !S.app?.youtubeTv; native.setYoutubeTv(on); S.app = { ...(S.app || {}), youtubeTv: on }; rerender(el.dataset.fid); return; }
  if (d.gender) {
    const a = S.app || (S.app = {});
    a[d.gender] = !a[d.gender];
    native.setGenderBlur(!!a.hideFemale, !!a.hideMale);
    toast(T(a[d.gender] ? "genderOn" : "genderOff", { g: T(d.gender) }));
    rerender(el.dataset.fid); return;
  }
  if (d.routeGuide !== undefined) { go({ name: "guide" }); return; }
  if (d.reportScene !== undefined) { openSceneReport(); return; }
  if (d.sendReport !== undefined) { sendSceneReport(); return; }
  if (d.suggest !== undefined) {
    openIssue(EN ? "[Suggestion] " : "[اقتراح] ", (EN ? "**Suggestion:**\n\n" : "**الاقتراح:**\n\n") + deviceLine(), "suggestion"); return;
  }
  if (d.source !== undefined) { native.openExternal(GITHUB_REPO); return; }
  if (d.shareLog !== undefined) { native.shareLog(); return; }
  if (d.exit !== undefined) { native.exitApp(); return; }
});

async function toggleTitleGroup(key, g) {
  const item = S.byKey[key];
  const { groups, disabled, all } = await perTitleState(item);
  const grp = groups.find((x) => x.g === g);
  const enable = !grp.on;
  const store = toggleTitleGroupStore(all, disabled, g, enable);
  await chrome.storage.local.set({ disabledFilters: store });
  toast(T(enable ? "titleGroupOn" : "titleGroupOff", { g: gName(g), t: item.title }));
}

document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName === "IMG" && img.classList.contains("poster")) {
    const div = document.createElement("div");
    div.className = "poster poster-fallback";
    div.textContent = img.dataset.title || "";
    img.replaceWith(div);
  } else if (img.tagName === "IMG" && img.classList.contains("hero-poster")) img.remove();
}, true);

const HOLD_MS = 550;
let suppressClickUntil = 0;
let holdTimer = null;

function openRecentMenu(key) {
  const item = S.byKey[key];
  if (!item) return;
  suppressClickUntil = Date.now() + 700;
  openModal(`<h3><bdi>${esc(item.title)}</bdi></h3>
    <div class="watch-list">
      <button class="watch-btn danger" data-nav data-fid="rm-yes" data-remove-recent="${esc(key)}"><span>${T("removeRecent")}</span></button>
      <button class="watch-btn neutral" data-nav data-fid="rm-no" data-close-btn><span>${T("cancel")}</span></button>
    </div>`);
}

function removeRecent(key) {
  try {
    const recent = JSON.parse(localStorage.getItem("salik.recent") || "[]").filter((k) => k !== key);
    localStorage.setItem("salik.recent", JSON.stringify(recent));
  } catch (e) {}
  const title = S.byKey[key]?.title || "";
  $modalRoot.innerHTML = "";
  const cards = [...$view.querySelectorAll("[data-recent]")];
  const i = cards.findIndex((c) => c.dataset.recent === key);
  const next = cards[i + 1] || cards[i - 1];
  rerender(next ? next.dataset.fid : "g-nudity");
  toast(T("removedRecent", { t: title }));
}

function cancelHold() { clearTimeout(holdTimer); holdTimer = null; }
document.addEventListener("pointerdown", (e) => {
  const el = e.target.closest("[data-recent]");
  if (!el || (e.pointerType === "mouse" && e.button !== 0)) return;
  cancelHold();
  const x = e.clientX, y = e.clientY;
  holdTimer = setTimeout(() => { holdTimer = null; openRecentMenu(el.dataset.recent); }, HOLD_MS);
  const move = (m) => { if (Math.hypot(m.clientX - x, m.clientY - y) > 12) cancelHold(); };
  el.addEventListener("pointermove", move, { passive: true });
  const end = () => { cancelHold(); el.removeEventListener("pointermove", move); };
  el.addEventListener("pointerup", end, { once: true });
  el.addEventListener("pointercancel", end, { once: true });
});
document.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-recent]")) e.preventDefault(); });

let enterHeld = null;
function onRecentEnterDown(e) {
  const el = document.activeElement?.closest?.("[data-recent]");
  if (!el || $modalRoot.firstChild || (e.key !== "Enter" && e.key !== " ")) return false;
  e.preventDefault();
  if (!enterHeld) {
    enterHeld = { key: el.dataset.recent, fired: false };
    enterHeld.timer = setTimeout(() => { if (enterHeld) { enterHeld.fired = true; openRecentMenu(enterHeld.key); } }, HOLD_MS);
  }
  return true;
}
document.addEventListener("keyup", (e) => {
  if (!enterHeld || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  const h = enterHeld; enterHeld = null;
  clearTimeout(h.timer);
  if (!h.fired) go({ name: "details", key: h.key });
});

function focusEl(el, instant) {
  if (!el) return;
  el.focus({ preventScroll: true });
  if (el.closest(".hero")) $view.scrollTo({ top: 0, behavior: instant ? "auto" : "smooth" });
  else if (!el.closest(".browse-head")) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: instant ? "auto" : "smooth" });
}

function visible(el) {
  if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function moveFocus(dir) {
  const scope = $modalRoot.firstChild || document;
  const els = [...scope.querySelectorAll("[data-nav]")].filter(visible);
  const cur = document.activeElement;
  if (!els.includes(cur)) { focusEl(els.find((e) => $view.contains(e)) || els[0]); return; }
  const c = cur.getBoundingClientRect();
  const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    let primary, secondary;
    if (dir === "right") { if (r.left < c.right - 6 && x <= cx + 4) continue; primary = Math.max(0, r.left - c.right); secondary = (r.bottom < c.top || r.top > c.bottom) ? Math.abs(y - cy) : 0; }
    else if (dir === "left") { if (r.right > c.left + 6 && x >= cx - 4) continue; primary = Math.max(0, c.left - r.right); secondary = (r.bottom < c.top || r.top > c.bottom) ? Math.abs(y - cy) : 0; }
    else if (dir === "down") { if (r.top < c.bottom - 6 && y <= cy + 4) continue; primary = Math.max(0, r.top - c.bottom); secondary = (r.right < c.left || r.left > c.right) ? Math.abs(x - cx) : 0; }
    else { if (r.bottom > c.top + 6 && y >= cy - 4) continue; primary = Math.max(0, c.top - r.bottom); secondary = (r.right < c.left || r.left > c.right) ? Math.abs(x - cx) : 0; }
    const score = primary + secondary * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) focusEl(best);
}

document.addEventListener("keydown", (e) => {
  const map = { ArrowRight: "right", ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down" };
  const dir = map[e.key];
  if (!dir && onRecentEnterDown(e)) return;
  if (!dir) {
    if (e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack") { if (!window.salikBack()) native.exitApp(); e.preventDefault(); }
    return;
  }
  const t = e.target;
  if (t.tagName === "INPUT" && (dir === "left" || dir === "right")) {
    const towardEnd = EN ? dir === "right" : dir === "left";
    const atEdge = towardEnd ? t.selectionStart === t.value.length : t.selectionStart === 0;
    if (!atEdge) return;
  }
  e.preventDefault();
  moveFocus(dir);
});

async function load(fresh) {
  try {
    const lib = await fetch(fresh ? "/data/library-fresh.json" : "/data/library.json").then((r) => r.json());
    S.error = lib.__error || null;
    if (!S.error) prepare(lib);
  } catch (e) {
    S.error = "NETWORK";
  }
  await rerender(null);
}

const $rail = document.querySelector(".rail");
document.querySelector(".rail-handle")?.addEventListener("click", () => {
  $rail.classList.add("open");
  const active = $rail.querySelector(".rail-item.active") || $rail.querySelector(".rail-item");
  if (active) active.focus({ preventScroll: true });
});
document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".rail, .rail-handle")) $rail.classList.remove("open"); });
$rail.addEventListener("focusin", (e) => {
  if (e.relatedTarget && $rail.contains(e.relatedTarget)) return;
  const active = $rail.querySelector(".rail-item.active");
  if (active && e.target !== active) active.focus({ preventScroll: true });
});
$rail.addEventListener("focusout", () => setTimeout(() => { if (!$rail.contains(document.activeElement)) $rail.classList.remove("open"); }, 0));
$rail.addEventListener("click", (e) => { if (e.target.closest(".rail-item")) setTimeout(() => $rail.classList.remove("open"), 0); });

(async function boot() {
  document.querySelectorAll(".rail-item").forEach((b) => {
    b.setAttribute("data-fid", "rail-" + b.dataset.route);
    b.querySelector("span:last-child").textContent = T(b.dataset.route);
    b.setAttribute("aria-label", T(b.dataset.route));
  });
  [S.settings, S.subtitleCensor, S.ytAutoMute, S.ytSkip, S.app] = await Promise.all([getFilterSettings(), getSubtitleCensorEnabled(), getYtAutoMuteEnabled(), getYtSkip(),
    fetch("/data/app.json").then((r) => r.json()).catch(() => null)]);
  renderState(T("loading"), T("loadingHint"));
  const after = sessionStorage.getItem("salik.route");
  sessionStorage.removeItem("salik.route");
  if (after === "settings") S.stack = [{ name: "home" }, { name: "settings" }];
  await load(false);
  fetch("/data/library-fresh.json").then((r) => r.json()).then((lib) => {
    if (lib.__error) return;
    const before = JSON.stringify(Object.keys(S.byKey).length);
    prepare(lib);
    fetch("/data/app.json").then((r) => r.json()).then((a) => { S.app = a; }).catch(() => {});
    if (S.error || JSON.stringify(Object.keys(S.byKey).length) !== before) { S.error = null; rerender(); }
  }).catch(() => {});
})();
