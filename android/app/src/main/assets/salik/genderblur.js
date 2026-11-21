(function () {
  var cfg = window.__SALIK_GENDER;
  if (!cfg || (!cfg.female && !cfg.male && !cfg.nsfw) || window.__salikGenderStarted) return;
  if (typeof SalikNative === "undefined") return;
  window.__salikGenderStarted = true;

  var INTERVAL_MS = 500, CLEAR_AFTER = 3, HOLD_MS = 3000, MIN_FACE = 0.3, MIN_GENDER = 0.1;
  var W = 480;
  var lastHitAt = 0;
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d", { willReadFrequently: false });
  var nextId = 1, waiting = null, cleanFrames = 0, blurred = false, overlay = null, overlayHost = null;

  SalikNative.addEventListener("message", function (e) {
    var msg; try { msg = JSON.parse(e.data); } catch (x) { return; }
    if (!msg || typeof msg.replyTo !== "string" || msg.replyTo.charAt(0) !== "g") return;
    if (waiting && waiting.id === msg.replyTo) { var cb = waiting.cb; waiting = null; cb(msg.payload || {}); }
  });

  function activeVideo() {
    var best = null, area = 0;
    var vids = document.querySelectorAll("video");
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      if (v.paused || v.readyState < 2 || !v.videoWidth) continue;
      var a = v.offsetWidth * v.offsetHeight;
      if (a > area) { area = a; best = v; }
    }
    return best;
  }

  function ensureOverlay(video) {
    var host = video.parentElement;
    if (!host) return null;
    if (overlay && overlayHost === host && overlay.isConnected) return overlay;
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.setAttribute("data-salik", "gender-blur");
    var s = overlay.style;
    s.position = "absolute"; s.inset = "0"; s.zIndex = "2147483646"; s.pointerEvents = "none";
    s.backdropFilter = "blur(48px) saturate(0.4)"; s.webkitBackdropFilter = "blur(48px) saturate(0.4)";
    s.background = "rgba(10,25,30,0.35)"; s.display = "none";
    s.alignItems = "flex-end"; s.justifyContent = "center";
    var label = document.createElement("span");
    label.textContent = cfg.ar ? "سالك: تمويه تلقائي (تجريبي)" : "Salik: auto blur (experimental)";
    var ls = label.style;
    ls.margin = "0 0 6%"; ls.padding = "6px 14px"; ls.borderRadius = "10px"; ls.font = "600 15px sans-serif";
    ls.color = "#fff"; ls.background = "rgba(0,0,0,0.55)";
    overlay.appendChild(label);
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.appendChild(overlay);
    overlayHost = host;
    return overlay;
  }

  function setBlur(video, on) {
    var o = ensureOverlay(video);
    if (!o) return;
    if (on !== blurred) console.log("[Salik] gender blur " + (on ? "ON" : "off"));
    blurred = on;
    o.style.display = on ? "flex" : "none";
  }

  function hidden(face) {
    if ((face.score || 0) < MIN_FACE || (face.genderScore || 0) < MIN_GENDER) return false;
    return (face.gender === "female" && cfg.female) || (face.gender === "male" && cfg.male);
  }

  /* Sexual / revealing picture (nsfwjs): porn + hentai + sexy together, so a strict line for family viewing. */
  var NSFW_LINE = 0.6;
  function nsfwHit(n) {
    return !!(cfg.nsfw && n && ((n.porn || 0) + (n.hentai || 0) + (n.sexy || 0)) >= NSFW_LINE);
  }

  function tick() {
    var v = activeVideo();
    if (!v) { if (overlay && blurred) overlay.style.display = "none", blurred = false; return; }
    if (waiting) return;
    var h = Math.round(W * v.videoHeight / v.videoWidth);
    if (canvas.width !== W || canvas.height !== h) { canvas.width = W; canvas.height = h; }
    var img;
    try { ctx.drawImage(v, 0, 0, W, h); img = canvas.toDataURL("image/jpeg", 0.7); }
    catch (e) {
      if (!tick.warned) { tick.warned = true; console.warn("[Salik] gender blur: this video's frames can't be read (" + e.name + ")"); }
      return;
    }
    var id = "g" + (nextId++);
    waiting = { id: id, cb: function (res) {
      if (!res || res.busy || res.timeout || res.error || res.off) return;
      var hit = (res.faces || []).some(hidden) || nsfwHit(res.nsfw);
      if (hit) { cleanFrames = 0; lastHitAt = Date.now(); setBlur(v, true); }
      else if (blurred && ++cleanFrames >= CLEAR_AFTER && Date.now() - lastHitAt > HOLD_MS) setBlur(v, false);
    } };
    setTimeout(function () { if (waiting && waiting.id === id) waiting = null; }, 9000);
    SalikNative.postMessage(JSON.stringify({ id: id, kind: "gender.frame", data: { img: img } }));
  }

  setInterval(tick, INTERVAL_MS);
  console.log("[Salik] experimental auto blur active (female=" + !!cfg.female + ", male=" + !!cfg.male + ", nsfw=" + !!cfg.nsfw + ")");
})();
