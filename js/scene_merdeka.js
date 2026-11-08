/* scene_merdeka.js — 独立广场 Dataran Merdeka（独立场景文件，v2：立体拱廊版）
   Scenes.makeMerdeka(R, T) → 与其他场景相同的对象。
   坐标：x→右（真实的"北"）  z→朝镜头（真实的"东"）  -z→远处是苏丹阿都沙末大厦（真实的"西"）
   v2：拱廊 / 拱门 / 窗洞都是真实凹进去的立体结构（有进深、拱圈线脚、铁门、柱子、栏杆），
   红陶瓦坡屋顶、鲑鱼铜色分瓣圆顶、弧形外楼梯、雕花灰泥、维多利亚喷泉、背景高楼（含 KL Tower）。 */
(function (G) {
'use strict';
const { MB, hex, clamp, envAt, sstep, lerp } = G.World;
const PI = Math.PI, TAU = PI * 2;
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---- 旋转体（圆顶、塔身、尖顶）：prof = [[半径, 高度, v]]，uT = 圆周方向贴图重复次数 ---- */
function lathe(mb, cx, cz, prof, seg, col, uT) {
  const base = mb.n, w = seg + 1; uT = uT || 1;
  for (let j = 0; j < prof.length; j++) {
    const p = prof[j], a = prof[Math.max(0, j - 1)], b = prof[Math.min(prof.length - 1, j + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
    for (let k = 0; k <= seg; k++) {
      const an = k / seg * TAU, c = Math.cos(an), s = Math.sin(an);
      mb.vert([cx + c * p[0], p[1], cz + s * p[0]], [dy / l * c, -dr / l, dy / l * s], k / seg * uT, p[2] == null ? j / (prof.length - 1) : p[2], col || [1, 1, 1]);
    }
  }
  for (let j = 0; j < prof.length - 1; j++) for (let k = 0; k < seg; k++) { const a = base + j * w + k; mb.i.push(a, a + 1, a + w, a + 1, a + w + 1, a + w); }
}
/* 任意四边形（逐顶点 UV，世界坐标） */
function Qw(mb, p0, p1, p2, p3, n, uv, col) {
  const b = mb.n; col = col || [1, 1, 1];
  mb.vert(p0, n, uv[0][0], uv[0][1], col); mb.vert(p1, n, uv[1][0], uv[1][1], col); mb.vert(p2, n, uv[2][0], uv[2][1], col); mb.vert(p3, n, uv[3][0], uv[3][1], col);
  mb.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
}
/* ---- 局部坐标系：frame 原点 (x,z)，切线 t=(tx,tz)，外法线 n=(-tz,tx)；局部点 (u 沿切线, y 高, d 沿外法线) ---- */
const FR = (x, z, tx, tz) => ({ x, z, tx, tz, nx: -tz, nz: tx, s: x * tx + z * tz });
const FRn = (x, z, ang) => FR(x, z, Math.sin(ang), -Math.cos(ang));                 // 朝向 ang（外法线 = (cos,sin)）
const wp = (f, u, y, d) => [f.x + f.tx * u + f.nx * d, y, f.z + f.tz * u + f.nz * d];
const wn = (f, a, b, c) => [f.tx * a + f.nx * c, b, f.tz * a + f.nz * c];
/* 局部四边形；uvf(u,y,d) → [U,V] */
function Q(mb, f, pts, nl, uvf, col) {
  const n = wn(f, nl[0], nl[1], nl[2]), b = mb.n; col = col || [1, 1, 1];
  for (const p of pts) { const uv = uvf(p[0], p[1], p[2]); mb.vert(wp(f, p[0], p[1], p[2]), n, uv[0], uv[1], col); }
  mb.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
}
function Qf(mb, f, pts, nl, uvs, col) {
  const n = wn(f, nl[0], nl[1], nl[2]), b = mb.n; col = col || [1, 1, 1];
  pts.forEach((p, k) => mb.vert(wp(f, p[0], p[1], p[2]), n, uvs[k][0], uvs[k][1], col));
  mb.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
}
const TB = 2.56;                                                                        // 砖 / 灰泥贴图每重复覆盖米数
const uvFront = (f, T) => (u, y) => [(f.s + u) / (T || TB), -y / (T || TB)];
/* 局部长方体（只做可见的 4 面：前、左、右、上；底和后省略）*/
function LB(mb, f, u0, y0, d0, u1, y1, d1, col, T, o) {
  T = T || TB; o = o || {}; col = col || [1, 1, 1];
  const uf = (u, y) => [(f.s + u) / T, -y / T], uS = (u, y, d) => [(f.s + d) / T, -y / T], uT = (u, y, d) => [(f.s + u) / T, d / T];
  Q(mb, f, [[u0, y0, d1], [u1, y0, d1], [u1, y1, d1], [u0, y1, d1]], [0, 0, 1], (u, y) => uf(u, y), col);
  if (!o.noSides) {
    Q(mb, f, [[u1, y0, d1], [u1, y0, d0], [u1, y1, d0], [u1, y1, d1]], [1, 0, 0], (u, y, d) => uS(u, y, d), mul(col, .86));
    Q(mb, f, [[u0, y0, d0], [u0, y0, d1], [u0, y1, d1], [u0, y1, d0]], [-1, 0, 0], (u, y, d) => uS(u, y, d), mul(col, .86));
  }
  if (!o.noTop) Q(mb, f, [[u0, y1, d1], [u1, y1, d1], [u1, y1, d0], [u0, y1, d0]], [0, 1, 0], (u, y, d) => uT(u, y, d), col);
}

/* 尖拱曲线（局部 u,y）：从左侧窗台起，竖直到起拱线，再沿拱曲线到右侧；seg 越大越圆滑 */
function archPts(w, y0, ySp, yTop, seg) {
  const hw = w / 2, H = yTop - ySp, pts = [[-hw, y0], [-hw, ySp]];
  for (let k = 1; k < seg; k++) { const th = -PI / 2 + k / seg * PI, s = Math.abs(Math.sin(th)), u = hw * Math.sin(th); pts.push([u, ySp + H * Math.sqrt(Math.max(0, 1 - s)) * (1 + .16 * Math.sin(PI * s))]); }
  pts.push([hw, ySp], [hw, y0]); return pts;
}
/* 折线向外偏移 b（外 = 远离洞口中心） */
function offsetPts(c, b) {
  const n = c.length, seg = [];
  for (let i = 0; i < n - 1; i++) { const du = c[i + 1][0] - c[i][0], dy = c[i + 1][1] - c[i][1], L = Math.hypot(du, dy) || 1; seg.push([-dy / L, du / L]); }
  const out = [];
  for (let i = 0; i < n; i++) { const a = seg[Math.max(0, i - 1)], d = seg[Math.min(n - 2, i)]; let nx = a[0] + d[0], ny = a[1] + d[1]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; const k = 1 / Math.max(.55, nx * d[0] + ny * d[1]); out.push([c[i][0] + nx * b * k, c[i][1] + ny * b * k]); }
  return out;
}

/* =====================================================================
   立体拱洞：墙面（带拱形洞口）+ 内壁（拱底）+ 门洞底板 + 后墙 + 拱圈线脚
   M = { brick, cream, lace, inner, gate }（各是一个 MB）
   o = { bw 开间宽, w 洞口宽, y0, ySp, yTop, yMax 墙顶, depth 进深, pier:'brick'|'cream', bands:[[宽, 凸出, 是否雕花]...],
         gate:{d, 'gate'}, seg, wallTint, noFloor }
   ===================================================================== */
function arcBay(M, f, o) {
  const hw = o.w / 2, seg = o.seg || 12, dep = o.depth, c = archPts(o.w, o.y0, o.ySp, o.yTop, seg), n = c.length;
  const wallMB = o.wallMB || M.brick, pierMB = o.pier === 'cream' ? M.cream : (o.pierMB || M.brick), tint = o.wallTint || [1, 1, 1];
  const uvW = uvFront(f);
  for (let i = 1; i < n - 2; i++) { const A = c[i], B = c[i + 1]; Q(wallMB, f, [[A[0], A[1], 0], [B[0], B[1], 0], [B[0], o.yMax, 0], [A[0], o.yMax, 0]], [0, 0, 1], uvW, tint); }
  if (o.bw > o.w + .01) {
    const py = o.py0 == null ? o.y0 : o.py0;
    Q(pierMB, f, [[-o.bw / 2, py, 0], [-hw, py, 0], [-hw, o.yMax, 0], [-o.bw / 2, o.yMax, 0]], [0, 0, 1], uvW, o.pier === 'cream' ? [1, 1, 1] : tint);
    Q(pierMB, f, [[hw, py, 0], [o.bw / 2, py, 0], [o.bw / 2, o.yMax, 0], [hw, o.yMax, 0]], [0, 0, 1], uvW, o.pier === 'cream' ? [1, 1, 1] : tint);
  }
  /* 内壁（拱底 + 两侧）*/
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    const A = c[i], B = c[i + 1], du = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(du, dy) || 1, a0 = acc / TB; acc += L;
    Qf(M.cream, f, [[A[0], A[1], 0], [B[0], B[1], 0], [B[0], B[1], -dep], [A[0], A[1], -dep]], [dy / L, -du / L, 0], [[a0, 0], [a0 + L / TB, 0], [a0 + L / TB, dep / TB], [a0, dep / TB]], [.82, .78, .72]);
  }
  /* 地面 + 后墙 */
  if (!o.noFloor) Q(M.inner, f, [[-hw, o.y0 + .005, 0], [hw, o.y0 + .005, 0], [hw, o.y0 + .005, -dep], [-hw, o.y0 + .005, -dep]], [0, 1, 0], (u, y, d) => [(u + hw) / o.w * .3, .6 + -d / dep * .4], [.7, .66, .62]);
  Q(M.inner, f, [[-hw, o.y0, -dep], [hw, o.y0, -dep], [hw, o.yTop + .02, -dep], [-hw, o.yTop + .02, -dep]], [0, 0, 1], (u, y) => [(u + hw) / o.w, 1 - (y - o.y0) / (o.yTop - o.y0)], [1, 1, 1]);
  if (o.gate) Q(M.gate, f, [[-hw, o.y0, -o.gate], [hw, o.y0, -o.gate], [hw, o.yTop + .02, -o.gate], [-hw, o.yTop + .02, -o.gate]], [0, 0, 1], (u, y) => [(u + hw) / o.w, 1 - (y - o.y0) / (o.yTop - o.y0)], [1, 1, 1]);
  /* 拱圈线脚 */
  let cur = c, off = 0;
  for (const bd of (o.bands || [[.28, .1, true]])) {
    const ou = offsetPts(cur, bd[0]), tx = bd[2] ? M.lace : M.cream, TL = bd[2] ? 1.28 : TB, dz = bd[1] + off;
    for (let i = 0; i < n - 1; i++) {
      const A = cur[i], B = cur[i + 1], A2 = ou[i], B2 = ou[i + 1];
      Q(tx, f, [[A[0], A[1], dz], [B[0], B[1], dz], [B2[0], B2[1], dz], [A2[0], A2[1], dz]], [0, 0, 1], (u, y) => [(f.s + u) / TL, -y / TL], [1, 1, 1]);
      const du = B2[0] - A2[0], dy = B2[1] - A2[1], L = Math.hypot(du, dy) || 1;
      Q(M.cream, f, [[A2[0], A2[1], 0], [B2[0], B2[1], 0], [B2[0], B2[1], dz], [A2[0], A2[1], dz]], [-dy / L, du / L, 0], (u, y, d) => [(f.s + u + d) / TB, -y / TB], [.93, .9, .86]);
    }
    cur = ou; off = dz;
  }
}

/* =====================================================================
   纹理（全部程序绘制）
   ===================================================================== */
function makeTex(R, T) {
  const t = {};
  const C = { cream: '#efe6d2', creamD: '#cfc19f', mortar: '#e8dcc2' };
  /* ---- 砖墙：每个砖独立色调（淡黄 / 粉褐 / 浅褐），顺砌；贴图覆盖 2.56 m ---- */
  t.brick = R.paint(256, 256, (g, w, h) => {
    const cols = ['#d9b796', '#cfa986', '#dfc09f', '#c89e7d', '#d4af8c', '#e3c7a8', '#ccA280', '#d7b08a'], bw = w / 8, bh = h / 24;
    g.fillStyle = C.mortar; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 24; row++) { const off = (row % 2) * bw / 2; for (let c = -1; c < 9; c++) {
      const cc = (((c % 8) + 8) % 8), hv = hash2(row * 3.1 + 1, cc * 7.7 + (row % 2) * 2.3), x = c * bw + off, y = row * bh;
      g.fillStyle = cols[(hv * cols.length) | 0]; g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      const gr = g.createLinearGradient(0, y, 0, y + bh); gr.addColorStop(0, 'rgba(255,240,215,.18)'); gr.addColorStop(1, 'rgba(110,60,40,.14)'); g.fillStyle = gr; g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      if (hv > .72) { g.fillStyle = 'rgba(120,70,45,.16)'; g.fillRect(x + 1 + hv * 9, y + 1, 5, bh - 2); }
    } }
    const r = rnd(41); for (let i = 0; i < 900; i++) { g.fillStyle = r() < .5 ? 'rgba(255,235,205,.10)' : 'rgba(100,60,40,.10)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  }, {});
  /* ---- 灰泥：奶油色 + 风化条纹 ---- */
  t.stucco = R.paint(256, 256, (g, w, h) => {
    g.fillStyle = C.cream; g.fillRect(0, 0, w, h); const r = rnd(9);
    for (let i = 0; i < 38; i++) { const x = r() * w; g.fillStyle = `rgba(150,125,90,${.03 + r() * .05})`; g.fillRect(x, 0, 1 + r() * 4, h); }
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() < .5 ? 'rgba(255,252,240,.18)' : 'rgba(140,115,80,.10)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = 'rgba(160,140,105,.22)'; g.fillRect(0, 0, w, 1); g.fillRect(0, h / 2, w, 1);
  }, {});
  /* ---- 雕花灰泥：缠枝格纹 + 四瓣花（贴图 1.28 m）---- */
  t.lace = R.paint(256, 256, (g, w, h) => {
    g.fillStyle = '#eee3cb'; g.fillRect(0, 0, w, h); const cell = 64;
    const petal = (cx, cy, rr, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; g.beginPath(); g.arc(cx + Math.cos(a) * rr * .45, cy + Math.sin(a) * rr * .45, rr * .42, 0, TAU); g.stroke(); } g.beginPath(); g.arc(cx, cy, rr * .16, 0, TAU); g.stroke(); };
    for (const [col, ox, lw] of [['#fffaf0', 1.5, 2.2], ['#bda982', 0, 1.8]]) {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const cx = i * cell + cell / 2 + ox, cy = j * cell + cell / 2 + ox; petal(cx, cy, cell * .42, col, lw); }
      g.strokeStyle = col; g.lineWidth = lw * .7; for (let k = -4; k <= 8; k++) { g.beginPath(); g.moveTo(k * cell + ox, ox); g.lineTo(k * cell + 4 * cell + ox, 4 * cell + ox); g.stroke(); g.beginPath(); g.moveTo(k * cell + ox, 4 * cell + ox); g.lineTo(k * cell + 4 * cell + ox, ox); g.stroke(); }
    }
    const r = rnd(3); for (let i = 0; i < 1200; i++) { g.fillStyle = 'rgba(150,125,90,.07)'; g.fillRect(r() * w, r() * h, 2, 2); }
  }, {});
  /* ---- 拱廊内壁（暗）+ 夜间暖光 ---- */
  t.inner = R.paint(64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a110f'); gr.addColorStop(.6, '#2b1d17'); gr.addColorStop(1, '#4a362a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const r = rnd(2); for (let i = 0; i < 200; i++) { g.fillStyle = 'rgba(255,220,170,.05)'; g.fillRect(r() * w, r() * h, 2, 2); } }, { clamp: true });
  t.innerE = R.paint(64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b4691e'); gr.addColorStop(.55, '#e9a04a'); gr.addColorStop(1, '#ffcf80'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { clamp: true });
  /* ---- 铁艺门：扇形 + 直栏 + 横档 + 卷草 ---- */
  const gate = (em) => R.paint(256, 384, (g, w, h) => {
    if (em) { const gr = g.createRadialGradient(w / 2, h * .62, 6, w / 2, h * .62, w * .8); gr.addColorStop(0, '#ffd790'); gr.addColorStop(1, '#a8601e'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    else { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#120c0c'); gr.addColorStop(1, '#3a2a26'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    g.strokeStyle = '#0a0607'; g.lineCap = 'round';
    g.lineWidth = 4; for (let x = 10; x < w; x += 20) { g.beginPath(); g.moveTo(x, h); g.lineTo(x, h * .42); g.stroke(); }
    g.lineWidth = 5; [h * .96, h * .78, h * .6, h * .42].forEach(y => { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); });
    g.lineWidth = 3.4; for (let k = -9; k <= 9; k++) { g.beginPath(); g.moveTo(w / 2, h * .42); g.lineTo(w / 2 + k * w / 14, -10); g.stroke(); }
    g.lineWidth = 3.4; for (let r = 1; r <= 4; r++) { g.beginPath(); g.arc(w / 2, h * .42, r * 34, PI, 0); g.stroke(); }
    g.lineWidth = 3; for (let x = 30; x < w; x += 40) { g.beginPath(); g.arc(x, h * .69, 12, 0, TAU); g.stroke(); g.beginPath(); g.arc(x + 20, h * .87, 9, 0, TAU); g.stroke(); }
  }, { clamp: true });
  t.gate = gate(false); t.gateE = gate(true);
  /* ---- 红陶瓦（筒瓦）：每片颜色略不同，贴图覆盖 2 m ---- */
  t.tile = R.paint(256, 256, (g, w, h) => {
    const cols = ['#b6502d', '#c25c33', '#ac482a', '#cf6b3b', '#b95631', '#c4623a'], tw = 16, th = 32; g.fillStyle = '#6a2a18'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < h / th; row++) for (let c = 0; c < w / tw; c++) {
      const hv = hash2(row * 5.3 + 2, c * 9.1), x = c * tw + (row % 2) * tw / 2, y = row * th;
      for (const xx of [x, x - w]) { const gr = g.createLinearGradient(xx, 0, xx + tw, 0); gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(.32, 'rgba(255,200,150,.22)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = cols[(hv * cols.length) | 0]; g.fillRect(xx + 1, y, tw - 2, th); g.fillStyle = gr; g.fillRect(xx + 1, y, tw - 2, th); }
      g.fillStyle = 'rgba(40,10,0,.38)'; g.fillRect(x, y + th - 5, tw, 5);
    }
  }, {});
  /* ---- 铜褐色圆顶：16 瓣，每瓣中间亮、缝暗；水平圈线（鲑鱼色铜）---- */
  t.copper = R.paint(256, 256, (g, w, h) => {
    const N = 16; for (let i = 0; i < N; i++) { const x = i / N * w, ww = w / N, gr = g.createLinearGradient(x, 0, x + ww, 0); gr.addColorStop(0, '#a85f3e'); gr.addColorStop(.22, '#cf8560'); gr.addColorStop(.55, '#ecae88'); gr.addColorStop(.85, '#c47c58'); gr.addColorStop(1, '#8f4e31'); g.fillStyle = gr; g.fillRect(x, 0, ww + 1, h); }
    g.fillStyle = 'rgba(70,30,15,.55)'; for (let i = 0; i < N; i++) g.fillRect(i / N * w - 1, 0, 2, h);
    [[.10, 6], [.26, 4], [.52, 5], [.8, 3]].forEach(([v, th]) => { g.fillStyle = 'rgba(80,35,18,.55)'; g.fillRect(0, v * h, w, th); g.fillStyle = 'rgba(255,215,180,.4)'; g.fillRect(0, v * h + th, w, 2); });
    const r = rnd(8); for (let i = 0; i < 1400; i++) { g.fillStyle = r() < .5 ? 'rgba(255,225,190,.12)' : 'rgba(70,30,15,.12)'; g.fillRect(r() * w, r() * h, 2, 2 + r() * 4); }
  }, {});
  t.copperE = R.paint(64, 64, (g, w, h) => { g.fillStyle = '#d8741c'; g.fillRect(0, 0, w, h); }, {});
  /* ---- 钟面 ---- */
  const clock = (em) => R.paint(256, 256, (g, w, h) => {
    const cx = w / 2, r = w / 2 - 6; g.fillStyle = em ? '#ffe9a8' : '#f4f1e6'; g.beginPath(); g.arc(cx, cx, r, 0, TAU); g.fill();
    g.lineWidth = 12; g.strokeStyle = em ? '#b07a2c' : '#2f2a26'; g.stroke(); g.lineWidth = 3; g.strokeStyle = em ? '#c89040' : '#8a7a5a'; g.beginPath(); g.arc(cx, cx, r - 14, 0, TAU); g.stroke();
    if (em) return; g.fillStyle = '#16120f'; g.font = 'bold 22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const rom = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.save(); g.translate(cx + Math.sin(a) * (r - 34), cx - Math.cos(a) * (r - 34)); g.rotate(a); g.fillText(rom[i], 0, 0); g.restore(); }
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; g.lineWidth = i % 5 ? 1.5 : 3; g.beginPath(); g.moveTo(cx + Math.sin(a) * (r - 14), cx - Math.cos(a) * (r - 14)); g.lineTo(cx + Math.sin(a) * (r - 20), cx - Math.cos(a) * (r - 20)); g.strokeStyle = '#16120f'; g.stroke(); }
    g.lineCap = 'round'; g.strokeStyle = '#111'; g.lineWidth = 9; g.beginPath(); g.moveTo(cx, cx); g.lineTo(cx + Math.sin(2.5) * r * .5, cx - Math.cos(2.5) * r * .5); g.stroke(); g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cx); g.lineTo(cx + Math.sin(.55) * r * .76, cx - Math.cos(.55) * r * .76); g.stroke(); g.beginPath(); g.arc(cx, cx, 8, 0, TAU); g.fillStyle = '#111'; g.fill();
  }, { clamp: true });
  t.clock = clock(false); t.clockE = clock(true);
  /* ---- 路面 / 草坪 / 铺装 ---- */
  t.asphalt = R.paint(256, 256, (g, w, h) => { g.fillStyle = '#6c6c70'; g.fillRect(0, 0, w, h); const r = rnd(3); for (let i = 0; i < 5000; i++) { const v = (r() * 40) | 0; g.fillStyle = `rgba(${v + 60},${v + 60},${v + 64},.38)`; g.fillRect(r() * w, r() * h, 2, 2); } }, {});
  t.grass = R.paint(256, 256, (g, w, h) => { g.fillStyle = '#f4fff0'; g.fillRect(0, 0, w, h); const r = rnd(5); for (let i = 0; i < 3400; i++) { g.fillStyle = r() < .5 ? 'rgba(30,110,40,.16)' : 'rgba(255,255,255,.22)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 4); } }, {});
  t.pave = R.paint(256, 256, (g, w, h) => { g.fillStyle = '#d8cdbd'; g.fillRect(0, 0, w, h); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const v = 214 + ((i * 7 + j * 13) % 4) * 6; g.fillStyle = `rgb(${v},${v - 8},${v - 20})`; g.fillRect(i * 64 + 1.5, j * 64 + 1.5, 61, 61); } g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 5; i++) { g.fillRect(i * 64 - 1, 0, 2, h); g.fillRect(0, i * 64 - 1, w, 2); } }, {});
  t.curb = R.paint(64, 16, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#e9e9e9' : '#1c1c1e'; g.fillRect(i * 16, 0, 16, h); } }, { mip: false });
  t.steel = R.paint(32, 32, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#8a8e92'); gr.addColorStop(.45, '#e6e9ec'); gr.addColorStop(1, '#6a6e72'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, {});
  t.stone = R.paint(128, 128, (g, w, h) => { g.fillStyle = '#3a3b3e'; g.fillRect(0, 0, w, h); const r = rnd(12); for (let i = 0; i < 900; i++) { const v = 40 + (r() * 40 | 0); g.fillStyle = `rgba(${v},${v},${v + 3},.5)`; g.fillRect(r() * w, r() * h, 2, 2); } g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, 1); g.fillRect(0, h / 2, w, 1); g.fillRect(0, 0, 1, h); g.fillRect(w / 2, 0, 1, h / 2); }, {});
  /* ---- 喷泉：绿釉小瓷砖 / 青铜铜绿 / 池底马赛克 ---- */
  t.tileGreen = R.paint(128, 128, (g, w, h) => { g.fillStyle = '#cfe0c8'; g.fillRect(0, 0, w, h); const r = rnd(4); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const v = r(); g.fillStyle = `rgb(${(96 + v * 40) | 0},${(178 + v * 34) | 0},${(122 + v * 30) | 0})`; g.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(i * 16 + 2, j * 16 + 2, 8, 3); } }, {});
  t.mosaic = R.paint(128, 128, (g, w, h) => { g.fillStyle = '#9fd0c4'; g.fillRect(0, 0, w, h); const r = rnd(6); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const v = r(); g.fillStyle = `rgb(${(30 + v * 30) | 0},${(130 + v * 50) | 0},${(130 + v * 40) | 0})`; g.fillRect(i * 8 + .5, j * 8 + .5, 7, 7); } }, {});
  t.bronze = R.paint(128, 128, (g, w, h) => { g.fillStyle = '#5c7a58'; g.fillRect(0, 0, w, h); const r = rnd(7); for (let i = 0; i < 1100; i++) { const q = r(); g.fillStyle = q < .35 ? 'rgba(90,150,120,.30)' : q < .6 ? 'rgba(30,25,18,.34)' : 'rgba(150,120,70,.22)'; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 8); } }, {});
  /* ---- 国旗 / 粽叶结（Ketupat 挂饰）---- */
  t.flag = R.paint(128, 64, (g, w, h) => { for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#fff' : '#cc0001'; g.fillRect(0, i * h / 14, w, h / 14 + 1); } g.fillStyle = '#010066'; g.fillRect(0, 0, w * .5, h * 8 / 14); g.fillStyle = '#ffcc00'; g.beginPath(); g.arc(w * .2, h * .286, h * .19, 0, TAU); g.fill(); g.fillStyle = '#010066'; g.beginPath(); g.arc(w * .24, h * .286, h * .155, 0, TAU); g.fill(); g.fillStyle = '#ffcc00'; g.beginPath(); for (let i = 0; i < 28; i++) { const a = i / 28 * TAU - PI / 2, rr2 = i % 2 ? h * .07 : h * .14; g.lineTo(w * .36 + Math.cos(a) * rr2, h * .286 + Math.sin(a) * rr2); } g.fill(); }, { clamp: true });
  t.ketupat = R.paint(64, 128, (g, w, h) => {
    g.fillStyle = '#f0d23a'; g.fillRect(0, 0, w, h); g.fillStyle = '#6fae2e';
    for (let j = -1; j < 8; j++) for (let i = -1; i < 4; i++) { const cx = i * 16 + (j % 2 ? 8 : 0), cy = j * 16; g.beginPath(); g.moveTo(cx, cy - 8); g.lineTo(cx + 8, cy); g.lineTo(cx, cy + 8); g.lineTo(cx - 8, cy); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(40,70,10,.55)'; g.lineWidth = 1.6; for (let k = -8; k < 12; k++) { g.beginPath(); g.moveTo(k * 8, 0); g.lineTo(k * 8 + h, h); g.stroke(); g.beginPath(); g.moveTo(k * 8 + h, 0); g.lineTo(k * 8, h); g.stroke(); }
  }, { clamp: true });
  /* ---- 背景高楼 ---- */
  const grid = (em, seed, o) => R.paint(256, 512, (g, w, h) => {
    const r = rnd(seed), fh = o.fh || 16, fw = o.fw || 20;
    if (em) g.fillStyle = '#000'; else { g.fillStyle = o.wall; } g.fillRect(0, 0, w, h);
    for (let y = 4; y < h - 8; y += fh) {
      if (!em) { if (o.band) { const gr = g.createLinearGradient(0, y, 0, y + fh - 6); gr.addColorStop(0, o.g0); gr.addColorStop(1, o.g1); g.fillStyle = gr; g.fillRect(0, y, w, fh - 6); g.fillStyle = o.mull; for (let x = 0; x < w; x += fw) g.fillRect(x, y, 2, fh - 6); } g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y + fh - 6, w, 1); }
      for (let x = 2; x < w - 2; x += fw) { const on = r(); if (em) { if (on < .3) { g.fillStyle = on < .18 ? '#d9b26e' : '#9db4d0'; g.fillRect(x + 2, y + 2, fw - 5, fh - 10); } } else if (!o.band) { const gr = g.createLinearGradient(0, y, 0, y + fh - 6); gr.addColorStop(0, o.g0); gr.addColorStop(1, o.g1); g.fillStyle = gr; g.fillRect(x + 2, y + 2, fw - 5, fh - 10); if (on < .15) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 2, y + 2, fw - 5, fh - 10); } } }
    }
  }, { clamp: false });
  t.twConc = grid(false, 3, { wall: '#c7c0b2', g0: '#4b6678', g1: '#2f4656', fh: 17, fw: 20 }); t.twConcE = grid(true, 3, { fh: 17, fw: 20 });
  t.twGlass = grid(false, 9, { wall: '#5d7d94', band: true, g0: '#92b6cc', g1: '#4d7189', mull: '#d6e2ea', fh: 15, fw: 24 }); t.twGlassE = grid(true, 9, { fh: 15, fw: 24 });
  t.twDark = grid(false, 5, { wall: '#7d8187', band: true, g0: '#5b7a90', g1: '#34495a', mull: '#a5adb4', fh: 14, fw: 16 }); t.twDarkE = grid(true, 5, { fh: 14, fw: 16 });
  t.twTeal = grid(false, 12, { wall: '#436b78', band: true, g0: '#79b2b8', g1: '#356a74', mull: '#cfe1e3', fh: 18, fw: 28 }); t.twTealE = grid(true, 12, { fh: 18, fw: 28 });
  t.shaft = R.paint(128, 128, (g, w, h) => { g.fillStyle = '#d8d6d0'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(90,90,95,.15)'; g.fillRect(x, 0, 2, h); } const r = rnd(2); for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(80,80,80,.07)'; g.fillRect(r() * w, r() * h, 2, 6); } }, {});
  t.pod = R.paint(256, 128, (g, w, h) => { g.fillStyle = '#b9c1c6'; g.fillRect(0, 0, w, h); for (let k = 0; k < 4; k++) { const y = 10 + k * 28; const gr = g.createLinearGradient(0, y, 0, y + 20); gr.addColorStop(0, '#9ec0d2'); gr.addColorStop(1, '#4b6b82'); g.fillStyle = gr; g.fillRect(0, y, w, 20); g.fillStyle = '#e6edf1'; for (let x = 0; x < w; x += 14) g.fillRect(x, y, 2, 20); } }, {});
  t.podE = R.paint(256, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = rnd(4); for (let k = 0; k < 4; k++) for (let x = 0; x < w; x += 14) if (r() < .7) { g.fillStyle = '#f0c070'; g.fillRect(x + 2, 12 + k * 28, 10, 16); } }, {});
  t.mast = R.paint(16, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f0f0f0' : '#d8232a'; g.fillRect(0, i * 8, w, 8); } }, {});
  return t;
}

/* =====================================================================
   场景
   ===================================================================== */
const ZF = -30;                 // 大厦正立面所在的 z
const HALF = 49;                // 大厦半长
const WH = 9.1;                 // 檐口顶高
const SPANS = [[-HALF, -39.8], [-30.2, -24.1], [-15.9, -3.5], [3.5, 15.9], [24.1, 30.2], [39.8, HALF]];
function makeMerdeka(R, T) {
  const X = makeTex(R, T);
  const S = { batches: [], obstacles: [], portals: [], hotspots: [], lamps: [], seats: [] };
  const bbOf = (mb) => { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (let k = 0; k < mb.v.length; k += 11) for (let j = 0; j < 3; j++) { const v = mb.v[k + j]; if (v < a[j]) a[j] = v; if (v > b[j]) b[j] = v; } return [a, b]; };
  const add = (mb, mat) => { if (!mb.i.length) return null; const b = R.batch(mb, mat); b.bb = bbOf(mb); S.batches.push(b); return b; };
  const obs = (x0, z0, x1, z1) => S.obstacles.push({ x0, z0, x1, z1 });
  const obsC = (x, z, r) => obs(x - r, z - r, x + r, z + r);
  const solid = (r, g, b) => R.solidTex([r, g, b, 255]);
  const emS = (hexc, d, n) => { const c = hex(hexc); return { em: solid(c[0] * 255, c[1] * 255, c[2] * 255), emDay: d, emNight: n }; };
  S.occluders = []; S.updateOcclusion = () => { };

  const CREAM = [1, 1, 1], WARM = [1.04, 1.0, .94];
  const halo = (mb, x, y, z, s, col) => { mb.quad([x - s, y - s, z], [x + s, y - s, z], [x + s, y + s, z], [x - s, y + s, z], [0, 0, 1], [0, 0, 1, 1], col); mb.quad([x, y - s, z + s], [x, y - s, z - s], [x, y + s, z - s], [x, y + s, z + s], [1, 0, 0], [0, 0, 1, 1], col); };
  /* 各材质的网格（最后统一提交）*/
  const M = { brick: new MB(), cream: new MB(), lace: new MB(), inner: new MB(), gate: new MB(), tile: new MB(), copper: new MB(), copperD: new MB(), gold: new MB(), stone: new MB(), flags: new MB(), iron: new MB() };

  /* ---------------- 地面 ---------------- */
  {
    const g = new MB(); g.floor(-420, -420, 420, 420, -.06, [.34, .42, .32], [0, 0, 70, 70]); add(g, { tex: X.grass });
    const pd = new MB(); pd.floor(-78, -6, 78, 58, 0, [.42, .74, .34], [0, 0, 26, 10]);
    for (let i = 0; i < 9; i++) { pd.floor(-78 + i * 17.3, -6, -78 + i * 17.3 + 8.65, 58, .004, [.47, .8, .38], [0, 0, 3, 10]); }
    add(pd, { tex: X.grass });
    const rd = new MB(); rd.floor(-120, -24, 120, -8, .002, [1, 1, 1], [0, 0, 60, 8]); add(rd, { tex: X.asphalt });
    const mk = new MB(), WH_ = [.95, .95, .92];
    for (const zz of [-20, -12]) for (let x = -118; x < 118; x += 7) mk.floor(x, zz - .07, x + 3.6, zz + .07, .014, WH_);
    mk.floor(-120, -16.1, 120, -15.95, .014, [.95, .85, .3]); mk.floor(-120, -15.8, 120, -15.65, .014, [.95, .85, .3]);
    mk.floor(-120, -23.8, 120, -23.65, .014, WH_); mk.floor(-120, -8.35, 120, -8.2, .014, WH_);
    for (const cx of [-40, 8, 44]) for (let k = 0; k < 14; k++) mk.floor(cx + k * 1.0, -23.4, cx + k * 1.0 + .55, -8.6, .016, WH_);
    for (const ax of [-30, 22, 70]) { mk.floor(ax, -21.2, ax + 3.6, -18.9, .014, WH_); mk.floor(ax + 3.6, -22.1, ax + 5.4, -18.0, .014, WH_); }
    add(mk, { tex: R.white });
    const sw = new MB(); sw.floor(-120, ZF - 6, 120, -24, .1, [1, 1, 1], [0, 0, 80, 4]); sw.floor(-120, -8, 120, -4.5, .1, [1, 1, 1], [0, 0, 80, 2.3]); add(sw, { tex: X.pave });
    const cb = new MB(); cb.box(-120, 0, -24.3, 120, .12, -24, [1, 1, 1], [1, .3], { noBack: true, noSides: true }); cb.box(-120, 0, -8, 120, .12, -7.7, [1, 1, 1], [1, .3], { noBack: true, noSides: true }); add(cb, { tex: X.curb });
    const cb2 = new MB(); cb2.box(-120, 0, -24.3, 120, .12, -24, [1, 1, 1], null, { noFront: true, noBack: true, noSides: true }); add(cb2, { tex: R.white });
    const pv = new MB(), PB = (x0, z0, x1, z1) => pv.box(x0, 0, z0, x1, .115, z1, [1, 1, 1], [4, 4], { noBack: false });
    PB(-78, -4.5, 78, -1.8); PB(-78, 56, 78, 58); PB(-1.6, -1.8, 1.6, 56); PB(-45, -1.8, -41.8, 56); PB(41.8, -1.8, 45, 56);
    add(pv, { tex: X.pave });
  }

  /* =================================================================
     大厦两翼：每个开间 = 下层拱门（带铁门）+ 上层双连拱凉廊（栏杆 + 圆柱）
     ================================================================= */
  const body = new MB(); body.box(-HALF, 0, ZF - 14, HALF, WH, ZF, [.92, .78, .66], [TB, TB], { noFront: true, noTop: true }); add(body, { tex: X.brick });
  const baluster = (f, u0, u1, y0, y1, d) => {
    LB(M.cream, f, u0 - .04, y1 - .12, d - .12, u1 + .04, y1, d + .14, CREAM);       // 扶手
    LB(M.cream, f, u0 - .04, y0, d - .12, u1 + .04, y0 + .13, d + .12, CREAM);       // 底座
    const n = Math.max(2, Math.round((u1 - u0) / .17));
    for (let k = 0; k <= n; k++) { const u = lerp(u0, u1, k / n); LB(M.cream, f, u - .036, y0 + .13, d - .035, u + .036, y1 - .12, d + .035, CREAM, 1, { noSides: true, noTop: true }); LB(M.cream, f, u - .07, y0 + .36, d - .07, u + .07, y0 + .66, d + .07, CREAM, 1, { noSides: true }); }
  };
  const dentils = (f, u0, u1, y0, y1, d, step) => { for (let u = u0 + step * .5; u < u1 - .05; u += step) LB(M.cream, f, u - step * .28, y0, 0, u + step * .28, y1, d, CREAM, 1, { noTop: true }); };
  /* 檐口 + 腰线 + 垛口（局部 u0..u1）*/
  const courses = (f, u0, u1, o) => {
    o = o || {};
    LB(M.cream, f, u0, 4.58, 0, u1, 4.78, .32, CREAM); LB(M.cream, f, u0, 4.78, 0, u1, 5.0, .4, CREAM); dentils(f, u0, u1, 4.44, 4.58, .26, .24);
    LB(M.cream, f, u0, 8.78, 0, u1, 8.95, .5, CREAM); LB(M.cream, f, u0, 8.95, 0, u1, WH, .66, CREAM); dentils(f, u0, u1, 8.6, 8.78, .44, .24);
    for (let u = u0 + .3; u < u1 - .5; u += 1.1) LB(M.cream, f, u, WH, .1, u + .52, WH + .66, .5, CREAM);
    LB(M.cream, f, u0, WH, .1, u1, WH + .2, .5, CREAM);
  };
  SPANS.forEach(([a, b]) => {
    const n = Math.max(1, Math.round((b - a) / 3.2)), dx = (b - a) / n;
    for (let k = 0; k < n; k++) {
      const cx = a + (k + .5) * dx, f = FR(cx, ZF, 1, 0), bw = dx;
      arcBay(M, f, { bw, w: 2.3, y0: 0, ySp: 2.55, yTop: 3.95, yMax: 4.58, depth: 2.2, pier: 'brick', bands: [[.26, .1, true], [.1, .2, false]], gate: .32, seg: 14, wallTint: WARM });
      for (const s of [-1, 1]) arcBay(M, FR(cx + s * bw * .25, ZF, 1, 0), { bw: bw / 2, w: 1.3, y0: 5.0, ySp: 7.15, yTop: 8.25, yMax: 8.75, depth: 2.2, pier: 'cream', bands: [[.17, .08, true]], seg: 10, wallTint: WARM, noFloor: false });
      baluster(f, -1.9, -.17, 5.0, 6.1, 0); baluster(f, .17, 1.9, 5.0, 6.1, 0);
      /* 中柱（圆柱 + 柱头）*/
      M.cream.cyl(cx, ZF + .1, 5.1, 7.1, .13, .1, 10, [1, 1, 1]); LB(M.cream, f, -.2, 7.1, 0, .2, 7.32, .24, CREAM); LB(M.cream, f, -.18, 5.0, 0, .18, 5.14, .24, CREAM);
      /* 下层：勒脚（只在墩上）+ 门前台阶 */
      for (const s of [-1, 1]) LB(M.cream, f, s > 0 ? 1.48 : -bw / 2, 0, 0, s > 0 ? bw / 2 : -1.48, .55, .22, CREAM);
      LB(M.stone, f, -1.55, 0, 0, 1.55, .09, .7, [1, 1, 1], 1.2); LB(M.stone, f, -1.48, .09, 0, 1.48, .18, .4, [1, 1, 1], 1.2);
      /* 拱间圆饰（灰泥圆盘）*/
      for (const s of [-1, 1]) { const rx = cx + s * bw * .25, cr = (x) => x; void cr; }
    }
    /* 开间分隔壁柱（立体）+ 柱头 + 起拱石 */
    for (let k = 0; k <= n; k++) { const x = a + k * dx, f = FR(x, ZF, 1, 0); const hw = (k === 0 || k === n) ? .22 : .22;
      LB(M.cream, f, -hw, .55, 0, hw, 4.5, .26, CREAM); LB(M.cream, f, -hw - .06, 4.2, 0, hw + .06, 4.58, .34, CREAM); LB(M.cream, f, -hw - .05, 2.45, 0, hw + .05, 2.62, .32, CREAM);
      LB(M.cream, f, -hw, 5.0, 0, hw, 8.6, .22, CREAM); LB(M.cream, f, -hw - .05, 8.2, 0, hw + .05, 8.62, .3, CREAM);
    }
    courses(FR((a + b) / 2, ZF, 1, 0), -(b - a) / 2, (b - a) / 2);
  });
  /* 屋顶（红陶瓦，坡屋顶；檐口之上，垛口之后）*/
  {
    const y1 = WH + .55, y2 = WH + 3.9, zE = ZF - .45, zR = ZF - 7, zB = ZF - 13.6, L = Math.hypot(zE - zR, y2 - y1);
    const nf = [0, (zE - zR) / Math.hypot(zE - zR, y2 - y1), (y2 - y1) / Math.hypot(zE - zR, y2 - y1)];
    Qw(M.tile, [-HALF, y1, zE], [HALF, y1, zE], [HALF, y2, zR], [-HALF, y2, zR], nf, [[-HALF / 2, 0], [HALF / 2, 0], [HALF / 2, L / 2], [-HALF / 2, L / 2]]);
    Qw(M.tile, [HALF, y1, zB], [-HALF, y1, zB], [-HALF, y2, zR], [HALF, y2, zR], [0, nf[1], -nf[2]], [[HALF / 2, 0], [-HALF / 2, 0], [-HALF / 2, L / 2], [HALF / 2, L / 2]]);
    for (const sx of [-1, 1]) Qw(M.brick, [sx * HALF, y1, zE], [sx * HALF, y1, zB], [sx * HALF, y2, zR], [sx * HALF, y2, zR], [sx, 0, 0], [[0, 0], [1, 0], [.5, 1], [.5, 1]], [.9, .78, .66]);
    M.cream.box(-HALF, y2 - .05, zR - .15, HALF, y2 + .22, zR + .15, [1, 1, 1], [TB, TB]);
  }
  obs(-HALF, ZF - 14, HALF, ZF + .25);

  /* ---------------- 通用小件 ---------------- */
  const finial = (x, z, y, sc) => {
    const pr = [[.55, 0], [.5, .35], [.3, .45], [.42, 1.0], [.22, 1.3], [.32, 1.6], [.16, 1.9], [.26, 2.25], [.1, 2.7], [.04, 4.0]].map(p => [p[0] * sc, y + p[1] * sc]);
    lathe(M.cream, x, z, pr, 10, CREAM); lathe(M.gold, x, z, [[.1 * sc, y + 3.3 * sc], [.15 * sc, y + 3.5 * sc], [.05 * sc, y + 3.75 * sc]], 8, [1, .82, .4]);
  };
  const fan = (mb, f, pts, cen, d, col, T) => {
    const c = mb.vert(wp(f, cen[0], cen[1], d), wn(f, 0, 0, 1), (f.s + cen[0]) / T, -cen[1] / T, col), b = mb.n;
    pts.forEach(p => mb.vert(wp(f, p[0], p[1], d), wn(f, 0, 0, 1), (f.s + p[0]) / T, -p[1] / T, col));
    for (let k = 0; k < pts.length - 1; k++) mb.i.push(c, b + k, b + k + 1);
  };
  const disc2 = (mb, f, cu, cy, r, d, col, T, seg) => { const pts = []; for (let k = 0; k <= seg; k++) { const a = k / seg * TAU; pts.push([cu + Math.cos(a) * r, cy + Math.sin(a) * r]); } fan(mb, f, pts, [cu, cy], d, col, T); };
  const archGroup = (f, list, depth, y0s, gate) => list;
  void archGroup;

  /* =================================================================
     两侧山墙大厅（带尖顶山花 + 小尖塔）
     ================================================================= */
  for (const sx of [-1, 1]) {
    const xc = sx * 35, zp = ZF + 1.0, f = FR(xc, zp, 1, 0);
    { const bb = new MB(); bb.box(xc - 4.77, 0, ZF - 2, xc + 4.77, WH, zp - .03, [.92, .78, .66], [TB, TB], { noFront: true }); add(bb, { tex: X.brick }); }
    /* 左右侧面（朝向 x 的砖墙，ZF → zp）*/
    for (const e of [-1, 1]) { const fs = FRn(xc + e * 4.8, ZF + .5, e > 0 ? 0 : PI); Q(M.brick, fs, [[-.5, 0, 0], [.5, 0, 0], [.5, WH, 0], [-.5, WH, 0]], [0, 0, 1], uvFront(fs), WARM); }
    const bays = [[-3.35, 2.9, 1.9, 2.5, 3.7, 1.5, 7.0, 8.1], [0, 3.8, 2.6, 3.0, 4.4, 2.6, 7.0, 8.3], [3.35, 2.9, 1.9, 2.5, 3.7, 1.5, 7.0, 8.1]];
    for (const [u, bw, w, ySp, yTop, w2, ySp2, yTop2] of bays) {
      const fb = FR(xc + u, zp, 1, 0);
      arcBay(M, fb, { bw, w, y0: 0, ySp, yTop, yMax: 4.58, depth: 2.4, pier: 'brick', bands: [[.28, .1, true], [.12, .2, false]], gate: .34, seg: 14, wallTint: WARM });
      arcBay(M, fb, { bw, w: w2 + (u === 0 ? 0 : .0), y0: 5.0, ySp: ySp2, yTop: yTop2, yMax: 8.75, depth: 2.4, pier: 'cream', bands: [[.22, .09, true], [.08, .16, false]], seg: 12, wallTint: WARM });
      baluster(fb, -(u === 0 ? 1.3 : .75), (u === 0 ? 1.3 : .75), 5.0, 6.1, 0);
      LB(M.stone, fb, -w / 2 - .15, 0, 0, w / 2 + .15, .09, .8, [1, 1, 1], 1.2); LB(M.stone, fb, -w / 2 - .05, .09, 0, w / 2 + .05, .18, .45, [1, 1, 1], 1.2);
    }
    for (const u of [-4.8, -1.9, 1.9, 4.8]) { const fp = FR(xc + u, zp, 1, 0); LB(M.cream, fp, -.24, .55, 0, .24, 4.5, .28, CREAM); LB(M.cream, fp, -.3, 4.2, 0, .3, 4.58, .36, CREAM); LB(M.cream, fp, -.24, 5.0, 0, .24, 8.6, .24, CREAM); LB(M.cream, fp, -.3, 8.2, 0, .3, 8.62, .32, CREAM); }
    for (const e of [-1, 1]) LB(M.cream, f, e > 0 ? 4.0 : -4.95, 0, 0, e > 0 ? 4.95 : -4.0, .55, .3, CREAM);
    courses(f, -4.95, 4.95);
    /* 山花：洋葱形(ogee)轮廓 + 雕花边 + 圆花窗 + 三个小拱窗 */
    const h0 = WH + .2, H = [[-4.8, 0], [-4.8, 2.3], [-4.4, 3.3], [-3.5, 4.0], [-2.6, 4.7], [-1.8, 5.7], [-1.1, 6.9], [-.45, 7.9], [0, 8.4], [.45, 7.9], [1.1, 6.9], [1.8, 5.7], [2.6, 4.7], [3.5, 4.0], [4.4, 3.3], [4.8, 2.3], [4.8, 0]];
    const out = H.map(p => [p[0], h0 + p[1]]);
    fan(M.brick, f, out, [0, h0 + 1.5], -.03, WARM, TB);
    { const inn = offsetPts(out, -.5), mid = offsetPts(out, .0), cap = offsetPts(out, .2);
      for (let i = 1; i < out.length - 2; i++) {
        Q(M.lace, f, [[mid[i][0], mid[i][1], .12], [mid[i + 1][0], mid[i + 1][1], .12], [inn[i + 1][0], inn[i + 1][1], .12], [inn[i][0], inn[i][1], .12]], [0, 0, 1], (u, y) => [(f.s + u) / 1.28, -y / 1.28]);
        Q(M.cream, f, [[cap[i][0], cap[i][1], .22], [cap[i + 1][0], cap[i + 1][1], .22], [mid[i + 1][0], mid[i + 1][1], .22], [mid[i][0], mid[i][1], .22]], [0, 0, 1], uvFront(f));
        const du = cap[i + 1][0] - cap[i][0], dy = cap[i + 1][1] - cap[i][1], L = Math.hypot(du, dy) || 1;
        Q(M.cream, f, [[cap[i][0], cap[i][1], 0], [cap[i + 1][0], cap[i + 1][1], 0], [cap[i + 1][0], cap[i + 1][1], .22], [cap[i][0], cap[i][1], .22]], [-dy / L, du / L, 0], (u, y, d) => [(f.s + u + d) / TB, -y / TB], [.9, .88, .84]);
      } }
    disc2(M.cream, f, 0, h0 + 4.6, 1.15, .1, CREAM, TB, 24); disc2(M.lace, f, 0, h0 + 4.6, .95, .13, CREAM, 1.28, 24); disc2(M.inner, f, 0, h0 + 4.6, .32, .15, [1, 1, 1], 64, 16);
    for (const u of [-1.9, 0, 1.9]) arcBay(M, FR(xc + u, zp, 1, 0), { bw: u === 0 ? 1.3 : 1.1, w: u === 0 ? 1.3 : 1.1, y0: h0 + .35, ySp: h0 + 1.6, yTop: h0 + 2.6, yMax: h0 + 2.95, depth: .02, pier: 'cream', bands: [[.14, .07, true]], seg: 10, wallTint: WARM, noFloor: true });
    /* 肩部与顶部小尖塔 */
    for (const e of [-1, 1]) { LB(M.cream, f, e * 4.5 - .55, WH, 0, e * 4.5 + .55, h0 + 2.7, .6, CREAM); finial(xc + e * 4.5, zp + .3, h0 + 2.7, .85); }
    finial(xc, zp + .15, h0 + 8.3, .8);
    obs(xc - 4.8, ZF - 14, xc + 4.8, zp + .1);
  }

  /* =================================================================
     钟楼（方塔身 4 面立体窗拱 + 钟面 + 圆形凉廊 + 宝塔檐 + 铜顶）
     ================================================================= */
  const clk = new MB();
  {
    const tcz = ZF - 2.3, TOP = 21.5, TINT = [1.06, 1.02, .98];
    const tb = new MB(); tb.box(-2.9, 0, tcz - 2.9, 2.9, TOP, tcz + 2.9, [.95, .8, .7], [TB, TB], { noTop: true, noFront: true }); add(tb, { tex: X.brick, ...emS('#8a5a3a', 0, .5) });
    { const ff = FR(0, tcz + 3.5, 1, 0); Q(M.brick, ff, [[-3.5, 9, -.6], [3.5, 9, -.6], [3.5, TOP, -.6], [-3.5, TOP, -.6]], [0, 0, 1], uvFront(ff), TINT); }
    const faces = [[FR(0, tcz + 3.5, 1, 0), true], [FRn(3.5, tcz, 0), false], [FRn(-3.5, tcz, PI), false], [FRn(0, tcz - 3.5, -PI / 2), false]];
    const sub = (f, u) => FR(f.x + f.tx * u, f.z + f.tz * u, f.tx, f.tz);
    for (const [f, front] of faces) {
      for (const e of [-1, 1]) LB(M.cream, f, e > 0 ? 3.0 : -3.62, 0, 0, e > 0 ? 3.62 : -3.0, TOP - .1, .34, CREAM);
      for (const [y0, y1] of [[9.0, 9.5], [13.3, 13.65], [16.9, 17.25]]) { LB(M.cream, f, -3.7, y0, 0, 3.7, y0 + (y1 - y0) * .5, .4, CREAM); LB(M.cream, f, -3.7, y0 + (y1 - y0) * .5, 0, 3.7, y1, .5, CREAM); }
      LB(M.cream, f, -3.9, 20.3, 0, 3.9, 20.6, .45, CREAM); LB(M.cream, f, -3.95, TOP, 0, 3.95, TOP + .45, .6, CREAM); dentils(f, -3.7, 3.7, 20.1, 20.3, .4, .26);
      if (front) arcBay(M, f, { bw: 7, w: 2.9, y0: 0, ySp: 3.8, yTop: 6.3, yMax: 9.0, depth: 3.2, pier: 'brick', bands: [[.4, .14, true], [.16, .26, false]], gate: .5, seg: 18, wallTint: TINT });
      else for (const s of [-1.75, 1.75]) arcBay(M, sub(f, s), { bw: 3.5, w: 1.3, y0: 2.4, py0: 0, ySp: 4.7, yTop: 6.0, yMax: 9.0, depth: .5, pier: 'brick', bands: [[.2, .08, true]], seg: 10, wallTint: TINT });
      if (front) LB(M.stone, f, -2.0, 0, 0, 2.0, .1, 1.0, [1, 1, 1], 1.2), LB(M.stone, f, -1.8, .1, 0, 1.8, .2, .55, [1, 1, 1], 1.2);
      for (const s of [-1.75, 1.75]) arcBay(M, sub(f, s), { bw: 3.5, w: .95, y0: 10.2, py0: 9.5, ySp: 11.9, yTop: 13.0, yMax: 13.3, depth: .5, pier: 'brick', bands: [[.17, .08, true]], seg: 10, wallTint: TINT });
      for (const s of [-2.333, 0, 2.333]) arcBay(M, sub(f, s), { bw: 2.333, w: .62, y0: 14.1, py0: 13.65, ySp: 15.9, yTop: 16.7, yMax: 16.9, depth: .4, pier: 'brick', bands: [[.12, .06, true]], seg: 8, wallTint: TINT, noFloor: true });
      arcBay(M, f, { bw: 7, w: 3.4, y0: 17.35, py0: 17.25, ySp: 18.9, yTop: 20.05, yMax: 20.3, depth: .35, pier: 'brick', bands: [[.28, .1, true], [.1, .2, false]], seg: 14, wallTint: TINT, noFloor: true });
      { const cd = -.2, rr = 1.18, cy = 18.7; Q(clk, f, [[-rr, cy - rr, cd], [rr, cy - rr, cd], [rr, cy + rr, cd], [-rr, cy + rr, cd]], [0, 0, 1], (u, y) => [(u + rr) / (2 * rr), 1 - (y - (cy - rr)) / (2 * rr)]); }
      for (let k = 0; k < 6; k++) arcBay(M, sub(f, (k - 2.5) * 7 / 6), { bw: 7 / 6, w: .62, y0: 20.7, py0: 20.6, ySp: 21.0, yTop: 21.3, yMax: TOP, depth: .35, pier: 'cream', bands: [], seg: 6, wallTint: TINT, noFloor: true });
      baluster(f, -3.45, 3.45, TOP + .45, TOP + 1.3, .2);
    }
    add(clk, { tex: X.clock, em: X.clockE, emDay: 0, emNight: 1.2 });
    for (const [px, pz] of [[-3.6, tcz - 3.6], [3.6, tcz - 3.6], [-3.6, tcz + 3.6], [3.6, tcz + 3.6]]) { M.cream.box(px - .32, TOP + .45, pz - .32, px + .32, TOP + 1.9, pz + .32, CREAM, [1, 1]); finial(px, pz, TOP + 1.9, .62); }
    /* 圆形凉廊（12 边形）*/
    const y0 = TOP + .45, cz = tcz; const ring = 12, R0 = 2.6, ap = R0 * Math.cos(PI / ring), bwr = 2 * R0 * Math.sin(PI / ring);
    for (let k = 0; k < ring; k++) { const ph = k * TAU / ring + PI / ring, f = FRn(Math.cos(ph) * ap, cz + Math.sin(ph) * ap, ph);
      arcBay(M, f, { bw: bwr, w: .95, y0: y0 + .1, ySp: y0 + 1.6, yTop: y0 + 2.6, yMax: y0 + 2.95, depth: .8, pier: 'cream', wallMB: M.cream, bands: [[.12, .06, true]], seg: 10, noFloor: true });
      LB(M.cream, f, -bwr / 2, y0 + .1, 0, bwr / 2, y0 + .55, .12, CREAM); }
    lathe(M.cream, 0, cz, [[3.1, y0 + 2.9], [3.2, y0 + 3.3], [2.8, y0 + 3.5], [2.2, y0 + 3.5]], 36, CREAM);
    const yb = y0 + 3.5;
    lathe(M.copperD, 0, cz, [[3.5, yb, 0], [3.9, yb + .25, .2], [3.5, yb + .65, .4], [2.5, yb + .9, .6], [3.0, yb + 1.2, .8], [2.55, yb + 1.7, 1]], 32, [1, 1, 1], 1);
    lathe(M.copper, 0, cz, [[2.45, yb + 1.6, 1], [2.85, yb + 2.3, .85], [3.0, yb + 3.1, .65], [2.7, yb + 3.9, .45], [1.9, yb + 4.8, .3], [1.0, yb + 5.6, .15], [.35, yb + 6.2, .05], [.1, yb + 6.5, 0]], 32, [1, 1, 1], 1);
    lathe(M.gold, 0, cz, [[.15, yb + 6.2], [.22, yb + 6.6], [.12, yb + 7.1], [.04, yb + 8.7]], 8, [1, .82, .4]);
    obs(-3.65, ZF - 6, 3.65, ZF + 1.35);
  }

  /* =================================================================
     两座圆塔：12 边形塔身（立体拱窗）+ 凉廊 + 铜顶 + 弧形外楼梯
     ================================================================= */
  for (const sx of [-1, 1]) {
    const cx = sx * 20, cz = ZF - 2.0, ring = 12;
    const faceBay = (r, fn) => { const ap = r * Math.cos(PI / ring), bw = 2 * r * Math.sin(PI / ring); for (let k = 0; k < ring; k++) { const ph = k * TAU / ring + PI / ring; if (Math.sin(ph) < -.7) continue; fn(FRn(cx + Math.cos(ph) * ap, cz + Math.sin(ph) * ap, ph), bw, ph); } };
    { const bb = new MB(); bb.cyl(cx, cz, 0, WH, 2.5, 2.5, 12, [.92, .78, .66]); add(bb, { tex: X.brick }); }
    faceBay(4.2, (f, bw) => {
      arcBay(M, f, { bw, w: 1.45, y0: 0, ySp: 2.7, yTop: 4.0, yMax: 4.58, depth: 1.4, pier: 'brick', bands: [[.22, .08, true], [.08, .16, false]], gate: .3, seg: 12, wallTint: WARM });
      arcBay(M, f, { bw, w: 1.3, y0: 5.0, ySp: 7.15, yTop: 8.2, yMax: 8.75, depth: 1.4, pier: 'cream', bands: [[.18, .07, true]], seg: 10, wallTint: WARM });
      baluster(f, -.65, .65, 5.0, 6.1, 0);
      LB(M.cream, f, -bw / 2 - .1, 4.58, 0, bw / 2 + .1, 4.8, .3, CREAM); LB(M.cream, f, -bw / 2 - .1, 4.8, 0, bw / 2 + .1, 5.0, .36, CREAM);
      LB(M.cream, f, -bw / 2 - .1, 8.78, 0, bw / 2 + .1, 8.95, .5, CREAM); LB(M.cream, f, -bw / 2 - .12, 8.95, 0, bw / 2 + .12, WH + .2, .64, CREAM);
      LB(M.cream, f, -.2, 5.0, 0, .2, 8.6, .22, CREAM, 1, { noSides: false });
    });
    for (let k = 0; k < ring; k++) { const ph = k * TAU / ring; if (Math.sin(ph) < -.7) continue; const fp = FRn(cx + Math.cos(ph) * 4.2 * Math.cos(PI / ring) * 1.0, cz + Math.sin(ph) * 4.2 * Math.cos(PI / ring), ph + PI / ring); void fp; }
    /* 凉廊 */
    lathe(M.cream, cx, cz, [[4.0, WH + .1], [4.5, WH + .2], [4.5, WH + .45], [3.7, WH + .6]], 36, CREAM);
    const y0 = WH + .6, Ru = 3.5;
    { const bb = new MB(); bb.cyl(cx, cz, y0, 14.0, 2.25, 2.25, 12, [.6, .5, .45]); add(bb, { tex: X.inner, em: X.innerE, emDay: 0, emNight: .8 }); }
    faceBay(Ru, (f, bw) => { arcBay(M, f, { bw, w: 1.3, y0: y0 + .1, ySp: 12.2, yTop: 13.35, yMax: 13.8, depth: .95, pier: 'cream', wallMB: M.cream, bands: [[.14, .06, true]], seg: 10, noFloor: true }); baluster(f, -.8, .8, y0 + .1, y0 + 1.05, .05); });
    lathe(M.cream, cx, cz, [[3.5, 13.8], [3.95, 13.9], [4.0, 14.25], [3.75, 14.5], [3.2, 14.5]], 36, CREAM);
    for (let k = 0; k < 32; k++) { const a = k / 32 * TAU, px = cx + Math.cos(a) * 3.65, pz = cz + Math.sin(a) * 3.65; M.cream.box(px - .06, 14.5, pz - .06, px + .06, 15.2, pz + .06, CREAM, [1, 1]); }
    lathe(M.cream, cx, cz, [[3.78, 15.2], [3.78, 15.35], [3.55, 15.35]], 36, CREAM);
    /* 圆顶座（小窗一圈）*/
    faceBay(3.2, (f, bw) => { arcBay(M, f, { bw, w: .55, y0: 15.5, ySp: 15.95, yTop: 16.45, yMax: 16.9, depth: .35, pier: 'cream', wallMB: M.cream, bands: [[.1, .05, true]], seg: 6, noFloor: true }); });
    lathe(M.cream, cx, cz, [[3.3, 16.9], [3.55, 16.95], [3.5, 17.2], [3.15, 17.25]], 36, CREAM);
    lathe(M.copperD, cx, cz, [[3.2, 17.2, 0], [3.7, 17.45, .2], [3.2, 17.85, .4]], 32, [1, 1, 1], 1);
    lathe(M.copper, cx, cz, [[3.15, 17.8, 1], [3.55, 18.5, .85], [3.7, 19.5, .65], [3.3, 20.5, .45], [2.4, 21.5, .3], [1.2, 22.4, .15], [.4, 23.0, .05], [.12, 23.3, 0]], 40, [1, 1, 1], 1);
    lathe(M.gold, cx, cz, [[.14, 23.0], [.2, 23.4], [.1, 23.9], [.04, 25.2]], 8, [1, .82, .4]);
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; finial(cx + Math.cos(a) * 3.7, cz + Math.sin(a) * 3.7, 15.35, .5); }
    /* ---- 弧形外楼梯：两侧各一段，爬向正面平台（高 4.58）---- */
    const r0 = 3.85, r1 = 6.5, sH = 4.58, nSt = 22;
    const radial = (r, a, y) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    const stairRun = (aLow, aHigh) => {
      for (let k = 0; k < nSt; k++) {
        const a0 = lerp(aLow, aHigh, k / nSt), a1 = lerp(aLow, aHigh, (k + 1) / nSt), yt = sH * (k + 1) / nSt, yp = sH * k / nSt, am = (a0 + a1) / 2;
        Qw(M.cream, radial(r0, a0, yt), radial(r1, a0, yt), radial(r1, a1, yt), radial(r0, a1, yt), [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]].map(p => [p[0] * 1.8, p[1] * .3]));
        const dirx = Math.sign(a1 - a0) * -Math.sin(am), dirz = Math.sign(a1 - a0) * Math.cos(am);
        Qw(M.cream, radial(r0, a0, yp), radial(r1, a0, yp), radial(r1, a0, yt), radial(r0, a0, yt), [-dirx, 0, -dirz], [[0, 1], [1, 1], [1, 0], [0, 0]].map(p => [p[0] * 1.8, p[1] * .3]), [.9, .88, .84]);
        const nO = [Math.cos(am), 0, Math.sin(am)], wy = (y) => y + 1.05;
        Qw(M.brick, radial(r0 + .0, a0, 0), radial(r0, a1, 0), radial(r0, a1, wy(yt) - .4), radial(r0, a0, wy(yt) - .4), [-nO[0], 0, -nO[2]], [[0, 0], [1, 0], [1, -1], [0, -1]]);
      }
    };
    const aL = PI / 2 - .4, aR = PI / 2 + .4;
    stairRun(.12, aL); stairRun(PI - .12, aR);
    Qw(M.cream, radial(r0, aL, sH), radial(r1, aL, sH), radial(r1, aR, sH), radial(r0, aR, sH), [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]].map(p => [p[0] * 2, p[1] * .6]));
    /* 外侧：层层升高的拱窗墙 + 栏杆（对照实景：楼梯外墙是一排随台阶抬高的拱形窗洞，顶上是小栏杆）*/
    const outerBays = (aLow, aHigh, flat) => {
      const span = aHigh - aLow, nb = Math.max(1, Math.round(Math.abs(span) / (1.45 / r1))), dth = span / nb, hAt = (th) => flat ? sH : sH * (th - aLow) / span;
      for (let j = 0; j < nb; j++) {
        const th0 = aLow + j * dth, th1 = th0 + dth, thm = (th0 + th1) / 2, lo = Math.min(hAt(th0), hAt(th1)), hi = Math.max(hAt(th0), hAt(th1));
        const f = FRn(cx + Math.cos(thm) * r1, cz + Math.sin(thm) * r1, thm), bw = Math.abs(dth) * r1, yMax = (lo + hi) / 2 + (flat ? 0 : .4);
        if (lo > 1.1) { const yTop = lo - .25; arcBay(M, f, { bw, w: Math.min(.9, bw - .5), y0: 0, ySp: Math.max(.45, yTop - .75), yTop, yMax, depth: 1.45, pier: 'cream', bands: [[.15, .07, true], [.07, .13, false]], gate: flat ? .3 : 0, seg: 10, wallTint: WARM }); }
        else Q(M.brick, f, [[-bw / 2, 0, 0], [bw / 2, 0, 0], [bw / 2, Math.max(yMax, .5), 0], [-bw / 2, Math.max(yMax, .5), 0]], [0, 0, 1], uvFront(f), WARM);
        LB(M.cream, f, -bw / 2 - .04, yMax, -.1, bw / 2 + .04, yMax + .16, .22, CREAM);
        baluster(f, -bw / 2 + .05, bw / 2 - .05, yMax + .16, yMax + 1.05, .02);
        if (j % 2 === 0 || flat) LB(M.cream, f, -bw / 2 - .04, yMax + .16, -.1, -bw / 2 + .08, yMax + 1.1, .2, CREAM);
      }
    };
    outerBays(.12, aL, false); outerBays(PI - .12, aR, false); outerBays(aL, aR, true);
    obsC(cx, cz, r1 + .25);
  }

  /* ---------------- 护柱（不锈钢）+ 铁链（大厦前）---------------- */
  {
    const bo = new MB(), ch = new MB();
    for (let x = -118; x <= 118; x += 4) { bo.cyl(x, -24.7, .08, .95, .14, .12, 10, [1, 1, 1], true); bo.sphere(x, 1.0, -24.7, .15, .1, .15, [1, 1, 1], 6); bo.box(x - .17, 0, -24.7 - .17, x + .17, .1, -24.7 + .17, [.6, .6, .62]);
      for (let k = 0; k < 8; k++) { const u0 = k / 8, u1 = (k + 1) / 8, y0 = .84 - .24 * Math.sin(u0 * PI), y1 = .84 - .24 * Math.sin(u1 * PI); ch.box(x + 4 * u0 + .13, y0 - .03, -24.7 - .03, x + 4 * u1 + .13, y1 + .03, -24.7 + .03, [.2, .2, .22]); } }
    add(bo, { tex: X.steel }); add(ch, {});
  }
  /* ---------------- 路灯（黑色铸铁 + 横臂 + 白球灯 + 粽叶结 Ketupat 挂饰）---------------- */
  const lampPos = [];
  /* 整齐排布：大厦前人行道一排、马路对面（草坪侧）一排，x 位置一一对应、左右对称；避开圆塔楼梯；
     中央步道两侧成对；两侧步道内侧单排 */
  { let k = 0; for (let x = 5.5; x <= 83; x += 11, k++) { if (Math.abs(x - 20) < 8) continue; for (const sx of [-1, 1]) { lampPos.push([sx * x, -26.0, k % 2 === 0], [sx * x, -6.4, false]); } } }
  for (let z = 8; z <= 52; z += 11) for (const sx of [-1, 1]) lampPos.push([sx * 2.9, z, false]);
  for (let z = 8; z <= 52; z += 11) for (const sx of [-1, 1]) { const x = sx * 40.4; if (Math.hypot(x + 34, z - 4) < 8.5) continue; lampPos.push([x, z, false]); }
  {
    const lp = new MB(), gl = new MB(), hl = new MB(), kt = new MB();
    lampPos.forEach(([x, z, dec]) => {
      lp.box(x - .3, 0, z - .3, x + .3, .7, z + .3, [.14, .15, .17]); lp.cyl(x, z, .7, 5.4, .13, .08, 8, [.1, .1, .12]); lp.box(x - .2, 1.2, z - .2, x + .2, 1.35, z + .2, [.18, .19, .22]);
      lp.box(x - 1.3, 5.1, z - .05, x + 1.3, 5.2, z + .05, [.1, .1, .12]);
      for (const s of [-1, 1]) { gl.sphere(x + s * 1.3, 4.85, z, .3, .34, .3, [1, .95, .8], 8); halo(hl, x + s * 1.3, 4.85, z, .9, [1, .85, .5]); S.lamps.push({ x: x + s * 1.3, z, y: 4.85 }); }
      if (dec) for (const [dx, dy] of [[-.6, 4.1], [.6, 4.1], [0, 3.3]]) { const kx = x + dx, ky = dy, kz = z + .08; lp.box(kx - .015, ky + .65, kz - .015, kx + .015, 5.1, kz + .015, [.2, .2, .2]);
        Qw(kt, [kx, ky - .6, kz], [kx + .27, ky, kz], [kx, ky + .6, kz], [kx - .27, ky, kz], [0, 0, 1], [[.5, 1], [1, .5], [.5, 0], [0, .5]]); Qw(kt, [kx + .27, ky, kz], [kx, ky - .6, kz], [kx - .27, ky, kz], [kx, ky + .6, kz], [0, 0, -1], [[1, .5], [.5, 1], [0, .5], [.5, 0]]); }
    });
    add(lp, {}); add(gl, { tex: R.white, ...emS('#ffe6b0', .1, 1.5) }); add(hl, { tex: T.glow, mode: 2, glow: e => e.night * .4 }); add(kt, { tex: X.ketupat, ...emS('#505020', 0, .3) });
  }

  /* ---------------- 旗杆 + 维多利亚喷泉 ---------------- */
  {
    const fx = -62, fz = 14, fp = new MB();
    lathe(fp, fx, fz, [[2.2, 0], [2.0, .5], [1.4, .7]], 20, [.8, .8, .8]); fp.cyl(fx, fz, .6, 70, .33, .12, 14, [.92, .92, .94], true); fp.sphere(fx, 71, fz, .35, .35, .35, [1, .85, .35], 8);
    add(fp, {}); obsC(fx, fz, 2.3);
    const fl = new MB(), fx2 = fx + .12; fl.quad([fx2, 68.5, fz], [fx2 + 11, 68.5, fz + 1.6], [fx2 + 11, 74.4, fz + 1.6], [fx2, 74.4, fz], [0, 0, 1], [0, 0, 1, 1]); fl.quad([fx2 + 11, 68.5, fz + 1.6], [fx2, 68.5, fz], [fx2, 74.4, fz], [fx2 + 11, 74.4, fz + 1.6], [0, 0, -1], [0, 0, 1, 1]); add(fl, { tex: X.flag });
  }
  {
    const cx = -34, cz = 4, fS = new MB(), fT = new MB(), fB = new MB(), fW = new MB(), fM = new MB();
    lathe(fS, cx, cz, [[5.75, 0, 0], [5.75, .75, .3], [5.2, .75, .5], [5.2, .35, .8]], 44, [1, 1, 1], 6);
    fM.disc(cx, cz, .12, 5.2, 44, [1, 1, 1]); fW.disc(cx, cz, .52, 5.15, 44, [.72, .95, 1]);
    lathe(fT, cx, cz, [[3.5, .1, 0], [3.5, .95, .5], [3.35, 1.05, .6], [3.0, 1.05, .8]], 36, [1, 1, 1], 4); lathe(fT, cx, cz, [[3.35, .5, 0], [3.0, .5, 1]], 36, [1, 1, 1]);
    lathe(fB, cx, cz, [[3.0, 1.05, 0], [3.35, 1.25, .1], [3.5, 1.6, .25], [3.25, 1.8, .4], [2.5, 1.75, .55], [1.7, 1.5, .7], [1.4, 1.7, .9]], 40, [1, 1, 1], 4);
    fW.disc(cx, cz, 1.72, 3.1, 36, [.72, .95, 1]);
    fB.cyl(cx, cz, 1.7, 3.3, 1.35, 1.3, 14, [.8, .8, .8]);
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, a2 = a + PI / 6, px = cx + Math.cos(a) * 1.5, pz = cz + Math.sin(a) * 1.5; fB.cyl(px, pz, 1.8, 3.15, .17, .14, 8, [.9, .9, .88]); fB.sphere(px, 3.22, pz, .24, .12, .24, [.9, .9, .88], 6);
      const nx = cx + Math.cos(a2) * 1.42, nz = cz + Math.sin(a2) * 1.42; fB.box(nx - .3, 1.9, nz - .3, nx + .3, 2.9, nz + .3, [.5, .55, .45], [1, 1], {}); fB.sphere(nx, 2.5, nz, .4, .52, .4, [1, 1, 1], 6); fB.sphere(nx + Math.cos(a2) * .25, 3.0, nz + Math.sin(a2) * .25, .2, .2, .2, [1, 1, 1], 6); }
    lathe(fB, cx, cz, [[1.95, 3.15, 0], [1.95, 3.45, .2], [1.6, 3.5, .3], [1.5, 3.4, .4]], 24, [1, 1, 1], 4);
    lathe(fB, cx, cz, [[1.5, 3.45, 0], [2.5, 3.7, .2], [2.75, 4.05, .4], [2.5, 4.2, .5], [1.2, 4.0, .8], [.7, 3.8, 1]], 36, [1, 1, 1], 4); fW.disc(cx, cz, 4.02, 2.4, 32, [.72, .95, 1]);
    lathe(fB, cx, cz, [[.6, 3.9, 0], [.5, 4.3, .2], [.8, 4.5, .3], [.45, 4.8, .5], [.6, 5.1, .7], [.4, 5.3, 1]], 16, [1, 1, 1], 3);
    lathe(fB, cx, cz, [[.4, 5.2, 0], [1.4, 5.4, .3], [1.55, 5.7, .6], [1.25, 5.75, .8], [.3, 5.6, 1]], 28, [1, 1, 1], 3); fW.disc(cx, cz, 5.62, 1.3, 24, [.72, .95, 1]);
    lathe(fB, cx, cz, [[.3, 5.6, 0], [.22, 6.0, .2], [.55, 6.25, .4], [.2, 6.55, .6], [.34, 6.85, .8], [.08, 7.5, 1]], 14, [1, 1, 1], 3);
    add(fS, { tex: X.stone }); add(fM, { tex: X.mosaic }); add(fW, { tex: X.mosaic, ...emS('#4ab8e8', .12, .55) }); add(fT, { tex: X.tileGreen }); add(fB, { tex: X.bronze, ...emS('#6a5a3a', 0, .35) });
    obsC(cx, cz, 5.9);
    /* 池边水雾（发光小粒子）*/
    const mist = new MB(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; halo(mist, cx + Math.cos(a) * 1.6, 4.4, cz + Math.sin(a) * 1.6, .5, [.8, .95, 1]); halo(mist, cx + Math.cos(a) * 3.2, 2.1, cz + Math.sin(a) * 3.2, .45, [.8, .95, 1]); } add(mist, { tex: T.glow, mode: 2, glow: e => .25 + e.night * .2 });
  }
  /* ---------------- 树（雨树 / 椰影）---------------- */
  {
    const tr = new MB(), rr = rnd(77);
    [[-62, -26.8], [60, -26.8], [-62, -3.2], [75.5, -3.2], [-72, 14], [72, 16], [-52, 40], [56, 38], [-24, 46], [26, 48]].forEach(([x, z]) => {
      const h = 3.6 + rr() * 1.6; tr.cyl(x, z, 0, h, .4, .22, 8, [.32, .24, .18]); tr.cyl(x + .3, z, h * .6, h + .8, .15, .08, 6, [.32, .24, .18]);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rr(), dd = k === 0 ? 0 : 1.2 + rr() * .5, g = .42 + rr() * .2; tr.sphere(x + Math.cos(a) * dd, h + 1.0 + rr() * .8, z + Math.sin(a) * dd, 1.5 + rr() * .5, 1.1 + rr() * .3, 1.5 + rr() * .5, [.16 * g * 2, g * 1.1, .2 * g * 1.3], 7); }
    });
    add(tr, {});
  }

  /* ---------------- 背景高楼 + KL Tower ---------------- */
  {
    const bg = [[-40, -92, 26, 58, 15, 'twConc'], [18, -118, 20, 76, 18, 'twGlass'], [-4, -98, 0, 40, 0, 'round'], [66, -104, 22, 60, 16, 'twDark'], [-84, -112, 22, 80, 18, 'twTeal'], [84, -140, 24, 100, 20, 'twConc'], [-112, -148, 24, 110, 20, 'twGlass'], [116, -164, 24, 120, 20, 'twDark'], [-58, -140, 20, 86, 18, 'twDark'], [44, -150, 22, 92, 18, 'twTeal']];
    bg.forEach(([x, z, w, h, d, ty]) => {
      if (ty === 'round') { const m = new MB(); lathe(m, x, z, [[10, 0, 0], [10, h, 1]], 28, [1, 1, 1], 5); add(m, { tex: X.twTeal, em: X.twTealE, emDay: 0, emNight: 1 }); const c = new MB(); c.cyl(x, z, h, h + 1.2, 10.3, 10.3, 28, [.7, .72, .74], true); c.cyl(x, z, h + 1.2, h + 4, 5, 5, 16, [.6, .62, .64], true); add(c, {}); return; }
      const m = new MB(); m.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, [1, 1, 1], [32, 105]); add(m, { tex: X[ty], em: X[ty + 'E'], emDay: 0, emNight: 1 });
      const r = new MB(); r.box(x - w * .3, h, z - d * .25, x + w * .1, h + 3, z + d * .25, [.55, .56, .58]); r.box(x + w * .15, h, z - d * .2, x + w * .35, h + 5, z, [.6, .6, .62]); add(r, {});
    });
    const mk = (text, x, y, z, w, h, bgc, fg, bd) => { const sg = T.sign(text, { w: 512, h: 128, fs: 76, bg: bgc, fg, border: bd }), sb = new MB(); sb.box(x - w / 2, y, z, x + w / 2, y + h, z + .6, [1, 1, 1], [w, h], { noBack: true, noSides: true, noTop: true }); add(sb, { tex: sg.tex, em: sg.em, emDay: .25, emNight: 2.2 }); };
    mk('OCBC', -40, 48, -84.4, 15, 4, '#8a8f93', '#d2232a', '#b0b4b8'); mk('Bank Muamalat', -4, 30, -87.8, 14, 3, '#1c5aa8', '#ffffff', '#6aa0e0'); mk('CCB', 18, 64, -126.4, 10, 4, '#2c6aa0', '#ffffff', '#8ab8e0');
    /* KL Tower：混凝土塔身 + 观景舱 + 红白天线 */
    const kx = 30, kz = -170, kt = new MB(), kp = new MB(), ka = new MB();
    lathe(kt, kx, kz, [[6.5, 0, 0], [5.4, 40, .2], [4.0, 150, .6], [3.4, 210, 1]], 20, [1, 1, 1], 3); add(kt, { tex: X.shaft });
    lathe(kp, kx, kz, [[3.4, 205, 0], [7.5, 212, .1], [10.5, 222, .3], [10.8, 232, .6], [8.0, 240, .8], [4.5, 246, .95], [3.2, 250, 1]], 28, [1, 1, 1], 3); add(kp, { tex: X.pod, em: X.podE, emDay: 0, emNight: 1.2 });
    lathe(ka, kx, kz, [[1.6, 250, 0], [1.0, 275, .5], [.35, 330, 1]], 8, [1, 1, 1], 1); add(ka, { tex: X.mast });
    /* Merdeka 118 */
    const tw = new MB(); lathe(tw, -190, -190, [[16, 0, 1], [14, 60, .8], [10.5, 130, .55], [7, 190, .3], [3.5, 235, .1], [1.0, 262, 0], [.3, 300, 0]], 24, [1, 1, 1], 4); add(tw, { tex: X.twGlass, em: X.twGlassE, emDay: 0, emNight: .8 });
  }

  /* ---------------- 提交所有材质批次 ---------------- */
  add(M.brick, { tex: X.brick, ...emS('#8a5a3a', 0, .5) });
  add(M.cream, { tex: X.stucco, ...emS('#b08a52', 0, .62) });
  add(M.lace, { tex: X.lace, ...emS('#b08a52', 0, .62) });
  add(M.stone, { tex: X.stone, ...emS('#4a3a2a', 0, .3) });
  add(M.inner, { tex: X.inner, em: X.innerE, emDay: 0, emNight: .85 });
  add(M.gate, { tex: X.gate, em: X.gateE, emDay: 0, emNight: 1 });
  add(M.tile, { tex: X.tile, ...emS('#8a3a1a', 0, .5) });
  add(M.copper, { tex: X.copper, em: X.copperE, emDay: 0, emNight: .8 });
  add(M.copperD, { tex: X.copper, em: X.copperE, emDay: 0, emNight: .5 });
  add(M.gold, { tex: R.white, ...emS('#ffcc66', 0, .8) });
  add(M.flags, { tex: X.flag });
  add(M.iron, { tex: R.white, ...emS('#101010', 0, 0) });

  /* ---------------- STARGO 电动踏板租借点（大厦最右边、大马路南侧人行道，路灯 x=60.5 与 71.5 之间）---------------- */
  if (G.Scooter) {
    const DX = 66.4, DY = .1, list = [], PUR = G.Scooter.COLORS[0].hex;
    [[-3.2, -7.05], [-1.1, -7.05], [1.0, -7.05], [-2.15, -5.05], [-.05, -5.05], [2.05, -5.05]].forEach(([dx, z]) => list.push({ x: DX + dx, y: DY, z, yaw: Math.PI / 2, hex: PUR }));
    /* 停车位：被租走的踏板从停车位消失（我自己 / 远程玩家借走的），还车后回到原位 */
    const dock = { x: DX, z: -6.05, r: 4.2, list, key: '', cur: [], G: null };
    const taken = () => { const t = new Set(), g = dock.G; if (g) { if (g.me && g.me.ride) t.add(g.me.ride.slot); (g.remotes || []).forEach(e => { if (e.ride && e.ride.slot >= 0) t.add(e.ride.slot); }); } return t; };
    const rebuild = () => {
      const t = taken(), key = [...t].sort().join(','); if (key === dock.key && dock.cur.length) return; dock.key = key;
      dock.cur.forEach(b => { const i = S.batches.indexOf(b); if (i >= 0) S.batches.splice(i, 1); });
      dock.cur = G.Scooter.parked(R, list.filter((_, i) => !t.has(i)), 1.5); dock.cur.forEach(b => S.batches.push(b));
    };
    dock.freeSlot = (any, x, z) => { const t = taken(); let best = -1, bd = 1e9; list.forEach((it, i) => { if (t.has(i)) return; const d = x == null ? i : Math.hypot(it.x - x, it.z - z); if (d < bd) { bd = d; best = i; } }); return best; };
    dock.refresh = () => rebuild(); dock.sync = g => { dock.G = g; rebuild(); };
    S.scooterDock = dock; rebuild();
    S.hotspots.push({ id: 'scooter_rent', x: DX, z: -6.05, r: 3.4, btn: '租借', icon: '🛴', color: [.6, .45, 1] });
    S.onUse = (n) => { if (n.id === 'scooter_rent' && window.ScooterRide) { ScooterRide.openRental(); return true; } return false; };
    /* 地面：车位白线（每车一格）*/
    const bay = new MB(), BW = .035, BY = DY + .012;
    list.forEach(it => { const x0 = it.x - 1.05, x1 = it.x + 1.15, z0 = it.z - .5, z1 = it.z + .5, W = [.93, .93, .97];
      bay.floor(x0, z0 - BW, x1, z0 + BW, BY, W); bay.floor(x0, z1 - BW, x1, z1 + BW, BY, W); bay.floor(x0 - BW, z0, x0 + BW, z1, BY, W); bay.floor(x1 - BW, z0, x1 + BW, z1, BY, W); });
    add(bay, { tex: R.white });
    /* 立牌（品牌 + 三档价格）*/
    const sx = DX + 4.15, sz = -7.4, post = new MB(); post.box(sx - .07, DY, sz - .21, sx + .07, DY + 3.2, sz - .07, [.2, .16, .36]); post.box(sx - .6, DY + .6, sz - .09, sx + .6, DY + .66, sz - .06, [.2, .16, .36]); add(post, { tex: R.white });
    const panel = (text, o, y0, y1, dN) => { const sg = T.sign(text, Object.assign({ w: 512, h: Math.round(512 * (y1 - y0) / 1.5), fs: 56, bg: '#2a1a5e', fg: '#fff', border: '#9b7bff' }, o)), pb = new MB(); pb.box(sx - .75, DY + y0, sz - .06, sx + .75, DY + y1, sz + .06, [1, 1, 1], [1.5, y1 - y0], { noSides: true, noTop: true }); add(pb, { tex: sg.tex, em: sg.em, emDay: .45, emNight: dN || 1.5 }); };
    panel('STARGO', { fs: 92, bg: '#3a1f8f', border: '#b79bff' }, 2.55, 3.25); panel('电动踏板', { fs: 70, bg: '#2a1a5e' }, 2.0, 2.55);
    panel('2分钟 · 30', { bg: '#1b1240', fg: '#ffe27a' }, 1.55, 2.0, 1.3); panel('5分钟 · 50', { bg: '#1b1240', fg: '#ffe27a' }, 1.1, 1.55, 1.3); panel('10分钟 · 80', { bg: '#1b1240', fg: '#ffe27a' }, .65, 1.1, 1.3);
    obs(sx - .12, sz - .12, sx + .12, sz + .12);
    /* 指路牌：带箭头的「STARGO 电动踏板」牌，立在去租借点的路上（草坪 / 人行道），玩家走到哪都能看到方向 */
    const arrowSign = (x, z, dir, y0) => {
      const dist = Math.max(1, Math.round(Math.hypot(DX - x, -6.05 - z))), bw = 2.0, bh = 1.47, base = y0 || 0;
      const tx = R.paint(512, 376, (g, w, h) => {
        const rr = (x0, y0_, ww, hh, r) => { g.beginPath(); g.moveTo(x0 + r, y0_); g.arcTo(x0 + ww, y0_, x0 + ww, y0_ + hh, r); g.arcTo(x0 + ww, y0_ + hh, x0, y0_ + hh, r); g.arcTo(x0, y0_ + hh, x0, y0_, r); g.arcTo(x0, y0_, x0 + ww, y0_, r); g.closePath(); };
        g.fillStyle = '#2a1a5e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9b7bff'; g.lineWidth = 12; rr(8, 8, w - 16, h - 16, 26); g.stroke();
        g.fillStyle = '#3a1f8f'; rr(22, 22, w - 44, 92, 16); g.fill();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 italic 58px "Arial Black",Impact,sans-serif'; g.fillText('STARGO', w * .36, 70); g.font = '800 40px sans-serif'; g.fillText('电动踏板', w * .78, 70);
        g.fillStyle = '#ffe27a'; g.save(); g.translate(w * .5, 218); g.rotate(dir === 'N' ? -Math.PI / 2 : dir === 'W' ? Math.PI : 0);
        g.beginPath(); g.moveTo(-120, -30); g.lineTo(30, -30); g.lineTo(30, -72); g.lineTo(125, 0); g.lineTo(30, 72); g.lineTo(30, 30); g.lineTo(-120, 30); g.closePath(); g.fill(); g.restore();
        g.fillStyle = '#fff'; g.font = '800 40px sans-serif'; g.fillText('租借点 约 ' + dist + ' 米', w / 2, 330);
      });
      const pb = new MB(), pm = new MB(), y1 = base + 2.0, y2 = y1 + bh;
      pm.box(x - .06, base, z - .17, x + .06, y2 - .1, z - .07, [.2, .16, .36]);
      pb.box(x - bw / 2, y1, z - .06, x + bw / 2, y2, z + .06, [1, 1, 1], [bw, bh], { noSides: true, noTop: true });
      add(pm, { tex: R.white }); add(pb, { tex: tx, em: tx, emDay: .45, emNight: 1.4 }); obs(x - .12, z - .2, x + .12, z - .04);
    };
    [[-28, -5.3, 'E', .1], [10, 1.8, 'E'], [30, -5.3, 'E', .1], [48, -5.3, 'E', .1], [50, -24.9, 'E', .1], [66.4, 3.2, 'N'], [58, 40, 'N']].forEach(a => arrowSign(a[0], a[1], a[2], a[3]));
  }

  /* ---------------- 传送门 + 边界 ---------------- */
  S.portals.push({ id: 'plaza', x: 64, z: 50, r: 2.0, label: '回到星光广场', color: [.4, 1, .7], spawn: [0, 12.5] }); S.exitPortal = S.portals[0];
  S.bounds = { x0: -78, x1: 78, z0: ZF + .4, z1: 57 };
  S.spawn = [0, 6];
  S.camera = { dist: 26, pitch: .34, fov: .95, clampX: [-56, 56], clampZ: [-22, 48], lead: 3 };
  S.cameraWide = { dist: 34, pitch: .2, fov: 1.1, clampX: [-56, 56], clampZ: [-22, 48], lead: 3 };
  S.walkable = (x, z) => x > S.bounds.x0 && x < S.bounds.x1 && z > S.bounds.z0 && z < S.bounds.z1;
  S.npcRect = { x0: -70, x1: 70, z0: -28, z1: 54 }; S.npcCount = 70;
  S.heightAt = () => 0;
  const PAVE = [[-78, -4.5, 78, -1.8], [-78, 56, 78, 58], [-1.6, -1.8, 1.6, 56], [-45, -1.8, -41.8, 56], [41.8, -1.8, 45, 56]];   // 与 PB() 铺装同一批矩形，高 .115
  S.floorY = (x, z) => {   // 地板比地面高的地方（踏板过去时抬高，避免车轮被盖住）
    for (const r of PAVE) if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) return .12;
    if ((z < -24 && z > ZF - 6) || (z > -8 && z < -4.5)) return .12;
    return 0;
  };
  S.name = '独立广场'; S.indoor = false;
  S.env = (h) => { const e = Object.assign({}, envAt(h)); e.fog = mix(e.bot, e.top, .9); e.fogNear = 110; e.fogFar = 380; return e; };
  return S;
}
G.Scenes = G.Scenes || {}; G.Scenes.makeMerdeka = makeMerdeka;
})(window);
