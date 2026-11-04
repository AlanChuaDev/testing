/* ktv.js — 「天皇巨星」KTV：共用工具包 + 1F 接待大堂 + 2F VIP 走廊 + 3F 包间走廊。
   包间在 ktvrooms.js。场景 id：ktv(1F) ktv2(2F) ktv3(3F) k2_1..k2_8 k3_1..k3_16。品牌名为虚构。 */
(function (G) {
'use strict';
const { MB, clamp } = G.World;
const PITCH = 0.5;
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const mul = (c, k) => [c[0] * k[0], c[1] * k[1], c[2] * k[2]];
const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const GOLD = [.93, .76, .36], IVORY = [.96, .93, .87], DARK = [.16, .12, .2], RED = [.62, .07, .16];
const F = (w, s) => `${w} ${s}px "Arial Black","PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`;

/* ---------- 房间/楼层布局表（走廊和包间共用） ---------- */
const DX = [-18.75, -14.25, -9.75, -5.25, 5.25, 9.75, 14.25, 18.75];
const WZ = [-0.5, 4, 8.5, 13];
const VIP = [['VIP 888', '金龙阁', 'dragon'], ['VIP 666', '凡尔赛厅', 'baroque'], ['VIP 168', '星河殿', 'star'], ['VIP 999', '赛博霓虹', 'cyber'], ['VIP 518', '海洋之心', 'ocean'], ['VIP 1688', '樱花和风', 'sakura'], ['VIP 8888', '翡翠花园', 'emerald'], ['VIP 6666', '皇家紫宴', 'royal']];
const STY3 = ['dragon', 'baroque', 'star', 'cyber', 'ocean', 'sakura', 'emerald', 'royal'];
const NAME3 = ['朱雀', '蔷薇', '银河', '电音', '珊瑚', '枫叶', '竹影', '紫晶', '赤焰', '白金', '极光', '霓虹', '碧海', '桃源', '翠谷', '丝绒'];
const ROOMS = {};
VIP.forEach((v, i) => { ROOMS['k2_' + (i + 1)] = { id: 'k2_' + (i + 1), floor: 2, num: v[0], name: v[1], style: v[2], variant: 0, door: [DX[i], -9.8], ret: [DX[i], -7.9], corridor: 'ktv2' }; });
for (let i = 0; i < 16; i++) {
  const id = 'k3_' + (i + 1), num = 'ROOM ' + (301 + i), st = STY3[i % 8], v = i < 8 ? 0 : 1; let door, ret;
  if (i < 8) { door = [DX[i], -9.8]; ret = [DX[i], -7.9]; } else if (i < 12) { const z = WZ[i - 8]; door = [-19.8, z]; ret = [-17.5, z]; } else { const z = WZ[i - 12]; door = [19.8, z]; ret = [17.5, z]; }
  ROOMS[id] = { id, floor: 3, num, name: NAME3[i] + '厅', style: st, variant: i < 8 ? 0 : 1, door, ret, corridor: 'ktv3', wing: i < 8 ? 0 : i < 12 ? -1 : 1 };
}
const isKtvId = (id) => id === 'ktv' || id === 'ktv2' || id === 'ktv3' || !!ROOMS[id];

/* ---------- 贴图（每个渲染器只画一次） ---------- */
const TEXC = new WeakMap();
function texs(R) {
  if (TEXC.has(R)) return TEXC.get(R); const X = {};
  X.bmarble = R.paint(512, 512, g => { g.fillStyle = '#1a141f'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#241b2b'; g.fillRect(0, 0, 256, 256); g.fillRect(256, 256, 256, 256); const r = rnd(5); g.strokeStyle = 'rgba(233,195,90,.35)'; g.lineWidth = 2; for (let i = 0; i < 22; i++) { g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - .5) * 90; y += (r() - .5) * 90; g.lineTo(x, y); } g.stroke(); } g.strokeStyle = '#d6a93e'; g.lineWidth = 5; g.strokeRect(2, 2, 508, 508); g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.moveTo(0, 256); g.lineTo(512, 256); g.stroke(); });
  X.cmarble = R.paint(512, 512, g => { g.fillStyle = '#efe6d8'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#d6c9b6'; g.fillRect(0, 0, 256, 256); g.fillRect(256, 256, 256, 256); const r = rnd(3); g.strokeStyle = 'rgba(120,100,80,.18)'; g.lineWidth = 2; for (let i = 0; i < 24; i++) { g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - .5) * 80; y += (r() - .5) * 80; g.lineTo(x, y); } g.stroke(); } g.strokeStyle = '#c9a24a'; g.lineWidth = 4; g.strokeRect(2, 2, 508, 508); });
  X.carpet = R.paint(256, 256, g => { g.fillStyle = '#7a0f26'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#e9c35a'; g.lineWidth = 10; g.strokeRect(5, 0, 246, 256); g.strokeStyle = '#c99a2e'; g.lineWidth = 3; g.strokeRect(22, -2, 212, 260); g.strokeStyle = 'rgba(233,195,90,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(128, 20); g.lineTo(190, 128); g.lineTo(128, 236); g.lineTo(66, 128); g.closePath(); g.stroke(); g.beginPath(); g.arc(128, 128, 22, 0, 7); g.stroke(); });
  X.damask = R.paint(256, 256, g => { g.fillStyle = '#efe3cf'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(190,150,70,.34)'; const d = (x, y) => { g.beginPath(); g.moveTo(x, y - 34); g.quadraticCurveTo(x + 22, y - 6, x, y + 34); g.quadraticCurveTo(x - 22, y - 6, x, y - 34); g.fill(); g.beginPath(); g.arc(x, y + 44, 7, 0, 7); g.fill(); }; d(64, 64); d(192, 64); d(64, 192); d(192, 192); d(128, 128); g.strokeStyle = 'rgba(190,150,70,.25)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256); });
  X.parquet = R.paint(256, 256, g => { const r = rnd(9); for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { const v = (r() - .5) * 26; g.fillStyle = `rgb(${186 + v},${140 + v},${92 + v})`; g.fillRect(x * 64 + (y % 2) * 32 - 32, y * 32, 62, 30); g.fillRect(x * 64 + (y % 2) * 32 + 32, y * 32, 62, 30); } g.strokeStyle = 'rgba(60,35,15,.45)'; g.lineWidth = 2; for (let y = 0; y <= 8; y++) { g.beginPath(); g.moveTo(0, y * 32); g.lineTo(256, y * 32); g.stroke(); } });
  X.stripe = R.paint(64, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 4; i++) g.fillRect(i * 16, 0, 5, 256); });
  TEXC.set(R, X); return X;
}

/* ---------- 工具包：每个场景一份 ---------- */
function kit(R, T) {
  const X = texs(R), S = { batches: [], obstacles: [], portals: [], hotspots: [], spots: [], lamps: [], seats: [], occluders: [] };
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
  const obs = (x0, z0, x1, z1, f) => S.obstacles.push({ x0, z0, x1, z1, f });
  const solid = (c) => R.solidTex([c[0] * 255, c[1] * 255, c[2] * 255, 255]);
  const emMat = (c, d, n) => ({ em: solid(c), emDay: d, emNight: n });
  const halo = (mb, x, y, z, s, col) => { const c = Math.cos(PITCH), sn = Math.sin(PITCH); const P = (a, b) => [x + a * s, y + c * b * s, z - sn * b * s]; mb.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col); };
  const pool = (mb, x, z, r, col, y) => mb.floor(x - r, z - r, x + r, z + r, y == null ? .03 : y, col);
  const night = k => e => .05 + e.night * k * .6;
  const lit = k => e => .16 + e.night * k * .5;                   // 霓虹类：白天也微亮
  const glowMat = (g) => ({ tex: T.glow, mode: 2, glow: g });
  const sgn = (text, o) => T.sign(text, Object.assign({ w: 768, h: 150, fs: 76, bg: '#14092a', fg: '#ffe9a8', border: '#e1b84e' }, o || {}));
  const signQuad = (mb, x0, x1, y0, y1, z) => mb.wall(x0, y0, x1, y1, z, [1, 1, 1]);
  const addSign = (text, o, x0, x1, y0, y1, z, dN) => { const s = sgn(text, o), mb = new MB(); signQuad(mb, x0, x1, y0, y1, z); add(mb, { tex: s.tex, em: s.em, emDay: .4, emNight: Math.min(dN || 1, .85) }); return s; };
  const seatAdd = (x, z, yaw, h, ap) => { const s = { x, z, yaw, h, ap, who: null, res: null }; s.hot = { id: 'sit', seat: s, x: ap[0], z: ap[1], r: 1.4 }; S.seats.push(s); return s; };
  const sofa = (x, z, dir, len, col, base, f, trim) => {
    trim = trim || GOLD; base = base || 0;
    const fx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0, fz = dir === 's' ? 1 : dir === 'n' ? -1 : 0, ew = fx !== 0, hx = ew ? .5 : len / 2, hz = ew ? len / 2 : .5, b = new MB();
    b.box(x - hx, base, z - hz, x + hx, base + .45, z + hz, col); b.box(x - hx, base, z - hz, x + hx, base + .12, z + hz, trim);
    const bx = x - fx * (hx - .1), bz = z - fz * (hz - .1); if (ew) b.box(Math.min(bx - .1, bx + .1), base + .45, z - hz, Math.max(bx - .1, bx + .1), base + 1.05, z + hz, mul(col, [.92, .92, .92])); else b.box(x - hx, base + .45, bz - .1, x + hx, base + 1.05, bz + .1, mul(col, [.92, .92, .92]));
    if (ew) { b.box(x - hx, base + .45, z - hz, x + hx, base + .7, z - hz + .12, trim); b.box(x - hx, base + .45, z + hz - .12, x + hx, base + .7, z + hz, trim); } else { b.box(x - hx, base + .45, z - hz, x - hx + .12, base + .7, z + hz, trim); b.box(x + hx - .12, base + .45, z - hz, x + hx, base + .7, z + hz, trim); }
    add(b, {}); obs(x - hx - .05, z - hz - .05, x + hx + .05, z + hz + .05, f);
    const ns = Math.max(1, Math.round(len / 1.1)); for (let k = 0; k < ns; k++) { const o = (k - (ns - 1) / 2) * 1.05, sx = x + (ew ? 0 : o) - fx * .08, sz = z + (ew ? o : 0) - fz * .08; seatAdd(sx, sz, Math.atan2(fx, fz), base + .45, [sx + fx * 1.2, sz + fz * 1.2]); }
  };
  const gtable = (x, z, w, d, col, h) => { h = h || .5; const t = new MB(); t.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, col || IVORY, [2, 2]); t.box(x - w / 2 - .06, h, z - d / 2 - .06, x + w / 2 + .06, h + .07, z + d / 2 + .06, GOLD); add(t, { tex: X.cmarble }); obs(x - w / 2 - .1, z - d / 2 - .1, x + w / 2 + .1, z + d / 2 + .1); };
  const chand = (x, y, z, s, col) => { col = col || [1, .85, .55]; occ(() => { const c = new MB(), cr = new MB(); [[0, 1.0], [-.7, .7], [-1.35, .4]].forEach(([dy, r], i) => { c.disc(x, z, y + dy, r * s, 24, GOLD, (r - .08) * s); for (let k = 0; k < 14 - i * 2; k++) { const a = k / (14 - i * 2) * 6.283; cr.sphere(x + Math.cos(a) * r * s, y + dy - .12, z + Math.sin(a) * r * s, .06, .1, .06, [1, 1, 1], 4); } }); c.cyl(x, z, y - 1.6, y + 1.6, .05, .05, 6, GOLD, false); cr.sphere(x, y - 1.7, z, .14, .22, .14, [1, 1, 1], 5); add(c, {}); add(cr, emMat([1, .95, .8], .35, 1.3)); }); const gl = new MB(); halo(gl, x, y - .5, z, 4 * s, col); add(gl, glowMat(night(.35))); };
  const column = (x, z, h, col) => { occ(() => { const c = new MB(); c.cyl(x, z, 0, .4, .62, .6, 14, GOLD, true); c.cyl(x, z, .4, h, .42, .38, 16, col || DARK, false); c.cyl(x, z, h, h + .4, .66, .5, 14, GOLD, true); c.cyl(x, z, 2.2, 2.35, .45, .45, 16, GOLD, false); add(c, {}); }); obs(x - .5, z - .5, x + .5, z + .5); };
  /* 栏杆：沿轴对齐的线段 */
  const rail = (x0, z0, x1, z1, h, col) => { h = h || 1.0; col = col || GOLD; const b = new MB(), r = new MB(), horiz = Math.abs(z1 - z0) < 1e-6, len = Math.abs(horiz ? x1 - x0 : z1 - z0), n = Math.max(1, Math.round(len / .8));
    for (let k = 0; k <= n; k++) { const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; b.cyl(x, z, 0, h, .05, .05, 6, IVORY, true); }
    r.box(Math.min(x0, x1) - .08, h, Math.min(z0, z1) - .08, Math.max(x0, x1) + .08, h + .09, Math.max(z0, z1) + .08, col); r.box(Math.min(x0, x1) - .06, 0, Math.min(z0, z1) - .06, Math.max(x0, x1) + .06, .1, Math.max(z0, z1) + .06, col); add(b, {}); add(r, {}); };
  /* 电梯门（贴在北墙 z=wz，朝 +z） */
  const elevDoors = (cx, wz, fl) => { const m = new MB(), fr = new MB();
    [-1.5, 1.5].forEach(dx => { const x = cx + dx; fr.box(x - 1.45, 0, wz, x - 1.25, 4.2, wz + .3, GOLD); fr.box(x + 1.25, 0, wz, x + 1.45, 4.2, wz + .3, GOLD); fr.box(x - 1.45, 3.95, wz, x + 1.45, 4.25, wz + .3, GOLD); fr.box(x - 1.25, 0, wz, x + 1.25, .12, wz + .14, [.3, .24, .14]);
      m.box(x - 1.25, .12, wz, x - .03, 3.95, wz + .1, [.88, .72, .4]); m.box(x + .03, .12, wz, x + 1.25, 3.95, wz + .1, [.88, .72, .4]);
      m.box(x - 1.0, .8, wz + .1, x - .2, 3.3, wz + .13, [.98, .86, .56]); m.box(x + .2, .8, wz + .1, x + 1.0, 3.3, wz + .13, [.98, .86, .56]); m.box(x - .08, 1.1, wz + .1, x - .04, 2.2, wz + .16, [.2, .15, .1]); m.box(x + .04, 1.1, wz + .1, x + .08, 2.2, wz + .16, [.2, .15, .1]);
      const d = sgn(fl, { w: 256, h: 96, fs: 56, bg: '#10080c', fg: '#ff9a4a', border: '#e1b84e' }), mb = new MB(); signQuad(mb, x - .7, x + .7, 4.4, 5.0, wz + .08); add(mb, { tex: d.tex, em: d.em, emDay: .5, emNight: .9 }); });
    add(fr, {}); add(m, {}); const tt = sgn('ELEVATOR · 电梯', { w: 768, h: 120, fs: 56, border: '#ffcf5a' }), tb = new MB(); signQuad(tb, cx - 3.4, cx + 3.4, 5.5, 6.7, wz + .06); add(tb, { tex: tt.tex, em: tt.em, emDay: .4, emNight: .85 });
    const gl = new MB(); halo(gl, cx, 2.2, wz + 1.2, 5, [1, .85, .5]); add(gl, glowMat(night(.3))); };
  const indoorEnv = (a0, a1, bot0, bot1, nt) => h => { const e0 = G.World.envAt(h), n = clamp(e0.night, 0, 1), L = (a, b) => a.map((v, i) => v + (b[i] - v) * n);
    return { indoor: true, night: nt != null ? nt : n * .85, gold: e0.gold || 0, day: 1 - n, dir: [.2, 1, .5], sun: L([.58, .52, .46], [.3, .26, .4]), amb: L(a0, a1), top: [.9, .8, .9], bot: L(bot0, bot1), fog: L(bot0, bot1), charAmb: L([.68, .64, .8], [.5, .46, .72]), charSun: L([.5, .46, .34], [.34, .3, .3]), line: [.3, .18, .24], fogNear: 60, fogFar: 140 }; };
  return { R, T, X, S, add, occ, obs, solid, emMat, halo, pool, night, lit, glowMat, sgn, addSign, signQuad, seatAdd, sofa, gtable, chand, column, rail, elevDoors, indoorEnv };
}

/* ---------- 门（走廊墙上，朝向 +z / ±x） ---------- */
function roomDoor(K, r, col) {
  const { add, halo, T, glowMat, night, sgn, signQuad, S, emMat } = K, [dx, dz] = r.door, wing = r.wing || 0;
  const fr = new MB(), lf = new MB(), kn = new MB(), sc = col || [.45, .08, .14], tier2 = r.floor === 2;
  const put = (mb, u0, y0, v0, u1, y1, v1, c) => { if (!wing) mb.box(dx + u0, y0, -11 + v0, dx + u1, y1, -11 + v1, c); else { const wx = wing < 0 ? -21 : 21, f = -wing; /* f：朝走廊内侧的方向 */ const a = wx + v0 * f, b = wx + v1 * f; mb.box(Math.min(a, b), y0, dz + u0, Math.max(a, b), y1, dz + u1, c); } };
  const box = (...a) => put(fr, ...a), leaf = (...a) => put(lf, ...a);
  const fc = tier2 ? GOLD : [.8, .82, .9];
  box(-1.15, 0, 0, -.95, 3.7, .24, fc); box(.95, 0, 0, 1.15, 3.7, .24, fc); box(-1.15, 3.5, 0, 1.15, 3.74, .24, fc); box(-1.3, 3.74, 0, 1.3, 3.9, .3, fc);
  leaf(-.95, 0, 0, -.02, 3.5, .1, sc); leaf(.02, 0, 0, .95, 3.5, .1, sc); leaf(-.75, .5, .1, -.2, 3.0, .13, mul(sc, [1.35, 1.35, 1.35])); leaf(.2, .5, .1, .75, 3.0, .13, mul(sc, [1.35, 1.35, 1.35]));
  box(-.06, 1.0, .1, -.02, 1.25, .2, fc); box(.02, 1.0, .1, .06, 1.25, .2, fc);
  add(fr, {}); add(lf, {});
  /* 号牌：北墙门朝 +z，直接贴；侧翼门用悬挑的“旗牌”面向镜头 */
  const pl = sgn(r.num, { w: 640, h: 190, fs: tier2 ? 96 : 84, bg: tier2 ? '#14070c' : '#0d1226', fg: tier2 ? '#ffe9a8' : '#e8f1ff', border: tier2 ? '#e1b84e' : '#9fc0ff' });
  const sub = sgn(r.name, { w: 400, h: 90, fs: 46, bg: tier2 ? '#14070c' : '#0d1226', fg: tier2 ? '#ffb3d0' : '#a8d8ff', border: tier2 ? '#a8294a' : '#5f84c8' });
  const pm = new MB(), sm = new MB();
  if (!wing) { signQuad(pm, dx - 1.5, dx + 1.5, 4.05, 5.0, -10.9); signQuad(sm, dx - .95, dx + .95, 3.55, 4.0, -10.88); }
  else { const wx = wing < 0 ? -21 : 21, ix = wx - wing * 1.1; signQuad(pm, ix - 1.3, ix + 1.3, 4.0, 4.9, dz); signQuad(sm, ix - .85, ix + .85, 3.52, 3.95, dz + .01); const bk = new MB(); bk.box(Math.min(wx, ix) - .03, 4.2, dz - .03, Math.max(wx, ix) + .03, 4.28, dz + .03, fc); bk.box(Math.min(wx, ix) - .03, 3.7, dz - .03, Math.max(wx, ix) + .03, 3.76, dz + .03, fc); add(bk, {}); }
  add(pm, { tex: pl.tex, em: pl.em, emDay: .4, emNight: .85 }); add(sm, { tex: sub.tex, em: sub.em, emDay: .4, emNight: .85 });
  const gl = new MB(); if (!wing) { halo(gl, dx, 2.2, -9.9, 2.6, tier2 ? [1, .8, .45] : [.7, .8, 1]); } else { const wx = wing < 0 ? -21 : 21; halo(gl, wx - wing * 1.2, 2.2, dz, 2.6, tier2 ? [1, .8, .45] : [.7, .8, 1]); } add(gl, glowMat(night(.25)));
  /* 自动进门触发点：贴近门口才进，不画圈 */
  const px = wing ? (wing < 0 ? -19.9 : 19.9) : dx, pz = wing ? dz : -9.9;
  S.portals.push({ id: r.id, auto: true, x: px, z: pz, r: 1.3, label: r.num, spawn: [0, tier2 ? 4.8 : 4.0], ret: r.ret });
}

/* ---------- 1F 接待大堂 ---------- */
function hallPoly(x0, x1, z0, z1, r) { const P = [[x0, z0], [x1, z0]]; const zc = z1 - r; for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI / 2; P.push([x1 - r + Math.cos(a) * r, zc + Math.sin(a) * r]); } for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 + k / 10 * Math.PI / 2; P.push([x0 + r + Math.cos(a) * r, zc + Math.sin(a) * r]); } return P; }
const wallSeg = (mb, A, B, h, y0, col) => { const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; mb.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], h, B[1]], [A[0], h, A[1]], [-dz / l, 0, dx / l], [0, 0, l / 4, (h - y0) / 4], col); return l; };

