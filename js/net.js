/* net.js — 联机核心：连接/自动重连、房间同步、聊天、K歌语音（演唱者→听众）、舞台队列通道。
   组队 / 举报 / 拉黑在 team.js，它通过 Net.on / Net.send 挂在这里。依赖 window.__game(G)、G.api、window.Karaoke。 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const CFG = window.NET_CONFIG || {};
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }].concat(CFG.turn ? [CFG.turn] : []) };

let G = null, api = null, ws = null, myId = null, myPub = '', started = false, joinedRoom = null, wantRoom = null, inRoom = false;
let retry = 0, retryT = 0, hello = 0, coldT = 0, lastRx = 0, totalOnline = 0;
let offset = 0, bestRtt = 1e9;
const remotes = new Map();         // playerId -> entity
const out = new Map();             // 我是演唱者：listenerId -> RTCPeerConnection
const inn = new Map();             // 我是听众：singerId -> { pc, audio }
let autoSing = false, kSyncT = 0, pendingRemoteK = null, kToastKey = '';
const hooks = {};                                     // Net.on(type, fn)：team.js / gm.js / game.js 接收服务器消息

const toast = (m, ms) => api && api.toast(m, ms);
const serverNow = () => Date.now() + offset;
const sendRaw = o => { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(o)); return true; } return false; };
const emit = (type, m) => (hooks[type] || []).forEach(f => { try { f(m || {}); } catch (e) { console.error(e); } });
const social = () => window.Social || { hello: () => ({}), isBlocked: () => false };

function serverUrl() {
  let u = (CFG.server || localStorage.getItem('sc_server') || '').trim();
  if (!u) return '';
  u = u.replace(/^http/i, 'ws');
  if (!/^wss?:\/\//i.test(u)) u = 'wss://' + u;
  return u.replace(/\/+$/, '');
}
function setOnline(on) { const el = $('online'); if (el) el.classList.toggle('off', !on); }
function refreshCount() { const n = $('onlineN'); if (n && G) n.textContent = ws && ws.readyState === 1 && totalOnline ? totalOnline : remotes.size + 1; }

/* 麦克风声音走 Opus：默认是"打电话"的低码率，这里调成适合唱歌的高码率 + 关闭 DTX（不然轻声唱会被当成静音切掉） */
function tuneOpus(sdp) {
  try {
    const m = /a=rtpmap:(\d+) opus\/48000\/2/.exec(sdp); if (!m) return sdp;
    const pt = m[1], want = { minptime: 10, useinbandfec: 1, usedtx: 0, stereo: 0, 'sprop-stereo': 0, maxaveragebitrate: 96000, maxplaybackrate: 48000 };
    const re = new RegExp('a=fmtp:' + pt + ' ([^\\r\\n]*)');
    if (re.test(sdp)) return sdp.replace(re, (_, p) => { const o = {}; p.split(';').forEach(kv => { const [k, v] = kv.split('='); if (k) o[k.trim()] = v; }); Object.assign(o, want); return 'a=fmtp:' + pt + ' ' + Object.entries(o).map(([k, v]) => k + '=' + v).join(';'); });
    return sdp.replace(new RegExp('(a=rtpmap:' + pt + ' opus/48000/2\\r?\\n)'), '$1a=fmtp:' + pt + ' ' + Object.entries(want).map(([k, v]) => k + '=' + v).join(';') + '\r\n');
  } catch (e) { return sdp; }
}
const tuned = d => d && d.sdp ? { type: d.type, sdp: tuneOpus(d.sdp) } : d;

