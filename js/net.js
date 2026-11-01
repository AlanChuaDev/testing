/* net.js — 联机：房间同步、聊天、WebRTC 语音、K歌同步。依赖 window.__game(G)、G.api、window.Karaoke。 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const CFG = window.NET_CONFIG || {};
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }].concat(CFG.turn ? [CFG.turn] : []) };

let G = null, api = null, ws = null, myId = null, started = false, joinedRoom = null, wantRoom = null;
let retry = 0, retryT = 0, hello = 0, coldT = 0;
let offset = 0, bestRtt = 1e9;
const remotes = new Map();         // playerId -> entity
const out = new Map();             // 我是演唱者：listenerId -> RTCPeerConnection
const inn = new Map();             // 我是听众：singerId -> { pc, audio }
let autoSing = false, kSyncT = 0, pendingRemoteK = null;

const toast = (m, ms) => api && api.toast(m, ms);
const serverNow = () => Date.now() + offset;
const sendRaw = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function serverUrl() {
  let u = (CFG.server || localStorage.getItem('sc_server') || '').trim();
  if (!u) return '';
  u = u.replace(/^http/i, 'ws');
  if (!/^wss?:\/\//i.test(u)) u = 'wss://' + u;
  return u.replace(/\/+$/, '');
}
function setOnline(on) { const el = $('online'); if (el) el.classList.toggle('off', !on); }
function refreshCount() { const n = $('onlineN'); if (n && G) n.textContent = G.npcs.length + 1 + remotes.size; }

/* ================= 连接 ================= */
function connect() {
  const url = serverUrl();
  if (!url) { toast('未设置服务器地址，当前是单机模式', 3000); return; }
  try { ws = new WebSocket(url); } catch (e) { scheduleRetry(); return; }
  clearTimeout(coldT);
  coldT = setTimeout(() => { if (!ws || ws.readyState !== 1) toast('服务器唤醒中…免费版首次约需 30–60 秒', 5000); }, 4000);
  ws.onopen = () => {
    retry = 0; clearTimeout(coldT); setOnline(true); toast('已连接服务器 ✅', 1800);
    ping(); clearInterval(hello); hello = setInterval(ping, 8000);
    joinedRoom = null; joinRoom();
  };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
  ws.onclose = () => { clearInterval(hello); setOnline(false); clearRemotes(); closeAllVoice(); joinedRoom = null; scheduleRetry(); };
  ws.onerror = () => {};
}
function scheduleRetry() {
  clearTimeout(retryT); retry = Math.min(retry + 1, 8);
  retryT = setTimeout(connect, Math.min(1000 * retry, 8000));
}
function ping() { sendRaw({ type: 'ping', t: Date.now() }); }
function joinRoom() {
  if (!ws || ws.readyState !== 1 || !wantRoom) return;
  if (joinedRoom === wantRoom) return;
  joinedRoom = wantRoom;
  const P = window.Profile || {};
  sendRaw({ type: 'join', room: wantRoom, name: P.name || '玩家', outfit: G.me.outfit });
  lastOutfit = JSON.stringify(G.me.outfit); lastSent = '';
}

/* ================= 消息处理 ================= */
function onMsg(m) {
  switch (m.type) {
    case 'connected': myId = m.playerId; break;
    case 'pong': {
      const t1 = Date.now(), rtt = t1 - m.t;
      if (rtt < bestRtt * 1.3 + 10) { offset = m.ts - (m.t + rtt / 2); bestRtt = Math.min(bestRtt, rtt); }
      break;
    }
    case 'joined': break;
    case 'count': { const n = $('onlineN'); if (n && G) n.textContent = G.npcs.length + (m.n || 1); break; }
    case 'playerJoined': addRemote(m.playerId, m.info || {}, m.state); break;
    case 'playerLeft': dropRemote(m.playerId); break;
    case 'state': { const e = remotes.get(m.playerId); if (e && m.state) applyState(e, m.state, false); break; }
    case 'outfit': { const e = remotes.get(m.playerId); if (e) { e.outfit = Object.assign({}, e.outfit, m.outfit); api.applyOutfit(e.inst, e.outfit); } break; }
    case 'chat': {
      api.addMsg(m.ch, m.name, m.text);
      const e = remotes.get(m.playerId); if (e) api.setBubble(e, m.text);
      break;
    }
    case 'rtc': chain = chain.then(() => onRtc(m)).catch(() => {}); break;
    case 'karaoke': onKaraoke(m); break;
    case 'error': if (m.message) toast(m.message, 2500); break;
  }
}

