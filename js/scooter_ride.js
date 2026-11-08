/* scooter_ride.js — 「星驰 STARGO」电动踏板：租借面板 / 骑行 / 计时 / 续费 / 自动还车 / 第一人称（带手）视角 / 渲染（自己 + 远程玩家）。
   只在《独立广场》(scene id = merdeka) 可用。game.js 里只有少量钩子（搜索 ScooterRide）。
   可调常量：MUL（速度倍数，相对当前走 / 跑速度）、PRICES（分钟, 金币）、WARN（剩余多少秒弹出续费）。 */
(function (G0) {
'use strict';
const S = G0.Scooter, W = G0.World, COLORS = S.COLORS;
const MUL = 1.5, SCALE = 1.5, LIFT = .138 * SCALE, WARN = 30, SCENE = 'merdeka';
const PRICES = [[2, 30], [5, 50], [10, 80]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angd = a => Math.atan2(Math.sin(a), Math.cos(a));
let G, api, $, root, rentEl, renewEl, hudEl;
let selHex = COLORS[0].hex, pv = null;
const models = {}, atl = {}, hands = {}, pvImg = {};
const MM = new W.MB(), GG = new W.MB(), DDs = {};
const HOT = { id: 'scooter_off', btn: '下车', icon: '🛴', x: 0, z: 0, r: 0 };

const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const model = hex => models[hex] || (models[hex] = S.build(hex));
const colorIdx = hex => Math.max(0, COLORS.findIndex(c => c.hex === hex));

/* ---------------- 租借面板 ---------------- */
function preview(hex) {
  if (pvImg[hex]) return pvImg[hex];
  try {
    if (!pv) { const cv = document.createElement('canvas'); cv.width = 520; cv.height = 340; pv = { cv, R: new W.Renderer(cv) }; }
    const R = pv.R, m = model(hex), MMp = new W.MB(), GGp = new W.MB(), DDp = new W.MB(), fl = new W.MB();
    fl.floor(-60, -60, 60, 60, 0, [.78, .76, .86]);
    S.emitModel({ main: MMp, glow: GGp, decal: DDp }, m, 0, 0, 0, 0, 1.4);
    const at = S.atlas(R, hex), env = Object.assign({}, W.envAt(12.5)); env.fogNear = 200; env.fogFar = 400;
    R.setCamera({ target: [0, .62, 0], dist: 3.1, pitch: .24, yaw: -.8, fov: .62 }, pv.cv.width, pv.cv.height); R.begin(env, pv.cv.width, pv.cv.height, 0);
    [R.batch(fl, { tex: R.white }), R.batch(MMp, { tex: R.white }), R.batch(GGp, { tex: R.white, em: R.white, emDay: .95, emNight: 1.6 }), R.batch(DDp, { tex: at, em: at, emDay: .12, emNight: .4 })].forEach(b => R.draw(b));
    return (pvImg[hex] = pv.cv.toDataURL('image/png'));
  } catch (e) { return ''; }
}
function buildUI() {
  root = document.createElement('div');
  root.innerHTML = `
  <section class="sheet small scPanel" id="scRent" hidden>
    <header><h2>🛴 STARGO 电动踏板</h2><button class="x" data-sc-close>✕</button></header>
    <div class="scPrev"><img id="scImg" alt=""><div id="scColName"></div></div>
    <div class="scSw" id="scSw"></div>
    <div class="scPrice" id="scPrice"></div>
    <p class="scTip">仅限独立广场使用 · 骑行速度 ${MUL}× · 到时间自动还车</p>
  </section>
  <section class="sheet small scPanel scRenew" id="scRenew" hidden>
    <header><h2>⏱ 骑行时间快到了</h2></header>
    <div class="scLeft" id="scLeft"></div>
    <p class="scTip">续费选择（时间会加在剩余时间后面）</p>
    <div class="scPrice" id="scPrice2"></div>
    <button class="scNo" id="scNo">不续费，到时自动还车</button>
  </section>
  <div id="rideHud" hidden></div>`;
  while (root.firstChild) document.body.appendChild(root.firstChild);
  rentEl = $('scRent'); renewEl = $('scRenew'); hudEl = $('rideHud');
  const sw = $('scSw');
  COLORS.forEach(c => { const b = document.createElement('button'); b.className = 'scDot'; b.style.background = c.hex; b.title = c.name; b.dataset.hex = c.hex; b.onclick = () => pick(c.hex); sw.appendChild(b); });
  const mk = (el, fn) => PRICES.forEach(([m, c]) => { const b = document.createElement('button'); b.className = 'scBuy'; b.innerHTML = `<b>${m} 分钟</b><span>🪙 ${c}</span>`; b.onclick = () => fn(m, c); el.appendChild(b); });
  mk($('scPrice'), (m, c) => rent(m, c)); mk($('scPrice2'), (m, c) => renew(m, c));
  document.querySelector('[data-sc-close]').onclick = () => { rentEl.hidden = true; };
  $('scNo').onclick = () => { if (G.ride) G.ride.askOff = true; renewEl.hidden = true; };
}
function pick(hex) {
  selHex = hex; const c = COLORS[colorIdx(hex)];
  document.querySelectorAll('#scSw .scDot').forEach(b => b.classList.toggle('on', b.dataset.hex === hex));
  $('scColName').textContent = c.name + (c === COLORS[0] ? '（默认）' : ''); $('scImg').src = preview(hex);
}
function openRental() {
  if (G.ride) return false; if (G.sceneId !== SCENE) return false;
  const d = G.scene.scooterDock; if (!d) return false;
  if (d.freeSlot(true) < 0) { api.toast('这里的踏板都被借走了，等等别人还车吧', 2400); return true; }
  closeAll(); pick(selHex); rentEl.hidden = false; return true;
}
function closeAll() { document.querySelectorAll('.sheet').forEach(p => p.hidden = true); }

/* ---------------- 租 / 续 / 还 ---------------- */
function rent(min, cost) {
  const d = G.scene.scooterDock; if (G.ride || !d) return;
  const me = G.me, slot = d.freeSlot(true, me.x, me.z); if (slot < 0) return api.toast('踏板刚被借走了，请换一辆', 2000);
  if (!api.pay(cost, '租借成功！骑行 ' + min + ' 分钟 🛴', null)) return;
  rentEl.hidden = true;
  G.ride = { hex: selHex, slot, endAt: Date.now() + min * 60000, askOff: false, hot: HOT, prevMode: G.camMode, confirmT: 0 };
  me.ride = { hex: selHex, slot }; me.sit = null; G.target = null;
  G.rideFP = true; api.applyView(); d.refresh();
  api.toast('摇杆 / 方向键：左右 = 转向，向前 = 加速。点「视角」可以切换', 3200);
}
function renew(min, cost) {
  const r = G.ride; if (!r) return;
  if (!api.pay(cost, '已续费 ' + min + ' 分钟', null)) return;
  r.endAt += min * 60000; r.askOff = false; renewEl.hidden = true;
}
function stop(reason) {
  const r = G.ride; if (!r) return;
  G.ride = null; G.me.ride = null; G.rideFP = false; G.camMode = r.prevMode || 'orig'; hudEl.hidden = true; renewEl.hidden = true;
  const d = G.scene && G.scene.scooterDock; if (d) d.refresh();
  if (api) { api.applyView(); G.cam.target[0] = G.me.x; G.cam.target[2] = G.me.z; G.near = null; api.setEnter(null); }
  if (reason === 'timeout') api.toast('时间到了，踏板已自动还回停车位 🛴', 2800); else if (reason === 'early') api.toast('已还车，踏板回到停车位', 2200);
}
function onUse(n) {   // 黄色按钮 = 下车（两次点击确认，避免误触）
  const r = G.ride; if (!r) return false;
  const now = performance.now();
  if (now - r.confirmT < 3000) stop('early'); else { r.confirmT = now; api.toast('再点一次「下车」确认还车（剩余时间不退）', 2600); }
  return true;
}

/* ---------------- 每帧 ---------------- */
function update(dt) {
  const r = G.ride; if (G.scene && G.scene.scooterDock) G.scene.scooterDock.sync(G);
  if (!r) return;
  if (G.sceneId !== SCENE) return stop('leave');
  const left = (r.endAt - Date.now()) / 1000;
  hudEl.hidden = false; hudEl.textContent = '🛴 剩余 ' + fmt(left) + (left <= WARN ? ' · 请续费' : ''); hudEl.classList.toggle('warn', left <= WARN);
  if (left <= 0) return stop('timeout');
  if (left <= WARN && !r.askOff) { if (renewEl.hidden) { closeAll(); renewEl.hidden = false; } $('scLeft').textContent = fmt(left); }
  else if (left > WARN && !renewEl.hidden) renewEl.hidden = true;
  G.target = G.rideFP ? null : G.target;
}
/* 第一人称：摇杆左右 = 转向，向前 = 前进，向后 = 刹停（没有倒车）*/
function fpInput(ix, iz, dt) {
  const me = G.me, fwd = clamp(-iz, 0, 1), f = fwd > .1 ? 1 : .45;
  me.yaw -= ix * 2.1 * f * dt; me.yaw = angd(me.yaw); G.inFwd = fwd; G.target = null;
  return [Math.sin(me.yaw) * fwd, Math.cos(me.yaw) * fwd];
}
function clipName(e) {
  const m = G.model && G.model.anims; if (!m) return 'idle';
  if (!m.ride && G0.ScooterPose) { try { G0.ScooterPose.install(G.model); } catch (err) { console.warn('ScooterPose', err); } }
  const st = e._rs ? e._rs.steer : 0;
  if (m.ride_l && st > .12) return 'ride_l'; if (m.ride_r && st < -.12) return 'ride_r';
  return m.ride ? 'ride' : 'idle';
}

/* ---------------- 第一人称相机 + 渲染 ---------------- */
const EYE = [0, 1.8, -.3], LOOK = [0, 1.38, 2.1];
function rot(v, yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; }
function fpCam() {
  const me = G.me, yaw = me.inst.yaw, o = [me.x, me.y + (me._rs ? me._rs.ex : 0), me.z], e = rot(EYE, yaw), t = rot(LOOK, yaw);
  return { eye: [o[0] + e[0], o[1] + e[1], o[2] + e[2]], target: [o[0] + t[0], o[1] + t[1], o[2] + t[2]], fov: 1.1, near: .05, far: 260, dist: 1, pitch: 0, yaw: 0 };
}
function handsFor(e) {
  const sk = (G0.Outfit && G0.Outfit.SKIN[(e.outfit && e.outfit.skin) || 0]) || [.96, .88, .8], key = sk.join(',');
  return hands[key] || (hands[key] = S.hands.build(sk.map((v, i) => v * [.95, .78, .66][i]), [.86, .88, .96]));
}
/* 车轮下面的地板如果比人物脚下高（路沿 / 人行道边），整辆车连同骑手一起抬高，车轮不会被地板盖住 */
function wheelLift(e, q, dt) {
  const f = G.scene && G.scene.floorY; let want = 0;
  if (f) { const yw = e.inst.yaw, sn = Math.sin(yw), cs = Math.cos(yw); for (const t of [-.8, -.55, -.3, 0, .3, .55, .85]) want = Math.max(want, f(e.x + sn * t * SCALE, e.z + cs * t * SCALE) - e.y); }
  want = Math.max(0, want); q.ex += (want - q.ex) * Math.min(1, dt * 16); if (q.ex < .002 && !want) q.ex = 0;
}
function rs(e, dt) {
  const q = e._rs || (e._rs = { x: e.x, z: e.z, yaw: e.inst.yaw, steer: 0, spin: 0, ex: 0 });
  wheelLift(e, q, dt);
  const yaw = e.inst.yaw, dd = angd(yaw - q.yaw), dist = Math.hypot(e.x - q.x, e.z - q.z);
  const target = clamp((dt > 0 ? dd / dt : 0) * .13, -.38, .38);
  q.steer += (target - q.steer) * Math.min(1, dt * 9); q.spin += dist / (S.GEOM.WR * SCALE); q.x = e.x; q.z = e.z; q.yaw = yaw; q.speed = dt > 0 ? dist / dt : 0;
  return q;
}
let lastT = 0;
function draw(R, env) {
  const ents = [G.me, ...(G.remotes || [])].filter(e => e.ride && (e.isMe || e.vis !== false));
  if (!ents.length) { lastT = performance.now(); return; }
  const now = performance.now(), dt = Math.min(.1, Math.max(.001, (now - lastT) / 1000)); lastT = now;
  [MM, GG].forEach(m => { m.v.length = 0; m.i.length = 0; m.n = 0; });
  Object.keys(DDs).forEach(k => { const m = DDs[k]; m.v.length = 0; m.i.length = 0; m.n = 0; });
  const fp = G.rideFP && G.ride;
  ents.forEach(e => {
    const q = rs(e, dt), hex = e.ride.hex || COLORS[0].hex, D = DDs[hex] || (DDs[hex] = new W.MB());
    S.emitModel({ main: MM, glow: GG, decal: D }, model(hex), e.x, e.y + q.ex, e.z, e.inst.yaw, SCALE, { steer: q.steer, spinF: q.spin, spinR: q.spin });
    if (fp && e === G.me) S.hands.emit(MM, handsFor(e), e.x, e.y + q.ex, e.z, e.inst.yaw, SCALE, { steer: q.steer, press: q.speed > .5 ? 1 : 0 });
  });
  R.drawDynamic(MM, { tex: R.white });
  R.drawDynamic(GG, { tex: R.white, em: R.white, emDay: .9, emNight: 1.6 });
  Object.keys(DDs).forEach(hex => { const m = DDs[hex]; if (!m.n) return; const at = atl[hex] || (atl[hex] = S.atlas(R, hex)); R.drawDynamic(m, { tex: at, em: at, emDay: .1, emNight: .22 }); });
}

function init(o) { G = o.G; api = o; $ = o.$; buildUI(); }
G0.ScooterRide = { init, openRental, onUse, update, fpInput, fpCam, clip: clipName, draw, stop, MUL, LIFT, lift: e => LIFT + (e._rs ? e._rs.ex : 0), get hot() { return HOT; } };
})(window);
