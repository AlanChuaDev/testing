/* bigshops.js — 广场两家大型主题店（室内 + 室外露台）
   Shops.bobaShop(K,cx,cz,{s})  星光奶茶：巨型波霸杯外带亭 + 猫头屋顶粉色奶茶厅 + 糖果色露台
   Shops.cafeShop(K,cx,cz,{s})  星光咖啡：巨型咖啡杯外带亭 + 玻璃花房咖啡厅 + 藤编沙发露台
   s=+1：外带亭在 +x 侧；s=-1：外带亭在 -x 侧。店面朝 +z（朝镜头）。
   K 需要：R T S add occ obs emMat halo glowMat night seatAdd
   占地(世界)：x 方向约 14，z 从 cz-4.5 到 cz+8.6。所有座位都能坐（seatAdd）。
   夜晚灯光：光晕/灯串/吊灯/招牌/窗户多光源，发光强度均有上限，不过曝。
   S.shopFx：数组，场景 dyn 里逐个调用 fn(fx,t,c,sn) 画蒸汽。 */
(function (G) {
'use strict';
const { MB } = G.World;
const PITCH = 0.46;
const mul = (c, k) => [c[0] * k[0], c[1] * k[1], c[2] * k[2]];
const WHITE = [1, 1, 1], CREAM = [.98, .94, .86], PINK = [1, .62, .76], MINT = [.62, .9, .8], GOLD = [.93, .76, .36], WOOD = [.62, .42, .28], YEL = [1, .88, .6], LILAC = [.82, .74, 1];

function ctx(K, cx, cz, s) {
  const { R, T, S, add, occ, obs, emMat, halo, glowMat, night } = K;
  const X = u => cx + s * u, Z = z => cz + z;
  const C = { R, T, S, add, occ, emMat, X, Z, s, K };
  C.bx = (mb, u0, y0, z0, u1, y1, z1, c, t) => { const a = X(u0), b = X(u1); mb.box(Math.min(a, b), y0, Z(Math.min(z0, z1)), Math.max(a, b), y1, Z(Math.max(z0, z1)), c || WHITE, t); };
  C.cyl = (mb, u, z, y0, y1, r0, r1, seg, c, cap) => mb.cyl(X(u), Z(z), y0, y1, r0, r1, seg || 12, c || WHITE, cap !== false);
  C.sph = (mb, u, y, z, rx, ry, rz, c, seg) => mb.sphere(X(u), y, Z(z), rx, ry, rz == null ? rx : rz, c || WHITE, seg || 8);
  C.floorQ = (mb, u0, z0, u1, z1, y, c, uv) => { const a = X(u0), b = X(u1); mb.floor(Math.min(a, b), Z(z0), Math.max(a, b), Z(z1), y, c || WHITE, uv); };
  C.wallQ = (mb, u0, y0, u1, y1, z, c, uv) => { const a = X(u0), b = X(u1); mb.wall(Math.min(a, b), y0, Math.max(a, b), y1, Z(z), c || WHITE, uv); };
  C.sideQ = (mb, u, z0, z1, y0, y1, c, uv) => mb.quad([X(u), y0, Z(z1)], [X(u), y0, Z(z0)], [X(u), y1, Z(z0)], [X(u), y1, Z(z1)], [-s, 0, 0], uv || [0, 0, 1, 1], c || WHITE);
  C.ob = (u0, z0, u1, z1) => { const a = X(u0), b = X(u1); obs(Math.min(a, b), Z(Math.min(z0, z1)), Math.max(a, b), Z(Math.max(z0, z1))); };
  C.HL = new MB(); C.PL = new MB(); C.BULB = new MB();
  C.halo = (u, y, z, sz, col) => halo(C.HL, X(u), y, Z(z), sz, col);
  C.pool = (u, z, r, col) => C.PL.floor(X(u) - r, Z(z) - r, X(u) + r, Z(z) + r, .035, col);
  C.flush = () => { add(C.HL, glowMat(night(.5))); add(C.PL, glowMat(night(.38))); add(C.BULB, emMat([1, .92, .62], .3, 1.0)); };
  C.sign = (text, o, u0, u1, y0, y1, z, dN) => { const sg = T.sign(text, Object.assign({ w: 768, h: 150, fs: 70 }, o)), mb = new MB(); C.wallQ(mb, u0, y0, u1, y1, z); add(mb, { tex: sg.tex, em: sg.em, emDay: .4, emNight: dN || .85 }); };
  C.seat = (u, z, fu, fz, h) => { const fx = s * fu, l = Math.hypot(fx, fz) || 1, nx = fx / l, nz = fz / l, x = X(u), zz = Z(z); K.seatAdd(x, zz, Math.atan2(nx, nz), h, [x + nx * 1.15, zz + nz * 1.15]); };
  C.stool = (u, z, tu, tz, col) => { const b = new MB(); C.cyl(b, u, z, 0, .4, .2, .17, 10, GOLD, true); C.cyl(b, u, z, .4, .52, .33, .31, 14, col || PINK, true); C.cyl(b, u, z, .52, .55, .3, .3, 14, CREAM, true); add(b, {}); C.ob(u - .3, z - .3, u + .3, z + .3); C.seat(u, z, tu - u, tz - z, .52); };
  C.chair = (u, z, tu, tz, col) => { const b = new MB(), dx = tu - u, dz = tz - z, l = Math.hypot(dx, dz) || 1, fu = dx / l, fz = dz / l; col = col || WOOD;
    C.bx(b, u - .27, .38, z - .27, u + .27, .5, z + .27, col); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c]) => C.bx(b, u + a * .22 - .02, 0, z + c * .22 - .02, u + a * .22 + .02, .4, z + c * .22 + .02, [.22, .2, .24]));
    const bu = u - fu * .24, bz = z - fz * .24, eu = Math.abs(fu) * .03 + Math.abs(fz) * .24, ez = Math.abs(fz) * .03 + Math.abs(fu) * .24; C.bx(b, bu - eu, .5, bz - ez, bu + eu, 1.0, bz + ez, col);
    add(b, {}); C.ob(u - .3, z - .3, u + .3, z + .3); C.seat(u, z, fu, fz, .5); };
  C.table = (u, z, r, h, col, top) => { h = h || .72; const b = new MB(); C.cyl(b, u, z, 0, h, .07, .06, 8, GOLD, false); C.cyl(b, u, z, 0, .05, .3, .3, 12, GOLD, true); C.cyl(b, u, z, h, h + .06, r, r, 18, top || CREAM, true); C.cyl(b, u, z, h - .03, h, r + .02, r + .02, 18, col || PINK, false); add(b, {}); C.ob(u - r - .1, z - r - .1, u + r + .1, z + r + .1); };
  /* 沙发：dir 为世界方向 s/n/e/w（沙发朝向） */
  C.sofa = (u, z, dir, len, col, trim) => { trim = trim || GOLD; const x = X(u), zz = Z(z), fx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0, fz = dir === 's' ? 1 : dir === 'n' ? -1 : 0, ew = fx !== 0, hx = ew ? .5 : len / 2, hz = ew ? len / 2 : .5, b = new MB(), dk = mul(col, [.88, .88, .88]);
    b.box(x - hx, 0, zz - hz, x + hx, .45, zz + hz, col); b.box(x - hx - .02, 0, zz - hz - .02, x + hx + .02, .12, zz + hz + .02, trim);
    const bx_ = x - fx * (hx - .1), bz_ = zz - fz * (hz - .1);
    if (ew) b.box(bx_ - .1, .45, zz - hz, bx_ + .1, 1.05, zz + hz, dk); else b.box(x - hx, .45, bz_ - .1, x + hx, 1.05, bz_ + .1, dk);
    if (ew) { b.box(x - hx, .45, zz - hz, x + hx, .7, zz - hz + .12, trim); b.box(x - hx, .45, zz + hz - .12, x + hx, .7, zz + hz, trim); } else { b.box(x - hx, .45, zz - hz, x - hx + .12, .7, zz + hz, trim); b.box(x + hx - .12, .45, zz - hz, x + hx, .7, zz + hz, trim); }
    add(b, {}); K.obs(x - hx - .05, zz - hz - .05, x + hx + .05, zz + hz + .05);
    const ns = Math.max(1, Math.round(len / 1.1)); for (let k = 0; k < ns; k++) { const o = (k - (ns - 1) / 2) * 1.05, sx = x + (ew ? 0 : o) - fx * .08, sz = zz + (ew ? o : 0) - fz * .08; K.seatAdd(sx, sz, Math.atan2(fx, fz), .45, [sx + fx * 1.2, sz + fz * 1.2]); } };
  C.parasol = (u, z, c1, c2) => { const h = 3.1; occ(() => { const p = new MB(), x0 = X(u), z0 = Z(z); C.cyl(p, u, z, 0, h, .05, .04, 6, [.92, .92, .94], false);
    for (let i = 0; i < 8; i++) { const a0 = i / 8 * 6.283, a1 = (i + 1) / 8 * 6.283; p.tri([x0, h + .5, z0], [x0 + Math.cos(a0) * 1.8, h, z0 + Math.sin(a0) * 1.8], [x0 + Math.cos(a1) * 1.8, h, z0 + Math.sin(a1) * 1.8], [0, 1, 0], i % 2 ? c2 : c1); }
    C.sph(p, u, h + .55, z, .08, .08, .08, GOLD, 5); add(p, {}); }); C.halo(u, h - .2, z, 2.2, [1, .85, .55]); C.pool(u, z, 1.9, [1, .82, .6]); };
  C.lamp = (u, z, col, h) => { h = h || 2.7; const p = new MB(), g = new MB(); C.cyl(p, u, z, 0, h, .07, .05, 8, [.2, .2, .24], true); C.cyl(p, u, z, 0, .25, .2, .12, 8, GOLD, true); C.sph(g, u, h + .22, z, .24, .28, .24, [1, .95, .8], 8); add(p, {}); add(g, emMat([1, .93, .75], .35, 1.0)); C.halo(u, h + .2, z, 2.2, col || [1, .85, .6]); C.pool(u, z, 1.6, col || [1, .85, .6]); C.ob(u - .2, z - .2, u + .2, z + .2); };
  C.planter = (u0, z0, u1, z1, flowers) => { const b = new MB(), l = new MB(), f = new MB(); C.bx(b, u0, 0, z0, u1, .5, z1, [.96, .94, .9]); C.bx(b, u0 - .04, .5, z0 - .04, u1 + .04, .56, z1 + .04, GOLD);
    const nu = Math.max(2, Math.round(Math.abs(u1 - u0) / .5)), nz = Math.max(1, Math.round(Math.abs(z1 - z0) / .5));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nz; j++) { const u = u0 + (i + .5) * (u1 - u0) / nu, z = z0 + (j + .5) * (z1 - z0) / nz; C.sph(l, u, .72 + ((i + j) % 2) * .08, z, .32, .26, .32, [.2 + ((i * 3 + j) % 3) * .05, .5, .3], 5); if ((i + j) % 2 === 0) C.sph(f, u + .1, .98, z, .09, .09, .09, flowers[(i + j) % flowers.length], 4); }
    add(b, {}); add(l, {}); add(f, {}); C.ob(u0, z0, u1, z1); };
  C.strings = (u0, y0, z0, u1, y1, z1, n) => { for (let i = 0; i <= n; i++) { const t = i / n, u = u0 + (u1 - u0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * .35; C.sph(C.BULB, u, y, z, .07, .07, .07, WHITE, 4); if (i % 2 === 0) C.halo(u, y, z, .9, [1, .85, .5]); } };
  return C;
}
function paintMenu(R, title, items, bg, fg, ac) {
  return R.paint(512, 320, g => { g.fillStyle = bg; g.fillRect(0, 0, 512, 320); g.strokeStyle = ac; g.lineWidth = 8; g.strokeRect(8, 8, 496, 304); g.textBaseline = 'middle'; g.font = '800 40px "Arial Black","PingFang SC","Noto Sans SC",sans-serif'; g.textAlign = 'center'; g.fillStyle = ac; g.fillText(title, 256, 46);
    g.font = '700 27px "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif'; items.forEach(([n, p], i) => { const y = 100 + i * 42; g.textAlign = 'left'; g.fillStyle = fg; g.fillText(n, 44, y); g.textAlign = 'right'; g.fillStyle = ac; g.fillText(p, 468, y); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(44, y + 20, 424, 2); }); }, { clamp: true });
}
/* 外带窗口的条纹遮阳棚 */
function awning(C, u0, u1, y1, y2, z0, z1, c1, c2) { const m = new MB(), n = 8, w = (u1 - u0) / n;
  for (let i = 0; i < n; i++) { const xa = C.X(u0 + i * w), xb = C.X(u0 + (i + 1) * w); m.quad([Math.min(xa, xb), y1, C.Z(z0)], [Math.max(xa, xb), y1, C.Z(z0)], [Math.max(xa, xb), y2, C.Z(z1)], [Math.min(xa, xb), y2, C.Z(z1)], [0, .8, .6], [0, 0, 1, 1], i % 2 ? c2 : c1);
    const sc = new MB(); sc.cyl((xa + xb) / 2, C.Z(z1), y2 - .25, y2, Math.abs(xb - xa) * .5, Math.abs(xb - xa) * .5, 10, i % 2 ? c2 : c1, true); C.add(sc, {}); }
  C.add(m, {}); }

