/* K歌：本地伴奏 + LRC 歌词 + 麦克风。通过 window.Karaoke 给联机模块(net.js)使用。
   - 演唱者：伴奏从本机播放，麦克风通过 WebRTC 发给同房间的人
   - 听众：收到 karaoke 同步消息后，在本机播放同一首伴奏并对齐进度，再叠加演唱者的人声 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const SONGS = {
  '小幸运': { name: '小幸运', artist: '田馥甄', mp3: 'assets/songs/xiaoxingyun.mp3', lrc: 'assets/songs/xiaoxingyun.lrc' },
};
const lrcCache = {};
const bar = () => $('lyricBar');
let micStream = null, current = null, remoteSong = null, remoteFrom = null;
const listeners = { mic: [], local: [] };

function parseLrc(text) {
  const out = [];
  text.split(/\r?\n/).forEach(line => {
    const stamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const lyric = line.replace(/\[[^\]]+\]/g, '').trim();
    stamps.forEach(m => out.push({ t: Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number('0.' + m[3]) : 0), text: lyric }));
  });
  return out.filter(x => x.text !== '' || true).sort((a, b) => a.t - b.t);
}
async function loadLrc(song) {
  if (lrcCache[song.name]) return lrcCache[song.name];
  try { const r = await fetch(song.lrc); if (!r.ok) throw 0; return lrcCache[song.name] = parseLrc(await r.text()); }
  catch (e) { return lrcCache[song.name] = []; }
}
function lyricAt(lines, t) {
  let lo = 0, hi = lines.length - 1, idx = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].t <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
  return idx;
}
function showBar(text, who) {
  const b = bar(); if (!b) return;
  b.hidden = !text; if (text) b.innerHTML = (who ? '<small>🎤 ' + who + '</small>' : '') + '<span></span>', b.querySelector('span').textContent = text;
}

/* ---------- 本机播放（演唱者 / 单机） ---------- */
const audio = $('karaokeAudio');
let lines = [], lyricsOwner = null;
function tickLyrics() {
  const src = remoteAudio && !remoteAudio.paused && remoteSong ? { a: remoteAudio, l: remoteLines, who: remoteWho } : (audio && !audio.paused && current ? { a: audio, l: lines, who: '' } : null);
  if (!src) return;
  const i = lyricAt(src.l, src.a.currentTime);
  const txt = i >= 0 ? (src.l[i].text || '♪') : '♪ 前奏 ♪';
  showBar(txt, src.who);
  const pl = $('karaokeLyrics'); if (pl && src.a === audio) pl.textContent = txt;
}
if (audio) audio.addEventListener('timeupdate', tickLyrics);

async function play(songName, pos) {
  const song = SONGS[songName]; if (!song || !audio) return false;
  current = song; lines = await loadLrc(song);
  const t = $('karaokeTitle'); if (t) t.textContent = song.name + ' — ' + song.artist;
  const url = new URL(song.mp3, document.baseURI).href;
  if (audio.src !== url) audio.src = url;
  if (pos > 0) { try { audio.currentTime = pos; } catch (e) {} }
  try { await audio.play(); } catch (e) { setStatus('请点一下屏幕后再点「播放」'); return false; }
  listeners.local.forEach(f => f('play', song.name));
  return true;
}
function pause() { if (audio) audio.pause(); showBar(''); listeners.local.forEach(f => f('stop')); }
function position() { return audio && current ? audio.currentTime : 0; }
function playing() { return !!(audio && current && !audio.paused); }
function songName() { return current ? current.name : ''; }
function hasSong(n) { return !!SONGS[n]; }

/* ---------- 听众：同步播放别人的伴奏 ---------- */
const remoteAudio = new Audio(); remoteAudio.preload = 'auto';
let remoteLines = [], remoteWho = '';
remoteAudio.addEventListener('timeupdate', tickLyrics);
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
$('karaokePause')?.addEventListener('click', pause);
$('karaokeMic')?.addEventListener('click', () => { if (micStream) micOff(); else micOn().catch(() => {}); });
// 点歌列表里点《小幸运》时直接开始播放（保留原有行为）
$('songList')?.addEventListener('click', e => {
  const b = e.target.closest('button.song'); if (!b) return;
  if ((b.textContent || '').includes('小幸运')) play('小幸运', 0);
}, true);
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

window.Karaoke = {
  play, pause, position, playing, songName, hasSong,
  micOn, micOff, micStream: micStreamNow,
  remoteStart, remoteSync, remoteStop, remotePlaying, remoteFromId,
  onMic(f) { listeners.mic.push(f); }, onLocal(f) { listeners.local.push(f); },
};
})();
