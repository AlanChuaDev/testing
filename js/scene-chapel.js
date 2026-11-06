/* scene-chapel.js — 星光教堂 · 婚礼庄园: 外景花园(makeChapel) + 教堂大殿(makeChapelIn) + 宴会厅(makeChapelHall)
   依赖 scene-common.js (Scenes.C.kit). 外景是传送列表里的"一张地图", 大殿与宴会厅是从外景进出的建筑(像 KTV / 试衣间).
   婚礼玩法: 誓词 / 戒指 / 亲吻 / 花球 / 切蛋糕 / 香槟塔 / 烟花 / 放飞白鸽 / 敲钟 ... 均由各场景的 S.onUse 处理. */
(function (G) {
'use strict';
const { MB } = G.World, C = G.Scenes.C, TAU = Math.PI * 2, { rnd, rbox } = C, PI = Math.PI;
const fr = (v) => v - Math.floor(v);
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/* =============================== 程序化贴图 =============================== */
function tex(R) {
  const X = {}, P = (w, h, fn, o) => R.paint(w, h, fn, o), dual = (w, h, fn, o) => ({ tex: P(w, h, (g) => fn(g, false), o), em: P(w, h, (g) => fn(g, true), o) });
  X.stone = P(256, 256, (g) => { const r = rnd(3); g.fillStyle = '#e9e0cf'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const ox = (y % 2) * 32, v = 10 * (r() - .5); g.fillStyle = `rgb(${233 + v},${224 + v},${206 + v})`; g.fillRect(x * 64 + ox + 1.5, y * 32 + 1.5, 61, 29); }
    g.strokeStyle = 'rgba(120,100,70,.28)'; g.lineWidth = 2; for (let y = 0; y <= 8; y++) { g.beginPath(); g.moveTo(0, y * 32); g.lineTo(256, y * 32); g.stroke(); }
    for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(90,75,50,.12)'; g.fillRect(r() * 256, r() * 256, 2 + r() * 3, 1 + r() * 2); } });
  X.slate = P(256, 256, (g) => { const r = rnd(5); g.fillStyle = '#56627c'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 9; x++) { const ox = (y % 2) * 14, v = 16 * (r() - .5); g.fillStyle = `rgb(${88 + v},${102 + v},${134 + v})`; g.beginPath(); g.moveTo(x * 28 + ox, y * 16); g.lineTo(x * 28 + ox + 26, y * 16); g.lineTo(x * 28 + ox + 26, y * 16 + 11); g.lineTo(x * 28 + ox + 13, y * 16 + 16); g.lineTo(x * 28 + ox, y * 16 + 11); g.closePath(); g.fill(); } });
  X.marble = P(512, 512, (g) => { const r = rnd(8); g.fillStyle = '#f3ecdf'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 8 * (r() - .5); g.fillStyle = (x + y) % 2 ? `rgb(${246 + v},${240 + v},${228 + v})` : `rgb(${236 + v},${228 + v},${212 + v})`; g.fillRect(x * 128, y * 128, 128, 128); }
    g.strokeStyle = 'rgba(190,165,110,.55)'; g.lineWidth = 3; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, k * 128); g.lineTo(512, k * 128); g.stroke(); }
    g.strokeStyle = 'rgba(150,140,130,.18)'; g.lineWidth = 1.5; for (let i = 0; i < 40; i++) { g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - .4) * 60; y += (r() - .5) * 40; g.lineTo(x, y); } g.stroke(); } });
  X.paving = P(256, 256, (g) => { const r = rnd(9); g.fillStyle = '#b9ab94'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 14 * (r() - .5); g.fillStyle = `rgb(${232 + v},${222 + v},${203 + v})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } });
  X.grass = P(128, 128, (g) => { const r = rnd(4); g.fillStyle = '#5aa857'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 300; i++) { g.fillStyle = r() < .5 ? 'rgba(34,120,50,.32)' : 'rgba(170,225,120,.3)'; g.fillRect(r() * 128, r() * 128, 2, 3); } for (let i = 0; i < 9; i++) { g.fillStyle = '#fff6f0'; g.beginPath(); g.arc(r() * 128, r() * 128, 1.6, 0, TAU); g.fill(); } });
  X.carpet = P(128, 512, (g) => { g.fillStyle = '#9d1830'; g.fillRect(0, 0, 128, 512); g.fillStyle = '#c99a3c'; g.fillRect(4, 0, 5, 512); g.fillRect(119, 0, 5, 512); g.fillRect(14, 0, 2, 512); g.fillRect(112, 0, 2, 512);
    for (let y = 0; y < 512; y += 64) { g.fillStyle = '#c99a3c'; g.beginPath(); g.moveTo(64, y + 14); g.lineTo(80, y + 32); g.lineTo(64, y + 50); g.lineTo(48, y + 32); g.closePath(); g.fill(); g.fillStyle = '#7a0f22'; g.beginPath(); g.arc(64, y + 32, 6, 0, TAU); g.fill(); } });
  X.petals = P(128, 256, (g) => { const r = rnd(21); g.fillStyle = '#fbf1ee'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#e8c7c0'; g.fillRect(0, 0, 6, 256); g.fillRect(122, 0, 6, 256);
    for (let i = 0; i < 90; i++) { const x = 10 + r() * 108, y = r() * 256; g.fillStyle = r() < .6 ? 'rgba(236,120,150,.75)' : r() < .5 ? 'rgba(255,200,215,.85)' : 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(x, y, 3 + r() * 3, 2 + r() * 2, r() * 3, 0, TAU); g.fill(); } });
  X.wood = P(128, 128, (g) => { const r = rnd(12); g.fillStyle = '#6b4226'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 26; i++) { g.strokeStyle = r() < .5 ? 'rgba(40,22,10,.35)' : 'rgba(150,100,60,.3)'; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(0, r() * 128); g.lineTo(128, r() * 128 + (r() - .5) * 8); g.stroke(); } });
  X.parquet = P(256, 256, (g) => { const r = rnd(13); g.fillStyle = '#9a6a38'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 22 * (r() - .5); g.fillStyle = `rgb(${186 + v},${134 + v},${78 + v})`; if ((x + y) % 2) g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); else { for (let k = 0; k < 4; k++) g.fillRect(x * 32 + 1, y * 32 + 1 + k * 8, 30, 7); } } });
  X.cloth = P(128, 128, (g) => { g.fillStyle = '#fbf7f0'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(200,180,140,.35)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(64, 64, 14 + i * 14, 0, TAU); g.stroke(); } });
  X.water = dual(256, 256, (g, em) => { const r = rnd(14); g.fillStyle = em ? '#000' : '#2c7a98'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 90; i++) { g.strokeStyle = em ? `rgba(170,220,255,${.2 + r() * .35})` : 'rgba(190,235,250,.35)'; g.lineWidth = 1 + r() * 1.5; const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14 + r() * 22, y + (r() - .5) * 3); g.stroke(); } });
  X.bed = P(128, 128, (g) => { const r = rnd(15); g.fillStyle = '#3c8c4a'; g.fillRect(0, 0, 128, 128); const cols = ['#ff7fa8', '#ffd3df', '#ffffff', '#ff4f7e', '#ffb6c9', '#fff0b0']; for (let i = 0; i < 70; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); g.arc(r() * 128, r() * 128, 3 + r() * 3.5, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(r() * 128, r() * 128, 1.5, 0, TAU); g.fill(); } });
  X.blossom = P(128, 128, (g) => { const r = rnd(16); g.fillStyle = '#f7b8cc'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 120; i++) { g.fillStyle = r() < .5 ? 'rgba(255,225,235,.8)' : r() < .5 ? 'rgba(233,120,160,.6)' : 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(r() * 128, r() * 128, 2 + r() * 4, 0, TAU); g.fill(); } });
  X.door = P(256, 384, (g) => { g.fillStyle = '#5a3820'; g.fillRect(0, 0, 256, 384); g.fillStyle = '#6e4628'; g.fillRect(8, 8, 116, 368); g.fillRect(132, 8, 116, 368); g.strokeStyle = '#c99a3c'; g.lineWidth = 4;
    for (let k = 0; k < 2; k++) { const ox = 8 + k * 124; g.strokeRect(ox + 12, 24, 92, 150); g.strokeRect(ox + 12, 190, 92, 170); g.beginPath(); g.arc(ox + 58, 99, 26, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(ox + 58, 180); g.lineTo(ox + 58, 340); g.stroke(); }
    g.fillStyle = '#e8c15a'; g.beginPath(); g.arc(110, 200, 7, 0, TAU); g.fill(); g.beginPath(); g.arc(146, 200, 7, 0, TAU); g.fill(); });
  /* 彩绘玻璃: 尖拱窗 (两个圆弧的交集), 菱形铅条格 + 中央纹样 */
  const inArch = (x, y, W, H, m, y0) => { const w = W - 2 * m; if (y >= y0) { return Math.hypot(x - m, y - y0) <= w && Math.hypot(x - (W - m), y - y0) <= w && x >= m && x <= W - m; } return x >= m && x <= W - m && y <= H - m; };
  const PALS = [['#1c3f94', '#2d6fd0', '#e9c24a', '#c42a3a', '#f4efe0'], ['#a3162b', '#e24a4a', '#f0c04a', '#2858a8', '#f6efe2'], ['#176b4a', '#2fa36e', '#e8c04a', '#7a3aa8', '#f4efe0'], ['#f0e6cf', '#e8c15a', '#c9d8f0', '#f2b6c8', '#fff8e8']];
  X.glass = (v, seed) => dual(256, 512, (g, em) => { const W = 256, H = 512, m = 14, y0 = 300, r = rnd(seed), pal = PALS[v % PALS.length];
    g.fillStyle = em ? '#000' : '#d9d0bf'; g.fillRect(0, 0, W, H); const step = 28;
    for (let j = -2; j < H / step + 2; j++) for (let i = -1; i < W / step + 2; i++) { const cx = i * step + (j % 2 ? step / 2 : 0), cy = j * step * .8 + 6; if (!inArch(cx, cy, W, H, m, y0)) continue;
      const c = pal[(r() * pal.length) | 0]; g.fillStyle = c; g.beginPath(); g.moveTo(cx, cy - step * .45); g.lineTo(cx + step * .5, cy); g.lineTo(cx, cy + step * .45); g.lineTo(cx - step * .5, cy); g.closePath(); g.fill(); }
    // central motif (rose / cross)
    const mc = pal[3]; g.fillStyle = em ? '#fff3c0' : '#f6e7ae'; g.beginPath(); g.arc(W / 2, 250, 54, 0, TAU); g.fill(); g.fillStyle = mc; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.ellipse(W / 2 + Math.cos(a) * 28, 250 + Math.sin(a) * 28, 17, 9, a, 0, TAU); g.fill(); } g.fillStyle = pal[2]; g.beginPath(); g.arc(W / 2, 250, 13, 0, TAU); g.fill();
    g.strokeStyle = em ? '#050505' : '#2b2420'; g.lineWidth = 3.5; for (let j = -2; j < H / step + 2; j++) for (let i = -1; i < W / step + 2; i++) { const cx = i * step + (j % 2 ? step / 2 : 0), cy = j * step * .8 + 6; if (!inArch(cx, cy, W, H, m, y0)) continue; g.beginPath(); g.moveTo(cx, cy - step * .45); g.lineTo(cx + step * .5, cy); g.lineTo(cx, cy + step * .45); g.lineTo(cx - step * .5, cy); g.closePath(); g.stroke(); }
    g.strokeStyle = em ? '#000' : '#6c5f4d'; g.lineWidth = 9; g.beginPath(); g.moveTo(m, H - m); g.lineTo(m, y0); for (let k = 0; k <= 30; k++) { const a = PI - k / 30 * (PI / 3); g.lineTo(W - m + Math.cos(a) * (W - 2 * m), y0 - Math.sin(a) * (W - 2 * m)); } for (let k = 30; k >= 0; k--) { const a = k / 30 * (PI / 3); g.lineTo(m + Math.cos(a) * (W - 2 * m), y0 - Math.sin(a) * (W - 2 * m)); } g.lineTo(W - m, H - m); g.closePath(); g.stroke(); }, { clamp: true });
  X.glassN = [0, 1, 2, 3].map((v) => X.glass(v, 40 + v * 7));
  X.rosewin = dual(512, 512, (g, em) => { const c = 256, r = rnd(44); g.fillStyle = em ? '#000' : '#d9d0bf'; g.fillRect(0, 0, 512, 512); const cols = ['#1c3f94', '#c42a3a', '#e9c24a', '#2d6fd0', '#7a3aa8', '#f4efe0'];
    const ring = (R0, R1, n, off) => { for (let k = 0; k < n; k++) { const a0 = off + k / n * TAU, a1 = off + (k + 1) / n * TAU; g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); g.moveTo(c + Math.cos(a0) * R0, c + Math.sin(a0) * R0); g.lineTo(c + Math.cos(a0) * R1, c + Math.sin(a0) * R1); g.lineTo(c + Math.cos(a1) * R1, c + Math.sin(a1) * R1); g.lineTo(c + Math.cos(a1) * R0, c + Math.sin(a1) * R0); g.closePath(); g.fill(); g.strokeStyle = em ? '#050505' : '#2b2420'; g.lineWidth = 4; g.stroke(); } };
    ring(170, 244, 24, 0); ring(100, 170, 12, .1); ring(46, 100, 12, .2); g.fillStyle = em ? '#fff3c0' : '#f6e7ae'; g.beginPath(); g.arc(c, c, 46, 0, TAU); g.fill(); g.fillStyle = '#c42a3a'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.ellipse(c + Math.cos(a) * 24, c + Math.sin(a) * 24, 14, 7, a, 0, TAU); g.fill(); }
    g.strokeStyle = em ? '#000' : '#6c5f4d'; g.lineWidth = 9; g.beginPath(); g.arc(c, c, 246, 0, TAU); g.stroke(); }, { clamp: true });
  X.shaft = P(64, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0.05)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(.3, 'rgba(0,0,0,0)'); gx.addColorStop(.7, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gx; g.fillRect(0, 0, 64, 256); }, { clamp: true });
  X.heart = dual(256, 256, (g, em) => { g.fillStyle = em ? '#000' : '#fff4f4'; g.fillRect(0, 0, 256, 256); g.fillStyle = em ? '#ff5b8f' : '#e8527e'; g.beginPath(); g.moveTo(128, 214); g.bezierCurveTo(10, 130, 40, 30, 128, 86); g.bezierCurveTo(216, 30, 246, 130, 128, 214); g.closePath(); g.fill(); g.fillStyle = em ? '#ffd2e0' : '#ff9fbd'; g.beginPath(); g.arc(94, 88, 14, 0, TAU); g.fill(); }, { clamp: true });
  X.dome = dual(256, 256, (g, em) => { const r = rnd(61), gr = g.createRadialGradient(128, 128, 4, 128, 128, 128); gr.addColorStop(0, em ? '#3a2f78' : '#4a3d8e'); gr.addColorStop(.6, em ? '#1b1550' : '#241c5e'); gr.addColorStop(1, em ? '#0a0830' : '#120f3a'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) { g.fillStyle = em ? 'rgba(255,230,160,.95)' : 'rgba(255,240,200,.8)'; g.beginPath(); g.arc(r() * 256, r() * 256, .8 + r() * 1.6, 0, TAU); g.fill(); }
    g.strokeStyle = em ? '#e8c15a' : '#c99a3c'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 118, 0, TAU); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(128, 128, 96, 0, TAU); g.stroke(); }, { clamp: true });
  X.lace = P(128, 128, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); });
  return X;
}

/* =============================== 通用建模小工具 =============================== */
const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
function ptArch(w, y0, seg) {                       // 尖拱剖面 (正三角拱: 拱顶 = 起拱线 + 0.866 w)
  const p = [[-w / 2, 0], [-w / 2, y0]];
  for (let k = 1; k <= seg; k++) { const a = PI - k / seg * (PI / 3); p.push([w / 2 + Math.cos(a) * w, y0 + Math.sin(a) * w]); }
  for (let k = 1; k <= seg; k++) { const a = PI / 3 - k / seg * (PI / 3); p.push([-w / 2 + Math.cos(a) * w, y0 + Math.sin(a) * w]); }
  p.push([w / 2, 0]); return p;
}
function barrel(mb, pts, z0, z1, col, tile) {       // 沿 z 拉伸的拱顶内壳 (法线朝内)
  const top = Math.max(...pts.map(p => p[1])), cy = top * .55; let u = 0;
  for (let i = 0; i + 1 < pts.length; i++) { const A = pts[i], B = pts[i + 1], dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy); if (l < 1e-6) continue; let n = [-dy / l, dx / l, 0]; if (n[0] * (0 - A[0]) + n[1] * (cy - A[1]) < 0) n = [-n[0], -n[1], 0];
    mb.quad([A[0], A[1], z0], [B[0], B[1], z0], [B[0], B[1], z1], [A[0], A[1], z1], n, [u / tile[0], 0, (u + l) / tile[0], (z1 - z0) / tile[1]], col); u += l; }
}
function ptRing(mb, cx, y0, z0, z1, w, th, col) {   // 尖拱形的石框 (两段圆弧环)
  mb.arch(cx + w / 2, y0, z0, z1, w + th, w, 2 * PI / 3, PI, 10, col); mb.arch(cx - w / 2, y0, z0, z1, w + th, w, 0, PI / 3, 10, col);
  mb.box(cx - w / 2 - th, 0, z0, cx - w / 2, y0, z1, col); mb.box(cx + w / 2, 0, z0, cx + w / 2 + th, y0, z1, col);
}
function gableZ(mb, x0, x1, z0, z1, yE, yR, col, tile, endCol) {   // 屋脊沿 z
  const xm = (x0 + x1) / 2, nl = nrm([-(yR - yE), xm - x0, 0]), nr = nrm([(yR - yE), xm - x0, 0]), L = Math.hypot(xm - x0, yR - yE);
  mb.quad([x0, yE, z1], [xm, yR, z1], [xm, yR, z0], [x0, yE, z0], nl, [0, 0, (z1 - z0) / tile[0], L / tile[1]], col); mb.quad([x1, yE, z0], [xm, yR, z0], [xm, yR, z1], [x1, yE, z1], nr, [0, 0, (z1 - z0) / tile[0], L / tile[1]], col);
  if (endCol) { mb.tri([x0, yE, z1], [x1, yE, z1], [xm, yR, z1], [0, 0, 1], endCol); mb.tri([x1, yE, z0], [x0, yE, z0], [xm, yR, z0], [0, 0, -1], endCol); }
}
function gableX(mb, x0, x1, z0, z1, yE, yR, col, tile, endCol) {   // 屋脊沿 x
  const zm = (z0 + z1) / 2, nf = nrm([0, zm - z0, (yR - yE)]), nb = nrm([0, zm - z0, -(yR - yE)]), L = Math.hypot(zm - z0, yR - yE);
  mb.quad([x0, yE, z1], [x1, yE, z1], [x1, yR, zm], [x0, yR, zm], nf, [0, 0, (x1 - x0) / tile[0], L / tile[1]], col); mb.quad([x1, yE, z0], [x0, yE, z0], [x0, yR, zm], [x1, yR, zm], nb, [0, 0, (x1 - x0) / tile[0], L / tile[1]], col);
  if (endCol) { mb.tri([x1, yE, z1], [x1, yE, z0], [x1, yR, zm], [1, 0, 0], endCol); mb.tri([x0, yE, z0], [x0, yE, z1], [x0, yR, zm], [-1, 0, 0], endCol); }
}
function spire(mb, cx, cz, half, y0, y1, col, tile) {                // 四棱锥尖顶
  const c = [[cx - half, cz - half], [cx + half, cz - half], [cx + half, cz + half], [cx - half, cz + half]], ap = [cx, y1, cz];
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4], A = [a[0], y0, a[1]], B = [b[0], y0, b[1]], n = nrm(cross(sub3(B, A), sub3(ap, A))), m = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz]; const s = n[0] * m[0] + n[2] * m[2] < 0 ? -1 : 1; mb.tri(A, B, ap, [n[0] * s, n[1] * s, n[2] * s], col); }
}
function cross3d(mb, x, y, z, s, col) { mb.box(x - .12 * s, y, z - .12 * s, x + .12 * s, y + 2.2 * s, z + .12 * s, col); mb.box(x - .7 * s, y + 1.35 * s, z - .1 * s, x + .7 * s, y + 1.6 * s, z + .1 * s, col); }
function sakura(mb, x, z, s, seed) {                                  // 樱花树: 弯曲树干 + 粉色花冠
  const r = rnd(seed | 0); mb.cyl(x, z, 0, 3.6 * s, .34 * s, .2 * s, 7, [.36, .24, .2]);
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + r(), ex = x + Math.cos(a) * 1.6 * s, ez = z + Math.sin(a) * 1.6 * s; C.tcyl(mb, [x, 3 * s, z], [ex, 4.6 * s, ez], .16 * s, .08 * s, 5, [.36, .24, .2]); }
  for (let k = 0; k < 6; k++) { const a = r() * TAU, d = r() * 2.1 * s, cy = (4.3 + r() * 1.6) * s, rad = (1.3 + r() * 1.0) * s, t = r(); mb.sphere(x + Math.cos(a) * d, cy, z + Math.sin(a) * d, rad, rad * .75, rad, mixc([1, .72, .82], [1, .88, .92], t), 5); }
}
function chairMB(mb, x, z, yaw, col, sash) {                          // 白色婚礼椅 (靠背朝后)
  const c = Math.cos(yaw), s = Math.sin(yaw), L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  let p = L(0, 0); rbox(mb, p[0], p[1], .5, .5, .44, .5, yaw, col); p = L(0, -.22); rbox(mb, p[0], p[1], .5, .06, .5, 1.0, yaw, col);
  [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].forEach(([lx, lz]) => { const q = L(lx, lz); mb.box(q[0] - .025, 0, q[1] - .025, q[0] + .025, .44, q[1] + .025, [.9, .88, .84]); });
  if (sash) { p = L(0, -.2); rbox(mb, p[0], p[1], .46, .08, .52, .8, yaw, sash); }
}
function lampPost(mb, gl, x, z, h, col) {                             // 复古路灯: 铁柱 + 灯笼
  mb.cyl(x, z, 0, .4, .3, .22, 8, col); mb.cyl(x, z, .4, h, .09, .07, 8, col); mb.box(x - .22, h, z - .22, x + .22, h + .5, z + .22, [1, .9, .6]); mb.cyl(x, z, h + .5, h + .8, .3, .05, 8, col);
  if (gl) C.halo(gl, x, h + .25, z, 1.6, [1, .8, .45], .5);
}
function roseArch(mb, x, z, w, h, col, rose) {                       // 玫瑰花拱门 (拱框 + 花球)
  const r = w / 2, y0 = h - r; mb.box(x - r - .09, 0, z - .1, x - r + .09, y0, z + .1, col); mb.box(x + r - .09, 0, z - .1, x + r + .09, y0, z + .1, col); mb.arch(x, y0, z - .1, z + .1, r + .09, r - .09, 0, PI, 14, col);
  for (let k = 0; k <= 14; k++) { const a = k / 14 * PI; mb.sphere(x + Math.cos(a) * r, y0 + Math.sin(a) * r, z, .3, .26, .26, k % 3 === 0 ? [1, .95, .95] : rose, 5); }
  for (let k = 0; k < 4; k++) { mb.sphere(x - r, .5 + k * .6, z, .26, .24, .26, rose, 5); mb.sphere(x + r, .5 + k * .6, z, .26, .24, .26, k % 2 ? [1, .95, .95] : rose, 5); }
}
function chandelier(mb, gl, x, y, z, s, col) {                       // 水晶吊灯: 金环 + 垂挂水晶 + 光晕
  mb.cyl(x, z, y, y + 1.2 * s, .06, .06, 6, [.85, .7, .35]);
  [[1.5 * s, 0], [1.0 * s, -.6 * s], [.55 * s, -1.1 * s]].forEach(([rr, dy], i) => { for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; mb.box(px - .06, y + dy - .5 * s, pz - .06, px + .06, y + dy, pz + .06, [.95, .98, 1]); mb.sphere(px, y + dy + .08, pz, .08 * s, .14 * s, .08 * s, [1, .9, .6], 4); } mb.cyl(x, z, y + dy - .05, y + dy + .02, rr, rr, 14, [.85, .7, .35]); });
  mb.cyl(x, z, y - 1.4 * s, y, .05, .05, 5, [.95, .98, 1]); mb.sphere(x, y - 1.5 * s, z, .16 * s, .3 * s, .16 * s, [.95, .98, 1], 6);
  if (gl) { C.halo(gl, x, y - .2 * s, z, 3.6 * s, [1, .84, .55], .5); C.halo(gl, x, y - .2 * s, z, 1.8 * s, [1, .95, .8], .5); }
}

/* =====================================================================
   外景: 星光教堂 · 婚礼庄园
   北(-z)是大教堂, 门朝南(+z, 面向镜头). 中轴: 教堂台阶 → 室外仪式草坪(白椅+花拱) → 爱之喷泉 → 玫瑰拱门长廊 → 铁艺大门.
   西侧: 盛宴露台 (圆桌 / 新人桌 / 舞池 / 乐队 / 蛋糕 / 香槟塔). 东侧: 倒影湖 + 石桥 + 宴会厅.
   ===================================================================== */
function makeChapel(R, T) {
  const S = {}, K = C.kit(R, T, S), X = tex(R), { add, occ, occ0, occ1, obs, obsRot, emS, solid, signAt, addTw, seat } = K;
  const IVORY = [.97, .94, .88], GOLD = [.86, .68, .3], WHITE = [1, 1, 1], ROSE = [1, .56, .68], gl = new MB();
  const fl = (mb, x0, z0, x1, z1, y, col, tile) => mb.floor(x0, z0, x1, z1, y, col, [0, 0, (x1 - x0) / tile, (z1 - z0) / tile]);
  const hl = (x, y, z, s, col, p) => C.halo(gl, x, y, z, s, col, p == null ? .5 : p);
  const winEm = (g, a, b) => ({ tex: g.tex, em: g.em, emDay: a == null ? .1 : a, emNight: b == null ? 1.5 : b });
  const dun = (mb, x0, y0, z0, x1, y1, z1, col, tile) => mb.box(x0, y0, z0, x1, y1, z1, col, tile);

  /* ---------- 地面 ---------- */
  { const g = new MB(); fl(g, -180, -150, 180, 160, 0, [.95, 1, .95], 5); add(g, { tex: X.grass });
    const p = new MB(); fl(p, -48, -22, 48, 11, .02, WHITE, 8); fl(p, -8, 32, 8, 80, .02, WHITE, 8); add(p, { tex: X.paving });
    const m = new MB(); fl(m, -3.2, -16, 3.2, 80, .04, WHITE, 8); add(m, { tex: X.petals });                 // 中轴: 粉白花瓣红毯
    const t = new MB(); fl(t, -78, -8, -24, 62, .02, WHITE, 8); add(t, { tex: X.parquet });                  // 西侧盛宴露台 (木地板)
    const sw = new MB(); fl(sw, -17, 11, 17, 33, .015, [.93, 1, .93], 6); add(sw, { tex: X.grass }); }        // 仪式草坪

  /* ---------- 大教堂 ---------- */
  { const st = new MB(), rf = new MB(), tw = new MB(), tr = new MB(), gd = new MB(), bf = new MB(), wd = new MB();
    // 中殿 + 侧廊 + 耳堂 + 后殿
    st.box(-14, 0, -62, 14, 22, -20, IVORY, [6, 6]); st.box(-25, 0, -60, -14, 13, -20, IVORY, [6, 6]); st.box(14, 0, -60, 25, 13, -20, IVORY, [6, 6]); st.box(-31, 0, -47, 31, 20, -33, IVORY, [6, 6]);
    st.cyl(0, -62, 0, 21, 11, 11, 6, IVORY); rf.cyl(0, -62, 21, 33, 12, .3, 6, [1, 1, 1]);
    gableZ(rf, -15.2, 15.2, -64, -19, 22, 35, [1, 1, 1], [8, 8], null); gableZ(st, -14, 14, -20.5, -19.5, 22, 35, IVORY, [6, 6], IVORY);
    gableX(rf, -32.5, 32.5, -48, -32, 20, 30, [1, 1, 1], [8, 8], null); gableX(st, -31, -30, -47, -33, 20, 30, IVORY, [6, 6], IVORY); gableX(st, 30, 31, -47, -33, 20, 30, IVORY, [6, 6], IVORY);
    [[-1, -26], [1, 26]].forEach(([sg, x]) => { rf.quad([sg * 14, 17, -60], [sg * 14, 17, -19.5], [sg * 25.6, 13.4, -19.5], [sg * 25.6, 13.4, -60], nrm([sg * -3.6, 11.6, 0]), [0, 0, 5, 3], [1, 1, 1]); });
    // 双钟塔 (向前突出) + 尖顶 + 小塔
    [[-18.5, -1], [18.5, 1]].forEach(([cx, sg]) => { tw.box(cx - 6, 0, -28, cx + 6, 44, -16, IVORY, [6, 6]); tw.box(cx - 6.4, 13.4, -28.4, cx + 6.4, 14.2, -15.6, [.9, .84, .7]); tw.box(cx - 6.4, 27.4, -28.4, cx + 6.4, 28.2, -15.6, [.9, .84, .7]); tw.box(cx - 6.6, 43.6, -28.6, cx + 6.6, 45, -15.4, [.9, .84, .7]);
      spire(rf, cx, -22, 6.4, 45, 66, [1, 1, 1], [8, 8]); [[-5.2, -26.4], [5.2, -26.4], [-5.2, -17.6], [5.2, -17.6]].forEach(([dx, z]) => { tw.box(cx + dx - .8, 45, z - .8, cx + dx + .8, 49, z + .8, IVORY); spire(rf, cx + dx, z, .95, 49, 54, [1, 1, 1], [4, 4]); });
      cross3d(gd, cx, 66, -22, 1.6, GOLD);
      [[-4, 1], [-1.4, 1], [1.4, 1], [4, 1]].forEach(([dx]) => { tw.box(cx + dx - .8, 34, -16.1, cx + dx + .8, 41.5, -15.95, [.16, .15, .2]); });   // 钟楼拱口
      gd.sphere(cx, 38, -22, .5, .6, .5, GOLD, 6); });
    // 大门: 层层尖拱 + 木门 + 台阶
    [[4, 1.6, IVORY], [5.6, .8, GOLD], [6.4, 1.6, IVORY], [8, .8, GOLD], [8.8, 1.6, IVORY]].forEach(([w, th, c], i) => ptRing(st, 0, 8.5 - i * .2, -20.0 - .3 - i * .22, -19.2, w, th, c));
    const dm = new MB(); dm.quad([-3.2, 0, -19.6], [3.2, 0, -19.6], [3.2, 9.4, -19.6], [-3.2, 9.4, -19.6], [0, 0, 1], [0, 0, 1, 1], WHITE); add(dm, { tex: X.door });
    for (let k = 0; k < 5; k++) st.box(-9 - k * .3, 0, -19.7 + k * 1.1, 9 + k * .3, .26 * (5 - k), -18.6 + k * 1.1 + (k === 4 ? 0 : 0), [.96, .92, .86], [3, 3]);
    // 玫瑰窗 + 立面彩窗
    const rw = new MB(); rw.quad([-5.2, 15.2, -19.9], [5.2, 15.2, -19.9], [5.2, 25.6, -19.9], [-5.2, 25.6, -19.9], [0, 0, 1], [0, 1, 1, 0], WHITE); add(rw, winEm(X.rosewin, .12, 1.6));
    [[-9.8, 0], [9.8, 1], [-18.5, 2], [18.5, 3]].forEach(([x, v]) => { const g = X.glassN[v], m = new MB(); const w = (Math.abs(x) > 12 ? 3.2 : 2.6), yb = Math.abs(x) > 12 ? 17 : 6, hh = Math.abs(x) > 12 ? 9.6 : 10; rbox(m, x, -15.9 + (Math.abs(x) > 12 ? 0 : -4), w, .2, yb, yb + hh, 0, WHITE, [w, hh]); add(m, winEm(g, .12, 1.5)); });
    // 飞扶壁 + 扶壁 + 小尖塔
    for (let z = -56; z <= -24; z += 8) [-1, 1].forEach(sg => { bf.box(sg * 25.4 - .6, 0, z - .7, sg * 25.4 + .6, 15, z + .7, IVORY); spire(rf, sg * 25.4, z, .8, 15, 19, [1, 1, 1], [4, 4]); C.beam(bf, sg * 25.3, 14.2, sg * 14.5, 20.4, z, .5, IVORY); });
    // 立面两侧圣像壁龛 + 天使像
    [[-11.2], [11.2]].forEach(([x]) => { wd.box(x - 1.1, 3.2, -19.8, x + 1.1, 4.1, -19.2, IVORY); wd.cyl(x, -19.4, 4.1, 6.3, .36, .24, 8, [1, .98, .95]); wd.sphere(x, 6.8, -19.4, .26, .3, .26, [1, .98, .95], 6); wd.quad([x - 1.5, 6.2, -19.1], [x - .15, 5.2, -19.1], [x - .15, 6.6, -19.1], [x - 1.4, 7.1, -19.1], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); wd.quad([x + 1.5, 6.2, -19.1], [x + .15, 5.2, -19.1], [x + .15, 6.6, -19.1], [x + 1.4, 7.1, -19.1], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); });
    add(st, { tex: X.stone }); add(wd, { tex: X.stone }); add(tw, { tex: X.stone }); add(bf, { tex: X.stone }); add(rf, { tex: X.slate }); add(gd, emS('#e0a83a', .35, 1.2));
    obs(-31, -74, 31, -19.2); }
  // 夜晚泛光 (教堂本体)
  [[-18.5, 12], [18.5, 12], [-18.5, 30], [18.5, 30], [0, 8], [0, 22], [-9, 4], [9, 4], [-28, 6], [28, 6]].forEach(([x, y]) => hl(x, y, -15, 7, [1, .82, .5], .4));
  for (let x = -26; x <= 26; x += 4.4) hl(x, 1.5, -18.6, 2.8, [1, .8, .5], .3);
  /* ---------- 前广场: 爱之喷泉 + 路灯 + 花坛 + 雕像 ---------- */
  { const f = new MB(), w = new MB(), t = new MB();
    f.cyl(0, 40, 0, .9, 6.2, 6, 28, [.96, .93, .88]); f.cyl(0, 40, .9, 1.0, 5.6, 5.6, 28, [.5, .8, .9]); f.cyl(0, 40, 1.0, 2.6, 1.0, .8, 12, IVORY); f.cyl(0, 40, 2.6, 2.9, 3.0, 3.0, 20, IVORY); f.cyl(0, 40, 2.9, 3.0, 2.7, 2.7, 20, [.5, .8, .9]); f.cyl(0, 40, 3.0, 4.6, .5, .4, 10, IVORY); f.cyl(0, 40, 4.6, 4.8, 1.5, 1.5, 14, IVORY);
    const hp = (x, y, z, s) => { f.sphere(x - s * .32, y + s * .3, z, s * .38, s * .38, s * .3, [1, .55, .7], 6); f.sphere(x + s * .32, y + s * .3, z, s * .38, s * .38, s * .3, [1, .55, .7], 6); f.sphere(x, y - s * .1, z, s * .42, s * .5, s * .3, [1, .55, .7], 6); };
    hp(0, 5.6, 40, 1.4); add(f, { tex: X.marble, em: solid(255, 120, 160), emDay: .0, emNight: .3 });
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; hl(Math.cos(a) * 5.8, 1.2, 40 + Math.sin(a) * 5.8, 1.6, [.6, .8, 1], .3); }
    obs(-6.4, 33.6, 6.4, 46.4);
    // 花坛 (带玫瑰花) 沿中轴两侧
    for (let z = 20; z <= 76; z += 14) [-1, 1].forEach(sg => { if (Math.abs(z - 40) < 9) return; const x = sg * 10.2; t.box(x - 2.4, 0, z - 1.2, x + 2.4, .5, z + 1.2, [.92, .88, .8]); add(t, {}); const b = new MB(); b.box(x - 2.2, .5, z - 1.0, x + 2.2, .85, z + 1.0, WHITE, [2, 2]); add(b, { tex: X.bed }); obs(x - 2.4, z - 1.2, x + 2.4, z + 1.2); });
    // 路灯 + 灯串
    for (let z = 20; z <= 80; z += 8) [-1, 1].forEach(sg => lampPost(w, gl, sg * 5.4, z, 4.4, [.2, .2, .26]));
    add(w, {}); }
  /* ---------- 室外仪式: 花拱 + 白椅 + 花瓣红毯 ---------- */
  { const a = new MB(), ch = new MB(), fw = new MB(); roseArch(a, 0, 6, 6.4, 6.6, [1, 1, 1], ROSE);
    a.arch(0, 5.2, 5.8, 6.2, 4.6, 4.1, 0, PI, 18, [1, 1, 1]); for (let k = 0; k <= 18; k++) { const an = k / 18 * PI; a.sphere(Math.cos(an) * 4.35, 5.2 + Math.sin(an) * 4.35, 6, .42, .36, .36, k % 2 ? [1, .6, .72] : [1, .96, .96], 5); }
    [-1, 1].forEach(sg => { a.cyl(sg * 4.35, 6, 0, 5.2, .14, .14, 8, [1, 1, 1]); for (let k = 0; k < 7; k++) a.sphere(sg * 4.35, .4 + k * .72, 6, .34, .3, .3, k % 2 ? [1, .6, .72] : [1, .96, .96], 5); a.box(sg * 5.4 - .8, 0, 5.2, sg * 5.4 + .8, .9, 6.8, [.96, .94, .9]); for (let k = 0; k < 5; k++) a.sphere(sg * 5.4 + (k - 2) * .3, 1.1 + (k % 2) * .2, 6, .34, .3, .3, k % 2 ? [1, .6, .72] : [1, .96, .96], 5); });
    add(a, {}); hl(0, 3.2, 6.4, 7, [1, .9, .8], .3);
    // 白椅: 左右各 9 排 x 6 把, 朝北 (yaw = PI)
    const rows = 9, cols = 6; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) [-1, 1].forEach(sg => { const x = sg * (4.6 + c * 1.15), z = 14 + r * 1.9; chairMB(ch, x, z, PI, [.97, .95, .92], c === 0 ? [1, .6, .72] : null); seat(x, z, PI, .46, [sg * 3.6, z]); });
    add(ch, {}); [-1, 1].forEach(sg => { for (let r = 0; r < rows; r++) { const z = 14 + r * 1.9; fw.sphere(sg * 3.9, .7, z - .1, .28, .26, .26, r % 2 ? ROSE : [1, .96, .96], 5); } }); add(fw, {});
    signAt('FOREVER & EVER  ·  永结同心', { w: 512, h: 100, fs: 40, bg: '#fff4f2', fg: '#b0405c', border: '#e0a83a' }, 0, 13, 0, 1.2, 2.2, 6.4, .5, 1.2); }

  /* ---------- 西侧盛宴露台: 舞台 / 舞池 / 圆桌 / 蛋糕 / 香槟塔 / 自助台 / 灯串 ---------- */
  { const tb = new MB(), cl = new MB(), ch = new MB(), fl2 = new MB(), st = new MB(), cake = new MB();
    // 舞台 + LED 心形背景 + 乐队
    st.box(-66, 0, -8, -42, .9, -1, [.96, .93, .88], [4, 4]); st.box(-66.4, .9, -8.2, -41.6, 1.05, -.8, GOLD);
    const sh = new MB(); sh.quad([-62, 1.1, -8.05], [-46, 1.1, -8.05], [-46, 10.5, -8.05], [-62, 10.5, -8.05], [0, 0, 1], [0, 1, 1, 0], WHITE);
    sh.quad([-56, 3.4, -7.9], [-52, 3.4, -7.9], [-52, 7.4, -7.9], [-56, 7.4, -7.9], [0, 0, 1], [0, 1, 1, 0], WHITE); add(sh, { tex: X.heart.tex, em: X.heart.em, emDay: .25, emNight: 1.6 });
    [-1, 1].forEach(sg => { for (let k = 0; k < 6; k++) st.sphere(-54 + sg * (8.4 - k * .02), 1.4 + k * 1.3, -7.6, .6, .55, .5, k % 2 ? ROSE : [1, .96, .96], 5); });
    // 乐队: 鼓 / 键盘 / 话筒架
    st.cyl(-61, -4.8, .9, 1.5, .62, .62, 12, [.85, .2, .25]); st.cyl(-61.9, -4.4, .9, 1.7, .32, .32, 10, [.85, .2, .25]); st.cyl(-60.1, -4.4, .9, 1.7, .32, .32, 10, [.85, .2, .25]); st.cyl(-61, -4.8, 1.5, 1.52, .66, .66, 12, GOLD);
    st.box(-48.4, .9, -5.6, -45.6, 1.6, -4.4, [.12, .12, .16]); st.box(-48.2, 1.6, -5.4, -45.8, 1.65, -4.6, [.95, .95, .98]);
    [-56, -53].forEach(x => { st.cyl(x, -3.2, .9, 2.3, .04, .04, 5, [.15, .15, .18]); st.sphere(x, 2.4, -3.2, .1, .12, .1, [.2, .2, .24], 5); });
    // 新人双人小圆桌 (舞台中央, 俯瞰全场)
    st.cyl(-54.5, -4.6, .9, 1.65, .7, .7, 14, WHITE); st.cyl(-54.5, -4.6, 1.65, 1.7, .8, .8, 14, WHITE); st.cyl(-54.5, -4.6, 1.7, 2.0, .06, .06, 6, [.9, .8, .4]); st.sphere(-54.5, 2.15, -4.6, .22, .22, .22, ROSE, 5);
    [-1, 1].forEach(sg => { chairMB(ch, -54.5 + sg * 1.5, -4.6, sg < 0 ? PI / 2 : -PI / 2, [1, .96, .9], [1, .6, .72]); seat(-54.5 + sg * 1.5, -4.6, sg < 0 ? PI / 2 : -PI / 2, 1.36, [-54.5 + sg * 1.5, .6]); });
    obs(-66, -8, -42, -1);
    // 舞池 (地面铺大理石 + 夜晚彩色闪格由 dynPool 绘制)
    fl(fl2, -66, 2, -42, 14, .03, WHITE, 6); add(fl2, { tex: X.marble });
    // 圆桌 x 9
    const table = (x, z) => { cl.cyl(x, z, 0, .78, 1.32, 1.32, 20, WHITE); cl.cyl(x, z, .78, .8, 1.36, 1.36, 20, [1, .98, .95]); cl.cyl(x, z, .8, 1.25, .07, .07, 6, [.9, .8, .4]); cl.sphere(x, 1.4, z, .32, .26, .32, ROSE, 6); cl.sphere(x + .22, 1.34, z + .1, .24, .2, .24, [1, .96, .96], 6); cl.cyl(x + .75, z - .5, .8, 1.0, .05, .05, 6, [1, .95, .8]); hl(x + .75, 1.1, z - .5, 1.1, [1, .85, .55], .4); hl(x, 1.6, z, 2.4, [1, .75, .85], .4);
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .2, cx = x + Math.cos(a) * 1.95, cz = z + Math.sin(a) * 1.95, yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); chairMB(ch, cx, cz, yaw, [1, .97, .93], k % 2 ? [1, .6, .72] : [.92, .85, .6]); seat(cx, cz, yaw, .46, [x + Math.cos(a) * 2.75, z + Math.sin(a) * 2.75]); } obs(x - 1.4, z - 1.4, x + 1.4, z + 1.4); };
    [22, 32, 42].forEach(z => [-68, -56, -44].forEach(x => table(x, z))); add(cl, { tex: X.cloth }); add(ch, {});
    // 蛋糕: 五层 + 糖花 + 烛光
    cake.box(-31.6, 0, 6.4, -27.4, .95, 10.6, [.96, .93, .88]); [[1.55, 1.0], [1.2, 1.05], [.9, 1.1], [.62, 1.15], [.38, 1.2]].forEach(([r, h], i) => { const y0 = .95 + [0, 1.0, 2.05, 3.15, 4.3][i]; cake.cyl(-29.5, 8.5, y0, y0 + h, r, r, 18, [1, .96, .95]); cake.cyl(-29.5, 8.5, y0 + h - .08, y0 + h, r + .08, r + .08, 18, ROSE); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; cake.sphere(-29.5 + Math.cos(a) * r, y0 + h * .5, 8.5 + Math.sin(a) * r, .12, .12, .12, k % 2 ? ROSE : [1, 1, 1], 4); } });
    cake.sphere(-29.5, 5.9, 8.5, .22, .3, .22, [1, .5, .65], 5); obs(-31.6, 6.4, -27.4, 10.6); hl(-29.5, 3.5, 8.5, 5, [1, .85, .85], .4);
    // 香槟塔 (金字塔形酒杯)
    const g0 = new MB(); g0.box(-31.2, 0, 17.3, -27.8, .95, 20.7, [.96, .93, .88]); for (let lv = 0; lv < 5; lv++) { const n = 5 - lv, y = 1.05 + lv * .52; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const x = -29.5 + (a - (n - 1) / 2) * .55, z = 19 + (b - (n - 1) / 2) * .55; g0.cyl(x, z, y, y + .22, .04, .17, 8, [.9, .96, 1]); g0.sphere(x, y + .24, z, .13, .06, .13, [1, .9, .55], 4); } } obs(-31.2, 17.3, -27.8, 20.7); add(g0, { em: solid(255, 214, 120), emDay: .05, emNight: .8 }); hl(-29.5, 2.2, 19, 4, [1, .9, .6], .4);
    // 自助长桌 (水果 / 甜点)
    const bf = new MB(); bf.box(-31.4, 0, 25, -27.6, .9, 38, [1, .98, .94], [3, 3]); for (let k = 0; k < 14; k++) { const z = 25.8 + k * .9, c = [[1, .4, .45], [1, .8, .35], [.6, .85, .4], [1, .6, .8], [.95, .95, .95]][k % 5]; bf.sphere(-29.5, 1.05, z, .3, .22, .3, c, 5); bf.sphere(-28.8, 1.0, z + .3, .22, .18, .22, c.map(v => v * .85), 5); } obs(-31.4, 25, -27.6, 38); add(bf, { tex: X.cloth });
    // 灯串 (三排悬索)
    [16, 28, 40].forEach((z, i) => { const lm = new MB(); for (let x = -78; x <= -24; x += 2.4) { const y = 7.6 - 1.3 * Math.sin((x + 78) / 54 * PI); lm.box(x - .1, y - .1, z - .1, x + .1, y + .1, z + .1, [1, .9, .6]); hl(x, y, z, 1.5, [1, .85, .5], .4); } addTw(lm, '#ffe7a8', i * 1.7, 1.3 + i * .3); });
    [[-78, -9], [-78, 52], [-24, -9], [-24, 52], [-78, 28], [-24, 28]].forEach(([x, z]) => { const p = new MB(); p.cyl(x, z, 0, 7.8, .12, .1, 7, [.95, .92, .86]); add(p, {}); });
    obs(-79, -10, -77, -8); }
  /* ---------- 东侧: 倒影湖 + 石桥 + 水上凉亭 + 天鹅 + 莲花 ---------- */
  { const LC = [58, 38], RX = 21, RZ = 17, w = new MB(), rim = new MB(), br = new MB(), gz = new MB(), dec = new MB();
    C.ellipse(w, LC[0], LC[1], RX, RZ, .05, WHITE, 36, [10, 10]); add(w, { tex: X.water.tex, em: X.water.em, emDay: 0, emNight: .7 });
    C.ellipseRing(rim, LC[0], LC[1], RX, RZ, RX + 1.3, RZ + 1.3, .06, [.95, .92, .86], 36, [8, 3]); add(rim, { tex: X.paving });
    // 石桥 (弧形桥面 + 栏杆)
    for (let k = 0; k < 24; k++) { const x0 = 36 + k * 1.6, x1 = x0 + 1.6, h = (x) => .12 + 1.5 * Math.sin(Math.min(1, Math.max(0, (x - 36) / 38)) * PI); br.quad([x0, h(x0), 36.4], [x1, h(x1), 36.4], [x1, h(x1), 39.6], [x0, h(x0), 39.6], [0, 1, 0], [0, 0, .4, 1], [1, 1, 1]); br.box(x0, h(x0) - .4, 36.4, x1, h(x0) - .1, 39.6, [.9, .86, .78]);
      [36.4, 39.6].forEach(z => { br.box(x0, h(x0), z - .08, x1, h(x0) + .85, z + .08, [.98, .96, .92]); if (k % 3 === 0) br.sphere(x0, h(x0) + .95, z, .16, .2, .16, [1, .9, .6], 5); }); }
    add(br, { tex: X.marble });
    // 凉亭 (八柱 + 穹顶 + 爱心)
    gz.cyl(58, 38, 1.5, 1.7, 3.6, 3.6, 16, [1, .98, .94]); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; gz.cyl(58 + Math.cos(a) * 3.2, 38 + Math.sin(a) * 3.2, 1.7, 6.4, .16, .14, 8, [1, .98, .94]); }
    gz.cyl(58, 38, 6.4, 6.8, 3.9, 3.9, 16, GOLD); gz.cyl(58, 38, 6.8, 9.8, 3.8, .2, 16, [.96, .9, .94]); gz.sphere(58, 10.2, 38, .35, .45, .35, GOLD, 6);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .2; dec.sphere(58 + Math.cos(a) * 3.2, 6.3, 38 + Math.sin(a) * 3.2, .34, .3, .3, ROSE, 5); }
    add(gz, { tex: X.marble }); add(dec, {}); hl(58, 5, 38, 9, [1, .85, .8], .4);
    // 天鹅 / 莲花
    const sw = new MB(); [[48, 30, .6], [66, 46, 2.4], [52, 48, 4.1]].forEach(([x, z, a]) => { sw.sphere(x, .45, z, .7, .45, .45, [1, 1, 1], 6); const nx = x + Math.cos(a) * .55, nz = z + Math.sin(a) * .55; sw.cyl(nx, nz, .5, 1.5, .1, .08, 6, [1, 1, 1]); sw.sphere(nx, 1.55, nz, .17, .15, .17, [1, 1, 1], 5); sw.box(nx + Math.cos(a) * .17 - .05, 1.5, nz + Math.sin(a) * .17 - .05, nx + Math.cos(a) * .35 + .05, 1.58, nz + Math.sin(a) * .35 + .05, [1, .6, .3]); }); add(sw, {});
    const lo = new MB(), rr = rnd(77); for (let i = 0; i < 22; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * .9, x = LC[0] + Math.cos(a) * RX * d, z = LC[1] + Math.sin(a) * RZ * d; lo.cyl(x, z, .06, .09, .7, .7, 8, [.3, .62, .35]); if (i % 3 === 0) lo.sphere(x, .2, z, .3, .2, .3, [1, .65, .8], 5); } add(lo, {});
    obs(36, 20, 80, 36.2); obs(36, 39.8, 80, 56); }

  /* ---------- 东侧宴会厅 (外观): 柱廊门厅 + 彩绘长窗 + 石板大屋顶 ---------- */
  { const st = new MB(), rf = new MB(), cl = new MB(), tw = new MB();
    st.box(36, 0, -58, 70, 14, -14, IVORY, [6, 6]); gableX(rf, 34.6, 71.4, -59, -13, 14, 25, [1, 1, 1], [8, 8], null); gableX(st, 36, 37, -58, -14, 14, 25, IVORY, [6, 6], IVORY); gableX(st, 69, 70, -58, -14, 14, 25, IVORY, [6, 6], IVORY);
    gableZ(st, 40, 66, -14.6, -13.4, 14, 20.5, IVORY, [6, 6], IVORY);                                     // 前山花
    [[36, -14], [70, -14]].forEach(([x, z]) => { st.cyl(x, z, 0, 16, 2.1, 2.1, 10, IVORY); rf.cyl(x, z, 16, 24, 2.5, .15, 10, [1, 1, 1]); cross3d(st, x, 24, z, .8, GOLD); });
    // 门廊: 6 根柱 + 檐部
    for (let k = 0; k < 6; k++) { const x = 44 + k * 1.84 * 1.0 + (k > 2 ? 3.2 : 0) - 1; cl.cyl(x, -9, 0, 9, .55, .5, 12, IVORY); cl.cyl(x, -9, 0, .35, .75, .75, 12, [.92, .88, .8]); cl.cyl(x, -9, 8.7, 9.2, .72, .72, 12, GOLD); }
    st.box(41, 9, -10.5, 65.5, 10.6, -7.5, IVORY, [4, 4]); st.box(41.4, 10.6, -10.2, 65.2, 11.2, -7.8, GOLD); st.box(36, 0, -14, 70, .5, -7, [.96, .92, .86], [4, 4]);
    for (let k = 0; k < 4; k++) st.box(44 - k * .4, 0, -7 + k * 1.2, 63 + k * .4, .22 * (4 - k), -5.8 + k * 1.2, [.96, .92, .86], [3, 3]);
    const dm = new MB(); dm.quad([50, 0, -14.1], [56, 0, -14.1], [56, 8.2, -14.1], [50, 8.2, -14.1], [0, 0, 1], [0, 0, 1, 1], WHITE); add(dm, { tex: X.door }); ptRing(st, 53, 6.2, -14.5, -13.9, 6, 1.2, GOLD);
    [[39.5, 0], [44.2, 1], [61.8, 2], [66.5, 3]].forEach(([x, v]) => { const g = X.glassN[v], m = new MB(); rbox(m, x, -13.9, 3, .2, 1.6, 12.2, 0, WHITE, [3, 10.6]); add(m, winEm(g, .1, 1.5)); });
    signAt('GRAND BALLROOM  ·  宴会厅', { w: 512, h: 90, fs: 40, bg: '#1b1530', fg: '#ffe7a8', border: '#e0a83a' }, 53, 12.2, 0, 1.6, 8.4, -7.3, .5, 1.5);
    add(st, { tex: X.stone }); add(cl, { tex: X.stone }); add(rf, { tex: X.slate }); obs(36, -58, 70, -12);
    [[53, 9], [44, 8], [62, 8]].forEach(([x, y]) => hl(x, y, -7, 6, [1, .82, .5], .4)); }
  /* ---------- 玫瑰拱门长廊 + 铁艺大门 + 门柱 ---------- */
  { const ra = new MB(); [52, 58.5, 65, 71.5].forEach((z, i) => { roseArch(ra, 0, z, 5.4, 4.8, [1, 1, 1], i % 2 ? ROSE : [1, .45, .62]); const lm = new MB(); for (let k = 0; k <= 12; k++) { const a = k / 12 * PI; lm.box(Math.cos(a) * 2.5 - .06, 2.4 + Math.sin(a) * 2.5 - .06, z - .2, Math.cos(a) * 2.5 + .06, 2.4 + Math.sin(a) * 2.5 + .06, z - .1, [1, .9, .6]); hl(Math.cos(a) * 2.5, 2.4 + Math.sin(a) * 2.5, z - .1, 1.2, [1, .85, .55], .5); } addTw(lm, '#ffe7a8', i * 1.3, 1.7); }); add(ra, {});
    const g = new MB(); [-1, 1].forEach(sg => { for (let k = 0; k < 2; k++) { g.box(sg * (4.4 + k * .1) - .55, 0, 83.5, sg * (4.4 + k * .1) + .55, 4.6 + k * 0, 84.5, IVORY, [3, 3]); } g.box(sg * 4.4 - .75, 4.6, 83.3, sg * 4.4 + .75, 5.0, 84.7, GOLD); g.sphere(sg * 4.4, 5.6, 84, .55, .65, .55, [1, .9, .6], 6); hl(sg * 4.4, 5.6, 84, 3, [1, .85, .5], .4);
      for (let x = 4.9; x < 82; x += .6) g.box(sg * x - .04, 0, 83.9, sg * x + .04, 2.2 + .25 * Math.sin(x * 2), 84.1, [.18, .18, .24]); g.box(sg * 43 - 38, 2.0, 83.9, sg * 43 + 38, 2.12, 84.1, [.18, .18, .24]); });
    g.arch(0, 4.8, 83.9, 84.1, 4.2, 4.0, 0, PI, 18, [.18, .18, .24]); add(g, {});
    signAt('STAR WEDDING CHAPEL  ·  星光教堂', { w: 600, h: 100, fs: 40, bg: '#fff4f2', fg: '#a8344f', border: '#e0a83a' }, 0, 6.6, 0, 1.4, 6.4, 84.2, .5, 1.5); obs(-3.6 - 1.2, 83.3, -3.2, 84.8); obs(3.2, 83.3, 4.8, 84.8); }
  /* ---------- 樱花树 + 花灌木 ---------- */
  { const t = new MB(); let sd = 1; const pts = []; for (let z = 22; z <= 78; z += 8) [-1, 1].forEach(sg => pts.push([sg * 15.5, z]));
    for (let z = -12; z <= 14; z += 9) { pts.push([-40, z]); pts.push([42, z]); } for (let a = 0; a < 14; a++) { const an = a / 14 * TAU; pts.push([58 + Math.cos(an) * 25.5, 38 + Math.sin(an) * 21.5]); } [[-22, 52], [-22, 62], [22, 56], [-76, 58], [-30, 58]].forEach(p => pts.push(p));
    pts.forEach(([x, z]) => { occ(() => { const m = new MB(); sakura(m, x, z, .9 + (sd++ % 3) * .12, sd); add(m, { tex: X.blossom }); }); obs(x - .5, z - .5, x + .5, z + .5); });
    const hd = new MB(); [[-45, 56, -24, 57.5], [-79, -9, -79.6, 52]].forEach(([a, b, c, d]) => hd.box(Math.min(a, c), 0, Math.min(b, d), Math.max(a, c) + (a === c ? 1 : 0), 1.1, Math.max(b, d) + (b === d ? 1 : 0), [.3, .6, .35])); add(hd, { tex: X.grass }); }
  /* ---------- 婚礼花车 + 钟亭 + 签名台 ---------- */
  { const c = new MB(), h = new MB();
    c.box(-16.2, .9, 68.8, -11.8, 1.5, 71.2, [1, .98, .95]); c.box(-16.2, 1.5, 68.8, -11.8, 2.9, 69.1, [1, .98, .95]); c.box(-16.3, 2.9, 68.7, -11.7, 3.1, 71.3, GOLD); c.cyl(-16, 69, 3.1, 4.2, .08, .08, 5, GOLD); c.cyl(-12, 69, 3.1, 4.2, .08, .08, 5, GOLD); c.box(-16.2, 4.2, 68.8, -11.8, 4.4, 71.2, [1, .98, .95]);
    [[-15.6, 68.8], [-12.4, 68.8], [-15.6, 71.2], [-12.4, 71.2]].forEach(([x, z]) => C.tcyl(c, [x, .8, z - .12], [x, .8, z + .12], .8, .8, 12, [.96, .9, .8]));
    for (let k = 0; k < 8; k++) c.sphere(-16.2 + k * .6, 2.1, 71.35, .22, .2, .2, k % 2 ? ROSE : [1, .96, .96], 5); c.box(-18.6, 1.1, 69.9, -16.2, 1.18, 70.1, [.6, .45, .3]);
    [[-20, 69, 0], [-20, 71, 0]].forEach(([x, z]) => { h.sphere(x, 1.9, z, .9, .65, .45, [1, 1, 1], 8); h.sphere(x - .85, 2.5, z, .3, .45, .26, [1, 1, 1], 6); h.sphere(x - 1.15, 2.85, z, .26, .22, .2, [1, 1, 1], 6); for (let l = 0; l < 4; l++) h.box(x + (l < 2 ? -.5 : .5) - .08, 0, z + (l % 2 ? .22 : -.22) - .08, x + (l < 2 ? -.5 : .5) + .08, 1.3, z + (l % 2 ? .22 : -.22) + .08, [.95, .95, .95]); h.box(x - 1.05, 3.1, z - .05, x - .95, 3.5, z + .05, ROSE); });
    add(c, {}); add(h, {}); obs(-21.5, 67.6, -11.5, 72.6);
    // 钟亭
    const b = new MB(); [[0, 0], [3.4, 0], [0, 3.4], [3.4, 3.4]].forEach(([dx, dz]) => b.cyl(24.2 + dx, -10 + dz, 0, 4.6, .16, .14, 8, IVORY)); b.box(23.6, 4.6, -10.6, 28.2, 5.0, -5.4, GOLD); spire(b, 25.9, -8, 2.9, 5.0, 8.2, [.96, .9, .94], [3, 3]); b.cyl(25.9, -8, 3.2, 3.5, .06, .06, 6, GOLD); b.sphere(25.9, 3.0, -8, .55, .7, .55, GOLD, 8); b.box(23.4, 0, -10.8, 28.4, .3, -5.2, [.95, .92, .86]); add(b, {}); obs(24.2, -10, 27.7, -6.6);
    // 签名台 + 欢迎牌
    const s = new MB(); s.box(-12.6, 0, -9.8, -9.4, 1.0, -8.6, [1, .98, .94], [3, 3]); s.box(-12.2, 1.0, -9.6, -9.8, 1.08, -8.8, [.9, .3, .4]); s.sphere(-11, 1.3, -9.2, .26, .3, .26, ROSE, 5); add(s, { tex: X.cloth }); obs(-12.6, -9.8, -9.4, -8.6); }
  /* ---------- 前广场装饰: 花瓣纹章 + 栏杆 + 心形花雕 + 大花盆 ---------- */
  { const m = new MB(), o = new MB(), t = new MB();
    [[10.2, 9.6, [.98, .9, .93]], [9.6, 9.0, [.86, .68, .3]], [8.6, 8.0, [1, .62, .74]], [6.6, 6.0, [.86, .68, .3]], [4.2, 0, [.97, .93, .9]]].forEach(([r1, r0, c], i) => m.disc(0, -2, .05 + i * .004, r1, 40, c, r0));
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; m.disc(Math.cos(a) * 7.3, -2 + Math.sin(a) * 7.3, .07, .9, 12, k % 2 ? [1, .55, .7] : [1, .95, .95]); }
    add(m, { tex: X.marble });
    for (let x = -46; x <= 46; x += 1.6) { if (Math.abs(x) < 10) continue; o.cyl(x, 11, 0, .85, .13, .1, 6, [.97, .94, .88]); } [[-46, -10], [10, 46]].forEach(([a, b]) => { o.box(a, .85, 10.85, b, 1.05, 11.15, [.97, .94, .88]); o.box(a, 0, 10.9, b, .25, 11.1, [.97, .94, .88]); }); [-46, -10, 10, 46].forEach(x => { o.box(x - .35, 0, 10.65, x + .35, 1.3, 11.35, [.97, .94, .88]); o.sphere(x, 1.55, 11, .28, .28, .28, GOLD, 6); });
    add(o, { tex: X.stone }); obs(-46.4, 10.6, -10, 11.4); obs(10, 10.6, 46.4, 11.4);
    [[-22, 3], [22, 3], [-34, -4], [34, -4]].forEach(([x, z]) => { t.cyl(x, z, 0, 1.0, 1.15, .95, 12, [.96, .92, .86]); t.cyl(x, z, 1.0, 1.1, 1.25, 1.25, 12, GOLD); t.sphere(x, 2.2, z, 1.0, 1.15, 1.0, [.3, .65, .38], 8); t.sphere(x - .35, 2.5, z + .85, .42, .4, .3, ROSE, 6); t.sphere(x + .45, 1.8, z + .88, .36, .34, .28, [1, .95, .96], 6); obs(x - 1.2, z - 1.2, x + 1.2, z + 1.2); }); add(t, {}); }
  /* ---------- 特效: 飘落花瓣 / 喷泉水柱 / 烟花 / 白鸽 / 钟声 / 舞池彩格 ---------- */
  S.bell = 0; S.fw = 0; S.doves = 0; S.bouq = 0; S.flash = 0;
  const dot = (m, x, y, z, w, h, col, p) => { const pp = p == null ? .46 : p, c = Math.cos(pp), s = Math.sin(pp); const hy = h * c, hz = h * s; m.quad([x - w, y - hy * .5, z + hz * .5], [x + w, y - hy * .5, z + hz * .5], [x + w, y + hy * .5, z - hz * .5], [x - w, y + hy * .5, z - hz * .5], [0, 1, 0], [0, 0, 1, 1], col); };
  S.dyn = (fx, t, g, env) => {
    const nt = env && env.night != null ? env.night : 0, sp = fx.spray, sk = fx.spark;
    for (let i = 0; i < 70; i++) { const ph = fr(t * .06 + i * .6180339), x = -34 + 70 * fr(i * .7548), z = -8 + 74 * fr(i * .5698 + .3), y = 9 - ph * 9.4; if (y < 0) continue; dot(sp, x + Math.sin(t * .8 + i) * .8, y, z, .11, .08, [1, .72 + .2 * fr(i * .13), .82], .46); }   // 玫瑰花瓣
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, ph = fr(t * .5 + i * .13), r = 1.5 + ph * 3.2, y = 3.4 + Math.sin(ph * PI) * 3.4 - ph * 1.6; dot(sp, Math.cos(a) * r * .55, y, 40 + Math.sin(a) * r * .55, .13, .13, [.7, .9, 1]); }   // 喷泉水柱
    for (let i = 0; i < 30; i++) { const x = -78 + 54 * fr(i * .618 + .1), z = -8 + 60 * fr(i * .414), y = 2 + 5 * fr(t * .1 + i * .21), tw = .5 + .5 * Math.sin(t * 2 + i * 3.1); dot(sk, x, y, z, .12 * tw, .12 * tw, [1, .9, .55]); }   // 露台星光
    if (S.fw > t) { const T0 = S.fw - 14; for (let sh = 0; sh < 7; sh++) { const st = T0 + sh * 1.8, u = t - st; if (u < 0 || u > 3.6) continue; const cx = -26 + sh * 9, cz = 4, cy = 26 + (sh % 3) * 6, col = [[1, .5, .6], [.6, .8, 1], [1, .9, .5], [.8, .6, 1], [.6, 1, .8]][sh % 5]; if (u < .9) { dot(sk, cx, cy * u / .9, cz, .25, .5, [1, .9, .7]); continue; } const k = (u - .9) / 2.7, r = 14 * (1 - Math.pow(1 - k, 2)); for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, b = (i % 3) * .35 - .3; dot(sk, cx + Math.cos(a) * r * Math.cos(b), cy + Math.sin(b) * r - 4 * k * k * 3, cz + Math.sin(a) * r * Math.cos(b), .22 * (1 - k), .22 * (1 - k), col); } } }
    if (S.doves > t) { for (let i = 0; i < 14; i++) { const k = (t - (S.doves - 9)) * .5, a = i * .7 + k, x = 8 + Math.cos(a) * (3 + k * 5), z = 40 + Math.sin(a) * (3 + k * 5), y = 2 + k * 5 + Math.sin(i + t * 4) * .4; dot(sk, x, y, z, .28, .12, [1, 1, 1]); dot(sk, x, y + .12, z, .12, .28, [1, 1, 1]); } }
    if (S.bell > t) { const u = 1 - (S.bell - t) / 3; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = 1 + u * 8; dot(sk, 18.5 + Math.cos(a) * r, 22 + Math.sin(a) * r * .7, -15, .3 * (1 - u), .3 * (1 - u), [1, .88, .5]); } }
    if (S.bouq > t) { const u = 1 - (S.bouq - t) / 2.2, x = -2 + u * 4, z = 6 - u * 14 + 14 * u, y = 1.5 + Math.sin(u * PI) * 5; dot(sk, x, y, z, .4, .4, [1, .5, .7]); dot(sk, x + .3, y + .2, z, .3, .3, [1, 1, 1]); }
    fx.glow = { spray: .9, beam: 0, spark: .7 + .3 * nt };
  };
  S.dynPool = (pm, g, env, t) => { const nt = env && env.night != null ? env.night : 0; for (let ix = 0; ix < 8; ix++) for (let iz = 0; iz < 4; iz++) { const ph = (ix + iz) * .5 + t * 2, c = [.5 + .5 * Math.sin(ph), .5 + .5 * Math.sin(ph + 2.1), .5 + .5 * Math.sin(ph + 4.2)]; pm.floor(-66 + ix * 3 + .2, 2 + iz * 3 + .2, -66 + ix * 3 + 2.8, 2 + iz * 3 + 2.8, .06, c.map(v => v * (.25 + .6 * nt))); } };
  /* ---------- 互动 + 传送 + 座位 + 场景参数 ---------- */
  S.portals.push({ id: 'chapel_in', x: 0, z: -13.5, r: 2.4, label: '教堂大殿', icon: '⛪', color: [1, .85, .6], spawn: [0, 9] });
  S.portals.push({ id: 'chapel_hall', x: 53, z: -6.5, r: 2.4, label: '宴会厅', icon: '🥂', color: [1, .7, .85], spawn: [0, 20] });
  const HS = (id, x, z, label, icon, col) => S.hotspots.push({ id, x, z, r: 2.0, label, icon, color: col });
  HS('photo', 0, 9.6, '婚礼合影', '📸', [1, .6, .75]); HS('bouquet', 0, 20.6, '抛花球', '💐', [1, .6, .8]); HS('bell', 18.5, -13.5, '敲响钟楼', '🔔', [1, .85, .5]); HS('fireworks', 0, 28, '放烟花', '🎆', [.7, .8, 1]);
  HS('doves', 8.5, 46.5, '放飞白鸽', '🕊️', [1, 1, 1]); HS('wish', 0, 47.4, '爱之喷泉', '⛲', [.6, .85, 1]); HS('cake', -29.5, 12, '切蛋糕', '🎂', [1, .7, .8]); HS('champagne', -29.5, 22.6, '香槟塔', '🥂', [1, .9, .55]);
  HS('dance', -54, 8, '舞池', '💃', [.9, .6, 1]); HS('guestbook', -11, -7.4, '签名簿', '📖', [1, .85, .6]); HS('carriage', -13.6, 74, '花车合影', '🚗', [1, .75, .75]);
  S.onUse = (n, api) => {
    const G2 = api.G, me = G2.me, toast = api.toast, say = api.setBubble;
    const act = (clip, sec) => { me.pose = sec; me.actClip = clip; };
    switch (n.id) {
      case 'photo': act('cheer', 3.4); say(me, '💍 永远在一起'); toast('📸 咔嚓！婚礼合影已保存（演示）', 2600); return true;
      case 'carriage': act('cheer', 3); say(me, '🚗 新婚快乐！'); toast('📸 在婚礼花车旁合影', 2400); return true;
      case 'bouquet': S.bouq = G2.t + 2.2; act('cheer', 2.4); say(me, '💐 接到的人是下一个！'); toast('💐 花球抛出去啦～', 2400); return true;
      case 'bell': S.bell = G2.t + 3; act('clap', 3); toast('🔔 当——当——当——  钟声祝福新人', 3000); return true;
      case 'fireworks': if (S.fw > G2.t) { toast('烟花还在绽放～', 1400); return true; } S.fw = G2.t + 14; toast('🎆 烟花秀开始！（夜晚更好看）', 3200); act('cheer', 5); return true;
      case 'doves': if (S.doves > G2.t) return true; S.doves = G2.t + 9; toast('🕊️ 白鸽放飞，祝福飞向远方', 3000); act('cheer', 3); return true;
      case 'wish': if (api.pay(10, '⛲ 你对爱之喷泉许了一个愿…', '许愿～')) { if (Math.random() < .35) setTimeout(() => { api.setCoins(G2.coinCount + 60); toast('💖 爱情的祝福：+60 金币', 2600); }, 1200); } return true;
      case 'cake': if (api.pay(0, '🎂 新人一起切下了婚礼蛋糕！', '甜蜜～')) act('clap', 3.5); return true;
      case 'champagne': act('cheer', 4); say(me, '🥂 干杯！'); toast('🥂 香槟塔倾倒，大家一起干杯！', 3000); return true;
      case 'dance': act('dance', 8); say(me, '💃 ♪'); return true;
      case 'guestbook': toast('📖 你在签名簿上写下：百年好合', 2800); act('wave', 2.4); return true;
    }
    return false;
  };
  S.name = '星光教堂 · 婚礼庄园'; S.bounds = { x0: -84, x1: 84, z0: -20, z1: 86 }; S.spawn = [0, 80];
  S.camera = { dist: 25, pitch: .46, fov: .74, clampX: [-68, 68], clampZ: [-10, 76], lead: 4, ty: 0 }; S.cameraWide = { dist: 21, pitch: .12, fov: 1.18, clampX: [-68, 68], clampZ: [-10, 76], lead: 4 };
  S.npcRect = { x0: -74, x1: 74, z0: -10, z1: 78 }; S.heightAt = () => 0; S.indoor = false;
  S.env = (h) => { const e = G.World.envAt(h); e.fogNear = 150; e.fogFar = 340; return e; };
  gl.fogOff = true; add(gl, { tex: T.glow, mode: 2, glow: (e) => .22 + e.night * .72 });
  return S;
}

/* =====================================================================
   大殿: 教堂内部 — 尖拱穹顶 / 彩绘玻璃 / 红毯 / 长椅 / 祭坛 / 管风琴 / 水晶吊灯 / 光柱
   入口在南(+z), 祭坛在北(-z). 婚礼互动: 誓词 / 交换戒指 / 亲吻 / 花球 / 烛光祈愿 / 管风琴 / 婚纱照.
   ===================================================================== */
const indoorEnv = (a0, a1, bot0, bot1, nt) => h => { const e0 = G.World.envAt(h), n = Math.max(0, Math.min(1, e0.night)), L = (a, b) => a.map((v, i) => v + (b[i] - v) * n);
  return { indoor: true, night: nt != null ? nt : n * .85, gold: e0.gold || 0, day: 1 - n, dir: [.2, 1, .5], sun: L([.62, .56, .5], [.4, .34, .36]), amb: L(a0, a1), top: [.98, .9, .84], bot: L(bot0, bot1), fog: L(bot0, bot1), charAmb: L([.74, .68, .66], [.58, .5, .56]), charSun: L([.56, .5, .4], [.4, .34, .32]), line: [.3, .18, .2], fogNear: 70, fogFar: 150 }; };
const hearts = (sk, cx, cy, cz, u, dotf, col) => { for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, r = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); dotf(sk, cx + r * .1 * (.3 + u), cy + y * .1 * (.3 + u) + u * 2, cz, .16 * (1 - u * .6), .16 * (1 - u * .6), col); } };

function makeChapelIn(R, T) {
  const S = {}, K = C.kit(R, T, S), X = tex(R), { add, occ, obs, emS, solid, signAt, addTw, seat } = K;
  const IVORY = [.97, .94, .88], GOLD = [.86, .68, .3], WHITE = [1, 1, 1], ROSE = [1, .56, .68], gl = new MB(), sh = new MB();
  const hl = (x, y, z, s, col, p) => C.halo(gl, x, y, z, s, col, p == null ? .55 : p);
  const winEm = (g, a, b) => ({ tex: g.tex, em: g.em, emDay: a == null ? .35 : a, emNight: b == null ? 1.3 : b });
  const BAYS = [1, -7, -15, -23, -31, -39, -47], COLZ = [5, -3, -11, -19, -27, -35, -43];
  /* 地面 / 红毯 / 圣坛台 */
  { const f = new MB(), cp = new MB(), d = new MB(); f.floor(-17, -62, 17, 13.4, 0, WHITE, [0, 0, 34 / 8, 75.4 / 8]); add(f, { tex: X.marble });
    cp.floor(-1.6, -47.5, 1.6, 11.6, .03, WHITE, [0, 0, 1, 59 / 6]); add(cp, { tex: X.carpet });
    d.box(-9.5, 0, -62, 9.5, 1.2, -50, [.97, .94, .88], [4, 4]); for (let k = 0; k < 4; k++) d.box(-9.5 + k * .5, 0, -50 + k * .65, 9.5 - k * .5, 1.2 - k * .3, -49.35 + k * .65, [.96, .92, .86], [4, 4]); add(d, { tex: X.marble });
    const dc = new MB(); dc.floor(-1.6, -50, 1.6, -47.5, 1.25, WHITE, [0, 0, 1, .4]); add(dc, { tex: X.carpet }); obs(-9.5, -62, 9.5, -50.4); }
  /* 墙体 + 彩窗 + 窗框 */
  { const w = new MB(), cs = new MB();
    w.box(-17.6, 0, -62.6, -16.8, 14, 13.4, IVORY, [6, 6]); w.box(16.8, 0, -62.6, 17.6, 14, 13.4, IVORY, [6, 6]); w.box(-17.6, 0, -62.6, 17.6, 32, -61.8, IVORY, [6, 6]);
    BAYS.forEach((z, i) => [[-1, 'L'], [1, 'R']].forEach(([sg]) => { const g = X.glassN[(i + (sg > 0 ? 2 : 0)) % 4], m = new MB(); rbox(m, sg * 16.7, z, 3.6, .15, 1.4, 12.6, sg < 0 ? PI / 2 : -PI / 2, WHITE, [3.6, 11.2]); add(m, winEm(g, .4, 1.2));
      w.box(sg * 17 - .2, 12.6, z - 2.0, sg * 17 + .2, 13.2, z + 2.0, GOLD); w.box(sg * 16.7 - .15, 1.0, z - 2.0, sg * 16.7 + .15, 1.4, z + 2.0, GOLD); }));
    // 北墙: 大玫瑰窗 + 三扇长窗
    const rw = new MB(); rw.quad([-6, 17.5, -61.7], [6, 17.5, -61.7], [6, 29.5, -61.7], [-6, 29.5, -61.7], [0, 0, 1], [0, 1, 1, 0], WHITE); add(rw, winEm(X.rosewin, .45, 1.5));
    [[-6.4, 0], [0, 2], [6.4, 1]].forEach(([x, v], i) => { const m = new MB(), hh = i === 1 ? 14 : 11; m.quad([x - 2.1, 5, -61.7], [x + 2.1, 5, -61.7], [x + 2.1, 5 + hh, -61.7], [x - 2.1, 5 + hh, -61.7], [0, 0, 1], [0, 1, 1, 0], WHITE); add(m, winEm(X.glassN[v], .45, 1.5)); });
    add(w, { tex: X.stone });
    // 立柱 + 柱头 + 楣梁 + 圣像
    COLZ.forEach(z => [-1, 1].forEach(sg => { const x = sg * 9.5; cs.cyl(x, z, 0, .7, 1.15, 1.0, 12, [.92, .88, .8]); cs.cyl(x, z, .7, 13.2, .78, .7, 14, IVORY); cs.cyl(x, z, 13.2, 14.2, 1.05, 1.2, 12, GOLD); cs.box(x - .12, 3, z - .12, x + .12, 11, z + .12, IVORY); obs(x - .9, z - .9, x + .9, z + .9); }));
    [-1, 1].forEach(sg => { cs.box(sg * 9.5 - .6, 13.2, -50, sg * 9.5 + .6, 14.2, 11, [.96, .92, .84]); cs.box(sg * 13.3 - 3.8, 13, -62, sg * 13.3 + 3.8, 13.3, 11, [.95, .9, .82]); }); add(cs, { tex: X.stone });
    // 穹顶 + 肋拱
    const vt = new MB(), pts = ptArch(19, 14, 10).map(p => [p[0], p[1]]); barrel(vt, pts.slice(1, -1), -62, 11, [.98, .95, .9], [6, 6]); add(vt, { em: solid(255, 236, 200), emDay: .1, emNight: .28 });
    const ce = new MB(); [-1, 1].forEach(sg => ce.quad([sg * 9.5, 13.1, -62], [sg * 17, 13.1, -62], [sg * 17, 13.1, 13.4], [sg * 9.5, 13.1, 13.4], [0, -1, 0], [0, 0, 6, 12], [.96, .92, .86])); add(ce, { tex: X.stone });
    const rb = new MB(); [...COLZ, -51, 9.5].forEach(z => { rb.arch(9.5, 14, z - .3, z + .3, 19.6, 19, 2 * PI / 3, PI, 12, GOLD); rb.arch(-9.5, 14, z - .3, z + .3, 19.6, 19, 0, PI / 3, 12, GOLD); rb.sphere(0, 30.4, z, .45, .45, .45, GOLD, 6); }); add(rb, emS('#e0a83a', .1, .55)); }
  /* 圣坛: 桌 + 玫瑰花拱 + 金十字 + 讲台 + 管风琴 */
  { const a = new MB(), fl = new MB(), pi = new MB();
    a.box(-3.2, 1.2, -58.4, 3.2, 2.5, -56.6, [1, .98, .95], [3, 3]); a.box(-3.4, 2.5, -58.6, 3.4, 2.62, -56.4, GOLD); a.box(-3.3, 1.4, -56.62, 3.3, 2.4, -56.5, [.96, .86, .5]);
    [-2.4, 2.4].forEach(x => { a.cyl(x, -57.5, 2.62, 4.4, .08, .08, 6, GOLD); a.cyl(x, -57.5, 4.4, 4.5, .26, .26, 8, GOLD); for (let k = 0; k < 3; k++) { a.cyl(x + (k - 1) * .22, -57.5, 4.5, 4.9, .05, .05, 5, [1, 1, .95]); a.sphere(x + (k - 1) * .22, 5.0, -57.5, .05, .1, .05, [1, .8, .35], 4); } hl(x, 5.1, -57.4, 2.2, [1, .8, .45]); });
    for (let k = 0; k < 9; k++) a.sphere(-1.6 + k * .4, 2.78, -57.6, .26, .22, .22, k % 2 ? ROSE : [1, .96, .96], 5);
    // 爱心花拱 (圆拱 + 玫瑰) + 金十字
    a.arch(0, 5.6, -60.6, -60.0, 6.4, 5.8, 0, PI, 24, [1, .98, .95]); for (let k = 0; k <= 24; k++) { const an = k / 24 * PI; fl.sphere(Math.cos(an) * 6.1, 5.6 + Math.sin(an) * 6.1, -60.3, .5, .46, .4, k % 2 ? ROSE : [1, .96, .96], 5); }
    [-1, 1].forEach(sg => { for (let k = 0; k < 9; k++) fl.sphere(sg * 6.1, .4 + k * .6, -60.3, .46, .42, .4, k % 2 ? [1, .96, .96] : ROSE, 5); a.cyl(sg * 6.1, -60.3, 0, 5.6, .1, .1, 8, [1, .98, .95]); });
    for (let k = 0; k < 7; k++) { fl.sphere(-1.4 + k * .46, 9.2, -60.8, .22, .5, .3, [1, .96, .96], 5); } a.box(-.22, 1.2, -60.9, .22, 11, -60.5, GOLD); a.box(-1.5, 7.8, -60.9, 1.5, 8.3, -60.5, GOLD);
    // 讲台 / 诵经台
    a.box(-8.2, 1.2, -52.8, -6.6, 2.2, -51.4, [.5, .32, .2]); a.box(-8.3, 2.2, -53, -6.5, 2.28, -51.2, GOLD); a.box(6.6, 1.2, -52.8, 8.2, 2.5, -51.4, [.5, .32, .2]); a.box(6.5, 2.5, -53, 8.3, 2.58, -51.2, GOLD);
    // 管风琴 (北墙两侧)
    [-1, 1].forEach(sg => { pi.box(sg * 13.3 - 3.8, 1.2, -61.6, sg * 13.3 + 3.8, 3.2, -60.2, [.42, .27, .18]); for (let i = 0; i < 12; i++) { const x = sg * 13.3 - 3.3 + i * .6, h = 7 + (i % 4) * 1.5 + (i % 3) * .5; pi.cyl(x, -61, 3.2, 3.2 + h, .24, .22, 8, GOLD); pi.cyl(x, -61, 3.2 + h * .3, 3.2 + h * .3 + .3, .26, .26, 8, [.7, .55, .25]); } });
    add(a, { tex: X.marble }); add(fl, {}); add(pi, {}); hl(0, 7, -59.5, 14, [1, .88, .62], .4); hl(0, 4, -57, 8, [1, .8, .55], .4); }
  /* 红毯两侧长椅 (21 排 × 左右) + 花球 + 烛台 */
  { const pw = new MB(), fw = new MB(), cd = new MB(), pe = new MB();
    for (let r = 0; r < 21; r++) { const z = 3.6 - r * 1.95; [-1, 1].forEach(sg => { const x0 = sg > 0 ? 3.0 : -9.0; pw.box(x0, 0, z - .45, x0 + 6, .5, z + .45, [.42, .27, .18], [2, 2]); pw.box(x0, .5, z - .08, x0 + 6, 1.2, z + .08, [.46, .3, .2], [2, 2]); pw.box(x0 - .1, 0, z - .55, x0 + .1, 1.3, z + .55, [.5, .34, .22]); pw.box(x0 + 5.9, 0, z - .55, x0 + 6.1, 1.3, z + .55, [.5, .34, .22]); pw.box(x0, .5, z - .36, x0 + 6, .56, z + .36, [.7, .12, .22]);
        [1, 3, 5].forEach(k => seat(x0 + k, z, PI, .5, [sg * 2.1, z])); obs(x0 - .1, z - .55, x0 + 6.1, z + .55); if (r % 3 === 0) { const ax = sg * 2.95; for (let k = 0; k < 5; k++) fw.sphere(ax, 1.4 + (k % 2) * .25, z - .3 + k * .15, .26, .24, .22, k % 2 ? ROSE : [1, .96, .96], 5); fw.sphere(ax, 1.0, z, .34, .3, .3, [.3, .6, .35], 5); } }); }
    add(pw, { tex: X.wood }); add(fw, {});
    COLZ.forEach(z => [-1, 1].forEach(sg => { const x = sg * 8.2; cd.cyl(x, z, 0, .25, .34, .26, 8, GOLD); cd.cyl(x, z, .25, 2.7, .06, .05, 6, GOLD); cd.cyl(x, z, 2.5, 2.7, .3, .1, 8, GOLD); for (let k = -1; k <= 1; k++) { cd.cyl(x + k * .28, z, 2.7, 3.15, .05, .05, 5, [1, 1, .94]); cd.sphere(x + k * .28, 3.22, z, .05, .1, .05, [1, .8, .35], 4); } hl(x, 3.3, z, 2.0, [1, .78, .42]); })); add(cd, emS('#ffd98a', .1, .5));
    // 花瓣 / 花拱 (红毯上空)
    const pt = new MB(), rr = rnd(5); for (let i = 0; i < 90; i++) { const x = (rr() - .5) * 4.4, z = -46 + rr() * 56; pt.quad([x - .09, .045, z - .06], [x + .09, .045, z - .06], [x + .09, .045, z + .06], [x - .09, .045, z + .06], [0, 1, 0], [0, 0, 1, 1], rr() < .55 ? [1, .55, .7] : [1, .93, .95]); } add(pt, {});
    [-6, -24, -40].forEach((z, i) => { const m = new MB(); roseArch(m, 0, z, 6.2, 6.0, [1, 1, 1], i % 2 ? ROSE : [1, .5, .66]); add(m, {}); }); }
  /* 吊灯 + 光柱 (彩窗投下) */
  { const ch = new MB(); [4, -8, -20, -32, -44, -54].forEach(z => chandelier(ch, gl, 0, 25.6, z, 1.9, GOLD)); add(ch, emS('#ffe2a0', .35, 1.1));
    BAYS.forEach((z, i) => [-1, 1].forEach(sg => { const c = [[.6, .75, 1], [1, .55, .6], [.65, 1, .8], [1, .92, .6]][(i + (sg > 0 ? 2 : 0)) % 4], dx = sg * -5.2; sh.quad([sg * 16.3, 12.4, z - 1.7], [sg * 16.3, 12.4, z + 1.7], [sg * 16.3 + dx - 0, .05, z + 3.4 + 1.2], [sg * 16.3 + dx, .05, z - 1.8 + 1.2], [0, 1, 0], [0, 0, 1, 1], c); }));
    sh.quad([-2.4, 30, -52], [2.4, 30, -52], [2.4, 1.3, -52], [-2.4, 1.3, -52], [0, 0, 1], [0, 0, 1, 1], [1, .92, .75]); sh.quad([0, 30, -54.4], [0, 30, -49.6], [0, 1.3, -49.6], [0, 1.3, -54.4], [1, 0, 0], [0, 0, 1, 1], [1, .92, .75]); }
  /* 入口: 大门(南墙, 会被镜头遮挡时淡出) + 唱诗楼 + 侧门 */
  occ(() => { const w = new MB(), d = new MB(), lo = new MB();
    w.box(-17.6, 0, 13, 17.6, 32, 13.8, IVORY, [6, 6]); ptRing(w, 0, 10, 12.7, 13.1, 6.4, 1.3, GOLD); d.quad([-3.2, 0, 12.6], [3.2, 0, 12.6], [3.2, 12.5, 12.6], [-3.2, 12.5, 12.6], [0, 0, -1], [0, 0, 1, 1], WHITE); add(d, { tex: X.door });
    lo.box(-9.5, 8.5, 7, 9.5, 9.1, 13, [.5, .34, .22]); for (let x = -9.4; x <= 9.4; x += .8) lo.box(x - .05, 9.1, 7, x + .05, 10.1, 7.1, GOLD); lo.box(-9.5, 10.1, 6.9, 9.5, 10.25, 7.2, GOLD); add(lo, { tex: X.wood }); add(w, { tex: X.stone }); });
  { const sd = new MB(); sd.quad([16.7, 0, -26], [16.7, 0, -21.4], [16.7, 7.4, -21.4], [16.7, 7.4, -26], [-1, 0, 0], [0, 0, 1, 1], WHITE); add(sd, { tex: X.door }); const g2 = new MB(); ptRing(g2, 0, 4.6, 0, .3, 4.6, 1.0, GOLD); }
  /* 光尘 + 互动 */
  S.burst = 0; S.kiss = 0;
  const dot = (m, x, y, z, w, h, col, p) => { const pp = p == null ? .56 : p, c = Math.cos(pp), s = Math.sin(pp), hy = h * c, hz = h * s; m.quad([x - w, y - hy * .5, z + hz * .5], [x + w, y - hy * .5, z + hz * .5], [x + w, y + hy * .5, z - hz * .5], [x - w, y + hy * .5, z - hz * .5], [0, 1, 0], [0, 0, 1, 1], col); };
  S.dyn = (fx, t, g, env) => { const sk = fx.spark, sp = fx.spray;
    for (let i = 0; i < 60; i++) { const ph = fr(t * .03 + i * .618), z = -52 + 62 * fr(i * .7548), x = (fr(i * .5698) - .5) * 30, y = 2 + ph * 20; dot(sk, x + Math.sin(t * .4 + i) * 1.2, y, z, .09, .09, [1, .92, .7]); }
    if (S.burst > t) { const u = 1 - (S.burst - t) / 4.5; for (let i = 0; i < 90; i++) { const a = i * 2.399, r = u * (3 + (i % 9)), y = 6 + Math.sin(a) * 3 + u * 6 - u * u * 8; dot(sp, Math.cos(a) * r * .9, Math.max(.2, y - u * 7), -50 + Math.sin(a * 1.7) * r * .7, .14, .1, i % 3 ? [1, .72, .82] : [1, 1, 1], .56); } }
    if (S.kiss > t) { const u = 1 - (S.kiss - t) / 4; hearts(sk, 0, 5, -49, u, dot, [1, .4, .6]); hearts(sk, -.6, 5.6, -49.4, u * .8, dot, [1, .7, .8]); hearts(sk, .7, 5.4, -48.8, u * .9, dot, [1, .55, .7]); }
    fx.glow = { spray: .9, beam: 0, spark: .9 }; };
  S.portals.push({ id: 'chapel', x: 0, z: 9.2, r: 2.4, label: '走出教堂', icon: '🚪', color: [1, .85, .6], spawn: [0, -10.5] });
  S.portals.push({ id: 'chapel_hall', x: 15, z: -23.7, r: 2.2, label: '宴会厅', icon: '🥂', color: [1, .7, .85], spawn: [0, 20] });
  const HS = (id, x, z, label, icon, col) => S.hotspots.push({ id, x, z, r: 2.1, label, icon, color: col });
  HS('vow', 0, -46.4, '婚礼宣誓', '💍', [1, .85, .6]); HS('ring', -4.2, -47.2, '交换戒指', '💎', [.7, .85, 1]); HS('kiss', 4.2, -47.2, '新娘之吻', '💋', [1, .55, .7]); HS('bouquet', 0, 1.2, '抛花球', '💐', [1, .6, .8]);
  HS('candle', -8.4, -30, '烛光祈愿', '🕯️', [1, .85, .5]); HS('organ', -12.8, -48, '管风琴', '🎹', [.9, .8, 1]); HS('photo', 0, -42, '婚纱照', '📸', [1, .6, .75]);
  S.onUse = (n, api) => { const G2 = api.G, me = G2.me, toast = api.toast, say = api.setBubble, act = (c, s) => { me.pose = s; me.actClip = c; };
    switch (n.id) {
      case 'vow': S.burst = G2.t + 4.5; act('cheer', 4); say(me, '💒 我愿意！'); toast('💒 在众人的祝福中，你们宣读了誓言：我愿意！', 3600); return true;
      case 'ring': act('clap', 3); say(me, '💍'); toast('💍 戴上戒指，永不分离', 3000); return true;
      case 'kiss': S.kiss = G2.t + 4; act('cheer', 4); say(me, '💋'); toast('💋 新郎可以亲吻新娘了！', 3200); return true;
      case 'bouquet': S.burst = G2.t + 3.5; act('cheer', 3); say(me, '💐 接住！'); toast('💐 花球抛向宾客，谁会是下一个？', 2800); return true;
      case 'candle': act('wave', 2.6); toast('🕯️ 你点燃了一支烛光，许下祝福', 2800); return true;
      case 'organ': act('clap', 3); toast('🎹 管风琴奏起圣洁的乐章（演示）', 3000); return true;
      case 'photo': act('cheer', 3.4); say(me, '📸'); toast('📸 婚纱照已保存（演示）', 2600); return true; }
    return false; };
  S.name = '星光教堂 · 大殿'; S.bounds = { x0: -16.2, x1: 16.2, z0: -61.2, z1: 12.2 }; S.spawn = [0, 9.6];
  S.camera = { dist: 21, pitch: .56, fov: .78, clampX: [-10, 10], clampZ: [-52, 5], lead: 3, ty: 0 }; S.cameraWide = { dist: 16, pitch: .3, fov: 1.12, clampX: [-10, 10], clampZ: [-52, 5], lead: 3 };
  S.npcRect = { x0: -1.8, x1: 1.8, z0: -45, z1: 8 }; S.heightAt = (x, z) => (z < -49.5 ? 1.2 : 0); S.indoor = true;
  S.env = indoorEnv([.9, .8, .72], [.7, .56, .54], [.98, .9, .84], [.34, .22, .24]);
  add(gl, { tex: T.glow, mode: 2, glow: (e) => .3 + e.night * .5 }); add(sh, { tex: X.shaft, mode: 2, glow: (e) => .05 + .26 * e.day + .08 * e.night });
  return S;
}

/* =====================================================================
   宴会厅: 盛大的婚宴大厅 — 舞池 / 圆桌 / 舞台 / 五层蛋糕 / 香槟塔 / 自助盛宴 / 吊灯 / 星空穹顶
   ===================================================================== */
function makeChapelHall(R, T) {
  const S = {}, K = C.kit(R, T, S), X = tex(R), { add, occ, obs, emS, solid, signAt, addTw, seat } = K;
  const IVORY = [.97, .94, .88], GOLD = [.86, .68, .3], WHITE = [1, 1, 1], ROSE = [1, .56, .68], gl = new MB();
  const hl = (x, y, z, s, col, p) => C.halo(gl, x, y, z, s, col, p == null ? .6 : p);
  const winEm = (g, a, b) => ({ tex: g.tex, em: g.em, emDay: a == null ? .35 : a, emNight: b == null ? 1.3 : b });
  /* 地面 / 舞池 / 墙 / 天花 */
  { const f = new MB(), dm = new MB(), w = new MB(), ce = new MB();
    f.floor(-32, -26, 32, 26, 0, WHITE, [0, 0, 8, 6.5]); add(f, { tex: X.parquet });
    [[11.4, 0, [.97, .93, .88]], [11.4, 10.8, GOLD], [10.8, 8, [1, .62, .74]], [8, 0, [.97, .93, .88]]].forEach(([r1, r0, c], i) => dm.disc(0, -2, .03 + i * .004, r1, 48, c, r0)); add(dm, { tex: X.marble });
    w.box(-33, 0, -27, -32, 18, 27, IVORY, [6, 6]); w.box(32, 0, -27, 33, 18, 27, IVORY, [6, 6]); w.box(-33, 0, -27.4, 33, 18, -26, IVORY, [6, 6]);
    [-1, 1].forEach(sg => { for (let i = 0; i < 6; i++) { const z = -20 + i * 8.2, g = X.glassN[(i + (sg > 0 ? 1 : 0)) % 4], m = new MB(); rbox(m, sg * 31.9, z, 3.6, .1, 1.6, 14, sg < 0 ? PI / 2 : -PI / 2, WHITE, [3.6, 12.4]); add(m, winEm(g, .4, 1.3)); w.box(sg * 32 - .15, 14.2, z - 2, sg * 32 + .15, 14.8, z + 2, GOLD); } });
    add(w, { tex: X.stone });
    ce.quad([-32, 18, -26], [32, 18, -26], [32, 18, 26], [-32, 18, 26], [0, -1, 0], [0, 0, 8, 6.5], [.97, .94, .9]); add(ce, { tex: X.stone });
    for (let x = -28; x <= 28; x += 8) { const gb = new MB(); gb.box(x - .25, 17.6, -26, x + .25, 18, 26, GOLD); add(gb, emS('#e0a83a', .1, .5)); } for (let z = -20; z <= 20; z += 8) { const gb = new MB(); gb.box(-32, 17.6, z - .25, 32, 18, z + .25, GOLD); add(gb, emS('#e0a83a', .1, .5)); }
    const dome = new MB(); dome.quad([-10, 17.9, -12], [10, 17.9, -12], [10, 17.9, 8], [-10, 17.9, 8], [0, -1, 0], [0, 0, 1, 1], WHITE); add(dome, { tex: X.dome.tex, em: X.dome.em, emDay: .3, emNight: 1.2 }); }
  /* 立柱 (缠绕玫瑰) + 吊灯 */
  { const c = new MB(), fl = new MB(), ch = new MB(); [-20, -6, 8, 22].forEach(z => [-1, 1].forEach(sg => { const x = sg * 29.6; c.cyl(x, z, 0, .6, .85, .75, 12, IVORY); c.cyl(x, z, .6, 15.4, .6, .55, 12, IVORY); c.cyl(x, z, 15.4, 16.6, .9, .8, 12, GOLD); for (let k = 0; k < 16; k++) fl.sphere(x + Math.cos(k * 1.1) * .62, .8 + k * .8, z + Math.sin(k * 1.1) * .62, .22, .2, .22, k % 2 ? ROSE : [1, .96, .96], 5); obs(x - .9, z - .9, x + .9, z + .9); }));
    add(c, { tex: X.stone }); add(fl, {}); [[0, -14], [0, -2], [0, 10], [-20, -2], [20, -2], [-20, 14], [20, 14]].forEach(([x, z]) => chandelier(ch, gl, x, 15.4, z, x === 0 && z === -2 ? 2.6 : 1.8, GOLD)); add(ch, emS('#ffe2a0', .35, 1.1)); }
  /* 舞台 + LED 心形背景 + 新人桌 + 乐队 */
  { const st = new MB(), ch = new MB(), bd = new MB(), hb = new MB(), fl = new MB();
    st.box(-14, 0, -26, 14, 1.0, -17, [.97, .94, .88], [4, 4]); st.box(-14.4, 1.0, -26, 14.4, 1.12, -16.7, GOLD); for (let k = 0; k < 3; k++) st.box(-6 - k * .5, 0, -17 + k * .5, 6 + k * .5, .3 * (3 - k), -16.5 + k * .5, [.96, .92, .86], [4, 4]);
    hb.quad([-10, 1.1, -26.3], [10, 1.1, -26.3], [10, 14, -26.3], [-10, 14, -26.3], [0, 0, 1], [0, 1, 1, 0], WHITE); add(hb, { tex: X.heart.tex, em: X.heart.em, emDay: .3, emNight: 1.7 });
    for (let k = 0; k < 9; k++) [-1, 1].forEach(sg => fl.sphere(sg * (11.6 + (k % 2) * .5), 1.4 + k * 1.3, -25.8, .62, .55, .5, k % 2 ? ROSE : [1, .96, .96], 5)); add(fl, {});
    st.cyl(0, -21.5, 1.0, 1.75, .8, .8, 14, WHITE); st.cyl(0, -21.5, 1.75, 1.8, .9, .9, 14, WHITE); st.sphere(0, 2.2, -21.5, .26, .26, .26, ROSE, 5); st.cyl(0.3, -21.2, 1.8, 2.1, .05, .05, 5, [1, .95, .8]); hl(.3, 2.2, -21.2, 1.4, [1, .85, .55]);
    [-1.7, 1.7].forEach(x => { chairMB(ch, x, -21.5, x < 0 ? PI / 2 : -PI / 2, [1, .96, .9], ROSE); seat(x, -21.5, x < 0 ? PI / 2 : -PI / 2, 1.46, [x, -16.2]); });
    st.cyl(-11, -21.5, 1.0, 1.7, .62, .62, 12, [.85, .2, .25]); st.cyl(-12, -21, 1.0, 1.8, .32, .32, 10, [.85, .2, .25]); st.cyl(-10, -21, 1.0, 1.8, .32, .32, 10, [.85, .2, .25]); st.box(9.4, 1.0, -22.5, 12.6, 1.8, -20.7, [.12, .12, .16]); st.box(9.6, 1.8, -22.3, 12.4, 1.86, -20.9, [.95, .95, .98]);
    [-7, 7].forEach(x => { st.cyl(x, -19.6, 1.0, 2.6, .04, .04, 5, [.15, .15, .18]); st.sphere(x, 2.7, -19.6, .1, .12, .1, [.2, .2, .24], 5); st.box(x * 1.55 - .6, 1.0, -24.4, x * 1.55 + .6, 3.2, -23.4, [.1, .1, .14]); });
    add(st, { tex: X.marble }); add(ch, {}); obs(-14, -26, 14, -17); }
  /* 16 张圆桌 (每桌 8 把椅) */
  { const cl = new MB(), ch = new MB(), tb = (x, z) => { cl.cyl(x, z, 0, .78, 1.32, 1.32, 20, WHITE); cl.cyl(x, z, .78, .8, 1.36, 1.36, 20, [1, .98, .95]); cl.cyl(x, z, .8, 1.3, .07, .07, 6, GOLD); cl.sphere(x, 1.45, z, .34, .28, .34, ROSE, 6); cl.sphere(x + .24, 1.38, z + .1, .24, .2, .24, [1, .96, .96], 6); hl(x, 1.7, z, 2.4, [1, .78, .86], .5);
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .2, cx = x + Math.cos(a) * 1.95, cz = z + Math.sin(a) * 1.95, yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); chairMB(ch, cx, cz, yaw, [1, .97, .93], k % 2 ? ROSE : [.92, .85, .6]); seat(cx, cz, yaw, .46, [x + Math.cos(a) * 2.75, z + Math.sin(a) * 2.75]); } obs(x - 1.4, z - 1.4, x + 1.4, z + 1.4); };
    [-8, 0, 8, 16].forEach(z => [-25, -18.5, 18.5, 25].forEach(x => { if (Math.abs(z) < 1 && Math.abs(x) < 20 && false) return; tb(x, z); })); add(cl, { tex: X.cloth }); add(ch, {}); }
  /* 蛋糕 / 香槟塔 / 礼金台 / 自助盛宴 / 拍照墙 */
  { const ck = new MB(), g0 = new MB(), gf = new MB(), bf = new MB(), pb = new MB(), fl = new MB();
    ck.cyl(0, 15.5, 0, .95, 2.1, 2.1, 20, [.96, .93, .88]); [[1.9, 1.0], [1.5, 1.05], [1.15, 1.1], [.8, 1.15], [.5, 1.2]].forEach(([r, h], i) => { const y0 = .95 + [0, 1.0, 2.05, 3.15, 4.3][i]; ck.cyl(0, 15.5, y0, y0 + h, r, r, 20, [1, .96, .95]); ck.cyl(0, 15.5, y0 + h - .08, y0 + h, r + .08, r + .08, 20, ROSE); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ck.sphere(Math.cos(a) * r, y0 + h * .5, 15.5 + Math.sin(a) * r, .13, .13, .13, k % 2 ? ROSE : [1, 1, 1], 4); } }); ck.sphere(0, 6.0, 15.5, .26, .34, .26, [1, .5, .65], 5); obs(-2.2, 13.3, 2.2, 17.7); hl(0, 3.4, 15.5, 6, [1, .85, .85], .5);
    g0.cyl(11, 15.5, 0, .95, 1.7, 1.7, 16, [.96, .93, .88]); for (let lv = 0; lv < 6; lv++) { const n = 6 - lv, y = 1.05 + lv * .52; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { const x = 11 + (a - (n - 1) / 2) * .5, z = 15.5 + (b - (n - 1) / 2) * .5; g0.cyl(x, z, y, y + .22, .04, .16, 8, [.9, .96, 1]); g0.sphere(x, y + .24, z, .12, .06, .12, [1, .9, .55], 4); } } obs(9.3, 13.8, 12.7, 17.2); add(g0, { em: solid(255, 214, 120), emDay: .05, emNight: .8 }); hl(11, 2.4, 15.5, 4.6, [1, .9, .6], .5);
    gf.box(-12.6, 0, 14, -9.4, .9, 17, [1, .98, .94], [3, 3]); for (let k = 0; k < 6; k++) gf.box(-12 + (k % 3) * .9, .9, 14.4 + Math.floor(k / 3) * 1.3, -11.2 + (k % 3) * .9, 1.35, 15.2 + Math.floor(k / 3) * 1.3, k % 2 ? [.9, .3, .4] : GOLD); obs(-12.6, 14, -9.4, 17); add(gf, { tex: X.cloth });
    bf.box(-31.2, 0, -14, -28.8, .9, 18, [1, .98, .94], [3, 3]); for (let k = 0; k < 28; k++) { const z = -13 + k * 1.1, c = [[1, .4, .45], [1, .8, .35], [.6, .85, .4], [1, .6, .8], [.95, .95, .95]][k % 5]; bf.sphere(-30, 1.05, z, .3, .22, .3, c, 5); bf.sphere(-29.4, 1.0, z + .3, .22, .18, .22, c.map(v => v * .85), 5); } obs(-31.2, -14, -28.8, 18); add(bf, { tex: X.cloth });
    // 拍照墙 (花墙 + 爱心)
    for (let k = 0; k < 8; k++) for (let j = 0; j < 6; j++) fl.sphere(30.6, .9 + j * 1.3, -16 + k * 1.15, .5, .5, .5, (k + j) % 2 ? ROSE : [1, .96, .96], 5); const hq = new MB(); hq.quad([31.4, 2.6, -13.5], [31.4, 2.6, -8.5], [31.4, 7.6, -8.5], [31.4, 7.6, -13.5], [-1, 0, 0], [0, 1, 1, 0], WHITE); add(hq, { tex: X.heart.tex, em: X.heart.em, emDay: .3, emNight: 1.5 }); add(fl, {});
    pb.box(29.6, 0, -17, 31.4, 7.6, -7.6, [.96, .92, .86]); add(pb, { tex: X.stone }); obs(29.6, -17, 31.6, -7.6); }
  /* 大门 (南墙, 遮挡时淡出) + 西侧门 */
  occ(() => { const w = new MB(), d = new MB(); w.box(-33, 0, 26, 33, 18, 27, IVORY, [6, 6]); ptRing(w, 0, 10, 25.7, 26.1, 6.4, 1.3, GOLD); d.quad([-3.2, 0, 25.6], [3.2, 0, 25.6], [3.2, 12.5, 25.6], [-3.2, 12.5, 25.6], [0, 0, -1], [0, 0, 1, 1], WHITE); add(d, { tex: X.door }); add(w, { tex: X.stone }); });
  { const sd = new MB(); sd.quad([-31.8, 0, -4.2], [-31.8, 0, .4], [-31.8, 7.4, .4], [-31.8, 7.4, -4.2], [1, 0, 0], [0, 0, 1, 1], WHITE); add(sd, { tex: X.door }); }
  /* 动态: 彩灯光束 / 彩带 / 舞池彩格 / 冷焰火 */
  S.spark = 0; S.confetti = 0;
  const dot = (m, x, y, z, w, h, col, p) => { const pp = p == null ? .6 : p, c = Math.cos(pp), s = Math.sin(pp), hy = h * c, hz = h * s; m.quad([x - w, y - hy * .5, z + hz * .5], [x + w, y - hy * .5, z + hz * .5], [x + w, y + hy * .5, z - hz * .5], [x - w, y + hy * .5, z - hz * .5], [0, 1, 0], [0, 0, 1, 1], col); };
  S.dyn = (fx, t, g, env) => { const sk = fx.spark, sp = fx.spray;
    for (let i = 0; i < 50; i++) { const ph = fr(t * .04 + i * .618), x = -28 + 56 * fr(i * .7548), z = -22 + 44 * fr(i * .5698), y = 2 + ph * 14; dot(sk, x + Math.sin(t * .4 + i) * 1.2, y, z, .09, .09, [1, .9, .7]); }
    for (let k = 0; k < 6; k++) { const a = t * .6 + k * 1.05, cx = Math.cos(a) * 9, cz = -2 + Math.sin(a) * 7, col = [[1, .4, .6], [.5, .8, 1], [1, .9, .4], [.7, .5, 1], [.5, 1, .7], [1, .6, .4]][k]; for (let j = 0; j < 8; j++) dot(sk, cx * (j / 8), 17 - j * 2, -2 + (cz + 2) * (j / 8), .16, .16, col); }
    if (S.confetti > g.t) { const u = 1 - (S.confetti - g.t) / 5; for (let i = 0; i < 120; i++) { const a = i * 2.399, r = 3 + (i % 11) * 1.6, y = 16 - u * 16 + Math.sin(i) * 1.2 - (1 - u) * 0; dot(sp, Math.cos(a) * r, Math.max(.2, 16 - u * 15.5 - (i % 7) * .4), -2 + Math.sin(a * 1.3) * r * .7, .12, .08, [[1, .6, .7], [1, .9, .5], [.6, .85, 1], [1, 1, 1]][i % 4]); } }
    if (S.spark > g.t) { [-12, 12].forEach(x => { for (let i = 0; i < 40; i++) { const a = i * 2.399 + t * 8, r = fr(i * .37 + t * 3) * 1.8; dot(sk, x + Math.cos(a) * r * .4, 1.2 + r * 2.2, -19 + Math.sin(a) * r * .4, .1, .1, [1, .9, .55]); } }); }
    fx.glow = { spray: .9, beam: 0, spark: .9 }; };
  S.dynPool = (pm, g, env, t) => { const nt = env && env.night != null ? env.night : .5; for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 6; iz++) { const ph = (ix + iz) * .55 + t * 2.2, c = [.5 + .5 * Math.sin(ph), .5 + .5 * Math.sin(ph + 2.1), .5 + .5 * Math.sin(ph + 4.2)]; const cx = -9 + ix * 3, cz = -11 + iz * 3; if (Math.hypot(cx + 1.5, cz + 1.5 + 2) > 12) continue; pm.floor(cx + .15, cz + .15, cx + 2.85, cz + 2.85, .07, c.map(v => v * (.3 + .55 * Math.max(.4, nt)))); } };
  S.portals.push({ id: 'chapel', x: 0, z: 23, r: 2.4, label: '走出宴会厅', icon: '🚪', color: [1, .85, .6], spawn: [53, -3.2] });
  S.portals.push({ id: 'chapel_in', x: -29.6, z: -1.9, r: 2.2, label: '教堂大殿', icon: '⛪', color: [1, .85, .6], spawn: [13.2, -23.7] });
  const HS = (id, x, z, label, icon, col) => S.hotspots.push({ id, x, z, r: 2.1, label, icon, color: col });
  HS('cake', 0, 12.4, '切蛋糕', '🎂', [1, .7, .8]); HS('champagne', 11, 12.2, '香槟塔', '🥂', [1, .9, .55]); HS('dance', 0, -2, '舞池', '💃', [.9, .6, 1]); HS('toast', 0, -13.4, '新人敬酒', '🍷', [1, .6, .7]);
  HS('buffet', -27, 2, '自助盛宴', '🍽️', [1, .85, .55]); HS('gifts', -11, 12.4, '礼金台', '🎁', [1, .8, .5]); HS('photo', 28, -12, '花墙合影', '📸', [1, .6, .75]); HS('sparkler', -9, -14, '冷焰火', '🎇', [1, .9, .6]);
  S.onUse = (n, api) => { const G2 = api.G, me = G2.me, toast = api.toast, say = api.setBubble, act = (c, s) => { me.pose = s; me.actClip = c; };
    switch (n.id) {
      case 'cake': S.confetti = G2.t + 5; act('clap', 3.5); say(me, '🎂'); toast('🎂 新人切下第一刀蛋糕，彩带漫天飞舞！', 3400); return true;
      case 'champagne': act('cheer', 4); say(me, '🥂 干杯！'); toast('🥂 香槟塔倾泻而下，全场干杯！', 3000); return true;
      case 'dance': act('dance', 10); say(me, '💃 ♪'); return true;
      case 'toast': act('cheer', 3.6); say(me, '🍷 谢谢大家！'); toast('🍷 新人向宾客敬酒', 2800); return true;
      case 'buffet': if (api.pay(10, '🍽️ 享用了丰盛的婚宴自助 -10 金币', '好吃！')) act('clap', 2.6); return true;
      case 'gifts': toast('🎁 你送上了祝福红包（演示）', 2800); act('wave', 2.4); return true;
      case 'photo': act('cheer', 3.4); say(me, '📸'); toast('📸 花墙合影已保存（演示）', 2600); return true;
      case 'sparkler': S.spark = G2.t + 7; toast('🎇 点燃冷焰火！', 2600); act('cheer', 3); return true; }
    return false; };
  S.name = '星光教堂 · 宴会厅'; S.bounds = { x0: -31, x1: 31, z0: -25.2, z1: 25 }; S.spawn = [0, 21];
  S.camera = { dist: 22, pitch: .6, fov: .8, clampX: [-24, 24], clampZ: [-18, 17], lead: 3, ty: 0 }; S.cameraWide = { dist: 17, pitch: .3, fov: 1.15, clampX: [-24, 24], clampZ: [-18, 17], lead: 3 };
  S.npcRect = { x0: -14, x1: 14, z0: -12, z1: 20 }; S.heightAt = (x, z) => (z < -17 && Math.abs(x) < 14 ? 1.0 : 0); S.indoor = true;
  S.env = indoorEnv([.88, .76, .78], [.6, .46, .6], [.96, .86, .9], [.3, .18, .28]);
  add(gl, { tex: T.glow, mode: 2, glow: (e) => .3 + e.night * .55 });
  return S;
}

G.Scenes.makeChapel = makeChapel; G.Scenes.makeChapelIn = makeChapelIn; G.Scenes.makeChapelHall = makeChapelHall;
})(window);