function makeLobby(R, T) {
  const K = kit(R, T), { S, X, add, occ, obs, emMat, halo, pool, night, lit, glowMat, sgn, addSign, signQuad, sofa, gtable, chand, column, elevDoors } = K;
  const outline = hallPoly(-17, 17, -15, 13, 7), inner = hallPoly(-16.3, 16.3, -14.3, 12.3, 6.3);
  S.walkable = (x, z) => inPoly(x, z, inner); S.outline = outline;
  /* 地面：黑金大理石 + 红地毯 */
  { const f = new MB(); f.poly(outline, 0, [1, 1, 1], 4); add(f, { tex: X.bmarble });
    const b = new MB(); for (let i = 0; i < outline.length; i++) { const A = outline[i], B = outline[(i + 1) % outline.length], a = inner[i], bb = inner[(i + 1) % inner.length]; b.quad([A[0], .012, A[1]], [B[0], .012, B[1]], [bb[0], .012, bb[1]], [a[0], .012, a[1]], [0, 1, 0], [0, 0, 1, 1], [.78, .62, .3]); } add(b, {});
    const c = new MB(); c.floor(-2.2, -7.6, 2.2, 12.6, .02, [1, 1, 1], [0, 0, 1, 5]); add(c, { tex: X.carpet }); }
  /* 墙：酒红底金纹，前方低栏杆 */
  { const tall = new MB(), low = new MB(), trim = new MB(), rail = new MB(), WINE = [.62, .24, .36];
    for (let i = 0; i < outline.length; i++) { const A = outline[i], B = outline[(i + 1) % outline.length]; if (i === 0) { wallSeg(tall, A, B, 12, 0, WINE); continue; } const mz = (A[1] + B[1]) / 2;
      if (mz < 6.2) wallSeg(tall, A, B, 12, 0, WINE); else { wallSeg(low, A, B, 1.0, 0, [.5, .12, .22]); const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; rail.quad([A[0], 1.0, A[1]], [B[0], 1.0, B[1]], [B[0], 1.12, B[1]], [A[0], 1.12, A[1]], [-dz / l, 0, dx / l], [0, 0, 1, 1], GOLD); } }
    add(tall, { tex: X.damask }); add(low, {}); add(rail, {});
    for (let i = 0; i < outline.length; i++) { const A = outline[i], B = outline[(i + 1) % outline.length]; if (i !== 0 && (A[1] + B[1]) / 2 >= 6.2) continue; const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; [[0, .6, [.85, .68, .3]], [11.3, 12, [.92, .76, .38]]].forEach(([y0, y1, col]) => trim.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], [-dz / l, 0, dx / l], [0, 0, 1, 1], col)); }
    add(trim, {});
    /* 侧墙霓虹灯条 + 金框海报灯箱 */
    const nb = new MB(); [-1, 1].forEach(sd => { for (let z = -12.5; z <= 4; z += 3.3) { const x = sd * 16.9; nb.box(x - (sd > 0 ? .1 : 0), 1.2, z - .06, x + (sd < 0 ? .1 : 0), 10.4, z + .06, [1, .4, .8]); nb.box(x - (sd > 0 ? .1 : 0) - sd * .0, 1.2, z + .5, x + (sd < 0 ? .1 : 0), 10.4, z + .56, [.45, .85, 1]); } }); add(nb, emMat([1, .6, .9], .2, .8)); }
  /* ---- 后墙正中：招牌 + 三块广告机 ---- */
  { addSign('天皇巨星', { w: 1280, h: 300, fs: 190, bg: '#14070c', fg: '#ffe9a8', border: '#e1b84e' }, -6.5, 6.5, 6.0, 9.3, -14.93, 1.9);
    addSign('SUPERSTAR KTV · 豪华欢唱殿堂', { w: 1024, h: 120, fs: 52, bg: '#14070c', fg: '#ff9ad8', border: '#ff4fc3' }, -5, 5, 9.5, 10.5, -14.93, 1.7);
    const cv = document.createElement('canvas'); cv.width = 1536; cv.height = 256; S.ad = { cv, tex: null, acc: 1 }; drawAds(cv.getContext('2d'), 0); S.ad.tex = R.canvasTex(cv, { clamp: true, mip: false });
    const fr = new MB(), sc = new MB(); [-4.2, 0, 4.2].forEach((cx, i) => { fr.box(cx - 1.95, 2.85, -14.99, cx + 1.95, 5.55, -14.86, GOLD); sc.wall(cx - 1.8, 3.0, cx + 1.8, 5.4, -14.84, [1, 1, 1], [i / 3, 0, (i + 1) / 3, 1]); }); add(fr, {}); add(sc, { tex: S.ad.tex, em: S.ad.tex, emDay: .55, emNight: .75 });
    S.update = (g, dt) => { const a = S.ad; a.acc += dt; if (a.acc < .25) return; a.acc = 0; drawAds(a.cv.getContext('2d'), g.t); R.updateCanvasTex(a.tex, a.cv); };
    const gl = new MB(); halo(gl, 0, 4.2, -13.5, 7, [1, .5, .85]); add(gl, glowMat(lit(.18))); }
  /* ---- 接待柜台 ---- */
  { const ct = new MB(), top = new MB(), led = new MB();
    ct.box(-6.2, 0, -11, 6.2, 1.15, -8.6, [.14, .1, .16], [4, 2]); ct.box(-6.4, 1.15, -11.2, 6.4, 1.28, -8.4, GOLD); ct.box(-6.2, 0, -8.7, 6.2, .14, -8.55, GOLD);
    for (let x = -5.6; x <= 5.7; x += 1.4) ct.box(x - .05, .2, -8.66, x + .05, 1.1, -8.6, GOLD);
    led.box(-6.0, .22, -8.62, 6.0, .32, -8.58, [1, .4, .8]); led.box(-6.0, 1.0, -8.62, 6.0, 1.06, -8.58, [.45, .85, 1]);
    add(ct, { tex: X.bmarble }); add(led, emMat([1, .6, .9], .35, 1.0));
    const it = new MB(); [-4, 4].forEach(x => { it.box(x - .45, 1.28, -10.2, x + .45, 1.34, -9.6, DARK); it.box(x - .4, 1.34, -10.0, x + .4, 1.9, -9.95, [.05, .06, .1]); it.box(x - .05, 1.34, -10.15, x + .05, 1.5, -10.0, DARK); });
    it.cyl(0, -9.4, 1.28, 1.36, .22, .22, 10, GOLD, true); it.sphere(0, 1.42, -9.4, .1, .06, .1, [1, .95, .8], 6);
    [-1.8, 1.8].forEach(x => { it.cyl(x, -9.8, 1.28, 1.55, .14, .1, 8, [.9, .9, 1], true); for (let k = 0; k < 7; k++) { const a = k * 2.4, h = 1.62 + (k % 3) * .06; it.sphere(x + Math.cos(a) * .12, h, -9.8 + Math.sin(a) * .12, .09, .09, .09, k % 2 ? [1, .35, .5] : [1, .8, .85], 5); } });
    add(it, {}); obs(-6.5, -11.4, 6.5, -8.2);
    const tg = addSign('RECEPTION · 前台接待', { w: 640, h: 100, fs: 50, border: '#ff9ad8' }, -2.6, 2.6, 1.5, 2.1, -8.52, 1.4);
    S.hotspots.push({ id: 'desk', x: 0, z: -7.2, r: 2.2, label: '前台接待', btn: '前台', icon: '🛎', color: [1, .55, .85], msg: '前台：欢迎光临天皇巨星！2 楼 VIP 至尊包间、3 楼欢唱包间，请乘右侧电梯上楼 🎤' });
    const gg = new MB(); pool(gg, 0, -6.5, 5.5, [1, .55, .9], .035); add(gg, glowMat(lit(.3))); }
  /* ---- 自由餐 ---- */
  { const bf = new MB(), fd = new MB(), gl = new MB();
    bf.box(-15.8, 0, -14.1, -8.6, 1.0, -12.1, [.16, .12, .18], [3, 1]); bf.box(-15.95, 1.0, -14.2, -8.45, 1.1, -12.0, GOLD); bf.box(-15.8, 0, -12.2, -8.6, .14, -12.08, GOLD);
    const pl = [[.95, .6, .3], [.9, .25, .25], [.5, .75, .35], [.95, .85, .4], [1, .55, .65], [.55, .4, .25]];
    for (let k = 0; k < 8; k++) { const x = -15.2 + k * .9; bf.box(x - .38, 1.1, -13.8, x + .38, 1.16, -12.4, [.85, .86, .9]); for (let j = 0; j < 5; j++) fd.sphere(x - .2 + (j % 3) * .2, 1.24 + (j % 2) * .04, -13.4 + Math.floor(j / 3) * .45, .1, .08, .1, pl[(k + j) % 6], 5); }
    for (let k = 0; k < 3; k++) { const x = -14.2 + k * 2.9; bf.box(x - .04, 1.16, -14.0, x + .04, 2.1, -13.92, [.7, .7, .75]); bf.box(x - .5, 2.05, -14.0, x + .5, 2.12, -13.1, [.95, .55, .25]); halo(gl, x, 1.9, -13.4, 1.8, [1, .65, .3]); }
    bf.cyl(-15.0, -11.2, 0, .9, .35, .3, 10, GOLD, true); bf.sphere(-15.0, 1.1, -11.2, .26, .3, .26, [.95, .95, 1], 6);
    add(bf, {}); add(fd, {}); add(gl, glowMat(night(.4))); obs(-16, -14.3, -8.4, -11.9);
    addSign('自由餐 · BUFFET', { w: 768, h: 130, fs: 60, border: '#ffb36b', fg: '#ffe2c0' }, -15.2, -9.4, 3.7, 4.7, -14.93, 1.6);
    S.hotspots.push({ id: 'buffet', x: -12.3, z: -10.4, r: 2.0, label: '自由餐', btn: '取餐', icon: '🍱', color: [1, .75, .4], msg: '自由餐：免费取用 🍱🍰🥤 慢慢享用（演示版）' }); }
  /* ---- 电梯（后墙右侧） ---- */
  { elevDoors(12, -15, '1F'); const sg = new MB(); S.hotspots.push({ id: 'elev', x: 12, z: -12.5, r: 2.5, label: '电梯', btn: '乘电梯', icon: '🛗', color: [1, .82, .35] });
    addSign('↑ 2F VIP 至尊包间　3F 欢唱包间', { w: 1024, h: 90, fs: 42, border: '#ffcf5a', fg: '#ffe9a8' }, 8.4, 15.6, 7.0, 7.9, -14.93, 1.5); S.elevSpawn = [12, -9.4]; }
  /* ---- 候客沙发区（柜台前） ---- */
  [-1, 1].forEach(sd => { const cx = sd * 9, VEL = sd < 0 ? [.55, .1, .3] : [.12, .2, .5]; sofa(cx, -5.9, 's', 3.2, VEL, 0); sofa(cx, -1.3, 'n', 3.2, VEL, 0); gtable(cx, -3.6, 2.6, 1.2, IVORY, .45);
    const it = new MB(); for (let k = 0; k < 3; k++) { it.cyl(cx - .8 + k * .8, -3.6, .52, .78, .06, .05, 6, [1, .95, .9], true); } add(it, {});
    const gg = new MB(); pool(gg, cx, -3.6, 4.2, [1, .8, .6], .036); add(gg, glowMat(night(.3))); });
  [[-9.5, 3.4], [9.5, 3.4], [-9.5, 9.6], [9.5, 9.6]].forEach(([x, z]) => column(x, z, 8.4, [.14, .1, .16]));
  chand(0, 8.6, 4.5, 1.5); chand(0, 9.2, -5, 1.2); chand(-9, 8.4, -3.6, .9); chand(9, 8.4, -3.6, .9);
  /* ---- 出口 ---- */
  { const ex = new MB(); [-2.7, 2.7].forEach(x => { ex.cyl(x, 12.4, 0, 3.6, .3, .26, 12, GOLD, true); ex.sphere(x, 3.9, 12.4, .3, .3, .3, [1, .85, .5], 8); ex.cyl(x, 12.4, 3.6, 5.8, .14, .14, 8, GOLD, true); }); occ(() => add(ex, {}));
    addSign('出口 EXIT · 回到星光广场', { w: 768, h: 120, fs: 56, border: '#7dffb0', fg: '#d8ffe8' }, -2.4, 2.4, 4.6, 5.5, 12.35, 1.6);
    const gl = new MB(); pool(gl, 0, 11, 3.2, [.4, 1, .6], .036); add(gl, glowMat(night(.6)));
    S.portals.push({ id: 'plaza', x: 0, z: 10.8, r: 1.9, label: '回到星光广场', color: [.4, 1, .6], spawn: [20.7, -8.4] }); }
  S.heightAt = () => 0; S.bounds = { x0: -17, x1: 17, z0: -15, z1: 13 }; S.spawn = [0, 9];
  S.camera = { dist: 27, pitch: .54, fov: .74, clampX: [-6, 6], clampZ: [-11, 5], lead: 4 }; S.cameraWide = { dist: 26, pitch: .17, fov: 1.05 };
  S.npcRect = { x0: -14, x1: 14, z0: -6, z1: 11 }; S.npcN = 12;
  S.name = '天皇巨星 · 接待大堂'; S.indoor = true;
  S.env = K.indoorEnv([.74, .66, .78], [.46, .36, .62], [.92, .84, .9], [.14, .08, .2]);
  return S;
}
const ADS = [['天皇巨星', 'SUPERSTAR KTV · 欢迎光临', '#ff4fc3', '#ffd86b'], ['VIP 至尊包间', '2F · 8 间主题豪华房', '#ffd86b', '#ff8ad8'], ['欢唱包间', '3F · 16 间 · 全天开放', '#7ee8ff', '#ffd86b'], ['自由餐', '全天畅吃 · 饮品无限', '#ffb36b', '#ffffff'], ['新歌首发', '每晚 9 点 · 巨星演唱会', '#b48cff', '#7ee8ff'], ['组队包场', '叫上家族一起 K 歌', '#7dffb0', '#ffd86b']];
function drawAds(c, t) {
  for (let i = 0; i < 3; i++) { const a = ADS[(Math.floor(t / 4) + i * 2) % ADS.length], x0 = i * 512, ph = (t % 4) / 4;
    const gr = c.createLinearGradient(x0, 0, x0 + 512, 256); gr.addColorStop(0, '#12061c'); gr.addColorStop(1, '#2a0d3a'); c.fillStyle = gr; c.fillRect(x0, 0, 512, 256);
    const sx = x0 + ((t * 140 + i * 90) % 700) - 100, lg = c.createLinearGradient(sx - 90, 0, sx + 90, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,200,255,.16)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = lg; c.fillRect(x0, 0, 512, 256);
    c.strokeStyle = a[2]; c.lineWidth = 8; c.strokeRect(x0 + 8, 8, 496, 240); c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = a[2]; c.shadowBlur = 18;
    let fs = 78; c.font = F(800, fs); while (c.measureText(a[0]).width > 440 && fs > 30) { fs -= 4; c.font = F(800, fs); } c.fillStyle = '#fff'; c.fillText(a[0], x0 + 256, 100);
    c.shadowColor = a[3]; c.font = F(700, 28); c.fillStyle = a[3]; c.fillText(a[1], x0 + 256, 175); c.shadowBlur = 0;
    for (let k = 0; k < 9; k++) { const h = 28 * (.25 + .75 * Math.abs(Math.sin(t * 3 + k * .9 + i))); c.fillStyle = k % 2 ? a[2] : a[3]; c.fillRect(x0 + 156 + k * 22, 232 - h, 14, h); } }
}

