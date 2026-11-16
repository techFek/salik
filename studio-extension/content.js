// Salik Studio — tab side. Talks to the side panel, previews the filters on the platform's own video,
// and draws the partial-blur picker over it.
(function(){
  if(window.__salikStudioCS) return;
  window.__salikStudioCS = true;
  const TAG = 'salik-studio';
  const LEAD = 0.3, MUTE_LEAD = 0.1;

  const state = { t: 0, at: 0, paused: true, duration: 0, rate: 1, platform: '' };
  let rows = [], apply = false, lastSent = 0;
  let weMuted = false, weBlurred = false, lastSkip = { uid: null, at: 0 };

  function video(){
    let best = null, area = 0;
    for(const v of document.querySelectorAll('video')){
      const r = v.getBoundingClientRect(), a = r.width * r.height;
      if(a > area){ best = v; area = a; }
    }
    return best;
  }
  const host = () => document.fullscreenElement || document.body;
  const now = () => state.paused ? state.t : state.t + (performance.now() - state.at) / 1000 * (state.rate || 1);
  const cmd = (c, extra) => window.postMessage({ from: TAG + '-cs', cmd: c, ...(extra || {}) }, '*');
  const toPanel = msg => { try{ chrome.runtime.sendMessage({ ...msg, salikStudioTab: true }, () => void chrome.runtime.lastError); }catch(e){ /* extension reloaded */ } };

  window.addEventListener('message', e => {
    if(e.source !== window || !e.data || e.data.from !== TAG + '-page') return;
    const d = e.data;
    Object.assign(state, { t: d.t, paused: d.paused, duration: d.duration, rate: d.rate, platform: d.platform, at: performance.now() });
    const n = performance.now();
    if(n - lastSent > 200){ lastSent = n; toPanel({ type: 'state', t: d.t, paused: d.paused, duration: d.duration, rate: d.rate, platform: d.platform }); }
  });

  /* ---------- overlays ---------- */
  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(0,0,0,.75);color:#fff;font:600 14px system-ui,sans-serif;padding:6px 14px;border-radius:8px;display:none;pointer-events:none;direction:auto;';
  const region = document.createElement('div');
  region.style.cssText = 'position:fixed;z-index:2147483646;backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);background:rgba(0,0,0,.25);border-radius:6px;display:none;pointer-events:none;';
  let badgeTimer = null;
  function attach(el){ if(el.parentNode !== host()) host().appendChild(el); }
  function flash(text, keep){
    attach(badge); badge.textContent = text; badge.style.display = 'block';
    clearTimeout(badgeTimer);
    if(!keep) badgeTimer = setTimeout(() => { badge.style.display = 'none'; }, 1500);
  }
  // Same convention as Salik and the bookmarklet: x/y = top-left corner, relative to the <video> box.
  function placeRegion(r){
    const v = video();
    if(!r || !v){ region.style.display = 'none'; return; }
    attach(region);
    const b = v.getBoundingClientRect();
    Object.assign(region.style, { display: 'block', left: (b.left + r.x * b.width) + 'px', top: (b.top + r.y * b.height) + 'px', width: (r.width * b.width) + 'px', height: (r.height * b.height) + 'px' });
  }
  function clearEffects(){
    const v = video();
    if(v && weMuted) v.muted = false;
    if(v && weBlurred) v.style.filter = '';
    weMuted = weBlurred = false;
    placeRegion(null);
    badge.style.display = 'none';
  }

  /* ---------- filters preview ---------- */
  function engine(){
    if(!apply || !rows.length) return;
    const v = video();
    if(!v) return;
    const t = now();
    let skip = null, mute = null, blur = null, pblur = null;
    for(const r of rows){
      const lead = r.action === 'mute' ? MUTE_LEAD : LEAD;
      if(t < r.start - lead || t > r.end) continue;
      if(r.action === 'skip'){ if(!skip || r.end > skip.end) skip = r; }
      else if(r.action === 'mute') mute = mute || r;
      else if(r.action === 'blur') blur = blur || r;
      else if(r.action === 'partial_blur') pblur = pblur || r;
    }
    if(skip && !state.paused){
      const n = performance.now();
      if(lastSkip.uid !== skip.uid || n - lastSkip.at > 3000){
        lastSkip = { uid: skip.uid, at: n };
        cmd('seek', { t: skip.end + 0.05 });
        state.t = skip.end + 0.05; state.at = n;
        flash('⏩ ' + (skip.text || 'skip'));
      }
    }
    const wantMute = !!mute && !skip;
    if(wantMute !== weMuted){ v.muted = wantMute; weMuted = wantMute; }
    const wantBlur = !!blur && !skip;
    if(wantBlur !== weBlurred){ v.style.filter = wantBlur ? 'blur(40px)' : ''; weBlurred = wantBlur; }
    placeRegion(pblur && !skip && !blur ? (pblur.region || { x: 0.35, y: 0.35, width: 0.3, height: 0.3 }) : null);
    const active = !skip && (mute || blur || pblur);
    if(active) flash((mute ? '🔇 ' : '') + (blur ? '🌫 ' : '') + (pblur ? '▣ ' : '') + (active.text || ''), true);
    else if(badge.style.display === 'block' && !/^⏩/.test(badge.textContent)) badge.style.display = 'none';
  }
  setInterval(engine, 50);   // not rAF: it stops while the tab isn't painted

  /* ---------- partial-blur picker ---------- */
  let picking = false, drag = null;
  const pick = document.createElement('div');
  pick.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,.08);';
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;border:2px dashed #ffd54a;background:rgba(255,213,74,.15);display:none;pointer-events:none;z-index:2147483647;';
  const tip = document.createElement('div');
  tip.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(0,0,0,.8);color:#fff;font:14px system-ui,sans-serif;padding:8px 14px;border-radius:8px;pointer-events:none;direction:rtl;';
  tip.textContent = '🎯 اسحب فوق الجزء اللي عايز تغبّشه · Space تشغيل/إيقاف · Esc إنهاء';

  function pickStart(){
    picking = true; drag = null; box.style.display = 'none';
    cmd('pause');
    [pick, box, tip].forEach(attach);
  }
  function pickStop(){
    picking = false; drag = null;
    [pick, box, tip].forEach(el => el.remove());
  }
  pick.addEventListener('mousedown', e => {
    drag = { x: e.clientX, y: e.clientY };
    Object.assign(box.style, { display: 'block', left: e.clientX + 'px', top: e.clientY + 'px', width: '0px', height: '0px' });
    e.preventDefault(); e.stopPropagation();
  }, true);
  pick.addEventListener('mousemove', e => {
    if(!drag) return;
    Object.assign(box.style, { left: Math.min(drag.x, e.clientX) + 'px', top: Math.min(drag.y, e.clientY) + 'px', width: Math.abs(e.clientX - drag.x) + 'px', height: Math.abs(e.clientY - drag.y) + 'px' });
    e.stopPropagation();
  }, true);
  pick.addEventListener('mouseup', e => {
    if(!drag) return;
    const v = video();
    const x1 = Math.min(drag.x, e.clientX), y1 = Math.min(drag.y, e.clientY), x2 = Math.max(drag.x, e.clientX), y2 = Math.max(drag.y, e.clientY);
    drag = null;
    e.stopPropagation();
    if(!v || x2 - x1 < 5 || y2 - y1 < 5) return;
    const r = v.getBoundingClientRect();
    const c = n => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
    const reg = { x: c((x1 - r.left) / r.width), y: c((y1 - r.top) / r.height), width: c((x2 - x1) / r.width), height: c((y2 - y1) / r.height) };
    toPanel({ type: 'region', region: reg });
    tip.textContent = '✅ اتبعت للاستوديو — اسحب تاني تغيّره، أو Esc للإنهاء';
  }, true);
  ['click', 'dblclick', 'pointerdown', 'pointerup'].forEach(ev => pick.addEventListener(ev, e => e.stopPropagation(), true));
  document.addEventListener('keydown', e => {
    if(!picking) return;
    if(e.key === 'Escape'){ pickStop(); e.preventDefault(); e.stopPropagation(); }
    else if(e.key === ' '){ cmd('toggle'); e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('fullscreenchange', () => { if(picking) [pick, box, tip].forEach(attach); });

  /* ---------- side panel messages ---------- */
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if(!msg || msg.salikStudio !== true) return;
    switch(msg.type){
      case 'hello': reply({ video: !!video(), platform: state.platform || location.hostname }); return;
      case 'seek': cmd('seek', { t: msg.t }); state.t = msg.t; state.at = performance.now(); break;
      case 'play': cmd('play'); break;
      case 'pause': cmd('pause'); break;
      case 'filters':
        apply = !!msg.apply; rows = Array.isArray(msg.rows) ? msg.rows : [];
        if(!apply) clearEffects();
        break;
      case 'pick': pickStart(); break;
    }
    reply({ ok: true });
  });
})();
