/* scene_funfair.js — STAR FUNFAIR 星光嘉年华（独立场景文件）
   用法：在 scenes.js 之后、game.js 之前加载；  Scenes.makeFunfair(R, T)  返回和其他场景一样的对象。
   特点：约 130x85 米的大地图（为几百人同屏准备）/ 不规则边界 + 湖泊 + 远景城市 / 摩天轮·旋转木马·过山车可以真的坐上去 /
         摊位街小游戏 / 喷泉许愿 / 鬼屋 / 夜晚自动烟花秀。
   所有动画都在 S.env() 里驱动（game.js 每帧都会调用），所以不需要改渲染循环。 */
(function (G) {
'use strict';
const { MB, hex, clamp, envAt, sstep, lerp } = G.World;
const PI = Math.PI, TAU = PI * 2;
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v); }

/* =====================================================================
   地图形状：一个"肾形"的大公园 + 东北角的湖（全部是函数，所以边界是弯的）
   x→右  z→朝镜头(南)  -z→远处（摩天轮、过山车、湖、城市天际线）
   ===================================================================== */
const CX = 0, CZ = 4, RX = 66, RZ = 42;
function rfun(x, z) { const dx = (x - CX) / RX, dz = (z - CZ) / RZ, a = Math.atan2(dz, dx); return Math.hypot(dx, dz) / (1 + .07 * Math.sin(3 * a + 1) + .04 * Math.sin(5 * a + 2)); }
const LAKE = { x: 36, z: -38, rx: 28, rz: 13 };
const lakeF = (x, z) => Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
const inside = (x, z) => rfun(x, z) < 1 && lakeF(x, z) > 1.12;
function H(x, z) {
  let h = 0; const o = rfun(x, z) - 1, lf = lakeF(x, z);
  if (o > 0) h += sstep(0, .3, o) * (6 + 7 * vnoise(x * .05, z * .05));
  h *= 1 - sstep(.7, 1.2, lf);
  h -= (1 - sstep(.8, 1.3, lf)) * 1.2;
  return h;
}
function axis(lo, hi, step, outLo, outHi) {
  const a = []; for (let v = lo; v <= hi + 1e-6; v += step) a.push(+v.toFixed(3));
  let s = step, v = lo; while (v > outLo) { s *= 1.4; v -= s; a.unshift(v); }
  s = step; v = hi; while (v < outHi) { s *= 1.4; v += s; a.push(v); }
  return a;
}
function crom(pts, seg) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < seg; k++) { const t = k / seg, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(c => .5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); } }
  out.push(pts[pts.length - 1]); return out;
}
function ribbon(mb, pts, w, y, uvS, col) {
  const n = pts.length; let acc = 0; const base = mb.n;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    mb.vert([pts[i][0] - dz * w / 2, y, pts[i][1] + dx * w / 2], [0, 1, 0], acc / uvS, 0, col || [1, 1, 1]); mb.vert([pts[i][0] + dz * w / 2, y, pts[i][1] - dx * w / 2], [0, 1, 0], acc / uvS, w / uvS, col || [1, 1, 1]);
  }
  for (let i = 0; i < n - 1; i++) { const a = base + i * 2; mb.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}
function tube(mb, pts, rs, seg, col) {
  const base = mb.n, N = pts.length;
  for (let i = 0; i < N; i++) {
    const p = pts[i], q = pts[Math.min(N - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    let tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let ux = ty, uy = -tx, uz = 0; let ul = Math.hypot(ux, uy, uz); if (ul < .05) { ux = 0; uy = tz; uz = -ty; ul = Math.hypot(ux, uy, uz) || 1; } ux /= ul; uy /= ul; uz /= ul;
    const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux, c = typeof col === 'function' ? col(i / (N - 1)) : col, r = Array.isArray(rs) ? rs[i] : rs;
    for (let k = 0; k <= seg; k++) { const a = k / seg * TAU, ca = Math.cos(a), sa = Math.sin(a), nx = ux * ca + vx * sa, ny = uy * ca + vy * sa, nz = uz * ca + vz * sa; mb.vert([p[0] + nx * r, p[1] + ny * r, p[2] + nz * r], [nx, ny, nz], k / seg, i / (N - 1), c); }
  }
  const w = seg + 1; for (let i = 0; i < N - 1; i++) for (let k = 0; k < seg; k++) { const a = base + i * w + k; mb.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
}
function blob(mb, cx, cy, cz, rx, ry, rz, col, seg, seed, k) {
  const base = mb.n; seg = seg || 6; k = k == null ? .25 : k;
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg * 2; i++) {
    const th = j / seg * PI, ph = i / (seg * 2) * TAU, dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph), nz = 1 + k * (vnoise(dx * 2.2 + seed, dz * 2.2 + dy * 2 + seed * .7) - .5) * 2;
    const sh = .82 + .3 * (dy * .5 + .5), v = .9 + .2 * hash2(i + seed, j);
    mb.vert([cx + dx * rx * nz, cy + dy * ry * nz, cz + dz * rz * nz], [dx, dy, dz], i / (seg * 2), j / seg, [col[0] * sh * v, col[1] * sh * v, col[2] * sh * v]);
  }
  const w = seg * 2 + 1; for (let j = 0; j < seg; j++) for (let i = 0; i < seg * 2; i++) { const a = base + j * w + i; mb.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
}

/* =====================================================================
   纹理
   ===================================================================== */
function makeTex(R, T) {
  const t = {}, stripeCache = {};
  t.grass = R.paint(256, 256, (g, w, h) => { g.fillStyle = '#f2fff0'; g.fillRect(0, 0, w, h); const r = rnd(5); for (let i = 0; i < 3400; i++) { g.fillStyle = r() < .5 ? 'rgba(30,100,40,.14)' : 'rgba(255,255,255,.2)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 4); } });
  t.pave = R.paint(256, 256, (g, w, h) => { g.fillStyle = '#e9dfd2'; g.fillRect(0, 0, w, h); const cols = ['#f6e7d0', '#f9cfd8', '#cfeee0', '#d6dcf8']; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { g.fillStyle = cols[(i + j * 2) % 4]; g.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); const gr = g.createLinearGradient(i * 64, j * 64, i * 64 + 64, j * 64 + 64); gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.08)'); g.fillStyle = gr; g.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); } });
  t.plank = R.paint(256, 256, (g, w, h) => { const r = rnd(9); for (let i = 0; i < 8; i++) { const v = r() * 22; g.fillStyle = `rgb(${196 + v},${146 + v * .8},${96 + v * .6})`; g.fillRect(0, i * 32, w, 32); g.fillStyle = 'rgba(60,30,10,.45)'; g.fillRect(0, i * 32, w, 2.5); g.fillStyle = 'rgba(50,30,15,.5)'; g.fillRect(10, i * 32 + 14, 3, 3); g.fillRect(w - 14, i * 32 + 14, 3, 3); } });
  t.stripe = (c1, c2) => { const k = c1 + c2; return stripeCache[k] || (stripeCache[k] = R.paint(128, 16, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, h); } }, { mip: false })); };
  t.cloud = R.paint(512, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = rnd(21);
    for (let i = 0; i < 46; i++) { const x = 60 + r() * (w - 120), y = h * .62 - Math.pow(r(), 2) * 34 - Math.abs(x - w / 2) / w * 10, rad = 14 + r() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    const m = g.createLinearGradient(0, 0, 0, h); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.35, 'rgba(0,0,0,0)'); m.addColorStop(.85, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = m; g.fillRect(0, 0, w, h);
  }, { clamp: true });
  t.lakeA = R.paint(4, 128, (g, w, h) => { for (let y = 0; y < h; y++) { const v = y / (h - 1), a = v < .1 ? v / .1 * .3 : lerp(.3, .86, Math.min(1, (v - .1) / .6)), c = Math.round(a * 255); g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(0, y, w, 1); } }, { clamp: true, mip: false });
  /* 鬼屋立面 */
  const haunt = (em) => R.paint(512, 256, (g, w, h) => {
    g.fillStyle = em ? '#000' : '#2b2140'; g.fillRect(0, 0, w, h); const r = rnd(8);
    if (!em) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let x = 0; x < w; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - .5) * 4, h); g.stroke(); } }
    [[70, 70], [400, 70], [70, 170], [400, 170]].forEach(([x, y], i) => { g.fillStyle = em ? ['#9dff7a', '#ffb03a', '#9dff7a', '#ff6ad0'][i] : '#120c20'; g.fillRect(x, y, 44, 60); if (!em) { g.fillStyle = '#4a3a66'; g.fillRect(x + 20, y, 4, 60); g.fillRect(x, y + 28, 44, 4); } });
    g.fillStyle = em ? '#7a0a0a' : '#160a12'; g.fillRect(212, 110, 90, 146); if (em) { const gr = g.createRadialGradient(257, 200, 4, 257, 200, 100); gr.addColorStop(0, 'rgba(255,60,40,.9)'); gr.addColorStop(1, 'rgba(255,60,40,0)'); g.fillStyle = gr; g.fillRect(150, 90, 214, 166); }
  }, { clamp: true });
  t.haunt = { tex: haunt(false), em: haunt(true) };
  /* 悬浮图标：4x4 格 */
  const ICONS = ['🎡', '🎠', '🎢', '🎯', '🎈', '🔨', '🔮', '📸', '🍭', '🍿', '⛲', '👻', '🚪'], COLS = ['#ff6fae', '#ffb347', '#ff5a5a', '#52d0ff', '#ff8fd0', '#ffd93d', '#b48cff', '#7be0b0', '#ff9ad5', '#ffcf5a', '#5ad0ff', '#9a8cff', '#52e08a'];
  t.icons = R.paint(512, 512, (g) => {
    g.fillStyle = '#10142e'; g.fillRect(0, 0, 512, 512);
    ICONS.forEach((ic, k) => { const cx = (k % 4) * 128 + 64, cy = Math.floor(k / 4) * 128 + 64, gr = g.createRadialGradient(cx - 14, cy - 18, 6, cx, cy, 58); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.55, COLS[k]); gr.addColorStop(1, '#222a55');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 58, 0, TAU); g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(cx - 14, cy - 30, 28, 12, -.4, 0, TAU); g.fill();
      g.font = '58px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ic, cx, cy + 5); });
  }, { clamp: true });
  t.ICONS = ICONS; return t;
}

/* =====================================================================
   场景
   ===================================================================== */