/* ---------- 2F / 3F 走廊 ---------- */
function makeFloor(R, T, floor) {
  const K = kit(R, T), { S, X, add, occ, obs, emMat, halo, pool, night, lit, glowMat, sgn, addSign, signQuad, sofa, gtable, chand, column, rail, elevDoors } = K, t2 = floor === 2;
  const WALL = t2 ? [.78, .28, .4] : [.46, .42, .74], TRIM = t2 ? GOLD : [.82, .84, .95], CARP = t2 ? X.carpet : X.carpet;
  const z1 = t2 ? -2.4 : -3.8;       // 走廊南缘（栏杆内侧）
  const rects = [[-21, -11, 21, t2 ? -2 : -3.4]]; if (!t2) rects.push([-21, -3.4, -14.2, 15], [14.2, -3.4, 21, 15]);
  const walk = [[-20.3, -10.3, 20.3, z1]]; if (!t2) walk.push([-20.3, z1, -14.8, 14.4], [14.8, z1, 20.3, 14.4]);
  S.walkable = (x, z) => walk.some(w => x >= w[0] && x <= w[2] && z >= w[1] && z <= w[3]);
  S.outline = rects.map(r => [r[0], r[1]]);
  /* 地面 */
  { const f = new MB(); rects.forEach(r => f.floor(r[0], r[1], r[2], r[3], 0, [1, 1, 1], [0, 0, (r[2] - r[0]) / 4, (r[3] - r[1]) / 4])); add(f, { tex: t2 ? X.bmarble : X.cmarble });
    const c = new MB(); c.floor(-20, -8.6, 20, -6.2, .02, t2 ? [1, 1, 1] : [.45, .5, .95], [0, 0, 10, 1]); if (!t2) { c.floor(-19, -3.4, -16, 14, .021, [.45, .5, .95], [0, 0, 1, 4.4]); c.floor(16, -3.4, 19, 14, .021, [.45, .5, .95], [0, 0, 1, 4.4]); } add(c, { tex: X.carpet });
    const e = new MB(); rects.forEach(r => { e.box(r[0], -.2, r[1], r[2], 0, r[3], [.3, .25, .2]); }); add(e, {}); }
  /* 北墙（所有包间的门都在这面墙上，朝向镜头） */
  { const w = new MB(), tr = new MB(); w.wall(-21, 0, 21, 12, -11, WALL, [0, 0, 10.5, 3]); add(w, { tex: X.damask });
    [[0, .6, TRIM], [11.2, 12, TRIM]].forEach(([y0, y1, c]) => tr.wall(-21, y0, 21, y1, -10.99, mul(c, [.95, .95, .95]))); tr.wall(-21, 3.95, 21, 4.1, -10.99, TRIM);
    for (let x = -21; x <= 21; x += 4.5) { tr.box(x - .12, 0, -11, x + .12, 11.6, -10.8, TRIM); }
    add(tr, {});
    /* 门之间的壁灯 */
    const lm = new MB(), gl = new MB(); for (let x = -21 + 2.25; x < 21; x += 4.5) { if (Math.abs(x) < 3.2) continue; }
    [-16.5, -12, -7.5, 7.5, 12, 16.5].forEach(x => { lm.cyl(x, -10.85, 2.2, 2.9, .08, .05, 6, TRIM, true); lm.sphere(x, 3.0, -10.8, .13, .17, .13, [1, .95, .8], 5); halo(gl, x, 3.0, -10.4, 1.5, [1, .85, .55]); });
    add(lm, emMat([1, .9, .7], .3, 1.2)); add(gl, glowMat(night(.35))); }
  /* 电梯（北墙正中） */
  { elevDoors(0, -11, floor + 'F'); S.hotspots.push({ id: 'elev', x: 0, z: -8.6, r: 2.2, label: '电梯', btn: '乘电梯', icon: '🛗', color: [1, .82, .35] }); S.elevSpawn = [0, t2 ? -5.2 : -5.6];
    addSign(t2 ? '2F · VIP 至尊包间' : '3F · 欢唱包间', { w: 768, h: 120, fs: 58, border: t2 ? '#ffcf5a' : '#9fc0ff', fg: t2 ? '#ffe9a8' : '#e8f1ff' }, -3, 3, 7.2, 8.2, -10.95, 1.6); }
  /* 包间门 */
  Object.values(ROOMS).filter(r => r.floor === floor).forEach(r => roomDoor(K, r, t2 ? [.45, .08, .14] : [.12, .2, .46]));
  /* 栏杆 + 中庭吊灯 */
  if (t2) { rail(-20.6, -2, 20.6, -2, 1.0); }
  else { rail(-14.4, -3.4, 14.4, -3.4, 1.0); rail(-14.4, -3.4, -14.4, 15, 1.0); rail(14.4, -3.4, 14.4, 15, 1.0); rail(-20.6, 15, -14.4, 15, 1.0); rail(14.4, 15, 20.6, 15, 1.0);
    /* 翼廊外墙 */
    const sw = new MB(); [-21, 21].forEach(x => { sw.quad([x, 0, -11], [x, 0, 15], [x, 12, 15], [x, 12, -11], [x > 0 ? -1 : 1, 0, 0], [0, 0, 6, 3], WALL); }); add(sw, { tex: X.damask }); }
  /* 走廊沙发（长凳，全部可坐）+ 立灯 + 盆栽 */
  const benchCol = t2 ? [.55, .1, .28] : [.22, .3, .62];
  if (t2) { [-15, -9, 9, 15].forEach(x => { sofa(x, -3.1, 'n', 3.0, benchCol, 0); }); [-19.4, 19.4].forEach(x => { const pm = new MB(); pm.cyl(x, -3.6, 0, .6, .45, .38, 10, GOLD, true); for (let k = 0; k < 6; k++) pm.sphere(x + Math.cos(k * 1.05) * .35, 1.0 + (k % 2) * .25, -3.6 + Math.sin(k * 1.05) * .35, .4, .5, .4, [.2, .55, .3], 6); add(pm, {}); obs(x - .6, -4.2, x + .6, -3.0); }); }
  else { [-8, 8].forEach(x => sofa(x, -4.6, 'n', 3.0, benchCol, 0)); [-1, 1].forEach(sd => { sofa(sd * 15.6, 1.8, sd < 0 ? 'w' : 'e', 3.0, benchCol, 0); sofa(sd * 15.6, 10.6, sd < 0 ? 'w' : 'e', 3.0, benchCol, 0); }); }
  { const pd = new MB(), gl = new MB(); [-20, -3.8, 3.8, 20].forEach((x, i) => { if (!t2 && Math.abs(x) > 19) return; pd.cyl(x, -9.7, 0, .9, .4, .34, 10, IVORY, true); pd.cyl(x, -9.7, .9, 1.0, .46, .46, 10, GOLD, true); pd.sphere(x, 1.5, -9.7, .26, .42, .26, i % 2 ? [.9, .3, .45] : [.35, .6, .95], 8); halo(gl, x, 1.4, -9.2, 1.6, [1, .85, .6]); obs(x - .5, -10.3, x + .5, -9.2); }); add(pd, {}); add(gl, glowMat(night(.55))); }
  chand(-10, 8.8, -5.5, 1.1); chand(10, 8.8, -5.5, 1.1);
  if (t2) chand(0, 9.8, 4, 2.2); else { chand(0, 10, 5, 2.4); chand(-17.4, 8.2, 6, .9); chand(17.4, 8.2, 6, .9); }
  /* 走廊地面光斑 */
  { const gg = new MB(); [-14, -5.5, 5.5, 14].forEach(x => pool(gg, x, -7.5, 3.4, t2 ? [1, .8, .5] : [.75, .8, 1], .036)); add(gg, glowMat(night(.25))); }
  S.heightAt = () => 0; S.bounds = { x0: -21, x1: 21, z0: -11, z1: t2 ? -2 : 15 }; S.spawn = S.elevSpawn;
  S.camera = { dist: 28, pitch: .56, fov: .74, clampX: [-14, 14], clampZ: t2 ? [-9, -4] : [-9, 7], lead: t2 ? 2 : 4 }; S.cameraWide = { dist: 26, pitch: .2, fov: 1.05 };
  S.npcRect = t2 ? { x0: -19, x1: 19, z0: -8.8, z1: -3.3 } : { x0: -19, x1: 19, z0: -8.8, z1: -4.6 }; S.npcN = t2 ? 6 : 8;
  S.name = t2 ? '天皇巨星 · 2F VIP 至尊廊' : '天皇巨星 · 3F 欢唱廊'; S.indoor = true;
  S.env = t2 ? K.indoorEnv([.76, .66, .74], [.48, .36, .58], [.92, .84, .88], [.16, .08, .18]) : K.indoorEnv([.72, .7, .82], [.42, .4, .66], [.88, .88, .96], [.1, .1, .22]);
  return S;
}

G.KTV = { kit, ROOMS, isKtvId, texs, F, GOLD, IVORY, DARK, RED, mul, inPoly, rnd, PITCH, makeLobby, makeFloor };
G.Scenes.isKtvId = isKtvId;
})(window);
