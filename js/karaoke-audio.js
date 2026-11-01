/* K歌：本地伴奏 + LRC 歌词 + 麦克风。通过 window.Karaoke 给联机模块(net.js)使用。
   - 演唱者：伴奏从本机播放，麦克风通过 WebRTC 发给同房间的人
   - 听众：收到 karaoke 同步消息后，在本机播放同一首伴奏并对齐进度，再叠加演唱者的人声 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const SONGS = {
  '小幸运': { name: '小幸运', artist: '田馥甄', mp3: 'assets/songs/xiaoxingyun.mp3', lrc: 'assets/songs/xiaoxingyun.lrc' },
};
const lrcCache = {}, rawCache = {};
const cfgMap = {};   // GM 在服务器保存的配置：{ 歌名: { offset: 毫秒, lrc: 歌词全文(空=用仓库里的文件) } }，由 net.js 收到 songcfg 后写入
const offOf = n => ((cfgMap[n] && cfgMap[n].offset) || 0) / 1000;   // 歌词延迟（秒）：显示时间 = 播放时间 − 延迟
const bar = () => $('lyricBar');
let micStream = null, current = null, remoteSong = null, remoteFrom = null;
const listeners = { mic: [], local: [], cfg: [] };

function parseLrc(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, ri) => {
    const stamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const lyric = line.replace(/\[[^\]]+\]/g, '').trim();
    stamps.forEach(m => out.push({ t: Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number('0.' + m[3]) : 0), text: lyric, ri }));
  });
  return out.filter(x => x.text !== '' || true).sort((a, b) => a.t - b.t);
}
async function fileRaw(song) {            // 仓库里的原始歌词文件（失败不缓存，下次还会重试）
  if (rawCache[song.name] != null) return rawCache[song.name];
  try { const r = await fetch(song.lrc); if (!r.ok) throw 0; return rawCache[song.name] = await r.text(); }
  catch (e) { return ''; }
}
async function loadRaw(song) {            // GM 改过的歌词优先，否则用文件
  const c = cfgMap[song.name];
  if (c && typeof c.lrc === 'string' && c.lrc.trim()) return c.lrc;
  return fileRaw(song);
}
async function loadLrc(song) {
  if (lrcCache[song.name]) return lrcCache[song.name];
  const raw = await loadRaw(song), L = parseLrc(raw);
  if (raw) lrcCache[song.name] = L;
  return L;
}
function lyricAt(lines, t) {
  let lo = 0, hi = lines.length - 1, idx = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].t <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
  return idx;
}
let barKey = null;
function showBar(text, who) {            // 只用 textContent，演唱者名字来自网络，不能拼进 innerHTML
  const b = bar(); if (!b) return;
  const key = text ? (who || '') + '\n' + text : '';
  if (key === barKey) return; barKey = key;
  b.hidden = !text; b.textContent = '';
  if (!text) return;
  if (who) { const s = document.createElement('small'); s.textContent = '🎤 ' + who; b.appendChild(s); }
  const sp = document.createElement('span'); sp.textContent = text; b.appendChild(sp);
}

/* ---------- 本机播放（演唱者 / 单机） ---------- */
const audio = $('karaokeAudio');
let lines = [], lyricsOwner = null;
function curSrc() {
  if (remoteAudio && !remoteAudio.paused && remoteSong) return { a: remoteAudio, l: remoteLines, who: remoteWho, song: remoteSong, local: false };
  if (audio && !audio.paused && current) return { a: audio, l: lines, who: '', song: current, local: true };
  return null;
}
/* 当前正在播放的这一句（歌词条、点歌面板、舞台大电视、GM 面板都用它，所以显示一模一样） */
function lyricNow() {
  const s = curSrc(); if (!s) return null;
  const i = lyricAt(s.l, s.a.currentTime - offOf(s.song.name));
  let next = ''; for (let j = i + 1; j < s.l.length; j++) if (s.l[j].text) { next = s.l[j].text; break; }
  return { cur: i >= 0 ? (s.l[i].text || '♪') : '♪ 前奏 ♪', next, idx: i, ri: i >= 0 ? s.l[i].ri : -1, who: s.who, song: s.song.name, t: s.a.currentTime, local: s.local };
}
function tickLyrics() {
  const L = lyricNow(); if (!L) return;
  showBar(L.cur, L.who);
  const pl = $('karaokeLyrics'); if (pl && L.local && pl.textContent !== L.cur) pl.textContent = L.cur;
}