function makeFunfair(R, T) {
  const X = makeTex(R, T);
  const S = { batches: [], obstacles: [], portals: [], hotspots: [], lamps: [], seats: [] };
  const PATHDEF = [];
  const seatAdd = (x, z, yaw, h, ap) => { const s = { x, z, yaw, h, ap, who: null, res: null }; s.hot = { id: 'sit', seat: s, x: ap[0], z: ap[1], r: 1.4 }; S.seats.push(s); return s; };
  const bbOf = (mb) => { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (let k = 0; k < mb.v.length; k += 11) for (let j = 0; j < 3; j++) { const v = mb.v[k + j]; if (v < a[j]) a[j] = v; if (v > b[j]) b[j] = v; } return [a, b]; };
  const add = (mb, mat) => { if (!mb.i.length) return null; const b = R.batch(mb, mat); b.bb = bbOf(mb); S.batches.push(b); return b; };
  /* ---- 遮挡半透明（与 Bukit Bintang 地图同一套）：会挡住人物的物体用 occ(() => {...add...}) 包起来 ---- */
  S.occluders = [];
  const occ0 = () => S.batches.length;
  const occ1 = (n0) => { const bs = S.batches.slice(n0).filter(b => b.bb && b.mat.mode === 0); if (!bs.length) return; const a = [1e9, 1e9, 1e9], c = [-1e9, -1e9, -1e9]; bs.forEach(b => { for (let j = 0; j < 3; j++) { a[j] = Math.min(a[j], b.bb[0][j]); c[j] = Math.max(c[j], b.bb[1][j]); } }); S.occluders.push({ bs, a, b: c, f: 1 }); };
  const occ = (fn) => { const n0 = occ0(); fn(); occ1(n0); };
  S.updateOcclusion = (eye, me, dt) => {
    const px = me.x, py = (me.y || 0) + .9, pz = me.z, pad = .2, k = Math.min(1, dt * 9);
    const hit = (o) => { const mn = [o.a[0] - pad, o.a[1] - pad, o.a[2] - pad], mx = [o.b[0] + pad, o.b[1] + pad, o.b[2] + pad];
      for (const [ox, oz] of [[0, 0], [.5, 0], [-.5, 0]]) for (const oy of [-.7, .5]) { const d = [px + ox - eye[0], py + oy - eye[1], pz + oz - eye[2]], len = Math.hypot(d[0], d[1], d[2]); let t0 = 0, t1 = Math.max(0, 1 - 2.6 / len), ok = true;
        for (let j = 0; j < 3; j++) { if (Math.abs(d[j]) < 1e-6) { if (eye[j] < mn[j] || eye[j] > mx[j]) { ok = false; break; } } else { let a = (mn[j] - eye[j]) / d[j], b = (mx[j] - eye[j]) / d[j]; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; } } }
        if (ok) return true; } return false; };
    for (const o of S.occluders) { const tg = hit(o) ? .1 : 1; o.f += (tg - o.f) * k; if (Math.abs(o.f - tg) < .01) o.f = tg; for (const b of o.bs) b.fade = o.f; }
  };
  const obs = (x0, z0, x1, z1) => S.obstacles.push({ x0, z0, x1, z1 });
  const obsC = (x, z, r) => obs(x - r, z - r, x + r, z + r);
  const solid = (r, g, b) => R.solidTex([r, g, b, 255]);
  const emS = (hexc, d, n) => { const c = hex(hexc); return { em: solid(c[0] * 255, c[1] * 255, c[2] * 255), emDay: d, emNight: n }; };
  const CP = .34, CU = [0, Math.cos(CP), -Math.sin(CP)];
  const bb = (mb, x, y, z, sx, sy, col) => { const P = (a, b) => [x + a * sx, y + CU[1] * b * sy, z + CU[2] * b * sy]; mb.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col); };
  const pool = (mb, x, z, r, col, y) => mb.floor(x - r, z - r, x + r, z + r, y == null ? .22 : y, col);
  const night = e => e.night;
  const PAL = [[.98, .36, .5], [.3, .78, .95], [1, .82, .25], [.62, .5, 1], [.4, .88, .6], [1, .6, .3]];

  /* ---------- 常量：设施位置 ---------- */
  const FOUNT = { x: 0, z: 8 };
  const WHEEL = { x: -18, z: -19, hub: 10.2, R: 8.4, n: 16 };
  const CAR = { x: 6, z: -14, r: 5.6 };
  const COAST = { cx: 30, cz: -9, a: 17, b: 10 };
  const DISCS = [[FOUNT.x, FOUNT.z, 13], [CAR.x, CAR.z, 8.5], [WHEEL.x, WHEEL.z + 3, 9], [COAST.cx, 2, 8], [-40, -4.8, 5.2]];
  const MIDZ = 20;
  const GATE = { x: -48, z: 25.7 };

  /* ---------- 地形（草地 + 外围丘陵 + 湖岸） ---------- */
  function terrainCol(x, z, h, slope) {
    const n = vnoise(x * .5, z * .5), n2 = vnoise(x * .09 + 5, z * .09), lf = lakeF(x, z);
    let c = mix([.30, .62, .28], [.46, .72, .32], n2); c = mix(c, [.24, .52, .26], sstep(0, 3, h));
    if (lf < 1.45) c = mix(c, [.86, .78, .56], 1 - sstep(1.05, 1.45, lf));
    if (lf < 1.1) c = mix(c, [.26, .5, .5], 1 - sstep(.7, 1.1, lf));
    c = mix(c, [.5, .46, .44], sstep(.7, 1.2, slope) * sstep(1.5, 4, h));
    const k = .92 + .16 * n; return [c[0] * k, c[1] * k, c[2] * k];
  }
  { const xs = axis(-80, 80, 1.6, -320, 320), zs = axis(-56, 62, 1.6, -320, 160), W = xs.length, mb = new MB();
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < W; i++) {
      const x = xs[i], z = zs[j], h = H(x, z), e = .8, dx = (H(x + e, z) - H(x - e, z)) / (2 * e), dz = (H(x, z + e) - H(x, z - e)) / (2 * e), nl = Math.hypot(dx, 1, dz);
      mb.vert([x, h, z], [-dx / nl, 1 / nl, -dz / nl], x / 6, z / 6, terrainCol(x, z, h, Math.hypot(dx, dz)));
    }
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < W - 1; i++) { const a = j * W + i; mb.i.push(a, a + W, a + 1, a + 1, a + W, a + W + 1); }
    add(mb, { tex: X.grass }); }

  /* ---------- 湖面（mode 3 半透明，颜色由 tick 随时间更新） ---------- */
  const lakeMB = new MB(); const LK_R = 10, LK_S = 56;
  const bLake = add(Object.assign(new MB(), { i: [0, 0, 0] }), { tex: X.lakeA, mode: 3, glow: 1 });
  function rebuildLake(t, e) {
    const mb = lakeMB; mb.v.length = 0; mb.i.length = 0; mb.n = 0; const L = [0, 1, 2].map(i => clamp(e.amb[i] * .9 + e.sun[i] * .5, 0, 1.1));
    mb.vert([LAKE.x, -.12, LAKE.z], [0, 1, 0], .5, 1, mix([.04, .3, .5].map((v, i) => v * L[i]), e.fog, .15));
    for (let r = 1; r <= LK_R; r++) for (let k = 0; k <= LK_S; k++) { const f = r / LK_R, a = k / LK_S * TAU, x = LAKE.x + Math.cos(a) * LAKE.rx * 1.4 * f, z = LAKE.z + Math.sin(a) * LAKE.rz * 1.4 * f, d = 1 - f, rip = 1 + .08 * Math.sin(x * .5 + z * .4 - t * 1.4);
      const base = mix([.04, .32, .52], [.3, .85, .8], sstep(.55, 1, f)); mb.vert([x, -.12, z], [0, 1, 0], .5, clamp(1 - f * .82, 0, 1), mix([base[0] * L[0] * rip, base[1] * L[1] * rip, base[2] * L[2] * rip], e.fog, sstep(.4, 1, f) * .15)); }
    const w = LK_S + 1; for (let k = 0; k < LK_S; k++) mb.i.push(0, 1 + k, 2 + k); for (let r = 0; r < LK_R - 1; r++) for (let k = 0; k < LK_S; k++) { const a = 1 + r * w + k, b = a + w; mb.i.push(a, b, a + 1, a + 1, b, b + 1); }
    upload(bLake, mb);
  }
  function upload(b, mb) {
    const gl = R.gl; gl.bindVertexArray(b.vao); gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mb.v), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mb.i), gl.DYNAMIC_DRAW); b.count = mb.i.length; gl.bindVertexArray(null);
  }

  /* ---------- 道路与广场（彩砖） ---------- */
  { const mb = new MB();
    mb.disc(FOUNT.x, FOUNT.z, .006, 13, 48, [1, 1, 1]);                                                  // 喷泉广场
    mb.disc(CAR.x, CAR.z, .012, 8.5, 32, [1, .95, 1]); mb.disc(WHEEL.x, WHEEL.z + 3, .018, 9, 32, [1, 1, .95]); mb.disc(COAST.cx, 2, .024, 8, 32, [.97, .97, 1]);
    let pathN = 0; const path = (pts, w, tag) => { const dense = crom(pts, 8); PATHDEF.push(Object.assign({ pts: dense, w }, tag || {})); ribbon(mb, dense, w, .028 + .003 * (pathN++), 4); };
    path([[-56, 25.7], [-30, 25.7], [0, 25.7], [30, 25.7], [58, 25.7]], 10.6, { street: 1 });               // 摊位街（东西向主街）
    path([[0, 8], [0, 18], [0, 25.7]], 7);                                                                  // 喷泉 → 摊位街
    path([[0, 8], [-8, -2], [-16, -12]], 6.5); path([[0, 8], [3, -2], [6, -8]], 6);                       // → 摩天轮 / 旋转木马
    path([[0, 8], [14, 6], [30, 3]], 6.5);                                                                // → 过山车
    path([[0, 8], [-18, 10], [-33, 5], [-40, -2.5]], 6.5); mb.disc(-40, -4.8, .021, 5.2, 28, [1, .97, 1]);                                                             // → 鬼屋
    add(mb, { tex: X.pave }); }

  /* ---------- 喷泉 ---------- */
  { const mb = new MB(), em = new MB(), w = new MB(), x = FOUNT.x, z = FOUNT.z;
    mb.cyl(x, z, 0, .7, 4.4, 4.2, 28, [.86, .88, .96], true); mb.cyl(x, z, .7, .9, 4.4, 4.4, 28, [.96, .96, 1]);
    mb.cyl(x, z, .9, 2.2, .5, .4, 10, [.9, .9, .98]); mb.cyl(x, z, 2.2, 2.45, 1.9, 1.6, 20, [.88, .9, 1], true); mb.cyl(x, z, 2.45, 3.5, .3, .25, 10, [.9, .9, .98]); mb.cyl(x, z, 3.5, 3.7, 1.0, .8, 16, [.9, .92, 1], true);
    w.disc(x, z, .72, 4.0, 28, [.3, .78, .95]); w.disc(x, z, 2.5, 1.7, 20, [.3, .78, .95]);
    em.sphere(x, 4.2, z, .35, .35, .35, [1, 1, 1], 6);
    add(mb, {}); add(w, emS('#5adcff', .35, 1.0)); add(em, emS('#fff4c0', .5, 2.4)); obsC(x, z, 4.5);
    const gl = new MB(); pool(gl, x, z, 8, [.4, .85, 1], .24); bb(gl, x, 3.8, z, 3.6, 3.6, [.7, .95, 1]); add(gl, { tex: T.glow, mode: 2, glow: e => .12 + night(e) * .7 });
    // 花坛一圈
    const fb = new MB(), fl = new MB(), r = rnd(3); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .26, bx = x + Math.cos(a) * 9.4, bz = z + Math.sin(a) * 9.4; fb.cyl(bx, bz, 0, .5, 1.1, 1.0, 10, [.9, .85, .8], true); for (let q = 0; q < 7; q++) { const aa = r() * TAU, rr = r() * .8; fl.sphere(bx + Math.cos(aa) * rr, .62 + r() * .1, bz + Math.sin(aa) * rr, .18, .16, .18, PAL[(r() * PAL.length) | 0], 4); } obsC(bx, bz, 1.05); }
    add(fb, {}); add(fl, {}); }

  /* ---------- 摊位工厂（门面朝 +z 也就是朝镜头） ---------- */
  const HS = [], strGlow = new MB(); let awnings = {}, wood = new MB(), signs = [], strLights = new MB(), grpN = null;
  function flushGroup() { if (grpN == null) return; add(wood, {}); Object.values(awnings).forEach(a => add(a.mb, { tex: a.tex })); signs.forEach(s => add(s.mb, { tex: s.tex, em: s.em, emDay: .45, emNight: 1.7 })); add(strLights, emS('#ffffff', .6, 2.2)); occ1(grpN); grpN = null; }
  function newGroup() { flushGroup(); awnings = {}; wood = new MB(); signs = []; strLights = new MB(); grpN = occ0(); }
  function awn(name, c1, c2) { return awnings[name] || (awnings[name] = { mb: new MB(), tex: X.stripe(c1, c2) }); }
  function booth(x, z, w, o) {
    newGroup(); const d = 2.8, col = o.col || [.9, .55, .6], aw = awn(o.awn[0], o.awn[1], o.awn[2]);
    wood.box(x - w / 2, 0, z - .1, x + w / 2, 1.05, z + .55, col); wood.box(x - w / 2 - .1, 1.05, z - .15, x + w / 2 + .1, 1.16, z + .65, [1, .96, .9]);
    wood.box(x - w / 2, 0, z - d, x + w / 2, 3.4, z - d + .2, mul(col, .85)); wood.box(x - w / 2, 0, z - d, x - w / 2 + .15, 3.4, z + .1, mul(col, .9)); wood.box(x + w / 2 - .15, 0, z - d, x + w / 2, 3.4, z + .1, mul(col, .9));
    aw.mb.quad([x - w / 2 - .2, 3.0, z + 1.4], [x + w / 2 + .2, 3.0, z + 1.4], [x + w / 2 + .2, 3.7, z - d], [x - w / 2 - .2, 3.7, z - d], [0, .9, .4], [0, 0, w / 1.2, 1], [1, 1, 1]);
    const n = Math.round(w / .55); for (let i = 0; i < n; i++) aw.mb.box(x - w / 2 - .2 + i * (w + .4) / n, 2.72, z + 1.38, x - w / 2 - .2 + (i + 1) * (w + .4) / n, 3.0, z + 1.5, i % 2 ? [1, 1, 1] : PAL[o.pi || 0]);
    for (let i = 0; i <= n; i++) { const bx = x - w / 2 - .2 + i * (w + .4) / n; strLights.sphere(bx, 2.64, z + 1.55, .09, .09, .09, [1, 1, 1], 4); bb(strGlow, bx, 2.64, z + 1.55, .8, .8, PAL[(i + (o.pi || 0)) % PAL.length]); }
    const sg = T.sign(o.text, { w: 1024, h: 200, fs: o.fs || 100, bg: o.bg || '#2a1038', fg: o.fg || '#ffe9a8', border: o.bd || '#ff6fae' }), sb = new MB();
    sb.box(x - w / 2 + .2, 3.7, z - d + .22, x + w / 2 - .2, 5.0, z - d + .3, [1, 1, 1], [w - .4, 1.3], { noBack: true, noSides: true, noTop: true }); sb.box(x - w / 2 + .3, 3.4, z - d + .22, x - w / 2 + .45, 3.7, z - d + .3, [.5, .4, .4]); sb.box(x + w / 2 - .45, 3.4, z - d + .22, x + w / 2 - .3, 3.7, z - d + .3, [.5, .4, .4]);
    signs.push({ mb: sb, tex: sg.tex, em: sg.em }); obs(x - w / 2 - .15, z - d - .1, x + w / 2 + .15, z + .7);
    return { x, z: z + 3.7 };
  }
  { const r = rnd(41);
    // 1 套圈
    let p = booth(-38, MIDZ, 7.2, { text: '套圈 RING TOSS', col: [.85, .45, .55], awn: ['rt', '#ff5a7a', '#ffffff'], pi: 0, bg: '#3a0f26', bd: '#ff6f9a' });
    for (let i = 0; i < 7; i++) { const bx = -38 - 2.1 + i * .7; wood.cyl(bx, MIDZ - 1.2, 1.16, 1.75, .13, .1, 8, PAL[i % PAL.length]); wood.cyl(bx, MIDZ - 1.2, 1.75, 1.95, .05, .05, 6, [.9, .9, .95]); }
    for (let i = 0; i < 9; i++) wood.sphere(-38 - 3.0 + i * .75, 2.2 + (i % 2) * .5, MIDZ - 2.35, .3, .3, .3, PAL[(i + 2) % PAL.length], 5);
    HS.push({ id: 'ring', x: p.x, z: p.z, r: 2.0, label: '套圈', color: [1, .5, .65], icon: 3, btn: '套圈', iy: 6.0, bx: -38, bz: MIDZ });
    // 2 打气球
    p = booth(-26, MIDZ, 7.2, { text: '射气球 BALLOON', col: [.35, .7, .9], awn: ['bd', '#2aa6e8', '#ffffff'], pi: 1, bg: '#0c2a4a', bd: '#52d0ff' });
    wood.box(-26 - 3.4, 1.16, MIDZ - 2.45, -26 + 3.4, 3.3, MIDZ - 2.42, [.98, .93, .8]);
    HS.push({ id: 'balloon', x: p.x, z: p.z, r: 2.0, label: '射气球', color: [.4, .85, 1], icon: 4, btn: '射飞镖', iy: 6.0, bx: -26, bz: MIDZ });
    // 3 大力锤（带高塔）
    p = booth(-14, MIDZ, 7.2, { text: '大力锤 STRONGMAN', fs: 88, col: [.95, .75, .3], awn: ['sm', '#ffb21a', '#ffffff'], pi: 2, bg: '#3a2606', bd: '#ffd93d' });
    { const tx = -14 + 5.4, tz = MIDZ - 1.2; wood.box(tx - .9, 0, tz - .9, tx + .9, .5, tz + .9, [.45, .3, .5]); for (let q = 0; q < 15; q++) wood.box(tx - .28, .5 + q * .55, tz - .28, tx + .28, Math.min(8.2, .5 + (q + 1) * .55), tz + .28, q % 2 ? [1, .55, .65] : [.98, .95, .88]); wood.box(tx - .45, 8.2, tz - .45, tx + .45, 8.5, tz + .45, [.95, .3, .4]); wood.sphere(tx, 8.9, tz, .45, .4, .45, [1, .82, .2], 6); obs(tx - 1, tz - 1, tx + 1, tz + 1);
      wood.box(tx - .6, .5, tz + .26, tx + .6, 8.2, tz + .34, [.16, .14, .26]); for (let i = 0; i < 15; i++) { wood.box(tx - .58, .88 + i * .5, tz + .34, tx - .38, .92 + i * .5, tz + .37, [.95, .95, 1]); wood.box(tx + .38, .88 + i * .5, tz + .34, tx + .58, .92 + i * .5, tz + .37, [.95, .95, 1]); } S.strong = { x: tx, z: tz }; }
    HS.push({ id: 'strong', x: -14 + 2.2, z: MIDZ + 3.7, r: 2.0, label: '大力锤', color: [1, .85, .3], icon: 5, btn: '挥锤', iy: 6.0, bx: -14, bz: MIDZ });
    // 5 大头贴
    { newGroup(); const x = 22, z = MIDZ; wood.box(x - 1.5, 0, z - 2.4, x + 1.5, 3.6, z + .4, [.3, .3, .5]); wood.box(x - 1.2, 0, z + .38, x + 1.2, 2.5, z + .44, [.8, .1, .3]); wood.box(x - 1.6, 3.6, z - 2.5, x + 1.6, 3.9, z + .5, [.98, .5, .6]); obs(x - 1.7, z - 2.5, x + 1.7, z + .5);
      const sg = T.sign('大头贴 PHOTO', { w: 512, h: 130, fs: 62, bg: '#2a1b4a', fg: '#fff0fa', border: '#b48cff' }), sb = new MB(); sb.box(x - 1.5, 4.0, z + .1, x + 1.5, 4.9, z + .16, [1, 1, 1], [3, .9], { noBack: true, noSides: true, noTop: true }); signs.push({ mb: sb, tex: sg.tex, em: sg.em });
      HS.push({ id: 'photo', x, z: z + 3.4, r: 2.0, label: '大头贴', color: [.7, .5, 1], icon: 7, btn: '拍大头贴', iy: 6.4 }); }
    // 6 棉花糖
    p = booth(34, MIDZ, 6.4, { text: '棉花糖 CANDY', col: [.98, .7, .85], awn: ['cc', '#ff7ab6', '#ffffff'], pi: 0, bg: '#3a1030', bd: '#ff9ad5' });
    for (let i = 0; i < 5; i++) { wood.cyl(34 - 2.0 + i * 1.0, MIDZ - .9, 1.16, 1.9, .03, .03, 4, [.9, .9, .9]); wood.sphere(34 - 2.0 + i * 1.0, 2.1, MIDZ - .9, .42, .4, .42, [[1, .7, .85], [.7, .85, 1], [.85, .75, 1], [1, .85, .6], [.7, 1, .85]][i], 6); }
    HS.push({ id: 'candy', x: p.x, z: p.z, r: 2.0, label: '棉花糖', color: [1, .6, .85], icon: 8, btn: '买棉花糖', iy: 6.0 });
    // 7 爆米花
    p = booth(46, MIDZ, 6.0, { text: '爆米花 POPCORN', col: [.95, .35, .3], awn: ['pc', '#e8352e', '#ffffff'], pi: 5, bg: '#3a0a08', bd: '#ffb03a' });
    wood.box(46 - 1.2, 1.16, MIDZ - 1.5, 46 + 1.2, 1.5, MIDZ - .3, [.9, .9, .95]); wood.box(46 - 1.1, 1.5, MIDZ - 1.4, 46 + 1.1, 2.7, MIDZ - .4, [1, .95, .85]); for (let i = 0; i < 40; i++) wood.sphere(46 - 1.0 + r() * 2, 1.9 + r() * .8, MIDZ - 1.3 + r() * .8, .13, .12, .13, [1, .96, .8 - r() * .15], 3);
    HS.push({ id: 'popcorn', x: p.x, z: p.z, r: 2.0, label: '爆米花', color: [1, .8, .35], icon: 9, btn: '买爆米花', iy: 6.0 });
    // 4 占卜帐篷（六边形）
    { newGroup(); const x = 15.5, z = MIDZ - 3.0, tent = awn('ft', '#7a3cff', '#ffcf5a'); tent.mb.cyl(x, z, 0, 2.7, 3.1, 3.1, 6, [1, 1, 1]); tent.mb.cyl(x, z, 2.7, 5.4, 3.5, .15, 6, [1, 1, 1]); wood.sphere(x, 5.7, z, .3, .3, .3, [1, .85, .3], 5);
      wood.box(x - 1.0, 0, z + 2.55, x + 1.0, 2.3, z + 2.75, [.1, .04, .16]); wood.box(x - .6, 0, z + 2.74, x + .6, 2.0, z + 2.78, [.35, .1, .5]);
      wood.cyl(x, z + 3.7, 0, .85, .45, .4, 8, [.4, .2, .5], true); wood.sphere(x, 1.3, z + 3.7, .38, .38, .38, [.7, .9, 1], 8); S.crystal = [x, 1.3, z + 3.7];
      obsC(x, z, 3.2); obsC(x, z + 3.7, .55);
      const sg = T.sign('占卜 FORTUNE', { w: 512, h: 120, fs: 64, bg: '#1a0838', fg: '#ffe6a8', border: '#b48cff' }), sb = new MB(); sb.box(x - 1.6, 3.0, z + 2.8, x + 1.6, 3.9, z + 2.86, [1, 1, 1], [3.2, .9], { noBack: true, noSides: true, noTop: true }); signs.push({ mb: sb, tex: sg.tex, em: sg.em });
      HS.push({ id: 'fortune', x, z: z + 6.7, r: 2.0, label: '占卜', color: [.7, .5, 1], icon: 6, btn: '占卜', iy: 6.4 }); }
    flushGroup(); add(strGlow, { tex: T.glow, mode: 2, glow: e => .1 + night(e) * .8 }); }

  /* ---------- 鬼屋（门面朝镜头） ---------- */
  { const n0 = occ0(), x = -40, z = -8, w = 15, mb = new MB(), rf = new MB();
    mb.box(x - w / 2, 0, z - 10, x + w / 2, 8, z, [1, 1, 1], [15, 8], { noTop: true, noFront: true });
    const fm = new MB(); fm.box(x - w / 2, 0, z - 10, x + w / 2, 8, z, [1, 1, 1], [15, 8], { noTop: true, noBack: true, noSides: true }); add(fm, { tex: X.haunt.tex, em: X.haunt.em, emDay: .35, emNight: 1.7 });
    add(mb, { tex: X.haunt.tex });
    rf.cyl(x, z - 5, 8, 14, 11, .2, 4, [.2, .15, .3]); [[-w / 2 + .5, 8.4], [w / 2 - .5, 8.4]].forEach(([a, h]) => rf.cyl(x + a, z - .5, 0, 11, .3, .2, 6, [.2, .15, .3]));
    const sg = T.sign('HAUNTED 鬼屋', { w: 768, h: 160, fs: 84, bg: '#10061e', fg: '#b6ff9a', border: '#ff6a3d' }), sb = new MB(); sb.box(x - 4, 8.3, z + .02, x + 4, 10, z + .12, [1, 1, 1], [8, 1.7], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.8 });
    const pk = new MB(), gl = new MB(); [-5.5, -3, 3, 5.5].forEach((o, i) => { pk.sphere(x + o, .5, z + 1.2, .5, .45, .5, [1, .5, .1], 6); bb(gl, x + o, .6, z + 1.3, 1.5, 1.5, [1, .5, .15]); }); bb(gl, x, 2, z + 2, 5, 5, [.5, 1, .4]); pool(gl, x, z + 3, 5, [.45, 1, .45]);
    add(rf, {}); add(pk, emS('#ff8a1e', .5, 1.6)); add(gl, { tex: T.glow, mode: 2, glow: e => .08 + night(e) * .8 }); obs(x - w / 2 - .1, z - 10, x + w / 2 + .1, z + .2);
    occ1(n0);
    HS.push({ id: 'haunt', x, z: z + 4.4, r: 2.0, label: '鬼屋', color: [.55, 1, .45], icon: 11, btn: '进鬼屋', iy: 5.0 }); }

  /* ---------- 摩天轮（静态部分：支架 / 轮圈；转动部分在 tick 里） ---------- */
  { const mb = new MB(), W = WHEEL, ring = (zo, r) => { const pts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; pts.push([W.x + Math.cos(a) * r, W.hub + Math.sin(a) * r, W.z + zo]); } return pts; };
    [-1, 1].forEach(s => { tube(mb, ring(s * .9, W.R), .14, 5, [.96, .96, 1]); tube(mb, ring(s * .9, W.R * .55), .1, 5, [.9, .9, 1]); [-1, 1].forEach(q => tube(mb, [[W.x, W.hub, W.z + s * 1.5], [W.x + q * 5.4, 0, W.z + s * 2.6]], .24, 6, [.92, .3, .45])); });
    mb.cyl(W.x, W.z - 1.6, W.hub - .2, W.hub + .2, .0, .0, 3, [1, 1, 1]); tube(mb, [[W.x, W.hub, W.z - 1.8], [W.x, W.hub, W.z + 1.8]], .55, 8, [1, .85, .3]);
    mb.box(W.x - 6.5, 0, W.z - 3.4, W.x + 6.5, .35, W.z + 3.4, [.55, .4, .7]); obs(W.x - 6.6, W.z - 3.5, W.x + 6.6, W.z + 3.5);
    add(mb, {});
    const sg = T.sign('摩天轮 FERRIS WHEEL', { w: 768, h: 140, fs: 70, bg: '#1d0b36', fg: '#ffe6f6', border: '#ff6fae' }), sb = new MB(); sb.box(W.x - 3.5, .5, W.z + 3.45, W.x + 3.5, 2.0, W.z + 3.52, [1, 1, 1], [7, 1.5], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.8 });
    HS.push({ id: 'ferris', x: W.x, z: W.z + 6.2, r: 2.0, label: '摩天轮', color: [1, .5, .75], icon: 0, btn: '乘摩天轮', iy: 5.2 }); }

  /* ---------- 旋转木马（静态：底盘 + 顶棚） ---------- */
  { const n0 = occ0(), mb = new MB(), top = new MB(), x = CAR.x, z = CAR.z, tex = awn('cr', '#ff7ab6', '#ffffff');
    mb.cyl(x, z, 0, .5, 6.0, 5.8, 28, [1, .9, .95], true); mb.cyl(x, z, .5, .55, 5.8, 5.8, 28, [.95, .6, .75], true); mb.cyl(x, z, .5, 5.6, .55, .5, 10, [1, .85, .3]);
    top.cyl(x, z, 5.3, 5.9, 6.3, 6.3, 20, [1, 1, 1]); tex.mb.cyl(x, z, 5.9, 8.3, 6.4, .3, 16, [1, 1, 1]); top.sphere(x, 8.6, z, .45, .45, .45, [1, .85, .3], 6);
    add(mb, {}); add(top, { tex: X.stripe('#ffd0e6', '#ffb0d0') }); add(tex.mb, { tex: tex.tex }); obsC(x, z, 6.1);
    occ1(n0);
    HS.push({ id: 'carousel', x, z: z + 8.8, r: 2.0, label: '旋转木马', color: [1, .6, .85], icon: 1, btn: '骑木马', iy: 6.6 }); }

  /* ---------- 过山车：轨道曲线、轨道、支柱 ---------- */
  const CO = (() => {
    const N = 360, pts = [], c = COAST; let ymin = 1e9, ymax = -1e9; const raw = [];
    for (let i = 0; i < N; i++) { const th = i / N * TAU, y = 7.5 + 5.5 * Math.sin(th - 2.0) + 2.2 * Math.sin(2 * th + .5) + 1.2 * Math.sin(3 * th); raw.push(y); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    for (let i = 0; i < N; i++) { const th = i / N * TAU, y = (raw[i] - ymin) / (ymax - ymin) * 13.5 + 1.4, wob = 1 + .22 * Math.cos(3 * th); pts.push([c.cx + Math.cos(th) * c.a * wob, y, c.cz + Math.sin(th) * c.b * wob]); }
    const len = [0]; for (let i = 1; i <= N; i++) { const a = pts[i - 1], b = pts[i % N]; len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
    const total = len[N];
    return { pts, len, total, N, ymax: 14.9, at(s) { s = ((s % total) + total) % total; let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] <= s) lo = m; else hi = m; } const t = (s - len[lo]) / (len[lo + 1] - len[lo] || 1), a = pts[lo], b = pts[(lo + 1) % N]; return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), Math.atan2(b[0] - a[0], b[2] - a[2])]; } };
  })();
  { const mb = new MB(), sup = new MB(), em = new MB(), c = COAST, P = CO.pts, N = CO.N, lat = i => { const a = P[(i + N - 1) % N], b = P[(i + 1) % N]; let dx = b[0] - a[0], dz = b[2] - a[2]; const l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
    const railA = [], railB = [], spine = []; for (let i = 0; i <= N; i += 2) { const p = P[i % N], l = lat(i % N); railA.push([p[0] + l[0] * .42, p[1], p[2] + l[1] * .42]); railB.push([p[0] - l[0] * .42, p[1], p[2] - l[1] * .42]); spine.push([p[0], p[1] - .35, p[2]]); }
    tube(mb, railA, .1, 4, [.95, .95, 1]); tube(mb, railB, .1, 4, [.95, .95, 1]); tube(mb, spine, .22, 5, [.9, .25, .35]);
    for (let i = 0; i < N; i += 14) { const p = P[i], l = lat(i); { const sm = new MB(); sm.box(p[0] - .17, 0, p[2] - .17, p[0] + .17, p[1] - .4, p[2] + .17, [.92, .92, .98]); occ(() => add(sm, {})); } if (i % 28 === 0) obsC(p[0], p[2], .35); em.sphere(p[0], p[1] + .15, p[2], .12, .12, .12, [1, 1, 1], 4); }
    add(mb, {}); add(em, emS('#ffd0f0', .3, 2));
    // 车站
    const st = P[0]; const sg = T.sign('过山车 COASTER', { w: 768, h: 140, fs: 72, bg: '#2a0a10', fg: '#ffe0d0', border: '#ff5a5a' }), sb = new MB(); sb.box(c.cx - 3.2, 3.8, c.cz + c.b + 1.3, c.cx + 3.2, 5.0, c.cz + c.b + 1.36, [1, 1, 1], [6.4, 1.2], { noBack: true, noSides: true, noTop: true }); sb.box(c.cx - 3.2, 0, c.cz + c.b + 1.25, c.cx - 3.0, 3.8, c.cz + c.b + 1.4, [.5, .3, .3]); sb.box(c.cx + 3.0, 0, c.cz + c.b + 1.25, c.cx + 3.2, 3.8, c.cz + c.b + 1.4, [.5, .3, .3]); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.8 });
    HS.push({ id: 'coaster', x: c.cx, z: c.cz + c.b + 3.8, r: 2.0, label: '过山车', color: [1, .45, .4], icon: 2, btn: '坐过山车', iy: 6.4 }); }

  /* ---------- 喷泉许愿 ---------- */
  HS.push({ id: 'wish', x: FOUNT.x, z: FOUNT.z + 6.4, r: 2.0, label: '喷泉许愿', color: [.5, .9, 1], icon: 10, btn: '投币许愿', iy: 4.6 });

  /* ---------- 入口门 + 回广场 ---------- */
  { const n0 = occ0(), gx = GATE.x, gz = GATE.z, mb = new MB(), em = new MB();
    mb.box(gx - 3.4, 0, gz - .3, gx - 2.9, 3.6, gz + .3, [.95, .35, .5]); mb.box(gx + 2.9, 0, gz - .3, gx + 3.4, 3.6, gz + .3, [.95, .35, .5]); mb.box(gx - 3.7, 3.6, gz - .4, gx + 3.7, 4.0, gz + .4, [.98, .8, .25]); add(mb, {});
    const sg = T.sign('回到星光广场', { w: 1024, h: 170, fs: 90, bg: '#10243a', fg: '#c8fff0', border: '#52e0b5' }), sb = new MB(); sb.quad([gx - 2.8, 2.0, gz + .32], [gx + 2.8, 2.0, gz + .32], [gx + 2.8, 3.4, gz + .32], [gx - 2.8, 3.4, gz + .32], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); sb.quad([gx + 2.8, 2.0, gz - .32], [gx - 2.8, 2.0, gz - .32], [gx - 2.8, 3.4, gz - .32], [gx + 2.8, 3.4, gz - .32], [0, 0, -1], [0, 0, 1, 1], [1, 1, 1]); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.7 });
    em.box(gx - 2.9, 3.4, gz - .2, gx + 2.9, 3.5, gz + .2, [1, 1, 1]); add(em, emS('#52e0b5', .8, 2.2)); obs(gx - 3.5, gz - .4, gx - 2.8, gz + .4); obs(gx + 2.8, gz - .4, gx + 3.5, gz + .4);
    S.portals.push({ id: 'plaza', x: gx, z: gz - .9, r: 2.0, label: '回到星光广场', color: [.4, 1, .7], spawn: [0, 12.5], icon: 12, iy: 4.8 }); S.exitPortal = S.portals[0];
    occ1(n0); }

  /* ---------- 灯柱 / 长椅 / 彩旗（沿路径两侧规则排列，避开互动圈 / 障碍 / 道路中央） ---------- */
  { const pole = new MB(), halo = new MB(), pl = new MB(), bench = new MB(), flags = new MB();
    const dseg = (px, pz, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / l2, 0, 1); return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t)); };
    const dPath = (px, pz, P) => { let m = 1e9; for (let i = 0; i < P.pts.length - 1; i++) m = Math.min(m, dseg(px, pz, P.pts[i], P.pts[i + 1])); return m; };
    const onRoad = (px, pz, skip, m) => PATHDEF.some(P => P !== skip && dPath(px, pz, P) < P.w / 2 + m);
    const inDisc = (px, pz) => DISCS.some(d => Math.hypot(px - d[0], pz - d[1]) < d[2] - .3);
    const ringHit = (px, pz, m) => [...HS, ...S.portals].some(h => Math.hypot(px - h.x, pz - h.z) < (h.r || 2.4) + m);
    const obsHit = (px, pz, m) => S.obstacles.some(o => px > o.x0 - m && px < o.x1 + m && pz > o.z0 - m && pz < o.z1 + m);
    const LAMPS = [], BEN = [];
    const tryLamp = (px, pz, skip) => { if (!inside(px, pz) || lakeF(px, pz) < 1.5 || onRoad(px, pz, skip, -.2) || ringHit(px, pz, .5) || obsHit(px, pz, .7)) return false; if (LAMPS.some(l => Math.hypot(l[0] - px, l[1] - pz) < 6) || BEN.some(b => Math.hypot(b.x - px, b.z - pz) < 2.2)) return false; LAMPS.push([px, pz]); return true; };
    /* 长椅：朝向目标点；旋转盒子 */
    const rbox = (mb, cx, cz, yaw, u0, u1, v0, v1, y0, y1, col) => { const s = Math.sin(yaw), c = Math.cos(yaw), W = (u, v) => [cx + u * c + v * s, cz - u * s + v * c], A = W(u0, v0), B = W(u1, v0), C = W(u1, v1), D = W(u0, v1), q = [0, 0, 1, 1];
      mb.quad([A[0], y1, A[1]], [B[0], y1, B[1]], [C[0], y1, C[1]], [D[0], y1, D[1]], [0, 1, 0], q, col);
      [[A, B], [B, C], [C, D], [D, A]].forEach(([P, Q]) => { let nx = Q[1] - P[1], nz = -(Q[0] - P[0]); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if (nx * (P[0] - cx) + nz * (P[1] - cz) < 0) { nx = -nx; nz = -nz; } mb.quad([P[0], y0, P[1]], [Q[0], y0, Q[1]], [Q[0], y1, Q[1]], [P[0], y1, P[1]], [nx, 0, nz], q, col); }); };
    const tryBench = (px, pz, tx, tz) => { const dx = tx - px, dz = tz - pz, l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l, yaw = Math.atan2(fx, fz), c = Math.cos(yaw), s = Math.sin(yaw), ex = Math.abs(c) * 1.2 + Math.abs(s) * .45, ez = Math.abs(s) * 1.2 + Math.abs(c) * .45;
      if (!inside(px, pz) || (onRoad(px, pz, null, -.3) && !inDisc(px, pz)) || ringHit(px, pz, .6) || obsHit(px, pz, .5) || BEN.some(b => Math.hypot(b.x - px, b.z - pz) < 3)) return false;
      BEN.push({ x: px, z: pz });
      const col = [.5, .35, .3], leg = [.2, .18, .26];
      rbox(bench, px, pz, yaw, -1.1, 1.1, -.3, .3, .45, .58, col); rbox(bench, px, pz, yaw, -1.1, 1.1, -.34, -.26, .58, 1.05, col); rbox(bench, px, pz, yaw, -1, -.85, -.25, .25, .1, .45, leg); rbox(bench, px, pz, yaw, .85, 1, -.25, .25, .1, .45, leg);
      obs(px - ex, pz - ez, px + ex, pz + ez);
      [-.55, .55].forEach(o => { const sx = px + c * o - fx * .05, sz = pz - s * o - fz * .05; seatAdd(sx, sz, yaw, .5, [sx + fx * 1.15, sz + fz * 1.15]); }); return true; };
    // 1. 长椅
    [-101, -40, 41, 132, 202].forEach(a => { const r = a / 57.296; tryBench(FOUNT.x + Math.cos(r) * 11.3, FOUNT.z + Math.sin(r) * 11.3, FOUNT.x, FOUNT.z); });   // 喷泉广场：路与路之间，朝喷泉
    [-36, -12, 14, 38].forEach(x => tryBench(x, 32.4, x, 26));                                                                       // 摊位街南侧，朝街
    tryBench(WHEEL.x - 7.6, WHEEL.z + 5.5, WHEEL.x, WHEEL.z); tryBench(WHEEL.x + 7.6, WHEEL.z + 5.5, WHEEL.x, WHEEL.z);           // 摩天轮前
    tryBench(CAR.x - 7, CAR.z + 5.5, CAR.x, CAR.z); tryBench(CAR.x + 7, CAR.z + 5.5, CAR.x, CAR.z);                              // 木马前
    tryBench(COAST.cx - 6.5, 6, COAST.cx, 2); tryBench(COAST.cx + 6.5, 6, COAST.cx, 2);                                          // 过山车站前
    // 2. 灯柱：喷泉一圈
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .1; tryLamp(FOUNT.x + Math.cos(a) * 12.4, FOUNT.z + Math.sin(a) * 12.4, null); }
    // 3. 灯柱：沿每条放射路两侧，间距 11m
    PATHDEF.filter(P => !P.street && !P.gate).forEach(P => { let acc = 0; const seg = [0]; for (let i = 1; i < P.pts.length; i++) { acc += Math.hypot(P.pts[i][0] - P.pts[i - 1][0], P.pts[i][1] - P.pts[i - 1][1]); seg.push(acc); }
      for (let s = 15; s < acc - 2.5; s += 11) { let i = 1; while (i < seg.length - 1 && seg[i] < s) i++; const t = (s - seg[i - 1]) / ((seg[i] - seg[i - 1]) || 1), a = P.pts[i - 1], b = P.pts[i], x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, o = P.w / 2 + .85;
        tryLamp(x + nx * o, z + nz * o, P); tryLamp(x - nx * o, z - nz * o, P); } });
    // 4. 摊位街：北排放在摊位之间的空档（z=21），南排每 12m 一根（z=30.2），均与路对齐
    const SP = PATHDEF.find(P => P.street), NL = [];
    [-32, -20, -6, 14.5, 27.2, 40.1, 52].forEach(x => { if (tryLamp(x, 21, SP)) NL.push(x); });
    for (let x = -54; x <= 54; x += 12) for (const sh of [0, 1.5, -1.5, 3, -3]) if (tryLamp(x + sh, 30.2, SP)) break;
    NL.sort((a, b) => a - b);
    LAMPS.forEach(([x, z]) => { pole.cyl(x, z, .1, 4.2, .09, .06, 8, [.25, .2, .32]); pole.cyl(x, z, .1, .5, .18, .13, 8, [.25, .2, .32]); { const hm = new MB(); hm.sphere(x, 4.35, z, .32, .32, .32, [1, 1, 1], 8); occ(() => add(hm, emS('#fff0c8', .35, 2.4))); } bb(halo, x, 4.35, z, 3.2, 3.2, [1, .8, .5]); pool(pl, x, z, 3.6, [1, .78, .45]); obsC(x, z, .22); S.lamps.push([x, z]); });
    for (let j = 0; j < NL.length - 1; j++) { const xa0 = NL[j], xb0 = NL[j + 1]; if (xb0 - xa0 > 15) continue; const ci = PAL.length, nseg = Math.max(8, Math.round((xb0 - xa0) * 1.2));
      for (let k = 0; k < nseg; k++) { const t0 = k / nseg, t1 = (k + .7) / nseg, y0 = 4.1 - Math.sin(t0 * PI) * .7, y1 = 4.1 - Math.sin(t1 * PI) * .7, xa = lerp(xa0, xb0, t0), xb = lerp(xa0, xb0, t1);
        flags.quad([xa, y0, 21], [xb, y1, 21], [(xa + xb) / 2, Math.min(y0, y1) - .55, 21], [(xa + xb) / 2, Math.min(y0, y1) - .55, 21], [0, 0, 1], [0, 0, 1, 1], PAL[(k + j) % ci]); } }
    add(pole, {}); add(bench, {}); add(flags, {}); add(halo, { tex: T.glow, mode: 2, glow: e => night(e) * .75 }); add(pl, { tex: T.glow, mode: 2, glow: e => night(e) * .22 }); }

  /* ---------- 植被：两侧与北面种树，南面只放矮灌木（避免挡住玩家） ---------- */
  { const tm = new MB(), lm = new MB(), hm = new MB(), fl = new MB(), r = rnd(9);
    const bound = (a) => { let lo = .6, hi = 1.5; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2, x = CX + m * RX * Math.cos(a), z = CZ + m * RZ * Math.sin(a); if (rfun(x, z) < 1) lo = m; else hi = m; } return [CX + hi * RX * Math.cos(a), CZ + hi * RZ * Math.sin(a), a]; };
    for (let a = 0; a < TAU; a += .03) {
      const [bx, bz] = bound(a), out = [Math.cos(a) * 1.4, Math.sin(a) * 1.0], south = bz > 12;
      if (south) { if (r() < .55) { const x = bx - out[0] * (.6 + r() * 1.6), z = bz - out[1] * (.6 + r() * 1.6), s = .55 + r() * .4; if (inside(x, z)) { blob(hm, x, .35, z, s * 1.2, s * .6, s * 1.2, mix([.2, .5, .22], [.34, .66, .3], r()), 5, a * 50, .2); if (r() < .7) for (let q = 0; q < 3; q++) fl.sphere(x + (r() - .5) * s * 1.6, .7 + r() * .2, z + (r() - .5) * s, .11, .11, .11, PAL[(r() * 6) | 0], 3); obsC(x, z, s * .9); } } continue; }
      for (let row = 0; row < 2; row++) { if (r() < (row ? .45 : .7)) continue; const d = row ? 6 + r() * 9 : 1.4 + r() * 3.5, x = bx + out[0] * d / 1.4 + (r() - .5) * 2, z = bz + out[1] * d / 1.4 + (r() - .5) * 2; if (lakeF(x, z) < 1.5) continue; const y = H(x, z), hh = 5 + r() * 5, pine = r() < .4;
        if (pine) { tm.cyl(x, z, y, y + hh * .35, .3, .22, 5, [.4, .28, .2]); for (let k = 0; k < 3; k++) lm.cyl(x, z, y + hh * (.25 + k * .24), y + hh * (.5 + k * .24), 2.0 - k * .5, .05, 7, mix([.12, .4, .26], [.2, .52, .3], r())); }
        else { tm.cyl(x, z, y, y + hh * .5, .35, .25, 5, [.45, .32, .22]); lm.sphere(x, y + hh * .75, z, 2.3, 1.9, 2.3, mix([.22, .55, .26], [.4, .7, .3], r()), 5); lm.sphere(x + 1.1, y + hh * .62, z + .5, 1.5, 1.2, 1.5, [.3, .62, .3], 4); } }
    }
    add(tm, {}); add(lm, {}); add(hm, {}); add(fl, {}); }

  /* ---------- 南侧草坪点缀：花丛、矮灌木、小石块（低矮，不挡镜头） ---------- */
  { const fl = new MB(), bu = new MB(), r = rnd(31); const FC = [[1, .45, .6], [1, .85, .3], [.7, .55, 1], [1, 1, 1], [1, .6, .3], [.5, .8, 1]];
    for (let i = 0; i < 160; i++) { const x = -62 + r() * 124, z = 34 + r() * 18; if (!inside(x, z) || lakeF(x, z) < 1.3) continue; const c = FC[(r() * FC.length) | 0], y = H(x, z);
      for (let q = 0; q < 4; q++) { const a = r() * TAU, d = r() * .5; fl.cyl(x + Math.cos(a) * d, z + Math.sin(a) * d, y, y + .22 + r() * .12, .015, .015, 3, [.25, .6, .25]); fl.sphere(x + Math.cos(a) * d, y + .3 + r() * .1, z + Math.sin(a) * d, .1, .09, .1, c, 4); } }
    for (let i = 0; i < 26; i++) { const x = -60 + r() * 120, z = 37 + r() * 12; if (!inside(x, z)) continue; const s = .5 + r() * .5; blob(bu, x, H(x, z) + .3, z, s * 1.2, s * .6, s, mix([.2, .5, .22], [.34, .66, .3], r()), 5, i * 17, .2); if (z < 44) obsC(x, z, s * .8); }
    add(fl, {}); add(bu, {});
    const bo = new MB(), bg = new MB();                                                                  // 草坪小地灯（矮，夜晚发光）
    for (let x = -60; x <= 60; x += 7.5) for (const z of [36.5, 41]) { const xx = x + (z > 40 ? 3.7 : 0); if (!inside(xx, z) || lakeF(xx, z) < 1.3) continue; bo.cyl(xx, z, 0, .75, .09, .07, 6, [.28, .24, .36]); bo.sphere(xx, .85, z, .14, .14, .14, [1, .95, .8], 5); bb(bg, xx, .9, z, 1.1, 1.1, [1, .8, .5]); pool(bg, xx, z, 1.8, [1, .78, .45], .2); obsC(xx, z, .16); }
    add(bo, {}); add(bg, { tex: T.glow, mode: 2, glow: e => .15 + night(e) * .75 }); }

  /* ---------- 远景：城市天际线 + 山 ---------- */
  { const mb = new MB(), r = rnd(77), facs = [T.facade(21, { wall: '#7d86ad', cols: 6, rows: 9, lit: .5 }), T.facade(22, { wall: '#9a8cb8', cols: 5, rows: 9, lit: .45 }), T.facade(23, { wall: '#7a94b8', cols: 6, rows: 8, lit: .55 })];
    const SK = [new MB(), new MB(), new MB()]; let k = 0; for (let a = -1.15; a < 1.15; a += .028) { const R0 = 175 + r() * 25, x = Math.sin(a) * R0, z = -Math.cos(a) * R0 + 20, w = 8 + r() * 9, h = 14 + r() * 26 * (1 - Math.abs(a) * .4), f = facs[k++ % 3]; SK[(k - 1) % 3].box(x, 0, z, x + w, h, z + 10, [1, 1, 1], [16, 14], { noTop: true }); mb.box(x - .1, h, z - .1, x + w + .1, h + .5, z + 10.1, [.26, .24, .34]); }
    SK.forEach((m, i) => add(m, { tex: facs[i].tex, em: facs[i].em, emNight: 1.5 }));
    [[-150, -230, 70, 26], [20, -250, 90, 34], [160, -220, 80, 28], [-60, -260, 60, 22]].forEach(([x, z, rx, h], i) => blob(mb, x, -2, z, rx, h, rx * .5, [.34, .42, .56], 7, 500 + i, .3));
    add(mb, {}); }

  /* ---------- 障碍：用不规则边界生成 ---------- */
  { const x0 = -82, x1 = 82, z0 = -52, z1 = 62, cs = 1.0, cols = Math.ceil((x1 - x0) / cs), rows = Math.ceil((z1 - z0) / cs);
    for (let i = 0; i < cols; i++) { let run = null; const xa = x0 + i * cs, xb = xa + cs, xm = xa + cs / 2;
      for (let j = 0; j <= rows; j++) { const za = z0 + j * cs, bad = j < rows && !inside(xm, za + cs / 2); if (bad) { if (!run) run = za; } else if (run != null) { obs(xa, run, xb, za); run = null; } } } }

  HS.forEach(h => { h.act = h.id; S.hotspots.push(h); });

  /* =====================================================================
     动态部分（摩天轮 / 旋转木马 / 过山车 / 摇摆飞椅 / 气球 / 喷泉 / 粒子 / 小游戏 / 乘坐）
     ===================================================================== */
  const mk = (mat) => add(Object.assign(new MB(), { i: [0, 0, 0] }), mat);
  const dynOpaque = new MB(), bOpaque = mk({});
  const dynIcons = new MB(), bIcons = mk({ tex: R.black, em: X.icons, emDay: 1, emNight: 0 });
  const dynSky = new MB(), bSky = mk({ tex: T.glow, mode: 2, glow: 1 });
  const dynCloud = new MB(), bCloud = mk({ tex: X.cloud, mode: 3, glow: .55 });
  const dynGlow = new MB(), bGlow = mk({ tex: T.glow, mode: 2, glow: 1 });
  const dynPart = new MB(), bPart = mk({ tex: T.glow, mode: 2, glow: 1 });

  const parts = [], later = [];
  const addP = (x, y, z, vx, vy, vz, life, size, col, g, drag) => { if (parts.length < 1100) parts.push({ x, y, z, vx, vy, vz, life, max: life, size, col, g: g == null ? -6 : g, drag: drag || 0 }); };
  const burst = (x, y, z, n, sp, life, size, cols, g) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, b = Math.acos(2 * Math.random() - 1), s = sp * (.55 + Math.random() * .45); addP(x, y, z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, life * (.7 + Math.random() * .5), size, cols[(Math.random() * cols.length) | 0], g, .9); } };
  const poof = (x, y, z, col) => { for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, s = 1 + Math.random() * 1.8; addP(x, y, z, Math.cos(a) * s, 1.2 + Math.random() * 2, Math.sin(a) * s, .8, .35, col || [.95, .85, .6], -3, 1.5); } };

  const host = S.host = {
    g() { return window.__game; },
    toast(msg, ms) { const el = document.getElementById('toast'); if (!el) return; el.textContent = msg; el.classList.add('on'); clearTimeout(host._t); host._t = setTimeout(() => el.classList.remove('on'), ms || 2000); },
    coins(n) { const g = host.g(); if (!g) return; g.coinCount += n; const el = document.getElementById('coinN'); if (el) el.textContent = Math.round(g.coinCount).toLocaleString('en-US'); try { localStorage.setItem('sc_coins', JSON.stringify(g.coinCount)); } catch (e) { } },
    balance() { const g = host.g(); return g ? g.coinCount : 0; },
    bubble(text, sec) { const g = host.g(); if (g && g.me) { g.me.bubble = text; g.me.bt = sec || 3.5; } },
    wave(sec) { const g = host.g(); if (g && g.me) { g.me.pose = sec || 2; g.me.actClip = null; } },
  act(clip, sec) { const g = host.g(); if (g && g.me) { g.me.pose = sec || 2; g.me.actClip = clip; } },
    face(yaw) { const g = host.g(); if (g && g.me) g.me.yaw = yaw; },
    flash(color) { let f = document.getElementById('ffFlash'); if (!f) { f = document.createElement('div'); f.id = 'ffFlash'; f.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;z-index:99'; document.body.appendChild(f); } f.style.background = color || '#fff'; f.style.transition = 'none'; f.style.opacity = '.95'; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .6s ease-out'; f.style.opacity = '0'; })); },
  };
  const pick = a => a[(Math.random() * a.length) | 0];
  const spend = (n) => { if (host.balance() < n) { host.toast('金币不够啦（需要 ' + n + '）'); return false; } host.coins(-n); return true; };
  const HSG = id => HS.find(h => h.id === id);
  const FORTUNES = ['今天会遇到一个很有趣的人 ✨', '想做的事，现在就是最好的时机 🌟', '好运正在向你靠近，别走太远 🍀', '今晚的烟花是为你放的 🎆', '请朋友吃一份棉花糖，会有惊喜 🍭', '你的下一个愿望会成真 🌙', '小心鬼屋里的那一声“哇”👻', '摩天轮最高处，会看到你想看的 🎡'];
  const BALC = [[1, .35, .45], [.35, .7, 1], [1, .85, .25], [.6, .5, 1], [.4, .9, .6], [1, .6, .3]];

  /* ---------- 状态 ---------- */
  const st = {
    wheel: 0, car: 0, coS: 20, swing: 0, ride: null, rideX: 0, rideZ: 0, rideY: 0, rideObs: null,
    ring: { s: 0, t: 0, sweep: 0, fl: null }, bal: { s: 0, t: 0, dart: null, list: [] }, str: { s: 0, t: 0, m: 0, power: 0, lit: 0, done: 0 },
    haunt: 0, photoT: 0, showT: 0, nextShow: 0, baseDist: 25, fw: 0, fountT: 0,
  };
  { const b = HSG('balloon'); for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) st.bal.list.push({ x: b.bx + (c - 3) * .8, y: 1.75 + r * .58, z: b.bz - 2.0, col: (c + r * 2) % 6, alive: true, back: 0, ph: Math.random() * 6 }); }
  const OMEGA = .22, HORSES = 10;
  const horseBob = (i, t) => .55 + Math.sin(t * 2 + i * 1.3) * .32;
  const carPos = k => CO.at(st.coS - 3.4 * k);
  const coasterV = y => 3.0 + 1.6 * Math.sqrt(Math.max(0, CO.ymax + .5 - y));

  /* ---------- 乘坐 ---------- */
  function ridePos(r, t) {
    const W = WHEEL;
    if (r.kind === 'ferris') { const a = st.wheel + r.cab * TAU / W.n; return [W.x + Math.cos(a) * W.R, W.hub + Math.sin(a) * W.R - 2.7, W.z, 0]; }
    if (r.kind === 'carousel') { const a = st.car + r.horse * TAU / HORSES; return [CAR.x + Math.cos(a) * 3.6, 1.1 + horseBob(r.horse, t) - .5 + .3, CAR.z + Math.sin(a) * 3.6, Math.atan2(-Math.sin(a), Math.cos(a))]; }
    const p = carPos(1); return [p[0], p[1] + .3, p[2], p[3]];
  }
  function startRide(kind) {
    const g = host.g(); if (!g || st.ride) return; const me = g.me, r = { kind, t: 0, home: [me.x, me.z] };
    if (kind === 'ferris') { let best = 0, bd = 9; for (let i = 0; i < WHEEL.n; i++) { const a = st.wheel + i * TAU / WHEEL.n, d = Math.abs(Math.atan2(Math.sin(a + PI / 2), Math.cos(a + PI / 2))); if (d < bd) { bd = d; best = i; } } r.cab = best; r.dur = TAU / OMEGA + .3; host.toast('🎡 坐上摩天轮啦！慢慢升到最高处看风景～（可点上方“👁 视角”切换）', 2800); }
    else if (kind === 'carousel') { r.horse = (Math.random() * HORSES) | 0; r.dur = 22; host.toast('🎠 旋转木马开动啦！', 2200); }
    else { r.s0 = st.coS; r.total = CO.total * 1.6; r.dur = 1e9; host.toast('🎢 抓紧！过山车出发～', 2200); }
    st.ride = r; fp_reset(); g.target = null; st.rideObs = { x0: me.x - .7, z0: me.z - .7, x1: me.x + .7, z1: me.z + .7 }; S.obstacles.push(st.rideObs);
    for (let i = 0; i < 20; i++) addP(me.x, 1, me.z, (Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3, 1, .3, pick(BALC), -3, .5);
  }
  function endRide(msg) {
    const g = host.g(); const r = st.ride; if (!r) return; st.ride = null;
    const i = S.obstacles.indexOf(st.rideObs); if (i >= 0) S.obstacles.splice(i, 1); st.rideObs = null;
    if (g) { g.me.x = r.home[0]; g.me.z = r.home[1]; g.me.y = 0; g.me.vx = g.me.vz = 0; g.target = null; }
    host.toast(msg || '已下车，欢迎再来～'); const rw = r.kind === 'coaster' ? 25 : r.kind === 'ferris' ? 20 : 12; if (!msg) { host.coins(rw); host.toast('已下车，玩得开心！+' + rw + ' 金币 🎉', 2400); }
  }

  /* ---------- 互动 ---------- */
  function act(h) {
    const g = host.g(); if (!g) return; const me = g.me, t = performance.now() / 1000;
    if (st.gameOpen) return;
    if (st.ride) { endRide('已提前下车'); return; }
    switch (h.id) {
      case 'ferris': case 'carousel': case 'coaster': startRide(h.id); break;
      case 'strong': { const s = st.str;
        if (s.s === 0) { if (!spend(10)) break; s.s = 1; s.t = 0; s.ph = 0; s.sp = 3.8 + Math.random() * 1.8; host.face(PI); host.toast('🔨 速度很快！指针到最上面时按“挥锤！”（只有 4 秒）', 2400); }
        else if (s.s === 1) { s.power = s.m; s.s = 2; s.t = 0; s.done = 0; host.act('cheer', 1.8); }
        break; }
      case 'ring': case 'balloon': case 'fortune': case 'photo': case 'candy': case 'popcorn': case 'wish': case 'haunt':
        if (st.gameOpen) break; host.face(PI); host.act('clap', 1.4); S.openGame(h.id); break;
    }
  }
  /* =====================================================================
     摊位小游戏（全屏 2D 覆盖层）：套圈 / 打气球 / 大力锤 / 鬼屋 / 占卜 / 大头贴 / 棉花糖 / 爆米花 / 许愿
     每个都有完整的玩法 → 结算 → 金币奖励，可"再玩一次"
     ===================================================================== */
  const GW = 960, GH = 540, FONT = 'system-ui,-apple-system,"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif';
  const gm = { el: null, cv: null, g: null, game: null, def: null, raf: 0, last: 0, res: null, btns: [] };
  const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const gtxt = (g, s, x, y, sz, col, al, wt) => { g.font = (wt || '700') + ' ' + sz + 'px ' + FONT; g.fillStyle = col || '#fff'; g.textAlign = al || 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  const gcol = (c, a) => 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? 1 : a) + ')';
  const rr_ = (a, b) => a + Math.random() * (b - a);
  const grad = (g, y0, y1, c0, c1) => { const q = g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, c0); q.addColorStop(1, c1); return q; };
  const popT = (G_, x, y, s, col) => G_.fx.push({ x, y, s, col: col || '#ffe36a', t: 0 });
  const baseGame = () => ({ fx: [], t: 0, score: 0, done: null, over: false });
  function drawFx(g, G_, dt) { for (let i = G_.fx.length - 1; i >= 0; i--) { const f = G_.fx[i]; f.t += dt; if (f.t > 1) { G_.fx.splice(i, 1); continue; } g.globalAlpha = 1 - f.t; gtxt(g, f.s, f.x, f.y - f.t * 46, 30, f.col, 'center', '900'); g.globalAlpha = 1; } }

  /* ---- 1 套圈 ---- */
  function gRing() {
    const G_ = baseGame(); G_.title = '🎯 套圈'; G_.rings = 6; G_.fly = null; G_.hit = [];
    G_.bottles = []; [[230, 6, 50, 24], [312, 5, 20, 31], [400, 4, 10, 38]].forEach(([y, n, pt, r], row) => { for (let i = 0; i < n; i++) G_.bottles.push({ x: 150 + (i + .5) * (660 / n) + (row % 2 ? 0 : 0), y, pt: row === 0 && i === 3 ? 100 : pt, r, gold: row === 0 && i === 3, ring: false }); });
    G_.cross = () => { const sp = 1 + (6 - G_.rings) * .13; return [480 + 360 * Math.sin(G_.t * 1.55 * sp), 300 + 105 * Math.sin(G_.t * 2.15 * sp + 1)]; };
    G_.update = (dt) => { G_.t += dt;
      if (G_.fly) { const f = G_.fly; f.u += dt / .55; if (f.u >= 1) { let hit = null, bd = 1e9; G_.bottles.forEach(b => { if (b.ring) return; const d = Math.hypot(b.x - f.x, b.y - 12 - f.y); if (d < b.r + 4 && d < bd) { bd = d; hit = b; } });
          if (hit) { hit.ring = true; G_.score += hit.pt; popT(G_, hit.x, hit.y - 30, '+' + hit.pt, hit.gold ? '#ffd93d' : '#9bff9b'); } else popT(G_, f.x, f.y - 20, '没套中', '#ff9bb0');
          G_.fly = null; if (G_.rings <= 0) G_.done = { score: G_.score, coins: Math.min(60, Math.round(G_.score / 5)), msg: '共 ' + G_.score + ' 分' }; } } };
    G_.down = () => { if (G_.fly || G_.rings <= 0) return; const c = G_.cross(); G_.rings--; G_.fly = { u: 0, x: c[0], y: c[1] }; };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#3b1450', '#1a0b33'); g.fillRect(0, 0, GW, GH);
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#ff5a7a' : '#fff'; g.fillRect(i * 80, 60, 80, 34); } rrect(g, 110, 130, 740, 330, 18); g.fillStyle = 'rgba(255,255,255,.07)'; g.fill();
      G_.bottles.forEach(b => { g.fillStyle = b.gold ? '#ffd93d' : b.r > 36 ? '#4ad0ff' : b.r > 28 ? '#b48cff' : '#ff7ab6'; rrect(g, b.x - b.r * .55, b.y - b.r * 1.1, b.r * 1.1, b.r * 1.5, b.r * .4); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(b.x - b.r * .3, b.y - b.r * 1.4, b.r * .6, b.r * .4); gtxt(g, b.pt, b.x, b.y - b.r * .2, Math.max(13, b.r * .55), '#241033', 'center', '900');
        if (b.ring) { g.strokeStyle = '#ffd93d'; g.lineWidth = 5; g.beginPath(); g.ellipse(b.x, b.y - b.r * .2, b.r * .9, b.r * .38, 0, 0, 7); g.stroke(); } });
      if (!G_.fly && G_.rings > 0) { const c = G_.cross(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(c[0], c[1], 22, 0, 7); g.moveTo(c[0] - 32, c[1]); g.lineTo(c[0] + 32, c[1]); g.moveTo(c[0], c[1] - 32); g.lineTo(c[0], c[1] + 32); g.stroke(); }
      if (G_.fly) { const f = G_.fly, u = f.u, x = lerp(480, f.x, u), y = lerp(520, f.y, u) - Math.sin(u * PI) * 120, s = 1.6 - .6 * u; g.strokeStyle = '#ffd93d'; g.lineWidth = 7 * s; g.beginPath(); g.ellipse(x, y, 34 * s, 14 * s, 0, 0, 7); g.stroke(); }
      for (let i = 0; i < G_.rings; i++) { g.strokeStyle = '#ffd93d'; g.lineWidth = 6; g.beginPath(); g.ellipse(70 + i * 46, 505, 18, 8, 0, 0, 7); g.stroke(); }
      gtxt(g, '点屏幕把圈扔出去！准星对准瓶子', 480, 112, 22, '#ffe9a8'); };
    return G_;
  }

  /* ---- 2 打气球 ---- */
  function gBalloon() {
    const G_ = baseGame(); G_.title = '🎈 射飞镖'; G_.left = 25; G_.bal = []; G_.darts = []; G_.cd = 0; G_.spawn = 0;
    const COLS = ['#ff5a7a', '#4ad0ff', '#b48cff', '#6be58a', '#ff9d3d'];
    G_.update = (dt) => { G_.t += dt; G_.left -= dt; G_.cd -= dt; G_.spawn -= dt;
      if (G_.spawn <= 0) { G_.spawn = rr_(.35, .7); const k = Math.random(); G_.bal.push({ x: rr_(90, 870), y: GH + 50, vy: rr_(70, 150), r: rr_(30, 44), c: COLS[(Math.random() * 5) | 0], type: k < .1 ? 'gold' : k < .2 ? 'bomb' : 'n', ph: rr_(0, 6) }); }
      G_.bal.forEach(b => { b.y -= b.vy * dt * (b.type === 'gold' ? 1.5 : 1); b.x += Math.sin(G_.t * 2 + b.ph) * 22 * dt; }); G_.bal = G_.bal.filter(b => b.y > -80);
      G_.darts.forEach(d => d.u += dt / .14); G_.darts = G_.darts.filter(d => d.u < 1);
      if (G_.left <= 0) G_.done = { score: G_.score, coins: Math.max(0, Math.min(50, Math.round(G_.score / 6))), msg: '共 ' + G_.score + ' 分' }; };
    G_.down = (x, y) => { if (G_.cd > 0) return; G_.cd = .22; G_.darts.push({ u: 0, x, y }); let hit = null, bd = 1e9; G_.bal.forEach(b => { const d = Math.hypot(b.x - x, b.y - y); if (d < b.r + 14 && d < bd) { bd = d; hit = b; } });
      if (hit) { G_.bal.splice(G_.bal.indexOf(hit), 1); const pt = hit.type === 'gold' ? 40 : hit.type === 'bomb' ? -15 : 10; G_.score = Math.max(0, G_.score + pt); popT(G_, hit.x, hit.y, (pt > 0 ? '+' : '') + pt, pt > 0 ? (hit.type === 'gold' ? '#ffd93d' : '#9bff9b') : '#ff6b6b'); } };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#2b6fd6', '#7fd3ff'); g.fillRect(0, 0, GW, GH);
      G_.bal.forEach(b => { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(b.x, b.y + b.r * 1.15); g.lineTo(b.x + Math.sin(G_.t * 3 + b.ph) * 6, b.y + b.r * 2.2); g.stroke();
        g.fillStyle = b.type === 'gold' ? '#ffd93d' : b.type === 'bomb' ? '#2b2b3a' : b.c; g.beginPath(); g.ellipse(b.x, b.y, b.r * .85, b.r * 1.05, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(b.x - b.r * .3, b.y - b.r * .35, b.r * .18, b.r * .3, .5, 0, 7); g.fill(); if (b.type === 'bomb') gtxt(g, '💣', b.x, b.y, b.r * .9); if (b.type === 'gold') gtxt(g, '★', b.x, b.y, b.r * .8, '#fff'); });
      G_.darts.forEach(d => { const x = lerp(480, d.x, d.u), y = lerp(540, d.y, d.u); g.strokeStyle = '#ffe36a'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (d.x - 480) * .08, y + 40); g.stroke(); });
      gtxt(g, '点气球射飞镖！金色 +40，别射炸弹 💣', 480, 500, 22, '#fff'); gtxt(g, '⏱ ' + Math.max(0, Math.ceil(G_.left)) + 's', 880, 30, 26, '#fff', 'right'); };
    return G_;
  }

  /* ---- 3 大力锤 ---- */
  function gStrong() {
    const G_ = baseGame(); G_.title = '🔨 大力锤'; G_.n = 0; G_.m = 0; G_.phase = 'aim'; G_.pt = 0; G_.power = 0; G_.best = 0; G_.rise = 0; G_.ham = 0;
    G_.update = (dt) => { G_.t += dt; if (G_.phase === 'aim') G_.m = Math.abs(Math.sin(G_.t * (2.6 + G_.n * .7)));
      else if (G_.phase === 'hit') { G_.pt += dt; G_.ham = Math.min(1, G_.pt / .25); if (G_.pt > .25) { G_.phase = 'rise'; G_.pt = 0; } }
      else if (G_.phase === 'rise') { G_.pt += dt; G_.rise = G_.power * (1 - Math.pow(1 - Math.min(1, G_.pt / 1.1), 2.2));
        if (G_.pt > 1.1 && !G_.rung) { G_.rung = true; G_.best = Math.max(G_.best, G_.power); if (G_.power > .92) { popT(G_, 700, 90, '🔔 叮——！', '#ffd93d'); } else popT(G_, 700, 200, Math.round(G_.power * 100) + ' 分', '#9bff9b'); G_.score = Math.round(G_.best * 100); }
        if (G_.pt > 2) { G_.n++; if (G_.n >= 3) G_.done = { score: G_.score, coins: 8 + Math.round(G_.best * 32) + (G_.best > .92 ? 20 : 0), msg: '最高力量 ' + G_.score + (G_.best > .92 ? '  🔔 敲响了钟！' : '') }; else { G_.phase = 'aim'; G_.rung = false; G_.rise = 0; G_.ham = 0; } } } };
    G_.down = () => { if (G_.phase === 'aim') { G_.power = G_.m; G_.phase = 'hit'; G_.pt = 0; } };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#2a1a4a', '#120a28'); g.fillRect(0, 0, GW, GH);
      g.fillStyle = '#3a2a5a'; g.fillRect(560, 470, 280, 30); rrect(g, 660, 110, 80, 360, 14); g.fillStyle = '#16102e'; g.fill();
      for (let i = 0; i < 18; i++) { const y = 460 - i * 19, lit = (G_.phase === 'rise' || G_.phase === 'aim' && 0) && i / 18 <= G_.rise + .01; g.fillStyle = lit ? (i < 10 ? '#6be58a' : i < 15 ? '#ffd93d' : '#ff5a5a') : 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(700, y, 7, 0, 7); g.fill(); }
      g.fillStyle = '#ffd93d'; g.beginPath(); g.arc(700, 98, 26, 0, 7); g.fill(); gtxt(g, '🔔', 700, 98, 26);
      if (G_.phase === 'rise' || G_.phase === 'hit') { const py = 460 - G_.rise * 342; g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(700, py, 12, 0, 7); g.fill(); }
      rrect(g, 120, 90, 70, 380, 12); g.fillStyle = 'rgba(255,255,255,.1)'; g.fill(); rrect(g, 120, 470 - 380 * (G_.phase === 'aim' ? G_.m : G_.power), 70, 380 * (G_.phase === 'aim' ? G_.m : G_.power), 12); g.fillStyle = G_.m > .85 || G_.power > .85 ? '#ff5a5a' : '#6be58a'; g.fill();
      const ang = -1.1 + G_.ham * 1.7; g.save(); g.translate(480, 420); g.rotate(ang); g.fillStyle = '#b07a3a'; g.fillRect(-8, -150, 16, 150); g.fillStyle = '#c9c9d6'; rrect(g, -50, -190, 100, 50, 10); g.fill(); g.restore();
      gtxt(g, G_.phase === 'aim' ? '指针到最上面时点屏幕挥锤！' : ' ', 480, 56, 24, '#ffe9a8'); gtxt(g, '第 ' + Math.min(3, G_.n + 1) + '/3 锤', 480, 500, 22, '#fff'); };
    return G_;
  }

  /* ---- 4 鬼屋（打鬼） ---- */
  function gHaunt() {
    const G_ = baseGame(); G_.title = '👻 鬼屋探险'; G_.left = 30; G_.lives = 3; G_.slots = []; G_.spawn = 1; G_.flash = 0;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) G_.slots.push({ x: 220 + c * 260, y: 175 + r * 180, e: null });
    G_.update = (dt) => { G_.t += dt; G_.left -= dt; G_.spawn -= dt; G_.flash = Math.max(0, G_.flash - dt);
      if (G_.spawn <= 0) { G_.spawn = Math.max(.4, 1.0 - G_.t * .015); const free = G_.slots.filter(s => !s.e); if (free.length) { const s = free[(Math.random() * free.length) | 0], k = Math.random(); s.e = { type: k < .15 ? 'bat' : k < .25 ? 'pump' : 'ghost', life: Math.max(.7, 1.5 - G_.t * .02), age: 0 }; } }
      G_.slots.forEach(s => { if (s.e) { s.e.age += dt; if (s.e.age >= s.e.life) s.e = null; } });
      if (G_.left <= 0 || G_.lives <= 0) G_.done = { score: G_.score, coins: Math.min(45, 5 + Math.round(G_.score / 6)), msg: (G_.lives <= 0 ? '被吓晕了…' : '勇敢地走出了鬼屋！') + ' 得分 ' + G_.score }; };
    G_.down = (x, y) => { G_.slots.forEach(s => { if (!s.e || Math.hypot(s.e.x0 || s.x - x, 0) > 1e9) return; const dx = x - s.x, dy = y - (s.y - 20); if (Math.hypot(dx, dy) < 70) { const e = s.e; s.e = null; if (e.type === 'bat') { G_.lives--; G_.flash = .3; popT(G_, s.x, s.y, '💥 -1命', '#ff6b6b'); } else { const pt = e.type === 'pump' ? 30 : 10; G_.score += pt; popT(G_, s.x, s.y, '+' + pt, e.type === 'pump' ? '#ffb03a' : '#9bff9b'); } } }); };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#150a26', '#05020c'); g.fillRect(0, 0, GW, GH);
      for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(i * 140 + 10, 0, 6, GH); }
      G_.slots.forEach(s => { g.fillStyle = '#2a1840'; rrect(g, s.x - 80, s.y - 86, 160, 160, 14); g.fill(); g.fillStyle = '#0b0614'; rrect(g, s.x - 66, s.y - 72, 132, 138, 10); g.fill();
        if (s.e) { const u = Math.min(1, s.e.age / .18), out = Math.min(u, (s.e.life - s.e.age) / .18); g.save(); g.beginPath(); rrect(g, s.x - 66, s.y - 72, 132, 138, 10); g.clip(); const yy = s.y + 62 - 90 * Math.max(0, out); if (s.e.type === 'ghost') { g.globalAlpha = .92; gtxt(g, '👻', s.x, yy, 92); } else if (s.e.type === 'bat') gtxt(g, '🦇', s.x, yy, 86); else gtxt(g, '🎃', s.x, yy, 84); g.restore(); } });
      if (G_.flash > 0) { g.fillStyle = 'rgba(255,0,60,' + G_.flash + ')'; g.fillRect(0, 0, GW, GH); }
      gtxt(g, '点幽灵 👻 +10 · 南瓜 🎃 +30 · 别点蝙蝠 🦇', 480, 52, 22, '#ffe9a8'); gtxt(g, '❤'.repeat(Math.max(0, G_.lives)), 80, 500, 30, '#ff5a7a', 'left'); gtxt(g, '⏱ ' + Math.max(0, Math.ceil(G_.left)) + 's', 880, 500, 26, '#fff', 'right'); };
    return G_;
  }

  /* ---- 5 占卜（猜水晶球 / 洗牌） ---- */
  function gFortune() {
    const G_ = baseGame(); G_.title = '🔮 占卜 · 找出水晶球'; G_.pos = [0, 1, 2]; G_.star = (Math.random() * 3) | 0; G_.phase = 'show'; G_.pt = 0; G_.swaps = 0; G_.sw = null; G_.pick = -1;
    const X = [240, 480, 720]; G_.slotX = i => X[G_.pos[i]]; G_.cx = [240, 480, 720];
    G_.update = (dt) => { G_.t += dt; G_.pt += dt;
      if (G_.phase === 'show' && G_.pt > 1.6) { G_.phase = 'shuffle'; G_.pt = 0; G_.sw = null; }
      else if (G_.phase === 'shuffle') { if (!G_.sw) { if (G_.swaps >= 8) { G_.phase = 'pick'; G_.pt = 0; } else { let a = (Math.random() * 3) | 0, b = (a + 1 + ((Math.random() * 2) | 0)) % 3; G_.sw = { a, b, u: 0, pa: G_.pos[a], pb: G_.pos[b] }; G_.swaps++; } }
        else { G_.sw.u += dt / Math.max(.22, .5 - G_.swaps * .035); if (G_.sw.u >= 1) { const s = G_.sw; G_.pos[s.a] = s.pb; G_.pos[s.b] = s.pa; G_.sw = null; } } }
      else if (G_.phase === 'reveal' && G_.pt > 1.6) { const win = G_.pick === G_.star, f = pick(FORTUNES); G_.done = { score: win ? 1 : 0, coins: win ? 25 : 5, msg: (win ? '🎉 猜中了！' : '😅 差一点～') + '\n水晶球说：' + f }; } };
    G_.cupX = i => { const base = X[G_.pos[i]]; if (G_.sw && (i === G_.sw.a || i === G_.sw.b)) { const to = X[i === G_.sw.a ? G_.sw.pb : G_.sw.pa], from = X[i === G_.sw.a ? G_.sw.pa : G_.sw.pb]; return lerp(from, to, G_.sw.u); } return base; };
    G_.cupY = i => { if (G_.sw && (i === G_.sw.a || i === G_.sw.b)) return 330 + (i === G_.sw.a ? -1 : 1) * Math.sin(G_.sw.u * PI) * 50; return 330; };
    G_.down = (x, y) => { if (G_.phase !== 'pick') return; for (let i = 0; i < 3; i++) if (Math.abs(x - G_.cupX(i)) < 85 && y > 230 && y < 420) { G_.pick = i; G_.phase = 'reveal'; G_.pt = 0; } };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#2a0f4a', '#0e0620'); g.fillRect(0, 0, GW, GH); for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,' + (.3 + .3 * Math.sin(G_.t * 2 + i)) + ')'; g.fillRect((i * 97) % GW, (i * 53) % 200, 3, 3); }
      g.fillStyle = '#4b2a7a'; rrect(g, 120, 400, 720, 40, 14); g.fill();
      for (let i = 0; i < 3; i++) { const x = G_.cupX(i), y = G_.cupY(i), lift = (G_.phase === 'show' && i === G_.star) || (G_.phase === 'reveal' && i === G_.pick) || (G_.phase === 'reveal' && i === G_.star) ? 70 : 0;
        if (i === G_.star) { g.fillStyle = '#7fe0ff'; g.beginPath(); g.arc(x, y + 60, 34, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x - 10, y + 48, 10, 0, 7); g.fill(); }
        g.fillStyle = i === G_.pick && G_.phase === 'reveal' ? '#ffb03a' : '#8f5bff'; g.beginPath(); g.moveTo(x - 62, y + 90 - lift); g.lineTo(x - 42, y - 50 - lift); g.lineTo(x + 42, y - 50 - lift); g.lineTo(x + 62, y + 90 - lift); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 28, y - 40 - lift, 14, 110); gtxt(g, '✦', x, y + 20 - lift, 34, '#ffe9a8'); }
      gtxt(g, G_.phase === 'show' ? '记住水晶球在哪个杯子下面！' : G_.phase === 'shuffle' ? '洗牌中…盯紧了！' : G_.phase === 'pick' ? '点你认为有水晶球的杯子' : G_.pick === G_.star ? '猜中了！' : '不是这个哦', 480, 70, 28, '#ffe9a8'); };
    return G_;
  }

  /* ---- 6 大头贴（3 连拍 + 相纸） ---- */
  function gPhoto() {
    const G_ = baseGame(); G_.title = '📸 大头贴'; G_.phase = 'choose'; G_.frame = 0; G_.shot = 0; G_.cd = 0; G_.shots = []; G_.flash = 0; G_.pt = 0;
    const FR = [{ n: '粉色爱心', c: '#ff8fbf', e: '💗' }, { n: '星空蓝', c: '#6aa8ff', e: '⭐' }, { n: '薄荷绿', c: '#6be5b0', e: '🍀' }], POSES = ['比个 ✌ 耶！', '做个鬼脸 😜', '笑一个 😊'];
    G_.snap = () => { const gl = document.getElementById('gl'), c = document.createElement('canvas'); c.width = 240; c.height = 300; const x = c.getContext('2d'); let ok = false; try { const me = host.g().me, p = R.project([me.x, me.y + .9, me.z]); if (p && gl) { const sz = Math.max(160, gl.height * .3), sx = p[0] - sz * .4, sy = p[1] - sz * .5; x.drawImage(gl, sx, sy, sz * .8, sz, 0, 0, 240, 300); const d = x.getImageData(0, 0, 8, 8).data; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 12) ok = true; } } catch (e) { } if (!ok) { x.fillStyle = '#9fd0ff'; x.fillRect(0, 0, 240, 300); x.font = '120px ' + FONT; x.textAlign = 'center'; x.fillText('🙂', 120, 190); } return c; };
    G_.update = (dt) => { G_.t += dt; G_.flash = Math.max(0, G_.flash - dt * 2.2);
      if (G_.phase === 'count') { G_.cd -= dt; if (G_.cd <= 0) { if (G_.cd > -1) { } } if (G_.cd <= 0 && !G_.fired) { G_.fired = true; G_.flash = 1; requestAnimationFrame(() => { G_.shots.push(G_.snap()); }); G_.pt = 0; } if (G_.fired) { G_.pt += dt; if (G_.pt > 1.0) { G_.fired = false; G_.shot++; if (G_.shot >= 3) { G_.phase = 'result'; G_.done = null; G_.tmo = 0; } else G_.cd = 2.2; } } }
      if (G_.phase === 'result') { G_.tmo += dt; if (G_.tmo > .3 && !G_.fin) { G_.fin = true; G_.score = 3; G_.resultReady = true; } } };
    G_.finishNow = () => { G_.done = { score: 3, coins: 5, msg: '大头贴完成！', keep: true }; };
    G_.down = (x, y) => { if (G_.phase === 'choose') { for (let i = 0; i < 3; i++) if (Math.abs(x - (260 + i * 220)) < 90 && y > 200 && y < 360) G_.frame = i; if (x > 380 && x < 580 && y > 410 && y < 480) { G_.phase = 'count'; G_.cd = 3; G_.shot = 0; G_.shots = []; G_.fired = false; } } else if (G_.phase === 'result' && G_.shots.length >= 3 && x > 380 && x < 580 && y > 470) G_.finishNow(); };
    G_.draw = (g) => { const f = FR[G_.frame]; g.fillStyle = grad(g, 0, GH, '#2a1b4a', '#150c2b'); g.fillRect(0, 0, GW, GH);
      if (G_.phase === 'choose') { gtxt(g, '选一个相框，再点「开拍」', 480, 80, 30, '#fff'); FR.forEach((q, i) => { rrect(g, 170 + i * 220, 190, 180, 190, 18); g.fillStyle = q.c; g.fill(); if (i === G_.frame) { g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke(); } gtxt(g, q.e, 260 + i * 220, 260, 64); gtxt(g, q.n, 260 + i * 220, 340, 22, '#241033'); });
        rrect(g, 380, 410, 200, 70, 35); g.fillStyle = '#ffb03a'; g.fill(); gtxt(g, '📸 开拍', 480, 445, 32, '#3a2000'); }
      else if (G_.phase === 'count') { rrect(g, 300, 60, 360, 420, 24); g.fillStyle = f.c; g.fill(); rrect(g, 320, 80, 320, 380, 16); g.fillStyle = '#111'; g.fill(); gtxt(g, POSES[Math.min(2, G_.shot)], 480, 140, 34, '#fff'); const n = Math.ceil(G_.cd); if (!G_.fired && G_.cd > 0) gtxt(g, n, 480, 280, 150, '#ffe9a8', 'center', '900'); else gtxt(g, '咔嚓！', 480, 280, 80, '#fff'); gtxt(g, (G_.shot + 1 > 3 ? 3 : G_.shot + 1) + ' / 3', 480, 440, 24, '#fff'); }
      else { rrect(g, 60, 40, 840, 410, 20); g.fillStyle = f.c; g.fill(); G_.shots.forEach((c, i) => { rrect(g, 90 + i * 270, 80, 240, 310, 12); g.save(); g.clip(); g.drawImage(c, 90 + i * 270, 80, 240, 310); g.restore(); }); gtxt(g, f.e + '  STAR FUNFAIR  ' + f.e, 480, 425, 26, '#fff', 'center', '900'); rrect(g, 380, 470, 200, 56, 28); g.fillStyle = '#ffb03a'; g.fill(); gtxt(g, G_.shots.length >= 3 ? '完成 +5 金币' : '冲洗中…', 480, 498, 26, '#3a2000'); }
      if (G_.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + G_.flash + ')'; g.fillRect(0, 0, GW, GH); } };
    return G_;
  }

  /* ---- 7 棉花糖（按住转圈 → 松手） ---- */
  function gCandy() {
    const G_ = baseGame(); G_.title = '🍭 做棉花糖'; G_.orders = [.35, .6, .85]; G_.i = 0; G_.size = 0; G_.hold = false; G_.phase = 'wait'; G_.pt = 0; G_.res = []; G_.cols = [['#ff8fc7', '#ffc6e4'], ['#7fc8ff', '#c5e6ff'], ['#b89cff', '#e0d4ff'], ['#ffd27a', '#ffeabd']]; G_.col = G_.cols[(Math.random() * 4) | 0];
    G_.update = (dt) => { G_.t += dt; if (G_.phase === 'spin') { G_.size += dt * (.36 + G_.i * .06); if (G_.size >= 1) G_.release(); } else if (G_.phase === 'show') { G_.pt += dt; if (G_.pt > 1.3) { G_.i++; if (G_.i >= 3) { const sc = G_.res.reduce((a, b) => a + b, 0); G_.score = sc; G_.done = { score: sc, coins: Math.min(40, 4 + Math.round(sc / 9)), msg: '三份订单总分 ' + sc }; } else { G_.phase = 'wait'; G_.size = 0; G_.col = G_.cols[(Math.random() * 4) | 0]; } } } };
    G_.release = () => { if (G_.phase !== 'spin') return; const tg = G_.orders[G_.i], d = Math.abs(G_.size - tg), sc = Math.max(0, Math.round(100 - d * 260)); G_.res.push(sc); G_.phase = 'show'; G_.pt = 0; popT(G_, 480, 220, sc >= 85 ? '完美！+' + sc : '+' + sc, sc >= 85 ? '#ffd93d' : '#9bff9b'); };
    G_.down = () => { if (G_.phase === 'wait') { G_.phase = 'spin'; G_.size = .02; } }; G_.up = () => { if (G_.phase === 'spin') G_.release(); };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#ffd1e8', '#ff9cc8'); g.fillRect(0, 0, GW, GH); g.fillStyle = '#e9e9f5'; g.beginPath(); g.ellipse(480, 430, 190, 60, 0, 0, 7); g.fill(); g.fillStyle = '#c7c7e0'; g.beginPath(); g.ellipse(480, 430, 150, 40, 0, 0, 7); g.fill();
      const tg = G_.orders[Math.min(2, G_.i)], baseR = 40, R1 = baseR + tg * 150; g.setLineDash([10, 8]); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.beginPath(); g.arc(480, 330, R1, 0, 7); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#c99a5a'; g.save(); g.translate(480, 330); g.rotate(G_.phase === 'spin' ? G_.t * 8 : 0); g.fillRect(-5, 20, 10, 150); g.restore();
      const r = baseR + G_.size * 150; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28 + G_.t * (G_.phase === 'spin' ? 5 : .3), rr2 = r * (.7 + .3 * Math.sin(k * 2.3 + G_.t * 3)); g.fillStyle = k % 2 ? G_.col[0] : G_.col[1]; g.beginPath(); g.arc(480 + Math.cos(a) * rr2 * .55, 330 + Math.sin(a) * rr2 * .55, r * .5, 0, 7); g.fill(); }
      gtxt(g, '第 ' + Math.min(3, G_.i + 1) + '/3 单：做到虚线圈那么大', 480, 62, 28, '#6a1d49'); gtxt(g, G_.phase === 'wait' ? '👆 按住屏幕开始转，大小刚好时松手' : G_.phase === 'spin' ? '转转转…到虚线圈就松手！' : '得分 ' + G_.res[G_.res.length - 1], 480, 118, 22, '#8a2d62'); };
    return G_;
  }

  /* ---- 8 爆米花（接爆米花） ---- */
  function gPopcorn() {
    const G_ = baseGame(); G_.title = '🍿 接爆米花'; G_.left = 22; G_.k = []; G_.bx = 480; G_.tx = 480; G_.spawn = 0;
    G_.update = (dt) => { G_.t += dt; G_.left -= dt; G_.spawn -= dt; G_.bx += (G_.tx - G_.bx) * Math.min(1, dt * 14);
      if (G_.spawn <= 0) { G_.spawn = rr_(.18, .38); const r = Math.random(); G_.k.push({ x: 480 + rr_(-30, 30), y: 150, vx: rr_(-260, 260), vy: rr_(-380, -160), type: r < .12 ? 'burnt' : r < .2 ? 'gold' : 'n', rot: 0 }); }
      G_.k.forEach(q => { q.vy += 620 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += dt * 6; if (q.y > 430 && q.y < 470 && Math.abs(q.x - G_.bx) < 70 && !q.got) { q.got = true; const pt = q.type === 'gold' ? 5 : q.type === 'burnt' ? -3 : 1; G_.score = Math.max(0, G_.score + pt); popT(G_, q.x, 420, (pt > 0 ? '+' : '') + pt, pt > 0 ? (pt > 1 ? '#ffd93d' : '#fff') : '#ff6b6b'); } }); G_.k = G_.k.filter(q => !q.got && q.y < 600 && q.x > -40 && q.x < 1000);
      if (G_.left <= 0) G_.done = { score: G_.score, coins: Math.min(45, Math.round(G_.score * 1.1)), msg: '接到 ' + G_.score + ' 分' }; };
    G_.down = (x) => { G_.tx = x; }; G_.move = (x) => { G_.tx = x; };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#ffe7a8', '#ffb86b'); g.fillRect(0, 0, GW, GH);
      rrect(g, 400, 20, 160, 160, 18); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill(); g.strokeStyle = '#e8352e'; g.lineWidth = 8; g.stroke(); gtxt(g, 'POP', 480, 100, 44, '#e8352e', 'center', '900'); g.fillStyle = '#e8352e'; g.fillRect(380, 180, 200, 24);
      G_.k.forEach(q => { gtxt(g, q.type === 'burnt' ? '⚫' : q.type === 'gold' ? '⭐' : '🍿', q.x, q.y, 40); });
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(G_.bx - 70, 440); g.lineTo(G_.bx + 70, 440); g.lineTo(G_.bx + 52, 520); g.lineTo(G_.bx - 52, 520); g.closePath(); g.fill(); for (let i = -2; i <= 2; i++) { g.fillStyle = '#e8352e'; g.fillRect(G_.bx + i * 26 - 7, 440, 14, 80); } gtxt(g, '左右拖动桶接爆米花  ⭐+5  ⚫-3', 480, 240, 22, '#7a2a00'); gtxt(g, '⏱ ' + Math.max(0, Math.ceil(G_.left)) + 's', 880, 30, 26, '#7a2a00', 'right'); };
    return G_;
  }

  /* ---- 9 许愿（投币进喷泉） ---- */
  function gWish() {
    const G_ = baseGame(); G_.title = '⛲ 投币许愿'; G_.coins = 3; G_.fly = null; G_.rip = [];
    G_.cross = () => { const sp = 1 + (3 - G_.coins) * .2; return [480 + 250 * Math.sin(G_.t * 1.7 * sp), 300 + 70 * Math.sin(G_.t * 2.3 * sp + 1)]; };
    G_.update = (dt) => { G_.t += dt; G_.rip.forEach(r => r.t += dt); G_.rip = G_.rip.filter(r => r.t < 1.2);
      if (G_.fly) { G_.fly.u += dt / .6; if (G_.fly.u >= 1) { const f = G_.fly, d = Math.hypot(f.x - 480, (f.y - 300) * 1.6); let pt = 0, s = '没投进池里'; if (d < 26) { pt = 100; s = '🌟 大吉！'; } else if (d < 80) { pt = 40; s = '✨ 许愿成功 +40'; } else if (d < 190) { pt = 15; s = '💫 +15'; } G_.score += pt; G_.rip.push({ x: f.x, y: f.y, t: 0 }); popT(G_, f.x, f.y - 30, s, pt ? '#ffe36a' : '#ff9bb0'); G_.fly = null; if (G_.coins <= 0) G_.done = { score: G_.score, coins: Math.min(60, Math.round(G_.score / 4)), msg: '愿望得分 ' + G_.score }; } } };
    G_.down = () => { if (G_.fly || G_.coins <= 0) return; const c = G_.cross(); G_.coins--; G_.fly = { u: 0, x: c[0], y: c[1] }; };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#16335e', '#0a1630'); g.fillRect(0, 0, GW, GH); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + (.25 + .25 * Math.sin(G_.t * 2 + i)) + ')'; g.fillRect((i * 83) % GW, (i * 47) % 160, 3, 3); }
      g.fillStyle = '#d9def2'; g.beginPath(); g.ellipse(480, 310, 330, 150, 0, 0, 7); g.fill(); g.fillStyle = '#5ed7ff'; g.beginPath(); g.ellipse(480, 310, 300, 128, 0, 0, 7); g.fill();
      [[190, 80, 'rgba(255,255,255,.35)'], [80, 34, 'rgba(255,230,120,.55)'], [26, 11, 'rgba(255,215,60,.95)']].forEach(([rx, ry, c]) => { g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.ellipse(480, 300, rx * 1.0, ry * 1.0 + 0, 0, 0, 7); g.stroke(); });
      G_.rip.forEach(r => { g.strokeStyle = 'rgba(255,255,255,' + (1 - r.t / 1.2) + ')'; g.lineWidth = 3; g.beginPath(); g.ellipse(r.x, r.y, 10 + r.t * 70, 4 + r.t * 28, 0, 0, 7); g.stroke(); });
      if (!G_.fly && G_.coins > 0) { const c = G_.cross(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(c[0], c[1], 18, 0, 7); g.moveTo(c[0] - 28, c[1]); g.lineTo(c[0] + 28, c[1]); g.moveTo(c[0], c[1] - 28); g.lineTo(c[0], c[1] + 28); g.stroke(); }
      if (G_.fly) { const f = G_.fly, u = f.u, x = lerp(480, f.x, u), y = lerp(520, f.y, u) - Math.sin(u * PI) * 190; gtxt(g, '🪙', x, y, 44 - 14 * u); }
      for (let i = 0; i < G_.coins; i++) gtxt(g, '🪙', 70 + i * 50, 505, 36); gtxt(g, '点屏幕投币，投中中心圈最吉利', 480, 56, 26, '#cfe9ff'); };
    return G_;
  }

  const GAMES = { ring: { make: gRing, cost: 8 }, balloon: { make: gBalloon, cost: 6 }, strong: { make: gStrong, cost: 10 }, haunt: { make: gHaunt, cost: 0 }, fortune: { make: gFortune, cost: 5 }, photo: { make: gPhoto, cost: 0 }, candy: { make: gCandy, cost: 10 }, popcorn: { make: gPopcorn, cost: 10 }, wish: { make: gWish, cost: 5 } };

  function gmBuild() {
    if (gm.el) return; const el = document.createElement('div'); el.id = 'ffGame'; el.style.cssText = 'position:fixed;inset:0;z-index:90;background:#07041a;display:none;align-items:center;justify-content:center;touch-action:none;-webkit-user-select:none;user-select:none';
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; cv.style.cssText = 'max-width:100vw;max-height:100vh;aspect-ratio:16/9;width:100%;height:auto;object-fit:contain;background:#000;touch-action:none'; el.appendChild(cv);
    const x = document.createElement('button'); x.textContent = '✕'; x.style.cssText = 'position:absolute;top:calc(8px + env(safe-area-inset-top));right:calc(10px + env(safe-area-inset-right));width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.4);background:rgba(20,10,50,.8);color:#fff;font:700 20px system-ui;z-index:2'; el.appendChild(x); x.addEventListener('click', () => gmClose());
    document.body.appendChild(el); gm.el = el; gm.cv = cv; gm.g = cv.getContext('2d');
    const P = (e) => { const r = cv.getBoundingClientRect(), ar = 16 / 9; let w = r.width, h = r.height, ox = r.left, oy = r.top; if (w / h > ar) { const nw = h * ar; ox += (w - nw) / 2; w = nw; } else { const nh = w / ar; oy += (h - nh) / 2; h = nh; } return [(e.clientX - ox) / w * GW, (e.clientY - oy) / h * GH]; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); const [px, py] = P(e); gmPtr('down', px, py); }); cv.addEventListener('pointermove', e => { const [px, py] = P(e); gmPtr('move', px, py); }); const up = e => { const [px, py] = P(e); gmPtr('up', px, py); }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    addEventListener('keydown', e => { if (gm.game && e.key === 'Escape') gmClose(); });
  }
  function gmPtr(kind, x, y) {
    if (!gm.game) return;
    if (gm.res) { if (kind === 'down') for (const b of gm.btns) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) { b.f(); return; } return; }
    const G_ = gm.game; if (kind === 'down' && G_.down) G_.down(x, y); else if (kind === 'move' && G_.move) G_.move(x, y); else if (kind === 'up' && G_.up) G_.up(x, y);
  }
  function gmOpen(id) {
    const def = GAMES[id]; if (!def) return; gmBuild(); if (def.cost && !spend(def.cost)) return; gm.def = def; gm.id = id; gm.game = def.make(); gm.res = null; gm.btns = []; st.gameOpen = true; gm.el.style.display = 'flex'; gm.last = performance.now(); cancelAnimationFrame(gm.raf); gm.raf = requestAnimationFrame(gmLoop);
  }
  function gmClose() { if (!gm.el) return; gm.game = null; gm.res = null; gm.el.style.display = 'none'; st.gameOpen = false; cancelAnimationFrame(gm.raf); }
  function gmFinish(d) { gm.res = d; if (d.coins) host.coins(d.coins); const again = () => { if (gm.def.cost && !spend(gm.def.cost)) return; gm.game = gm.def.make(); gm.res = null; gm.btns = []; }; gm.btns = [{ x: 240, y: 380, w: 220, h: 66, f: again, t: '再玩一次' + (gm.def.cost ? '（-' + gm.def.cost + '）' : ''), c: '#ffb03a' }, { x: 500, y: 380, w: 220, h: 66, f: gmClose, t: '完成', c: '#6be58a' }]; }
  function gmLoop(now) {
    if (!gm.game) return; const dt = Math.min(.05, (now - gm.last) / 1000); gm.last = now; const g = gm.g, G_ = gm.game; g.setTransform(1280 / GW, 0, 0, 720 / GH, 0, 0);
    if (!gm.res) { G_.update(dt); if (G_.done && !gm.res) { if (G_.done.keep && G_.phase === 'result') { /* photo handled by button */ } gmFinish(G_.done); } }
    G_.draw(g); drawFx(g, G_, dt);
    if (!gm.res) { gtxt(g, G_.title, 24, 30, 22, 'rgba(255,255,255,.85)', 'left'); if (G_.score != null && G_.phase !== 'result') gtxt(g, '得分 ' + G_.score, 24, 62, 20, '#ffe9a8', 'left'); }
    else { g.fillStyle = 'rgba(5,3,20,.78)'; g.fillRect(0, 0, GW, GH); rrect(g, 180, 110, 600, 360, 28); g.fillStyle = '#241446'; g.fill(); g.strokeStyle = '#8f5bff'; g.lineWidth = 4; g.stroke();
      gtxt(g, G_.title.replace(/^\S+\s/, '') + ' 结束', 480, 160, 34, '#fff'); const lines = String(gm.res.msg || '').split('\n'); lines.forEach((l, i) => gtxt(g, l, 480, 225 + i * 36, i ? 20 : 26, i ? '#cfe9ff' : '#ffe9a8')); gtxt(g, gm.res.coins ? '+' + gm.res.coins + ' 金币 🪙' : '这次没有奖励', 480, 322, 32, gm.res.coins ? '#ffd93d' : '#ff9bb0');
      gm.btns.forEach(b => { rrect(g, b.x, b.y, b.w, b.h, 33); g.fillStyle = b.c; g.fill(); gtxt(g, b.t, b.x + b.w / 2, b.y + b.h / 2, 26, '#2a1500'); }); }
    gm.raf = requestAnimationFrame(gmLoop);
  }
  S.openGame = gmOpen;
  S.act = act;
  const crossPos = () => { const b = HSG('balloon'), tt = st.bal.t; return [b.bx + 2.6 * Math.sin(1.3 * tt), 2.35 + .95 * Math.sin(1.7 * tt + 1), b.bz - 1.9]; };

  /* ---------- 帧驱动 ---------- */
  let fr = 0, hooked = false, lastT = performance.now() / 1000, accLake = 99, lastH = -1;
  function installHooks() {
    if (hooked) return; const g = window.__game; if (!g) return; hooked = true;
    const btn = document.getElementById('enterBtn'), orig = btn.onclick;
    btn.onclick = e => { const n = (window.__game || {}).near; if (n && n.id === 'plaza' && window.FUNFAIR_STANDALONE) { host.toast('单独测试版：整合后这里会回到星光广场', 2200); return; } if (st.ride) endRide('已提前下车'); else if (n && n.act && S.hotspots.includes(n)) act(n); else if (orig) orig.call(btn, e); };
    window.addEventListener('keydown', ev => { if (ev.target && ev.target.tagName === 'INPUT') return; if (ev.key === 'e' || ev.key === 'E' || ev.key === 'Enter') { const n = (window.__game || {}).near; if (n && n.id === 'plaza' && window.FUNFAIR_STANDALONE) { host.toast('单独测试版：整合后这里会回到星光广场', 2200); ev.stopImmediatePropagation(); } else if (st.ride) { endRide('已提前下车'); ev.stopImmediatePropagation(); } else if (n && n.act && S.hotspots.includes(n)) { act(n); ev.stopImmediatePropagation(); } } }, true);
  }
  function envFair(h) { const e = Object.assign({}, envAt(h)); e.fog = mix(e.bot, e.top, .9); e.fogNear = 85; e.fogFar = 270; return e; }
  const sunCol = (e) => mix(mix([1, 1, .95], [1, .62, .3], e.gold), [.75, .85, 1], e.night);
  const rr = (k) => { const s = Math.sin(k * 12.9898) * 43758.5453; return s - Math.floor(s); };

  function horse(mb, x, y, z, tx, tz, col, uni) {
    for (const k of [-.5, 0, .5]) mb.sphere(x + tx * k * .95, y + .95, z + tz * k * .95, k ? .34 : .4, .36, k ? .34 : .4, col, 4);
    mb.sphere(x + tx * .9, y + 1.32, z + tz * .9, .22, .3, .22, col, 4); mb.sphere(x + tx * 1.2, y + 1.5, z + tz * 1.2, .2, .2, .2, col, 4); mb.sphere(x - tx * 1.0, y + .92, z - tz * 1.0, .13, .3, .13, [.98, .9, .6], 4);
    mb.sphere(x + tx * .05, y + 1.32, z + tz * .05, .3, .1, .3, [.9, .2, .35], 4);
    for (const [a, b] of [[.55, .12], [.55, -.12], [-.55, .12], [-.55, -.12]]) mb.cyl(x + tx * a - tz * b, z + tz * a + tx * b, y + .1, y + .75, .06, .05, 4, mul(col, .8));
    if (uni) mb.cyl(x + tx * 1.3, z + tz * 1.3, y + 1.6, y + 2.0, .05, .0, 4, [1, .85, .3]);
  }
  function tick(h, e) {
    const now = performance.now() / 1000, dt = Math.min(.1, now - lastT); lastT = now; const t = now, g = window.__game; installHooks();
    const me = g && g.me, cam = g && g.cam, camX = cam ? cam.target[0] : 0, camZ = cam ? cam.target[2] : 0;
    for (let i = later.length - 1; i >= 0; i--) if (later[i][0] <= t) { const f = later[i][1]; later.splice(i, 1); f(); }
    fr++; accLake += dt; if (accLake > .2 || Math.abs(h - lastH) > .02) { accLake = 0; lastH = h; rebuildLake(t, e); }
    st.wheel += OMEGA * dt; st.car += .55 * dt; st.swing += .9 * dt; st.photoT = Math.max(0, st.photoT - dt); st.haunt = Math.max(0, st.haunt - dt);
    { const y = carPos(0)[1]; st.coS += coasterV(y) * dt; }

    /* ---- 乘坐：覆盖玩家位置 + 镜头拉远 ---- */
    let riderY = 0;
    if (st.ride && me) {
      const r = st.ride; r.t += dt; const p = ridePos(r, t);
      me.x = p[0]; me.z = p[2]; me.y = p[1]; me.yaw = p[3]; me.vx = me.vz = 0; me.moving = false; g.target = null; st.rideX = me.x; st.rideZ = me.z; st.rideY = p[1]; riderY = p[1];
      if (st.rideObs) { st.rideObs.x0 = me.x - .7; st.rideObs.x1 = me.x + .7; st.rideObs.z0 = me.z - .7; st.rideObs.z1 = me.z + .7; }
      const bt = document.getElementById('enterBtn'), tx = document.getElementById('enterText'), ic = document.getElementById('enterIcon'); if (bt) bt.hidden = false; if (tx) tx.textContent = '下车'; if (ic) ic.textContent = '⬇️';
      if ((r.kind === 'coaster' && st.coS - r.s0 > r.total) || r.t > r.dur) endRide();
    }
    computeRig(dt, t);
    { const vw = (g && g.wide && S.cameraWide) || S.camera; st.baseDist = vw.dist; }
    if (cam) { const want = st.baseDist + (st.ride ? 2.1 * Math.max(0, riderY - 1.5) : 0); cam.dist += (want - cam.dist) * (1 - Math.exp(-(st.ride ? 3 : 2) * dt)); }

    /* ---- 按钮文字 ---- */
    const n = g && g.near; if (!st.ride && n && S.hotspots.includes(n)) { const tx = document.getElementById('enterText'), ic = document.getElementById('enterIcon'); let label = n.btn; if (n.id === 'ring' && st.ring.s === 1) label = '投！'; if (n.id === 'balloon' && st.bal.s === 1) label = '射！'; if (n.id === 'strong' && st.str.s === 1) label = '挥锤！'; if (tx) tx.textContent = label; if (ic) ic.textContent = X.ICONS[n.icon]; }

    /* ---- 小游戏逻辑 ---- */
    const ringH = HSG('ring'), strH = HSG('strong'), R_ = st.ring, B_ = st.bal, S_ = st.str;
    if (R_.s === 1) { R_.t += dt; R_.sweep = 2.4 * Math.sin(R_.t * 2.2); if (R_.t > 7) { R_.s = 0; host.toast('时间到，下次再来～'); } }
    if (R_.s === 2) { R_.fl.t += dt / .9; if (R_.fl.t >= 1) { const off = R_.fl.off; let bi = 0, bd = 9; for (let i = 0; i < 7; i++) { const d = Math.abs(i * .7 - 2.1 - off); if (d < bd) { bd = d; bi = i; } } R_.s = 0;
      if (bd < .27) { const rw = bi === 3 ? 40 : 15; host.coins(rw); host.toast(bi === 3 ? '🎉 正中大奖瓶！+40 金币' : '🎯 套中啦！+15 金币', 2200); burst(R_.fl.to[0], 1.9, R_.fl.to[2], 22, 3, 1, .26, [[1, .85, .3], [1, .5, .7], [.5, .9, 1]], -5); } else host.toast('差一点点～再试一次', 1600); } }
    if (B_.s === 1) { B_.t += dt; if (B_.t > 7) { B_.s = 0; host.toast('时间到，下次再来～'); } }
    if (B_.s === 2) { B_.dart.t += dt / .3; if (B_.dart.t >= 1) { const c = B_.dart.to; B_.s = 0; let bi = -1, bd = .55; B_.list.forEach((b, i) => { if (!b.alive) return; const d = Math.hypot(b.x - c[0], b.y - c[1]); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) { const b = B_.list[bi]; b.alive = false; b.back = 12; const rw = b.col === 2 ? 25 : 8; host.coins(rw); host.toast(b.col === 2 ? '🎈 金色气球！+25 金币' : '🎈 命中！+8 金币', 1800); burst(b.x, b.y, b.z, 18, 3, .8, .26, [BALC[b.col], [1, 1, 1]], -6); } else host.toast('没射中，再来！', 1500); } }
    B_.list.forEach(b => { if (!b.alive) { b.back -= dt; if (b.back <= 0) b.alive = true; } });
    if (S_.s === 1) { S_.t += dt; S_.ph += dt * S_.sp * (1 + .45 * Math.sin(S_.t * 3.1)); S_.m = Math.abs(Math.sin(S_.ph)); if (S_.t > 4) { S_.s = 0; host.toast('时间到，下次再来～'); } }
    if (S_.s === 2) { S_.t += dt; const u = Math.min(1, S_.t / 1.1), hh = S_.power * 7 * (1 - Math.pow(1 - u, 2.2)); S_.lit = Math.floor(hh / .5) + 1;
      if (u >= 1 && !S_.done) { S_.done = 1; if (S_.power > .95) { host.coins(60); host.toast('🔔 叮——！满分！+60 金币', 2600); burst(strH.bx + 5.4, 9, strH.bz - 1.2, 50, 6, 1.4, .4, [[1, .85, .3], [1, 1, .7], [1, .5, .5]], -3); } else { const rw = 3 + Math.round(S_.power * S_.power * 24); host.coins(rw); host.toast('🔨 力量 ' + Math.round(S_.power * 100) + '！+' + rw + ' 金币', 2000); } }
      if (S_.t > 3) { S_.s = 0; S_.lit = 0; } }

    /* ---- 夜晚自动烟花秀（湖面上空） ---- */
    if (!st.nextShow) st.nextShow = t + 12;
    if (e.night > .55 && t > st.nextShow) { st.nextShow = t + 55; const cols = [[[1, .4, .6], [1, .8, .9]], [[.4, .8, 1], [.8, 1, 1]], [[1, .85, .3], [1, 1, .7]], [[.6, 1, .5], [.9, 1, .8]]];
      for (let i = 0; i < 9; i++) { const x = 6 + Math.random() * 52, z = -46 - Math.random() * 14, hh = 13 + Math.random() * 4, cc = pick(cols), t0 = t + i * 1.1 + .2;
        later.push([t0, () => { for (let k = 0; k < 12; k++) later.push([performance.now() / 1000 + k * .04, () => addP(x, 2 + (hh - 2) * (k / 12), z, 0, 0, 0, .5, .3, [1, .9, .6], 0, 0)]); }], [t0 + .55, () => { burst(x, hh, z, 90, 9, 1.9, .42, cc, -4); burst(x, hh, z, 24, 4.5, 1.4, .55, [[1, 1, 1]], -3); }]); } }

    /* ---- 天空：太阳 / 月亮 / 地平线暖光 / 云 ---- */
    const ev = R.view ? R.view.eye : [camX, 8.5, camZ + 24], eyeY = ev[1], D = 105, sx = camX * .9 + 14;
    dynSky.v.length = 0; dynSky.i.length = 0; dynSky.n = 0;
    if (fr % 4 === 0) { const sc = sunCol(e), elev = lerp(.012, .055, e.day) * (1 - e.night) + e.night * .05, sy = eyeY + D * Math.tan(clamp(elev, .01, .06)) + 1, sz = ev[2] - D - 30, sunI = 1 - e.night;
      if (sunI > .02) { bb(dynSky, sx, sy, sz, 60, 60, mul(sc, .55 * sunI)); bb(dynSky, sx, sy, sz, 22, 22, mul(sc, .9 * sunI)); bb(dynSky, sx, sy, sz, 6.5, 6.5, mul([1, 1, 1], 1.2 * sunI)); }
      if (e.night > .05) { const mx = camX * .9 - 20, my = eyeY + D * .052 + 1; bb(dynSky, mx, my, sz, 26, 26, mul([.45, .6, 1], .5 * e.night)); bb(dynSky, mx, my, sz, 5, 5, mul([.95, .97, 1], 1.4 * e.night)); }
      bb(dynSky, camX, eyeY + 1, sz, 190, 7, mul(sc, (.2 + e.gold * .45) * (1 - e.night * .8)));
      upload(bSky, dynSky);
      dynCloud.v.length = 0; dynCloud.i.length = 0; dynCloud.n = 0; const cc = mix(mix([1, 1, 1], [1, .66, .55], e.gold), [.2, .22, .4], e.night);
      [[-120, 4.4, 80, 14], [-30, 5.4, 110, 18], [70, 4.2, 90, 15], [150, 5.8, 100, 16], [-210, 5.2, 90, 14]].forEach(([ox, ang, w, hh], i) => bb(dynCloud, camX * .85 + ox + Math.sin(t * .01 + i) * 6, eyeY + 150 * Math.tan(ang / 57.3) + hh * .5, ev[2] - 150, w, hh, cc)); upload(bCloud, dynCloud); }

    /* ---- 不透明动态物 ---- */
    const mb = dynOpaque; mb.v.length = 0; mb.i.length = 0; mb.n = 0; const W = WHEEL;
    // 摩天轮：辐条 + 吊舱
    for (let i = 0; i < W.n; i++) { const a = st.wheel + i * TAU / W.n, px = W.x + Math.cos(a) * W.R, py = W.hub + Math.sin(a) * W.R;
      [-.9, .9].forEach(zo => tube(mb, [[W.x, W.hub, W.z + zo], [px, py, W.z + zo]], .06, 4, [.95, .95, 1]));
      const col = PAL[i % PAL.length], fy = py - 2.85; mb.box(px - .7, fy, W.z - .62, px + .7, fy + .12, W.z + .62, [.96, .94, .9]);
      [[-.7, -.62], [.7 - .06, -.62], [-.7, .62 - .06], [.7 - .06, .62 - .06]].forEach(([dx, dz]) => mb.box(px + dx, fy + .12, W.z + dz, px + dx + .06, fy + 1.0, W.z + dz + .06, col));
      mb.box(px - .75, fy + 1.0, W.z - .66, px + .75, fy + 1.06, W.z + .66, col); mb.box(px - .85, fy + 2.5, W.z - .75, px + .85, fy + 2.62, W.z + .75, col); [-.6, .6].forEach(dz => mb.box(px - .03, fy + 1.06, W.z + dz - .03, px + .03, py, W.z + dz + .03, [.8, .8, .85])); [-.6, .6].forEach(dz => mb.box(px - .03, fy + .12, W.z + dz - .03, px + .03, fy + 2.5, W.z + dz + .03, [.8, .8, .85])); }
    // 旋转木马
    for (let i = 0; i < HORSES; i++) { const a = st.car + i * TAU / HORSES, x = CAR.x + Math.cos(a) * 3.6, z = CAR.z + Math.sin(a) * 3.6, y = horseBob(i, t), tx = -Math.sin(a), tz = Math.cos(a);
      mb.cyl(x, z, .5, 5.4, .05, .05, 5, [1, .85, .3]); horse(mb, x, y, z, tx, tz, [[1, 1, 1], [.7, .45, .3], [1, .75, .85], [.7, 1, .9], [.85, .8, 1]][i % 5], i % 3 === 0); }
    for (let i = 0; i < 6; i++) { const a = -st.car * .9 + i * TAU / 6, x = CAR.x + Math.cos(a) * 1.7, z = CAR.z + Math.sin(a) * 1.7; mb.cyl(x, z, .5, 4.6, .04, .04, 4, [1, .85, .3]); mb.box(x - .5, .55 + horseBob(i, t) * .8, z - .5, x + .5, .95 + horseBob(i, t) * .8, z + .5, PAL[i % 6]); }
    // 过山车列车
    for (let k = 0; k < 4; k++) { const p = carPos(k), c = PAL[k % PAL.length]; mb.box(p[0] - .55, p[1] - .25, p[2] - .55, p[0] + .55, p[1] + .35, p[2] + .55, c); mb.sphere(p[0], p[1] + .3, p[2], .5, .22, .5, mul(c, 1.1), 5); }
    // 摇摆飞椅
    { const sx0 = 54, sz0 = 10; mb.cyl(sx0, sz0, 0, 13, .5, .3, 8, [.95, .9, .95]); const sp = st.swing, ra = Math.min(1, 1.2 + Math.sin(sp * .3) * .3);
      mb.cyl(sx0, sz0, 12.8, 13.4, 4.8, 4.8, 20, [1, .5, .65], true); mb.cyl(sx0, sz0, 13.4, 15.2, 4.9, .2, 12, [1, .85, .3]);
      for (let i = 0; i < 12; i++) { const a = sp + i * TAU / 12, swing = .75 + Math.sin(sp * .25) * .15, rx = 4.2 + Math.sin(swing) * 3.4, ry = 12.8 - Math.cos(swing) * 3.4 - 1.6, cx = sx0 + Math.cos(a) * rx, cz = sz0 + Math.sin(a) * rx;
        tube(mb, [[sx0 + Math.cos(a) * 4.2, 12.8, sz0 + Math.sin(a) * 4.2], [cx, ry + 1.2, cz]], .03, 3, [.85, .85, .9]); mb.box(cx - .35, ry, cz - .35, cx + .35, ry + .12, cz + .35, PAL[i % 6]); mb.box(cx - .35, ry + .12, cz - .35, cx + .35, ry + .7, cz - .28, PAL[i % 6]); } }
    // 入口彩色气球（飘浮）
    for (let i = 0; i < 9; i++) { const sd = i < 5 ? -1 : 1, kq = i < 5 ? i : i - 5, bx = GATE.x + sd * (3.9 + kq * .85), bz = GATE.z - .3 + (kq % 2) * .5, by = 4.2 + Math.sin(t * 1.1 + i) * .3 + (kq % 3) * .45; mb.sphere(bx, by, bz, .5, .62, .5, BALC[i % 6], 6); tube(mb, [[bx, by - .6, bz], [bx + Math.sin(t + i) * .1, .28, bz]], .012, 3, [.9, .9, .9]); mb.box(bx - .14, 0, bz - .14, bx + .14, .28, bz + .14, BALC[i % 6]); }
    // 打气球摊的气球
    B_.list.forEach(b => { if (b.alive) { mb.sphere(b.x, b.y + Math.sin(t * 2 + b.ph) * .03, b.z, .3, .36, .3, BALC[b.col], 5); } });
    // 大力锤的小球
    if (S_.s === 2) { const ph = S_.power * 7 * (1 - Math.pow(1 - Math.min(1, S_.t / 1.1), 2.2)); mb.sphere(strH.bx + 5.4, .95 + ph, strH.bz - .62, .2, .2, .2, [1, .3, .3], 6); }
    // 飞镖 / 套圈
    if (B_.s === 2) { const d = B_.dart, u = Math.min(1, d.t); const p = [lerp(d.from[0], d.to[0], u), lerp(d.from[1], d.to[1], u), lerp(d.from[2], d.to[2], u)]; tube(mb, [[p[0], p[1], p[2]], [p[0], p[1], p[2] + .5]], [.03, .03], 3, [.95, .9, .3]); mb.sphere(p[0], p[1], p[2] - .04, .06, .06, .06, [1, .3, .3], 3); }
    if (R_.s === 2) { const f = R_.fl, u = Math.min(1, f.t), p = [lerp(f.from[0], f.to[0], u), lerp(f.from[1], f.to[1], u) + Math.sin(u * PI) * 1.8, lerp(f.from[2], f.to[2], u)], pts = []; for (let i = 0; i <= 9; i++) { const a = i / 9 * TAU; pts.push([p[0] + Math.cos(a) * .3, p[1], p[2] + Math.sin(a) * .3]); } tube(mb, pts, .045, 3, [1, .85, .3]); }
    upload(bOpaque, mb);

    /* ---- 发光层：灯泡链、准星、鬼屋、水晶球、喷泉 ---- */
    const gi = .22 + e.night * .78, gm = dynGlow; gm.v.length = 0; gm.i.length = 0; gm.n = 0; const cyc = Math.floor(t * 6);
    for (let k = 0; k < 2; k++) { const zo = k ? .9 : -.9; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU + st.wheel * 0, c = PAL[(i + cyc) % PAL.length], on = ((i + cyc) % 3 ? .55 : 1.2) * gi; bb(gm, W.x + Math.cos(a) * W.R, W.hub + Math.sin(a) * W.R, W.z + zo, .5, .5, mul(c, on)); } }
    for (let i = 0; i < 16; i++) { const a = st.wheel + i * TAU / W.n; bb(gm, W.x + Math.cos(a) * W.R, W.hub + Math.sin(a) * W.R - 2.6, W.z, 1.0, 1.0, mul(PAL[i % PAL.length], .5 * gi)); }
    bb(gm, W.x, W.hub, W.z, 2.6, 2.6, mul([1, .85, .6], .5 * gi));
    for (let i = 0; i < 32; i++) { const a = i / 32 * TAU, c = PAL[(i + cyc) % PAL.length]; bb(gm, CAR.x + Math.cos(a) * 6.35, 5.5, CAR.z + Math.sin(a) * 6.35, .45, .45, mul(c, ((i + cyc) % 2 ? .5 : 1.1) * gi)); }
    bb(gm, CAR.x, 8.6, CAR.z, 1.8, 1.8, mul([1, .85, .4], .6 * gi));
    { const cx = 54, cz = 10; for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + st.swing * .2; bb(gm, cx + Math.cos(a) * 4.8, 12.8, cz + Math.sin(a) * 4.8, .45, .45, mul(PAL[(i + cyc) % 6], .9 * gi)); } }
    // 游戏摊的准星
    if (R_.s === 1) bb(gm, ringH.bx + R_.sweep, 2.05, ringH.bz - 1.2, .8, .8, mul([1, .4, .6], .9 + .3 * Math.sin(t * 12)));
    if (B_.s === 1) { const c = crossPos(); bb(gm, c[0], c[1], c[2], .5, .5, mul([1, .3, .3], 1.1)); bb(gm, c[0], c[1], c[2], 1.1, 1.1, mul([1, .6, .6], .35)); }
    if (S_.s >= 1) { const tx = strH.bx + 5.4, tz = strH.bz - 1.2; for (let i = 0; i < 14; i++) { const y = .9 + i * .5, lit = S_.s === 2 ? y <= .9 + S_.power * 7 * (1 - Math.pow(1 - Math.min(1, S_.t / 1.1), 2.2)) + .01 : false, c = i < 8 ? [.4, 1, .5] : i < 12 ? [1, .85, .3] : [1, .3, .3]; bb(gm, tx, y, tz + .44, lit ? .42 : .2, lit ? .42 : .2, mul(c, lit ? 1.3 : .22)); }
      if (S_.s === 1) { const my = .9 + S_.m * 7; bb(gm, tx, my, tz + .5, .62, .2, mul([1, .95, .5], 1.3)); bb(gm, tx, my, tz + .5, 1.1, .5, mul([1, .9, .4], .35)); } }
    // 占卜水晶球、鬼屋门口、喷泉光
    if (S.crystal) bb(gm, S.crystal[0], S.crystal[1], S.crystal[2], 1.1, 1.1, mul([.7, .6, 1], .6 + .4 * Math.sin(t * 2.4)));
    const hh = HSG('haunt'); if (st.haunt > 0 && Math.random() < .5) bb(gm, hh.x, 2 + Math.random(), hh.z - 3, 3, 3, [.3, 1, .3]);
    for (let i = 0; i < 6; i++) bb(gm, FOUNT.x + Math.cos(i * 1.047 + t * .6) * 3.6, 1.2, FOUNT.z + Math.sin(i * 1.047 + t * .6) * 3.6, .8, .8, mul(PAL[(i + cyc) % 6], .45 + gi * .5));
    // 湖面闪光 + 萤火虫
    { const gc = mix(mix([1, 1, 1], [1, .75, .4], e.gold), [.6, .75, 1], e.night); for (let i = 0; i < 70; i++) { const x = LAKE.x + (rr(i) - .5) * LAKE.rx * 1.6, z = LAKE.z + (rr(i + 9) - .5) * LAKE.rz * 1.6, a = Math.pow(Math.max(0, Math.sin(t * (2 + rr(i + 3) * 2) + rr(i + 7) * 6)), 4) * (.3 + e.gold * .6 + e.night * .7 + e.day * .3); if (a > .03 && lakeF(x, z) < .95) bb(gm, x, -.05, z, .4, .12, mul(gc, a)); }
      if (e.night > .2) for (let i = 0; i < 40; i++) { const bx = (rr(i + 50) - .5) * 120 + camX * .3, bz = (rr(i + 70) - .5) * 60, x = bx + Math.sin(t * .5 + i) * 2, y = 1 + rr(i + 3) * 3 + Math.sin(t * .9 + i * 2) * .5, z = bz + Math.cos(t * .4 + i) * 2, a = (.4 + .4 * Math.sin(t * 2 + i)) * e.night; if (inside(x, z)) bb(gm, x, y, z, .22, .22, mul([.8, 1, .4], a)); } }
    // 过山车 / 灯泡之外：路灯等静态已处理
    upload(bGlow, gm);

    /* ---- 喷泉水花 + 粒子 ---- */
    st.fountT += dt; while (st.fountT > .03) { st.fountT -= .03; const a = Math.random() * TAU, s = Math.random() * 1.2; addP(FOUNT.x + Math.cos(a) * .2, 4.0, FOUNT.z + Math.sin(a) * .2, Math.cos(a) * s, 6 + Math.random() * 2, Math.sin(a) * s, 1.1, .12, [.75, .92, 1], -9, 0); if (Math.random() < .35) { const b = Math.random() * TAU; addP(FOUNT.x + Math.cos(b) * 2.6, 2.6, FOUNT.z + Math.sin(b) * 2.6, Math.cos(b) * 1.2, 3.5, Math.sin(b) * 1.2, .9, .1, [.75, .92, 1], -9, 0); } }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < .05 && p.g < -5 && p.max > .5 && !(p.size < .15)) { p.y = .05; p.vy *= -.2; } }
    dynPart.v.length = 0; dynPart.i.length = 0; dynPart.n = 0; parts.forEach(p => { const a = Math.pow(p.life / p.max, 1.4); bb(dynPart, p.x, p.y, p.z, p.size * (.6 + a * .6), p.size * (.6 + a * .6), mul(p.col, a * 1.1)); }); upload(bPart, dynPart);

    /* ---- 悬浮图标 ---- */
    if (fr % 2 === 0) {
    dynIcons.v.length = 0; dynIcons.i.length = 0; dynIcons.n = 0;
    [...S.hotspots, S.portals[0]].forEach(hs => { const near = me ? Math.hypot(me.x - hs.x, me.z - hs.z) : 99, dE = Math.hypot((R.view ? R.view.eye[0] : camX) - hs.x, (R.view ? R.view.eye[2] : camZ + 20) - hs.z), sz = (.72 + (near < hs.r ? .12 + .05 * Math.sin(t * 6) : 0)) * Math.min(1, Math.max(.4, dE / 16)), cx = hs.x, cy = (hs.iy || 3) + Math.sin(t * 2.2 + hs.x) * .16, cz = hs.z;
      const col = (hs.icon % 4) * .25, row = Math.floor(hs.icon / 4) * .25, base = dynIcons.n, segs = 14, C = [0, 0, 0]; dynIcons.vert([cx, cy, cz], [0, 1, 0], col + .125, row + .125, C);
      for (let k = 0; k <= segs; k++) { const a = k / segs * TAU, ca = Math.cos(a), sa = Math.sin(a); dynIcons.vert([cx + ca * sz, cy + CU[1] * sa * sz, cz + CU[2] * sa * sz], [0, 1, 0], col + .125 + ca * .108, row + .125 - sa * .108, C); }
      for (let k = 0; k < segs; k++) dynIcons.i.push(base, base + 1 + k, base + 2 + k); });
    upload(bIcons, dynIcons); }
  }

  /* ---------- 第一视角（乘坐时）：接管 R.setCamera，不改 game.js ---------- */
  function fp_reset() { fp.sm = null; }
  const M4 = G.World.M4, fp = { on: true, k: 0, rig: null, sm: null, btn: null };
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  function computeRig(dt, t) {
    const r = st.ride; fp.k += ((r && fp.on ? 1 : 0) - fp.k) * (1 - Math.exp(-4.5 * dt)); if (Math.abs(fp.k - (r && fp.on ? 1 : 0)) < .002) fp.k = r && fp.on ? 1 : 0;
    if (fp.btn) fp.btn.style.display = r ? 'block' : 'none';
    if (!r) return; const p = ridePos(r, t); let eye, tgt, fov = 1.05;
    if (r.kind === 'ferris') { const a = .9 * Math.sin(t * .3), d = [Math.sin(a), 0, Math.cos(a)]; eye = [p[0] + d[0] * .35, p[1] + 1.8, p[2] + d[2] * .35]; tgt = [eye[0] + d[0] * 22, eye[1] - 2.6, eye[2] + d[2] * 22]; fov = 1.1; }
    else if (r.kind === 'carousel') { const a = st.car + r.horse * TAU / HORSES, tg = [-Math.sin(a), Math.cos(a)], ou = [Math.cos(a), Math.sin(a)], d = nrm([tg[0] * .8 + ou[0] * .6, 0, tg[1] * .8 + ou[1] * .6]); eye = [p[0] + tg[0] * .3, p[1] + 1.75, p[2] + tg[1] * .3]; tgt = [eye[0] + d[0] * 14, eye[1] - .9, eye[2] + d[2] * 14]; fov = 1.05; }
    else { const q = carPos(1), ah = CO.at(st.coS + 8); eye = [q[0], q[1] + 1.8, q[2]]; tgt = [ah[0], ah[1] + 1.4, ah[2]]; fov = 1.2; }
    if (!fp.sm) fp.sm = tgt.slice(); const kk = 1 - Math.exp(-7 * dt); for (let i = 0; i < 3; i++) fp.sm[i] += (tgt[i] - fp.sm[i]) * kk;
    fp.rig = { eye, tgt: fp.sm.slice(), fov };
  }
  { const proto = Object.getPrototypeOf(R), orig = proto.setCamera;
    R.setCamera = function (cam, w, h) {
      const g = window.__game; if (!fp.rig || fp.k <= 0 || (g && g.scene && g.scene !== S)) return orig.call(this, cam, w, h);
      const k = fp.k * fp.k * (3 - 2 * fp.k), ps = cam.pitch, e3 = [cam.target[0], cam.target[1] + cam.dist * Math.sin(ps), cam.target[2] + cam.dist * Math.cos(ps)], L = (a, b) => a + (b - a) * k;
      const eye = [L(e3[0], fp.rig.eye[0]), L(e3[1], fp.rig.eye[1]), L(e3[2], fp.rig.eye[2])], tg = [L(cam.target[0], fp.rig.tgt[0]), L(cam.target[1], fp.rig.tgt[1]), L(cam.target[2], fp.rig.tgt[2])];
      const V = M4.look(eye, tg, [0, 1, 0]), Pm = M4.persp(L(cam.fov, fp.rig.fov), w / h, L(1, .5), 260);
      this.view = { eye, V, P: Pm, VP: M4.mul(Pm, V), iVP: null, w, h, cam }; this.view.iVP = M4.inv(this.view.VP); return this.view; };
  }
  { const mkBtn = () => { if (fp.btn || !document.body) return; const b = document.createElement('button'); b.textContent = '👁 视角'; b.style.cssText = 'position:fixed;top:62px;left:50%;transform:translateX(-50%);display:none;z-index:30;padding:6px 14px;border-radius:14px;border:1px solid rgba(151,174,255,.45);background:rgba(15,12,36,.72);color:#fff;font:700 13px system-ui,sans-serif;touch-action:manipulation';
      const tog = (ev) => { ev.preventDefault(); ev.stopPropagation(); fp.on = !fp.on; host.toast(fp.on ? '👁 第一视角' : '🎥 第三视角', 1400); }; b.addEventListener('pointerdown', ev => ev.stopPropagation()); b.addEventListener('click', tog); document.body.appendChild(b); fp.btn = b; };
    if (document.body) mkBtn(); else addEventListener('DOMContentLoaded', mkBtn); }
  S.bounds = { x0: -70, x1: 70, z0: -42, z1: 48 };
  S.spawn = [0, 15];
  S.camera = { dist: st.baseDist, pitch: CP, fov: .95, clampX: [-40, 40], clampZ: [-14, 34], lead: 3 };
  S.cameraWide = { dist: 27, pitch: .16, fov: 1.1, clampX: [-40, 40], clampZ: [-14, 34], lead: 3 };      // 广角：压低镜头看远处天际线
  S.walkable = (x, z) => inside(x, z) && x > S.bounds.x0 && x < S.bounds.x1 && z > S.bounds.z0 && z < S.bounds.z1;
  S.npcRect = { x0: -52, x1: 52, z0: -12, z1: 32 };
  S.npcCount = 60;
  S.heightAt = (x, z) => (st.ride && Math.abs(x - st.rideX) < .1 && Math.abs(z - st.rideZ) < .1) ? st.rideY : 0;
  S.name = '星光嘉年华'; S.indoor = false;
  S.env = (h) => { const e = envFair(h); try { tick(h, e); } catch (err) { if (!S._err) { S._err = 1; console.error('[funfair tick]', err); } } return e; };
  return S;
}

G.Scenes = G.Scenes || {}; G.Scenes.makeFunfair = makeFunfair;
})(window);
