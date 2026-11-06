/* scene-klcc.js — KLCC: 双子塔 + Suria KLCC + 音乐喷泉大湖 + 空中单轨 (Scenes.makeKlcc; 依赖 scene-common.js)
   与 Bukit Bintang 连通: 人行天桥 / 单轨. 默认相机是低机位广角, 让双子塔有气势. */
(function (G) {
'use strict';
const { MB } = G.World, C = G.Scenes.C, TAU = Math.PI * 2, { rnd, rbox, ellipse, ellipseRing, ellipseWall, beam } = C;
const PITCH = .16;
const fr = (v) => v - Math.floor(v);
const hsv = (h, s, v) => { h = fr(h); const i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i]; };

/* ---------- 程序化贴图 ---------- */
function tex(R) {
  const X = {}, P = (w, h, fn, o) => R.paint(w, h, fn, o), dual = (w, h, fn, o) => ({ tex: P(w, h, (g) => fn(g, false), o), em: P(w, h, (g) => fn(g, true), o) });
  X.paveK = P(256, 256, (g) => { const r = rnd(2); g.fillStyle = '#9d948a'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 12 * (r() - .5); g.fillStyle = `rgb(${204 + v},${196 + v},${184 + v})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } });
  X.grass = P(128, 128, (g) => { const r = rnd(4); g.fillStyle = '#4f9d4f'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 260; i++) { g.fillStyle = r() < .5 ? 'rgba(30,110,40,.35)' : 'rgba(150,210,110,.3)'; g.fillRect(r() * 128, r() * 128, 2, 3); } });
  X.track = P(256, 64, (g) => { const r = rnd(6); g.fillStyle = '#b8473b'; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 200; i++) { g.fillStyle = r() < .5 ? 'rgba(120,30,25,.25)' : 'rgba(230,110,90,.2)'; g.fillRect(r() * 256, r() * 64, 3, 2); } g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, 6, 256, 3); g.fillRect(0, 55, 256, 3); });
  X.wing = dual(512, 256, (g, em) => {                                    // 商场翼楼: 米褐色横条 + 暖光窗带
    const r = rnd(9); g.fillStyle = em ? '#000' : '#cdb48f'; g.fillRect(0, 0, 512, 256);
    for (let f = 0; f < 3; f++) { const y0 = f * 85 + 36;
      if (!em) { g.fillStyle = '#d9c4a0'; g.fillRect(0, f * 85, 512, 36); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, f * 85 + 33, 512, 3); g.fillStyle = '#34414f'; g.fillRect(0, y0, 512, 46); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, y0, 512, 6); g.fillStyle = '#c0a47c'; for (let x = 0; x < 512; x += 64) g.fillRect(x, y0, 6, 46); }
      else { for (let x = 0; x < 512; x += 64) { if (r() < .22) continue; const gr = g.createLinearGradient(0, y0, 0, y0 + 46); gr.addColorStop(0, '#ffe2a8'); gr.addColorStop(1, '#ffb96a'); g.fillStyle = gr; g.fillRect(x + 6, y0 + 2, 52, 42); } } }
  });
  X.atrium = dual(512, 512, (g, em) => {                                  // 中庭大玻璃: 多层暖光餐厅
    const r = rnd(12), frame = () => { for (let i = 0; i <= 8; i++) g.fillRect(i * 64 - 3, 0, 6, 512); for (let f = 0; f <= 4; f++) g.fillRect(0, f * 128 - 3, 512, 7); };
    if (!em) { g.fillStyle = '#2a3340'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#9aa4b0'; frame(); }
    else { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); for (let f = 0; f < 4; f++) { const gr = g.createLinearGradient(0, f * 128, 0, f * 128 + 128); gr.addColorStop(0, '#ffd08a'); gr.addColorStop(1, '#ff9a55'); g.fillStyle = gr; g.fillRect(0, f * 128 + 5, 512, 118);
        for (let i = 0; i < 18; i++) { g.fillStyle = r() < .3 ? '#ff6aa0' : r() < .5 ? '#7fd8ff' : '#6b3a22'; g.globalAlpha = .55; g.fillRect(r() * 480, f * 128 + 40 + r() * 50, 12 + r() * 22, 26); } g.globalAlpha = 1; }
      g.fillStyle = '#000'; frame(); }
  });
  X.petro = dual(512, 1024, (g, em) => {                                  // 双子塔: 不锈钢肋 + 暖色灯带 + 上部泛光
    const W = 512, H = 1024;
    if (!em) { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#8e9aaf'); gr.addColorStop(.5, '#dfe5ef'); gr.addColorStop(1, '#8a96ac'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(40,60,100,.5)'; for (let y = 0; y < H; y += 9) g.fillRect(0, y, W, 3); }
    else { g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 9) { const f = 1 - y / H; g.fillStyle = `rgba(${200 + 55 * f | 0},${215 + 40 * f | 0},255,${.16 + .5 * f})`; g.fillRect(0, y, W, 3); }
      g.fillStyle = 'rgba(255,214,110,.8)'; [.30, .37, .45, .52, .60, .68].forEach(v => g.fillRect(0, H * v, W, 16));
      const fl = g.createLinearGradient(0, 0, 0, H * .4); fl.addColorStop(0, 'rgba(255,245,220,.8)'); fl.addColorStop(1, 'rgba(255,245,220,0)'); g.fillStyle = fl; g.fillRect(0, 0, W, H * .4); }
  });
  X.swirl = dual(256, 256, (g, em) => {                                   // 简化的紫色漩涡标志
    g.fillStyle = em ? '#000' : '#1a0f2e'; g.fillRect(0, 0, 256, 256); g.translate(128, 128);
    for (let k = 0; k < 14; k++) { g.save(); g.rotate(k / 14 * TAU); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(30, -20, 90, -30, 110, 10); g.bezierCurveTo(80, -2, 40, 4, 0, 0); g.fillStyle = em ? `hsl(${285 + k * 4},90%,${60 + (k % 3) * 8}%)` : `hsl(${285 + k * 4},70%,${45 + (k % 3) * 6}%)`; g.fill(); g.restore(); }
    g.beginPath(); g.arc(0, 0, 14, 0, 6.3); g.fillStyle = em ? '#ffe9ff' : '#e8d0f8'; g.fill();
  }, { clamp: true });
  X.piazza = P(512, 512, (g) => {                                         // 圆形广场: 同心环 + 八角星 (青金配色)
    const c = 256, ring = (r, col) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill(); };
    ring(256, '#6a645a'); ring(248, '#d8cfbf'); ring(222, '#1f6f80'); ring(214, '#d8cfbf'); ring(186, '#cbbfa8'); ring(150, '#c8932f'); ring(142, '#e6dccb'); ring(112, '#d2c6b0');
    g.strokeStyle = 'rgba(80,66,44,.3)'; g.lineWidth = 2; for (let k = 0; k < 72; k++) { const a = k / 72 * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * 186, c + Math.sin(a) * 186); g.lineTo(c + Math.cos(a) * 214, c + Math.sin(a) * 214); g.stroke(); }
    const st = (R0, R1, rot, fill, stroke) => { g.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + rot, r = k % 2 ? R1 : R0; g[k ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = 4; g.stroke(); };
    st(108, 60, 0, '#1f6f80', '#c8932f'); st(76, 42, Math.PI / 8, '#e6dccb', '#1f6f80'); ring(30, '#c8932f'); ring(22, '#1f6f80');
  });
  X.train = dual(1024, 416, (g, em) => {                                  // KL 单轨列车侧面: 白底 + 红色飘带 + 顶部蓝条 + 门窗
    const W = 1024, H = 416, r = rnd(77), spots = [['d', 72, 110], ['w', 202, 140], ['w', 362, 140], ['w', 522, 140], ['w', 682, 140], ['d', 842, 110]];
    g.fillStyle = em ? '#000' : '#f3f4f8'; g.fillRect(0, 0, W, H);
    if (!em) { g.fillStyle = '#e4e7ee'; g.fillRect(0, H * .86, W, H * .14); g.fillStyle = '#1f4fb4'; g.fillRect(0, H * .19, W, H * .05);
      g.fillStyle = '#d61f2c'; g.beginPath(); g.moveTo(0, H * .74); g.bezierCurveTo(W * .3, H * .64, W * .62, H * .86, W, H * .7); g.lineTo(W, H * .9); g.bezierCurveTo(W * .66, H * 1.02, W * .3, H * .84, 0, H * .94); g.closePath(); g.fill();
      g.fillStyle = '#d61f2c'; g.beginPath(); g.moveTo(0, H * .52); g.bezierCurveTo(W * .17, H * .6, W * .33, H * .78, W * .47, H * .97); g.lineTo(0, H * .97); g.closePath(); g.fill();                       // 左右两片大红色飘带 (参照真实涂装)
      g.beginPath(); g.moveTo(W, H * .52); g.bezierCurveTo(W * .83, H * .6, W * .67, H * .78, W * .53, H * .97); g.lineTo(W, H * .97); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.font = '800 30px Arial'; g.textAlign = 'center'; g.fillText('MONORAIL', W * .5, H * .88); }
    spots.forEach(([k, x, w]) => { const y0 = H * .3, h = H * .38;
      if (!em) { if (k === 'w') { const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#34476a'); gr.addColorStop(1, '#0e1a30'); g.fillStyle = '#c9ced8'; g.fillRect(x - 5, y0 - 5, w + 10, h + 10); g.fillStyle = gr; g.fillRect(x, y0, w, h); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + 10, y0 + h); g.lineTo(x + w * .45, y0); g.lineTo(x + w * .7, y0); g.lineTo(x + 30, y0 + h); g.fill(); }
        else { g.fillStyle = '#dfe3ea'; g.fillRect(x, y0 - 8, w, h + 24); g.fillStyle = '#9aa2b2'; g.fillRect(x + w / 2 - 2, y0 - 8, 4, h + 24); g.fillStyle = '#1c2a44'; g.fillRect(x + 12, y0 + 6, w / 2 - 20, h * .55); g.fillRect(x + w / 2 + 8, y0 + 6, w / 2 - 20, h * .55); } }
      else { const lit = r() > .2; g.fillStyle = k === 'w' ? (lit ? '#ffe7b0' : '#c79a55') : '#fff0c8'; if (k === 'w') g.fillRect(x, y0, w, h); else { g.fillRect(x + 12, y0 + 6, w / 2 - 20, h * .55); g.fillRect(x + w / 2 + 8, y0 + 6, w / 2 - 20, h * .55); } } });
  });
  const ADS = [{ c: ['#ff3d8b', '#7b2cff'], t1: '今晚大减价', t2: 'SALE 70%', t3: 'RM 99 起' }, { c: ['#18c6c6', '#1c5cff'], t1: 'BUBBLE TEA', t2: '买一送一', t3: '今天限定' }, { c: ['#ff7a18', '#c4122f'], t1: 'CINEMA', t2: '今晚电影', t3: 'TONIGHT 8PM' },
    { c: ['#1db954', '#f6d32d'], t1: 'SELAMAT', t2: '欢迎来到吉隆坡', t3: 'Welcome to KL' }, { c: ['#2d7bff', '#12d6ff'], t1: 'FREE WIFI', t2: '5G 高速上网', t3: 'RM 30 / 月' }, { c: ['#8a4a1c', '#ffb347'], t1: 'TEH TARIK', t2: '拉茶 RM3', t3: '现拉现喝' }, { c: ['#e11d48', '#fbbf24'], t1: 'KL FOOD FEST', t2: '美食节', t3: '本周末免费入场' }];
  const drawAd = (g, em, w, h, a) => { const land = w > h, ff = '"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif', gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, a.c[0]); gr.addColorStop(1, a.c[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.14)'; for (let k = -2; k < 8; k++) { g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4 + w * .18, 0); g.lineTo(k * w / 4 + w * .18 - h * .5, h); g.lineTo(k * w / 4 - h * .5, h); g.fill(); }
    g.beginPath(); g.arc(land ? w * .86 : w * .5, land ? h * .5 : h * .2, land ? h * .3 : w * .26, 0, TAU); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 8; const cx = land ? w * .42 : w / 2, mw = (land ? w * .72 : w * .9);
    const line = (txt, base, wt, y) => { let sz = base; g.font = `${wt} ${sz}px ${ff}`; while (g.measureText(txt).width > mw && sz > 10) { sz -= 2; g.font = `${wt} ${sz}px ${ff}`; } g.fillText(txt, cx, y); };
    if (land) { line(a.t1, h * .26, 800, h * .3); line(a.t2, h * .3, 800, h * .58); line(a.t3, h * .16, 700, h * .84); } else { line(a.t1, w * .15, 800, h * .46); line(a.t2, w * .18, 800, h * .62); line(a.t3, w * .11, 700, h * .8); }
    g.shadowBlur = 0; if (!em) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, w, h); } };
  X.ads = ADS.map((a) => ({ L: dual(512, 256, (g, em) => drawAd(g, em, 512, 256, a)), P: dual(256, 416, (g, em) => drawAd(g, em, 256, 416, a)) }));
  return X;
}

/* =====================================================================
   KLCC
   ===================================================================== */
function makeKlcc(R, T, style) {
  const S = {}, K = C.kit(R, T, S), X = tex(R), { add, occ, occ0, occ1, obs, obsRot, emS, solid, signAt, addTw } = K;
  const LC = [0, 26], LRX = 40, LRZ = 20, TZ = -64, TXs = [-20.5, 20.5], HR = 62;
  const hl = (mb, x, y, z, s, col) => C.halo(mb, x, y, z, s, col, PITCH), gl = new MB();
  const ck = document.createElement('canvas'); ck.width = 256; ck.height = 96;                       // LED 钟的动态贴图 (每 0.1 秒按 g.hour 刷新)
  const ckc = ck.getContext('2d'), clockTex = R.canvasTex(ck, { clamp: true, mip: false });
  const drawClock = (txt) => { ckc.fillStyle = '#000'; ckc.fillRect(0, 0, 256, 96); ckc.strokeStyle = '#ff4a30'; ckc.lineWidth = 6; ckc.strokeRect(5, 5, 246, 86); ckc.font = '700 46px "Courier New",monospace'; ckc.textAlign = 'center'; ckc.textBaseline = 'middle'; ckc.fillStyle = '#ff4a30'; ckc.fillText(txt, 128, 50); R.updateCanvasTex(clockTex, ck); };
  drawClock('--:--:--'); let clockLast = '';
  const edgeZ = (x) => LC[1] + LRZ * Math.sqrt(Math.max(0, 1 - (x / LRX) * (x / LRX)));      // 湖面前沿 z

  /* ---- 地面 / 草坪 / 大湖 / 慢跑道 ---- */
  { const g = new MB(); g.floor(-260, -200, 260, 170, 0, [.82, .78, .74], [0, 0, 52, 37]); add(g, { tex: X.paveK });
    const gr = new MB(); [[-64, 40, 24, 26], [66, 18, 22, 22], [-70, 2, 20, 10], [68, -2, 20, 10], [-34, 72, 20, 8], [34, 72, 20, 8]].forEach(([x, z, rx, rz]) => { ellipse(gr, x, z, rx, rz, .012, [.36, .66, .36], 40, [6, 6]); ellipse(gr, x, z, rx * .78, rz * .78, .016, [.44, .74, .4], 36, [6, 6]); }); add(gr, { tex: X.grass });
    const lk = new MB(); ellipse(lk, LC[0], LC[1], LRX, LRZ, .35, [.06, .17, .26], 60, [12, 12]); add(lk, { em: solid(16, 62, 92), emDay: .3, emNight: .55 });
    const cp = new MB(); ellipseWall(cp, LC[0], LC[1], LRX, LRZ, .35, .75, [.8, .76, .7], 60); ellipseRing(cp, LC[0], LC[1], LRX, LRZ, LRX + 1.4, LRZ + 1.4, .75, [.86, .82, .76], 60, [6, 2]); add(cp, {});
    const tk = new MB(); ellipseRing(tk, LC[0], LC[1], LRX + 1.4, LRZ + 1.4, LRX + 4.4, LRZ + 4.4, .035, [1, 1, 1], 72, [10, 3]); add(tk, { tex: X.track });
    const pm = new MB(); ellipseRing(pm, LC[0], LC[1], LRX + 4.4, LRZ + 4.4, LRX + 8, LRZ + 8, .03, [.9, .86, .8], 72, [8, 4]); add(pm, { tex: X.paveK });
    for (let z0 = LC[1] - LRZ - 1.4; z0 < LC[1] + LRZ + 1.4; z0 += 2) { const zc = z0 + 1, q = 1 - Math.pow((zc - LC[1]) / (LRZ + 1.4), 2); if (q <= 0) continue; const hw = (LRX + 1.4) * Math.sqrt(q); obs(-hw, z0, hw, z0 + 2); }
    const pz = new MB(); pz.floor(-70, -8, 70, 8, .02, [.9, .86, .8], [0, 0, 14, 3.2]); add(pz, { tex: X.paveK });
    const pc = new MB(); pc.disc(0, 58, .04, 13, 64, [1, 1, 1]); add(pc, { tex: X.piazza }); const pe = new MB(); pe.cyl(0, 58, 0, .14, 13.25, 13.25, 64, [.72, .68, .62]); add(pe, {});
    // 花坛 (中轴两侧)
    const fb = new MB(), r = rnd(21), fl = [[.95, .25, .5], [.95, .6, .2], [1, .85, .25], [.8, .3, .8]]; [[-18, 63], [18, 63], [-18, 71], [18, 71], [-36, 64], [36, 64]].forEach(([x, z], i) => { rbox(fb, x, z, 4.6, 2, 0, .55, 0, [.78, .74, .68]); for (let k = 0; k < 4; k++) { const bx = x - 1.5 + k, bz = z + (r() - .5) * .5; fb.sphere(bx, .75, bz, .62, .5, .62, [.3 + r() * .08, .62, .34], 7); fb.sphere(bx + .1, 1.1, bz, .4, .3, .4, fl[(i + k) % 4], 6); } obs(x - 2.5, z - 1.2, x + 2.5, z + 1.2); }); add(fb, {}); }

  /* ---- Suria KLCC 商场: 中庭 + 环抱的两翼 + 后方大裙楼 ---- */
  { const mm = new MB(), wi = X.wing;
    rbox(mm, 0, -18, 30, 24, 0, 15.5, 0, [1, 1, 1], [16, 11]);
    [-1, 1].forEach(sd => rbox(mm, sd * 38, -26.5, 46, 36, 0, 11, -sd * .16, [1, 1, 1], [16, 11]));
    rbox(mm, 0, -56, 96, 40, 0, 12, 0, [1, 1, 1], [16, 11]); add(mm, { tex: wi.tex, em: wi.em, emDay: .25, emNight: 1.0 });
    const ag = new MB(); ag.quad([-10.5, .2, -5.9], [10.5, .2, -5.9], [10.5, 14.2, -5.9], [-10.5, 14.2, -5.9], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); add(ag, { tex: X.atrium.tex, em: X.atrium.em, emDay: .5, emNight: 1.1 });
    [[-1, '#ff5ccf'], [1, '#5cc8ff']].forEach(([sd, hx]) => { const led = new MB(); rbox(led, sd * 38, -26.5, 46.4, 36.4, 10.85, 11.15, -sd * .16, [.1, .1, .1]); add(led, emS(hx, .5, 1.4)); });
    const lt = new MB(); rbox(lt, 0, -18, 30.4, 24.4, 15.3, 15.6, 0, [.1, .1, .1]); add(lt, emS('#ffd27a', .5, 1.4));
    signAt('SURIA KLCC', { w: 512, h: 120, fs: 64, bg: '#1b1230', fg: '#ffffff', border: '#b05cff' }, 0, -6.4, 0, 15.8, 17.6, 12, .7, 1.3);
    const sw = new MB(); sw.quad([-2.1, 17.9, -6.3], [2.1, 17.9, -6.3], [2.1, 22.1, -6.3], [-2.1, 22.1, -6.3], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); add(sw, { tex: X.swirl.tex, em: X.swirl.em, emDay: .6, emNight: 1.4 });
    signAt('百货 DEPARTMENT STORE', { w: 512, h: 100, fs: 40, bg: '#2a1a0a', fg: '#ffe9b8', border: '#e6b84f' }, -35.3 - .03, -8.55, -.16, 7.6, 9.3, 15, .6, 1.2);
    signAt('美食 FOOD & DINE', { w: 512, h: 100, fs: 44, bg: '#0c2438', fg: '#d8f2ff', border: '#5cc8ff' }, 35.3 + .03, -8.55, .16, 7.6, 9.3, 15, .6, 1.2);
    const ca = new MB(); rbox(ca, 0, -3.8, 14, 4.6, 5.2, 5.8, 0, [.93, .9, .84]); [-6, -2, 2, 6].forEach(x => ca.cyl(x, -1.8, 0, 5.2, .3, .3, 10, [.93, .9, .84])); add(ca, {});
    const g1 = new MB(); C.pool(g1, 0, -2, 9, [1, .8, .5], .045); hl(g1, 0, 4, -5, 11, [1, .85, .55]); add(g1, { tex: T.glow, mode: 2, glow: e => .12 + e.night * .6 });
    S.hotspots.push({ id: 'suria', x: 0, z: -3.4, r: 2.0, label: 'Suria KLCC 商场', icon: '🛍', color: [1, .8, .5] }); }

  /* ---- 圣诞树 (中庭门口右侧): 分层绿色树冠 + 红金蓝挂球 + 金色彩带 + 顶星 + 不规律闪烁的彩灯 + 礼物堆 ---- */
  const treeSpark = [];
  { const X0 = 11, Z0 = -.6, r = rnd(41), tiers = [], gold = [.95, .76, .22];
    for (let i = 0; i < 6; i++) tiers.push({ y0: .8 + i * 1.5, h: 2.7 - i * .12, r0: 3.3 - i * .5 });
    const rAt = (y) => { let q = tiers[0]; for (const t of tiers) if (y >= t.y0) q = t; const u = Math.min(1, Math.max(0, (y - q.y0) / q.h)); return q.r0 * (1 - u) + .3 * u; };
    occ(() => {
      const tr = new MB(); tr.cyl(X0, Z0, 0, 1.0, .34, .3, 10, [.32, .2, .12]); tr.cyl(X0, Z0, 0, .75, 1.1, 1.0, 18, [.62, .1, .12], true);
      tiers.forEach((q, i) => { tr.cyl(X0, Z0, q.y0, q.y0 + q.h, q.r0, .3, 18, i % 2 ? [.1, .4, .17] : [.07, .3, .13]); tr.disc(X0, Z0, q.y0, q.r0, 18, [.05, .2, .08]); }); add(tr, {});
      const og = new MB(), oc = [[.85, .1, .14], [.95, .76, .22], [.2, .42, .88], [.9, .9, .95], [.85, .1, .14], [.95, .76, .22]];
      for (let n = 0; n < 48; n++) { const y = 1.3 + r() * 7.6, rr = rAt(y) + .16, a = r() * TAU; og.sphere(X0 + Math.cos(a) * rr, y, Z0 + Math.sin(a) * rr, .26, .26, .26, oc[n % 6], 8); } add(og, {});
      const gb = new MB(); for (let k = 0; k < 110; k++) { const t = k / 110, y = 1.2 + t * 8.6, rr = rAt(y) + .1, a = t * TAU * 6.5, x = X0 + Math.cos(a) * rr, z = Z0 + Math.sin(a) * rr; gb.box(x - .09, y - .09, z - .09, x + .09, y + .09, z + .09, gold); } add(gb, {});
      ['#ff4a4a', '#ffd24a', '#ffffff', '#5fb4ff', '#ff8ad8', '#8dff7a', '#ffa84a', '#7ff0ff'].forEach((hx, gi) => { const lb = new MB();                // 8 组彩灯, 每组频率/相位都不同 => 不规律闪烁
        for (let j = 0; j < 22; j++) { const y = 1.2 + r() * 8.6, rr = rAt(y) + .14, a = r() * TAU, x = X0 + Math.cos(a) * rr, z = Z0 + Math.sin(a) * rr; lb.box(x - .07, y - .07, z - .07, x + .07, y + .07, z + .07, [.1, .1, .1]); if (j % 4 === 0) treeSpark.push([x, y, z, r() * 6.28, 1.2 + r() * 3.2]); }
        const b = add(lb, emS(hx, .45, 1.9)); if (b) S.tw.push({ b, ph: r() * 6.28, f: 1.1 + r() * 3.6 }); });
      const st = new MB(), cy = 10.75, bk = [.1, .1, .1];                                                                                       // 顶星 (两片十字交叉)
      const c0 = st.vert([X0, cy, Z0], [0, 0, 1], .5, .5, bk), b0 = st.n; for (let k = 0; k < 10; k++) { const an = Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? .38 : .95; st.vert([X0 + Math.cos(an) * rr, cy + Math.sin(an) * rr, Z0], [0, 0, 1], .5, .5, bk); } for (let k = 0; k < 10; k++) st.i.push(c0, b0 + k, b0 + (k + 1) % 10);
      const c1 = st.vert([X0, cy, Z0], [1, 0, 0], .5, .5, bk), b1 = st.n; for (let k = 0; k < 10; k++) { const an = Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? .38 : .95; st.vert([X0, cy + Math.sin(an) * rr, Z0 + Math.cos(an) * rr], [1, 0, 0], .5, .5, bk); } for (let k = 0; k < 10; k++) st.i.push(c1, b1 + k, b1 + (k + 1) % 10);
      add(st, emS('#ffd34a', .9, 2.4));
      const gf = new MB(), gc = [[.8, .1, .15], [.15, .35, .8], [.9, .72, .2], [.12, .55, .3], [.6, .2, .7], [.85, .4, .1], [.9, .9, .95]];          // 树下礼物
      for (let k = 0; k < 8; k++) { const an = k * .85 + .3, rad = 2.9 + r() * .5, x = X0 + Math.cos(an) * rad, z = Z0 + Math.sin(an) * rad, w = .7 + r() * .45, hh = .55 + r() * .45, yw = r() * 3, col = gc[k % 7];
        rbox(gf, x, z, w, w, 0, hh, yw, col); rbox(gf, x, z, w + .03, .12, 0, hh + .02, yw, [1, .9, .5]); rbox(gf, x, z, .12, w + .03, 0, hh + .02, yw, [1, .9, .5]); } add(gf, {});
    });
    hl(gl, X0, 6, Z0 + 1.5, 9, [1, .85, .5]); obs(X0 - 3.2, Z0 - 3.2, X0 + 3.2, Z0 + 3.2); }

  /* ---- 双子塔 (八角星截面, 分层收窄, 暖色灯带) + 天桥 + 倒V支撑 ---- */
  { const tw = new MB(), cap = new MB(), Ro = 7.8, Ri = .74;
    const prof = [[0, 1.1], [.05, 1.0], [.62, .94], [.62, .86], [.74, .86], [.74, .74], [.84, .74], [.84, .6], [.91, .6], [.91, .46], [.96, .46], [.96, .32], [.985, .32]];
    TXs.forEach(cx => {
      for (let q = 0; q + 1 < prof.length; q++) { const [f0, s0] = prof[q], [f1, s1] = prof[q + 1]; if (f1 === f0) continue; const y0 = f0 * HR, y1 = f1 * HR;
        for (let k = 0; k < 16; k++) { const a0 = k / 16 * TAU + Math.PI / 8, a1 = (k + 1) / 16 * TAU + Math.PI / 8, ra = (k % 2 ? Ri : 1) * Ro, rb = ((k + 1) % 2 ? Ri : 1) * Ro;
          const A0 = [cx + Math.cos(a0) * ra * s0, y0, TZ + Math.sin(a0) * ra * s0], B0 = [cx + Math.cos(a1) * rb * s0, y0, TZ + Math.sin(a1) * rb * s0], B1 = [cx + Math.cos(a1) * rb * s1, y1, TZ + Math.sin(a1) * rb * s1], A1 = [cx + Math.cos(a0) * ra * s1, y1, TZ + Math.sin(a0) * ra * s1];
          let n = [B0[2] - A0[2], 0, -(B0[0] - A0[0])]; const ml = Math.hypot(n[0], n[2]) || 1; n = [n[0] / ml, 0, n[2] / ml]; if (n[0] * ((A0[0] + B0[0]) / 2 - cx) + n[2] * ((A0[2] + B0[2]) / 2 - TZ) < 0) n = [-n[0], 0, -n[2]];
          tw.quad(A0, B0, B1, A1, n, [k / 16 * 3, 1 - y1 / HR, (k + 1) / 16 * 3, 1 - y0 / HR], [1, 1, 1]); } }
      cap.sphere(cx, .985 * HR + .7, TZ, 1.9, 1.4, 1.9, [.9, .92, .96], 10); C.tcyl(cap, [cx, .985 * HR + 1.6, TZ], [cx, HR + 14, TZ], .32, .05, 6, [.92, .94, .98]); cap.cyl(cx, TZ, HR + 4, HR + 4.4, .8, .8, 8, [.9, .92, .96]);
      hl(gl, cx, 60, TZ + 5, 18, [1, .95, .8]); hl(gl, cx, 14, TZ + 8, 30, [1, .88, .55]); });
    add(tw, { tex: X.petro.tex, em: X.petro.em, emDay: .25, emNight: 1.15 }); add(cap, {});
    const br = new MB(), bc = [.86, .9, .97]; br.box(-14.6, 28.5, TZ - 1.7, 14.6, 31.5, TZ + 1.7, bc); beam(br, -14.4, 19.5, 0, 28.5, TZ + 1.3, 1.0, bc); beam(br, 14.4, 19.5, 0, 28.5, TZ + 1.3, 1.0, bc); add(br, emS('#bcd8ff', .3, 1.1));
    const rb = new MB(); rbox(rb, 0, -50, 26, 18, 0, 13, 0, [.74, .64, .52], [16, 11]); add(rb, {}); }

  /* ---- 周边塔楼 (参考照片: 斜顶玻璃塔 / 圆弧塔+LED钟 / 白色圆弧塔 / 发光边线黑塔 / 褐色酒店) ---- */
  { const fc = (seed, o) => T.facade(seed, o);
    const bld = (x, z, w, d, h, f, nt) => { const mb = new MB(); rbox(mb, x, z, w, d, 0, h, 0, [1, 1, 1], [w, h], { noTop: true }); add(mb, { tex: f.tex, em: f.em, emDay: 0, emNight: nt || .8 }); const rf = new MB(); rbox(rf, x, z, w + .2, d + .2, h, h + .5, 0, [.3, .3, .36]); add(rf, {}); };
    bld(-52, -62, 20, 20, 60, fc(62, { wall: '#252b3a', glass: ['#34476a', '#1b2a4a'], cols: 6, rows: 17, lit: .4 })); { const wd = new MB(); C.wedge(wd, -52, -62, 20.2, 20.2, 60.5, 9, [.2, .24, .34]); add(wd, {}); const nl = new MB(); rbox(nl, -52, -51.9, 20.4, .5, 60.2, 60.7, 0, [.1, .1, .1]); add(nl, emS('#e070ff', .5, 1.6)); }
    bld(-52, -40, 18, 16, 36, fc(64, { wall: '#3a4250', glass: ['#4a6088', '#2a3a58'], cols: 5, rows: 10, lit: .5 }));
    bld(-82, -56, 24, 20, 30, fc(61, { wall: '#9a7550', glass: ['#c89a5a', '#7a5a38'], cols: 7, rows: 9, lit: .8 })); bld(-80, -56, 16, 16, 42, fc(68, { wall: '#8a6642', glass: ['#c89a5a', '#7a5a38'], cols: 5, rows: 11, lit: .8 }));
    const oval = (x, z, r, h, f, nt) => { const m = new MB(); m.cyl(x, z, 0, h, r, r, 32, [1, 1, 1]); add(m, { tex: f.tex, em: f.em, emDay: 0, emNight: nt || .8 }); return h; };
    { const x = 52, z = -62, r = 10, h = oval(x, z, r, 54, fc(63, { wall: '#c9d0d6', glass: ['#8aa4b8', '#5a7690'], cols: 20, rows: 15, lit: .6 })); const cr = new MB(); cr.cyl(x, z, h, h + 2.2, r + .6, r + .6, 32, [.95, .95, .97]); cr.cyl(x, z, h + 2.2, h + 2.6, r - 1, r - 1, 32, [.35, .35, .4]); add(cr, {}); const cm = new MB(); rbox(cm, x, z + r + .1, 9.8, .25, h - 5.6, h - 1.9, 0, [.06, .02, .02], [9.8, 3.7], { noBack: true, noSides: true, noTop: true }); add(cm, { em: clockTex, emDay: 1.0, emNight: 1.8 }); }
    oval(78, -58, 12, 62, fc(65, { wall: '#e6e2da', glass: ['#7d99b0', '#4e6c88'], cols: 24, rows: 17, lit: .55 }));
    { const x = 106, z = -28; bld(x, z, 22, 22, 92, fc(66, { wall: '#10141c', glass: ['#1e2a40', '#0e1626'], cols: 6, rows: 24, lit: .35 })); const ne = new MB(); [-11, 11].forEach(dx => ne.box(x + dx - .2, 0, z + 10.9, x + dx + .2, 92, z + 11.3, [.1, .1, .1])); ne.box(x - 3.2, 0, z + 11.05, x - 2.8, 92, z + 11.4, [.1, .1, .1]); ne.box(x + 3.8, 0, z + 11.05, x + 4.2, 92, z + 11.4, [.1, .1, .1]); add(ne, emS('#9fe8ff', .5, 1.5)); }
    bld(-106, -30, 22, 22, 84, fc(67, { wall: '#2a1f1a', glass: ['#5a4a3a', '#2a2018'], cols: 6, rows: 21, lit: .5 }));
    const sk = [fc(41, { wall: '#9ea6c4', cols: 4, rows: 9, lit: .5 }), fc(42, { wall: '#b6a9c9', cols: 4, rows: 9, lit: .42 }), fc(43, { wall: '#8c9bb8', cols: 4, rows: 8, lit: .55 })], r = rnd(91);
    for (let i = 0; i < 34; i++) { const x = -190 + i * 11.2 + (r() - .5) * 5, z = -96 - r() * 60, w = 10 + r() * 12, h = 20 + r() * 30; if ((x > 20 && x < 120 && z > -120) || (x > -120 && x < -30 && z > -110)) continue; bld(x, z, w, 12, h, sk[i % 3], 1.0); } }

  /* ---- 路灯 + 灯串(夜晚闪烁): 一圈紧贴星形广场外沿 + 湖边外圈(避开广场) ---- */
  { const poles = new MB(), heads = new MB(), halos = new MB(), bulbG = [0, 1, 2, 3, 4, 5].map(() => new MB()), chains = [], PC = [0, 58], PR = 14.4, h = 4.6;
    const post = (m, x, z) => { m.cyl(x, z, 0, h, .1, .07, 8, [.2, .18, .3]); m.cyl(x, z, 0, .4, .22, .15, 8, [.2, .18, .3]); };
    const lamp = (x, z, own) => { if (own) occ(() => { const m = new MB(); post(m, x, z); add(m, {}); const hd = new MB(); hd.sphere(x, h + .15, z, .32, .32, .32, [1, 1, 1], 8); add(hd, emS('#fff0c8', .35, 2.2)); }); else { post(poles, x, z); heads.sphere(x, h + .15, z, .32, .32, .32, [1, 1, 1], 8); }
      hl(halos, x, h + .15, z, 3.6, [1, .8, .45]); obs(x - .22, z - .22, x + .22, z + .22); S.lamps.push([x, z]); return [x, z, h]; };
    const ring = []; for (let k = 0; k < 13; k++) { const an = (62 + k * (236 / 12)) * Math.PI / 180; ring.push(lamp(PC[0] + PR * Math.sin(an), PC[1] - PR * Math.cos(an), true)); } chains.push(ring);   // 圆外沿: 每盏单独成批, 挡在镜头和人物之间时会淡出
    const lk = [], N = 16; for (let i = 0; i < N; i++) { const an = -.25 + i * (Math.PI + .5) / (N - 1), x = (LRX + 10) * Math.cos(an), z = LC[1] + (LRZ + 10) * Math.sin(an); if (Math.hypot(x - PC[0], z - PC[1]) < PR + 6) continue; lk.push(lamp(x, z, false)); } chains.push(lk);
    [[-30, 66], [30, 66]].forEach(([x, z]) => lamp(x, z, false));
    add(poles, {}); add(heads, emS('#fff0c8', .35, 2.2)); add(halos, { tex: T.glow, mode: 2, glow: e => e.night * .8 + .06 });
    chains.forEach((ch, ci) => { for (let i = 0; i + 1 < ch.length; i++) { const p0 = ch[i], p1 = ch[i + 1]; if (Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) > 16) continue; for (let k = 1; k < 12; k++) { const t = k / 12, x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t, y = h - Math.sin(t * Math.PI) * .7; bulbG[(k + i * 2 + ci) % 6].box(x - .05, y - .05, z - .05, x + .05, y + .05, z + .05, [.12, .1, .05]); } } });
    bulbG.forEach((g, i) => addTw(g, ['#ffe2a0', '#fff4dc', '#ffd27a', '#ffeccf', '#ffc9a0', '#fff0c0'][i], i * 1.1, 2.2 + i * .55)); }

  /* ---- 棕榈 / 雨树 / 长椅 / 观景台 / 合影点 / 小摊 ---- */
  [-60, -50, -40, -30, 30, 40, 50, 60].forEach((x, i) => K.palm(x, 58 + (i % 2) * 2, 9 + (i % 3), (i % 2 ? 1 : -1) * .05));
  [-52, -44, -36, -28, -20, 20, 28, 36, 44, 52].forEach((x, i) => K.palm(x, .6, 8.5 + (i % 2), (i % 2 ? 1 : -1) * .04));
  K.tree(-64, 68, 1.7); K.tree(54, 79, 1.6); K.tree(-68, 28, 1.5); K.tree(68, 46, 1.4); K.tree(-66, 8, 1.4);
  [-40, -31, -22, 22, 31, 40].forEach(x => K.bench(x, 54.6, Math.PI));
  { signAt('音乐喷泉秀', { w: 512, h: 110, fs: 62, bg: '#10243a', fg: '#e6f6ff', border: '#7fd8ff' }, 5.2, 58, 0, .9, 2.0, 3.8, .7, 1.3); const sp = new MB(); [3.4, 7].forEach(x => rbox(sp, x, 57.9, .14, .14, 0, 1, 0, [.3, .3, .36])); add(sp, {}); obs(3.2, 57.5, 7.2, 58.5);
    S.hotspots.push({ id: 'show', x: 0, z: 58, r: 2.0, label: '音乐喷泉秀', icon: '🌈', color: [.6, .8, 1] }); }
  { const nb = occ0(); signAt('KLCC · 双子塔合影点', { w: 512, h: 200, fs: 46, bg: '#1a1a3a', fg: '#ffe9b8', border: '#ff9a5a' }, -26, 51, 0, 1.3, 3.7, 5.4, .8, 1.3); const pl = new MB(); [-2.5, 2.5].forEach(dx => rbox(pl, -26 + dx, 50.9, .16, .16, 0, 1.4, 0, [.3, .26, .3])); add(pl, {}); occ1(nb); obs(-29, 50.4, -23, 51.6);
    S.hotspots.push({ id: 'photo', x: -26, z: 54.2, r: 2.0, label: '合影', icon: '📸', color: [1, .6, .5] }); }
  { const nc = occ0(), cm = new MB(); rbox(cm, 28, 52, 2.6, 1.4, 0, 1.1, 0, [.78, .52, .3]); rbox(cm, 28, 52, 2.7, 1.5, 1.1, 1.2, 0, [.95, .93, .9]); cm.cyl(28, 52, 1.2, 3.0, .06, .06, 6, [.3, .26, .24]); cm.cyl(28, 52, 2.6, 3.2, 2.0, .15, 12, [.95, .45, .6], true); add(cm, {}); signAt('CENDOL 煎蕊', { w: 512, h: 120, fs: 56, bg: '#1d3a12', fg: '#f6f08a', border: '#8fd14f' }, 28, 51.3, 0, 1.3, 2.1, 2.6, .5, 1.5); occ1(nc); obsRot(28, 52, 3, 1.8, 0);
    S.hotspots.push({ id: 'cendol', x: 28, z: 54.3, r: 2.0, label: '煎蕊摊', icon: '🍧', color: [.7, 1, .5] }); }

  /* ---- 人行天桥 (通往 Pavilion / Bukit Bintang) ---- */
  { const sx = -58, sz = 61; occ(() => { const eb = new MB(); rbox(eb, sx, sz, 9, 7, 0, 7.5, 0, [1, 1, 1], [16, 11]); add(eb, { tex: X.wing.tex, em: X.wing.em, emDay: .25, emNight: 1.0 });
      const dg = new MB(); dg.quad([sx - 2.5, .1, sz + 3.55], [sx + 2.5, .1, sz + 3.55], [sx + 2.5, 4.4, sz + 3.55], [sx - 2.5, 4.4, sz + 3.55], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); add(dg, { tex: X.atrium.tex, em: X.atrium.em, emDay: .5, emNight: 1.1 });
      signAt('人行天桥 SKYBRIDGE', { w: 512, h: 110, fs: 46, bg: '#12304a', fg: '#e6f6ff', border: '#5cc8ff' }, sx, sz + 3.6, 0, 5.2, 6.9, 8.4, .6, 1.3);
      const bb = new MB(); rbox(bb, -108, sz, 100, 3.6, 6.2, 9.4, 0, [1, 1, 1], [16, 3.2]); add(bb, { tex: X.wing.tex, em: X.wing.em, emDay: .25, emNight: 1.0 }); const pl = new MB(); for (let x = -70; x > -150; x -= 14) pl.cyl(x, sz, 0, 6.2, .6, .6, 10, [.76, .76, .8]); add(pl, {}); });
    obsRot(sx, sz, 9, 7, 0); if (G.Scenes.makeBukit) S.portals.push({ id: 'to_bukit', to: 'bukit', x: sx, z: sz + 7, r: 2.0, label: 'Pavilion · Bukit Bintang', color: [.5, .8, 1] }); }

  /* ---- 空中单轨: 两条高架线 (右线经车站并向中间收拢; 左线绕过来并横跨人行天桥); 列车由 S.dyn / S.drawSolid 动态绘制 ---- */
  const mkLine = (cp) => { const g = (i) => cp[Math.max(0, Math.min(cp.length - 1, i))], Pt = [];
    for (let i = 0; i < cp.length - 1; i++) for (let k = 0; k < 8; k++) { const t = k / 8, p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2); Pt.push([0, 1].map(j => .5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t))); }
    Pt.push(cp[cp.length - 1]); const Lc = [0]; for (let i = 1; i < Pt.length; i++) Lc.push(Lc[i - 1] + Math.hypot(Pt[i][0] - Pt[i - 1][0], Pt[i][1] - Pt[i - 1][1]));
    const at = (s) => { s = Math.max(0, Math.min(Lc[Lc.length - 1] - .01, s)); let i = 1; while (i < Lc.length - 1 && Lc[i] < s) i++; const u = (s - Lc[i - 1]) / (Lc[i] - Lc[i - 1] || 1), a = Pt[i - 1], b = Pt[i]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(-(b[1] - a[1]), b[0] - a[0])]; };
    return { Pt, Lc, Ltot: Lc[Lc.length - 1], at }; };
  const lines = [mkLine([[112, -72], [92, -38], [70, -8], [54, 14], [50, 32], [54, 48], [66, 60], [66, 84], [66, 125]]), mkLine([[-112, -72], [-92, -38], [-72, -8], [-56, 14], [-52, 32], [-56, 46], [-70, 54], [-96, 62], [-130, 70]])];
  S.ads = []; S.monoLines = lines;                                                    // S.ads: 夜晚发亮并轻微呼吸闪烁的广告牌批次
  const BC = [.7, .7, .73], BC2 = [.79, .79, .82];
  lines.forEach((L, li) => { const pm = new Map(); let pk = 0; for (let sp = 16 + li * 9; sp < L.Ltot - 6; sp += 26) { let i = 1; while (i < L.Lc.length - 1 && L.Lc[i] < sp) i++; pm.set(i - 1, [sp, pk++]); }   // 立柱约每 26 米一根
    for (let g0 = 0; g0 + 1 < L.Pt.length; g0 += 4) occ(() => { const bm = new MB(), adm = {};
      for (let i = g0; i < Math.min(g0 + 4, L.Pt.length - 1); i++) { const a = L.Pt[i], b = L.Pt[i + 1], cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
        rbox(bm, cx, cz, len + .5, 1.3, 10.8, 12.15, yaw, BC); rbox(bm, cx, cz, len + .5, 2.3, 12.15, 12.5, yaw, BC2);                       // T 形梁: 腹板 + 顶板
        const pi = pm.get(i); if (pi) { const u = (pi[0] - L.Lc[i]) / (L.Lc[i + 1] - L.Lc[i]), px = a[0] + (b[0] - a[0]) * u, pz = a[1] + (b[1] - a[1]) * u;
          if (!(pz > 57 && pz < 65 && px < -56)) { rbox(bm, px, pz, 2.2, 3.0, 0, .5, yaw, BC2); rbox(bm, px, pz, 1.5, 2.1, .5, 10.3, yaw, BC); rbox(bm, px, pz, 2.4, 3.8, 10.3, 10.8, yaw, BC2);   // 长方形立柱 + 底座 + 盖梁
            if (px < 72 && px > -72 && pz > -4) obsRot(px, pz, 2.2, 3.0, yaw);
            if (pi[1] % 3 === 1) { const ai = (pi[1] + li * 2) % X.ads.length, m = adm[ai] || (adm[ai] = new MB());                                  // 每三根立柱挂一块灯箱广告 (两侧)
              [1, -1].forEach(sg => rbox(m, px + Math.sin(yaw) * sg * 1.12, pz + Math.cos(yaw) * sg * 1.12, 1.8, .1, 3.6, 6.6, sg > 0 ? yaw : yaw + Math.PI, [1, 1, 1], [1.8, 3.0], { noBack: true, noSides: true, noTop: true })); } } } }
      add(bm, {}); Object.keys(adm).forEach(k => { const ad = X.ads[k].P, bt = add(adm[k], { tex: ad.tex, em: ad.em, emDay: .3, emNight: 1.3 }); if (bt) S.ads.push(bt); }); }); });
  occ(() => { const st = new MB(); rbox(st, 58, 72, 22, 8, 0, 9, Math.PI / 2, [1, 1, 1], [16, 11]); add(st, { tex: X.wing.tex, em: X.wing.em, emDay: .25, emNight: 1.0 });
    const pf = new MB(); rbox(pf, 62.5, 72, 26, 5, 9, 12.3, Math.PI / 2, [.8, .8, .84]); rbox(pf, 63, 72, 28, 8, 15.2, 15.6, Math.PI / 2, [.85, .2, .25]); [62, 82].forEach(z => pf.cyl(61, z, 12.3, 15.2, .15, .15, 6, [.3, .3, .34])); [62, 72, 82].forEach(z => pf.cyl(63, z, 0, 9, .5, .5, 10, [.76, .76, .8])); add(pf, {});
    signAt('KLCC 单轨站 MONORAIL', { w: 512, h: 120, fs: 48, bg: '#8a1018', fg: '#ffffff', border: '#ffd0d4' }, 53.9, 72, -Math.PI / 2, 4.6, 7.2, 14, .6, 1.3); });
  obsRot(58, 72, 22, 8, Math.PI / 2); [62, 72, 82].forEach(z => obs(62.5, z - .6, 63.5, z + .6));
  if (G.Scenes.makeBukit) S.portals.push({ id: 'monorail_k', to: 'bukit', x: 49, z: 70, r: 2.0, label: '单轨 · Bukit Bintang 站', color: [1, .35, .4] });

  const adBoard = (x, z, yaw, w, h, y0, ai) => occ(() => { const fm = new MB(), sm = new MB(), c = Math.cos(yaw), s2 = Math.sin(yaw);        // 轨道旁的大型 LED 广告牌
    [-1, 1].forEach(sg => { const px = x + c * sg * (w / 2 - .8), pz = z - s2 * sg * (w / 2 - .8); rbox(fm, px, pz, .5, .5, 0, y0 + h * .2, yaw, [.3, .3, .34]); obs(px - .4, pz - .4, px + .4, pz + .4); });
    rbox(fm, x, z, w + .7, .45, y0 - .35, y0 + h + .35, yaw, [.18, .18, .2]); rbox(sm, x + s2 * .26, z + c * .26, w, .05, y0, y0 + h, yaw, [1, 1, 1], [w, h], { noBack: true, noSides: true, noTop: true });
    add(fm, {}); const ad = X.ads[ai].L, bt = add(sm, { tex: ad.tex, em: ad.em, emDay: .35, emNight: 1.5 }); if (bt) S.ads.push(bt); });
  adBoard(63, 16, -.5, 12, 6, 9, 0); adBoard(-62, 18, .5, 12, 6, 9, 3); adBoard(65, 32, -.4, 10, 5, 8, 4); adBoard(-66, 46, .4, 10, 5, 8, 6);
  const lightbox = (x, z, ai) => occ(() => { const fm = new MB(), sm = new MB(); rbox(fm, x, z, 1.9, .3, .6, 3.4, 0, [.18, .18, .2]); [-.8, .8].forEach(dx => rbox(fm, x + dx, z, .12, .12, 0, .6, 0, [.3, .3, .34]));        // 步道灯箱 (正反两面)
    [1, -1].forEach(sg => rbox(sm, x, z + sg * .17, 1.7, .05, .75, 3.3, sg > 0 ? 0 : Math.PI, [1, 1, 1], [1.7, 2.55], { noBack: true, noSides: true, noTop: true })); add(fm, {});
    const ad = X.ads[ai].P, bt = add(sm, { tex: ad.tex, em: ad.em, emDay: .3, emNight: 1.3 }); if (bt) S.ads.push(bt); obs(x - 1, z - .3, x + 1, z + .3); });
  lightbox(-44, 62, 1); lightbox(44, 62, 2); lightbox(-52, 46, 5); lightbox(52, 46, 0);

  add(gl, { tex: T.glow, mode: 2, glow: e => e.night * .75 });

  /* ---- 互动 (由 game.js 的 hotAct 调用 S.onUse) ---- */
  S.onUse = (n, api) => {
    switch (n.id) {
      case 'show': S.boost = api.G.t + 20; api.toast('🌈 音乐喷泉秀开始！', 2600); return true;
      case 'photo': api.G.me.pose = 3; api.setBubble(api.G.me, '✌ 双子塔！'); api.toast('📸 咔嚓！背景是双子塔（演示）', 2400); return true;
      case 'cendol': if (api.pay) api.pay(12, '🍧 煎蕊 Cendol：椰奶、红豆、班兰！-12 金币', '好清凉！'); else api.toast('🍧 煎蕊 Cendol：椰奶、红豆、班兰！', 2400); return true;
      case 'suria': api.toast('🛍 Suria KLCC 商场室内：下一个场景，开发中', 2600); return true;
    }
    return false;
  };

  /* ---- 动态效果 (引擎接口 S.dyn / S.dynPool; 可选 S.drawSolid 画实心列车): 彩虹音乐喷泉 + 水面倒影 + 两条线的单轨列车 + 灯串闪烁 ---- */
  { const jets = [];
    for (let i = 0; i < 17; i++) { const a = -1.25 + i * 2.5 / 16; jets.push({ x: 34 * Math.sin(a), z: 36 - 10 * (1 - Math.cos(a)), H: 9, k: i / 16, row: 0 }); }
    for (let i = 0; i < 13; i++) { const a = -1.2 + i * 2.4 / 12; jets.push({ x: 26 * Math.sin(a), z: 27 - 6 * (1 - Math.cos(a)), H: 7, k: i / 12, row: 1 }); }
    for (let i = 0; i < 14; i++) jets.push({ x: -27 + i * 54 / 13, z: 13, H: 4.5, k: i / 13, row: 2 });
    const hgt = (j, i, t) => { const boost = t < S.boost, mode = Math.floor(t / 22) % 3; let a; if (boost) a = .85 + .15 * Math.sin(t * 6 + i); else if (mode === 0) a = .55 + .45 * Math.sin(t * 1.7 - j.k * 4.2 - j.row); else if (mode === 1) a = .25 + .75 * (.5 + .5 * Math.sin(t * 2.4 + (i % 2) * Math.PI + j.row)); else a = .5 + .5 * Math.sin(t * 2 - Math.abs(j.k - .5) * 9); return Math.max(.4, j.H * a); };
    const colOf = (j, t) => hsv(j.k * .9 + t * .07 + j.row * .15, .8, 1);
    const sp = [], r0 = rnd(17); for (let i = 0; i < 44; i++) { const a = r0() * TAU, d = Math.sqrt(r0()) * .92; sp.push([LC[0] + Math.cos(a) * LRX * d, LC[1] + Math.sin(a) * LRZ * d, r0() * 6.28, 1.4 + r0() * 2.2]); }
    const tbP = new MB(), tbT = new MB(), tw2 = new MB(), tw3 = new MB(), clr = (m) => { m.v.length = 0; m.i.length = 0; m.n = 0; }, warmEm = solid(255, 236, 190), redEm = solid(255, 40, 30);
    const TR = [[lines[0], 0], [lines[1], 10]];                                           // 两条线的列车错开开过 (约每 40 秒一趟)
    const trainOf = (L, t, off) => { const dur = (L.Ltot + 40) / 16, per = dur + 16, ph = (t + off) % per; if (ph >= dur) return null; const sF = ph / dur * (L.Ltot + 40), cl = 7.4, N = 4, cars = [];
      for (let i = 0; i < N; i++) { const sc = sF - i * (cl + .62) - cl / 2; if (sc >= 0 && sc <= L.Ltot) { const [x, z, yaw] = L.at(sc); cars.push({ x, z, yaw, cl, s: sc, kind: i === 0 ? 'front' : i === N - 1 ? 'rear' : 'mid' }); } } return { cars, sF, L }; };
    // 车厢: 沿车长放样的圆润截面 (车头/车尾逐级收窄压低), 侧面贴涂装贴图, 车头有挡风玻璃与灯
    const PROF = [[-1.2, 0], [1.2, 0], [1.38, .7], [1.38, 2.3], [1.1, 3.0], [-1.1, 3.0], [-1.38, 2.3], [-1.38, .7]], Y0 = 11.9;
    const car = (x, z, yaw, len, kind) => {
      const c = Math.cos(yaw), s2 = Math.sin(yaw), Pw = (p) => [x + p[0] * c + p[2] * s2, p[1], z - p[0] * s2 + p[2] * c], Nw = (n) => [n[0] * c + n[2] * s2, n[1], -n[0] * s2 + n[2] * c], h = len / 2;
      const CS = kind === 'front' ? [[-h, 1, 1, 0], [h - 1.7, 1, 1, 0], [h - .8, .93, .96, .05], [h, .72, .8, .3]] : kind === 'rear' ? [[-h, .72, .8, .3], [-h + .8, .93, .96, .05], [-h + 1.7, 1, 1, 0], [h, 1, 1, 0]] : [[-h, 1, 1, 0], [h, 1, 1, 0]];
      const secs = CS.map(([lx, wz, hy, lift]) => PROF.map(([pz, py]) => [lx, Y0 + lift + py * hy, pz * wz]));
      const tri = (mb, A, B, C, uv, col, n) => { const nw = Nw(n), i0 = mb.vert(Pw(A), nw, uv[0][0], uv[0][1], col), i1 = mb.vert(Pw(B), nw, uv[1][0], uv[1][1], col), i2 = mb.vert(Pw(C), nw, uv[2][0], uv[2][1], col); mb.i.push(i0, i1, i2); };
      for (let k = 0; k + 1 < secs.length; k++) for (let e = 0; e < 8; e++) { const A0 = secs[k][e], B0 = secs[k][(e + 1) % 8], A1 = secs[k + 1][e], B1 = secs[k + 1][(e + 1) % 8];
        const u1 = [A1[0] - A0[0], A1[1] - A0[1], A1[2] - A0[2]], u2 = [B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]]; let n = [u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]]; const nl = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(v => v / nl);
        if (n[1] * ((A0[1] + B1[1]) / 2 - (Y0 + 1.5)) + n[2] * ((A0[2] + B1[2]) / 2) < 0) n = n.map(v => -v);
        const tex = e !== 0 && e !== 4, flip = e >= 5, uv = (P) => [flip ? 1 - (P[0] + h) / len : (P[0] + h) / len, (Y0 + 3.0 - P[1]) / 3.0], mb = tex ? tbT : tbP, col = tex ? [1, 1, 1] : (e === 4 ? [.93, .94, .97] : [.18, .18, .2]);
        tri(mb, A0, B0, B1, [uv(A0), uv(B0), uv(B1)], col, n); tri(mb, A0, B1, A1, [uv(A0), uv(B1), uv(A1)], col, n); }
      if (kind !== 'mid') { const [lx, wz, hy, lift] = kind === 'front' ? CS[CS.length - 1] : CS[0], d = kind === 'front' ? 1 : -1, yb = Y0 + lift + .1, ym = Y0 + lift + 1.5 * hy, yt = Y0 + lift + 2.9 * hy, nr = [d, 0, 0], z0 = [[0, 0], [0, 0], [0, 0]];
        const q4 = (mb, a, b2, c2, d2, col) => { tri(mb, a, b2, c2, z0, col, nr); tri(mb, a, c2, d2, z0, col, nr); };
        q4(tbP, [lx, yb, -1.2 * wz], [lx, yb, 1.2 * wz], [lx, ym, 1.38 * wz], [lx, ym, -1.38 * wz], [.95, .95, .97]); q4(tbP, [lx, ym - .28, -1.38 * wz], [lx, ym - .28, 1.38 * wz], [lx, ym, 1.38 * wz], [lx, ym, -1.38 * wz], [.82, .1, .14]);
        q4(tbP, [lx, ym, -1.38 * wz], [lx, ym, 1.38 * wz], [lx, yt, 1.1 * wz], [lx, yt, -1.1 * wz], [.06, .09, .15]);
        [-.85, .85].forEach(zz => q4(kind === 'front' ? tw2 : tw3, [lx + .02 * d, ym - .75, zz * wz - .22], [lx + .02 * d, ym - .75, zz * wz + .22], [lx + .02 * d, ym - .5, zz * wz + .22], [lx + .02 * d, ym - .5, zz * wz - .22], [.1, .1, .1])); } };
    S.boost = 0; S._solidT = -9;
    S.dyn = (fx, t, g, env) => {
      const p = g && g.cam ? g.cam.pitch : .46, c = Math.cos(p), sn = Math.sin(p), nt = env.night;
      for (const ab of S.ads) { ab.mat.emNight = 1.25 + .3 * Math.sin(t * 1.3 + (ab.bb ? ab.bb[0][0] : 0) * .37); }                                                                   // 广告牌: 轻微呼吸闪烁
      for (const o of S.tw) { const v = .5 + .3 * Math.sin(t * o.f + o.ph) + .2 * Math.sin(t * o.f * 2.71 + o.ph * 1.7); o.b.mat.emNight = .08 + 2.7 * v * v * v; }   // 灯串/彩灯: 两个不成比例的频率叠加 => 不规律闪烁
      const dot = (mb, x, y, z, w, hh, col) => { const P = (a, b) => [x + a * w, y + c * b * hh, z - sn * b * hh]; mb.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [0, 1, 0], [0, 0, 1, 1], col); };
      jets.forEach((j, i) => { const h = hgt(j, i, t), col = colOf(j, t), N = 9;
        for (let q = 0; q < N; q++) dot(fx.spray, j.x, h * (q + .5) / N, j.z, .3 + .1 * (1 - q / N), Math.max(.3, h / N * .8), col);
        for (let q = 0; q < 3; q++) { const u = fr(t * 1.4 + q / 3 + i * .13), dir = q % 2 ? 1 : -1; dot(fx.spray, j.x + dir * 1.3 * u, h + 1.6 * u - 3.2 * u * u, j.z, .22, .3, col); } });
      for (const [x, y, z, ph, f] of treeSpark) { const v = Math.pow(Math.max(0, Math.sin(t * f + ph)), 8); if (v > .08) dot(fx.spark, x, y, z, .5 * v + .08, .5 * v + .08, [1, .92, .7].map(c => c * (.35 + .9 * nt))); }     // 圣诞树星芒
      for (const [x, z, ph, f] of sp) { const v = Math.max(0, Math.sin(t * f + ph)); if (v > .1) dot(fx.spark, x, .55, z, .22 * v, .22 * v, [.85, .95, 1]); }          // 水面闪光
      TR.forEach(([L, off]) => { const tr = trainOf(L, t, off); if (!tr) return; const solid2 = S._solidT > t - .6;
        tr.cars.forEach((cr) => { const dx = Math.cos(cr.yaw), dz = -Math.sin(cr.yaw);
          if (!solid2) { dot(fx.spray, cr.x, 13.4, cr.z, 3.3, 1.5, [.42, .42, .5]); dot(fx.spray, cr.x, 12.8, cr.z, 3.6, .35, [.7, .08, .12]); }
          dot(fx.spray, cr.x, 13.4, cr.z, 6.4, 3.8, [.5, .4, .18].map(v => v * (.12 + .95 * nt)));                                    // 夜晚: 整节车厢外圈泛光
          for (let q = -2; q <= 2; q++) dot(fx.spray, cr.x + dx * q * 1.35, 13.9, cr.z + dz * q * 1.35, .5, .42, [1, .88, .55].map(v => v * (.4 + .5 * nt))); });
        if (tr.cars.length) { const f = tr.cars[0], l = tr.cars[tr.cars.length - 1], dx = Math.cos(f.yaw), dz = -Math.sin(f.yaw), px = Math.sin(f.yaw), pz = Math.cos(f.yaw), hx = f.x + dx * 3.9, hz = f.z + dz * 3.9, bl = [1, .95, .72].map(v => v * (.18 + .75 * nt));
          dot(fx.spray, hx, 13.0, hz, 1.9, 1.9, [1, .95, .75].map(v => v * (.5 + .7 * nt)));                                       // 车头灯
          fx.spray.quad([hx + px * .7, 12.9, hz + pz * .7], [hx - px * .7, 12.9, hz - pz * .7], [hx + dx * 22 - px * 3.6, 11.2, hz + dz * 22 - pz * 3.6], [hx + dx * 22 + px * 3.6, 11.2, hz + dz * 22 + pz * 3.6], [0, 1, 0], [0, 0, 1, 1], bl);   // 前照灯光束
          dot(fx.spray, l.x - Math.cos(l.yaw) * 3.9, 13.0, l.z + Math.sin(l.yaw) * 3.9, .9, .9, [1, .12, .1].map(v => v * (.4 + .8 * nt))); } });                  // 车尾红灯
      fx.glow = { spray: 1, beam: 0, spark: .85 };
    };
    S.dynPool = (mb, g, env, t) => {
      jets.forEach((j, i) => { const h = hgt(j, i, t), col = colOf(j, t); mb.floor(j.x - 1.2, j.z - 1.2, j.x + 1.2, j.z + 1.2, .37, col.map(v => v * .5));
        const zEnd = Math.min(j.z + .5 + h * .9, edgeZ(j.x) - .8); if (zEnd > j.z + .6) mb.floor(j.x - .45, j.z + .3, j.x + .45, zEnd, .37, col.map(v => v * .26)); });
      for (let i = 0; i < 25; i++) { const x = -24 + i * 2, f = .5 + .5 * Math.sin(t * 1.5 + i * 1.7), z0 = LC[1] - LRZ * Math.sqrt(1 - (x / LRX) * (x / LRX)) + .4; mb.floor(x - .5, z0, x + .5, z0 + 6 + 5 * f, .37, i % 3 === 0 ? [.4 * f, .18 * f, .3 * f] : [.42 * f, .3 * f, .12 * f]); }
      const nt = env && env.night != null ? env.night : 0; if (nt > .05) TR.forEach(([L, off]) => { const tr = trainOf(L, t, off); if (tr) tr.cars.forEach(cr => mb.floor(cr.x - 6, cr.z - 6, cr.x + 6, cr.z + 6, .045, [.55 * nt, .42 * nt, .2 * nt])); });   // 夜晚列车经过时照亮地面
    };
    S.drawSolid = (Rr, t, g) => {                                                                                             // 可选: 引擎若提供 sc.drawSolid 钩子, 画实心列车
      S._solidT = t; [tbP, tbT, tw2, tw3].forEach(clr);
      TR.forEach(([L, off]) => { const tr = trainOf(L, t, off); if (!tr) return; tr.cars.forEach(cr => car(cr.x, cr.z, cr.yaw, cr.cl, cr.kind));
        for (let i = 0; i + 1 < tr.cars.length; i++) { const [mx, mz, my] = L.at((tr.cars[i].s + tr.cars[i + 1].s) / 2); rbox(tbP, mx, mz, .66, 2.5, Y0 + .35, Y0 + 2.75, my, [.1, .1, .12]); } });      // 车厢连接处
      Rr.drawDynamic(tbP, {}); Rr.drawDynamic(tbT, { tex: X.train.tex, em: X.train.em, emDay: .45, emNight: 2.0 }); Rr.drawDynamic(tw2, { em: warmEm, emDay: .6, emNight: 2.6 }); Rr.drawDynamic(tw3, { em: redEm, emDay: .6, emNight: 2.4 });
    }; }

  // 游戏时间 -> 文字. 以后做节日倒数, 只改这一个函数即可 (g.hour 是游戏小时, 0~24 的小数)
  S.clockText = (g) => { const p = (n) => String(n).padStart(2, '0'), h = ((g.hour % 24) + 24) % 24; return p(Math.floor(h)) + ':' + p(Math.floor((h % 1) * 60)) + ':' + p(Math.floor((h * 3600) % 60)); };
  S.update = (g, dt) => { S._ca = (S._ca || 0) + dt; if (S._ca < .1) return; S._ca = 0; const txt = S.clockText(g); if (txt !== clockLast) { clockLast = txt; drawClock(txt); } };
  S.bounds = { x0: -72, x1: 72, z0: -4, z1: 78 }; S.spawn = [0, 64];
  S.walkable = (x, z) => Math.pow(Math.abs(x / 72), 3) + Math.pow(Math.abs((z - 37) / 41), 3) <= 1;      // 不规则可走区域 (超椭圆)
  S.camera = { dist: 24, pitch: .46, fov: .72, clampX: [-60, 60], clampZ: [4, 70], lead: 4 };          // 原版斜俯视 (与广场同参数)
  S.cameraWide = { dist: 19, pitch: .16, fov: 1.28 };                                                   // 广角: 镜头压低, 看得到双子塔与天际线
  S.npcRect = { x0: -62, x1: 62, z0: -2, z1: 74 }; S.heightAt = () => 0; S.name = 'KLCC · 双子塔'; S.indoor = false;
  S.env = h => { const e = G.World.envAt(h); e.fogNear = 160; e.fogFar = 340; return e; };
  return S;
}
G.Scenes.makeKlcc = makeKlcc;
})(window);
