/* team.js — 组队（跨地图聊天 + 语音）、点击玩家菜单、举报 / 拉黑、说话指示。
   依赖 window.Net（net.js）、window.__game。界面全部用 JS 生成（名字都是网络来的，一律用 textContent，不拼 innerHTML）。
   对外：window.Team { inTeam() }，window.Social { hello(), isBlocked(pub), openMenu(entity), ... } */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const MAX_TEAM = 5;
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k.startsWith('on')) el[k] = v; else el.setAttribute(k, v); }
  kids.forEach(c => c != null && el.append(c));
  return el;
}
const toast = (m, ms) => window.__game && __game.api ? __game.api.toast(m, ms) : null;

/* ================= 黑名单 ================= */
let blocks = lsGet('sc_blocks', []);            // [{ pub, name }]
const blockSet = () => new Set(blocks.map(b => b.pub));
function saveBlocks() { lsSet('sc_blocks', blocks); Net.send({ type: 'blocks', list: blocks.map(b => b.pub), detail: blocks }); renderBlockList(); }
function block(pub, name, pid) {
  if (!pub || blockSet().has(pub)) return;
  blocks.push({ pub, name: String(name || '玩家').slice(0, 12) }); saveBlocks();
  if (pid) Net.dropVoice(pid);
  toast('已拉黑 ' + name + '：不会再看到 TA 的消息，也听不到 TA', 2200);
  if (T && T.members.some(m => m.pub === pub)) setTimeout(syncPeers, 300);
}
function unblock(pub) { blocks = blocks.filter(b => b.pub !== pub); saveBlocks(); toast('已取消拉黑', 1500); }
function renderBlockList() {
  const box = $('blockList'); if (!box) return;
  box.textContent = '';
  if (!blocks.length) { box.append(h('p', { class: 'hint', text: '黑名单是空的。点一下场景里的玩家，可以拉黑 / 举报。' })); return; }
  blocks.forEach(b => box.append(h('div', { class: 'blkRow' }, h('span', { text: b.name }), h('button', { class: 'chip', type: 'button', text: '取消拉黑', onclick: () => unblock(b.pub) }))));
}

/* ================= 队伍状态 ================= */
let T = null;                                     // { id, leader, members: [{ pub, name, pid, room, online }] }
let micOn = false, spkOn = true, micStream = null, micTrack = null;
const peers = new Map();                          // pid -> { pc, audio, an, buf, last, q }
let actx = null, silent = null, sigChain = Promise.resolve();

const savedTeam = () => lsGet('sc_team', null);
function saveTeam() { if (T) lsSet('sc_team', { id: T.id, leader: T.leader, members: T.members.map(m => ({ pub: m.pub, name: m.name })) }); else lsSet('sc_team', null); }
const me = () => ({ id: Net.myId(), pub: Net.myPub() });
const isLeader = () => !!(T && T.leader === me().pub);

window.Team = { inTeam: () => !!T, debug: () => ({ peers: [...peers].map(([k, p]) => [k.slice(0, 6), p.pc.connectionState, p.pc.iceConnectionState, !!p.audio, !!p.an]), mic: micOn, spk: spkOn, members: T && T.members.map(m => [m.name, (m.pid || '').slice(0, 6), m.online]), me: Net.myId().slice(0, 6) }) };
window.Social = {
  hello: () => ({ blocks: blocks.map(b => b.pub), blocksDetail: blocks, team: savedTeam() }),
  isBlocked: pub => !!pub && blockSet().has(pub),
  block, unblock, list: () => blocks.slice(),
  openMenu: e => openPlayerMenu(e),
};

/* ---------- 语音：每两个队员之间一条 WebRTC 连接（全网状，最多 5 人） ---------- */
function ensureCtx() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    actx = new AC(); const d = actx.createMediaStreamDestination(); silent = d.stream.getAudioTracks()[0];   // 静音轨：先占住发送位，开麦时 replaceTrack 换成真麦克风，不用重新协商
  }
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
addEventListener('pointerdown', () => { if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); }, true);
const sigSend = (to, kind, data) => Net.send({ type: 'rtc', to, kind, role: 'team', data });
const outTrack = () => (micOn && micTrack) ? micTrack : silent;