/* ======================= 星光奶茶 ======================= */
function bobaShop(K, cx, cz, o) {
  o = o || {}; const s = o.s == null ? 1 : o.s, C = ctx(K, cx, cz, s), { R, T, add, occ, bx, cyl, sph, wallQ, floorQ, sideQ, emMat, S } = C;
  const HX0 = -6.4, HX1 = .8, ZB = -4.5, ZF = 1.6, KC = 3.8, EW = KC + 3.3;
  const checker = R.paint(128, 128, g => { g.fillStyle = '#ffe3ec'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fffaf5'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); });
  const gingham = R.paint(128, 128, g => { g.fillStyle = '#ffd0df'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 4; i++) { g.fillRect(i * 32, 0, 16, 128); g.fillRect(0, i * 32, 128, 16); } });
  const stripe = R.paint(128, 64, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffe6ee' : '#ffc4d6'; g.fillRect(i * 16, 0, 16, 64); } });
  { const f = new MB(); floorQ(f, HX0, ZB, HX1, ZF, .02, WHITE, [0, 0, 3, 3]); add(f, { tex: checker });
    const t = new MB(); floorQ(t, HX0 - .4, ZF, EW, 8.4, .02, WHITE, [0, 0, 8, 3]); add(t, { tex: stripe });
    const k2 = new MB(); floorQ(k2, HX1, ZB, EW, ZF, .02, WHITE, [0, 0, 4, 3]); add(k2, { tex: stripe });
    const tr = new MB(); floorQ(tr, HX0 - .4, 8.4, EW, 8.55, .04, GOLD); add(tr, {}); }
  { const w = new MB(), tr = new MB(), wn = new MB();
    wallQ(w, HX0, 0, EW, 4.2, ZB, WHITE, [0, 0, 6, 1.4]); sideQ(w, HX0, ZB, ZF, 0, 4.2, WHITE, [0, 0, 2, 1.4]); add(w, { tex: gingham });
    wallQ(tr, HX0, 4.2, EW, 4.45, ZB + .02, CREAM); wallQ(tr, HX0, 0, EW, .3, ZB + .02, CREAM); sideQ(tr, HX0 + .02, ZB, ZF, 4.2, 4.45, CREAM); sideQ(tr, HX0 + .02, ZB, ZF, 0, .3, CREAM); add(tr, {});
    C.ob(HX0 - .2, ZB - .3, EW + .1, ZB + .2); C.ob(HX0 - .2, ZB, HX0 + .2, ZF);
    [-3.4, -.9].forEach(z => sideQ(wn, HX0 + .03, z - .8, z + .8, 1.4, 3.3, [.85, .95, 1])); add(wn, emMat([.85, .95, 1], .15, .5)); }
  { const ct = new MB(), it = new MB(), sh = new MB();
    bx(ct, -5.5, 0, -2.3, -1.0, 1.05, -1.5, [1, .93, .95]); bx(ct, -5.6, 1.05, -2.4, -.9, 1.14, -1.4, PINK); bx(ct, -5.5, 0, -1.55, -1.0, .3, -1.5, GOLD); add(ct, {}); C.ob(-5.7, -2.5, -.8, -1.3);
    [-4.6, -3.2, -1.8].forEach((u, i) => { cyl(it, u, -1.9, 1.14, 1.55, .18, .14, 10, [1, .95, .9], true); cyl(it, u, -1.9, 1.14, 1.34, .16, .16, 10, i % 2 ? [.95, .7, .8] : [.62, .4, .27], true); cyl(it, u + .05, -1.9, 1.55, 1.9, .02, .02, 4, [1, .4, .6], false); });
    sph(it, -2.25, 1.62, -1.95, .3, .16, .3, [1, .6, .75], 8); add(it, {});
    [1.5, 2.2].forEach(y => { bx(sh, -5.8, y, -4.45, -.6, y + .06, -4.15, WHITE); for (let k = 0; k < 10; k++) cyl(sh, -5.5 + k * .5, -4.3, y + .06, y + .42, .14, .14, 8, [PINK, MINT, YEL, LILAC][k % 4], true); }); add(sh, {});
    const mn = paintMenu(R, '招牌饮品 · MENU', [['珍珠奶茶', '¥18'], ['芋泥波波', '¥22'], ['杨枝甘露', '¥24'], ['草莓鲜奶', '¥23'], ['茉莉厚乳', '¥20']], '#fff4f7', '#7a3a4c', '#ff6f9f'), mb = new MB(); wallQ(mb, -5.2, 2.65, -1.1, 4.0, ZB + .08); add(mb, { tex: mn, em: mn, emDay: .45, emNight: .8 });
    S.hotspots.push({ id: 'boba_order', x: C.X(-3.2), z: C.Z(-.5), r: 1.7, label: '点单', btn: '点单', icon: '🧋', color: [1, .6, .8], msg: '店员：欢迎光临星光奶茶！招牌珍珠奶茶一杯～（演示版）' });
    C.halo(-3.2, 3.3, -4.0, 4.2, [1, .8, .88]); C.pool(-3.2, -.6, 3.0, [1, .8, .86]); }
  /* 前檐梁 + 两根柱 + 屋顶猫头 */
  { const bm = new MB(); bx(bm, HX0 - .2, 4.2, ZF - .3, HX1 + .2, 4.85, ZF + .5, [1, .92, .95]); bx(bm, HX0 - .25, 4.15, ZF - .35, HX1 + .25, 4.28, ZF + .55, GOLD);
    [HX0 + .1, HX1 - .1].forEach(u => { cyl(bm, u, ZF + .1, 0, 4.2, .26, .22, 12, [1, .88, .92], true); cyl(bm, u, ZF + .1, 0, .3, .36, .36, 12, GOLD, true); C.ob(u - .35, ZF - .25, u + .35, ZF + .45); });
    occ(() => { add(bm, {});
      const hd = new MB(), ea = new MB(), ey = new MB(), fa = new MB(), hu = -2.8, hz = .1, hy = 6.65, fzp = hz + 2.3;
      sph(hd, hu, hy, hz, 3.55, 1.9, 2.4, [1, .94, .9], 24);
      [-1, 1].forEach(sd => { cyl(ea, hu + sd * 2.2, hz, hy + .7, hy + 2.5, 1.0, .08, 4, [1, .94, .9], true); cyl(ea, hu + sd * 2.2, hz + .32, hy + .8, hy + 2.1, .6, .06, 4, PINK, true); });
      const sf = (dx, dy) => hz + 2.4 * Math.sqrt(Math.max(0, 1 - (dx / 3.55) ** 2 - (dy / 1.9) ** 2)) + .1;   // 头部椭球表面 z：五官贴在表面外
      [-1, 1].forEach(sd => { const ex = sd * 1.3, ey0 = .15; sph(ey, hu + ex, hy + ey0, sf(ex, ey0), .38, .5, .14, [.12, .08, .1], 10); sph(ey, hu + ex + .11 * s, hy + ey0 + .17, sf(ex, ey0) + .1, .12, .15, .06, WHITE, 6);
        const cxp = sd * 2.2, cyp = -.5; sph(fa, hu + cxp, hy + cyp, sf(cxp, cyp), .46, .28, .1, [1, .6, .72], 8);
        for (let k = 0; k < 3; k++) bx(fa, hu + sd * 2.5, hy - .62 + k * .24, sf(2.5, -.4) + .02, hu + sd * 3.9, hy - .58 + k * .24, sf(2.5, -.4) + .06, [.55, .42, .42]); });
      sph(fa, hu, hy - .3, sf(0, -.3) + .02, .2, .15, .1, [1, .5, .62], 8); sph(fa, hu - .24, hy - .7, sf(0, -.7) + .02, .24, .11, .07, [.3, .2, .2], 6); sph(fa, hu + .24, hy - .7, sf(0, -.7) + .02, .24, .11, .07, [.3, .2, .2], 6);
      add(hd, {}); add(ea, {}); add(ey, {}); add(fa, {}); });
    C.sign('星光奶茶 STAR BOBA', { w: 768, h: 140, fs: 64, bg: '#ff8fb5', fg: '#fff', border: '#fff' }, HX0 + .9, HX1 - .9, 4.3, 4.78, ZF + .58, .8);
    C.halo(-2.8, 4.6, ZF + 1.2, 5.4, [1, .75, .86]); C.halo(-2.8, 7.4, ZF + 1.2, 4.4, [1, .86, .9]); }
  /* 厅内座位 */
  { C.sofa(HX0 + .55, -.1, s > 0 ? 'e' : 'w', 2.2, PINK, GOLD);
    [-3.6, -1.0].forEach((u, i) => { const c = i ? MINT : PINK; C.table(u, -.1, .5, .74, c); C.stool(u, -1.0, u, -.1, c); C.stool(u, .8, u, -.1, c); });
    const pd = new MB(); [-4.8, -2.6, -.4].forEach(u => { cyl(pd, u, -.9, 3.2, 4.2, .02, .02, 4, [.5, .4, .4], false); sph(pd, u, 3.05, -.9, .28, .32, .28, [1, .93, .85], 8); C.halo(u, 3.0, -.9, 1.8, [1, .85, .6]); }); occ(() => add(pd, emMat([1, .92, .75], .35, 1.0))); }
  /* 巨型波霸杯外带亭 */
  { const cu = KC, cc = -1.6, y0 = .3, y1 = 4.9, rb = 1.65, rt = 2.2, bands = [[.42, .22, .12], [.58, .33, .18], [.74, .46, .26], [.88, .62, .38], [.97, .78, .55], [1, .88, .72], [1, .93, .84]], n = bands.length;
    occ(() => { const cup = new MB(), lid = new MB(), st = new MB(), pe = new MB(), hh = new MB();
      bands.forEach((c, i) => { const a = y0 + (y1 - y0) * i / n, b = y0 + (y1 - y0) * (i + 1) / n; cyl(cup, cu, cc, a, b, rb + (rt - rb) * i / n, rb + (rt - rb) * (i + 1) / n, 28, c, i === 0); });
      cyl(cup, cu, cc, y1 - .02, y1 + .26, rt + .08, rt + .08, 28, WHITE, true); cyl(cup, cu, cc, y1 + .24, y1 + .32, rt + .14, rt + .14, 28, PINK, true);
      sph(lid, cu, y1 + .3, cc, rt + .02, .9, rt + .02, [.99, .95, .9], 20); [[6.0, 1.3], [6.4, .92], [6.75, .52]].forEach(([y, r]) => sph(lid, cu, y, cc, r, .38, r, [1, .98, .94], 14)); sph(lid, cu, 7.0, cc, .26, .26, .26, [.9, .1, .22], 10);
      for (let i = 0; i < 12; i++) { const y = 5.4 + i * .42, sx = Math.sin(i * .5) * .12; cyl(st, cu - .9 - i * .1 - sx, cc + .3, y, y + .44, .16, .16, 8, i % 2 ? [1, .35, .55] : WHITE, true); }
      for (let q = 0; q < 26; q++) { const a = Math.PI / 2 - 1.15 + (q % 13) / 12 * 2.3 + (q > 12 ? .09 : 0), yy = .65 + (q > 12 ? .5 : 0) + ((q * 37) % 10) / 40, r = rb + (rt - rb) * (yy - y0) / (y1 - y0) + .04, px = C.X(cu) + Math.cos(a) * r, pz = C.Z(cc) + Math.sin(a) * r; pe.sphere(px, yy, pz, .27, .27, .27, [.16, .1, .09], 8); hh.sphere(px - .08, yy + .11, pz + .13, .06, .06, .05, WHITE, 4); }
      add(cup, {}); add(lid, {}); add(st, {}); add(pe, {}); add(hh, emMat(WHITE, .3, .9)); });
    C.ob(cu - 2.4, cc - 2.4, cu + 2.4, cc + 1.9);
    const pb = new MB(); cyl(pb, cu, cc + .4, 0, .04, 3.6, 3.6, 24, WHITE, true); add(pb, {});
    const pe2 = new MB(); [[-3, 1.7], [3, 1.9], [-2.6, 2.6]].forEach(([du, dz]) => sph(pe2, cu + du, .3, cc + dz, .3, .3, .3, [.16, .1, .09], 8)); add(pe2, {});
    const ct = new MB(); bx(ct, cu - 2.5, 0, cc + 2.2, cu + 2.5, 1.0, cc + 2.95, [1, .93, .94]); bx(ct, cu - 2.6, 1.0, cc + 2.1, cu + 2.6, 1.1, cc + 3.05, PINK); add(ct, {}); C.ob(cu - 2.7, cc + 2.05, cu + 2.7, cc + 3.1);
    awning(C, cu - 2.7, cu + 2.7, 2.5, 1.95, cc + 1.7, cc + 3.4, PINK, CREAM);
    C.sign('星光奶茶', { w: 512, h: 200, fs: 120, bg: '#ff8fb5', fg: '#fff', border: '#fff' }, cu - 1.55, cu + 1.55, 2.7, 3.75, cc + 2.45, .8);
    C.sign('STAR BOBA · 珍珠奶茶 · 现摇鲜奶', { w: 768, h: 90, fs: 40, bg: '#fff3e6', fg: '#a8452c', border: '#ffb3c9' }, cu - 2.4, cu + 2.4, 1.15, 1.7, cc + 3.08, .7);
    const cp = new MB(); [-1.7, -.5, .8, 1.9].forEach(du => { cyl(cp, cu + du, cc + 2.6, 1.1, 1.62, .17, .13, 10, [1, .95, .9], true); cyl(cp, cu + du, cc + 2.6, 1.1, 1.3, .15, .15, 10, [.62, .4, .27], true); cyl(cp, cu + du + .04, cc + 2.6, 1.62, 1.95, .02, .02, 4, [1, .4, .6], false); }); add(cp, {});
    S.hotspots.push({ id: 'boba_go', x: C.X(cu), z: C.Z(cc + 4.6), r: 1.8, label: '外带', btn: '外带', icon: '🧋', color: [1, .6, .8], msg: '外带窗口：一杯珍珠奶茶，少冰三分糖～（演示版）' });
    C.halo(cu, 3.1, cc + 3.2, 4.2, [1, .75, .85]); C.halo(cu, 6.0, cc + 1, 4.2, [1, .86, .9]); C.pool(cu, cc + 3.8, 3.4, [1, .82, .86]);
    for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; sph(C.BULB, cu + Math.cos(a) * s * (rt + .12), y1 + .55, cc + Math.sin(a) * (rt + .12), .07, .07, .07, WHITE, 4); } }
  /* 露台 */
  { C.table(-4.5, 4.8, .6, .72, PINK); [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([a, b], i) => C.stool(-4.5 + a * 1.05, 4.8 + b * 1.05, -4.5, 4.8, [PINK, MINT, YEL, LILAC][i])); C.parasol(-4.5, 4.8, PINK, CREAM);
    C.sofa(-.4, 4.3, 's', 2.4, PINK, GOLD); C.sofa(-.4, 6.9, 'n', 2.4, MINT, GOLD); C.table(-.4, 5.6, .55, .45, CREAM);
    C.table(3.6, 6.4, .5, .72, MINT); [[-1, 0], [1, 0], [0, 1]].forEach(([a, b], i) => C.stool(3.6 + a * 1.0, 6.4 + b * 1.0, 3.6, 6.4, [MINT, PINK, YEL][i])); C.parasol(3.6, 6.4, MINT, CREAM);
    C.planter(HX0 - .3, 8.1, -2.8, 8.45, [[1, .55, .7], YEL, WHITE]); C.planter(1.4, 8.1, EW - .2, 8.45, [[1, .55, .7], YEL, WHITE]);
    [HX0 - .2, -1.4, 1.1, EW - .1].forEach(u => C.lamp(u, 8.0, [1, .78, .86], 2.6));
    C.strings(HX0 - .2, 3.6, 8.0, -1.4, 3.6, 8.0, 9); C.strings(1.1, 3.6, 8.0, EW - .1, 3.6, 8.0, 9); C.strings(HX0 + .1, 4.6, ZF + .5, HX0 - .2, 3.6, 8.0, 6); }
  C.flush();
}

/* ======================= 星光咖啡 ======================= */
function cafeShop(K, cx, cz, o) {
  o = o || {}; const s = o.s == null ? -1 : o.s, C = ctx(K, cx, cz, s), { R, T, add, occ, bx, cyl, sph, wallQ, floorQ, sideQ, emMat, S } = C;
  const HX0 = -6.4, HX1 = .3, ZB = -4.5, ZF = 1.7, KC = 3.6, EW = KC + 3.3, MID = (HX0 + HX1) / 2, RAD = (HX1 - HX0) / 2, WH = 3.1, WHT = [.98, .98, .95], GRN = [.3, .55, .45];
  const parquet = R.paint(128, 128, g => { for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) { const v = ((x * 7 + y * 3) % 5) * 5; g.fillStyle = `rgb(${196 + v},${150 + v},${100 + v})`; g.fillRect(x * 64, y * 32, 62, 30); } g.strokeStyle = 'rgba(70,40,20,.5)'; g.lineWidth = 2; for (let y = 0; y <= 4; y++) { g.beginPath(); g.moveTo(0, y * 32); g.lineTo(128, y * 32); g.stroke(); } });
  const tile = R.paint(128, 128, g => { g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#8fb5a2'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); });
  const brick = R.paint(128, 128, g => { g.fillStyle = '#e9d9bf'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(150,110,70,.45)'; g.lineWidth = 3; for (let y = 0; y < 4; y++) { g.beginPath(); g.moveTo(0, y * 32); g.lineTo(128, y * 32); g.stroke(); for (let x = 0; x < 3; x++) { g.beginPath(); g.moveTo(x * 48 + (y % 2) * 24, y * 32); g.lineTo(x * 48 + (y % 2) * 24, y * 32 + 32); g.stroke(); } } });
  const glassT = em => R.paint(128, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); if (em) { gr.addColorStop(0, '#ffe3a8'); gr.addColorStop(1, '#ffc87a'); } else { gr.addColorStop(0, '#cfe9ff'); gr.addColorStop(1, '#eaf6ff'); } g.fillStyle = gr; g.fillRect(0, 0, 128, 256); g.strokeStyle = '#fbfbf7'; g.lineWidth = 8; g.strokeRect(2, 2, 124, 252); g.lineWidth = 4; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 256); g.moveTo(0, 120); g.lineTo(128, 120); g.stroke(); }, { clamp: true });
  { const f = new MB(); floorQ(f, HX0, ZB, HX1, ZF, .02, WHITE, [0, 0, 3, 3]); add(f, { tex: parquet });
    const t = new MB(); floorQ(t, HX0 - .4, ZF, EW, 8.4, .02, WHITE, [0, 0, 8, 4]); add(t, { tex: tile });
    const k2 = new MB(); floorQ(k2, HX1, ZB, EW, ZF, .02, WHITE, [0, 0, 4, 3]); add(k2, { tex: tile });
    const tr = new MB(); floorQ(tr, HX0 - .4, 8.4, EW, 8.55, .04, GOLD); add(tr, {}); }
  { const w = new MB(), wd = new MB(), gl = new MB(), fr = new MB();
    wallQ(w, HX0, 0, EW, 4.0, ZB, WHITE, [0, 0, 6, 1.4]); add(w, { tex: brick });
    wallQ(wd, HX0, 0, EW, 1.2, ZB + .03, [.5, .34, .22]); wallQ(wd, HX0, 1.2, EW, 1.28, ZB + .04, GOLD); sideQ(wd, HX0, ZB, ZF, 0, 1.2, [.5, .34, .22]); add(wd, {});
    [-3.5, -1.5, .5].forEach(z => sideQ(gl, HX0 + .02, z - .7, z + .7, 1.3, 3.1, WHITE)); add(gl, { tex: glassT(false), em: glassT(true), emDay: .3, emNight: 1.0 });
    bx(fr, HX0 - .08, 0, ZB, HX0 + .08, 3.15, ZB + .15, WHT); bx(fr, HX0 - .08, 0, ZF - .15, HX0 + .08, 3.15, ZF, WHT); bx(fr, HX0 - .08, 3.1, ZB, HX0 + .08, 3.25, ZF, WHT); add(fr, {});
    C.ob(HX0 - .2, ZB - .3, EW + .1, ZB + .2); C.ob(HX0 - .2, ZB, HX0 + .2, ZF); }
  /* 玻璃花房拱顶骨架 */
  occ(() => { const rb = new MB(), pl = new MB();
    [-4.35, -2.2, -.05, 1.6].forEach(z => rb.arch(C.X(MID), WH, C.Z(z) - .07, C.Z(z) + .07, RAD + .08, RAD - .12, 0, Math.PI, 28, WHT));
    bx(rb, MID - .07, WH + RAD - .08, ZB, MID + .07, WH + RAD + .08, ZF + .1, GOLD); [HX0, HX1].forEach(u => bx(rb, u - .08, WH - .05, ZB, u + .08, WH + .1, ZF + .1, WHT));
    bx(rb, HX1 - .1, 0, ZF - .15, HX1 + .1, WH, ZF + .05, WHT); bx(rb, HX1 - .1, 0, ZB, HX1 + .1, WH, ZB + .2, WHT);
    [[-3.3, -2.2], [-1.3, -.05], [-5.2, -2.2]].forEach(([u, z]) => { pl.sphere(C.X(u), WH + RAD * .6, C.Z(z), .45, .3, .45, [.28, .6, .34], 6); pl.sphere(C.X(u) + .2, WH + RAD * .6 - .2, C.Z(z) + .1, .3, .3, .3, [.35, .7, .4], 6); });
    add(rb, {}); add(pl, {}); });
  C.sign('Café Étoile · 星光咖啡馆', { w: 768, h: 130, fs: 54, bg: '#fbf4e6', fg: '#3b4f45', border: '#c9a24a' }, MID - 2.6, MID + 2.6, WH + .35, WH + 1.3, ZF + .16, .5);
  C.halo(MID, WH + .9, ZF + 1.0, 5.2, [1, .88, .6]);
  /* 吧台 */
  { const ct = new MB(), it = new MB(), sh = new MB(), cs = new MB();
    bx(ct, -5.7, 0, -3.1, -.6, 1.05, -2.25, [.97, .94, .88]); bx(ct, -5.8, 1.05, -3.2, -.5, 1.14, -2.15, [.28, .42, .34]); bx(ct, -5.7, 0, -2.3, -.6, .3, -2.25, GOLD); add(ct, {}); C.ob(-5.9, -3.3, -.4, -2.0);
    bx(it, -5.2, 1.14, -3.0, -4.2, 1.6, -2.5, [.74, .76, .8]); bx(it, -5.0, 1.6, -2.95, -4.4, 1.78, -2.55, [.5, .52, .56]); cyl(it, -3.8, -2.7, 1.14, 1.5, .12, .1, 8, [.3, .2, .12], true); [-3.2, -2.5].forEach(u => cyl(it, u, -2.6, 1.14, 1.3, .1, .07, 8, WHITE, true));
    bx(cs, -2.1, 1.14, -3.0, -.9, 1.9, -2.5, [.9, .96, 1]); bx(cs, -2.1, 1.3, -2.95, -.9, 1.34, -2.55, WHITE); [0, 1].forEach(i => { sph(cs, -1.7 + i * .6, 1.42, -2.75, .18, .12, .18, [1, .6, .7], 6); sph(cs, -1.6 + i * .6, 1.7, -2.75, .18, .12, .18, [.95, .85, .55], 6); }); add(it, {}); add(cs, {});
    [1.5, 2.3].forEach(y => { bx(sh, -5.7, y, -4.45, -.7, y + .06, -4.15, WOOD); for (let k = 0; k < 9; k++) cyl(sh, -5.4 + k * .55, -4.3, y + .06, y + .34, .12, .1, 8, k % 2 ? WHITE : [.3, .5, .42], true); }); add(sh, {});
    const mn = paintMenu(R, '今日咖啡 · CAFÉ', [['美式', '¥16'], ['拿铁', '¥20'], ['手冲单品', '¥28'], ['卡布奇诺', '¥21'], ['提拉米苏', '¥26']], '#2b3a33', '#f4ead2', '#e8c46a'), mb = new MB(); wallQ(mb, -5.0, 2.75, -1.3, 4.0, ZB + .08); add(mb, { tex: mn, em: mn, emDay: .4, emNight: .75 });
    S.hotspots.push({ id: 'cafe_order', x: C.X(-3.2), z: C.Z(-.9), r: 1.7, label: '点单', btn: '点单', icon: '☕', color: [1, .85, .5], msg: '咖啡师：欢迎光临星光咖啡！今天的手冲是埃塞俄比亚～（演示版）' });
    C.halo(-3.2, 3.3, -4.0, 4.4, [1, .85, .6]); C.pool(-3.2, -.8, 3.0, [1, .85, .6]);
    const pd = new MB(); [-5.0, -3.2, -1.4].forEach(u => { cyl(pd, u, -1.2, 2.4, WH + RAD * .6, .015, .015, 3, [.3, .3, .3], false); sph(pd, u, 2.28, -1.2, .26, .3, .26, [1, .93, .78], 8); C.halo(u, 2.25, -1.2, 1.8, [1, .85, .55]); }); occ(() => add(pd, emMat([1, .92, .72], .35, 1.0))); }
  /* 厅内座位 */
  { C.sofa(HX0 + .55, -.2, s > 0 ? 'e' : 'w', 2.2, GRN, GOLD);
    [-3.9, -1.5].forEach(u => { C.table(u, .1, .42, .74, [.95, .9, .8]); C.chair(u, -.75, u, .1); C.chair(u, .95, u, .1); });
    const pt = new MB(); cyl(pt, HX1 - .5, ZF - .6, 0, .5, .38, .3, 10, [.85, .6, .4], true); for (let k = 0; k < 6; k++) sph(pt, HX1 - .5 + Math.cos(k * 1.05) * .3, .9 + (k % 2) * .3, ZF - .6 + Math.sin(k * 1.05) * .3, .3, .45, .3, [.2, .55, .3], 6); add(pt, {}); C.ob(HX1 - .9, ZF - 1.0, HX1 - .1, ZF - .2); }
  /* 巨型咖啡杯外带亭 */
  { const cu = KC, cc = -1.3;
    const art = R.paint(256, 256, g => { const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, '#9b6b44'); gr.addColorStop(1, '#4a2a18'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#f4e3cf'; g.lineWidth = 9; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(128, 128, 90 - i * 22, 90 - i * 22, 0, 0, Math.PI * 2); g.stroke(); } }, { clamp: true });
    occ(() => { const cup = new MB(), han = new MB(), sc = new MB(), bn = new MB();
      cyl(sc, cu, cc, 0, .12, 3.3, 3.3, 28, [.97, .95, .92], true); cyl(sc, cu, cc, .12, .26, 3.1, 2.6, 28, [.97, .95, .92], true); cyl(sc, cu, cc, .1, .14, 2.95, 2.95, 28, GOLD, false);
      cyl(cup, cu, cc, .26, 4.1, 1.35, 2.05, 30, [.98, .97, .95], true); cyl(cup, cu, cc, .8, .92, 1.46, 1.47, 30, GOLD, false); cyl(cup, cu, cc, 3.5, 3.6, 1.96, 1.97, 30, GOLD, false); cyl(cup, cu, cc, 3.95, 4.2, 2.07, 2.08, 30, WHITE, false);
      han.arch(C.X(cu + 1.75), 2.3, C.Z(cc) - .3, C.Z(cc) + .3, 1.15, .76, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : 3 * Math.PI / 2, 24, [.98, .97, .95]);
      for (let k = 0; k < 8; k++) sph(bn, cu - 2.4 + (k % 4) * 1.6, .36, cc + 2.2 + (k > 3 ? .45 : 0), .24, .16, .18, [.35, .2, .12], 6);
      add(sc, {}); add(cup, {}); add(han, {}); add(bn, {}); const la = new MB(); la.disc(C.X(cu), C.Z(cc), 4.12, 1.95, 40, WHITE); add(la, { tex: art }); });
    C.ob(cu - 2.4, cc - 2.4, cu + 2.4, cc + 1.8);
    const ct = new MB(); bx(ct, cu - 2.4, 0, cc + 2.3, cu + 2.4, 1.0, cc + 3.05, [.97, .94, .88]); bx(ct, cu - 2.5, 1.0, cc + 2.2, cu + 2.5, 1.1, cc + 3.15, [.2, .38, .3]); add(ct, {}); C.ob(cu - 2.6, cc + 2.15, cu + 2.6, cc + 3.2);
    awning(C, cu - 2.6, cu + 2.6, 2.5, 1.95, cc + 1.8, cc + 3.5, [.16, .4, .3], CREAM);
    C.sign('STAR CAFÉ 星光咖啡', { w: 768, h: 150, fs: 62, bg: '#1d3a2e', fg: '#f5e2b0', border: '#d9b45a' }, cu - 2.4, cu + 2.4, 2.7, 3.4, cc + 2.2, .8);
    C.sign('精品手冲 · 拿铁 · 手作甜点', { w: 768, h: 90, fs: 40, bg: '#f5ead6', fg: '#4a2a18', border: '#d9b45a' }, cu - 2.4, cu + 2.4, 1.15, 1.7, cc + 3.18, .7);
    S.hotspots.push({ id: 'cafe_go', x: C.X(cu), z: C.Z(cc + 4.7), r: 1.8, label: '外带', btn: '外带', icon: '☕', color: [1, .85, .5], msg: '外带窗口：一杯热拿铁，小心烫～（演示版）' });
    C.halo(cu, 3.0, cc + 3.2, 4.2, [1, .85, .6]); C.halo(cu, 4.6, cc + .5, 3.6, [1, .85, .6]); C.pool(cu, cc + 3.9, 3.4, [1, .85, .6]);
    (S.shopFx = S.shopFx || []).push((fx, t, c, sn) => { for (let k = 0; k < 14; k++) { const ph = (t * .22 + k * .071) % 1, x = C.X(cu) + Math.sin(ph * 7 + k) * .5 + (k % 3 - 1) * .7, y = 4.4 + ph * 3.0, z = C.Z(cc) + Math.cos(k) * .6, q = .2 + ph * .28, f = .55 * (1 - ph), P = (u, v) => [x + u * q, y + c * v * q, z - sn * v * q]; fx.spray.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], [f, f * .98, f * .94]); } }); }
  /* 露台：藤编/绿色沙发 */
  { C.sofa(-4.6, 4.2, 's', 2.4, GRN, WOOD); C.sofa(-4.6, 6.8, 'n', 2.4, GRN, WOOD); C.table(-4.6, 5.5, .55, .45, [.96, .92, .84]); C.parasol(-4.6, 5.5, GRN, CREAM);
    C.table(-1.0, 5.0, .45, .74, WOOD); C.chair(-1.0, 4.1, -1.0, 5.0); C.chair(-1.0, 5.9, -1.0, 5.0);
    C.table(3.4, 6.2, .5, .74, WOOD); [[-1, 0], [1, 0], [0, 1]].forEach(([a, b]) => C.chair(3.4 + a * 1.0, 6.2 + b * 1.0, 3.4, 6.2)); C.parasol(3.4, 6.2, [.92, .82, .6], CREAM);
    C.planter(HX0 - .3, 8.1, -3.0, 8.45, [[1, .55, .7], YEL, LILAC]); C.planter(-1.5, 8.1, EW - .2, 8.45, [[1, .55, .7], YEL, WHITE]);
    [HX0 - .2, -2.2, EW - .1].forEach(u => C.lamp(u, 8.0, [1, .86, .6], 2.6)); C.strings(HX0 - .2, 3.7, 8.0, -2.2, 3.7, 8.0, 8); C.strings(-2.2, 3.7, 8.0, EW - .1, 3.7, 8.0, 12); C.strings(MID, WH + RAD, ZF + .1, HX0 - .2, 3.7, 8.0, 8); }
  C.flush();
}

G.Shops = Object.assign(G.Shops || {}, { bobaShop, cafeShop });

/* 预览场景：两家大店 */
G.Scenes.makeShopDemo = function (R, T) {
  const K = G.KTV.kit(R, T), { S, add } = K;
  const f = new MB(); f.floor(-60, -45, 60, 30, 0, [1, 1, 1], [0, 0, 30, 18.75]); add(f, { tex: T.pave });
  G.Shops.bobaShop(K, 18, 0, { s: 1 }); G.Shops.cafeShop(K, -18, 0, { s: -1 });
  S.dyn = (fx, t, g, env) => { const c = Math.cos(PITCH), sn = Math.sin(PITCH); (S.shopFx || []).forEach(fn => fn(fx, t, c, sn)); fx.glow = { spray: .35, beam: 0, spark: .5 }; };
  S.walkable = () => true; S.heightAt = () => 0; S.bounds = { x0: -60, x1: 60, z0: -40, z1: 25 }; S.spawn = [0, 12];
  S.camera = { dist: 27, pitch: PITCH, fov: .72, clampX: [-40, 40], clampZ: [-2, 8], lead: 4 }; S.npcRect = { x0: -5, x1: 5, z0: 5, z1: 12 }; S.npcN = 0;
  S.name = '店面预览'; S.indoor = false; S.env = h => G.World.envAt(h);
  return S;
};
})(window);
