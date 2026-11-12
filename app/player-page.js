/* Extension page: plays a local video file (or a direct link) with a library title's filters. */
import * as S from "./services.js";
import { LANG, initI18n, localizeLibrary } from "./i18n.js";
import { mountLocalPlayer } from "./local-player.js";

(async function () {
    await initI18n();
    document.documentElement.lang = LANG;
    document.documentElement.dir = LANG === "en" ? "ltr" : "rtl";
    const [library, settings, disabledStore] = await Promise.all([S.fetchLibrary(), S.getFilterSettings(), S.getDisabledFiltersStore()]);
    localizeLibrary(library);
    mountLocalPlayer(document.getElementById("root"), { library, settings, disabledStore, lang: LANG });
})();
