/* plaza.js — v3 plaza: curved waterfront shape, concert stage with LED countdown, sittable seats.
   Scenes.makePlazaV3(R, T, styleName) -> scene object. */
(function (G) {
'use strict';
const { MB, hex, clamp } = G.World;
const PITCH = 0.46;
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const mul = (c, k) => [c[0] * k[0], c[1] * k[1], c[2] * k[2]];

const STYLES = {
  cozy: { name: '暖色黄昏街区', hour: 17.7, pave: [1.16, .98, .80], apron: [.62, .5, .42], far: ['#d8b494', '#c79a82', '#e2c6a6'], mid: ['#e0bf9c', '#cfa585', '#e8d0ae', '#d9ae92', '#e5c7a4'], ktvWall: '#6b3e4a', cafeWall: '#ecd2a8', leaf: [1.12, 1, .78], flowers: ['#ff8a5c', '#ffd166', '#ff6f91', '#fff2c6', '#f4a261'], accent: '#ffb347', accent2: '#ff6fa8', mosaic: ['#f3dcb4', '#e7c690', '#d9a566', '#fff1d4'], gold: '#e9b24a', water: ['#74d3d0', '#3aa6b5'], sea: ['#4fb3c4', '#1f6f8f'], umb: [[.95, .42, .3], [1, .8, .35]] },
  neon: { name: '霓虹夜城', hour: 21.6, pave: [.86, .86, 1.06], apron: [.5, .46, .7], far: ['#8e97c4', '#a595c8', '#7b8dba'], mid: ['#9aa0cf', '#8f9fc9', '#b09fd0', '#9b95c8', '#8ea7cf'], ktvWall: '#3b2f63', cafeWall: '#d9c3a6', leaf: [.85, 1, .9], flowers: ['#ff5fc8', '#7ee8ff', '#b48cff', '#ffe27a', '#ff8ab0'], accent: '#7ee8ff', accent2: '#ff4fc3', mosaic: ['#4a3f86', '#35306a', '#5b4aa8', '#2a2552'], gold: '#9fe9ff', water: ['#4fd9ff', '#2a62d6'], sea: ['#2a7fd6', '#12306e'], umb: [[.35, .8, 1], [1, .35, .78]] },
  fresh: { name: '清新白天广场', hour: 12.6, pave: [1.02, 1.06, 1.12], apron: [.75, .8, .88], far: ['#dcd3ea', '#c6dceb', '#efdccb'], mid: ['#e9dcee', '#cfe6ee', '#f2e3d0', '#dbe8d6', '#efd5dc'], ktvWall: '#7b6bb8', cafeWall: '#fbe3c0', leaf: [.9, 1.12, .9], flowers: ['#ff7aa8', '#ffd84d', '#ffffff', '#9a7bff', '#ff9a5c'], accent: '#3fc9b5', accent2: '#ff7aa8', mosaic: ['#d8ecf6', '#bfe0ee', '#ffe4ea', '#fff7dc'], gold: '#e7b04a', water: ['#7ae6ef', '#3fa8d8'], sea: ['#5fd0e8', '#2b8fd0'], umb: [[1, .5, .6], [.4, .8, .85]] },
};

/* ---------- geometry helpers ---------- */
const CR = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return [0, 1].map(i => .5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)); };
function spline(ctrl, seg) { const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = []; for (let i = 1; i < P.length - 2; i++) for (let k = 0; k < seg; k++) out.push(CR(P[i - 1], P[i], P[i + 1], P[i + 2], k / seg)); out.push(ctrl[ctrl.length - 1]); return out; }
const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const scaleP = (P, k) => P.map(p => [p[0] * k, 4 + (p[1] - 4) * k]);
const edgeZ = (x, poly) => { let best = -1e9; for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) { const t = (x - a[0]) / (b[0] - a[0]); best = Math.max(best, a[1] + (b[1] - a[1]) * t); } } return best; };
const strip = (mb, A, B, y, col) => { for (let i = 0; i < A.length - 1; i++) mb.quad([A[i][0], y, A[i][1]], [A[i + 1][0], y, A[i + 1][1]], [B[i + 1][0], y, B[i + 1][1]], [B[i][0], y, B[i][1]], [0, 1, 0], [0, 0, 1, 1], col); };
const wallv = (mb, P, y0, y1, col) => { for (let i = 0; i < P.length - 1; i++) { const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1; mb.quad([P[i][0], y0, P[i][1]], [P[i + 1][0], y0, P[i + 1][1]], [P[i + 1][0], y1, P[i + 1][1]], [P[i][0], y1, P[i][1]], [dz / l, 0, -dx / l], [0, 0, 1, 1], col); } };

