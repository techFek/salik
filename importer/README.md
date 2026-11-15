# Salik importer

أداة بتاخد توقيتات المشاهد من مشاريع تانية وتحوّلها لصيغة سالك. التوقيتات دي **ما بتتطبّقش** في الإضافة والتطبيق غير بعد ما حد يراجعها، أو لو المستخدم شغّل "توقيتات المجتمع غير المراجعة".

| المصدر | الملف | الحالة |
|---|---|---|
| [MovieContentFilter](https://www.moviecontentfilter.com/specification) | `.mcf` (WebVTT) | شغال |
| [VideoSkip](https://videoskip.herokuapp.com/exchange/howto/edit) | `.skp` | شغال |
| [Skipit](https://getskipit.com/) | — | مقفول، ومستني إذن المطوّر (`SkipitAdapter`) |

الأداة بتقرا بس الملفات اللي **إنت** نزّلتها بإيدك، ومش بتسحب حاجة من أي موقع.

## 1) الاستيراد

```
node importer/cli.mjs film.mcf --runtime 7265.4 --platform stremio --license "…" --out film.json
node importer/cli.mjs film.skp --imdb tt1234567 --runtime 7265.4 --merge --title "Film"
```

- `--merge`: بيضيف المشاهد لـ `library/<key>.json` على إنها `verified:false`، ويبني `library.json` من جديد. الـ key بيتعرف من رقم IMDb، أو بتحدده بـ `--key`.
- أي مشهد بيتداخل مع فلتر موجود من نفس النوع بيتشال، علشان ما يتكررش.
- المشاهد من نوع `other` (قمار، رعب، إعلانات…) بتتحفظ في ملف الـ JSON الموحّد، بس مش بتدخل المكتبة، لأن سالك مفيهوش مجموعة ليها.

## 2) المراجعة

```
node importer/serve.mjs        ← http://localhost:8788/importer/review.html
```

1. **الملف:** افتح ملف `.mcf` أو `.skp`، أو اكتب مفتاح عمل موجود علشان تراجع المشاهد غير المراجعة بتاعته.
2. **الفيديو:** افتح ملف الفيديو.
   - مدته بتتسجّل `runtimeSec` لوحدها.
   - **مزامنة:** شغّل الفيديو على اللقطة المرجعية (START في MCF، أو الـ screenshot في VideoSkip)، ودوس **"اللقطة المرجعية الآن"**، وبعدين **"طبّق الإزاحة"**.
3. **كل مشهد:**
   - **▶** بيشغّله، من قبل بدايته بثانيتين لحد بعد نهايته بثانية.
   - تقدر تعدّل التوقيت (أو "البداية/النهاية = الآن") والتصنيف والإجراء.
   - **✓** موافقة، **✗** حذف.
4. **النشر على GitHub:**
   - استخدم token من نوع **fine-grained**: مستودع `techFek/salik` بس، وصلاحية **Contents: Read and write**.
   - الـ token بيتحفظ في الجلسة دي بس، ومبيتبعتش غير لـ `api.github.com`.
   - النشر بيعمل commit واحد فيه `library/<key>.json` و`library.json`.
   - الافتراضي إن المشاهد اللي وافقت عليها بس هي اللي بتتنشر.

## الصيغة الموحّدة

```json
{
  "imdb": "tt1234567", "season": null, "episode": null,
  "source": "mcf|videoskip|skipit|manual",
  "platformVersion": "netflix|shahid|stremio|unknown",
  "runtimeSec": 7265.4,
  "reference": { "time": 4.02, "desc": "…" },
  "attribution": { "source": "MovieContentFilter", "url": "…", "license": "…", "importedAt": "2026-11-15" },
  "segments": [
    { "start": 10.5, "end": 12.75, "category": "sex|nudity|violence|gore|profanity|drugs|other",
      "severity": "low|medium|high", "action": "skip|mute|blur", "verified": false, "note": "punching" }
  ]
}
```

**الصيغة دي للاستيراد والتبادل بس.** المكتبة نفسها لسه بصيغتها القديمة، علشان الإضافة والتطبيق وStremio ما يتكسروش. التحويل بيعمل كده:

| الصيغة الموحّدة | `library/<key>.json` |
|---|---|
| segment | filter: `start`, `end`, `category`, `original_description`, `action_type` + `severity`, `source`, `verified:false` |
| `sex`, `nudity` | `category: "nudity"` |
| `violence`, `gore` | `"violence"` |
| `profanity` | `"language"` |
| `drugs` | `"substance abuse"` |
| `runtimeSec`, `platformVersion`, `reference` | `sync: { runtimeSec, platformVersion, reference }` |
| `attribution` | `attribution: [ … ]` (بيظهر في "عن سالك") |

### التصنيفات

- **MovieContentFilter:** الإجراء حسب القناة: `both` → skip، و`video` → blur، و`audio` → mute. الألفاظ دايمًا mute.

  | الفئة | تصنيف سالك |
  |---|---|
  | sex وفروعها (kissing, coitus…) | `sex` |
  | `sexualDialogue` | `sex` + mute |
  | nudity وفروعها | `nudity` |
  | violence وفروعها | `violence` |
  | `hemophobia`, `emetophobia` | `gore` |
  | language وفروعها | `profanity` |
  | drugs وفروعها (alcohol, cigarettes…) | `drugs` |
  | `gambling`، و fear وdiscrimination وcommercial وdispensable وفروعهم | `other` |

- **VideoSkip:** بيقرا أول 3 حروف من التصنيف، زي ما VideoSkip نفسه بيعمل. والشدة من 1 لـ 3 بتبقى low وmedium وhigh.

  | البادئة | تصنيف سالك |
  |---|---|
  | `nud` | `nudity` |
  | `sex`, `kis` | `sex` |
  | `vio`, `fig` | `violence` |
  | `gor`, `blo` | `gore` |
  | `pro`, `cur`, `swe`, `lan` | `profanity` |
  | `alc`, `dru`, `smo` | `drugs` |
  | `fri` وأي حاجة تانية | `other` |

  الإجراء بيتحدد من الكلمات اللي في السطر:

  | الكلمة | الإجراء |
  |---|---|
  | `video` / `image` / `blank` / `img` / `blur` | blur |
  | `audio` / `word` / `speech` / `sound` | mute |
  | من غير كلمة | skip (والألفاظ mute) |

## المزامنة في الإضافة

- **عادي:** لو العمل فيه `sync.runtimeSec`، أو `platforms.<منصة>.runtime_sec`، الإضافة بتقارن المدة دي بمدة الفيديو اللي شغال (`SalikFilterCore.syncDecision`).
- **فرق من 2 لـ 60 ثانية:** الفلاتر شغالة، وبيظهر زرار **"مزامنة"**.
  - تشغّل الفيديو لحد اللقطة المرجعية وتدوس "هنا"، أو تظبط بـ ±½ ثانية.
  - الإزاحة دي بتتحفظ على الجهاز لكل عمل ولكل منصة في `salikPlatformOffsets`، وبتاخد مكان `offset_seconds` اللي في المكتبة.
- **فرق أكتر من 60 ثانية:** دي نسخة تانية، فالفلاتر بتقف لحد ما المستخدم يعمل مزامنة.

## الحقوق

- **الرخصة:** صفحة مواصفات MovieContentFilter وصفحة VideoSkip **ما بيذكروش رخصة للبيانات**. كود MovieContentFilter نفسه رخصته AGPL-3.0، بس ده مش معناه إن الملفات المرفوعة عليه بنفس الرخصة.
  - علشان كده الأداة بتسجّل الرخصة "unknown" لحد ما تكتبها بنفسك.
  - صفحة المراجعة بتحذّرك قبل النشر.
  - اتأكد من صاحب الملف أو من الموقع قبل ما تنشر ملفاته في المكتبة العامة.
- **الإسناد:** كل عمل مستورد بيحتفظ بـ `attribution` (المصدر والرابط والرخصة)، وبيظهر في **"عن سالك"** في الإضافة والتطبيق.
- **Skipit:** مفيش استيراد منه قبل إذن مطوّره.
