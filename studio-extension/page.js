// Salik Studio — page adapter (runs in the page's own world).
// Reports the player's time and does seek / play / pause through each platform's own player API,
// because seeking the <video> element directly breaks Netflix and is wrong on Disney+.
(function(){
  if(window.__salikStudioPage) return;
  window.__salikStudioPage = true;
  const TAG = 'salik-studio';

  function bigVideo(){
    let best = null, area = 0;
    for(const v of document.querySelectorAll('video')){
      const r = v.getBoundingClientRect(), a = r.width * r.height;
      if(a > area && v.readyState > 0){ best = v; area = a; }
    }
    return best;
  }

  function netflix(){
    try{
      const vp = window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
      const ids = vp.getAllPlayerSessionIds();
      if(!ids || !ids.length) return null;
      const p = vp.getVideoPlayerBySessionId(ids[ids.length - 1]);
      if(!p) return null;
      return {
        platform: 'Netflix',
        time: () => p.getCurrentTime() / 1000,
        duration: () => p.getDuration() / 1000,
        paused: () => p.isPaused(),
        seek: t => p.seek(Math.round(t * 1000)),
        play: () => p.play(),
        pause: () => p.pause()
      };
    }catch(e){ return null; }
  }

  function disney(){
    const el = document.querySelector('disney-web-player');
    if(!el) return null;
    const v = bigVideo();
    const pos = () => {
      try{
        const ms = el.stateStore.getState().player.core.timeline.timeline.playheadPositionMs;
        if(typeof ms === 'number') return ms / 1000;
      }catch(e){}
      return v ? v.currentTime : 0;
    };
    return {
      platform: 'Disney+',
      time: pos,
      duration: () => { try{ const d = el.stateStore.getState().player.core.timeline.timeline.durationMs; if(d) return d / 1000; }catch(e){} return v ? v.duration : 0; },
      paused: () => v ? v.paused : true,
      seek: t => { try{ el.mediaPlayer.seek(Math.round(t * 1000)); }catch(e){ if(v) v.currentTime = t; } },
      play: () => { try{ el.mediaPlayer.play(); }catch(e){ v && v.play(); } },
      pause: () => { try{ el.mediaPlayer.pause(); }catch(e){ v && v.pause(); } }
    };
  }

  function html5(){
    const v = bigVideo();
    if(!v) return null;
    return {
      platform: location.hostname.replace(/^www\./, ''),
      time: () => v.currentTime,
      duration: () => v.duration || 0,
      paused: () => v.paused,
      seek: t => { v.currentTime = t; },
      play: () => v.play().catch(()=>{}),
      pause: () => v.pause()
    };
  }

  function adapter(){
    if(/netflix\./.test(location.hostname)){ const a = netflix(); if(a) return a; }
    if(/disneyplus\./.test(location.hostname)){ const a = disney(); if(a) return a; }
    return html5();
  }

  window.addEventListener('message', e => {
    if(e.source !== window || !e.data || e.data.from !== TAG + '-cs') return;
    const a = adapter();
    if(!a) return;
    const m = e.data;
    try{
      if(m.cmd === 'seek') a.seek(Math.max(0, m.t));
      else if(m.cmd === 'play') a.play();
      else if(m.cmd === 'pause') a.pause();
      else if(m.cmd === 'toggle') a.paused() ? a.play() : a.pause();
    }catch(err){ /* the player isn't ready */ }
  });

  setInterval(() => {
    const a = adapter();
    if(!a) return;
    let t = 0, d = 0, p = true;
    try{ t = a.time(); d = a.duration(); p = a.paused(); }catch(e){ return; }
    const v = bigVideo();
    window.postMessage({ from: TAG + '-page', t, duration: d || 0, paused: p, rate: v ? v.playbackRate : 1, platform: a.platform }, '*');
  }, 100);
})();
