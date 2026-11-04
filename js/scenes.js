/* scenes.js — procedural scenes: Plaza (main hub), KTV hall, Fashion boutique.
   Every scene returns { env(hour), batches, dyn(mb,t,env), obstacles, bounds, portals, spots, spawn, camera, heightAt } */
(function (G) {
'use strict';
const { MB, hex, clamp } = G.World;
const PITCH = 0.70;                      // camera pitch used for billboard-ish halos (rad)
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/* ---------- procedural textures ---------- */
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function makeTextures(R) {
  const T = {};
  T.pave = R.paint(256, 256, (g, w, h) => {
    const r = rnd(7); g.fillStyle = '#9d97bd'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = 6 * (r() - .5); g.fillStyle = `rgb(${176 + v},${170 + v},${204 + v})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      const gr = g.createLinearGradient(x * 64, y * 64, x * 64 + 64, y * 64 + 64); gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(0,0,0,.10)'); g.fillStyle = gr; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  });
  T.glow = R.paint(128, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(.6, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { clamp: true });
  T.blob = R.paint(64, 64, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { clamp: true });
  T.ring = R.paint(256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke(); const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,.0)'); gr.addColorStop(.8, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { clamp: true });

  /* dais with neon rings */
  const dais = (g, w, h, em) => {
    const c = w / 2; if (!em) { const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, '#4b4378'); gr.addColorStop(1, '#2f2a55'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } else { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
    [[.96, 14, '#7ee8ff'], [.78, 5, '#b48cff'], [.45, 4, '#ff7ad9'], [.12, 4, '#7ee8ff']].forEach(([f, lw, col]) => { g.strokeStyle = em ? col : 'rgba(210,200,255,.55)'; g.lineWidth = lw; g.beginPath(); g.arc(c, c, c * f, 0, 7); g.stroke(); });
    if (!em) { g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; g.beginPath(); g.moveTo(c + Math.cos(a) * c * .12, c + Math.sin(a) * c * .12); g.lineTo(c + Math.cos(a) * c * .78, c + Math.sin(a) * c * .78); g.stroke(); } }
  };
  T.dais = R.paint(512, 512, (g, w, h) => dais(g, w, h, false)); T.daisEm = R.paint(512, 512, (g, w, h) => dais(g, w, h, true));

  /* generic office facade: cols x rows of windows inside a (16m x 14m) tile */
  T.facade = (seed, o) => {
    o = o || {}; const cols = o.cols || 5, rows = o.rows || 5, lit = o.lit == null ? .45 : o.lit, wall = o.wall || '#cfc6b3', glass = o.glass || ['#5d86b8', '#3b5a86'], warm = o.warm || ['#ffd98a', '#ffc766', '#9fe3ff', '#ffb0d8'];
    const W = 512, H = 512, r = rnd(seed), wins = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) wins.push([i, j, r() < lit, warm[(r() * warm.length) | 0]]);
    const cw = W / cols, ch = H / rows, ww = cw * .62, wh = ch * .58;
    const albedo = R.paint(W, H, (g) => {
      g.fillStyle = wall; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,.06)'; for (let j = 0; j < rows; j++) g.fillRect(0, (j + 1) * ch - 5, W, 5);
      wins.forEach(([i, j]) => {
        const x = i * cw + (cw - ww) / 2, y = j * ch + (ch - wh) / 2, gr = g.createLinearGradient(x, y, x + ww, y + wh); gr.addColorStop(0, glass[0]); gr.addColorStop(1, glass[1]);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 3, y - 3, ww + 6, wh + 6); g.fillStyle = gr; g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x, y + wh); g.lineTo(x + ww * .5, y); g.lineTo(x + ww * .75, y); g.lineTo(x + ww * .25, y + wh); g.fill();
        g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + ww / 2 - 1, y, 2, wh);
      });
    });
    const em = R.paint(W, H, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      wins.forEach(([i, j, on, col]) => { if (!on) return; const x = i * cw + (cw - ww) / 2, y = j * ch + (ch - wh) / 2; g.fillStyle = col; g.fillRect(x, y, ww, wh); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + ww / 2 - 1, y, 2, wh); });
    });
    return { tex: albedo, em };
  };

  /* shop-front glass curtain wall for the fashion mall (full-width single texture) */
  T.mall = (() => {
    const W = 1024, H = 512, cols = 12, rows = 4;
    const albedo = R.paint(W, H, (g) => {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#6aa6d6'); gr.addColorStop(.5, '#3e6ea6'); gr.addColorStop(1, '#2a4a80'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.16)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(k * 190, H); g.lineTo(k * 190 + 90, 0); g.lineTo(k * 190 + 140, 0); g.lineTo(k * 190 + 50, H); g.fill(); }
      g.fillStyle = '#e9edf5'; for (let i = 0; i <= cols; i++) g.fillRect(i * (W / cols) - 3, 0, 6, H); for (let j = 0; j <= rows; j++) g.fillRect(0, j * (H / rows) - 3, W, 6);
    });
    const r = rnd(33), em = R.paint(W, H, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { if (r() < .22) continue; g.fillStyle = ['#ffe9b8', '#fff3d6', '#cfeaff', '#ffd1ea'][(r() * 4) | 0]; g.globalAlpha = .55 + r() * .4; g.fillRect(i * (W / cols) + 4, j * (H / rows) + 4, W / cols - 8, H / rows - 8); }
      g.globalAlpha = 1; g.fillStyle = '#000'; for (let i = 0; i <= cols; i++) g.fillRect(i * (W / cols) - 3, 0, 6, H); for (let j = 0; j <= rows; j++) g.fillRect(0, j * (H / rows) - 3, W, 6);
    });
    return { tex: albedo, em };
  })();

  /* text signs: returns {tex,em} */
  T.sign = (text, o) => {
    o = o || {}; const W = o.w || 512, H = o.h || 128, font = o.font || `800 ${o.fs || 68}px "Arial Black","Helvetica Neue",Arial,"PingFang SC","Noto Sans SC",sans-serif`;
    const draw = (g, em) => {
      g.fillStyle = em ? '#000' : (o.bg || '#1b1738'); g.fillRect(0, 0, W, H);
      if (o.border) { g.strokeStyle = em ? o.border : o.border; g.lineWidth = 8; rrect(g, 8, 8, W - 16, H - 16, 14); g.stroke(); }
      g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (o.vertical) { const ch = [...text], step = H / ch.length; ch.forEach((c, i) => { g.fillStyle = o.fg || '#fff'; g.fillText(c, W / 2, step * (i + .5)); }); }
      else { g.shadowColor = o.fg || '#fff'; g.shadowBlur = em ? 18 : 0; g.fillStyle = o.fg || '#fff'; g.fillText(text, W / 2, H / 2 + 3); }
    };
    return { tex: R.paint(W, H, (g) => draw(g, false), { mip: false, clamp: true }), em: R.paint(W, H, (g) => draw(g, true), { mip: false, clamp: true }) };
  };

  T.mallDoor = (() => {
    const W = 256, H = 320, d = (g, em) => {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#fff6d8'); gr.addColorStop(1, '#ffd89a'); g.fillStyle = em ? '#c9a05a' : gr; g.fillRect(0, 0, W, H);
      g.fillStyle = em ? '#000' : '#e8edf5'; g.fillRect(W / 2 - 4, 0, 8, H); g.fillRect(0, 0, W, 8); g.fillRect(0, 0, 8, H); g.fillRect(W - 8, 0, 8, H);
      if (!em) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(30, H); g.lineTo(80, 0); g.lineTo(110, 0); g.lineTo(60, H); g.fill(); }
    };
    return { tex: R.paint(W, H, (g) => d(g, false), { mip: false, clamp: true }), em: R.paint(W, H, (g) => d(g, true), { mip: false, clamp: true }) };
  })();
  T.ktvDoor = (() => {
    const W = 256, H = 320, d = (g, em) => {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a0f2f'); gr.addColorStop(1, '#6a1a38'); g.fillStyle = em ? '#000' : gr; g.fillRect(0, 0, W, H);
      if (em) { const r = g.createRadialGradient(W / 2, H * .75, 6, W / 2, H * .75, 150); r.addColorStop(0, 'rgba(255,120,90,.9)'); r.addColorStop(1, 'rgba(255,120,90,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); }
      else {
        for (let s = 0; s < 6; s++) { g.fillStyle = `rgb(${150 - s * 12},${28},${44})`; g.fillRect(70, 150 + s * 28, 116, 26); }
        ['#b21d2c', '#8e1523'].forEach((c, k) => { for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? c : '#c4283a'; if (k === 0) g.fillRect(i * 12, 0, 12, H); else g.fillRect(W - 72 + i * 12, 0, 12, H); } });
        g.fillStyle = '#7a1020'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(40, 80, 72, 0); g.fill(); g.beginPath(); g.moveTo(W, 0); g.quadraticCurveTo(W - 40, 80, W - 72, 0); g.fill();
      }
    };
    return { tex: R.paint(W, H, (g) => d(g, false), { mip: false, clamp: true }), em: R.paint(W, H, (g) => d(g, true), { mip: false, clamp: true }) };
  })();

  /* interiors */
  T.checker = R.paint(256, 256, (g) => { g.fillStyle = '#241a3d'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#34265a'; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128); g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.fillRect(i * 128 + 6, j * 128 + 6, 116, 30); });
  T.wood = R.paint(256, 256, (g) => { g.fillStyle = '#c99565'; g.fillRect(0, 0, 256, 256); const r = rnd(5); for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(${90 + r() * 40},${50 + r() * 30},20,.25)`; g.fillRect(0, i * 32, 256, 31); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, i * 32, 256, 2); } });
  T.stage = R.paint(256, 256, (g) => { g.fillStyle = '#2a2140'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.stroke(); } });
  T.stageEm = R.paint(256, 256, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ff5fc8'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 250, 256, 6); });
  T.curtain = R.paint(128, 256, (g) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#a3182c' : '#c5283f'; g.fillRect(i * 8, 0, 8, 256); } const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(0,0,0,.0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256); });
  T.ktvScreen = (() => {
    const W = 1024, H = 360, d = (g, em) => {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#ff4fa8'); gr.addColorStop(.5, '#6a4cff'); gr.addColorStop(1, '#27d6ff'); g.fillStyle = em ? gr : '#150f30'; g.fillRect(0, 0, W, H);
      g.fillStyle = em ? 'rgba(0,0,0,.35)' : '#000'; g.fillRect(0, 0, W, H);
      g.font = '800 120px "Arial Black",Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.shadowColor = '#ff7ad9'; g.shadowBlur = em ? 30 : 0; g.fillText('♪ STAR KTV ♪', W / 2, H * .4);
      g.font = '700 54px "PingFang SC","Noto Sans SC",sans-serif'; g.shadowBlur = 0; g.fillStyle = '#dcd4ff'; g.fillText('点歌排队 · 上台开唱', W / 2, H * .75);
    };
    return { tex: R.paint(1024, 360, (g) => d(g, false), { mip: false, clamp: true }), em: R.paint(1024, 360, (g) => d(g, true), { mip: false, clamp: true }) };
  })();
  T.mirror = R.paint(256, 512, (g) => { const gr = g.createLinearGradient(0, 0, 256, 512); gr.addColorStop(0, '#e9f4ff'); gr.addColorStop(1, '#a8c6ea'); g.fillStyle = gr; g.fillRect(0, 0, 256, 512); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(40, 512); g.lineTo(150, 0); g.lineTo(200, 0); g.lineTo(90, 512); g.fill(); }, { clamp: true });
  T.mirrorEm = R.paint(256, 512, (g) => { g.fillStyle = '#4a5a70'; g.fillRect(0, 0, 256, 512); }, { clamp: true });
  T.rack = R.paint(256, 128, (g) => { const r = rnd(12); g.fillStyle = '#d9d4e6'; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 14; i++) { g.fillStyle = ['#ef6a8a', '#7aa8ff', '#ffd166', '#6fd6b0', '#c08cff', '#ffffff'][(r() * 6) | 0]; g.fillRect(i * 18 + 3, 14, 14, 100); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(i * 18 + 3, 14, 3, 100); } });
  return T;
}

