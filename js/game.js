/* game.js — game logic: scenes, characters, crowd, input, chat, KTV queue, wardrobe, UI. */
(function () {
'use strict';
const { Renderer, MB, envAt, clamp } = World;
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
const PI = Math.PI, TAU = PI * 2;
const store = { get(k, d) { try { const v = localStorage.getItem('sc_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('sc_' + k, JSON.stringify(v)); } catch (e) {} } };

/* ---------------- state ---------------- */
const QS = new URLSearchParams(location.search);
const G = {
  style: QS.get('style') || 'cozy',
  R: null, GR: null, model: null, T: null, scenes: {}, scene: null, sceneId: 'plaza',
  me: null, remotes: [], coins: [], hour: 18.4, timeMode: 'auto', t: 0, joy: { x: 0, z: 0 }, keys: {}, target: null,
  owned: store.get('owned', []),   // [创建面板] 已领取的套装（例如 'hoodie'）
  coinCount: store.get('coins', 1250), chat: { world: [], team: [], family: [] }, tab: 'world',
  cam: { target: [0, 0, 8], dist: 25, pitch: .7, fov: .62 }, quality: store.get('q', 1.5), outline: store.get('ol', 1),
  wide: store.get('wide', false), transitioning: false, near: null, standHot: { id: 'stand' }, stg: { mode: 'idle', queue: [] }, ktv: { queue: [], cur: null, arrived: false, online: false, mine: false, doneOk: false },
};
const SKIN = [[1, 1, 1], [.96, .88, .8], [.88, .74, .62], [.78, .62, .5]];
const HAIRS = ['#2a1a14', '#5b3a29', '#8a5a3a', '#d8b26a', '#c94f6a', '#3b3f7a', '#e8e8f0', '#141414', '#7a4fd0'];
const TOPS = ['#ef6a5b', '#2fb3a3', '#f6b92b', '#6c8cf0', '#c779d9', '#ff9d5c', '#5ac26e', '#f4f4f8', '#2b2b3a', '#ff7ab6'];
const BOTS = ['#f4f4f8', '#2d3a5a', '#3d5a4a', '#e8a0b8', '#2b2b3a', '#c9b48a', '#8b5cf6'];
const SOCKS = ['#6c8cf0', '#f4f4f8', '#2b2b3a', '#ff7ab6', '#5ac26e', '#f6b92b'];
const SHOES = ['#f4f4f8', '#2b2b3a', '#ef6a5b', '#6c8cf0', '#f6b92b'];
Outfit.init(G); Creator.init({ G, $, store, closePanels, drawPortrait });   // [创建面板] js/outfit.js + js/creator.js 需要游戏状态
const SONGS = (window.SongData && SongData.LIST) || [];   // 歌曲表在 js/songs.js（含每首歌的时长）
const GRACE = 25;                                                  // 轮到你后，走上舞台的时间（秒）

/* ---------------- tiny UI helpers ---------------- */
let toastT = 0;
function toast(msg, ms) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms || 1800); }
function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
function setCoins(n) { G.coinCount = n; $('coinN').textContent = fmt(n); store.set('coins', n); }
function addMsg(ch, name, text, me, sys, isGM) {
  const L = G.chat[ch]; L.push({ name, text, me, sys, isGM: !!isGM }); if (L.length > 80) L.shift();
  if (ch === G.tab) appendLog({ name, text, me, sys });
}
function appendLog(m) {
  const log = $('log'), d = document.createElement('div'); d.className = 'm' + (m.me ? ' me' : '') + (m.sys ? ' sys' : '');
  if (m.sys) d.textContent = m.text; else { if (m.isGM) { const badge = document.createElement('span'); badge.className = 'gm-badge'; badge.textContent = '✦ GM ✦'; d.append(badge, ' '); } const b = document.createElement('b'); b.textContent = m.name; d.append(b, ': ' + m.text); }
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 12; log.appendChild(d); while (log.children.length > 80) log.removeChild(log.firstChild); if (stick) log.scrollTop = log.scrollHeight;
}
function renderLog() { $('log').innerHTML = ''; G.chat[G.tab].forEach(appendLog); $('log').scrollTop = 1e9; }

/* ---------------- outfits ---------------- */
function rgb(hexc, k) { const c = hexc.replace('#', ''); return [parseInt(c.slice(0, 2), 16) / 255 * (k || 1), parseInt(c.slice(2, 4), 16) / 255 * (k || 1), parseInt(c.slice(4, 6), 16) / 255 * (k || 1)]; }
/* [创建面板] 外观逻辑搬到了 js/outfit.js（脸型 / 发型 / 性别 / 耳朵 / 套装 / 颜色）。
   这里只留两个同名入口，让 game.js 和 net.js 原来的调用（applyOutfit / DEFAULT_OUTFIT）不用改。 */
function applyOutfit(inst, o) { Outfit.applyOutfit(inst, o); inst.scale = (o.scale || 1) * 1.4; }
const DEFAULT_OUTFIT = Outfit.DEFAULT_OUTFIT;
/* ---------------- entities ---------------- */
function makeEntity(x, z, name, outfit, isMe) {
  const inst = GLBChar.makeInstance(G.model, G.GR); inst.play('idle', .01); inst.isMe = !!isMe;
  const e = { x, y: 0, z, name, outfit, isMe: !!isMe, inst, yaw: rand(-PI, PI), vx: 0, vz: 0, wait: rand(0, 5), target: null, stuck: 0, moving: false, run: false, bubble: null, bt: 0, pose: 0, mode: 'wander', phase: rand(0, 6), nearT: 0, canStage: false, sit: null, sitT: 0, sitP: 1, cheerT: 0, sing: false };
  applyOutfit(inst, outfit); inst.yaw = e.yaw; inst.pos = [x, 0, z]; inst.update(rand(0, 2));
  return e;
}
function blocked(sc, x, z, r, e) {
  if (sc.stageZone && sc.stageZone(x, z, r)) {
    /* 舞台只允许「轮到的演唱者」走上去。已经在台上 / 刚走下台阶、还贴在舞台边缘的人，要能继续往外走。
       （旧版只认「脚下就在舞台里」：走下最后一级台阶后脚下已不在舞台，但人物半径还碰着舞台边缘，往哪走都判堵 → 卡在楼梯口。） */
    if (!(e && e.canStage)) {
      const onStage = !!(e && sc.stageZone(e.x, e.z, 0)), atEdge = !!(e && sc.stageZone(e.x, e.z, r + .06));
      if (!(onStage || atEdge) || (!onStage && sc.stageZone(x, z, 0))) return true;
    }
  }
  else if (sc.walkable) { if (!sc.walkable(x, z)) return true; }
  else { const b = sc.bounds; if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return true; }
  const up = e ? e.y > 2.1 : false;
  for (const o of sc.obstacles) { if (o.f != null && o.f !== (up ? 1 : 0)) continue; if (x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) return true; }
  return false;
}
/* GM 飞行加速：FLY.on（只有 GM 能开）时，自己的人物无视建筑和物体（不碰撞），速度 ×FLY.mul；
   高度仍然由 heightAt 决定，所以走到楼梯 / 台阶 / 斜坡会正常升降，不会陷进地板。地图边界保留，不会飞出地图。 */
const FLY = window.GMFly = { on: false, mul: 4 };
const flying = () => !!(FLY.on && window.GM && window.GM.isGM);
function moveEnt(e, dx, dz, sc) {
  if (e.isMe && flying()) { const b = sc.bounds; e.x = b ? Math.max(b.x0, Math.min(b.x1, e.x + dx)) : e.x + dx; e.z = b ? Math.max(b.z0, Math.min(b.z1, e.z + dz)) : e.z + dz; return !!(dx || dz); }
  const r = .32; let moved = false;
  if (dx && !blocked(sc, e.x + dx, e.z, r, e)) { e.x += dx; moved = true; }
  if (dz && !blocked(sc, e.x, e.z + dz, r, e)) { e.z += dz; moved = true; }
  return moved;
}
function fixTarget(sc, x, z) {
  const st = sc.stage;
  if (sc.stageZone && sc.stageZone(x, z, .3) && !G.me.canStage) { z = st.z1 + 2.2; }
  for (let k = 0; k < 40 && sc.walkable && !sc.walkable(x, z); k++) { x *= .96; z = 4 + (z - 4) * .96; }
  return [x, z];
}
function randomSpot(sc) { for (let k = 0; k < 40; k++) { const r = sc.npcRect, x = rand(r.x0, r.x1), z = rand(r.z0, r.z1); if (!blocked(sc, x, z, .6)) return [x, z]; } return [sc.spawn[0], sc.spawn[1]]; }

/* ---------------- scene switching ---------------- */
/* ======================= integration glue (maps <-> hub, seats, interactions, buttons) ======================= */
const HUB = [['plaza', '星光广场', '⭐'], ['merdeka', '独立广场', '🏛️'], ['bukit', '武吉免登', '🌃'], ['klcc', 'KLCC 双子塔', '🏙️'], ['beach', '星光海滩', '🏖️'], ['funfair', '星光嘉年华', '🎡']];   // KTV / 试衣间 are buildings inside the plaza, not hub maps
const HUB_DROP = { klcc: ['to_bukit', 'monorail_k'], bukit: ['monorail'], beach: ['plaza'], funfair: ['plaza'], merdeka: ['plaza'] };   // each map's own travel portals -> replaced by ONE hub portal
const HUB_AT = { plaza: [-10, 10] };
/* 动作菜单：c=动画名（也是联机同步用的名字，最长 12 个字符，且必须写进 net.js 的 POSES）  t=持续秒数  b=头顶气泡  sit=坐着能不能做
   ✔ 和 ❌ 放在最前面。 */
const ACTIONS = [
  { c: 'signok', n: '对', i: '✔', t: 4, b: '✔ 对！', sit: true, col: '#2eb25c' },
  { c: 'signno', n: '错', i: '❌', t: 4, b: '❌ 不对', sit: true, col: '#e2343a' },
  { c: 'wave', n: '挥手', i: '👋', t: 3, b: '嗨～', sit: true },
  { c: 'dance', n: '跳舞', i: '💃', t: 5, b: '♪ ♪' },
  { c: 'cheer', n: '欢呼', i: '🙌', t: 4, b: '耶！', sit: true },
  { c: 'clap', n: '拍手', i: '👏', t: 4, b: '👏', sit: true },
  { c: 'photo', n: '拍照', i: '✌', t: 3.4, b: '✌ 耶！', sit: true },
  { c: 'bow', n: '鞠躬', i: '🙇', t: 2.4, b: '谢谢大家～' },
  { c: 'heart', n: '比心', i: '💗', t: 3.2, b: '💗', sit: true },
  { c: 'thumbs', n: '点赞', i: '👍', t: 3, b: '👍', sit: true },
  { c: 'point', n: '指向', i: '👉', t: 3, b: '看那边！', sit: true }
];
function pay(c, ok, msg) { if (G.coinCount < c) { toast('金币不够啦（需要 ' + c + '）'); return false; } setCoins(G.coinCount - c); toast(ok, 2400); if (msg) setBubble(G.me, msg); return true; }
function addSeat(sc, x, z, yaw, h) { const ap = [x + Math.sin(yaw) * 1.15, z + Math.cos(yaw) * 1.15], q = { x, z, yaw, h, ap, who: null, res: null }; q.hot = { id: 'sit', seat: q, x: ap[0], z: ap[1], r: 1.4 }; (sc.seats = sc.seats || []).push(q); return q; }
const PORTAL_UI = { boutique: ['👗', '试衣间'], ktv: ['🎤', 'K歌厅'], pavilion: ['🛍️', '商场'], plaza: ['🚪', '回广场'] };
function setEnter(best) {   // the yellow button lives above the six action buttons: grey + unclickable unless something is in range
  const b = $('enterBtn'), tx = $('enterText'), ic = $('enterIcon'); if (!b) return;
  b.disabled = !best;
  if (!best) { tx.textContent = '互动'; ic.textContent = '🚪'; return; }
  const isPortal = G.scene.portals.includes(best), u = PORTAL_UI[best.id];
  tx.textContent = best.btn ? best.btn : best.id === 'sit' ? '坐下' : best.id === 'stand' ? '起身' : best.id === 'songs' ? '点歌' : best.id === 'wardrobe' ? '试衣镜' : best.hub ? '传送阵' : best.id === 'elev' ? '电梯' : isPortal ? (u ? (best.id === 'plaza' ? u[1] : '进入 ' + u[1]) : '进入 ' + (best.label || '')) : (best.label || '互动');
  ic.textContent = best.hub ? '🌀' : typeof best.icon === 'string' && best.icon ? best.icon : best.id === 'sit' ? '🪑' : best.id === 'stand' ? '🧍' : best.id === 'songs' ? '🎵' : best.id === 'wardrobe' ? '👗' : (u ? u[0] : '🚪');
}
function openHub() {
  const root = $('hubOpts'); root.innerHTML = '';
  HUB.forEach(([id, name, ic]) => { const b = document.createElement('button'); b.className = 'floor' + (G.sceneId === id ? ' on' : ''); b.innerHTML = `<b>${ic}</b><span>${name}</span>`; b.disabled = G.sceneId === id;
    b.onclick = () => { closePanels(); toast('传送中 → ' + name, 1500); goTo(id, null); }; root.appendChild(b); });
  $('hubPanel').hidden = false;
}
/* Bukit Bintang's own hotspots (the scene file itself has no onUse) */
function bukitUse(n, api) {
  const G = api.G, toast = api.toast, setBubble = api.setBubble, setCoins = api.setCoins, pay = api.pay;
  switch (n.id) {
    case 'teh': pay(15, '🥤 拉茶一杯！-15 金币，拉得真高～', '好喝！'); break;
    case 'satay': pay(20, '🍢 沙爹 10 串，花生酱超香！-20 金币', '沙爹赞！'); break;
    case 'durian': pay(30, '🍈 猫山王榴莲！好臭但好吃 -30 金币', '榴莲万岁'); break;
    case 'roti': pay(12, '🥞 印度煎饼配咖喱 -12 金币', '好烫！'); break;
    case 'fountain': if (pay(10, '⛲ 你投了一枚硬币，默默许了愿…', '许愿～')) { if (Math.random() < .3) setTimeout(() => { setCoins(G.coinCount + 50); toast('✨ 愿望成真！+50 金币', 2400); }, 1200); } break;
    case 'photo': G.me.pose = 3.4; G.me.actClip = 'cheer'; G.me.yaw = 0; setBubble(G.me, '✌ KL！'); $('fade').classList.add('on'); setTimeout(() => $('fade').classList.remove('on'), 140); toast('📸 咔嚓！已保存到相册（演示）', 2400); break;
    case 'busker': if (pay(5, '🎸 你给艺人打赏了 5 金币，他为你弹了一曲', '♪')) { G.me.pose = 4; G.me.actClip = 'clap'; } break;
    case 'pavilion': toast('🛍 Pavilion 商场室内：下一个场景，开发中', 2600); break;
    default: return false;
  }
  return true;
}
/* make sure every seat has a walkable stand-up spot (benches' obstacle boxes can swallow the default one) */
function fixSeatAp(sc) {
  for (const s of sc.seats || []) {
    if (!blocked(sc, s.ap[0], s.ap[1], .3)) continue;
    let done = false;
    for (const d of [1.15, 1.5, 1.9, 2.4, 2.9]) { for (const ang of [0, .5, -.5, 1, -1, 1.6, -1.6, 2.4, -2.4, 3.14]) { const a = s.yaw + ang, x = s.x + Math.sin(a) * d, z = s.z + Math.cos(a) * d; if (!blocked(sc, x, z, .3)) { s.ap = [x, z]; if (s.hot) { s.hot.x = x; s.hot.z = z; } done = true; break; } } if (done) break; }
  }
}
/* 出生点和传送阵放在一起：把传送阵挪到出生点旁边（约 3 米，优先放在人物正前方），玩家一进图就能看到。
   先找「周围一圈都没有障碍」的位置，找不到再放宽，最后实在没有就保持原位。 */
function placeHubAtSpawn(sc, hub) {
  if (!sc.spawn) return false;
  const sx = sc.spawn[0], sz = sc.spawn[1], DIST = [3.2, 3.8, 4.6, 2.6], ANG = [0, .6, -.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6, PI];   // 角度 0 = 正前方（-z，镜头看过去的方向）
  const ringFree = (x, z) => { for (let k = 0; k < 8; k++) if (blocked(sc, x + Math.cos(k * PI / 4) * 1.1, z + Math.sin(k * PI / 4) * 1.1, .2)) return false; return true; };
  for (const strict of [true, false]) for (const d of DIST) for (const a of ANG) {
    const x = sx + Math.sin(a) * d, z = sz - Math.cos(a) * d;
    if (!blocked(sc, x, z, .5) && (!strict || ringFree(x, z))) { hub.x = x; hub.z = z; return true; }
  }
  return false;
}
function glueScene(id, sc) {
  // 1) one hub portal per map
  if (HUB.some(h => h[0] === id)) {
    let hub = null; const drop = HUB_DROP[id] || [];
    for (const p of sc.portals) if (drop.includes(p.id)) { hub = p; break; }
    if (hub) { for (let i = sc.portals.length - 1; i >= 0; i--) if (drop.includes(sc.portals[i].id) && sc.portals[i] !== hub) sc.portals.splice(i, 1); }
    else { const at = HUB_AT[id]; if (at) { hub = { x: at[0], z: at[1] }; sc.portals.push(hub); } }
    if (hub) { Object.assign(hub, { id: 'hub', hub: true, label: '传送阵', icon: '🌀', color: [.55, .8, 1], r: 1.6 }); delete hub.to; delete hub.spawn; delete hub.auto; placeHubAtSpawn(sc, hub); }
  }
  if (id === 'bukit') { sc.hotspots = sc.hotspots.filter(h => h.id !== 'skybridge'); if (!sc.onUse) sc.onUse = bukitUse; }
  // 2) seats for maps that do not define any (Bukit Bintang benches, beach benches + fire logs)
  if (!sc.seats || !sc.seats.length) {
    if (id === 'bukit') [40, 90, 135, -40, -90, -135].forEach(d => { const th = d * Math.PI / 180, cx = 10.2 * Math.sin(th), cz = 4 - 10.2 * Math.cos(th), yaw = -th; [-.55, .55].forEach(lx => addSeat(sc, cx + lx * Math.cos(yaw), cz - lx * Math.sin(yaw), yaw, .49)); });
    if (id === 'beach') { [[-40, 23.13], [-26, 19.69], [-10, 18.91], [6, 23.7], [22, 21.27], [38, 18.19]].forEach(([x, z]) => [-.55, .55].forEach(o => addSeat(sc, x + o, z, 0, .58)));
      [[8.23, 14], [3.7, 13.94], [3.77, 9.41], [8.3, 9.48]].forEach(([x, z]) => addSeat(sc, x, z, Math.atan2(6 - x, 11.7 - z), .38)); }
  }
  fixSeatAp(sc);
}

function getScene(id) {
  if (!G.scenes[id]) G.scenes[id] = (Scenes.isKtvId && Scenes.isKtvId(id)) ? Scenes.makeTianhuang(id, G.R, G.T) : id === 'klcc' && Scenes.makeKlcc ? Scenes.makeKlcc(G.R, G.T, G.style) : id === 'bukit' && Scenes.makeBukit ? Scenes.makeBukit(G.R, G.T, G.style) : id === 'beach' && Scenes.makeBeach ? Scenes.makeBeach(G.R, G.T) : id === 'funfair' && Scenes.makeFunfair ? Scenes.makeFunfair(G.R, G.T) : id === 'merdeka' && Scenes.makeMerdeka ? Scenes.makeMerdeka(G.R, G.T) : id === 'plaza' ? Scenes.makePlazaV3(G.R, G.T, G.style) : id === 'ktv' ? Scenes.makeKTV(G.R, G.T) : (Scenes.makeBoutiqueV2 || Scenes.makeBoutique)(G.R, G.T);
  if (!G.scenes[id]._glued) { G.scenes[id]._glued = true; glueScene(id, G.scenes[id]); }
  return G.scenes[id];
}
function curCam(sc) { return (G.wide && sc.cameraWide) ? Object.assign({}, sc.camera, sc.cameraWide) : sc.camera; }
function applyView() { const sc = G.scene, c = curCam(sc); G.cam.pitch = c.pitch; G.cam.dist = c.dist; G.cam.fov = c.fov; const b = $('viewBtn'); if (b) { b.hidden = !sc.cameraWide; b.textContent = '📷 视角：' + (G.wide ? '广角' : '原版'); } }
function enterScene(id, spawn) {
  G.scene = getScene(id); G.sceneId = id; G.target = null;
  const s = spawn || G.scene.spawn; G.me.x = s[0]; G.me.z = s[1]; G.me.y = G.scene.heightAt(s[0], s[1]); G.me.vx = G.me.vz = 0;
  G.me.yaw = 0; applyView(); G.cam.ty = G.me.y; G.cam.target = [s[0], 0, s[1] - (G.scene.camera.lead == null ? 2 : G.scene.camera.lead)];
  G.me.singing = false; G.me.sit = null; G.me.canStage = false; G.ktv = { queue: [], cur: null, arrived: false, online: false, mine: false, doneOk: false }; G.stg = { mode: 'idle', queue: [] }; (G.scene.seats || []).forEach(q => { q.who = null; q.res = null; });
  G.near = null; setEnter(null); G.hubLock = true; G.me.actClip = null; if (window.Music) Music.setScene(id);
  spawnCoins(); $('banner').hidden = true; $('sceneName').textContent = G.scene.name; closePanels();
  addMsg('world', '', '— 你来到了「' + G.scene.name + '」—', false, true);
  G.autoCool = 1.3;
  if (window.Net) Net.onScene(id);
}
function goTo(id, spawn) {
  if (G.transitioning) return; G.transitioning = true; $('fade').classList.add('on');
  setTimeout(() => { enterScene(id, spawn); setTimeout(() => { $('fade').classList.remove('on'); G.transitioning = false; }, 120); }, 300);
}

/* ---------------- 舞台队列 ----------------
   联机时：队列在服务器上（每个房间一个），所有人看到同一份；单机时：本地排队，只有我一个。
   演唱时长 = 这首歌的时长（js/songs.js）。 */
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const stageLive = () => !!(window.Net && Net.inRoom);
const stageClock = () => (G.ktv.online && window.Net) ? Net.now() : Date.now();
function stageCmd(action) {                       // 'arrived' | 'done' | 'leave'
  const K = G.ktv;
  if (K.online) { Net.send({ type: 'stage_' + action }); return; }
  if (action === 'done' || action === 'leave') { K.cur = null; }
}
function startMyTurn() {
  const st = G.scene.stage; if (G.me.sit) standUp(G.me); G.me.canStage = true; G.ktv.doneOk = false;
  toast('轮到你了！请在倒数结束前走上舞台 🎤', 2800); G.target = st && st.front ? [st.front[0], st.front[1] - 1.5] : null;
}
function stopMyTurn() {                           // 我的这一轮结束了（唱完 / 离开舞台 / 超时 / 掉线）
  const K = G.ktv, st = G.scene.stage, ok = K.doneOk, song = K.lastSong || ''; K.doneOk = false;
  G.me.singing = false; G.me.sing = false; G.me.canStage = false; G.me.ejectT = 4;
  if (G.scene.stageZone && G.scene.stageZone(G.me.x, G.me.z, .5) && st) G.target = [st.front[0], st.front[1]];
  if (ok) { setCoins(G.coinCount + 200); toast('演唱完成！+200 金币 🎉', 2400); addMsg('world', '', '你演唱了《' + song + '》，获得 200 金币', false, true); }
}
function stageReset() { const K = G.ktv; if (K.mine) stopMyTurn(); G.ktv = { queue: [], cur: null, arrived: false, online: false, mine: false, doneOk: false }; }
function enqueueMe(s) {
  const K = G.ktv;
  if (K.queue.some(x => x.you) || (K.cur && K.cur.you)) return toast('你已经点过歌啦，先排队吧');
  if (stageLive()) { K.online = true; Net.send({ type: 'stage_join', song: s.name, dur: s.dur }); toast('已点歌：' + s.name + '（' + fmtT(s.dur) + '），排队中…'); return; }
  K.queue.push({ name: '我', you: true, song: s.name, artist: s.artist, dur: s.dur });
  if (!K.cur) { const q = K.queue.shift(); K.cur = Object.assign({}, q, { phase: 'wait', end: Date.now() + GRACE * 1000 }); }
  toast('已点歌：' + s.name + '（' + fmtT(s.dur) + '）'); renderQueue();
}
function ktvUpdate(dt) {
  const K = G.ktv, sc = G.scene, st = sc.stage; if (!st) return;
  if (K.online && !stageLive()) { stageReset(); toast('和服务器断开了，舞台队列已清空', 2200); return; }
  const now = stageClock(), c = K.cur, mine = !!(c && c.you);
  if (mine && !K.mine) startMyTurn();
  if (!mine && K.mine) stopMyTurn();
  K.mine = mine; if (c && c.you) K.lastSong = c.song;
  K.arrived = !!(c && c.phase === 'sing');
  if (c) {
    const singer = c.you ? G.me : (window.Net && Net.remote(c.pid)) || null, mic = st.mic;
    if (mine && K.sentFor !== c) {
      const d = Math.hypot(G.me.x - mic[0], G.me.z - mic[1]);
      if (c.phase === 'wait') {
        if (d < (st.arriveR || 2.4)) { c.phase = 'sing'; c.end = now + c.dur * 1000; K.arrived = true; stageCmd('arrived'); }
        else if (now > c.end + 800) { toast('你没有及时上台，已跳过'); K.sentFor = c; stageCmd('leave'); }
      } else if (d > (st.leaveR || 3.4)) { toast('你离开了舞台，演唱结束'); K.sentFor = c; stageCmd('leave'); }
      else if (now >= c.end) { K.doneOk = true; K.sentFor = c; stageCmd('done'); }
    }
    if (mine) { G.me.sing = K.arrived; G.me.singing = K.arrived; if (K.arrived) G.me.yaw = 0; }
    if (K.arrived && singer && Math.random() < dt * .8) setBubble(singer, pick(['♪', '♫', '♪♪', '🎵']));
    const left = Math.max(0, (c.end - now) / 1000), nxt = K.queue.length ? '　下一位：' + K.queue[0].name : '';
    const bn = $('banner'); bn.hidden = false; bn.textContent = '';
    const nm = document.createElement('b'); nm.textContent = c.name; const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = '⏱ ' + fmtT(left);
    bn.append(K.arrived ? '🎤 ' : '🎤 请上台：', nm, K.arrived ? ' 《' + c.song + '》 ' : ' ', tm, nxt);
    G.stg = { mode: K.arrived ? 'sing' : 'wait', name: c.name, song: c.song, left, total: K.arrived ? c.dur : GRACE, queue: K.queue.map(q => q.name), you: mine };
  } else { $('banner').hidden = true; G.stg = { mode: 'idle', queue: K.queue.map(q => q.name) }; }
  renderQueue();
}
if (window.Net) Net.on('stage', m => {           // 服务器下发：这个房间的排队情况（唯一的真相）
  const K = G.ktv, my = Net.myId(); K.online = true;
  K.queue = (m.queue || []).map(q => Object.assign({}, q, { you: q.pid === my }));
  K.cur = m.cur ? Object.assign({}, m.cur, { you: m.cur.pid === my }) : null;
});
if (window.Net) Net.on('stage_skip', () => { toast('你没有及时上台，已跳过'); });
let qKey = '';
let songFilter = 'all';
let songQuery = '';
let songFavs = new Set(Array.isArray(store.get('songFavs', [])) ? store.get('songFavs', []) : []);
function renderSongList() {
  const list = $('songList'), empty = $('songEmpty');
  if (!list || !empty) return;
  const q = songQuery.trim().toLocaleLowerCase();
  const matches = SONGS.filter(s => {
    if (songFilter === 'fav' && !songFavs.has(s.name)) return false;
    if (!q) return true;
    return (s.name + ' ' + s.artist).toLocaleLowerCase().includes(q);
  });
  list.textContent = '';
  matches.forEach(s => {
    const b = document.createElement('div'); b.className = 'song';
    const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'song-pick';
    const main = document.createElement('span'); main.className = 'song-main'; main.append(document.createTextNode(s.name));
    const sm = document.createElement('small'); sm.textContent = s.artist + ' · ' + fmtT(s.dur) + (s.acc ? ' · 🎵有伴奏' : ' · 清唱'); main.appendChild(sm);
    const fav = document.createElement('button'); fav.type = 'button'; fav.className = 'song-fav' + (songFavs.has(s.name) ? ' on' : ''); fav.textContent = songFavs.has(s.name) ? '★' : '☆'; fav.title = songFavs.has(s.name) ? '取消收藏' : '收藏歌曲'; fav.setAttribute('aria-label', fav.title);
    fav.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (songFavs.has(s.name)) songFavs.delete(s.name); else songFavs.add(s.name);
      store.set('songFavs', [...songFavs]); renderSongList();
    });
    pick.appendChild(main); pick.addEventListener('click', () => enqueueMe(s));
    b.append(pick, fav);
    list.appendChild(b);
  });
  empty.hidden = matches.length !== 0;
}
function bindSongSearch() {
  const input = $('songSearch'), all = $('songAll'), fav = $('songFavOnly');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = '1';
  input.addEventListener('input', () => { songQuery = input.value; renderSongList(); });
  const setFilter = mode => { songFilter = mode; all.classList.toggle('on', mode === 'all'); fav.classList.toggle('on', mode === 'fav'); renderSongList(); };
  all.addEventListener('click', () => setFilter('all'));
  fav.addEventListener('click', () => setFilter('fav'));
}
function renderQueue() {
  const K = G.ktv, el = $('queueList'); if ($('songPanel').hidden) { qKey = ''; return; }
  const rows = []; if (K.cur) rows.push(Object.assign({}, K.cur, { now: true })); K.queue.forEach(x => rows.push(x));
  const key = JSON.stringify(rows.map(x => [x.name, x.song, !!x.now, !!x.you])); if (key === qKey) return; qKey = key;
  el.textContent = '';
  if (!rows.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = '还没有人点歌，来当第一个吧！'; el.appendChild(p); return; }
  rows.forEach((x, i) => {
    const d = document.createElement('div'); d.className = 'q' + (x.now ? ' now' : '') + (x.you ? ' you' : '');
    const a = document.createElement('span'); a.textContent = x.now ? '🎤' : String(i);
    const b = document.createElement('span'), n = document.createElement('b'); n.textContent = x.name; b.append(n, ' — ' + x.song);
    d.append(a, b); el.appendChild(d);
  });
}
function openSongs() {
  bindSongSearch();
  songQuery = $('songSearch').value || '';
  renderSongList();
  $('songHint').textContent = (G.scene.private ? '包间点歌：' : '点歌排队（同一张地图的玩家共用一个队列）：') + '轮到你时有 25 秒走上舞台；上台后演唱时间 = 整首歌的时长，电视和左上角都有倒数；台上只有演唱者，其他人在台下观看。上台后会自动开麦克风并播放伴奏。';
  $('songPanel').hidden = false; qKey = ''; renderQueue();
}

/* ---------------- seats ---------------- */
const SIT_DROP = .56;
function PHONE_K() { return innerHeight <= 480 ? 1.3 : 1; }   // 手机横屏人物放大，平板不变
function sitDown(e, s) { if (!s || s.who) return; if (G.ktv.cur && G.ktv.cur.you && e.isMe) return; e.sit = s; s.who = e; s.res = null; e.sitP = 0; e.sitFrom = [e.x, e.z]; e.moving = false; e.target = null; e.yaw = s.yaw; if (e.isMe) G.target = null; }
function standUp(e) {
  const s = e.sit; if (!s) return; s.who = null; e.sit = null; e.sitP = 1;
  const sc = G.scene; let [x, z] = s.ap; if (blocked(sc, x, z, .3, e)) { x = s.x + Math.sin(s.yaw) * 1.2; z = s.z + Math.cos(s.yaw) * 1.2; } e.x = x; e.z = z; e.y = sc.heightAt(x, z); e.mode = e.isMe ? 'wander' : 'wander'; if (!e.isMe) { e.wait = rand(1, 4); e.target = null; }
}
function nearSeat(e, r) { let best = null, bd = r; for (const s of G.scene.seats || []) { if (s.who || s.res) continue; const d = Math.min(Math.hypot(e.x - s.ap[0], e.z - s.ap[1]), Math.hypot(e.x - s.x, e.z - s.z)); if (d < bd) { bd = d; best = s; } } return best; }

/* ---------------- wardrobe ---------------- */
function openActions() {
  const grid = $('actGrid'); grid.innerHTML = '';
  ACTIONS.forEach(A => {
    const b = document.createElement('button'); b.className = 'actb'; b.innerHTML = `<span class="ai">${A.i}</span>${A.n}`; if (A.col) b.style.setProperty('--ac', A.col);
    if (G.me.sit && !A.sit) b.classList.add('off');
    b.onclick = () => { if (G.me.sit && !A.sit) return toast('这个动作要先起身再做', 1400); closePanels(); G.me.pose = A.t; G.me.actClip = A.c; setBubble(G.me, A.b); toast(A.n, 1000); };
    grid.appendChild(b);
  });
  $('actPanel').hidden = false;
}
function openWardrobe() { Creator.open(); }   // [创建面板] 换装按钮 / 衣橱镜子 → 打开创建人物面板（js/creator.js）
/* ---------------- elevator (天皇巨星) ---------------- */
const FLOORS = [['ktv3', '3F', '欢唱包间 · 16 间'], ['ktv2', '2F', 'VIP 至尊包间 · 8 间'], ['ktv', '1F', '接待大堂']];
function openElev() {
  const root = $('elevOpts'); root.innerHTML = '';
  FLOORS.forEach(([id, f, t]) => { const b = document.createElement('button'); b.className = 'floor' + (G.sceneId === id ? ' on' : ''); b.innerHTML = `<b>${f}</b><span>${t}</span>`; b.disabled = G.sceneId === id;
    b.onclick = () => { closePanels(); const sp = getScene(id).elevSpawn; toast('叮～ 电梯前往 ' + f, 1500); goTo(id, sp); }; root.appendChild(b); });
  $('elevPanel').hidden = false;
}
function closePanels() { document.querySelectorAll('.sheet').forEach(p => p.hidden = true); }

/* ---------------- chat ---------------- */
function setBubble(e, text) { e.bubble = text.length > 26 ? text.slice(0, 25) + '…' : text; e.bt = 4.5; }
function sendChat(text) {
  text = text.trim(); if (!text) return;
  if (text.toLowerCase() === '/ver') return toast('当前版本：' + (window.APP_V || '?'), 3000);     // 聊天框输入 /ver 查看当前加载的版本号（确认更新有没有生效）
  if (text.toLowerCase() === '/gm') {      // GM 入口：聊天框输入 /gm，不发给任何人，直接打开 GM 密钥框，并把失败原因显示在屏幕上
    try {
      if (!window.GM || typeof GM.open !== 'function') return toast('GM 模块没有启动（gm.js 未加载或未绑定），版本 ' + (window.APP_V || '?'), 4000);
      GM.open();
      const gp = $('gmPanel'); if (!gp || gp.hidden) toast('GM 面板没有打开，版本 ' + (window.APP_V || '?'), 4000);
    } catch (e) { toast('GM 打开出错：' + (e && e.message || e), 5000); }
    return;
  } addMsg(G.tab, '我', text, true); setBubble(G.me, text); if (window.Net) Net.sendChat(G.tab, text);
}
/* ---------------- coins (plaza) ---------------- */
function spawnCoins() {
  G.coins = []; /* 地上不再掉金币（设定已取消） */
}

/* ---------------- update ---------------- */
function update(dt) {
  G.t += dt; const sc = G.scene, me = G.me;
  // time of day
  if (G.timeMode === 'auto') G.hour = (G.hour + dt / 15) % 24;
  // player input
  let ix = G.joy.x, iz = G.joy.z; const k = G.keys;
  if (k.ArrowLeft || k.a) ix -= 1; if (k.ArrowRight || k.d) ix += 1; if (k.ArrowUp || k.w) iz -= 1; if (k.ArrowDown || k.s) iz += 1;
  let mag = Math.hypot(ix, iz);
  if (me.sit && (mag > .3 || G.target)) standUp(me);
  if (mag > .12) { G.target = null; if (mag > 1) { ix /= mag; iz /= mag; mag = 1; } }
  else if (G.target) { const dx = G.target[0] - me.x, dz = G.target[1] - me.z, d = Math.hypot(dx, dz); if (d < .25) G.target = null; else { ix = dx / d; iz = dz / d; mag = 1; me.stuck += dt; } } else { ix = iz = mag = 0; }
  if (mag > .12 && !me.sit) {
    const run = mag > .85 && (G.joy.x || G.joy.z || k.Shift) ? 1 : 0, sp = (run ? 6.2 : 3.8) * (mag > .85 ? 1 : mag / .85) * (flying() ? FLY.mul : 1);
    const px = me.x, pz = me.z; moveEnt(me, ix / (mag || 1) * sp * dt, iz / (mag || 1) * sp * dt, sc);
    if (Math.hypot(me.x - px, me.z - pz) < sp * dt * .2) { if (G.target) { me.stuck += dt; if (me.stuck > .5) G.target = null; } } else me.stuck = 0;
    me.moving = true; me.run = !!run; me.pose = 0; me.actClip = null; const want = Math.atan2(ix, iz); let d = want - me.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); me.yaw += d * Math.min(1, dt * 12);
  } else me.moving = false;
  if (!me.sit) me.y = sc.heightAt(me.x, me.z);
  if (me.ejectT > 0) { me.ejectT -= dt; if (me.ejectT <= 0 && sc.stageZone && !me.canStage && sc.stageZone(me.x, me.z, .5)) { me.x = sc.stage.front[0]; me.z = sc.stage.front[1]; me.y = 0; G.target = null; } }
  if (sc.update) sc.update(G, dt);
  // soft separation
  const all = [me, ...(G.remotes || [])];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = all[i], b = all[j], dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz; if (d2 < .36 && d2 > 1e-5 && !a.sit && !b.sit) { const d = Math.sqrt(d2), p = (.6 - d) * .5; const ux = dx / d * p, uz = dz / d * p; if (a !== me && !a.remote) moveEnt(a, -ux, -uz, sc); else if (a === me) moveEnt(a, -ux * .3, -uz * .3, sc); if (b !== me && !b.remote) moveEnt(b, ux, uz, sc); } }
  // animation + bubbles
  for (const e of all) {
    const inst = e.inst; let clip = 'idle';
    inst.scale = (e.outfit.scale || 1) * 1.4 * PHONE_K();
    if (e.sit) { e.sitP = Math.min(1, e.sitP + dt / .35); const k = e.sitP * e.sitP * (3 - 2 * e.sitP), s = e.sit; e.x = e.sitFrom[0] + (s.x - e.sitFrom[0]) * k; e.z = e.sitFrom[1] + (s.z - e.sitFrom[1]) * k; e.y = s.h - SIT_DROP * k * (e.inst.scale / 1.4); e.yaw = s.yaw; e.moving = false; }
    if (e.cheerT > 0) e.cheerT -= dt;
    if (e.pose > 0) { e.pose = Math.max(0, e.pose - dt); clip = e.actClip || ((G.ktv.arrived && !e.sing && !e.sit && G.sceneId === 'plaza') ? 'cheer' : 'wave'); if (e.sit) clip = G.model.anims['sit_' + clip] ? 'sit_' + clip : 'sit'; } else if (e.sit) clip = 'sit'; else if (e.moving) clip = e.run ? 'run' : 'walk'; else if (e.sing) clip = 'sing'; else if (e.cheerT > 0) clip = 'cheer';
    inst.hidden.SignOK = clip.replace('sit_', '') !== 'signok'; inst.hidden.SignNo = clip.replace('sit_', '') !== 'signno';   // 举牌动作才显示牌子
    inst.play(clip, .2); inst.speed = e.moving ? (e.run ? 1 : (e.isMe ? 1.1 : 1.0)) : 1;
    if (e.vis !== false || e.isMe) inst.update(dt);
    inst.pos[0] = e.x; inst.pos[1] = e.y; inst.pos[2] = e.z; let d = e.yaw - inst.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); inst.yaw += d * Math.min(1, dt * 14);
    if (e.bt > 0) { e.bt -= dt; if (e.bt <= 0) e.bubble = null; }
  }
  // coins
  for (let i = G.coins.length - 1; i >= 0; i--) { const c = G.coins[i]; if (Math.hypot(c.x - me.x, c.z - me.z) < .9) { G.coins.splice(i, 1); setCoins(G.coinCount + 10); const [x, z] = randomSpot(sc); setTimeout(() => G.coins.push({ x, z, ph: rand(0, 6) }), 4000); } }
  if (G.scene.stage) ktvUpdate(dt);
  // interactions (portals / hotspots)
  let best = null, bd = 1e9; G.autoCool = Math.max(0, (G.autoCool || 0) - dt);
  for (const p of [...sc.portals, ...sc.hotspots]) { const d = Math.hypot(me.x - p.x, me.z - p.z); if (p.hub) { if (d > p.r + .8) G.hubLock = false; else if (d < p.r && !G.hubLock && !G.transitioning && !me.sit && $('hubPanel').hidden) { G.hubLock = true; openHub(); } } if (p.auto) { if (d < p.r && !G.autoCool && !G.transitioning && !me.sit) { G.autoCool = 2; goTo(p.id, p.spawn || null); } continue; } if (d < p.r && d < bd) { bd = d; best = p; } }
  if (me.sit) best = G.standHot; else if (!best) { const q = nearSeat(me, 1.5); if (q) best = q.hot; }
  if (best !== G.near) { G.near = best; setEnter(best); }
  // camera follow
  const cc = curCam(sc), tx = clamp(me.x, cc.clampX[0], cc.clampX[1]), tz = clamp(me.z - (cc.lead == null ? 2 : cc.lead), cc.clampZ[0], cc.clampZ[1]), a = 1 - Math.exp(-dt * 5);
  G.cam.ty = (G.cam.ty || 0) + (me.y - (G.cam.ty || 0)) * a; G.cam.target[0] += (tx - G.cam.target[0]) * a; G.cam.target[2] += (tz - G.cam.target[2]) * a;
}
/* ---------------- render ---------------- */
const dynFx = { spray: new MB(), beam: new MB(), spark: new MB(), pool: new MB(), glow: {} }, dynShadow = new MB(), dynGlow = new MB(), dynCoin = new MB();
const ovc = $('ov'), ov = ovc.getContext('2d');
function render() {
  const R = G.R, GR = G.GR, sc = G.scene, [w, h, dpr] = R.resize();
  const env = sc.env(G.hour), cam = G.cam;
  const view = R.setCamera({ target: [cam.target[0], 0.8 + (cam.ty || 0), cam.target[2]], dist: cam.dist, pitch: cam.pitch, fov: cam.fov }, w, h);
  R.begin(env, w, h, G.t);
  if (sc.updateOcclusion) { const dt2 = Math.min(.1, Math.max(.001, G.t - (G._ot == null ? G.t : G._ot))); G._ot = G.t; sc.updateOcclusion(view.eye, G.me, dt2); }
  // static opaque
  for (const b of sc.batches) if (b.mat.mode === 0 && !(b.fade < .995)) R.draw(b);
  // coins (opaque, billboard)
  dynCoin.v.length = 0; dynCoin.i.length = 0; dynCoin.n = 0;
  if (G.coins.length) {
    const c = Math.cos(cam.pitch), s = Math.sin(cam.pitch);
    for (const k of G.coins) { const sp = Math.abs(Math.cos(G.t * 2.6 + k.ph)) * .28 + .06, y = .9 + Math.sin(G.t * 3 + k.ph) * .08, r = .24;
      dynCoin.quad([k.x - sp, y - r * c, k.z + r * s], [k.x + sp, y - r * c, k.z + r * s], [k.x + sp, y + r * c, k.z - r * s], [k.x - sp, y + r * c, k.z - r * s], [0, 0, 1], [0, 0, 1, 1], [1, 1, 1]); }
    R.drawDynamic(dynCoin, { tex: G.T.coin, em: G.T.coinEm, emDay: .55, emNight: 1.4 });
  }
  // shadows
  dynShadow.v.length = 0; dynShadow.i.length = 0; dynShadow.n = 0;
  const all = [G.me, ...(G.remotes || [])];
  for (const e of all) { const r = .5 * e.inst.scale; dynShadow.floor(e.x - r, e.z - r, e.x + r, e.z + r, e.y + .03, [0, 0, 0]); }
  R.drawDynamic(dynShadow, { tex: G.T.blob, mode: 3, glow: env.indoor ? .5 : .42 - .14 * env.night });
  // characters
  const px = (2 * cam.dist * Math.tan(cam.fov / 2)) / h, olw = G.outline ? Math.max(.007, px * 1.7) : 0;
  const lightDir = env.dir, rim = env.night > .5 ? [.7, .45, 1] : [.45, .55, 1];
  const vis = [];
  for (const e of all) {
    const p = R.project([e.x, e.y + .9, e.z]); if (!p || p[0] < -80 || p[0] > w + 80 || p[1] < -140 || p[1] > h + 140) { e.vis = false; continue; }
    e.vis = true; e.sx = p[0]; e.sy = p[1]; vis.push(e);
  }
  const ordered = vis.slice().sort((a, b) => Math.hypot(a.x - G.me.x, a.z - G.me.z) - Math.hypot(b.x - G.me.x, b.z - G.me.z));
  ordered.forEach((e, i) => {
    GR.draw(e.inst, view.VP, { light: lightDir, amb: env.charAmb, sun: env.charSun, view: [0, Math.sin(cam.pitch), Math.cos(cam.pitch)], outline: i < 26 ? olw : 0, line: env.line, rim });
  });
  // occluders that currently hide the player: translucent layer
  for (const b of sc.batches) if (b.mat.mode === 0 && b.fade < .995) R.draw(b);
  // glows & additive layers
  if (sc.dyn) {
    for (const k of ['spray', 'beam', 'spark', 'pool']) { const m = dynFx[k]; m.v.length = 0; m.i.length = 0; m.n = 0; }
    sc.dyn(dynFx, G.t, G, env); if (sc.dynPool) sc.dynPool(dynFx.pool, G, env, G.t); const gs = dynFx.glow;
    R.drawDynamic(dynFx.spray, { tex: G.T.glow, mode: 2, glow: gs.spray == null ? 1 : gs.spray });
    if (sc.tex && sc.tex.beam) R.drawDynamic(dynFx.beam, { tex: sc.tex.beam, mode: 2, glow: gs.beam });
    R.drawDynamic(dynFx.spark, { tex: G.T.glow, mode: 2, glow: gs.spark }); R.drawDynamic(dynFx.pool, { tex: G.T.glow, mode: 2, glow: 1 });
  }
  for (const b of sc.batches) if (b.mat.mode >= 2) R.draw(b);
  dynGlow.v.length = 0; dynGlow.i.length = 0; dynGlow.n = 0;
  for (const e of vis) {   // GM 发光光环：脚下两圈会呼吸的光环（金 + 紫）；GM 开着飞行加速时变大、变粉
    if (!e.isGM) continue; const fl = e.isMe && flying(), br = Math.sin(G.t * 3 + e.x), r0 = (fl ? 1.3 : .95) + .09 * br, r1 = r0 * .62 + .05 * Math.sin(G.t * 4.4 + 1), yy = e.y + .05;
    dynGlow.floor(e.x - r0, e.z - r0, e.x + r0, e.z + r0, yy, fl ? [1, .5, .85] : [1, .82, .35]); dynGlow.floor(e.x - r1, e.z - r1, e.x + r1, e.z + r1, yy + .01, fl ? [.8, .6, 1] : [.66, .45, 1]);
  }
  const pulse = .55 + .3 * Math.sin(G.t * 3.2);
  for (const p of [...sc.portals, ...sc.hotspots]) { if (p.auto) continue; const r = (p.r + .15 + .12 * Math.sin(G.t * 3.2)); dynGlow.floor(p.x - r, p.z - r, p.x + r, p.z + r, .05, p.color || [1, 1, 1]); }
  R.gl.useProgram(R.prog.p); R.gl.disable(R.gl.DEPTH_TEST); R.drawDynamic(dynGlow, { tex: G.T.ring, mode: 2, glow: pulse }); R.gl.enable(R.gl.DEPTH_TEST);   // 圈圈优先级最高：画在最上层
  // ---- overlay: names, bubbles
  ovc.width = w; ovc.height = h; ov.clearRect(0, 0, w, h); ov.textAlign = 'center'; ov.textBaseline = 'middle';
  const sc2 = dpr, fs = 12 * sc2;
  for (const e of vis) {
    const near = Math.hypot(e.x - G.me.x, e.z - G.me.z) < 6.5 || e.isMe || e.speaking;
    const top = R.project([e.x, e.y + 1.78 * e.inst.scale, e.z]); if (!top) continue;
    let y = top[1] - 6 * sc2;
    if (e.bubble) { ov.font = `600 ${fs}px system-ui,"PingFang SC","Noto Sans SC",sans-serif`; const tw = ov.measureText(e.bubble).width + 16 * sc2, bh = 22 * sc2; y -= bh + 20 * sc2 * (near ? 1 : 0); bubble(ov, top[0], y, tw, bh, e.bubble, sc2, window.ShopData && e.cos ? (ShopData.look(e.cos) || {}).bubble : null); y += bh + 4 * sc2; }
    if (near || e.bubble) {
      const cs = window.ShopData && e.cos ? ShopData.look(e.cos) : null, tt = cs && cs.title;   // 商店买的称号 / 名字颜色
      ov.font = `700 ${fs}px system-ui,"PingFang SC","Noto Sans SC",sans-serif`;
      const nw = ov.measureText(e.name).width, bw = e.isGM ? 42 * sc2 : 0, gap = e.isGM ? 5 * sc2 : 0, tf = Math.max(9, fs * .72);
      let tbw = 0; if (tt) { ov.font = `800 ${tf}px system-ui,"PingFang SC","Noto Sans SC",sans-serif`; tbw = ov.measureText(tt.name).width + 10 * sc2; ov.font = `700 ${fs}px system-ui,"PingFang SC","Noto Sans SC",sans-serif`; }
      const tg = tt ? 4 * sc2 : 0, tw = nw + bw + gap + tbw + tg + 14 * sc2, bh = 18 * sc2, ty = top[1] - 6 * sc2 - bh / 2, pl = top[0] - tw / 2, nameCx = pl + 7 * sc2 + tbw + tg + nw / 2;
      pill(ov, pl, ty - bh / 2, tw, bh, e.isGM ? 'rgba(43,20,82,.96)' : (e.isMe && !(cs && cs.nameColor) ? '#ffcf4a' : 'rgba(20,16,44,.78)'));
      if (tt) { const th = bh - 4 * sc2; pill(ov, pl + 7 * sc2, ty - th / 2, tbw, th, tt.bg); ov.font = `800 ${tf}px system-ui,"PingFang SC","Noto Sans SC",sans-serif`; ov.fillStyle = tt.fg; ov.fillText(tt.name, pl + 7 * sc2 + tbw / 2, ty + 1); ov.font = `700 ${fs}px system-ui,"PingFang SC","Noto Sans SC",sans-serif`; }
      ov.fillStyle = (cs && cs.nameColor) || (e.isMe ? '#2a1c00' : '#f4efff'); ov.fillText(e.name, nameCx, ty + 1);
      if (e.isGM) { ov.font = `900 ${Math.max(9, fs * .72)}px system-ui,sans-serif`; ov.fillStyle = '#ffdf75'; ov.fillText('✦ GM ✦', nameCx + nw / 2 + gap + bw / 2, ty + 1); }
      if (e.speaking) { const bx = top[0] + tw / 2 + 13 * sc2, r = 10 * sc2, pl = .5 + .5 * Math.sin(G.t * 9); ov.fillStyle = 'rgba(70,230,130,' + (.35 + .25 * pl) + ')'; ov.beginPath(); ov.arc(bx, ty, r + 3 * sc2 * pl, 0, 7); ov.fill(); ov.fillStyle = '#18c56a'; ov.beginPath(); ov.arc(bx, ty, r, 0, 7); ov.fill(); ov.font = `${12 * sc2}px system-ui,sans-serif`; ov.fillStyle = '#fff'; ov.fillText('🎙', bx, ty + 1); } }
  }
}
function pill(g, x, y, w, h, fill) { g.fillStyle = fill; g.beginPath(); const r = h / 2; g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill(); }
function bubble(g, cx, y, w, h, text, s, col) {
  g.fillStyle = (col && col.bg) || 'rgba(255,255,255,.95)'; g.beginPath(); const x = cx - w / 2, r = 9 * s; g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.lineTo(cx + 5 * s, y + h); g.lineTo(cx, y + h + 6 * s); g.lineTo(cx - 5 * s, y + h); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill();
  g.fillStyle = (col && col.fg) || '#251d3f'; g.fillText(text, cx, y + h / 2 + s);
}