/* ================= 远程玩家 ================= */
function addRemote(id, info, st) {
  if (remotes.has(id) || id === myId) return;
  const e = api.makeEntity(st ? st.x : 0, st ? st.z : 0, info.name || '玩家', Object.assign({ scale: 1 }, info.outfit || {}), false);
  e.remote = true; e.pid = id; e.tx = e.x; e.tz = e.z; e.ty = 0; e.mode = 'remote';
  remotes.set(id, e); G.remotes.push(e);
  if (st) applyState(e, st, true);
  api.addMsg('world', '', '👋 ' + e.name + ' 来到了这里', false, true);
  refreshCount();
  if (window.Karaoke && Karaoke.micStream()) startVoiceTo(id);
  if (window.Karaoke && Karaoke.playing()) sendKaraoke('start');
}
function dropRemote(id) {
  const e = remotes.get(id); if (!e) return;
  remotes.delete(id); const i = G.remotes.indexOf(e); if (i >= 0) G.remotes.splice(i, 1);
  closeOut(id); closeIn(id);
  if (Karaoke.remoteFromId() === id) Karaoke.remoteStop(id);
  refreshCount();
}
function clearRemotes() { remotes.clear(); if (G) G.remotes.length = 0; refreshCount(); }
function applyState(e, s, snap) {
  e.tx = s.x; e.tz = s.z; e.ty = s.y; e.yaw = s.yaw;
  e.moving = !!s.mv; e.run = !!s.run; e.sing = !!s.sing;
  if (s.pz) { e.pose = 0.7; e.actClip = s.pz; } else { e.pose = 0; e.actClip = null; }
  if (s.sit) {
    if (!e.sit) { e.sit = { x: s.sit.x, z: s.sit.z, h: s.sit.h, yaw: s.sit.yaw }; e.sitFrom = [e.x, e.z]; e.sitP = snap ? 1 : 0; }
    else { e.sit.x = s.sit.x; e.sit.z = s.sit.z; e.sit.h = s.sit.h; e.sit.yaw = s.sit.yaw; }
  } else if (e.sit) { e.sit = null; e.sitP = 1; }
  if (snap) { e.x = s.x; e.z = s.z; e.y = s.y; }
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!G || !remotes.size) return;
  const dt = Math.min(.1, (now - (frame.last || now)) / 1000); frame.last = now;
  const k = Math.min(1, dt * 10);
  for (const e of remotes.values()) {
    if (e.sit) continue;               // 坐着时位置由游戏动画控制
    if (Math.hypot(e.tx - e.x, e.tz - e.z) > 8) { e.x = e.tx; e.z = e.tz; }
    else { e.x += (e.tx - e.x) * k; e.z += (e.tz - e.z) * k; }
    e.y += (e.ty - e.y) * k;
  }
}

/* ================= 发送自己的状态 ================= */
let lastSent = '', lastSentAt = 0, lastOutfit = '';
function pushState() {
  if (!ws || ws.readyState !== 1 || !G || !G.me || joinedRoom !== wantRoom) return;
  const me = G.me;
  const st = {
    x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(2),
    mv: me.moving ? 1 : 0, run: me.run ? 1 : 0, sing: (me.sing || me.singing) ? 1 : 0,
    pz: me.pose > 0 ? (me.actClip || 'wave') : null,
    sit: me.sit ? { x: me.sit.x, z: me.sit.z, h: me.sit.h, yaw: me.sit.yaw } : null,
  };
  const key = JSON.stringify(st), now = Date.now();
  if (key === lastSent && now - lastSentAt < 1000) return;
  lastSent = key; lastSentAt = now; sendRaw({ type: 'state', state: st });
}
function watchOutfit() {
  if (!G || !G.me) return;
  const s = JSON.stringify(G.me.outfit);
  if (s !== lastOutfit) { lastOutfit = s; sendRaw({ type: 'outfit', outfit: G.me.outfit }); }
}

/* ================= 聊天 ================= */
function sendChat(ch, text) { sendRaw({ type: 'chat', ch, text: String(text).slice(0, 80) }); }

/* ================= 语音（WebRTC，演唱者 → 听众，单向） ================= */
let chain = Promise.resolve();
const sig = (to, kind, role, data) => sendRaw({ type: 'rtc', to, kind, role, data });