/* ---------- helpers to add glows ---------- */
function halo(mb, x, y, z, s, col) { // camera-facing glow quad
  const c = Math.cos(PITCH), sn = Math.sin(PITCH), ux = [0, c, -sn];
  const P = (a, b) => [x + a * s, y + ux[1] * b * s, z + ux[2] * b * s];
  mb.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col);
}
function pool(mb, x, z, r, col, y) { mb.floor(x - r, z - r, x + r, z + r, y == null ? .03 : y, col); }

/* ---------- shared building bits ---------- */
function mats(R, T) {
  const solid = (r, g, b) => R.solidTex([r, g, b, 255]);
  const M = {
    pave: { tex: T.pave },
    plain: {},
    glowAdd: (strength) => ({ tex: T.glow, mode: 2, glow: strength }),
    emSolid: (hexc, dayE, nightE) => { const c = hex(hexc); return { em: solid(c[0] * 255, c[1] * 255, c[2] * 255), emDay: dayE, emNight: nightE }; },
  };
  return M;
}

/* =====================================================================
   PLAZA
   ===================================================================== */
function makePlaza(R, T) {
  const M = mats(R, T), S = { batches: [], obstacles: [], portals: [], spots: [], lamps: [] };
  const add = (mb, mat) => { if (mb.i.length) S.batches.push(R.batch(mb, mat)); return mb; };
  const obs = (x0, z0, x1, z1) => S.obstacles.push({ x0, z0, x1, z1 });

  /* ground */
  { const mb = new MB(); mb.floor(-110, -40, 110, 70, 0, [1, 1, 1], [0, 0, 220 / 4, 110 / 4]); add(mb, { tex: T.pave }); }
  /* outer darker apron so the plaza edge reads */
  { const mb = new MB(); mb.floor(-110, 18.6, 110, 70, .012, [.55, .5, .7], [0, 0, 1, 1]); add(mb, {}); mb.floor; }

  /* dais */
  { const mb = new MB(); mb.cyl(0, 2, 0, .2, 5.3, 5.3, 48, [.28, .24, .5]);
    add(mb, {});
    const t = new MB(); t.disc(0, 2, .205, 5, 64, [1, 1, 1]); add(t, { tex: T.dais, em: T.daisEm, emDay: .55, emNight: 1.6 }); }

  /* ---- buildings ---- */
  const roofMat = {}, roofCol = [.26, .24, .34];
  const building = (x0, x1, z0, z1, h, facade, tile, o) => {
    o = o || {}; const mb = new MB(); mb.box(x0, 0, z0, x1, h, z1, [1, 1, 1], tile, { noTop: true }); add(mb, { tex: facade.tex, em: facade.em, emDay: 0, emNight: o.emNight || 1.5 });
    const r = new MB(); r.box(x0 - .15, h, z0 - .15, x1 + .15, h + .5, z1 + .15, roofCol); add(r, roofMat);
    obs(x0 - .2, z0 - .2, x1 + .2, z1 + .2);
  };
  const FA = (seed, o) => T.facade(seed, o);

  /* backdrop towers (no collision) */
  { const r = rnd(99), facs = [FA(1, { wall: '#9ea6c4', cols: 6, rows: 8, lit: .5 }), FA(2, { wall: '#b6a9c9', cols: 5, rows: 8, lit: .4 }), FA(3, { wall: '#8c9bb8', cols: 6, rows: 7, lit: .55 })];
    for (let x = -96, k = 0; x < 96; x += 7 + r() * 6, k++) {
      const w = 7 + r() * 6, h = 20 + r() * 34, z0 = -52 - r() * 12, f = facs[k % 3]; const mb = new MB(); mb.box(x, 0, z0, x + w, h, z0 + 11, [1, 1, 1], [16, 14], { noTop: true }); add(mb, { tex: f.tex, em: f.em, emNight: 1.5 });
      const rf = new MB(); rf.box(x - .1, h, z0 - .1, x + w + .1, h + .6, z0 + 11.1, roofCol); add(rf, roofMat);
      if (r() < .45) { const gl = new MB(); halo(gl, x + w / 2, h + 1.5, z0 + 11.2, 3.2, r() < .5 ? [1, .3, .6] : [.3, .8, 1]); add(gl, { tex: T.glow, mode: 2, glow: e => e.night * .9 }); }
    } }
  /* mid-distance towers flanking the passage between the buildings */
  building(-30, -22, -34, -17, 22, FA(4, { wall: '#b3a5c9', cols: 4, rows: 6, lit: .5 }), [16, 14]);
  building(18, 28, -34, -17, 26, FA(5, { wall: '#9eb0d0', cols: 4, rows: 7, lit: .55 }), [16, 14]);
  building(-6.2, 4.2, -40, -16, 19, FA(6, { wall: '#c3b8d8', cols: 4, rows: 6, lit: .5 }), [16, 14]);

  /* FASHION DISTRICT (curved glass mall) */
  { const x0 = -24, x1 = -6, zf = -15, h = 9.5;
    const mb = new MB(); mb.box(x0, 0, zf - 12, x1, h, zf, [1, 1, 1], [x1 - x0, h], { noTop: true }); add(mb, { tex: T.mall.tex, em: T.mall.em, emDay: .25, emNight: 1.6 });
    const rf = new MB(); rf.box(x0 - .2, h, zf - 12.2, x1 + .2, h + .5, zf + .2, [.85, .88, .95]); add(rf, roofMat); obs(x0 - .2, zf - 12, x1 + .2, zf + .2);
    // arch canopy
    const ar = new MB(); ar.arch(-14, 0, zf + .05, zf + 1.7, 6.0, 5.5, 0, Math.PI, 28, [.88, .92, 1]); add(ar, {});
    const ar2 = new MB(); ar2.arch(-14, 0, zf + 1.72, zf + 1.78, 5.45, 5.25, 0, Math.PI, 28, [1, 1, 1]); add(ar2, M.emSolid('#7ee8ff', .9, 2.4));
    // door
    const d = new MB(); d.wall(-15.4, 0, -12.6, 3.6, zf + .06, [1, 1, 1]); add(d, { tex: T.mallDoor.tex, em: T.mallDoor.em, emDay: .6, emNight: 1.5 });
    // sign
    const sg = T.sign('FASHION DISTRICT', { w: 1024, h: 150, fs: 92, bg: '#0f1c3a', fg: '#e8f6ff', border: '#7ee8ff' }); const sb = new MB(); sb.box(-19, 4.1, zf + .02, -9, 5.6, zf + .45, [1, 1, 1], [10, 1.5], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.6 });
    // red carpet
    const c = new MB(); c.floor(-15.1, -15, -12.9, -11.2, .035, [.78, .12, .18]); add(c, {});
    // glow
    const gl = new MB(); pool(gl, -14, -11.5, 6, [.4, .85, 1]); halo(gl, -14, 2.2, zf + 2, 6.5, [.6, .9, 1]); add(gl, { tex: T.glow, mode: 2, glow: e => .12 + e.night * .5 });
    S.portals.push({ id: 'boutique', x: -14, z: -12.6, r: 1.9, label: '时尚街 · 试衣间', color: [.5, .9, 1] }); }

  /* STAR KTV LOBBY */
  { const x0 = 4.2, x1 = 18, zf = -15, h = 8.5, dc = 11;
    const f = FA(8, { wall: '#3b2f63', glass: ['#7a5cc0', '#432c80'], cols: 4, rows: 4, lit: .6, warm: ['#ff9de0', '#ffd98a', '#8fe9ff'] });
    const mb = new MB(); mb.box(x0, 0, zf - 12, x1, h, zf, [1, 1, 1], [16, 12], { noTop: true }); add(mb, { tex: f.tex, em: f.em, emDay: 0, emNight: 1.6 });
    const rf = new MB(); rf.box(x0 - .2, h, zf - 12.2, x1 + .2, h + .5, zf + .2, [.2, .15, .35]); add(rf, roofMat); obs(x0 - .2, zf - 12, x1 + .2, zf + .2);
    const d = new MB(); d.wall(dc - 1.6, 0, dc + 1.6, 3.8, zf + .06, [1, 1, 1]); add(d, { tex: T.ktvDoor.tex, em: T.ktvDoor.em, emDay: .7, emNight: 1.5 });
    const nf = new MB(); const zz = zf + .1; nf.box(dc - 1.9, 0, zz, dc - 1.6, 4.1, zz + .3, [1, 1, 1]); nf.box(dc + 1.6, 0, zz, dc + 1.9, 4.1, zz + .3, [1, 1, 1]); nf.box(dc - 1.9, 3.8, zz, dc + 1.9, 4.1, zz + .3, [1, 1, 1]);
    add(nf, M.emSolid('#ff4fc3', .8, 1.4));
    const sg = T.sign('STAR KTV', { w: 1024, h: 220, fs: 150, bg: '#14092a', fg: '#ffe2f6', border: '#ff4fc3' }), sb = new MB(); sb.box(6, 5.0, zf + .02, 16, 7.2, zf + .45, [1, 1, 1], [10, 2.2], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .6, emNight: 1.8 });
    const sg2 = T.sign('LOBBY', { w: 512, h: 100, fs: 70, bg: '#14092a', fg: '#9fe9ff', border: '#7ee8ff' }), sb2 = new MB(); sb2.box(8.8, 4.25, zf + .02, 13.2, 4.85, zf + .4, [1, 1, 1], [4.4, .6], { noBack: true, noSides: true, noTop: true }); add(sb2, { tex: sg2.tex, em: sg2.em, emDay: .6, emNight: 1.8 });
    const c = new MB(); c.floor(dc - 1.3, -15, dc + 1.3, -11.2, .035, [.75, .1, .2]); add(c, {});
    const gl = new MB(); pool(gl, dc, -11.8, 6.5, [1, .3, .75]); halo(gl, dc, 2.4, zf + 1.6, 6, [1, .4, .8]); add(gl, { tex: T.glow, mode: 2, glow: e => .06 + e.night * .65 });
    S.portals.push({ id: 'ktv', x: dc, z: -12.6, r: 1.9, label: 'STAR KTV · 大堂', color: [1, .4, .8] }); }

  /* cafe between them */
  { const x0 = -5, x1 = 3.4, zf = -13.4, h = 5.2, f = FA(9, { wall: '#e3c9a6', glass: ['#ffd9a0', '#c9904a'], cols: 3, rows: 2, lit: .9, warm: ['#ffd98a', '#ffe8b0'] });
    const mb = new MB(); mb.box(x0, 0, zf - 8, x1, h, zf, [1, 1, 1], [8.4, 5.2], { noTop: true }); add(mb, { tex: f.tex, em: f.em, emNight: 1.6 });
    const rf = new MB(); rf.box(x0 - .2, h, zf - 8.2, x1 + .2, h + .4, zf + .2, [.5, .35, .3]); add(rf, roofMat); obs(x0 - .2, zf - 8, x1 + .2, zf + .2);
    const sg = T.sign('CAFE 咖啡', { w: 512, h: 100, fs: 64, bg: '#3a2418', fg: '#ffe2b0', border: '#ffb060' }), sb = new MB(); sb.box(-2.5, 3.0, zf + .02, 1, 4.1, zf + .35, [1, 1, 1], [3.5, 1.1], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .3, emNight: 1.5 });
    const aw = new MB(); for (let i = 0; i < 8; i++) aw.box(x0 + .3 + i * 1.02, 2.5, zf, x0 + .3 + (i + 1) * 1.02, 2.9, zf + 1.3, i % 2 ? [1, .95, .9] : [.9, .35, .3], null, { noBack: true }); add(aw, {}); }

  /* side blocks */
  building(-40, -26, -16, 16, 17, FA(10, { wall: '#c0b7d3', cols: 6, rows: 6, lit: .5 }), [16, 14]);
  building(24, 40, -16, 16, 14, FA(11, { wall: '#bfc9d9', cols: 5, rows: 5, lit: .5 }), [16, 14]);
  { const sg = T.sign('HOME 公寓', { w: 512, h: 100, fs: 64, bg: '#14264a', fg: '#c9e6ff', border: '#7ac0ff' }); const sb = new MB(); sb.box(23.7, 6.0, -4, 23.95, 7.4, 2.2, [1, 1, 1], null, { noFront: true, noBack: true, noTop: true, noSides: true }); sb.quad([23.6, 6.0, -4], [23.6, 6.0, 2.2], [23.6, 7.4, 2.2], [23.6, 7.4, -4], [-1, 0, 0], [0, 0, 1, 1], [1, 1, 1]); add(sb, { tex: sg.tex, em: sg.em, emNight: 1.6 }); }

  /* neon pole signs */
  { const mk = (text, x, col, bg, bd) => { const sg = T.sign(text, { w: 128, h: 512, fs: 84, vertical: true, bg, fg: col, border: bd }); const mb = new MB(); mb.box(x - .12, 0, -12.7, x + .12, 3.6, -12.5, [.25, .22, .35]); add(mb, {}); const sb = new MB(); sb.box(x - .7, 3.6, -12.75, x + .7, 8.4, -12.5, [1, 1, 1], [1.4, 4.8], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.8 }); const gl = new MB(); halo(gl, x, 6, -12, 4.2, hex(bd)); add(gl, { tex: T.glow, mode: 2, glow: e => e.night * .5 }); obs(x - .2, -12.8, x + .2, -12.4); };
    mk('K歌乐园', 2.4, '#ffe2f6', '#14092a', '#ff4fc3'); mk('时尚街', -6.6, '#e8f6ff', '#0f1c3a', '#7ee8ff'); }

  /* lamps, planters, trees, benches */
  { const poles = new MB(), heads = new MB(), halos = new MB(), pools = new MB();
    [[-20, -11.5], [-9.5, -11.5], [1, -11], [14.5, -11.5], [20.5, -11.5], [-21, 5], [-9, 12], [9, 12], [21, 6], [-12, 1], [14, 2]].forEach(([x, z]) => {
      poles.cyl(x, z, 0, 4.4, .09, .06, 8, [.2, .18, .3]); poles.cyl(x, z, 0, .35, .2, .14, 8, [.2, .18, .3]); heads.sphere(x, 4.55, z, .3, .3, .3, [1, 1, 1], 8);
      halo(halos, x, 4.55, z, 3.2, [1, .8, .45]); pool(pools, x, z, 3.4, [1, .78, .45]); obs(x - .22, z - .22, x + .22, z + .22); S.lamps.push([x, z]);
    });
    add(poles, {}); add(heads, M.emSolid('#fff0c8', .35, 2.4)); add(halos, { tex: T.glow, mode: 2, glow: e => e.night * .75 }); add(pools, { tex: T.glow, mode: 2, glow: e => e.night * .22 }); }
  { const mb = new MB(), bush = new MB();
    [[-18, -13], [-10, -13], [7.5, -13], [14.5, -13], [-7.5, 9.5], [7.5, 9.5], [-2.5, 13], [2.5, 13], [-23, 12], [22, 12]].forEach(([x, z], i) => {
      mb.box(x - .7, 0, z - .7, x + .7, .55, z + .7, [.82, .8, .9], null); bush.sphere(x, .95, z, .8, .62, .8, [.28 + (i % 3) * .04, .62, .36], 8); bush.sphere(x + .3, 1.1, z - .2, .5, .45, .5, [.34, .72, .42], 7); obs(x - .75, z - .75, x + .75, z + .75);
    }); add(mb, {}); add(bush, {}); }
  { const tr = new MB(), lf = new MB(), flowers = new MB();
    [[-22.5, 9], [-22.5, 2], [22.5, 9], [22.5, 0.5], [-16, 14.5], [16, 14.5]].forEach(([x, z], i) => { tr.cyl(x, z, 0, 3, .22, .16, 8, [.4, .28, .2]); lf.sphere(x, 4.2, z, 1.9, 1.6, 1.9, [.26, .6 + (i % 2) * .06, .34], 9); lf.sphere(x + .8, 3.5, z + .5, 1.2, 1.0, 1.2, [.32, .68, .4], 8); lf.sphere(x - .8, 3.7, z - .4, 1.3, 1.1, 1.3, [.3, .64, .38], 8); obs(x - .3, z - .3, x + .3, z + .3); });
    add(tr, {}); add(lf, {});
    [[-14, 7.6], [-14, 12.4], [14, 12.4], [8, 7.5]].forEach(([x, z]) => { const b = new MB(); b.box(x - 1.2, .45, z - .35, x + 1.2, .6, z + .35, [.5, .36, .3]); b.box(x - 1.2, .6, z - .38, x + 1.2, 1.1, z - .3, [.5, .36, .3]); b.box(x - 1.1, 0, z - .3, x - .95, .45, z + .3, [.25, .22, .3]); b.box(x + .95, 0, z - .3, x + 1.1, .45, z + .3, [.25, .22, .3]); add(b, {}); obs(x - 1.2, z - .45, x + 1.2, z + .45); }); }

  S.bounds = { x0: -23.5, x1: 22.5, z0: -14.0, z1: 17.5 };
  S.spawn = [0, 8.5];
  S.camera = { dist: 27, pitch: 0.50, fov: 0.74, clampX: [-12, 12], clampZ: [-8, 6], lead: 4 };
  S.npcRect = { x0: -21, x1: 20, z0: -10, z1: 16 };
  S.heightAt = () => 0;
  S.name = '星光广场'; S.indoor = false;
  S.env = h => G.World.envAt(h);
  S.hotspots = [];
  return S;
}

