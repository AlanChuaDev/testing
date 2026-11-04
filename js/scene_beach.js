/* scene_beach.js — STAR BEACH 星光海滩（独立场景文件）
   用法：在 scenes.js 之后、game.js 之前加载；  Scenes.makeBeach(R, T)  返回和其他场景一样的对象。
   特点：弯曲海岸线 / 不规则可走区域（用障碍条拼出，不是方盒子）/ 动态海浪 / 码头 / 10 个互动点 / 昼夜都好看
   说明：所有动画都在 S.env() 里驱动（game.js 每帧都会调用），所以不需要改 game.js 的渲染。 */
(function (G) {
'use strict';
const { MB, hex, clamp, envAt, sstep, lerp } = G.World;
const PI = Math.PI, TAU = PI * 2;
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v); }
function pnoise(x, z, P) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf), m = (a) => ((a % P) + P) % P; return lerp(lerp(hash2(m(xi), zi), hash2(m(xi + 1), zi), u), lerp(hash2(m(xi), zi + 1), hash2(m(xi + 1), zi + 1), u), v); }

/* =====================================================================
   地形形状（全部是函数，所以海岸线是弯的）  x→右  z→朝镜头(南)  -z→大海
   ===================================================================== */
const zc = x => -5.2 + 3.3 * Math.sin(x * .105 + .9) + 1.5 * Math.sin(x * .27 + 2.2) + .45 * Math.sin(x * .61 + 1);   // 海岸线(水边)
const zb = x => 25.2 + 2.2 * Math.sin(x * .13 + .3) + 1.0 * Math.sin(x * .31);                                          // 后方可走边界
const xl = z => -45 + 2.4 * Math.sin(z * .25 + 1), xr = z => 45 + 2.2 * Math.sin(z * .22 + 2);                             // 左右边界
const WADE = 3.4;                                                                                                       // 浅水可走宽度
const PIERX = 9.2, PIER_Z0 = 3.4, PIER_ZEND = -33.2;
const pierHW = z => z > -27.6 ? 1.2 : 1.7;                                                                              // 码头半宽
const onPier = (x, z, m) => Math.abs(x - PIERX) < pierHW(z) - (m || 0) && z < PIER_Z0 && z > PIER_ZEND + (m || 0);
const pierY = z => .5 * sstep(PIER_Z0, 1.0, z);
const seabed = d => d <= 0 ? 0 : -Math.min(d * .12, .45) - Math.max(0, d - WADE - 2) * .2;
function inside(x, z) {
  if (onPier(x, z, .12)) return true;
  return z > zc(x) - WADE && z < zb(x) && x > xl(z) && x < xr(z);
}
function H(x, z) {
  const d = zc(x) - z; let h = d > 0 ? Math.max(seabed(d), -5) : 0;
  const bk = z - zb(x); if (bk > 0) h += sstep(0, 11, bk) * (2.4 + 2.6 * vnoise(x * .09 + 3, z * .09));
  const mk = sstep(-26, -9, z), R = x - xr(z); if (R > 0) h += sstep(0, 8, R) * mk * (6.5 + 4.5 * vnoise(x * .08, z * .08 + 9));
  const Lf = xl(z) - x; if (Lf > 0) h += sstep(0, 8, Lf) * mk * (5.5 + 4 * vnoise(x * .08 + 5, z * .08));
  return h;
}
const groundY = (x, z) => H(x, z);

function axis(lo, hi, step, outLo, outHi) {
  const a = []; for (let v = lo; v <= hi + 1e-6; v += step) a.push(+v.toFixed(3));
  let s = step, v = lo; while (v > outLo) { s *= 1.4; v -= s; a.unshift(v); }
  s = step; v = hi; while (v < outHi) { s *= 1.4; v += s; a.push(v); }
  return a;
}

/* =====================================================================
   纹理
   ===================================================================== */
function makeTex(R) {
  const t = {};
  t.sand = R.paint(256, 256, (g, w, h) => {
    g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h); const r = rnd(3);
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() < .5 ? 'rgba(150,110,60,.10)' : 'rgba(255,255,255,.35)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.strokeStyle = 'rgba(120,90,50,.045)'; g.lineWidth = 3; for (let k = 0; k < 9; k++) { g.beginPath(); for (let x = 0; x <= w; x += 8) { const y = k * 29 + 12 + Math.sin(x / 256 * TAU * 2 + k) * 6; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  });
  t.plank = R.paint(256, 256, (g, w, h) => {
    const r = rnd(9); for (let i = 0; i < 8; i++) { const v = r() * 22; g.fillStyle = `rgb(${196 + v},${146 + v * .8},${96 + v * .6})`; g.fillRect(0, i * 32, w, 32); g.fillStyle = 'rgba(60,30,10,.45)'; g.fillRect(0, i * 32, w, 2.5); g.fillStyle = 'rgba(80,45,20,.13)'; for (let k = 0; k < 6; k++) g.fillRect(r() * w, i * 32 + 4 + r() * 24, 30 + r() * 60, 1.5); g.fillStyle = 'rgba(50,30,15,.5)'; g.fillRect(10, i * 32 + 14, 3, 3); g.fillRect(w - 14, i * 32 + 14, 3, 3); }
  });
  t.stripe = R.paint(128, 16, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e0e0e0'; g.fillRect(i * 16, 0, 16, h); } }, { mip: false });
  t.thatch = R.paint(128, 128, (g, w, h) => { g.fillStyle = '#d8b46a'; g.fillRect(0, 0, w, h); const r = rnd(4); for (let i = 0; i < 220; i++) { g.strokeStyle = r() < .5 ? 'rgba(110,70,20,.35)' : 'rgba(255,230,150,.35)'; g.lineWidth = 1.5; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 5, y + 12 + r() * 14); g.stroke(); } });
  t.net = R.paint(128, 64, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 1.6, h); for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1.6); g.fillRect(0, 0, w, 6); }, { clamp: true });
  t.waterA = R.paint(4, 256, (g, w, h) => { for (let y = 0; y < h; y++) { const v = y / (h - 1), a = v < .04 ? v / .04 * .22 : v < .2 ? lerp(.22, .5, (v - .04) / .16) : lerp(.5, .93, Math.min(1, (v - .2) / .6)); const c = Math.round(a * 255); g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(0, y, w, 1); } }, { clamp: true, mip: false });
  t.foam = R.paint(256, 64, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = y / (h - 1), prof = sstep(0, .22, v) * (1 - sstep(.62, 1, v)) * .55 + Math.exp(-Math.pow((v - .62) / .06, 2)) * .9;
      const n = pnoise(x / w * 20, y / h * 5, 20) * .65 + pnoise(x / w * 56, y / h * 14, 56) * .35, lace = sstep(.38, .72, n + (1 - v) * .12);
      const a = clamp(prof * (.2 + 1.1 * lace), 0, 1) * 255, i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = a; im.data[i + 3] = 255;
    } g.putImageData(im, 0, 0);
  }, { clamp: false });
  t.cloud = R.paint(512, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = rnd(21);
    for (let i = 0; i < 46; i++) { const x = 60 + r() * (w - 120), y = h * .62 - Math.pow(r(), 2) * 34 - Math.abs(x - w / 2) / w * 10, rad = 14 + r() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    const m = g.createLinearGradient(0, 0, 0, h); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(.35, 'rgba(0,0,0,0)'); m.addColorStop(.85, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = m; g.fillRect(0, 0, w, h);
  }, { clamp: true });
  /* 悬浮图标贴图：4x4 格，每格 128px */
  const ICONS = ['🎣', '🏐', '🏰', '🍹', '🍦', '🔥', '📸', '🎆', '🍾', '🚪'], COLS = ['#2ec4ff', '#ff9f43', '#f6c177', '#ff6fae', '#ff8fd0', '#ff6a3d', '#b48cff', '#ffd93d', '#52e0b5', '#52e08a'];
  t.icons = R.paint(512, 512, (g) => {
    g.fillStyle = '#10142e'; g.fillRect(0, 0, 512, 512);
    ICONS.forEach((ic, k) => {
      const cx = (k % 4) * 128 + 64, cy = Math.floor(k / 4) * 128 + 64, gr = g.createRadialGradient(cx - 14, cy - 18, 6, cx, cy, 58); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.55, COLS[k]); gr.addColorStop(1, '#222a55');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 58, 0, TAU); g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(cx - 14, cy - 30, 28, 12, -.4, 0, TAU); g.fill();
      g.font = '58px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ic, cx, cy + 5);
    });
  }, { clamp: true });
  t.ICONS = ICONS;
  return t;
}

/* =====================================================================
   小工具：管道（弯曲树干）、岩石、棕榈树、广告牌
   ===================================================================== */
