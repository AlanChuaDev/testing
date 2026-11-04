/* ktvrooms.js — 「天皇巨星」24 间主题包间（2F VIP×8，3F 欢唱×16）+ 场景分发。
   进门靠近即进（无圈）；电视=LED 倒数屏；电视前小舞台：点歌→上台→唱歌（和广场同一套排队逻辑，包间里只有自己）。 */
(function (G) {
'use strict';
const { MB, clamp } = G.World;
const KT = G.KTV, { kit, ROOMS, F, GOLD, IVORY, DARK, mul, rnd, PITCH } = KT;
const css = (c, k) => { k = k || 1; return `rgb(${Math.min(255, c[0] * 255 * k) | 0},${Math.min(255, c[1] * 255 * k) | 0},${Math.min(255, c[2] * 255 * k) | 0})`; };
const rot = (c) => [c[2], c[0], c[1]];

/* 8 种主题；a1/a2=灯光霓虹主副色；wall=墙面染色；sofa=沙发色 */
const STYLES = {
  dragon:  { ftex: 'parquet', ft: [1, .6, .5], wtex: 'damask', wall: [.95, .28, .25], a1: [1, .82, .3], a2: [1, .25, .25], sofa: [.62, .08, .14], tint: [1, .78, .72] },
  baroque: { ftex: 'cmarble', ft: [1, .96, .88], wtex: 'damask', wall: [.95, .9, .78], a1: [1, .85, .45], a2: [.45, .6, 1], sofa: [.16, .24, .6], tint: [1, .95, .88] },
  star:    { ftex: 'bmarble', ft: [.55, .6, 1.5], wtex: null, wall: [.14, .16, .38], a1: [.7, .85, 1], a2: [1, .9, .55], sofa: [.22, .26, .62], tint: [.7, .78, 1] },
  cyber:   { ftex: 'bmarble', ft: [.8, .8, 1.2], wtex: null, wall: [.1, .08, .16], a1: [1, .25, .75], a2: [.2, .9, 1], sofa: [.12, .1, .2], tint: [.9, .75, 1] },
  ocean:   { ftex: 'cmarble', ft: [.5, .95, 1], wtex: null, wall: [.1, .38, .5], a1: [.4, 1, .95], a2: [1, .65, .5], sofa: [.1, .5, .62], tint: [.75, .95, 1] },
  sakura:  { ftex: 'parquet', ft: [1, .9, .85], wtex: 'damask', wall: [1, .82, .88], a1: [1, .6, .75], a2: [1, .95, .8], sofa: [.82, .3, .45], tint: [1, .88, .92] },
  emerald: { ftex: 'cmarble', ft: [.55, 1, .7], wtex: 'damask', wall: [.3, .72, .5], a1: [.4, 1, .6], a2: [1, .85, .4], sofa: [.08, .42, .26], tint: [.82, 1, .86] },
  royal:   { ftex: 'bmarble', ft: [1.2, .7, 1.4], wtex: 'damask', wall: [.62, .3, .85], a1: [.85, .5, 1], a2: [1, .82, .4], sofa: [.4, .1, .6], tint: [.95, .8, 1] }
};
const NAMES_EN = { dragon: 'DRAGON', baroque: 'VERSAILLES', star: 'GALAXY', cyber: 'CYBER NEON', ocean: 'OCEAN', sakura: 'SAKURA', emerald: 'EMERALD', royal: 'ROYAL' };

function beamTex(R) { return R.paint(64, 256, (g, w, h) => { const im = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = (x / (w - 1) - .5) * 2, v = y / (h - 1), a = Math.exp(-u * u * 3.2) * (.15 + .85 * v), k = Math.min(255, a * 255) | 0, o = (y * w + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = k; im.data[o + 3] = 255; } g.putImageData(im, 0, 0); }, { clamp: true, mip: false }); }

function makeRoom(R, T, id) {
  const r = ROOMS[id], t2 = r.floor === 2, base = STYLES[r.style], v = r.variant;
  const st = Object.assign({}, base); if (v) { st.wall = rot(base.wall); st.sofa = rot(base.sofa); st.a1 = base.a2; st.a2 = base.a1; st.tint = rot(base.tint); }
  const TRIM = t2 ? GOLD : [.84, .86, .95];
  const K = kit(R, T), { S, X, add, occ, obs, emMat, halo, pool, glowMat, night, lit, sgn, addSign, signQuad, sofa, gtable, chand, seatAdd } = K;
  const HX = t2 ? 9.5 : 8.5, ZB = t2 ? -11 : -10, ZF = t2 ? 8 : 7.2, TVW = t2 ? 11.4 : 8.8, TVH = TVW / 2.5, A1 = st.a1, A2 = st.a2;
  S.walkable = (x, z) => x > -HX + .7 && x < HX - .7 && z > ZB + .75 && z < ZF - .3;
  /* ---- 地面、墙 ---- */
  { const f = new MB(); f.floor(-HX, ZB, HX, ZF, 0, st.ft, [0, 0, HX / 2.2, (ZF - ZB) / 2.2]); add(f, { tex: X[st.ftex] });
    const rg = new MB(), rz0 = ZB + 4.8, rz1 = ZF - 1.0; rg.floor(-2.8, rz0, 2.8, rz1, .02, mul(A2, [.55, .55, .55])); rg.floor(-2.6, rz0 + .2, 2.6, rz1 - .2, .022, mul(st.sofa, [.7, .7, .7])); rg.floor(-2.8, rz0, -2.65, rz1, .024, TRIM); rg.floor(2.65, rz0, 2.8, rz1, .024, TRIM); add(rg, {});
    const wl = new MB(), wc = st.wall; wl.wall(-HX, 0, HX, 10.5, ZB, wc, [0, 0, HX / 2.5, 2.8]);
    [-1, 1].forEach(sd => wl.quad([sd * HX, 0, ZF], [sd * HX, 0, ZB], [sd * HX, 10.5, ZB], [sd * HX, 10.5, ZF], [-sd, 0, 0], [0, 0, (ZF - ZB) / 3, 2.8], wc)); add(wl, st.wtex ? { tex: X.damask } : {});
    const tr = new MB(); tr.wall(-HX, 0, HX, .55, ZB + .02, TRIM); tr.wall(-HX, 9.7, HX, 10.5, ZB + .02, TRIM); tr.wall(-HX, 3.95, HX, 4.05, ZB + .02, mul(TRIM, [.9, .9, .9]));
    [-1, 1].forEach(sd => { tr.quad([sd * (HX - .02), 0, ZF], [sd * (HX - .02), 0, ZB], [sd * (HX - .02), .55, ZB], [sd * (HX - .02), .55, ZF], [-sd, 0, 0], [0, 0, 1, 1], TRIM); tr.quad([sd * (HX - .02), 9.7, ZF], [sd * (HX - .02), 9.7, ZB], [sd * (HX - .02), 10.5, ZB], [sd * (HX - .02), 10.5, ZF], [-sd, 0, 0], [0, 0, 1, 1], TRIM); }); add(tr, {});
    /* 前方低墙 + 门洞 + 门柱 + 招牌（朝镜头那一面） */
    const lw = new MB(), rl = new MB(); [[-HX, -1.4], [1.4, HX]].forEach(([a, b]) => { lw.box(a, 0, ZF, b, 1.0, ZF + .18, mul(st.wall, [.8, .8, .8])); rl.box(a, 1.0, ZF - .02, b, 1.1, ZF + .2, TRIM); }); add(lw, {}); add(rl, {}); obs(-HX, ZF - .1, -1.4, ZF + .3); obs(1.4, ZF - .1, HX, ZF + .3);
    occ(() => { const gp = new MB(); [-1.55, 1.55].forEach(x => { gp.cyl(x, ZF + .1, 0, 3.4, .2, .18, 10, TRIM, true); gp.sphere(x, 3.7, ZF + .1, .24, .28, .24, [1, .95, .8], 7); }); add(gp, emMat([1, .95, .8], 0.25, 1)); });
    addSign('出口 EXIT · 离开包间', { w: 640, h: 100, fs: 48, border: '#7dffb0', fg: '#d8ffe8' }, -1.35, 1.35, 2.2, 2.9, ZF + .2, 1.5);
    addSign(r.num, { w: 640, h: 180, fs: 92, bg: '#12070c', fg: '#ffe9a8', border: '#e1b84e' }, -HX + 1.4, -HX + 5.0, 1.15, 2.15, ZF + .2, 1.6);
    addSign(r.name + ' · ' + NAMES_EN[r.style], { w: 640, h: 120, fs: 44, bg: '#12070c', fg: '#ffe0f0', border: '#ff8ad8' }, HX - 5.0, HX - 1.4, 1.15, 2.0, ZF + .2, 1.5);
    S.portals.push({ id: r.corridor, auto: true, x: 0, z: ZF - .55, r: 1.2, label: '离开包间', spawn: r.ret }); }
  /* ---- 超大电视 + 音响 ---- */
  { const ty = 1.9, fr = new MB(); fr.box(-TVW / 2 - .22, ty - .22, ZB + .02, TVW / 2 + .22, ty + TVH + .22, ZB + .2, TRIM); fr.box(-TVW / 2 - .06, ty - .06, ZB + .18, TVW / 2 + .06, ty + TVH + .06, ZB + .22, [.04, .04, .06]); add(fr, {});
    const ST = { accent: css(A1, 1), accent2: css(A2, 1), title: r.num, titleFs: 128, sub: r.name + ' · 在点歌台点歌，轮到你就上台', idle: '现在没人点歌 · 快来唱一首！', hint: '包间里只有你和朋友 · 尽情唱！' };
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 410; S.led = { cv, tex: null, acc: 1 }; G.Scenes.drawLED(cv.getContext('2d'), ST, { mode: 'idle', queue: [] }, 0); S.led.tex = R.canvasTex(cv, { clamp: true, mip: false });
    const sc = new MB(); sc.wall(-TVW / 2, ty, TVW / 2, ty + TVH, ZB + .23, [1, 1, 1]); add(sc, { tex: S.led.tex, em: S.led.tex, emDay: .6, emNight: .8 });
    S.update = (g, dt) => { const L = S.led; L.acc += dt; if (L.acc < .12) return; L.acc = 0; G.Scenes.drawLED(L.cv.getContext('2d'), ST, g.stg || { mode: 'idle', queue: [] }, g.t); R.updateCanvasTex(L.tex, L.cv); };
    const sp = new MB(), sg = new MB(); [-1, 1].forEach(sd => { const x = sd * (TVW / 2 + (t2 ? 1.2 : 1.0)); sp.box(x - .55, 0, ZB + .4, x + .55, 2.7, ZB + 1.3, [.07, .07, .09]); sp.box(x - .6, 0, ZB + .35, x + .6, .18, ZB + 1.35, TRIM); sp.box(x - .6, 2.7, ZB + .35, x + .6, 2.85, ZB + 1.35, TRIM); sg.cyl(x, ZB + 1.34, 1.6, 2.3, .3, .3, 14, [.2, .2, .26], true); sg.cyl(x, ZB + 1.36, .55, 1.2, .35, .35, 14, [.2, .2, .26], true); sg.sphere(x, 1.95, ZB + 1.4, .12, .12, .06, A1, 6); obs(x - .7, ZB + .3, x + .7, ZB + 1.4); }); add(sp, {}); add(sg, emMat([.5, .5, .6], 0.3, 1.1));
    const gl = new MB(); halo(gl, 0, ty + TVH / 2, ZB + 3, TVW * .5, mul(A1, [.6, .6, .6])); pool(gl, 0, ZB + 5, TVW * .45, mul(A1, [.5, .5, .5]), .035); add(gl, glowMat(lit(.22))); }
  /* ---- 小舞台 ---- */
  const SZ0 = ZB + 1.6, SZ1 = ZB + 4.5, SH = .3;
  { const sg = new MB(); sg.box(-3.7, 0, SZ0, 3.7, SH, SZ1, [.14, .1, .17], [2, 1]); sg.box(-3.78, SH, SZ0 - .02, 3.78, SH + .05, SZ1 + .08, TRIM); add(sg, { tex: X.bmarble });
    const nb = new MB(); nb.box(-3.7, .06, SZ1, 3.7, .14, SZ1 + .05, A1); nb.box(-3.7, .18, SZ1, 3.7, .24, SZ1 + .05, A2); add(nb, emMat(A1, 0.4, 1.1));
    const mc = new MB(); mc.cyl(.8, ZB + 3.0, SH, SH + 1.35, .03, .03, 6, [.15, .15, .18], false); mc.cyl(.8, ZB + 3.0, SH, SH + .04, .2, .2, 10, [.15, .15, .18], true); mc.sphere(.8, SH + 1.45, ZB + 3.0, .07, .09, .07, [.85, .85, .9], 6); add(mc, {});
    S.stage = { x0: -3.7, x1: 3.7, z0: SZ0, z1: SZ1, h: SH, mic: [0, ZB + 3.0], front: [0, SZ1 + 1.8], arriveR: 2.3, leaveR: 6.5 };
    S.heightAt = (x, z) => (x > -3.7 && x < 3.7 && z > SZ0 && z < SZ1) ? SH : 0; S.private = true; }
  /* ---- 沙发 / 茶几 ---- */
  { const sw = t2 ? 3.6 : 3.2, sx = t2 ? 5.7 : 5.2; [-1, 1].forEach(sd => { sofa(sd * sx, 2.4, 'n', sw, st.sofa, 0, null, TRIM); sofa(sd * (HX - .9), -3.2, sd < 0 ? 'e' : 'w', 3.6, st.sofa, 0, null, TRIM); if (t2) sofa(sd * (HX - .9), 2.0, sd < 0 ? 'e' : 'w', 3.0, st.sofa, 0, null, TRIM);
      gtable(sd * sx, -.3, 3.2, 1.2, IVORY, .5); gtable(sd * (HX - 2.3), -3.2, 1.1, 2.0, IVORY, .5);
      const it = new MB(); for (let k = 0; k < 4; k++) { it.cyl(sd * sx - 1.1 + k * .72, -.3 + (k % 2) * .25 - .1, .58, .86, .07, .05, 6, [1, .95, .9], true); } it.cyl(sd * sx, -.3, .58, 1.0, .09, .07, 8, mul(A2, [.9, .9, .9]), true); add(it, {}); });
    const rp = new MB(); [-1, 1].forEach(sd => pool(rp, sd * sx, -.3, 4, mul(A1, [.8, .8, .8]), .036)); add(rp, glowMat(lit(.3)));
    /* 点歌机：VIP(2F)=复古点唱机，普通(3F)=玻璃触屏点歌柱 */
    const kx = -(HX - 3.2), kz = ZF - 2.5; occ(() => (t2 ? G.Kiosk.jukebox : G.Kiosk.pillar)(K, kx, kz));
    S.hotspots.push({ id: 'songs', x: kx, z: kz + 1.5, r: 1.8, label: '点歌台', color: [1, .5, .85] }); }
  /* ---- 灯：吊灯 + 迪斯科球 ---- */
  chand(0, 8.6, t2 ? -1 : -.5, t2 ? 1.5 : 1.1, mul(A1, [1, 1, 1]));
  if (t2) { chand(-6, 8.4, 3, .8); chand(6, 8.4, 3, .8); }
  { const db = new MB(); db.cyl(0, -4.2, 6.5, 9, .03, .03, 6, TRIM, false); db.sphere(0, 6.3, -4.2, .6, .6, .6, [.9, .92, 1], 10); occ(() => add(db, emMat([.8, .85, 1], 0.5, 1.1))); }
  /* ---- 主题装饰 ---- */
  const full = t2, lx = (n) => [-1, 1].map(sd => sd * n);
  const D = { dragon, baroque, star, cyber, ocean, sakura, emerald, royal };
  D[r.style]({ K, st, t2, full, HX, ZB, ZF, TVW, TVH, A1, A2, TRIM, S, R, T, add, occ, obs, emMat, halo, pool, glowMat, night, lit, sgn, addSign, X, MB, sofa, gtable });
  /* ---- 动态灯光：光束 / 迪斯科星点 / 主题粒子 ---- */
  S.tex = { beam: beamTex(R) };
  S.dyn = (fx, t, g, env) => {
    const c = Math.cos(PITCH), sn = Math.sin(PITCH), stg = g && g.stg ? g.stg : { mode: 'idle' }, act = stg.mode === 'sing' ? 1 : stg.mode === 'wait' ? .5 : 0, cols = [A1, A2, [1, .95, .85], mul(A1, [.8, .8, 1])];
    for (let k = 0; k < 5; k++) { const hx = -6 + k * 3, hy = 9.4, hz = ZB + 1.0, tx = hx + Math.sin(t * (.7 + k * .13) + k * 1.9) * (3 + act * 2.5), tz = ZB + 5 + Math.cos(t * (.5 + k * .1) + k * 2.3) * 3.2, w1 = .9 + act * .4, col = cols[k % 4].map(q => q * (.55 + .45 * Math.sin(t * 2 + k)));
      fx.beam.quad([hx - .1, hy, hz], [hx + .1, hy, hz], [tx + w1, .05, tz], [tx - w1, .05, tz], [0, 1, 0], [0, 0, 1, 1], col); }
    for (let k = 0; k < 26; k++) { const a = k * 2.399 + t * .6, rr = .9 + (k % 4) * .3, y = 6.3 + Math.sin(a * 1.7) * .5, x = Math.cos(a) * rr, z = -4.2 + Math.sin(a) * rr, s = .09 * Math.max(0, Math.sin(t * 5 + k * 1.3)), P = (u, vv) => [x + u * s, y + c * vv * s, z - sn * vv * s]; if (s > .01) fx.spark.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], [.9, .95, 1]); }
    if (S.extra) S.extra(fx, t, c, sn);
    fx.glow = { spray: 1, beam: .22 + .5 * act, spark: .9 };
  };
  S.dynPool = (mb, g, env, t) => { const stg = g && g.stg ? g.stg : { mode: 'idle' };
    if (stg.mode === 'sing' || stg.mode === 'wait') { const k = (stg.mode === 'sing' ? 1 : .6) * (.7 + .3 * Math.sin(t * 4)); pool(mb, 0, ZB + 3.0, 3.0, [A1[0] * k, A1[1] * k, A1[2] * k], SH + .04); }
    if (stg.you) { const k = .6 + .4 * Math.sin(t * 6); pool(mb, 0, SZ1 + 1.5, 2.2, [.3 * k, 1 * k, .5 * k], .05); } };
  S.bounds = { x0: -HX, x1: HX, z0: ZB, z1: ZF }; S.spawn = [0, ZF - (t2 ? 3.2 : 3.2)];
  S.camera = { dist: t2 ? 27.5 : 26, pitch: .6, fov: .74, clampX: [-2, 2], clampZ: [ZB + 4.5, ZF - 5], lead: 1 }; S.cameraWide = { dist: 23, pitch: .17, fov: 1.05 };
  S.npcRect = { x0: -HX + 2, x1: HX - 2, z0: ZB + 5, z1: ZF - 2 }; S.npcN = t2 ? 3 : 2;
  S.name = r.num + ' · ' + r.name; S.indoor = true;
  const amb = mul([.66, .62, .72], st.tint), bot = mul([.12, .08, .16], st.tint);
  S.env = K.indoorEnv(amb, amb, bot, bot, .92);
  return S;
}

