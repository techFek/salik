
import { h, render, html, useState, useEffect, useRef } from "../vendor/preact-standalone.module.js";
import * as S from "./services.js";
import { LANG, setLang, initI18n, localizeLibrary } from "./i18n.js";

function TabsHeader({ activeTab, onChange }) {
    const items = [
        { key: "control", label: "🎛️ التحكم" },
        { key: "platforms", label: "🎬 المنصات" },
        { key: "account", label: "👤 الحساب" }
    ];
    return html`
        <div class="tabs-header">
            ${items.map(t => html`
                <button class=${"tab-btn" + (activeTab === t.key ? " active" : "")} onClick=${() => onChange(t.key)}>${t.label}</button>
            `)}
        </div>
    `;
}

function NowPlayingCard({ item }) {
    const [posterSrc, setPosterSrc] = useState(item && item.poster_url ? item.poster_url : "");

    useEffect(() => {
        if (item && item.poster_url) {
            let cancelled = false;
            S.compressImageToDataUrl(item.poster_url, 100, 140)
                .then((dataUrl) => { if (!cancelled) setPosterSrc(dataUrl); })
                .catch(() => { if (!cancelled) setPosterSrc(item.poster_url); });
            return () => { cancelled = true; };
        }
    }, [item && item.poster_url]);

    if (!item) return null;

    const genreValue = item.genre || item.category;
    const metaParts = [];
    if (genreValue) metaParts.push(genreValue);
    if (item.year) metaParts.push(item.year);

    return html`
        <div class="now-playing-card visible">
            ${item.poster_url ? html`<img class="now-playing-poster" src=${posterSrc} alt="" />` : null}
            <div class="now-playing-info">
                <div class="now-playing-title">${item.title || ""}</div>
                ${metaParts.length ? html`<div class="now-playing-meta">${metaParts.join(" • ")}</div>` : null}
                ${item.description ? html`<div class="now-playing-desc">${item.description}</div>` : null}
            </div>
        </div>
    `;
}

function SeverityPill({ count, durationMinutes }) {
    const level = S.getSeverityLevel(count, durationMinutes);
    const meta = S.SEVERITY_META[level];
    return html`
        <span style=${{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: meta.bg, color: meta.color, borderRadius: "999px",
            padding: "2px 9px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap"
        }}>
            <span style=${{ width: "7px", height: "7px", borderRadius: "50%", background: meta.color, display: "inline-block" }}></span>
            ${meta.label}
        </span>
    `;
}

function SubcategoryAccordion({ sub, items, durationMinutes, enabled, onToggle, itemKey, disabledMap, onToggleFilter, showToggle = true }) {
    const [open, setOpen] = useState(false);
    return html`
        <div class="card" style=${{ margin: "6px 10px", boxShadow: "none", border: "1px solid var(--border-color, #e2e8f0)" }}>
            <div class="card-header" onClick=${() => setOpen(!open)} style=${{ padding: "9px 12px" }}>
                <span style=${{ fontSize: "0.85rem" }}>${sub.label}</span>
                <span style=${{ display: "flex", alignItems: "center", gap: "8px" }}>
                    ${items.length > 0
                        ? html`<${SeverityPill} count=${items.length} durationMinutes=${durationMinutes} />`
                        : html`<span style=${{ color: "#94a3b8", fontSize: "0.72rem" }}>لا يوجد</span>`}
                    ${showToggle ? html`
                        <label class="toggle-container" onClick=${(e) => e.stopPropagation()}>
                            <input type="checkbox" class="toggle-input" checked=${enabled} onChange=${(e) => onToggle(e.target.checked)} />
                            <span class="toggle-slider"></span>
                        </label>
                    ` : null}
                </span>
            </div>
            <div class=${"dropdown-content" + (open ? " open" : "")} style=${open ? { maxHeight: "260px", overflowY: "auto" } : {}}>
                ${items.length === 0 ? html`<div class="description-item">لا يوجد مشاهد من هذا النوع حالياً ✅</div>` : items.map(it => html`
                    <div class="description-item" key=${it.id}>
                        <span>${it.original_description || "مشهد محجوب"}</span>
                        <label class="toggle-container" onClick=${(e) => e.stopPropagation()}>
                            <input type="checkbox" class="toggle-input" checked=${!disabledMap[it.id]}
                                onChange=${(e) => onToggleFilter(itemKey, it.id, e.target.checked)} />
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `)}
            </div>
        </div>
    `;
}