function makePlazaV3(R, T, styleName) {
  const ST = STYLES[styleName] || STYLES.cozy, A = hex(ST.accent), A2 = hex(ST.accent2);
  const S = { batches: [], obstacles: [], portals: [], hotspots: [], spots: [], lamps: [], seats: [], style: ST };
  const bbOf = (mb) => { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (let k = 0; k < mb.v.length; k += 11) for (let j = 0; j < 3; j++) { const v = mb.v[k + j]; if (v < a[j]) a[j] = v; if (v > b[j]) b[j] = v; } return [a, b]; };
  const add = (mb, mat) => { if (mb.i.length) { if (SHX || SHZ) for (let k = 0; k < mb.v.length; k += 11) { mb.v[k] += SHX; mb.v[k + 2] += SHZ; } const b = R.batch(mb, mat); b.bb = bbOf(mb); S.batches.push(b); } return mb; };
  /* occluders: things that can stand between camera and player fade to 10% (S.updateOcclusion) */
  S.occluders = [];
  const occ = (fn) => { const n0 = S.batches.length; fn(); const bs = S.batches.slice(n0).filter(b => b.bb && b.mat.mode === 0); if (!bs.length) return; const a = [1e9, 1e9, 1e9], c = [-1e9, -1e9, -1e9]; bs.forEach(b => { for (let j = 0; j < 3; j++) { a[j] = Math.min(a[j], b.bb[0][j]); c[j] = Math.max(c[j], b.bb[1][j]); } }); S.occluders.push({ bs, a, b: c, f: 1 }); };
  S.updateOcclusion = (eye, me, dt) => {
    const px = me.x, py = (me.y || 0) + .9, pz = me.z, pad = .2, k = Math.min(1, dt * 9);
    const hit = (o) => { const mn = [o.a[0] - pad, o.a[1] - pad, o.a[2] - pad], mx = [o.b[0] + pad, o.b[1] + pad, o.b[2] + pad];
      for (const [ox, oz] of [[0, 0], [.5, 0], [-.5, 0]]) for (const oy of [-.7, .5]) { const d = [px + ox - eye[0], py + oy - eye[1], pz + oz - eye[2]], len = Math.hypot(d[0], d[1], d[2]); let t0 = 0, t1 = Math.max(0, 1 - 2.6 / len), ok = true;
        for (let j = 0; j < 3; j++) { if (Math.abs(d[j]) < 1e-6) { if (eye[j] < mn[j] || eye[j] > mx[j]) { ok = false; break; } } else { let a = (mn[j] - eye[j]) / d[j], b = (mx[j] - eye[j]) / d[j]; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; } } }
        if (ok) return true; } return false; };
    for (const o of S.occluders) { const tg = hit(o) ? .1 : 1; o.f += (tg - o.f) * k; if (Math.abs(o.f - tg) < .01) o.f = tg; for (const b of o.bs) b.fade = o.f; }
  };
  const obs = (x0, z0, x1, z1) => S.obstacles.push({ x0, z0, x1, z1 });
  const solid = (c) => R.solidTex([c[0] * 255, c[1] * 255, c[2] * 255, 255]);
  const emMat = (c, d, n) => ({ em: solid(c), emDay: d, emNight: n });
  const halo = (mb, x, y, z, s, col) => { const c = Math.cos(PITCH), sn = Math.sin(PITCH); const P = (a, b) => [x + a * s, y + c * b * s, z - sn * b * s]; mb.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col); };
  const pool = (mb, x, z, r, col, y) => mb.floor(x - r, z - r, x + r, z + r, y == null ? .03 : y, col);
  const night = k => e => e.night * k, nightPlus = (a, b) => e => a + e.night * b;
  /* ===== 广场整体放大 K 倍：只拉开布局间距，物体本身大小不变 ===== */
  const K = 1.5, ZC = 4, ZB = ZC + (-13.5 - ZC) * K;
  const ZP = z => ZC + (z - ZC) * K;
  let SHX = 0, SHZ = 0;
  const withShift = (dx, dz, fn) => {
    const n = [S.obstacles.length, S.portals.length, S.hotspots.length, S.seats.length, S.lamps.length]; SHX = dx; SHZ = dz; fn(); SHX = 0; SHZ = 0;
    for (let i = n[0]; i < S.obstacles.length; i++) { const o = S.obstacles[i]; o.x0 += dx; o.x1 += dx; o.z0 += dz; o.z1 += dz; }
    for (let i = n[1]; i < S.portals.length; i++) { const o = S.portals[i]; o.x += dx; o.z += dz; }
    for (let i = n[2]; i < S.hotspots.length; i++) { const o = S.hotspots[i]; o.x += dx; o.z += dz; }
    for (let i = n[3]; i < S.seats.length; i++) { const o = S.seats[i]; o.x += dx; o.z += dz; o.ap[0] += dx; o.ap[1] += dz; o.hot.x = o.ap[0]; o.hot.z = o.ap[1]; }
    for (let i = n[4]; i < S.lamps.length; i++) { const o = S.lamps[i]; o[0] += dx; o[1] += dz; }
  };
  const at = (x, z, fn) => withShift((K - 1) * x, (K - 1) * (z - ZC), fn);
  const CX = 0, CZ = ZP(9);

  /* ---------- shape ---------- */
  const ctrl0 = [[29, -13.5], [29.8, -5], [28.8, 4], [25.2, 12.5], [18, 18.6], [8, 22], [0, 22.8], [-8, 22], [-18, 18.6], [-25.2, 12.5], [-28.8, 4], [-29.8, -5], [-29, -13.5]], ctrl = ctrl0.map(p => [p[0] * K, ZP(p[1])]);
  const outline = spline(ctrl, 8), walk = scaleP(outline, .955);
  const wz = x => edgeZ(x, walk);
  S.outline = outline; S.walk = walk;
  S.walkable = (x, z) => inPoly(x, z, walk);

  /* ---------- ground + sea ---------- */
  { const land = new MB(); land.floor(-190, -120, 190, ZB, 0, mul(ST.apron, [1, 1, 1]), [0, 0, 380 / 4, (ZB + 120) / 4]); add(land, { tex: T.pave });
    const pv = new MB(); pv.poly(outline, 0, ST.pave, 4); add(pv, { tex: T.pave });
    const prom = new MB(); strip(prom, outline, scaleP(outline, .97), .014, mul(ST.pave, [1.12, 1.1, 1.05])); add(prom, {});
    const seaTex = R.paint(256, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, ST.sea[0]); gr.addColorStop(1, ST.sea[1]); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const r = rnd(7); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 3; for (let i = 0; i < 26; i++) { const x = r() * 256, y = r() * 256, w = 20 + r() * 40; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 6, x + w, y); g.stroke(); g.beginPath(); g.moveTo(x - 256, y); g.quadraticCurveTo(x - 256 + w / 2, y - 6, x - 256 + w, y); g.stroke(); } });
    const seaEm = R.paint(64, 64, g => { g.fillStyle = '#10305a'; g.fillRect(0, 0, 64, 64); });
    const sea = new MB(); sea.floor(-190, ZB - .1, 190, 120, -.9, [1, 1, 1], [0, 0, 26, 11.4]); add(sea, { tex: seaTex, em: seaEm, emDay: .0, emNight: .8 });
    // seawall: outer face + cap + foam
    const wl = new MB(); wallv(wl, outline, -.9, .38, [.84, .8, .78]); strip(wl, outline, scaleP(outline, .985), .38, [.95, .92, .9]); add(wl, {});
    const quay = new MB(); quay.quad([29 * K, -.9, ZB], [190, -.9, ZB], [190, 0, ZB], [29 * K, 0, ZB], [0, 0, 1], [0, 0, 1, 1], [.8, .76, .74]); quay.quad([-190, -.9, ZB], [-29 * K, -.9, ZB], [-29 * K, 0, ZB], [-190, 0, ZB], [0, 0, 1], [0, 0, 1, 1], [.8, .76, .74]); add(quay, {});
    const foam = new MB(); strip(foam, scaleP(outline, 1.0), scaleP(outline, 1.035), -.86, [.55, .6, .65]); add(foam, { mode: 2, tex: T.pave, glow: e => .2 + e.night * .25 });
    // rail
    const rl = new MB(), rp = new MB(); const ro = scaleP(outline, .99);
    for (let i = 0; i < ro.length - 1; i++) { const a = ro[i], b = ro[i + 1]; rl.quad([a[0], .92, a[1]], [b[0], .92, b[1]], [b[0], 1.0, b[1]], [a[0], 1.0, a[1]], [0, 0, 1], [0, 0, 1, 1], [.95, .93, .98]); if (i % 3 === 0) rp.cyl(a[0], a[1], .38, 1.0, .05, .05, 6, [.9, .88, .95], true); }
    add(rl, {}); add(rp, {}); }

  /* mosaic compass disc */
  const mosaic = (em) => R.paint(1024, 1024, (g) => {
    const c = 512; if (em) { g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024); } else { g.fillStyle = ST.mosaic[3]; g.fillRect(0, 0, 1024, 1024); }
    const N = 24; for (let i = 0; i < N; i++) { const a0 = i / N * 6.283, a1 = (i + 1) / N * 6.283; if (!em) { g.fillStyle = ST.mosaic[i % 2 ? 0 : 1]; g.beginPath(); g.moveTo(c, c); g.arc(c, c, 500, a0, a1); g.fill(); } }
    const star = (r1, r2, n, rot, col, lw, fill) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; g[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } g.strokeStyle = col; g.lineWidth = lw; g.stroke(); };
    const gold = em ? ST.accent : ST.gold, gold2 = em ? ST.accent2 : ST.gold;
    [[490, 14, gold], [440, 6, gold2], [330, 8, gold], [215, 6, gold2]].forEach(([r, lw, col]) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); });
    if (!em) { star(300, 150, 8, -Math.PI / 2, ST.gold, 6, ST.mosaic[3]); star(190, 90, 8, -Math.PI / 2 + Math.PI / 8, ST.gold, 5, ST.mosaic[2]); } else { star(300, 150, 8, -Math.PI / 2, ST.accent, 8, null); star(190, 90, 8, -Math.PI / 2 + Math.PI / 8, ST.accent2, 6, null); }
    for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283, r = 465; g.fillStyle = em ? (i % 2 ? ST.accent : ST.accent2) : ST.gold; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, em ? 7 : 5, 0, 7); g.fill(); }
  });
  { const m = new MB(); m.disc(CX, CZ, .022, 9.2, 80, [1, 1, 1]); add(m, { tex: mosaic(false), em: mosaic(true), emDay: .0, emNight: 1.5 }); }

  /* fountain */
  { const f = new MB(); f.cyl(CX, CZ, 0, .55, 2.9, 2.8, 40, [.9, .88, .84], false); f.cyl(CX, CZ, .55, .55, 2.9, 2.9, 40, [.9, .88, .84], true); f.cyl(CX, CZ, .55, .62, 2.55, 2.55, 40, [.85, .83, .8], false);
    f.cyl(CX, CZ, .5, 1.5, .55, .38, 16, [.92, .9, .86], true); f.cyl(CX, CZ, 1.35, 1.6, 1.25, 1.0, 24, [.92, .9, .86], true);
    f.cyl(CX, CZ, 1.55, 2.6, .22, .16, 12, [.92, .9, .86], true); f.cyl(CX, CZ, 2.4, 2.65, .75, .55, 18, [.92, .9, .86], true);
    add(f, {}); obs(CX - 2.9, CZ - 2.9, CX + 2.9, CZ + 2.9);
    const wt = R.paint(256, 256, g => { const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, ST.water[0]); gr.addColorStop(1, ST.water[1]); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; for (let r = 30; r < 128; r += 22) { g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); } }, { clamp: true });
    const wm = new MB(); wm.disc(CX, CZ, .6, 2.5, 40, [1, 1, 1]); add(wm, { tex: wt, em: solid(hex(ST.water[0]).map(v => v * .5)), emDay: .15, emNight: 1.0 });
    const wb = new MB(); wb.disc(CX, CZ, 1.62, 1.1, 24, [1, 1, 1]); add(wb, { tex: wt, em: solid(hex(ST.water[0]).map(v => v * .5)), emDay: .15, emNight: 1.0 });
    const gl = new MB(); pool(gl, CX, CZ, 5.5, A, .035); halo(gl, CX, 2.2, CZ, 3.4, [.7, .9, 1]); add(gl, { tex: T.glow, mode: 2, glow: nightPlus(.04, .5) }); }

  /* ---------- buildings ---------- */
  const roofCol = [.3, .27, .36], FA = (seed, o) => T.facade(seed, o);
  const building = (x0, x1, z0, z1, h, f, tile) => {
    const mb = new MB(); mb.box(x0, 0, z0, x1, h, z1, [1, 1, 1], tile || [16, 14], { noTop: true }); add(mb, { tex: f.tex, em: f.em, emNight: 1.5 });
    const r = new MB(); r.box(x0 - .15, h, z0 - .15, x1 + .15, h + .5, z1 + .15, roofCol); add(r, {});
  };
  withShift(0, -24, () => { const r = rnd(99), facs = ST.far.map((w, i) => FA(i + 1, { wall: w, cols: 6, rows: 8, lit: .5 }));
    for (let x = -104, k = 0; x < 104; x += 7 + r() * 6, k++) {
      const w = 7 + r() * 6, h = 20 + r() * 34, z0 = -60 - r() * 12, f = facs[k % 3]; const mb = new MB(); mb.box(x, 0, z0, x + w, h, z0 + 11, [1, 1, 1], [16, 14], { noTop: true }); add(mb, { tex: f.tex, em: f.em, emNight: 1.5 });
      const rf = new MB(); rf.box(x - .1, h, z0 - .1, x + w + .1, h + .6, z0 + 11.1, roofCol); add(rf, {});
      if (r() < .5) { const gl = new MB(); halo(gl, x + w / 2, h + 1.5, z0 + 11.2, 3.2, r() < .5 ? A2 : A); add(gl, { tex: T.glow, mode: 2, glow: night(.9) }); }
    } });
  at(0, -36, () => building(-14, 14, -50, -22, 24, FA(6, { wall: ST.mid[2], cols: 5, rows: 6, lit: .5 })));
  at(-37.75, -23.75, () => building(-46, -29.5, -34, -13.5, 20, FA(4, { wall: ST.mid[0], cols: 4, rows: 6, lit: .5 })));
  at(37.75, -23.75, () => building(29.5, 46, -34, -13.5, 22, FA(5, { wall: ST.mid[1], cols: 4, rows: 6, lit: .55 })));

  /* FASHION DISTRICT (left of the stage) */
  at(-20.7, -13.5, () => { const x0 = -29, x1 = -12.5, zf = -13.5, h = 9.5, dc = -20.7;
    const mb = new MB(); mb.box(x0, 0, zf - 12, x1, h, zf, [1, 1, 1], [x1 - x0, h], { noTop: true }); add(mb, { tex: T.mall.tex, em: T.mall.em, emDay: .25, emNight: 1.6 });
    const rf = new MB(); rf.box(x0 - .2, h, zf - 12.2, x1 + .2, h + .5, zf + .2, [.9, .9, .96]); add(rf, {});
    const ar = new MB(); ar.arch(dc, 0, zf + .05, zf + 1.7, 6.2, 5.7, 0, Math.PI, 32, [.92, .94, 1]); add(ar, {});
    const ar2 = new MB(); ar2.arch(dc, 0, zf + 1.72, zf + 1.78, 5.65, 5.45, 0, Math.PI, 32, [1, 1, 1]); add(ar2, emMat(A, .9, 2.2));
    const d = new MB(); d.wall(dc - 1.4, 0, dc + 1.4, 3.6, zf + .06, [1, 1, 1]); add(d, { tex: T.mallDoor.tex, em: T.mallDoor.em, emDay: .6, emNight: 1.5 });
    const sg = T.sign('FASHION DISTRICT', { w: 1024, h: 150, fs: 92, bg: '#0f1c3a', fg: '#e8f6ff', border: ST.accent }), sb = new MB(); sb.box(dc - 5, 6.6, zf + .02, dc + 5, 8.2, zf + .45, [1, 1, 1], [10, 1.5], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .45, emNight: .9 }); { const gf = new MB(); gf.box(dc - 5.2, 6.45, zf + .02, dc + 5.2, 6.6, zf + .5, [.93, .76, .36]); gf.box(dc - 5.2, 8.2, zf + .02, dc + 5.2, 8.35, zf + .5, [.93, .76, .36]); gf.box(dc - 5.2, 6.45, zf + .02, dc - 5.05, 8.35, zf + .5, [.93, .76, .36]); gf.box(dc + 5.05, 6.45, zf + .02, dc + 5.2, 8.35, zf + .5, [.93, .76, .36]); add(gf, {}); }
    const rs = T.sign('STYLE · 时尚', { w: 1024, h: 200, fs: 120, bg: '#10142e', fg: '#fff', border: ST.accent2 }), rb = new MB(); rb.box(dc - 5.5, h + .5, zf - 1, dc + 5.5, h + 3.3, zf - .8, [1, 1, 1], [11, 2.8], { noBack: true, noSides: true, noTop: true }); add(rb, { tex: rs.tex, em: rs.em, emDay: .4, emNight: 1.6 });
    const c = new MB(); c.floor(dc - 1.15, zf, dc + 1.15, zf + 3.7, .035, [.78, .12, .18]); add(c, {});
    const gl = new MB(); pool(gl, dc, -11, 6.5, A, .036); halo(gl, dc, 2.2, zf + 2, 6.5, mul(A, [.8, .9, 1])); add(gl, { tex: T.glow, mode: 2, glow: nightPlus(.1, .5) });
    S.portals.push({ id: 'boutique', x: dc, z: -11.2, r: 2.0, label: '时尚街 · 试衣间', color: A }); });

  /* STAR KTV (right of the stage) */
  at(20.7, -13.5, () => { const x0 = 12.5, x1 = 29, zf = -13.5, h = 8.5, dc = 20.7;
    /* 奢侈品牌式外立面：黑色抛光石材 + 金色细线 + 大幅暖光橱窗 */
    const lxT = (em) => R.paint(256, 512, (g, w, h2) => { g.fillStyle = em ? '#000' : '#16131b'; g.fillRect(0, 0, w, h2); if (!em) { const gr = g.createLinearGradient(0, 0, w, h2); gr.addColorStop(0, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.2)'); g.fillStyle = gr; g.fillRect(0, 0, w, h2); g.fillStyle = '#c9a24a'; g.fillRect(0, 0, 3, h2); g.fillRect(w - 3, 0, 3, h2); }
      const px = 34, py = 70, pw = w - 68, ph = h2 - 190; const gl = g.createLinearGradient(0, py, 0, py + ph); if (em) { gl.addColorStop(0, '#9a7a45'); gl.addColorStop(1, '#4a3820'); } else { gl.addColorStop(0, '#3a3548'); gl.addColorStop(1, '#14121c'); } g.fillStyle = gl; g.fillRect(px, py, pw, ph);
      g.strokeStyle = em ? '#6b5326' : '#d9b45a'; g.lineWidth = 5; g.strokeRect(px, py, pw, ph); if (!em) { g.lineWidth = 2; g.strokeStyle = 'rgba(217,180,90,.55)'; g.beginPath(); g.moveTo(px + pw / 2, py); g.lineTo(px + pw / 2, py + ph); g.stroke(); } });
    const lxA = lxT(false), lxE = lxT(true);
    const mb = new MB(); mb.box(x0, 0, zf - 12, x1, h, zf, [1, 1, 1], [8, 1], { noTop: true }); add(mb, { tex: lxA, em: lxE, emDay: .35, emNight: .6 });
    const rf = new MB(); rf.box(x0 - .2, h, zf - 12.2, x1 + .2, h + .5, zf + .2, [.08, .07, .1]); rf.box(x0 - .25, h + .5, zf - .3, x1 + .25, h + .62, zf + .25, [.93, .76, .36]); rf.box(x0 - .25, 0, zf, x1 + .25, .7, zf + .35, [.1, .09, .13]); rf.box(x0 - .28, .7, zf, x1 + .28, .8, zf + .38, [.93, .76, .36]); add(rf, {});
    const fin = new MB(); for (let fx = x0 + 1; fx <= x1 - .5; fx += 2.06) { if (Math.abs(fx - dc) < 3.6) continue; fin.box(fx - .07, .8, zf, fx + .07, h, zf + .2, [.93, .76, .36]); } add(fin, {});
    const dT = (em) => R.paint(256, 256, g => { g.fillStyle = em ? '#000' : '#17141c'; g.fillRect(0, 0, 256, 256); const gr = g.createLinearGradient(0, 0, 0, 256); if (em) { gr.addColorStop(0, '#a98446'); gr.addColorStop(1, '#fff0c8'); } else { gr.addColorStop(0, '#2c2638'); gr.addColorStop(1, '#8a7650'); } g.fillStyle = gr; g.fillRect(10, 8, 112, 248); g.fillRect(134, 8, 112, 248); g.strokeStyle = '#e1b84e'; g.lineWidth = 6; g.strokeRect(10, 8, 112, 248); g.strokeRect(134, 8, 112, 248); g.fillStyle = '#f4d98a'; g.fillRect(112, 100, 6, 60); g.fillRect(138, 100, 6, 60); }, { clamp: true });
    const d = new MB(); d.wall(dc - 1.7, 0, dc + 1.7, 3.8, zf + .06, [1, 1, 1]); add(d, { tex: dT(false), em: dT(true), emDay: .5, emNight: .8 });
    const nf = new MB(), zz = zf + .1; nf.box(dc - 2, 0, zz, dc - 1.7, 4.1, zz + .3, [1, 1, 1]); nf.box(dc + 1.7, 0, zz, dc + 2, 4.1, zz + .3, [1, 1, 1]); nf.box(dc - 2, 3.8, zz, dc + 2, 4.1, zz + .3, [1, 1, 1]); add(nf, emMat([1, .85, .5], .5, .9));
    const sg = T.sign('天皇巨星', { w: 1024, h: 300, fs: 200, bg: '#12060c', fg: '#ffe9a8', border: '#e1b84e' }), sb = new MB(); sb.box(dc - 5.2, 5.1, zf + .02, dc + 5.2, 8.0, zf + .45, [1, 1, 1], [10, 3], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: .9 }); { const gf = new MB(); gf.box(dc - 5.4, 4.95, zf + .02, dc + 5.4, 5.1, zf + .5, [.93, .76, .36]); gf.box(dc - 5.4, 8.0, zf + .02, dc + 5.4, 8.15, zf + .5, [.93, .76, .36]); gf.box(dc - 5.4, 4.95, zf + .02, dc - 5.25, 8.15, zf + .5, [.93, .76, .36]); gf.box(dc + 5.25, 4.95, zf + .02, dc + 5.4, 8.15, zf + .5, [.93, .76, .36]); add(gf, {}); }
    const sg2 = T.sign('♪ SUPERSTAR KTV · 豪华欢唱 ♪', { w: 1024, h: 120, fs: 56, bg: '#12060c', fg: '#ff9ad8', border: '#ff4fc3' }), sb2 = new MB(); sb2.box(dc - 3.4, 4.15, zf + .02, dc + 3.4, 4.9, zf + .4, [1, 1, 1], [6.8, .8], { noBack: true, noSides: true, noTop: true }); add(sb2, { tex: sg2.tex, em: sg2.em, emDay: .5, emNight: .9 });
    /* 豪华门面：金柱雨棚 + 红毯围栏 + 屋顶巨型金麦克风 + 皇冠 */
    const GD = [.93, .76, .36], pil = new MB(), can = new MB(), lights = new MB(), mic = new MB(), crown = new MB(), jew = new MB(), rope = new MB(), cg = new MB();
    [-2.9, 2.9].forEach(dx => { pil.cyl(dc + dx, zf + 1.4, 0, .4, .55, .5, 12, GD, true); pil.cyl(dc + dx, zf + 1.4, .4, 4.2, .32, .3, 14, [.98, .86, .5], false); pil.cyl(dc + dx, zf + 1.4, 4.2, 4.5, .5, .42, 12, GD, true); [1.2, 2.4, 3.4].forEach(y => pil.cyl(dc + dx, zf + 1.4, y, y + .1, .36, .36, 14, GD, false)); lights.sphere(dc + dx, 4.85, zf + 1.4, .26, .3, .26, [1, .95, .8], 7); obs(dc + dx - .55, zf + .85, dc + dx + .55, zf + 1.95); });
    can.box(dc - 3.6, 4.5, zf, dc + 3.6, 4.72, zf + 2.0, [.1, .09, .12]); can.box(dc - 3.7, 4.72, zf + 1.9, dc + 3.7, 4.78, zf + 2.2, GD);
    for (let k = 0; k <= 14; k++) lights.sphere(dc - 3.5 + k * .5, 4.6, zf + 2.15, .09, .09, .09, k % 2 ? [1, .5, .85] : [1, .9, .5], 4);
    for (let k = 0; k < 6; k++) { const px = dc + (k < 3 ? -1.9 : 1.9), pz = zf + 2.2 + (k % 3) * 1.6; rope.cyl(px, pz, 0, 1.0, .05, .05, 6, GD, true); rope.sphere(px, 1.06, pz, .1, .1, .1, GD, 5); if (k % 3 < 2) rope.box(px - .02, .8, pz, px + .02, .88, pz + 1.6, [.1, .09, .12]); }
    [-1, 1].forEach(sd => { const mx = dc + sd * 7.4, mz = zf - .3; mic.box(mx - .5, h, mz - .5, mx + .5, h + .3, mz + .5, [.1, .09, .12]); mic.box(mx - .12, h + .3, mz - .12, mx + .12, h + 5.2, mz + .12, GD); mic.sphere(mx, h + 5.5, mz, .32, .32, .32, [1, .93, .7], 8); halo(cg, mx, h + 5.5, mz + .8, 2.4, [1, .85, .5]); });
    { const cx = dc, cz = zf - 1.1, cy = h + 4.9; crown.cyl(cx, cz, cy, cy + .6, 1.7, 1.5, 24, GD, false); for (let k = 0; k < 7; k++) { const x = cx + (k - 3) * .5; crown.cyl(x, cz, cy + .6, cy + 1.5 + (k === 3 ? .5 : (k % 2 ? 0 : .25)), .24, .03, 6, GD, true); jew.sphere(x, cy + 1.62 + (k === 3 ? .5 : (k % 2 ? 0 : .25)), cz, .12, .12, .12, k % 2 ? [1, .2, .3] : [.3, .6, 1], 5); } jew.sphere(cx, cy + .3, cz + 1.55, .22, .22, .12, [1, .2, .4], 6); halo(cg, cx, cy + 1, cz + .8, 5, [1, .85, .5]); }
    occ(() => { add(pil, {}); add(can, {}); add(mic, {}); add(crown, {}); }); add(rope, {}); add(lights, emMat([1, .95, .8], .4, 1.0)); add(jew, emMat([1, .6, .7], .5, 1.0)); add(cg, { tex: T.glow, mode: 2, glow: nightPlus(.05, .35) });
    const bs = new MB(); bs.box(dc - 5.2, h + .5, zf - 1.2, dc + 5.3, h + 4.9, zf - 1.0, [1, 1, 1], [10.5, 4.4], { noBack: true, noSides: true, noTop: true }); add(bs, { tex: T.ktvScreen.tex, em: T.ktvScreen.em, emDay: .5, emNight: .9 });
    const c = new MB(); c.floor(dc - 1.6, zf, dc + 1.6, zf + 7.2, .035, [.9, .84, .7]); c.floor(dc - 1.6, zf, dc - 1.45, zf + 7.2, .037, [.95, .78, .35]); c.floor(dc + 1.45, zf, dc + 1.6, zf + 7.2, .037, [.95, .78, .35]); add(c, {});
    const gl = new MB(); pool(gl, dc, -11, 5.5, [1, .85, .55], .036); halo(gl, dc, 2.4, zf + 1.6, 4.5, [1, .85, .6]); add(gl, { tex: T.glow, mode: 2, glow: nightPlus(.02, .3) });
    S.portals.push({ id: 'ktv', x: dc, z: -11.2, r: 2.0, label: '天皇巨星 · 接待大堂', color: A2 }); });

  /* hedges closing the north gaps beside the stage */
  [[-12.5, -9.7], [9.7, 12.5]].forEach(([a, b]) => at((a + b) / 2, -13, () => { const h = new MB(); const lf = mul([.3, .62, .34], ST.leaf); h.box(a, 0, -13.5, b, .9, -12.5, lf); add(h, {}); obs(a, -13.6, b, -12.4); }));

  /* ---------- CONCERT STAGE ---------- */
  const SX0 = -9.5, SX1 = 9.5, SZ0 = -13.4, SZ1 = -6.6, SH = 1.5, STEPW = 2.2, STEPD = 1.2, DZS = (K - 1) * (-10 - ZC);   // DZS: 舞台整体后移量
  const inDeck = (x, z, m) => x > SX0 - m && x < SX1 + m && z - DZS > SZ0 - m && z - DZS < SZ1 + m;
  const inSteps = (x, z, m) => Math.abs(x) < STEPW + m && z - DZS > SZ1 - .01 && z - DZS < SZ1 + STEPD + m;
  S.stageZone = (x, z, m) => inDeck(x, z, m || 0) || inSteps(x, z, m || 0);
  S.stage = { x0: SX0, x1: SX1, z0: SZ0 + DZS, z1: SZ1 + DZS, h: SH, mic: [0, -9.6 + DZS], front: [0, -4.4 + DZS], arriveR: 2.6, leaveR: 8.5 };
  S.heightAt = (x, z) => { if (Math.abs(x) < STEPW && z - DZS >= SZ1 && z - DZS <= SZ1 + STEPD) return SH * (1 - (z - DZS - SZ1) / STEPD); if (inDeck(x, z, 0)) return SH; return 0; };
  withShift(0, DZS, () => { const deckTex = (em) => R.paint(1024, 366, (g, w, h) => {
      const mx = 512, my = (-9.6 - SZ0) / (SZ1 - SZ0) * h;
      if (!em) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a2146'); gr.addColorStop(1, '#3a2e63'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2; for (let i = 0; i < 38; i++) { g.beginPath(); g.moveTo(i * 27, 0); g.lineTo(i * 27, h); g.stroke(); } }
      else { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
      [[150, 8, ST.accent], [105, 5, ST.accent2], [55, 4, ST.accent]].forEach(([r, lw, col]) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.ellipse(mx, my, r * 2.3, r, 0, 0, 7); g.stroke(); });
      g.strokeStyle = em ? ST.accent2 : 'rgba(255,111,200,.6)'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    });
    const dk = new MB(); dk.box(SX0, 0, SZ0, SX1, SH, SZ1, [1, 1, 1], [4, 1.5], { noTop: true }); add(dk, { tex: T.stage, em: T.stageEm, emDay: .2, emNight: 1.3 });
    const tp = new MB(); tp.floor(SX0, SZ0, SX1, SZ1, SH, [1, 1, 1]); add(tp, { tex: deckTex(false), em: deckTex(true), emDay: .25, emNight: 1.5 });
    const ed = new MB(); ed.box(SX0, SH - .12, SZ1, SX1, SH + .02, SZ1 + .08, [1, 1, 1]); ed.box(SX0, 0, SZ1, SX1, .12, SZ1 + .08, [1, 1, 1]); add(ed, emMat(A2, .9, 2.4));
    const st = new MB(); for (let i = 0; i < 3; i++) st.box(-STEPW, 0, SZ1 + STEPD - (i + 1) * .4, STEPW, (i + 1) * .5, SZ1 + STEPD - i * .4, [.78, .74, .86]); add(st, {});
    const sl = new MB(); [-STEPW - .12, STEPW + .12].forEach(x => { sl.cyl(x, SZ1 + STEPD + .1, 0, 1.1, .07, .07, 8, [.9, .9, .95], true); sl.cyl(x, SZ1 + .1, 0, 2.0, .07, .07, 8, [.9, .9, .95], true); }); add(sl, {});
    const slc = new MB(); [-STEPW - .12, STEPW + .12].forEach(x => { slc.sphere(x, 1.2, SZ1 + STEPD + .1, .12, .12, .12, [1, 1, 1], 6); slc.sphere(x, 2.1, SZ1 + .1, .12, .12, .12, [1, 1, 1], 6); }); add(slc, emMat(A, .9, 2.5));
    // back wall + LED frame
    const bw = new MB(); bw.box(SX0 - 1.2, SH, SZ0 - .6, SX1 + 1.2, 3.4, SZ0 + .2, [.13, .11, .22]); add(bw, {});
    const fr = new MB(); fr.box(-6.9, 3.25, SZ0 + .15, 6.9, 8.75, SZ0 + .26, [.1, .09, .16]); add(fr, {});
    S.led = { cv: document.createElement('canvas'), tex: null, acc: 1 }; S.led.cv.width = 1024; S.led.cv.height = 410;
    drawLED(S.led.cv.getContext('2d'), ST, { mode: 'idle', queue: [] }, 0); S.led.tex = R.canvasTex(S.led.cv, { clamp: true, mip: false });
    const sc = new MB(); sc.wall(-6.5, 3.4, 6.5, 8.6, SZ0 + .28, [1, 1, 1]); add(sc, { tex: S.led.tex, em: S.led.tex, emDay: .85, emNight: 1.6 });
    // truss: posts + top beam + lights
    const tr = new MB(); [SX0 - .2, SX1 - .2].forEach(x => tr.box(x, SH, SZ0 + .3, x + .4, 9.9, SZ0 + .7, [.22, .2, .3])); tr.box(SX0 - .2, 9.4, SZ0 + .3, SX1 + .2, 9.9, SZ0 + .7, [.22, .2, .3]); tr.box(SX0 - .2, 8.9, SZ0 + .35, SX1 + .2, 9.1, SZ0 + .65, [.2, .18, .28]); add(tr, {});
    const tl = new MB(); for (let i = 0; i < 8; i++) { const x = -7.7 + i * 2.2; tl.box(x - .22, 9.0, SZ0 + 1.0, x + .22, 9.4, SZ0 + 1.45, [1, 1, 1]); } tl.box(SX0, 9.42, SZ0 + .7, SX1, 9.52, SZ0 + .78, [1, 1, 1]); add(tl, emMat([1, .95, .85], .5, 2.4));
    // speakers
    const sp = new MB(); [[-9.3, -7.9], [7.9, 9.3]].forEach(([a, b]) => { sp.box(a, SH, -8.3, b, SH + 2.5, -7.0, [.12, .11, .16]); sp.box(a + .1, SH + 2.5, -8.2, b - .1, SH + 3.5, -7.1, [.14, .13, .19]); }); add(sp, {});
    const spl = new MB(); [[-9.2, -8.0], [8.0, 9.2]].forEach(([a, b]) => { spl.box(a, SH + .3, -7.02, b, SH + .36, -6.98, [1, 1, 1]); spl.box(a, SH + 1.1, -7.02, b, SH + 1.16, -6.98, [1, 1, 1]); spl.box(a, SH + 1.9, -7.02, b, SH + 1.96, -6.98, [1, 1, 1]); }); add(spl, emMat(A, .6, 2.0));
    // side LED towers
    const tw = T.sign('LIVE', { w: 128, h: 512, fs: 84, vertical: true, bg: '#14092a', fg: '#ffe2f6', border: ST.accent2 });
    const tws = new MB(); [[-11.2, -10.6], [10.6, 11.2]].forEach(([a, b]) => tws.box(a, 0, -12.6, b, 7.4, -12.0, [1, 1, 1], [.6, 7.4], { noBack: true, noSides: true, noTop: true })); add(tws, { tex: tw.tex, em: tw.em, emDay: .5, emNight: 1.6 });
    const glo = new MB(); halo(glo, 0, 6, SZ0 + .9, 9, [.8, .5, 1]); halo(glo, -10.9, 4, -12, 3.5, A2); halo(glo, 10.9, 4, -12, 3.5, A2); pool(glo, 0, -9.6, 7, A2, SH + .03); pool(glo, 0, -3.8, 8.5, A2, .036); add(glo, { tex: T.glow, mode: 2, glow: nightPlus(.04, .55) }); });

  /* ---------- song kiosk (left of the stage) ---------- */
  { const KS0 = { R, T, S, add, occ, obs, emMat, halo, glowMat: g => ({ tex: T.glow, mode: 2, glow: g }), night }, kx = -12.6, kz = -11.6;
    occ(() => G.Kiosk.arcade(KS0, kx, kz));
    S.hotspots.push({ id: 'songs', x: kx, z: kz + 1.9, r: 2.0, label: '点歌台', color: A2 }); }

  /* ---------- seating ---------- */
  const seatAdd = (x, z, yaw, h, ap) => { const s = { x, z, yaw, h, ap, who: null, res: null }; s.hot = { id: 'sit', seat: s, x: ap[0], z: ap[1], r: 1.4 }; S.seats.push(s); return s; };
  const bench = (x, z, dir) => {
    const fx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0, fz = dir === 's' ? 1 : dir === 'n' ? -1 : 0, ew = fx !== 0, hx = ew ? .35 : 1.2, hz = ew ? 1.2 : .35, wood = [.58, .4, .3], dark = [.25, .22, .3], b = new MB();
    b.box(x - hx, .42, z - hz, x + hx, .5, z + hz, wood);
    const bx = x - fx * (hx - .05), bz = z - fz * (hz - .05);
    if (ew) b.box(Math.min(bx - .05, bx + .05), .5, z - hz, Math.max(bx - .05, bx + .05), 1.05, z + hz, wood); else b.box(x - hx, .5, bz - .05, x + hx, 1.05, bz + .05, wood);
    [-1, 1].forEach(sd => { if (ew) b.box(x - hx, 0, z + sd * (hz - .12) - .05, x + hx, .42, z + sd * (hz - .12) + .05, dark); else b.box(x + sd * (hx - .12) - .05, 0, z - hz, x + sd * (hx - .12) + .05, .42, z + hz, dark); });
    add(b, {}); obs(x - hx - .1, z - hz - .1, x + hx + .1, z + hz + .1);
    [-.55, .55].forEach(o => { const sx = x + (ew ? 0 : o) - fx * .1, sz = z + (ew ? o : 0) - fz * .1; seatAdd(sx, sz, Math.atan2(fx, fz), .5, [sx + fx * 1.15, sz + fz * 1.15]); });
  };
  const stool = (x, z, tx, tz) => { const b = new MB(); b.cyl(x, z, 0, .44, .24, .2, 10, [.85, .4, .35], true); add(b, {}); const dx = tx - x, dz = tz - z, l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l; seatAdd(x, z, Math.atan2(fx, fz), .46, [x - fx * .95, z - fz * .95]); };
  
  [-15, -8, 8, 15].forEach(x => bench(x * K, wz(x * K) - 1.7, 's'));

  /* ---------- 舞台前观众席：长椅分左右两块，中间留过道，三排朝向舞台 ---------- */
  { const AZ = [SZ1 + DZS + 3.4, SZ1 + DZS + 5.6, SZ1 + DZS + 7.8], BX = [3.9, 6.3, 8.7];
    AZ.forEach(z => BX.forEach(x => { bench(x, z, 'n'); bench(-x, z, 'n'); }));
    const car = new MB(); car.floor(-1.1, SZ1 + DZS + STEPD + .1, 1.1, AZ[2] + 1.0, .03, [.62, .1, .2]); car.floor(-1.1, SZ1 + DZS + STEPD + .1, -.95, AZ[2] + 1.0, .035, [.93, .76, .36]); car.floor(.95, SZ1 + DZS + STEPD + .1, 1.1, AZ[2] + 1.0, .035, [.93, .76, .36]); add(car, {}); }

  /* ---------- 舞台两侧后方花园（放大后的空地）：花坛 + 树 + 长椅 + 路灯 ---------- */
  [-1, 1].forEach(sd => { const xc = sd * 17.4, r = rnd(60 + sd + 2), L = ST.leaf, pl = new MB(), gr = new MB(), fl = new MB(), tr = new MB(), lf = new MB(), lp = new MB(), lh = new MB(), hl = new MB(), pw = new MB();
    pl.box(xc - 3.9, 0, -20.7, xc + 3.9, .5, -16.5, [.82, .78, .72]); pl.box(xc - 3.9, .5, -20.7, xc + 3.9, .56, -16.5, [.9, .86, .8]);
    gr.box(xc - 3.65, .56, -20.45, xc + 3.65, .62, -16.75, mul([.3, .62, .34], L));
    for (let i = 0; i < 70; i++) { const px = xc + (r() * 2 - 1) * 3.4, pz = -18.6 + (r() * 2 - 1) * 1.9; fl.sphere(px, .74 + r() * .2, pz, .17, .15, .17, mul([.3, .62, .34], L), 4); if (r() < .7) fl.sphere(px, .92 + r() * .2, pz, .11, .1, .11, hex(ST.flowers[(r() * ST.flowers.length) | 0]), 4); }
    [-2.5, 0, 2.5].forEach((dx, i) => { const tx = xc + dx, tz = -18.6 + (i % 2 ? .5 : -.4), th = 3.6 + (i === 1 ? .9 : 0);
      tr.cyl(tx, tz, .6, th, .2, .14, 7, [.5, .38, .28], false);
      [[0, th + .2, 0, 1.25], [.55, th - .2, .3, .9], [-.55, th - .35, -.25, .9]].forEach(([ox, oy, oz, rr]) => lf.sphere(tx + ox, oy, tz + oz, rr, rr * .85, rr, mul([.26 + r() * .06, .62, .3], L), 7));
      for (let k = 0; k < 6; k++) { const a = k * 1.05, bx = tx + Math.cos(a) * 1.0, bz = tz + Math.sin(a) * 1.0; pw.sphere(bx, th + .1 + (k % 2) * .4, bz, .06, .06, .06, [1, 1, 1], 4); if (k % 2) halo(hl, bx, th + .1, bz, .55, [1, .85, .5]); }
      obs(tx - .3, tz - .3, tx + .3, tz + .3); });
    obs(xc - 3.9, -20.8, xc + 3.9, -16.4);
    [-4.7, 4.7].forEach(dx => { const lx = xc + dx, lz = -15.2; lp.cyl(lx, lz, 0, 4.4, .09, .06, 8, [.22, .2, .32]); lp.cyl(lx, lz, 0, .4, .22, .15, 8, [.22, .2, .32]); lh.sphere(lx, 4.7, lz, .3, .3, .3, [1, 1, 1], 8); halo(hl, lx, 4.7, lz, 3.2, [1, .8, .48]); pool(hl, lx, lz, 3.4, [1, .78, .45]); obs(lx - .2, lz - .2, lx + .2, lz + .2); });
    occ(() => { add(pl, {}); add(tr, {}); add(lf, {}); add(lp, {}); add(lh, emMat([1, .94, .78], .35, 1.8)); }); add(gr, {}); add(fl, {}); add(pw, emMat([1, .92, .6], .3, 1.8)); add(hl, { tex: T.glow, mode: 2, glow: night(.55) });
    [-2, 2].forEach(dx => bench(xc + dx, -14.6, 'n')); });

  /* pavilions with tables */
  const pavilion = (cx, cz, label, wallCol) => {
    const pw = 3.2, pd = 2.6, p = new MB();
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { p.cyl(cx + a * (pw - .2), cz + b * (pd - .2), 0, 3.2, .1, .1, 8, [.9, .88, .92], true); obs(cx + a * (pw - .2) - .15, cz + b * (pd - .2) - .15, cx + a * (pw - .2) + .15, cz + b * (pd - .2) + .15); });
    const fl0 = new MB(); fl0.floor(cx - pw, cz - pd, cx + pw, cz + pd, .02, [.9, .78, .62]); add(fl0, {});
    const nP = S.batches.length; p.box(cx - pw - .3, 3.2, cz - pd - .3, cx + pw + .3, 3.5, cz + pd + .3, wallCol); p.box(cx - pw - .3, 3.5, cz - pd - .3, cx + pw + .3, 3.6, cz + pd + .3, [1, 1, 1]); add(p, {});
    const e = new MB(); e.box(cx - pw - .3, 3.14, cz + pd + .3, cx + pw + .3, 3.2, cz + pd + .36, [1, 1, 1]); add(e, emMat(A, .5, 2.0));
    const sg = T.sign(label, { w: 512, h: 100, fs: 64, bg: '#2a1a30', fg: '#ffe2b0', border: ST.accent }), sb = new MB(); sb.box(cx - 1.8, 3.6, cz + pd + .1, cx + 1.8, 4.7, cz + pd + .4, [1, 1, 1], [3.6, 1.1], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .3, emNight: 1.5 });
    { const bs = S.batches.slice(nP).filter(b => b.mat.mode === 0); const a = [1e9, 1e9, 1e9], c = [-1e9, -1e9, -1e9]; bs.forEach(b => { for (let j = 0; j < 3; j++) { a[j] = Math.min(a[j], b.bb[0][j]); c[j] = Math.max(c[j], b.bb[1][j]); } }); S.occluders.push({ bs, a, b: c, f: 1 }); }
    [-1.6, 1.6].forEach((tx, i) => { const x = cx + tx, z = cz, t = new MB(); t.cyl(x, z, 0, .72, .07, .07, 8, [.3, .25, .3]); t.cyl(x, z, .72, .78, .55, .55, 16, [.95, .9, .85], true); add(t, {}); obs(x - .6, z - .6, x + .6, z + .6);
      [[-.95, 0], [.95, 0], [0, .95], [0, -.95]].forEach(([dx, dz]) => stool(x + dx, z + dz, x, z)); });
    const gl = new MB(); pool(gl, cx, cz, 5, [1, .8, .55], .036); halo(gl, cx, 3.0, cz + pd, 4, [1, .8, .5]); add(gl, { tex: T.glow, mode: 2, glow: night(.5) });
  };
  { const KS = { R, T, S, add, occ, obs, emMat, halo, glowMat: g => ({ tex: T.glow, mode: 2, glow: g }), night, seatAdd };
    G.Shops.cafeShop(KS, -18 * K, ZP(0.5), { s: -1 }); G.Shops.bobaShop(KS, 18 * K, ZP(0.5), { s: 1 }); }

  /* ---------- lamps + banners + string lights ---------- */
  const lamps0 = [[-25.5, -10.5], [-15.5, -10.5], [-11.2, -8.2], [11.2, -8.2], [15.5, -10.5], [25.5, -10.5],
    [-26.5, -1], [-26.5, 10], [26.5, -1], [26.5, 10],
    [-19, wz(-19) - 1], [-10, wz(-10) - 1], [0, wz(0) - 1], [10, wz(10) - 1], [19, wz(19) - 1],
    [-12.5, 1.2], [12.5, 1.2]], lamps = lamps0.map(([x, z], i) => i >= 10 && i <= 14 ? [x * K, wz(x * K) - 1] : [x * K, ZP(z)]);
  { const poles = new MB(), heads = new MB(), halos = new MB(), pools = new MB(), ban = new MB();
    lamps.forEach(([x, z], i) => {
      { const pl1 = new MB(), hd1 = new MB(); pl1.cyl(x, z, 0, 4.6, .09, .06, 8, [.22, .2, .32]); pl1.cyl(x, z, 0, .4, .22, .15, 8, [.22, .2, .32]); pl1.cyl(x, z, 4.3, 4.35, .22, .22, 8, [.9, .8, .4]); hd1.sphere(x, 4.8, z, .3, .3, .3, [1, 1, 1], 8); occ(() => { add(pl1, {}); add(hd1, emMat([1, .94, .78], .35, 2.2)); }); }
 halo(halos, x, 4.8, z, 3.4, [1, .8, .48]); pool(pools, x, z, 3.6, [1, .78, .45]); obs(x - .22, z - .22, x + .22, z + .22);
      const bn1 = new MB();
      const bc = i % 2 ? A : A2;
      bn1.quad([x - .22, 2.9, z + .1], [x + .22, 2.9, z + .1], [x + .22, 4.0, z + .1], [x - .22, 4.0, z + .1], [0, 0, 1], [0, 0, 1, 1], bc); bn1.quad([x - .22, 2.9, z + .1], [x, 2.55, z + .1], [x + .22, 2.9, z + .1], [x - .22, 2.9, z + .1], [0, 0, 1], [0, 0, 1, 1], bc);
      occ(() => add(bn1, {}));
      S.lamps.push([x, z]);
    });
    add(halos, { tex: T.glow, mode: 2, glow: night(.7) }); add(pools, { tex: T.glow, mode: 2, glow: night(.2) }); add(ban, {}); }
  { const links = [[0, 1], [4, 5], [6, 7], [8, 9], [10, 11], [11, 12], [12, 13], [13, 14]], bulbs = new MB(), hal = new MB(), rr = rnd(5);
    links.forEach(([a, b]) => { const [x0, z0] = lamps[a], [x1, z1] = lamps[b], n = Math.max(6, Math.round(Math.hypot(x1 - x0, z1 - z0) / .9));
      for (let k = 1; k < n; k++) { const u = k / n, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u, y = 4.6 - .9 * (1 - (2 * u - 1) ** 2);
        bulbs.sphere(x, y - .1, z, .07, .07, .07, [1, 1, 1], 4); if (k % 2 === 0) halo(hal, x, y - .1, z, .55, rr() < .5 ? [1, .85, .5] : mul(A2, [1, .9, .8])); } });
    add(bulbs, emMat([1, .9, .62], .55, 2.2)); add(hal, { tex: T.glow, mode: 2, glow: night(.8) }); }

  /* ---------- flower beds, palms, trees ---------- */
  { const pl = new MB(), fl = new MB(), r = rnd(21);
    const bed = (x, z, hw, hd) => { pl.box(x - hw, 0, z - hd, x + hw, .5, z + hd, [.82, .78, .72]); pl.box(x - hw + .12, .5, z - hd + .12, x + hw - .12, .62, z + hd - .12, [.32, .24, .18]); obs(x - hw - .05, z - hd - .05, x + hw + .05, z + hd + .05);
      const nx = Math.round(hw * 3.2), nz = Math.round(hd * 3.2); for (let i = 0; i < nx * nz; i++) { const px = x + (r() * 2 - 1) * (hw - .2), pz = z + (r() * 2 - 1) * (hd - .2); fl.sphere(px, .78 + r() * .22, pz, .17, .15, .17, [.3 * ST.leaf[0], .62 * ST.leaf[1], .34 * ST.leaf[2]], 4); if (r() < .75) fl.sphere(px, .95 + r() * .2, pz, .11, .1, .11, hex(ST.flowers[(r() * ST.flowers.length) | 0]), 4); } };
    [[-18.5, -4.5, 1.3, .8], [18.5, -4.5, 1.3, .8], [-24.5, -7.5, .9, 1.4], [24.5, -7.5, .9, 1.4], [-5.5, 17, 1.3, .8], [5.5, 17, 1.3, .8], [-24.5, 13, 1, 1], [24.5, 13, 1, 1]].forEach(([x, z, a, b]) => bed(x * K, ZP(z), a, b));
    add(pl, {}); add(fl, {}); }
  { const tr = new MB(), lf = new MB(), lf2 = new MB(), fb = new MB(), hal = new MB(), r = rnd(31), L = ST.leaf;
    const frond = (x, y, z, ang, len, c1, c2) => { const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx, m = [x + dx * len * .55, y + len * .3, z + dz * len * .55], t = [x + dx * len, y - len * .18, z + dz * len], w = len * .17; lf.tri([x, y, z], [m[0] + px * w, m[1], m[2] + pz * w], [m[0] - px * w, m[1], m[2] - pz * w], [0, 1, 0], c1); lf2.tri([m[0] + px * w, m[1], m[2] + pz * w], [m[0] - px * w, m[1], m[2] - pz * w], t, [0, 1, 0], c2); };
    const palm = (x, z, h, lean) => { const tr = new MB(), lf = new MB(), lf2 = new MB(), fb = new MB(); const frond = (x, y, z, ang, len, c1, c2) => { const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx, m = [x + dx * len * .55, y + len * .3, z + dz * len * .55], t = [x + dx * len, y - len * .18, z + dz * len], w = len * .17; lf.tri([x, y, z], [m[0] + px * w, m[1], m[2] + pz * w], [m[0] - px * w, m[1], m[2] - pz * w], [0, 1, 0], c1); lf2.tri([m[0] + px * w, m[1], m[2] + pz * w], [m[0] - px * w, m[1], m[2] - pz * w], t, [0, 1, 0], c2); };
      for (let j = 0; j < 5; j++) { const u = j / 5, v = (j + 1) / 5; tr.cyl(x + lean * u * u, z, h * u, h * v, .24 * (1 - u * .4), .24 * (1 - v * .4), 7, [.5, .38, .28], false); }
      const tx = x + lean, ty = h; for (let k = 0; k < 9; k++) frond(tx, ty, z, k / 9 * 6.283 + r(), 1.7 + r() * .4, [.26 * L[0], .66 * L[1], .3 * L[2]], [.2 * L[0], .54 * L[1], .24 * L[2]]);
      tr.sphere(tx, ty - .1, z, .22, .2, .22, [.4, .3, .2], 5); obs(x - .3, z - .3, x + .3, z + .3);
      for (let k = 0; k < 6; k++) { const a = k * 1.05, px = tx + Math.cos(a) * .9, pz2 = z + Math.sin(a) * .9; fb.sphere(px, ty + .1, pz2, .06, .06, .06, [1, 1, 1], 4); if (k % 2) halo(hal, px, ty + .1, pz2, .5, [1, .85, .5]); }
      occ(() => { add(tr, {}); add(lf, {}); add(lf2, {}); add(fb, emMat([1, .92, .6], .3, 2.2)); }); };
    [-22, -13, -4.5, 4.5, 13, 22].filter(x => Math.abs(x) < 10).forEach((x, i) => palm(x * K, wz(x * K) - .9, 5 + (i % 3) * .5, (i % 2 ? .5 : -.5)));
    palm(-27.2 * K, ZP(8), 5, .3); palm(27.2 * K, ZP(8), 5.4, -.3);
    add(hal, { tex: T.glow, mode: 2, glow: night(.7) }); }

  /* ---------- dynamic: LED redraw / spray / beams / sparkles ---------- */
  S.tex = { beam: R.paint(64, 256, (g, w, h) => { const im = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = (x / (w - 1) - .5) * 2, v = y / (h - 1), a = Math.exp(-u * u * 3.2) * (.15 + .85 * v) * (1 - Math.pow(1 - v, 3) * .0), k = Math.min(255, a * 255) | 0, o = (y * w + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = k; im.data[o + 3] = 255; } g.putImageData(im, 0, 0); }, { clamp: true, mip: false }) };
  S.update = (g, dt) => { const L = S.led; L.acc += dt; if (L.acc < .1) return; L.acc = 0; drawLED(L.cv.getContext('2d'), ST, g.stg || { mode: 'idle', queue: [] }, g.t); R.updateCanvasTex(L.tex, L.cv); };
  S.dyn = (fx, t, g, env) => {
    const c = Math.cos(PITCH), sn = Math.sin(PITCH), stg = g && g.stg ? g.stg : { mode: 'idle' }, act = stg.mode === 'sing' ? 1 : stg.mode === 'wait' ? .5 : 0, nt = env.night;
    for (let k = 0; k < 36; k++) { const ph = (t * .7 + k / 36) % 1, a = k * 2.399, r = ph * 1.9 * (.4 + (k % 5) * .15), y = 2.7 + 1.6 * Math.sin(Math.min(1, ph * 1.15) * Math.PI) - ph * ph * 1.9, x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r, s = .1 + (1 - ph) * .05, P = (u, v) => [x + u * s, y + c * v * s, z - sn * v * s];
      fx.spray.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], [.75, .95, 1]); }
    const cols = [A, A2, [1, .95, .8], mul(A, [.8, .8, 1])];
    for (let k = 0; k < 6; k++) { const hx = -7.5 + k * 3, hy = 9.0, hz = SZ0 + 1.2 + DZS, tx = hx + Math.sin(t * (.7 + k * .11) + k * 1.9) * (4 + act * 3), tz = -4 + DZS + Math.cos(t * (.5 + k * .09) + k * 2.3) * 3, w0 = .12, w1 = 1.0 + act * .4, col = cols[k % 4].map(v => v * (.6 + .4 * Math.sin(t * 2 + k)));
      fx.beam.quad([hx - w0, hy, hz], [hx + w0, hy, hz], [tx + w1, .05, tz], [tx - w1, .05, tz], [0, 1, 0], [0, 0, 1, 1], col); }
    (S.shopFx || []).forEach(fn => fn(fx, t, c, sn));
    fx.glow = { spray: 1, beam: (.12 + .62 * act) * (.3 + .7 * nt), spark: .7 * (.25 + .75 * nt) };
    for (let k = 0; k < 70; k++) { const ph = (t * .35 + k * .137) % 1, tw = Math.max(0, Math.sin(ph * 6.283 * 2 + k)), a = (k * 97.3) % 1, x = -60 + ((k * 53.7) % 120), z = 24 + ((k * 31.3) % 36), s = .16 * tw, P = (u, v) => [x + u * s * 2, -.85, z + v * s]; if (tw > .1 && (x * x * .0 + 1) && !inPoly(x, z, outline)) fx.spark.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], [.85, .95, 1]); }
  };
  S.dynPool = (mb, g, env, t) => { const stg = g && g.stg ? g.stg : { mode: 'idle' };
    if (stg.mode === 'sing' || stg.mode === 'wait') { const k = (stg.mode === 'sing' ? 1 : .6) * (.7 + .3 * Math.sin(t * 4)); pool(mb, 0, -9.6 + DZS, 3.6, [1 * k, .9 * k, .75 * k], SH + .04); }
    if (stg.you) { const k = .6 + .4 * Math.sin(t * 6); pool(mb, 0, SZ1 + 1.6 + DZS, 2.4, [.3 * k, 1 * k, .5 * k], .05); } };

  S.bounds = { x0: -31 * K, x1: 31 * K, z0: ZP(-14), z1: ZP(24) };
  S.spawn = [0, ZP(2.5)];
  S.camera = { dist: 24, pitch: PITCH, fov: .72, clampX: [-29, 29], clampZ: [ZB + 6.5, ZP(22.8) - 12.8], lead: 6 };
  S.cameraWide = { dist: 27, pitch: .14, fov: 1.05 };
  S.npcRect = { x0: -26 * K, x1: 26 * K, z0: ZP(-5.5), z1: ZP(20) };
  S.name = '星光广场'; S.indoor = false;
  S.env = h => G.World.envAt(h);
  return S;
}

