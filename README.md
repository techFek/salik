<div align="center">

# Salik • سالك

**Watch movies and series with your family, with peace of mind.**
**شاهد مع عائلتك وانت مطمئن.**

Free & open-source · Chrome · Android · Android TV · Stremio

[English](#english) · [العربية](#العربية)

</div>

---

## English

Salik is a free, open-source tool that **skips, blurs or mutes** sensitive scenes and language while you watch on official streaming platforms. It is a charitable project. It is free forever, with no subscriptions, no ads and no accounts.

Salik does not host or download any video content. In the browser and the apps it only controls playback in the platform's own player, based on a timed filters library.

### Install

| Platform | How to install |
|---|---|
| 💻 **Chrome extension** | Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/salik-%E2%80%A2-%D8%B3%D8%A7%D9%84%D9%83/ngehcikconlnhlhhfbgemloihlkmiibb) → **Add to Chrome** (also works in Edge) |
| 📱 **Android** | Download [Salik-Android.apk](https://github.com/techFek/salik/releases/download/v1.1.0/Salik-Android-1.1.0.apk) → open it → allow installing from unknown sources |
| 📺 **Android TV / Google TV** | On your TV: install **Downloader** from Google Play → allow it to install unknown apps → open it, enter code **2145494** and press Go → Install. Or [download the APK](https://github.com/techFek/salik/releases/download/v1.1.0/Salik-AndroidTV-1.1.0.apk) and copy it with a USB drive |
| 🎬 **Stremio (any device, incl. Samsung TVs)** | Run the [Stremio addon](stremio-addon/README.md) on your computer and install it in Stremio |

All releases: [Releases](https://github.com/techFek/salik/releases)

### Supported platforms

Netflix · Prime Video · Disney+ · Shahid · OSN+ · Yango Play · Apple TV · Watch It · Starzplay · STC tv · Tod · beIN Connect · YouTube · Dailymotion · Stremio

### How it works

Every title in the library has a timeline of filters. When playback reaches a filter's start time, Salik applies one of these actions until the end time:

| Skip | Blur | Mute |
|:---:|:---:|:---:|
| <img src="assets/demo-skip.gif" width="260" alt="Skip demo"> | <img src="assets/demo-blur.gif" width="260" alt="Blur demo"> | <img src="assets/demo-mute.gif" width="260" alt="Mute demo"> |
| Jumps over the scene | Covers the picture | Silences the audio |

The amber part of the timeline is the filtered segment. A blur can also cover **only part of the picture** (partial blur). Mute and skip start a fraction of a second early, so not even the first letter of a word is heard.

### Features

**Filtering**
- 🔞 **Four categories**, each with sub-categories you can turn on or off:
  - Sensitive scenes: kissing, relations, exposure, revealing clothes…
  - Violence & gore: weapons, physical harm, disturbing scenes, blood
  - Language: blasphemy, swearing, profanity, insults, sexual words…
  - Substance use: smoking, alcohol, drugs, gambling
- 🎛️ **Per title**: see every scene of a title and turn any single scene off.
- ✍️ **Subtitle cleaning**: bad words in on-screen subtitles are replaced with symbols, and stay readable during a full blur.

**YouTube**
- 🔇 **Auto-mute**: mutes the moment a bad word is spoken, using the video's captions.
- ⏭️ **Skip sponsors and filler** (on by default, each can be turned off):
  - paid sponsors
  - subscribe / like reminders
  - self promotion
  - intros and outros

  Times come from [SponsorBlock](https://sponsor.ajay.app). Only a 4-character hash prefix of the video id is sent.
- 🔑 **Sign in on Android** through YouTube's TV screen with a code, since Google blocks sign-in inside apps.

**Android & Android TV app**
- 📚 A full catalog in **Arabic and English**: home, browse, recently watched, and a page for every title with its scenes.
- 📺 Remote-friendly TV interface; the same app adapts to phones (portrait and landscape).
- 🎬 **Stremio** through the Stremio app on a computer at home (see *Platform guide* in Settings).
- 🧪 **Experimental**: hide women or hide men on YouTube, Dailymotion and Stremio, using open-source face models that run on the device.
- 📝 Report a scene that was not filtered, or send a suggestion, straight to GitHub Issues from Settings.

**Stremio addon** ([details](stremio-addon/README.md))
- Works on **any Stremio**, including Samsung (Tizen) TVs where extensions and apps cannot run.
- Your computer plays the stream through FFmpeg with the library applied: skipped parts are cut out, mute, full and partial blur.
- Subtitles from a subtitles addon are retimed after the skipped parts and cleaned.

**Privacy**
- No accounts, no tracking. Settings stay on your device.
- The library is a public JSON file in this repository.

### Project structure

```
library/<key>.json          One file per title: title info + its filters (start, end, action, category)
library.json                Generated combined library downloaded by the apps. Do not edit by hand.
scripts/build-library.js    Builds library.json from library/ (leaves out titles without filters) and validates it
scripts/validate-library.js Checks the library (duplicate ids, bad times, unknown categories, shared platform ids)
scripts/sync-android.js     Copies the shared files into android/ (--check fails in CI when they differ)
shared/filter-core.js       One copy of the categories, keyword matching, title lookup and timing rules
isolated.script.js          Extension engine (picks the filter to apply, talks to the background)
main.script.js              Runs in the page: mute, skip, blur, YouTube captions
subtitle-censor-core.js     Subtitle word lists (main.script.js has its own copy for YouTube captions)
Background.js               Extension service worker: library download, title lookup, SponsorBlock
app/                        Extension popup (services.js, i18n.js: Arabic RTL / English LTR)
android/                    Android & Android TV app (Kotlin + WebView)
stremio-addon/              Stremio addon (Node.js + FFmpeg)
tests/                      Node tests: run `node --test` from the repo root
```

Titles may include `title_en` and `description_en`, and filters may include `description_en`, for the English UI.

### Contributing

Every contribution is welcome, from a single missed scene to a whole new title.

**Report without code:** open an [Issue](../../issues) with the title, platform, timestamp and what should be filtered.

**With code:** edit `library/<key>.json` (never `library.json`), then run:

```
node scripts/build-library.js
node scripts/sync-android.js
node --test
```

### Support the project

Salik is and will always be free. Donations are **optional** and are not commercial profit. They go entirely to keeping the project running: server costs, developing new features, and operating expenses, so its benefit can keep growing. Donation links are available inside the apps.

### License

[MIT](LICENSE). YouTube skip times are SponsorBlock data, under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). The experimental face detection uses [Human](https://github.com/vladmandic/human) (MIT) and its models (Apache 2.0).

---

<div dir="rtl">

## العربية

**سالك** أداة مجانية ومفتوحة المصدر تتيح **تخطّي المشاهد والألفاظ غير اللائقة أو تمويهها أو كتمها** أثناء المشاهدة على منصات البث الرسمية. أُطلق هذا المشروع **مبادرةً مجتمعية غير ربحية** بالكامل، تهدف إلى توفير بيئة مشاهدة آمنة لكل العائلات، وهو مجاني إلى الأبد، بلا اشتراكات ولا إعلانات ولا حسابات.

لا يستضيف سالك أي محتوى ولا يُنزّله؛ وإنما يتحكم في التشغيل داخل مشغّل المنصة نفسها في المتصفح والتطبيقات، بناءً على مكتبة فلاتر مضبوطة بالتوقيت.

### التثبيت

| المنصة | طريقة التثبيت |
|---|---|
| 💻 **إضافة كروم** | ثبّتها من [Chrome Web Store](https://chromewebstore.google.com/detail/salik-%E2%80%A2-%D8%B3%D8%A7%D9%84%D9%83/ngehcikconlnhlhhfbgemloihlkmiibb) ← **Add to Chrome** (تعمل أيضًا على Edge) |
| 📱 **أندرويد** | [نزّل Salik-Android.apk](https://github.com/techFek/salik/releases/download/v1.1.0/Salik-Android-1.1.0.apk) ← افتح الملف ← اسمح بالتثبيت من مصادر غير معروفة |
| 📺 **أندرويد TV و Google TV** | على التلفاز: ثبّت تطبيق **Downloader** من Google Play ← اسمح له بتثبيت التطبيقات ← افتحه وأدخل الرمز **2145494** ثم اضغط Go ← Install. أو [نزّل الملف](https://github.com/techFek/salik/releases/download/v1.1.0/Salik-AndroidTV-1.1.0.apk) وانقله إلى التلفاز عبر ذاكرة USB |
| 🎬 **Stremio (أي جهاز، ومنها تلفزيونات سامسونج)** | شغّل [إضافة Stremio](stremio-addon/README.md) على حاسوبك وثبّتها في Stremio |

كل الإصدارات: [Releases](https://github.com/techFek/salik/releases)

### المنصات المدعومة

نتفليكس · برايم فيديو · ديزني+ · شاهد · OSN+ · يانغو بلاي · Apple TV · واتش إت · Starzplay · STC tv · تود · beIN Connect · يوتيوب · Dailymotion · Stremio

### كيف تعمل الأداة؟

لكل فيلم أو مسلسل في المكتبة جدولٌ زمني من الفلاتر. فإذا بلغ الفيديو بداية أي فلتر، طبّق سالك أحد هذه الإجراءات حتى نهايته:

| تخطٍّ | تمويه | كتم |
|:---:|:---:|:---:|
| <img src="assets/demo-skip.gif" width="260" alt="تخطٍّ"> | <img src="assets/demo-blur.gif" width="260" alt="تمويه"> | <img src="assets/demo-mute.gif" width="260" alt="كتم"> |
| يتجاوز المشهد | يحجب الصورة | يكتم الصوت |

يمثّل الجزء البرتقالي في شريط التشغيل المقطعَ الذي تجري تصفيته. ويمكن أن يغطي التمويه **جزءًا من الصورة فقط** (تمويه جزئي). ويبدأ الكتم والتخطي قبل اللفظ أو المشهد بجزء من الثانية، فلا يُسمع حتى الحرف الأول.

### الميزات

**التصفية**
- 🔞 **أربع فئات**، لكلٍّ منها تصنيفات فرعية يمكن تفعيلها أو تعطيلها:
  - المشاهد الحساسة: القبلات، والعلاقات، والعري، والملابس الكاشفة…
  - العنف والمحتوى المقزز: الأسلحة، والإيذاء الجسدي، والمشاهد المقززة، والدماء
  - الألفاظ: الإساءة للمقدسات، والشتائم، والألفاظ البذيئة، والإهانات، والألفاظ الجنسية…
  - التعاطي: التدخين، والكحول، والمخدرات، والقمار
- 🎛️ **لكل عمل على حدة**: اعرض كل مشاهد العمل، وأوقف أي مشهد بمفرده.
- ✍️ **تنقية الترجمة**: تُستبدل الألفاظ الممنوعة في الترجمة المعروضة برموز، وتبقى الترجمة مقروءة أثناء التمويه الكامل.

**يوتيوب**
- 🔇 **الكتم التلقائي**: يكتم الصوت لحظة نطق اللفظ الخارج، اعتمادًا على ترجمة الفيديو.
- ⏭️ **تخطي الإعلانات والحشو** (مفعّل افتراضيًا، ويمكن إيقاف كل نوع):
  - الإعلانات المدفوعة
  - التذكير بالاشتراك والإعجاب
  - الترويج الذاتي
  - المقدمة والخاتمة

  الأوقات من [SponsorBlock](https://sponsor.ajay.app)، ولا يُرسَل من معرّف الفيديو إلا أول 4 أحرف من بصمته.
- 🔑 **تسجيل الدخول على أندرويد** عبر واجهة يوتيوب للتلفاز برمز، لأن جوجل تمنع تسجيل الدخول داخل التطبيقات.

**تطبيق أندرويد وأندرويد TV**
- 📚 كتالوج كامل **بالعربية والإنجليزية**: الرئيسية، والتصفح، وشاهدته مؤخرًا، وصفحة لكل عمل بمشاهده.
- 📺 واجهة مناسبة للريموت على التلفاز، والتطبيق نفسه يتكيف مع الهاتف (طوليًا وأفقيًا).
- 🎬 **Stremio** عبر برنامج Stremio على حاسوب في المنزل (انظر «دليل ربط المنصات» في الإعدادات).
- 🧪 **تجريبي**: حجب الظهور النسائي أو الرجالي على يوتيوب وDailymotion وStremio، بنماذج مفتوحة المصدر تعمل على الجهاز نفسه.
- 📝 الإبلاغ عن مشهد لم تتم تصفيته، أو إرسال اقتراح، مباشرةً إلى GitHub Issues من الإعدادات.

**إضافة Stremio** ([التفاصيل](stremio-addon/README.md))
- تعمل على **أي Stremio**، ومنها تلفزيونات سامسونج (Tizen) التي لا تعمل عليها الإضافات ولا التطبيقات.
- يشغّل حاسوبك البث عبر FFmpeg مع تطبيق المكتبة: تُحذف المقاطع المتخطاة، ويُطبَّق الكتم والتمويه الكامل والجزئي.
- تُضبط توقيتات الترجمة القادمة من إضافة ترجمة بعد حذف المقاطع، وتُنقّى ألفاظها.

**الخصوصية**
- بلا حسابات ولا تتبّع، والإعدادات تبقى على جهازك.
- المكتبة ملف JSON عام في هذا المستودع.

### المساهمة

نرحّب بكل مساهمة، بدءًا من مشهدٍ واحد فائت التصفية، وصولًا إلى إضافة فيلم كامل جديد.

**دون برمجة:** افتح [Issue](../../issues) واذكر فيها اسم العمل، والمنصة، والتوقيت، وما يحتاج إلى تصفية.

**بالبرمجة:** عدّل `library/<key>.json` (وليس `library.json`)، ثم شغّل الأوامر الموضحة في القسم الإنجليزي.

### دعم المشروع

سالك مجاني وسيظل مجانيًا. والتبرعات **اختيارية لا إلزامية**، ولا يُقصد بها ربحٌ تجاري؛ إذ تُصرف كاملةً على استمرار المشروع: تكاليف الخوادم، وتطوير ميزات جديدة، ونفقات التشغيل، ليبقى أثره ممتدًا. وتجد روابط التبرع داخل التطبيقات.

### الترخيص

[MIT](LICENSE). أوقات التخطي على يوتيوب من بيانات SponsorBlock بترخيص [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). ويستخدم كشف الوجوه التجريبي مكتبة [Human](https://github.com/vladmandic/human) (MIT) ونماذجها (Apache 2.0).

</div>
