/* haunted_fx.js — 鬼屋专用效果：合成音效 / 视线光影(手电筒+烛光，墙会挡光) / 怪物与惊吓的 2D 精灵绘制。
   不依赖任何外部素材；音效全部 WebAudio 合成。挂在 G.HFX 上。 */
(function (G) {
'use strict';
const TAU = Math.PI * 2, clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/* =====================================================================
   音效
   ===================================================================== */
const Aud = (() => {
  let ac = null, master, nb, droneG, windG, windF, hb = 0, muted = false, lastStep = 0;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const comp = ac.createDynamicsCompressor(); master = ac.createGain(); master.gain.value = muted ? 0 : .9; master.connect(comp); comp.connect(ac.destination);
    nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    /* 低频嗡鸣（两个略失谐的低音）+ 风声 */
    droneG = ac.createGain(); droneG.gain.value = .0; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; droneG.connect(master); lp.connect(droneG);
    [49, 49.7, 73.5].forEach((f, i) => { const o = ac.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = i === 2 ? .35 : .8; o.connect(g); g.connect(lp); o.start(); });
    const wn = ac.createBufferSource(); wn.buffer = nb; wn.loop = true; windF = ac.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 380; windF.Q.value = .8; windG = ac.createGain(); windG.gain.value = 0;
    const lfo = ac.createOscillator(); lfo.frequency.value = .11; const lg = ac.createGain(); lg.gain.value = 170; lfo.connect(lg); lg.connect(windF.frequency); lfo.start(); wn.connect(windF); windF.connect(windG); windG.connect(master); wn.start();
    droneG.gain.setTargetAtTime(.16, ac.currentTime, 2); windG.gain.setTargetAtTime(.07, ac.currentTime, 3);
  }
  const ok = () => ac && ac.state !== 'closed';
  function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function pan(node, p) { if (ac.createStereoPanner) { const s = ac.createStereoPanner(); s.pan.value = clamp(p || 0, -1, 1); node.connect(s); return s; } return node; }
  function tone(f0, f1, dur, type, vol, p, a) { if (!ok()) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, a || .005, vol, dur); o.connect(g); pan(g, p).connect(master); o.start(t); o.stop(t + dur + .1); return o; }
  function noise(dur, vol, type, f0, f1, q, p, a) { if (!ok()) return; const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1; const g = ac.createGain(); env(g, t, a || .005, vol, dur); s.connect(f); f.connect(g); pan(g, p).connect(master); s.start(t, Math.random()); s.stop(t + dur + .1); }
  return {
    init, get on() { return !!ac; },
    mute(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; },
    /* danger 0..1：嗡鸣更响更亮 */
    setDanger(d) { if (!ok()) return; droneG.gain.setTargetAtTime(.14 + d * .34, ac.currentTime, .6); windG.gain.setTargetAtTime(.06 + d * .03, ac.currentTime, 1); },
    heart(dt, danger) { if (!ok() || danger < .12) { hb = 0; return; } hb -= dt; if (hb > 0) return; hb = lerp(1.05, .36, clamp(danger, 0, 1)); const v = .35 + danger * .55; tone(70, 38, .13, 'sine', v); setTimeout(() => tone(62, 34, .15, 'sine', v * .8), 150 - danger * 40); },
    step(run, p) { if (!ok()) return; const n = performance.now(); if (n - lastStep < 90) return; lastStep = n; noise(.09, run ? .22 : .13, 'lowpass', 420 + Math.random() * 160, 160, 1, p, .002); if (Math.random() < .16) this.creak(.25); },
    creak(v) { noise(.45 + Math.random() * .3, (v || .3) * .5, 'bandpass', 260 + Math.random() * 120, 520 + Math.random() * 300, 14, (Math.random() - .5) * .6, .08); },
    slam() { noise(.7, .9, 'lowpass', 260, 60, 1, 0, .002); tone(62, 30, .5, 'sine', .9, 0, .002); setTimeout(() => noise(.6, .25, 'bandpass', 900, 300, 3), 80); },
    thud(v) { tone(90, 40, .22, 'sine', v || .6); noise(.12, (v || .6) * .5, 'lowpass', 300, 100); },
    knock() { for (let i = 0; i < 3; i++) setTimeout(() => { tone(150, 90, .09, 'triangle', .6, (Math.random() - .5) * .7); noise(.06, .4, 'bandpass', 700, 400, 4); }, i * 190); },
    blow() { noise(.5, .35, 'bandpass', 2400, 600, 2, 0, .04); },
    whisper(p) { if (!ok()) return; const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 5; const g = ac.createGain(), L = ac.createOscillator(), lg = ac.createGain(); L.frequency.value = 5 + Math.random() * 4; lg.gain.value = 900; L.connect(lg); lg.connect(f.frequency); f.frequency.setValueAtTime(1400 + Math.random() * 1000, t);
      const d = 1.1 + Math.random() * .8; env(g, t, .25, .42, d); s.connect(f); f.connect(g); pan(g, p == null ? (Math.random() - .5) * 1.6 : p).connect(master); s.start(t, Math.random()); L.start(t); s.stop(t + d + .4); L.stop(t + d + .4); },
    bell() { tone(392, 0, 2.4, 'sine', .16); tone(784 * 1.003, 0, 1.8, 'sine', .1); tone(1175, 0, 1.2, 'sine', .05); },
    pick() { this.bell(); setTimeout(() => tone(523, 0, 1.4, 'sine', .1), 140); },
    click() { tone(1800, 900, .03, 'square', .09); },
    hiss(v) { noise(.7, v || .5, 'highpass', 3200, 5200, 1, (Math.random() - .5) * .5, .06); },
    sting(v) { tone(300, 1600, .9, 'sawtooth', .5 * (v || 1)); tone(311, 1650, .9, 'square', .25 * (v || 1)); noise(.9, .6 * (v || 1), 'highpass', 1500, 6000, 1, 0, .002); tone(50, 28, .9, 'sine', .9 * (v || 1)); },
    scream() { if (!ok()) return; const t = ac.currentTime, o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(), L = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(1180, t + .25); o.frequency.linearRampToValueAtTime(760, t + 1.1); o2.frequency.setValueAtTime(790, t); o2.frequency.linearRampToValueAtTime(1500, t + .3); o2.frequency.linearRampToValueAtTime(1050, t + 1.1);
      L.frequency.value = 38; lg.gain.value = 90; L.connect(lg); lg.connect(o.frequency); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.4; env(g, t, .02, .5, 1.2); o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(t); o2.start(t); L.start(t); [o, o2, L].forEach(n => n.stop(t + 1.5)); this.sting(.6); },
    static(d) { if (!ok()) return; for (let i = 0; i < 6; i++) setTimeout(() => noise(.12 + Math.random() * .2, .22, 'bandpass', 500 + Math.random() * 2500, 800 + Math.random() * 2000, 1.2), i * (d || 120)); },
    note(f) { tone(f, 0, 2.8, 'triangle', .13); tone(f * 2.005, 0, 1.6, 'sine', .04); },
    drip() { tone(1500, 520, .09, 'sine', .07, (Math.random() - .5) * .6); noise(.05, .03, 'highpass', 3000, 3000, 1); },
    chime() { [0, 1, 2].forEach(i => setTimeout(() => tone(330 * Math.pow(1.5, i), 0, 1.6, 'sine', .12), i * 220)); },
    win() { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, 0, 2.2, 'sine', .14), i * 260)); },
    rumble(d) { noise(d || 2, .5, 'lowpass', 110, 50, 1, 0, .4); },
    gate() { this.rumble(3); setTimeout(() => this.creak(.6), 300); setTimeout(() => this.creak(.6), 1200); },
  };
})();