/* ---------- LED screen drawing ---------- */
function drawLED(c, ST, st, t) {
  const W = 1024, H = 410, F = (w, s) => `${w} ${s}px "Arial Black","PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`;
  const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, `hsl(${270 + Math.sin(t * .3) * 18},70%,14%)`); gr.addColorStop(1, `hsl(${322 + Math.cos(t * .25) * 18},75%,22%)`); c.fillStyle = gr; c.fillRect(0, 0, W, H);
  const sx = (t * 170) % (W + 400) - 200, lg = c.createLinearGradient(sx - 140, 0, sx + 140, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,200,255,.14)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = lg; c.fillRect(0, 0, W, H);
  c.strokeStyle = ST.accent; c.lineWidth = 10; c.strokeRect(10, 10, W - 20, H - 20); c.strokeStyle = ST.accent2; c.lineWidth = 3; c.strokeRect(26, 26, W - 52, H - 52);
  c.textBaseline = 'middle';
  const gt = (txt, x, y, font, glow, al) => { c.font = font; c.textAlign = al || 'left'; c.shadowColor = glow; c.shadowBlur = 20; c.fillStyle = '#fff'; c.fillText(txt, x, y); c.shadowBlur = 0; };
  const fit = (txt, maxw, size, w) => { c.font = F(w || 800, size); while (c.measureText(txt).width > maxw && size > 24) { size -= 4; c.font = F(w || 800, size); } return size; };
  const eq = (x0, y1, n, bw, gap, hmax) => { for (let i = 0; i < n; i++) { const h = hmax * (.2 + .8 * Math.abs(Math.sin(t * 3.1 + i * .9) * Math.cos(t * 1.7 + i * .5))); c.fillStyle = i % 2 ? ST.accent : ST.accent2; c.fillRect(x0 + i * (bw + gap), y1 - h, bw, h); } };
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const ly = st.mode === 'sing' && window.Karaoke && Karaoke.lyricNow ? Karaoke.lyricNow() : null;   // 伴奏正在播放时才有歌词
  if (ly) {                                   // —— 歌词版面：和 K 歌歌词条内容一致（当前句 + 下一句）——
    const frac = clamp((st.left || 0) / (st.total || 1), 0, 1), red = frac < .2;
    const head = (st.you ? '★ ' : '♪ ') + (st.name || '') + '  《' + (st.song || '') + '》';
    gt(head, 56, 62, F(800, fit(head, 660, 38)), ST.accent2);
    gt('⏱ ' + mmss(st.left || 0), W - 56, 62, F(800, 38), red ? '#ff5a6e' : ST.accent, 'right');
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(56, 96, W - 112, 2);
    const cur = ly.cur; gt(cur, W / 2, 168, F(800, fit(cur, 900, 76)), ST.accent2, 'center');
    if (ly.next) { c.globalAlpha = .6; gt(ly.next, W / 2, 242, F(700, fit(ly.next, 900, 38, 700)), ST.accent, 'center'); c.globalAlpha = 1; }
    eq(56, 362, 12, 14, 8, 40);
    const nx = st.queue && st.queue.length ? 'NEXT ▸ ' + st.queue[0] : ''; if (nx) gt(nx, W - 56, 340, F(700, 26), ST.accent2, 'right');
  } else if (st.mode === 'sing' || st.mode === 'wait') {
    const sing = st.mode === 'sing', fs = fit(st.name || '', 520, 84);
    gt(sing ? '♪ NOW SINGING' : '▶ ON DECK · 请上台', 56, 74, F(800, 32), ST.accent);
    gt(st.name || '', 56, 150, F(800, fs), ST.accent2);
    if (sing) { const f2 = fit('《' + (st.song || '') + '》', 540, 52, 700); gt('《' + (st.song || '') + '》', 56, 222, F(700, f2), ST.accent); }
    else gt('请在倒数结束前走上舞台', 56, 222, F(700, 40), ST.accent);
    eq(56, 340, 14, 22, 10, 80);
    const nx = st.queue && st.queue.length ? 'NEXT ▸ ' + st.queue[0] : (ST.hint || '舞台上只有演唱者，其他人台下观看'); gt(nx, 56, 372, F(700, 28), ST.accent2);
    const cx = 812, cy = 205, R0 = 132, frac = clamp((st.left || 0) / (st.total || 1), 0, 1);
    c.lineWidth = 24; c.strokeStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.arc(cx, cy, R0, 0, 7); c.stroke();
    c.strokeStyle = frac < .2 ? '#ff5a6e' : ST.accent; c.shadowColor = c.strokeStyle; c.shadowBlur = 24; c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, R0, -Math.PI / 2, -Math.PI / 2 + frac * 6.2832); c.stroke(); c.shadowBlur = 0; c.lineCap = 'butt';
    gt(mmss(st.left || 0), cx, cy - 6, F(800, 96), frac < .2 ? '#ff5a6e' : ST.accent2, 'center'); gt(sing ? '剩余时间' : '上台倒数', cx, cy + 66, F(700, 28), ST.accent, 'center');
    if (st.you) gt('★ YOU', cx, 62, F(800, 34), '#ffd54a', 'center');
  } else {
    gt(ST.title || 'STAR PLAZA', W / 2, 120, F(800, ST.titleFs || 132), ST.accent2, 'center');
    gt(ST.sub || '在点歌台点歌 · 轮到你时登台开唱', W / 2, 224, F(700, 44), ST.accent, 'center');
    const n = st.queue ? st.queue.length : 0; gt(n ? `排队 ${n} 人 · 下一位 ${st.queue[0]}` : (ST.idle || '现在没人排队 · 快来当第一位！'), W / 2, 290, F(700, 32), '#fff', 'center');
    eq(120, 384, 30, 18, 10, 56);
  }
}

G.Scenes.drawLED = drawLED; G.Scenes.makePlazaV3 = makePlazaV3; G.Scenes.makePlazaV2 = makePlazaV3; G.Scenes.PLAZA_STYLES = STYLES;
})(window);
