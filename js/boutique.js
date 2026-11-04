/* boutique.js — luxury two-floor fashion mall (bags / clothes / hats / necklaces), grand staircase to a 2F gallery.
   Scenes.makeBoutiqueV2(R, T) -> scene object. Brand names are fictional. */
(function (G) {
'use strict';
const { MB, hex, clamp } = G.World;
const PITCH = 0.5, FL = 4.2;
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const mul = (c, k) => [c[0] * k[0], c[1] * k[1], c[2] * k[2]];
const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
/* hall outline: square back corners, rounded front corners (r) */
function hallPoly(x0, x1, z0, z1, r) { const P = [[x0, z0], [x1, z0]]; const zc = z1 - r; for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI / 2; P.push([x1 - r + Math.cos(a) * r, zc + Math.sin(a) * r]); } for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 + k / 10 * Math.PI / 2; P.push([x0 + r + Math.cos(a) * r, zc + Math.sin(a) * r]); } return P; }

function makeBoutiqueV2(R, T) {
  const S = { batches: [], obstacles: [], portals: [], hotspots: [], spots: [], lamps: [], seats: [], occluders: [] };
  const bbOf = (mb) => { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (let k = 0; k < mb.v.length; k += 11) for (let j = 0; j < 3; j++) { const v = mb.v[k + j]; if (v < a[j]) a[j] = v; if (v > b[j]) b[j] = v; } return [a, b]; };
  const add = (mb, mat) => { if (mb.i.length) { const b = R.batch(mb, mat); b.bb = bbOf(mb); S.batches.push(b); } return mb; };
  const occ = (fn) => { const n0 = S.batches.length; fn(); const bs = S.batches.slice(n0).filter(b => b.bb && b.mat.mode === 0); if (!bs.length) return; const a = [1e9, 1e9, 1e9], c = [-1e9, -1e9, -1e9]; bs.forEach(b => { for (let j = 0; j < 3; j++) { a[j] = Math.min(a[j], b.bb[0][j]); c[j] = Math.max(c[j], b.bb[1][j]); } }); S.occluders.push({ bs, a, b: c, f: 1 }); };
  S.updateOcclusion = (eye, me, dt) => {
    const px = me.x, py = (me.y || 0) + .9, pz = me.z, pad = .2, k = Math.min(1, dt * 9);
    const hit = (o) => { const mn = [o.a[0] - pad, o.a[1] - pad, o.a[2] - pad], mx = [o.b[0] + pad, o.b[1] + pad, o.b[2] + pad];
      for (const [ox, oz] of [[0, 0], [.5, 0], [-.5, 0]]) for (const oy of [-.7, .5]) { const d = [px + ox - eye[0], py + oy - eye[1], pz + oz - eye[2]], len = Math.hypot(d[0], d[1], d[2]); let t0 = 0, t1 = Math.max(0, 1 - 2.6 / len), ok = true;
        for (let j = 0; j < 3; j++) { if (Math.abs(d[j]) < 1e-6) { if (eye[j] < mn[j] || eye[j] > mx[j]) { ok = false; break; } } else { let a = (mn[j] - eye[j]) / d[j], b = (mx[j] - eye[j]) / d[j]; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; } } }
        if (ok) return true; } return false; };
    for (const o of S.occluders) { const tg = hit(o) ? .1 : 1; o.f += (tg - o.f) * k; if (Math.abs(o.f - tg) < .01) o.f = tg; for (const b of o.bs) b.fade = o.f; }
  };
  /* f: 0 = ground floor only, 1 = upper floor only, undefined = both */
  const obs = (x0, z0, x1, z1, f) => S.obstacles.push({ x0, z0, x1, z1, f });
  const solid = (c) => R.solidTex([c[0] * 255, c[1] * 255, c[2] * 255, 255]);
  const emMat = (c, d, n) => ({ em: solid(c), emDay: d, emNight: n });
  const halo = (mb, x, y, z, s, col) => { const c = Math.cos(PITCH), sn = Math.sin(PITCH); const P = (a, b) => [x + a * s, y + c * b * s, z - sn * b * s]; mb.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col); };
  const pool = (mb, x, z, r, col, y) => mb.floor(x - r, z - r, x + r, z + r, y == null ? .03 : y, col);
  const night = k => e => .05 + e.night * k * .6;   // additive glows: nearly off by day so the marble never blows out
  const GOLD = [.93, .76, .36], IVORY = [.96, .93, .87], RED = [.62, .07, .16], DARK = [.2, .16, .22];
  const rr = rnd(7);

  /* ---------- textures ---------- */
  const marble = R.paint(512, 512, g => { g.fillStyle = '#efe6d8'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#d6c9b6'; g.fillRect(0, 0, 256, 256); g.fillRect(256, 256, 256, 256); const r = rnd(3); g.strokeStyle = 'rgba(120,100,80,.18)'; g.lineWidth = 2; for (let i = 0; i < 26; i++) { g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - .5) * 80; y += (r() - .5) * 80; g.lineTo(x, y); } g.stroke(); } g.strokeStyle = '#c9a24a'; g.lineWidth = 4; g.strokeRect(2, 2, 508, 508); g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke(); });
  const carpet = R.paint(256, 256, g => { g.fillStyle = '#8c1428'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#e9c35a'; g.lineWidth = 10; g.strokeRect(5, 0, 246, 256); g.strokeStyle = '#c99a2e'; g.lineWidth = 3; g.strokeRect(22, -2, 212, 260); g.strokeStyle = 'rgba(233,195,90,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(128, 20); g.lineTo(190, 128); g.lineTo(128, 236); g.lineTo(66, 128); g.closePath(); g.stroke(); g.beginPath(); g.arc(128, 128, 22, 0, 7); g.stroke(); });
  const damask = R.paint(256, 256, g => { g.fillStyle = '#efe3cf'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(190,150,70,.28)'; const d = (x, y) => { g.beginPath(); g.moveTo(x, y - 34); g.quadraticCurveTo(x + 22, y - 6, x, y + 34); g.quadraticCurveTo(x - 22, y - 6, x, y - 34); g.fill(); g.beginPath(); g.arc(x, y + 44, 7, 0, 7); g.fill(); }; d(64, 64); d(192, 64); d(64, 192); d(192, 192); d(128, 128 + 0); g.strokeStyle = 'rgba(190,150,70,.2)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256); });
  const win = R.paint(128, 320, g => { const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#a9d4ff'); gr.addColorStop(1, '#eaf6ff'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 320); g.lineTo(0, 64); g.arc(64, 64, 64, Math.PI, 0); g.lineTo(128, 320); g.closePath(); g.fill(); g.strokeStyle = '#c99a2e'; g.lineWidth = 6; g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 320); g.moveTo(0, 150); g.lineTo(128, 150); g.moveTo(0, 235); g.lineTo(128, 235); g.stroke(); }, { clamp: true });
  const winEm = R.paint(128, 320, g => { const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#7db4f0'); gr.addColorStop(1, '#d6ecff'); g.fillStyle = gr; g.fillRect(0, 0, 128, 320); }, { clamp: true });
  const sgn = (text, o) => T.sign(text, Object.assign({ w: 768, h: 150, fs: 76, bg: '#1a1020', fg: '#f8e2a8', border: '#e1b84e' }, o || {}));

  /* ---------- shape ---------- */
  const outline = hallPoly(-17, 17, -15, 13, 7), inner = hallPoly(-16.3, 16.3, -14.3, 12.3, 6.3);
  S.walkable = (x, z) => inPoly(x, z, inner);
  S.outline = outline;
  const wallSeg = (mb, A, B, h, y0, col) => { const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; mb.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], h, B[1]], [A[0], h, A[1]], [-dz / l, 0, dx / l], [0, 0, l / 4, (h - y0) / 4], col); return l; };

  /* floor */
  { const f = new MB(); f.poly(outline, 0, [1, 1, 1], 4); add(f, { tex: marble });
    const b = new MB(); for (let i = 0; i < outline.length; i++) { const A = outline[i], B = outline[(i + 1) % outline.length], a = inner[i], bb = inner[(i + 1) % inner.length]; b.quad([A[0], .012, A[1]], [B[0], .012, B[1]], [bb[0], .012, bb[1]], [a[0], .012, a[1]], [0, 1, 0], [0, 0, 1, 1], [.78, .62, .3]); } add(b, {});
    const c = new MB(); c.floor(-2.1, -3, 2.1, 12.6, .02, [1, 1, 1], [0, 0, 1, 4]); add(c, { tex: carpet }); }

  /* walls: tall at back/sides, low gilded balustrade at the open front */
  { const tall = new MB(), low = new MB(), trim = new MB(), rail = new MB();
    for (let i = 0; i < outline.length; i++) { const A = outline[i], B = outline[(i + 1) % outline.length]; if (i === 0) { /* back wall */ wallSeg(tall, A, B, 12, 0, [1, 1, 1]); continue; }
      const mz = (A[1] + B[1]) / 2; if (mz < 6.2) { wallSeg(tall, A, B, 12, 0, [1, 1, 1]); } else { wallSeg(low, A, B, 1.0, 0, [.95, .9, .85]); const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; rail.quad([A[0], 1.0, A[1]], [B[0], 1.0, B[1]], [B[0], 1.12, B[1]], [A[0], 1.12, A[1]], [-dz / l, 0, dx / l], [0, 0, 1, 1], GOLD); } }
    add(tall, { tex: damask }); add(low, {}); add(rail, {});
    // skirting + cornice
    for (let i = 0; i < outline.length; i++) { const A = outline[i], B = outline[(i + 1) % outline.length]; if (i !== 0 && (A[1] + B[1]) / 2 >= 6.2) continue; const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; [[0, .55, [.82, .66, .3]], [11.4, 12, [.9, .74, .38]]].forEach(([y0, y1, col]) => trim.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], [-dz / l, 0, dx / l], [0, 0, 1, 1], col)); }
    add(trim, {}); }

  /* tall arched windows (light changes with the time line) */
  { const w = new MB(); [-1, 1].forEach(sd => { const x = sd * 16.93; for (let z = -13; z <= 8; z += 3.6) { const hw = 1.05; if (sd < 0) w.quad([x, 4.9, z + hw], [x, 4.9, z - hw], [x, 10.4, z - hw], [x, 10.4, z + hw], [1, 0, 0], [0, 0, 1, 1], [1, 1, 1]); else w.quad([x, 4.9, z - hw], [x, 4.9, z + hw], [x, 10.4, z + hw], [x, 10.4, z - hw], [-1, 0, 0], [0, 0, 1, 1], [1, 1, 1]); } });
    const bw = [-12, -6, 6, 12]; bw.forEach(x => w.quad([x - 1.05, 5.4, -14.93], [x + 1.05, 5.4, -14.93], [x + 1.05, 10.6, -14.93], [x - 1.05, 10.6, -14.93], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1])); add(w, { tex: win, em: winEm, emDay: .9, emNight: .08 }); }

  /* ---------- grand staircase (2F at y = FL) ---------- */
  const NST = 21, SZ0 = -3, SZ1 = -8, dz = (SZ0 - SZ1) / NST;
  S.heightAt = (x, z) => { if (z <= SZ1) return FL; if (z < SZ0) return Math.abs(x) < 3.6 ? FL * (SZ0 - z) / (SZ0 - SZ1) : FL; return 0; };   // gallery sides (|x|>=3.6, z<-3) are the 2F slab
  { const st = new MB(), cp = new MB(), tr = new MB(), post = new MB(), hr = new MB();
    for (let i = 0; i < NST; i++) { const za = SZ0 - i * dz, zb = SZ0 - (i + 1) * dz, h = (i + 1) * FL / NST; st.box(-3.6, 0, zb, 3.6, h, za, IVORY, [4, 4]); cp.floor(-2.3, zb, 2.3, za, h + .004, RED); cp.wall(-2.3, h - FL / NST, 2.3, h, za + .004, mul(RED, [.8, .8, .8])); cp.floor(-2.3, zb, -2.15, za, h + .006, GOLD); cp.floor(2.15, zb, 2.3, za, h + .006, GOLD);
      if (i % 2 === 0) [-3.45, 3.45].forEach(x => { post.cyl(x, (za + zb) / 2, h, h + .95, .045, .045, 6, GOLD, true); }); }
    [-3.45, 3.45].forEach(x => { hr.quad([x, .95, SZ0], [x, FL + .95, SZ1], [x, FL + 1.04, SZ1], [x, 1.04, SZ0], [1, 0, 0], [0, 0, 1, 1], GOLD); post.cyl(x, SZ0 + .1, 0, 1.3, .13, .1, 10, IVORY, true); post.sphere(x, 1.5, SZ0 + .1, .24, .24, .24, GOLD, 8); post.cyl(x, SZ1 - .1, FL, FL + 1.3, .13, .1, 10, IVORY, true); post.sphere(x, FL + 1.5, SZ1 - .1, .24, .24, .24, GOLD, 8); });
    add(st, { tex: marble }); add(cp, {}); add(post, {}); add(hr, {});
    const gl = new MB(); [-3.45, 3.45].forEach(x => { halo(gl, x, 1.5, SZ0 + .1, 1.6, [1, .85, .5]); halo(gl, x, FL + 1.5, SZ1 - .1, 1.6, [1, .85, .5]); }); add(gl, { tex: T.glow, mode: 2, glow: night(.7) }); }

  /* ---------- 2F slab, balustrade, back wall niches ---------- */
  { const sl = new MB(); sl.box(-17, FL - .3, -15, -3.6, FL, -3, IVORY, [4, 4]); sl.box(3.6, FL - .3, -15, 17, FL, -3, IVORY, [4, 4]); sl.box(-3.6, FL - .3, -15, 3.6, FL, -8, IVORY, [4, 4]); add(sl, { tex: marble });
    const fa = new MB(); fa.box(-17, FL - .55, -3.06, -3.6, FL - .3, -3, GOLD); fa.box(3.6, FL - .55, -3.06, 17, FL - .3, -3, GOLD); add(fa, {});
    const bal = new MB(); [[-17, -3.6], [3.6, 17]].forEach(([a, b]) => { for (let x = a + .2; x <= b - .1; x += .8) bal.cyl(x, -3.15, FL, FL + .95, .05, .05, 6, IVORY, true); bal.box(a, FL + .95, -3.22, b, FL + 1.05, -3.08, GOLD); bal.box(a, FL, -3.22, b, FL + .08, -3.08, GOLD); }); add(bal, {});
    // gilded 2F bays on the back wall
    obs(-17, -15, -3.28, -3, 0); obs(3.28, -15, 17, -3, 0);          // ground floor: closed alcoves under the gallery
    obs(-17, -3.3, -3.5, -3.02, 1); obs(3.5, -3.3, 17, -3.02, 1);     // gallery balustrade
    obs(-3.8, -8, -3.5, -3.02, 1); obs(3.5, -8, 3.8, -3.02, 1);       // stairwell sides (upper floor)
    // ground-floor facade of the alcoves (visible from the hall)
    const fc = new MB(); fc.box(-17, 0, -3.1, -3.6, FL - .55, -3, [1, 1, 1], [4, 4]); fc.box(3.6, 0, -3.1, 17, FL - .55, -3, [1, 1, 1], [4, 4]); add(fc, { tex: damask });
    const pil = new MB(); [-16.6, -13.2, -5, -3.9, 3.9, 5, 13.2, 16.6].forEach(x => { pil.box(x - .25, 0, -3.35, x + .25, FL - .55, -2.95, IVORY); pil.box(x - .32, 0, -3.4, x + .32, .3, -2.9, GOLD); pil.box(x - .32, FL - .85, -3.4, x + .32, FL - .55, -2.9, GOLD); }); add(pil, {});
    // grand arch over the stairs' top landing
    const ar = new MB(); ar.arch(0, 7.2, -8.9, -8.1, 4.5, 3.9, 0, Math.PI, 40, GOLD); [-4.2, 4.2].forEach(x => ar.box(x - .3, FL, -8.9, x + .3, 7.2, -8.1, IVORY)); occ(() => add(ar, {}));
    const ae = new MB(); ae.arch(0, 7.2, -8.1, -8.04, 3.9, 3.7, 0, Math.PI, 40, [1, 1, 1]); add(ae, emMat([1, .85, .5], .5, 2.4));
    const crest = sgn('STAR MALL · 星光名品', { w: 1024, h: 160, fs: 84 }), cb = new MB(); cb.quad([-3.6, 8.3, -8.05], [3.6, 8.3, -8.05], [3.6, 10.2, -8.05], [-3.6, 10.2, -8.05], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); add(cb, { tex: crest.tex, em: crest.em, emDay: .5, emNight: 1.6 }); }

  /* ---------- merchandise builders ---------- */
  const bag = (mb, x, y, z, col, w) => { w = w || .4; mb.box(x - w / 2, y, z - w * .2, x + w / 2, y + w * .7, z + w * .2, col); mb.box(x - w / 2 - .005, y + w * .5, z - w * .21, x + w / 2 + .005, y + w * .7, z + w * .21, mul(col, [.75, .75, .75])); mb.box(x - .03, y + w * .52, z + w * .2, x + .03, y + w * .6, z + w * .23, GOLD); mb.box(x - w * .32, y + w * .7, z - .015, x - w * .27, y + w * .98, z + .015, DARK); mb.box(x + w * .27, y + w * .7, z - .015, x + w * .32, y + w * .98, z + .015, DARK); mb.box(x - w * .32, y + w * .96, z - .015, x + w * .32, y + w * 1.0, z + .015, DARK); };
  const hat = (mb, x, y, z, col, k) => { k = k || 1; mb.cyl(x, z, y, y + .025, .3 * k, .3 * k, 14, col, true); mb.cyl(x, z, y + .02, y + .22, .16 * k, .15 * k, 12, col, true); mb.cyl(x, z, y + .03, y + .08, .163 * k, .163 * k, 12, GOLD, false); };
  const bust = (mb, x, y, z, col) => { mb.cyl(x, z, y, y + .05, .2, .2, 10, GOLD, true); mb.cyl(x, z, y + .05, y + .5, .09, .06, 8, col, true); mb.cyl(x, z, y + .3, y + .5, .2, .13, 10, col, true); mb.sphere(x, y + .6, z, .08, .1, .08, [.95, .85, .78], 6); for (let k = 0; k < 12; k++) { const a = Math.PI * (.12 + k / 11 * .76), px = x + Math.cos(a) * .16, pz = z + Math.sin(a) * .16 + .02; mb.sphere(px, y + .44 - Math.sin(a) * .0, pz, .018, .018, .018, k % 3 === 0 ? [.4, .8, 1] : [1, .96, .9], 4); } mb.sphere(x, y + .36, z + .22, .035, .035, .035, [1, .3, .5], 5); };
  const gown = (mb, x, y, z, col, h) => { h = h || 1; mb.cyl(x, z, y, y + .03, .3, .3, 12, GOLD, true); mb.cyl(x, z, y + .03, y + .6 * h, .025, .025, 6, GOLD, false); mb.cyl(x, z, y + .55 * h, y + 1.1 * h, .24, .15, 10, col, true); mb.cyl(x, z, y + .06, y + .55 * h, .5, .24, 14, mul(col, [.9, .9, .95]), false); mb.cyl(x, z, y + 1.1 * h, y + 1.2 * h, .05, .04, 6, [.95, .85, .78], false); mb.sphere(x, y + 1.3 * h, z, .09, .11, .09, [.95, .85, .78], 6); };
  const garment = (mb, x, y, z, col) => { mb.box(x - .02, y + 1.0, z - .01, x + .02, y + 1.06, z + .01, GOLD); mb.box(x - .24, y + .3, z - .05, x + .24, y + 1.0, z + .05, col); mb.box(x - .36, y + .75, z - .045, x - .24, y + 1.0, z + .045, col); mb.box(x + .24, y + .75, z - .045, x + .36, y + 1.0, z + .045, col); };
  const BAGC = [[.75, .1, .2], [.1, .2, .5], [.95, .85, .7], [.12, .12, .14], [.9, .45, .55], [.2, .5, .4]], HATC = [[.95, .9, .8], [.12, .12, .16], [.8, .2, .3], [.35, .5, .75], [.95, .75, .8]], CLC = [[.85, .2, .35], [.2, .3, .6], [.95, .9, .85], [.15, .15, .2], [.4, .65, .5], [.9, .6, .2], [.6, .3, .75]];
  /* wall bay: shelves + items + counter + sign. dir=+1 on the left wall (faces +x), -1 on the right wall */
  const bay = (xw, z0, z1, dir, kind, name, signCol) => {
    const sh = new MB(), it = new MB(), ct = new MB(), gl = new MB(), len = z1 - z0, n = Math.floor(len / .6);
    sh.box(Math.min(xw, xw + dir * .06), 0, z0, Math.max(xw, xw + dir * .06), 3.7, z1, [.12, .1, .16]);
    [.7, 1.55, 2.4, 3.25].forEach((y, li) => { sh.box(Math.min(xw, xw + dir * .55), y - .04, z0, Math.max(xw, xw + dir * .55), y + .02, z1, IVORY); gl.floor(Math.min(xw, xw + dir * .5), z0 + .1, Math.max(xw, xw + dir * .5), z1 - .1, y + .021, [.9, .8, .5]);
      for (let k = 0; k < n; k++) { const z = z0 + .45 + k * ((len - .9) / Math.max(1, n - 1)), x = xw + dir * .3; if (kind === 'bags') bag(it, x, y + .02, z, BAGC[(k + li) % BAGC.length], .4); else if (kind === 'hats') { if (li < 3) hat(it, x, y + .02, z, HATC[(k + li) % HATC.length], .9); } else if (kind === 'jewel') bust(it, x, y + .02, z, [.12, .1, .2]); else if (li < 2) { it.box(x - .22, y + .02, z - .22, x + .22, y + .12 + .05 * ((k + li) % 3), z + .22, CLC[(k + li) % CLC.length]); } } });
    if (kind === 'clothes') { for (let k = 0; k < n; k++) { const z = z0 + .45 + k * ((len - .9) / Math.max(1, n - 1)); it.box(xw + dir * .25 - .01, 2.46, z - .01, xw + dir * .25 + .01, 2.52, z + .01, GOLD); garment(it, xw + dir * .3, 1.45 + .0, z, CLC[(k * 2) % CLC.length]); garment(it, xw + dir * .3, 2.3 + 0, z, CLC[(k * 3 + 1) % CLC.length]); } }
    add(sh, {}); add(it, {}); add(gl, emMat([.9, .8, .5], .15, .8));
    // counter
    const cx = xw + dir * 1.9; ct.box(cx - .4, 0, z0 + .5, cx + .4, 1.0, z1 - .5, IVORY, [4, 4]); ct.box(cx - .45, 1.0, z0 + .45, cx + .45, 1.08, z1 - .45, GOLD); ct.box(cx - .42, 0, z0 + .5, cx + .42, .12, z1 - .5, GOLD); add(ct, { tex: marble });
    const cit = new MB(); for (let k = 0; k < 3; k++) { const z = z0 + 1.1 + k * ((len - 2.2) / 2); if (kind === 'bags') bag(cit, cx, 1.08, z, BAGC[k], .36); else if (kind === 'hats') hat(cit, cx, 1.08, z, HATC[k], .8); else if (kind === 'jewel') bust(cit, cx, 1.08, z, [.12, .1, .2]); else gown(cit, cx, 1.08, z, CLC[k], .5); } add(cit, {});
    obs(Math.min(xw, cx + .5), z0, Math.max(xw, cx + .5), z1, 0);
    const sgx = sgn(name, { bg: '#1a1020', fg: '#f8e2a8', border: signCol }), sb = new MB(), xs = xw + dir * .08;
    if (dir > 0) sb.quad([xs, 3.8, z1], [xs, 3.8, z0], [xs, 4.8, z0], [xs, 4.8, z1], [1, 0, 0], [0, 0, 1, 1], [1, 1, 1]); else sb.quad([xs, 3.8, z0], [xs, 3.8, z1], [xs, 4.8, z1], [xs, 4.8, z0], [-1, 0, 0], [0, 0, 1, 1], [1, 1, 1]); add(sb, { tex: sgx.tex, em: sgx.em, emDay: .5, emNight: 1.7 });
    const gg = new MB(); pool(gg, xw + dir * 2.4, (z0 + z1) / 2, 3.4, [1, .85, .6], .035); halo(gg, xw + dir * 1.4, 2.2, (z0 + z1) / 2, 4.2, [1, .85, .6]); add(gg, { tex: T.glow, mode: 2, glow: night(.55) });
  };
  bay(-16.7, -1.5, 4.3, 1, 'bags', 'MAISON LUNE · 手袋', '#ff7aa8');
  bay(-16.7, 5.3, 11, 1, 'hats', 'VELOUR · 帽饰', '#b48cff');
  bay(16.7, -1.5, 4.3, -1, 'jewel', 'ÉTOILE · 珠宝项链', '#7ee8ff');
  bay(16.7, 5.3, 11, -1, 'clothes', 'AURELIA · 时装', '#ffd166');

  /* ---------- seating (velvet sofas / armchairs) ---------- */
  const seatAdd = (x, z, yaw, h, ap) => { const s = { x, z, yaw, h, ap, who: null, res: null }; s.hot = { id: 'sit', seat: s, x: ap[0], z: ap[1], r: 1.4 }; S.seats.push(s); return s; };
  const sofa = (x, z, dir, len, col, base, f) => {
    const fx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0, fz = dir === 's' ? 1 : dir === 'n' ? -1 : 0, ew = fx !== 0, hx = ew ? .5 : len / 2, hz = ew ? len / 2 : .5, b = new MB();
    b.box(x - hx, base, z - hz, x + hx, base + .45, z + hz, col); b.box(x - hx, base, z - hz, x + hx, base + .12, z + hz, GOLD);
    const bx = x - fx * (hx - .1), bz = z - fz * (hz - .1); if (ew) b.box(Math.min(bx - .1, bx + .1), base + .45, z - hz, Math.max(bx - .1, bx + .1), base + 1.05, z + hz, mul(col, [.92, .92, .92])); else b.box(x - hx, base + .45, bz - .1, x + hx, base + 1.05, bz + .1, mul(col, [.92, .92, .92]));
    if (ew) { b.box(x - hx, base + .45, z - hz, x + hx, base + .7, z - hz + .12, GOLD); b.box(x - hx, base + .45, z + hz - .12, x + hx, base + .7, z + hz, GOLD); } else { b.box(x - hx, base + .45, z - hz, x - hx + .12, base + .7, z + hz, GOLD); b.box(x + hx - .12, base + .45, z - hz, x + hx, base + .7, z + hz, GOLD); }
    add(b, {}); obs(x - hx - .05, z - hz - .05, x + hx + .05, z + hz + .05, f);
    const ns = Math.max(1, Math.round(len / 1.1)); for (let k = 0; k < ns; k++) { const o = (k - (ns - 1) / 2) * 1.05, sx = x + (ew ? 0 : o) - fx * .08, sz = z + (ew ? o : 0) - fz * .08; seatAdd(sx, sz, Math.atan2(fx, fz), base + .45, [sx + fx * 1.2, sz + fz * 1.2]); }
  };
  // two display plinths with lounge sofas (ground) — the carpet axis stays clear
  [-6, 6].forEach((px, i) => { const pl = new MB(); pl.cyl(px, 4.6, 0, .35, 1.6, 1.5, 22, IVORY, true); pl.cyl(px, 4.6, .35, .42, 1.5, 1.45, 22, GOLD, true); add(pl, {}); obs(px - 1.7, 2.9, px + 1.7, 6.3, 0);
    const mn = new MB(); gown(mn, px - .5, .42, 4.6, i ? [.15, .2, .55] : [.8, .12, .3], 1.2); gown(mn, px + .5, .42, 4.6, i ? [.8, .12, .3] : [.15, .2, .55], 1.2); occ(() => add(mn, {}));
    const gl = new MB(); pool(gl, px, 5.2, 4.6, [1, .85, .6], .036); add(gl, { tex: T.glow, mode: 2, glow: night(.5) });
    sofa(px, 7.4, 'n', 2.8, [.55, .12, .3], 0); });
  // 2F lounge (upper): sofas around a low table
  { const t = new MB(); t.cyl(-9, -9, FL, FL + .45, .6, .6, 14, IVORY, true); t.cyl(-9, -9, FL + .45, FL + .5, .7, .7, 14, GOLD, true); t.cyl(9, -9, FL, FL + .45, .6, .6, 14, IVORY, true); t.cyl(9, -9, FL + .45, FL + .5, .7, .7, 14, GOLD, true); add(t, {}); obs(-9.7, -9.7, -8.3, -8.3, 1); obs(8.3, -9.7, 9.7, -8.3, 1);
    sofa(-9, -6.6, 'n', 2.6, [.2, .3, .6], FL, 1); sofa(-9, -11.4, 's', 2.6, [.2, .3, .6], FL, 1); sofa(9, -6.6, 'n', 2.6, [.2, .3, .6], FL, 1); sofa(9, -11.4, 's', 2.6, [.2, .3, .6], FL, 1); }
  // 2F merchandise: gown displays + necklace busts along the back wall
  { const mm = new MB(); [-14, -11, 11, 14].forEach((x, i) => { mm.cyl(x, -13.4, FL, FL + .4, .75, .7, 16, IVORY, true); mm.cyl(x, -13.4, FL + .4, FL + .46, .7, .65, 16, GOLD, true); gown(mm, x, FL + .46, -13.4, CLC[i * 2 % CLC.length], 1.5); obs(x - .8, -14.2, x + .8, -12.6, 1); });
    [-7.5, -5, 5, 7.5].forEach((x, i) => { mm.box(x - .5, FL, -14.6, x + .5, FL + .9, -13.6, IVORY, [4, 4]); mm.box(x - .55, FL + .9, -14.65, x + .55, FL + .96, -13.55, GOLD); bust(mm, x - .22, FL + .96, -14.1, [.12, .1, .2]); bag(mm, x + .22, FL + .96, -14.1, BAGC[i % 6], .36); obs(x - .6, -14.7, x + .6, -13.5, 1); }); add(mm, { tex: marble });
    const s1 = sgn('HAUTE COUTURE · 高级定制', { w: 1024, h: 150, fs: 70, border: '#ff7aa8' }), s2 = sgn('JOAILLERIE · 珠宝', { w: 768, h: 150, fs: 70, border: '#7ee8ff' });
    const sb = new MB(); sb.quad([-16, 8.0, -14.9], [-9, 8.0, -14.9], [-9, 9.4, -14.9], [-16, 9.4, -14.9], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); add(sb, { tex: s1.tex, em: s1.em, emDay: .5, emNight: 1.6 });
    const sb2 = new MB(); sb2.quad([9, 8.0, -14.9], [16, 8.0, -14.9], [16, 9.4, -14.9], [9, 9.4, -14.9], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); add(sb2, { tex: s2.tex, em: s2.em, emDay: .5, emNight: 1.6 });
    const gg = new MB(); [[-12.5, -12], [12.5, -12], [0, -11]].forEach(([x, z]) => pool(gg, x, z, 5, [1, .85, .6], FL + .03)); add(gg, { tex: T.glow, mode: 2, glow: night(.55) }); }

  /* ---------- columns, chandeliers ---------- */
  { [[-9.5, 1.2], [9.5, 1.2], [-9.5, 9.6], [9.5, 9.6]].forEach(([x, z]) => { occ(() => { const c = new MB(); c.cyl(x, z, 0, .4, .62, .6, 14, GOLD, true); c.cyl(x, z, .4, 8.4, .42, .38, 16, IVORY, false); c.cyl(x, z, 8.4, 8.8, .66, .5, 14, GOLD, true); add(c, {}); }); obs(x - .5, z - .5, x + .5, z + .5, 0); }); }
  const chand = (x, y, z, s) => { occ(() => { const c = new MB(), cr = new MB(); [[0, 1.0], [-.7, .7], [-1.35, .4]].forEach(([dy, r], i) => { c.disc(x, z, y + dy, r * s, 24, GOLD, (r - .08) * s); for (let k = 0; k < 14 - i * 2; k++) { const a = k / (14 - i * 2) * 6.283; cr.sphere(x + Math.cos(a) * r * s, y + dy - .12, z + Math.sin(a) * r * s, .06, .1, .06, [1, 1, 1], 4); } }); c.cyl(x, z, y - 1.6, y + 1.6, .05, .05, 6, GOLD, false); cr.sphere(x, y - 1.7, z, .14, .22, .14, [1, 1, 1], 5); add(c, {}); add(cr, emMat([1, .95, .8], .5, 2.6)); }); const gl = new MB(); halo(gl, x, y - .5, z, 5.5 * s, [1, .85, .55]); add(gl, { tex: T.glow, mode: 2, glow: night(.8) }); };
  chand(0, 8.6, 5.2, 1.5); chand(0, 9.4, -11, 1.3); chand(-9, 8.6, -4, .9); chand(9, 8.6, -4, .9);

  /* ---------- fitting mirrors (hotspots) ---------- */
  { const fr = new MB(); fr.box(-10.4, .15, -3.12, -5.6, 4.0, -2.96, GOLD); add(fr, {}); const mr = new MB(); mr.wall(-10.05, .4, -5.95, 3.75, -2.94, [1, 1, 1]); add(mr, { tex: T.mirror, em: T.mirrorEm, emDay: .4, emNight: .9 });
    const lb = sgn('FITTING · 试衣镜', { w: 512, h: 100, fs: 54 }), sb = new MB(); sb.quad([-9.2, 4.0, -2.93], [-6.8, 4.0, -2.93], [-6.8, 4.5, -2.93], [-9.2, 4.5, -2.93], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); add(sb, { tex: lb.tex, em: lb.em, emDay: .5, emNight: 1.5 });
    const gl = new MB(); pool(gl, -8, -1.2, 3.2, [1, .8, .95], .037); add(gl, { tex: T.glow, mode: 2, glow: night(.6) });
    S.hotspots.push({ id: 'wardrobe', x: -8, z: -1.2, r: 2.0, label: '试衣镜', color: [1, .6, .85] });
    const fr2 = new MB(); fr2.box(-2.5, FL + .15, -14.98, 2.5, FL + 4.0, -14.84, GOLD); add(fr2, {}); const mr2 = new MB(); mr2.wall(-2.15, FL + .4, 2.15, FL + 3.75, -14.82, [1, 1, 1]); add(mr2, { tex: T.mirror, em: T.mirrorEm, emDay: .4, emNight: .9 });
    S.hotspots.push({ id: 'wardrobe', x: 0, z: -13.0, r: 2.0, label: '试衣镜', color: [1, .6, .85] }); const g2 = new MB(); pool(g2, 0, -13.2, 3.2, [1, .8, .95], FL + .037); add(g2, { tex: T.glow, mode: 2, glow: night(.6) }); }

  /* ---------- exit (front centre) ---------- */
  { const ex = new MB(); [-2.7, 2.7].forEach(x => { ex.cyl(x, 12.4, 0, 3.6, .3, .26, 12, IVORY, true); ex.sphere(x, 3.9, 12.4, .3, .3, .3, GOLD, 8); ex.cyl(x, 12.4, 3.6, 5.8, .14, .14, 8, IVORY, true); }); occ(() => add(ex, {}));
    const es = sgn('出口 EXIT · 回到星光广场', { w: 768, h: 120, fs: 56, border: '#7dffb0' }), eb = new MB(); eb.quad([-2.4, 4.6, 12.35], [2.4, 4.6, 12.35], [2.4, 5.5, 12.35], [-2.4, 5.5, 12.35], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); add(eb, { tex: es.tex, em: es.em, emDay: .6, emNight: 1.6 });
    const gl = new MB(); pool(gl, 0, 11, 3.2, [.4, 1, .6], .036); add(gl, { tex: T.glow, mode: 2, glow: night(.6) });
    S.portals.push({ id: 'plaza', x: 0, z: 10.8, r: 1.9, label: '回到星光广场', color: [.4, 1, .6], spawn: [-20.7, -8.4] }); }

  S.bounds = { x0: -17, x1: 17, z0: -15, z1: 13 };
  S.spawn = [0, 9];
  S.camera = { dist: 23, pitch: PITCH, fov: .74, clampX: [-6, 6], clampZ: [-12, 6], lead: 5 };
  S.cameraWide = { dist: 24, pitch: .17, fov: 1.05 };
  S.npcRect = { x0: -13, x1: 13, z0: -1.5, z1: 11 };
  S.name = '星光名品廊 · STAR MALL'; S.indoor = true;
  S.env = h => { const e0 = G.World.envAt(h), n = clamp(e0.night, 0, 1), L = (a, b) => a.map((v, i) => v + (b[i] - v) * n);
    return { indoor: true, night: n * .85, gold: e0.gold || 0, day: 1 - n, dir: [.2, 1, .5], sun: L([.58, .52, .46], [.3, .26, .4]), amb: L([.74, .68, .74], [.42, .36, .58]), top: [.9, .8, .9], bot: L([.92, .86, .9], [.12, .08, .2]), fog: L([.92, .86, .9], [.12, .08, .2]), charAmb: L([.68, .64, .8], [.5, .46, .72]), charSun: L([.5, .46, .34], [.34, .3, .3]), line: [.3, .18, .24], fogNear: 60, fogFar: 140 }; };
  return S;
}
G.Scenes.makeBoutiqueV2 = makeBoutiqueV2;
})(window);
