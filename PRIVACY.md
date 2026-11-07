# Privacy Policy: Salik • سالك

_Last updated: 7 November 2026_

This policy covers the Salik Chrome extension, the Salik Android / Android TV app, and the Salik Stremio addon. Salik is free and open source: https://github.com/techFek/salik

## Summary

Salik does **not** collect, sell or share personal data. There are no accounts, no analytics, no ads and no tracking.

## What stays on your device

These are stored with the browser's or the app's own storage (`chrome.storage`) and never sent to us:
- your filter settings: categories, sub-categories, YouTube options, and scenes you turned off
- a cached copy of the public scene library
- the length of the video you are watching, used only to show how many scenes it has

If you are signed in to Chrome with sync on, Chrome may sync your Salik settings between your own devices. That is Chrome's feature, handled by Google under its own privacy policy.

## What the extension reads on web pages

On the supported streaming sites only, Salik reads:
- the page address, to know which title is playing
- the video's current time, to mute, skip or blur at the right moment
- the subtitles shown on screen, to hide bad words

It does not read or store your viewing history, account details, messages, or anything on other websites.

## Network requests

Salik only downloads public data:

| Request | Purpose | What is sent |
|---|---|---|
| `raw.githubusercontent.com/techFek/salik` | The scene library and update notices | Nothing personal (a normal file download) |
| `sponsor.ajay.app` (SponsorBlock) | YouTube sponsor / reminder skip times | Only the first 4 characters of a hash of the YouTube video id, never the id itself |
| The streaming site itself (e.g. YouTube captions, Apple TV episode info) | Timing and captions for the video you opened | The same requests the site's own player makes |
| Poster images listed in the library | Catalog pictures | A normal image download |

These services may see your IP address, as with any web request. Their own privacy policies apply.

## Things you choose to do

- **Report a scene / send a suggestion** opens a GitHub page in your browser. What you write there is public on GitHub, and nothing is sent unless you submit it.
- **Donate** opens the donation page of the payment provider; Salik receives no payment details.
- **Android app, Stremio server address:** if you enter the address of your own Stremio server, it is stored on your device and used only to play from that server on your home network.
- **Android app, experimental "hide women / hide men":** video frames are analysed on the device itself and are never uploaded.

## Children

Salik is a family tool and does not knowingly collect data from anyone, including children.

## Changes

Changes to this policy are published in this file, and the history is visible on GitHub.

## Contact

Open an issue: https://github.com/techFek/salik/issues

---

<div dir="rtl">

# سياسة الخصوصية: سالك

_آخر تحديث: 7 نوفمبر 2026_

تشمل هذه السياسة إضافة سالك لمتصفح Chrome، وتطبيق سالك لأندرويد وأندرويد TV، وإضافة سالك لـ Stremio. سالك مجاني ومفتوح المصدر: https://github.com/techFek/salik

## باختصار

لا يجمع سالك أي بيانات شخصية، ولا يبيعها، ولا يشاركها. لا توجد حسابات ولا تحليلات ولا إعلانات ولا تتبّع.

## ما يبقى على جهازك

تُحفظ هذه البيانات في مساحة التخزين الخاصة بالمتصفح أو التطبيق، ولا تُرسل إلينا أبدًا:
- إعدادات التصفية: الفئات، والتصنيفات الفرعية، وخيارات يوتيوب، والمشاهد التي أوقفتها
- نسخة مؤقتة من مكتبة المشاهد العامة
- مدة الفيديو الذي تشاهده، لعرض عدد المشاهد فيه فقط

إذا كنت مسجّل الدخول في Chrome مع تفعيل المزامنة، فقد يزامن Chrome إعداداتك بين أجهزتك. هذه ميزة من Chrome تخضع لسياسة خصوصية جوجل.

## ما تقرؤه الإضافة من الصفحات

على مواقع البث المدعومة فقط، يقرأ سالك:
- عنوان الصفحة، لمعرفة العمل المعروض
- الوقت الحالي للفيديو، للكتم أو التخطي أو التمويه في اللحظة المناسبة
- الترجمة المعروضة، لإخفاء الألفاظ غير اللائقة

ولا يقرأ سجل المشاهدة، ولا بيانات الحساب، ولا الرسائل، ولا أي شيء في المواقع الأخرى، ولا يخزّن شيئًا من ذلك.

## طلبات الشبكة

لا يُنزّل سالك إلا بيانات عامة:
- **مكتبة المشاهد وإشعارات التحديث:** من GitHub، كأي تنزيل عادي لملف.
- **أوقات التخطي على يوتيوب:** من SponsorBlock، ولا يُرسل إلا أول 4 أحرف من بصمة معرّف الفيديو، وليس المعرّف نفسه.
- **الترجمة ومعلومات الحلقات:** من موقع البث نفسه، وهي الطلبات نفسها التي يرسلها مشغّل الموقع.
- **صور الملصقات:** المذكورة في المكتبة.

قد ترى هذه الخدمات عنوان IP الخاص بك، كما في أي طلب على الإنترنت، وتنطبق عليها سياسات الخصوصية الخاصة بها.

## ما تختار فعله بنفسك

- **الإبلاغ عن مشهد أو إرسال اقتراح:** يفتح صفحة على GitHub في متصفحك. ما تكتبه هناك يكون علنيًا، ولا يُرسل شيء إلا إذا أرسلته بنفسك.
- **التبرع:** يفتح صفحة مزوّد الدفع، ولا يتلقى سالك أي بيانات دفع.
- **عنوان خادم Stremio في تطبيق أندرويد:** يُحفظ على جهازك فقط، ويُستخدم للتشغيل من خادمك على شبكتك المنزلية.
- **ميزة حجب الظهور النسائي أو الرجالي التجريبية في تطبيق أندرويد:** تُحلَّل لقطات الفيديو على الجهاز نفسه، ولا تُرفع إلى أي مكان.

## الأطفال

سالك أداة عائلية، ولا يجمع بيانات من أحد عن قصد، بمن في ذلك الأطفال.

## التغييرات

تُنشر أي تغييرات على هذه السياسة في هذا الملف، ويظهر سجلّها على GitHub.

## التواصل

افتح Issue على: https://github.com/techFek/salik/issues

</div>