/* ================= 连接 / 自动重连 ================= */
function connect() {
  if (ws && ws.readyState <= 1) return;
  const url = serverUrl();
  if (!url) { toast('未设置服务器地址，当前是单机模式', 3000); return; }
  try { ws = new WebSocket(url); } catch (e) { scheduleRetry(); return; }
  const mine = ws;
  clearTimeout(coldT);
  coldT = setTimeout(() => { if (!ws || ws.readyState !== 1) toast('服务器唤醒中…免费版首次约需 30–60 秒', 5000); }, 4000);
  ws.onopen = async () => {
    if (ws !== mine) return;
    const wasRetry = retry > 0;
    retry = 0; clearTimeout(coldT); setOnline(true); lastRx = Date.now(); toast(wasRetry ? '已重新连接 ✅' : '已连接服务器 ✅', 1800);
    ping(); clearInterval(hello); hello = setInterval(ping, 8000);
    const P = window.Profile || {};
    let token = null; try { token = window.Auth ? await Auth.getToken() : null; } catch (e) {}   // Firebase 登录凭证；拿不到就当游客
    if (ws !== mine || ws.readyState !== 1) return;
    sendRaw(Object.assign({ type: 'hello', uid: P.uid || '', token, name: P.name || '玩家' }, social().hello()));   // 身份 + 黑名单 + 上次的队伍（服务器重启 / 掉线后自动归队）
    joinedRoom = null; inRoom = false; joinRoom();
    emit('_open');
  };
  ws.onmessage = ev => { if (ws !== mine) return; lastRx = Date.now(); let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
  ws.onclose = () => {
    if (ws !== mine) return;
    clearInterval(hello); setOnline(false); clearRemotes(); closeAllVoice(); joinedRoom = null; inRoom = false; totalOnline = 0; refreshCount();
    emit('_close'); scheduleRetry();
  };
  ws.onerror = () => {};
}
function scheduleRetry() {
  clearTimeout(retryT); retry = Math.min(retry + 1, 8);
  if (retry === 2) toast('连接断开，正在重连…', 2000);
  retryT = setTimeout(connect, Math.min(1000 * retry, 8000));
}
function kick() {     // 回到前台 / 网络恢复：不用等退避，马上重连；半死不活的连接直接掐掉重来
  if (!started) return;
  if (!ws || ws.readyState > 1) { retry = 0; clearTimeout(retryT); connect(); }
  else if (ws.readyState === 1 && Date.now() - lastRx > 15000) { try { ws.close(); } catch (e) {} }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
addEventListener('online', kick);
setInterval(() => { if (started && ws && ws.readyState === 1 && Date.now() - lastRx > 25000) { try { ws.close(); } catch (e) {} } }, 5000);   // 25 秒没收到任何数据 = 假连接

function ping() { sendRaw({ type: 'ping', t: Date.now() }); }
function joinRoom() {
  if (!ws || ws.readyState !== 1 || !wantRoom) return;
  if (joinedRoom === wantRoom) return;
  joinedRoom = wantRoom; inRoom = false;
  const P = window.Profile || {};
  sendRaw({ type: 'join', room: wantRoom, name: P.name || '玩家', outfit: G.me.outfit });
  lastOutfit = JSON.stringify(G.me.outfit); lastSent = '';
}

/* ================= 消息处理 ================= */
function onMsg(m) {
  switch (m.type) {
    case 'connected': myId = m.playerId; break;
    case 'hello_ok': myPub = m.pub || ''; break;
    case 'pong': {
      const t1 = Date.now(), rtt = t1 - m.t;
      if (rtt < bestRtt * 1.3 + 10) { offset = m.ts - (m.t + rtt / 2); bestRtt = Math.min(bestRtt, rtt); }
      break;
    }
    case 'joined': if (m.room === wantRoom) inRoom = true; break;
    case 'count': break;
    case 'online': totalOnline = m.n || 0; refreshCount(); break;
    case 'playerJoined': addRemote(m.playerId, m.info || {}, m.state); break;
    case 'playerLeft': dropRemote(m.playerId); break;
    case 'rename': { const e = remotes.get(m.playerId); if (e) e.name = m.name; break; }
    case 'state': { const e = remotes.get(m.playerId); if (e && m.state) applyState(e, m.state, false); break; }
    case 'outfit': { const e = remotes.get(m.playerId); if (e) { e.outfit = Object.assign({}, e.outfit, m.outfit); api.applyOutfit(e.inst, e.outfit); } break; }
    case 'chat': {
      if (social().isBlocked(m.pub)) break;
      api.addMsg(m.ch, m.name, m.text);
      const e = remotes.get(m.playerId); if (e) api.setBubble(e, m.text);
      break;
    }
    case 'rtc': if (m.role !== 'team') chain = chain.then(() => onRtc(m)).catch(() => {}); break;   // 队伍语音的信令交给 team.js（下面的 emit）
    case 'karaoke': onKaraoke(m); break;
    case 'songcfg': if (window.Karaoke) Karaoke.setSongConfig(m.cfg || {}); break;   // GM 保存的歌词 / 延迟
    case 'error': case 'toast': if (m.message) toast(m.message, 2500); break;
    default: break;
  }
  emit(m.type, m);
}

/* ================= 远程玩家 ================= */
function addRemote(id, info, st) {
  if (remotes.has(id) || id === myId) return;
  const e = api.makeEntity(st ? st.x : 0, st ? st.z : 0, info.name || '玩家', Object.assign({ scale: 1 }, info.outfit || {}), false);
  e.remote = true; e.pid = id; e.pub = info.pub || ''; e.tx = e.x; e.tz = e.z; e.ty = 0; e.mode = 'remote';
  remotes.set(id, e); G.remotes.push(e);
  if (st) applyState(e, st, true);
  api.addMsg('world', '', '👋 ' + e.name + ' 来到了这里', false, true);
  refreshCount();
  if (window.Karaoke && Karaoke.micStream() && !social().isBlocked(e.pub)) startVoiceTo(id);
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
  if (POSES.includes(s.pz)) { e.pose = 0.7; e.actClip = s.pz; } else { e.pose = 0; e.actClip = null; }
  if (s.sit) {
    if (!e.sit) { e.sit = { x: s.sit.x, z: s.sit.z, h: s.sit.h, yaw: s.sit.yaw }; e.sitFrom = [e.x, e.z]; e.sitP = snap ? 1 : 0; }
    else { e.sit.x = s.sit.x; e.sit.z = s.sit.z; e.sit.h = s.sit.h; e.sit.yaw = s.sit.yaw; }
  } else if (e.sit) { e.sit = null; e.sitP = 1; }
  if (snap) { e.x = s.x; e.z = s.z; e.y = s.y; }
}
const POSES = ['wave', 'dance', 'cheer', 'clap', 'signok', 'signno', 'photo', 'bow', 'heart', 'thumbs', 'point'];   // 远程玩家只允许这些动作名（服务器只限制了长度）
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
function sendChat(ch, text) {
  text = String(text).slice(0, 80);
  if (ch === 'team' && !(window.Team && Team.inTeam())) { api.addMsg('team', '', '你还没有队伍。点一下场景里的玩家，选「组队邀请」。', false, true); return; }
  if (!sendRaw({ type: 'chat', ch, text })) toast('没连上服务器，消息没发出去', 1800);
}

/* ================= 语音（WebRTC，演唱者 → 听众，单向） ================= */
let chain = Promise.resolve();
const sig = (to, kind, role, data) => sendRaw({ type: 'rtc', to, kind, role, data });

async function startVoiceTo(pid) {
  const stream = Karaoke.micStream(); if (!stream || out.has(pid)) return;
  const pc = new RTCPeerConnection(ICE); out.set(pid, pc); pc._q = [];
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
  pc.onicecandidate = e => { if (e.candidate) sig(pid, 'ice', 'singer', e.candidate); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') closeOut(pid); };
  const offer = await pc.createOffer(); await pc.setLocalDescription(tuned(offer));
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
const voiceVol = () => { const f = window.Karaoke && Karaoke.fx ? Karaoke.fx.get() : null; return f ? f.voiceVol : 1; };

async function onRtc(m) {
  const from = m.from;
  if (m.kind === 'offer' && m.role === 'singer') {
    closeIn(from);
    const pc = new RTCPeerConnection(ICE); pc._q = [];
    const entry = { pc, audio: null }; inn.set(from, entry);
    pc.onicecandidate = e => { if (e.candidate) sig(from, 'ice', 'listener', e.candidate); };
    pc.ontrack = ev => {
      const a = new Audio(); a.autoplay = true; a.playsInline = true; a.srcObject = ev.streams[0] || new MediaStream([ev.track]); a.volume = voiceVol();
      entry.audio = a;
      const tryPlay = () => a.play().catch(() => { toast('点一下屏幕就能听到歌声 🎧', 3000); addEventListener('pointerdown', () => a.play().catch(() => {}), { once: true }); });
      tryPlay();
      const e = remotes.get(from); if (e) toast('🎤 ' + e.name + ' 开麦了', 2000);
    };
    await pc.setRemoteDescription(m.data); await flushQ(pc);
    const ans = await pc.createAnswer(); await pc.setLocalDescription(tuned(ans));
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
  if (m.action === 'stop') { Karaoke.remoteStop(m.from); if (pendingRemoteK && pendingRemoteK.m.from === m.from) { pendingRemoteK = null; kToastKey = ''; } return; }
  const pos = m.pos + Math.max(0, (serverNow() - m.ts)) / 1000;
  if (Karaoke.remoteActive() && Karaoke.remoteFromId() !== m.from) return;   // 已经在听别人的伴奏：不跟着换人（两个人同时唱时，以前每 4 秒会来回切一次）
  if (pendingRemoteK && pendingRemoteK.m.from !== m.from && Date.now() - pendingRemoteK.at < 60000) return;   // 正在等玩家点屏幕加入某个人的伴奏，不被别人抢走
  if (m.action === 'sync' && Karaoke.remotePlaying() && Karaoke.remoteFromId() === m.from) { Karaoke.remoteSync(pos); return; }
  const e = remotes.get(m.from);
  Karaoke.remoteStart(m.song, pos, e ? e.name : '', m.from).then(ok => {
    if (!ok) {
      pendingRemoteK = { m, at: Date.now() };
      const key = m.from + '|' + m.song; if (kToastKey !== key) { kToastKey = key; toast('点一下屏幕，加入合唱伴奏 🎶', 3000); }   // 同一首只提示一次，不再每 4 秒弹一次
    }
  });
}
addEventListener('pointerdown', () => {
  if (pendingRemoteK && Date.now() - pendingRemoteK.at < 60000) { const { m, at } = pendingRemoteK; pendingRemoteK = null; onKaraoke({ ...m, pos: m.pos + (Date.now() - at) / 1000, ts: m.ts }); }
}, true);

function bindKaraoke() {
  Karaoke.onMic((on) => {
    if (on) { for (const [id, e] of remotes) if (!social().isBlocked(e.pub)) startVoiceTo(id); }
    else { for (const id of [...out.keys()]) closeOut(id, true); }
  });
  Karaoke.onLocal((ev) => {
    clearInterval(kSyncT);
    if (ev === 'play') { sendKaraoke('start'); kSyncT = setInterval(() => sendKaraoke('sync'), 4000); }
    else sendKaraoke('stop');
  });
  Karaoke.fx.onChange(() => { const v = voiceVol(); inn.forEach(o => { if (o.audio) o.audio.volume = v; }); });
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
    else toast('《' + song + '》暂无伴奏文件，这一首是清唱 🎤', 3600);
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
    if (Karaoke.playing()) Karaoke.pause();      // 换地图：本机伴奏必须停（否则会一直往新房间发同步消息，新房间的人会听到）
    pendingRemoteK = null; kToastKey = '';
    clearRemotes(); closeAllVoice(); Karaoke.remoteStop();
    wantRoom = 'sv1:' + id; inRoom = false; joinRoom();
    emit('_scene', { id });
  },
  sendChat, refresh: refreshCount,
  reauth() { retry = 0; try { if (ws) ws.close(); else connect(); } catch (e) {} },
  send: sendRaw,
  on(type, fn) { (hooks[type] = hooks[type] || []).push(fn); },
  now: serverNow, dropVoice(pid) { closeIn(pid); closeOut(pid, true); },
  myId: () => myId, myPub: () => myPub, ICE, tuneOpus, tuned,
  remote: pid => remotes.get(pid) || null,
  remotes: () => [...remotes.values()],
  get connected() { return !!(ws && ws.readyState === 1); },
  get inRoom() { return !!(ws && ws.readyState === 1 && inRoom); },
  get room() { return wantRoom; },
};
})();