function FeatureToggleRow({ label, description, enabled, onToggle }) {
    return html`
        <div class="card" style=${{ margin: "6px 10px", boxShadow: "none", border: "1px solid var(--border-color, #e2e8f0)" }}>
            <div class="card-header" style=${{ padding: "9px 12px" }}>
                <span style=${{ fontSize: "0.85rem" }}>🔤 ${label}</span>
                <label class="toggle-container" onClick=${(e) => e.stopPropagation()}>
                    <input type="checkbox" class="toggle-input" checked=${enabled} onChange=${(e) => onToggle(e.target.checked)} />
                    <span class="toggle-slider"></span>
                </label>
            </div>
            ${description ? html`<p style=${{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0 12px 9px" }}>${description}</p>` : null}
        </div>
    `;
}

function CategoryCard({ catKey, groupData, groupSettings, onToggleGroup, onToggleSubcategory, itemKey, disabledMap, onToggleFilter, durationMinutes, subtitleCensorEnabled, onToggleSubtitleCensor, ytAutoMuteEnabled, onToggleYtAutoMute }) {
    const [open, setOpen] = useState(false);
    const items = groupData.items;
    const groupOn = groupSettings ? groupSettings.enabled !== false : true;
    const otherItems = groupData.otherItems || [];

    return html`
        <div class="card">
            <div class="card-header" onClick=${() => setOpen(!open)}>
                <span>${groupData.icon} ${groupData.label}</span>
                <label class="toggle-container" onClick=${(e) => e.stopPropagation()}>
                    <input type="checkbox" class="toggle-input" checked=${groupOn} onChange=${(e) => onToggleGroup(catKey, e.target.checked)} />
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="category-count visible" style=${{ display: "flex", alignItems: "center", gap: "8px" }}>
                ${items.length > 0
                    ? html`<${SeverityPill} count=${items.length} durationMinutes=${durationMinutes} />`
                    : html`<span style=${{ color: "#94a3b8" }}>${groupData.noneLabel} ✅</span>`}
            </div>
            <div class=${"dropdown-content" + (open ? " open" : "")} style=${open ? { maxHeight: "460px", overflowY: "auto" } : {}}>
                ${catKey === "language" ? html`
                    <${FeatureToggleRow} label="تشفير الترجمة النصية"
                        description="يستبدل الألفاظ الممنوعة في نص الترجمة المعروض على الشاشة بالرموز *&^"
                        enabled=${subtitleCensorEnabled} onToggle=${onToggleSubtitleCensor} />
                    <${FeatureToggleRow} label="كتم الألفاظ التلقائي على يوتيوب"
                        description="يكتم الصوت لحظة نطق اللفظ الخارج في فيديوهات يوتيوب اعتماداً على ترجمتها"
                        enabled=${ytAutoMuteEnabled} onToggle=${onToggleYtAutoMute} />
                ` : null}
                ${groupData.subcategories.map((sub) => html`
                    <${SubcategoryAccordion} key=${sub.key} sub=${sub}
                        items=${groupData.bySub[sub.key] || []}
                        durationMinutes=${durationMinutes}
                        enabled=${groupSettings ? groupSettings.subs[sub.key] !== false : true}
                        onToggle=${(enabled) => onToggleSubcategory(catKey, sub.key, enabled)}
                        itemKey=${itemKey} disabledMap=${disabledMap} onToggleFilter=${onToggleFilter} />
                `)}
                ${otherItems.length > 0 ? html`
                    <${SubcategoryAccordion} key="other" sub=${{ key: "other", label: "مشاهد أخرى غير مصنّفة" }}
                        items=${otherItems} durationMinutes=${durationMinutes}
                        showToggle=${false}
                        itemKey=${itemKey} disabledMap=${disabledMap} onToggleFilter=${onToggleFilter} />
                ` : null}
            </div>
        </div>
    `;
}

function ControlTab({ currentItemDisplay, categorizedDetailed, filterSettings, onToggleGroup, onToggleSubcategory, itemKey, disabledMap, onToggleFilter, ratingTitle, durationMinutes, subtitleCensorEnabled, onToggleSubtitleCensor, ytAutoMuteEnabled, onToggleYtAutoMute }) {
    const groupKeys = ["nudity", "violence", "language", "substance"];
    return html`
        <div id="section-control" class="tab-content active">
            <${NowPlayingCard} item=${currentItemDisplay} />
            ${groupKeys.map(k => html`
                <${CategoryCard} key=${k} catKey=${k} groupData=${categorizedDetailed[k]}
                    groupSettings=${filterSettings[k]} onToggleGroup=${onToggleGroup} onToggleSubcategory=${onToggleSubcategory}
                    itemKey=${itemKey} disabledMap=${disabledMap} onToggleFilter=${onToggleFilter} durationMinutes=${durationMinutes}
                    subtitleCensorEnabled=${subtitleCensorEnabled} onToggleSubtitleCensor=${onToggleSubtitleCensor}
                    ytAutoMuteEnabled=${ytAutoMuteEnabled} onToggleYtAutoMute=${onToggleYtAutoMute} />
            `)}
            <div class="rating-box">
                <strong>${ratingTitle}</strong>
            </div>
        </div>
    `;
}

function MovieCard({ id, item }) {
    const platformsObj = item.platforms || {};
    let urlMapping = {};
    let platforms = [];

    S.SUPPORTED_PLATFORMS.forEach(p => {
        if (S.isPlatformHidden(item, p)) return;
        const url = S.getUrlForPlatform(item, p);
        if (url) { urlMapping[p] = url; platforms.push(p); }
    });
    Object.keys(platformsObj).forEach(p => {
        if (!urlMapping[p] && !S.isPlatformHidden(item, p) && platformsObj[p] && platformsObj[p].url) {
            urlMapping[p] = platformsObj[p].url;
            platforms.push(p);
        }
    });

    if (platforms.length === 0) return null;

    return html`
        <div class="movie-card-link" data-card-platforms=${platforms.join(",")} data-item-id=${id}>
            <div style=${{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
                <img src=${item.poster_url || "icons/default-poster.png"} class="movie-poster" style=${{ height: "140px", objectFit: "cover" }} />
                <div class="movie-details">
                    <span class="movie-name">${item.title || id}${item.year ? html` <span class="movie-year">(${item.year})</span>` : null}</span>
                    <div style=${{ textAlign: "center", marginTop: "5px" }}>
                        ${platforms.map(p => html`
                            <a key=${p} href=${urlMapping[p] || "#"} target="_blank" class="platform-btn"
                                style=${{ display: "inline-block", padding: "4px 8px", margin: "2px", background: "#e2e8f0", borderRadius: "4px", color: "#334155", textDecoration: "none", fontSize: "10px", fontWeight: "bold" }}>
                                ${S.getPlatformLabel(p)}
                            </a>
                        `)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

const PLATFORM_CHIPS = [
    { key: "all", label: "الكل" }, { key: "netflix", label: "Netflix" }, { key: "amazon", label: "Prime Video" },
    { key: "yango", label: "Yango Play" }, { key: "osnplus", label: "OSN+" }, { key: "disney", label: "Disney+" },
    { key: "shahid", label: "MBC Shahid" }, { key: "appletv", label: "Apple TV" }, { key: "watchit", label: "Watch It" },
    { key: "starzplay", label: "Starzplay" }, { key: "youtube", label: "YouTube" }, { key: "jawwy", label: "Jawwy TV" },
    { key: "stctv", label: "STC tv" }, { key: "dailymotion", label: "Dailymotion" }, { key: "tod", label: "Tod" },
    { key: "beinconnect", label: "beIN Connect" }
];

function PlatformsTab({ library, activePlatformFilter, onPlatformChange, searchQuery, onSearchChange }) {
    const browsable = Object.entries(library || {}).filter(([, item]) => item && typeof item === "object" && (item.type === "movie" || item.type === "series"));
    browsable.sort(([, a], [, b]) => (b.addedAt || 0) - (a.addedAt || 0));

    const q = (searchQuery || "").toLowerCase().trim();
    let selected = (activePlatformFilter || "all").toLowerCase().trim();
    if (selected === "prime video") selected = "amazon";
    if (selected === "mbc shahid") selected = "shahid";

    const filtered = browsable.filter(([, item]) => {
        const title = (item.title || "").toLowerCase();
        if (!title.includes(q)) return false;
        if (selected === "all") return true;
        const platformsObj = item.platforms || {};
        const platformKeys = new Set([...S.SUPPORTED_PLATFORMS.filter(p => S.getUrlForPlatform(item, p)), ...Object.keys(platformsObj)].filter(p => !S.isPlatformHidden(item, p)));
        return platformKeys.has(selected);
    });

    return html`
        <div id="section-platforms" class="tab-content active">
            <div class="search-container">
                <input type="text" id="searchBar" placeholder="🔍 ابحث عن فيلم أو مسلسل مدعوم..." value=${searchQuery}
                    onInput=${(e) => onSearchChange(e.target.value)} />
            </div>
            <div class="platforms-tabs">
                ${PLATFORM_CHIPS.map(c => html`
                    <button key=${c.key} class=${"platform-chip" + (selected === c.key ? " active" : "")} onClick=${() => onPlatformChange(c.key)}>${c.label}</button>
                `)}
            </div>
            <h3 style=${{ fontSize: "0.9rem", margin: "12px 4px 4px 4px", color: "#475569" }}>🎬 الأعمال المدعومة والمفلترة هنا:</h3>
            <div id="available-movies-list">
                ${filtered.length === 0
                    ? html`<div style=${{ textAlign: "center", color: "#94a3b8", padding: "20px", gridColumn: "span 2" }}>لا توجد أعمال مدعومة مضافة حالياً.</div>`
                    : filtered.map(([id, item]) => html`<${MovieCard} key=${id} id=${id} item=${item} />`)}
            </div>
        </div>
    `;
}

function salikOpenIssue(title, body, label) {
    const base = (typeof SALIK_CONFIG !== "undefined" && SALIK_CONFIG.ISSUES_URL) || "https://github.com";
    const url = `${base}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(label || "")}`;
    chrome.tabs.create({ url });
}

function SceneReportForm({ defaultTitle }) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(defaultTitle || "");
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState({ msg: "", color: "" });
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (defaultTitle) setTitle(defaultTitle); }, [defaultTitle]);

    async function submit() {
        const workTitle = title.trim();
        const msg = message.trim();
        if (!workTitle || !msg) {
            setStatus({ msg: "من فضلك اكتب اسم العمل ووصف المشكلة.", color: "var(--danger)" });
            return;
        }
        setBusy(true);
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const platform = (tabs[0] && tabs[0].url) ? new URL(tabs[0].url).hostname : "";
            salikOpenIssue(`[بلاغ مشهد] ${workTitle}`, `**العمل:** ${workTitle}\n**المنصة:** ${platform}\n\n**المشكلة:**\n${msg}`, "scene-report");
            setStatus({ msg: "تم فتح صفحة البلاغ على GitHub، اضغط Submit لإرساله. شكراً لك.", color: "var(--success)" });
            setMessage("");
        } catch (err) {
            console.error(err);
            setStatus({ msg: "حدث خطأ أثناء الإرسال، حاول مرة أخرى.", color: "var(--danger)" });
        } finally {
            setBusy(false);
        }
    }

    return html`
        <div class="card" style=${{ marginTop: "16px" }}>
            <div class="card-header" onClick=${() => setOpen(!open)}>
                <span>🎬 مراجعة مشهد لم يُحجب</span><span>▾</span>
            </div>
            <div class=${"dropdown-content" + (open ? " open" : "")} style=${open ? { maxHeight: "300px" } : {}}>
                <div style=${{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <p style=${{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0 0 4px 0" }}>شاهدت مشهداً كان ينبغي حجبه ولم يُحجب؟ بلّغنا عنه وسيراجعه الفريق.</p>
                    <input type="text" placeholder="اسم العمل (فيلم/مسلسل)" value=${title} onInput=${(e) => setTitle(e.target.value)}
                        style=${{ padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "0.83rem" }} />
                    <textarea placeholder="اكتب المشكلة، مثال: مشهد عري في الدقيقة 12:30" rows="3" value=${message} onInput=${(e) => setMessage(e.target.value)}
                        style=${{ padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "0.83rem", resize: "vertical", fontFamily: "inherit" }}></textarea>
                    <button disabled=${busy} onClick=${submit} style=${{ padding: "9px", border: "none", borderRadius: "6px", background: "var(--danger)", color: "#fff", fontWeight: 600, fontSize: "0.83rem", cursor: "pointer" }}>إرسال البلاغ</button>
                    <div style=${{ fontSize: "0.78rem", textAlign: "center", minHeight: "16px", color: status.color }}>${status.msg}</div>
                </div>
            </div>
        </div>
    `;
}

const NAZAFA_PLATFORM_LABELS = {
    netflix: "Netflix", amazon: "Prime Video", osnplus: "OSN+", yango: "Yango Play", disney: "Disney+",
    shahid: "MBC Shahid", appletv: "Apple TV+", watchit: "Watch It", tod: "Tod", starzplay: "Starzplay",
    jawwy: "Jawwy TV", stctv: "STC tv", beinconnect: "beIN Connect", stremio: "Stremio"
};

const ICON_FILM_SEARCH = html`<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="14" rx="2.5"/><path d="M7 4v14M13 4v14M3 9h4M3 13h4M13 9h4M13 13h4"/><circle cx="18" cy="18" r="3"/><path d="M20.2 20.2L22 22"/></svg>`;
const ICON_SPARKLE = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zM19 14l.9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z"/></svg>`;
const ICON_CHECK = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const ICON_X = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const ICON_CLAPPER = html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/><path d="M4 9l2.5-5 3 1.2L7 10M10 9l2.5-5 3 1.2L13 10M16 9l2.5-5L21 5.2 19 10"/></svg>`;
const ICON_HEART_CHECK = html`<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.8c0 5.4-7.5 10-7.5 10z"/><path d="M9 11.5l2.2 2.2L15.2 9.7"/></svg>`;

function UnlistedWorkPrompt({ work, onFinish }) {
    const [phase, setPhase] = useState(work.already ? "done-before" : "ask");
    if (phase === "hidden") return null;

    const wrap = {
        margin: "10px 12px 4px", padding: "14px", borderRadius: "14px", direction: "rtl",
        background: "linear-gradient(135deg, #f5f3ff 0%, #eef2ff 55%, #ecfeff 100%)",
        border: "1px solid #e0e7ff", boxShadow: "0 4px 14px rgba(79,70,229,0.10)"
    };
    const iconCircle = (bg, fg) => ({
        width: "46px", height: "46px", borderRadius: "14px", flex: "0 0 46px", display: "flex",
        alignItems: "center", justifyContent: "center", background: bg, color: fg
    });
    const platformLabel = NAZAFA_PLATFORM_LABELS[work.platform] || work.platform;

    async function submit() {
        setPhase("sending");
        try {
            const wt = work.title || `(${platformLabel}) ${work.movieId}`;
            salikOpenIssue(`[اقتراح عمل] ${wt}`, `**العمل:** ${wt}\n**المنصة:** ${platformLabel}\n**الرابط:** ${work.url || "-"}\n**المعرّف:** ${work.movieId}`, "suggestion");
            await S.markWorkSuggested(work.platform, work.movieId);
            setPhase("done");
            if (onFinish) setTimeout(onFinish, 1800);
        } catch (e) {
            console.error(e);
            setPhase("error");
        }
    }

    if (phase === "done" || phase === "done-before") {
        return html`
            <div style=${wrap}>
                <div style=${{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style=${iconCircle("#dcfce7", "#16a34a")}>${ICON_HEART_CHECK}</div>
                    <div>
                        <div style=${{ fontWeight: 800, fontSize: "0.9rem", color: "#14532d" }}>
                            ${phase === "done" ? "وصلنا اقتراحك، شكراً لك!" : "سبق أن اقترحت هذا العمل"}
                        </div>
                        <div style=${{ fontSize: "0.76rem", color: "#4b5563", marginTop: "3px" }}>
                            ${phase === "done" ? "سنراجعه وسيُضاف إلى المكتبة قريباً." : "اقتراحك لدى فريق المراجعة بالفعل."}
                        </div>
                    </div>
                </div>
            </div>`;
    }

    return html`
        <div style=${wrap}>
            <div style=${{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style=${iconCircle("linear-gradient(135deg,#6366f1,#8b5cf6)", "#fff")}>${ICON_FILM_SEARCH}</div>
                <div style=${{ minWidth: 0 }}>
                    <div style=${{ fontWeight: 800, fontSize: "0.92rem", color: "#312e81" }}>هذا العمل غير موجود في القائمة بعد</div>
                    <div style=${{ display: "inline-flex", alignItems: "center", gap: "5px", marginTop: "5px", maxWidth: "100%",
                        padding: "3px 9px", borderRadius: "999px", background: "#fff", border: "1px solid #e0e7ff", color: "#4338ca", fontSize: "0.74rem", fontWeight: 600 }}>
                        ${ICON_CLAPPER}
                        <span style=${{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "190px" }}>${work.title || platformLabel}</span>
                    </div>
                </div>
            </div>
            <div style=${{ display: "flex", alignItems: "center", gap: "6px", margin: "12px 2px 9px", fontSize: "0.84rem", fontWeight: 700, color: "#1e1b4b" }}>
                <span style=${{ color: "#f59e0b", display: "inline-flex" }}>${ICON_SPARKLE}</span>
                هل تقترح إضافته؟
            </div>
            <div style=${{ display: "flex", gap: "8px" }}>
                <button disabled=${phase === "sending"} onClick=${submit}
                    style=${{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", border: "none", borderRadius: "10px",
                        background: "linear-gradient(135deg,#16a34a,#22c55e)", color: "#fff", fontWeight: 700, fontSize: "0.84rem", cursor: "pointer", boxShadow: "0 3px 8px rgba(34,197,94,0.35)" }}>
                    ${ICON_CHECK} ${phase === "sending" ? "جارٍ الإرسال..." : "نعم، اقترحه"}
                </button>
                <button disabled=${phase === "sending"} onClick=${() => { setPhase("hidden"); if (onFinish) onFinish(); }}
                    style=${{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", borderRadius: "10px",
                        background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", fontWeight: 700, fontSize: "0.84rem", cursor: "pointer" }}>
                    ${ICON_X} لا
                </button>
            </div>
            ${phase === "error" ? html`<div style=${{ marginTop: "9px", fontSize: "0.76rem", color: "#b91c1c", textAlign: "center" }}>حدث خطأ أثناء الإرسال، حاول مرة أخرى.</div>` : null}
        </div>`;
}

const ICON_INFO = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>`;
const ICON_REFRESH = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>`;

function UpdateBanner() {
    const [items, setItems] = useState([]);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState("");

    async function load() {
        const st = await S.getBannerState();
        const list = [];
        const dismissed = st.dismissed || {};
        const s = st.status;
        if (s && s.notice && !dismissed["notice:" + s.notice.id]) {
            list.push({ key: "notice:" + s.notice.id, kind: s.notice.level === "warn" ? "warn" : "info", text: s.notice.text });
        }
        if (s && s.minVersion && S.compareVersions(st.current, s.minVersion) < 0) {
            list.push({ key: "min:" + s.minVersion, kind: "warn", update: true, noDismiss: true, text: `إصدارك (${st.current}) قديم وقد لا يعمل بشكل صحيح. يُنصح بالتحديث الآن.` });
        } else if (s && s.latest && S.compareVersions(st.current, s.latest) < 0 && !dismissed["latest:" + s.latest]) {
            list.push({ key: "latest:" + s.latest, kind: "info", update: true, text: `يتوفر إصدار أحدث من سالك (${s.latest}).` });
        }
        const ju = st.justUpdated;
        if (ju && !dismissed["updated:" + ju.to]) {
            list.push({ key: "updated:" + ju.to, kind: "info", text: `تم تحديث سالك إلى الإصدار ${ju.to}. إن كانت صفحة منصة مفتوحة، حدّثها (F5) ليعمل التحديث عليها.` });
        }
        setItems(list.slice(0, 2));
    }
    useEffect(() => { load(); }, []);

    async function close(key) { await S.dismissBanner(key); load(); }
    async function updateNow() {
        setBusy(true); setNote("");
        const status = await S.requestExtensionUpdate();
        setBusy(false);
        if (status === "no_update") setNote("لا يوجد تحديث متاح لك حالياً، سيصلك تلقائياً قريباً.");
        else if (status === "throttled") setNote("حاول مرة أخرى بعد قليل.");
        else if (status === "error") setNote("تعذر التحقق الآن، حاول لاحقاً.");
    }

    if (!items.length) return null;
    return html`<div style=${{ padding: "8px 12px 0", display: "flex", flexDirection: "column", gap: "6px", direction: "rtl" }}>
        ${items.map((it) => {
            const warn = it.kind === "warn";
            return html`<div key=${it.key} style=${{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "9px 10px", borderRadius: "10px", fontSize: "0.78rem", lineHeight: 1.5,
                background: warn ? "#fffbeb" : "#eff6ff", border: "1px solid " + (warn ? "#fde68a" : "#bfdbfe"), color: warn ? "#92400e" : "#1e3a8a" }}>
                <span style=${{ display: "inline-flex", marginTop: "2px", flex: "0 0 auto" }}>${it.update ? ICON_REFRESH : ICON_INFO}</span>
                <div style=${{ flex: 1 }}>
                    <div>${it.text}</div>
                    ${it.update ? html`<button disabled=${busy} onClick=${updateNow} style=${{ marginTop: "6px", padding: "4px 12px", border: "none", borderRadius: "8px", cursor: "pointer",
                        background: warn ? "#d97706" : "#2563eb", color: "#fff", fontWeight: 700, fontSize: "0.76rem" }}>${busy ? "جارٍ الفحص..." : "حدّث الآن"}</button>` : null}
                    ${it.update && note ? html`<div style=${{ marginTop: "4px", fontSize: "0.72rem", opacity: 0.85 }}>${note}</div>` : null}
                </div>
                ${it.noDismiss ? null : html`<button onClick=${() => close(it.key)} aria-label="إغلاق" style=${{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", fontSize: "1rem", lineHeight: 1, padding: "0 2px", opacity: 0.7 }}>×</button>`}
            </div>`;
        })}
    </div>`;
}

function ContentSuggestionForm() {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [platform, setPlatform] = useState("");
    const [notes, setNotes] = useState("");
    const [status, setStatus] = useState({ msg: "", color: "" });
    const [busy, setBusy] = useState(false);

    const platformOptions = [
        ["", "المنصة (اختياري)"], ["netflix", "Netflix"], ["amazon", "Prime Video"], ["yango", "Yango Play"],
        ["osnplus", "OSN+"], ["disney", "Disney+"], ["shahid", "MBC Shahid"], ["appletv", "Apple TV"],
        ["watchit", "Watch It"], ["tod", "Tod"], ["starzplay", "Starzplay"], ["youtube", "YouTube"],
        ["jawwy", "Jawwy TV"], ["stctv", "STC tv"], ["other", "منصة أخرى"]
    ];

    async function submit() {
        const workTitle = title.trim();
        if (!workTitle) {
            setStatus({ msg: "من فضلك اكتب اسم العمل المقترح.", color: "var(--danger)" });
            return;
        }
        setBusy(true);
        try {
            salikOpenIssue(`[اقتراح عمل] ${workTitle}`, `**العمل:** ${workTitle}\n**المنصة:** ${platform || "-"}\n\n**ملاحظات:**\n${notes.trim()}`, "suggestion");
            setStatus({ msg: "تم فتح صفحة الاقتراح على GitHub، اضغط Submit لإرساله. شكراً لك.", color: "var(--success)" });
            setTitle(""); setPlatform(""); setNotes("");
        } catch (err) {
            console.error(err);
            setStatus({ msg: "حدث خطأ أثناء الإرسال، حاول مرة أخرى.", color: "var(--danger)" });
        } finally {
            setBusy(false);
        }
    }

    return html`
        <div class="card" style=${{ marginTop: "10px" }}>
            <div class="card-header" onClick=${() => setOpen(!open)}>
                <span>➕ اقتراح فيلم أو مسلسل جديد للفلترة</span><span>▾</span>
            </div>
            <div class=${"dropdown-content" + (open ? " open" : "")} style=${open ? { maxHeight: "300px" } : {}}>
                <div style=${{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <p style=${{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0 0 4px 0" }}>لم تجد عملاً معيناً في المكتبة؟ اقترحه علينا وسنضيفه إلى قائمة المراجعة.</p>
                    <input type="text" placeholder="اسم العمل (فيلم/مسلسل)" value=${title} onInput=${(e) => setTitle(e.target.value)}
                        style=${{ padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "0.83rem" }} />
                    <select value=${platform} onChange=${(e) => setPlatform(e.target.value)}
                        style=${{ padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "0.83rem", background: "#fff" }}>
                        ${platformOptions.map(([v, l]) => html`<option key=${v} value=${v}>${l}</option>`)}
                    </select>
                    <textarea placeholder="ملاحظات إضافية (اختياري) — مثال: رابط العمل أو سبب الاقتراح" rows="2" value=${notes} onInput=${(e) => setNotes(e.target.value)}
                        style=${{ padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "0.83rem", resize: "vertical", fontFamily: "inherit" }}></textarea>
                    <button disabled=${busy} onClick=${submit} style=${{ padding: "9px", border: "none", borderRadius: "6px", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: "0.83rem", cursor: "pointer" }}>إرسال الاقتراح</button>
                    <div style=${{ fontSize: "0.78rem", textAlign: "center", minHeight: "16px", color: status.color }}>${status.msg}</div>
                </div>
            </div>
        </div>
    `;
}

function AccountTab({ ratingTitle }) {
    const C = (typeof SALIK_CONFIG !== "undefined") ? SALIK_CONFIG : {};
    const open = (u) => chrome.tabs.create({ url: u });
    const btn = { width: "100%", marginTop: "8px", padding: "10px", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" };

    return html`
        <div id="section-account" class="tab-content active">
            <div class="card" style=${{ padding: "14px 12px", textAlign: "center" }}>
                <p style=${{ fontSize: "0.85rem", fontWeight: 700, margin: "0 0 4px" }}>🤍 سالك مجاني ومفتوح المصدر</p>
                <p style=${{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>إن نفعك فادعُ لنا، وإن شئت فساهم في استمراره.</p>
                <button style=${{ ...btn, background: "#FFDD00", color: "#000" }} onClick=${(e) => {
                    open((LANG === "en" && C.DONATE_URL_EN) ? C.DONATE_URL_EN : C.DONATE_URL_AR);
                }}>☕ صبّح علينا بجنيه</button>
                <button style=${{ ...btn, background: "#f1f5f9", color: "var(--text-dark)" }} onClick=${() => setLang(LANG === "en" ? "ar" : "en")}>${LANG === "en" ? "العربية" : "English"}</button>
                <button style=${{ ...btn, background: "#fff", color: "var(--primary)", border: "1px solid var(--primary)" }} onClick=${() => open(C.GITHUB_URL)}>الشيفرة المصدرية على GitHub</button>
            </div>

            <${SceneReportForm} defaultTitle=${ratingTitle !== "منصة تصفح" ? ratingTitle : ""} />
            <${ContentSuggestionForm} />

            <div class="card" style=${{ marginTop: "10px" }}>
                <div style=${{ padding: "14px 12px 6px", textAlign: "center" }}>
                    <p style=${{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-dark)", margin: "0 0 10px" }}>📱 حمّل سالك على أجهزتك الأخرى</p>
                </div>
                <div style=${{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style=${{ display: "flex", alignItems: "center", gap: "10px", background: "#000", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", userSelect: "none" }} onClick=${() => open(C.GITHUB_URL)}>
                        <svg width="24" height="24" viewBox="0 0 16 16" style=${{ flexShrink: 0 }}><path fill="#fff" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                        <span style=${{ color: "#fff", textAlign: "right", lineHeight: 1.25 }}>
                            <span style=${{ display: "block", fontSize: "0.62rem", color: "#ccc" }}>حمّله من</span>
                            <span style=${{ display: "block", fontSize: "1rem", fontWeight: 600, fontFamily: "'Segoe UI',sans-serif" }}>GitHub</span>
                        </span>
                    </div>
                    <div style=${{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "var(--primary)", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", userSelect: "none" }} onClick=${() => open(C.GITHUB_URL)}>
                        <span style=${{ fontSize: "1.1rem" }}>📺</span>
                        <span style=${{ color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>حمّل نسخة أندرويد تي في من GitHub</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function App() {
    const [gateState, setGateState] = useState("loading");
    const [activeTab, setActiveTab] = useState("control");
    const [library, setLibrary] = useState({});
    const [currentItem, setCurrentItem] = useState(null);
    const [currentFilters, setCurrentFilters] = useState([]);
    const [disabledMap, setDisabledMap] = useState({});
    const [filterSettings, setFilterSettings] = useState(null);
    const [durationMinutes, setDurationMinutes] = useState(null);
    const [subtitleCensorEnabled, setSubtitleCensorEnabled] = useState(true);
    const [ytAutoMuteEnabled, setYtAutoMuteEnabledState] = useState(true);
    const [activePlatformFilter, setActivePlatformFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [connectionStatus, setConnectionStatus] = useState("جاري الفحص والربط مع قاعدة البيانات...");
    const [unlistedWork, setUnlistedWork] = useState(null);
    const [promptDone, setPromptDone] = useState(false);
    const initializedRef = useRef(false);

    async function checkGate() {
        setGateState("ok");
        return true;
    }

    async function loadCurrentItemFilters(key, item) {
        const filters = item.filters ? Object.values(item.filters) : [];
        setCurrentFilters(filters);
        const dm = await S.getDisabledFiltersMap(key);
        setDisabledMap(dm);
    }

    async function bootstrapApp() {
        try { chrome.storage.local.get(["nazafaPopupOpens"], (r) => chrome.storage.local.set({ nazafaPopupOpens: (r.nazafaPopupOpens || 0) + 1 })); } catch (e) {}
        setConnectionStatus("جاري الفحص والربط مع قاعدة البيانات...");
        const tabInfo = await S.getCurrentTabInfo();
        if (tabInfo.platform !== "unknown") {
            setActivePlatformFilter(tabInfo.platform);
        }

        try {
            const lib = localizeLibrary(await S.fetchLibrary());
            setLibrary(lib);

            let hasActiveItem = false;
            const storageData = await new Promise(resolve => chrome.storage.local.get(['currentMovieId'], resolve));

            if (storageData.currentMovieId && lib[storageData.currentMovieId]) {
                hasActiveItem = true;
                const item = lib[storageData.currentMovieId];
                setCurrentItem({ key: storageData.currentMovieId, item });
                await loadCurrentItemFilters(storageData.currentMovieId, item);
            } else if (tabInfo.movieId && tabInfo.platform !== "unknown") {
                const found = S.findMovieByPlatformId(lib, tabInfo.platform, tabInfo.movieId);
                if (found) {
                    hasActiveItem = true;
                    setCurrentItem(found);
                    await loadCurrentItemFilters(found.key, found.item);
                    setConnectionStatus("");
                } else if (tabInfo.platform !== "youtube" && tabInfo.platform !== "dailymotion") {
                    const meta = await S.getActiveTabMeta();
                    const already = await S.isWorkSuggested(tabInfo.platform, tabInfo.movieId);
                    setUnlistedWork({ platform: tabInfo.platform, movieId: tabInfo.movieId, title: S.cleanWorkTitle(meta.title), url: meta.url, already });
                    setConnectionStatus("");
                } else {
                    setConnectionStatus("لم يتم العثور على فلاتر لهذا العمل");
                }
            } else {
                setConnectionStatus("لا يوجد عمل نشط حالياً");
            }

            setActiveTab(hasActiveItem ? "control" : "platforms");

        } catch (e) {
            console.error("Salik bootstrap error:", e);
            setConnectionStatus("تعذر تحميل البيانات، حاول مرة أخرى");
            setActiveTab("platforms");
        }

        const settings = await S.getFilterSettings();
        setFilterSettings(settings);

        const dur = await S.getStoredVideoDurationMinutes();
        setDurationMinutes(dur);

        const subtitleCensor = await S.getSubtitleCensorEnabled();
        setSubtitleCensorEnabled(subtitleCensor);
        setYtAutoMuteEnabledState(await S.getYtAutoMuteEnabled());
    }

    useEffect(() => {
        (async () => {
            const ok = await checkGate();
            if (ok && !initializedRef.current) {
                initializedRef.current = true;
                await bootstrapApp();
            }
        })();
    }, []);

    async function handleToggleFilter(itemKey, filterId, enabled) {
        await S.setFilterEnabled(itemKey, filterId, enabled);
        setDisabledMap(prev => {
            const next = { ...prev };
            if (enabled) delete next[filterId]; else next[filterId] = true;
            return next;
        });
    }

    async function handleToggleGroup(catKey, isEnabled) {
        const updated = await S.setGroupEnabled(catKey, isEnabled);
        setFilterSettings({ ...updated });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: "UPDATE_FILTER_SETTINGS", category: catKey, enabled: isEnabled });
            }
        });

        if (!isEnabled && currentItem) {
            const categorized = S.categorizeFiltersDetailed(currentFilters);
            const catItems = categorized[catKey].items;
            for (const it of catItems) {
                if (!S.belongsOnlyTo(it, catKey)) continue;
                await S.setFilterEnabled(currentItem.key, it.id, false);
            }
            const dm = await S.getDisabledFiltersMap(currentItem.key);
            setDisabledMap(dm);
        }
    }

    async function handleToggleSubcategory(catKey, subKey, isEnabled) {
        const updated = await S.setSubcategoryEnabled(catKey, subKey, isEnabled);
        setFilterSettings({ ...updated });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: "UPDATE_SUBCATEGORY_SETTINGS", category: catKey, subKey, enabled: isEnabled });
            }
        });

        if (!isEnabled && currentItem) {
            const detailed = S.categorizeFiltersDetailed(currentFilters);
            const subItems = detailed[catKey].bySub[subKey] || [];
            for (const it of subItems) {
                if (!S.belongsOnlyTo(it, catKey, subKey)) continue;
                await S.setFilterEnabled(currentItem.key, it.id, false);
            }
            const dm = await S.getDisabledFiltersMap(currentItem.key);
            setDisabledMap(dm);
        }
    }

    async function handleToggleYtAutoMute(enabled) {
        setYtAutoMuteEnabledState(enabled);
        await S.setYtAutoMuteEnabled(enabled);
    }

    async function handleToggleSubtitleCensor(enabled) {
        setSubtitleCensorEnabled(enabled);
        await S.setSubtitleCensorEnabled(enabled);
    }

    function handleTabChange(key) {
        setActiveTab(key);
    }

    if (gateState === "loading" || (gateState === "ok" && !filterSettings)) {
        return html`<div style=${{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>جاري التحميل...</div>`;
    }
    const categorizedDetailed = S.categorizeFiltersDetailed(currentFilters);
    const currentItemDisplay = currentItem ? S.resolveDisplayItem(currentItem.item, library) : null;
    const ratingTitle = currentItem ? (currentItem.item.title || "") : "منصة تصفح";

    if (unlistedWork && !unlistedWork.already && !promptDone) {
        return html`
            <div id="main-app">
                <div class="app-titlebar">
                    <img src="images/icon128.png" alt="Salik" class="app-titlebar-logo" onError=${(e) => { e.target.style.display = "none"; }} />
                    <span class="app-titlebar-text">سالك - Salik</span>
                </div>
                <div style=${{ padding: "18px 4px 22px" }}>
                    <${UnlistedWorkPrompt} work=${unlistedWork} onFinish=${() => setPromptDone(true)} />
                </div>
            </div>
        `;
    }

    return html`
        <div id="main-app">
            <div class="app-titlebar">
                <img src="images/icon128.png" alt="Salik" class="app-titlebar-logo" onError=${(e) => { e.target.style.display = "none"; }} />
                <span class="app-titlebar-text">سالك - Salik</span>
            </div>
            <${UpdateBanner} />
            ${connectionStatus ? html`<div class="info-bar">${connectionStatus}</div>` : null}
            ${unlistedWork && unlistedWork.already ? html`<${UnlistedWorkPrompt} work=${unlistedWork} />` : null}
            <${TabsHeader} activeTab=${activeTab} onChange=${handleTabChange} />
            ${activeTab === "control" ? html`
                <${ControlTab} currentItemDisplay=${currentItemDisplay} categorizedDetailed=${categorizedDetailed}
                    filterSettings=${filterSettings} onToggleGroup=${handleToggleGroup} onToggleSubcategory=${handleToggleSubcategory}
                    itemKey=${currentItem ? currentItem.key : null} disabledMap=${disabledMap}
                    onToggleFilter=${handleToggleFilter} ratingTitle=${ratingTitle} durationMinutes=${durationMinutes}
                    subtitleCensorEnabled=${subtitleCensorEnabled} onToggleSubtitleCensor=${handleToggleSubtitleCensor}
                    ytAutoMuteEnabled=${ytAutoMuteEnabled} onToggleYtAutoMute=${handleToggleYtAutoMute} />
            ` : null}
            ${activeTab === "platforms" ? html`
                <${PlatformsTab} library=${library} activePlatformFilter=${activePlatformFilter}
                    onPlatformChange=${(p) => { setSearchQuery(""); setActivePlatformFilter(p); }}
                    searchQuery=${searchQuery} onSearchChange=${(v) => { setSearchQuery(v); if (v) setActivePlatformFilter("all"); }} />
            ` : null}
            ${activeTab === "account" ? html`
                <${AccountTab} ratingTitle=${ratingTitle} />
            ` : null}
        </div>
    `;
}

initI18n();
render(html`<${App} />`, document.getElementById("app-root"));
