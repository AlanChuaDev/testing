/* songkiosk.js — 点歌机（概念稿 3 款，面朝 +z）
   Kiosk.arcade(K,x,z)  A 霓虹街机式点歌机   Kiosk.pillar(K,x,z) B 玻璃触屏点歌柱   Kiosk.jukebox(K,x,z) C 复古点唱机
   K = KTV.kit(R,T)（需要 R T S add occ obs emMat halo glowMat night） */
(function (G) {
'use strict';
const { MB } = G.World;
const PITCH = 0.46;
const GOLD = [.93, .76, .36], DARK = [.12, .1, .18], PUR = [.2, .15, .34], WHITE = [1, 1, 1];

/* 点歌界面（屏幕贴图）：顶部标签、搜索条、歌曲卡片、底部已点 */
function uiTex(R, o) {
  o = o || {}; const A = o.a || '#ff5fc8', B = o.b || '#6fd8ff', bg0 = o.bg0 || '#1b0c36', bg1 = o.bg1 || '#3a1370', W = o.w || 512, H = o.h || 640;
  return R.paint(W, H, g => {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, bg0); gr.addColorStop(1, bg1); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 12; i++) g.fillRect(0, i * H / 12, W, 2);
    g.textBaseline = 'middle'; const F = (w, s) => `${w} ${s}px "Arial Black","PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`;
    g.fillStyle = A; g.fillRect(0, 0, W, 78); g.fillStyle = '#fff'; g.font = F(800, 40); g.textAlign = 'left'; g.fillText('♪ 点歌台  SONGS', 24, 40); g.textAlign = 'right'; g.font = F(700, 24); g.fillText('已点 3 首', W - 24, 40);
    const tabs = ['热门', '新歌', '国语', '英文', '粤语', '合唱']; tabs.forEach((t, i) => { const x = 18 + i * ((W - 36) / 6), w = (W - 36) / 6 - 8; g.fillStyle = i === 0 ? B : 'rgba(255,255,255,.14)'; g.beginPath(); g.roundRect(x, 92, w, 40, 20); g.fill(); g.fillStyle = i === 0 ? '#0b1a33' : '#fff'; g.font = F(700, 22); g.textAlign = 'center'; g.fillText(t, x + w / 2, 113); });
    g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.roundRect(18, 146, W - 36, 44, 22); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.font = F(600, 22); g.textAlign = 'left'; g.fillText('🔍  搜索歌名 / 歌手 / 拼音首字母', 40, 168);
    const songs = [['夜空中最亮的星', '逃跑计划'], ['Shape of You', 'Ed Sheeran'], ['告白气球', '周杰伦'], ['月亮代表我的心', '邓丽君'], ['Perfect', 'Ed Sheeran'], ['小幸运', '田馥甄']];
    songs.forEach(([n, a], i) => { const y = 206 + i * 66, hue = (i * 53 + 300) % 360; g.fillStyle = 'rgba(255,255,255,.09)'; g.beginPath(); g.roundRect(18, y, W - 36, 58, 14); g.fill(); g.fillStyle = `hsl(${hue},80%,60%)`; g.beginPath(); g.roundRect(28, y + 7, 44, 44, 10); g.fill();
      g.fillStyle = '#fff'; g.font = F(800, 26); g.textAlign = 'left'; g.fillText(n, 86, y + 21); g.fillStyle = 'rgba(255,255,255,.65)'; g.font = F(600, 20); g.fillText(a, 86, y + 43); g.fillStyle = i === 1 ? '#ffd54a' : A; g.beginPath(); g.roundRect(W - 112, y + 12, 86, 34, 17); g.fill(); g.fillStyle = i === 1 ? '#3a2a00' : '#fff'; g.font = F(800, 20); g.textAlign = 'center'; g.fillText(i === 1 ? '已点' : '点歌', W - 69, y + 30); });
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, H - 56, W, 56); g.fillStyle = B; g.font = F(700, 22); g.textAlign = 'left'; g.fillText('NEXT ▸ Danny《告白气球》', 22, H - 28); g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText('排队 3 人', W - 22, H - 28);
  }, { clamp: true });
}

