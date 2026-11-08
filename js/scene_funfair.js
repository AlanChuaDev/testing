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
const CX = 0, CZ = 4, RX = 66, RZ = 42, RZN = 56;
function rfun(x, z) { const dx = (x - CX) / RX, dz = (z - CZ) / (z < CZ ? RZN : RZ), a = Math.atan2(dz, dx); return Math.hypot(dx, dz) / (1 + .07 * Math.sin(3 * a + 1) + .04 * Math.sin(5 * a + 2)); }
const LAKE = { x: 36, z: -52, rx: 28, rz: 13 };
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
    { const ax = pts[i][0] - dz * w / 2, az = pts[i][1] + dx * w / 2, bx = pts[i][0] + dz * w / 2, bz = pts[i][1] - dx * w / 2; mb.vert([ax, y, az], [0, 1, 0], ax / uvS, az / uvS, col || [1, 1, 1]); mb.vert([bx, y, bz], [0, 1, 0], bx / uvS, bz / uvS, col || [1, 1, 1]); }
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




/* ---- v2 新增工具：旋转体 / 定向盒 / 变换拷贝 / 圆环 ---- */
function lathe(mb, cx, cz, prof, seg, col, uT, cy) {
  const base = mb.n, w = seg + 1; uT = uT || 1; cy = cy || 0;
  for (let j = 0; j < prof.length; j++) {
    const p = prof[j], a = prof[Math.max(0, j - 1)], b = prof[Math.min(prof.length - 1, j + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
    for (let k = 0; k <= seg; k++) {
      const an = k / seg * TAU, c = Math.cos(an), s = Math.sin(an);
      mb.vert([cx + c * p[0], cy + p[1], cz + s * p[0]], [dy / l * c, -dr / l, dy / l * s], k / seg * uT, p[2] == null ? j / (prof.length - 1) : p[2], col || [1, 1, 1]);
    }
  }
  for (let j = 0; j < prof.length - 1; j++) for (let k = 0; k < seg; k++) { const a = base + j * w + k; mb.i.push(a, a + 1, a + w, a + 1, a + w + 1, a + w); }
}
/* 定向盒：p + T*t + U*u + R*r（T,U,R 单位正交向量）；t0..t1 / u0..u1 / r0..r1 为三个方向的范围 */
function ob(mb, p, T, U, Rv, t0, t1, u0, u1, r0, r1, col) {
  const P = (t, u, r) => [p[0] + T[0] * t + U[0] * u + Rv[0] * r, p[1] + T[1] * t + U[1] * u + Rv[1] * r, p[2] + T[2] * t + U[2] * u + Rv[2] * r];
  const q = [0, 0, 1, 1], F = (a, b, c, d, n) => mb.quad(a, b, c, d, n, q, col);
  const nT = T, nU = U, nR = Rv, neg = v => [-v[0], -v[1], -v[2]];
  F(P(t1, u0, r0), P(t1, u0, r1), P(t1, u1, r1), P(t1, u1, r0), nT); F(P(t0, u0, r1), P(t0, u0, r0), P(t0, u1, r0), P(t0, u1, r1), neg(nT));
  F(P(t0, u1, r0), P(t1, u1, r0), P(t1, u1, r1), P(t0, u1, r1), nU); F(P(t0, u0, r1), P(t1, u0, r1), P(t1, u0, r0), P(t0, u0, r0), neg(nU));
  F(P(t0, u0, r1), P(t0, u1, r1), P(t1, u1, r1), P(t1, u0, r1), nR); F(P(t1, u0, r0), P(t1, u1, r0), P(t0, u1, r0), P(t0, u0, r0), neg(nR));
}
/* 把 src（局部网格）旋转 yaw/pitch/roll 缩放 sc 后平移到 (px,py,pz) 追加到 dst */
function xfAppend(dst, src, px, py, pz, yaw, pitch, roll, sc) {
  sc = sc == null ? 1 : sc; const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0), cr = Math.cos(roll || 0), sr = Math.sin(roll || 0), base = dst.n;
  const rot = (x, y, z) => { let a = x * cr - y * sr, b = x * sr + y * cr, c = z; let y2 = b * cp - c * sp, z2 = b * sp + c * cp; return [a * cy + z2 * sy, y2, -a * sy + z2 * cy]; };
  for (let k = 0; k < src.v.length; k += 11) { const p = rot(src.v[k] * sc, src.v[k + 1] * sc, src.v[k + 2] * sc), n = rot(src.v[k + 3], src.v[k + 4], src.v[k + 5]); dst.v.push(px + p[0], py + p[1], pz + p[2], n[0], n[1], n[2], src.v[k + 6], src.v[k + 7], src.v[k + 8], src.v[k + 9], src.v[k + 10]); dst.n++; }
  for (let i = 0; i < src.i.length; i++) dst.i.push(base + src.i[i]);
}
/* 圆环（管状）：轴向 'y'（平放）或 'z'（竖放，面朝 +z）*/
function ring3(mb, cx, cy, cz, R, r, col, axis, seg) { const pts = [], n = seg || 28; for (let i = 0; i <= n; i++) { const a = i / n * TAU; pts.push(axis === 'z' ? [cx + Math.cos(a) * R, cy + Math.sin(a) * R, cz] : [cx + Math.cos(a) * R, cy, cz + Math.sin(a) * R]); } tube(mb, pts, r, 4, col); }
/* 竖直半圆（门帘飘带 / 灯笼）*/
function fanZ(mb, cx, cy, cz, r, col, a0, a1, seg) { const c = mb.vert([cx, cy, cz], [0, 0, 1], .5, .5, col), b = mb.n; for (let k = 0; k <= seg; k++) { const a = a0 + (a1 - a0) * k / seg; mb.vert([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz], [0, 0, 1], .5 + Math.cos(a) * .5, .5 - Math.sin(a) * .5, col); } for (let k = 0; k < seg; k++) mb.i.push(c, b + k, b + k + 1); }
/* 样条（三维）：Catmull-Rom，闭合 */
function cromLoop3(pts, seg) { const n = pts.length, out = []; for (let i = 0; i < n; i++) { const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]; for (let k = 0; k < seg; k++) { const t = k / seg, t2 = t * t, t3 = t2 * t; out.push([0, 1, 2].map(c => .5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); } } return out; }

function shiftZ(mb, dz) { for (let k = 2; k < mb.v.length; k += 11) mb.v[k] += dz; }
function pdisc(mb, cx, cz, y, r, seg, tile) { const c = mb.vert([cx, y, cz], [0, 1, 0], cx / tile, cz / tile, [1, 1, 1]), b = mb.n; for (let k = 0; k <= seg; k++) { const a = k / seg * TAU, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; mb.vert([x, y, z], [0, 1, 0], x / tile, z / tile, [1, 1, 1]); } for (let k = 0; k < seg; k++) mb.i.push(c, b + k + 1, b + k); }
function nrm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function xfBasis(dst, src, p, T, U, sc) {
  sc = sc || 1; const X = nrm3([U[1] * T[2] - U[2] * T[1], U[2] * T[0] - U[0] * T[2], U[0] * T[1] - U[1] * T[0]]), base = dst.n;
  for (let k = 0; k < src.v.length; k += 11) { const x = src.v[k] * sc, y = src.v[k + 1] * sc, z = src.v[k + 2] * sc, nx = src.v[k + 3], ny = src.v[k + 4], nz = src.v[k + 5];
    dst.v.push(p[0] + X[0] * x + U[0] * y + T[0] * z, p[1] + X[1] * x + U[1] * y + T[1] * z, p[2] + X[2] * x + U[2] * y + T[2] * z, X[0] * nx + U[0] * ny + T[0] * nz, X[1] * nx + U[1] * ny + T[1] * nz, X[2] * nx + U[2] * ny + T[2] * nz, src.v[k + 6], src.v[k + 7], src.v[k + 8], src.v[k + 9], src.v[k + 10]); dst.n++; }
  for (let i = 0; i < src.i.length; i++) dst.i.push(base + src.i[i]);
}
function crom3(pts, seg) { const out = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; for (let k = 0; k < seg; k++) { const t = k / seg, t2 = t * t, t3 = t2 * t; out.push([0, 1, 2].map(c => .5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3))); } } out.push(pts[pts.length - 1]); return out; }

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
  /* ---- v2 新纹理 ---- */
  t.dino = R.paint(256, 256, (g, w, h) => { g.fillStyle = '#4f9a3c'; g.fillRect(0, 0, w, h); const r = rnd(12);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const x = i * 16 + (j % 2) * 8, y = j * 16, v = r(); g.fillStyle = `rgb(${(60 + v * 40) | 0},${(130 + v * 50) | 0},${(50 + v * 30) | 0})`; g.beginPath(); g.moveTo(x, y + 8); g.quadraticCurveTo(x + 8, y - 4, x + 16, y + 8); g.quadraticCurveTo(x + 8, y + 20, x, y + 8); g.fill(); g.strokeStyle = 'rgba(20,60,20,.5)'; g.lineWidth = 1.2; g.stroke(); }
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,150,40,.55)'; g.beginPath(); g.ellipse(r() * w, r() * h, 7 + r() * 8, 4 + r() * 5, r() * 3, 0, TAU); g.fill(); }
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(20,50,20,.35)'; g.fillRect(x, 0, 14, h); } });
  t.rock = R.paint(256, 256, (g, w, h) => { g.fillStyle = '#3a2a26'; g.fillRect(0, 0, w, h); const r = rnd(5); for (let i = 0; i < 700; i++) { const v = 40 + (r() * 40 | 0); g.fillStyle = `rgba(${v + 20},${v},${v - 6},.55)`; g.fillRect(r() * w, r() * h, 3 + r() * 9, 2 + r() * 6); }
    g.strokeStyle = '#ff7a1a'; g.lineWidth = 3; for (let k = 0; k < 10; k++) { g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (r() - .5) * 40; y += h / 8; g.lineTo(x, y); } g.stroke(); } });
  t.rockE = R.paint(256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = rnd(5); for (let i = 0; i < 700; i++) r(); g.strokeStyle = '#ff7a1a'; g.lineWidth = 3; for (let k = 0; k < 10; k++) { g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (r() - .5) * 40; y += h / 8; g.lineTo(x, y); } g.stroke(); } });
  t.bone = R.paint(64, 64, (g, w, h) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h); const r = rnd(2); for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(120,100,70,.18)'; g.fillRect(r() * w, r() * h, 2, 6); } });
  t.talisman = R.paint(64, 160, (g, w, h) => { g.fillStyle = '#f2d24a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c0141c'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#c0141c'; g.font = 'bold 30px serif'; g.textAlign = 'center'; ['敕', '令', '镇', '邪'].forEach((c, i) => g.fillText(c, w / 2, 36 + i * 32)); }, { clamp: true });
  t.coffin = R.paint(64, 128, (g, w, h) => { g.fillStyle = '#4a2a1a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.moveTo(0, i * 9); g.lineTo(w, i * 9 + 2); g.stroke(); } g.fillStyle = '#e8c860'; g.font = 'bold 40px serif'; g.textAlign = 'center'; g.fillText('奠', w / 2, 64); });
  t.web = R.paint(128, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 1.4; for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 180, Math.sin(a) * 180); g.stroke(); } for (let r2 = 14; r2 < 128; r2 += 16) { g.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * PI * .5; const rr2 = r2 * (k % 2 ? .9 : 1); g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.stroke(); } }, { clamp: true });
  t.camLens = R.paint(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, '#9ad8ff'); gr.addColorStop(.25, '#2a4a9a'); gr.addColorStop(.5, '#10163a'); gr.addColorStop(.7, '#c8c8d8'); gr.addColorStop(.78, '#3a3a50'); gr.addColorStop(1, '#8a8aa0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(46, 44, 10, 6, -.6, 0, TAU); g.fill(); }, { clamp: true });
  t.dartboard = R.paint(128, 128, (g, w, h) => { const cols = ['#ff4a5a', '#fff', '#ff4a5a', '#fff', '#ffd93d']; for (let i = 0; i < 5; i++) { g.fillStyle = cols[i]; g.beginPath(); g.arc(64, 64, 62 - i * 12, 0, TAU); g.fill(); } g.fillStyle = '#ff2a3a'; g.beginPath(); g.arc(64, 64, 6, 0, TAU); g.fill(); }, { clamp: true });
  t.waffle = R.paint(64, 64, (g, w, h) => { g.fillStyle = '#e8b56a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b8803a'; g.lineWidth = 3; for (let k = -64; k < 128; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke(); g.beginPath(); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke(); } });
  t.gold = R.paint(32, 32, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(.45, '#e8b838'); gr.addColorStop(1, '#a8761a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, {});
  t.mirror = R.paint(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#fff'); gr.addColorStop(.5, '#b8d8f8'); gr.addColorStop(1, '#f0e0ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8b838'; g.lineWidth = 6; g.strokeRect(0, 0, w, h); }, {});
  /* 鬼屋立面：阴森石墙 + 歪斜发光窗 + 张口怪物门（牙齿）+ 符纸 + 血渍；em = 夜间发光（绿 / 橙 / 红）*/
  const hauntF = (em) => R.paint(1024, 512, (g, w, h) => {
    g.fillStyle = em ? '#000' : '#2a2433'; g.fillRect(0, 0, w, h); const r = rnd(18);
    if (!em) { for (let y = 0; y < h; y += 28) for (let x = (y / 28 % 2) * 30; x < w; x += 60) { g.fillStyle = `rgba(${(r() * 30) | 0},${(r() * 25) | 0},${(r() * 40) | 0},.4)`; g.fillRect(x, y, 58, 26); g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeRect(x, y, 58, 26); }
      for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.beginPath(); let x = r() * w, y = r() * 120; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - .5) * 50; y += 40 + r() * 30; g.lineTo(x, y); } g.stroke(); } }
    const win = (x, y, ww, hh, col, tilt) => { g.save(); g.translate(x + ww / 2, y + hh / 2); g.rotate(tilt); g.translate(-ww / 2, -hh / 2); g.fillStyle = em ? col : '#100b18'; g.beginPath(); g.moveTo(0, hh); g.lineTo(0, hh * .3); g.quadraticCurveTo(ww / 2, -hh * .25, ww, hh * .3); g.lineTo(ww, hh); g.closePath(); g.fill(); if (!em) { g.strokeStyle = '#5a4a6a'; g.lineWidth = 5; g.stroke(); g.fillStyle = '#4a3a5a'; g.fillRect(ww / 2 - 3, 0, 6, hh); g.fillRect(0, hh * .55, ww, 6); g.strokeStyle = '#6a5a3a'; g.lineWidth = 7; g.beginPath(); g.moveTo(-6, hh * .2); g.lineTo(ww + 6, hh * .75); g.moveTo(-6, hh * .7); g.lineTo(ww + 6, hh * .3); g.stroke(); } g.restore(); };
    win(80, 60, 100, 150, '#9dff7a', -.06); win(260, 70, 90, 140, '#ffb03a', .05); win(670, 70, 90, 140, '#ffb03a', -.05); win(850, 60, 100, 150, '#9dff7a', .06);
    win(90, 300, 90, 130, '#ff6ad0', .04); win(850, 300, 90, 130, '#ff6ad0', -.04);
    /* 怪物门（张开的大嘴）*/
    const cx = 512; g.fillStyle = em ? '#000' : '#14080e'; g.beginPath(); g.moveTo(cx - 130, h); g.lineTo(cx - 130, 300); g.quadraticCurveTo(cx - 140, 170, cx, 150); g.quadraticCurveTo(cx + 140, 170, cx + 130, 300); g.lineTo(cx + 130, h); g.closePath(); g.fill();
    if (em) { const gr = g.createRadialGradient(cx, 380, 8, cx, 380, 150); gr.addColorStop(0, '#ff3a2a'); gr.addColorStop(1, 'rgba(255,40,20,0)'); g.fillStyle = gr; g.fillRect(cx - 150, 180, 300, 332); }
    g.fillStyle = em ? '#fff2d0' : '#e8e2cc'; for (let k = 0; k < 8; k++) { const x = cx - 112 + k * 32; g.beginPath(); g.moveTo(x, 190 + Math.abs(k - 3.5) * 8); g.lineTo(x + 16, 250 + (k % 2) * 22 + 20 - Math.abs(k - 3.5) * 4); g.lineTo(x + 32, 190 + Math.abs(k - 3.5) * 8); g.fill(); }
    for (let k = 0; k < 7; k++) { const x = cx - 96 + k * 32; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h - 56 - (k % 2) * 20); g.lineTo(x + 32, h); g.fill(); }
    g.fillStyle = em ? '#ff2a2a' : '#7a0a10'; [[cx - 70, 120], [cx + 70, 120]].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y, 34, 20, 0, 0, TAU); g.fill(); g.fillStyle = em ? '#000' : '#000'; g.beginPath(); g.ellipse(x, y, 7, 18, 0, 0, TAU); g.fill(); g.fillStyle = em ? '#ff2a2a' : '#7a0a10'; });
    if (!em) { g.fillStyle = '#9a0c14'; for (let i = 0; i < 26; i++) { const x = r() * w, hh = 20 + r() * 70; g.fillRect(x, 0, 6, hh); g.beginPath(); g.arc(x + 3, hh, 6, 0, TAU); g.fill(); } }
    if (!em) { g.fillStyle = '#e8d048'; [[330, 230], [350, 400], [690, 240], [670, 410]].forEach(([x, y], i) => { g.save(); g.translate(x, y); g.rotate((i - 1.5) * .12); g.fillRect(-14, -40, 28, 80); g.fillStyle = '#c0141c'; g.fillRect(-9, -32, 18, 4); g.fillRect(-9, -16, 18, 4); g.fillRect(-9, 0, 18, 4); g.fillRect(-9, 16, 18, 4); g.fillStyle = '#e8d048'; g.restore(); }); }
  }, { clamp: true });
  t.hauntF = hauntF(false); t.hauntFE = hauntF(true);
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
  const BALC = [[1, .35, .45], [.35, .7, 1], [1, .85, .25], [.6, .5, 1], [.4, .9, .6], [1, .6, .3]];
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
  { const xs = axis(-80, 80, 1.6, -320, 320), zs = axis(-78, 62, 1.6, -320, 160), W = xs.length, mb = new MB();
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
    /* 动态几何：复用类型数组（少产生垃圾回收），整块重传 */
    const gl = R.gl; gl.bindVertexArray(b.vao);
    const nv = mb.v.length, ni = mb.i.length;
    if (!b.fv || b.fv.length < nv) { b.fv = new Float32Array(Math.max(1024, Math.ceil(nv * 1.5))); b.vcap = 0; }
    if (!b.fi || b.fi.length < ni) { b.fi = new Uint32Array(Math.max(1024, Math.ceil(ni * 1.5))); b.icap = 0; }
    for (let k = 0; k < nv; k++) b.fv[k] = mb.v[k]; for (let k = 0; k < ni; k++) b.fi[k] = mb.i[k];
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.bufferData(gl.ARRAY_BUFFER, b.fv.subarray(0, nv), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, b.fi.subarray(0, ni), gl.DYNAMIC_DRAW);
    b.count = ni; gl.bindVertexArray(null);
  }

  /* ---------- 道路与广场（彩砖） ---------- */
  { const mb = new MB();
    pdisc(mb, FOUNT.x, FOUNT.z, .02, 13, 56, 4);                                                  // 喷泉广场
    pdisc(mb, CAR.x, CAR.z, .02, 8.5, 40, 4); pdisc(mb, WHEEL.x, WHEEL.z + 3, .02, 9, 40, 4); pdisc(mb, COAST.cx, 2, .02, 8, 40, 4);
    let pathN = 0; const path = (pts, w, tag) => { const dense = crom(pts, 8); PATHDEF.push(Object.assign({ pts: dense, w }, tag || {})); ribbon(mb, dense, w, .024 + .0007 * (pathN++), 4); };
    path([[-56, 25.7], [-30, 25.7], [0, 25.7], [30, 25.7], [58, 25.7]], 10.6, { street: 1 });               // 摊位街（东西向主街）
    path([[0, 8], [0, 18], [0, 25.7]], 7);                                                                  // 喷泉 → 摊位街
    path([[0, 8], [-8, -2], [-16, -12]], 6.5); path([[0, 8], [3, -2], [6, -8]], 6);                       // → 摩天轮 / 旋转木马
    path([[0, 8], [14, 6], [30, 3]], 6.5);                                                                // → 过山车
    path([[0, 8], [-18, 10], [-33, 5], [-40, -2.5]], 6.5); pdisc(mb, -40, -4.8, .02, 5.2, 32, 4);                                                             // → 鬼屋
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
    const fb = new MB(), fl = new MB(), r = rnd(3); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .26; if ([-101, -40, 41, 132, 202].some(bd => Math.abs(((a * 57.296 - bd + 540) % 360) - 180) > 168)) continue; const bx = x + Math.cos(a) * 9.4, bz = z + Math.sin(a) * 9.4; fb.cyl(bx, bz, 0, .5, 1.1, 1.0, 10, [.9, .85, .8], true); for (let q = 0; q < 7; q++) { const aa = r() * TAU, rr = r() * .8; fl.sphere(bx + Math.cos(aa) * rr, .62 + r() * .1, bz + Math.sin(aa) * rr, .18, .16, .18, PAL[(r() * PAL.length) | 0], 4); } obsC(bx, bz, 1.05); }
    add(fb, {}); add(fl, {}); }

  /* ---------- 摊位工厂（门面朝 +z 也就是朝镜头） ---------- */
  const HS = [], strGlow = new MB(); let awnings = {}, wood = new MB(), signs = [], strLights = new MB(), grpN = null;
  function flushGroup() { if (grpN == null) return; add(wood, {}); Object.values(awnings).forEach(a => add(a.mb, a.em ? { tex: a.tex, em: a.em, emDay: a.emDay, emNight: a.emNight } : { tex: a.tex })); signs.forEach(s => add(s.mb, { tex: s.tex, em: s.em, emDay: .45, emNight: 1.3 })); add(strLights, emS('#ffffff', .6, 2.2)); add(glowL, emS('#ffe9b0', .7, 2.4)); occ1(grpN); grpN = null; }
  let glowL = new MB();
  function newGroup() { flushGroup(); awnings = {}; wood = new MB(); signs = []; strLights = new MB(); glowL = new MB(); grpN = occ0(); }
  function awn(name, c1, c2) { return awnings[name] || (awnings[name] = { mb: new MB(), tex: X.stripe(c1, c2) }); }
  function texm(name, tex, em, d, n) { return awnings[name] || (awnings[name] = { mb: new MB(), tex, em, emDay: d, emNight: n }); }
  function booth(x, z, w, o) {
    newGroup(); const d = 2.8, col = o.col || [.9, .55, .6], aw = awn(o.awn[0], o.awn[1], o.awn[2]), cA = PAL[o.pi || 0], cream = [1, .96, .9], gold = [.98, .8, .3];
    /* 柜台：木板立面 + 金边 + 台面外挑 */
    wood.box(x - w / 2, 0, z - .1, x + w / 2, 1.05, z + .55, col); const nb = Math.round(w / .9); for (let i = 0; i <= nb; i++) { const bx = x - w / 2 + i * w / nb; wood.box(bx - .05, .08, z + .55, bx + .05, .98, z + .6, cream); }
    wood.box(x - w / 2 - .1, 1.05, z - .15, x + w / 2 + .1, 1.16, z + .65, cream); wood.box(x - w / 2 - .12, .0, z + .5, x + w / 2 + .12, .1, z + .7, gold); wood.box(x - w / 2 - .12, .93, z + .5, x + w / 2 + .12, 1.03, z + .7, gold);
    for (let i = 0; i < nb; i++) { const bx = x - w / 2 + (i + .5) * w / nb; wood.sphere(bx, .52, z + .62, .2, .2, .04, i % 2 ? cA : [1, 1, 1], 5); }
    wood.box(x - w / 2 + .15, 0, z - d, x + w / 2 - .15, 3.4, z - d + .2, mul(col, .85)); wood.box(x - w / 2 - .02, 0, z - d, x - w / 2 + .15, 3.4, z + .1, mul(col, .9)); wood.box(x + w / 2 - .15, 0, z - d, x + w / 2 + .02, 3.4, z + .1, mul(col, .9));
    for (let i = 1; i < 4; i++) wood.box(x - w / 2 + .15, i * .8, z - d + .2, x + w / 2 - .15, i * .8 + .05, z - d + .25, mul(col, .7));
    /* 四角：糖果柱 */
    [[x - w / 2 - .05, z + .55], [x + w / 2 + .05, z + .55], [x - w / 2 - .05, z - d + .1], [x + w / 2 + .05, z - d + .1]].forEach(([px, pz], k) => { for (let q = 0; q < 9; q++) wood.cyl(px, pz, q * .34, q * .34 + .34, .15, .15, 8, q % 2 ? [1, 1, 1] : cA); wood.sphere(px, 3.15, pz, .22, .22, .22, gold, 6); });
    /* 顶棚：条纹斜面 + 扇贝垂边 + 脊线 + 灯笼 */
    aw.mb.quad([x - w / 2 - .2, 3.0, z + 1.4], [x + w / 2 + .2, 3.0, z + 1.4], [x + w / 2 + .2, 3.7, z - d], [x - w / 2 - .2, 3.7, z - d], [0, .9, .4], [0, 0, w / 1.2, 1], [1, 1, 1]);
    const n = Math.max(6, Math.round(w / .5)), sw = (w + .4) / n; for (let i = 0; i < n; i++) { const cx = x - w / 2 - .2 + (i + .5) * sw; fanZ(wood, cx, 3.0, z + 1.43, sw * .52, i % 2 ? [1, 1, 1] : cA, PI, TAU, 8); }
    wood.box(x - w / 2 - .25, 3.6, z - d - .05, x + w / 2 + .25, 3.82, z - d + .2, gold); wood.box(x - w / 2 - .22, 2.95, z + 1.36, x + w / 2 + .22, 3.04, z + 1.5, gold);
    for (let i = 0; i <= n; i++) { const bx = x - w / 2 - .2 + i * sw; strLights.sphere(bx, 2.62, z + 1.58, .09, .09, .09, [1, 1, 1], 4); bb(strGlow, bx, 2.62, z + 1.58, .8, .8, PAL[(i + (o.pi || 0)) % PAL.length]); }
    [-1, 1].forEach(s => { const lx = x + s * (w / 2 - .25), lz = z + 1.2; tube(wood, [[lx, 3.0, lz], [lx, 2.55, lz]], .015, 3, [.5, .4, .2]); wood.sphere(lx, 2.35, lz, .2, .26, .2, [1, .45, .35], 6); glowL.sphere(lx, 2.35, lz, .17, .22, .17, [1, .85, .5], 6); bb(strGlow, lx, 2.35, lz, 1.2, 1.2, [1, .6, .3]); });
    /* 两侧花箱 */
    const fr = rnd((x * 7 + z) | 0); [-1, 1].forEach(s => { const fx = x + s * (w / 2 + .55); wood.box(fx - .35, 0, z + .25, fx + .35, .55, z + .95, [.95, .9, .8]); wood.box(fx - .38, .5, z + .22, fx + .38, .6, z + .98, gold); for (let q = 0; q < 8; q++) wood.sphere(fx + (fr() - .5) * .6, .68 + fr() * .18, z + .6 + (fr() - .5) * .5, .13, .13, .13, PAL[(fr() * PAL.length) | 0], 4); });
    /* 招牌：加金边 + 皇冠球 */
    const sg = T.sign(o.text, { w: 1024, h: 200, fs: o.fs || 100, bg: o.bg || '#2a1038', fg: o.fg || '#ffe9a8', border: o.bd || '#ff6fae' }), sb = new MB();
    sb.box(x - w / 2 + .2, 3.82, z - d + .22, x + w / 2 - .2, 5.1, z - d + .3, [1, 1, 1], [w - .4, 1.3], { noBack: true, noSides: true, noTop: true });
    wood.box(x - w / 2 + .1, 3.82, z - d + .2, x - w / 2 + .22, 5.2, z - d + .34, gold); wood.box(x + w / 2 - .22, 3.82, z - d + .2, x + w / 2 - .1, 5.2, z - d + .34, gold); wood.box(x - w / 2 + .1, 5.1, z - d + .2, x + w / 2 - .1, 5.22, z - d + .34, gold); wood.box(x - w / 2 + .1, 3.82, z - d + .2, x + w / 2 - .1, 3.94, z - d + .34, gold);
    [x - w / 2 + .16, x + w / 2 - .16].forEach(sx => wood.sphere(sx, 5.38, z - d + .27, .22, .22, .22, cA, 6)); wood.sphere(x, 5.4, z - d + .27, .26, .26, .26, gold, 6);
    signs.push({ mb: sb, tex: sg.tex, em: sg.em }); obs(x - w / 2 - .15, z - d - .1, x + w / 2 + .15, z + .7);
    return { x, z: z + 3.7 };
  }
  /* ---- 主题巨型装饰（站在招牌上方：参考图那种“把店做成一个巨大的东西”）---- */
  const topRing = (x, z) => { const zz = z - 1.9; wood.cyl(x, zz, 5.2, 9.2, .14, .1, 6, [.9, .9, .95]); for (let i = 0; i < 6; i++) ring3(wood, x, 5.7 + i * .6, zz, 1.75 - i * .22, .21, PAL[i % 6], 'y', 26); wood.sphere(x, 9.5, zz, .38, .38, .38, gold0, 6); [-1, 1].forEach(s => { for (let k = 0; k < 3; k++) wood.sphere(x + s * (2.8 + k * .55), 5.55 + k * .35, zz, .3, .3, .3, PAL[(k + 2) % 6], 5); }); };
  const topBalloon = (x, z) => { const zz = z - 1.9, cs = [[0, 8.2, 0], [-.9, 7.4, .3], [.9, 7.5, -.2], [-.4, 6.8, -.6], [.5, 6.9, .5], [-1.5, 6.7, -.1], [1.5, 6.8, .2]]; cs.forEach(([dx, dy, dz], i) => { wood.sphere(x + dx, dy, zz + dz, .66, .8, .66, BALC[i % 6], 7); tube(wood, [[x + dx, dy - .8, zz + dz], [x, 5.3, zz]], .012, 3, [.9, .9, .9]); wood.cyl(x + dx, zz + dz, dy - .88, dy - .78, .08, .12, 5, BALC[i % 6]); });
    const bx = x + 3.9, by = 6.5; [[1.35, [1, .3, .35]], [1.0, [1, 1, 1]], [.68, [1, .3, .35]], [.38, [1, .85, .3]]].forEach(([r, c], i) => { const f = awn('dart', '#ff4a5a', '#ffffff'); fanZ(wood, bx, by, zz + .1 + i * .03, r, c, 0, TAU, 20); }); wood.cyl(bx, zz + .12, 3.6, by - 1.35, .1, .1, 5, [.5, .35, .2]); };
  const topStrong = (x, z) => { const zz = z - 1.9; wood.cyl(x - .6, zz, 5.2, 8.2, .22, .2, 8, [.7, .45, .22]); wood.box(x - 2.3, 7.7, zz - .85, x + 1.1, 9.1, zz + .85, [.9, .25, .3]); [x - 2.3, x + 1.1].forEach(ex => wood.box(ex - .12, 7.6, zz - .92, ex + .12, 9.2, zz + .92, [1, .85, .3])); wood.box(x - 1.0, 7.68, zz - .9, x - .7, 9.12, zz + .9, [1, .85, .3]); wood.sphere(x - .6, 8.4, zz + .9, .25, .25, .08, [1, .9, .5], 5);
    for (let i = 0; i < 5; i++) { wood.sphere(x + 2.2 + i * .0, 5.6 + i * .8, zz, .32, .32, .32, i < 3 ? [.4, 1, .5] : i < 4 ? [1, .85, .3] : [1, .3, .3], 6); } };
  const topCamera = (x, z) => { const zz = z - .3; wood.box(x - 1.6, 5.2, zz - .6, x + 1.6, 6.2, zz + .6, [.25, .25, .35]); wood.box(x - 1.72, 6.2, zz - .72, x + 1.72, 7.0, zz + .72, [.9, .9, .95]); wood.box(x - 1.0, 7.0, zz - .4, x - .2, 7.45, zz + .4, [.9, .9, .95]); wood.sphere(x + 1.0, 7.3, zz + .5, .2, .2, .1, [1, .95, .6], 5);
    ring3(wood, x, 6.15, zz + .95, .92, .14, [.7, .7, .78], 'z', 24); wood.cyl(x, zz + .72, 5.25, 5.25, 0, 0, 3, [1, 1, 1]); const lz = texm('lens', X.camLens, X.camLens, .3, .9); lz.mb.quad([x - .76, 5.4, zz + 1.0], [x + .76, 5.4, zz + 1.0], [x + .76, 6.9, zz + 1.0], [x - .76, 6.9, zz + 1.0], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); [-1, 1].forEach(s => wood.sphere(x + s * 1.25, 5.6, zz + .7, .1, .1, .06, [1, .3, .4], 4)); };
  const topCandy = (x, z) => { const zz = z - .9, wf = texm('waffle', X.waffle); wf.mb.cyl(x, zz, 5.1, 7.0, .08, .95, 12, [1, 1, 1]); [[0, 7.6, 0, 1.25, 1.1], [-.9, 7.3, .2, .9, .8], [.9, 7.4, -.1, .95, .85], [.1, 8.5, 0, .85, .8], [-.4, 8.0, .6, .7, .6]].forEach(([dx, dy, dz, rx, ry], i) => wood.sphere(x + dx, dy, zz + dz, rx, ry, rx, i % 2 ? [1, .72, .86] : [.82, .85, 1], 7)); for (let i = 0; i < 14; i++) { const a = i * 2.4; wood.sphere(x + Math.cos(a) * 1.3, 7.3 + (i % 5) * .3, zz + Math.sin(a) * .9 + .5, .07, .07, .07, PAL[i % 6], 3); } };
  const topPopcorn = (x, z) => { const zz = z - .9, bk = awn('pcB', '#e8352e', '#ffffff'); bk.mb.cyl(x, zz, 5.1, 7.2, .95, 1.45, 14, [1, 1, 1]); wood.cyl(x, zz, 7.15, 7.25, 1.5, 1.5, 14, [.98, .98, .95]); const r = rnd(31); for (let i = 0; i < 46; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * 1.3; wood.sphere(x + Math.cos(a) * rr, 7.4 + (1 - rr / 1.3) * .9 + r() * .3, zz + Math.sin(a) * rr, .27, .24, .27, [1, .96 - r() * .1, .8 - r() * .2], 4); } };
  const gold0 = [.98, .8, .3];
  { const r = rnd(41);
    // 1 套圈
    let p = booth(-38, MIDZ, 7.2, { text: '套圈 RING TOSS', col: [.85, .45, .55], awn: ['rt', '#ff5a7a', '#ffffff'], pi: 0, bg: '#3a0f26', bd: '#ff6f9a' });
    for (let i = 0; i < 7; i++) { const bx = -38 - 2.1 + i * .7; wood.cyl(bx, MIDZ - 1.2, 1.16, 1.75, .13, .1, 8, PAL[i % PAL.length]); wood.cyl(bx, MIDZ - 1.2, 1.75, 1.95, .05, .05, 6, [.9, .9, .95]); }
    for (let i = 0; i < 9; i++) wood.sphere(-38 - 3.0 + i * .75, 2.2 + (i % 2) * .5, MIDZ - 2.35, .3, .3, .3, PAL[(i + 2) % PAL.length], 5);
    topRing(-38, MIDZ);
    HS.push({ id: 'ring', x: p.x, z: p.z, r: 2.0, label: '套圈', color: [1, .5, .65], icon: 3, btn: '套圈', iy: 6.0, bx: -38, bz: MIDZ });
    // 2 打气球
    p = booth(-26, MIDZ, 7.2, { text: '射气球 BALLOON', col: [.35, .7, .9], awn: ['bd', '#2aa6e8', '#ffffff'], pi: 1, bg: '#0c2a4a', bd: '#52d0ff' });
    wood.box(-26 - 3.4, 1.16, MIDZ - 2.45, -26 + 3.4, 3.3, MIDZ - 2.42, [.98, .93, .8]);
    topBalloon(-26, MIDZ);
    HS.push({ id: 'balloon', x: p.x, z: p.z, r: 2.0, label: '射气球', color: [.4, .85, 1], icon: 4, btn: '射飞镖', iy: 6.0, bx: -26, bz: MIDZ });
    // 3 大力锤（带高塔）
    p = booth(-14, MIDZ, 7.2, { text: '大力锤 STRONGMAN', fs: 88, col: [.95, .75, .3], awn: ['sm', '#ffb21a', '#ffffff'], pi: 2, bg: '#3a2606', bd: '#ffd93d' });
    { const tx = -14 + 5.4, tz = MIDZ - 1.2; wood.box(tx - .9, 0, tz - .9, tx + .9, .5, tz + .9, [.45, .3, .5]); for (let q = 0; q < 14; q++) wood.box(tx - .28, .5 + q * .55, tz - .28, tx + .28, Math.min(8.2, .5 + (q + 1) * .55), tz + .28, q % 2 ? [1, .55, .65] : [.98, .95, .88]); wood.box(tx - .45, 8.2, tz - .45, tx + .45, 8.5, tz + .45, [.95, .3, .4]); wood.sphere(tx, 8.9, tz, .45, .4, .45, [1, .82, .2], 6); obs(tx - 1, tz - 1, tx + 1, tz + 1);
      wood.box(tx - .6, .5, tz + .26, tx + .6, 8.18, tz + .34, [.16, .14, .26]); for (let i = 0; i < 15; i++) { wood.box(tx - .58, .88 + i * .5, tz + .34, tx - .38, .92 + i * .5, tz + .37, [.95, .95, 1]); wood.box(tx + .38, .88 + i * .5, tz + .34, tx + .58, .92 + i * .5, tz + .37, [.95, .95, 1]); } S.strong = { x: tx, z: tz }; }
    topStrong(-14, MIDZ);
    HS.push({ id: 'strong', x: -14, z: MIDZ + 3.7, r: 2.0, label: '大力锤', color: [1, .85, .3], icon: 5, btn: '挥锤', iy: 6.0, bx: -14, bz: MIDZ });
    // 5 大头贴
    { newGroup(); const x = 22, z = MIDZ; wood.box(x - 1.5, 0, z - 2.4, x + 1.5, 3.6, z + .4, [.3, .3, .5]); wood.box(x - 1.2, 0, z + .38, x + 1.2, 2.5, z + .44, [.8, .1, .3]); wood.box(x - 1.6, 3.6, z - 2.5, x + 1.6, 3.9, z + .5, [.98, .5, .6]); obs(x - 1.7, z - 2.5, x + 1.7, z + .5);
      const sg = T.sign('大头贴 PHOTO', { w: 512, h: 130, fs: 62, bg: '#2a1b4a', fg: '#fff0fa', border: '#b48cff' }), sb = new MB(); sb.box(x - 1.5, 4.0, z + .1, x + 1.5, 4.9, z + .16, [1, 1, 1], [3, .9], { noBack: true, noSides: true, noTop: true }); signs.push({ mb: sb, tex: sg.tex, em: sg.em });
      topCamera(x, z);
      HS.push({ id: 'photo', x, z: z + 3.4, r: 2.0, label: '大头贴', color: [.7, .5, 1], icon: 7, btn: '拍大头贴', iy: 9.2 }); }
    // 6 棉花糖
    p = booth(34, MIDZ, 6.4, { text: '棉花糖 CANDY', col: [.98, .7, .85], awn: ['cc', '#ff7ab6', '#ffffff'], pi: 0, bg: '#3a1030', bd: '#ff9ad5' });
    for (let i = 0; i < 5; i++) { wood.cyl(34 - 2.0 + i * 1.0, MIDZ - .9, 1.16, 1.9, .03, .03, 4, [.9, .9, .9]); wood.sphere(34 - 2.0 + i * 1.0, 2.1, MIDZ - .9, .42, .4, .42, [[1, .7, .85], [.7, .85, 1], [.85, .75, 1], [1, .85, .6], [.7, 1, .85]][i], 6); }
    topCandy(34, MIDZ);
    HS.push({ id: 'candy', x: p.x, z: p.z, r: 2.0, label: '棉花糖', color: [1, .6, .85], icon: 8, btn: '买棉花糖', iy: 6.0 });
    // 7 爆米花
    p = booth(46, MIDZ, 6.0, { text: '爆米花 POPCORN', col: [.95, .35, .3], awn: ['pc', '#e8352e', '#ffffff'], pi: 5, bg: '#3a0a08', bd: '#ffb03a' });
    wood.box(46 - 1.2, 1.16, MIDZ - 1.5, 46 + 1.2, 1.5, MIDZ - .3, [.9, .9, .95]); wood.box(46 - 1.1, 1.5, MIDZ - 1.4, 46 + 1.1, 2.7, MIDZ - .4, [1, .95, .85]); for (let i = 0; i < 40; i++) wood.sphere(46 - 1.0 + r() * 2, 1.9 + r() * .8, MIDZ - 1.3 + r() * .8, .13, .12, .13, [1, .96, .8 - r() * .15], 3);
    topPopcorn(46, MIDZ);
    HS.push({ id: 'popcorn', x: p.x, z: p.z, r: 2.0, label: '爆米花', color: [1, .8, .35], icon: 9, btn: '买爆米花', iy: 6.0 });
    // 4 占卜帐篷（六边形）
    { newGroup(); const x = 15.5, z = MIDZ - 3.0, tent = awn('ft', '#7a3cff', '#ffcf5a'); tent.mb.cyl(x, z, 0, 2.7, 3.1, 3.1, 6, [1, 1, 1]); tent.mb.cyl(x, z, 2.7, 5.4, 3.5, .15, 6, [1, 1, 1]); wood.sphere(x, 5.7, z, .3, .3, .3, [1, .85, .3], 5);
      wood.box(x - 1.0, 0, z + 2.55, x + 1.0, 2.3, z + 2.75, [.1, .04, .16]); wood.box(x - .6, 0, z + 2.74, x + .6, 2.0, z + 2.78, [.35, .1, .5]);
      wood.cyl(x, z + 3.7, 0, .85, .45, .4, 8, [.4, .2, .5], true); wood.sphere(x, 1.3, z + 3.7, .38, .38, .38, [.7, .9, 1], 8); S.crystal = [x, 1.3, z + 3.7];
      obsC(x, z, 3.2); obsC(x, z + 3.7, .55);
      const sg = T.sign('占卜 FORTUNE', { w: 512, h: 120, fs: 64, bg: '#1a0838', fg: '#ffe6a8', border: '#b48cff' }), sb = new MB(); sb.box(x - 1.6, 3.0, z + 2.8, x + 1.6, 3.9, z + 2.86, [1, 1, 1], [3.2, .9], { noBack: true, noSides: true, noTop: true }); signs.push({ mb: sb, tex: sg.tex, em: sg.em });
      HS.push({ id: 'fortune', x, z: z + 6.7, r: 2.0, label: '占卜', color: [.7, .5, 1], icon: 6, btn: '占卜', iy: 6.4 }); }
    flushGroup(); add(strGlow, { tex: T.glow, mode: 2, glow: e => .1 + night(e) * .8 }); }

  /* ---------- 鬼屋（万圣节 × 中式僵尸 × 吸血鬼 × 丧尸）---------- */
  const HAUNT = { x: -40, z: -8 };
  { const n0 = occ0(), x0 = HAUNT.x, z0 = HAUNT.z, w = 15, mb = new MB(), rf = new MB(), rd = new MB(), st2 = new MB(), iron = new MB(), bone = new MB(), pk = new MB(), pkE = new MB(), face = new MB(), tal = new MB(), cof = new MB(), web = new MB(), lan = new MB(), lanE = new MB(), eyeE = new MB(), gold = new MB(), r = rnd(66), stone = [.5, .47, .58];
    /* 主体 + 立面 */
    mb.box(x0 - w / 2, 0, z0 - 10, x0 + w / 2, 8, z0, [1, 1, 1], [15, 8], { noTop: true, noFront: true });
    const fm = new MB(); fm.box(x0 - w / 2, 0, z0 - 10, x0 + w / 2, 8, z0, [1, 1, 1], [15, 8], { noTop: true, noBack: true, noSides: true }); add(fm, { tex: X.hauntF, em: X.hauntFE, emDay: .3, emNight: 1.4 }); add(mb, { tex: X.haunt.tex });
    /* 屋顶：陡坡山墙 + 红黑檐 + 烟囱 */
    const RC = [.16, .12, .24]; const eave = (zz, yy, sg2) => { rf.quad([x0 - w / 2 - .9, 8, zz], [x0 + w / 2 + .9, 8, zz], [x0 + w / 2 + .9, 12.6, z0 - 5.1], [x0 - w / 2 - .9, 12.6, z0 - 5.1], sg2 === 1 ? [0, .75, .65] : [0, .75, -.65], [0, 0, 6, 3], RC); };
    rf.quad([x0 - w / 2 - .9, 8, z0 + .9], [x0 + w / 2 + .9, 8, z0 + .9], [x0 + w / 2 + .9, 12.6, z0 - 5.1], [x0 - w / 2 - .9, 12.6, z0 - 5.1], [0, .75, .65], [0, 0, 6, 3], RC); rf.quad([x0 + w / 2 + .9, 8, z0 - 11.1], [x0 - w / 2 - .9, 8, z0 - 11.1], [x0 - w / 2 - .9, 12.6, z0 - 5.1], [x0 + w / 2 + .9, 12.6, z0 - 5.1], [0, .75, -.65], [0, 0, 6, 3], RC);
    rf.tri([x0 - w / 2 - .9, 8, z0 + .9], [x0 - w / 2 - .9, 12.6, z0 - 5.1], [x0 - w / 2 - .9, 8, z0 - 11.1], [-1, 0, 0], stone); rf.tri([x0 + w / 2 + .9, 8, z0 - 11.1], [x0 + w / 2 + .9, 12.6, z0 - 5.1], [x0 + w / 2 + .9, 8, z0 + .9], [1, 0, 0], stone);
    rd.box(x0 - w / 2 - 1, 7.8, z0 + .8, x0 + w / 2 + 1, 8.15, z0 + 1.0, [.6, .08, .12]); rd.box(x0 - w / 2 - 1, 12.55, z0 - 5.2, x0 + w / 2 + 1, 12.75, z0 - 5.0, [.6, .08, .12]); rf.box(x0 + 3.2, 8, z0 - 8.8, x0 + 4.6, 15.2, z0 - 7.4, stone); rf.box(x0 + 3.0, 15.2, z0 - 9.0, x0 + 4.8, 15.5, z0 - 7.2, [.3, .26, .35]);
    /* 塔楼（哥特尖顶）*/
    [[-8.9, -6.2, 2.1, 11.5, 5.2], [8.8, -7.2, 1.8, 9.5, 4.6]].forEach(([dx, dz, rr2, hh, rh], k) => { const cx = x0 + dx, cz = z0 + dz; st2.cyl(cx, cz, 0, hh, rr2, rr2, 10, stone); st2.cyl(cx, cz, hh - .2, hh + .15, rr2 + .35, rr2 + .35, 10, [.35, .3, .42]); rf.cyl(cx, cz, hh + .15, hh + .15 + rh, rr2 + .45, .06, 10, RC);
      for (let q = 0; q < 8; q++) { const a = q / 8 * TAU; rd.cyl(cx + Math.cos(a) * (rr2 + .1), cz + Math.sin(a) * (rr2 + .1), hh - .1, hh + .5, .12, .1, 4, [.35, .3, .42]); } tube(iron, [[cx, hh + rh, cz], [cx, hh + rh + 1.4, cz]], .05, 4, [.1, .1, .12]); iron.sphere(cx, hh + rh + 1.5, cz, .12, .12, .12, [.1, .1, .12], 4);
      [4, 7.5].forEach((wy, q) => { if (wy < hh - 1) { const wx = cx, wz = cz + rr2 + .02; pkE.quad([wx - .35, wy, wz], [wx + .35, wy, wz], [wx + .35, wy + 1.1, wz], [wx - .35, wy + 1.1, wz], [0, 0, 1], [0, 0, 1, 1], q % 2 ? [.6, 1, .5] : [1, .7, .2]); } }); obsC(cx, cz, rr2 + .1); });
    /* 门廊：中式红柱 + 飞檐 + 灯笼 + 符 + 匾 */
    { const dz = z0 + 1.6; [-2.7, 2.7].forEach(s => { rd.cyl(x0 + s, dz, 0, 4.6, .24, .24, 8, [.7, .08, .1]); gold.cyl(x0 + s, dz, 0, .3, .32, .32, 8, [.85, .7, .3]); gold.cyl(x0 + s, dz, 4.3, 4.6, .3, .3, 8, [.85, .7, .3]); });
      rd.box(x0 - 3.3, 4.6, dz - 1.4, x0 + 3.3, 5.0, dz + .4, [.55, .06, .08]); rf.quad([x0 - 4.6, 5.35, dz + 1.0], [x0 + 4.6, 5.35, dz + 1.0], [x0 + 3.4, 6.5, dz - 1.4], [x0 - 3.4, 6.5, dz - 1.4], [0, .8, .6], [0, 0, 5, 2], [.35, .06, .08]); [-1, 1].forEach(s => { tube(gold, [[x0 + s * 4.6, 5.35, dz + 1.0], [x0 + s * 5.1, 5.55, dz + 1.15], [x0 + s * 5.4, 5.9, dz + 1.2]], .07, 4, [.9, .75, .3]); });
      gold.box(x0 - 3.2, 5.0, dz + .45, x0 + 3.2, 5.12, dz + .55, [.9, .75, .3]);
      [-1.4, 1.4].forEach(s => { tube(iron, [[x0 + s, 4.6, dz + .2], [x0 + s, 4.2, dz + .2]], .02, 3, [.2, .1, .1]); lan.sphere(x0 + s, 3.85, dz + .2, .34, .42, .34, [.95, .15, .15], 8); lanE.sphere(x0 + s, 3.85, dz + .2, .3, .38, .3, [1, .4, .25], 8); tube(iron, [[x0 + s, 3.4, dz + .2], [x0 + s, 2.9, dz + .2]], .03, 3, [.9, .75, .3]); });
      [-1, 0, 1].forEach(k => { const tx = x0 + k * 1.3; tal.quad([tx - .22, 4.1, dz + .55], [tx + .22, 4.1, dz + .55], [tx + .22, 5.0 - .4 + .4, dz + .55], [tx - .22, 5.0, dz + .55], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); tal.quad([tx - .22, 3.2, dz + .56], [tx + .22, 3.2, dz + .56], [tx + .22, 4.1, dz + .56], [tx - .22, 4.1, dz + .56], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); }); }
    /* 棺材（立在门边）+ 白灯笼 */
    { const bx = x0 - 5.6, bz = z0 + 1.2, T_ = [0, .12, .99], U_ = [0, .99, -.12], R_ = [1, 0, 0]; ob(cof, [bx, 1.8, bz], nrm3(T_), nrm3(U_), R_, -.1, .1, -1.5, 1.5, -.55, .55, [1, 1, 1]); ob(rd, [bx, 1.8, bz - .06], nrm3(T_), nrm3(U_), R_, -.1, .1, -1.55, 1.55, -.6, .6, [.2, .12, .08]); obs(bx - .8, bz - .6, bx + .8, bz + .4);
      [-1, 1].forEach(s => { lan.sphere(bx + s * 1.1, 2.3, bz + .3, .28, .34, .28, [.95, .95, .9], 7); lanE.sphere(bx + s * 1.1, 2.3, bz + .3, .24, .3, .24, [.9, 1, .85], 7); tube(iron, [[bx + s * 1.1, 2.64, bz + .3], [bx + s * 1.1, 3.0, bz + .3]], .02, 3, [.3, .3, .3]); }); }
    /* 院子：铁栅栏（中间留 8 米缺口）+ 骷髅门柱 + 墓碑 + 枯树 + 南瓜 + 蜘蛛网 */
    { const fz = z0 + 6.2; [[-9.5, -4.4], [4.4, 9.5]].forEach(([a, b]) => { for (let xx = a; xx <= b + .01; xx += .6) { iron.cyl(x0 + xx, fz, 0, 1.9, .045, .045, 4, [.08, .08, .1]); iron.cyl(x0 + xx, fz, 1.9, 2.25, .09, 0, 4, [.08, .08, .1]); } tube(iron, [[x0 + a, fz, fz], [x0 + b, fz, fz]].map((p, i) => [p[0] === fz ? x0 + (i ? b : a) : p[0], 1.5, fz]), .04, 3, [.08, .08, .1]); tube(iron, [[x0 + a, .5, fz], [x0 + b, .5, fz]], .04, 3, [.08, .08, .1]); obs(x0 + a, fz - .15, x0 + b, fz + .15); });
      [-4.4, 4.4].forEach(s => { st2.box(x0 + s - .45, 0, fz - .45, x0 + s + .45, 2.6, fz + .45, stone); st2.box(x0 + s - .6, 2.6, fz - .6, x0 + s + .6, 2.85, fz + .6, [.4, .38, .46]); bone.sphere(x0 + s, 3.25, fz, .42, .38, .4, [.95, .93, .85], 7); eyeE.sphere(x0 + s - .15, 3.3, fz + .3, .1, .12, .06, [1, .3, .2], 4); eyeE.sphere(x0 + s + .15, 3.3, fz + .3, .1, .12, .06, [1, .3, .2], 4); bone.box(x0 + s - .2, 2.87, fz + .15, x0 + s + .2, 3.0, fz + .35, [.9, .88, .8]); obs(x0 + s - .6, fz - .6, x0 + s + .6, fz + .6); });
      tube(iron, (() => { const p = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * PI; p.push([x0 + Math.cos(a) * 4.4, 2.9 + Math.sin(a) * 1.5, fz]); } return p; })(), .07, 4, [.1, .1, .12]); for (let i = 3; i < 14; i += 2) { const a = i / 16 * PI; iron.cyl(x0 + Math.cos(a) * 4.4, fz, 2.9 + Math.sin(a) * 1.5 + .05, 2.9 + Math.sin(a) * 1.5 + .45, .05, 0, 4, [.1, .1, .12]); } }
    [[-7, 3.6], [-5.5, 1.8], [-8.2, 0.4], [5.8, 3.2], [7.4, 1.4], [5.2, 0], [-3.2, 4.8], [3.4, 4.9], [8.6, 4.4], [-8.6, 4.0]].forEach(([dx, dz], i) => { const gx = x0 + dx, gz = z0 + dz + 1, hh = .9 + r() * .5, ty = i % 3; if (ty === 0) { st2.box(gx - .4, 0, gz - .12, gx + .4, hh, gz + .12, [.52, .5, .56]); st2.cyl(gx, gz, hh, hh + .01, .4, .0, 8, [.52, .5, .56]); st2.sphere(gx, hh, gz, .4, .26, .12, [.52, .5, .56], 6); } else if (ty === 1) { st2.box(gx - .1, 0, gz - .1, gx + .1, hh + .4, gz + .1, [.45, .43, .5]); st2.box(gx - .4, hh - .1, gz - .1, gx + .4, hh + .1, gz + .1, [.45, .43, .5]); } else { st2.box(gx - .35, 0, gz - .13, gx + .35, hh * .7, gz + .13, [.4, .42, .38]); st2.box(gx - .26, hh * .7, gz - .1, gx + .26, hh * .7 + .1, gz + .1, [.4, .42, .38]); } obsC(gx, gz, .45); });
    { const dead = (bx, bz, hh, sd) => { const rr2 = rnd(sd); const trunk = crom3([[bx, 0, bz], [bx + (rr2() - .5), hh * .5, bz + (rr2() - .5)], [bx + (rr2() - .5) * 1.4, hh, bz + (rr2() - .5)]], 4); tube(iron, trunk, trunk.map((_, i) => .32 - i / trunk.length * .22), 6, [.2, .16, .14]);
        for (let k = 0; k < 6; k++) { const a = rr2() * TAU, y0 = hh * (.4 + rr2() * .55), len = 1.4 + rr2() * 1.4; const b2 = [bx + Math.cos(a) * len, y0 + len * .6 + rr2(), bz + Math.sin(a) * len]; tube(iron, [[bx, y0, bz], [(bx + b2[0]) / 2 + (rr2() - .5) * .6, y0 + len * .3, (bz + b2[2]) / 2], b2], [.12, .08, .02], 4, [.2, .16, .14]); } obsC(bx, bz, .5); };
      dead(x0 - 11.4, z0 + 2, 4.6, 5); dead(x0 + 11.6, z0 + 3.4, 5.2, 8); dead(x0 - 10.2, z0 - 7, 4.2, 12); dead(x0 + 4.6, z0 + 4.6, 3.8, 17); }
    [[-3.5, 2.8, .75], [-2.5, 2.2, .55], [3.2, 2.6, .8], [2.3, 2.9, .5], [-6.8, 5.8, .6], [6.9, 5.7, .65], [-1.0, 1.0, .45], [1.1, 1.2, .4]].forEach(([dx, dz, rr2], i) => { const px = x0 + dx, pz = z0 + dz; pk.sphere(px, rr2 * .85, pz, rr2 * 1.1, rr2 * .88, rr2, [1, .5, .08], 8); pkE.sphere(px, rr2 * .85, pz, rr2 * 1.06, rr2 * .85, rr2 * .96, [1, .55, .12], 8); const fz2 = pz + rr2 * .95; face.tri([px - rr2 * .55, rr2 * 1.05, fz2], [px - rr2 * .15, rr2 * 1.05, fz2], [px - rr2 * .35, rr2 * 1.4, fz2], [0, 0, 1], [1, .85, .3]); face.tri([px + rr2 * .15, rr2 * 1.05, fz2], [px + rr2 * .55, rr2 * 1.05, fz2], [px + rr2 * .35, rr2 * 1.4, fz2], [0, 0, 1], [1, .85, .3]); for (let k = 0; k < 5; k++) face.tri([px - rr2 * .6 + k * rr2 * .24, rr2 * .55, fz2], [px - rr2 * .36 + k * rr2 * .24, rr2 * .55, fz2], [px - rr2 * .48 + k * rr2 * .24, rr2 * (k % 2 ? .35 : .75), fz2], [0, 0, 1], [1, .85, .3]); pk.cyl(px, pz, rr2 * 1.65, rr2 * 1.95, .08, .06, 4, [.3, .5, .2]); obsC(px, pz, rr2 * 1.1); });
    /* 蜘蛛网 + 大蜘蛛 */
    { const wz = z0 + .06; [[-7.3, 7.9, 3.2, 0], [7.3, 7.9, 3.2, 1]].forEach(([dx, dy, sz, fl]) => { web.quad([x0 + dx - (fl ? sz : 0), dy - sz, wz], [x0 + dx + (fl ? 0 : sz), dy - sz, wz], [x0 + dx + (fl ? 0 : sz), dy, wz], [x0 + dx - (fl ? sz : 0), dy, wz], [0, 0, 1], fl ? [1, 0, 0, 1] : [0, 0, 1, 1], [1, 1, 1]); });
      const sx = x0 - 5.4, sy = 6.0, sz2 = z0 + .5; bone.sphere(sx, sy, sz2, .5, .42, .5, [.08, .06, .1], 7); bone.sphere(sx, sy + .1, sz2 + .5, .3, .28, .3, [.1, .08, .12], 6); for (let k = 0; k < 4; k++) [-1, 1].forEach(s => tube(iron, [[sx + s * .3, sy, sz2 + (k - 1.5) * .18], [sx + s * 1.0, sy + .6, sz2 + (k - 1.5) * .3], [sx + s * 1.5, sy - .5 - k * .08, sz2 + (k - 1.5) * .45]], .04, 3, [.08, .06, .1])); [-1, 1].forEach(s => eyeE.sphere(sx + s * .12, sy + .2, sz2 + .75, .06, .06, .06, [1, .1, .1], 4)); tube(iron, [[sx, 7.9, wz], [sx, sy + .5, sz2]], .01, 3, [.9, .9, .9]); }
    /* 招牌：血滴 */
    const sg = T.sign('HAUNTED 鬼屋', { w: 768, h: 160, fs: 84, bg: '#1a0408', fg: '#ff4a3a', border: '#8a0a14' }), sb = new MB(); sb.box(x0 - 4, 8.3, z0 + .06, x0 + 4, 10, z0 + .16, [1, 1, 1], [8, 1.7], { noBack: true, noSides: true, noTop: true });
    for (let i = 0; i < 9; i++) { const dx = -3.6 + i * .9, hh = .3 + (i * 37 % 5) * .15; pkE.box(x0 + dx - .05, 8.3 - hh, z0 + .08, x0 + dx + .05, 8.3, z0 + .14, [.8, .05, .08]); pkE.sphere(x0 + dx, 8.3 - hh, z0 + .11, .09, .09, .04, [.8, .05, .08], 4); }
    /* 悬挂灯笼串（塔楼 ↔ 门柱）*/
    for (let k = 0; k < 7; k++) { const u = (k + .5) / 7, lx = x0 - 8 + u * 16, ly = 5.3 - Math.sin(u * PI) * .7 + .9; if (Math.abs(lx - x0) < 4.2) continue; lan.sphere(lx, ly, z0 + 2.2, .3, .38, .3, [.95, .15, .15], 7); lanE.sphere(lx, ly, z0 + 2.2, .26, .34, .26, [1, .4, .2], 7); tube(iron, [[lx, ly + .38, z0 + 2.2], [lx, ly + .7, z0 + 2.2]], .015, 3, [.5, .4, .2]); }
    add(rf, {}); add(rd, {}); add(st2, { tex: X.haunt.tex }); add(iron, {}); add(bone, {}); add(gold, {}); add(pk, {}); add(lan, {}); add(face, {});
    add(pkE, emS('#ff8a1e', .5, 2.2)); add(lanE, emS('#ff5a30', .6, 2.3)); add(eyeE, emS('#ff2a1a', .9, 2.4)); add(tal, { tex: X.talisman }); add(cof, { tex: X.coffin }); add(web, { tex: X.web, mode: 2, glow: e => .35 + night(e) * .3 });
    add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.4 });
    obs(x0 - w / 2 - .1, z0 - 10, x0 + w / 2 + .1, z0 + .2); occ1(n0);
    /* 光：绿雾 / 月亮 / 门口红光 */
    const gl = new MB(); bb(gl, x0, 2.4, z0 + 2.5, 6, 6, [.45, 1, .5]); pool(gl, x0, z0 + 4, 7, [.35, 1, .45]); bb(gl, x0 - 7, 3, z0 + 3, 5, 5, [.5, .9, .6]); bb(gl, x0 + 7, 3, z0 + 3, 5, 5, [.5, .9, .6]); bb(gl, x0, 2.2, z0 + 1, 3.4, 3.4, [1, .25, .15]);
    add(gl, { tex: T.glow, mode: 2, glow: e => .06 + night(e) * .75 }); const mn = new MB(); bb(mn, x0 + 1, 17, z0 - 14, 20, 20, [.9, .95, .6]); bb(mn, x0 + 1, 17, z0 - 14, 9, 9, [1, 1, .85]); add(mn, { tex: T.glow, mode: 2, glow: e => night(e) * .85 });
    S.hauntLights = { x: x0, z: z0 };
    HS.push({ id: 'haunt', x: x0, z: z0 + 4.4, r: 2.0, label: '鬼屋', color: [.55, 1, .45], icon: 11, btn: '进入鬼屋', iy: 6.3 }); }

  /* ---------- 摩天轮（浪漫版：静态部分）---------- */
  const WROSE = [1, .55, .72], WGOLD = [.98, .82, .4], WWHITE = [.99, .96, .98];
  { const n0 = occ0(), mb = new MB(), gd = new MB(), lt = new MB(), hg = new MB(), W = WHEEL, ring = (zo, r) => { const pts = []; for (let i = 0; i <= 56; i++) { const a = i / 56 * TAU; pts.push([W.x + Math.cos(a) * r, W.hub + Math.sin(a) * r, W.z + zo]); } return pts; };
    [-1, 1].forEach(s => { tube(mb, ring(s * .9, W.R), .17, 6, WWHITE); tube(mb, ring(s * .9, W.R * .72), .1, 5, [.98, .86, .9]); tube(mb, ring(s * .9, W.R * .42), .1, 5, [.98, .86, .9]); tube(gd, ring(s * .9, W.R + .22), .05, 4, WGOLD); tube(gd, ring(s * .9, W.R - .22), .05, 4, WGOLD);
      [-1, 1].forEach(q => { tube(mb, [[W.x, W.hub, W.z + s * 1.5], [W.x + q * 5.4, 0, W.z + s * 2.6]], .26, 7, [.99, .93, .95]); for (let k = 1; k < 6; k++) { const u = k / 6.5; tube(gd, [[W.x + q * 5.4 * u - .26, W.hub * (1 - u), W.z + s * (1.5 + u * 1.1)], [W.x + q * 5.4 * u + .26, W.hub * (1 - u), W.z + s * (1.5 + u * 1.1)]], .05, 3, WGOLD); } }); });
    [[-5.4, 2.6], [5.4, 2.6], [-5.4, -2.6], [5.4, -2.6]].forEach(([dx, dz]) => { gd.sphere(W.x + dx, .3, W.z + dz * 1, .45, .3, .45, WGOLD, 6); });
    tube(mb, [[W.x, W.hub, W.z - 1.8], [W.x, W.hub, W.z + 1.8]], .6, 10, WGOLD); [1.6, 1.95].forEach(zz => ring3(gd, W.x, W.hub, W.z - 1.95 + zz * 2.0, .9, .1, WWHITE, 'z', 20)); gd.sphere(W.x, W.hub, W.z + 2.0, .55, .55, .3, WROSE, 8);
    mb.box(W.x - 6.9, 0, W.z - 3.6, W.x + 6.9, .35, W.z + 3.6, [.98, .86, .9]); mb.box(W.x - 7.1, .3, W.z - 3.8, W.x + 7.1, .45, W.z + 3.8, WGOLD); obs(W.x - 6.6, W.z - 3.5, W.x + 6.6, W.z + 3.5);
    /* 灯串：两条支架之间的垂花灯 + 站台边的心形灯门 */
    [-1, 1].forEach(s => { const pts = []; for (let i = 0; i <= 18; i++) { const u = i / 18; pts.push([W.x - 5.2 + u * 10.4, 1.2 + Math.sin(u * PI) * -.9 + 2.4, W.z + s * 3.3]); } tube(gd, pts, .03, 3, WGOLD); pts.forEach((p, i) => { if (i % 2 === 0) lt.sphere(p[0], p[1] - .06, p[2], .1, .1, .1, [1, .9, .7], 4); }); });
    const HX = W.x, HZ = W.z + 4.4, heart = (u, s) => [16 * Math.pow(Math.sin(u), 3) * s, (13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) * s]; { const ptsH = []; for (let i = 0; i <= 40; i++) { const h = heart(i / 40 * TAU, .2); ptsH.push([HX + h[0], 4.6 + h[1], HZ]); } tube(gd, ptsH, .06, 4, WROSE); for (let i = 0; i < 40; i += 2) lt.sphere(ptsH[i][0], ptsH[i][1], ptsH[i][2] + .05, .11, .11, .11, [1, .75, .85], 4); [-1, 1].forEach(sd => { mb.cyl(HX + sd * 3.4, HZ, 0, 3.0, .14, .12, 6, WWHITE); }); }
    /* 玫瑰花丛（站台两侧）*/
    const rs = new MB(), rf = new MB(), rr = rnd(77); [[-1, 1], [1, 1], [-1, 2], [1, 2], [-1, 3], [1, 3]].forEach(([sd, k]) => { const bx = HX + sd * (4.6 + k * .9), bz = HZ + .6 - (k % 2) * .5; rs.sphere(bx, .6, bz, .75, .55, .75, [.28, .55, .3], 6); for (let q = 0; q < 6; q++) { const a = rr() * TAU, r2 = rr() * .55; rf.sphere(bx + Math.cos(a) * r2, .78 + rr() * .28, bz + Math.sin(a) * r2, .15, .13, .15, rr() < .5 ? [1, .35, .5] : [1, .72, .8], 4); } obsC(bx, bz, .8); });
    add(mb, {}); add(gd, {}); add(lt, emS('#ffe9c0', .5, 2.4)); add(rs, {}); add(rf, {}); occ1(n0);
    const sg = T.sign('摩天轮 FERRIS WHEEL', { w: 768, h: 140, fs: 70, bg: '#3a0f28', fg: '#fff0f6', border: '#ffb0cf' }), sb = new MB(); sb.box(W.x - 3.5, .5, W.z + 3.85, W.x + 3.5, 2.0, W.z + 3.92, [1, 1, 1], [7, 1.5], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.3 });
    HS.push({ id: 'ferris', x: W.x, z: W.z + 6.4, r: 2.0, label: '摩天轮', color: [1, .5, .75], icon: 0, btn: '乘摩天轮', iy: 5.2 }); }

  /* ---------- 旋转木马（豪华版：静态）---------- */
  const horseMesh = (coat, mane, uni, wing) => { const m = new MB(), dk = mul(coat, .78), gold = [.98, .8, .3], rb = [.9, .2, .35];
    m.sphere(0, 1.0, 0, .4, .42, .82, coat, 4); m.sphere(0, 1.1, .55, .42, .47, .42, coat, 4); m.sphere(0, 1.05, -.62, .42, .45, .42, coat, 4);
    const nk = crom3([[0, 1.25, .7], [0, 1.65, .98], [0, 1.95, 1.2]], 2); tube(m, nk, nk.map((_, i) => .25 - i / nk.length * .1), 4, coat);
    m.sphere(0, 2.02, 1.42, .19, .23, .33, coat, 4); m.sphere(0, 1.9, 1.74, .14, .14, .2, mul(coat, 1.06), 3); m.sphere(0, 1.88, 1.9, .07, .06, .04, [.9, .5, .55], 4); [-1, 1].forEach(s => { m.sphere(s * .16, 2.1, 1.48, .045, .05, .05, [.08, .06, .06], 4); m.cyl(s * .1, 1.2 + 0, 2.16, 2.42, .06, 0, 4, dk); m.cyl(s * .1, 1.2, 2.16, 2.4, .0, 0, 3, coat); });
    for (let i = 0; i < 6; i++) m.sphere(0, 2.08 - i * .13, 1.1 - i * .13, .09, .1, .13, mane, 4); tube(m, [[0, 2.3, 1.38], [0, 2.52, 1.25], [.15, 2.62, 1.0]], [.06, .05, .01], 4, rb);
    const tl = crom3([[0, 1.15, -.95], [0, 1.0, -1.3], [.1, .45, -1.55], [.05, .1, -1.5]], 2); tube(m, tl, tl.map((_, i) => .13 - i / tl.length * .09), 4, mane);
    [[-.2, 1], [.2, 1]].forEach(([x, f], i) => { tube(m, [[x, .85, .55], [x * 1.1, .85, 1.0], [x * 1.1, .55, 1.1]], [.11, .08, .06], 4, coat); m.sphere(x * 1.1, .5, 1.12, .07, .06, .08, gold, 4); });
    [[-.2], [.2]].forEach(([x]) => { tube(m, [[x, .85, -.55], [x * 1.1, .55, -.78], [x * 1.1, .12, -.8]], [.13, .09, .06], 4, coat); m.sphere(x * 1.1, .08, -.8, .08, .06, .09, gold, 4); });
    m.sphere(0, 1.46, 0, .36, .07, .46, rb, 4); m.sphere(0, 1.5, 0, .3, .05, .38, gold, 4); m.box(-.04, 1.5, -.35, .04, 1.9, -.28, gold); m.sphere(0, 1.95, -.31, .08, .08, .08, gold, 4); m.sphere(0, 1.18, 1.0, .16, .16, .12, gold, 3); tube(m, [[-.2, 1.9, 1.7], [0, 1.8, 1.95], [.2, 1.9, 1.7]], .02, 3, gold);
    
    if (uni) tube(m, [[0, 2.15, 1.55], [0, 2.55, 1.75], [0, 2.95, 1.9]], [.07, .05, .005], 5, [1, .88, .4]);
    if (wing) [-1, 1].forEach(s => { m.quad([s * .38, 1.5, .1], [s * 1.2, 2.0, -.1], [s * 1.5, 1.7, -.6], [s * .38, 1.3, -.3], [0, 1, 0], [0, 0, 1, 1], WWHITE); m.quad([s * .38, 1.5, .1], [s * 1.2, 2.0, -.1], [s * 1.5, 1.7, -.6], [s * .38, 1.3, -.3], [0, -1, 0], [0, 0, 1, 1], WWHITE); });
    return m; };
  const HM = [horseMesh([.98, .98, .98], [.98, .8, .3], false, false), horseMesh([.7, .46, .3], [.2, .12, .08], false, false), horseMesh([1, .78, .88], [.95, .45, .7], true, false), horseMesh([.72, 1, .9], [.3, .7, .6], false, true), horseMesh([.86, .82, 1], [.6, .5, 1], true, true)];
  { const n0 = occ0(), mb = new MB(), gd = new MB(), top = new MB(), x = CAR.x, z = CAR.z, tex = awn('cr', '#ff7ab6', '#ffffff'), mr = texm('mir', X.mirror, X.mirror, .15, .9), fan = [new MB(), new MB()];
    fanZ(fan[0], 0, 0, 0, .56, [1, .55, .72], PI, TAU, 8); fanZ(fan[1], 0, 0, 0, .56, [1, 1, 1], PI, TAU, 8);
    mb.cyl(x, z, 0, .5, 6.4, 6.2, 32, [1, .93, .96], true); mb.cyl(x, z, .5, .56, 6.0, 6.0, 32, [.98, .6, .78], true); gd.cyl(x, z, .46, .64, 6.5, 6.5, 32, WGOLD); gd.cyl(x, z, .0, .12, 6.55, 6.55, 32, WGOLD);
    /* 中心柱：镜面板 + 金柱 + 彩绘 */
    mb.cyl(x, z, .56, 5.5, 1.7, 1.7, 16, [.98, .78, .86]); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, c = Math.cos(a), s = Math.sin(a); mr.mb.quad([x + c * 1.72 - s * .5, .9, z + s * 1.72 + c * .5], [x + c * 1.72 + s * .5, .9, z + s * 1.72 - c * .5], [x + c * 1.72 + s * .5, 4.9, z + s * 1.72 - c * .5], [x + c * 1.72 - s * .5, 4.9, z + s * 1.72 + c * .5], [c, 0, s], [0, 0, 1, 1], [1, 1, 1]); gd.cyl(x + c * 1.78 - s * .52, z + s * 1.78 + c * .52, .56, 5.3, .1, .1, 6, WGOLD); }
    gd.cyl(x, z, .56, .9, 1.9, 1.9, 16, WGOLD); gd.cyl(x, z, 4.9, 5.3, 1.9, 1.9, 16, WGOLD);
    /* 栏杆 */
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; gd.cyl(x + Math.cos(a) * 6.0, z + Math.sin(a) * 6.0, .56, 1.3, .06, .05, 5, WGOLD); gd.sphere(x + Math.cos(a) * 6.0, 1.32, z + Math.sin(a) * 6.0, .09, .09, .09, WROSE, 4); } { const rg = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU; rg.push([x + Math.cos(a) * 6.0, 1.05, z + Math.sin(a) * 6.0]); } tube(gd, rg, .05, 4, WGOLD); }
    /* 雨篷：两层斜面 + 金肋 + 扇贝垂边 + 檐口彩绘板 */
    top.cyl(x, z, 5.3, 5.9, 6.5, 6.5, 24, [1, .8, .9]); gd.cyl(x, z, 5.25, 5.4, 6.62, 6.62, 28, WGOLD); gd.cyl(x, z, 5.85, 6.0, 6.55, 6.55, 28, WGOLD);
    tex.mb.cyl(x, z, 5.9, 8.0, 6.6, 2.2, 24, [1, 1, 1]); tex.mb.cyl(x, z, 7.95, 9.5, 2.3, .2, 24, [1, 1, 1]); gd.cyl(x, z, 7.9, 8.05, 2.5, 2.5, 20, WGOLD);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, c = Math.cos(a), s = Math.sin(a); tube(gd, [[x + c * 6.62, 5.95, z + s * 6.62], [x + c * 4.4, 7.0, z + s * 4.4], [x + c * 2.35, 7.95, z + s * 2.35], [x + c * .25, 9.45, z + s * .25]], .07, 3, WGOLD); }
    for (let i = 0; i < 32; i++) { const a = (i + .5) / 32 * TAU; xfAppend(top, fan[i % 2], x + Math.cos(a) * 6.5, 5.3, z + Math.sin(a) * 6.5, Math.PI / 2 - a, 0, 0, 1); }
    for (let i = 0; i < 16; i++) { const a = (i + .5) / 16 * TAU, c = Math.cos(a), s = Math.sin(a); mr.mb.quad([x + c * 6.0 - s * .8, 5.62 - .3, z + s * 6.0 + c * .8], [x + c * 6.0 + s * .8, 5.62 - .3, z + s * 6.0 - c * .8], [x + c * 6.0 + s * .8, 5.62 + .35, z + s * 6.0 - c * .8], [x + c * 6.0 - s * .8, 5.62 + .35, z + s * 6.0 + c * .8], [-c, 0, -s], [0, 0, 1, 1], [1, 1, 1]); }
    gd.sphere(x, 9.75, z, .55, .55, .55, WGOLD, 8); gd.cyl(x, z, 9.9, 11.4, .1, 0, 6, WGOLD); mb.quad([x, 11.2, z], [x + 1.5, 10.9, z], [x + 1.4, 10.45, z], [x, 10.7, z], [0, 0, 1], [0, 0, 1, 1], WROSE); mb.quad([x, 11.2, z], [x, 10.7, z], [x + 1.4, 10.45, z], [x + 1.5, 10.9, z], [0, 0, -1], [0, 0, 1, 1], WROSE);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; gd.sphere(x + Math.cos(a) * 2.6, 8.0 + .1, z + Math.sin(a) * 2.6, .2, .2, .2, WROSE, 5); }
    add(mb, {}); add(gd, {}); add(top, { tex: X.stripe('#ffd0e6', '#ffffff') }); add(tex.mb, { tex: tex.tex }); add(mr.mb, { tex: mr.tex, em: mr.em, emDay: .15, emNight: .9 }); obsC(x, z, 6.3);
    occ1(n0);
    HS.push({ id: 'carousel', x, z: z + 8.8, r: 2.0, label: '旋转木马', color: [1, .6, .85], icon: 1, btn: '骑木马', iy: 7.2 }); }

  /* 摩天轮吊舱（封闭玻璃舱）*/
  const cabinMesh = (col) => { const m = new MB(), gold = WGOLD, W2 = WWHITE; m.cyl(0, 0, 0, .1, .98, .98, 8, gold); m.cyl(0, 0, .1, .15, .92, .92, 8, W2);
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; m.cyl(Math.cos(a) * .9, Math.sin(a) * .9, .15, 2.15, .04, .04, 4, W2); }
    m.cyl(0, 0, .15, 1.0, .91, .91, 8, col); ring3(m, 0, 1.0, 0, .91, .05, gold, 'y', 10); ring3(m, 0, 1.75, 0, .9, .04, gold, 'y', 10);
    m.cyl(0, 0, 2.1, 2.45, 1.1, .6, 8, col); m.cyl(0, 0, 2.45, 2.85, .6, .05, 8, W2); ring3(m, 0, 2.12, 0, 1.08, .06, gold, 'y', 10); m.sphere(0, 2.95, 0, .13, .13, .13, [1, .5, .65], 5);
    m.box(-.5, .15, -.6, .5, .5, -.3, [.98, .86, .9]); m.box(-.5, .5, -.62, .5, 1.0, -.55, [.98, .86, .9]); m.box(-.5, .15, .3, .5, .5, .6, [.98, .86, .9]); m.box(-.5, .5, .55, .5, 1.0, .62, [.98, .86, .9]); [-1, 1].forEach(s => m.sphere(s * .5, 1.12, .0, .08, .08, .08, [1, .45, .6], 5)); return m; };
  const CABIN = [cabinMesh([1, .8, .88]), cabinMesh([.99, .96, .98]), cabinMesh([.88, .8, 1]), cabinMesh([1, .88, .78])];

  /* ---------- 恐龙过山车：3D 轨道（升降坡 / 大俯冲 / 垂直环 / 穿过霸王龙嘴 / 倾斜弯） ---------- */
  const DZ = -7;                                          // 整个过山车区域整体往后（-z）移，让入口落在铺砖广场上
  const DINO = { x: 45.5, zm: 4.6 + DZ, zr: -16.5 + DZ };      // 霸王龙：嘴在 +z 方向（朝镜头），轨道从尾部进、嘴里出
  const CO = (() => {
    const ctrl = [], P = (x, y, z) => ctrl.push([x, y, z + DZ]), ix = {};
    P(34, 1.6, 9.2); P(27, 1.6, 9.2); P(21, 1.6, 9.0); ix.lift0 = ctrl.length; P(16.5, 2.0, 6.8); P(14.8, 4.6, 1.5); P(14.5, 8.5, -5); P(15, 13, -11); P(16, 17.2, -17); ix.peak = ctrl.length; P(19.5, 20.2, -21.8); P(26, 19.4, -23.6); P(30.5, 14.5, -23.8); P(33, 7.8, -23.5); P(34.6, 3.6, -23.3);
    ix.loop0 = ctrl.length; const LP = { x0: 36.2, y0: 1.9, z0: -23.2 + DZ, R: 4.5, k: .9, dz: 2.6 };
    for (let i = 0; i <= 12; i++) { const th = i / 12 * TAU; ctrl.push([LP.x0 + LP.R * Math.sin(th) + LP.k * th, LP.y0 + LP.R * (1 - Math.cos(th)), LP.z0 + LP.dz * th / TAU]); } ix.loop1 = ctrl.length - 1;
    P(43.7, 2.3, -20.2); P(45.3, 3.0, -18.0); ix.tun0 = ctrl.length; P(45.5, 3.5, -15); P(45.5, 3.5, -9); P(45.5, 3.5, -2); P(45.5, 3.4, 3.0); ix.tun1 = ctrl.length; P(45.4, 3.0, 5.4); P(45.1, 2.4, 7.0); P(42.8, 1.9, 8.7); P(38.5, 1.6, 9.2);
    const dense = cromLoop3(ctrl, 14), nd = dense.length; const cum = [0]; for (let i = 1; i <= nd; i++) { const a = dense[i - 1], b = dense[i % nd]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
    const total0 = cum[nd], N = Math.round(total0 / .8); let pts = []; { let j = 0; for (let i = 0; i < N; i++) { const s = i / N * total0; while (cum[j + 1] < s) j++; const u = (s - cum[j]) / (cum[j + 1] - cum[j] || 1), a = dense[j], b = dense[(j + 1) % nd]; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]); } }
    for (let pass = 0; pass < 3; pass++) pts = pts.map((p, i) => { const a = pts[(i + N - 1) % N], b = pts[(i + 1) % N]; return [0, 1, 2].map(c => (a[c] + 2 * p[c] + b[c]) / 4); });
    pts.forEach(p => { if (p[1] < 1.5) p[1] = 1.5; });
    const len = [0]; for (let i = 1; i <= N; i++) { const a = pts[i - 1], b = pts[i % N]; len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); } const total = len[N];
    const Tn = pts.map((p, i) => { const a = pts[(i + N - 1) % N], b = pts[(i + 1) % N]; return nrm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]); });
    const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const rotA = (v, ax, an) => { const c = Math.cos(an), s = Math.sin(an), k = cr(ax, v), d = dot(ax, v) * (1 - c); return [v[0] * c + k[0] * s + ax[0] * d, v[1] * c + k[1] * s + ax[1] * d, v[2] * c + k[2] * s + ax[2] * d]; };
    const near = (c) => { let bi = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]); if (d < bd) { bd = d; bi = i; } }); return bi; };
    const I = { lift0: near(ctrl[ix.lift0]), peak: near(ctrl[ix.peak]), loop0: near(ctrl[ix.loop0]), loop1: near(ctrl[ix.loop1]), tun0: near(ctrl[ix.tun0]), tun1: near(ctrl[ix.tun1]) };
    const Un = []; { const upP = t => { const d = t[1]; return nrm3([-t[0] * d, 1 - t[1] * d, -t[2] * d]); }; let u = null;
      for (let i = 0; i < N; i++) { const t = Tn[i]; if (i < I.loop0 - 1 || i > I.loop1 + 16) { Un.push(upP(t)); continue; }
        if (i === I.loop0 - 1) { u = upP(t); Un.push(u); continue; }
        const d = dot(u, t); u = nrm3([u[0] - t[0] * d, u[1] - t[1] * d, u[2] - t[2] * d]);
        if (i > I.loop1) { const k = (i - I.loop1) / 16, q = upP(t); Un.push(nrm3([u[0] * (1 - k) + q[0] * k, u[1] * (1 - k) + q[1] * k, u[2] * (1 - k) + q[2] * k])); } else Un.push(u); } }
    const yaw = Tn.map(t => Math.atan2(t[0], t[2])), bank = Tn.map((t, i) => { const a = yaw[(i + N - 3) % N], b = yaw[(i + 3) % N]; let dy = b - a; while (dy > PI) dy -= TAU; while (dy < -PI) dy += TAU; const kap = dy / (6 * .8), vert = Math.abs(t[1]); return clamp(-kap * 6.2, -.85, .85) * (1 - Math.min(1, vert * 1.6)); });
    for (let pass = 0; pass < 4; pass++) for (let i = 0, prev = bank.slice(); i < N; i++) bank[i] = (prev[(i + N - 1) % N] + 2 * prev[i] + prev[(i + 1) % N]) / 4;
    for (let i = 0; i < N; i++) Un[i] = rotA(Un[i], Tn[i], bank[i]);
    const find = (s) => { s = ((s % total) + total) % total; let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] <= s) lo = m; else hi = m; } return [lo, (s - len[lo]) / (len[lo + 1] - len[lo] || 1)]; };
    const frame = (s) => { const [i, u] = find(s), j = (i + 1) % N, a = pts[i], b = pts[j]; return { p: [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], T: nrm3([lerp(Tn[i][0], Tn[j][0], u), lerp(Tn[i][1], Tn[j][1], u), lerp(Tn[i][2], Tn[j][2], u)]), U: nrm3([lerp(Un[i][0], Un[j][0], u), lerp(Un[i][1], Un[j][1], u), lerp(Un[i][2], Un[j][2], u)]) }; };
    return { pts, Tn, Un, len, total, N, I, LP, ymax: 20.5, frame, s0: len[I.lift0], s1: len[I.peak], at(s) { const f = frame(s); return [f.p[0], f.p[1], f.p[2], Math.atan2(f.T[0], f.T[2])]; } };
  })();
  { const mb = new MB(), em = new MB(), ties = new MB(), chain = new MB(), P = CO.pts, N = CO.N, Tn = CO.Tn, Un = CO.Un, I = CO.I;
    const XR = i => { const t = Tn[i], u = Un[i]; return nrm3([u[1] * t[2] - u[2] * t[1], u[2] * t[0] - u[0] * t[2], u[0] * t[1] - u[1] * t[0]]); };
    const railA = [], railB = [], spine = [], sp2 = [];
    for (let i = 0; i <= N; i++) { const k = i % N, p = P[k], x = XR(k), u = Un[k]; railA.push([p[0] + x[0] * .46, p[1] + x[1] * .46, p[2] + x[2] * .46]); railB.push([p[0] - x[0] * .46, p[1] - x[1] * .46, p[2] - x[2] * .46]); spine.push([p[0] - u[0] * .42, p[1] - u[1] * .42, p[2] - u[2] * .42]); }
    tube(mb, railA, .1, 5, [.95, .96, 1]); tube(mb, railB, .1, 5, [.95, .96, 1]); tube(mb, spine, .24, 6, i => [.78, .16, .14]);
    for (let i = 0; i < N; i += 2) { const p = P[i], x = XR(i), u = Un[i], t = Tn[i]; ob(ties, [p[0] - u[0] * .2, p[1] - u[1] * .2, p[2] - u[2] * .2], t, u, x, -.07, .07, -.09, .09, -.52, .52, [.5, .3, .18]); if (i % 4 === 0) { tube(mb, [[p[0] + x[0] * .46, p[1] + x[1] * .46, p[2] + x[2] * .46], [p[0] - u[0] * .42, p[1] - u[1] * .42, p[2] - u[2] * .42], [p[0] - x[0] * .46, p[1] - x[1] * .46, p[2] - x[2] * .46]], .045, 3, [.85, .85, .92]); } }
    for (let i = I.lift0 + 4; i < I.peak; i += 1) { const p = P[i], x = XR(i), u = Un[i], t = Tn[i]; ob(chain, [p[0] - u[0] * .08, p[1] - u[1] * .08, p[2] - u[2] * .08], t, u, x, -.14, .14, -.07, .09, -.18, .18, i % 2 ? [.2, .2, .24] : [.62, .62, .68]); }
    for (let i = 0; i < N; i += 11) { const p = P[i], u = Un[i]; em.sphere(p[0] + u[0] * .24, p[1] + u[1] * .24, p[2] + u[2] * .24, .1, .1, .1, [1, .7, .5], 4); }
    add(mb, {}); add(ties, {}); add(chain, {}); add(em, emS('#ffb080', .35, 2));
    /* 支柱（隧道 / 垂直环处不放；高的加斜撑） */
    const noSup = (x, z) => (x > DINO.x - 6 && x < DINO.x + 6 && z > DINO.zr - 3 && z < DINO.zm + 2) || (x > 30 && x < 45 && z > -27 + DZ && z < -18.5 + DZ) || (x > 34 && z > 7 + DZ && x < 50 && z < 10 + DZ);
    let prevSup = null; for (let i = 0; i < N; i += 8) { const p = P[i], u = Un[i]; if (p[1] < 2.0 || u[1] < .3 || noSup(p[0], p[2])) { prevSup = null; continue; }
      const h = p[1] - .6, w = .15 + h * .008; const sm = new MB(); sm.box(p[0] - w, 0, p[2] - w, p[0] + w, h, p[2] + w, [.93, .93, .98]); if (h > 7) { sm.box(p[0] - w - .06, 0, p[2] - w - .06, p[0] + w + .06, .35, p[2] + w + .06, [.55, .35, .3]); }
      if (prevSup && prevSup[1] > 4 && h > 4) tube(sm, [[prevSup[0], .4, prevSup[2]], [p[0], h * .9, p[2]]], .045, 3, [.8, .8, .88]);
      occ(() => add(sm, {})); if (i % 16 === 0) obsC(p[0], p[2], .4); prevSup = [p[0], h, p[2]]; }
    /* 垂直环：两座塔 */
    { const L = CO.LP, ax = L.x0 + L.k * PI, az = L.z0 + L.dz * .5, ay = L.y0 + 2 * L.R, sm = new MB(); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => tube(sm, [[ax + a * 4.4, 0, az + b * 3.3], [ax + a * 4.4 * .55, ay * .5, az + b * 2.2], [ax + a * .95, ay + .1, az + b * 0.0]], .17, 5, [.93, .93, .98]));
      [.3, .55, .8].forEach(f => { sm.box(ax - 4.4 * (1 - f * .6), ay * f - .08, az - 3.3 * (1 - f * .6), ax + 4.4 * (1 - f * .6), ay * f + .08, az - 3.3 * (1 - f * .6) + .12, [.8, .8, .88]); }); occ(() => add(sm, {})); obs(ax - 4.7, az - 3.6, ax - 4.1, az - 3.0); obs(ax + 4.1, az - 3.6, ax + 4.7, az - 3.0); obs(ax - 4.7, az + 3.0, ax - 4.1, az + 3.6); obs(ax + 4.1, az + 3.0, ax + 4.7, az + 3.6); }
  }
  /* 车站 + 骨架拱门入口 */
  { const n0 = occ0(), mb = new MB(), bone = new MB(), roof = new MB(), em = new MB();
    mb.box(18, 0, 7.6, 37, 1.0, 10.8, [.62, .5, .4]); mb.box(18, 1.0, 7.6, 37, 1.08, 10.8, [.85, .75, .6]);
    [[18.4, 7.9], [18.4, 10.5], [36.6, 7.9], [36.6, 10.5], [27.5, 7.9], [27.5, 10.5]].forEach(([x, z]) => { bone.cyl(x, z, 1.08, 4.6, .22, .16, 6, [.93, .88, .74]); bone.sphere(x, 4.7, z, .3, .3, .3, [.95, .9, .78], 5); });
    roof.box(17.6, 4.6, 7.3, 37.4, 4.85, 11.1, [.3, .55, .28]); for (let i = 0; i < 12; i++) roof.cyl(18.3 + i * 1.7, 11.0, 4.85, 5.5, .35, 0, 4, [.9, .4, .12]);
    // 肋骨拱门（入口，朝南）
    const AZ = 12.4, AX = 27.5; for (let k = -2; k <= 2; k++) { const pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * PI, rr = 3.6 - Math.abs(k) * .35; pts.push([AX + Math.cos(a) * rr, Math.sin(a) * (4.2 - Math.abs(k) * .3), AZ + k * .55]); } tube(bone, pts, .16, 5, [.95, .9, .78]); }
    for (let i = 0; i < 6; i++) { const a = (i + .5) / 6 * PI; bone.cyl(AX + Math.cos(a) * 3.6, AZ + 1.5, 0, 0, .0, 0, 3, [1, 1, 1]); }
    [-3.6, 3.6].forEach(x => bone.sphere(AX + x, .25, AZ, .5, .5, .5, [.92, .87, .72], 6));
    const sg = T.sign('恐龙过山车 JURASSIC', { w: 1024, h: 190, fs: 84, bg: '#1a0a06', fg: '#ffd98a', border: '#ff6a1a' }), sb = new MB(); sb.box(AX - 3.4, 4.6, AZ + 1.2, AX + 3.4, 6.2, AZ + 1.28, [1, 1, 1], [6.8, 1.6], { noBack: true, noSides: true, noTop: true });
    [mb, bone, roof, sb].forEach(m => shiftZ(m, DZ)); add(mb, {}); add(bone, { tex: X.bone }); add(roof, {}); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.5 });
    obs(18, 7.6 + DZ, 37, 10.8 + DZ); occ1(n0);
    HS.push({ id: 'coaster', x: AX, z: AZ + 2.6 + DZ, r: 2.0, label: '恐龙过山车', color: [1, .5, .3], icon: 2, btn: '坐过山车', iy: 6.9 }); }

  const X0 = X;
  /* ---------- 恐龙主题：霸王龙（轨道穿过它的嘴）+ 其它恐龙 + 火山 + 棕榈 ---------- */
  const tooth = [.97, .95, .86], skinC = [.34, .68, .3];
  const sauroMesh = () => { const m = new MB(), c = [.5, .66, .34], d = [.4, .55, .3];
    m.sphere(0, 3.7, 0, 1.9, 2.1, 3.8, c, 7); [[-1.3, 2.3], [1.3, 2.3], [-1.3, -2.3], [1.3, -2.3]].forEach(([x, z]) => { m.cyl(x, z, 0, 3.0, .75, .6, 7, d); m.box(x - .8, 0, z - .3, x + .8, .35, z + 1.2, [.3, .4, .25]); });
    const neck = crom3([[0, 4.6, 3], [0, 6.2, 5.0], [0, 9, 6.2], [0, 11.4, 6.9], [0, 12.4, 7.6]], 6); tube(m, neck, neck.map((_, i) => 1.15 - i / neck.length * .6), 8, c);
    m.sphere(0, 12.5, 8.1, .6, .55, 1.0, c, 6); m.sphere(.42, 12.7, 8.5, .13, .13, .13, [1, .9, .3], 4); m.sphere(-.42, 12.7, 8.5, .13, .13, .13, [1, .9, .3], 4);
    const tl = crom3([[0, 3.6, -3], [0, 2.6, -6.5], [.8, 1.2, -10], [-.5, .5, -13]], 6); tube(m, tl, tl.map((_, i) => 1.1 - i / tl.length * .95), 7, c);
    for (let i = 0; i < 6; i++) m.cyl(0, -2.6 + i * 1.2, 5.55 - i * .08, 6.2 - i * .08, .35, 0, 4, [.9, .5, .2]); return m; };
  const triceMesh = () => { const m = new MB(), c = [.78, .5, .3], d = [.65, .4, .25];
    m.sphere(0, 1.7, 0, 1.4, 1.3, 2.4, c, 7); [[-.9, 1.4], [.9, 1.4], [-.9, -1.4], [.9, -1.4]].forEach(([x, z]) => m.cyl(x, z, 0, 1.2, .42, .35, 6, d));
    m.sphere(0, 1.7, 2.9, .85, .8, 1.15, c, 6); m.sphere(0, 2.7, 2.2, 1.7, 1.55, .16, [.9, .35, .3], 8); m.sphere(0, 2.7, 2.18, 1.3, 1.2, .2, [1, .75, .3], 8);
    [-.55, .55].forEach(x => tube(m, [[x, 2.2, 3.5], [x, 2.55, 4.6], [x * 1.15, 2.9, 5.6]], [.2, .13, .03], 5, tooth)); tube(m, [[0, 1.7, 4.0], [0, 1.95, 4.5]], [.16, .03], 5, tooth);
    [-.5, .5].forEach(x => m.sphere(x, 2.15, 3.35, .11, .11, .11, [.1, .1, .1], 4)); const tl = crom3([[0, 1.6, -2.2], [0, 1.2, -3.6], [.4, .6, -5]], 4); tube(m, tl, tl.map((_, i) => .6 - i / tl.length * .5), 6, c); return m; };
  const palm = (mb, fm, x, z, h, lean, sd) => { const r = rnd(sd), a0 = r() * TAU, pts = [], top = [x + Math.cos(a0) * lean, h, z + Math.sin(a0) * lean]; for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push([x + (top[0] - x) * u * u, h * u, z + (top[2] - z) * u * u]); } tube(mb, pts, pts.map((_, i) => .32 - i * .025), 6, [.55, .4, .28]);
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + r(), dx = Math.cos(a), dz = Math.sin(a), L = 3.3 + r() * .8, px = -dz * .55, pz = dx * .55, e = [top[0] + dx * L, top[1] - 1.5 - r() * .5, top[2] + dz * L], mid = [top[0] + dx * L * .55, top[1] + .35, top[2] + dz * L * .55], col = [.2 + r() * .12, .55 + r() * .15, .25];
      fm.quad([top[0], top[1], top[2]], [mid[0] + px, mid[1], mid[2] + pz], [e[0], e[1], e[2]], [mid[0] - px, mid[1], mid[2] - pz], [0, 1, 0], [0, 0, 1, 1], col); } };
  { const n0 = occ0(), sk = new MB(), tb = new MB(), em = new MB(), mt = new MB(), dk = new MB(), DX = DINO.x, X = DX;
    /* --- 霸王龙：下颌 / 上颌 / 颅顶 / 身体 / 腿 / 尾 --- */
    sk.box(X - 2.5, .3, -1.8, X + 2.5, 1.7, 4.0, skinC); sk.sphere(X, 1.0, 4.0, 2.5, .7, .55, skinC, 7); mt.box(X - 2.0, 1.7, -1.5, X + 2.0, 1.95, 4.2, [.78, .2, .26]);
    for (let i = 0; i < 9; i++) { const z = -.4 + i * .52; [-1, 1].forEach(s => tb.cyl(X + s * 2.25, z + 0.1, 1.7, 2.7 + (i % 2) * .25, .17, 0, 4, tooth)); } for (let i = 0; i < 5; i++) tb.cyl(X - 1.4 + i * .7, 4.25, 1.7, 2.6, .17, 0, 4, tooth);
    sk.sphere(X, 7.4, .2, 3.4, 1.9, 5.2, skinC, 8); sk.sphere(X, 6.7, 3.1, 2.7, 1.5, 1.8, skinC, 8); sk.box(X - 2.75, 5.3, -.6, X + 2.75, 5.9, 4.6, skinC); mt.box(X - 2.4, 5.2, -.5, X + 2.4, 5.35, 4.4, [.78, .2, .26]);
    for (let i = 0; i < 9; i++) { const z = -.2 + i * .5; [-1, 1].forEach(s => tb.cyl(X + s * 2.4, z + .15, 5.3, 3.9 - (i % 2) * .3, .19, 0, 4, tooth)); } for (let i = 0; i < 6; i++) tb.cyl(X - 1.75 + i * .7, 4.7, 5.3, 4.0, .19, 0, 4, tooth);
    [-1, 1].forEach(s => { sk.box(X + s * 3.0 - .3, 1.7, -6, X + s * 3.0 + .3, 5.3, -.8, skinC); em.sphere(X + s * 2.85, 8.2, 1.7, .5, .5, .45, [1, .85, .15], 6); dk.sphere(X + s * 3.12, 8.2, 1.75, .07, .38, .12, [.05, .02, .02], 4); sk.sphere(X + s * 2.75, 8.85, 1.7, .8, .22, .75, mul(skinC, .8), 5); dk.sphere(X + s * .8, 8.15, 4.4, .22, .17, .22, [.1, .05, .05], 4); });
    /* 身体：隧道（空心壳）+ 背刺 + 大腿 */
    { const sp = [], rs = []; for (let i = 0; i <= 8; i++) { const z = -6 - i * 1.3, u = i / 8; sp.push([X, 3.5, z]); rs.push(4.1 + 1.4 * Math.sin(u * PI) + (i === 0 ? .0 : 0)); } tube(sk, sp, rs, 14, skinC);
      for (let i = 0; i < 10; i++) { const z = -6.8 - i * 1.0, r = 4.1 + 1.4 * Math.sin(Math.min(1, (i * 1.0 + .8) / 10.4) * PI); tb.cyl(X, z, 3.5 + r - .2, 3.5 + r + 1.5 - i * .06, .5, 0, 4, [.95, .5, .15]); }
      [-1, 1].forEach(s => { sk.sphere(X + s * 5.0, 3.4, -11.5, 2.2, 3.0, 3.6, mul(skinC, .95), 8); sk.box(X + s * 5.0 - 1.2, 0, -10.8, X + s * 5.0 + 1.2, .5, -7.6, [.35, .5, .25]); for (let k = -1; k <= 1; k++) tb.cyl(X + s * 5.0 + k * .8, -7.8, .0, .5, .22, 0, 4, tooth); });
      const tl = crom3([[X + 2.5, 2.8, -15.5], [X + 6, 2.2, -18], [X + 10, 1.4, -20.5], [X + 14, .6, -21]], 6); tube(sk, tl, tl.map((_, i) => 2.2 - i / tl.length * 2), 8, skinC);
      [-1, 1].forEach(s => tube(sk, [[X + s * 2.9, 4.4, 1.5 + 0], [X + s * 3.0, 3.3, 3.2]], [.35, .2], 5, skinC)); }
    [sk, tb, mt, em, dk].forEach(m => shiftZ(m, DZ)); add(sk, { tex: X0.dino }); add(tb, { tex: X0.bone }); add(mt, {}); add(em, emS('#ffd020', .8, 2.2)); add(dk, {});
    obs(X - 6.6, -18 + DZ, X + 6.6, 4.8 + DZ); occ1(n0);
    /* --- 其它恐龙 --- */
    const skin2 = new MB(), sv = sauroMesh(), tr = triceMesh(); xfAppend(skin2, sv, 27, 0, -9 + DZ, .9, 0, 0, 1); obsC(27, -9 + DZ, 3.2); obs(24, -12 + DZ, 30, -5 + DZ); xfAppend(skin2, tr, 36, 0, -7 + DZ, -.8, 0, 0, 1.15); obsC(36, -7 + DZ, 2.4); xfAppend(skin2, tr, 22, 0, 3 + DZ, 2.4, 0, 0, .8); obsC(22, 3 + DZ, 1.6);
    occ(() => add(skin2, {})); }
  { const n0 = occ0(), mb = new MB(), fr = new MB(); [[20, -2.5, 6, 1.4], [24.5, 6, 5, .8], [38.2, -4, 6.5, 1.8], [40, 5, 5.2, -1], [33, -15, 6, 1], [30, 5, 5, 1.2], [10.5, 7, 5.6, .6], [21, -17, 5, 1.6], [50, 10, 5, 1.3]].forEach(([x, z, h, l], i) => { palm(mb, fr, x, z + DZ, h, l, 70 + i); obsC(x, z + DZ, .45); });
    add(mb, {}); add(fr, {}); occ1(n0);
    /* 恐龙蛋窝 */
    const nest = new MB(), eg = new MB(), r = rnd(9); const nx = 25.5, nz = 1.5 + DZ; { const ring = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU; ring.push([nx + Math.cos(a) * 1.5, .25, nz + Math.sin(a) * 1.5]); } tube(nest, ring, .3, 6, [.5, .36, .22]); }
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, e = [[.95, .92, .78], [.8, .93, .85], [.95, .82, .8], [.85, .85, .95], [.97, .9, .6]][i]; eg.sphere(nx + Math.cos(a) * .6, .55, nz + Math.sin(a) * .6, .36, .48, .36, e, 6); } eg.sphere(nx, .65, nz, .42, .55, .42, [.7, .95, .6], 6); obsC(nx, nz, 1.7);
    add(nest, {}); add(eg, {});
    /* 火山 */
    const vx = 57, vz = -8 + DZ, vo = new MB(); lathe(vo, vx, vz, [[7, 0], [6.4, 1.2], [5.2, 3.2], [3.8, 6], [2.5, 8.6], [1.9, 9.8], [1.5, 10.2], [1.2, 9.5], [.8, 8.8]], 14, [1, 1, 1], 3); add(vo, { tex: X0.rock, em: X0.rockE, emDay: .5, emNight: 2.2 });
    const lv = new MB(); lv.disc(vx, vz, 9.0, 1.35, 12, [1, .55, .1]); add(lv, emS('#ff8a1a', 1.0, 2.6)); obsC(vx, vz, 5.5); S.volcano = [vx, 10.4, vz];
    const vg = new MB(); bb(vg, vx, 10.2, vz, 7, 7, [1, .5, .15]); add(vg, { tex: T.glow, mode: 2, glow: e => .25 + night(e) * .7 });
    /* 化石：肋骨 / 头骨装饰（路边） */
    const fo = new MB(); for (let k = 0; k < 6; k++) { const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * PI * .85; pts.push([46.5 + k * .7, Math.sin(a) * 1.4, 12.6 + DZ + Math.cos(a) * 1.2 - 1.2]); } tube(fo, pts, .09, 4, [.95, .9, .78]); } add(fo, { tex: X0.bone });
  }

  /* ---------- 喷泉许愿 ---------- */
  HS.push({ id: 'wish', x: FOUNT.x, z: FOUNT.z + 6.4, r: 2.0, label: '喷泉许愿', color: [.5, .9, 1], icon: 10, btn: '投币许愿', iy: 4.6 });

  /* ---------- 入口门 + 回广场 ---------- */
  { const n0 = occ0(), gx = GATE.x, gz = GATE.z, mb = new MB(), em = new MB();
    mb.box(gx - 3.4, 0, gz - .3, gx - 2.9, 3.6, gz + .3, [.95, .35, .5]); mb.box(gx + 2.9, 0, gz - .3, gx + 3.4, 3.6, gz + .3, [.95, .35, .5]); mb.box(gx - 3.7, 3.6, gz - .4, gx + 3.7, 4.0, gz + .4, [.98, .8, .25]); add(mb, {});
    const sg = T.sign('回到星光广场', { w: 1024, h: 170, fs: 90, bg: '#10243a', fg: '#c8fff0', border: '#52e0b5' }), sb = new MB(); sb.quad([gx - 2.8, 2.0, gz + .32], [gx + 2.8, 2.0, gz + .32], [gx + 2.8, 3.4, gz + .32], [gx - 2.8, 3.4, gz + .32], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); sb.quad([gx + 2.8, 2.0, gz - .32], [gx - 2.8, 2.0, gz - .32], [gx - 2.8, 3.4, gz - .32], [gx + 2.8, 3.4, gz - .32], [0, 0, -1], [0, 0, 1, 1], [1, 1, 1]); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.3 });
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
    const bound = (a) => { let lo = .6, hi = 1.5; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2, x = CX + m * RX * Math.cos(a), z = CZ + m * (Math.sin(a) < 0 ? RZN : RZ) * Math.sin(a); if (rfun(x, z) < 1) lo = m; else hi = m; } return [CX + hi * RX * Math.cos(a), CZ + hi * (Math.sin(a) < 0 ? RZN : RZ) * Math.sin(a), a]; };
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
  { const x0 = -82, x1 = 82, z0 = -80, z1 = 62, cs = 1.0, cols = Math.ceil((x1 - x0) / cs), rows = Math.ceil((z1 - z0) / cs);
    for (let i = 0; i < cols; i++) { let run = null; const xa = x0 + i * cs, xb = xa + cs, xm = xa + cs / 2;
      for (let j = 0; j <= rows; j++) { const za = z0 + j * cs, bad = j < rows && !inside(xm, za + cs / 2); if (bad) { if (!run) run = za; } else if (run != null) { obs(xa, run, xb, za); run = null; } } } }

  /* 座位起身点：如果被障碍（花坛/灌木/灯柱）压住，就换到附近的空位，避免坐下→起身卡住 */
  { const hitO = (x, z, m) => S.obstacles.some(o => x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m);
    S.seats.forEach(s => { const m = .5; if (!hitO(s.ap[0], s.ap[1], m) && inside(s.ap[0], s.ap[1])) return; let best = null;
      for (const d of [1.2, 1.6, 2.0, 2.6, 3.2]) { for (const a of [0, .5, -.5, 1, -1, 1.5, -1.5, 2.2, -2.2, PI]) { const ang = s.yaw + a, x = s.x + Math.sin(ang) * d, z = s.z + Math.cos(ang) * d; if (!hitO(x, z, m) && inside(x, z) && lakeF(x, z) > 1.2) { best = [x, z]; break; } } if (best) break; }
      if (best) { s.ap = best; s.hot.x = best[0]; s.hot.z = best[1]; } }); }
  HS.forEach(h => { h.act = h.id; S.hotspots.push(h); });

  /* =====================================================================
     动态部分（摩天轮 / 旋转木马 / 过山车 / 摇摆飞椅 / 气球 / 喷泉 / 粒子 / 小游戏 / 乘坐）
     ===================================================================== */
  const mk = (mat) => { const b = add(Object.assign(new MB(), { i: [0, 0, 0] }), mat); if (b) b.bb = null; return b; };
  const dynOpaque = new MB(), bOpaque = mk({}), dynRide = new MB(), bRide = mk({});
  const dynIcons = new MB(), bIcons = mk({ tex: R.black, em: X.icons, emDay: 1, emNight: 0 });
  const dynSky = new MB(), bSky = mk({ tex: T.glow, mode: 2, glow: 1 });
  const dynCloud = new MB(), bCloud = mk({ tex: X.cloud, mode: 3, glow: .55 });
  const dynGlow = new MB(), bGlow = mk({ tex: T.glow, mode: 2, glow: 1 });
  const dynPart = new MB(), bPart = mk({ tex: T.glow, mode: 2, glow: 1 });
  const dynTal = new MB(), bTal = mk({ tex: X.talisman });

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
    wave(sec) { const g = host.g(); if (g && g.me) g.me.pose = sec || 2; },
    face(yaw) { const g = host.g(); if (g && g.me) g.me.yaw = yaw; },
    flash(color) { let f = document.getElementById('ffFlash'); if (!f) { f = document.createElement('div'); f.id = 'ffFlash'; f.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;z-index:99'; document.body.appendChild(f); } f.style.background = color || '#fff'; f.style.transition = 'none'; f.style.opacity = '.95'; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .6s ease-out'; f.style.opacity = '0'; })); },
  };
  const pick = a => a[(Math.random() * a.length) | 0];
  const spend = (n) => { if (host.balance() < n) { host.toast('金币不够啦（需要 ' + n + '）'); return false; } host.coins(-n); return true; };
  const HSG = id => HS.find(h => h.id === id);
  const FORTUNES = ['今天会遇到一个很有趣的人 ✨', '想做的事，现在就是最好的时机 🌟', '好运正在向你靠近，别走太远 🍀', '今晚的烟花是为你放的 🎆', '请朋友吃一份棉花糖，会有惊喜 🍭', '你的下一个愿望会成真 🌙', '小心鬼屋里的那一声“哇”👻', '摩天轮最高处，会看到你想看的 🎡'];

  /* ---------- 状态 ---------- */
  const st = {
    wheel: 0, car: 0, coS: 5, swing: 0, ride: null, rideX: 0, rideZ: 0, rideY: 0, rideObs: null,
    ring: { s: 0, t: 0, sweep: 0, fl: null }, bal: { s: 0, t: 0, dart: null, list: [] }, str: { s: 0, t: 0, m: 0, power: 0, lit: 0, done: 0 },
    haunt: 0, photoT: 0, showT: 0, nextShow: 0, baseDist: 25, fw: 0, fountT: 0,
  };
  { const b = HSG('balloon'); for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) st.bal.list.push({ x: b.bx + (c - 3) * .8, y: 1.75 + r * .58, z: b.bz - 2.0, col: (c + r * 2) % 6, alive: true, back: 0, ph: Math.random() * 6 }); }
  const OMEGA = .22, HORSES = 10;
  const horseBob = (i, t) => .55 + Math.sin(t * 2 + i * 1.3) * .32;
  const carPos = k => CO.at(st.coS - 3.5 * k);
  const coasterV = y => 3.2 + 2.0 * Math.sqrt(Math.max(0, CO.ymax + .5 - y));

  /* ---------- 乘坐 ---------- */
  function ridePos(r, t) {
    const W = WHEEL;
    if (r.kind === 'ferris') { const a = st.wheel + r.cab * TAU / W.n; return [W.x + Math.cos(a) * W.R, W.hub + Math.sin(a) * W.R - 2.7, W.z, 0]; }
    if (r.kind === 'carousel') { const a = st.car + r.horse * TAU / HORSES; return [CAR.x + Math.cos(a) * 3.9, horseBob(r.horse, t) + .95, CAR.z + Math.sin(a) * 3.9, Math.atan2(-Math.sin(a), Math.cos(a))]; }
    const p = carPos(1); return [p[0], p[1] + .45, p[2], p[3]];
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
        else if (s.s === 1) { s.power = s.m; s.s = 2; s.t = 0; s.done = 0; host.wave(1.5); }
        break; }
      case 'haunt': { const ap = window.__game && window.__game.api; if (ap && ap.goTo) { window.HZ_RETURN = 'funfair'; window.HZ_RETURN_SPAWN = [HAUNT.x, HAUNT.z + 7]; ap.goTo('haunted', null); } break; }
      case 'ring': case 'balloon': case 'fortune': case 'photo': case 'candy': case 'popcorn': case 'wish':
        if (st.gameOpen) break; host.face(PI); host.wave(1); S.openGame(h.id); break;
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
    { let drag = null; const isCv = ev => ev.target && (ev.target.id === 'gl' || ev.target.id === 'ov');
      window.addEventListener('pointerdown', ev => { if (!(st.ride && fp.on) || !isCv(ev)) return; drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }; ev.stopPropagation(); ev.preventDefault(); }, true);
      window.addEventListener('pointermove', ev => { if (!drag || ev.pointerId !== drag.id) return; fp.yaw -= (ev.clientX - drag.x) * .006; fp.pit = clamp(fp.pit + (ev.clientY - drag.y) * .005, -1.25, 1.25); drag.x = ev.clientX; drag.y = ev.clientY; if (fp.yaw > PI) fp.yaw -= TAU; if (fp.yaw < -PI) fp.yaw += TAU; }, true);
      const up = ev => { if (drag && ev.pointerId === drag.id) drag = null; }; window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true); }
    const btn = document.getElementById('enterBtn'), orig = btn.onclick;
    btn.onclick = e => { const n = (window.__game || {}).near; if (n && n.id === 'plaza' && window.FUNFAIR_STANDALONE) { host.toast('单独测试版：整合后这里会回到星光广场', 2200); return; } if (st.ride) endRide('已提前下车'); else if (n && n.act && S.hotspots.includes(n)) act(n); else if (orig) orig.call(btn, e); };
    window.addEventListener('keydown', ev => { if (ev.target && ev.target.tagName === 'INPUT') return; if (ev.key === 'e' || ev.key === 'E' || ev.key === 'Enter') { const n = (window.__game || {}).near; if (n && n.id === 'plaza' && window.FUNFAIR_STANDALONE) { host.toast('单独测试版：整合后这里会回到星光广场', 2200); ev.stopImmediatePropagation(); } else if (st.ride) { endRide('已提前下车'); ev.stopImmediatePropagation(); } else if (n && n.act && S.hotspots.includes(n)) { act(n); ev.stopImmediatePropagation(); } } }, true);
  }
  function envFair(h) { const e = Object.assign({}, envAt(h)); e.fog = mix(e.bot, e.top, .9); e.fogNear = 85; e.fogFar = 270; return e; }
  const sunCol = (e) => mix(mix([1, 1, .95], [1, .62, .3], e.gold), [.75, .85, 1], e.night);
  const rr = (k) => { const s = Math.sin(k * 12.9898) * 43758.5453; return s - Math.floor(s); };

  /* 恐龙列车：车头是张嘴的小恐龙，后面三节带背刺 */
  const carMesh = (head, col) => { const m = new MB(), dk = mul(col, .7), tooth = [.96, .94, .86];
    m.box(-.62, -.34, -1.35, .62, .0, 1.35, dk); m.box(-.7, 0, -1.3, -.55, .5, 1.3, col); m.box(.55, 0, -1.3, .7, .5, 1.3, col); m.box(-.62, 0, -1.35, .62, .5, -1.22, col);
    m.box(-.5, .05, -.9, .5, .38, -.1, [.2, .15, .25]); m.box(-.5, .05, .1, .5, .38, .9, [.2, .15, .25]); m.box(-.5, .38, -1.0, .5, 1.0, -.88, [.25, .2, .3]); m.box(-.5, .38, .0, .5, 1.0, .12, [.25, .2, .3]);
    [-.9, .9].forEach(z => { m.cyl(-.62, z, -.4, -.4, 0, 0, 3, col); }); [-.6, .6].forEach(x => [-1.0, 1.0].forEach(z => { tube(m, [[x, -.38, z - .12], [x, -.38, z + .12]], .13, 6, [.15, .15, .18]); }));
    if (head) { m.sphere(0, .28, 1.62, .55, .32, .5, col, 6); m.box(-.45, .02, 1.55, .45, .1, 2.2, dk); m.sphere(0, .3, 2.05, .4, .2, .3, mul(col, 1.1), 5);
      for (let i = 0; i < 5; i++) { m.cyl(-.36 + i * .18, 2.12, .08, .28, .035, 0, 4, tooth); m.cyl(-.36 + i * .18, 2.12, .08, -.1, .035, 0, 4, tooth); }
      m.sphere(-.38, .52, 1.78, .1, .1, .1, [1, .85, .2], 4); m.sphere(.38, .52, 1.78, .1, .1, .1, [1, .85, .2], 4); }
    else { for (let i = 0; i < 4; i++) m.cyl(0, -1.0 + i * .66, .5, .95 + (i % 2) * .12, .15, 0, 4, [1, .55, .15]); m.cyl(0, -1.6, .1, .3, .16, 0, 5, col); }
    return m; };
  const CARM = [carMesh(true, [.3, .72, .32]), carMesh(false, [.38, .78, .3]), carMesh(false, [.3, .66, .4]), carMesh(false, [.45, .78, .28])];
  /* ---------- 鬼屋 NPC：中式僵尸（蹦跳）/ 丧尸 / 吸血鬼，在鬼屋前的固定范围内游荡 ---------- */
  const ZR = { x0: -53, x1: -27, z0: -.4, z1: 9 };
  const ZS = [['jiang', -46, 3], ['jiang', -34, 6], ['jiang', -40, 8], ['zombie', -48, 7], ['zombie', -31, 2], ['vamp', -40, 4]].map(([k, x, z], i) => ({ k, x, z, tx: x, tz: z, yaw: Math.random() * TAU, ph: Math.random() * 6, wait: Math.random() * 2, ps: i }));
  function zombieStep(dt, t, me) {
    ZS.forEach(n => { const near = me ? Math.hypot(me.x - n.x, me.z - n.z) : 99, tgtP = near < 6.5 && me.x > ZR.x0 - 4 && me.x < ZR.x1 + 4 && me.z > ZR.z0 - 3 && me.z < ZR.z1 + 3; let sp = n.k === 'jiang' ? 2.4 : n.k === 'zombie' ? .9 : 1.15;
      if (tgtP) { if (near > 2.4) { n.tx = clamp(me.x, ZR.x0, ZR.x1); n.tz = clamp(me.z, ZR.z0, ZR.z1); } else { n.tx = n.x; n.tz = n.z; } n.wait = 0; } else if (n.wait > 0) n.wait -= dt; else if (Math.hypot(n.tx - n.x, n.tz - n.z) < .6) { n.wait = 1 + Math.random() * 3; n.tx = ZR.x0 + Math.random() * (ZR.x1 - ZR.x0); n.tz = ZR.z0 + Math.random() * (ZR.z1 - ZR.z0); }
      const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz); n.ph += dt * (n.k === 'jiang' ? 8 : n.k === 'zombie' ? 4.2 : 3);
      if (d > .3 && !(n.wait > 0 && !tgtP)) { const want = Math.atan2(dx, dz); let da = want - n.yaw; while (da > PI) da -= TAU; while (da < -PI) da += TAU; n.yaw += da * Math.min(1, dt * (n.k === 'jiang' ? 5 : 3));
        const hopF = n.k === 'jiang' ? Math.max(0, Math.sin(n.ph)) : 1, v = sp * hopF * (n.k === 'jiang' ? 1.4 : 1); n.x += Math.sin(n.yaw) * v * dt; n.z += Math.cos(n.yaw) * v * dt; n.moving = true; } else n.moving = false; });
  }
  const ZG = [];
  function zombieDraw(mb, tal, gm, t) {
    ZS.forEach(n => { const fw = [Math.sin(n.yaw), 0, Math.cos(n.yaw)], rt = [Math.cos(n.yaw), 0, -Math.sin(n.yaw)], hop = n.k === 'jiang' ? Math.abs(Math.sin(n.ph)) * .38 : 0, bob = n.k === 'zombie' ? Math.abs(Math.sin(n.ph)) * .05 : n.k === 'vamp' ? Math.sin(t * 2 + n.ps) * .04 : 0;
      const P = (f, u, r) => [n.x + fw[0] * f + rt[0] * r, u + hop + bob, n.z + fw[2] * f + rt[2] * r], sw = n.moving ? Math.sin(n.ph) : 0, idle = Math.sin(t * 1.3 + n.ps) * .05;
      const skin = n.k === 'jiang' ? [.62, .74, .6] : n.k === 'zombie' ? [.52, .72, .42] : [.96, .92, .92], body = n.k === 'jiang' ? [.1, .22, .3] : n.k === 'zombie' ? [.36, .36, .44] : [.08, .06, .1], pant = n.k === 'jiang' ? [.1, .2, .26] : n.k === 'zombie' ? [.3, .24, .18] : [.1, .08, .12];
      /* 腿 */ [-1, 1].forEach(s => { const sg = n.k === 'jiang' ? .05 : sw * s * (n.k === 'zombie' ? .38 : .25), foot = P(sg, .06 + (n.k === 'jiang' ? 0 : Math.max(0, sw * s) * .12), s * .14); tube(mb, [P(0, .95, s * .14), P(sg * .5, .5, s * .14), foot], .085, 5, pant); ob(mb, [foot[0] + fw[0] * .08, foot[1] + .03 - hop - bob + hop + bob, foot[2] + fw[2] * .08], fw, [0, 1, 0], rt, -.14, .14, -.04, .05, -.07, .07, [.08, .08, .1]); });
      /* 躯干 + 衣物 */ const hipY = .95, tp = P(n.k === 'zombie' ? .06 : 0, 1.25, 0); ob(mb, tp, fw, [0, 1, 0], rt, -.15, .15, -.34, .36, -.27, .27, body);
      if (n.k === 'jiang') { mb.cyl(n.x, n.z, .4 + hop, 1.0 + hop, .36, .27, 8, body); ob(mb, P(.16, 1.3, 0), fw, [0, 1, 0], rt, 0, .02, -.2, .25, -.17, .17, [.2, .38, .5]); ob(mb, P(.16, 1.3, 0), fw, [0, 1, 0], rt, .02, .03, -.05, .05, -.17, .17, [.85, .7, .25]); }
      if (n.k === 'zombie') { ob(mb, P(.17, 1.25, .1), fw, [0, 1, 0], rt, 0, .02, -.2, .2, -.1, .12, [.6, .08, .1]); ob(mb, P(.0, 1.0, -.12), fw, [0, 1, 0], rt, -.17, .17, -.08, .1, -.08, .2, [.2, .15, .15]); }
      if (n.k === 'vamp') { ob(mb, P(.16, 1.3, 0), fw, [0, 1, 0], rt, 0, .02, -.2, .3, -.11, .11, [.95, .95, .98]); tube(mb, [P(.17, 1.52, -.05), P(.2, 1.38, 0), P(.17, 1.52, .05)], .02, 3, [.7, .05, .1]);
        const sh = Math.sin(t * 2 + n.ps) * .12, c0 = [.55, .04, .08]; [P(-.14, 1.6, -.3), P(-.14, 1.6, .3), P(-.9 - sh, .1, .65), P(-.9 - sh, .1, -.65)].forEach(() => 0); const q = [P(-.14, 1.62, -.28), P(-.14, 1.62, .28), P(-.95 - sh, .05, .72 + sh * .5), P(-.95 - sh, .05, -.72 - sh * .5)]; mb.quad(q[0], q[1], q[2], q[3], [-fw[0], 0, -fw[2]], [0, 0, 1, 1], c0); mb.quad(q[1], q[0], q[3], q[2], [fw[0], 0, fw[2]], [0, 0, 1, 1], [.07, .05, .09]); }
      /* 头 */ const hf = n.k === 'zombie' ? .12 : 0, hp = P(hf, 1.8, 0); mb.sphere(hp[0], hp[1], hp[2], .2, .23, .2, skin, 6);
      const eyeC = n.k === 'zombie' ? [.9, 1, .3] : n.k === 'vamp' ? [1, .1, .1] : [.05, .05, .05]; [-1, 1].forEach(s => { const e = P(hf + .17, 1.84, s * .08); mb.sphere(e[0], e[1], e[2], .035, .035, .035, eyeC, 4); if (n.k === 'vamp') ZG.push([e[0], e[1], e[2], .35, [1, .15, .15]]); if (n.k === 'zombie') ZG.push([e[0], e[1], e[2], .3, [.7, 1, .2]]); const f2 = P(hf + .17, 1.7, s * .045); if (n.k !== 'zombie') mb.cyl(f2[0], f2[2], f2[1] - .04, f2[1] + .02, .018, 0, 3, [1, 1, .95]); });
      if (n.k === 'jiang') { const hpp = P(0, 0, 0); mb.cyl(hp[0], hp[2], 1.92 + hop, 2.32 + hop, .3, .14, 8, [.06, .06, .08]); mb.cyl(hp[0], hp[2], 1.88 + hop, 1.97 + hop, .31, .31, 8, [.7, .06, .08]); mb.sphere(hp[0], 2.38 + hop, hp[2], .07, .07, .07, [.8, .08, .1], 4);
        const a = P(.24, 2.1, -.14), b = P(.24, 2.1, .14), c2 = P(.24, 1.45, .14), d2 = P(.24, 1.45, -.14); tal.quad(d2, c2, b, a, fw, [0, 0, 1, 1], [1, 1, 1]); mb.tri(P(-.06, 2.0, -.15), P(-.06, 2.0, .15), P(-.2, 2.35, 0), fw, [.7, .06, .08]); }
      if (n.k === 'vamp') { mb.sphere(hp[0] - fw[0] * .02, hp[1] + .1, hp[2] - fw[2] * .02, .22, .17, .22, [.04, .03, .05], 6); mb.tri(P(.14, 2.02, -.06), P(.14, 2.02, .06), P(.2, 1.8, 0), fw, [.05, .04, .06]); }
      if (n.k === 'zombie') { const w2 = P(hf + .03, 1.9, -.17); mb.sphere(w2[0], w2[1], w2[2], .09, .07, .06, [.6, .05, .08], 4); }
      /* 手臂 */ [-1, 1].forEach(s => { const sh = P(0, 1.52, s * .31); let el, hd; if (n.k === 'jiang') { el = P(.45, 1.5 + idle * .3, s * .3); hd = P(.9, 1.5 + idle * .3, s * .3); } else if (n.k === 'zombie') { const up = s > 0 ? .12 : -.12; el = P(.4, 1.38 + up, s * .32); hd = P(.78, 1.34 + up + Math.sin(n.ph * .5 + s) * .08, s * .3); } else { el = P(-.15, 1.65, s * .6); hd = P(-.4, 1.3, s * .95 + Math.sin(t * 2 + n.ps) * .1); }
        tube(mb, [sh, el, hd], n.k === 'vamp' ? .06 : .075, 5, n.k === 'jiang' ? body : n.k === 'zombie' ? [.45, .6, .36] : body); mb.sphere(hd[0], hd[1], hd[2], .07, .07, .07, skin, 4); if (n.k === 'zombie') [-.03, .03].forEach(o => tube(mb, [hd, P(.9, hd[1] - hop - bob - .05, s * .3 + o)], .012, 3, skin)); }); });
  }
  const BATS = [0, 1, 2, 3, 4, 5].map(i => ({ ph: i * 1.05, r: 7 + i * 1.3, y: 10 + (i % 3) * 1.8, s: .5 + (i % 3) * .12 }));
  function batsDraw(mb, t) { BATS.forEach((b, i) => { const a = t * (.5 + b.s * .35) * (i % 2 ? 1 : -1) + b.ph, x = HAUNT.x + Math.cos(a) * b.r * 1.5, z = HAUNT.z + 1 + Math.sin(a) * b.r * .8, y = b.y + Math.sin(t * 1.3 + b.ph) * 1.2, dx = (i % 2 ? -1 : 1) * -Math.sin(a), dz = (i % 2 ? -1 : 1) * Math.cos(a), yw = Math.atan2(dx, dz), fw = [Math.sin(yw), 0, Math.cos(yw)], rt = [Math.cos(yw), 0, -Math.sin(yw)], fl = Math.sin(t * 13 + b.ph * 3), P = (f, u, r) => [x + fw[0] * f + rt[0] * r, y + u, z + fw[2] * f + rt[2] * r], c = [.07, .05, .09];
    mb.sphere(x, y, z, .12, .1, .2, c, 4); mb.sphere(fw[0] * .2 + x, y + .03, fw[2] * .2 + z, .08, .08, .08, c, 4); mb.tri(P(.24, .1, .04), P(.24, .1, -.04), P(.22, .2, 0), [0, 1, 0], c); [-1, 1].forEach(s => { mb.tri(P(.1, 0, s * .1), P(-.12, 0, s * .1), P(-.2, .45 * fl, s * 1.0), [0, 1, 0], c); mb.tri(P(.1, 0, s * .1), P(-.2, .45 * fl, s * 1.0), P(.25, .3 * fl, s * .75), [0, 1, 0], mul(c, 1.4)); }); }); }
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
    { const y = carPos(0)[1], onLift = st.coS % CO.total > CO.s0 && st.coS % CO.total < CO.s1; st.coS += (onLift ? 3.8 : coasterV(y)) * dt; }

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
    { const cx = st.ride ? [-62, 72] : [-40, 40], cz = st.ride ? [-52, 44] : [-34, 34]; [S.camera, S.cameraWide].forEach(c => { c.clampX = cx; c.clampZ = cz; }); }
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
      for (let i = 0; i < 9; i++) { const x = 6 + Math.random() * 52, z = -60 - Math.random() * 14, hh = 13 + Math.random() * 4, cc = pick(cols), t0 = t + i * 1.1 + .2;
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
    /* 性能：屏幕外的游乐设施这一帧不重新生成几何 */
    const vis = (x0, y0, z0, x1, y1, z1) => st.ride || !R.view || !R.view.VP || inView([[x0, y0, z0], [x1, y1, z1]], R.view.VP, 3);
    const visW = vis(W.x - W.R - 3, 0, W.z - 3, W.x + W.R + 3, W.hub + W.R + 3, W.z + 8), visC = vis(CAR.x - 7.5, 0, CAR.z - 7.5, CAR.x + 7.5, 11, CAR.z + 7.5), visS = vis(44, 0, 0, 64, 17, 20), visG = vis(GATE.x - 8, 0, GATE.z - 3, GATE.x + 8, 7, GATE.z + 3);
    // 摩天轮、旋转木马：慢速转动，30Hz 更新即可（省一半 CPU / 上传）
    const doRide = st.ride || fr % 2 === 0 || !S._ri;
    if (doRide) { const mb = dynRide; mb.v.length = 0; mb.i.length = 0; mb.n = 0;
    if (visW) for (let i = 0; i < W.n; i++) { const a = st.wheel + i * TAU / W.n, px = W.x + Math.cos(a) * W.R, py = W.hub + Math.sin(a) * W.R;
      [-.9, .9].forEach(zo => tube(mb, [[W.x, W.hub, W.z + zo], [px, py, W.z + zo]], .07, 4, [.99, .92, .95]));
      xfAppend(mb, CABIN[i % 4], px, py - 2.95, W.z, 0, 0, 0, 1); [-.6, .6].forEach(dz => tube(mb, [[px, py - .1, W.z + dz * .5], [px + dz * 0, py - .8, W.z + dz * .8], [px, py - 0.95 + 0, W.z + dz * .8]], .025, 3, WGOLD)); tube(mb, [[px, py, W.z - .9], [px, py, W.z + .9]], .05, 4, WGOLD); [-.9, .9].forEach(zz => tube(mb, [[px, py, W.z + zz], [px, py - 1.0, W.z + zz * .5], [px, py - .85, W.z + zz * .5]], .03, 3, [.9, .9, .95])); }
    // 旋转木马（豪华马）
    if (visC) for (let i = 0; i < HORSES; i++) { const a = st.car + i * TAU / HORSES, x = CAR.x + Math.cos(a) * 3.9, z = CAR.z + Math.sin(a) * 3.9, y = horseBob(i, t), tx = -Math.sin(a), tz = Math.cos(a);
      tube(mb, [[x, .56, z], [x, 5.35, z]], .05, 5, [.98, .82, .35]); for (let q = 0; q < 7; q++) mb.sphere(x, .9 + q * .62, z, .075, .075, .075, [1, .55, .72], 4); xfAppend(mb, HM[i % 5], x, y - .05, z, Math.atan2(tx, tz), 0, 0, .95); }
    if (visC) for (let i = 0; i < 5; i++) { const a = -st.car * .9 + i * TAU / 5, x = CAR.x + Math.cos(a) * 2.35, z = CAR.z + Math.sin(a) * 2.35, bb0 = horseBob(i, t) * .6, tx = -Math.sin(a), tz = Math.cos(a); mb.cyl(x, z, .56, 5.3, .04, .04, 4, WGOLD);
      mb.cyl(x, z, .55 + bb0, .62 + bb0, .62, .62, 10, [.98, .8, .3]); mb.cyl(x, z, .62 + bb0, .86 + bb0, .6, .56, 10, PAL[i % 6]); mb.sphere(x - tx * .1, .98 + bb0, z - tz * .1, .5, .22, .45, [1, 1, 1], 6); mb.sphere(x + tx * .55, 1.45 + bb0, z + tz * .55, .17, .3, .17, [1, 1, 1], 5); mb.sphere(x + tx * .66, 1.76 + bb0, z + tz * .66, .13, .12, .13, [1, 1, 1], 5); mb.sphere(x + tx * .8, 1.74 + bb0, z + tz * .8, .09, .04, .06, [1, .6, .2], 4); }
    }
    // 过山车列车
    for (let k = 0; k < 4; k++) { const f = CO.frame(st.coS - 3.5 * k); xfBasis(mb, CARM[k], f.p, f.T, f.U); }
    // 摇摆飞椅
    if (doRide) { const mb = dynRide;
    if (visS) { const sx0 = 54, sz0 = 10; mb.cyl(sx0, sz0, 0, 13, .5, .3, 8, [.95, .9, .95]); const sp = st.swing, ra = Math.min(1, 1.2 + Math.sin(sp * .3) * .3);
      mb.cyl(sx0, sz0, 12.8, 13.4, 4.8, 4.8, 20, [1, .5, .65], true); mb.cyl(sx0, sz0, 13.4, 15.2, 4.9, .2, 12, [1, .85, .3]);
      for (let i = 0; i < 12; i++) { const a = sp + i * TAU / 12, swing = .75 + Math.sin(sp * .25) * .15, rx = 4.2 + Math.sin(swing) * 3.4, ry = 12.8 - Math.cos(swing) * 3.4 - 1.6, cx = sx0 + Math.cos(a) * rx, cz = sz0 + Math.sin(a) * rx;
        tube(mb, [[sx0 + Math.cos(a) * 4.2, 12.8, sz0 + Math.sin(a) * 4.2], [cx, ry + 1.2, cz]], .03, 3, [.85, .85, .9]); mb.box(cx - .35, ry, cz - .35, cx + .35, ry + .12, cz + .35, PAL[i % 6]); mb.box(cx - .35, ry + .12, cz - .35, cx + .35, ry + .7, cz - .28, PAL[i % 6]); } }
    // 入口彩色气球（飘浮）
    if (visG) for (let i = 0; i < 9; i++) { const sd = i < 5 ? -1 : 1, kq = i < 5 ? i : i - 5, bx = GATE.x + sd * (3.9 + kq * .85), bz = GATE.z - .3 + (kq % 2) * .5, by = 4.2 + Math.sin(t * 1.1 + i) * .3 + (kq % 3) * .45; mb.sphere(bx, by, bz, .5, .62, .5, BALC[i % 6], 6); tube(mb, [[bx, by - .6, bz], [bx + Math.sin(t + i) * .1, .28, bz]], .012, 3, [.9, .9, .9]); mb.box(bx - .14, 0, bz - .14, bx + .14, .28, bz + .14, BALC[i % 6]); }
    if (doRide) { upload(bRide, dynRide); S._ri = 1; } }
    // 打气球摊的气球
    B_.list.forEach(b => { if (b.alive) { mb.sphere(b.x, b.y + Math.sin(t * 2 + b.ph) * .03, b.z, .3, .36, .3, BALC[b.col], 5); } });
    // 大力锤的小球
    if (S_.s === 2) { const ph = S_.power * 7 * (1 - Math.pow(1 - Math.min(1, S_.t / 1.1), 2.2)); mb.sphere(strH.bx + 5.4, .95 + ph, strH.bz - .62, .2, .2, .2, [1, .3, .3], 6); }
    // 飞镖 / 套圈
    if (B_.s === 2) { const d = B_.dart, u = Math.min(1, d.t); const p = [lerp(d.from[0], d.to[0], u), lerp(d.from[1], d.to[1], u), lerp(d.from[2], d.to[2], u)]; tube(mb, [[p[0], p[1], p[2]], [p[0], p[1], p[2] + .5]], [.03, .03], 3, [.95, .9, .3]); mb.sphere(p[0], p[1], p[2] - .04, .06, .06, .06, [1, .3, .3], 3); }
    if (R_.s === 2) { const f = R_.fl, u = Math.min(1, f.t), p = [lerp(f.from[0], f.to[0], u), lerp(f.from[1], f.to[1], u) + Math.sin(u * PI) * 1.8, lerp(f.from[2], f.to[2], u)], pts = []; for (let i = 0; i <= 9; i++) { const a = i / 9 * TAU; pts.push([p[0] + Math.cos(a) * .3, p[1], p[2] + Math.sin(a) * .3]); } tube(mb, pts, .045, 3, [1, .85, .3]); }
    // 翼龙（绕着过山车盘旋）
    for (let i = 0; i < 3; i++) { const a = t * (.16 + i * .03) + i * 2.1, rx = 30 + i * 4, rz = 20 + i * 3, cx0 = 32, cz0 = -6 + DZ, x = cx0 + Math.cos(a) * rx, z = cz0 + Math.sin(a) * rz, y = 17 + i * 2.2 + Math.sin(t * .7 + i) * 1.6, dx = -Math.sin(a) * rx, dz = Math.cos(a) * rz, yw = Math.atan2(dx, dz), fl = Math.sin(t * 4.2 + i * 1.7), c = [[.55, .38, .5], [.4, .5, .6], [.6, .45, .3]][i], sc = 1.3;
      const fw = [Math.sin(yw), 0, Math.cos(yw)], rt = [Math.cos(yw), 0, -Math.sin(yw)], P = (f, u, r) => [x + fw[0] * f * sc + rt[0] * r * sc, y + u * sc, z + fw[2] * f * sc + rt[2] * r * sc];
      mb.sphere(x, y, z, .35 * sc, .28 * sc, .9 * sc, c, 5); mb.tri(P(1.3, .0, .15), P(1.3, .0, -.15), P(2.4, -.1, 0), [0, 1, 0], [.9, .5, .3]); mb.tri(P(.6, .15, .1), P(.6, .15, -.1), P(-.7, .9, 0), [0, 1, 0], mul(c, 1.2));
      [-1, 1].forEach(s2 => { mb.tri(P(.5, 0, s2 * .2), P(-.6, 0, s2 * .2), P(-1.4, 1.4 * fl * .6 + .1, s2 * 3.4), [0, 1, 0], c); mb.tri(P(.5, 0, s2 * .2), P(-1.4, 1.4 * fl * .6 + .1, s2 * 3.4), P(.9, .9 * fl * .6, s2 * 3.0), [0, 1, 0], mul(c, 1.15)); }); mb.tri(P(-.6, 0, .1), P(-.6, 0, -.1), P(-2.0, -.1, 0), [0, 1, 0], c); }
    dynTal.v.length = 0; dynTal.i.length = 0; dynTal.n = 0; zombieStep(dt, t, me); zombieDraw(mb, dynTal, dynGlow, t); batsDraw(mb, t); upload(bTal, dynTal);
    upload(bOpaque, mb);

    /* ---- 发光层：灯泡链、准星、鬼屋、水晶球、喷泉 ---- */
    const gi = .22 + e.night * .78, gm = dynGlow; gm.v.length = 0; gm.i.length = 0; gm.n = 0; const cyc = Math.floor(t * 6);
    if (visW) { const RC = [[1, .55, .72], [1, .86, .92], [1, .9, .62], [1, .66, .82]], hb = (u, sc) => [16 * Math.pow(Math.sin(u), 3) * sc, (13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) * sc];
      for (let k = 0; k < 2; k++) { const zo = k ? .9 : -.9; for (let i = 0; i < 64; i++) { const a = i / 64 * TAU, c = RC[(i + (cyc >> 1)) % 4], on = (.45 + .8 * Math.max(0, Math.sin(t * 2.6 - i * .4))) * gi; bb(gm, W.x + Math.cos(a) * W.R, W.hub + Math.sin(a) * W.R, W.z + zo, .5, .5, mul(c, on)); if (i % 2 === 0) bb(gm, W.x + Math.cos(a) * W.R * .72, W.hub + Math.sin(a) * W.R * .72, W.z + zo, .34, .34, mul(RC[(i >> 1) % 4], .55 * gi)); } }
      for (let i = 0; i < W.n; i++) { const a = st.wheel + i * TAU / W.n; for (let j = 1; j <= 6; j++) { const r = j * W.R / 7; bb(gm, W.x + Math.cos(a) * r, W.hub + Math.sin(a) * r, W.z + .95, .36, .36, mul(RC[(i + j) % 4], (.35 + .5 * Math.max(0, Math.sin(t * 3 - j * .8 + i))) * gi)); } bb(gm, W.x + Math.cos(a) * W.R, W.hub + Math.sin(a) * W.R - 1.9, W.z, 1.9, 1.9, mul([1, .85, .6], .55 * gi)); bb(gm, W.x + Math.cos(a) * W.R, W.hub + Math.sin(a) * W.R - 2.95 + .1, W.z, 1.0, 1.0, mul([1, .6, .75], .35 * gi)); }
      for (let q = 0; q < 3; q++) { const a = st.wheel + q * TAU / 3 + .5, cx = W.x + Math.cos(a) * W.R * .45, cy = W.hub + Math.sin(a) * W.R * .45; for (let k = 0; k < 22; k++) { const h = hb(k / 22 * TAU, .085); bb(gm, cx + h[0], cy + h[1] + .2, W.z + 1.0, .3, .3, mul([1, .45, .65], (.7 + .5 * Math.sin(t * 4 + q)) * gi)); } }
      for (let k = 0; k < 40; k++) { const h = hb(k / 40 * TAU, .2); bb(gm, W.x + h[0], 4.6 + h[1], W.z + 4.4 + .1, .36, .36, mul([1, .6, .78], (.6 + .6 * Math.max(0, Math.sin(t * 3 - k * .3))) * gi)); }
      bb(gm, W.x, W.hub, W.z + 1.2, 3.2, 3.2, mul([1, .8, .85], .6 * gi)); bb(gm, W.x, W.hub, W.z + 1.2, 1.4, 1.4, mul([1, 1, 1], .8 * gi)); }
    if (visC) for (let i = 0; i < 44; i++) { const a = i / 44 * TAU, c = [[1, .55, .72], [1, 1, 1], [1, .85, .4]][(i + (cyc >> 1)) % 3]; bb(gm, CAR.x + Math.cos(a) * 6.55, 5.0, CAR.z + Math.sin(a) * 6.55, .5, .5, mul(c, (.55 + .6 * Math.max(0, Math.sin(t * 3 - i * .5))) * gi)); if (i % 2 === 0) bb(gm, CAR.x + Math.cos(a) * 6.0, 1.55, CAR.z + Math.sin(a) * 6.0, .3, .3, mul([1, .75, .85], .5 * gi)); }
    if (visC) for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; bb(gm, CAR.x + Math.cos(a) * 3.0, 5.05, CAR.z + Math.sin(a) * 3.0, .42, .42, mul([1, .9, .6], (.6 + .4 * Math.sin(t * 2 + i)) * gi)); }
    if (visC) bb(gm, CAR.x, 5.1, CAR.z, 6.5, 6.5, mul([1, .75, .85], .28 * gi)); bb(gm, CAR.x, 9.8, CAR.z, 2.4, 2.4, mul([1, .85, .4], .8 * gi));
    if (Math.random() < .12) addP(WHEEL.x + (Math.random() - .5) * 15, WHEEL.hub + WHEEL.R + 1, WHEEL.z + (Math.random() - .5) * 5, (Math.random() - .5) * .8, -.5, (Math.random() - .5) * .8, 6, .16, [1, .62, .78], -.15, .3);
    if (visS) { const cx = 54, cz = 10; for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + st.swing * .2; bb(gm, cx + Math.cos(a) * 4.8, 12.8, cz + Math.sin(a) * 4.8, .45, .45, mul(PAL[(i + cyc) % 6], .9 * gi)); } }
    // 游戏摊的准星
    if (R_.s === 1) bb(gm, ringH.bx + R_.sweep, 2.05, ringH.bz - 1.2, .8, .8, mul([1, .4, .6], .9 + .3 * Math.sin(t * 12)));
    if (B_.s === 1) { const c = crossPos(); bb(gm, c[0], c[1], c[2], .5, .5, mul([1, .3, .3], 1.1)); bb(gm, c[0], c[1], c[2], 1.1, 1.1, mul([1, .6, .6], .35)); }
    if (S_.s >= 1) { const tx = strH.bx + 5.4, tz = strH.bz - 1.2; for (let i = 0; i < 14; i++) { const y = .9 + i * .5, lit = S_.s === 2 ? y <= .9 + S_.power * 7 * (1 - Math.pow(1 - Math.min(1, S_.t / 1.1), 2.2)) + .01 : false, c = i < 8 ? [.4, 1, .5] : i < 12 ? [1, .85, .3] : [1, .3, .3]; bb(gm, tx, y, tz + .44, lit ? .42 : .2, lit ? .42 : .2, mul(c, lit ? 1.3 : .22)); }
      if (S_.s === 1) { const my = .9 + S_.m * 7; bb(gm, tx, my, tz + .5, .62, .2, mul([1, .95, .5], 1.3)); bb(gm, tx, my, tz + .5, 1.1, .5, mul([1, .9, .4], .35)); } }
    // 占卜水晶球、鬼屋门口、喷泉光
    if (S.crystal) bb(gm, S.crystal[0], S.crystal[1], S.crystal[2], 1.1, 1.1, mul([.7, .6, 1], .6 + .4 * Math.sin(t * 2.4)));
    ZG.forEach(g => bb(gm, g[0], g[1], g[2], g[3], g[3], g[4])); ZG.length = 0; for (let i = 0; i < 6; i++) { const fx = HAUNT.x + Math.sin(t * .3 + i * 1.7) * 9, fz = HAUNT.z + 4 + Math.cos(t * .25 + i * 2.3) * 3; bb(gm, fx, .5, fz, 4.5, 1.6, mul([.4, 1, .5], (.14 + .1 * Math.sin(t + i)) * (.4 + e.night))); }
    const hh = HSG('haunt'); if (st.haunt > 0 && Math.random() < .5) bb(gm, hh.x, 2 + Math.random(), hh.z - 3, 3, 3, [.3, 1, .3]);
    for (let i = 0; i < 6; i++) bb(gm, FOUNT.x + Math.cos(i * 1.047 + t * .6) * 3.6, 1.2, FOUNT.z + Math.sin(i * 1.047 + t * .6) * 3.6, .8, .8, mul(PAL[(i + cyc) % 6], .45 + gi * .5));
    // 湖面闪光 + 萤火虫
    { const gc = mix(mix([1, 1, 1], [1, .75, .4], e.gold), [.6, .75, 1], e.night); for (let i = 0; i < 70; i++) { const x = LAKE.x + (rr(i) - .5) * LAKE.rx * 1.6, z = LAKE.z + (rr(i + 9) - .5) * LAKE.rz * 1.6, a = Math.pow(Math.max(0, Math.sin(t * (2 + rr(i + 3) * 2) + rr(i + 7) * 6)), 4) * (.3 + e.gold * .6 + e.night * .7 + e.day * .3); if (a > .03 && lakeF(x, z) < .95) bb(gm, x, -.05, z, .4, .12, mul(gc, a)); }
      if (e.night > .2) for (let i = 0; i < 40; i++) { const bx = (rr(i + 50) - .5) * 120 + camX * .3, bz = (rr(i + 70) - .5) * 60, x = bx + Math.sin(t * .5 + i) * 2, y = 1 + rr(i + 3) * 3 + Math.sin(t * .9 + i * 2) * .5, z = bz + Math.cos(t * .4 + i) * 2, a = (.4 + .4 * Math.sin(t * 2 + i)) * e.night; if (inside(x, z)) bb(gm, x, y, z, .22, .22, mul([.8, 1, .4], a)); } }
    // 过山车 / 灯泡之外：路灯等静态已处理
    upload(bGlow, gm);

    /* ---- 喷泉水花 + 粒子 ---- */
    st.fountT += dt; while (st.fountT > .03) { st.fountT -= .03; const a = Math.random() * TAU, s = Math.random() * 1.2; addP(FOUNT.x + Math.cos(a) * .2, 4.0, FOUNT.z + Math.sin(a) * .2, Math.cos(a) * s, 6 + Math.random() * 2, Math.sin(a) * s, 1.1, .12, [.75, .92, 1], -9, 0); if (Math.random() < .35) { const b = Math.random() * TAU; addP(FOUNT.x + Math.cos(b) * 2.6, 2.6, FOUNT.z + Math.sin(b) * 2.6, Math.cos(b) * 1.2, 3.5, Math.sin(b) * 1.2, .9, .1, [.75, .92, 1], -9, 0); } }
    /* ---- 霸王龙喷火 + 火山余烬 + 鼻孔烟 ---- */
    { st.fireT = (st.fireT || 0) + dt; const f0 = CO.frame(st.coS), atM = Math.abs(f0.p[0] - DINO.x) < 2 && f0.p[2] > 1 + DZ && f0.p[2] < 9 + DZ && f0.p[1] < 5; if (atM) st.fireB = 1.4; st.fireB = Math.max(0, (st.fireB || 0) - dt);
      const cyc = st.fireT % 7, br = cyc < 1.5 || st.fireB > 0; if (br) for (let k = 0; k < 4; k++) { const sp = 7 + Math.random() * 5; addP(DINO.x + (Math.random() - .5) * 1.4, 3.7 + Math.random() * .6, DINO.zm + .2, (Math.random() - .5) * 1.4, .4 + Math.random() * 1.4, sp, .8 + Math.random() * .5, .9 + Math.random() * .7, Math.random() < .5 ? [1, .55, .12] : [1, .85, .3], 1.5, .9); }
      if (Math.random() < .25) [-.8, .8].forEach(x => addP(DINO.x + x, 8.1, DINO.zm + .3, 0, 1.0, 1.0, 1.4, .5, [.5, .5, .55], 1, .6));
      if (S.volcano && Math.random() < .5) addP(S.volcano[0] + (Math.random() - .5) * 1.5, S.volcano[1], S.volcano[2] + (Math.random() - .5) * 1.5, (Math.random() - .5) * 2.4, 5 + Math.random() * 4, (Math.random() - .5) * 2.4, 1.6, .35, [1, .5, .1], -4, .2); }
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
  function fp_reset() { fp.sm = null; fp.yaw = 0; fp.pit = 0; }
  const M4 = G.World.M4, fp = { on: true, k: 0, rig: null, sm: null, btn: null, yaw: 0, pit: 0, hint: 0 };
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function computeRig(dt, t) {
    const r = st.ride; fp.k += ((r && fp.on ? 1 : 0) - fp.k) * (1 - Math.exp(-4.5 * dt)); if (Math.abs(fp.k - (r && fp.on ? 1 : 0)) < .002) fp.k = r && fp.on ? 1 : 0;
    if (fp.btn) { fp.btn.style.display = r ? 'block' : 'none'; fp.btn2.style.display = r && fp.on ? 'block' : 'none'; }
    if (!r) return; const p = ridePos(r, t); let eye, F, U = [0, 1, 0], fov = 1.05;
    if (r.kind === 'ferris') { const sw = .12 * Math.sin(t * .5); F = [-Math.sin(sw), 0, -Math.cos(sw)]; eye = [p[0], p[1] + 1.55, p[2]]; fov = 1.15; }
    else if (r.kind === 'carousel') { const a = st.car + r.horse * TAU / HORSES; F = [-Math.sin(a), 0, Math.cos(a)]; eye = [p[0] + F[0] * .25, p[1] + 1.7, p[2] + F[2] * .25]; fov = 1.1; }
    else { const f = CO.frame(st.coS - 3.5 * 1 + .6); U = f.U; F = f.T; eye = [f.p[0] + U[0] * 1.75 + F[0] * .5, f.p[1] + U[1] * 1.75 + F[1] * .5, f.p[2] + U[2] * 1.75 + F[2] * .5]; fov = 1.25; }
    const Rr = crs(F, U), cy = Math.cos(fp.yaw), sy = Math.sin(fp.yaw), cp = Math.cos(fp.pit), sp = Math.sin(fp.pit);
    const d = [(F[0] * cy + Rr[0] * sy) * cp + U[0] * sp, (F[1] * cy + Rr[1] * sy) * cp + U[1] * sp, (F[2] * cy + Rr[2] * sy) * cp + U[2] * sp], tgt = [eye[0] + d[0] * 20, eye[1] + d[1] * 20, eye[2] + d[2] * 20];
    if (!fp.sm) fp.sm = tgt.slice(); const kk = 1 - Math.exp(-(r.kind === 'coaster' ? 14 : 8) * dt); for (let i = 0; i < 3; i++) fp.sm[i] += (tgt[i] - fp.sm[i]) * kk;
    fp.rig = { eye, tgt: fp.sm.slice(), fov, up: U };
    if (fp.on && !fp.hint) { fp.hint = 1; host.toast('👁 第一视角：手指/鼠标拖动屏幕可 360° 环顾，点“回正”看回前方', 3600); }
  }
  { const proto = Object.getPrototypeOf(R), orig = proto.setCamera;
    R.setCamera = function (cam, w, h) {
      const g = window.__game; if (!fp.rig || fp.k <= 0 || (g && g.scene && g.scene !== S)) { const v0 = orig.call(this, cam, w, h); if (g && g.scene === S) { const Pm = M4.persp(cam.fov, w / h, 2.6, 270); v0.P = Pm; v0.VP = M4.mul(Pm, v0.V); v0.iVP = M4.inv(v0.VP); } return v0; }
      const k = fp.k * fp.k * (3 - 2 * fp.k), ps = cam.pitch, e3 = [cam.target[0], cam.target[1] + cam.dist * Math.sin(ps), cam.target[2] + cam.dist * Math.cos(ps)], L = (a, b) => a + (b - a) * k;
      const eye = [L(e3[0], fp.rig.eye[0]), L(e3[1], fp.rig.eye[1]), L(e3[2], fp.rig.eye[2])], tg = [L(cam.target[0], fp.rig.tgt[0]), L(cam.target[1], fp.rig.tgt[1]), L(cam.target[2], fp.rig.tgt[2])];
      const uu = fp.rig.up || [0, 1, 0], up = [L(0, uu[0]), L(1, uu[1]), L(0, uu[2])], V = M4.look(eye, tg, up), Pm = M4.persp(L(cam.fov, fp.rig.fov), w / h, L(1, .5), 260);
      this.view = { eye, V, P: Pm, VP: M4.mul(Pm, V), iVP: null, w, h, cam }; this.view.iVP = M4.inv(this.view.VP); return this.view; };
  }
  { const mkBtn = () => { if (fp.btn || !document.body) return; const b = document.createElement('button'); b.textContent = '👁 视角'; b.style.cssText = 'position:fixed;top:62px;left:50%;transform:translateX(-50%);display:none;z-index:30;padding:6px 14px;border-radius:14px;border:1px solid rgba(151,174,255,.45);background:rgba(15,12,36,.72);color:#fff;font:700 13px system-ui,sans-serif;touch-action:manipulation';
      const tog = (ev) => { ev.preventDefault(); ev.stopPropagation(); fp.on = !fp.on; host.toast(fp.on ? '👁 第一视角' : '🎥 第三视角', 1400); }; b.addEventListener('pointerdown', ev => ev.stopPropagation()); b.addEventListener('click', tog); document.body.appendChild(b); fp.btn = b; const b2 = document.createElement('button'); b2.textContent = '↺ 回正'; b2.style.cssText = b.style.cssText; b2.style.top = '100px'; b2.addEventListener('pointerdown', ev => ev.stopPropagation()); b2.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); fp.yaw = 0; fp.pit = 0; }); document.body.appendChild(b2); fp.btn2 = b2; };
    if (document.body) mkBtn(); else addEventListener('DOMContentLoaded', mkBtn); }
  S.bounds = { x0: -70, x1: 70, z0: -56, z1: 48 };
  S.spawn = [0, 15];
  S.camera = { dist: st.baseDist, pitch: CP, fov: .95, clampX: [-40, 40], clampZ: [-34, 34], lead: 3 };
  S.cameraWide = { dist: 27, pitch: .16, fov: 1.1, clampX: [-40, 40], clampZ: [-34, 34], lead: 3 };      // 广角：压低镜头看远处天际线
  S.walkable = (x, z) => inside(x, z) && x > S.bounds.x0 && x < S.bounds.x1 && z > S.bounds.z0 && z < S.bounds.z1;
  S.npcRect = { x0: -52, x1: 52, z0: -12, z1: 32 };
  S.npcCount = 60;
  S.heightAt = (x, z) => (st.ride && Math.abs(x - st.rideX) < .1 && Math.abs(z - st.rideZ) < .1) ? st.rideY : 0;
  S._dbg = { cabin: CABIN[0].i.length, horse: HM[0].i.length, car: CARM.map(m => m.i.length) }; S._st = st; S._CO = CO; S.name = '星光嘉年华'; S.indoor = false;
  const inView = (bb, VP, pad) => { const [a, b] = bb; let out = [0, 0, 0, 0, 0, 0];
    for (let c = 0; c < 8; c++) { const x = c & 1 ? b[0] + pad : a[0] - pad, y = c & 2 ? b[1] + pad : a[1] - pad, z = c & 4 ? b[2] + pad : a[2] - pad, cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13], cz = VP[2] * x + VP[6] * y + VP[10] * z + VP[14], cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
      if (cx >= -cw) out[0]++; if (cx <= cw) out[1]++; if (cy >= -cw) out[2]++; if (cy <= cw) out[3]++; if (cz >= -cw) out[4]++; if (cz <= cw) out[5]++; }
    return out.every(n => n > 0); };
  S.env = (h) => { if (!S.all) S.all = S.batches; const vw = R.view; if (vw && vw.VP && !S._noCull) { const L = S.all.filter(b => !b.bb || inView(b.bb, vw.VP, 4)); S._vis = L.length; S.batches = L; } else S.batches = S.all; const e = envFair(h); try { tick(h, e); } catch (err) { if (!S._err) { S._err = 1; console.error('[funfair tick]', err); } } return e; };
  return S;
}

G.Scenes = G.Scenes || {}; G.Scenes.makeFunfair = makeFunfair;
})(window);