function makePeer(pid) {
  ensureCtx();
  const pc = new RTCPeerConnection(Net.ICE), p = { pc, pid, audio: null, an: null, buf: null, last: 0, q: [], sender: null };
  peers.set(pid, p);
  pc.onicecandidate = ev => { if (ev.candidate) sigSend(pid, 'ice', ev.candidate); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { closePeer(pid); setTimeout(syncPeers, 1500); } };
  pc.ontrack = ev => {
    const stream = ev.streams[0] || new MediaStream([ev.track]);
    const a = new Audio(); a.autoplay = true; a.playsInline = true; a.srcObject = stream; a.muted = !spkOn; p.audio = a;
    a.play().catch(() => addEventListener('pointerdown', () => a.play().catch(() => {}), { once: true }));
    try { if (actx) { const src = actx.createMediaStreamSource(stream); p.an = actx.createAnalyser(); p.an.fftSize = 512; src.connect(p.an); p.buf = new Uint8Array(p.an.fftSize); } } catch (e) {}
  };
  return p;
}
function closePeer(pid) {
  const p = peers.get(pid); if (!p) return; peers.delete(pid);
  try { p.pc.close(); } catch (e) {}
  if (p.audio) { p.audio.pause(); p.audio.srcObject = null; }
  const e = Net.remote(pid); if (e) e.speaking = false;
}
async function openPeer(pid) {                   // 我是发起方（pid 比对方小的一边）
  const p = makePeer(pid);
  const tr = p.pc.addTransceiver('audio', { direction: 'sendrecv' }); p.sender = tr.sender;
  try { if (outTrack()) await tr.sender.replaceTrack(outTrack()); } catch (e) {}
  const offer = await p.pc.createOffer(); await p.pc.setLocalDescription(offer);
  sigSend(pid, 'offer', p.pc.localDescription);
}
async function onRtc(m) {
  const from = m.from;
  if (m.kind === 'offer') {
    closePeer(from); const p = makePeer(from);
    await p.pc.setRemoteDescription(m.data);
    const tr = p.pc.getTransceivers().find(t => t.receiver && t.receiver.track && t.receiver.track.kind === 'audio');
    if (tr) { tr.direction = 'sendrecv'; p.sender = tr.sender; try { if (outTrack()) await tr.sender.replaceTrack(outTrack()); } catch (e) {} }
    for (const c of p.q.splice(0)) { try { await p.pc.addIceCandidate(c); } catch (e) {} }
    const ans = await p.pc.createAnswer(); await p.pc.setLocalDescription(ans);
    sigSend(from, 'answer', p.pc.localDescription);
  } else if (m.kind === 'answer') {
    const p = peers.get(from); if (!p) return;
    await p.pc.setRemoteDescription(m.data);
    for (const c of p.q.splice(0)) { try { await p.pc.addIceCandidate(c); } catch (e) {} }
  } else if (m.kind === 'ice') {
    const p = peers.get(from); if (!p) return;
    if (p.pc.remoteDescription) { try { await p.pc.addIceCandidate(m.data); } catch (e) {} } else p.q.push(m.data);
  }
}
Net.on('rtc', m => { if (m.role === 'team') sigChain = sigChain.then(() => onRtc(m)).catch(() => {}); });

function syncPeers() {                            // 队伍名单变了 / 重连了：补上缺的连接，关掉多的
  const my = me(), want = new Set();
  if (T && Net.connected) T.members.forEach(m => { if (m.pid && m.pid !== my.id && !blockSet().has(m.pub)) want.add(m.pid); });
  for (const pid of [...peers.keys()]) if (!want.has(pid)) closePeer(pid);
  for (const pid of want) if (!peers.has(pid) && my.id && my.id < pid) openPeer(pid).catch(() => closePeer(pid));
}