function mk(K, x, z) {
  const { R, T, S, add, occ, obs, emMat, halo, glowMat, night } = K, HL = new MB(), PL = new MB();
  const box = (mb, x0, y0, z0, x1, y1, z1, c, t, o) => mb.box(x + x0, y0, z + z0, x + x1, y1, z + z1, c, t, o);
  const cyl = (mb, dx, dz, y0, y1, r0, r1, seg, c, cap) => mb.cyl(x + dx, z + dz, y0, y1, r0, r1, seg, c, cap);
  const sph = (mb, dx, y, dz, rx, ry, rz, c, seg) => mb.sphere(x + dx, y, z + dz, rx, ry, rz, c, seg || 8);
  const wallQ = (mb, x0, y0, x1, y1, dz, c, uv) => mb.wall(x + x0, y0, x + x1, y1, z + dz, c || WHITE, uv);
  const glow = (mb, dx, y, dz, s, col) => halo(mb, x + dx, y, z + dz, s, col);
  const pool = (dx, dz, r, col) => PL.floor(x + dx - r, z + dz - r, x + dx + r, z + dz + r, .035, col);
  const ui = (w, h, o) => uiTex(R, Object.assign({ w, h }, o));
  const mic = (mb, dx, dz, y, tilt) => { cyl(mb, dx, dz, y, y + .02, .05, .05, 6, GOLD, true); cyl(mb, dx, dz, y, y + .38, .018, .018, 6, [.75, .75, .8], false); sph(mb, dx, y + .45, dz, .07, .09, .07, [.1, .1, .12], 8); };
  const fin = () => { add(HL, glowMat(night(.55))); add(PL, glowMat(night(.4))); };
  return { obs: (a, b, c, d) => obs(x + a, z + b, x + c, z + d), box, cyl, sph, wallQ, glow, pool, ui, mic, fin, add, emMat, HL, occ, R, T, S, x, z };
}

