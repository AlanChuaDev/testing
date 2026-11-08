/* scooter_pose.js — 【骑行姿势】独立文件（由负责动作的同学 / AI 接手，直接改这个文件即可，不用碰别的文件）。
   作用：给角色骨架加 3 个动作：'ride'（直行）、'ride_l'（向左拐）、'ride_r'（向右拐）。
   接入：scooter_ride.js 在第一次需要时调用 ScooterPose.install(model)；这三个名字的动作不存在时才会安装（已有就不覆盖）。
   坐标约定（和 glbchar.js 的 addActions 完全一致）：角色面朝 +Z，上 = +Y，角色左边 = +X；pr(pitch, roll, yaw)：
     pitch > 0 = 肢体向「后」摆，pitch < 0 = 向「前」摆；spine / chest / head 的 pitch > 0 = 前倾（和 bow 一致）。
   踏板常量（单位：世界单位，踏板缩放 1.5 之后）见 ScooterPose.GEOM：踏板面高度、握把位置，方便对手 / 脚。
   游戏里的位置：角色脚底 = 踏板面（game.js 已把角色整体抬高 ScooterRide.LIFT）；角色在踏板正上方，朝向 = 车头方向。
   ★ 手部在第一人称视角里由 scooter_hands.js 另外画，这里只管第三人称 / 其他玩家看到的姿势。 */
(function (G) {
'use strict';
const GEOM = { deckTop: .138 * 1.5, gripY: 1.0 * 1.5, gripZ: .25 * 1.5, gripHalfX: .2275 * 1.5 };

function install(model) {
  if (model.anims.ride) return;
  const g = model.g, names = {}, J = model.skins[0] ? model.skins[0].joints : [];
  J.forEach(i => { names[g.nodes[i].name] = i; });
  const qm = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qi = a => [-a[0], -a[1], -a[2], a[3]];
  const qa = (ax, deg) => { const h = deg * Math.PI / 360, s = Math.sin(h); return ax === 'x' ? [s, 0, 0, Math.cos(h)] : ax === 'y' ? [0, s, 0, Math.cos(h)] : [0, 0, s, Math.cos(h)]; };
  const ID = [0, 0, 0, 1], rr = i => [model.restR[i * 4], model.restR[i * 4 + 1], model.restR[i * 4 + 2], model.restR[i * 4 + 3]];
  const Wr = new Array(model.n);
  for (const i of model.order) { const p = model.parent[i]; Wr[i] = p < 0 ? rr(i) : qm(Wr[p], rr(i)); }
  const hipsRest = [model.restT[names.hips * 3], model.restT[names.hips * 3 + 1], model.restT[names.hips * 3 + 2]];
  const pr = (pitch, roll, yaw) => qm(qa('z', roll || 0), qm(qa('y', yaw || 0), qa('x', pitch || 0)));
  function clip(name, dur, keys) {
    const bones = new Set(); keys.forEach(k => Object.keys(k.r || {}).forEach(b => { if (names[b] != null) bones.add(b); }));
    const ch = [], tt = keys.map(k => k.t);
    const perKey = keys.map(k => {
      const Wn = new Array(model.n), loc = {};
      for (const i of model.order) {
        const p = model.parent[i], nm = g.nodes[i].name, spec = (k.r || {})[nm];
        const desired = spec ? qm(spec, Wr[i]) : (p < 0 ? rr(i) : qm(Wn[p], rr(i)));
        Wn[i] = desired; const par = p < 0 ? ID : Wn[p]; if (spec) loc[nm] = qm(qi(par), desired);
      }
      return loc;
    });
    bones.forEach(b => { const v = []; perKey.forEach(loc => v.push(...loc[b])); ch.push({ node: names[b], path: 'rotation', t: tt.slice(), v }); });
    if (keys.some(k => k.hips)) { const v = []; keys.forEach(k => { const h = k.hips || [0, hipsRest[1], 0]; v.push(h[0] + hipsRest[0], h[1], h[2] + hipsRest[2]); }); ch.push({ node: names.hips, path: 'translation', t: tt.slice(), v }); }
    model.anims[name] = { duration: dur, ch };
  }
  const arms = (s, pU, rU, pF, rF) => { const m = s === 'L' ? 1 : -1; return { ['upperarm.' + s]: pr(pU, m * rU), ['forearm.' + s]: pr(pF, m * rF) }; };
  const legs = (s, pT, pC) => ({ ['thigh.' + s]: pr(pT, 0), ['calf.' + s]: pr(pC, 0) });
  const merge = (...o) => Object.assign({}, ...o);
  /* 姿势：lean = 身体向左(+)/右(-)倾斜的角度（拐弯时），headYaw = 头转向 */
  const pose = (lean, bob) => ({
    hips: [0, hipsRest[1] - .012 + bob, .02],
    r: merge(
      legs('L', -6, 12), legs('R', -6, 12),
      arms('L', 6, 6, -86, 8.5), arms('R', 6, 6, -86, 8.5),
      { spine: pr(7, lean * .5), chest: pr(4, lean * .5), head: pr(-8, -lean * .3, lean * .6) })
  });
  const K = (t, l, b) => Object.assign({ t }, pose(l, b));
  clip('ride', 1.2, [K(0, 0, 0), K(.6, 0, .004), K(1.2, 0, 0)]);
  clip('ride_l', 1.2, [K(0, 9, 0), K(.6, 9, .004), K(1.2, 9, 0)]);
  clip('ride_r', 1.2, [K(0, -9, 0), K(.6, -9, .004), K(1.2, -9, 0)]);
}
G.ScooterPose = { GEOM, install };
})(window);