/* ---------- 开麦 / 闭麦 / 喇叭 ---------- */
async function setMic(on) {
  if (on === micOn) return;
  if (on) {
    if (!T) return;
    try {
      ensureCtx();
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      micTrack = micStream.getAudioTracks()[0];
      try { const src = actx.createMediaStreamSource(micStream); selfAn = actx.createAnalyser(); selfAn.fftSize = 512; selfBuf = new Uint8Array(selfAn.fftSize); src.connect(selfAn); } catch (e) {}
    } catch (err) { toast(err && err.name === 'NotAllowedError' ? '麦克风权限被拒绝，请在系统设置里允许' : '麦克风开启失败', 2600); return; }
    micOn = true; toast('🎙 麦克风已开启（队友能听到你）', 1800);
  } else {
    micOn = false; if (micStream) micStream.getTracks().forEach(t => t.stop()); micStream = micTrack = selfAn = null;
  }
  for (const p of peers.values()) if (p.sender) { try { await p.sender.replaceTrack(outTrack()); } catch (e) {} }
  renderHud(); renderPanel();
}
let selfAn = null, selfBuf = null;
function setSpk(on) { spkOn = on; for (const p of peers.values()) if (p.audio) p.audio.muted = !on; toast(on ? '🔊 已开喇叭' : '🔇 已闭喇叭（听不到队友语音）', 1600); renderHud(); renderPanel(); }

/* ---------- 说话指示：队友头顶的图标 + 面板里的绿点 ---------- */
let speaking = new Set();
function level(an, buf) { if (!an) return 0; an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } return Math.sqrt(s / buf.length); }
setInterval(() => {
  const now = performance.now(), G = window.__game, next = new Set();
  if (G && G.me) {
    if (micTrack) micTrack.enabled = !G.me.singing;                         // 我在台上唱歌：队伍麦克风自动让路
    G.me.speaking = !!(micOn && micTrack && micTrack.enabled && level(selfAn, selfBuf) > .02);
    if (G.me.speaking) next.add('me');
  }
  for (const [pid, p] of peers) {
    if (p.an && level(p.an, p.buf) > .015) p.last = now;
    const on = now - p.last < 400 && spkOn; const e = Net.remote(pid); if (e) e.speaking = on;
    if (on) next.add(pid);
  }
  const changed = next.size !== speaking.size || [...next].some(x => !speaking.has(x));
  speaking = next; if (changed) { renderHud(); if (!$('teamPanel').hidden) renderPanel(); }
}, 120);

/* ================= 消息 ================= */
Net.on('team', m => {
  T = m.team || null; saveTeam();
  if (!T) { if (micOn) setMic(false); for (const pid of [...peers.keys()]) closePeer(pid); if (m.reason) { toast(m.reason, 2400); __game.api.addMsg('team', '', m.reason, false, true); } }
  else { syncPeers(); }
  renderHud(); renderPanel();
});
Net.on('blocks_sync', m => { blocks = (m.list || []).map(b => ({ pub: b.pub, name: b.name })); lsSet('sc_blocks', blocks); renderBlockList(); });   // 登录用户的黑名单以服务器为准
Net.on('team_invited', m => showInvite(m));
Net.on('team_sent', m => toast('已向 ' + m.name + ' 发出组队邀请', 1800));
Net.on('team_msg', m => { toast(m.text, 2200); __game.api.addMsg('team', '', m.text, false, true); });
Net.on('chat', m => { if (m.ch === 'team' && __game.tab !== 'team' && !Social.isBlocked(m.pub)) { const b = document.querySelector('#tabs [data-ch="team"]'); if (b) b.classList.add('dot'); } });
Net.on('_close', () => { for (const pid of [...peers.keys()]) closePeer(pid); if (T) { T.members.forEach(m => { m.online = false; m.pid = null; }); } renderHud(); renderPanel(); });
Net.on('_scene', () => { renderPanel(); });
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#tabs button'); if (b && b.dataset.ch === 'team') b.classList.remove('dot'); }, true);

/* ================= 界面 ================= */
const PLACE = { plaza: '星光广场', bukit: '武吉免登', klcc: 'KLCC 双子塔', beach: '星光海滩', funfair: '星光嘉年华', boutique: '时尚街试衣间', ktv: 'KTV 大堂', ktv2: 'KTV 2F 走廊', ktv3: 'KTV 3F 走廊' };
const sceneOf = room => String(room || '').replace(/^sv1:/, '');
function placeName(room) { const id = sceneOf(room); if (!id) return '离线'; if (/^k2_/.test(id)) return 'KTV VIP 包间'; if (/^k3_/.test(id)) return 'KTV 包间'; return PLACE[id] || id; }
function teleportTarget(room) { const id = sceneOf(room); if (/^k2_/.test(id)) return 'ktv2'; if (/^k3_/.test(id)) return 'ktv3'; return PLACE[id] ? id : null; }