/* ---------------- HUD clock ---------------- */
function updateClock() {
  const h = G.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60), env = envAt(h);
  $('timeText').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  $('timeIcon').textContent = env.night > .6 ? '🌙' : env.gold > .35 ? '🌇' : '☀️';
  $('timeMode').textContent = { auto: '自动', day: '白天', dusk: '黄昏', night: '夜晚' }[G.timeMode];
}

/* ---------------- input ---------------- */
function bindInput() {
  // joystick
  const joy = $('joy'), knob = $('knob'); let jid = null, jc = null;
  const jm = e => { const R = joy.getBoundingClientRect(), r = R.width / 2, cx = R.left + r, cy = R.top + r; let dx = e.clientX - cx, dz = e.clientY - cy; const d = Math.hypot(dx, dz), m = Math.min(1, d / r); if (d > 0) { dx /= d; dz /= d; } G.joy.x = dx * m; G.joy.z = dz * m; knob.style.transform = `translate(${dx * m * r * .6}px,${dz * m * r * .6}px)`; };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); jm(e); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jm(e); });
  const jend = e => { if (e.pointerId === jid) { jid = null; G.joy.x = G.joy.z = 0; knob.style.transform = ''; } };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  // keyboard
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; G.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true; if (e.key === 'e' || e.key === 'Enter') { if (G.near) interact(); } });
  addEventListener('keyup', e => { G.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
  // tap to move
  const gl = $('gl'); let down = null;
  const anySheetOpen = () => !!document.querySelector('.sheet:not([hidden])');
  gl.addEventListener('pointerdown', e => { if (anySheetOpen()) { down = null; return; } down = [e.clientX, e.clientY, performance.now()]; });
  gl.addEventListener('pointerup', e => {
    if (anySheetOpen()) { down = null; return; }
    if (!down || G.transitioning) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null; if (moved > 10) return;
    const dpr = G.R.canvas.width / G.R.canvas.clientWidth;
    { const px = e.clientX * dpr, py = e.clientY * dpr; let hit = null, hd = 1e9;   // 点到别的玩家 → 弹出菜单（组队 / 举报 / 拉黑），而不是走过去
      for (const r of G.remotes || []) { if (!r.vis || r.sx == null) continue; const d = Math.hypot(px - r.sx, py - r.sy), rad = 36 * dpr * Math.max(.85, r.inst.scale / 1.4); if (d < rad && d < hd) { hd = d; hit = r; } }
      if (hit && window.Social) { Social.openMenu(hit); return; } }
    const g = G.R.pickGround(e.clientX * dpr, e.clientY * dpr, G.me.y || 0), b = G.scene.bounds;
    G.target = fixTarget(G.scene, clamp(g[0], b.x0, b.x1), clamp(g[2], b.z0, b.z1)); G.me.stuck = 0; G.markT = 0.9;
  });
  // buttons
  $('enterBtn').onclick = interact;
  $('viewBtn').onclick = () => { G.wide = !G.wide; store.set('wide', G.wide); applyView(); };
  $('actions').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.act;
    if (a === 'pose') openActions();
    else if (a === 'wardrobe') openWardrobe();
    else if (a === 'chat') { $('chatIn').focus(); }
    else if (a === 'chorus') toast(G.scene.private ? '合唱：先在点歌机点歌，邀请好友后可一起上台（开发中）' : '合唱要在 KTV 大堂里使用，进去试试吧 🎤');
    else if (a === 'friends') { if (window.Friends) Friends.open(); }
    else if (a === 'gift') { if (window.Shop) Shop.open('gift'); else toast('礼物功能加载中…'); }
  });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; G.tab = b.dataset.ch; [...$('tabs').children].forEach(x => x.classList.toggle('on', x === b)); renderLog(); });
  $('chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat($('chatIn').value); $('chatIn').value = ''; });
  $('chatIn').addEventListener('keydown', e => e.stopPropagation());
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = closePanels);
  $('timeChip').onclick = () => { const order = ['auto', 'day', 'dusk', 'night'], i = (order.indexOf(G.timeMode) + 1) % 4; G.timeMode = order[i]; if (G.timeMode === 'day') G.hour = 12.5; if (G.timeMode === 'dusk') G.hour = 18.4; if (G.timeMode === 'night') G.hour = 22; updateClock(); };
  $('card').onclick = () => { if (window.Friends) Friends.openMe(); };
  $('serverBtn').onclick = () => toast(window.Net && Net.connected ? '已连接服务器 ✅' : '未连接服务器（离线单机）', 2200);
  $('gear').onclick = () => { $('setPanel').hidden = false; syncSeg(); };
  const seg = (id, key, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; fn(parseFloat(b.dataset.v)); syncSeg(); });
  seg('segQ', 'q', v => { G.quality = v; store.set('q', v); });
  seg('segOl', 'ol', v => { G.outline = v; store.set('ol', v); });
  addEventListener('contextmenu', e => e.preventDefault());
}
function syncSeg() { [['segQ', G.quality], ['segOl', G.outline]].forEach(([id, v]) => [...$(id).children].forEach(b => b.classList.toggle('on', parseFloat(b.dataset.v) === v))); }
function interact() {
  const n = G.near; if (!n || G.transitioning) return;
  if (G.scene.onUse && G.scene.onUse(n, { toast, goTo, setBubble, setCoins, G, pay })) return;
  if (n.hub) { openHub(); return; }
  if (n.to) { goTo(n.to, n.spawn); return; }
  if (n.id === 'sit') sitDown(G.me, n.seat); else if (n.id === 'stand') standUp(G.me); else if (n.id === 'songs') openSongs(); else if (n.id === 'wardrobe') openWardrobe(); else if (n.id === 'plaza') goTo('plaza', n.spawn); else if (n.id === 'elev') openElev(); else if (n.msg) toast(n.msg, 3000); else if (G.scene.portals.includes(n)) goTo(n.id, n.spawn || null);
}

