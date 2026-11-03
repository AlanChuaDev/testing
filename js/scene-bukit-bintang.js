/* scene-bukit-bintang.js — Bukit Bintang / Pavilion KL 广场 (独立场景文件, 注册为 Scenes.makeBukit)
   弧形商场 + 放射状排屋/小贩街 + 远处双子塔/KL塔天际线, 无方盒围墙. */
(function (G) {
'use strict';
const { MB, hex, clamp } = G.World;
const TAU = Math.PI * 2, PITCH = 0.5;
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const CX = 0, CZ = 4;                                   // 广场圆心
const polar = (r, th) => [CX + r * Math.sin(th), CZ - r * Math.cos(th)];   // th=0 朝后(商场), +th 朝右

/* ---------- 几何小工具 ---------- */
function halo(mb, x, y, z, s, col) { const c = Math.cos(PITCH), sn = Math.sin(PITCH); const P = (a, b) => [x + a * s, y + c * b * s, z - sn * b * s]; mb.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col); }
function pool(mb, x, z, r, col, y) { mb.floor(x - r, z - r, x + r, z + r, y == null ? .04 : y, col); }
function rbox(mb, cx, cz, w, d, y0, y1, yaw, col, tile, o) {          // 可旋转的盒子 (正面朝 local +z)
  o = o || {}; col = col || [1, 1, 1]; const c = Math.cos(yaw), s = Math.sin(yaw), hw = w / 2, hd = d / 2, tw = tile ? tile[0] : 1e9, th = tile ? tile[1] : 1e9, H = y1 - y0;
  const P = (lx, lz, y) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
  const F = (a, b, n, len) => mb.quad(P(a[0], a[1], y0), P(b[0], b[1], y0), P(b[0], b[1], y1), P(a[0], a[1], y1), n, [0, 0, len / tw, H / th], col);
  if (!o.noFront) F([-hw, hd], [hw, hd], [s, 0, c], w);
  if (!o.noBack) F([hw, -hd], [-hw, -hd], [-s, 0, -c], w);
  if (!o.noSides) { F([hw, hd], [hw, -hd], [c, 0, -s], d); F([-hw, -hd], [-hw, hd], [-c, 0, s], d); }
  if (!o.noTop) mb.quad(P(-hw, hd, y1), P(hw, hd, y1), P(hw, -hd, y1), P(-hw, -hd, y1), [0, 1, 0], [0, 0, w / tw, d / th], col);
}
function arcWall(mb, cx, cz, R, a0, a1, y0, y1, seg, tile, col) {      // 朝圆心的弧形墙
  let u = 0; const L = R * (a1 - a0) / seg; col = col || [1, 1, 1];
  for (let k = 0; k < seg; k++) { const A = a0 + (a1 - a0) * k / seg, B = a0 + (a1 - a0) * (k + 1) / seg, m = (A + B) / 2;
    mb.quad([cx + R * Math.sin(A), y0, cz - R * Math.cos(A)], [cx + R * Math.sin(B), y0, cz - R * Math.cos(B)], [cx + R * Math.sin(B), y1, cz - R * Math.cos(B)], [cx + R * Math.sin(A), y1, cz - R * Math.cos(A)], [-Math.sin(m), 0, Math.cos(m)], [u / tile[0], 0, (u + L) / tile[0], (y1 - y0) / tile[1]], col); u += L; }
}
function arcFloor(mb, cx, cz, R0, R1, a0, a1, y, seg, col) {
  for (let k = 0; k < seg; k++) { const A = a0 + (a1 - a0) * k / seg, B = a0 + (a1 - a0) * (k + 1) / seg;
    mb.quad([cx + R1 * Math.sin(A), y, cz - R1 * Math.cos(A)], [cx + R1 * Math.sin(B), y, cz - R1 * Math.cos(B)], [cx + R0 * Math.sin(B), y, cz - R0 * Math.cos(B)], [cx + R0 * Math.sin(A), y, cz - R0 * Math.cos(A)], [0, 1, 0], [0, 0, 1, 1], col); }
}
function star(mb, cx, cz, y0, y1, Ro, Ri, col, tile, cap) {            // 8角星截面柱 (双子塔)
  const n = 16, p = []; for (let k = 0; k < n; k++) { const a = k / n * TAU + Math.PI / 8, r = k % 2 ? Ri : Ro; p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  for (let k = 0; k < n; k++) { const A = p[k], B = p[(k + 1) % n], ex = B[0] - A[0], ez = B[1] - A[1], l = Math.hypot(ex, ez); let nx = ez / l, nz = -ex / l; if (nx * ((A[0] + B[0]) / 2 - cx) + nz * ((A[1] + B[1]) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
    mb.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], [nx, 0, nz], [k / n * tile[0], 0, (k + 1) / n * tile[0], (y1 - y0) / tile[1]], col); }
  if (cap) { const t = mb.vert([cx, y1, cz], [0, 1, 0], .5, .5, col), b0 = mb.n; for (let k = 0; k < n; k++) mb.vert([p[k][0], y1, p[k][1]], [0, 1, 0], .5, .5, col); for (let k = 0; k < n; k++) mb.i.push(t, b0 + k, b0 + (k + 1) % n); }
}
function tcyl(mb, a, b, r0, r1, seg, col) {                            // 倾斜圆柱 (棕榈树干)
  const base = mb.n; for (let k = 0; k <= seg; k++) { const an = k / seg * TAU, c = Math.cos(an), s = Math.sin(an);
    mb.vert([a[0] + c * r0, a[1], a[2] + s * r0], [c, 0, s], k / seg, 1, col); mb.vert([b[0] + c * r1, b[1], b[2] + s * r1], [c, 0, s], k / seg, 0, col); }
  for (let k = 0; k < seg; k++) { const i = base + k * 2; mb.i.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
}

function facet(mb, cx, cz, secs, c0, c1, seed) {                      // 逐层扭转的折面塔身: 每个侧面拆成两个三角形(平面着色), 形成斜向折痕
  const r = rnd(seed || 7), N = 8, ring = (sec) => { const [y, hw, rot] = sec, p = []; for (let k = 0; k < N; k++) { const a = rot + k * Math.PI / 4 + Math.PI / 8, c = Math.cos(a), s2 = Math.sin(a); p.push([cx + hw * Math.sign(c) * Math.sqrt(Math.abs(c)), y, cz + hw * Math.sign(s2) * Math.sqrt(Math.abs(s2))]); } return p; };
  const tri = (A, B, C, u, col) => { const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]; let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(v => v / l);
    const gx = (A[0] + B[0] + C[0]) / 3 - cx, gz = (A[2] + B[2] + C[2]) / 3 - cz; if (n[0] * gx + n[2] * gz < 0) n = n.map(v => -v);
    const i0 = mb.vert(A, n, u[0], A[1] / 8, col), i1 = mb.vert(B, n, u[1], B[1] / 8, col), i2 = mb.vert(C, n, u[2], C[1] / 8, col); mb.i.push(i0, i1, i2); };
  const top = secs[secs.length - 1][0];
  for (let q = 0; q + 1 < secs.length; q++) { const R0 = ring(secs[q]), R1 = ring(secs[q + 1]), t = (secs[q][0] + secs[q + 1][0]) / 2 / top;
    for (let k = 0; k < N; k++) { const k2 = (k + 1) % N, A0 = R0[k], B0 = R0[k2], A1 = R1[k], B1 = R1[k2], base = c0.map((v, i) => v + (c1[i] - v) * t), sh = () => { const m = .55 + r() * 1.05; return base.map(v => Math.min(1, v * m)); };
      tri(A0, B0, B1, [0, 1, 1], sh()); tri(A0, B1, A1, [0, 1, 0], sh()); } }
  const last = ring(secs[secs.length - 1]), ap = [cx + secs[secs.length - 1][1] * .3, top + 3.2, cz];                 // 斜切塔冠
  for (let k = 0; k < N; k++) tri(last[k], last[(k + 1) % N], ap, [0, 1, .5], c1.map(v => Math.min(1, v * (.9 + r() * .3))));
  return ap;
}
/* ---------- 程序化贴图 ---------- */
function makeTex(R, T) {
  const X = {}, P = (w, h, fn, o) => R.paint(w, h, fn, o);
  const dual = (w, h, fn, o) => ({ tex: P(w, h, (g) => fn(g, false), o), em: P(w, h, (g) => fn(g, true), o) });
  const arch = (g, x0, y0, x1, y1) => { const r = (x1 - x0) / 2; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0 + r); g.arc(x0 + r, y0 + r, r, Math.PI, 0); g.lineTo(x1, y1); g.closePath(); };
  X.side = P(256, 256, (g) => { const r = rnd(3); g.fillStyle = '#a89c8c'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 10 * (r() - .5); g.fillStyle = `rgb(${196 + v},${182 + v},${164 + v})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } });
  X.plaza = P(512, 512, (g) => {                                      // 广场地砖: 同心环 + 伊斯兰八角星
    const c = 256, ring = (r, col) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill(); };
    ring(256, '#5e5a6e'); ring(248, '#e6d7b4'); ring(224, '#9a4a52'); ring(217, '#e6d7b4'); ring(186, '#cdb78c'); ring(150, '#2f7280'); ring(143, '#eadfc4'); ring(112, '#d8c49c');
    g.strokeStyle = 'rgba(90,70,40,.35)'; g.lineWidth = 2; for (let k = 0; k < 72; k++) { const a = k / 72 * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * 186, c + Math.sin(a) * 186); g.lineTo(c + Math.cos(a) * 217, c + Math.sin(a) * 217); g.stroke(); }
    for (let k = 0; k < 32; k++) { const a = k / 32 * TAU, x = c + Math.cos(a) * 168, y = c + Math.sin(a) * 168; g.fillStyle = k % 2 ? '#e6b84f' : '#9a4a52'; g.save(); g.translate(x, y); g.rotate(a + Math.PI / 4); g.fillRect(-7, -7, 14, 14); g.restore(); }
    const st = (R0, R1, rot, fill, stroke) => { g.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + rot, r = k % 2 ? R1 : R0; g[k ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 4; g.stroke(); };
    st(108, 62, 0, '#2f7280', '#e6b84f'); st(78, 44, Math.PI / 8, '#eadfc4', '#9a4a52'); ring(34, '#9a4a52'); ring(26, '#e6b84f');
  });
  X.mall = dual(512, 512, (g, em) => {                                // 商场正面: 石柱 + 大玻璃
    const bay = 128; if (!em) { g.fillStyle = '#e9ddc6'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#8c8272'; g.fillRect(0, 484, 512, 28); g.fillStyle = '#d4c7ac'; g.fillRect(0, 108, 512, 26); g.fillRect(0, 0, 512, 34); } else { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#7ee8ff'; g.fillRect(0, 28, 512, 5); }
    const r = rnd(21);
    for (let i = 0; i < 4; i++) { const x = i * bay + 18, w = bay - 36;
      if (!em) { let gr = g.createLinearGradient(x, 134, x + w, 480); gr.addColorStop(0, '#3f8aa0'); gr.addColorStop(1, '#16405c'); g.fillStyle = gr; g.fillRect(x, 134, w, 346); g.fillStyle = '#1a4a66'; g.fillRect(x, 40, w, 66); g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(x, 480); g.lineTo(x + w * .7, 134); g.lineTo(x + w * .95, 134); g.lineTo(x + w * .25, 480); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + w / 2 - 1, 134, 2, 346); }
      else { const gr = g.createLinearGradient(0, 134, 0, 480); gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(1, '#ff9e70'); g.fillStyle = gr; g.globalAlpha = .88; g.fillRect(x, 134, w, 346); g.globalAlpha = 1;
        for (let k = 0; k < 4; k++) { g.fillStyle = ['#fff3d6', '#ffb3d8', '#bfe8ff', '#ffe08a'][(r() * 4) | 0]; g.globalAlpha = .75; g.fillRect(x + 6 + r() * 20, 200 + k * 62, 30 + r() * 40, 38); g.globalAlpha = 1; }
        g.fillStyle = '#9fe8ff'; g.globalAlpha = .8; g.fillRect(x, 40, w, 66); g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(x + w / 2 - 1, 134, 2, 346); } }
  });
  X.tier = dual(512, 256, (g, em) => {                                // 上层: 竖鳍 + 玻璃
    if (!em) { g.fillStyle = '#2d6f86'; g.fillRect(0, 0, 512, 256); for (let k = 0; k < 24; k++) { g.fillStyle = '#f3ecdc'; g.fillRect(k * 21.3, 0, 7, 256); } g.fillStyle = 'rgba(255,255,255,.18)'; for (let j = 0; j < 4; j++) g.fillRect(0, j * 64 + 58, 512, 6); }
    else { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256); const r = rnd(8); for (let j = 0; j < 4; j++) for (let k = 0; k < 24; k++) { if (r() < .28) continue; g.fillStyle = ['#ffe3a8', '#ffcf8a', '#c8f1ff'][(r() * 3) | 0]; g.fillRect(k * 21.3 + 8, j * 64 + 8, 13, 46); } }
  });
  X.door = dual(256, 256, (g, em) => {                                // 大门玻璃
    if (!em) { g.fillStyle = '#16384f'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#e8edf5'; for (let i = 0; i <= 4; i++) g.fillRect(i * 64 - 3, 0, 6, 256); g.fillRect(0, 0, 256, 8); g.fillRect(0, 100, 256, 5); }
    else { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffe6b0'); gr.addColorStop(1, '#ffb070'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.fillStyle = '#000'; for (let i = 0; i <= 4; i++) g.fillRect(i * 64 - 3, 0, 6, 256); g.fillRect(0, 100, 256, 5); }
  });
  X.shop = (seed, wall, shut) => dual(256, 512, (g, em) => {          // 马来西亚排屋 (五脚基 + 百叶窗)
    const r = rnd(seed); g.fillStyle = em ? '#000' : wall; g.fillRect(0, 0, 256, 512);
    if (!em) { g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0, 0, 256, 46); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, 46, 256, 6); for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(26 + i * 51, 28, 14, Math.PI, 0); g.fill(); } g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(0, 306, 256, 8); }
    [[74, 176], [196, 298]].forEach(([y0, y1]) => [[30, 100], [156, 226]].forEach(([x0, x1]) => { arch(g, x0, y0, x1, y1);
      if (em) { if (r() < .6) { g.fillStyle = ['#ffd98a', '#ffc766', '#ffe9b8'][(r() * 3) | 0]; g.fill(); g.fillStyle = '#000'; g.fillRect(x0 + (x1 - x0) / 2 - 1, y0, 2, y1 - y0); } }
      else { g.fillStyle = '#f6f1e4'; g.fill(); const m = 6; arch(g, x0 + m, y0 + m, x1 - m, y1 - m); g.fillStyle = '#1c2236'; g.fill(); g.fillStyle = shut; g.fillRect(x0 + m, y0 + 28, 15, y1 - y0 - 28 - m); g.fillRect(x1 - m - 15, y0 + 28, 15, y1 - y0 - 28 - m); g.fillStyle = 'rgba(0,0,0,.25)'; for (let l = y0 + 34; l < y1 - 10; l += 7) { g.fillRect(x0 + m, l, 15, 2); g.fillRect(x1 - m - 15, l, 15, 2); } } }));
    g.fillStyle = em ? '#000' : shut; g.fillRect(0, 320, 256, 36);
    if (em) { g.fillStyle = '#ffdca0'; g.fillRect(10, 326, 236, 24); }
    [[20, 120], [138, 236]].forEach(([x0, x1]) => { arch(g, x0, 372, x1, 512); if (em) { const gr = g.createLinearGradient(0, 372, 0, 512); gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(1, '#ff9e60'); g.fillStyle = gr; g.fill(); } else { g.fillStyle = '#2a1f26'; g.fill(); g.strokeStyle = '#f6f1e4'; g.lineWidth = 7; g.stroke(); } });
    g.fillStyle = em ? '#000' : '#f6f1e4'; g.fillRect(118, 360, 22, 152);
  });
  X.tower = dual(256, 256, (g, em) => {                               // 双子塔不锈钢幕墙
    if (!em) { const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#9aa7bd'); gr.addColorStop(.5, '#dfe6f2'); gr.addColorStop(1, '#8794ac'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(30,50,90,.55)'; for (let j = 0; j < 16; j++) g.fillRect(0, j * 16 + 4, 256, 8); }
    else { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); const r = rnd(14); for (let j = 0; j < 16; j++) for (let k = 0; k < 8; k++) { if (r() < .35) continue; g.fillStyle = r() < .8 ? '#ffe2a8' : '#cfeaff'; g.fillRect(k * 32 + 3, j * 16 + 4, 26, 8); } }
  });
  X.diamond = dual(512, 512, (g, em) => {
    if (!em) { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#d6eaf8'); gr.addColorStop(1, '#6f95bb'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); } else { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); }
    g.strokeStyle = em ? '#9fd8ff' : 'rgba(255,255,255,.8)'; g.lineWidth = em ? 2 : 3;
    for (let i = -30; i < 30; i++) { g.beginPath(); g.moveTo(i * 22, 0); g.lineTo(i * 22 + 300, 512); g.stroke(); g.beginPath(); g.moveTo(i * 22 + 300, 0); g.lineTo(i * 22, 512); g.stroke(); }
  });
  X.klshaft = dual(256, 512, (g, em) => {
    if (!em) { const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#b9bac6'); gr.addColorStop(.35, '#f2f2f8'); gr.addColorStop(.7, '#e2e3ec'); gr.addColorStop(1, '#a9abba'); g.fillStyle = gr; g.fillRect(0, 0, 256, 512); }
    else { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 512); g.fillStyle = '#ff3550'; g.fillRect(150, 262, 62, 64); g.fillRect(150, 372, 62, 98); g.fillStyle = '#ff8a9a'; g.fillRect(172, 262, 8, 64); g.fillRect(172, 372, 8, 98); }
  });
  X.glass = P(256, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dfe8f4'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(20,40,80,.28)'; for (let y = 0; y < 256; y += 10) g.fillRect(0, y, 256, 2); g.fillStyle = 'rgba(255,255,255,.16)'; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 3, 256); });
  X.awn = P(64, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f6efe2' : '#d8362f'; g.fillRect(i * 8, 0, 8, 64); } });
  X.awn2 = P(64, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f6efe2' : '#1f8a5b'; g.fillRect(i * 8, 0, 8, 64); } });
  X.board = dual(512, 320, (g, em) => {                               // 合影看板
    g.fillStyle = em ? '#000' : '#fff4e0'; g.fillRect(0, 0, 512, 320); g.strokeStyle = em ? '#ffb347' : '#e0452f'; g.lineWidth = 14; g.strokeRect(10, 10, 492, 300);
    const tw = (x, c) => { g.fillStyle = c; g.fillRect(x, 70, 30, 150); g.fillRect(x + 8, 40, 14, 40); g.fillRect(x + 12, 20, 6, 24); };
    tw(350, em ? '#ffd27a' : '#9fb0cc'); tw(404, em ? '#ffd27a' : '#9fb0cc'); g.fillStyle = em ? '#ffd27a' : '#9fb0cc'; g.fillRect(380, 120, 24, 10);
    g.font = '800 92px "Arial Black",Arial,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = em ? '#ff6a7a' : '#e0452f'; g.fillText('I ♥ KL', 40, 100);
    g.font = '700 38px "PingFang SC","Noto Sans SC",sans-serif'; g.fillStyle = em ? '#ffe7b0' : '#4a3a30'; g.fillText('吉隆坡 · 合影点', 40, 200); g.font = '600 26px Arial'; g.fillText('Selamat Datang!', 40, 252);
  }, { clamp: true });
  X.led = dual(512, 256, (g, em) => {                                 // 商场 LED 大屏
    const gr = g.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, '#ff4f9a'); gr.addColorStop(.5, '#7a4cff'); gr.addColorStop(1, '#ffb13b'); g.fillStyle = em ? gr : '#120d24'; g.fillRect(0, 0, 512, 256); g.fillStyle = em ? 'rgba(0,0,0,.2)' : '#000'; g.fillRect(0, 0, 512, 256);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.shadowColor = '#ffd0f0'; g.shadowBlur = 0; g.font = '800 78px "Arial Black",Arial,sans-serif'; g.fillText('SALE 70%', 256, 92); g.font = '700 44px "PingFang SC","Noto Sans SC",sans-serif'; g.shadowBlur = 0; g.fillText('武吉免登 · 年终大促', 256, 182);
  }, { clamp: true });
  return X;
}

/* =====================================================================
   BUKIT BINTANG PAVILION PLAZA
   ===================================================================== */
function makeBukit(R, T) {
  R.gl.bindVertexArray(null);   // 防止创建网格时误改当前绑定的 VAO（如角色模型）
  const X = makeTex(R, T), S = { batches: [], obstacles: [], portals: [], hotspots: [], lamps: [] };
  const bbOf = (mb) => { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (let k = 0; k < mb.v.length; k += 11) for (let j = 0; j < 3; j++) { const v = mb.v[k + j]; if (v < a[j]) a[j] = v; if (v > b[j]) b[j] = v; } return [a, b]; };
  const add = (mb, mat) => { if (mb.i.length) { const b = R.batch(mb, mat); b.bb = bbOf(mb); S.batches.push(b); return b; } };
  S.occluders = []; S.tw = [];                                        // S.tw: 夜晚闪烁的灯串批次
  const addTw = (mb, hexc, ph, f) => { const b = add(mb, emS(hexc, .9, 1.9)); if (b) S.tw.push({ b, ph, f }); };                                                   // 会挡住人物的物体: 人物被挡时自动变半透明(只留10%)
  const occ0 = () => S.batches.length;
  const occ1 = (n0) => { const bs = S.batches.slice(n0).filter(b => b.bb && b.mat.mode === 0); if (!bs.length) return; const a = [1e9, 1e9, 1e9], c = [-1e9, -1e9, -1e9]; bs.forEach(b => { for (let j = 0; j < 3; j++) { a[j] = Math.min(a[j], b.bb[0][j]); c[j] = Math.max(c[j], b.bb[1][j]); } }); S.occluders.push({ bs, a, b: c, f: 1 }); };
  const occ = (fn) => { const n0 = occ0(); fn(); occ1(n0); };
  const obs = (a, b, c, d) => S.obstacles.push({ x0: a, z0: b, x1: c, z1: d });
  const solid = (r, g, b) => R.solidTex([r, g, b, 255]);
  const emS = (hx, d, n) => { const c = hex(hx); return { em: solid(c[0] * 255, c[1] * 255, c[2] * 255), emDay: d, emNight: n }; };
  const obsRot = (cx, cz, w, d, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw), n = Math.max(1, Math.ceil(w / 1.8)), hx = Math.abs(c) * (w / n / 2 + .3) + Math.abs(s) * d / 2, hz = Math.abs(s) * (w / n / 2 + .3) + Math.abs(c) * d / 2;
    for (let k = 0; k < n; k++) { const lx = -w / 2 + (k + .5) * w / n, x = cx + lx * c, z = cz - lx * s; obs(x - hx, z - hz, x + hx, z + hz); } };
  const plain = new MB(), awn = new MB(), awn2 = new MB(), bulbs = new MB(), glow = new MB(), leaf = new MB(), steam = new MB(), bulbG = [0, 1, 2, 3, 4, 5].map(() => new MB());
  const signAt = (text, o, cx, cz, yaw, y0, y1, w, dn, nn) => { const sg = T.sign(text, o), mb = new MB(); rbox(mb, cx, cz, w, .2, y0, y1, yaw, [1, 1, 1], [w, y1 - y0], { noBack: true, noSides: true, noTop: true }); add(mb, { tex: sg.tex, em: sg.em, emDay: dn == null ? .6 : dn, emNight: nn == null ? 1.7 : nn }); };

  /* ---- 地面 ---- */
  { const mb = new MB(); mb.floor(-170, -150, 170, 120, 0, [.86, .78, .7], [0, 0, 340 / 8, 270 / 8]); add(mb, { tex: X.side }); }
  { const mb = new MB(); mb.floor(-170, 27, 170, 41, .012, [.15, .15, .19]); for (let x = -120; x < 120; x += 6) mb.floor(x, 33.8, x + 3, 34.2, .02, [.95, .85, .4]); mb.floor(-170, 26.2, 170, 27, .02, [.8, .8, .85]); mb.floor(-170, 41, 170, 41.8, .02, [.8, .8, .85]);
    for (let k = -6; k <= 6; k++) mb.floor(k * 1.3 - .45, 27.2, k * 1.3 + .45, 40.8, .022, [.93, .93, .95]); add(mb, {}); }        // 马路 + 斑马线
  { const mb = new MB(); mb.disc(CX, CZ, .03, 19, 72, [1, 1, 1]); add(mb, { tex: X.plaza });
    const cb = new MB(); cb.cyl(CX, CZ, 0, .14, 19.35, 19.35, 72, [.78, .72, .62]); cb.disc(CX, CZ, .14, 19.35, 72, [.84, .78, .68], 19); add(cb, {});
    const gr = new MB(); [[-15, 25.5, 4.6], [15, 25.5, 4.6], [-29, 14, 4.4], [29, 14, 4.4], [-8, 30, 0]].forEach(([x, z, r]) => { if (r) { gr.disc(x, z, .05, r, 28, [.36, .66, .38]); gr.disc(x, z, .07, r * .72, 24, [.42, .74, .42]); } }); add(gr, {}); }

  /* ---- Pavilion 商场 (弧形, 三层退台) ---- */
  const MCx = 0, MCz = 14, A = .95;
  { const mb = new MB(); arcWall(mb, MCx, MCz, 32, -A, A, 0, 8, 40, [12, 8]); add(mb, { tex: X.mall.tex, em: X.mall.em, emDay: .3, emNight: .95 });
    const t2 = new MB(); arcWall(t2, MCx, MCz, 35.5, -A, A, 8, 11.2, 36, [12, 3.2]); add(t2, { tex: X.tier.tex, em: X.tier.em, emDay: .2, emNight: 1.0 });
    const rf = new MB(); arcFloor(rf, MCx, MCz, 32, 35.5, -A, A, 8, 36, [.62, .6, .58]); arcFloor(rf, MCx, MCz, 35.5, 52, -A, A, 11.2, 36, [.5, .5, .55]); add(rf, {});
    const ed = new MB(); for (const [R0, y] of [[32, 8], [35.5, 11.2]]) { arcWall(ed, MCx, MCz, R0 - .05, -A, A, y, y + .35, 40, [1e3, 1e3], [.95, .93, .88]); } add(ed, {});
    const neon = new MB(); for (const [R0, y] of [[31.9, 7.6], [35.4, 10.8]]) arcWall(neon, MCx, MCz, R0, -A, A, y, y + .12, 40, [1e3, 1e3], [.1, .1, .1]); add(neon, emS('#7ee8ff', .6, 1.6));
    for (let a = -A; a < A; a += .07) { const p = [MCx + 32.6 * Math.sin(a), MCz - 32.6 * Math.cos(a)]; obs(p[0] - 1.5, p[1] - 5, p[0] + 1.5, p[1] + .4); }
    // 大门 + 雨棚 (porte-cochère)
    const d = new MB(); d.quad([-6, 0, -17.35], [6, 0, -17.35], [6, 5.2, -17.35], [-6, 5.2, -17.35], [0, 0, 1], [0, 0, 3, 1], [1, 1, 1]); add(d, { tex: X.door.tex, em: X.door.em, emDay: .5, emNight: 1.0 });
    const nC = occ0();
    const ca = new MB(); ca.box(-7.2, 4.35, -17.4, 7.2, 5.75, -11.8, [.1, .08, .06]); [-6.6, -2.2, 2.2, 6.6].forEach(x => ca.cyl(x, -12.3, 0, 5.2, .32, .32, 12, [.93, .9, .83])); add(ca, {});
    const cl = new MB(); cl.box(-7.25, 5.65, -17.45, 7.25, 5.8, -11.75, [.1, .1, .1]); add(cl, emS('#ffd27a', .7, 1.5));
    signAt('PAVILION KUALA LUMPUR', { w: 1536, h: 150, fs: 100, bg: '#2a1a0a', fg: '#ffe9b8', border: '#e6b84f' }, 0, -11.79, 0, 4.42, 5.68, 14.2, .8, 1.25); occ1(nC);
    const cc = new MB(); [-6.6, -2.2, 2.2, 6.6].forEach(x => obs(x - .5, -12.8, x + .5, -11.8)); S.portals.push({ id: 'pavilion', x: 0, z: -14.2, r: 2.6, label: 'Pavilion KL · 商场', color: [1, .8, .4] });
    signAt('→ KLCC 人行天桥', { w: 512, h: 110, fs: 46, bg: '#12304a', fg: '#e6f6ff', border: '#5cc8ff' }, -11.2, -16.0, 0, 2.3, 3.7, 4.6, .6, 1.2); S.hotspots.push({ id: 'skybridge', x: -11.2, z: -13.2, r: 1.9, label: '人行天桥 · 往 KLCC', icon: '🌉', color: [.5, .8, 1] });
    const g1 = new MB(); pool(g1, 0, -13.5, 8, [1, .8, .5]); halo(g1, 0, 3, -17, 9, [1, .85, .55]); add(g1, { tex: T.glow, mode: 2, glow: e => .15 + e.night * .6 });
    const rc = new MB(); rc.floor(-5.5, -17.3, 5.5, -9.5, .05, [.7, .1, .16]); add(rc, {});
    // 招牌 + LED 屏 (弧形)
    const sg = T.sign('PAVILION KUALA LUMPUR', { w: 1024, h: 150, fs: 62, bg: '#2a1a0a', fg: '#ffe9b8', border: '#e6b84f' }), sb = new MB(); /* 招牌已移到雨棚横梁 */
    const lb = new MB(); arcWall(lb, MCx, MCz, 31.9, .42, .66, 1.8, 6.6, 8, [31.9 * .24, 4.8]); add(lb, { tex: X.led.tex, em: X.led.em, emDay: .45, emNight: .6 });
    const lb2 = new MB(); arcWall(lb2, MCx, MCz, 31.9, -.66, -.42, 1.8, 6.6, 8, [31.9 * .24, 4.8]); add(lb2, { tex: X.led.tex, em: X.led.em, emDay: .45, emNight: .6 });
    // 两端圆柱角楼
    [-1, 1].forEach(sd => occ(() => { const cx = sd * 27.6, cz = -2.7, m = new MB(); m.cyl(cx, cz, 0, 12.4, 3.8, 3.5, 28, [1, 1, 1], true); add(m, { tex: X.tier.tex, em: X.tier.em, emDay: .2, emNight: 1.0 }); const r2 = new MB(); r2.cyl(cx, cz, 12.4, 13, 4, 4, 28, [.9, .88, .84], true); add(r2, {}); obs(cx - 3.9, cz - 3.9, cx + 3.9, cz + 3.9); }));
  }

  /* ---- 吉隆坡天际线 (远景, 不可走): 双子塔 / KL Tower / Merdeka 118 / Exchange 106, 彼此拉开 ---- */
  {
    const gl = new MB();
    const beam = (mb, x0, y0, x1, y1, z, t, col) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * t / 2, ny = dx / l * t / 2;
      [[z + .55, 1], [z - .55, -1]].forEach(([zz, sg]) => mb.quad([x0 - nx, y0 - ny, zz], [x1 - nx, y1 - ny, zz], [x1 + nx, y1 + ny, zz], [x0 + nx, y0 + ny, zz], [0, 0, sg], [0, 0, 1, 1], col)); };
    const tw = new MB(), cap = new MB(), TZ = -112, TX = [35, 49];
    const tiers = [[0, 17, 2.7, 1.9], [17, 27, 2.45, 1.75], [27, 36, 2.1, 1.5], [36, 44, 1.7, 1.22], [44, 51, 1.3, .95], [51, 56, .9, .66], [56, 58.5, .6, .42]];
    TX.forEach(x => { tiers.forEach(([y0, y1, ro, ri]) => star(tw, x, TZ, y0, y1, ro * 1.4, ri * 1.4, [1, 1, 1], [4, 6], y1 === 58.5)); cap.cyl(x, TZ, 58.5, 66, .24, .04, 8, [.9, .92, 1]); halo(gl, x, 60, TZ + 1, 9, [1, .95, .8]); halo(gl, x, 16, TZ + 4, 15, [.5, .7, 1]); });
    tw.box(37.8, 31, TZ - 1.4, 46.2, 34.2, TZ + 1.4, [.8, .86, .95], [2, 2]); beam(tw, 38.5, 22, 42, 31, TZ, .7, [.78, .84, .94]); beam(tw, 45.5, 22, 42, 31, TZ, .7, [.78, .84, .94]);
    add(tw, { tex: X.tower.tex, em: X.tower.em, emDay: .4, emNight: 1.2 }); add(cap, {});
    // KL Tower (按参考照片): 白色塔身(向上收窄, 夜间红色灯带) + 红灯圆钵形观景舱 + 多层白色环带 + 小圆顶 + 绿灯天线底座 + 细天线
    const KX = -62, KZ = -104, KW = [.93, .93, .96], KD = [.3, .34, .42];
    const ks = new MB(); ks.cyl(KX, KZ, 0, 44.5, 2.2, .85, 22, [1, 1, 1]); add(ks, { tex: X.klshaft.tex, em: X.klshaft.em, emDay: .12, emNight: 1.5 });
    const kt = new MB(); kt.cyl(KX, KZ, 0, 3, 3.0, 2.2, 22, [.72, .72, .76]);
    kt.cyl(KX, KZ, 48.2, 48.7, 3.8, 3.95, 28, KW); kt.cyl(KX, KZ, 49.6, 50.1, 4.0, 4.0, 28, KW); kt.cyl(KX, KZ, 50.9, 51.5, 3.85, 3.5, 28, KW);
    kt.cyl(KX, KZ, 48.7, 49.6, 3.95, 4.0, 28, KD); kt.cyl(KX, KZ, 50.1, 50.9, 4.0, 3.85, 28, KD);
    kt.cyl(KX, KZ, 51.5, 53.2, 3.5, 2.0, 28, [.85, .86, .92], true); kt.cyl(KX, KZ, 53.2, 54.3, 2.0, 1.7, 20, KW); kt.cyl(KX, KZ, 54.3, 55.1, 1.2, 1.2, 16, KW);
    kt.cyl(KX, KZ, 63, 63.5, .95, .95, 12, KW); tcyl(kt, [KX, 60.5, KZ], [KX, 73, KZ], .3, .05, 6, KW); add(kt, {});
    const kp = new MB(); [[44.5, 45.4, .85, 1.9], [45.4, 46.3, 1.9, 2.9], [46.3, 47.3, 2.9, 3.5], [47.3, 48.2, 3.5, 3.8]].forEach(([y0, y1, r0, r1]) => kp.cyl(KX, KZ, y0, y1, r0, r1, 28, [.12, .08, .08])); add(kp, emS('#ff3a42', .5, 1.7));   // 红灯钵形底部
    const kw = new MB(); kw.cyl(KX, KZ, 48.72, 49.58, 3.97, 4.02, 28, [.1, .1, .1]); kw.cyl(KX, KZ, 50.12, 50.88, 4.02, 3.87, 28, [.1, .1, .1]); add(kw, emS('#ffe6b0', .4, 1.3));
    const kg = new MB(); kg.cyl(KX, KZ, 55.1, 60.5, .85, .5, 12, [.1, .14, .12]); add(kg, emS('#3dffa0', .7, 2.0));                                                                                // 绿灯天线底座
    halo(gl, KX, 46, KZ + 5, 11, [1, .3, .35]); halo(gl, KX, 58, KZ + 3, 7, [.3, 1, .6]); halo(gl, KX, 73.5, KZ + 1, 3.5, [1, .3, .3]);
    // Merdeka 118 (按参考照片): 近似等宽的深蓝玻璃塔身, 逐层扭转的折面+斜向折痕, 约45%高处收腰+台阶, 斜切塔冠, 一侧伸出深色细长尖顶
    const MX = -14, MZ = -160, mf = new MB(), ws = 1.15;
    const secs = [[0, 5.6 * ws, 0], [13, 5.2 * ws, .25], [24, 4.8 * ws, -.22], [30.4, 4.3 * ws, -.2], [31.7, 5.0 * ws, .18], [46, 4.7 * ws, .3], [57, 4.4 * ws, -.25], [67, 4.1 * ws, .05]];
    const ap = facet(mf, MX, MZ, secs, [.16, .34, .72], [.34, .62, 1], 11); add(mf, { tex: X.glass, em: solid(60, 100, 190), emDay: 0, emNight: .6 });
    const sp = new MB(); tcyl(sp, [ap[0] + .2, ap[1] - .6, MZ], [ap[0] + .5, 88, MZ], .7, .05, 4, [.1, .13, .25]); add(sp, {});
    halo(gl, MX, 72, MZ + 2, 9, [.7, .85, 1]); halo(gl, MX, 20, MZ + 6, 16, [.5, .7, 1]);
    const ex = new MB(), EX = 88, EZ = -132;
    ex.box(EX - 5.6, 0, EZ - 5.6, EX + 5.6, 34, EZ + 5.6, [.9, .96, 1], [6, 6]); ex.box(EX - 4.8, 34, EZ - 4.8, EX + 4.8, 50, EZ + 4.8, [.9, .96, 1], [6, 6]); ex.box(EX - 4, 50, EZ - 4, EX + 4, 60, EZ + 4, [.9, .96, 1], [6, 6]);
    ex.cyl(EX, EZ, 60, 70, 5.2, .6, 4, [.88, .94, 1], true); ex.cyl(EX, EZ, 70, 78, .3, .05, 6, [.92, .94, 1]);
    add(ex, { tex: X.tower.tex, em: X.tower.em, emDay: .3, emNight: 1.2 }); halo(gl, EX, 72, EZ + 1, 8, [.9, .95, 1]); halo(gl, EX, 18, EZ + 5, 14, [.5, .7, 1]);
    add(gl, { tex: T.glow, mode: 2, glow: e => e.night * .7 });
    const sk = [T.facade(41, { wall: '#9ea6c4', cols: 4, rows: 9, lit: .5 }), T.facade(42, { wall: '#b6a9c9', cols: 4, rows: 9, lit: .42 }), T.facade(43, { wall: '#8c9bb8', cols: 4, rows: 8, lit: .55 })], r = rnd(77);
    for (let i = 0; i < 40; i++) { const th = -1.8 + i / 39 * 3.6 + (r() - .5) * .05, rr = 84 + r() * 40, [x, z] = polar(rr, th), w = 7 + r() * 8, h = 10 + r() * 13, f = sk[i % 3];
      if (z < -80 && ((x > 24 && x < 62) || (x > -78 && x < -46) || (x > 70 && x < 106))) continue;
      const mb = new MB(); rbox(mb, x, z, w, 9, 0, h, -th, [1, 1, 1], [16, 14], { noTop: true }); add(mb, { tex: f.tex, em: f.em, emNight: 1.1 }); const rf = new MB(); rbox(rf, x, z, w + .2, 9.2, h, h + .5, -th, [.3, .28, .38]); add(rf, {}); }
  }

  /* ---- 左侧: 排屋 (放射状) + 夜市小贩 ---- */
  { const pals = [['#f2b6a0', '#2e7d6b'], ['#a8d5e2', '#c0392b'], ['#f6e0a0', '#2c6aa0'], ['#d9b8e6', '#2f7d4f'], ['#f5c4d3', '#2c5f8a'], ['#b8e0b0', '#a04a3a'], ['#f6c9a0', '#3a6a9a']];
    const tx = pals.map((p, i) => X.shop(30 + i * 7, p[0], p[1]));
    for (let i = 0; i < 7; i++) occ(() => { const th = -1.28 - i * .205, [x, z] = polar(27.5, th), yaw = -th, mb = new MB(); rbox(mb, x, z, 5.6, 8, 0, 9.6, yaw, [1, 1, 1], [5.6, 9.6], { noTop: true }); add(mb, { tex: tx[i].tex, em: tx[i].em, emDay: .12, emNight: 1.05 });
      const rf = new MB(); rbox(rf, x, z, 5.8, 8.2, 9.6, 10.15, yaw, [.62, .3, .26]); rbox(rf, x, z, 6, 8.4, 10.15, 10.4, yaw, [.5, .26, .24]); add(rf, {}); obsRot(x, z, 5.6, 8, yaw); });
  }
  const plainShared = plain;
  const stall = (x, z, yaw, name, sigO, aw, hotId, label, icon, col) => {
    const plain = new MB(), awn = new MB(), awn2 = new MB(), bulbs = new MB(), bulbsB = new MB(), steam = new MB(), glow = new MB(), nS = occ0();
    const c = Math.cos(yaw), s = Math.sin(yaw);
    rbox(plain, x, z, 3.2, 1.3, 0, .95, yaw, [.78, .52, .3]); rbox(plain, x, z, 3.3, 1.4, .95, 1.05, yaw, [.95, .93, .9]); rbox(plain, x - s * .55, z - c * .55, 3.2, .2, 1.05, 2.5, yaw, [.3, .26, .24], null, { noTop: false });
    [[-1.5, .6], [1.5, .6]].forEach(([lx, lz]) => { const px = x + lx * c + lz * s, pz = z - lx * s + lz * c; plain.cyl(px, pz, 0, 2.5, .05, .05, 6, [.25, .22, .22]); });
    const a = new MB(); rbox(aw === 2 ? awn2 : awn, x + s * .25, z + c * .25, 3.9, 2.1, 2.4, 2.55, yaw, [1, 1, 1], [.7, .7]);
    for (let k = 0; k < 8; k++) { const lx = -1.85 + k * .53, bx = x + lx * c + 1.25 * s, bz = z - lx * s + 1.25 * c; (k % 2 ? bulbsB : bulbs).box(bx - .06, 2.22, bz - .06, bx + .06, 2.34, bz + .06, [.12, .1, .05]); }
    for (let k = 0; k < 4; k++) { const lx = -1.2 + k * .8, fx = x + lx * c + .1 * s, fz = z - lx * s + .1 * c; plain.box(fx - .22, 1.05, fz - .16, fx + .22, 1.3, fz + .16, [[.9, .35, .2], [.95, .8, .3], [.5, .75, .35], [.9, .55, .6]][k]); }
    halo(steam, x, 1.9, z + 0, 2.6, [1, .8, .5]); pool(glow, x + s * 1.2, z + c * 1.2, 2.2, [1, .72, .4]);
    signAt(name, sigO, x - s * .62 + s * .0, z - c * .62, yaw, 1.5, 2.3, 3.0, .5, 1.8);
    const tb = [[3.3, 3.8]]; tb.forEach(([lx, lz]) => { const px = x + lx * c + lz * s, pz = z - lx * s + lz * c; plainShared.cyl(px, pz, 0, .72, .55, .55, 12, [.85, .83, .8], true); [[-.6, 0], [.6, 0], [0, .6], [0, -.6]].forEach(([a2, b2]) => plainShared.cyl(px + a2, pz + b2, 0, .42, .22, .2, 8, [.82, .15, .15], true)); obs(px - .9, pz - .9, px + .9, pz + .9); });
    obsRot(x, z, 3.4, 1.8, yaw);
    add(plain, {}); add(awn, { tex: X.awn }); add(awn2, { tex: X.awn2 }); addTw(bulbs, '#ffe2a0', x * .37, 2.7); addTw(bulbsB, '#fff4dc', x * .37 + 1.7, 3.2); add(steam, { tex: T.glow, mode: 2, glow: e => .12 + e.night * .45 }); add(glow, { tex: T.glow, mode: 2, glow: e => .06 + e.night * .35 }); occ1(nS);
    if (hotId) S.hotspots.push({ id: hotId, x: x + s * 1.9, z: z + c * 1.9, r: 1.6, label, icon, color: col });
  };
  { const defs = [['TEH TARIK 拉茶', { w: 512, h: 120, fs: 56, bg: '#3a1a10', fg: '#ffe0b0', border: '#ff9a4a' }, 1, 'teh', '拉茶摊', '🥤', [1, .7, .3]], ['SATAY 沙爹', { w: 512, h: 120, fs: 62, bg: '#2a1408', fg: '#ffd9a0', border: '#e0452f' }, 2, 'satay', '沙爹摊', '🍢', [1, .5, .3]], ['DURIAN 榴莲', { w: 512, h: 120, fs: 56, bg: '#1d3a12', fg: '#f6f08a', border: '#8fd14f' }, 2, 'durian', '榴莲摊', '🍈', [.7, 1, .4]], ['ROTI CANAI', { w: 512, h: 120, fs: 56, bg: '#2a1a0a', fg: '#fff0c8', border: '#e6b84f' }, 1, 'roti', '印度煎饼', '🥞', [1, .85, .4]]];
    defs.forEach((d, i) => { const th = -1.42 - i * .34, [x, z] = polar(21.2, th); stall(x, z, -th, d[0], d[1], d[2], d[3], d[4], d[5], d[6]); }); }

  /* ---- 右侧: 现代商业楼 + 单轨站 + 车站 ---- */
  { const fa = [T.facade(51, { wall: '#c3b8d8', glass: ['#5d86b8', '#3b5a86'], cols: 5, rows: 6, lit: .5 }), T.facade(52, { wall: '#9eb0d0', cols: 5, rows: 5, lit: .55 }), T.facade(53, { wall: '#d6c7a8', glass: ['#7aa6c8', '#3d6a94'], cols: 4, rows: 6, lit: .6 })];
    [[1.3, 8.6, 11, 0], [1.56, 8.6, 13.5, 1], [1.82, 8.6, 10, 2], [2.3, 7.8, 9, 0], [2.58, 7.8, 11.5, 1]].forEach(([th, d, h, f], i) => occ(() => { const [x, z] = polar(27.5, th), yaw = -th, mb = new MB(); rbox(mb, x, z, 7, d, 0, h, yaw, [1, 1, 1], [8, 7], { noTop: true }); add(mb, { tex: fa[f].tex, em: fa[f].em, emDay: 0, emNight: 1.05 }); const rf = new MB(); rbox(rf, x, z, 7.3, d + .3, h, h + .5, yaw, [.3, .28, .38]); add(rf, {}); obsRot(x, z, 7, d, yaw); }));
    // 单轨车站 (入口牌 + 高架 + 列车)
    const th = 2.02, [sx, sz] = polar(23.8, th), yaw = -th, st = new MB(), nS = occ0();
    rbox(st, sx, sz, 5, 4, 0, 3.6, yaw, [.92, .92, .96]); rbox(st, sx, sz, 5.6, 4.6, 3.6, 3.95, yaw, [.8, .12, .16]); add(st, {}); obsRot(sx, sz, 5, 4, yaw);
    signAt('MONORAIL 单轨', { w: 512, h: 120, fs: 56, bg: '#8a1018', fg: '#fff', border: '#ffd0d4' }, sx + Math.sin(yaw) * 2.05, sz + Math.cos(yaw) * 2.05, yaw, 2.2, 3.3, 3.6, .7, 1.7); occ1(nS);
    occ(() => {
    const vi = new MB(); for (let k = 0; k < 9; k++) { const t = k * 7.5, x = sx + 3 + t * .86, z = sz - 1 - t * .5; rbox(vi, x, z, 8.4, 1.9, 8.1, 9.3, -.52, [.82, .82, .86]); vi.cyl(x, z, 0, 8.1, .55, .45, 10, [.76, .76, .8]); obs(x - .6, z - .6, x + .6, z + .6); }
    add(vi, {});
    const tr = new MB(); [0, 1, 2].forEach(k => { const t = 10 + k * 5.1, x = sx + 3 + t * .86, z = sz - 1 - t * .5; rbox(tr, x, z, 4.8, 2.5, 9.35, 11.3, -.52, [.96, .96, .98]); rbox(tr, x, z, 4.82, 2.52, 9.7, 10.2, -.52, [.82, .1, .16]); }); add(tr, {});
    const tw = new MB(); [0, 1, 2].forEach(k => { const t = 10 + k * 5.1, x = sx + 3 + t * .86, z = sz - 1 - t * .5; rbox(tw, x, z, 4.4, 2.56, 10.4, 11.0, -.52, [.1, .1, .1]); }); add(tw, emS('#ffe6a8', .5, 1.6));
    });
    S.portals.push({ id: 'monorail', x: sx + Math.sin(yaw) * 3.5, z: sz + Math.cos(yaw) * 3.5, r: 1.9, label: '单轨列车 · Bukit Bintang 站', color: [1, .35, .4] });
  }

  /* ---- 喷泉 (广场中心) ---- */
  { const f = new MB(); f.cyl(CX, CZ, 0, .75, 3.7, 3.7, 40, [.86, .82, .76]); f.disc(CX, CZ, .75, 3.7, 40, [.9, .86, .8], 3.2); f.cyl(CX, CZ, .1, .6, 3.2, 3.2, 40, [.4, .5, .6]); f.cyl(CX, CZ, .55, 2.6, .4, .22, 12, [.9, .88, .82], true); f.cyl(CX, CZ, 1.3, 1.5, 1.4, 1.4, 20, [.9, .88, .82], true); f.sphere(CX, 2.75, CZ, .3, .3, .3, [.8, .93, 1], 10); add(f, {});
    const w = new MB(); w.disc(CX, CZ, .55, 3.2, 40, [.5, .75, .95]); add(w, emS('#2f86d8', .2, .55));
    const g = new MB(); halo(g, CX, 2.2, CZ, 5.5, [.5, .8, 1]); pool(g, CX, CZ, 5.5, [.4, .7, 1], .06); add(g, { tex: T.glow, mode: 2, glow: e => .1 + e.night * .55 });
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + .26; leaf.sphere(CX + Math.cos(a) * 1.25, 1.55, CZ + Math.sin(a) * 1.25, .1, .1, .1, [.85, .95, 1], 5); }
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, ox = CX + Math.cos(a) * 3.3, oz = CZ + Math.sin(a) * 3.3; obs(ox - .8, oz - .8, ox + .8, oz + .8); } S.hotspots.push({ id: 'fountain', x: CX, z: CZ + 5.2, r: 2.0, label: '许愿喷泉', icon: '⛲', color: [.5, .8, 1] }); }

  /* ---- 合影点 (I ♥ KL) / 街头艺人 ---- */
  { const bx = 13.6, bz = 11.4, yaw = -.5; rbox(plain, bx, bz, .2, .3, 0, 2.6, yaw, [.3, .26, .3]);
    const nB = occ0(); const mb = new MB(); rbox(mb, bx, bz, 4.2, .2, 1.1, 3.8, yaw, [1, 1, 1], [4.2, 2.7], { noBack: false, noSides: true, noTop: true }); add(mb, { tex: X.board.tex, em: X.board.em, emDay: .3, emNight: 1.3 }); occ1(nB);
    const lg = [[-1.8, 0], [1.8, 0]]; lg.forEach(([lx]) => rbox(plain, bx + lx * Math.cos(yaw), bz - lx * Math.sin(yaw), .16, .16, 0, 1.2, yaw, [.3, .26, .3])); obsRot(bx, bz, 4.2, .6, yaw);
    pool(glow, bx + Math.sin(yaw) * 2.2, bz + Math.cos(yaw) * 2.2, 2.2, [1, .8, .5]); for (let k = 0; k < 3; k++) plain.floor(bx + Math.sin(yaw) * (1.5 + k * .5) - .15, bz + Math.cos(yaw) * (1.5 + k * .5) - .15, bx + Math.sin(yaw) * (1.5 + k * .5) + .15, bz + Math.cos(yaw) * (1.5 + k * .5) + .15, .07, [.9, .3, .3]);
    S.hotspots.push({ id: 'photo', x: bx + Math.sin(yaw) * 2.6, z: bz + Math.cos(yaw) * 2.6, r: 1.6, label: '合影', icon: '📸', color: [1, .6, .5] });
    const ux = -9.5, uz = 13.5; plain.cyl(ux, uz, 0, .08, 1.5, 1.5, 24, [.55, .1, .22], true); plain.box(ux + 1.6, 0, uz - .1, ux + 2.1, .6, uz + .4, [.15, .12, .14]); plain.cyl(ux - .3, uz - .5, 0, .6, .32, .26, 8, [.35, .2, .12], true);
    const bk = new MB(); pool(bk, ux, uz, 3, [1, .7, .5]); add(bk, { tex: T.glow, mode: 2, glow: e => .15 + e.night * .35 }); obs(ux + 1.5, uz - .2, ux + 2.2, uz + .5);
    S.hotspots.push({ id: 'busker', x: ux, z: uz + .6, r: 1.7, label: '街头艺人', icon: '🎸', color: [1, .5, .7] }); }

  /* ---- 路灯 + 灯串 ---- */
  { const poles = new MB(), heads = new MB(), halos = new MB(), pools = new MB(), pts = {};
    [-2.55, -2.05, -1.55, -1.05, -.55, .55, 1.05, 1.55, 2.05, 2.55].forEach((th, i) => { const [x, z] = polar(18.3, th), h = 4.5; pts[th] = [x, z, h];
      poles.cyl(x, z, 0, h, .09, .06, 8, [.2, .18, .3]); poles.cyl(x, z, 0, .35, .2, .14, 8, [.2, .18, .3]); heads.sphere(x, h + .12, z, .3, .3, .3, [1, 1, 1], 8); halo(halos, x, h + .12, z, 3.4, [1, .8, .45]); pool(pools, x, z, 3.6, [1, .78, .45]); obs(x - .22, z - .22, x + .22, z + .22); S.lamps.push([x, z]); });
    add(poles, {}); add(heads, emS('#fff0c8', .35, 2.4)); add(halos, { tex: T.glow, mode: 2, glow: e => e.night * .8 + .08 }); add(pools, { tex: T.glow, mode: 2, glow: e => e.night * .24 });
    let strN = 0; const str = (a, b, sag, n) => { const g0 = strN++; for (let k = 1; k < n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * sag; bulbG[(k + g0 * 2) % 6].box(x - .045, y - .045, z - .045, x + .045, y + .045, z + .045, [.12, .1, .05]); } };
    const ks = Object.keys(pts).map(Number).sort((a, b) => a - b); for (let i = 0; i + 1 < ks.length; i++) if (ks[i + 1] - ks[i] < .6) str(pts[ks[i]], pts[ks[i + 1]], .7, 12);
    [[-2.05, 2.05], [-1.55, 1.55], [-1.05, 1.05]].forEach(([a, b]) => str(pts[a], pts[b], 1.3, 30)); }
  bulbG.forEach((g, i) => addTw(g, ['#ffe2a0', '#fff4dc', '#ffd27a', '#ffeccf', '#ffc9a0', '#fff0c0'][i], i * 1.1, 2.2 + i * .55)); add(awn, { tex: X.awn }); add(awn2, { tex: X.awn2 }); add(steam, { tex: T.glow, mode: 2, glow: e => .12 + e.night * .45 }); add(glow, { tex: T.glow, mode: 2, glow: e => .06 + e.night * .35 });

  /* ---- 棕榈树 / 雨树 / 灌木花 ---- */
  { const r = rnd(5), palm = (x, z, h, lean) => { const pm = new MB(), n0 = occ0();
      for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6, a = [x + lean * t0 * t0 * h, t0 * h, z], b = [x + lean * t1 * t1 * h, t1 * h, z]; tcyl(pm, a, b, .26 - t0 * .1, .26 - t1 * .1, 8, [.5 + .08 * (k % 2), .38, .28]); }
      const cx = x + lean * h, cy = h, n = 9; for (let i = 0; i < n; i++) { const an = i / n * TAU + r() * .4, L = 2.5 + r() * .8, dx = Math.cos(an), dz = Math.sin(an), px = -dz, pz = dx, g = [.2 + r() * .1, .55 + r() * .15, .26 + r() * .08];
        const pt = (t, w) => { const o = t * L, y = cy + Math.sin(t * 2.6) * .7 - t * t * 1.2; return [[cx + dx * o - px * w, y, z + dz * o - pz * w], [cx + dx * o + px * w, y, z + dz * o + pz * w]]; };
        let prev = pt(0, .05); for (let s2 = 1; s2 <= 4; s2++) { const t = s2 / 4, w = .55 * Math.sin(Math.min(1, t * 1.15) * Math.PI * .85 + .3) * (1 - t * .55), cur = pt(t, Math.max(.04, w)); pm.quad(prev[0], prev[1], cur[1], cur[0], [0, 1, 0], [0, 0, 1, 1], g); prev = cur; } }
      pm.sphere(cx, cy - .15, z, .3, .25, .3, [.45, .32, .2], 6); add(pm, {}); occ1(n0); obs(x - .3, z - .3, x + .3, z + .3); };
    [[-24.5, 11.5, 9, .05], [24.5, 12.5, 9, -.05], [-13, 20.5, 7.5, -.04], [13, 20.5, 8, .05], [-6, -10, 7.5, .05], [6, -10.5, 8, -.05], [-16, -9, 8.5, -.04], [16, -9, 8, .05]].forEach(p => palm(...p));
    [[-30, 5], [30, 3]].forEach(([x, z], i) => { const tm = new MB(), n0 = occ0(); tm.cyl(x, z, 0, 3.4, .45, .3, 8, [.4, .3, .22]); [[0, 0, 3.2, 2.4], [1.8, .8, 2.4, 1.8], [-1.8, -.6, 2.5, 1.9], [.3, 1.8, 2.2, 1.7]].forEach(([dx, dz, rx, ry]) => tm.sphere(x + dx, 4.4 + dz * .3, z + dz, rx, ry * .6, rx * .9, [.24 + (i * .04), .56, .32], 9)); add(tm, {}); occ1(n0); obs(x - .5, z - .5, x + .5, z + .5); });
    const fl = [[.95, .25, .5], [.95, .45, .2], [.85, .2, .35], [1, .75, .2]];
    for (let i = 0; i < 14; i++) { const th = 2.5 + i * .16 + (i > 11 ? .2 : 0), a = th > 3.9 ? th : th, [x, z] = polar(20.8, th % 6.283 > 3.5 ? th : th); if (Math.abs(x) < 4.5 && z > 22) continue; if (z > 26 || z < -14) continue; leaf.sphere(x, .42, z, .55, .38, .55, [.28 + r() * .06, .62, .34], 7); leaf.sphere(x + .15, .66, z - .1, .4, .28, .4, fl[i % 4], 6); obs(x - .6, z - .6, x + .6, z + .6); }
    for (let k = 0; k < 6; k++) { const x = -12 + k * 4.8; if (Math.abs(x) < 2.4) continue; leaf.sphere(x, .4, 25.6, .6, .36, .6, [.3, .62, .36], 7); leaf.sphere(x, .64, 25.6, .4, .26, .4, fl[k % 4], 6); obs(x - .9, 24.8, x + .9, 26.4); } add(plain, {}); add(leaf, {}); }

  /* ---- 长椅: 绕喷泉对称摆放 (朝向喷泉), 木板座面 + 铸铁椅脚 + 靠背 + 扶手 ---- */
  { const bm = new MB(), W = 2.6, wood = [.66, .43, .24], wood2 = [.58, .37, .2], iron = [.14, .13, .18];
    const bench = (x, z, yaw) => { const c = Math.cos(yaw), s2 = Math.sin(yaw), L = (lx, lz) => [x + lx * c + lz * s2, z - lx * s2 + lz * c];
      for (let k = 0; k < 4; k++) { const p = L(0, -.24 + k * .16); rbox(bm, p[0], p[1], W, .13, .43, .49, yaw, k % 2 ? wood2 : wood); }
      for (let k = 0; k < 3; k++) { const p = L(0, -.3); rbox(bm, p[0], p[1], W, .06, .62 + k * .16, .72 + k * .16, yaw, k % 2 ? wood2 : wood); }
      [-1.15, 1.15].forEach(lx => { [[.24, .45], [-.3, 1.1]].forEach(([lz, hh]) => { const p = L(lx, lz); rbox(bm, p[0], p[1], .09, .09, 0, hh, yaw, iron); });
        const f = L(lx, -.03); rbox(bm, f[0], f[1], .07, .6, .38, .43, yaw, iron); const a2 = L(lx + Math.sign(lx) * .1, -.02); rbox(bm, a2[0], a2[1], .11, .62, .66, .72, yaw, wood); const ft = L(lx, .0); rbox(bm, ft[0], ft[1], .22, .72, 0, .04, yaw, iron); });
      obsRot(x, z, W + .3, .95, yaw); };
    [40, 90, 135, -40, -90, -135].forEach(d => { const th = d * Math.PI / 180, p = polar(10.2, th); bench(p[0], p[1], -th); }); add(bm, {}); }

  S.updateOcclusion = (eye, me, dt) => {                              // 相机→人物 的视线穿过哪个物体, 该物体就变半透明
    const px = me.x, py = (me.y || 0) + .9, pz = me.z, pad = .2, k = Math.min(1, dt * 9);
    const hit = (o) => { const mn = [o.a[0] - pad, o.a[1] - pad, o.a[2] - pad], mx = [o.b[0] + pad, o.b[1] + pad, o.b[2] + pad];
      for (const [ox, oz] of [[0, 0], [.5, 0], [-.5, 0]]) for (const oy of [-.7, .5]) { const d = [px + ox - eye[0], py + oy - eye[1], pz + oz - eye[2]], len = Math.hypot(d[0], d[1], d[2]); let t0 = 0, t1 = Math.max(0, 1 - 2.6 / len), ok = true;   // 人物身边2.6米内不算挡住
        for (let j = 0; j < 3; j++) { if (Math.abs(d[j]) < 1e-6) { if (eye[j] < mn[j] || eye[j] > mx[j]) { ok = false; break; } } else { let a = (mn[j] - eye[j]) / d[j], b = (mx[j] - eye[j]) / d[j]; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; } } }
        if (ok) return true; } return false; };
    for (const o of S.occluders) { const tg = hit(o) ? .1 : 1; o.f += (tg - o.f) * k; if (Math.abs(o.f - tg) < .01) o.f = tg; for (const b of o.bs) b.fade = o.f; }
  };
  /* ---- 动态效果 (每帧由引擎调用 sc.drawFx): 喷泉水流 + 夜晚灯串闪烁 ---- */
  { const fx = new MB(), fx2 = new MB(), fr = (v) => v - Math.floor(v), W = [.8, .94, 1], sp = [], r0 = rnd(5);
    for (let i = 0; i < 24; i++) { const a = r0() * TAU, d = 1.9 + r0() * 1.1; sp.push([CX + Math.cos(a) * d, CZ + Math.sin(a) * d, r0() * 6.28, 1.5 + r0() * 2]); }
    S.drawFx = (R, t, cam) => {
      const p = cam ? cam.pitch : PITCH, c = Math.cos(p), sn = Math.sin(p);
      for (const o of S.tw) { const v = .5 + .5 * Math.sin(t * o.f + o.ph); o.b.mat.emNight = .12 + 2.3 * v * v; }          // 灯串: 各组节奏/相位不同, 夜晚闪烁
      fx.v.length = 0; fx.i.length = 0; fx.n = 0; fx2.v.length = 0; fx2.i.length = 0; fx2.n = 0;
      const dot = (x, y, z, s, col) => { const P = (a, b) => [x + a * s, y + c * b * s, z - sn * b * s]; fx.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col); };
      const en = (u, a, b) => Math.max(.15, Math.min(1, u / a, (1 - u) / b));
      for (let i = 0; i < 32; i++) { const u = fr(t * .6 + i / 32), an = i * 2.4, r = .9 * u * u; dot(CX + Math.cos(an) * r, 3.0 - 1.45 * u + 6.8 * u * (1 - u), CZ + Math.sin(an) * r, .21 * en(u, .06, .1), W); }                 // 中央高喷柱
      for (let j = 0; j < 12; j++) { const an = j / 12 * TAU + .26; for (let q = 0; q < 11; q++) { const u = fr(t * .75 + q / 11 + j * .083), r = 1.25 + 1.7 * u; dot(CX + Math.cos(an) * r, 1.62 - .98 * u + 3.8 * u * (1 - u), CZ + Math.sin(an) * r, .15 * en(u, .06, .08), W); } }   // 环绕弧形喷射
      for (let k = 0; k < 16; k++) { const an = k / 16 * TAU; for (let q = 0; q < 5; q++) { const u = fr(t * 1.1 + q / 5 + k * .13), r = 1.45 + .15 * u; dot(CX + Math.cos(an) * r, 1.45 - .85 * u * u, CZ + Math.sin(an) * r, .1, W); } }      // 中层盘溢出的水帘
      for (const [x, z, ph, f] of sp) { const v = Math.max(0, Math.sin(t * f + ph)); if (v > .05) dot(x, .62, z, .09 * v * v * v + .02, [1, 1, 1]); }                                                          // 水面闪光
      for (let j = 0; j < 4; j++) { const u = fr(t * .33 + j / 4), r = 1.7 + 1.45 * u, f = (1 - u) * Math.min(1, u * 6) * .55; fx2.floor(CX - r, CZ - r, CX + r, CZ + r, .58, [.5 * f, .8 * f, f]); }       // 水面涟漪
      R.drawDynamic(fx2, { tex: T.ring, mode: 2, glow: 1 }); R.drawDynamic(fx, { tex: T.blob, mode: 3, glow: .92 });
    };
  }
  S.bounds = { x0: -31, x1: 31, z0: -14.4, z1: 23 }; S.spawn = [0, 9];
  S.camera = { dist: 27, pitch: 0.5, fov: 0.74, clampX: [-16, 16], clampZ: [-7, 6], lead: 4 };   // 与原游戏相同的视角
  S.cameraWide = { dist: 23, pitch: 0.11, fov: 1.18 };                                         // 可切换的广角(能看到双子塔)
  S.npcRect = { x0: -17, x1: 17, z0: -10, z1: 20 }; S.heightAt = () => 0; S.name = '武吉免登 · Pavilion 广场'; S.indoor = false;
  S.env = h => { const e = G.World.envAt(h); e.fogNear = 110; e.fogFar = 300; return e; };
  return S;
}
G.Scenes.makeBukit = makeBukit;
})(window);
