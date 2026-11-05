"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const ANDROID_ASSETS = path.join(ROOT, "android", "app", "src", "main", "assets");
const CORE_PATH = path.join(ROOT, "shared", "filter-core.js");
const LIBRARY_PATH = path.join(ROOT, "library.json");

function quietCore() {
    const origWarn = console.warn;
    console.warn = () => {};
    delete require.cache[require.resolve(CORE_PATH)];
    const core = require(CORE_PATH);
    console.warn = origWarn;
    return core;
}

function loadLibrary() {
    return JSON.parse(fs.readFileSync(LIBRARY_PATH, "utf8"));
}

/* Every filter of every title, tagged with its library key (as the catalog UI does). */
function allFilters(lib) {
    const out = [];
    for (const [key, item] of Object.entries(lib)) {
        for (const f of (Array.isArray(item.filters) ? item.filters : [])) out.push(Object.assign({}, f, { __key: key }));
    }
    return out;
}

function filtersByTitle(lib) {
    const out = {};
    for (const [key, item] of Object.entries(lib)) {
        if (item.type === "series") continue;
        const fs_ = (Array.isArray(item.filters) ? item.filters : []).map((f) => Object.assign({}, f, { __key: key }));
        if (fs_.length) out[key] = fs_;
    }
    return out;
}

function fakeElement() {
    const el = {
        style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ""; } }, dataset: {}, children: [],
        classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
        appendChild(c) { el.children.push(c); return c; }, append() {}, prepend() {}, insertBefore(c) { return c; }, removeChild() {},
        setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, remove() {},
        querySelector(sel) { return el.__q[sel] || (el.__q[sel] = fakeElement()); }, querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {},
        __q: {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }), contains() { return false; },
        textContent: "", innerHTML: "", parentElement: null, parentNode: null
    };
    return el;
}

/* A tiny fake page: enough DOM/window for the engine scripts to load in a vm context. */
function makePage(opts) {
    const o = opts || {};
    const posted = [];
    const listeners = {};
    const docListeners = {};
    const videos = o.videos || [];
    const storage = { sync: o.sync || {}, local: o.local || {} };
    const runtimeListeners = [];
    const chrome = {
        runtime: {
            lastError: null,
            sendMessage: (msg, cb) => { (o.onRuntimeMessage || (() => {}))(msg, cb); },
            onMessage: { addListener: (fn) => runtimeListeners.push(fn) }
        },
        storage: {
            sync: { get: (keys, cb) => cb(Object.assign({}, storage.sync)), set: () => {} },
            local: { get: (keys, cb) => cb(Object.assign({}, storage.local)), set: () => {} }
        }
    };
    const document = {
        readyState: "complete",
        head: fakeElement(),
        body: fakeElement(),
        documentElement: fakeElement(),
        querySelectorAll: (sel) => (/video/.test(sel) ? videos.filter((v) => !/data-nazafa-blurred/.test(sel) || v.dataset.nazafaBlurred === "1") : []),
        querySelector: (sel) => (/video/.test(sel) ? videos[0] || null : null),
        getElementById: () => null,
        createElement: () => fakeElement(),
        addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); }
    };
    const location = { hostname: o.hostname || "www.netflix.com", href: o.href || "https://www.netflix.com/watch/81234567", pathname: "/watch/81234567", origin: "https://www.netflix.com" };
    const window = {
        postMessage: (m) => { posted.push(m); (listeners.message || []).forEach((fn) => fn({ data: m, source: innerWindow(), origin: location.origin })); },
        addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
        location
    };
    const ctx = {
        window, document, location, chrome, console: o.console || { log() {}, warn() {}, error() {} },
        setTimeout: o.setTimeout || setTimeout, clearTimeout, setInterval: o.setInterval || (() => 0), clearInterval: () => {},
        requestAnimationFrame: () => 0, performance: { now: () => Date.now() },
        XMLHttpRequest: function () {}, fetch: async () => ({}), Response: function () {}, TextDecoder, TextEncoder,
        MutationObserver: function () { return { observe() {}, disconnect() {} }; },
        HTMLVideoElement: function () {}, Node: function () {}, Element: function () {}, URL, JSON, Math, Date
    };
    ctx.XMLHttpRequest.prototype = { open() {}, send() {} };
    Object.assign(ctx, {
        getComputedStyle: () => ({}), navigator: { userAgent: "node" },
        history: { pushState() {}, replaceState() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} }
    }, o.globals || {});
    /* In a page, window is the global object. */
    Object.assign(ctx, window);
    ctx.window = ctx;
    ctx.globalThis = ctx;
    ctx.self = ctx;
    ctx.top = ctx;
    ctx.parent = ctx;
    vm.createContext(ctx);
    /* What scripts inside the context see as `window` (the contextified global, not ctx itself). */
    let inner = null;
    function innerWindow() { return inner || (inner = vm.runInContext("window", ctx)); }
    return {
        ctx, posted, videos, runtimeListeners, docListeners,
        run(file) { vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file }); },
        eval(code) { return vm.runInContext(code, ctx); },
        post(msg, source) { (listeners.message || []).forEach((fn) => fn({ data: msg, source: source === undefined ? innerWindow() : source, origin: location.origin })); }
    };
}

function fakeVideo(over) {
    const v = Object.assign({
        tagName: "VIDEO", offsetWidth: 1280, offsetHeight: 720, duration: 5400, currentTime: 0,
        muted: false, volume: 1, paused: false, playbackRate: 1,
        dataset: {}, style: { filter: "", setProperty() {}, getPropertyValue() { return ""; }, getPropertyPriority() { return ""; }, removeProperty() {} },
        parentElement: { appendChild() {}, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
        closest: () => null, play: () => Promise.resolve(), pause() {}
    }, over || {});
    return v;
}

module.exports = { fakeElement, ROOT, ANDROID_ASSETS, CORE_PATH, LIBRARY_PATH, quietCore, loadLibrary, allFilters, filtersByTitle, makePage, fakeVideo };