function tube(mb, pts, rs, seg, col) {
  const base = mb.n, N = pts.length;
  for (let i = 0; i < N; i++) {
    const p = pts[i], q = pts[Math.min(N - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    let tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let ux = ty, uy = -tx, uz = 0; let ul = Math.hypot(ux, uy, uz); if (ul < .05) { ux = 0; uy = tz; uz = -ty; ul = Math.hypot(ux, uy, uz) || 1; } ux /= ul; uy /= ul; uz /= ul;
    const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux, c = typeof col === 'function' ? col(i / (N - 1)) : col;
    for (let k = 0; k <= seg; k++) { const a = k / seg * TAU, ca = Math.cos(a), sa = Math.sin(a), nx = ux * ca + vx * sa, ny = uy * ca + vy * sa, nz = uz * ca + vz * sa; mb.vert([p[0] + nx * rs[i], p[1] + ny * rs[i], p[2] + nz * rs[i]], [nx, ny, nz], k / seg, i / (N - 1), c); }
  }
  const w = seg + 1; for (let i = 0; i < N - 1; i++) for (let k = 0; k < seg; k++) { const a = base + i * w + k; mb.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
}
function blob(mb, cx, cy, cz, rx, ry, rz, col, seg, seed, k) {
  const base = mb.n; seg = seg || 6; k = k == null ? .28 : k;
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg * 2; i++) {
    const th = j / seg * PI, ph = i / (seg * 2) * TAU, dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph), nz = 1 + k * (vnoise(dx * 2.2 + seed, dz * 2.2 + dy * 2 + seed * .7) - .5) * 2;
    const yy = Math.max(dy * ry * nz, -ry * .45), sh = .82 + .3 * (dy * .5 + .5), v = .9 + .2 * hash2(i + seed, j);
    mb.vert([cx + dx * rx * nz, cy + yy, cz + dz * rz * nz], [dx, dy, dz], i / (seg * 2), j / seg, [col[0] * sh * v, col[1] * sh * v, col[2] * sh * v]);
  }
  const w = seg * 2 + 1; for (let j = 0; j < seg; j++) for (let i = 0; i < seg * 2; i++) { const a = base + j * w + i; mb.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
}
function palm(tm, lm, x, z, o) {
  const r = rnd(o.seed), y0 = groundY(x, z), h = o.h, n = 7, pts = [], rs = [];
  for (let k = 0; k <= n; k++) { const t = k / n, b = o.lean * t * t * h * .5; pts.push([x + Math.cos(o.yaw) * b, y0 + t * h, z + Math.sin(o.yaw) * b]); rs.push(lerp(.27, .13, t)); }
  tube(tm, pts, rs, 6, t => mix([.46, .34, .24], [.62, .5, .36], (Math.sin(t * 40) * .5 + .5) * .6));
  const top = pts[n];
  for (let f = 0; f < 11; f++) {
    const a = f / 11 * TAU + r() * .4, L = 2.5 + r() * 1.0, drop = .75 + r() * .5, ca = Math.cos(a), sa = Math.sin(a), m = 7, tint = .85 + r() * .3, base = lm.n;
    for (let k = 0; k <= m; k++) {
      const s = k / m, d = L * s * .95, yy = top[1] + .25 + L * (.55 * s - drop * s * s * .9), w = .62 * Math.sin(PI * (s * .86 + .08)) * (k % 2 ? .72 : 1), px = top[0] + ca * d, pz = top[2] + sa * d, col = mix([.14, .42, .18], [.42, .8, .34], s).map(v => v * tint);
      lm.vert([px - sa * w, yy - w * .35, pz + ca * w], [0, 1, 0], 0, s, col); lm.vert([px + sa * w, yy - w * .35, pz - ca * w], [0, 1, 0], 1, s, col);
    }
    for (let k = 0; k < m; k++) { const q = base + k * 2; lm.i.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  lm.sphere(top[0] + .15, top[1] - .2, top[2], .17, .17, .17, [.36, .26, .16], 4); lm.sphere(top[0] - .12, top[1] - .25, top[2] + .12, .16, .16, .16, [.4, .3, .18], 4);
}

/* =====================================================================
   场景
   ===================================================================== */
function makeBeach(R, T) {
  const X = makeTex(R);
  const S = { batches: [], obstacles: [], portals: [], hotspots: [], lamps: [] };
  const add = (mb, mat) => { if (!mb.i.length) return null; const b = R.batch(mb, mat); S.batches.push(b); return b; };
  const obs = (x0, z0, x1, z1) => S.obstacles.push({ x0, z0, x1, z1 });
  const obsC = (x, z, r) => obs(x - r, z - r, x + r, z + r);
  const solid = (r, g, b) => R.solidTex([r, g, b, 255]);
  const emS = (hexc, d, n) => { const c = hex(hexc); return { em: solid(c[0] * 255, c[1] * 255, c[2] * 255), emDay: d, emNight: n }; };
  const CP = .33;                                          // 镜头俯角（给广告牌光晕用）
  const CU = [0, Math.cos(CP), -Math.sin(CP)];
  const bb = (mb, x, y, z, sx, sy, col) => { const P = (a, b) => [x + a * sx, y + CU[1] * b * sy, z + CU[2] * b * sy]; mb.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col); };
  const pool = (mb, x, z, r, col, y) => mb.floor(x - r, z - r, x + r, z + r, y == null ? .035 : y, col);
  const night = e => e.night;
  const sandZ = (x, dz) => zc(x) + dz;

  /* ---------- 地形 ---------- */
  const C_SAND = [.97, .89, .70], C_WET = [.62, .50, .36], C_UNDER = [.84, .78, .60], C_SEABED = [.14, .34, .40], C_GRASS = [.30, .60, .26], C_GRASS2 = [.52, .66, .28], C_ROCK = [.56, .50, .47];
  function terrainCol(x, z, h, slope) {
    const n = vnoise(x * .6, z * .6), n2 = vnoise(x * .13 + 9, z * .13), d = zc(x) - z; let c;
    if (h <= .02 && d > 0) c = mix(C_UNDER, C_SEABED, sstep(0, 12, d));
    else {
      const s = Math.max(-d, 0); c = mix(C_SAND, C_WET, (1 - sstep(.1, 2.8, s)) * .9); c = mix(c, [1, .94, .76], n2 * .35);
      const g = sstep(-1.2, 3.8, (z - zb(x)) + 3 * n2), hh = sstep(.3, 2.2, h), grass = mix(C_GRASS, C_GRASS2, n);
      c = mix(c, grass, Math.max(g, hh)); const rock = Math.max(sstep(.55, 1.0, slope) * sstep(.4, 2.2, h), d > 0 && h > .02 ? .9 : 0); c = mix(c, mix(C_ROCK, [.36, .33, .34], n), rock);
    }
    const k = .93 + .14 * n; return [c[0] * k, c[1] * k, c[2] * k];
  }
  { const xs = axis(-58, 58, 1, -320, 320), zs = axis(-32, 36, 1, -320, 90), W = xs.length, mb = new MB();
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < W; i++) {
      const x = xs[i], z = zs[j], h = H(x, z), e = .6, dx = (H(x + e, z) - H(x - e, z)) / (2 * e), dz = (H(x, z + e) - H(x, z - e)) / (2 * e), nl = Math.hypot(dx, 1, dz);
      mb.vert([x, h, z], [-dx / nl, 1 / nl, -dz / nl], x / 7, z / 7, terrainCol(x, z, h, Math.hypot(dx, dz)));
    }
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < W - 1; i++) { const a = j * W + i; mb.i.push(a, a + W, a + 1, a + 1, a + W, a + W + 1); }
    add(mb, { tex: X.sand }); }

  /* ---------- 海面（动态：跟着海岸线的曲面网格） ---------- */
  const WX = axis(-58, 58, 1.6, -330, 330), WD = [0, .45, 1, 1.7, 2.7, 4, 5.8, 8, 11, 15, 20, 27, 37, 52, 75, 105, 150, 220, 330], NR = WD.length;
  const shoreZ = (x, t) => zc(x) + .3 * Math.sin(t * .7 + x * .2);
  const mbW = new MB(); const bWater = add(Object.assign(new MB(), { i: [0, 0, 0] }), { tex: X.waterA, mode: 3, glow: 1 });
  const W_SH = [.34, .88, .82], W_MID = [.06, .56, .80], W_DEEP = [.03, .22, .52];
  let lastWaterT = -9, lastWaterHour = -9;
  function upload(b, mb) {
    const gl = R.gl; gl.bindVertexArray(b.vao); gl.bindBuffer(gl.ARRAY_BUFFER, b.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mb.v), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mb.i), gl.DYNAMIC_DRAW); b.count = mb.i.length; gl.bindVertexArray(null);
  }
  const lightOf = e => [0, 1, 2].map(i => clamp(e.amb[i] * .92 + e.sun[i] * .5, 0, 1.1));
  function rebuildWater(t, e) {
    const mb = mbW; mb.v.length = 0; mb.i.length = 0; mb.n = 0; const L = lightOf(e), fog = e.fog;
    for (let i = 0; i < WX.length; i++) { const x = WX[i], sh = shoreZ(x, t);
      for (let j = 0; j < NR; j++) { const d = WD[j], z = sh - d, base = d < 8 ? mix(W_SH, W_MID, sstep(0, 8, d)) : mix(W_MID, W_DEEP, sstep(8, 45, d)), rip = 1 + .09 * Math.sin(x * .55 + z * .31 - t * 1.7) + .06 * Math.sin(x * .23 - z * .5 + t * 1.1);
        const c = mix([base[0] * L[0] * rip, base[1] * L[1] * rip, base[2] * L[2] * rip], fog, sstep(6, 150, d) * .75); mb.vert([x, .03, z], [0, 1, 0], .5, Math.min(1, d / 16), c); } }
    for (let i = 0; i < WX.length - 1; i++) for (let j = 0; j < NR - 1; j++) { const a = i * NR + j; mb.i.push(a, a + NR, a + 1, a + 1, a + NR, a + NR + 1); }
    upload(bWater, mb);
  }

  /* ---------- 浪花（3 道，各自一个批次，透明度随时间变化） ---------- */
  const FX = []; for (let x = -56; x <= 56; x += 1) FX.push(x);
  const foams = [0, 1, 2].map(k => { const o = { k, fade: 0, mb: new MB() }; o.b = add(Object.assign(new MB(), { i: [0, 0, 0] }), { tex: X.foam, mode: 3, glow: () => o.fade }); return o; });
  function rebuildFoam(t, e) {
    const L = lightOf(e), col = [clamp(L[0] * 1.05, .1, 1), clamp(L[1] * 1.05, .1, 1), clamp(L[2] * 1.05, .1, 1)];
    foams.forEach(f => { const p0 = (t / 7 + f.k * .34) % 1, mb = f.mb; mb.v.length = 0; mb.i.length = 0; mb.n = 0; f.fade = .95 * sstep(0, .12, p0) * (1 - sstep(.86, 1, p0));
      for (let i = 0; i < FX.length; i++) { const x = FX[i], p = clamp(p0 + Math.sin(x * .21 + f.k * 2) * .035, 0, 1), D = 7.5 * Math.pow(1 - p, 1.35) - 1.15 * sstep(.8, 1, p), zf = zc(x) - D, wd = .75 + 1.6 * (1 - p) * .4 + .5;
        mb.vert([x, .05, zf + wd], [0, 1, 0], x / 5.5, 0, col); mb.vert([x, .05, zf - .12], [0, 1, 0], x / 5.5, 1, col); }
      for (let i = 0; i < FX.length - 1; i++) { const a = i * 2; mb.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } upload(f.b, mb); });
  }

  /* ---------- 木栈道（沿后方弯曲） ---------- */
  { const mb = new MB(); const pts = []; for (let x = -52; x <= 52; x += 1) pts.push([x, zb(x) - 2.6]); let u = 0;
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], w1 = 1.3, du = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.2; mb.quad([a[0], .1, a[1] + w1], [b[0], .1, b[1] + w1], [b[0], .1, b[1] - w1], [a[0], .1, a[1] - w1], [0, 1, 0], [u, 0, u + du, 1], [1, 1, 1]);
      mb.quad([a[0], 0, a[1] + w1], [b[0], 0, b[1] + w1], [b[0], .1, b[1] + w1], [a[0], .1, a[1] + w1], [0, 0, 1], [u, 0, u + du, .1], [.7, .7, .7]); u += du; } add(mb, { tex: X.plank }); }

  /* ---------- 灯柱、长椅（木栈道上） ---------- */
  { const pole = new MB(), head = new MB(), halo = new MB(), pl = new MB(), bench = new MB();
    for (let x = -48; x <= 48; x += 8) { const z = zb(x) - 4.1; pole.cyl(x, z, .1, 3.6, .08, .05, 8, [.22, .2, .26]); pole.cyl(x, z, .1, .5, .17, .12, 8, [.22, .2, .26]); head.sphere(x, 3.75, z, .3, .3, .3, [1, 1, 1], 8); bb(halo, x, 3.75, z, 2.8, 2.8, [1, .8, .5]); pool(pl, x, z, 3.2, [1, .78, .45]); obsC(x, z, .22); S.lamps.push([x, z]); }
    [-40, -26, -10, 6, 22, 38].forEach(x => { const z = zb(x) - 4.4; bench.box(x - 1.1, .45, z - .3, x + 1.1, .58, z + .3, [.55, .38, .26]); bench.box(x - 1.1, .58, z - .34, x + 1.1, 1.05, z - .26, [.55, .38, .26]); bench.box(x - 1, .1, z - .25, x - .85, .45, z + .25, [.2, .18, .24]); bench.box(x + .85, .1, z - .25, x + 1, .45, z + .25, [.2, .18, .24]); obs(x - 1.2, z - .4, x + 1.2, z + .4); });
    add(pole, {}); add(head, emS('#fff0c8', .35, 2.4)); add(bench, {}); add(halo, { tex: T.glow, mode: 2, glow: e => night(e) * .75 }); add(pl, { tex: T.glow, mode: 2, glow: e => night(e) * .24 }); }

  /* ---------- 棕榈树、灌木、花、草丛 ---------- */
  { const tm = new MB(), lm = new MB(), r = rnd(77); let k = 0;
    // 后方只在两侧种高棕榈（中间留空，不挡视线），中间用低矮灌木
    for (let x = -38; x <= 38; x += 9 + r() * 4) { if (Math.abs(x) < 26) continue; const z = zb(x) + 1.5 + r() * 2.4; palm(tm, lm, x, z, { h: 3.8 + r() * 1.2, lean: (.3 + r() * .4), yaw: -PI / 2 + (r() - .5) * 1.0, seed: 100 + k++ }); obsC(x, z, .3); }
    // 沙滩上零星几棵（靠近酒吧、排球场、岩石），顺着海岸线斜向大海
    [[-42, sandZ(-42, 3.5), 6.2], [-37, zb(-37) + 1.2, 5.6], [42, sandZ(42, 3.2), 6.4], [40, zb(40) + 1.2, 5.4], [-16, zb(-16) - .2, 5.0], [16, zb(16) - .2, 5.0], [-4, zb(-4) - .2, 4.8], [31, sandZ(31, 9), 5.0], [-27, sandZ(-27, 7), 5.4]].forEach(([x, z, hh]) => { palm(tm, lm, x, z, { h: hh, lean: .4 + r() * .3, yaw: -PI / 2 + (r() - .5) * .8, seed: 200 + k++ }); obsC(x, z, .3); });
    add(tm, {}); add(lm, {}); }
  { const bu = new MB(), fl = new MB(), gr = new MB(), r = rnd(5);
    for (let i = 0; i < 72; i++) { const x = -50 + r() * 100, z = zb(x) + .3 + r() * 2.2, s = .6 + r() * .7, y = groundY(x, z); bu.sphere(x, y + s * .5, z, s, s * .65, s, mix([.2, .5, .22], [.34, .66, .3], r()), 6); bu.sphere(x + s * .6, y + s * .38, z + s * .2, s * .6, s * .45, s * .6, [.28, .6, .28], 5); if (r() < .7) { const c = [[.98, .35, .45], [1, .85, .3], [1, .6, .8], [1, 1, 1]][(r() * 4) | 0]; for (let q = 0; q < 4; q++) fl.sphere(x + (r() - .5) * s * 1.4, y + s * .75 + r() * .2, z + (r() - .5) * s * 1.2, .13, .13, .13, c, 3); } if (z < zb(x) + 1.6) obsC(x, z, s * .8); }
    for (let i = 0; i < 150; i++) { const x = -49 + r() * 98, z = zb(x) - 2 + r() * 5, y = groundY(x, z); for (let q = 0; q < 4; q++) { const a = r() * TAU; gr.cyl(x + Math.cos(a) * .25, z + Math.sin(a) * .25, y, y + .7 + r() * .5, .06, .0, 3, mix([.45, .62, .25], [.7, .78, .4], r())); } }
    add(bu, {}); add(fl, {}); add(gr, {}); }

  /* ---------- 岩石：两侧海岬与水中礁石 ---------- */
  { const mb = new MB(), r = rnd(31);
    const rock = (x, z, s, k) => { blob(mb, x, groundY(x, z) + s * .35, z, s * (1 + r() * .5), s * (.7 + r() * .5), s * (1 + r() * .4), mix([.5, .46, .44], [.62, .56, .5], r()), 6, k, .3); };
    for (let i = 0; i < 16; i++) { const x = -48.5 + r() * 5, z = zc(-44) - 3 + r() * 20; rock(x, z, .9 + r() * 1.6, i); const x2 = 43 + r() * 5.5, z2 = zc(45) - 2 + r() * 20; rock(x2, z2, .9 + r() * 1.7, i + 40); }
    [[-36.5, -10.5, 1.6], [-41, -13.5, 2.3], [-33, -13.8, 1.2], [46, -9, 2.2], [39, -13.5, 1.5], [-3.5, -20, 1.4], [-7, -24.5, 2.0], [19.5, -23, 1.6], [24, -27, 2.4]].forEach(([x, z, s], i) => rock(x, z, s, 90 + i));
    // 可走区域里的几块装饰岩（带碰撞）
    [[-40.5, sandZ(-40.5, 1.4), 1.1], [38.8, sandZ(38.8, 1.8), 1.0], [-1.5, sandZ(-1.5, 2.2), .6], [20.6, sandZ(20.6, 1.2), .7], [-24, sandZ(-24, 1.5), .8]].forEach(([x, z, s], i) => { rock(x, z, s, 120 + i); obsC(x, z, s * 1.1); });
    add(mb, {}); }

  /* ---------- 木栈道入口门（回广场的传送门） ---------- */
  { const gx = -39, gz = zb(-39) - 1.6; const mb = new MB(), em = new MB();
    mb.box(gx - 3.2, 0, gz - .3, gx - 2.7, 4.2, gz + .3, [.5, .34, .22]); mb.box(gx + 2.7, 0, gz - .3, gx + 3.2, 4.2, gz + .3, [.5, .34, .22]); mb.box(gx - 3.5, 4.2, gz - .4, gx + 3.5, 4.6, gz + .4, [.46, .3, .2]); mb.box(gx - 3.5, 4.6, gz - .3, gx + 3.5, 4.75, gz + .3, [.9, .5, .3]);
    add(mb, {}); const sg = T.sign('回到星光广场 →', { w: 1024, h: 170, fs: 90, bg: '#10243a', fg: '#c8fff0', border: '#52e0b5' });
    const sb = new MB(); sb.quad([gx - 2.6, 2.7, gz + .32], [gx + 2.6, 2.7, gz + .32], [gx + 2.6, 4.1, gz + .32], [gx - 2.6, 4.1, gz + .32], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); sb.quad([gx + 2.6, 2.7, gz - .32], [gx - 2.6, 2.7, gz - .32], [gx - 2.6, 4.1, gz - .32], [gx + 2.6, 4.1, gz - .32], [0, 0, -1], [0, 0, 1, 1], [1, 1, 1]); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.7 });
    em.box(gx - 2.7, 4.1, gz - .2, gx + 2.7, 4.2, gz + .2, [1, 1, 1]); add(em, emS('#52e0b5', .8, 2.2)); obs(gx - 3.3, gz - .4, gx - 2.6, gz + .4); obs(gx + 2.6, gz - .4, gx + 3.3, gz + .4);
    S.portals.push({ id: 'plaza', x: gx, z: gz - .9, r: 1.9, label: '回到星光广场', color: [.4, 1, .7], spawn: [0, 17] }); S.exitPortal = S.portals[0]; }

  /* ---------- 码头 ---------- */
  { const mb = new MB(), pst = new MB(), rail = new MB(), lampH = new MB(), lampG = new MB(), cx = PIERX, hw = 1.2, y = .5;
    mb.box(cx - hw, y - .16, -27.6, cx + hw, y, PIER_Z0 - 2.4, [1, 1, 1], [2.4, 2.2], { noBack: false });                       // 长桥面
    mb.box(cx - 1.7, y - .16, PIER_ZEND, cx + 1.7, y, -27.6, [1, 1, 1], [3.4, 2.2]);                                                // 末端平台
    // 斜坡
    mb.quad([cx - hw, 0, PIER_Z0], [cx + hw, 0, PIER_Z0], [cx + hw, y, 1.0], [cx - hw, y, 1.0], [0, .9, .4], [0, 0, 1, 1], [1, 1, 1]);
    for (let z = PIER_Z0 - 2.4; z > -27; z -= 4) { [cx - hw + .1, cx + hw - .1].forEach(x => pst.cyl(x, z, -3.2, y - .1, .16, .16, 8, [.32, .22, .16])); }
    [[cx - 1.5, -33], [cx + 1.5, -33], [cx - 1.5, -28.5], [cx + 1.5, -28.5]].forEach(([x, z]) => pst.cyl(x, z, -3.2, y + 3.0, .16, .16, 8, [.36, .25, .18]));
    for (let z = PIER_Z0 - 2.6; z > -27.4; z -= 2.2) { [-1, 1].forEach(s => { const x = cx + s * (hw - .08); rail.box(x - .06, y, z - .06, x + .06, y + 1.0, z + .06, [.5, .34, .22]); }); }
    [-1, 1].forEach(s => { const x = cx + s * (hw - .08); rail.box(x - .05, y + .95, -27.6, x + .05, y + 1.05, PIER_Z0 - 2.4, [.58, .4, .27]); rail.box(x - .04, y + .5, -27.6, x + .04, y + .56, PIER_Z0 - 2.4, [.58, .4, .27]); });
    [-1, 1].forEach(s => { const x = cx + s * 1.62; rail.box(x - .05, y + .95, PIER_ZEND, x + .05, y + 1.05, -27.6, [.58, .4, .27]); for (let z = -32.5; z < -27.6; z += 1.6) rail.box(x - .05, y, z - .05, x + .05, y + 1.0, z + .05, [.5, .34, .22]); });
    rail.box(cx - 1.7, y + .95, PIER_ZEND - .05, cx + 1.7, y + 1.05, PIER_ZEND + .05, [.58, .4, .27]);
    // 平台上的小凉亭屋顶 + 长椅
    rail.cyl(cx, -30.8, y + 3.0, y + 4.4, 3.0, .15, 4, [.88, .42, .3]);
    rail.box(cx - 1.4, y, -32.5, cx + 1.4, y + .45, -32.0, [.55, .38, .26]);
    for (let z = -4; z > -27; z -= 6) { const L2 = [cx - hw + .1, cx + hw - .1]; L2.forEach(x => { lampH.sphere(x, y + 1.35, z, .22, .22, .22, [1, 1, 1], 6); bb(lampG, x, y + 1.35, z, 2.4, 2.4, [1, .78, .45]); }); }
    [[cx - 1.5, -33], [cx + 1.5, -33], [cx - 1.5, -28.5], [cx + 1.5, -28.5]].forEach(([x, z]) => { lampH.sphere(x, y + 3.15, z, .2, .2, .2, [1, 1, 1], 6); bb(lampG, x, y + 3.15, z, 2.8, 2.8, [1, .78, .45]); });
    add(mb, { tex: X.plank }); add(pst, {}); add(rail, {}); add(lampH, emS('#ffe9b0', .3, 2.4)); add(lampG, { tex: T.glow, mode: 2, glow: e => night(e) * .8 });
    const sg = T.sign('FISHING 钓鱼', { w: 512, h: 120, fs: 64, bg: '#0d2c45', fg: '#bff3ff', border: '#2ec4ff' }); const sb = new MB(); sb.box(cx - 1.2, y + 3.4, -28.6, cx + 1.2, y + 4.1, -28.5, [1, 1, 1], [2.4, .7], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .6, emNight: 1.7 });
    const sg2 = T.sign('STAR PIER', { w: 512, h: 120, fs: 70, bg: '#2a1138', fg: '#ffe2f6', border: '#ff4fc3' }); const s2 = new MB(); s2.box(cx - 1.3, y + 2.6, PIER_Z0 - 2.55, cx + 1.3, y + 3.4, PIER_Z0 - 2.45, [1, 1, 1], [2.6, .8], { noBack: true, noSides: true, noTop: true }); s2.box(cx - 1.35, y, PIER_Z0 - 2.6, cx - 1.2, y + 3.4, PIER_Z0 - 2.4, [.5, .34, .22]); s2.box(cx + 1.2, y, PIER_Z0 - 2.6, cx + 1.35, y + 3.4, PIER_Z0 - 2.4, [.5, .34, .22]); add(s2, { tex: sg2.tex, em: sg2.em, emDay: .6, emNight: 1.7 });
  }

  /* ---------- 阳伞 + 躺椅 ---------- */
  { const pole = new MB(), lounger = new MB(), tow = new MB(), canopies = {};
    const UC = [[.98, .42, .52], [.2, .78, .8], [1, .8, .28], [.6, .5, 1], [1, .62, .3]];
    const group = (cx, cz, n, seed) => { const r = rnd(seed); for (let i = 0; i < n; i++) { const x = cx + (i - (n - 1) / 2) * 4.3 + (r() - .5) * .6, z = cz + (r() - .5) * 1.4, ci = (r() * UC.length) | 0, col = UC[ci];
        pole.cyl(x, z, 0, 2.5, .05, .05, 6, [.9, .88, .85]); (canopies[ci] = canopies[ci] || new MB()).cyl(x, z, 2.05, 2.75, 1.85, .06, 10, col);
        for (let k = 0; k < 2; k++) { const lx = x + (k ? 1.05 : -1.05) , lz = z + .9; lounger.box(lx - .42, .12, lz - .85, lx + .42, .3, lz + .85, [.96, .94, .9]); lounger.quad([lx - .42, .3, lz + .9], [lx + .42, .3, lz + .9], [lx + .42, .95, lz + 1.5], [lx - .42, .95, lz + 1.5], [0, .8, -.5], [0, 0, 1, 1], [.96, .94, .9]);
          tow.box(lx - .36, .3, lz - .8, lx + .36, .33, lz + .55, col); obs(lx - .45, lz - .9, lx + .45, lz + 1.5); }
        obsC(x, z, .15); } };
    group(-17, sandZ(-17, 9.5), 3, 3); group(-39, sandZ(-39, 12), 2, 8); group(36, sandZ(36, 9), 2, 12); group(-3, sandZ(-3, 17), 2, 21);
    add(pole, {}); add(lounger, {}); add(tow, {}); Object.keys(canopies).forEach(k => add(canopies[k], { tex: X.stripe })); }

  /* ---------- 酒吧小屋（BEACH BAR） ---------- */
  const BAR = { x: -31, z: sandZ(-31, 6) };
  { const bx = BAR.x, bz = BAR.z, mb = new MB(), wood = new MB(), roof = new MB(), lights = new MB(), glow = new MB(), stool = new MB(), bottles = new MB();
    mb.box(bx - 4.2, 0, bz - 2.8, bx + 4.2, .18, bz + 1.4, [1, 1, 1], [3, 3]);                                          // 平台
    wood.box(bx - 3.6, .18, bz - .1, bx + 3.6, 1.15, bz + .5, [.6, .4, .26]); wood.box(bx - 3.75, 1.15, bz - .2, bx + 3.75, 1.28, bz + .65, [.82, .62, .4]);      // 吧台
    wood.box(bx - 3.6, .18, bz - 2.7, bx + 3.6, 2.2, bz - 2.55, [.5, .34, .22]); wood.box(bx - 3.4, 1.2, bz - 2.6, bx + 3.4, 1.28, bz - 2.0, [.7, .5, .32]); wood.box(bx - 3.4, 1.9, bz - 2.6, bx + 3.4, 1.98, bz - 2.1, [.7, .5, .32]);
    const bc = [[.9, .3, .3], [.3, .8, .5], [.95, .8, .3], [.4, .6, 1], [.9, .5, .8]]; for (let i = 0; i < 14; i++) { const x = bx - 3.1 + i * .47, c = bc[i % 5]; bottles.box(x - .08, 1.28, bz - 2.4, x + .08, 1.62 + (i % 3) * .06, bz - 2.24, c); bottles.box(x - .08, 1.98, bz - 2.4, x + .08, 2.3, bz - 2.24, bc[(i + 2) % 5]); }
    [-3.8, 3.8].forEach(s => [-2.6, .9].forEach(zz => wood.cyl(bx + s, bz + zz, 0, 3.4, .12, .1, 6, [.78, .62, .36])));
    roof.cyl(bx, bz - .8, 3.35, 5.4, 6.2, .2, 12, [1, 1, 1]);
    for (let i = 0; i < 5; i++) { const x = bx - 2.4 + i * 1.2; stool.cyl(x, bz + 1.5, 0, .75, .08, .08, 6, [.35, .25, .18]); stool.cyl(x, bz + 1.5, .75, .85, .38, .36, 8, [.95, .4, .45], true); obsC(x, bz + 1.5, .3); }
    for (let i = 0; i <= 18; i++) { const t = i / 18, x = bx - 3.8 + t * 7.6, y = 3.1 - Math.sin(t * PI) * .45; lights.sphere(x, y, bz + .95, .1, .1, .1, [1, 1, 1], 4); bb(glow, x, y, bz + .95, .85, .85, [[1, .7, .4], [1, .45, .7], [.5, .9, 1], [1, .9, .4]][i % 4]); }
    obs(bx - 4.2, bz - 2.9, bx + 4.2, bz + .75);
    add(mb, { tex: X.plank }); add(wood, {}); add(bottles, {}); add(stool, {}); add(roof, { tex: X.thatch }); add(lights, emS('#ffffff', .6, 2.2)); add(glow, { tex: T.glow, mode: 2, glow: e => .12 + night(e) * .8 });
    const sg = T.sign('BEACH BAR 海边酒吧', { w: 1024, h: 150, fs: 78, bg: '#2a1a10', fg: '#ffe7b0', border: '#ffae45' }), sb = new MB(); sb.box(bx - 3, 3.0, bz + .95, bx + 3, 3.9, bz + 1.0, [1, 1, 1], [6, .9], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .6, emNight: 1.7 });
    // 冲浪板架
    const sf = new MB(); [[.95, .35, .5], [.2, .75, .85], [1, .85, .3], [.98, .98, .98], [.6, .45, 1]].forEach((c, i) => { const x = bx + 5.0 + i * .5; sf.sphere(x, 1.25, bz - .9 + (i % 2) * .15, .22, 1.2, .07, c, 6); }); sf.box(bx + 4.6, 0, bz - 1.2, bx + 7.3, .15, bz - .5, [.5, .34, .22]); add(sf, {}); obs(bx + 4.6, bz - 1.2, bx + 7.3, bz - .5); }

  /* ---------- 冰淇淋车 ---------- */
  const ICE = { x: -8, z: sandZ(-8, 9.5) };
  { const x = ICE.x, z = ICE.z, mb = new MB(), aw = new MB(), cone = new MB();
    mb.box(x - 1.7, .4, z - 1.0, x + 1.7, 1.25, z + 1.0, [.98, .82, .88]); mb.box(x - 1.8, 1.25, z - 1.05, x + 1.8, 1.35, z + 1.1, [1, 1, 1]); mb.box(x - 1.7, 1.35, z - 1.0, x + 1.7, 2.6, z - .9, [.98, .82, .88]); mb.box(x - 1.7, 1.35, z - 1.0, x - 1.6, 2.6, z + 1.0, [.98, .82, .88]); mb.box(x + 1.6, 1.35, z - 1.0, x + 1.7, 2.6, z + 1.0, [.98, .82, .88]);
    [-1.2, 1.2].forEach(s => mb.box(x + s - .4, 0, z - .15, x + s + .4, .8, z + .15, [.2, .2, .26]));
    for (let i = 0; i < 8; i++) aw.box(x - 2.0 + i * .5, 2.5, z - 1.1, x - 1.5 + i * .5, 2.66, z + 1.35, i % 2 ? [1, 1, 1] : [.98, .4, .55]); aw.box(x - 2.0, 2.3, z + 1.3, x + 2.0, 2.52, z + 1.4, [.98, .4, .55]);
    cone.cyl(x + 1.1, z - .2, 2.7, 3.7, .0, .55, 8, [.9, .66, .32]); cone.sphere(x + 1.1, 3.95, z - .2, .6, .5, .6, [.98, .62, .78], 7); cone.sphere(x + 1.1, 4.35, z - .2, .45, .38, .45, [1, .98, .92], 7); cone.sphere(x + 1.1, 4.68, z - .2, .22, .22, .22, [.9, .1, .2], 5);
    add(mb, {}); add(aw, {}); add(cone, {}); obs(x - 2, z - 1.1, x + 2, z + 1.2);
    const sg = T.sign('ICE CREAM 冰淇淋', { w: 512, h: 110, fs: 56, bg: '#fff0f6', fg: '#e0407f', border: '#ff8fd0' }), sb = new MB(); sb.box(x - 1.4, 1.5, z + 1.08, x + .1, 2.2, z + 1.12, [1, 1, 1], [1.5, .7], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .3, emNight: 1.3 }); }

  /* ---------- 拍照拱门 ---------- */
  const PHOTO = { x: -1, z: sandZ(-1, 4.5) };
  { const x = PHOTO.x, z = PHOTO.z, mb = new MB(), fl = new MB(), gl = new MB(), r = rnd(55);
    mb.arch(x, 0.4, z - .15, z + .15, 2.5, 2.1, 0, PI, 28, [.98, .96, .92]); mb.box(x - 2.5, 0, z - .15, x - 2.1, .4, z + .15, [.98, .96, .92]); mb.box(x + 2.1, 0, z - .15, x + 2.5, .4, z + .15, [.98, .96, .92]);
    for (let i = 0; i < 36; i++) { const a = PI * (i / 35), rr = 2.3 + (r() - .5) * .25; fl.sphere(x + Math.cos(a) * rr, .4 + Math.sin(a) * rr, z + .12 * (r() < .5 ? 1 : -1), .17 + r() * .1, .17 + r() * .1, .17 + r() * .1, [[1, .5, .65], [1, .95, .9], [1, .8, .3], [.6, .85, .5], [.9, .55, 1]][(r() * 5) | 0], 4); }
    add(mb, {}); add(fl, {}); obs(x - 2.6, z - .3, x - 2.0, z + .3); obs(x + 2.0, z - .3, x + 2.6, z + .3);
    const sg = T.sign('STAR BEACH ✦ 拍照点', { w: 1024, h: 140, fs: 70, bg: '#2a1b4a', fg: '#fff0fa', border: '#b48cff' }), sb = new MB(); sb.box(x - 2.4, 3.55, z + .16, x + 2.4, 4.4, z + .22, [1, 1, 1], [4.8, .85], { noBack: true, noSides: true, noTop: true }); sb.box(x - 2.2, 2.95, z - .05, x - 2.14, 3.55, z + .05, [.8, .8, .85]); sb.box(x + 2.14, 2.95, z - .05, x + 2.2, 3.55, z + .05, [.8, .8, .85]); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.6 });
    bb(gl, x, 2.2, z + 1.5, 4.5, 4.5, [1, .7, 1]); pool(gl, x, z + 2.0, 3.2, [1, .7, .95]); add(gl, { tex: T.glow, mode: 2, glow: e => .08 + night(e) * .5 }); }

  /* ---------- 排球场 ---------- */
  const VB = { x: 26, z: sandZ(26, 13) };
  { const cx = VB.x, cz = VB.z, hx = 4.2, hz = 4.0, mb = new MB(), ln = new MB(), post = new MB(), net = new MB();
    mb.floor(cx - hx - .4, cz - hz - .4, cx + hx + .4, cz + hz + .4, .012, [1, .95, .8]);
    [[cx - hx, cz - hz, cx + hx, cz - hz + .1], [cx - hx, cz + hz - .1, cx + hx, cz + hz], [cx - hx, cz - hz, cx - hx + .1, cz + hz], [cx + hx - .1, cz - hz, cx + hx, cz + hz]].forEach(q => ln.floor(q[0], q[1], q[2], q[3], .02, [1, 1, 1]));
    [-1, 1].forEach(s => post.cyl(cx + s * (hx - .3), cz, 0, 2.5, .07, .06, 8, [.9, .9, .94])); post.box(cx - hx + .3, 2.15, cz - .03, cx + hx - .3, 2.5, cz + .03, [1, 1, 1]); obsC(cx - hx + .3, cz, .12); obsC(cx + hx - .3, cz, .12);
    net.quad([cx - hx + .3, 1.3, cz], [cx + hx - .3, 1.3, cz], [cx + hx - .3, 2.5, cz], [cx - hx + .3, 2.5, cz], [0, 0, 1], [0, 0, (hx * 2 - .6) / 1.0, 1], [1, 1, 1]);
    add(mb, {}); add(ln, {}); add(post, {}); add(net, { tex: X.net, mode: 3, glow: .85 });
    const sg = T.sign('BEACH VOLLEYBALL 沙滩排球', { w: 1024, h: 130, fs: 62, bg: '#3a1c0a', fg: '#fff0cf', border: '#ff9f43' }), sb = new MB(); sb.box(cx - 2.6, 3.0, cz - hz - .6, cx + 2.6, 3.9, cz - hz - .55, [1, 1, 1], [5.2, .9], { noBack: true, noSides: true, noTop: true }); sb.box(cx - 2.5, 0, cz - hz - .62, cx - 2.4, 3.0, cz - hz - .5, [.5, .34, .22]); sb.box(cx + 2.4, 0, cz - hz - .62, cx + 2.5, 3.0, cz - hz - .5, [.5, .34, .22]); add(sb, { tex: sg.tex, em: sg.em, emDay: .4, emNight: 1.5 }); }

  /* ---------- 篝火营地 ---------- */
  const FIRE = { x: 6, z: sandZ(6, 15) };
  { const fx = FIRE.x, fz = FIRE.z, mb = new MB(), logs = new MB(), seat = new MB(), gl = new MB(), r = rnd(11);
    mb.disc(fx, fz, .02, 1.6, 20, [.22, .17, .14]); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; blob(mb, fx + Math.cos(a) * 1.15, .22, fz + Math.sin(a) * 1.15, .3, .24, .3, [.52, .5, .5], 4, i, .2); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4; tube(logs, [[fx + Math.cos(a) * .6, .15, fz + Math.sin(a) * .6], [fx - Math.cos(a) * .1, .5, fz - Math.sin(a) * .1]], [.1, .09], 5, [.34, .22, .14]); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .8, x = fx + Math.cos(a) * 3.2, z = fz + Math.sin(a) * 3.2; seat.box(x - .8, 0, z - .22, x + .8, .38, z + .22, [.55, .38, .26]); obs(x - .85, z - .26, x + .85, z + .26); }
    obsC(fx, fz, 1.0); add(mb, {}); add(logs, {}); add(seat, {}); pool(gl, fx, fz, 6.5, [1, .55, .2], .04); add(gl, { tex: T.glow, mode: 2, glow: e => .08 + night(e) * .6 }); }

  /* ---------- 救生塔 / 灯笼小屋 ---------- */
  { const x = -42, z = sandZ(-42, 6), mb = new MB(), rf = new MB();
    [[-.9, -.9], [.9, -.9], [-.9, .9], [.9, .9]].forEach(([a, b]) => mb.cyl(x + a, z + b, 0, 2.4, .1, .1, 6, [.95, .95, .95]));
    mb.box(x - 1.3, 2.4, z - 1.3, x + 1.3, 4.0, z + 1.3, [1, .96, .94]); mb.box(x - 1.32, 2.9, z + 1.28, x + 1.32, 3.3, z + 1.34, [.95, .3, .3]); rf.box(x - 1.7, 4.0, z - 1.7, x + 1.7, 4.25, z + 1.7, [.95, .32, .32]); rf.cyl(x, z, 4.25, 5.1, 2.0, .1, 4, [.95, .32, .32]);
    mb.box(x - .1, 4.0, z - .1, x + .1, 6, z + .1, [.9, .9, .9]); mb.box(x + .1, 5.3, z - .1, x + 1.3, 5.9, z - .08, [.96, .3, .3]);
    add(mb, {}); add(rf, {}); obs(x - 1.5, z - 1.5, x + 1.5, z + 1.5);
    const sg = T.sign('LIFEGUARD', { w: 512, h: 100, fs: 56, bg: '#fff0e8', fg: '#d92f2f', border: '#ff6a6a' }), sb = new MB(); sb.box(x - 1.0, 2.6, z + 1.34, x + 1.0, 3.2, z + 1.38, [1, 1, 1], [2, .6], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .3, emNight: 1.2 }); }

  /* ---------- 沙堡（4 个阶段，用 count=0 隐藏） ---------- */
  const CASTLE = { x: -14, z: sandZ(-14, 3), stage: 0, t: 0 };
  const castleB = [];
  { const x = CASTLE.x, z = CASTLE.z, sand = [.92, .78, .5], sand2 = [.82, .68, .42];
    let m = new MB(); m.cyl(x, z, 0, .55, 1.6, 1.25, 12, sand); m.cyl(x, z, .55, .6, 1.25, 1.2, 12, sand2, true); castleB.push(add(m, { tex: X.sand }));
    m = new MB(); [[-.9, -.9], [.9, -.9], [-.9, .9], [.9, .9]].forEach(([a, b]) => { m.cyl(x + a, z + b, .55, 1.5, .34, .3, 8, sand); m.cyl(x + a, z + b, 1.5, 1.85, .4, .0, 8, sand2); }); castleB.push(add(m, { tex: X.sand }));
    m = new MB(); m.box(x - .9, .55, z - .95, x + .9, 1.1, z - .75, sand); m.box(x - .9, .55, z + .75, x + .9, 1.1, z + .95, sand); m.box(x - .95, .55, z - .9, x - .75, 1.1, z + .9, sand); m.box(x + .75, .55, z - .9, x + .95, 1.1, z + .9, sand); m.cyl(x, z, .6, 1.9, .5, .45, 10, sand); m.cyl(x, z, 1.9, 2.5, .55, .0, 10, sand2); castleB.push(add(m, { tex: X.sand }));
    m = new MB(); m.cyl(x, z, 2.5, 3.1, .02, .02, 4, [.8, .8, .8]); m.quad([x, 3.1, z], [x + .6, 2.85, z], [x + .6, 2.85, z], [x, 2.6, z], [0, 0, 1], [0, 0, 1, 1], [1, .3, .4]); m.quad([x, 3.1, z], [x + .6, 2.85, z], [x, 2.6, z], [x, 2.6, z], [0, 0, 1], [0, 0, 1, 1], [1, .3, .4]);
    [[-.9, -.9], [.9, -.9], [-.9, .9], [.9, .9]].forEach(([a, b], i) => m.sphere(x + a, 2.0, z + b, .12, .12, .12, [1, .5, .7], 4)); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; blob(m, x + Math.cos(a) * 1.9, .08, z + Math.sin(a) * 1.9, .14, .08, .14, [1, .75, .8], 3, i, .1); } castleB.push(add(m, {}));
    castleB.forEach(b => { b._c = b.count; b.count = 0; }); obsC(x, z, 1.4); }

  /* ---------- 烟花发射台 + 漂流瓶 + 钓竿等小件 ---------- */
  const FW = { x: 3, z: sandZ(3, 6.5) };
  { const x = FW.x, z = FW.z, mb = new MB(), gl = new MB();
    mb.box(x - .8, 0, z - .6, x + .8, .5, z + .6, [.35, .26, .2]); [-.5, 0, .5].forEach((o, i) => mb.cyl(x + o, z, .5, 1.3, .13, .13, 6, [[1, .3, .3], [.3, .7, 1], [1, .85, .3]][i])); mb.box(x - .8, .5, z + .45, x + .8, .56, z + .6, [1, .8, .3]);
    add(mb, {}); obs(x - .9, z - .7, x + .9, z + .7); const sg = T.sign('FIREWORKS 烟花', { w: 512, h: 110, fs: 56, bg: '#15082e', fg: '#ffe9a0', border: '#ffd93d' }), sb = new MB(); sb.box(x - 1.1, 1.6, z + .56, x + 1.1, 2.2, z + .6, [1, 1, 1], [2.2, .6], { noBack: true, noSides: true, noTop: true }); sb.box(x - 1.0, .5, z + .5, x - .94, 1.6, z + .56, [.5, .34, .22]); sb.box(x + .94, .5, z + .5, x + 1.0, 1.6, z + .56, [.5, .34, .22]); add(sb, { tex: sg.tex, em: sg.em, emDay: .5, emNight: 1.6 });
    bb(gl, x, 1.3, z + 1, 3, 3, [1, .85, .4]); add(gl, { tex: T.glow, mode: 2, glow: e => night(e) * .5 }); }
  const BOTTLE = { x: -14.5, z: zc(-14.5) - 1.1 };

  /* ---------- 远景：小岛、灯塔、帆船剪影 ---------- */
  { const mb = new MB(), lh = new MB(), em = new MB();
    [[-62, -120, 22, 7], [-36, -150, 16, 5], [70, -135, 26, 9], [40, -170, 18, 6], [-95, -170, 30, 10]].forEach(([x, z, rx, h], i) => { blob(mb, x, -.5, z, rx, h, rx * .6, [.22, .48, .32], 8, 300 + i, .35); blob(mb, x + rx * .25, -.5, z + 4, rx * .6, h * .7, rx * .4, [.28, .55, .34], 6, 320 + i, .3); });
    const lx = -52, lz = -86; blob(mb, lx, -.5, lz, 9, 3.2, 7, [.44, .4, .38], 7, 350, .3);
    for (let k = 0; k < 4; k++) lh.cyl(lx, lz, 2.5 + k * 3.1, 2.5 + (k + 1) * 3.1, 1.55 - k * .1, 1.45 - k * .1, 10, k % 2 ? [.95, .95, .95] : [.9, .28, .28]);
    lh.cyl(lx, lz, 14.9, 15.5, 1.7, 1.7, 10, [.2, .2, .26]); lh.cyl(lx, lz, 15.5, 16.4, 1.35, 1.35, 10, [.5, .55, .6]); lh.cyl(lx, lz, 16.4, 17.5, 1.7, .05, 10, [.9, .28, .28]); em.sphere(lx, 15.95, lz, 1.0, .7, 1.0, [1, 1, 1], 6);
    add(mb, {}); add(lh, {}); add(em, emS('#fff4c0', .5, 2.5)); S.lighthouse = [lx, 15.95, lz]; }

  /* ---------- 障碍：用不规则边界生成（这就是"不是方盒子"的关键） ---------- */
  { const x0 = -58, x1 = 58, z0 = -40, z1 = 38, cs = .8, cols = Math.ceil((x1 - x0) / cs), rows = Math.ceil((z1 - z0) / cs);
    for (let i = 0; i < cols; i++) { let run = null; const xa = x0 + i * cs, xb = xa + cs, xm = xa + cs / 2;
      for (let j = 0; j <= rows; j++) { const za = z0 + j * cs, bad = j < rows && !inside(xm, za + cs / 2); if (bad) { if (!run) run = za; } else if (run != null) { obs(xa, run, xb, za); run = null; } } } }

  /* ---------- 悬浮图标（可互动的地方飘着一个小气泡） ---------- */
  const HS = [
    { id: 'fish', x: PIERX, z: -30.4, r: 2.2, label: '钓鱼', color: [.4, .85, 1], icon: 0, btn: '钓鱼', iy: 3.3 },
    { id: 'volley', x: VB.x, z: VB.z + 4.8, r: 2.6, label: '沙滩排球', color: [1, .7, .3], icon: 1, btn: '打排球', iy: 3.6 },
    { id: 'castle', x: CASTLE.x, z: CASTLE.z + 2.3, r: 1.9, label: '堆沙堡', color: [1, .85, .5], icon: 2, btn: '堆沙堡', iy: 3.3 },
    { id: 'bar', x: BAR.x, z: BAR.z + 2.6, r: 2.4, label: '海边酒吧', color: [1, .5, .75], icon: 3, btn: '点饮料', iy: 4.8 },
    { id: 'ice', x: ICE.x, z: ICE.z + 2.4, r: 1.9, label: '冰淇淋', color: [1, .6, .85], icon: 4, btn: '买冰淇淋', iy: 4.0 },
    { id: 'fire', x: FIRE.x, z: FIRE.z, r: 3.0, label: '篝火', color: [1, .5, .2], icon: 5, btn: '烤棉花糖', iy: 3.3 },
    { id: 'photo', x: PHOTO.x, z: PHOTO.z + 2.4, r: 1.9, label: '拍照点', color: [.75, .55, 1], icon: 6, btn: '拍照', iy: 3.0 },
    { id: 'fw', x: FW.x, z: FW.z + 2.1, r: 1.8, label: '烟花', color: [1, .85, .3], icon: 7, btn: '放烟花', iy: 3.2 },
    { id: 'bottle', x: BOTTLE.x, z: BOTTLE.z + .6, r: 1.9, label: '漂流瓶', color: [.4, 1, .8], icon: 8, btn: '捡瓶子', iy: 2.4 },
  ];
  HS.forEach(h => { h.act = h.id; S.hotspots.push(h); });
  S.portals[0].icon = 9; S.portals[0].iy = 4.9; S.portals[0].x0 = S.portals[0].x;

  /* =====================================================================
     动态部分
     ===================================================================== */
  const mk = (mat) => add(Object.assign(new MB(), { i: [0, 0, 0] }), mat);
  const dynOpaque = new MB(), bOpaque = mk({}), bOpaque2 = null;
  const dynIcons = new MB(), bIcons = mk({ tex: R.black, em: X.icons, emDay: 1, emNight: 0 });
  const dynSky = new MB(), bSky = mk({ tex: T.glow, mode: 2, glow: 1 });
  const dynCloud = new MB(), bCloud = mk({ tex: X.cloud, mode: 3, glow: .55 });
  const dynGlow = new MB(), bGlow = mk({ tex: T.glow, mode: 2, glow: 1 });
  const dynPart = new MB(), bPart = mk({ tex: T.glow, mode: 2, glow: 1 });
  const dynShadow = new MB(), bShadow = mk({ tex: T.blob, mode: 3, glow: .35 });
  const dynLine = new MB(), bLine = mk({});
  // 批次顺序：水 → 浪花 → 云 → 网/阴影 → 发光，已按创建顺序放进 S.batches（水和浪花先创建）

  /* 粒子 */
  const parts = []; const later = [];
  const addP = (x, y, z, vx, vy, vz, life, size, col, g, drag) => { if (parts.length < 2600) parts.push({ x, y, z, vx, vy, vz, life, max: life, size, col, g: g == null ? -6 : g, drag: drag || 0 }); };
  const burst = (x, y, z, n, sp, life, size, cols, g) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, b = Math.acos(2 * Math.random() - 1), s = sp * (.55 + Math.random() * .45); addP(x, y, z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, life * (.7 + Math.random() * .5), size, cols[(Math.random() * cols.length) | 0], g, .9); } };
  const splash = (x, z, n) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 1 + Math.random() * 2; addP(x, .1, z, Math.cos(a) * s, 3 + Math.random() * 2.5, Math.sin(a) * s, .7, .22, [.8, .95, 1], -9, 0); } };
  const poof = (x, y, z) => { for (let i = 0; i < 16; i++) { const a = Math.random() * TAU, s = 1 + Math.random() * 1.8; addP(x, y, z, Math.cos(a) * s, 1.2 + Math.random() * 2, Math.sin(a) * s, .8, .4, [.95, .85, .6], -3, 1.5); } };

  /* 海鸥 / 螃蟹 / 船 / 海豚 / 贝壳 / 状态 */
  const gulls = Array.from({ length: 6 }, (_, i) => ({ cx: -20 + i * 8 + Math.random() * 6, cz: -8 - Math.random() * 20, r: 7 + Math.random() * 12, sp: (.25 + Math.random() * .25) * (i % 2 ? 1 : -1), y: 8 + Math.random() * 5, ph: Math.random() * 6 }));
  const crabs = Array.from({ length: 4 }, (_, i) => { const x = -34 + i * 22 + Math.random() * 4; return { x, z: zc(x) + 1.8, vx: 0, ph: Math.random() * 6, dir: Math.random() < .5 ? 1 : -1, flee: 0 }; });
  const boats = [{ x: -13, z: -23, yaw: .5, s: 1.0, col: [.95, .35, .4] }, { x: 26, z: -31, yaw: -.4, s: 1.25, col: [.25, .75, .85] }, { x: -36, z: -46, yaw: .9, s: 1.5, col: [1, .8, .3] }, { x: 13.2, z: -17.5, yaw: PI / 2, s: .7, col: [1, 1, 1], moored: true }];
  const shells = [-42, -33, -24, -15, -7, 2, 15, 24, 33, 41].map((x, i) => ({ x, z: zc(x) + .9 + (i % 3) * .55, alive: true, t: 0, ph: i }));
  const dolphin = { on: false, t: 0, next: 6, x: 0, z: 0, dx: 1 };
  const st = { fish: { s: 0, t: 0, wait: 0, bite: 0 }, vb: { s: 0, t: 0, rally: 0, from: [0, 0], to: [0, 0], dur: 1, hitAt: 0, side: 0 }, drinkI: 0, fireCd: 0, photoT: 0, bottleCd: 0, bobberZ: -36, castleReset: 0, iceI: 0, fwBusy: 0 };

  /* ---------- 宿主接口（以后接入 game.js 时可替换） ---------- */
  const host = S.host = {
    g() { return window.__game; },
    toast(msg, ms) { const el = document.getElementById('toast'); if (!el) return; el.textContent = msg; el.classList.add('on'); clearTimeout(host._t); host._t = setTimeout(() => el.classList.remove('on'), ms || 2000); },
    coins(n) { const g = host.g(); if (!g) return; g.coinCount += n; const el = document.getElementById('coinN'); if (el) el.textContent = Math.round(g.coinCount).toLocaleString('en-US'); try { localStorage.setItem('sc_coins', JSON.stringify(g.coinCount)); } catch (e) { } },
    balance() { const g = host.g(); return g ? g.coinCount : 0; },
    bubble(text, sec) { const g = host.g(); if (g && g.me) { g.me.bubble = text; g.me.bt = sec || 3.5; } },
    wave(sec) { const g = host.g(); if (g && g.me) { g.me.pose = sec || 2; g.me.actClip = null; } },
  act(clip, sec) { const g = host.g(); if (g && g.me) { g.me.pose = sec || 2; g.me.actClip = clip; } },
    face(yaw) { const g = host.g(); if (g && g.me) g.me.yaw = yaw; },
    flash() { let f = document.getElementById('beachFlash'); if (!f) { f = document.createElement('div'); f.id = 'beachFlash'; f.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:99;transition:opacity .5s ease-out'; document.body.appendChild(f); } f.style.transition = 'none'; f.style.opacity = '.95'; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .6s ease-out'; f.style.opacity = '0'; })); },
  };
  const pick = a => a[(Math.random() * a.length) | 0];
  const spend = (n) => { if (host.balance() < n) { host.toast('金币不够啦（需要 ' + n + '）'); return false; } host.coins(-n); return true; };
  const FISH = [['🐟 小鱼', 12, .42], ['🐠 热带鱼', 28, .28], ['🦀 螃蟹', 30, .1], ['🐡 河豚', 45, .1], ['🦑 鱿鱼', 60, .06], ['👢 旧靴子', 1, .04]];
  const MSGS = ['愿你每天都像今天的日落一样好看 🌅', '给未来的你：别忘了喝水 💧', '今晚的星星，是为你亮的 ✨', '勇敢一点，大海就在前面 🌊', '遇见你真好，这里的每一天都有你 🎶', '下次来，我们一起放烟花 🎆'];

  function act(h) {
    const g = host.g(); if (!g) return; const t = performance.now() / 1000; if (st.gameOpen) return;
    switch (h.id) {
      case 'fish': {
        const f = st.fish; host.face(PI);
        if (f.s === 0) { f.s = 1; f.t = 0; f.wait = 2.2 + Math.random() * 3.2; host.toast('🎣 抛竿！等鱼上钩…'); host.bubble('🎣'); splash(PIERX, -37.2, 8); }
        else if (f.s === 1) { f.s = 0; host.toast('收竿了，空空的～'); }
        else if (f.s === 2) { f.s = 0; let r = Math.random(), pk = FISH[0]; for (const x of FISH) { if (r < x[2]) { pk = x; break; } r -= x[2]; } st.fishPick = pk; host.act('cheer', 1.8); splash(PIERX, -36.2, 10); S.openGame('fish'); }
        break; }
      case 'volley': volley(); break;
      case 'castle': { if (CASTLE.stage >= 4) { host.toast('沙堡已经很完美啦～等它被浪冲走再来 🌊'); break; } host.face(PI); host.act('clap', 1.4); S.openGame('castle'); break; }
      case 'bar': case 'ice': case 'fire': case 'photo': case 'bottle': host.act('cheer', 1.6); S.openGame(h.id); break;
      case 'fw': if (st.fwBusy > 0) { host.toast('烟花还在天上呢 🎆'); break; } S.openGame('fw'); break;
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

  /* ---- 钓鱼：按住拉线，让鱼停在绿色区间里 ---- */
  function gFish() {
    const fk = st.fishPick || FISH[0], val = fk[1], hard = clamp(val / 60, .3, 1);
    const G_ = baseGame(); G_.title = '🎣 拉线 · ' + fk[0]; G_.left = 28; G_.zone = .3; G_.zv = 0; G_.fish = .5; G_.ft = .5; G_.fc = 0; G_.prog = .3; G_.hold = false; G_.zh = .26 - hard * .07;
    G_.update = (dt) => { G_.t += dt; G_.left -= dt; G_.fc -= dt;
      if (G_.fc <= 0) { G_.fc = rr_(.35, .9) * (1.15 - hard * .4); G_.ft = rr_(.05, .95); }
      G_.fish += (G_.ft - G_.fish) * Math.min(1, dt * (2.2 + hard * 3));
      G_.zv += ((G_.hold ? 1.25 : -1.15) - 0) * dt * 1.6; G_.zv = clamp(G_.zv, -1.1, 1.1); G_.zone += G_.zv * dt * .55; if (G_.zone < G_.zh / 2) { G_.zone = G_.zh / 2; G_.zv = Math.max(0, G_.zv) * .3; } if (G_.zone > 1 - G_.zh / 2) { G_.zone = 1 - G_.zh / 2; G_.zv = Math.min(0, G_.zv) * .3; }
      const inz = Math.abs(G_.fish - G_.zone) < G_.zh / 2; G_.inz = inz; G_.prog += (inz ? .2 : -.15 - hard * .05) * dt;
      if (G_.prog >= 1) G_.done = { score: val, coins: val, msg: '🎉 钓到了 ' + fk[0] + '！' };
      else if (G_.prog <= 0 || G_.left <= 0) G_.done = { score: 0, coins: fk[0].indexOf('靴') >= 0 ? 0 : 2, msg: '鱼跑掉了…' }; };
    G_.down = () => { G_.hold = true; }; G_.up = () => { G_.hold = false; };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#0e5a8a', '#06233f'); g.fillRect(0, 0, GW, GH); for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.arc(160 + i * 55, 100 + (i * 37) % 300, 20 + (i * 13) % 40, 0, 7); g.stroke(); }
      const bx = 430, bw = 100, by = 70, bh = 400; rrect(g, bx, by, bw, bh, 18); g.fillStyle = 'rgba(0,20,40,.7)'; g.fill();
      const zy = by + bh * (1 - G_.zone - G_.zh / 2), zhh = bh * G_.zh; rrect(g, bx + 6, zy, bw - 12, zhh, 12); g.fillStyle = G_.inz ? 'rgba(80,255,150,.85)' : 'rgba(80,220,140,.5)'; g.fill();
      gtxt(g, fk[0].split(' ')[0], bx + bw / 2, by + bh * (1 - G_.fish), 46 + Math.sin(G_.t * 14) * 2);
      rrect(g, 580, by, 28, bh, 14); g.fillStyle = 'rgba(255,255,255,.15)'; g.fill(); rrect(g, 580, by + bh * (1 - clamp(G_.prog, 0, 1)), 28, bh * clamp(G_.prog, 0, 1), 14); g.fillStyle = '#ffd93d'; g.fill();
      gtxt(g, '按住屏幕 = 绿框上升，松开下落，让鱼待在绿框里！', 480, 38, 22, '#cfe9ff'); gtxt(g, '⏱ ' + Math.max(0, Math.ceil(G_.left)) + 's', 880, 30, 24, '#fff', 'right'); };
    return G_;
  }

  /* ---- 堆沙堡：滑动的沙块，点击落下，叠得越整齐越高 ---- */
  function gCastle() {
    const G_ = baseGame(); G_.title = '🏰 堆沙堡'; G_.layers = [{ x: 480, w: 280 }]; G_.mv = { x: 100, w: 280, dir: 1 }; G_.sp = 260; G_.perf = 0; G_.fall = null; G_.maxL = 9; G_.score = 0;
    G_.finish = (ok) => { const n = G_.layers.length - 1; G_.done = { score: n, coins: n * 4 + G_.perf * 3 + (ok ? 15 : 0), msg: ok ? '🏰 超完美的沙堡！' : '堆了 ' + n + ' 层', layers: n }; };
    G_.update = (dt) => { G_.t += dt; if (G_.fall) { G_.fall.y += 520 * dt; G_.fall.t += dt; if (G_.fall.t > .8) G_.fall = null; }
      if (!G_.dead) { const m = G_.mv; m.x += m.dir * G_.sp * dt; if (m.x - m.w / 2 < 140) { m.x = 140 + m.w / 2; m.dir = 1; } if (m.x + m.w / 2 > 820) { m.x = 820 - m.w / 2; m.dir = -1; } }
      else { G_.dt = (G_.dt || 0) + dt; if (G_.dt > 1.2) G_.finish(G_.layers.length - 1 >= G_.maxL); } };
    G_.down = () => { if (G_.dead) return; const m = G_.mv, p = G_.layers[G_.layers.length - 1], l = Math.max(m.x - m.w / 2, p.x - p.w / 2), r = Math.min(m.x + m.w / 2, p.x + p.w / 2), y = 490 - G_.layers.length * 34;
      if (r - l <= 4) { G_.fall = { x: m.x, w: m.w, y, t: 0 }; G_.dead = true; G_.dt = 0; popT(G_, m.x, y, '塌了！', '#ff9bb0'); return; }
      let w = r - l, x = (l + r) / 2; if (Math.abs(m.x - p.x) < 7) { x = p.x; w = p.w; G_.perf++; popT(G_, x, y, '完美！', '#ffd93d'); } else if (m.w - w > 1) G_.fall = { x: m.x + (m.x > p.x ? 1 : -1) * w / 2, w: m.w - w, y, t: 0 };
      G_.layers.push({ x, w }); G_.score = G_.layers.length - 1; if (G_.layers.length - 1 >= G_.maxL) { G_.dead = true; G_.dt = 0; return; } G_.mv = { x: m.dir > 0 ? 150 + w / 2 : 810 - w / 2, w, dir: -m.dir }; G_.sp = 260 + G_.layers.length * 38; };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#ffd9a0', '#ff9f6b'); g.fillRect(0, 0, GW, GH); g.fillStyle = '#f3d79a'; g.fillRect(0, 490, GW, 50); g.fillStyle = '#4fc3e8'; g.fillRect(0, 0, GW, 80);
      G_.layers.forEach((l, i) => { const y = 490 - (i + 1) * 34 + 34 - 34; g.fillStyle = i % 2 ? '#e8b868' : '#f0c77a'; rrect(g, l.x - l.w / 2, 490 - (i + 1) * 34, l.w, 34, 8); g.fill(); g.strokeStyle = 'rgba(120,80,20,.35)'; g.lineWidth = 2; g.stroke(); });
      if (!G_.dead) { const m = G_.mv, y = 490 - G_.layers.length * 34 - 34 + 34 - 34 + 34 - 34; g.fillStyle = '#ffd98a'; rrect(g, m.x - m.w / 2, 490 - (G_.layers.length + 1) * 34, m.w, 34, 8); g.fill(); g.strokeStyle = 'rgba(120,80,20,.5)'; g.lineWidth = 2; g.stroke(); }
      if (G_.fall) { g.globalAlpha = Math.max(0, 1 - G_.fall.t * 1.3); g.fillStyle = '#e8b868'; g.fillRect(G_.fall.x - G_.fall.w / 2, G_.fall.y - 34 + 34 - 34 + (G_.fall.t * 200), G_.fall.w, 34); g.globalAlpha = 1; }
      const n = G_.layers.length - 1; if (n >= 3) gtxt(g, '🚩', G_.layers[n].x, 490 - (n + 1) * 34 - 20, 34);
      gtxt(g, '点屏幕落下沙块，对齐越准越稳！ 层数 ' + n + ' / ' + G_.maxL, 480, 120, 24, '#6a3d00'); };
    return G_;
  }

  /* ---- 酒吧：照着订单调饮料 ---- */
  function gBar() {
    const ING = [['🥥', '椰汁'], ['🍋', '柠檬'], ['🍓', '草莓'], ['🧊', '冰块'], ['🍍', '菠萝'], ['🌿', '薄荷']], COLS = ['#f4f0e0', '#ffe35a', '#ff6b8a', '#c7efff', '#ffc940', '#6be58a'];
    const G_ = baseGame(); G_.title = '🍹 调饮料'; G_.left = 40; G_.n = 0; G_.cup = []; G_.shake = 0; G_.served = 0; G_.wait = 0;
    const newOrder = () => { const a = []; const len = G_.served < 2 ? 3 : 4; while (a.length < len) a.push((Math.random() * 6) | 0); G_.order = a; G_.cup = []; };
    newOrder();
    G_.update = (dt) => { G_.t += dt; G_.left -= dt; G_.shake = Math.max(0, G_.shake - dt); if (G_.wait > 0) { G_.wait -= dt; if (G_.wait <= 0) newOrder(); }
      if (G_.left <= 0) G_.done = { score: G_.served, coins: Math.min(60, G_.served * 10 + G_.served * 2), msg: '一共调好 ' + G_.served + ' 杯' }; };
    G_.down = (x, y) => { if (G_.wait > 0) return; for (let i = 0; i < 6; i++) { const bx = 130 + i * 140; if (Math.abs(x - bx) < 56 && y > 380 && y < 520) { const need = G_.order[G_.cup.length]; if (i === need) { G_.cup.push(i); if (G_.cup.length === G_.order.length) { G_.served++; G_.score = G_.served; G_.wait = .9; G_.left = Math.min(45, G_.left + 3); popT(G_, 480, 260, '+1 杯 ⏱+3s', '#9bff9b'); } } else { G_.shake = .35; G_.cup = []; G_.left -= 2; popT(G_, bx, 360, '放错了 -2s', '#ff6b6b'); } } } };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#3a1b52', '#1b0c2e'); g.fillRect(0, 0, GW, GH); g.fillStyle = '#6b3f26'; g.fillRect(0, 370, GW, 170);
      rrect(g, 240, 30, 480, 90, 16); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(); gtxt(g, '订单：', 290, 76, 22, '#ffe9a8'); G_.order.forEach((k, i) => { gtxt(g, ING[k][0], 380 + i * 80, 76, 44); if (i < G_.cup.length) gtxt(g, '✔', 404 + i * 80, 100, 22, '#6bff9b'); });
      const sx = G_.shake > 0 ? Math.sin(G_.t * 60) * 8 : 0; g.save(); g.translate(sx, 0); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(400, 170); g.lineTo(560, 170); g.lineTo(535, 340); g.lineTo(425, 340); g.closePath(); g.fill();
      G_.cup.forEach((k, i) => { g.fillStyle = COLS[k]; g.globalAlpha = .9; g.fillRect(430 + i * 0, 330 - (i + 1) * 36, 100, 34); g.globalAlpha = 1; }); g.restore();
      for (let i = 0; i < 6; i++) { const bx = 130 + i * 140; rrect(g, bx - 48, 395, 96, 110, 16); g.fillStyle = COLS[i]; g.fill(); gtxt(g, ING[i][0], bx, 440, 46); gtxt(g, ING[i][1], bx, 488, 20, '#241033'); }
      gtxt(g, '按订单顺序点材料，放错会重来并扣 2 秒', 480, 148, 20, '#cfb3ff'); gtxt(g, '⏱ ' + Math.max(0, Math.ceil(G_.left)) + 's', 880, 30, 26, '#fff', 'right'); };
    return G_;
  }

  /* ---- 冰淇淋：左右移动甜筒，按订单顺序接冰淇淋球 ---- */
  function gIce() {
    const FL = [['#ff9ec4', '草莓'], ['#7a4a2a', '巧克力'], ['#ffe27a', '香草'], ['#8be39a', '抹茶']];
    const G_ = baseGame(); G_.title = '🍦 接冰淇淋'; G_.left = 35; G_.lives = 3; G_.cx = 480; G_.tx = 480; G_.sc = []; G_.stack = []; G_.cones = 0; G_.spawn = .5;
    const newO = () => { G_.order = [0, 1, 2, 3].map(() => (Math.random() * 4) | 0).slice(0, 3 + (G_.cones > 1 ? 1 : 0)); G_.stack = []; }; newO();
    G_.update = (dt) => { G_.t += dt; G_.left -= dt; G_.spawn -= dt; G_.cx += (G_.tx - G_.cx) * Math.min(1, dt * 14);
      if (G_.spawn <= 0) { G_.spawn = rr_(.5, .85); const need = G_.order[G_.stack.length]; G_.sc.push({ x: rr_(120, 840), y: 130, f: Math.random() < .5 ? need : (Math.random() * 4) | 0, vy: 230 + G_.cones * 20 }); }
      G_.sc.forEach(s => { s.y += s.vy * dt; const top = 470 - G_.stack.length * 38; if (!s.dead && s.y > top - 24 && s.y < top + 20 && Math.abs(s.x - G_.cx) < 62) { s.dead = true; const need = G_.order[G_.stack.length]; if (s.f === need) { G_.stack.push(s.f); popT(G_, G_.cx, top - 30, '✔', '#9bff9b'); if (G_.stack.length === G_.order.length) { G_.cones++; G_.score = G_.cones; popT(G_, 480, 240, '完成一份！+1', '#ffd93d'); newO(); } } else { G_.lives--; popT(G_, G_.cx, top - 30, '口味不对 ❤-1', '#ff6b6b'); } } }); G_.sc = G_.sc.filter(s => !s.dead && s.y < 600);
      if (G_.left <= 0 || G_.lives <= 0) G_.done = { score: G_.cones, coins: Math.min(45, G_.cones * 14 + G_.stack.length * 2), msg: '做好 ' + G_.cones + ' 份冰淇淋' }; };
    G_.down = (x) => { G_.tx = x; }; G_.move = (x) => { G_.tx = x; };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#c9f0ff', '#ffe4f1'); g.fillRect(0, 0, GW, GH);
      rrect(g, 260, 20, 440, 80, 16); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); gtxt(g, '订单（由下到上）：', 340, 60, 20, '#6a3a5a'); G_.order.forEach((k, i) => { g.fillStyle = FL[k][0]; g.beginPath(); g.arc(470 + i * 62, 60, 22, 0, 7); g.fill(); if (i < G_.stack.length) gtxt(g, '✔', 470 + i * 62, 60, 22, '#fff'); else if (i === G_.stack.length) { g.strokeStyle = '#ff5a8a'; g.lineWidth = 4; g.beginPath(); g.arc(470 + i * 62, 60, 28, 0, 7); g.stroke(); } });
      G_.sc.forEach(s => { g.fillStyle = FL[s.f][0]; g.beginPath(); g.arc(s.x, s.y, 26, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(s.x - 8, s.y - 8, 7, 0, 7); g.fill(); });
      g.fillStyle = '#d9a35a'; g.beginPath(); g.moveTo(G_.cx - 36, 478); g.lineTo(G_.cx + 36, 478); g.lineTo(G_.cx, 540); g.closePath(); g.fill(); G_.stack.forEach((k, i) => { g.fillStyle = FL[k][0]; g.beginPath(); g.arc(G_.cx, 452 - i * 38, 30, 0, 7); g.fill(); });
      gtxt(g, '左右拖动甜筒，只接订单要的口味', 480, 128, 20, '#6a3a5a'); gtxt(g, '❤'.repeat(Math.max(0, G_.lives)), 40, 500, 28, '#ff5a7a', 'left'); gtxt(g, '⏱ ' + Math.max(0, Math.ceil(G_.left)) + 's', 880, 30, 26, '#6a3a5a', 'right'); };
    return G_;
  }

  /* ---- 篝火烤棉花糖：按住烤，金黄时松手 ---- */
  function gFire() {
    const G_ = baseGame(); G_.title = '🔥 烤棉花糖'; G_.i = 0; G_.heat = 0; G_.hold = false; G_.phase = 'wait'; G_.pt = 0; G_.res = [];
    const color = h => h < .35 ? '#fff6ec' : h < .55 ? '#ffe9b8' : h < .8 ? '#f3b552' : h < .95 ? '#8a4a1e' : '#1c1410';
    G_.update = (dt) => { G_.t += dt; if (G_.phase === 'roast') { G_.heat += dt * (.3 + G_.i * .05) * (G_.hold ? 1 : 0); if (G_.heat >= 1) G_.release(); }
      else if (G_.phase === 'show') { G_.pt += dt; if (G_.pt > 1.2) { G_.i++; if (G_.i >= 3) { const sc = G_.res.reduce((a, b) => a + b, 0); G_.score = sc; G_.done = { score: sc, coins: Math.min(40, Math.round(sc / 8)), msg: '三颗棉花糖总分 ' + sc }; } else { G_.phase = 'wait'; G_.heat = 0; } } } };
    G_.release = () => { if (G_.phase !== 'roast') return; const h = G_.heat; const sc = h >= .95 ? 0 : Math.max(0, Math.round(100 - Math.abs(h - .68) * 330)); G_.res.push(sc); G_.phase = 'show'; G_.pt = 0; popT(G_, 480, 200, sc >= 85 ? '完美金黄！+' + sc : sc === 0 ? '烤焦啦…' : '+' + sc, sc >= 85 ? '#ffd93d' : sc ? '#9bff9b' : '#ff6b6b'); };
    G_.down = () => { if (G_.phase === 'wait') { G_.phase = 'roast'; G_.hold = true; } else if (G_.phase === 'roast') G_.hold = true; }; G_.up = () => { if (G_.phase === 'roast') G_.release(); };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#0b1030', '#251320'); g.fillRect(0, 0, GW, GH); for (let i = 0; i < 24; i++) { g.fillStyle = 'rgba(255,255,255,' + (.3 + .3 * Math.sin(G_.t * 2 + i)) + ')'; g.fillRect((i * 97) % GW, (i * 41) % 160, 3, 3); }
      g.fillStyle = '#3a2412'; g.fillRect(380, 470, 200, 22); g.fillRect(420, 482, 120, 22); const fl = 1 + .12 * Math.sin(G_.t * 14) + (G_.phase === 'roast' ? .25 : 0);
      [[90, '#ff5a1a'], [66, '#ff9a2a'], [40, '#ffe27a']].forEach(([r, c], i) => { g.fillStyle = c; g.beginPath(); g.moveTo(480 - r * fl * .8, 470); g.quadraticCurveTo(480 - r * .3, 470 - r * 2.2 * fl, 480 + Math.sin(G_.t * 9 + i) * 8, 470 - r * 3 * fl); g.quadraticCurveTo(480 + r * .3, 470 - r * 2.2 * fl, 480 + r * fl * .8, 470); g.fill(); });
      const my = G_.phase === 'roast' || G_.phase === 'show' ? 330 : 250; g.strokeStyle = '#a77740'; g.lineWidth = 8; g.beginPath(); g.moveTo(780, 120); g.lineTo(480, my + 20); g.stroke(); g.fillStyle = color(G_.heat); rrect(g, 450, my - 22, 60, 54, 18); g.fill();
      const bx = 140, by = 120, bh = 300; rrect(g, bx, by, 40, bh, 14); g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(); rrect(g, bx, by + bh * (1 - .8), 40, bh * .25, 6); g.fillStyle = 'rgba(255,217,61,.55)'; g.fill(); rrect(g, bx + 4, by + bh * (1 - G_.heat), 32, bh * G_.heat, 10); g.fillStyle = G_.heat > .55 && G_.heat < .8 ? '#ffd93d' : '#ff7a3a'; g.fill();
      gtxt(g, '第 ' + Math.min(3, G_.i + 1) + '/3 颗', 480, 52, 28, '#ffe9a8'); gtxt(g, G_.phase === 'wait' ? '👆 按住屏幕开始烤，进入黄色区间松手' : G_.phase === 'roast' ? '烤…烤…快到金黄了吗？' : '得分 ' + G_.res[G_.res.length - 1], 480, 96, 22, '#cfe9ff'); };
    return G_;
  }

  /* ---- 漂流瓶：点击海面漂过来的瓶子 ---- */
  function gBottle() {
    const G_ = baseGame(); G_.title = '🍾 捞漂流瓶'; G_.left = 22; G_.b = []; G_.spawn = 0; G_.got = 0; G_.coins = 0; G_.last = null;
    G_.update = (dt) => { G_.t += dt; G_.left -= dt; G_.spawn -= dt; if (G_.spawn <= 0) { G_.spawn = rr_(.5, 1.0); const k = Math.random(); G_.b.push({ x: 1010, y: rr_(190, 460), v: rr_(80, 190), type: k < .12 ? 'gold' : k < .24 ? 'boot' : 'n', ph: rr_(0, 6) }); }
      G_.b.forEach(b => { b.x -= b.v * dt; }); G_.b = G_.b.filter(b => b.x > -60 && !b.dead);
      if (G_.left <= 0) G_.done = { score: G_.coins, coins: Math.min(60, G_.coins), msg: '捞到 ' + G_.got + ' 个瓶子' + (G_.last ? '\n最后一张纸条：' + G_.last : '') }; };
    G_.down = (x, y) => { let hit = null, bd = 1e9; G_.b.forEach(b => { const by = b.y + Math.sin(G_.t * 2.5 + b.ph) * 12, d = Math.hypot(b.x - x, by - y); if (d < 56 && d < bd) { bd = d; hit = b; } }); if (!hit) return; hit.dead = true; const v = hit.type === 'gold' ? 20 : hit.type === 'boot' ? 0 : 6; G_.coins += v; if (hit.type !== 'boot') { G_.got++; G_.last = pick(MSGS); } popT(G_, hit.x, hit.y, hit.type === 'boot' ? '👢 旧靴子' : '+' + v, hit.type === 'gold' ? '#ffd93d' : hit.type === 'boot' ? '#ff9bb0' : '#9bff9b'); };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, 190, '#ffb87a', '#ffe0b0'); g.fillRect(0, 0, GW, 190); g.fillStyle = grad(g, 150, GH, '#2fb4d6', '#0a4a78'); g.fillRect(0, 150, GW, GH); for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= GW; x += 20) g.lineTo(x, 200 + i * 40 + Math.sin(x * .02 + G_.t * 1.5 + i) * 8); g.stroke(); }
      G_.b.forEach(b => { const y = b.y + Math.sin(G_.t * 2.5 + b.ph) * 12; g.save(); g.translate(b.x, y); g.rotate(Math.sin(G_.t * 2 + b.ph) * .25); gtxt(g, b.type === 'boot' ? '👢' : '🍾', 0, 0, 56); if (b.type === 'gold') { g.globalAlpha = .6 + .4 * Math.sin(G_.t * 8); gtxt(g, '✨', 0, -4, 70); g.globalAlpha = 1; } g.restore(); });
      gtxt(g, '点漂过来的瓶子！✨金色瓶 +20，别捞靴子', 480, 60, 24, '#4a2a00'); gtxt(g, '⏱ ' + Math.max(0, Math.ceil(G_.left)) + 's', 880, 30, 26, '#4a2a00', 'right'); };
    return G_;
  }

  /* ---- 烟花：三档价格选择 ---- */
  const FWT = [
    { id: 0, name: '小烟花', cost: 20, icon: '🎆', desc: '6 发 · 约 9 秒', n: 6, gap: 1.2, spread: 9, hmin: 5.5, hmax: 8, dur: 10 },
    { id: 1, name: '璀璨烟花', cost: 60, icon: '🎇', desc: '18 发 · 约 20 秒 · 多种花型', n: 18, gap: 1.05, spread: 14, hmin: 6, hmax: 10, dur: 21 },
    { id: 2, name: '盛宴烟花', cost: 150, icon: '✨', desc: '40 发 · 约 30 秒 · 三幕演出', n: 40, gap: .8, spread: 20, hmin: 6, hmax: 12, dur: 33 }
  ];
  function gFwMenu() {
    const G_ = baseGame(); G_.title = '🎆 选择烟花套餐'; G_.sel = -1;
    G_.update = (dt) => { G_.t += dt; };
    G_.down = (x, y) => { for (let i = 0; i < 3; i++) { const cx = 190 + i * 290; if (Math.abs(x - cx) < 130 && y > 120 && y < 430) { const T = FWT[i]; if (st.fwBusy > 0) { host.toast('烟花还在天上呢 🎆'); return; } if (!spend(T.cost)) return; gmClose(); startFw(i); return; } } };
    G_.draw = (g) => { g.fillStyle = grad(g, 0, GH, '#0a0a2a', '#1a0a3a'); g.fillRect(0, 0, GW, GH); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + (.25 + .25 * Math.sin(G_.t * 2 + i)) + ')'; g.fillRect((i * 83) % GW, (i * 47) % 160, 3, 3); }
      gtxt(g, '价格越高，烟花越盛大，持续越久', 480, 70, 26, '#ffe9a8');
      FWT.forEach((T, i) => { const cx = 190 + i * 290, hh = 280 + i * 20, y0 = 430 - hh; rrect(g, cx - 130, y0, 260, hh, 22); g.fillStyle = ['#2a3a6a', '#4a2a7a', '#7a2a4a'][i]; g.fill(); g.strokeStyle = ['#7fa8ff', '#c79bff', '#ffb36a'][i]; g.lineWidth = 4; g.stroke();
        gtxt(g, T.icon, cx, y0 + 55, 56); gtxt(g, T.name, cx, y0 + 112, 30, '#fff'); gtxt(g, T.desc, cx, y0 + 152, 17, '#cfe9ff'); if (i === 2) gtxt(g, '含终章', cx, y0 + 180, 17, '#ffd93d');
        rrect(g, cx - 80, y0 + hh - 70, 160, 50, 25); g.fillStyle = '#ffb03a'; g.fill(); gtxt(g, '🪙 ' + T.cost, cx, y0 + hh - 45, 26, '#3a2000'); }); };
    return G_;
  }
  function startFw(tier) {
    const T = FWT[tier], t = performance.now() / 1000; st.fwBusy = T.dur; host.toast('🎆 ' + T.name + '开始！看天上～', 2600); host.bubble(T.icon, 3); host.act('cheer', 3);
    const cols = [[[1, .4, .6], [1, .8, .9]], [[.4, .8, 1], [.8, 1, 1]], [[1, .85, .3], [1, 1, .7]], [[.6, 1, .5], [.9, 1, .8]], [[.8, .5, 1], [1, .8, 1]], [[1, .6, .25], [1, .9, .6]]];
    const kinds = tier === 0 ? ['peony'] : tier === 1 ? ['peony', 'peony', 'willow', 'ring', 'double'] : ['peony', 'willow', 'ring', 'double', 'palm'];
    const shot = (t0, kind, big) => { const sp = T.spread, x = PIERX + (Math.random() - .5) * 2 * sp, z = -24 - Math.random() * 14, hh = T.hmin + Math.random() * (T.hmax - T.hmin), cc = pick(cols), k0 = big ? 1.3 : 1;
      later.push([t0, () => { for (let k = 0; k < 12; k++) later.push([performance.now() / 1000 + k * .05, () => addP(FW.x + (x - FW.x) * (k / 12), 1.3 + (hh - 1.3) * (k / 12), FW.z + (z - FW.z) * (k / 12), 0, 0, 0, .5, .3, [1, .9, .6], 0, 0)]); }],
        [t0 + .7, () => { if (kind === 'willow') { burst(x, hh, z, 70, 6.2 * k0, 3.2, .34, [[1, .85, .4], [1, .7, .25]], -2.2); } else if (kind === 'ring') { const yw = Math.random() * PI; for (let k = 0; k < 44; k++) { const a = k / 44 * TAU; addP(x, hh, z, Math.cos(a) * 7 * Math.cos(yw) * k0, Math.sin(a) * 7 * k0, Math.cos(a) * 7 * Math.sin(yw) * k0, 1.9, .4, cc[k % 2], -3, .9); } burst(x, hh, z, 18, 3, 1.4, .5, [[1, 1, 1]], -3); } else if (kind === 'palm') { for (let r = 0; r < 7; r++) { const a = r / 7 * TAU; for (let k = 0; k < 10; k++) addP(x, hh, z, Math.cos(a) * (3 + k * .5), 5 + k * .3, Math.sin(a) * (3 + k * .5), 2.6, .34, cc[k % 2], -4, .8); } burst(x, hh, z, 30, 3, 1.5, .5, [[1, 1, 1]], -3); } else { burst(x, hh, z, Math.round(90 * k0), 9 * k0, 1.9, .42, cc, -4); burst(x, hh, z, 26, 4.5, 1.4, .55, [[1, 1, 1]], -3); if (kind === 'double') { const c2 = pick(cols); later.push([performance.now() / 1000 + .35, () => burst(x + 2, hh - 1, z, 70, 7, 1.7, .4, c2, -4)]); } } }]); };
    let tt = t + .3;
    if (tier < 2) for (let i = 0; i < T.n; i++) { shot(tt, tier === 0 ? 'peony' : pick(kinds), false); tt += T.gap * (.75 + Math.random() * .5); }
    else { for (let i = 0; i < 12; i++) { shot(tt, pick(['peony', 'double']), false); tt += .9 + Math.random() * .3; }
      for (let i = 0; i < 14; i++) { shot(tt, pick(['willow', 'ring', 'palm', 'peony']), true); tt += .7 + Math.random() * .25; }
      later.push([tt, () => host.toast('🎆 终章！', 1800)]); for (let i = 0; i < 14; i++) { shot(tt + .5 + i * .16, pick(['peony', 'double', 'ring']), true); } }
  }
  /* ---- 6 大头贴（3 连拍 + 相纸） ---- */
  function gPhoto() {
    const G_ = baseGame(); G_.title = '📸 大头贴'; G_.phase = 'choose'; G_.frame = 0; G_.shot = 0; G_.cd = 0; G_.shots = []; G_.flash = 0; G_.pt = 0;
    const FR = [{ n: '粉色爱心', c: '#ff8fbf', e: '💗' }, { n: '星空蓝', c: '#6aa8ff', e: '⭐' }, { n: '薄荷绿', c: '#6be5b0', e: '🍀' }], POSES = ['比个 ✌ 耶！', '做个鬼脸 😜', '笑一个 😊'];
    G_.snap = () => { const gl = document.getElementById('gl'), c = document.createElement('canvas'); c.width = 240; c.height = 300; const x = c.getContext('2d'); let ok = false; try { const v = R.view, me = host.g().me, p = R.project([me.x, me.y + .9, me.z]); if (p && gl) { const k = gl.width / (gl.clientWidth || gl.width), sz = Math.max(160, 300 * (gl.height / 600)), sx = p[0] - sz * .4, sy = p[1] - sz * .5; x.drawImage(gl, sx, sy, sz * .8, sz, 0, 0, 240, 300); const d = x.getImageData(0, 0, 8, 8).data; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 12) ok = true; } } catch (e) { } if (!ok) { x.fillStyle = '#9fd0ff'; x.fillRect(0, 0, 240, 300); x.font = '120px ' + FONT; x.textAlign = 'center'; x.fillText('🙂', 120, 190); } return c; };
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

  function castleAfter(d) { const c = CASTLE; castleB.forEach(b => b.count = 0); c.stage = Math.min(4, Math.floor((d.layers || 0) / 2)); for (let i = 0; i < c.stage; i++) castleB[i].count = castleB[i]._c; c.t = 0; poof(c.x, .6, c.z); }
  const GAMES = { fish: { make: gFish, cost: 0, noAgain: true }, castle: { make: gCastle, cost: 0, after: castleAfter }, bar: { make: gBar, cost: 0 }, ice: { make: gIce, cost: 12 }, fire: { make: gFire, cost: 0 }, photo: { make: gPhoto, cost: 0 }, bottle: { make: gBottle, cost: 0 }, fw: { make: gFwMenu, cost: 0, noAgain: true } };
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
  function gmFinish(d) { gm.res = d; if (d.coins) host.coins(d.coins); const again = () => { if (gm.def.cost && !spend(gm.def.cost)) return; gm.game = gm.def.make(); gm.res = null; gm.btns = []; }; gm.def.after && gm.def.after(d); gm.btns = [{ x: 240, y: 380, w: 220, h: 66, f: again, t: '再玩一次' + (gm.def.cost ? '（-' + gm.def.cost + '）' : ''), c: '#ffb03a' }, { x: 500, y: 380, w: 220, h: 66, f: gmClose, t: '完成', c: '#6be58a' }]; if (gm.def.noAgain) { gm.btns = [{ x: 370, y: 380, w: 220, h: 66, f: gmClose, t: '完成', c: '#6be58a' }]; } }
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
  /* 排球小游戏：球过来时再按一次“击球” */
  const VBA = () => [VB.x - 1.8, VB.z + 2.6], VBB = () => [VB.x + 1.6, VB.z - 2.6];
  function volley() {
    const v = st.vb, t = performance.now() / 1000;
    if (v.s === 0) { v.rally = 0; serve(true); host.toast('🏐 发球！球回来时按“击球”'); host.wave(1); host.bubble('🏐'); }
    else if (v.s === 2) { const dt = t - v.hitAt; if (dt > -.65 && dt < .4) { v.rally++; host.wave(1); host.bubble(['好球!', '漂亮!', '🏐', '再来!'][v.rally % 4]); serve(true); } else host.toast('太早啦～等球落下来'); }
    else host.toast('球在空中！');
  }
  function serve(fromMe) { const v = st.vb, t = performance.now() / 1000; v.s = 1; v.t = t; v.from = VBA(); v.to = VBB(); v.dur = 1.15; v.side = 0; }
  function volleyStep(t) {
    const v = st.vb; if (v.s === 0) return null; const u = (t - v.t) / v.dur;
    if (v.s === 1) { if (u >= 1) { if (Math.random() < .86 - Math.min(.5, v.rally * .06)) { v.s = 2; v.t = t; v.from = VBB(); v.to = VBA(); v.dur = 1.35; v.hitAt = t + v.dur; } else { v.s = 0; host.toast('对手失误！你们打了 ' + (v.rally + 1) + ' 回合，+' + (6 + v.rally * 4) + ' 金币 🎉', 2600); host.coins(6 + v.rally * 4); return null; } } }
    else if (v.s === 2) { if (t > v.hitAt + .4) { v.s = 3; v.t = t; v.from = VBA(); v.to = [VBA()[0] + .4, VBA()[1] + 1.2]; v.dur = .45; host.toast(v.rally ? '漏接了！一共 ' + v.rally + ' 回合' + (v.rally ? '，+' + (v.rally * 4) + ' 金币' : '') : '没接到～再来一次', 2200); if (v.rally) host.coins(v.rally * 4); } }
    else if (v.s === 3) { if (u >= 1) { v.s = 0; return null; } }
    const uu = clamp((t - v.t) / v.dur, 0, 1), a = v.from, b = v.to, apex = v.s === 3 ? .8 : 3.6, x = lerp(a[0], b[0], uu), z = lerp(a[1], b[1], uu), y = .7 + (v.s === 3 ? 0 : 0) + 4 * apex * uu * (1 - uu) * (v.s === 3 ? 1 : 1) + (v.s === 3 ? 0 : lerp(0, 1.2, 1 - Math.abs(uu - .5) * 2) * 0) ;
    return [x, y, z, uu];
  }

  /* ---------- 帧驱动（由 S.env 调用） ---------- */
  let hooked = false, lastT = performance.now() / 1000, accW = 99, accG = 99, lastH = -1;
  function installHooks() {
    if (hooked) return; const g = window.__game; if (!g) return; hooked = true;
    const btn = document.getElementById('enterBtn'), orig = btn.onclick;
    btn.onclick = e => { const n = (window.__game || {}).near; if (n && n.act && S.hotspots.includes(n)) act(n); else if (orig) orig.call(btn, e); };
    window.addEventListener('keydown', ev => { if (ev.target && ev.target.tagName === 'INPUT') return; if (ev.key === 'e' || ev.key === 'E' || ev.key === 'Enter') { const n = (window.__game || {}).near; if (n && n.act && S.hotspots.includes(n)) { act(n); ev.stopImmediatePropagation(); } } }, true);
  }
  function envBeach(h) {
    const e = Object.assign({}, envAt(h)); e.fog = mix(e.bot, e.top, .9); e.fogNear = 70; e.fogFar = 230; return e;
  }
  const sunCol = (e) => mix(mix([1, 1, .95], [1, .62, .3], e.gold), [.75, .85, 1], e.night);
  function tick(h, e) {
    const now = performance.now() / 1000, dt = Math.min(.1, now - lastT); lastT = now; const t = now, g = window.__game; installHooks();
    const me = g && g.me, cam = g && g.cam, camX = cam ? cam.target[0] : 0, camZ = cam ? cam.target[2] : 0;
    // 定时器队列
    for (let i = later.length - 1; i >= 0; i--) if (later[i][0] <= t) { const f = later[i][1]; later.splice(i, 1); f(); }
    // 海面与浪花
    accW += dt; if (accW > .06 || Math.abs(h - lastH) > .02) { accW = 0; lastH = h; rebuildWater(t, e); }
    rebuildFoam(t, e);
    // 冷却
    st.fireCd = Math.max(0, st.fireCd - dt); st.bottleCd = Math.max(0, st.bottleCd - dt); st.fwBusy = Math.max(0, st.fwBusy - dt); st.photoT = Math.max(0, st.photoT - dt);
    if (CASTLE.stage >= 4) { CASTLE.t += dt; if (CASTLE.t > 18) { CASTLE.stage = 0; CASTLE.t = 0; castleB.forEach(b => b.count = 0); poof(CASTLE.x, .5, CASTLE.z); host.toast('🌊 海浪把沙堡冲走了，再堆一个吧'); } }
    // 钓鱼状态
    const f = st.fish; if (f.s > 0) { f.t += dt; if (me && Math.hypot(me.x - PIERX, me.z + 30.4) > 3.4) { f.s = 0; host.toast('走远了，鱼线收回来了'); } else if (f.s === 1 && f.t > f.wait) { f.s = 2; f.t = 0; host.toast('❗ 鱼上钩了！快点“收竿”', 1800); host.bubble('❗', 2); splash(PIERX, -36.4, 6); } else if (f.s === 2 && f.t > 2.0) { f.s = 0; host.toast('鱼跑掉了…'); } }
    const sT = performance.now() / 1000;
    // 按钮文字
    const n = g && g.near; if (n && S.hotspots.includes(n)) { const tx = document.getElementById('enterText'), ic = document.getElementById('enterIcon'); let label = n.btn; if (n.id === 'fish') label = f.s === 0 ? '钓鱼' : f.s === 1 ? '收竿' : '收竿！'; if (n.id === 'volley') label = st.vb.s === 2 ? '击球！' : '打排球'; if (tx) tx.textContent = label; if (ic) ic.textContent = X.ICONS[n.icon]; }

    /* ---- 天空：太阳 / 月亮 / 地平线光 / 云 ---- */
    const ev = R.view ? R.view.eye : [camX, 8.5, camZ + 24], eyeY = ev[1], D = 105, sx = camX * .9 + 14;
    dynSky.v.length = 0; dynSky.i.length = 0; dynSky.n = 0;
    const sc = sunCol(e), elev = lerp(.012, .055, e.day) * (1 - e.night) + e.night * .05, sy = eyeY + D * Math.tan(clamp(elev, .01, .06)) + 1, sz = ev[2] - D - 30;
    const vis = 1 - e.night * .15; const sunI = (1 - e.night); // 太阳
    if (sunI > .02) { bb(dynSky, sx, sy, sz, 60, 60, mul(sc, .55 * sunI)); bb(dynSky, sx, sy, sz, 22, 22, mul(sc, .9 * sunI)); bb(dynSky, sx, sy, sz, 6.5, 6.5, mul([1, 1, 1], 1.2 * sunI)); }
    // 月亮
    if (e.night > .05) { const mx = camX * .9 - 20, my = eyeY + D * .052 + 1; bb(dynSky, mx, my, sz, 26, 26, mul([.45, .6, 1], .5 * e.night)); bb(dynSky, mx, my, sz, 5, 5, mul([.95, .97, 1], 1.4 * e.night)); }
    // 地平线暖光
    bb(dynSky, camX, eyeY + 1, sz, 190, 7, mul(sc, (.2 + e.gold * .45) * (1 - e.night * .8)));
    // 灯塔灯光（闪烁）
    const lh = S.lighthouse; { const blink = Math.pow(Math.max(0, Math.sin(t * .9)), 6), v = (e.night * .9 + .08) * (.15 + blink * 1.2); bb(dynSky, lh[0], lh[1], lh[2], 9 + blink * 14, 9 + blink * 14, mul([1, .95, .7], v)); }
    upload(bSky, dynSky);
    // 云
    dynCloud.v.length = 0; dynCloud.i.length = 0; dynCloud.n = 0; { const cc = mix(mix([1, 1, 1], [1, .66, .55], e.gold), [.2, .22, .4], e.night); [[-120, 4.4, 80, 14], [-30, 5.4, 110, 18], [70, 4.2, 90, 15], [150, 5.8, 100, 16], [-210, 5.2, 90, 14]].forEach(([ox, ang, w, hh], i) => { const x = camX * .85 + ox + Math.sin(t * .01 + i) * 6 + t * .4 % 300 * 0, y = eyeY + 150 * Math.tan(ang / 57.3) + hh * .5; bb(dynCloud, x, y, ev[2] - 150, w, hh, cc); }); }
    upload(bCloud, dynCloud);

    /* ---- 海面闪光：太阳/月亮倒影 ---- */
    dynGlow.v.length = 0; dynGlow.i.length = 0; dynGlow.n = 0;
    { const gi = (e.day * .35 + e.gold * 1 + e.night * .5), gc = mix(mix([1, 1, 1], [1, .75, .4], e.gold), [.6, .75, 1], e.night), r = (k) => { const s = Math.sin(k * 12.9898) * 43758.5453; return s - Math.floor(s); };
      for (let i = 0; i < 110; i++) { const zz = -14 - r(i) * 110, spread = 4 + (-zz - 14) * .22, x = sx + (r(i + 99) - .5) * spread * 2 - (-zz - 14) * .0, ph = r(i + 7) * 6, tw = Math.pow(Math.max(0, Math.sin(t * (2.2 + r(i + 3) * 2) + ph)), 4), a = tw * gi * (1.3 - (-zz - 14) / 140); if (a > .02 && inside(x, zz) === false) bb(dynGlow, x, .08, zz, .35 + (-zz) * .02, .1 + (-zz) * .01, mul(gc, a)); }
      // 水边的星点（白天也有）
      for (let i = 0; i < 26; i++) { const x = (r(i + 300) - .5) * 70 + camX * .6, zz = zc(x) - 2 - r(i + 400) * 16, ph = r(i + 9) * 6, a = Math.pow(Math.max(0, Math.sin(t * 2.6 + ph)), 6) * (.25 + e.day * .5 + e.night * .5); if (a > .03 && !inside(x, zz)) bb(dynGlow, x, .08, zz, .22, .07, mul([1, 1, 1], a)); } }

    // 篝火火焰 + 光
    { const fl = (e.night * .9 + .35), fx = FIRE.x, fz = FIRE.z; for (let i = 0; i < 5; i++) { const k = t * 7 + i * 1.7, h2 = .9 + .5 * Math.sin(k) * Math.cos(k * .7) + i * .1, w = (.55 - i * .07) * (1 + .15 * Math.sin(k * 1.3)); bb(dynGlow, fx + Math.sin(k * .9) * .12, .5 + h2 * .5, fz, w, h2 * .6, mul(i < 2 ? [1, .45, .12] : [1, .8, .3], 1.0)); }
      bb(dynGlow, fx, 1.2, fz, 3.6 * fl, 3.0 * fl, mul([1, .55, .2], .35 * fl + .1 * Math.sin(t * 11))); if (Math.random() < dt * 12) addP(fx + (Math.random() - .5) * .5, .9, fz + (Math.random() - .5) * .4, (Math.random() - .5) * .8, 1.6 + Math.random() * 1.6, (Math.random() - .5) * .8, 1.3, .12, [1, .65, .25], -.3, .3); }
    // 漂流瓶光点
    bb(dynGlow, BOTTLE.x, .7 + Math.sin(t * 2) * .05, BOTTLE.z, 1.0, 1.0, mul([.6, 1, .85], .6 + .3 * Math.sin(t * 3)));
    // 贝壳光点
    shells.forEach(s => { if (s.alive) bb(dynGlow, s.x, .35, s.z, .7, .7, mul([1, .85, 1], .5 + .35 * Math.sin(t * 3 + s.ph))); else { s.t -= dt; if (s.t <= 0) s.alive = true; } });
    // 船灯 / 岸灯
    boats.forEach((b, i) => { const by = .85 * b.s * 3.2 + Math.sin(t * 1.3 + i) * .08; bb(dynGlow, b.x + Math.cos(b.yaw) * 0, by + .1, b.z, 1.4 * b.s, 1.4 * b.s, mul([1, .85, .55], e.night * .9 + .1)); });
    upload(bGlow, dynGlow);

    /* ---- 不透明动态物：海鸥、船、螃蟹、排球、贝壳、钓竿、瓶子、悬浮图标 ---- */
    const mb = dynOpaque; mb.v.length = 0; mb.i.length = 0; mb.n = 0;
    // 海鸥
    gulls.forEach(gl => { const a = t * gl.sp + gl.ph, x = gl.cx + Math.cos(a) * gl.r, z = gl.cz + Math.sin(a) * gl.r * .6, y = gl.y + Math.sin(a * 2) * .8, vx = -Math.sin(a) * gl.sp, vz = Math.cos(a) * gl.sp * .6, vl = Math.hypot(vx, vz) || 1, fx2 = vx / vl, fz2 = vz / vl, rx = -fz2, rz = fx2, fl = Math.sin(t * 6 + gl.ph) * .55, sp = 1.5;
      mb.sphere(x, y, z, .28, .2, .28, [.97, .97, .98], 4); [-1, 1].forEach(s => { mb.quad([x, y, z], [x + rx * s * sp, y + fl * .8 * (s), z + rz * s * sp], [x + rx * s * sp - fx2 * .9, y + fl * .8 * s - .1, z + rz * s * sp - fz2 * .9], [x - fx2 * .5, y, z - fz2 * .5], [0, 1, 0], [0, 0, 1, 1], s > 0 ? [.92, .93, .95] : [.9, .91, .94]); }); });
    // 船
    boats.forEach((b, i) => { const s0 = mb.n, bob = Math.sin(t * 1.3 + i) * .1, roll = Math.sin(t * 1.1 + i * 2) * .06, pit = Math.cos(t * .9 + i) * .04, sS = b.s;
      mb.box(-1.8, 0, -.5, 1.8, .45, .5, [.95, .95, .98]); mb.box(-1.5, -.25, -.4, 1.5, 0, .4, [.2, .26, .45]); mb.box(1.8, 0, -.35, 2.3, .45, .35, b.col); mb.box(-1.9, .45, -.55, 1.9, .55, .55, b.col);
      if (!b.moored) { mb.cyl(0, 0, .5, 4.6, .06, .05, 6, [.7, .7, .75]); mb.quad([.1, .9, 0], [1.7, .9, 0], [.1, 4.4, 0], [.1, 4.4, 0], [0, 0, 1], [0, 0, 1, 1], [.98, .98, .96]); mb.quad([-.1, 1.0, 0], [-1.5, 1.0, 0], [-.1, 3.8, 0], [-.1, 3.8, 0], [0, 0, 1], [0, 0, 1, 1], b.col); }
      else { mb.box(-.6, .55, -.35, .6, 1.1, .35, [.95, .85, .7]); }
      const cy = Math.cos(b.yaw), sy2 = Math.sin(b.yaw), cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pit), sp2 = Math.sin(pit);
      for (let k = s0; k < mb.n; k++) { const o = k * 11; let x = mb.v[o] * sS, y = mb.v[o + 1] * sS, z = mb.v[o + 2] * sS; let x1 = x * cr - y * sr, y1 = x * sr + y * cr, z1 = z; let y2 = y1 * cp - z1 * sp2, z2 = y1 * sp2 + z1 * cp; mb.v[o] = b.x + x1 * cy + z2 * sy2; mb.v[o + 1] = .02 + bob + y2; mb.v[o + 2] = b.z - x1 * sy2 + z2 * cy; } });
    // 螃蟹
    crabs.forEach(c => { let dx = 0; if (me && Math.hypot(me.x - c.x, me.z - c.z) < 3) { dx = Math.sign(c.x - me.x) || 1; c.flee = 1; } else { c.ph += dt; dx = Math.sin(c.ph * .7 + c.dir) > .3 ? c.dir * .35 : 0; } c.x = clamp(c.x + dx * (c.flee ? 3.2 : 1) * dt, -43, 43); c.flee = Math.max(0, c.flee - dt * .5); c.z = zc(c.x) + 1.4 + Math.sin(c.x * .6) * .3; const y = .08 + Math.abs(Math.sin(t * 12 * (dx ? 1 : 0))) * .02;
      mb.sphere(c.x, y + .1, c.z, .2, .1, .15, [.95, .4, .3], 5); [-1, 1].forEach(s => { mb.sphere(c.x + s * .26, y + .14, c.z - .12, .09, .07, .07, [1, .45, .3], 4); mb.sphere(c.x + s * .08, y + .22, c.z - .06, .035, .035, .035, [.05, .05, .05], 3); }); });
    // 贝壳
    shells.forEach(s => { if (s.alive) { mb.sphere(s.x, .1, s.z, .17, .09, .13, [1, .78, .85], 4); mb.sphere(s.x + .08, .13, s.z, .09, .06, .08, [1, .95, .95], 3); if (me && Math.hypot(me.x - s.x, me.z - s.z) < 1.0) { s.alive = false; s.t = 28; host.coins(6); host.toast('✨ 捡到一枚贝壳 +6 金币', 1400); burst(s.x, .5, s.z, 10, 2.2, .8, .2, [[1, .8, .95], [1, 1, .8]], -3); } } });
    // 漂流瓶
    { const bobb = Math.sin(t * 1.7) * .06; mb.cyl(BOTTLE.x, BOTTLE.z, .0 + bobb, .55 + bobb, .12, .1, 6, [.5, .85, .8]); mb.cyl(BOTTLE.x, BOTTLE.z, .55 + bobb, .75 + bobb, .06, .05, 6, [.5, .85, .8]); mb.sphere(BOTTLE.x, .8 + bobb, BOTTLE.z, .07, .06, .07, [.8, .55, .3], 4); }
    // 排球
    const bp = volleyStep(t); dynShadow.v.length = 0; dynShadow.i.length = 0; dynShadow.n = 0;
    if (bp) { mb.sphere(bp[0], bp[1], bp[2], .26, .26, .26, [1, .95, .85], 6); mb.sphere(bp[0] + .02, bp[1] + .02, bp[2] + .02, .265, .1, .265, [.35, .55, 1], 6); dynShadow.floor(bp[0] - .3, bp[2] - .3, bp[0] + .3, bp[2] + .3, .05, [0, 0, 0]); }
    // 钓竿 + 鱼线
    if (f.s > 0 && me) { const hx = me.x + .35, hz = me.z - .2, tipx = me.x + .5, tipy = 2.3, tipz = me.z - 1.2; tube(mb, [[hx, .9 + me.y, hz], [tipx, tipy + me.y, tipz]], [.03, .015], 4, [.35, .24, .16]);
      const bx = PIERX, bz = -36.6 + (f.s === 2 ? Math.sin(t * 25) * .05 : 0), by = .07 - (f.s === 2 ? .12 + Math.sin(t * 20) * .04 : Math.sin(t * 2) * .02), pts = []; for (let k = 0; k <= 12; k++) { const u = k / 12; pts.push([lerp(tipx, bx, u), lerp(tipy + me.y, by + .04, u) - Math.sin(u * PI) * .35 - u * u * 0, lerp(tipz, bz, u)]); } tube(mb, pts, pts.map(() => .012), 3, [.9, .92, .95]);
      mb.sphere(bx, by + .06, bz, .1, .1, .1, [1, .25, .25], 5); mb.sphere(bx, by + .13, bz, .08, .06, .08, [1, 1, 1], 4); }
    // 海豚
    { dolphin.next -= dt; if (!dolphin.on && dolphin.next <= 0) { dolphin.on = true; dolphin.t = 0; dolphin.x = camX * .5 + (Math.random() - .5) * 26; dolphin.z = -16 - Math.random() * 14; dolphin.dx = Math.random() < .5 ? 1 : -1; }
      if (dolphin.on) { dolphin.t += dt; const T2 = 1.8, u = dolphin.t / T2; if (u > 1) { dolphin.on = false; dolphin.next = 14 + Math.random() * 18; splash(dolphin.x + dolphin.dx * 4.5, dolphin.z, 14); } else { if (dolphin.t - dt < .02) splash(dolphin.x, dolphin.z, 12); const pts = [], rs = [], rr = [.1, .22, .27, .23, .15, .08]; for (let k = 0; k < 6; k++) { const u2 = clamp(u - k * .045, 0, 1), px = dolphin.x + dolphin.dx * u2 * 4.5, py = .02 + 4 * 2.2 * u2 * (1 - u2) * 1 - .5 + .5, ang = 0; pts.push([px, Math.max(py - .0, -.2), dolphin.z]); } tube(mb, pts.reverse(), rr, 6, [.55, .62, .72]); } } }
    upload(bOpaque, mb);

    // 船影/其他 mode3 阴影
    upload(bShadow, dynShadow);

    /* ---- 粒子 ---- */
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < .05 && p.g < -5) { p.y = .05; p.vy *= -.2; } }
    dynPart.v.length = 0; dynPart.i.length = 0; dynPart.n = 0; parts.forEach(p => { const a = Math.pow(p.life / p.max, 1.4); bb(dynPart, p.x, p.y, p.z, p.size * (.6 + a * .6), p.size * (.6 + a * .6), mul(p.col, a * 1.1)); });
    upload(bPart, dynPart);

    /* ---- 悬浮图标 ---- */
    dynIcons.v.length = 0; dynIcons.i.length = 0; dynIcons.n = 0;
    [...S.hotspots, S.portals[0]].forEach(hs => { const near = me ? Math.hypot(me.x - hs.x, me.z - hs.z) : 99, sz = .62 + (near < hs.r ? .12 + .05 * Math.sin(t * 6) : 0), cx = hs.x, cy = (hs.iy || 3) + Math.sin(t * 2.2 + hs.x) * .14, cz = hs.z; if (hs.id === 'bottle') return;
      const col = (hs.icon % 4) * .25, row = Math.floor(hs.icon / 4) * .25, base = dynIcons.n, segs = 14, C = [0, 0, 0]; dynIcons.vert([cx, cy, cz], [0, 1, 0], col + .125, row + .125, C);
      for (let k = 0; k <= segs; k++) { const a = k / segs * TAU, ca = Math.cos(a), sa = Math.sin(a); dynIcons.vert([cx + ca * sz, cy + CU[1] * sa * sz, cz + CU[2] * sa * sz], [0, 1, 0], col + .125 + ca * .108, row + .125 - sa * .108, C); }
      for (let k = 0; k < segs; k++) dynIcons.i.push(base, base + 1 + k, base + 2 + k); });
    upload(bIcons, dynIcons);
    const sec = e.night; return;
  }

  S.bounds = { x0: -47, x1: 47, z0: -35, z1: 30 };
  S.spawn = [2, 14];
  S.camera = { dist: 25, pitch: CP, fov: .86, clampX: [-27, 27], clampZ: [-8, 17], lead: 3 };
  S.npcRect = { x0: -42, x1: 42, z0: -6, z1: 27 };
  S.npcCount = 16;
  S.heightAt = (x, z) => { if (onPier(x, z, -.25)) return pierY(z) * 1 + (z < PIER_Z0 - 2.4 ? 0 : 0); const d = zc(x) - z; return d > 0 ? seabed(d) : 0; };
  S.name = '星光海滩'; S.indoor = false;
  S.env = (h) => { const e = envBeach(h); try { tick(h, e); } catch (err) { if (!S._err) { S._err = 1; console.error('[beach tick]', err); } } return e; };
  return S;
}

G.Scenes = G.Scenes || {}; G.Scenes.makeBeach = makeBeach;
})(window);