function build() {
  const topR = $('topR');
  document.body.insertAdjacentHTML('beforeend', '<div id="teamHud"></div>');
  $('hud').appendChild($('teamHud'));
  const panel = h('section', { class: 'sheet small', id: 'teamPanel', hidden: '' }, h('header', null, h('h2', { text: '👥 队伍' }), h('button', { class: 'x', type: 'button', text: '✕', onclick: () => { $('teamPanel').hidden = true; } })), h('div', { id: 'teamBody' }));
  const menu = h('section', { class: 'sheet small', id: 'playerMenu', hidden: '' }, h('header', null, h('h2', { id: 'pmName', text: '' }), h('button', { class: 'x', type: 'button', text: '✕', onclick: closeMenu })), h('div', { id: 'pmBody' }));
  const inv = h('div', { id: 'invitePop', hidden: '' });
  document.body.append(panel, menu, inv);
  /* 防误点：菜单是在手指抬起时弹出来的，手机随后补发的「点击」会落在刚出现、正好在手指下面的按钮上（点头部 = 加好友，点脚 = 拉黑）。
     所以：菜单里的点击，必须是「菜单出现之后，手指又在菜单里按下去」才算数；补发的那次点击没有对应的按下，一律忽略。 */
  menu.addEventListener('pointerdown', () => { menuDownAt = performance.now(); }, true);
  menu.addEventListener('click', e => { if (e.detail !== 0 && menuDownAt <= menuAt) { e.stopPropagation(); e.preventDefault(); } }, true);   // detail 0 = 键盘触发，放行
  renderHud(); renderBlockList();
  const wn = $('whatsNew'); if (wn) { wn.textContent = ''; ['v2 更新：', '· 修复唱完歌后卡在舞台楼梯', '· 演唱时长 = 歌曲时长；舞台队列改由服务器统一排队', '· 删除全部 NPC，只剩真人玩家', '· K 歌音效：混响 / 回声 / 明亮度 / 混音，音质提升', '· 组队：跨地图聊天与语音、闭麦 / 闭喇叭、说话指示、一键传送', '· 点击玩家：组队邀请 / 举报 / 拉黑', '· 聊天过滤 + 限速；断线自动重连并恢复队伍'].forEach(t => wn.append(h('div', { text: t }))); }
  if (window.Karaoke && Karaoke.mountFx) { Karaoke.mountFx($('fxSong')); Karaoke.mountFx($('fxSet')); }
}
function renderHud() {
  const hud = $('teamHud'); if (!hud) return; hud.textContent = '';
  const n = T ? T.members.length : 0, anySpeak = [...speaking].some(x => x !== 'me');
  hud.append(h('button', { class: 'tmBtn' + (anySpeak ? ' talk' : ''), type: 'button', text: T ? '👥 ' + n + '/' + MAX_TEAM : '👥 组队', onclick: () => openPanel() }));
  if (T) {
    hud.append(h('button', { class: 'tmBtn' + (micOn ? ' on' : ' off') + (speaking.has('me') ? ' talk' : ''), type: 'button', title: micOn ? '点击闭麦' : '点击开麦', text: micOn ? '🎙' : '🎙✕', onclick: () => setMic(!micOn) }));
    hud.append(h('button', { class: 'tmBtn' + (spkOn ? ' on' : ' off'), type: 'button', title: spkOn ? '点击闭喇叭' : '点击开喇叭', text: spkOn ? '🔊' : '🔇', onclick: () => setSpk(!spkOn) }));
  }
}
function openPanel() { closeSheets(); renderPanel(); $('teamPanel').hidden = false; }
function closeSheets() { document.querySelectorAll('.sheet').forEach(p => { p.hidden = true; }); }
function renderPanel() {
  const body = $('teamBody'); if (!body) return; body.textContent = '';
  if (!T) {
    body.append(h('p', { class: 'tmHint', text: '你还没有队伍。' }), h('p', { class: 'hint', text: '点一下场景里的其他玩家，选「组队邀请」。队伍最多 ' + MAX_TEAM + ' 人；队员不管在哪张地图都能互相看到队伍聊天、听到语音；队伍之外的人看不到也听不到。' }));
    return;
  }
  const my = me(), here = Net.room;
  const list = h('div', { class: 'tmList' });
  T.members.forEach(m => {
    const self = m.pub === my.pub, talk = self ? speaking.has('me') : speaking.has(m.pid);
    const row = h('div', { class: 'tmRow' + (m.online ? '' : ' off') });
    row.append(h('i', { class: 'tmDot' + (talk ? ' talk' : '') }), h('b', { text: (m.pub === T.leader ? '👑 ' : '') + m.name + (self ? '（我）' : '') }), h('small', { text: m.online ? placeName(m.room) : '掉线重连中…' }));
    const tp = teleportTarget(m.room);
    if (!self && m.online && tp) row.append(h('button', { class: 'chip', type: 'button', text: m.room === here ? '同图' : '传送', disabled: m.room === here ? '' : null, onclick: () => teleportTo(m) }));
    if (isLeader() && !self) row.append(h('button', { class: 'chip', type: 'button', text: '移出', onclick: () => { if (confirm('把 ' + m.name + ' 移出队伍？')) Net.send({ type: 'team_kick', pub: m.pub }); } }));
    list.append(row);
  });
  body.append(list);
  body.append(h('div', { class: 'tmCtl' },
    h('button', { class: 'chip' + (micOn ? ' on' : ''), type: 'button', text: micOn ? '🎙 麦克风：开（点击闭麦）' : '🎙 麦克风：关（点击开麦）', onclick: () => setMic(!micOn) }),
    h('button', { class: 'chip' + (spkOn ? ' on' : ''), type: 'button', text: spkOn ? '🔊 喇叭：开' : '🔇 喇叭：关', onclick: () => setSpk(!spkOn) })));
  body.append(h('p', { class: 'hint', text: '默认开喇叭、闭麦。麦克风开启后一直开着，想静音随时点一下。你上台唱歌时，队伍麦克风会自动让路。' }));
  body.append(h('button', { class: 'chip danger', type: 'button', text: '退出队伍', onclick: () => { if (confirm('确定退出队伍？')) Net.send({ type: 'team_leave' }); } }));
}
function teleportTo(m) {
  const id = teleportTarget(m.room); if (!id) return toast('现在去不了那里', 1600);
  if (m.room === Net.room) return toast('你们已经在同一张地图了', 1600);
  closeSheets(); toast('传送中 → ' + m.name + (/^sv1:k[23]_/.test(m.room) ? '（对方在包间，先送你到走廊）' : ''), 2200);
  __game.api.goTo(id, null);
}

