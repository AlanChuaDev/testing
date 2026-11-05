/* music.js — background music: one looping track per map, crossfaded when the scene changes.
   Tracks live in assets/music/*.mp3. Scenes that are not listed in FILES (the KTV rooms) stay silent.
   Mobile browsers only allow sound after a tap, so audio starts on the first touch / click / key press. */
(function () {
  const FILES = { plaza: 'plaza', boutique: 'mall', bukit: 'bukit', klcc: 'klcc', beach: 'beach', funfair: 'funfair', merdeka: 'plaza' };
  const XF = 1.4;                                                  // crossfade seconds (between tracks and between loop repeats)
  const ls = { get(k, d) { try { const v = localStorage.getItem('sc_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('sc_' + k, JSON.stringify(v)); } catch (e) {} } };
  const M = { on: ls.get('music', 1) !== 0 && ls.get('music', 1) !== false, vol: ls.get('mvol', .6), want: null, ducked: false, cur: null, ctx: null, master: null, cache: {} };
  const curve = (up) => { const n = 48, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1); a[i] = up ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2); } return a; };
  const UP = curve(true), DOWN = curve(false);

  function ensureCtx() {
    if (M.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { M.ctx = new AC(); M.master = M.ctx.createGain(); M.master.gain.value = (M.on && !M.ducked) ? M.vol : 0; M.master.connect(M.ctx.destination); } catch (e) { M.ctx = null; return false; }
    return true;
  }
  function load(name) {
    if (M.cache[name]) return M.cache[name];
    const p = fetch('assets/music/' + name + '.mp3').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(ab => new Promise((res, rej) => M.ctx.decodeAudioData(ab, res, rej)));
    p.catch(() => { delete M.cache[name]; }); M.cache[name] = p; return p;
  }
  function startVoice(name, buf) {
    const ctx = M.ctx, g = ctx.createGain(), t0 = ctx.currentTime + .05; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + XF); g.connect(M.master);
    const v = { name, g, srcs: [], next: t0, stopped: false, timer: 0 }, dur = buf.duration;
    const sched = () => {
      while (!v.stopped && v.next < ctx.currentTime + 4) {
        const s = ctx.createBufferSource(), sg = ctx.createGain(), first = v.srcs.length === 0, at = v.next; s.buffer = buf; s.connect(sg); sg.connect(g);
        if (!first) { sg.gain.setValueAtTime(0, at); sg.gain.setValueCurveAtTime(UP, at, XF); } else sg.gain.setValueAtTime(1, at);
        sg.gain.setValueAtTime(1, at + dur - XF); sg.gain.setValueCurveAtTime(DOWN, at + dur - XF, XF);
        s.start(at); s.stop(at + dur + .05); v.srcs.push(s); if (v.srcs.length > 6) v.srcs.shift();
        v.next = at + dur - XF;
      }
    };
    sched(); v.timer = setInterval(sched, 700); return v;
  }
  function stopVoice(v) {
    if (!v) return; v.stopped = true; clearInterval(v.timer); const ctx = M.ctx, t = ctx.currentTime;
    try { v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + XF); } catch (e) {}
    setTimeout(() => { v.srcs.forEach(s => { try { s.stop(); } catch (e) {} }); try { v.g.disconnect(); } catch (e) {} }, (XF + .3) * 1000);
  }
  function apply() {   // make the current voice match the wanted track
    if (!M.ctx) return;
    const name = M.want;
    if (M.cur && M.cur.name === name) return;
    const old = M.cur; M.cur = null; stopVoice(old);
    if (!name) return;
    load(name).then(buf => { if (M.want !== name || (M.cur && M.cur.name === name)) return; M.cur = startVoice(name, buf); }).catch(() => {});
  }
  function setVol() { if (M.master) M.master.gain.setTargetAtTime((M.on && !M.ducked) ? M.vol : 0, M.ctx.currentTime, (M.on && !M.ducked) ? .35 : .12); }   // 唱歌 / 播放伴奏时背景音乐淡出，唱完淡入
  function unlock() {
    if (!ensureCtx()) return;
    if (M.ctx.state !== 'running') M.ctx.resume().catch(() => {});
    try { const b = M.ctx.createBuffer(1, 1, 22050), s = M.ctx.createBufferSource(); s.buffer = b; s.connect(M.ctx.destination); s.start(0); } catch (e) {}   // iOS: unlock with a silent tick
    apply();
  }
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!M.ctx) return; if (document.hidden) M.ctx.suspend().catch(() => {}); else if (M.on) M.ctx.resume().catch(() => {}); });

  function wireSettings() {
    const bind = (id, get, set) => { const root = document.getElementById(id); if (!root) return; const sync = () => [...root.children].forEach(b => b.classList.toggle('on', Math.abs(parseFloat(b.dataset.v) - get()) < .001)); sync();
      root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; set(parseFloat(b.dataset.v)); sync(); }); };
    bind('segMusic', () => M.on ? 1 : 0, v => { M.on = v > 0; ls.set('music', M.on ? 1 : 0); setVol(); if (M.on) unlock(); });
    bind('segVol', () => M.vol, v => { M.vol = v; ls.set('mvol', v); setVol(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireSettings); else wireSettings();

  window.Music = { duck(f) { f = !!f; if (M.ducked === f) return; M.ducked = f; setVol(); }, setScene(id) { M.want = FILES[id] || null; apply(); }, get enabled() { return M.on; } };
})();