async function play(songName, pos, quiet) {   // quiet=true：只在本机试听，不通知房间里的其他人（GM 校准用）
  const song = SONGS[songName]; if (!song || !audio) return false;
  current = song; lines = await loadLrc(song);
  const t = $('karaokeTitle'); if (t) t.textContent = song.name + ' — ' + song.artist;
  const url = new URL(song.mp3, document.baseURI).href;
  if (audio.src !== url) audio.src = url;
  if (pos > 0) { try { audio.currentTime = pos; } catch (e) {} }
  try { await audio.play(); } catch (e) { setStatus('请点一下屏幕后再点「播放」'); return false; }
  if (!quiet) listeners.local.forEach(f => f('play', song.name));
  return true;
}
function pause(quiet) { if (audio) audio.pause(); showBar(''); if (!quiet) listeners.local.forEach(f => f('stop')); }
function seek(t) { if (audio && current) { try { audio.currentTime = Math.max(0, t); } catch (e) {} } }
function duration() { return audio && audio.duration && isFinite(audio.duration) ? audio.duration : 0; }
function position() { return audio && current ? audio.currentTime : 0; }
function playing() { return !!(audio && current && !audio.paused); }
function songName() { return current ? current.name : ''; }
function hasSong(n) { return !!SONGS[n]; }

/* ---------- 听众：同步播放别人的伴奏 ---------- */
const remoteAudio = new Audio(); remoteAudio.preload = 'auto';
let remoteLines = [], remoteWho = '';
async function remoteStart(songName, pos, who, fromId) {
  const song = SONGS[songName]; if (!song) return false;
  remoteSong = song; remoteFrom = fromId; remoteWho = who || ''; remoteLines = await loadLrc(song);
  const url = new URL(song.mp3, document.baseURI).href;
  if (remoteAudio.src !== url) remoteAudio.src = url;
  remoteAudio.volume = 0.85;
  const go = () => { try { remoteAudio.currentTime = Math.max(0, pos); } catch (e) {} return remoteAudio.play(); };
  if (remoteAudio.readyState < 1) await new Promise(r => { remoteAudio.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 4000); });
  try { await go(); return true; } catch (e) { return false; }
}
function remoteSync(pos) {
  if (!remoteSong || remoteAudio.paused) return;
  if (Math.abs(remoteAudio.currentTime - pos) > 0.35) { try { remoteAudio.currentTime = Math.max(0, pos); } catch (e) {} }
}
function remoteStop(fromId) {
  if (fromId && remoteFrom && fromId !== remoteFrom) return;
  remoteAudio.pause(); remoteSong = null; remoteFrom = null; showBar('');
}
function remotePlaying() { return !!remoteSong; }
function remoteFromId() { return remoteFrom; }

/* ---------- 麦克风 ---------- */
function setStatus(t) { const s = $('karaokeMicStatus'); if (s) s.textContent = t; }
async function micOn() {
  if (micStream) return micStream;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setStatus('此环境不支持麦克风（需要 HTTPS 或 APK）'); throw new Error('no-mic'); }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
  } catch (err) {
    setStatus(err.name === 'NotAllowedError' ? '麦克风权限被拒绝，请在系统设置中允许' : '麦克风启动失败：' + err.message);
    throw err;
  }
  const b = $('karaokeMic'); if (b) b.textContent = '🔴 关闭麦克风';
  setStatus('麦克风已开启（好友可以听到你）');
  listeners.mic.forEach(f => f(true, micStream));
  return micStream;
}
function micOff() {
  if (!micStream) return;
  micStream.getTracks().forEach(t => t.stop()); micStream = null;
  const b = $('karaokeMic'); if (b) b.textContent = '🎙 开启麦克风';
  setStatus('麦克风已关闭');
  listeners.mic.forEach(f => f(false, null));
}
function micStreamNow() { return micStream; }

/* ---------- 面板按钮 ---------- */
$('karaokePlay')?.addEventListener('click', () => play(current ? current.name : '小幸运', audio && audio.currentTime || 0));
$('karaokePause')?.addEventListener('click', () => pause());
$('karaokeMic')?.addEventListener('click', () => { if (micStream) micOff(); else micOn().catch(() => {}); });
if (audio) audio.addEventListener('ended', () => { showBar(''); listeners.local.forEach(f => f('stop')); });