/* =====================================================================
   KTV HALL
   ===================================================================== */
function makeKTV(R, T) {
  const M = mats(R, T), S = { batches: [], obstacles: [], portals: [], hotspots: [] };
  const add = (mb, mat) => { if (mb.i.length) S.batches.push(R.batch(mb, mat)); };
  const obs = (x0, z0, x1, z1) => S.obstacles.push({ x0, z0, x1, z1 });
  const X0 = -16, X1 = 16, Z0 = -12, Z1 = 12;
  { const mb = new MB(); mb.floor(X0, Z0, X1, Z1, 0, [1, 1, 1], [0, 0, (X1 - X0) / 4, (Z1 - Z0) / 4]); add(mb, { tex: T.checker, em: R.black }); }
  { const dark = new MB(); dark.floor(-80, -60, 80, 60, -.02, [.03, .02, .06]); add(dark, {}); }
  // walls
  { const wl = [.22, .17, .38]; const mb = new MB(); mb.box(X0 - .5, 0, Z0 - .5, X1 + .5, 8, Z0, wl, null, { noBack: true }); mb.box(X0 - .5, 0, Z0, X0, 6, Z1, wl); mb.box(X1, 0, Z0, X1 + .5, 6, Z1, wl); add(mb, {}); }
  { const mb = new MB(); mb.floor(X0, Z0, X1, Z0 + .4, .01, [1, 1, 1]); }
  // wall neon strips
  { const mb = new MB(); mb.box(X0 + .02, 3.2, Z0 + .02, X1 - .02, 3.35, Z0 + .12, [1, 1, 1]); mb.box(X0 + .02, 3.2, Z0, X0 + .14, 3.35, Z1, [1, 1, 1]); mb.box(X1 - .14, 3.2, Z0, X1 - .02, 3.35, Z1, [1, 1, 1]); add(mb, M.emSolid('#ff4fc3', .9, 1.15)); }
  // stage
  { const sx0 = -9.5, sx1 = 9.5, sz0 = -12, sz1 = -5.5, sh = 1.1;
    const mb = new MB(); mb.box(sx0, 0, sz0, sx1, sh, sz1, [1, 1, 1], [4, 4]); add(mb, { tex: T.stage, em: T.stageEm, emDay: .8, emNight: .9 });
    const st = new MB(); st.box(-2.5, 0, sz1, 2.5, .55, sz1 + .9, [.3, .24, .5]); add(st, {});
    obs(-2.5, sz1, 2.5, sz1 + .9);
    const scr = new MB(); scr.wall(-8.5, 1.9, 8.5, 6.6, Z0 + .13, [1, 1, 1]); add(scr, { tex: T.ktvScreen.tex, em: T.ktvScreen.em, emDay: 1, emNight: 1.6 });
    const cu = new MB(); cu.box(-13, 0, Z0 + .1, -9.7, 7, Z0 + 1.1, [1, 1, 1], [3, 7]); cu.box(9.7, 0, Z0 + .1, 13, 7, Z0 + 1.1, [1, 1, 1], [3, 7]); cu.box(-13, 6.4, Z0 + .1, 13, 7.2, Z0 + 1.3, [1, 1, 1], [3, 7]); add(cu, { tex: T.curtain, em: R.black });
    const gl = new MB(); [[-5, -9, [1, .3, .8]], [0, -8.3, [.4, .8, 1]], [5, -9, [1, .85, .3]]].forEach(([x, z, c]) => { pool(gl, x, z, 4.2, c, sh + .02); halo(gl, x, 4.5, z - 1, 5, c); }); add(gl, { tex: T.glow, mode: 2, glow: .55 });
    S.stage = { x0: sx0, x1: sx1, z0: sz0, z1: sz1, h: sh, mic: [0, sz0 + 3.2] };
  }
  // song machine
  { const x = -11.2, z = -2.4; const mb = new MB(); mb.box(x - .7, 0, z - .45, x + .7, 2.0, z + .45, [.16, .12, .3]); add(mb, {});
    const sg = T.sign('点歌机', { w: 256, h: 160, fs: 60, bg: '#12082a', fg: '#9fe9ff', border: '#ff4fc3' }); const sc = new MB(); sc.box(x - .62, 1.0, z + .44, x + .62, 1.9, z + .5, [1, 1, 1], [1.24, .9], { noBack: true, noSides: true, noTop: true }); add(sc, { tex: sg.tex, em: sg.em, emDay: 1, emNight: 2 });
    const tp = new MB(); tp.box(x - .75, 2.0, z - .5, x + .75, 2.1, z + .5, [.9, .3, .75]); add(tp, M.emSolid('#ff4fc3', 1, 2.5));
    const gl = new MB(); halo(gl, x, 1.5, z + 1, 3, [.6, .9, 1]); pool(gl, x, z + 1.4, 2.4, [.4, .85, 1], .03); add(gl, { tex: T.glow, mode: 2, glow: .7 });
    obs(x - .75, z - .5, x + .75, z + .5);
    S.hotspots.push({ id: 'songs', x, z: z + 1.7, r: 2.1, label: '点歌', color: [.4, .85, 1] });
  }
  // sofas and tables
  { const mb = new MB(); const sofa = (x0, z0, x1, z1) => { mb.box(x0, 0, z0, x1, .55, z1, [.55, .12, .3]); mb.box(x0, .55, z0, x1, 1.2, z0 + .35, [.62, .16, .36]); obs(x0, z0, x1, z1); };
    for (let k = 0; k < 3; k++) { const z = -1 + k * 5; sofa(11.8, z, 15.6, z + 2.4); mb.box(8.2, 0, z + .4, 10.2, .7, z + 2, [.15, .1, .25]); obs(8.2, z + .4, 10.2, z + 2); mb.box(8.7, .7, z + .8, 9.7, .78, z + 1.6, [.4, .85, 1]); }
    add(mb, {}); const em = new MB(); for (let k = 0; k < 3; k++) { const z = -1 + k * 5; em.box(8.7, .7, z + .8, 9.7, .74, z + 1.6, [1, 1, 1]); } add(em, M.emSolid('#7ee8ff', .8, 2)); }
  // exit door
  { const mb = new MB(); mb.box(-16.05, 0, 4.8, -15.95, 3.4, 7.2, [1, 1, 1]); add(mb, M.emSolid('#7dffb0', 1, 2.4)); const gl = new MB(); pool(gl, -14.4, 6, 3, [.4, 1, .6], .03); add(gl, { tex: T.glow, mode: 2, glow: .6 });
    const sg = T.sign('EXIT 出口', { w: 256, h: 80, fs: 44, bg: '#06261a', fg: '#aaffd0', border: '#7dffb0' }); const sb = new MB(); sb.quad([-15.9, 3.5, 6.6], [-15.9, 3.5, 5.4], [-15.9, 4.2, 5.4], [-15.9, 4.2, 6.6], [1, 0, 0], [0, 0, 1, 1], [1, 1, 1]); add(sb, { tex: sg.tex, em: sg.em, emDay: 1, emNight: 2 });
    S.portals.push({ id: 'plaza', x: -14.2, z: 6, r: 1.7, label: '回到星光广场', color: [.4, 1, .6], spawn: [31.05, -17.15] }); }
  // disco-ball light pools on the floor
  { const gl = new MB(); [[8, 7, [1, .4, .8]], [-6, 6, [.4, .8, 1]], [2, 2, [1, .8, .4]], [-3, 9, [.7, .5, 1]]].forEach(([x, z, c]) => pool(gl, x, z, 3.6, c, .03)); add(gl, { tex: T.glow, mode: 2, glow: .3 }); }
  S.bounds = { x0: X0 + 1, x1: X1 - 1, z0: Z0 + .8, z1: Z1 - .8 }; S.spawn = [-12.2, 6];
  S.camera = { dist: 27, pitch: 0.66, fov: 0.74, clampX: [-7, 7], clampZ: [-6, 5], lead: 3 };
  S.npcRect = { x0: -8, x1: 14, z0: -4, z1: 10 };
  S.heightAt = (x, z) => (S.stage && x > S.stage.x0 && x < S.stage.x1 && z < S.stage.z1 + .2 && z > S.stage.z0) ? S.stage.h : 0;
  S.name = 'STAR KTV 大堂'; S.indoor = true;
  const E = { indoor: true, night: 1, gold: 0, day: 0, dir: [.25, 1, .35], sun: [.28, .24, .35], amb: [.62, .52, .78], top: [.03, .02, .08], bot: [.03, .02, .08], fog: [.04, .02, .09], charAmb: [.56, .50, .74], charSun: [.34, .30, .42], line: [.1, .06, .14], fogNear: 60, fogFar: 140 };
  S.env = () => E;
  return S;
}