/* =====================================================================
   视线光影：低分辨率"黑暗层"，每个光源是一个可视多边形（被墙挡住）+ 渐变，用 destination-out 擦出光。
   ===================================================================== */
class Dark {
  constructor() { this.lo = document.createElement('canvas'); this.lc = this.lo.getContext('2d'); this.tn = document.createElement('canvas'); this.tc = this.tn.getContext('2d'); }
  /* ray vs wall rects：返回 {t, ax, face}；face: 1 = 朝镜头(+z)的墙面，2 = 侧面，0 = 背面 */
  static cast(ox, oz, dx, dz, walls, range) {
    let best = range, face = -1;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i]; let t0 = 0, t1 = best, f = -1, ok = true;
      for (let a = 0; a < 2; a++) {
        const o = a ? oz : ox, d = a ? dz : dx, lo = a ? w[1] : w[0], hi = a ? w[3] : w[2];
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
        let ta = (lo - o) / d, tb = (hi - o) / d, fa = d > 0 ? (a ? 0 : 2) : (a ? 1 : 2); if (ta > tb) { const q = ta; ta = tb; tb = q; }
        if (ta > t0) { t0 = ta; f = fa; } if (tb < t1) t1 = tb; if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best && t0 > 0) { best = t0; face = f; }
    }
    return { t: best, face };
  }
  /* 可视多边形（屏幕坐标）。a0..a1 为弧度范围（null = 全圆） */
  poly(R, x, z, range, walls, n, a0, a1, H) {
    const pts = [], full = a0 == null; if (full) { a0 = 0; a1 = TAU; }
    const steps = full ? n : n + 1;
    const pr = (px, py, pz) => R.project([px, py, pz]);
    for (let k = 0; k < steps; k++) {
      const a = a0 + (a1 - a0) * (k / (full ? n : n)), dx = Math.sin(a), dz = Math.cos(a), r = Dark.cast(x, z, dx, dz, walls, range), hx = x + dx * r.t, hz = z + dz * r.t;
      const hit = r.t < range - 1e-3; const y = !hit ? 0 : r.face === 1 ? H * .92 : r.face === 2 ? H * .35 : 0;
      const p = pr(hx, y, hz); if (p) pts.push(p);
    }
    if (!full) { const c = pr(x, 0, z); if (c) pts.push(c); }
    return pts;
  }
  /* o: {R, w, h, me:{x,z}, walls, lights:[{x,z,r,a,col:[r,g,b],cone:{dir,half}|null,tint}], darkness, H, target(ctx of hz canvas), shake} */
  render(o) {
    const R = o.R, w = o.w, h = o.h, S = .28, lw = Math.max(2, Math.round(w * S)), lh = Math.max(2, Math.round(h * S));
    if (this.lo.width !== lw || this.lo.height !== lh) { this.lo.width = this.tn.width = lw; this.lo.height = this.tn.height = lh; }
    const lc = this.lc, tc = this.tc; lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, lw, lh); lc.fillStyle = 'rgba(2,3,8,' + o.darkness + ')'; lc.fillRect(0, 0, lw, lh);
    tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, lw, lh);
    for (const L of o.lights) {
      if (L.a <= .01) continue; const c = R.project([L.x, 0, L.z]); if (!c) continue;
      const c1 = R.project([L.x + 1, 0, L.z]), c2 = R.project([L.x, 0, L.z + 1]); if (!c1 || !c2) continue;
      const e1x = c1[0] - c[0], e1y = c1[1] - c[1], e2x = c2[0] - c[0], e2y = c2[1] - c[1], pxm = Math.max(Math.hypot(e1x, e1y), Math.hypot(e2x, e2y), 1);
      if (c[0] < -L.r * pxm || c[0] > w + L.r * pxm || c[1] < -L.r * pxm * 2 || c[1] > h + L.r * pxm * 2) continue;
      const layers = L.cone ? [[1, .45], [.86, .35], [.7, .35]] : [[1, 1]];
      for (const [hf, al] of layers) {
        const pts = this.poly(R, L.x, L.z, L.r, o.walls, L.cone ? 34 : 64, L.cone ? L.cone.dir - L.cone.half * hf : null, L.cone ? L.cone.dir + L.cone.half * hf : null, o.H);
        if (pts.length < 3) continue;
        for (const [ctx, kind] of [[lc, 0], [tc, 1]]) {
          if (kind && !L.tint) continue;
          ctx.save(); ctx.globalCompositeOperation = kind ? 'lighter' : 'destination-out'; ctx.beginPath(); ctx.moveTo(pts[0][0] * S, pts[0][1] * S); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * S, pts[i][1] * S); ctx.closePath(); ctx.clip();
          ctx.translate(c[0] * S, c[1] * S); ctx.transform(e1x * S, e1y * S, e2x * S, e2y * S, 0, 0); const g = ctx.createRadialGradient(0, 0, L.r * (L.hole || 0), 0, 0, L.r);
          if (kind) { const k = L.tint * al; g.addColorStop(0, `rgba(${L.col[0]},${L.col[1]},${L.col[2]},${k})`); g.addColorStop(1, `rgba(${L.col[0]},${L.col[1]},${L.col[2]},0)`); }
          else { g.addColorStop(0, `rgba(0,0,0,${L.a * al})`); g.addColorStop(.55, `rgba(0,0,0,${L.a * al * .62})`); g.addColorStop(1, 'rgba(0,0,0,0)'); }
          ctx.fillStyle = g; ctx.fillRect(-L.r * 3, -L.r * 3, L.r * 6, L.r * 6); ctx.restore();
        }
      }
    }
    const t = o.target; t.imageSmoothingEnabled = true; t.drawImage(this.lo, 0, 0, w, h); t.save(); t.globalCompositeOperation = 'lighter'; t.globalAlpha = 1; t.drawImage(this.tn, 0, 0, w, h); t.restore();
  }
}