/* ================= 主题装饰（每个都尽量短） ================= */
const gp = (mb, x0, z0, x1, z1) => mb;
function paintTank(R, kind, A1, A2) {
  return R.paint(256, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h);
    if (kind === 'ocean') { gr.addColorStop(0, '#2fc4e8'); gr.addColorStop(1, '#06304f'); } else if (kind === 'fall') { gr.addColorStop(0, '#d8fff0'); gr.addColorStop(1, '#0c7a58'); } else { gr.addColorStop(0, '#fff6ea'); gr.addColorStop(1, '#f0d7c0'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h); const r = rnd(11);
    if (kind === 'ocean') { for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 5, 0, 7); g.fill(); } const fish = (x, y, s, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 26 * s, 12 * s, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 22 * s, y); g.lineTo(x - 40 * s, y - 14 * s); g.lineTo(x - 40 * s, y + 14 * s); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 14 * s, y - 3 * s, 3 * s, 0, 7); g.fill(); };
      ['#ff9a3c', '#ffd23c', '#ff5f8a', '#fff', '#7ae0ff', '#ffb34a'].forEach((c, i) => fish(40 + r() * 170, 60 + i * 70 + r() * 20, .8 + r() * .8, c)); g.strokeStyle = '#2fa86a'; g.lineWidth = 8; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(20 + i * 36, h); g.quadraticCurveTo(10 + i * 36, h - 90, 30 + i * 36, h - 170); g.stroke(); } }
    else if (kind === 'fall') { for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${.25 + r() * .5})`; g.lineWidth = 2 + r() * 5; const x = r() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - .5) * 14, h); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, h - 40, w, 40); }
    else { g.strokeStyle = '#a07040'; g.lineWidth = 6; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 85) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.strokeRect(3, 3, w - 6, h - 6); }
  }, { clamp: true });
}
function dragon(o) { const { HX, ZB, TVW, TVH, A1, A2, TRIM, add, occ, obs, emMat, halo, glowMat, night, full, S } = o;
  const px = TVW / 2 + (full ? 3.0 : 2.4); occ(() => { const p = new MB(); [-1, 1].forEach(sd => { const x = sd * Math.min(px, HX - 1), z = ZB + 1.2; p.cyl(x, z, 0, .5, .75, .7, 14, TRIM, true); p.cyl(x, z, .5, 8.3, .55, .5, 16, [.6, .06, .1], false); for (let y = 1.2; y < 8; y += 1.8) p.cyl(x, z, y, y + .16, .6, .6, 16, TRIM, false); for (let k = 0; k < 22; k++) { const a = k * .62, y = .8 + k * .33; p.sphere(x + Math.cos(a) * .6, y, z + Math.sin(a) * .6 * .0 + Math.sin(a) * .45 + .15, .2 - k * .004, .2 - k * .004, .2 - k * .004, [1, .8, .3], 5); } p.sphere(x, 8.65, z, .5, .4, .5, [1, .8, .3], 8); obs(x - .8, z - .8, x + .8, z + .8); }); add(p, {}); });
  const d = new MB(), eyes = new MB(); const y0 = 2.0 + TVH + 1.0; for (let k = 0; k < 40; k++) { const x = -TVW / 2 - 1 + k / 39 * (TVW + 2), y = y0 + Math.sin(k * .55) * .55, sz = .3 - Math.abs(k - 20) * .003 + (k > 36 ? .08 : 0); d.sphere(x, y, ZB + .5, sz, sz, sz, [1, .78, .28], 6); if (k % 5 === 2) d.box(x - .03, y, ZB + .5, x + .03, y + sz + .28, ZB + .56, [.9, .2, .1]); }
  const hx = TVW / 2 + 1.0, hy = y0 + Math.sin(39 * .55) * .55; d.sphere(hx + .3, hy + .1, ZB + .5, .46, .38, .4, [1, .78, .28], 8); eyes.sphere(hx + .45, hy + .22, ZB + .85, .08, .08, .06, [1, .1, .1], 5); eyes.sphere(hx + .15, hy + .22, ZB + .85, .08, .08, .06, [1, .1, .1], 5); add(d, {}); add(eyes, emMat([1, .2, .2], 0.5, 1.1));
  const l = new MB(), gl = new MB(); for (const sd of [-1, 1]) for (const z of [-6, -2, 2]) { const x = sd * (HX - 1.4); l.cyl(x, z, 6.6, 9.5, .02, .02, 4, [.3, .2, .1], false); l.sphere(x, 6.2, z, .55, .65, .55, [.95, .15, .12], 8); l.cyl(x, z, 6.75, 6.9, .22, .2, 8, TRIM, true); l.cyl(x, z, 5.45, 5.6, .2, .18, 8, TRIM, true); halo(gl, x, 6.2, z, 1.7, [1, .3, .2]); } occ(() => add(l, emMat([1, .3, .25], 0.5, 1.1))); add(gl, glowMat(night(.3)));
  S.extra = (fx, t, c, sn) => { for (let k = 0; k < 16; k++) { const ph = (t * .3 + k * .137) % 1, x = (-9 + (k * 5.7) % 18), y = 9 - ph * 8, s = .08, P = (u, v) => [x + u * s, y + c * v * s, -4 + ((k * 3.1) % 8) - sn * v * s]; fx.spark.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], [1, .8, .3]); } };
}
function baroque(o) { const { HX, ZB, TVW, TVH, A1, A2, TRIM, add, occ, obs, emMat, halo, glowMat, night, T, X, full, S } = o;
  const fm = new MB(), mr = new MB(), fx = TVW / 2 + (full ? 2.2 : 1.8); [-1, 1].forEach(sd => { const x = sd * Math.min(fx + .4, HX - 1.6); fm.box(x - 1.15, 1.3, ZB + .03, x + 1.15, 6.2, ZB + .14, TRIM); fm.sphere(x, 6.4, ZB + .1, .6, .35, .1, TRIM, 8); mr.wall(x - .95, 1.5, x + .95, 6.0, ZB + .16, [1, 1, 1]); }); add(fm, {}); add(mr, { tex: T.mirror, em: T.mirrorEm, emDay: .4, emNight: .9 });
  const pt = new MB(); pt.box(-2.8, 2.0 + TVH + .45, ZB + .03, 2.8, 2.0 + TVH + 1.55, ZB + .12, TRIM); pt.wall(-2.6, 2.0 + TVH + .6, 2.6, 2.0 + TVH + 1.4, ZB + .14, [.45, .3, .5]); add(pt, {});
  const cu = new MB(); [-1, 1].forEach(sd => { const x = sd * (HX - .9); for (let k = 0; k < 4; k++) cu.box(x - .45 + (sd > 0 ? 0 : 0) + k * .24 * sd - (sd < 0 ? 0 : 0), 0, ZB + .1 + k * .06, x - .2 + k * .24 * sd, 9.0 - k * .5, ZB + .5 + k * .06, k % 2 ? [.12, .18, .55] : [.16, .24, .7]); cu.box(x - .6, 6.6, ZB + .1, x + .6, 6.8, ZB + .6, TRIM); cu.sphere(x, 6.2, ZB + .65, .14, .2, .14, TRIM, 6); }); occ(() => add(cu, {}));
  if (full) occ(() => { const s = new MB(); [-1, 1].forEach(sd => { const x = sd * 4.7, z = ZB + 4.9; s.cyl(x, z, 0, 1.0, .5, .42, 10, IVORY, true); s.cyl(x, z, 1.0, 1.1, .56, .56, 10, TRIM, true); s.cyl(x, z, 1.1, 2.1, .3, .22, 10, [.95, .93, .9], true); s.sphere(x, 2.45, z, .22, .27, .22, [.95, .93, .9], 7); s.box(x - .5, 1.5, z - .04, x - .3, 1.58, z + .04, [.95, .93, .9]); obs(x - .6, z - .6, x + .6, z + .6); }); add(s, {}); });
  const cd = new MB(), fl = new MB(); [[-5.7, -.3], [5.7, -.3]].forEach(([x, z]) => { cd.cyl(x, z, .56, 1.2, .05, .04, 6, TRIM, true); for (let k = -1; k <= 1; k++) { cd.cyl(x + k * .22, z, .56, .95, .02, .02, 5, TRIM, false); fl.sphere(x + k * .22, 1.02, z, .05, .08, .05, [1, .85, .4], 5); } }); add(cd, {}); add(fl, emMat([1, .85, .4], 0.5, 1.1));
}
function star(o) { const { HX, ZB, TVW, TVH, A1, A2, TRIM, add, occ, emMat, halo, glowMat, S } = o;
  const mn = new MB(), gl = new MB(); mn.sphere(-HX + 2.2, 7.8, ZB + .5, 1.2, 1.2, .35, [.98, .95, .75], 12); mn.sphere(-HX + 2.7, 8.2, ZB + .9, .95, .95, .2, [.07, .08, .2], 12); add(mn, emMat([1, .96, .75], 0.5, 1.1)); halo(gl, -HX + 2.2, 7.8, ZB + .6, 3.6, [1, .95, .7]);
  const pl = new MB(), rg = new MB(); [[5.6, 7.4, 1.2, [.9, .55, .35]], [3.2, 8.4, .6, [.5, .75, 1]], [-3.2, 8.7, .45, [.9, .8, .5]]].forEach(([x, y, r, c]) => { pl.cyl(x, ZB + 1.6, y + r, 10.5, .02, .02, 4, [.6, .6, .8], false); pl.sphere(x, y, ZB + 1.6, r, r, r, c, 10); if (r > 1) rg.disc(x, ZB + 1.6, y, r * 1.7, 24, [.95, .9, .75], r * 1.35); }); occ(() => { add(pl, emMat([.7, .7, .9], 0.4, 1.1)); add(rg, {}); }); add(gl, glowMat(e => .3 + e.night * .5));
  const lp = new MB(); [-1, 1].forEach(sd => { for (let k = 0; k < 6; k++) lp.box(sd * (HX - .12) - .04, 1.0 + k * 1.4, ZB + 1 + k * 1.6, sd * (HX - .12) + .04, 1.15 + k * 1.4, ZB + 1.5 + k * 1.6, A1); }); add(lp, emMat(A1, 0.5, 1.1));
  S.extra = (fx, t, c, sn) => { for (let k = 0; k < 60; k++) { const x = -HX + 1 + ((k * 7.31) % (2 * HX - 2)), y = 3 + ((k * 3.77) % 6.6), tw = Math.max(0, Math.sin(t * 2 + k * 1.7)), s = .16 * tw; if (tw < .1 || (Math.abs(x) < TVW / 2 + .3 && y < 2 + TVH + .3)) continue; const P = (u, v) => [x + u * s, y + c * v * s, ZB + .3 - sn * v * s]; fx.spark.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], k % 3 ? [.85, .92, 1] : [1, .95, .7]); } };
}
function cyber(o) { const { HX, ZB, TVW, TVH, A1, A2, TRIM, add, occ, obs, emMat, halo, glowMat, lit, S, full } = o;
  const ng = new MB(), n2 = new MB(); for (let y = 4.4; y < 10; y += .9) ng.box(-HX, y, ZB + .03, HX, y + .06, ZB + .08, (y * 10 | 0) % 2 ? A1 : A2); for (let x = -HX + 1; x < HX; x += 1.5) n2.box(x, 4.4, ZB + .03, x + .06, 10.2, ZB + .08, A2);
  [-1, 1].forEach(sd => { for (let z = ZB + 1; z < 6; z += 1.7) n2.box(sd * (HX - .06) - .03, .8, z, sd * (HX - .06) + .03, 9.8, z + .06, A1); }); add(ng, emMat(A1, 0.5, 1.1)); add(n2, emMat(A2, 0.5, 1.1));
  const fl = new MB(); for (let x = -8; x <= 8; x += 2) fl.floor(x - .03, ZB + 5, x + .03, 7, .03, A2); for (let z = ZB + 6; z < 7; z += 2) fl.floor(-HX, z - .03, HX, z + .03, .03, A1); add(fl, emMat(A2, 0.4, 1.1));
  const cb = new MB(), cx = full ? 6.8 : 5.9, cz = -5.6, cy = 3.4, h = .9; [-1, 1].forEach(a => [-1, 1].forEach(b => { cb.box(cx + a * h - .03, cy - h, cz + b * h - .03, cx + a * h + .03, cy + h, cz + b * h + .03, A1); cb.box(cx - h, cy + a * h - .03, cz + b * h - .03, cx + h, cy + a * h + .03, cz + b * h + .03, A2); cb.box(cx + a * h - .03, cy - h, cz - h, cx + a * h + .03, cy + a * 0 + h, cz - h + .06, A2); })); add(cb, emMat(A1, 0.5, 1.1));
  const gl = new MB(); halo(gl, cx, cy, cz, 2.6, A1); halo(gl, -cx, 3.6, cz, 2.2, A2); add(gl, glowMat(lit(.3)));
  const lc = new MB(); [-1, 1].forEach(sd => { const x = sd * (HX - 1.4); lc.box(x - .3, 0, ZB + .8, x + .3, 7.8, ZB + 1.4, [.08, .07, .12]); lc.box(x - .22, .3, ZB + 1.38, x + .22, 7.5, ZB + 1.43, sd < 0 ? A1 : A2); obs(x - .4, ZB + .7, x + .4, ZB + 1.5); }); occ(() => add(lc, emMat(A1, 0.5, 1.1)));
}
function ocean(o) { const { HX, ZB, TVW, TVH, A1, A2, TRIM, add, occ, obs, emMat, halo, glowMat, night, R, S, full } = o;
  const tex = paintTank(R, 'ocean'), tx = TVW / 2 + .6, tw = HX - .5 - tx; if (tw > 1.2) { const tk = new MB(), fr = new MB(); [-1, 1].forEach(sd => { const x0 = sd < 0 ? -HX + .5 : tx, x1 = sd < 0 ? -tx : HX - .5; tk.wall(x0, 1.2, x1, 6.6, ZB + .14, [1, 1, 1], [0, 0, 1, 1]); fr.box(x0 - .12, 1.05, ZB + .03, x1 + .12, 1.2, ZB + .22, TRIM); fr.box(x0 - .12, 6.6, ZB + .03, x1 + .12, 6.78, ZB + .22, TRIM); fr.box(x0 - .12, 1.05, ZB + .03, x0, 6.78, ZB + .22, TRIM); fr.box(x1, 1.05, ZB + .03, x1 + .12, 6.78, ZB + .22, TRIM); }); add(tk, { tex, em: tex, emDay: .6, emNight: .8 }); add(fr, {}); }
  const jf = new MB(), gl = new MB(); [[-5, -2, 6], [4, 1, 6.6], [-1, 3.5, 5.8], [6.2, -4.5, 6.2]].forEach(([x, z, y], i) => { jf.cyl(x, z, y + .6, 9.5, .02, .02, 4, [.8, .9, 1], false); jf.sphere(x, y, z, .45, .38, .45, i % 2 ? [.7, .95, 1] : [1, .7, .95], 8); for (let k = 0; k < 6; k++) jf.cyl(x + Math.cos(k) * .25, z + Math.sin(k) * .25, y - 1.0, y - .2, .015, .015, 4, [.8, .95, 1], false); halo(gl, x, y - .2, z, 1.6, i % 2 ? [.5, .9, 1] : [1, .6, .9]); }); occ(() => add(jf, emMat([.8, .95, 1], 0.5, 1.1))); add(gl, glowMat(night(.3)));
  const cr = new MB(); [[-4.3, ZB + 5.1], [4.3, ZB + 5.1]].forEach(([x, z], i) => { for (let k = 0; k < 7; k++) { const a = k * .9, h = .5 + (k % 3) * .35; cr.cyl(x + Math.cos(a) * .35, z + Math.sin(a) * .25, 0, h, .09, .05, 5, k % 2 ? [1, .5, .45] : [1, .75, .5], true); cr.sphere(x + Math.cos(a) * .35, h + .05, z + Math.sin(a) * .25, .12, .1, .12, [1, .6, .65], 5); } });  add(cr, {});
  S.extra = (fx, t, c, sn) => { for (let k = 0; k < 24; k++) { const ph = (t * .22 + k * .173) % 1, sd = k % 2 ? 1 : -1, x = sd * (tx + .5 + ((k * 1.7) % Math.max(1, tw - 1))), y = 1.3 + ph * 5.2, s = .08 + (k % 3) * .02, P = (u, v) => [x + u * s + Math.sin(t + k) * .1, y + c * v * s, ZB + .4 - sn * v * s]; fx.spray.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], [.7, .95, 1]); } };
}
function sakura(o) { const { HX, ZB, TVW, TVH, A1, A2, TRIM, add, occ, obs, emMat, halo, glowMat, night, R, S, full } = o;
  occ(() => { const tr = new MB(), lv = new MB(); [-1, 1].forEach(sd => { const x = sd * (HX - 1.5), z = ZB + 1.7; tr.cyl(x, z, 0, 3.2, .3, .2, 8, [.32, .2, .14], true); tr.cyl(x - sd * .7, z, 2.4, 4.4, .12, .08, 6, [.32, .2, .14], false); tr.cyl(x + sd * .2, z + .3, 3.0, 5.2, .12, .07, 6, [.32, .2, .14], false); const rr = rnd(sd > 0 ? 3 : 8); for (let k = 0; k < 14; k++) lv.sphere(x - sd * 1 + (rr() - .5) * 2.8, 4.4 + rr() * 3, z + (rr() - .5) * 2.0, .6 + rr() * .7, .5 + rr() * .5, .6 + rr() * .6, rr() < .5 ? [1, .72, .82] : [1, .85, .9], 6); obs(x - .4, z - .4, x + .4, z + .4); }); add(tr, {}); add(lv, emMat([1, .8, .88], 0.3, 1.1)); });
  const sj = R.paint(256, 384, g => { g.fillStyle = '#fff8ea'; g.fillRect(0, 0, 256, 384); g.strokeStyle = '#8a5a30'; g.lineWidth = 6; for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 384); g.stroke(); } for (let y = 0; y <= 384; y += 96) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } g.strokeRect(3, 3, 250, 378); }, { clamp: true });
  const tx = TVW / 2 + .5, sw = HX - 2.4 - tx; if (sw > 1) { const sm = new MB(); [-1, 1].forEach(sd => sm.wall(sd < 0 ? -HX + 2.4 : tx, 1.0, sd < 0 ? -tx : HX - 2.4, 5.6, ZB + .14, [1, 1, 1], [0, 0, 1, 1])); add(sm, { tex: sj, em: sj, emDay: .8, emNight: 1.3 }); }
  occ(() => { const to = new MB(), z = ZB + 5.4; [-1, 1].forEach(sd => { to.cyl(sd * 3.4, z, 0, 4.4, .18, .16, 10, [.8, .1, .1], true); obs(sd * 3.4 - .3, z - .3, sd * 3.4 + .3, z + .3); }); to.box(-4.2, 4.2, z - .22, 4.2, 4.5, z + .22, [.08, .06, .08]); to.box(-3.8, 3.6, z - .12, 3.8, 3.8, z + .12, [.8, .1, .1]); add(to, {}); });
  const rg = new MB(), ln = new MB(), gl = new MB(); rg.floor(-4, ZB + 6, 4, ZB + 10, .028, [.7, .75, .35]); add(rg, {}); for (let k = 0; k < 5; k++) { const x = -7 + k * 3.5, z = -3 + (k % 2) * 4; ln.cyl(x, z, 6.4, 9.5, .02, .02, 4, [.4, .3, .3], false); ln.sphere(x, 6.0, z, .5, .5, .5, [1, .85, .9], 8); halo(gl, x, 6, z, 1.6, [1, .6, .75]); } occ(() => add(ln, emMat([1, .8, .88], 0.5, 1.1))); add(gl, glowMat(night(.3)));
  S.extra = (fx, t, c, sn) => { for (let k = 0; k < 34; k++) { const ph = (t * .12 + k * .0789) % 1, x = -HX + 1 + ((k * 5.13) % (2 * HX - 2)) + Math.sin(t * .8 + k) * .8, y = 9 - ph * 8.7, z = -8 + ((k * 3.7) % 14), s = .11, P = (u, v) => [x + u * s, y + c * v * s, z - sn * v * s]; fx.spray.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], [1, .7, .82]); } };
}
function emerald(o) { const { HX, ZB, TVW, TVH, A1, A2, TRIM, add, occ, obs, emMat, halo, glowMat, night, R, S, full } = o;
  const tex = paintTank(R, 'fall'), tx = TVW / 2 + .6, tw = HX - .6 - tx; if (tw > 1.2) { const tk = new MB(), fr = new MB(); [-1, 1].forEach(sd => { const x0 = sd < 0 ? -HX + .6 : tx, x1 = sd < 0 ? -tx : HX - .6; tk.wall(x0, 1.0, x1, 8.2, ZB + .14, [1, 1, 1], [0, 0, 1, 1]); fr.box(x0 - .1, .9, ZB + .03, x1 + .1, 1.0, ZB + .22, TRIM); fr.box(x0 - .1, 8.2, ZB + .03, x1 + .1, 8.34, ZB + .22, TRIM); fr.box(x0 - .1, .9, ZB + .03, x0, 8.34, ZB + .22, TRIM); fr.box(x1, .9, ZB + .03, x1 + .1, 8.34, ZB + .22, TRIM); }); add(tk, { tex, em: tex, emDay: .55, emNight: .8 }); add(fr, {}); }
  const pl = (x, z, s) => occ(() => { const p = new MB(); p.cyl(x, z, 0, .7, .5, .42, 10, TRIM, true); p.cyl(x, z, .7, .76, .54, .54, 10, [.1, .3, .2], true); for (let k = 0; k < 9; k++) { const a = k * .7, h = 1.2 + (k % 3) * .6; p.cyl(x + Math.cos(a) * .12, z + Math.sin(a) * .12, .76, .76 + h, .03, .02, 4, [.2, .4, .15], false); p.sphere(x + Math.cos(a) * (.5 + (k % 2) * .3), .76 + h, z + Math.sin(a) * (.5 + (k % 2) * .3), .55 * s, .22 * s, .3 * s, [.15 + (k % 3) * .06, .6 + (k % 2) * .15, .3], 5); } add(p, {}); obs(x - .6, z - .6, x + .6, z + .6); });
  pl(-(HX - 1.1), ZB + 5.2, 1); pl(HX - 1.1, ZB + 5.2, 1); pl(-(HX - 1.1), 5, 1); pl(HX - 1.1, 5, 1);
  if (full) { const fx = -(HX - 3.3), fz = -6; const fn = new MB(), gl = new MB(); fn.cyl(fx, fz, 0, .4, 1.5, 1.4, 16, TRIM, true); fn.cyl(fx, fz, .4, .8, 1.3, 1.3, 16, [.1, .4, .3], true); fn.cyl(fx, fz, .8, 1.6, .22, .18, 10, TRIM, true); fn.disc(fx, fz, 1.6, .85, 16, TRIM, 0); fn.cyl(fx, fz, 1.6, 2.2, .1, .08, 8, TRIM, true); fn.disc(fx, fz, 2.2, .42, 12, TRIM, 0); add(fn, {}); halo(gl, fx, 1.2, fz, 2.6, [.5, 1, .8]); add(gl, glowMat(night(.3))); obs(fx - 1.5, fz - 1.5, fx + 1.5, fz + 1.5);
    S.extra = (fx2, t, c, sn) => { for (let k = 0; k < 22; k++) { const ph = (t * .8 + k * .0455) % 1, a = k * 2.399, rr = ph * 1.1, y = 2.3 + 1.2 * Math.sin(Math.min(1, ph * 1.1) * Math.PI) - ph * ph * 1.9, x = fx + Math.cos(a) * rr, z = fz + Math.sin(a) * rr, s = .07, P = (u, v) => [x + u * s, y + c * v * s, z - sn * v * s]; fx2.spray.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], [.75, 1, .95]); } }; }
  const cl = new MB(); [-1, 1].forEach(sd => { const x = sd * (TVW / 2 + .35); cl.cyl(x, ZB + .5, 0, 9.6, .22, .2, 12, [.1, .5, .34], false); [.9, 3, 5, 7.2].forEach(y => cl.cyl(x, ZB + .5, y, y + .2, .28, .28, 12, TRIM, false)); }); occ(() => add(cl, {}));
}
function royal(o) { const { HX, ZB, ZF, TVW, TVH, A1, A2, TRIM, add, occ, obs, emMat, halo, glowMat, night, S, full, X } = o;
  const cr = new MB(), jw = new MB(), gl = new MB(), cy = 2.0 + TVH + .8; cr.cyl(0, ZB + .4, cy, cy + .5, 1.5, 1.5, 24, TRIM, false); for (let k = 0; k < 7; k++) { const a = (k / 6 - .5) * 2.6, x = Math.sin(a) * 1.4; cr.cyl(x, ZB + .4, cy + .5, cy + 1.5 + Math.cos(a) * .4, .22, .02, 6, TRIM, true); jw.sphere(x, cy + 1.62 + Math.cos(a) * .4, ZB + .4, .13, .13, .13, k % 2 ? [1, .2, .3] : [.3, .5, 1], 6); } for (let k = 0; k < 5; k++) jw.sphere((k - 2) * .6, cy + .25, ZB + 1.88, .12, .12, .08, [.9, .95, 1], 5); add(cr, {}); add(jw, emMat([1, .9, .9], 0.5, 1.1)); halo(gl, 0, cy + .8, ZB + 1.2, 3.6, [1, .85, .5]); add(gl, glowMat(night(.3)));
  const cu = new MB(); [-1, 1].forEach(sd => { const x = sd * (HX - .9); for (let k = 0; k < 4; k++) cu.box(x - .45 + k * .24 * sd, 0, ZB + .1 + k * .06, x - .2 + k * .24 * sd, 9.2 - k * .5, ZB + .5 + k * .06, k % 2 ? [.34, .08, .5] : [.45, .12, .66]); cu.box(x - .6, 7.0, ZB + .1, x + .6, 7.2, ZB + .6, TRIM); }); occ(() => add(cu, {}));
  if (full) occ(() => { const c = new MB(); [-1, 1].forEach(sd => { const x = sd * (HX - 1.6), z = -1; c.cyl(x, z, 0, .4, .65, .6, 14, TRIM, true); c.cyl(x, z, .4, 8, .42, .38, 16, [.95, .93, .98], false); c.cyl(x, z, 8, 8.4, .66, .5, 14, TRIM, true); obs(x - .6, z - .6, x + .6, z + .6); }); add(c, {}); });
  { const tx = HX - 3.2, tz = ZF - 3.8, tb = new MB(), ch = new MB(), lq = new MB(); tb.cyl(tx, tz, 0, .9, .55, .5, 12, [.95, .93, .98], true); tb.cyl(tx, tz, .9, .96, .62, .62, 12, TRIM, true);
    [[4, .5], [3, .38], [2, .26], [1, .14]].forEach(([n, r], li) => { for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * 6.283, x = tx + (n > 1 ? Math.cos(a) * r * (n - 1) * .8 : 0), z = tz + (n > 1 ? Math.sin(a) * r * (n - 1) * .8 : 0), y = .96 + li * .2; ch.cyl(x, z, y, y + .2, .09, .05, 6, [.95, .97, 1], true); lq.sphere(x, y + .13, z, .055, .05, .055, [1, .85, .4], 4); } });
    add(tb, {}); add(ch, {}); add(lq, emMat([1, .85, .4], 0.5, 1.1)); obs(tx - .8, tz - .8, tx + .8, tz + .8); const g2 = new MB(); halo(g2, tx, 1.5, tz, 1.8, [1, .85, .5]); add(g2, glowMat(night(.3))); }
}

/* ================= 场景分发 ================= */
G.Scenes.makeTianhuang = (id, R, T) => id === 'ktv' ? KT.makeLobby(R, T) : id === 'ktv2' ? KT.makeFloor(R, T, 2) : id === 'ktv3' ? KT.makeFloor(R, T, 3) : makeRoom(R, T, id);
})(window);