/* ---------------- avatar portrait ---------------- */
function drawPortrait() {
  const gl = G.R.gl, GR = G.GR, me = G.me, S = 256, ctx = $('avatar').getContext('2d');
  const old = me.inst.pos.slice(), oy = me.inst.yaw; me.inst.pos = [0, 0, 0]; me.inst.yaw = 0.25; me.inst.update(0);
  gl.viewport(0, 0, S, S); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, S, S); gl.clearColor(.62, .56, .9, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
  const vp = GR.viewProj({ yaw: 0, pitch: 0, halfH: .43, target: [0, 2.3, 0] }, S, S);   // [头像] 对准头部+肩膀（角色已放大 1.4 倍，原来对准胸口所以只看到上衣）
  GR.draw(me.inst, vp, { outline: .006, amb: [.62, .6, .78], sun: [.45, .42, .26], line: [.23, .14, .17], light: [-.3, .5, 1], view: [0, 0, 1] });
  ctx.clearRect(0, 0, 128, 128); ctx.drawImage(G.R.canvas, 0, G.R.canvas.height - S, S, S, 0, 0, 128, 128);
  gl.disable(gl.SCISSOR_TEST); me.inst.pos = old; me.inst.yaw = oy;
}

/* ---------------- boot ---------------- */
async function boot() {
  const text = $('loadText');
  try {
    G.R = new Renderer($('gl'));
    G.GR = GLBChar.createRenderer($('gl'), {});
    text.textContent = '生成场景…';
    G.T = Scenes.makeTextures(G.R);
    G.T.coin = G.R.paint(64, 64, g => { const gr = g.createRadialGradient(24, 22, 4, 32, 32, 30); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(.6, '#f4b415'); gr.addColorStop(1, '#a86a00'); g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.strokeStyle = '#7a4f00'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#b57800'; g.font = '800 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', 32, 34); }, { clamp: true });
    G.T.coinEm = G.R.paint(64, 64, g => { g.fillStyle = '#4a3000'; g.fillRect(0, 0, 64, 64); }, { clamp: true });
    text.textContent = '加载角色模型…';
    let buf; if (window.GLB64) { const s = atob(window.GLB64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); buf = u.buffer; } else buf = await (await fetch('assets/girl.glb')).arrayBuffer();
    G.model = await GLBChar.loadModel(buf, G.GR); GLBChar.addActions(G.model);
    const saved = store.get('outfit', null); G.me = makeEntity(0, 2.5, (window.Profile && Profile.name) || '我', Object.assign({}, DEFAULT_OUTFIT, saved || {}), true);
    { const st = Scenes.PLAZA_STYLES[G.style] || Scenes.PLAZA_STYLES.cozy; G.hour = QS.get('t') ? parseFloat(QS.get('t')) : st.hour; if (QS.get('t')) G.timeMode = 'x'; }
    G.scene = getScene('plaza'); enterScene('plaza'); spawnCoins();
    if (QS.get('pz')) { G.me.z = parseFloat(QS.get('pz')); G.cam.target[2] = G.me.z - G.scene.camera.lead; }
    bindInput(); Creator.bind(); setCoins(G.coinCount); updateClock(); syncSeg(); renderLog();
    let last = performance.now(), clk = 0, firstPortrait = true;
    let errAt = -1e9;
    const frame = now => {
      requestAnimationFrame(frame);        // 先排下一帧：这一帧哪怕出错，游戏循环也不会停
      const dt = Math.min(.05, (now - last) / 1000); last = now; clk += dt;
      try {
        update(dt); render(); if (Creator.isOpen()) Creator.drawPreview(dt);   // [创建面板] 面板左边的实时预览
        if (firstPortrait) { firstPortrait = false; $('loading').classList.add('done'); try { drawPortrait(); } catch (e) { console.error(e); } }
        if (clk > .4) { clk = 0; updateClock(); }
      } catch (err) { if (now - errAt > 3000) { errAt = now; console.error('frame error', err); } }
    };
    // quality => canvas resolution scale
    const origResize = G.R.resize.bind(G.R);
    G.R.resize = function () {
      const q = Math.min(window.devicePixelRatio || 1, G.quality), cv = this.canvas, w = Math.max(2, Math.round(cv.clientWidth * q)), h = Math.max(2, Math.round(cv.clientHeight * q));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return [w, h, q];
    };
    requestAnimationFrame(frame);
    G.api = { goTo, openSongs, openWardrobe, enterScene, sitDown, standUp, nearSeat, makeEntity, applyOutfit, addMsg, setBubble, toast }; window.__game = G;
    if (window.Net) Net.start(G);
    if (store.get('new_char', false)) { store.set('new_char', false); setTimeout(() => Creator.open(), 600); }   // [创建面板] 新建角色后第一次进游戏：自动弹出创建人物面板
  } catch (err) { console.error(err); text.textContent = '加载失败：' + err.message + '（需要支持 WebGL2 的浏览器）'; }
}
(window.loginReady || Promise.resolve()).then(boot);
})();