async function startVoiceTo(pid) {
  const stream = Karaoke.micStream(); if (!stream || out.has(pid)) return;
  const pc = new RTCPeerConnection(ICE); out.set(pid, pc); pc._q = [];
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
  pc.onicecandidate = e => { if (e.candidate) sig(pid, 'ice', 'singer', e.candidate); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') closeOut(pid); };
  const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
  sig(pid, 'offer', 'singer', pc.localDescription);
}
function closeOut(pid, notify) {
  const pc = out.get(pid); if (!pc) return;
  out.delete(pid); try { pc.close(); } catch (e) {}
  if (notify) sig(pid, 'bye', 'singer', null);
}
function closeIn(pid) {
  const o = inn.get(pid); if (!o) return;
  inn.delete(pid); try { o.pc.close(); } catch (e) {}
  if (o.audio) { o.audio.pause(); o.audio.srcObject = null; }
}
function closeAllVoice() { for (const id of [...out.keys()]) closeOut(id); for (const id of [...inn.keys()]) closeIn(id); }
async function flushQ(pc) { const q = pc._q || []; pc._q = []; for (const c of q) { try { await pc.addIceCandidate(c); } catch (e) {} } }

async function onRtc(m) {
  const from = m.from;
  if (m.kind === 'offer' && m.role === 'singer') {
    closeIn(from);
    const pc = new RTCPeerConnection(ICE); pc._q = [];
    const entry = { pc, audio: null }; inn.set(from, entry);
    pc.onicecandidate = e => { if (e.candidate) sig(from, 'ice', 'listener', e.candidate); };
    pc.ontrack = ev => {
      const a = new Audio(); a.autoplay = true; a.playsInline = true; a.srcObject = ev.streams[0] || new MediaStream([ev.track]);
      entry.audio = a;
      const tryPlay = () => a.play().catch(() => { toast('点一下屏幕就能听到歌声 🎧', 3000); addEventListener('pointerdown', () => a.play().catch(() => {}), { once: true }); });
      tryPlay();
      const e = remotes.get(from); if (e) toast('🎤 ' + e.name + ' 开麦了', 2000);
    };
    await pc.setRemoteDescription(m.data); await flushQ(pc);
    const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
    sig(from, 'answer', 'listener', pc.localDescription);
  } else if (m.kind === 'answer' && m.role === 'listener') {
    const pc = out.get(from); if (!pc) return;
    await pc.setRemoteDescription(m.data); await flushQ(pc);
  } else if (m.kind === 'ice') {
    const pc = m.role === 'singer' ? (inn.get(from) || {}).pc : out.get(from);
    if (!pc) return;
    if (pc.remoteDescription) { try { await pc.addIceCandidate(m.data); } catch (e) {} } else pc._q.push(m.data);
  } else if (m.kind === 'bye') {
    closeIn(from);
  }
}

/* ================= K歌同步 ================= */
function sendKaraoke(action) {
  if (!ws || ws.readyState !== 1) return;
  sendRaw({ type: 'karaoke', action, song: Karaoke.songName(), pos: Karaoke.position(), ts: serverNow() });
}
function onKaraoke(m) {
  if (Karaoke.playing()) return;                       // 我自己正在唱，不跟别人的
  if (m.action === 'stop') { Karaoke.remoteStop(m.from); pendingRemoteK = null; return; }
  const pos = m.pos + Math.max(0, (serverNow() - m.ts)) / 1000;
  if (m.action === 'sync' && Karaoke.remotePlaying() && Karaoke.remoteFromId() === m.from) { Karaoke.remoteSync(pos); return; }
  const e = remotes.get(m.from);
  Karaoke.remoteStart(m.song, pos, e ? e.name : '', m.from).then(ok => {
    if (!ok) { pendingRemoteK = { m, at: Date.now() }; toast('点一下屏幕，加入合唱伴奏 🎶', 3000); }
  });
}
addEventListener('pointerdown', () => {
  if (pendingRemoteK && Date.now() - pendingRemoteK.at < 60000) { const { m, at } = pendingRemoteK; pendingRemoteK = null; onKaraoke({ ...m, pos: m.pos + (Date.now() - at) / 1000, ts: m.ts }); }
}, true);

function bindKaraoke() {
  Karaoke.onMic((on) => {
    if (on) { for (const id of remotes.keys()) startVoiceTo(id); }
    else { for (const id of [...out.keys()]) closeOut(id, true); }
  });
  Karaoke.onLocal((ev) => {
    clearInterval(kSyncT);
    if (ev === 'play') { sendKaraoke('start'); kSyncT = setInterval(() => sendKaraoke('sync'), 4000); }
    else sendKaraoke('stop');
  });
}

/* 轮到我上台演唱：自动开麦克风 + 放伴奏；演唱结束自动关闭 */
let wasSinging = false;
function singWatch() {
  if (!G || !G.me) return;
  const now = !!G.me.singing;
  if (now && !wasSinging) {
    autoSing = true; const song = (G.stg && G.stg.song) || '';
    Karaoke.micOn().catch(() => toast('麦克风没开成功，好友听不到你', 2500));
    if (Karaoke.hasSong(song)) Karaoke.play(song, 0);
    else toast('《' + song + '》暂无伴奏文件，目前只有《小幸运》有伴奏', 3000);
  } else if (!now && wasSinging && autoSing) {
    autoSing = false; Karaoke.pause(); Karaoke.micOff();
  }
  wasSinging = now;
}

/* ================= 对外接口 ================= */
window.Net = {
  start(game) {
    if (started) return; started = true; G = game; api = G.api; G.remotes = G.remotes || [];
    wantRoom = 'sv1:' + G.sceneId;
    bindKaraoke(); connect();
    setInterval(pushState, 100); setInterval(watchOutfit, 1500); setInterval(singWatch, 250);
    requestAnimationFrame(frame);
  },
  onScene(id) {
    if (!started) return;
    clearRemotes(); closeAllVoice(); Karaoke.remoteStop();
    wantRoom = 'sv1:' + id; joinRoom();
    if (Karaoke.micStream()) { /* 我开着麦克风切换了地图：新房间的人加入时会自动建立连接 */ }
  },
  sendChat, refresh: refreshCount,
  get connected() { return !!(ws && ws.readyState === 1); },
};
})();
