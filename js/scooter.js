/* scooter.js — 「星驰 STARGO」共享电动踏板：程序化建模（无外部资源）。
   Scooter.build(colorHex, {stand})  → { main, glow, decal } 三个局部坐标网格（MB）；前方 = +z，左 = +x，地面 y=0，约 1.1 米长（未缩放）。
   Scooter.emit(targetMB, srcMB, x, y, z, yaw, scale, pitch, roll) → 把局部网格变换后追加到另一个网格里（停车位 / 骑行中每帧都用它）。
   Scooter.atlas(R, colorHex) → 车身贴花贴图（STARGO 字标 / 二维码牌 / 仪表屏 / 侧标）。
   Scooter.COLORS → 可选颜色（默认第一个：紫色）。 */
(function (G) {
'use strict';
const { MB, hex } = G.World;
const PI = Math.PI, TAU = PI * 2;
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const COLORS = [
  { id: 'purple', name: '星空紫', hex: '#7a5cf0' },
  { id: 'sky', name: '天空蓝', hex: '#2f9bff' },
  { id: 'mint', name: '薄荷绿', hex: '#1fc79b' },
  { id: 'coral', name: '珊瑚红', hex: '#ff5a62' },
  { id: 'sun', name: '日落橙', hex: '#ff9d2e' },
  { id: 'pink', name: '樱花粉', hex: '#ff72b8' },
  { id: 'black', name: '曜石黑', hex: '#2c2e38' },
  { id: 'white', name: '珍珠白', hex: '#eceef5' },
];

/* ---------------- 带变换的小型建模器 ---------------- */
class Build {
  constructor() { this.m = [1, 0, 0, 0, 1, 0, 0, 0, 1]; this.t = [0, 0, 0]; this.st = []; }
  push() { this.st.push([this.m.slice(), this.t.slice()]); return this; }
  pop() { const s = this.st.pop(); this.m = s[0]; this.t = s[1]; return this; }
  T(x, y, z) { const m = this.m; this.t = [this.t[0] + m[0] * x + m[1] * y + m[2] * z, this.t[1] + m[3] * x + m[4] * y + m[5] * z, this.t[2] + m[6] * x + m[7] * y + m[8] * z]; return this; }
  R(r) { const m = this.m, o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = m[i * 3] * r[j] + m[i * 3 + 1] * r[3 + j] + m[i * 3 + 2] * r[6 + j]; this.m = o; return this; }
  RX(a) { const c = Math.cos(a), s = Math.sin(a); return this.R([1, 0, 0, 0, c, -s, 0, s, c]); }
  RY(a) { const c = Math.cos(a), s = Math.sin(a); return this.R([c, 0, s, 0, 1, 0, -s, 0, c]); }
  RZ(a) { const c = Math.cos(a), s = Math.sin(a); return this.R([c, -s, 0, s, c, 0, 0, 0, 1]); }
  P(p) { const m = this.m, t = this.t; return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + t[2]]; }
  N(n) { const m = this.m; return norm([m[0] * n[0] + m[1] * n[1] + m[2] * n[2], m[3] * n[0] + m[4] * n[1] + m[5] * n[2], m[6] * n[0] + m[7] * n[1] + m[8] * n[2]]); }
  vert(mb, p, n, u, v, c) { return mb.vert(this.P(p), this.N(n), u, v, c); }
  quad(mb, p0, p1, p2, p3, n, col, uv) {
    uv = uv || [0, 0, 1, 1];
    const a = this.vert(mb, p0, n, uv[0], uv[3], col), b = this.vert(mb, p1, n, uv[2], uv[3], col), c = this.vert(mb, p2, n, uv[2], uv[1], col), d = this.vert(mb, p3, n, uv[0], uv[1], col);
    mb.i.push(a, b, c, a, c, d);
  }
  box(mb, x0, y0, z0, x1, y1, z1, col) {
    const q = (a, b, c, d, n) => this.quad(mb, a, b, c, d, n, col);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  }
  ellip(mb, c, r, col, seg) {
    seg = seg || 10; const base = mb.n;
    for (let j = 0; j <= seg; j++) for (let k = 0; k <= seg * 2; k++) {
      const th = j / seg * PI, ph = k / (seg * 2) * TAU, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      this.vert(mb, [c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2]], [x / r[0], y / r[1], z / r[2]], k / (seg * 2), j / seg, col);
    }
    const w = seg * 2 + 1;
    for (let j = 0; j < seg; j++) for (let k = 0; k < seg * 2; k++) { const a = base + j * w + k; mb.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
  }
  /* 沿折线扫出的圆管（Catmull-Rom 平滑，可变半径，可封口）*/
  tube(mb, pts, rad, col, seg, caps, sub) {
    seg = seg || 10; sub = sub || 0;
    if (sub > 0) {
      const o = [], n = pts.length;
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
        for (let s = 0; s < sub; s++) {
          const t = s / sub, t2 = t * t, t3 = t2 * t;
          o.push([0, 1, 2].map(k => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
        }
      }
      o.push(pts[n - 1]); pts = o;
    }
    const N = pts.length, rr = i => typeof rad === 'function' ? rad(i / (N - 1)) : rad;
    let tg = [], prev = null, nrm, bn; const base = mb.n;
    for (let i = 0; i < N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)]; const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]); tg.push(t);
      if (!prev) { nrm = Math.abs(t[1]) < .9 ? norm(cross(t, [0, 1, 0])) : norm(cross(t, [1, 0, 0])); }
      else { const d = dot(prev, t); nrm = norm([prev[0] - t[0] * d, prev[1] - t[1] * d, prev[2] - t[2] * d]); }
      prev = nrm; bn = cross(t, nrm); const r = rr(i);
      for (let k = 0; k <= seg; k++) { const a2 = k / seg * TAU, c = Math.cos(a2), s = Math.sin(a2), d = [nrm[0] * c + bn[0] * s, nrm[1] * c + bn[1] * s, nrm[2] * c + bn[2] * s]; this.vert(mb, [pts[i][0] + d[0] * r, pts[i][1] + d[1] * r, pts[i][2] + d[2] * r], d, k / seg, i / (N - 1), col); }
    }
    const w = seg + 1; for (let i = 0; i < N - 1; i++) for (let k = 0; k < seg; k++) { const a = base + i * w + k; mb.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
    if (caps !== false) for (const [idx, sg] of [[0, -1], [N - 1, 1]]) {
      const t = tg[idx], r = rr(idx); let n2 = Math.abs(t[1]) < .9 ? norm(cross(t, [0, 1, 0])) : norm(cross(t, [1, 0, 0])); const b2 = cross(t, n2), cn = this.vert(mb, pts[idx], mul(t, sg), .5, .5, col), b0 = mb.n;
      for (let k = 0; k <= seg; k++) { const a2 = k / seg * TAU, c = Math.cos(a2), s = Math.sin(a2); this.vert(mb, [pts[idx][0] + (n2[0] * c + b2[0] * s) * r, pts[idx][1] + (n2[1] * c + b2[1] * s) * r, pts[idx][2] + (n2[2] * c + b2[2] * s) * r], mul(t, sg), .5, .5, col); }
      for (let k = 0; k < seg; k++) mb.i.push(cn, b0 + k, b0 + k + 1);
    }
  }
  /* 绕 X 轴旋转体：prof = [[轴向x, 半径]]；顺序决定法线朝向（小半径→大半径 = 法线朝 -x；反过来朝 +x）*/
  lathe(mb, c, prof, col, seg) {
    seg = seg || 24; const base = mb.n, w = seg + 1;
    for (let j = 0; j < prof.length; j++) {
      const a = prof[Math.max(0, j - 1)], b = prof[Math.min(prof.length - 1, j + 1)], dx = b[0] - a[0], dr = b[1] - a[1], l = Math.hypot(dx, dr) || 1;
      for (let k = 0; k <= seg; k++) { const an = k / seg * TAU, cs = Math.cos(an), sn = Math.sin(an); this.vert(mb, [c[0] + prof[j][0], c[1] + prof[j][1] * cs, c[2] + prof[j][1] * sn], [-dr / l, dx / l * cs, dx / l * sn], k / seg, j / (prof.length - 1), col); }
    }
    for (let j = 0; j < prof.length - 1; j++) for (let k = 0; k < seg; k++) { const a = base + j * w + k; mb.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
  }
  /* 轮胎：绕 X 轴的圆环 */
  torus(mb, c, R, r, col, su, sv) {
    su = su || 40; sv = sv || 12; const base = mb.n;
    for (let i = 0; i <= su; i++) {
      const ph = i / su * TAU, cy = Math.cos(ph), sz = Math.sin(ph);
      for (let k = 0; k <= sv; k++) { const th = k / sv * TAU, ct = Math.cos(th), st = Math.sin(th); this.vert(mb, [c[0] + st * r * 1.0, c[1] + (R + ct * r) * cy, c[2] + (R + ct * r) * sz], [st, ct * cy, ct * sz], i / su, k / sv, col); }
    }
    const w = sv + 1; for (let i = 0; i < su; i++) for (let k = 0; k < sv; k++) { const a = base + i * w + k; mb.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
  }
  /* 挡泥板：绕 X 轴的圆弧带，角度从 +y 向 +z 计 */
  arcBand(mb, c, r0, r1, a0, a1, x0, x1, col, seg) {
    seg = seg || 18; const P = (a, r, x) => [c[0] + x, c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)], Nr = a => [0, Math.cos(a), Math.sin(a)];
    for (let k = 0; k < seg; k++) {
      const A = a0 + (a1 - a0) * k / seg, B = a0 + (a1 - a0) * (k + 1) / seg, nA = Nr((A + B) / 2);
      this.quad(mb, P(A, r1, x0), P(A, r1, x1), P(B, r1, x1), P(B, r1, x0), nA, col);
      this.quad(mb, P(A, r0, x1), P(A, r0, x0), P(B, r0, x0), P(B, r0, x1), mul(nA, -1), col);
      this.quad(mb, P(A, r0, x0), P(A, r1, x0), P(B, r1, x0), P(B, r0, x0), [-1, 0, 0], col);
      this.quad(mb, P(A, r1, x1), P(A, r0, x1), P(B, r0, x1), P(B, r1, x1), [1, 0, 0], col);
    }
    const tA = [0, -Math.sin(a0), Math.cos(a0)], tB = [0, Math.sin(a1), -Math.cos(a1)];
    this.quad(mb, P(a0, r0, x0), P(a0, r0, x1), P(a0, r1, x1), P(a0, r1, x0), mul(tA, -1), col); this.quad(mb, P(a1, r0, x1), P(a1, r0, x0), P(a1, r1, x0), P(a1, r1, x1), mul(tB, -1), col);
  }
  /* 倒角板：outline = [[x,z]]（外轮廓），顶面 y1，底面 y0，bevel = 倒角 */
  slab(mb, outline, y0, y1, col, bevel, colTop) {
    bevel = bevel == null ? .008 : bevel; colTop = colTop || col; const n = outline.length; let cx = 0, cz = 0; outline.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= n; cz /= n;
    const nr = outline.map((p, i) => { const a = outline[(i + n - 1) % n], b = outline[(i + 1) % n]; let ex = b[0] - a[0], ez = b[1] - a[1]; const l = Math.hypot(ex, ez) || 1; let nx = ez / l, nz = -ex / l; if (nx * (p[0] - cx) + nz * (p[1] - cz) < 0) { nx = -nx; nz = -nz; } return [nx, nz]; });
    const inset = outline.map((p, i) => [p[0] - nr[i][0] * bevel, p[1] - nr[i][1] * bevel]);
    const ctr = this.vert(mb, [cx, y1, cz], [0, 1, 0], .5, .5, colTop), tb = mb.n;
    inset.forEach(p => this.vert(mb, [p[0], y1, p[1]], [0, 1, 0], .5, .5, colTop)); for (let k = 0; k < n; k++) mb.i.push(ctr, tb + k, tb + (k + 1) % n);
    const yb = y1 - bevel;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n, nA = nr[k], nB = nr[k2];
      const nBev = i => [nr[i][0] * .7071, .7071, nr[i][1] * .7071], nSide = i => [nr[i][0], 0, nr[i][1]];
      const a = this.vert(mb, [inset[k][0], y1, inset[k][1]], nBev(k), 0, 0, col), b = this.vert(mb, [inset[k2][0], y1, inset[k2][1]], nBev(k2), 1, 0, col), c = this.vert(mb, [outline[k2][0], yb, outline[k2][1]], nBev(k2), 1, 1, col), d = this.vert(mb, [outline[k][0], yb, outline[k][1]], nBev(k), 0, 1, col);
      mb.i.push(a, b, c, a, c, d);
      const e = this.vert(mb, [outline[k][0], yb, outline[k][1]], nSide(k), 0, 0, col), f = this.vert(mb, [outline[k2][0], yb, outline[k2][1]], nSide(k2), 1, 0, col), g = this.vert(mb, [outline[k2][0], y0, outline[k2][1]], nSide(k2), 1, 1, col), h = this.vert(mb, [outline[k][0], y0, outline[k][1]], nSide(k), 0, 1, col);
      mb.i.push(e, f, g, e, g, h);
      void nA; void nB;
    }
    const cb = this.vert(mb, [cx, y0, cz], [0, -1, 0], .5, .5, col), bb = mb.n; outline.forEach(p => this.vert(mb, [p[0], y0, p[1]], [0, -1, 0], .5, .5, col)); for (let k = 0; k < n; k++) mb.i.push(cb, bb + (k + 1) % n, bb + k);
  }
  /* 放样：sections = [{c:[x,y,z], rx, ry, n}]（沿路径依次排列的超椭圆截面，n 越大越方），用于手掌 / 手腕这类圆润形体 */
  loft(mb, sections, col, K) {
    K = K || 16; const S = sections.length, base = mb.n, grid = [];
    for (let i = 0; i < S; i++) {
      const sc = sections[i], row = [], pw = 2 / (sc.n || 2);
      for (let k = 0; k <= K; k++) { const t = k / K * TAU, ct = Math.cos(t), st = Math.sin(t); row.push([sc.c[0] + sc.rx * Math.sign(ct) * Math.pow(Math.abs(ct), pw), sc.c[1] + sc.ry * Math.sign(st) * Math.pow(Math.abs(st), pw), sc.c[2]]); }
      grid.push(row);
    }
    for (let i = 0; i < S; i++) for (let k = 0; k <= K; k++) {
      const p = grid[i][k], pu = grid[i][(k + 1) % K], pd = grid[i][(k - 1 + K) % K], nv = grid[Math.min(S - 1, i + 1)][k], pv = grid[Math.max(0, i - 1)][k];
      const du = [pu[0] - pd[0], pu[1] - pd[1], pu[2] - pd[2]], dv = [nv[0] - pv[0], nv[1] - pv[1], nv[2] - pv[2]]; let n = norm(cross(du, dv)); const c = sections[i].c;
      if (dot(n, [p[0] - c[0], p[1] - c[1], p[2] - c[2]]) < 0) n = mul(n, -1);
      this.vert(mb, p, n, k / K, i / (S - 1), col);
    }
    const w = K + 1; for (let i = 0; i < S - 1; i++) for (let k = 0; k < K; k++) { const a = base + i * w + k; mb.i.push(a, a + w, a + 1, a + 1, a + w, a + w + 1); }
    for (const [idx, sg] of [[0, -1], [S - 1, 1]]) { const c = sections[idx].c, cn = this.vert(mb, c, [0, 0, sg], .5, .5, col), b0 = mb.n; for (let k = 0; k <= K; k++) this.vert(mb, grid[idx][k], [0, 0, sg], .5, .5, col); for (let k = 0; k < K; k++) mb.i.push(cn, b0 + k, b0 + k + 1); }
  }
  helix(mb, a, b, radius, turns, tr, col) {
    const d = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), n1 = norm(cross(d, Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), n2 = cross(d, n1), N = Math.round(turns * 14), pts = [];
    for (let i = 0; i <= N; i++) { const t = i / N, an = t * turns * TAU, p = lerp3(a, b, t); pts.push([p[0] + (n1[0] * Math.cos(an) + n2[0] * Math.sin(an)) * radius, p[1] + (n1[1] * Math.cos(an) + n2[1] * Math.sin(an)) * radius, p[2] + (n1[2] * Math.cos(an) + n2[2] * Math.sin(an)) * radius]); }
    this.tube(mb, pts, tr, col, 5, false);
  }
}
/* 圆角轮廓（x 方向半宽 hw、z 方向半长 hd 的圆角矩形）*/
function rrect(hw, hd, cr, seg, cx, cz) {
  const o = [], c = [[hw - cr, hd - cr, 0], [-hw + cr, hd - cr, PI / 2], [-hw + cr, -hd + cr, PI], [hw - cr, -hd + cr, PI * 1.5]]; seg = seg || 5; cx = cx || 0; cz = cz || 0;
  c.forEach(([x, z, a0]) => { for (let k = 0; k <= seg; k++) { const a = a0 + k / seg * PI / 2; o.push([cx + x + Math.cos(a) * cr, cz + z + Math.sin(a) * cr]); } });
  return o;
}

