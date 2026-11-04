
/* scene-common.js — 多个场景共用的工具: 几何(Scenes.C) / 批次包围盒 / 遮挡变透明 / 棕榈树·雨树·长椅
   用法: const K = Scenes.C.kit(R, T, S);  之后用 K.add / K.occ / K.palm ... ; 场景需要 S.updateOcclusion 由 kit 自动提供 */
(function (G) {
'use strict';
const { MB, hex } = G.World, TAU = Math.PI * 2, C = {};
C.TAU = TAU;
C.rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
C.halo = (mb, x, y, z, s, col, pitch) => { const p = pitch == null ? .5 : pitch, c = Math.cos(p), sn = Math.sin(p); const P = (a, b) => [x + a * s, y + c * b * s, z - sn * b * s]; mb.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col); };
C.pool = (mb, x, z, r, col, y) => mb.floor(x - r, z - r, x + r, z + r, y == null ? .04 : y, col);
C.rbox = (mb, cx, cz, w, d, y0, y1, yaw, col, tile, o) => {                       // 可旋转的盒子 (正面朝 local +z)
  o = o || {}; col = col || [1, 1, 1]; const c = Math.cos(yaw), s = Math.sin(yaw), hw = w / 2, hd = d / 2, tw = tile ? tile[0] : 1e9, th = tile ? tile[1] : 1e9, H = y1 - y0;
  const P = (lx, lz, y) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
  const F = (a, b, n, len) => mb.quad(P(a[0], a[1], y0), P(b[0], b[1], y0), P(b[0], b[1], y1), P(a[0], a[1], y1), n, [0, 0, len / tw, H / th], col);
  if (!o.noFront) F([-hw, hd], [hw, hd], [s, 0, c], w);
  if (!o.noBack) F([hw, -hd], [-hw, -hd], [-s, 0, -c], w);
  if (!o.noSides) { F([hw, hd], [hw, -hd], [c, 0, -s], d); F([-hw, -hd], [-hw, hd], [-c, 0, s], d); }
  if (!o.noTop) mb.quad(P(-hw, hd, y1), P(hw, hd, y1), P(hw, -hd, y1), P(-hw, -hd, y1), [0, 1, 0], [0, 0, w / tw, d / th], col);
};
C.tcyl = (mb, a, b, r0, r1, seg, col) => {                                        // 倾斜圆柱
  const base = mb.n; for (let k = 0; k <= seg; k++) { const an = k / seg * TAU, c = Math.cos(an), s = Math.sin(an);
    mb.vert([a[0] + c * r0, a[1], a[2] + s * r0], [c, 0, s], k / seg, 1, col); mb.vert([b[0] + c * r1, b[1], b[2] + s * r1], [c, 0, s], k / seg, 0, col); }
  for (let k = 0; k < seg; k++) { const i = base + k * 2; mb.i.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
};
C.beam = (mb, x0, y0, x1, y1, z, t, col) => {                                     // XY 平面内的斜梁 (前后两面)
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * t / 2, ny = dx / l * t / 2;
  [[z + .55, 1], [z - .55, -1]].forEach(([zz, sg]) => mb.quad([x0 - nx, y0 - ny, zz], [x1 - nx, y1 - ny, zz], [x1 + nx, y1 + ny, zz], [x0 + nx, y0 + ny, zz], [0, 0, sg], [0, 0, 1, 1], col));
};
C.ellipse = (mb, cx, cz, rx, rz, y, col, seg, tile) => {                          // 椭圆平面 (世界坐标UV, 可平铺)
  tile = tile || [8, 8]; const c0 = mb.vert([cx, y, cz], [0, 1, 0], .5, .5, col), b0 = mb.n;
  for (let k = 0; k < seg; k++) { const a = k / seg * TAU, x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; mb.vert([x, y, z], [0, 1, 0], (x - cx) / tile[0] + .5, (z - cz) / tile[1] + .5, col); }
  for (let k = 0; k < seg; k++) mb.i.push(c0, b0 + k, b0 + (k + 1) % seg);
};
C.ellipseRing = (mb, cx, cz, rx0, rz0, rx1, rz1, y, col, seg, tile) => {          // 椭圆环形路面
  tile = tile || [8, 3]; const per = Math.PI * (rx0 + rz0 + rx1 + rz1) / 2;
  for (let k = 0; k < seg; k++) { const A = k / seg * TAU, B = (k + 1) / seg * TAU, u0 = k / seg * per / tile[0], u1 = (k + 1) / seg * per / tile[0];
    mb.quad([cx + Math.cos(A) * rx0, y, cz + Math.sin(A) * rz0], [cx + Math.cos(B) * rx0, y, cz + Math.sin(B) * rz0], [cx + Math.cos(B) * rx1, y, cz + Math.sin(B) * rz1], [cx + Math.cos(A) * rx1, y, cz + Math.sin(A) * rz1], [0, 1, 0], [u0, 0, u1, 1], col); }
};
C.ellipseWall = (mb, cx, cz, rx, rz, y0, y1, col, seg) => {                       // 椭圆外墙 (向外)
  for (let k = 0; k < seg; k++) { const A = k / seg * TAU, B = (k + 1) / seg * TAU, m = (A + B) / 2; let n = [Math.cos(m) / rx, 0, Math.sin(m) / rz]; const l = Math.hypot(n[0], n[2]); n = [n[0] / l, 0, n[2] / l];
    mb.quad([cx + Math.cos(A) * rx, y0, cz + Math.sin(A) * rz], [cx + Math.cos(B) * rx, y0, cz + Math.sin(B) * rz], [cx + Math.cos(B) * rx, y1, cz + Math.sin(B) * rz], [cx + Math.cos(A) * rx, y1, cz + Math.sin(A) * rz], n, [0, 0, 1, 1], col); }
};
C.wedge = (mb, x, z, w, d, h, dh, col) => {                                       // 斜屋顶 (向后升高)
  const x0 = x - w / 2, x1 = x + w / 2, zf = z + d / 2, zb = z - d / 2, nl = Math.hypot(d, dh), ny = d / nl, nz = dh / nl;
  mb.quad([x0, h, zf], [x1, h, zf], [x1, h + dh, zb], [x0, h + dh, zb], [0, ny, nz], [0, 0, 1, 1], col);
  mb.quad([x1, h, zb], [x0, h, zb], [x0, h + dh, zb], [x1, h + dh, zb], [0, 0, -1], [0, 0, 1, 1], col);
  [[x0, -1], [x1, 1]].forEach(([xx, sg]) => { const a = mb.vert([xx, h, zf], [sg, 0, 0], 0, 1, col), b = mb.vert([xx, h, zb], [sg, 0, 0], 1, 1, col), c = mb.vert([xx, h + dh, zb], [sg, 0, 0], 1, 0, col); mb.i.push(a, b, c); });
};

/* ---- kit: 批次登记 / 包围盒 / 遮挡组 / 常用摆件 ---- */
C.kit = (R, T, S) => {
  R.gl.bindVertexArray(null);                                                     // 防止创建网格时误改当前绑定的 VAO
  Object.assign(S, { batches: [], obstacles: [], portals: [], hotspots: [], lamps: [], seats: [], occluders: [], tw: [] });
  const K = { R, T, S };
  K.solid = (r, g, b) => R.solidTex([r, g, b, 255]);
  K.emS = (hx, d, n) => { const c = hex(hx); return { em: K.solid(c[0] * 255, c[1] * 255, c[2] * 255), emDay: d, emNight: n }; };
  const bbOf = (mb) => { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (let k = 0; k < mb.v.length; k += 11) for (let j = 0; j < 3; j++) { const v = mb.v[k + j]; if (v < a[j]) a[j] = v; if (v > b[j]) b[j] = v; } return [a, b]; };
  K.add = (mb, mat) => { if (mb.i.length) { const b = R.batch(mb, mat); b.bb = bbOf(mb); S.batches.push(b); return b; } };
  K.addTw = (mb, hexc, ph, f) => { const b = K.add(mb, K.emS(hexc, .9, 1.9)); if (b) S.tw.push({ b, ph, f }); };   // 夜晚闪烁的灯
  K.occ0 = () => S.batches.length;
  K.occ1 = (n0) => { const bs = S.batches.slice(n0).filter(b => b.bb && b.mat.mode === 0); if (!bs.length) return; const a = [1e9, 1e9, 1e9], c = [-1e9, -1e9, -1e9]; bs.forEach(b => { for (let j = 0; j < 3; j++) { a[j] = Math.min(a[j], b.bb[0][j]); c[j] = Math.max(c[j], b.bb[1][j]); } }); S.occluders.push({ bs, a, b: c, f: 1 }); };
  K.occ = (fn) => { const n0 = K.occ0(); fn(); K.occ1(n0); };
  K.obs = (a, b, c, d) => S.obstacles.push({ x0: a, z0: b, x1: c, z1: d });
  K.obsRot = (cx, cz, w, d, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw), n = Math.max(1, Math.ceil(w / 1.8)), hx = Math.abs(c) * (w / n / 2 + .3) + Math.abs(s) * d / 2, hz = Math.abs(s) * (w / n / 2 + .3) + Math.abs(c) * d / 2;
    for (let k = 0; k < n; k++) { const lx = -w / 2 + (k + .5) * w / n, x = cx + lx * c, z = cz - lx * s; K.obs(x - hx, z - hz, x + hx, z + hz); } };
  K.signAt = (text, o, cx, cz, yaw, y0, y1, w, dn, nn) => { const sg = T.sign(text, o), mb = new MB(); C.rbox(mb, cx, cz, w, .2, y0, y1, yaw, [1, 1, 1], [w, y1 - y0], { noBack: true, noSides: true, noTop: true }); K.add(mb, { tex: sg.tex, em: sg.em, emDay: dn == null ? .6 : dn, emNight: nn == null ? 1.4 : nn }); };
  K.seat = (x, z, yaw, h, ap) => { const q = { x, z, yaw, h, ap, who: null, res: null }; q.hot = { id: 'sit', seat: q, x: ap[0], z: ap[1], r: 1.4 }; S.seats.push(q); return q; };   // 与 plaza.js 的 seatAdd 同格式
  K.palm = (x, z, h, lean) => {
    const pm = new MB(), n0 = K.occ0(), r = C.rnd((x * 31 + z * 17 + 7) | 0);
    for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6; C.tcyl(pm, [x + lean * t0 * t0 * h, t0 * h, z], [x + lean * t1 * t1 * h, t1 * h, z], .26 - t0 * .1, .26 - t1 * .1, 8, [.5 + .08 * (k % 2), .38, .28]); }
    const cx = x + lean * h, cy = h, n = 9;
    for (let i = 0; i < n; i++) { const an = i / n * TAU + r() * .4, L = 2.5 + r() * .8, dx = Math.cos(an), dz = Math.sin(an), px = -dz, pz = dx, g = [.2 + r() * .1, .55 + r() * .15, .26 + r() * .08];
      const pt = (t, w) => { const o = t * L, y = cy + Math.sin(t * 2.6) * .7 - t * t * 1.2; return [[cx + dx * o - px * w, y, z + dz * o - pz * w], [cx + dx * o + px * w, y, z + dz * o + pz * w]]; };
      let prev = pt(0, .05); for (let s2 = 1; s2 <= 4; s2++) { const t = s2 / 4, w = .55 * Math.sin(Math.min(1, t * 1.15) * Math.PI * .85 + .3) * (1 - t * .55), cur = pt(t, Math.max(.04, w)); pm.quad(prev[0], prev[1], cur[1], cur[0], [0, 1, 0], [0, 0, 1, 1], g); prev = cur; } }
    pm.sphere(cx, cy - .15, z, .3, .25, .3, [.45, .32, .2], 6); K.add(pm, {}); K.occ1(n0); K.obs(x - .3, z - .3, x + .3, z + .3);
  };
  K.tree = (x, z, s) => {                                                         // 雨树: 粗树干 + 宽大树冠
    const tm = new MB(), n0 = K.occ0(); tm.cyl(x, z, 0, 3.4 * s, .45 * s, .3 * s, 8, [.4, .3, .22]);
    [[0, 0, 3.2, 2.4], [1.8, .8, 2.4, 1.8], [-1.8, -.6, 2.5, 1.9], [.3, 1.8, 2.2, 1.7]].forEach(([dx, dz, rx, ry], i) => tm.sphere(x + dx * s, (4.4 + dz * .3) * s, z + dz * s, rx * s, ry * .6 * s, rx * .9 * s, [.2 + (i % 2) * .05, .5, .3], 9));
    K.add(tm, {}); K.occ1(n0); K.obs(x - .5 * s, z - .5 * s, x + .5 * s, z + .5 * s);
  };
  K.bench = (x, z, yaw) => {                                                      // 长椅 (木板座面 + 铸铁椅脚 + 靠背 + 扶手), 正面朝 yaw 方向
    const bm = new MB(), W = 2.4, wood = [.66, .43, .24], wood2 = [.58, .37, .2], iron = [.14, .13, .18], c = Math.cos(yaw), s2 = Math.sin(yaw), L = (lx, lz) => [x + lx * c + lz * s2, z - lx * s2 + lz * c];
    for (let k = 0; k < 4; k++) { const p = L(0, -.24 + k * .16); C.rbox(bm, p[0], p[1], W, .13, .43, .49, yaw, k % 2 ? wood2 : wood); }
    for (let k = 0; k < 3; k++) { const p = L(0, -.3); C.rbox(bm, p[0], p[1], W, .06, .62 + k * .16, .72 + k * .16, yaw, k % 2 ? wood2 : wood); }
    [-1.15, 1.15].forEach(lx => { [[.24, .45], [-.3, 1.1]].forEach(([lz, hh]) => { const p = L(lx, lz); C.rbox(bm, p[0], p[1], .09, .09, 0, hh, yaw, iron); });
      const f = L(lx, -.03); C.rbox(bm, f[0], f[1], .07, .6, .38, .43, yaw, iron); const a2 = L(lx + Math.sign(lx) * .1, -.02); C.rbox(bm, a2[0], a2[1], .11, .62, .66, .72, yaw, wood); const ft = L(lx, 0); C.rbox(bm, ft[0], ft[1], .22, .72, 0, .04, yaw, iron); });
    K.add(bm, {}); K.obsRot(x, z, W + .3, .95, yaw);
    [-.55, .55].forEach(o => { const sx = x + o * c - .1 * s2, sz = z - o * s2 - .1 * c; K.seat(sx, sz, yaw, .5, [sx + s2 * 1.15, sz + c * 1.15]); });   // 每张长椅两个座位, 落脚点在正前方 1.15 米
  };
  // 每帧由引擎调用: 相机→人物 的视线穿过哪个物体, 该物体就变半透明(只留10%)
  S.updateOcclusion = (eye, me, dt) => {
    const px = me.x, py = (me.y || 0) + .9, pz = me.z, pad = .2, k = Math.min(1, dt * 9);
    const hit = (o) => { const mn = [o.a[0] - pad, o.a[1] - pad, o.a[2] - pad], mx = [o.b[0] + pad, o.b[1] + pad, o.b[2] + pad];
      for (const [ox, oz] of [[0, 0], [.5, 0], [-.5, 0]]) for (const oy of [-.7, .5]) { const d = [px + ox - eye[0], py + oy - eye[1], pz + oz - eye[2]], len = Math.hypot(d[0], d[1], d[2]); let t0 = 0, t1 = Math.max(0, 1 - 2.6 / len), ok = true;
        for (let j = 0; j < 3; j++) { if (Math.abs(d[j]) < 1e-6) { if (eye[j] < mn[j] || eye[j] > mx[j]) { ok = false; break; } } else { let a = (mn[j] - eye[j]) / d[j], b = (mx[j] - eye[j]) / d[j]; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; } } }
        if (ok) return true; } return false; };
    for (const o of S.occluders) { const tg = hit(o) ? .1 : 1; o.f += (tg - o.f) * k; if (Math.abs(o.f - tg) < .01) o.f = tg; for (const b of o.bs) b.fade = o.f; }
  };
  return K;
};
G.Scenes.C = C;
})(window);