/* A：霓虹街机式点歌机 —— 梯形机身 + 大触屏 + 操作台（旋钮/按键）+ 顶部灯箱 + 两侧话筒架 */
function arcade(K, x, z) {
  const k = mk(K, x, z), { box, cyl, sph, wallQ, glow, pool, ui, mic, add, emMat, HL } = k; k.obs(-1.35, -.7, 1.35, .75); const A = [1, .35, .78], B = [.42, .85, 1];
  const body = new MB(), trim = new MB(), neonA = new MB(), neonB = new MB(), but = new MB(), grille = new MB(), gl = new MB();
  box(body, -1.25, 0, -.65, 1.25, .28, .65, [.1, .08, .14]); box(trim, -1.3, .26, -.7, 1.3, .34, .7, GOLD);
  box(body, -1.1, .34, -.5, 1.1, 1.18, .5, PUR);                        // 下柜
  box(body, -1.1, 1.18, -.5, 1.1, 3.0, -.1, PUR);                        // 立柱背板
  box(trim, -1.14, .34, .5, 1.14, .4, .54, GOLD); box(trim, -1.14, 1.12, .46, 1.14, 1.18, .54, GOLD);
  // 斜面操作台
  body.quad([x - 1.1, 1.18, z + .5], [x + 1.1, 1.18, z + .5], [x + 1.1, 1.5, z + .1], [x - 1.1, 1.5, z + .1], [0, .7, .7], [0, 0, 1, 1], [.16, .12, .26]);
  // 音箱格栅（下柜正面）
  [-.62, .62].forEach(sx => { const gt = R_grille(K.R); wallQ(grille, sx - .42, .5, sx + .42, 1.05, .52, WHITE); });
  // 按键 + 旋钮
  [[-.72, 0], [-.48, 1], [-.24, 2]].forEach(([bx, i]) => sph(but, bx, 1.33, .28, .075, .05, .075, [[1, .3, .6], [.35, .85, 1], [1, .85, .3]][i], 8));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) box(but, .2 + c * .21, 1.3 + r * .02, .2 - r * .1 + .02, .2 + c * .21 + .15, 1.35 + r * .02, .2 - r * .1 + .14, [.9, .9, .96]);
  cyl(but, -.05, .28, 1.33, 1.43, .1, .09, 14, GOLD, true); cyl(but, -.05, .28, 1.43, 1.45, .07, .07, 14, [1, .3, .6], true);
  // 屏幕 + 边框
  box(body, -1.0, 1.52, -.12, 1.0, 2.9, .0, [.05, .04, .08]); box(trim, -1.04, 1.5, -.14, 1.04, 1.56, .02, GOLD); box(trim, -1.04, 2.86, -.14, 1.04, 2.92, .02, GOLD); box(trim, -1.04, 1.5, -.14, -.98, 2.92, .02, GOLD); box(trim, .98, 1.5, -.14, 1.04, 2.92, .02, GOLD);
  const scr = new MB(); wallQ(scr, -.92, 1.6, .92, 2.82, .03, WHITE);
  // 顶部灯箱
  box(body, -1.25, 3.0, -.55, 1.25, 3.62, .35, [.1, .08, .14]); box(trim, -1.3, 3.0, -.6, 1.3, 3.06, .4, GOLD); box(trim, -1.3, 3.58, -.6, 1.3, 3.66, .4, GOLD);
  const mq = K.T.sign('♪ 点歌台 SONGS ♪', { w: 768, h: 160, fs: 78, bg: '#1a0830', fg: '#ffe9fb', border: '#ff5fc8' }), mqb = new MB(); wallQ(mqb, -1.15, 3.1, 1.15, 3.54, .37, WHITE);
  // 霓虹灯带
  box(neonA, -1.12, 1.15, .5, 1.12, 1.17, .52, [1, 1, 1]); box(neonA, -1.28, .3, .62, -1.24, 3.6, .66, [1, 1, 1]); box(neonA, 1.24, .3, .62, 1.28, 3.6, .66, [1, 1, 1]);
  box(neonB, -1.12, .45, .52, 1.12, .47, .54, [1, 1, 1]); box(neonB, -1.12, 2.93, .02, 1.12, 2.95, .04, [1, 1, 1]);
  // 侧面话筒架
  [-1, 1].forEach(sd => { box(body, sd * 1.25 - (sd < 0 ? .0 : -.0) - (sd > 0 ? 0 : .3), .9, -.3, sd * 1.25 + (sd > 0 ? .3 : 0), .96, .3, [.16, .12, .26]); box(trim, sd * 1.25 + (sd > 0 ? .3 : -.3) - .02, .9, -.3, sd * 1.25 + (sd > 0 ? .3 : -.3) + .02, 1.2, .3, GOLD); mic(gl, sd * 1.55, 0, .96); });
  // 顶部音符
  sph(gl, 0, 3.95, 0, .13, .13, .13, [1, .85, .95], 8); cyl(gl, .1, 0, 3.95, 4.4, .02, .02, 5, [1, .85, .95], false);
  add(body, {}); add(trim, {}); add(grille, { tex: grilleTex(R_ref(K)) }); add(but, {}); add(gl, {});
  add(scr, { tex: ui(512, 640), em: ui(512, 640), emDay: .55, emNight: .85 }); add(mqb, { tex: mq.tex, em: mq.em, emDay: .45, emNight: .8 });
  add(neonA, emMat(A, .7, 1.5)); add(neonB, emMat(B, .7, 1.5));
  glow(HL, 0, 3.3, .6, 4.2, [1, .55, .85]); glow(HL, 0, 2.2, .5, 3.6, [.6, .5, 1]); glow(HL, -1.55, 1.3, .5, 1.4, [1, .85, .6]); glow(HL, 1.55, 1.3, .5, 1.4, [1, .85, .6]); pool(0, 1.4, 3.2, [1, .45, .8]);
  k.fin();
}
const R_ref = K => K.R;
function R_grille(R) { return null; }
function grilleTex(R) { return R.paint(128, 96, g => { g.fillStyle = '#17112a'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#2d2350'; for (let y = 6; y < 96; y += 12) for (let x = 6 + (y / 12 % 2) * 6; x < 128; x += 12) { g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.fill(); } g.strokeStyle = '#e1b84e'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 92); }); }

/* B：玻璃触屏点歌柱 —— 细长黑玻璃立柱 + 曲面大屏 + 金色圆环灯 + 悬臂话筒 */
function pillar(K, x, z) {
  const k = mk(K, x, z), { box, cyl, sph, wallQ, glow, pool, ui, add, emMat, HL, R } = k; k.obs(-1.5, -.8, 1.5, .8);
  const body = new MB(), trim = new MB(), neon = new MB(), gl = new MB(), scr = new MB(), ring = new MB();
  cyl(body, 0, 0, 0, .12, 1.1, 1.1, 28, [.1, .09, .14], true); cyl(trim, 0, 0, .12, .2, 1.1, 1.1, 28, GOLD, false); cyl(trim, 0, 0, .0, .04, 1.14, 1.14, 28, GOLD, false);
  box(body, -.8, .2, -.32, .8, 1.15, .32, [.08, .07, .12]);                          // 立柱下段
  body.quad([x - .8, 1.15, z + .32], [x + .8, 1.15, z + .32], [x + .8, 1.5, z + .12], [x - .8, 1.5, z + .12], [0, .6, .8], [0, 0, 1, 1], [.1, .09, .16]);
  box(body, -.8, 1.5, -.3, .8, 3.1, .02, [.06, .05, .1]);                            // 屏体
  [[-.75, 1.5, -.74, 3.1], [.74, 1.5, .75, 3.1]].forEach(([a, b, c, d]) => box(trim, a, b, -.32, c, d, .06, GOLD));
  box(trim, -.8, 1.46, -.32, .8, 1.52, .06, GOLD); box(trim, -.8, 3.08, -.32, .8, 3.14, .06, GOLD);
  // 曲面屏：三片微折
  [[-.7, -.24, .06, .1], [-.24, .24, .1, .1], [.24, .7, .1, .06]].forEach(([a, b, za, zb], i) => { const q = new MB(); q.quad([x + a, 1.58, z + za], [x + b, 1.58, z + zb], [x + b, 3.0, z + zb], [x + a, 3.0, z + za], [0, 0, 1], [i / 3, 0, (i + 1) / 3, 1], WHITE); scr.i.length; add(q, { tex: ui(768, 640, { a: '#ffb347', b: '#7cf0c8', bg0: '#08102a', bg1: '#143a66' }), em: ui(768, 640, { a: '#ffb347', b: '#7cf0c8', bg0: '#08102a', bg1: '#143a66' }), emDay: .5, emNight: .8 }); });
  // 顶部圆环灯 + 立体"♪"
  ring.cyl(x, z - .05, 3.3, 3.34, .55, .55, 28, [1, 1, 1], false); ring.cyl(x, z - .05, 3.62, 3.66, .55, .55, 28, [1, 1, 1], false);
  cyl(trim, 0, -.05, 3.14, 3.7, .04, .04, 6, GOLD, false); [-.55, .55].forEach(sx => cyl(trim, sx, -.05, 3.3, 3.66, .03, .03, 6, GOLD, false));
  sph(gl, 0, 3.48, -.05, .18, .18, .18, [1, .93, .75], 10);
  // 悬臂话筒（右侧）
  box(body, .8, 1.15, -.1, 1.45, 1.2, .1, [.14, .12, .2]); cyl(trim, 1.4, 0, 1.2, 1.42, .025, .025, 6, [.75, .75, .8], false); sph(gl, 1.4, 1.5, 0, .09, .11, .09, [.1, .1, .12], 8);
  // 左侧：投币/扫码口 + 耳机挂钩
  box(body, -1.35, 1.1, -.1, -.8, 1.15, .1, [.14, .12, .2]); box(neon, -1.3, 1.16, -.04, -.9, 1.19, .04, [1, 1, 1]);
  // 立柱边缘霓虹条 + 底座发光环 + 屏幕上方金色拱
  box(neon, -.84, .2, .3, -.8, 3.1, .34, [1, 1, 1]); box(neon, .8, .2, .3, .84, 3.1, .34, [1, 1, 1]); box(neon, -.8, 1.12, .3, .8, 1.15, .34, [1, 1, 1]);
  const rb = new MB(); rb.disc(x, z, .045, 1.5, 36, [1, 1, 1], 1.38); add(rb, emMat([1, .8, .45], .6, 1.5));
  [-.55, .55].forEach(sx => box(trim, sx - .03, .2, .3, sx + .03, 1.12, .34, GOLD));
  add(body, {}); add(trim, {}); add(gl, {}); add(neon, emMat([.5, .9, 1], .7, 1.4)); add(ring, emMat([1, .8, .45], .6, 1.4));
  glow(HL, 0, 3.5, .5, 3.4, [1, .8, .5]); glow(HL, 0, 2.3, .6, 3.8, [.5, .8, 1]); glow(HL, 1.4, 1.6, .5, 1.1, [1, .9, .6]); pool(0, 1.4, 3.0, [.55, .8, 1]);
  k.fin();
}

/* C：复古点唱机 —— 圆顶机身 + 弧形霓虹管 + 中央屏幕 + 唱片窗 + 底部喇叭 */
function jukebox(K, x, z) {
  const k = mk(K, x, z), { box, cyl, sph, wallQ, glow, pool, ui, add, emMat, HL, R } = k; k.obs(-1.2, -.7, 1.2, .7);
  const body = new MB(), trim = new MB(), neonP = new MB(), neonC = new MB(), gl = new MB(), chrome = new MB();
  box(body, -1.1, 0, -.6, 1.1, .3, .6, [.2, .12, .1]); box(trim, -1.16, .28, -.66, 1.16, .36, .66, GOLD);
  box(body, -1.0, .36, -.5, 1.0, 1.3, .5, [.5, .1, .22]);                            // 下柜：酒红
  box(body, -.92, 1.3, -.46, .92, 2.55, .46, [.52, .1, .24]);                       // 中段
  sph(body, 0, 2.55, 0, .92, .95, .46, [.52, .1, .24], 24);                          // 圆顶
  box(chrome, -1.04, .36, -.52, -.94, 2.5, .52, [.9, .9, .95]); box(chrome, .94, .36, -.52, 1.04, 2.5, .52, [.9, .9, .95]);
  [0, 1, 2].forEach(i => { box(chrome, -1.04, .6 + i * .5 - .0, .5, 1.04, .62 + i * .5, .54, [.95, .95, .98]); });
  // 圆形扬声器
  [-.5, .5].forEach(sx => { cyl(gl, sx, .54, .52, .94, .34, .34, 20, [.12, .09, .14], true); cyl(gl, sx, .545, .62, .84, .24, .24, 20, [.3, .26, .36], true); });
  // 屏幕（拱形窗内）
  box(body, -.78, 1.38, .44, .78, 2.62, .5, [.08, .06, .12]); const scr = new MB(); wallQ(scr, -.7, 1.46, .7, 2.54, .52, WHITE);
  box(trim, -.82, 1.34, .46, .82, 1.4, .56, GOLD); box(trim, -.82, 2.62, .46, .82, 2.68, .56, GOLD); box(trim, -.82, 1.34, .46, -.76, 2.68, .56, GOLD); box(trim, .76, 1.34, .46, .82, 2.68, .56, GOLD);
  // 弧形霓虹管（顶部拱 + 两侧竖管）
  neonP.arch(x, 2.56, z + .5, z + .53, .98, .93, 0, Math.PI, 28, [1, 1, 1]); neonC.arch(x, 2.56, z + .5, z + .53, .78, .74, 0, Math.PI, 28, [1, 1, 1]);
  box(neonP, -.99, .4, .5, -.94, 2.56, .53, [1, 1, 1]); box(neonP, .94, .4, .5, .99, 2.56, .53, [1, 1, 1]);
  box(neonC, -.88, 1.32, .5, .88, 1.34, .53, [1, 1, 1]);
  // 顶饰：唱片 + 音符
  cyl(gl, 0, 0, 3.5, 3.52, .0, .0, 3, GOLD, false); sph(gl, 0, 3.62, 0, .16, .16, .16, [1, .9, .6], 10); cyl(gl, 0, 0, 3.5, 3.62, .05, .05, 6, GOLD, true);
  // 招牌
  const mq = K.T.sign('SONGS ♪ 点歌', { w: 512, h: 120, fs: 64, bg: '#2a0812', fg: '#ffe2b0', border: '#e1b84e' }), mqb = new MB(); wallQ(mqb, -.6, 2.78, .6, 3.2, .1, WHITE);
  box(body, -.62, 2.76, .06, .62, 3.22, .1, [.16, .08, .08]);
  // 唱片窗
  const rec = R.paint(128, 128, g => { g.fillStyle = '#0a0a0e'; g.fillRect(0, 0, 128, 128); g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fillStyle = '#16161c'; g.fill(); g.strokeStyle = '#2c2c38'; g.lineWidth = 2; for (let r = 18; r < 58; r += 7) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); } g.beginPath(); g.arc(64, 64, 16, 0, 7); g.fillStyle = '#e8446a'; g.fill(); g.beginPath(); g.arc(64, 64, 3, 0, 7); g.fillStyle = '#111'; g.fill(); }, { clamp: true });
  const rw = new MB(); wallQ(rw, -.28, 2.8, .28, 3.2, .115, WHITE);
  add(body, {}); add(trim, {}); add(chrome, {}); add(gl, {}); add(scr, { tex: ui(512, 640, { a: '#e8446a', b: '#ffd980', bg0: '#2a0a16', bg1: '#5a1230' }), em: ui(512, 640, { a: '#e8446a', b: '#ffd980', bg0: '#2a0a16', bg1: '#5a1230' }), emDay: .5, emNight: .8 });
  add(mqb, { tex: mq.tex, em: mq.em, emDay: .45, emNight: .8 }); add(neonP, emMat([1, .5, .72], .7, 1.5)); add(neonC, emMat([1, .85, .45], .7, 1.5));
  glow(HL, 0, 2.6, .7, 4.2, [1, .5, .65]); glow(HL, 0, 1.8, .6, 3.4, [1, .75, .45]); glow(HL, 0, .8, .7, 2.6, [1, .6, .6]); pool(0, 1.5, 3.2, [1, .55, .6]);
  k.fin();
}

G.Kiosk = { arcade, pillar, jukebox, uiTex };

/* 概念预览：三台点歌机并排 */
G.Scenes.makeKioskDemo = function (R, T) {
  const K = G.KTV.kit(R, T), { S, add } = K;
  const f = new MB(); f.floor(-60, -45, 60, 30, 0, [1, 1, 1], [0, 0, 30, 18.75]); add(f, { tex: T.pave });
  arcade(K, -10, 0); pillar(K, 0, 0); jukebox(K, 10, 0);
  S.dyn = (fx) => { fx.glow = { spray: .35, beam: 0, spark: .5 }; };
  S.walkable = () => true; S.heightAt = () => 0; S.bounds = { x0: -60, x1: 60, z0: -40, z1: 25 }; S.spawn = [0, 12];
  S.camera = { dist: 12, pitch: PITCH, fov: .72, clampX: [-40, 40], clampZ: [0, 0], lead: 0 }; S.npcRect = { x0: -5, x1: 5, z0: 5, z1: 12 }; S.npcN = 0;
  S.name = '点歌机预览'; S.indoor = false; S.env = h => G.World.envAt(h);
  return S;
};
})(window);
