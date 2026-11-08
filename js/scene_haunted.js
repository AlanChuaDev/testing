/* scene_haunted.js — 鬼屋内部（恐怖探索）。地图 + 道具 + 光源表；玩法逻辑在 haunted_game.js。
   场景 id：haunted。坐标：x 向右，z 向镜头（南）。主楼 30 × 38 米：门厅 → 长走廊 → 停尸间 / 厨房 / 镜子房 / 书房（祭坛），走廊尽头是被封印的大门。 */
(function (G) {
'use strict';
const { MB, clamp } = G.World, TAU = Math.PI * 2, PITCH = .66, H = 5.6, T_ = .35, DOOR_H = 3.9;
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

G.Scenes.makeHaunted = function (R, T) {
  const K = G.KTV.kit(R, T), { S, add, occ, obs, halo, glowMat } = K, X = G.HTex(R), rr = rnd(7);
  const NAV = {};          // 供玩法层使用的数据
  S.name = '👻 鬼屋'; S.indoor = true;

  /* ---------------- 房间 / 地面 ---------------- */
  const FLOORS = [
    { id: 'foyer', r: [-7, 4, 7, 14], tex: X.wood, tile: 4 }, { id: 'hall', r: [-3, -24, 3, 4], tex: X.wood, tile: 4 },
    { id: 'morgue', r: [-15, -8.35, -3, 4], tex: X.stone, tile: 4 }, { id: 'mirror', r: [-15, -22.85, -3, -8.35], tex: X.parquet, tile: 4 },
    { id: 'kitchen', r: [3, -8.35, 15, 4], tex: X.tile, tile: 4 }, { id: 'study', r: [3, -22.85, 15, -8.35], tex: X.woodDark, tile: 4 },
  ];
  NAV.floors = FLOORS;
  FLOORS.forEach(f => { const m = new MB(), [a, b, c, d] = f.r; m.floor(a, b, c, d, 0, [1, 1, 1], [a / f.tile, b / f.tile, c / f.tile, d / f.tile]); add(m, { tex: f.tex }); });
  S.walkable = (x, z) => FLOORS.some(f => x > f.r[0] + .02 && x < f.r[2] - .02 && z > f.r[1] + .02 && z < f.r[3] - .02) || (x > -1.6 && x < 1.6 && z >= 13.98 && z < 14.4 && !NAV.frontLocked);
  /* 走廊/门厅的红地毯（磨损） */
  { const m = new MB(); m.floor(-1.15, 4, 1.15, 14, .015, [1, 1, 1], [0, 0, 1, 4]); m.floor(-1.15, -24, 1.15, 4, .015, [1, 1, 1], [0, 0, 1, 11]); add(m, { tex: X.runner }); }

  /* ---------------- 墙（碰撞 + 挡光）---------------- */
  const WALLS = [];
  const gap = (z0, z1, gaps) => { const out = []; let a = z0; gaps.forEach(([g0, g1]) => { out.push([a, g0]); a = g1; }); out.push([a, z1]); return out; };
  const wallDefs = [];     // [x0,z0,x1,z1,style]
  const hz = (z, xa, xb, st) => wallDefs.push([xa, z - T_ / 2, xb, z + T_ / 2, st]);
  const vt = (x, za, zb, st) => wallDefs.push([x - T_ / 2, za, x + T_ / 2, zb, st]);
  /* 南墙（前门缺口 3.2 米）*/ hz(14.175, -7.175, -1.6, 'paper'); hz(14.175, 1.6, 7.175, 'paper');
  /* 门厅侧墙 */ vt(-7, 4, 14.35, 'paper'); vt(7, 4, 14.35, 'paper');
  /* z=4 线：门厅北墙 + 停尸间/厨房南墙 */ hz(4, -7.175, -3, 'paper'); hz(4, -15.175, -7.175, 'stoneWall'); hz(4, 3, 7.175, 'paper'); hz(4, 7.175, 15.175, 'stoneWall');
  /* 北墙：各房间 */ hz(-8.35, -15.175, -3, 'wtile'); hz(-8.35, 3, 15.175, 'ktile'); hz(-22.85, -15.175, -3, 'purple'); hz(-22.85, 3, 15.175, 'panel'); hz(-24.175, -3.175, 3.175, 'paper');
  /* 外侧墙 */ vt(-15, -22.85, 4.175, 'stoneWall'); vt(15, -22.85, 4.175, 'stoneWall');
  /* 走廊两侧墙（带 4 个房门，门洞宽 3）*/ [-3, 3].forEach(x => gap(-24.175, 4, [[-17, -14], [-3.5, -.5]]).forEach(([a, b]) => vt(x, a, b, 'paper')));
  wallDefs.forEach(w => { const [x0, z0, x1, z1, st] = w; WALLS.push([x0, z0, x1, z1]); obs(x0, z0, x1, z1);
    occ(() => { const m = new MB(), tex = X[st] || X.paper; m.box(x0, 0, z0, x1, H, z1, [1, 1, 1], [4, 4]); add(m, { tex });
      if (x1 - x0 > z1 - z0) { const t = new MB(); t.box(x0, 0, z1, x1, .5, z1 + .09, [.08, .06, .06]); t.box(x0, H - .4, z1, x1, H, z1 + .14, [.1, .08, .08]); add(t, {}); } }); });
  /* 门楣（门洞上方的墙，不挡路）+ 门框 */
  const lintel = (x0, z0, x1, z1, st) => occ(() => { const m = new MB(); m.box(x0, DOOR_H, z0, x1, H, z1, [1, 1, 1], [4, 4]); add(m, { tex: X[st] }); const f = new MB(), c = [.12, .08, .06]; if (x1 - x0 > z1 - z0) { f.box(x0 - .22, 0, z0 - .05, x0, DOOR_H, z1 + .12, c); f.box(x1, 0, z0 - .05, x1 + .22, DOOR_H, z1 + .12, c); f.box(x0 - .22, DOOR_H - .22, z0 - .05, x1 + .22, DOOR_H, z1 + .12, c); } else { f.box(x0 - .05, 0, z0 - .22, x1 + .05, DOOR_H, z0, c); f.box(x0 - .05, 0, z1, x1 + .05, DOOR_H, z1 + .22, c); f.box(x0 - .05, DOOR_H - .22, z0 - .22, x1 + .05, DOOR_H, z1 + .22, c); } add(f, {}); });
  lintel(-1.6, 14, 1.6, 14.35, 'paper'); lintel(-3 - T_ / 2, -17, -3 + T_ / 2, -14, 'paper'); lintel(3 - T_ / 2, -17, 3 + T_ / 2, -14, 'paper'); lintel(-3 - T_ / 2, -3.5, -3 + T_ / 2, -.5, 'paper'); lintel(3 - T_ / 2, -3.5, 3 + T_ / 2, -.5, 'paper');
  NAV.walls = WALLS;

  /* ---------------- 贴花 / 小工具 ---------------- */
  const decals = {};   // tex → {mb, col}
  const dec = (tex, x, z, w, d, ang, col, a) => { const k = tex + col.join(','); const o = decals[k] || (decals[k] = { tex, mb: new MB(), a: a == null ? .85 : a }), c = Math.cos(ang || 0), s = Math.sin(ang || 0), P = (u, v) => [x + (u * c - v * s) * w / 2, .035, z + (u * s + v * c) * d / 2];
    o.mb.quad(P(-1, 1), P(1, 1), P(1, -1), P(-1, -1), [0, 1, 0], [0, 0, 1, 1], col); };
  const BLOOD = [.42, .02, .04], SOOT = [.02, .02, .03], DUST = [.5, .48, .44];
  const webC = (x, y, z, s, flip) => { const m = new MB(); m.quad([x, y - s, z], [x + (flip ? -s : s), y - s, z], [x + (flip ? -s : s), y, z], [x, y, z], [0, 0, 1], flip ? [1, 0, 0, 1] : [0, 0, 1, 1], [.8, .8, .8]); add(m, { tex: X.dWeb, mode: 3, glow: .5 }); };
  const wallDec = (tex, x0, x1, y0, y1, z, col, a) => { const m = new MB(); m.wall(x0, y0, x1, y1, z, col); add(m, { tex, mode: 3, glow: a == null ? .8 : a }); };
  const rect = (m, x0, z0, x1, z1, y0, y1, c, f) => { m.box(x0, y0, z0, x1, y1, z1, c); if (f !== false) obs(x0, z0, x1, z1); };
  const lights = [], flames = [], pick = [];
  const L = (o) => { o.k = 1; o.on = o.on !== false; o.base = o.a; lights.push(o); return o; };
  const flame = (x, y, z, s, col, light) => flames.push({ x, y, z, s, col, L: light });
  const candle = (x, z, y0, lightO, h) => { const m = new MB(); h = h || .45; m.cyl(x, z, y0, y0 + .05, .2, .22, 10, [.5, .38, .15]); m.cyl(x, z, y0 + .05, y0 + h, .09, .09, 8, [.9, .86, .72], true); m.cyl(x, z, y0 + h, y0 + h + .02, .05, .05, 6, [.2, .15, .1]); add(m, {}); flame(x, y0 + h + .12, z, .5, [1, .62, .26], lightO); };

  /* ================= 门厅 ================= */
  { // 前门：门洞、月光、碎裂的大吊灯、座钟、壁灯、楼梯、肖像
    const sc = { x: 0, z: 12.6 };
    L({ id: 'moon', x: 0, z: 13.2, r: 7.5, a: .55, col: [90, 120, 220], tint: .14, fl: 0 });
    // 吊灯摔碎在地上
    { const m = new MB(), cx = 3.3, cz = 8.6; m.disc(cx, cz, .12, 1.25, 20, [.35, .28, .16], .95); m.disc(cx, cz, .26, .95, 20, [.42, .34, .2], .75); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = .55 + (i % 3) * .2; m.sphere(cx + Math.cos(a) * r, .22, cz + Math.sin(a) * r, .09, .14, .09, [.8, .85, .95], 5); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3; m.cyl(cx + Math.cos(a) * 1.1, cz + Math.sin(a) * 1.1, .24, .55, .07, .07, 6, [.9, .86, .72]); }
      add(m, {}); obs(cx - 1.2, cz - 1.2, cx + 1.2, cz + 1.2); dec(X.dSplat, cx - .6, cz + .3, 2.4, 2.0, .4, BLOOD, .55); }
    // 座钟（停在 3:00）
    { const x = -5.5, z = 4.5; occ(() => { const m = new MB(); rect(m, x - .65, z + .05, x + .65, z + 1.0, 0, 5.0, [.22, .13, .08]); m.box(x - .8, 4.7, z, x + .8, 5.2, z + 1.1, [.17, .1, .06]); m.box(x - .8, 0, z, x + .8, .5, z + 1.1, [.17, .1, .06]); add(m, {});
      const f = new MB(); f.wall(x - .5, 3.0, x + .5, 4.5, z + 1.02, [1, 1, 1]); add(f, { tex: R.paint(64, 96, g => { g.fillStyle = '#b8ad90'; g.fillRect(0, 0, 64, 96); g.strokeStyle = '#2a1c10'; g.lineWidth = 3; g.beginPath(); g.arc(32, 30, 24, 0, TAU); g.stroke(); g.lineWidth = 2; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(32 + Math.cos(a) * 19, 30 + Math.sin(a) * 19); g.lineTo(32 + Math.cos(a) * 23, 30 + Math.sin(a) * 23); g.stroke(); } g.lineWidth = 3; g.beginPath(); g.moveTo(32, 30); g.lineTo(32, 12); g.moveTo(32, 30); g.lineTo(50, 30); g.stroke(); g.fillStyle = '#6a1a14'; g.fillRect(14, 62, 36, 28); g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(32, 78, 8, 0, TAU); g.fill(); }, { clamp: true }) }); }); }
    // 楼梯（只到一半，被蛛网封住）
    { const m = new MB(); for (let i = 0; i < 9; i++) m.box(3.9, 0, 12.6 - i * .95, 7, .3 + i * .3, 13.5 - i * .95, [.28, .18, .12]); m.box(3.85, 0, 4.9, 4.0, 3.4, 13.5, [.2, .12, .08]); add(m, {}); obs(3.85, 4.8, 7, 13.5);
      const r = new MB(); for (let i = 0; i <= 9; i++) r.cyl(3.95, 13.2 - i * .95, .3 + i * .3, 1.4 + i * .3, .06, .06, 6, [.2, .12, .08]); add(r, {}); }
    // 沙发/小桌/倒下的椅子
    { const m = new MB(); rect(m, -6.8, 8.3, -4.9, 10.0, 0, .5, [.26, .08, .1]); m.box(-6.8, .5, 8.3, -6.3, 1.4, 10.0, [.22, .06, .08]); m.box(-6.8, .5, 8.3, -4.9, .8, 8.5, [.22, .06, .08]); m.box(-6.8, .5, 9.8, -4.9, .8, 10, [.22, .06, .08]); add(m, {});
      const t = new MB(); rect(t, -4.6, 10.4, -3.4, 11.4, 0, .75, [.3, .2, .12]); add(t, {}); candle(-4.0, 10.9, .75, L({ id: 'c_f', x: -4, z: 10.9, r: 4.2, a: .62, col: [255, 170, 80], tint: .22, fl: 1 }));
      const c = new MB(); rect(c, 1.6, 10.2, 2.6, 11.0, 0, .35, [.3, .2, .12]); c.box(1.6, .35, 10.2, 1.7, 1.2, 11.0, [.3, .2, .12]); add(c, {}); }
    // 壁灯（入口处，鬼门关上之后会熄灭）
    [[-5.6, 5.0], [5.6, 5.0]].forEach(([x, z], i) => { const m = new MB(); m.box(x - .25, 2.6, z, x + .25, 3.0, z + .35, [.3, .24, .12]); add(m, {}); candle(x, z + .2, 3.0, L({ id: 'sc' + i, x, z: z + 1.0, r: 6, a: .75, col: [255, 160, 70], tint: .26, fl: 1, y: 3.2 }), .4); });
    // 肖像（眼睛在精灵层，会跟着玩家转）
    NAV.portraits = []; [[-6.1, 3.3, 0], [-4.4, 3.9, 1], [4.2, 3.9, 2], [5.9, 3.3, 3]].forEach(([x, y, k]) => { const m = new MB(), z = 4.2; m.box(x - .85, y - 1.15, z, x + .85, y + 1.15, z + .08, [.45, .35, .15]); add(m, { tex: X.frame }); const p = new MB(); p.wall(x - .7, y - 1.0, x + .7, y + 1.0, z + .09, [1, 1, 1]); add(p, { tex: X.portrait(k) }); NAV.portraits.push({ x, y: y + .175, z: z + .1, k, dx: .175, s: .085 }); });
    dec(X.dSplat, 0, 10.5, 1.8, 1.8, .2, BLOOD, .5); dec(X.dDrag, 0, 7.4, 1.0, 5, 0, BLOOD, .55); dec(X.dHand, -2.2, 4.8, .9, .9, .5, BLOOD, .8);
    webC(-7, H - .15, 4.2, 2.2); webC(7, H - .15, 4.2, 2.2, true);
    NAV.spawn = [0, 12]; }

  /* ================= 走廊 ================= */
  { // 倾倒的烛台、碎花瓶、拖痕与手印；尽头的封印大门
    const m = new MB(); m.cyl(-1.9, -9.2, 0, .12, .5, .5, 10, [.3, .24, .12], true); m.cyl(-1.9, -9.2, .12, 1.1, .06, .06, 6, [.3, .24, .12]); add(m, {});
    const c = new MB(); c.box(1.2, 0, -5.3, 2.0, .45, -4.5, [.5, .45, .4]); c.box(1.5, .05, -4.6, 2.4, .35, -3.9, [.55, .5, .44]); add(c, {});
    dec(X.dCrack, 1.6, -4.8, 3, 3, .3, [.02, .02, .02], .5); dec(X.dDrag, 0.4, -12.5, 1.3, 7, .1, BLOOD, .6); dec(X.dSplat, -.3, -17.5, 2.2, 2.2, 1, BLOOD, .6); dec(X.dHand, -1.2, -22.8, 1.0, 1.0, 3.1, BLOOD, .9); dec(X.dHand, 1.3, -22.4, .9, .9, 3.4, BLOOD, .9); dec(X.dHand, 0.2, -23.2, .9, .9, 3.0, BLOOD, .9);
    dec(X.dSplat, 1.6, -1.2, 2.4, 2.4, .6, BLOOD, .6);
    // 大门（关闭状态 / 打开状态各一组，运行时切换）
    const gz = -24.175 + T_ / 2 + .01;
    NAV.gateClosed = (() => { const b0 = S.batches.length, m = new MB(), f = new MB(); occ(() => { m.wall(-1.5, 0, 1.5, 3.9, gz + .22, [1, 1, 1]); add(m, { tex: X.gate, em: X.gateEm, emDay: 1, emNight: 1.1 }); f.box(-1.8, 0, gz, -1.5, 4.0, gz + .42, [.1, .07, .06]); f.box(1.5, 0, gz, 1.8, 4.0, gz + .42, [.1, .07, .06]); f.box(-1.8, 3.9, gz, 1.8, 4.3, gz + .42, [.1, .07, .06]); add(f, {}); }); return S.batches.splice(b0); })();
    NAV.gateOpen = (() => { const b0 = S.batches.length, m = new MB(), f = new MB(); m.box(-1.5, 0, gz + .2, -.8, 3.9, gz + .5, [.2, .13, .09]); m.box(.8, 0, gz + .2, 1.5, 3.9, gz + .5, [.2, .13, .09]); add(m, {}); f.box(-1.8, 0, gz, -1.5, 4.0, gz + .42, [.1, .07, .06]); f.box(1.5, 0, gz, 1.8, 4.0, gz + .42, [.1, .07, .06]); f.box(-1.8, 3.9, gz, 1.8, 4.3, gz + .42, [.1, .07, .06]); add(f, {});
      const w = new MB(); w.wall(-1.5, 0, 1.5, 3.9, gz - .05, [.55, .7, 1]); add(w, { tex: T.glow, mode: 2, glow: .9 }); return S.batches.splice(b0); })();
    S.batches.push(...NAV.gateClosed); NAV.gateObs = { x0: -1.6, z0: -24.4, x1: 1.6, z1: -23.7 }; S.obstacles.push(NAV.gateObs);
    L({ id: 'gate', x: 0, z: -22.4, r: 5.5, a: .4, col: [255, 40, 30], tint: .22, fl: 3, base: .5 });
    webC(-3, H - .1, -24, 2.5); webC(3, H - .1, -24, 2.5, true);
  }

  /* ================= 停尸间（左上）================= */
  { const wz = -8.35 + T_ / 2 + .01, cx = -9.2;
    // 北墙停尸柜 + 一格被拉开
    occ(() => { const m = new MB(); m.wall(-14.6, 0, -3.4, 3.6, wz + .06, [1, 1, 1], [0, 0, 3.4, 1]); add(m, { tex: X.drawers }); const o = new MB(); o.box(-14.6, 0, wz, -3.4, 3.6, wz + .06, [.14, .17, .18]); add(o, {});
      const d = new MB(); d.box(-8.9, 1.55, wz + .06, -7.4, 2.15, wz + 1.9, [.7, .75, .78]); d.box(-8.8, 2.15, wz + .06, -7.5, 2.4, wz + 1.9, [.75, .7, .62]); add(d, {}); rect(new MB(), -8.9, wz, -7.4, wz + 1.9, 0, 0, [1, 1, 1]); });
    // 解剖台 + 裹尸布
    [[-12.4, -4.2, 1], [-9.4, -4.2, 1], [-12.4, -.2, 0], [-9.4, -.2, 1]].forEach(([x, z, body]) => { const m = new MB(); m.box(x - .55, .95, z - 1.1, x + .55, 1.05, z + 1.1, [.78, .82, .85]); [[-.45, -.95], [.45, -.95], [-.45, .95], [.45, .95]].forEach(([a, b]) => m.cyl(x + a, z + b, 0, .95, .05, .05, 6, [.5, .55, .58]));
      add(m, { tex: X.steel }); obs(x - .6, z - 1.15, x + .6, z + 1.15);
      if (body) { const s = new MB(); s.box(x - .4, 1.05, z - .9, x + .4, 1.35, z + .9, [1, 1, 1]); s.sphere(x, 1.42, z - .72, .24, .2, .26, [1, 1, 1], 7); s.box(x - .34, 1.05, z + .6, x + .34, 1.28, z + 1.05, [1, 1, 1]); add(s, { tex: X.sheet }); dec(X.dSplat, x + .1, z + 1.35, 1.2, 1.2, 0, BLOOD, .8); } });
    // 棺材（符纸在里面）+ 一口封死的
    { const x = -11.2, z = 1.8; occ(() => { const m = new MB(); m.box(x - 1.5, 0, z - .7, x + 1.5, .95, z + .7, [.32, .2, .14], [2, 1]); m.box(x - 1.38, .8, z - .58, x + 1.38, .96, z + .58, [.03, .02, .03]); add(m, { tex: X.coffinW }); const lid = new MB(); lid.box(x - 1.55 + 1.05, .98, z - .74 + .42, x + 1.55 + 1.05, 1.1, z + .74 + .42, [.4, .26, .17], [2, 1]); add(lid, { tex: X.coffinW }); obs(x - 1.5, z - .7, x + 1.5, z + .7); });
      NAV.coffin = { x, z }; dec(X.dSplat, x - 1.8, z + 1.1, 2.4, 2.4, 1.2, BLOOD, .6);
      const y = -7.2, w = 2.6; occ(() => { const m = new MB(); m.box(-4.5 - 1.5, 0, 1.4 - .7, -4.5 + 1.5, 1.05, 1.4 + .7, [.28, .18, .12], [2, 1]); add(m, { tex: X.coffinW }); const n = new MB(); [[-5.6], [-4.4], [-3.2]].forEach(([nx]) => n.box(nx - .3, 1.05, 1.15, nx + .3, 1.12, 1.65, [.7, .6, .2])); add(n, {}); obs(-6, .7, -3, 2.1); }); }
    // 日光灯（会闪）
    { const m = new MB(); m.box(-10.4, 4.7, -3.2, -7.9, 4.85, -2.9, [.7, .75, .7]); m.cyl(-9.1, -3.05, 4.4, 4.7, .02, .02, 4, [.3, .3, .3]); add(m, {}); L({ id: 'fluor', x: -9.2, z: -3.0, r: 6.5, a: .5, col: [150, 255, 200], tint: .2, fl: 2 }); }
    // 排水口 / 血 / 工具车
    { const m = new MB(); m.disc(-9.2, -2.1, .02, .45, 12, [.04, .05, .05]); add(m, {}); dec(X.dSplat, -9.2, -2.1, 3.8, 3.8, .3, BLOOD, .55);
      const c = new MB(); rect(c, -14.3, -7.7, -13.3, -6.1, 0, 1.0, [.6, .64, .66]); c.box(-14.35, 1.0, -7.75, -13.25, 1.12, -6.05, [.75, .78, .8]); add(c, { tex: X.steel }); candle(-13.8, -6.9, 1.12, L({ id: 'c_m', x: -13.8, z: -6.6, r: 4, a: .62, col: [255, 170, 80], tint: .2, fl: 1 }), .38); }
    dec(X.dDrag, -6.5, -2, 1.1, 6, 1.57, BLOOD, .6); dec(X.dHand, -4.2, -6.5, 1, 1, .2, BLOOD, .8);
    webC(-15, H - .1, wz, 2.4); webC(-3, H - .1, wz, 2.4, true); }

  /* ================= 镜子房（左下）================= */
  { const wz = -22.85 + T_ / 2 + .01;
    // 大镜子（北墙）：反射在精灵层画
    occ(() => { const f = new MB(); f.box(-12.0, .3, wz, -5.9, 5.2, wz + .2, [1, 1, 1]); add(f, { tex: X.frame }); const m = new MB(); m.wall(-11.6, .7, -6.3, 4.8, wz + .21, [1, 1, 1]); add(m, { tex: X.mirror }); const t = new MB(); t.box(-12.3, 5.2, wz, -5.6, 5.5, wz + .3, [.8, .65, .28]); t.box(-12.3, 0, wz, -11.9, .3, wz + .3, [.8, .65, .28]); t.box(-6.0, 0, wz, -5.6, .3, wz + .3, [.8, .65, .28]); add(t, {}); });
    NAV.mirror = { x0: -11.6, x1: -6.3, z: wz + .22, y0: .7, y1: 4.8 };
    // 落地镜（迷宫般的障碍）
    [[-12.6, -13.5, 0], [-6.5, -14.5, 1], [-9.4, -10.6, 0]].forEach(([x, z, v]) => { const m = new MB(); m.box(x - .9, 0, z - .1, x + .9, 3.2, z + .1, [.12, .09, .07]); add(m, {}); const g = new MB(); g.wall(x - .78, .2, x + .78, 3.0, z + .11, [.8, .9, 1]); add(g, { tex: X.mirror }); obs(x - .95, z - .15, x + .95, z + .15); dec(X.dCrack, x, z + 1.2, 2.2, 2.2, x, [.03, .03, .04], .5); });
    // 钢琴（会自己弹）、梳妆台（玉佩）、衣柜、盖白布的家具
    { const x = -13.2, z = -17.8; occ(() => { const m = new MB(); rect(m, x - .9, z - 1.5, x + .9, z + 1.5, 0, 1.4, [.06, .05, .07]); m.box(x - .95, 1.4, z - 1.55, x + .95, 1.5, z + 1.55, [.08, .07, .09]); m.box(x + .9, .9, z - 1.3, x + 1.4, 1.0, z + 1.3, [.9, .88, .8]); [[-1.2], [1.2]].forEach(([d]) => m.box(x + 1.3, 0, z + d - .05, x + 1.4, .9, z + d + .05, [.06, .05, .07])); add(m, {}); }); NAV.piano = { x, z }; }
    { const x = -4.7, z = -20.2; occ(() => { const m = new MB(); rect(m, x - 1.0, z - .5, x + 1.0, z + .5, 0, 1.2, [.3, .2, .15]); m.box(x - 1.05, 1.2, z - .55, x + 1.05, 1.28, z + .55, [.38, .26, .18]); add(m, { tex: X.woodF }); const s = new MB(); rect(s, x - .35, z + .8, x + .35, z + 1.4, 0, .6, [.4, .1, .12]); add(s, {}); const v = new MB(); v.wall(x - .6, 1.5, x + .6, 3.4, z - .45, [1, 1, 1]); add(v, { tex: X.mirror }); }); candle(x - .7, z + .1, 1.28, L({ id: 'c_v', x: x - .6, z: z + .8, r: 4, a: .62, col: [255, 175, 90], tint: .2, fl: 1 }), .4); NAV.vanity = { x: x + .5, z: z + .1 }; }
    { const x = -14.1, z = -11.0; occ(() => { const m = new MB(); rect(m, x - .7, z - 1.2, x + .7, z + 1.2, 0, 4.2, [.2, .12, .08]); m.box(x - .72, 0, z - 1.22, x - .64, 4.22, z + 1.22, [.14, .09, .06]); add(m, { tex: X.woodF }); }); }
    [[-6.2, -17.2], [-8.8, -20.9], [-12.6, -21.3]].forEach(([x, z]) => { const m = new MB(); m.box(x - .7, 0, z - .6, x + .7, 1.1, z + .6, [1, 1, 1]); m.sphere(x, 1.2, z, .55, .3, .5, [1, 1, 1], 6); add(m, { tex: X.sheet }); obs(x - .75, z - .65, x + .75, z + .65); });
    L({ id: 'mirrorMoon', x: -9, z: -20.2, r: 6.5, a: .32, col: [120, 180, 255], tint: .2, fl: 0 }); L({ id: 'mirrorFog', x: -8.5, z: -14, r: 5, a: .18, col: [120, 200, 255], tint: .08, fl: 0 });
    dec(X.dRune, -9, -14, 6, 6, .7, [.3, .6, 1], .12); dec(X.dHand, -9, -20.8, 1.2, 1.2, 0, [.5, .75, 1], .35);
    webC(-15, H - .1, wz, 2.6); webC(-3, H - .1, wz, 2.6, true); }

  /* ================= 厨房（右上）================= */
  { const wz = -8.35 + T_ / 2 + .01;
    // 北墙：灶台 / 抽油烟机 / 架子 / 挂钩
    occ(() => { const m = new MB(); rect(m, 5.6, wz, 10.4, wz + 1.5, 0, 1.5, [.1, .1, .12]); m.box(5.55, 1.5, wz, 10.45, 1.62, wz + 1.55, [.55, .56, .58]); [[6.5], [7.9], [9.3]].forEach(([x]) => { m.cyl(x, wz + .75, 1.62, 1.7, .32, .32, 10, [.05, .05, .06], true); }); m.box(5.8, 3.5, wz, 10.2, 5.0, wz + 1.0, [.45, .46, .48]); m.box(7.4, 1.0, wz + 1.4, 8.8, 1.45, wz + 1.52, [.04, .04, .05]); add(m, { tex: X.steel });
      const p = new MB(); p.cyl(6.5, wz + .75, 1.7, 2.3, .38, .34, 10, [.15, .15, .16], true); add(p, {});
      const sh = new MB(); [2.2, 3.2, 4.2].forEach(y => { sh.box(11, y, wz, 14.6, y + .1, wz + .6, [.25, .17, .1]); for (let i = 0; i < 6; i++) { const x = 11.3 + i * .55; sh.cyl(x, wz + .3, y + .1, y + .1 + .35 + (i % 3) * .08, .17, .17, 8, [[.5, .6, .3], [.55, .3, .2], [.4, .5, .55]][i % 3], true); } }); add(sh, {});
      const t = new MB(); t.box(3.3, 3.4, wz, 5.3, 3.5, wz + .1, [.3, .3, .3]); for (let i = 0; i < 5; i++) { t.cyl(3.6 + i * .38, wz + .05, 2.8 - (i % 2) * .3, 3.4, .01, .01, 4, [.3, .3, .3]); t.cyl(3.6 + i * .38, wz + .15, 2.2 - (i % 2) * .3, 2.8 - (i % 2) * .3, .13, .13, 8, [.25, .25, .27], true); } add(t, {}); });
    NAV.stove = { x: 8.1, z: wz + 2.1 }; L({ id: 'stove', x: 8.1, z: wz + 1.3, r: 4, a: .45, col: [255, 110, 40], tint: .2, fl: 3 });
    // 屠宰台 + 挂钩 + 麻袋
    { const x = 9.4, z = -1.8; occ(() => { const m = new MB(); rect(m, x - 1.4, z - .8, x + 1.4, z + .8, 0, 1.1, [.36, .22, .14]); m.box(x - 1.5, 1.1, z - .9, x + 1.5, 1.25, z + .9, [.5, .32, .2]); add(m, { tex: X.woodF }); const c = new MB(); c.box(x + .3, 1.25, z - .1, x + .7, 1.3, z + .1, [.7, .72, .75]); c.box(x + .6, 1.25, z - .1, x + .95, 1.4, z + .1, [.2, .1, .06]); add(c, {}); dec(X.dSplat, x, z, 3, 2.2, 0, BLOOD, .8); });
      const h = new MB(); [[x - 2.6, z - 1.2], [x + 2.4, z + 1.0], [x + .2, z + 2.6]].forEach(([hx, hzz], i) => { h.cyl(hx, hzz, 3.2, H, .04, .04, 5, [.15, .15, .16]); h.cyl(hx, hzz, 2.9, 3.2, .06, .02, 5, [.5, .5, .52]); h.sphere(hx, 2.1, hzz, .38, .7, .32, [.85, .8, .7], 7); }); add(h, {}); }
    // 冰箱 / 桶 / 箱 / 桌椅 / 水槽
    { const m = new MB(); rect(m, 13.3, -7.2, 14.8, -5.6, 0, 3.7, [.7, .74, .76]); m.box(13.25, 1.8, -5.65, 14.85, 1.86, -5.55, [.2, .22, .22]); add(m, { tex: X.steel }); }
    [[14.1, 2.6], [12.6, 3.1]].forEach(([x, z]) => { const m = new MB(); m.cyl(x, z, 0, 1.3, .6, .6, 10, [.28, .18, .1], true); m.cyl(x, z, .3, .38, .64, .64, 10, [.45, .45, .5]); m.cyl(x, z, .9, .98, .64, .64, 10, [.45, .45, .5]); add(m, {}); obs(x - .62, z - .62, x + .62, z + .62); });
    { const m = new MB(); rect(m, 3.4, -6.8, 4.4, -4.6, 0, 1.3, [.55, .58, .6]); add(m, { tex: X.steel }); const t = new MB(); t.cyl(3.9, -5.7, 1.3, 1.9, .05, .05, 6, [.7, .7, .72]); t.box(3.8, 1.85, -5.7, 4.2, 1.95, -5.65, [.7, .7, .72]); add(t, {}); NAV.sink = { x: 3.9, z: -5.7 }; }
    { const m = new MB(); rect(m, 11.2, -.6, 13.4, .6, 0, .85, [.3, .2, .12]); add(m, {}); [[10.7, 0], [14.0, .3]].forEach(([x, z], i) => { const c = new MB(); c.box(x - .35, 0, z - .35, x + .35, .55, z + .35, [.28, .18, .1]); if (i) c.box(x - .35, .55, z - .35, x - .3, 1.3, z + .35, [.28, .18, .1]); add(c, {}); obs(x - .38, z - .38, x + .38, z + .38); }); NAV.radio = { x: 12.3, z: 0 }; const r = new MB(); r.box(12.0, .85, -.2, 12.6, 1.15, .2, [.3, .22, .14]); r.cyl(12.5, 0, 1.15, 1.8, .015, .015, 4, [.6, .6, .6]); add(r, {}); }
    [[5.0, 3.0], [6.2, 3.1], [13.0, -3.9], [4.6, 0.2]].forEach(([x, z]) => { const c = new MB(); c.box(x - .45, 0, z - .35, x + .45, .75, z + .35, [.36, .24, .14]); add(c, { tex: X.woodF }); obs(x - .47, z - .37, x + .47, z + .37); });
    L({ id: 'bulb', x: 9.5, z: -1.2, r: 5.5, a: .42, col: [255, 214, 120], tint: .14, fl: 4 }); candle(12.6, -7.3, .0, L({ id: 'c_k', x: 12.6, z: -6.6, r: 4, a: .62, col: [255, 170, 80], tint: .2, fl: 1 }), .45);
    dec(X.dSplat, 5.2, 1.8, 2.8, 2.8, .9, BLOOD, .6); dec(X.dDrag, 12, 1.9, 1.2, 5, 1.2, BLOOD, .6); dec(X.dHand, 14.4, -3, .9, .9, 4.5, BLOOD, .8); webC(3, H - .1, wz, 2.4); webC(15, H - .1, wz, 2.4, true); }

  /* ================= 书房（右下）：祭坛 ================= */
  { const wz = -22.85 + T_ / 2 + .01;
    occ(() => { [[3.4, 5.9], [12.2, 14.7]].forEach(([a, b]) => { const m = new MB(); rect(m, a, wz, b, wz + .8, 0, 5.0, [.18, .11, .07]); add(m, {}); const bk = new MB(); bk.wall(a + .1, .15, b - .1, 4.9, wz + .81, [1, 1, 1], [0, 0, (b - a) / 2.4, 1.2]); add(bk, { tex: X.books }); });
      const fp = new MB(); rect(fp, 7.6, wz, 10.4, wz + .9, 0, 3.4, [.14, .12, .13]); fp.box(7.9, .2, wz + .9, 10.1, 2.8, wz + 1.0, [.01, .01, .01]); fp.box(7.4, 3.4, wz, 10.6, 3.65, wz + 1.15, [.22, .2, .21]); fp.sphere(9, 3.85, wz + .6, .3, .3, .3, [.9, .88, .78], 8); add(fp, { tex: X.stoneWall });
      const pt = new MB(); pt.box(7.7, 4.0, wz, 10.3, 5.25, wz + .1, [.45, .35, .15]); add(pt, { tex: X.frame }); const pp = new MB(); pp.wall(7.85, 4.15, 10.15, 5.1, wz + .11, [1, 1, 1]); add(pp, { tex: X.portrait(2) }); NAV.portraits.push({ x: 9, y: 4.708, z: wz + .12, k: 2, dx: .29, s: .1 }); });
    // 窗（月光）
    [[6.3], [11.7]].forEach(([x], i) => { const f = new MB(); f.box(x - .9, 1.5, wz, x + .9, 4.9, wz + .12, [.12, .08, .06]); add(f, {}); const w = new MB(); w.wall(x - .75, 1.65, x + .75, 4.75, wz + .13, [1, 1, 1]); add(w, { tex: X.window, em: X.windowEm, emDay: 1, emNight: 1 }); L({ id: 'win' + i, x, z: wz + 1.4, r: 5, a: .3, col: [110, 150, 255], tint: .12, fl: 0 }); });
    L({ id: 'fire', x: 9, z: wz + 1.6, r: 6.5, a: .5, col: [255, 110, 36], tint: .24, fl: 3 }); { const e = new MB(); e.floor(8.1, wz + .95, 9.9, wz + 1.15, .22, [1, .4, .1]); add(e, { tex: T.glow, mode: 2, glow: .8 }); }
    // 祭坛 + 符阵
    { const x = 9, z = -16.6; dec(X.dRune, x, z, 8.4, 8.4, 0, [.9, .12, .1], .5); const m = new MB(); rect(m, x - 1.4, z - .7, x + 1.4, z + .7, 0, 1.0, [.3, .3, .34]); m.box(x - 1.5, 1.0, z - .8, x + 1.5, 1.15, z + .8, [.4, .4, .45]); add(m, { tex: X.stoneWall });
      const sk = new MB(); [-.85, 0, .85].forEach(dx => { sk.cyl(x + dx, z, 1.15, 1.25, .26, .28, 10, [.7, .6, .25], true); }); add(sk, {});
      NAV.altar = { x, z, slots: [[x - .85, z], [x, z], [x + .85, z]] }; L({ id: 'altar', x, z: z + 1.2, r: 5, a: .38, col: [255, 60, 40], tint: .18, fl: 3 }); }
    // 书桌 / 椅 / 扶手椅 / 地球仪 / 骷髅
    { const m = new MB(); rect(m, 12.2, -13.2, 14.4, -11.8, 0, 1.2, [.28, .17, .1]); m.box(12.1, 1.2, -13.3, 14.5, 1.3, -11.7, [.36, .22, .14]); add(m, { tex: X.woodF }); candle(13.7, -12.5, 1.3, L({ id: 'c_s', x: 13.5, z: -11.2, r: 4, a: .62, col: [255, 175, 90], tint: .2, fl: 1 }), .42);
      const a = new MB(); rect(a, 4.0, -12.4, 5.5, -10.9, 0, .6, [.3, .08, .1]); a.box(4.0, .6, -12.4, 4.4, 1.5, -10.9, [.26, .06, .08]); add(a, {});
      const gb = new MB(); gb.cyl(5.0, -20.5, 0, 1.0, .05, .05, 6, [.2, .12, .08]); gb.sphere(5.0, 1.5, -20.5, .5, .5, .5, [.3, .42, .5], 9); add(gb, {}); obs(4.5, -21, 5.5, -20); }
    [[4.4, -9.4], [13.6, -9.6]].forEach(([x, z]) => { const m = new MB(); m.box(x - .4, 0, z - .35, x + .4, .6, z + .35, [.28, .18, .1]); add(m, {}); obs(x - .4, z - .35, x + .4, z + .35); });
    dec(X.dSplat, 9, -12.5, 2.6, 2.6, .3, BLOOD, .45); webC(3, H - .1, wz, 2.6); webC(15, H - .1, wz, 2.6, true); dec(X.dHand, 6.7, -12.5, 1, 1, .4, BLOOD, .8); }

  /* ---------------- 把贴花合并成批 ---------------- */
  Object.values(decals).forEach(o => add(o.mb, { tex: o.tex, mode: 3, glow: o.a }));

  /* ---------------- 道具：关键物品 / 蜡烛 / 护身符 ---------------- */
  const mkPick = (o, build) => { const b0 = S.batches.length; const mb = new MB(); build(mb); add(mb, {}); o.batches = S.batches.splice(b0); S.batches.push(...o.batches); o.got = false; pick.push(o); return o; };
  const itemMesh = {
    talisman: (mb, x, z) => { mb.box(x - .22, 1.0, z - .34, x + .22, 1.03, z + .34, [.92, .82, .38]); mb.box(x - .12, 1.03, z - .24, x + .12, 1.035, z + .24, [.7, .08, .1]); },
    key: (mb, x, z) => { mb.cyl(x, z, 1.64, 1.7, .16, .16, 10, [.9, .68, .24], true); mb.cyl(x, z, 1.64, 1.7, .08, .08, 8, [.1, .08, .06], true); mb.box(x - .04, 1.6, z + .1, x + .04, 1.67, z + .55, [.9, .68, .24]); mb.box(x - .04, 1.6, z + .42, x + .1, 1.66, z + .5, [.9, .68, .24]); },
    jade: (mb, x, z) => { mb.cyl(x, z, 1.3, 1.34, .24, .24, 14, [.35, .85, .6], true); mb.cyl(x, z, 1.3, 1.341, .08, .08, 8, [.05, .1, .08], true); },
    candle: (mb, x, z) => { mb.cyl(x, z, 0, .02, .2, .2, 8, [.5, .38, .15]); mb.cyl(x, z, .02, .42, .09, .09, 8, [.9, .86, .72], true); },
    amulet: (mb, x, z) => { mb.box(x - .17, .4, z - .02, x + .17, .84, z + .02, [.62, .08, .1]); mb.box(x - .06, .55, z + .02, x + .06, .67, z + .03, [.9, .75, .3]); mb.cyl(x, z, .84, .9, .03, .03, 4, [.8, .6, .2]); },
  };
  const PK = [
    { id: 'talisman', kind: 'key', mesh: 'talisman', name: '镇煞符', x: NAV.coffin.x + 1.15, z: NAV.coffin.z + .4, col: [255, 214, 90], icon: '📜' },
    { id: 'key', kind: 'key', mesh: 'key', name: '铜钥匙', x: NAV.stove.x, z: NAV.stove.z - .3, col: [255, 190, 70], icon: '🗝️' },
    { id: 'jade', kind: 'key', mesh: 'jade', name: '镜中玉佩', x: NAV.vanity.x, z: NAV.vanity.z, col: [90, 255, 190], icon: '🪞' },
    ...[[-4.2, 9.3], [1.8, -9.5], [-5.0, -6.8], [11.6, -6.8], [13.4, -10.4], [-12.2, -9.4], [11.0, 3.2]].map(([x, z], i) => ({ id: 'cd' + i, kind: 'candle', mesh: 'candle', name: '蜡烛', x, z, col: [255, 170, 80] })),
    ...[[1.9, -19.4], [13.4, 1.4]].map(([x, z], i) => ({ id: 'am' + i, kind: 'amulet', mesh: 'amulet', name: '护身符', x, z, col: [255, 70, 70] })),
  ];
  PK.forEach(p => mkPick(p, mb => itemMesh[p.mesh](mb, p.x, p.z)));
  NAV.pick = pick; NAV.lights = lights; NAV.flames = flames; NAV.decalBatches = Object.values(decals);

  /* ---------------- 前门（关上后出现） ---------------- */
  NAV.frontDoor = (() => { const b0 = S.batches.length; const m = new MB(); m.box(-1.6, 0, 14, 1.6, DOOR_H, 14.3, [.2, .13, .09]); m.box(-1.6, 1.6, 14.3, 1.6, 1.7, 14.34, [.55, .5, .4]); for (let i = 0; i < 3; i++) m.box(-1.5 + i * 1.1, .2, 14.3, -1.3 + i * 1.1, 3.6, 14.33, [.15, .1, .07]); occ(() => add(m, {})); return S.batches.splice(b0); })();
  NAV.frontObs = { x0: -1.7, z0: 13.9, x1: 1.7, z1: 14.4 };

  /* ---------------- 摄像机 / 环境 ---------------- */
  S.heightAt = () => 0; S.bounds = { x0: -16, x1: 16, z0: -25, z1: 15 }; S.spawn = NAV.spawn;
  S.camera = { dist: 15.5, pitch: PITCH, fov: .72, clampX: [-8.5, 8.5], clampZ: [-17, 10.5], lead: 1.6 };
  S.cameraWide = { dist: 20 };
  S.npcRect = { x0: 0, x1: 0, z0: 0, z1: 0 }; S.npcN = 0;
  S.env = () => ({ indoor: true, night: 1, gold: 0, day: 0, dir: [.25, 1, .5], sun: [.2, .22, .34], amb: [.46, .5, .68], top: [0, 0, .02], bot: [.012, .012, .03], fog: [.012, .012, .03], fogNear: 70, fogFar: 150, charAmb: [.62, .64, .9], charSun: [.4, .4, .62], line: [.07, .05, .1] });
  S.nav = NAV; S.R = R; S.X = X; S.T = T; S.K = K;
  if (G.HGame) G.HGame.attach(S);
  return S;
};
})(window);