/* ---------- 邀请弹窗 ---------- */
let invT = 0;
function showInvite(m) {
  if (T) { Net.send({ type: 'team_decline', inv: m.inv }); return; }
  const pop = $('invitePop'); pop.textContent = '';
  pop.append(h('p', { text: m.name + ' 邀请你加入队伍' + (m.size > 1 ? '（现有 ' + m.size + ' 人）' : '') }),
    h('div', { class: 'row2' },
      h('button', { class: 'chip on', type: 'button', text: '接受', onclick: () => { Net.send({ type: 'team_accept', inv: m.inv }); pop.hidden = true; clearTimeout(invT); } }),
      h('button', { class: 'chip', type: 'button', text: '拒绝', onclick: () => { Net.send({ type: 'team_decline', inv: m.inv }); pop.hidden = true; clearTimeout(invT); } })));
  pop.hidden = false; clearTimeout(invT); invT = setTimeout(() => { pop.hidden = true; }, 30000);
}

/* ---------- 点击玩家的菜单：组队邀请 / 举报 / 拉黑 ---------- */
let menuEnt = null, menuAt = 0, menuDownAt = 0;
function closeMenu() { $('playerMenu').hidden = true; menuEnt = null; }
function openPlayerMenu(e) {
  if (!e || !e.pid) return;
  closeSheets(); menuEnt = e; menuMain(); menuAt = performance.now(); menuDownAt = 0; $('playerMenu').hidden = false;
}
function menuMain() {
  const e = menuEnt, body = $('pmBody'); $('pmName').textContent = e.name; body.textContent = '';
  const blocked = Social.isBlocked(e.pub), my = me();
  const inT = !!(T && e.pub && T.members.some(m => m.pub === e.pub));
  const canInvite = !blocked && !inT && (!T || (isLeader() && T.members.length < MAX_TEAM));
  const reason = inT ? '已经是队友' : blocked ? '已拉黑' : T && !isLeader() ? '只有队长可以邀请' : T && T.members.length >= MAX_TEAM ? '队伍已满' : '';
  const btn = (text, fn, cls, dis) => h('button', { class: 'pmBtn ' + (cls || ''), type: 'button', text, onclick: fn, disabled: dis ? '' : null });
  body.append(
    btn('🤝 组队邀请' + (reason ? '（' + reason + '）' : ''), () => { Net.send({ type: 'team_invite', to: e.pid }); closeMenu(); }, '', !canInvite),
    ...friendButtons(e, btn),
    btn('🚩 举报', menuReport, 'warn', !e.pub),
    blocked ? btn('✅ 取消拉黑', () => { unblock(e.pub); menuMain(); }) : btn('🚫 拉黑', () => { if (!confirm('确定拉黑「' + e.name + '」？')) return; block(e.pub, e.name, e.pid); closeMenu(); }, 'warn', !e.pub),
    h('p', { class: 'hint', text: '查看资料、加好友、私信：之后的版本开放。' }));
  if (window.GM && window.GM.isGM && e.pid !== Net.myId()) {
    const admin = h('div', { class: 'gm-player-tools' }, h('div', { class: 'gm-player-title', text: '✦ GM 管理权限 ✦' }));
    const act = (label, action, minutes) => h('button', { class: 'pmBtn gmAdminBtn', type: 'button', text: label, onclick: () => { Net.send({ type: 'gm_action', pid: e.pid, action, minutes }); } });
    admin.append(act('禁言 15 分钟', 'mute', 15), act('禁言 1 小时', 'mute', 60), act('禁言 24 小时', 'mute', 1440), act('解除禁言', 'unmute'), act('踢出当前房间', 'kick'));
    body.append(admin);
  }
}
function friendButtons(e, btn) {                  // 查看资料 / 加好友 / 私信（profile.js 提供）
  const F = window.Friends; if (!F || !e.pub) return [];
  const rel = F.relation(e.pub), ok = F.authed && !Social.isBlocked(e.pub);
  return [
    btn('👤 查看资料', () => { closeMenu(); F.viewProfile(e.pub); }, '', !F.authed),
    rel === 'friend' ? btn('💬 私信', () => { closeMenu(); F.openDm(e.pub, e.name); }, '', !ok)
      : btn(rel === 'out' ? '⏳ 好友申请已发送' : rel === 'in' ? '✅ 同意 TA 的好友申请' : '➕ 加好友', () => { if (rel === 'in') Net.send({ type: 'friend_accept', pub: e.pub }); else Net.send({ type: 'friend_request', pub: e.pub }); closeMenu(); }, '', !ok || rel === 'out'),
    btn('🎁 送礼', () => { closeMenu(); if (window.Shop) Shop.openGift(e.pub, e.name); }, '', !F.authed),
  ];
}
function menuReport() {
  const e = menuEnt, body = $('pmBody'); body.textContent = '';
  body.append(h('p', { class: 'hint', text: '举报 ' + e.name + '：请选择原因。被多人举报的玩家会被自动临时禁言。' }));
  [['harass', '辱骂 / 骚扰'], ['porn', '色情 / 低俗'], ['ad', '广告 / 诈骗'], ['other', '其他']].forEach(([k, t]) => body.append(h('button', { class: 'pmBtn', type: 'button', text: t, onclick: () => { Net.send({ type: 'report', pid: e.pid, reason: k }); menuAfterReport(); } })));
  body.append(h('button', { class: 'pmBtn', type: 'button', text: '返回', onclick: menuMain }));
}
function menuAfterReport() {
  const e = menuEnt, body = $('pmBody'); body.textContent = '';
  body.append(h('p', { text: '已提交举报，谢谢你。' }), Social.isBlocked(e.pub) ? null : h('button', { class: 'pmBtn warn', type: 'button', text: '🚫 同时拉黑 ' + e.name, onclick: () => { block(e.pub, e.name, e.pid); closeMenu(); } }), h('button', { class: 'pmBtn', type: 'button', text: '关闭', onclick: closeMenu }));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