/* ---------------- 整车 ---------------- */
function build(colorHex, opt) {
  opt = opt || {}; const B = new Build();
  /* 分组：r = 车身（踏板/后轮挡泥板/脚撑）, f = 转向组（立杆/车把/前叉/前挡泥板/头灯/仪表）, fw = 前轮（随转向 + 自转）, rw = 后轮（自转）。
     每组各有 main / glow / decal 三个网格。cur 指向当前正在写的组。 */
  const GR = {}; ['r', 'f', 'fw', 'rw'].forEach(k => { GR[k] = { main: new MB(), glow: new MB(), decal: new MB() }; });
  let cur = 'r';
  const prox = k => ({ get v() { return GR[cur][k].v; }, get i() { return GR[cur][k].i; }, get n() { return GR[cur][k].n; }, set n(x) { GR[cur][k].n = x; }, vert(p, n, u, v, c) { return GR[cur][k].vert(p, n, u, v, c); } });
  const M = prox('main'), GL = prox('glow'), DC = prox('decal');
  const body = hex(colorHex || COLORS[0].hex), bodyD = mul(body, .72), bodyL = [Math.min(1, body[0] * 1.18 + .05), Math.min(1, body[1] * 1.18 + .05), Math.min(1, body[2] * 1.18 + .05)];
  const BLACK = [.085, .088, .105], DARK = [.15, .155, .18], GREY = [.30, .31, .35], RUB = [.045, .047, .055], SIL = [.80, .82, .87], SILD = [.55, .57, .62], WHITE = [.96, .97, 1];
  const GLOW_W = [1, .96, .86], GLOW_R = [1, .12, .1], GLOW_A = [1, .65, .15];
  const WR = .13, FZ = .5, RZ = -.42, FW = [0, WR, FZ], RW = [0, WR, RZ];
  const UVQ = (u0, v0, u1, v1) => [u0, v0, u1, v1];

  /* ===== 车轮（前 / 后）===== */
  const wheel = (cz, motor) => {
    cur = motor ? 'rw' : 'fw'; const c = [0, WR, cz];
    B.torus(M, c, .104, .026, RUB, 44, 14);                                                          // 轮胎
    for (let k = 0; k < 40; k++) { B.push().T(0, WR, cz).RX(k / 40 * TAU); B.box(M, -.014, .1275, -.0065, .014, .1315, .0065, [.09, .092, .105]); B.pop(); }   // 胎面花纹
    B.lathe(M, c, [[-.026, .060], [-.026, .086], [.026, .086], [.026, .060]], SIL, 36);               // 轮毂外圈（银色）
    B.lathe(M, c, [[.0275, .064], [.0275, .082]], bodyL, 36); B.lathe(M, c, [[-.0275, .082], [-.0275, .064]], bodyL, 36);   // 车身色装饰环
    for (let k = 0; k < 5; k++) { B.push().T(0, WR, cz).RX(k / 5 * TAU + .3); B.box(M, -.0125, .017, -.0105, .0125, .076, .0105, SILD); B.pop(); }   // 五辐
    for (const s of [-1, 1]) {
      B.lathe(M, c, s > 0 ? [[.026, .02], [.032, .02], [.036, .016], [.036, 0]] : [[-.036, 0], [-.036, .016], [-.032, .02], [-.026, .02]], SIL, 18);   // 轮毂盖
      B.lathe(M, c, s > 0 ? [[.0375, 0], [.0375, .01]] : [[-.0375, .01], [-.0375, 0]], bodyD, 18);
    }
    if (motor) { B.lathe(M, c, [[.0405, .05], [.0405, .0]], GREY, 28); B.lathe(M, c, [[-.0405, 0], [-.0405, .05]], GREY, 28); }   // 后轮电机盖
  };
  wheel(FZ, false); wheel(RZ, true);
  /* 前盘刹（随前轮转）+ 卡钳（不转，属于转向组）*/
  cur = 'fw'; B.lathe(M, FW, [[.0335, .043], [.0335, .062]], SIL, 36); cur = 'f'; B.push().T(.0335, WR + .05, FZ + .002); B.box(M, 0, -.011, -.008, .014, .011, .008, [.9, .2, .22]); B.pop(); cur = 'fw';
  for (let k = 0; k < 10; k++) { B.push().T(.0345, WR, FZ).RX(k / 10 * TAU); B.box(M, 0, .047, -.0035, .0008, .058, .0035, BLACK); B.pop(); }

  cur = 'r';
  /* ===== 踏板 ===== */
  const half = [[0, -.31], [.045, -.31], [.075, -.30], [.09, -.275], [.097, -.23], [.099, -.1], [.099, .1], [.097, .2], [.088, .28], [.07, .335], [.045, .36], [0, .365]];
  const outline = half.slice(0, -1).concat(half.slice(1).reverse().map(p => [-p[0], p[1]]));   // 右侧向前 + 左侧返回
  B.slab(M, outline, .093, .138, body, .012, body);
  /* 防滑垫（深色）+ 横向防滑条 */
  const padO = [[.074, -.262], [.083, -.2], [.084, -.05], [.084, .08], [.07, .125], [-.07, .125], [-.084, .08], [-.084, -.05], [-.083, -.2], [-.074, -.262], [-.04, -.274], [.04, -.274]];
  B.slab(M, padO, .136, .1425, [.075, .078, .09], .002);
  for (let z = -.245; z < .11; z += .026) B.box(M, -.078, .1425, z, .078, .1448, z + .0105, [.135, .14, .16]);
  /* 深色电池盖（底部）+ 边缘银色螺丝 */
  B.slab(M, rrect(.082, .26, .05, 5, 0, -.02), .066, .094, DARK, .008);
  for (const s of [-1, 1]) for (const z of [-.2, -.08, .04, .16]) B.ellip(M, [s * .088, .115, z], [.006, .006, .006], SIL, 5);
  /* 踏板侧面彩色灯带（发光）+ 侧反光片 */
  for (const s of [-1, 1]) { B.box(GL, s * .0995, .107, -.2, s * .1015, .119, .17, bodyL); B.box(M, s * .0995, .103, .2, s * .102, .122, .235, [1, .62, .12]); B.box(GL, s * .0995, .107, -.3, s * .1018, .119, -.27, GLOW_R); }
  /* 踏板前部贴花（STARGO 字标，贴在车身色面上）*/
  B.quad(DC, [.085, .1385, .19], [-.085, .1385, .19], [-.085, .1385, .2325], [.085, .1385, .2325], [0, 1, 0], WHITE, UVQ(0, 0, 1, .25));
  B.quad(DC, [.1005, .1265, .12], [.1005, .1265, .032], [.1005, .1335, .032], [.1005, .1335, .12], [1, 0, 0], WHITE, UVQ(.5, .75, 1, .875)); B.quad(DC, [-.1005, .1265, .032], [-.1005, .1265, .12], [-.1005, .1335, .12], [-.1005, .1335, .032], [-1, 0, 0], WHITE, UVQ(.5, .75, 1, .875));

  /* ===== 后挡泥板 + 尾灯 + 后摇臂 ===== */
  B.arcBand(M, RW, .141, .1475, -1.62, .5, -.04, .04, body, 20);
  B.push().T(0, WR + .152 * Math.cos(-1.5), RZ + .152 * Math.sin(-1.5)).RX(-1.5 + PI / 2); B.box(GL, -.038, -.003, -.014, .038, .013, .014, GLOW_R); B.box(M, -.042, -.006, -.017, .042, -.003, .017, BLACK); B.pop();
  B.push().T(0, WR + .152 * Math.cos(-1.3), RZ + .152 * Math.sin(-1.3)).RX(-1.3 + PI / 2); B.box(M, -.02, .012, -.018, .02, .02, -.002, [1, .15, .15]); B.pop();   // 后反光片
  for (const s of [-1, 1]) { B.tube(M, [[s * .075, .12, -.27], [s * .068, .125, -.35], [s * .058, .13, RZ]], .0125, SILD, 8, true, 3); B.ellip(M, [s * .062, WR, RZ], [.012, .018, .018], SIL, 8); }

  cur = 'f';
  /* ===== 前叉 + 前挡泥板 + 减震弹簧 ===== */
  B.slab(M, rrect(.056, .05, .03, 5, 0, .385), .182, .232, body, .01);                       // 车头颈部
  B.box(M, -.058, .17, .345, .058, .182, .435, DARK);
  for (const s of [-1, 1]) {
    B.tube(M, [[s * .04, .182, .385], [s * .048, .15, .45], [s * .054, WR, FZ]], .0125, DARK, 8, true, 2);
    B.tube(M, [[s * .0415, .2, .392], [s * .0455, .165, .428]], .0185, SIL, 10, true);       // 减震筒
    B.ellip(M, [s * .062, WR, FZ], [.012, .02, .02], SIL, 8);
  }
  B.helix(M, [.042, .24, .39], [.05, .165, .455], .019, 5.5, .0035, [1, .66, .18]);          // 弹簧（右侧可见）
  B.helix(M, [-.042, .24, .39], [-.05, .165, .455], .019, 5.5, .0035, [1, .66, .18]);
  B.arcBand(M, FW, .141, .1475, -.5, 1.5, -.037, .037, body, 22);
  for (const s of [-1, 1]) B.tube(M, [[s * .05, .135 + .145 * Math.cos(-.2) - .01, FZ + .145 * Math.sin(-.2)], [s * .054, .15, FZ + .02]], .007, SILD, 6, true);   // 挡泥板支架

  /* ===== 立杆（带后倾）+ 折叠铰链 + 车标牌 ===== */
  const SA = [0, .14, .375], SB = [0, 1.0, .262];
  B.tube(M, [SA, SB], .0215, body, 18, true);
  const at = t => lerp3(SA, SB, t);
  for (const [t, h] of [[.12, .05], [.86, .035]]) { const p = at(t), q = at(t + h / .87); B.tube(M, [p, q], .0275, t < .5 ? SIL : DARK, 16, true); }   // 折叠铰链环 / 上卡环
  { const p = at(.125); B.tube(M, [[p[0] + .02, p[1] + .01, p[2] + .02], [p[0] + .06, p[1] - .01, p[2] + .06]], .0055, SIL, 8, true); B.ellip(M, [p[0] + .064, p[1] - .011, p[2] + .064], [.009, .009, .009], [.92, .25, .28], 8); }   // 折叠锁扣拉杆
  B.push().T(0, .46, .3535).RX(-.131);
  B.box(M, -.0225, -.05, -.012, .0225, .05, .0, body); B.box(M, -.0245, -.054, -.014, .0245, -.05, .002, bodyD); B.box(M, -.0245, .05, -.014, .0245, .054, .002, bodyD);   // 立杆正面牌
  B.quad(DC, [-.02, -.046, .0012], [.02, -.046, .0012], [.02, -.006, .0012], [-.02, -.006, .0012], [0, 0, 1], WHITE, UVQ(0, .25, .5, .75));   // 二维码牌
  B.quad(DC, [-.02, .006, .0012], [.02, .006, .0012], [.02, .046, .0012], [-.02, .046, .0012], [0, 0, 1], WHITE, UVQ(.5, .25, 1, .75));   // 字标牌
  B.pop();

  /* ===== 头灯 ===== */
  { const p = at(.8); B.ellip(M, [p[0], p[1], p[2] + .03], [.04, .03, .026], BLACK, 10); B.ellip(GL, [p[0], p[1], p[2] + .047], [.029, .021, .01], GLOW_W, 10);
    for (const s of [-1, 1]) B.ellip(M, [s * .044, p[1] - .004, p[2] + .028], [.006, .012, .01], [1, .62, .12], 6); }

  /* ===== 车把 / 握把 / 刹车 / 铃 / 油门 / 仪表 ===== */
  const hy = 1.0, hz = .262;
  B.box(M, -.034, hy - .018, hz - .028, .034, hy + .022, hz + .03, BLACK);                      // 把立夹块
  B.tube(M, [[-.275, hy + .004, hz - .022], [-.2, hy - .002, hz - .006], [0, hy - .004, hz], [.2, hy - .002, hz - .006], [.275, hy + .004, hz - .022]], .0115, DARK, 10, true, 4);
  for (const s of [-1, 1]) {
    B.tube(M, [[s * .185, hy - .001, hz - .007], [s * .27, hy + .004, hz - .022]], t => .0165 + .0013 * Math.sin(t * TAU * 9), RUB, 12, true);     // 橡胶握把（带纹）
    B.ellip(M, [s * .272, hy + .004, hz - .023], [.012, .017, .017], SIL, 8);
    B.box(M, s * .172, hy - .014, hz - .004, s * .19, hy + .006, hz + .02, BLACK);               // 刹车座
    B.tube(M, [[s * .176, hy - .012, hz + .012], [s * .182, hy - .018, hz + .062], [s * .19, hy - .04, hz + .11]], .0052, SIL, 8, true, 3);   // 刹车拉杆
  }
  B.ellip(M, [.115, hy + .018, hz + .012], [.032, .016, .032], SIL, 10); B.ellip(M, [.115, hy + .034, hz + .012], [.01, .006, .01], SILD, 6);   // 车铃（骑手左手边）
  B.push().T(-.135, hy + .012, hz - .004).RX(-.18); B.box(M, -.016, 0, -.016, .016, .011, .016, bodyL); B.box(M, -.015, .011, -.015, .015, .0135, .015, [.9, .91, .95]); B.pop();   // 拇指油门（骑手右手边）
  /* 仪表盒 + 屏幕 */
  B.push().T(0, hy + .02, hz - .004).RX(-.28);
  B.slab(M, rrect(.056, .034, .014, 5), -.006, .014, BLACK, .006);
  B.quad(DC, [.043, .0146, -.022], [-.043, .0146, -.022], [-.043, .0146, .022], [.043, .0146, .022], [0, 1, 0], WHITE, UVQ(0, .75, .5, 1));   // 骑手视角下文字正向
  B.ellip(GL, [.045, .012, .03], [.005, .002, .005], bodyL, 5); B.ellip(GL, [-.045, .012, .03], [.005, .002, .005], [.5, 1, .6], 5);
  B.pop();
  /* 线缆 */
  B.tube(M, [[.19, hy - .036, hz + .1], [.12, hy - .02, hz + .06], [.03, hy - .06, hz + .03], [.036, .7, .3], [.036, .45, .338], [.044, .22, .396], [.058, .17, .455], [.06, WR + .03, FZ - .01]], .0042, BLACK, 5, false, 3);
  B.tube(M, [[-.19, hy - .036, hz + .1], [-.12, hy - .02, hz + .06], [-.03, hy - .06, hz + .03], [-.034, .7, .3], [-.034, .45, .338], [-.042, .22, .396], [-.05, .16, .44]], .0042, BLACK, 5, false, 3);

  cur = 'r';
  /* ===== 脚撑 ===== */
  B.box(M, -.014, .068, -.15, .014, .094, -.1, SILD);
  if (opt.stand === false) B.tube(M, [[0, .08, -.125], [0, .083, -.24]], .008, SIL, 6, true); else { B.tube(M, [[0, .08, -.125], [0, .012, -.215]], .008, SIL, 6, true); B.ellip(M, [0, .008, -.218], [.022, .01, .024], RUB, 8); }
  return GR;
}