/* ---------- 麦克风测试（设置面板） ---------- */
let mt = null;
function mtStatus(t) { const s = $('micTestStatus'); if (s) s.textContent = t; }
async function micTestStart() {
  if (mt) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { mtStatus('此环境不支持麦克风（需要 HTTPS 或 APK）'); return; }
  let stream, own = false;
  try {
    stream = micStream || (own = true, await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }));
  } catch (err) { mtStatus(err.name === 'NotAllowedError' ? '麦克风权限被拒绝，请在系统设置里允许' : '麦克风启动失败：' + err.message); return; }
  const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
  const src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
  const loopG = ctx.createGain(); loopG.gain.value = 0; src.connect(loopG); loopG.connect(ctx.destination);
  const buf = new Uint8Array(an.fftSize); let peak = 0, raf = 0; const t0 = performance.now(); mt = { stream, own, ctx, stop: null };
  const tick = () => {
    an.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / buf.length), lvl = Math.min(1, rms * 5); peak = Math.max(peak, rms);
    const m = $('micMeter'); if (m) m.style.width = (lvl * 100).toFixed(0) + '%';
    loopG.gain.value = $('micLoop') && $('micLoop').checked ? 1 : 0;
    if (peak > 0.02) mtStatus('✅ 麦克风正常，能听到你的声音');
    else if (performance.now() - t0 > 4000) mtStatus('❌ 没检测到声音：请检查麦克风权限、是否静音，或靠近一点说话');
    raf = requestAnimationFrame(tick);
  };
  mt.stop = () => {
    cancelAnimationFrame(raf); try { src.disconnect(); loopG.disconnect(); ctx.close(); } catch (e) {}
    if (mt.own) stream.getTracks().forEach(t => t.stop());
    mt = null; const b = $('micTestBtn'); if (b) b.textContent = '🎙 开始测试'; const m = $('micMeter'); if (m) m.style.width = '0%';
  };
  const b = $('micTestBtn'); if (b) b.textContent = '⏹ 停止测试'; mtStatus('请对着手机说话…'); tick();
}
$('micTestBtn')?.addEventListener('click', () => { if (mt) { mt.stop(); mtStatus('已停止'); } else micTestStart(); });
setInterval(() => { const p = $('setPanel'); if (mt && p && p.hidden) mt.stop(); }, 500);   // 关掉设置面板自动停止

/* ---------- GM 配置（歌词延迟 / 改过的歌词） ---------- */
async function reloadLines() {
  if (current) lines = await loadLrc(current);
  if (remoteSong) remoteLines = await loadLrc(remoteSong);
}
function cleanCfg(v) { return { offset: Math.max(-10000, Math.min(10000, Math.round(Number(v && v.offset) || 0))), lrc: v && typeof v.lrc === 'string' ? v.lrc : '' }; }
function setSongConfig(map) {              // 服务器下发的全部配置（连上服务器时、GM 保存时）
  for (const k of Object.keys(cfgMap)) delete cfgMap[k];
  for (const [k, v] of Object.entries(map || {})) if (v && typeof v === 'object') cfgMap[k] = cleanCfg(v);
  for (const k of Object.keys(lrcCache)) delete lrcCache[k];
  reloadLines(); listeners.cfg.forEach(f => { try { f(); } catch (e) {} });
}
function applyLocal(name, cfg) {           // GM 面板里的本机预览（还没保存到服务器）
  if (cfg) cfgMap[name] = cleanCfg(cfg); else delete cfgMap[name];
  delete lrcCache[name]; reloadLines();
}
function getSongConfig(name) { const c = cfgMap[name]; return c ? { offset: c.offset, lrc: c.lrc } : { offset: 0, lrc: '' }; }
function songNames() { return Object.keys(SONGS); }
const rawLrc = name => SONGS[name] ? loadRaw(SONGS[name]) : Promise.resolve('');    // 当前生效的歌词全文
const fileLrc = name => SONGS[name] ? fileRaw(SONGS[name]) : Promise.resolve('');   // 仓库里的原始文件
setInterval(tickLyrics, 100);              // 歌词条每 0.1 秒刷新（以前靠 timeupdate，约 0.25 秒一次，校准延迟不够准）

window.Karaoke = {
  play, pause, seek, duration, position, playing, songName, hasSong,
  lyricNow, setSongConfig, applyLocal, getSongConfig, songNames, rawLrc, fileLrc, onCfg(f) { listeners.cfg.push(f); },
  micOn, micOff, micStream: micStreamNow,
  remoteStart, remoteSync, remoteStop, remotePlaying, remoteFromId,
  onMic(f) { listeners.mic.push(f); }, onLocal(f) { listeners.local.push(f); },
};
})();