/* =====================================================================
   2D 精灵：全部用路径 + 渐变现画。约定：(x,y) = 脚底中心(屏幕 px)，h = 全高(px)。
   ===================================================================== */
const P = {};
function hairStrands(g, x, y, w, h, t, seed, n, col) {
  const r = rnd(seed); g.strokeStyle = col; for (let i = 0; i < n; i++) { const u = (i / (n - 1)) * 2 - 1, sx = x + u * w * .5 * (.6 + r() * .4), len = h * (.55 + r() * .5), sw = Math.sin(t * 1.3 + i * .7) * w * .05 * (1 + r()); g.lineWidth = Math.max(1, w * (.018 + r() * .02)); g.beginPath(); g.moveTo(sx, y); g.bezierCurveTo(sx + u * w * .12 + sw, y + len * .3, sx - u * w * .05 + sw * 1.6, y + len * .65, sx + u * w * .1 + sw * 2.2, y + len); g.stroke(); }
}
/* 红衣女鬼：悬浮、长黑发遮脸、苍白手臂、血红长裙。pose: 0 正常 1 被照到(僵直、头抬起) 2 逼近(扑来) */
P.ghost = function (g, x, y, h, t, o) {
  o = o || {}; const lit = o.lit || 0, w = h * .46, sway = Math.sin(t * 1.6) * h * .012, fl = lit ? (Math.random() - .5) * h * .012 : 0, bob = Math.sin(t * 2.1) * h * .018, yy = y - h * .08 + bob;
  g.save(); g.translate(x + fl, 0); g.globalAlpha = o.alpha == null ? 1 : o.alpha;
  /* 光晕 */
  const au = g.createRadialGradient(0, yy - h * .5, h * .05, 0, yy - h * .5, h * .7); au.addColorStop(0, lit ? 'rgba(255,40,40,.22)' : 'rgba(150,0,20,.16)'); au.addColorStop(1, 'rgba(120,0,10,0)'); g.fillStyle = au; g.fillRect(-h * .8, yy - h * 1.3, h * 1.6, h * 1.6);
  /* 后发 */
  g.fillStyle = '#05030a'; g.beginPath(); g.moveTo(-w * .3, yy - h * .88); g.bezierCurveTo(-w * .62, yy - h * .62, -w * .6 + sway, yy - h * .2, -w * .42 + sway * 2, yy - h * .02); g.lineTo(w * .42 + sway * 2, yy - h * .02); g.bezierCurveTo(w * .6 + sway, yy - h * .2, w * .62, yy - h * .62, w * .3, yy - h * .88); g.closePath(); g.fill();
  /* 裙：上窄下宽，下摆撕成烟 */
  const gd = g.createLinearGradient(0, yy - h * .62, 0, yy); gd.addColorStop(0, '#9a0f1e'); gd.addColorStop(.55, '#6e0714'); gd.addColorStop(1, 'rgba(60,0,8,0)');
  g.fillStyle = gd; g.beginPath(); g.moveTo(-w * .17, yy - h * .66); g.bezierCurveTo(-w * .2, yy - h * .5, -w * .46 + sway, yy - h * .22, -w * .52 + sway * 2, yy + h * .02);
  for (let i = 0; i <= 8; i++) { const u = -.52 + i / 8 * 1.04; g.lineTo(w * u + sway * 2, yy + h * (.02 + (i % 2 ? .06 : -.01) + Math.sin(t * 3 + i) * .012)); }
  g.bezierCurveTo(w * .46 + sway, yy - h * .22, w * .2, yy - h * .5, w * .17, yy - h * .66); g.closePath(); g.fill();
  /* 裙上血迹 + 褶 */
  g.strokeStyle = 'rgba(20,0,4,.45)'; g.lineWidth = Math.max(1, h * .006); for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * w * .045, yy - h * .62); g.quadraticCurveTo(i * w * .12 + sway, yy - h * .3, i * w * .16 + sway * 2, yy - h * .02); g.stroke(); }
  g.fillStyle = 'rgba(30,0,4,.5)'; g.beginPath(); g.ellipse(-w * .06, yy - h * .4, w * .09, h * .05, .2, 0, TAU); g.fill();
  /* 手臂（苍白，垂下，指尖很长） */
  const arm = (s) => { const sx = s * w * .17, sy = yy - h * .64, ex = s * w * (lit ? .62 : .34) + sway, ey = yy - h * (lit ? .78 : .3 + Math.sin(t * 1.5 + s) * .01); g.strokeStyle = '#d9d2d0'; g.lineCap = 'round'; g.lineWidth = h * .028; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(s * w * .42, (sy + ey) / 2, ex, ey); g.stroke();
    g.lineWidth = Math.max(1, h * .006); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + k * h * .012 + s * h * .02, ey + h * (lit ? -.075 : .085)); g.stroke(); } };
  arm(-1); arm(1);
  /* 脖子/头 */
  const hy = yy - h * .8, hr = h * .105; g.fillStyle = '#cfc8c6'; g.fillRect(-hr * .22, hy + hr * .6, hr * .44, hr * .8);
  const fg = g.createRadialGradient(0, hy, hr * .1, 0, hy, hr * 1.05); fg.addColorStop(0, '#f1ecea'); fg.addColorStop(1, '#b9b0b0'); g.fillStyle = fg; g.beginPath(); g.ellipse(0, hy, hr * .84, hr * 1.02, 0, 0, TAU); g.fill();
  /* 脸：黑眼窝、裂嘴 */
  g.fillStyle = '#0a0406'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(s * hr * .34, hy - hr * .08, hr * .2, hr * .3, s * .12, 0, TAU); g.fill(); });
  if (lit) { g.fillStyle = 'rgba(255,50,40,.95)'; [-1, 1].forEach(s => { g.beginPath(); g.arc(s * hr * .34, hy - hr * .02, hr * .06, 0, TAU); g.fill(); }); }
  g.fillStyle = '#12020a'; g.beginPath(); g.ellipse(0, hy + hr * .5, hr * (lit ? .24 : .13), hr * (lit ? .42 : .22), 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(150,0,16,.75)'; g.lineWidth = Math.max(1, hr * .07); [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * hr * .34, hy + hr * .2); g.quadraticCurveTo(s * hr * .4 + sway, hy + hr * .8, s * hr * .3, hy + hr * 1.5 + Math.sin(t * 2 + s) * hr * .1); g.stroke(); });   // 血泪
  /* 前发：中分，遮住大半脸（被照到时往两边拨开一点） */
  const part = lit ? hr * .36 : hr * .06;
  [-1, 1].forEach(s => { g.fillStyle = '#05030a'; g.beginPath(); g.moveTo(s * part, hy - hr * 1.08); g.bezierCurveTo(s * hr * 1.15, hy - hr * .9, s * hr * 1.1 + sway, hy + hr * .4, s * hr * .95 + sway * 2, hy + hr * 2.2); g.lineTo(s * hr * .5 + sway * 2, hy + hr * 2.6); g.bezierCurveTo(s * hr * .25, hy + hr * .8, s * part * 1.3, hy - hr * .2, s * part, hy - hr * 1.08); g.fill(); });
  hairStrands(g, 0, hy - hr * .9, hr * 2.4, h * .6, t, 7, 16, 'rgba(5,3,10,.95)');
  g.restore();
};
/* 中式僵尸：清朝官帽、符纸遮脸、双臂平举、跳着走。hop = 0..1 跳跃高度 */
P.jiangshi = function (g, x, y, h, t, o) {
  o = o || {}; const hop = (o.hop || 0) * h * .13, yy = y - hop, w = h * .4, face = o.face || 0;
  g.save(); g.translate(x, 0); g.globalAlpha = o.alpha == null ? 1 : o.alpha;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, y, w * .45 * (1 - (o.hop || 0) * .3), h * .02, 0, 0, TAU); g.fill();
  /* 腿/靴 */
  g.fillStyle = '#0c0c12'; [-1, 1].forEach(s => { g.fillRect(s * w * .1 - w * .08, yy - h * .27, w * .16, h * .24); g.beginPath(); g.moveTo(s * w * .1 - w * .1, yy - h * .04); g.lineTo(s * w * .1 + w * .1, yy - h * .04); g.lineTo(s * w * .1 + w * .14, yy); g.lineTo(s * w * .1 - w * .14, yy); g.fill(); });
  /* 长袍 */
  const gd = g.createLinearGradient(0, yy - h * .72, 0, yy - h * .2); gd.addColorStop(0, '#17315a'); gd.addColorStop(1, '#0c1830'); g.fillStyle = gd; g.beginPath(); g.moveTo(-w * .24, yy - h * .72); g.lineTo(-w * .3, yy - h * .18); g.lineTo(w * .3, yy - h * .18); g.lineTo(w * .24, yy - h * .72); g.closePath(); g.fill();
  g.strokeStyle = '#b8903a'; g.lineWidth = Math.max(1, h * .008); g.beginPath(); g.moveTo(0, yy - h * .72); g.lineTo(0, yy - h * .18); g.stroke();   // 金色襟
  g.strokeStyle = 'rgba(200,160,70,.7)'; g.strokeRect(-w * .12, yy - h * .62, w * .24, h * .16); g.beginPath(); g.moveTo(-w * .12, yy - h * .54); g.lineTo(w * .12, yy - h * .54); g.stroke();   // 补子
  g.fillStyle = '#7a0a14'; g.fillRect(-w * .3, yy - h * .28, w * .6, h * .03);   // 红腰带
  /* 手臂（平举，僵直） */
  [-1, 1].forEach(s => { const ay = yy - h * .66 + Math.sin(t * 6 + s) * h * .004; g.fillStyle = '#14284a'; g.beginPath(); g.moveTo(s * w * .22, ay); g.lineTo(s * w * .78, ay - h * .04); g.lineTo(s * w * .8, ay + h * .03); g.lineTo(s * w * .22, ay + h * .1); g.closePath(); g.fill();
    g.fillStyle = '#9db78a'; g.beginPath(); g.ellipse(s * w * .83, ay - h * .005, h * .025, h * .03, 0, 0, TAU); g.fill(); g.strokeStyle = '#9db78a'; g.lineWidth = Math.max(1, h * .006); for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(s * w * .85, ay - h * .005 + k * h * .01); g.lineTo(s * w * .98, ay - h * .01 + k * h * .017); g.stroke(); } });
  /* 头：青灰色脸 + 官帽 + 符纸 */
  const hy = yy - h * .83, hr = h * .075; g.fillStyle = '#8fa684'; g.beginPath(); g.ellipse(0, hy, hr, hr * 1.18, 0, 0, TAU); g.fill();
  g.fillStyle = '#e9e0b8'; g.fillRect(-hr * .72, hy - hr * 1.1, hr * 1.44, hr * 2.7);   // 符纸
  g.fillStyle = '#b3141c'; g.font = `800 ${Math.max(8, hr * .62)}px "PingFang SC","Noto Sans SC",sans-serif`; g.textAlign = 'center'; ['敕', '令', '镇', '煞'].forEach((c, i) => g.fillText(c, 0, hy - hr * .5 + i * hr * .62)); g.strokeStyle = '#b3141c'; g.lineWidth = Math.max(1, hr * .06); g.strokeRect(-hr * .62, hy - hr * 1.0, hr * 1.24, hr * 2.5);
  g.fillStyle = '#a5171d'; g.fillRect(-hr * .72, hy - hr * 1.1, hr * 1.44, hr * .16);
  g.fillStyle = '#0a0a10'; g.beginPath(); g.moveTo(-hr * 1.15, hy - hr * .85); g.lineTo(-hr * .85, hy - hr * 1.9); g.lineTo(hr * .85, hy - hr * 1.9); g.lineTo(hr * 1.15, hy - hr * .85); g.closePath(); g.fill(); g.fillStyle = '#a5171d'; g.fillRect(-hr * 1.15, hy - hr * 1.0, hr * 2.3, hr * .2); g.fillStyle = '#d4a93a'; g.beginPath(); g.arc(0, hy - hr * 1.5, hr * .22, 0, TAU); g.fill();
  /* 眼睛红点（从符纸缝里露出） */
  if (face || (o.hop || 0) > .2) { g.fillStyle = 'rgba(255,50,30,.9)'; [-1, 1].forEach(s => { g.beginPath(); g.arc(s * hr * .35, hy - hr * .05, hr * .09, 0, TAU); g.fill(); }); }
  g.restore();
};
/* 镜中鬼 / 大头特写（用于跳吓与镜子）：只画脸 */
P.face = function (g, cx, cy, r, t, o) {
  o = o || {}; const open = o.open == null ? .6 : o.open;
  g.save(); g.translate(cx, cy);
  const aura = g.createRadialGradient(0, 0, r * .3, 0, 0, r * 1.7); aura.addColorStop(0, 'rgba(180,0,20,.5)'); aura.addColorStop(1, 'rgba(100,0,10,0)'); g.fillStyle = aura; g.fillRect(-r * 2, -r * 2, r * 4, r * 4);
  g.fillStyle = '#04020a'; g.beginPath(); g.moveTo(-r * 1.1, -r * 1.2); g.bezierCurveTo(-r * 1.7, -r * .2, -r * 1.5, r * 1.6, -r * 1.2, r * 2.4); g.lineTo(r * 1.2, r * 2.4); g.bezierCurveTo(r * 1.5, r * 1.6, r * 1.7, -r * .2, r * 1.1, -r * 1.2); g.fill();
  const fg = g.createRadialGradient(-r * .1, -r * .2, r * .1, 0, 0, r * 1.15); fg.addColorStop(0, '#f6f1ee'); fg.addColorStop(1, '#a89c9c'); g.fillStyle = fg; g.beginPath(); g.ellipse(0, 0, r * .86, r * 1.08, 0, 0, TAU); g.fill();
  g.fillStyle = '#050205'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(s * r * .36, -r * .12, r * .22, r * .34, s * .15, 0, TAU); g.fill(); });
  g.fillStyle = 'rgba(255,40,30,.95)'; [-1, 1].forEach(s => { g.beginPath(); g.arc(s * r * .36 + Math.sin(t * 40) * r * .01, -r * .05, r * .07, 0, TAU); g.fill(); });
  g.fillStyle = '#10020a'; g.beginPath(); g.ellipse(0, r * .55, r * .3 * (.6 + open * .6), r * (.2 + open * .62), 0, 0, TAU); g.fill();
  g.fillStyle = '#e8e0d0'; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * r * .08 - r * .03, r * .38); g.lineTo(i * r * .08 + r * .03, r * .38); g.lineTo(i * r * .08, r * .5); g.fill(); }
  g.strokeStyle = 'rgba(160,0,18,.85)'; g.lineWidth = r * .07; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(s * r * .36, r * .2); g.quadraticCurveTo(s * r * .5, r * .9, s * r * .38, r * 1.7); g.stroke(); });
  [-1, 1].forEach(s => { g.fillStyle = '#04020a'; g.beginPath(); g.moveTo(s * r * .06, -r * 1.14); g.bezierCurveTo(s * r * 1.1, -r * 1.0, s * r * 1.0, r * .2, s * r * .95, r * 2); g.lineTo(s * r * .55, r * 2.1); g.bezierCurveTo(s * r * .35, r * .6, s * r * .2, -r * .3, s * r * .06, -r * 1.14); g.fill(); });
  g.restore();
};
/* 从棺材/地面伸出的手 */
P.hand = function (g, x, y, h, t, p) {
  g.save(); g.translate(x, y); const L = h * clamp(p, 0, 1); g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(0, 0, h * .12, h * .03, 0, 0, TAU); g.fill();
  g.strokeStyle = '#cfc6c0'; g.lineCap = 'round'; g.lineWidth = h * .075; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(h * .05 * Math.sin(t * 9), -L * .5, h * .03 * Math.sin(t * 7), -L); g.stroke();
  g.lineWidth = Math.max(1, h * .018); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(h * .03 * Math.sin(t * 7), -L); g.lineTo(h * .03 * Math.sin(t * 7) + k * h * .035, -L - h * .1 + Math.abs(k) * h * .018 + Math.sin(t * 12 + k) * h * .01); g.stroke(); }
  g.restore();
};
/* 黑色人影（跑过走廊/窗外）：白眼 */
P.shade = function (g, x, y, h, t, o) {
  o = o || {}; g.save(); g.translate(x, y); g.globalAlpha = o.alpha == null ? .92 : o.alpha; const k = Math.sin(t * 12) * h * .02;
  g.fillStyle = '#020104'; g.beginPath(); g.moveTo(-h * .12, 0); g.bezierCurveTo(-h * .2, -h * .4, -h * .14 + k, -h * .74, -h * .07, -h * .86); g.bezierCurveTo(-h * .08, -h * .98, h * .08, -h * .98, h * .07, -h * .86); g.bezierCurveTo(h * .14 + k, -h * .74, h * .2, -h * .4, h * .12, 0); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.96)'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(s * h * .028, -h * .9, h * .014, h * .024, 0, 0, TAU); g.fill(); });
  g.restore();
};

G.HFX = { Aud, Dark, P, rnd, clamp, lerp, TAU };
})(window);