/* ---------------- 几何常量（未缩放，米）---------------- */
const GEOM = { WR: .13, FZ: .5, RZ: -.42, DECK_Y: .138, STEER_P: [0, .14, .375], STEER_D: norm([0, 1.0 - .14, .262 - .375]), BAR_Y: 1.0, BAR_Z: .262, GRIP_IN: .185, GRIP_OUT: .27, GRIP_R: .0165 };
function rotAbout(p, d, a) {
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c, x = d[0], y = d[1], z = d[2];
  const R = [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
  return { R, t: [p[0] - (R[0] * p[0] + R[1] * p[1] + R[2] * p[2]), p[1] - (R[3] * p[0] + R[4] * p[1] + R[5] * p[2]), p[2] - (R[6] * p[0] + R[7] * p[1] + R[8] * p[2])] };
}
/* 把局部网格变换后追加到 target：先依次做 pres（绕某根轴转：转向 / 车轮自转），再 roll(z) → pitch(x) → yaw(y) → 缩放 → 平移 */
function emit(target, src, x, y, z, yaw, scale, pitch, roll, pres) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0), cr = Math.cos(roll || 0), sr = Math.sin(roll || 0), s = scale || 1, base = target.n, V = src.v, np = pres ? pres.length : 0;
  const tr = (px, py, pz, out) => {
    let a = px * cr - py * sr, b = px * sr + py * cr, c = pz; const d = b * cp - c * sp, e = b * sp + c * cp; out[0] = a * cy + e * sy; out[1] = d; out[2] = -a * sy + e * cy;
  };
  const o = [0, 0, 0], on = [0, 0, 0];
  for (let k = 0; k < V.length; k += 11) {
    let px = V[k], py = V[k + 1], pz = V[k + 2], nx = V[k + 3], ny = V[k + 4], nz = V[k + 5];
    for (let q = 0; q < np; q++) { const m = pres[q], R = m.R, t = m.t; const X = R[0] * px + R[1] * py + R[2] * pz + t[0], Y = R[3] * px + R[4] * py + R[5] * pz + t[1], Z = R[6] * px + R[7] * py + R[8] * pz + t[2]; px = X; py = Y; pz = Z; const NX = R[0] * nx + R[1] * ny + R[2] * nz, NY = R[3] * nx + R[4] * ny + R[5] * nz, NZ = R[6] * nx + R[7] * ny + R[8] * nz; nx = NX; ny = NY; nz = NZ; }
    tr(px * s, py * s, pz * s, o); tr(nx, ny, nz, on);
    target.v.push(o[0] + x, o[1] + y, o[2] + z, on[0], on[1], on[2], V[k + 6], V[k + 7], V[k + 8], V[k + 9], V[k + 10]);
  }
  for (let k = 0; k < src.i.length; k++) target.i.push(src.i[k] + base); target.n += V.length / 11;
}
/* 整车：T = { main, glow, decal }（三个目标网格）；o = { pitch, roll, steer（转向弧度，正 = 向左）, spinF / spinR（前后轮自转弧度）} */
function emitModel(T, model, x, y, z, yaw, scale, o) {
  o = o || {}; const st = o.steer || 0, steerM = st ? rotAbout(GEOM.STEER_P, GEOM.STEER_D, st) : null;
  const spinF = o.spinF ? rotAbout([0, GEOM.WR, GEOM.FZ], [1, 0, 0], o.spinF) : null, spinR = o.spinR ? rotAbout([0, GEOM.WR, GEOM.RZ], [1, 0, 0], o.spinR) : null;
  const plan = [['r', null], ['rw', spinR ? [spinR] : null], ['f', steerM ? [steerM] : null], ['fw', (spinF || steerM) ? [spinF, steerM].filter(Boolean) : null]];
  for (const [g, pres] of plan) for (const k of ['main', 'glow', 'decal']) emit(T[k], model[g][k], x, y, z, yaw, scale, o.pitch, o.roll, pres);
}

