/*
 * Data sources Salik uses, shown on the "About" page of the extension and the app. Titles imported from another
 * project also carry their own attribution (library item "attribution"), which is listed next to these.
 */
(function (root) {
    "use strict";
    const CREDITS = [
        { source: "MovieContentFilter", url: "https://www.moviecontentfilter.com/", use: "scene timings (imported, reviewed before use)" },
        { source: "VideoSkip exchange", url: "https://videoskip.herokuapp.com/exchange", use: "scene timings (imported, reviewed before use)" },
        { source: "SponsorBlock", url: "https://sponsor.ajay.app/", use: "YouTube sponsor / reminder segments", license: "CC BY-NC-SA 4.0" },
        { source: "TMDB", url: "https://www.themoviedb.org/", use: "posters", license: "This product uses the TMDB API but is not endorsed or certified by TMDB." }
    ];

    /* Static credits + every distinct attribution found in the library. */
    function collectCredits(library) {
        const out = CREDITS.map((c) => Object.assign({}, c, { titles: 0 }));
        for (const item of Object.values(library || {})) {
            for (const a of (item && Array.isArray(item.attribution) ? item.attribution : [])) {
                if (!a || !a.source) continue;
                let c = out.find((x) => x.source === a.source);
                if (!c) { c = { source: a.source, url: a.url || "", use: "scene timings", titles: 0 }; out.push(c); }
                if (a.license && !c.license) c.license = a.license;
                c.titles++;
            }
        }
        return out;
    }

    const api = { CREDITS, collectCredits };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    root.SalikCredits = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