/* =====================================================================
   BOUTIQUE
   ===================================================================== */
function makeBoutique(R, T) {
  const M = mats(R, T), S = { batches: [], obstacles: [], portals: [], hotspots: [] };
  const add = (mb, mat) => { if (mb.i.length) S.batches.push(R.batch(mb, mat)); };
  const obs = (x0, z0, x1, z1) => S.obstacles.push({ x0, z0, x1, z1 });
  const X0 = -12, X1 = 12, Z0 = -10, Z1 = 10;
  { const mb = new MB(); mb.floor(X0, Z0, X1, Z1, 0, [1, 1, 1], [0, 0, 6, 5]); add(mb, { tex: T.wood }); const d = new MB(); d.floor(-80, -60, 80, 60, -.02, [.08, .06, .1]); add(d, {}); }
  { const wl = [.98, .88, .92]; const mb = new MB(); mb.box(X0 - .5, 0, Z0 - .5, X1 + .5, 7, Z0, wl, null, { noBack: true }); mb.box(X0 - .5, 0, Z0, X0, 5.5, Z1, wl); mb.box(X1, 0, Z0, X1 + .5, 5.5, Z1, wl); add(mb, {}); }
  { const sg = T.sign('FASHION DISTRICT · 试衣间', { w: 1024, h: 140, fs: 70, bg: '#fff0f6', fg: '#d0407f', border: '#ff7ab6' }); const sb = new MB(); sb.wall(-5, 4.6, 5, 6, Z0 + .05, [1, 1, 1]); add(sb, { tex: sg.tex, em: sg.em, emDay: .3, emNight: 1 }); }
  // mirror
  { const mb = new MB(); mb.box(-2.4, 0, Z0 + .05, 2.4, 3.8, Z0 + .3, [.95, .8, .9], null); add(mb, {}); const mr = new MB(); mr.wall(-2.1, .2, 2.1, 3.6, Z0 + .32, [1, 1, 1]); add(mr, { tex: T.mirror, em: T.mirrorEm, emDay: .4, emNight: .8 });
    const gl = new MB(); pool(gl, 0, Z0 + 3, 3.4, [1, .8, .95], .03); add(gl, { tex: T.glow, mode: 2, glow: .8 });
    S.hotspots.push({ id: 'wardrobe', x: 0, z: Z0 + 3.2, r: 2.2, label: '试衣镜', color: [1, .6, .85] }); }
  // racks
  { const mb = new MB(); const rack = (x0, z0, x1, z1) => { mb.box(x0, 0, z0, x1, 1.9, z1, [1, 1, 1], [x1 - x0 || 1, 1.9], { noTop: false }); obs(x0, z0, x1, z1); };
    [[-10, -7, -6, -6.3], [6, -7, 10, -6.3], [-10, 0, -6, .7], [6, 0, 10, .7], [-10, 6, -6, 6.7], [6, 6, 10, 6.7]].forEach(r => rack(...r)); add(mb, { tex: T.rack }); }
  { const mb = new MB(); mb.box(-3, 0, 5.5, 3, 1.1, 7, [.9, .6, .75]); mb.box(-3, 1.1, 5.5, 3, 1.2, 7, [1, 1, 1]); obs(-3, 5.5, 3, 7); add(mb, {}); }
  { const gl = new MB(); [[-8, -2, [1, .7, .9]], [8, -2, [1, .85, .6]], [0, 2, [1, 1, 1]]].forEach(([x, z, c]) => pool(gl, x, z, 4.5, c, .03)); add(gl, { tex: T.glow, mode: 2, glow: .35 }); }
  // exit
  { const mb = new MB(); mb.box(-12.05, 0, 4.8, -11.95, 3.4, 7.2, [1, 1, 1]); add(mb, M.emSolid('#7dffb0', 1, 2)); S.portals.push({ id: 'plaza', x: -10.3, z: 6, r: 1.7, label: '回到星光广场', color: [.4, 1, .6], spawn: [-14, -11.5] }); const gl = new MB(); pool(gl, -10.5, 6, 3, [.4, 1, .6], .03); add(gl, { tex: T.glow, mode: 2, glow: .6 }); }
  S.bounds = { x0: X0 + 1, x1: X1 - 1, z0: Z0 + 1.2, z1: Z1 - .8 }; S.spawn = [-9.5, 6];
  S.camera = { dist: 22, pitch: 0.7, fov: 0.74, clampX: [-5, 5], clampZ: [-5, 4], lead: 3 };
  S.npcRect = { x0: -8, x1: 9, z0: -4, z1: 5 }; S.heightAt = () => 0; S.name = '时尚街试衣间'; S.indoor = true;
  const E = { indoor: true, night: .3, gold: 0, day: 1, dir: [.2, 1, .5], sun: [.5, .46, .42], amb: [.78, .72, .82], top: [.9, .8, .9], bot: [.9, .8, .9], fog: [.9, .82, .9], charAmb: [.62, .6, .78], charSun: [.44, .42, .3], line: [.3, .18, .24], fogNear: 60, fogFar: 140 };
  S.env = () => E;
  return S;
}

G.Scenes = { makeTextures, makePlaza, makeKTV, makeBoutique, PITCH };
})(window);