/* ---------------- 贴花贴图（每种颜色一张）---------------- */
function atlas(R, colorHex) {
  return R.paint(512, 512, (g, w, h) => {
    const bg = colorHex || COLORS[0].hex; g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const lum = (() => { const c = hex(bg); return c[0] * .3 + c[1] * .59 + c[2] * .11; })(), fg = lum > .72 ? '#2b2d3a' : '#ffffff', FONT = '"Arial Black",Impact,"Helvetica Neue",sans-serif';
    const bolt = (cx, cy, k) => { g.beginPath(); g.moveTo(cx + 8 * k, cy - 24 * k); g.lineTo(cx - 14 * k, cy + 4 * k); g.lineTo(cx - 1 * k, cy + 4 * k); g.lineTo(cx - 9 * k, cy + 24 * k); g.lineTo(cx + 16 * k, cy - 6 * k); g.lineTo(cx + 2 * k, cy - 6 * k); g.closePath(); g.fill(); };
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
    /* (0,0)-(1,.25) 512x128：大字标（踏板前部）*/
    g.font = '900 italic 86px ' + FONT; g.fillText('STARGO', w * .58, 66); bolt(w * .16, 64, 2.1);
    /* (0,.25)-(.5,.75) 256x256：二维码牌 */
    g.fillStyle = '#fbfbfd'; g.fillRect(0, 128, 256, 256);
    const qx = 18, qy = 146, qs = 220, mod = 21, ms = qs / mod; let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    g.fillStyle = '#16171c'; for (let i = 0; i < mod; i++) for (let j = 0; j < mod; j++) { const fx = (i < 8 && j < 8) || (i >= mod - 8 && j < 8) || (i < 8 && j >= mod - 8); if (!fx && rnd() > .5) g.fillRect(qx + i * ms, qy + j * ms, ms + .6, ms + .6); }
    for (const [ox, oy] of [[0, 0], [mod - 7, 0], [0, mod - 7]]) { g.fillStyle = '#16171c'; g.fillRect(qx + ox * ms, qy + oy * ms, ms * 7, ms * 7); g.fillStyle = '#fbfbfd'; g.fillRect(qx + (ox + 1) * ms, qy + (oy + 1) * ms, ms * 5, ms * 5); g.fillStyle = '#16171c'; g.fillRect(qx + (ox + 2) * ms, qy + (oy + 2) * ms, ms * 3, ms * 3); }
    /* (.5,.25)-(1,.75) 256x256：立杆字标牌 */
    g.fillStyle = bg; g.fillRect(256, 128, 256, 256); g.fillStyle = fg; g.font = '900 italic 50px ' + FONT; g.fillText('STARGO', 384, 190); bolt(384, 262, 1.5);
    g.fillRect(300, 312, 168, 5); g.font = '800 22px sans-serif'; g.fillText('SCAN TO RIDE', 384, 346);
    /* (0,.75)-(.5,1) 256x128：仪表屏 */
    const gr = g.createLinearGradient(0, 384, 0, 512); gr.addColorStop(0, '#0e2a44'); gr.addColorStop(1, '#06121f'); g.fillStyle = gr; g.fillRect(0, 384, 256, 128);
    g.fillStyle = '#7ff0ff'; g.font = '800 70px "Courier New",monospace'; g.fillText('15', 84, 440); g.font = '700 20px sans-serif'; g.fillText('km/h', 200, 452);
    g.fillStyle = '#8dff9a'; g.fillRect(18, 488, 130, 9); g.fillStyle = '#2d4a3a'; g.fillRect(152, 488, 60, 9); g.fillStyle = '#ffd36a'; g.font = '700 16px sans-serif'; g.fillText('ECO', 224, 402);
    /* (.5,.75)-(1,.875) 256x64：侧标 */
    g.fillStyle = bg; g.fillRect(256, 384, 256, 64); g.fillStyle = fg; g.font = '900 italic 38px ' + FONT; g.fillText('STARGO', 392, 417); bolt(292, 416, .75);
  }, { mip: true });
}

/* 停车位：把一批停放的踏板合并成静态批次（每种颜色一张贴花图）。list = [{x,y,z,yaw,hex}]，返回 batches 数组 */
function parked(R, list, scale) {
  const sc = scale || 1.5, by = {}, out = [], MM = new MB(), GG = new MB();
  list.forEach(it => { const k = it.hex || COLORS[0].hex; (by[k] = by[k] || []).push(it); });
  Object.keys(by).forEach(k => {
    const m = build(k), DD = new MB();
    by[k].forEach(it => emitModel({ main: MM, glow: GG, decal: DD }, m, it.x, it.y || 0, it.z, it.yaw || 0, sc));
    const at = atlas(R, k); out.push(R.batch(DD, { tex: at, em: at, emDay: .1, emNight: .22 }));
  });
  out.push(R.batch(MM, { tex: R.white })); out.push(R.batch(GG, { tex: R.white, em: R.white, emDay: .9, emNight: 1.6 }));
  return out;
}

G.Scooter = { Build, rotAbout, COLORS, GEOM, build, emit, emitModel, atlas, parked, hex };
})(window);
