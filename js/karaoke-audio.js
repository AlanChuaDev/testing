/* K歌：本地伴奏 + LRC 歌词 + 麦克风。通过 window.Karaoke 给联机模块(net.js)使用。
   - 演唱者：伴奏从本机播放，麦克风通过 WebRTC 发给同房间的人
   - 听众：收到 karaoke 同步消息后，在本机播放同一首伴奏并对齐进度，再叠加演唱者的人声 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const SONGS = {   // 歌名必须和 js/songs.js 里的 name 一字不差；mp3 / lrc 用 assets/songs 里的拼音文件名
  '小幸运': { name: '小幸运', artist: '田馥甄', mp3: 'assets/songs/xiaoxingyun.mp3', lrc: 'assets/songs/xiaoxingyun.lrc' },
  '珊瑚海': { name: '珊瑚海', artist: '周杰伦&Lara梁心颐', mp3: 'assets/songs/shanhuhai.mp3', lrc: 'assets/songs/shanhuhai.lrc' },
  '明明就': { name: '明明就', artist: '周杰伦', mp3: 'assets/songs/mingmingjiu.mp3', lrc: 'assets/songs/mingmingjiu.lrc' },
  '夏夜最后的烟火': { name: '夏夜最后的烟火', artist: '颜人中', mp3: 'assets/songs/xiayezuihoudeyanhuo.mp3', lrc: 'assets/songs/xiayezuihoudeyanhuo.lrc' },
  '有点甜': { name: '有点甜', artist: '汪苏泷&BY2', mp3: 'assets/songs/youdiantian.mp3', lrc: 'assets/songs/youdiantian.lrc' },
  '我知道': { name: '我知道', artist: 'BY2', mp3: 'assets/songs/wozhidao.mp3', lrc: 'assets/songs/wozhidao.lrc' },
  '恶作剧': { name: '恶作剧', artist: '林依晨', mp3: 'assets/songs/ezuoju.mp3', lrc: 'assets/songs/ezuoju.lrc' },
  '坠落': { name: '坠落', artist: '蔡健雅', mp3: 'assets/songs/zuiluo.mp3', lrc: 'assets/songs/zuiluo.lrc' },
  '孤身': { name: '孤身', artist: '徐秉龙', mp3: 'assets/songs/gushen.mp3', lrc: 'assets/songs/gushen.lrc' },
  '可不可以': { name: '可不可以', artist: '张紫豪', mp3: 'assets/songs/kebukeyi.mp3', lrc: 'assets/songs/kebukeyi.lrc' },
  '后会无期': { name: '后会无期', artist: '徐良&汪苏泷', mp3: 'assets/songs/houhuiwuqi.mp3', lrc: 'assets/songs/houhuiwuqi.lrc' },
  '一滴泪的时间 (L)': { name: '一滴泪的时间 (L)', artist: '赵紫骅', mp3: 'assets/songs/yidileideshijian.mp3', lrc: 'assets/songs/yidileideshijian.lrc' },
  '如愿': { name: '如愿', artist: '王菲', mp3: 'assets/songs/ruyuan.mp3', lrc: 'assets/songs/ruyuan.lrc' },
  '大眠': { name: '大眠', artist: '王心凌', mp3: 'assets/songs/damian.mp3', lrc: 'assets/songs/damian.lrc' },
  '乌梅子酱': { name: '乌梅子酱', artist: '李荣浩', mp3: 'assets/songs/wumeizijiang.mp3', lrc: 'assets/songs/wumeizijiang.lrc' },
  '说好的幸福呢': { name: '说好的幸福呢', artist: '周杰伦', mp3: 'assets/songs/shuohaodexinfune.mp3', lrc: 'assets/songs/shuohaodexinfune.lrc' },
  '倒数': { name: '倒数', artist: 'G.E.M. 邓紫棋', mp3: 'assets/songs/daoshu.mp3', lrc: 'assets/songs/daoshu.lrc' },
  '静悄悄': { name: '静悄悄', artist: '陈泫孝', mp3: 'assets/songs/jingqioqio.mp3', lrc: 'assets/songs/jingqioqio.lrc' },
  '爱我还是他': { name: '爱我还是他', artist: '陶喆', mp3: 'assets/songs/aiwohaishita.mp3', lrc: 'assets/songs/aiwohaishita.lrc' },
  '此生不换': { name: '此生不换', artist: '青鸟飞鱼', mp3: 'assets/songs/cishengbuhuan.mp3', lrc: 'assets/songs/cishengbuhuan.lrc' },
  '天天': { name: '天天', artist: '陶喆', mp3: 'assets/songs/tiantian.mp3', lrc: 'assets/songs/tiantian.lrc' },
  '孤雏': { name: '孤雏', artist: 'AGA', mp3: 'assets/songs/guchu.mp3', lrc: 'assets/songs/guchu.lrc' },
  '彩虹': { name: '彩虹', artist: '周杰伦', mp3: 'assets/songs/caihong.mp3', lrc: 'assets/songs/caihong.lrc' },
  '月牙湾': { name: '月牙湾', artist: 'F.I.R.飞儿乐团', mp3: 'assets/songs/yueyawan.mp3', lrc: 'assets/songs/yueyawan.lrc' },
};
const lrcCache = {}, rawCache = {};
const cfgMap = {};   // GM 在服务器保存的配置：{ 歌名: { offset: 毫秒, lrc: 歌词全文(空=用仓库里的文件) } }，由 net.js 收到 songcfg 后写入
const offOf = n => ((cfgMap[n] && cfgMap[n].offset) || 0) / 1000;   // 歌词延迟（秒）：显示时间 = 播放时间 − 延迟
const bar = () => $('lyricBar');
let micStream = null, current = null, remoteSong = null, remoteFrom = null;
const listeners = { mic: [], local: [], cfg: [], fx: [] };

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
  audio.volume = Math.max(0, Math.min(1, fx.accVol));
  if (typeof pos === 'number' && isFinite(pos)) { try { audio.currentTime = Math.max(0, pos); } catch (e) {} }   // pos=0 也要重置（同一首歌第二次播放必须回到开头）
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
  remoteAudio.volume = Math.max(0, Math.min(1, .85 * fx.accVol));
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

/* ---------- 音效：混响 / 回声 / 音色 / 混音（所有听众听到的是处理后的声音） ---------- */
const lsGet2 = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const PRESETS = {
  dry:    { name: '原声',   reverb: 0,   echo: 0,   tone: 0,   room: 0.6 },
  ktv:    { name: 'KTV',    reverb: .38, echo: .18, tone: .35, room: 1.4 },
  hall:   { name: '大厅',   reverb: .6,  echo: .08, tone: .1,  room: 2.4 },
  studio: { name: '录音棚', reverb: .16, echo: 0,   tone: .5,  room: 0.7 },
  air:    { name: '空灵',   reverb: .75, echo: .32, tone: .2,  room: 3.2 },
};
const FX_DEF = { preset: 'ktv', reverb: .38, echo: .18, tone: .35, room: 1.4, micVol: 1, accVol: 1, voiceVol: 1, headphone: false };
const fx = Object.assign({}, FX_DEF, lsGet2('sc_fx', null) || {});
const liveChains = new Set();
function saveFx() { try { localStorage.setItem('sc_fx', JSON.stringify(fx)); } catch (e) {} }

function irBuffer(ctx, sec) {             // 用代码生成混响脉冲响应：指数衰减的噪声 + 越往后越暗（高频先消失），不需要任何音频文件
  const rate = ctx.sampleRate, len = Math.max(64, Math.floor(rate * Math.max(.2, sec))), buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len, n = Math.random() * 2 - 1; lp += (n - lp) * (0.92 - 0.75 * t);
      d[i] = lp * Math.pow(1 - t, 2.4) * (i < rate * .01 ? i / (rate * .01) : 1);
    }
  }
  return buf;
}
function buildChain(ctx, stream) {        // 麦克风 → 低切 → 压缩 → 提亮 → [干声 + 混响 + 回声] → 限幅 → 输出
  const src = ctx.createMediaStreamSource(stream);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -26; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .22;
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.Q.value = .8;
  const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000;
  const vol = ctx.createGain(), mix = ctx.createGain(), dry = ctx.createGain(), rev = ctx.createGain(), ech = ctx.createGain(), fb = ctx.createGain();
  const conv = ctx.createConvolver(), dl = ctx.createDelay(1), dlp = ctx.createBiquadFilter();
  dl.delayTime.value = .27; fb.gain.value = .34; dlp.type = 'lowpass'; dlp.frequency.value = 3500; dry.gain.value = 1;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .08;
  const dest = ctx.createMediaStreamDestination(), an = ctx.createAnalyser(); an.fftSize = 512;
  src.connect(hp); hp.connect(comp); comp.connect(pres); pres.connect(air); air.connect(vol);
  vol.connect(dry); dry.connect(mix);
  vol.connect(conv); conv.connect(rev); rev.connect(mix);
  vol.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(ech); ech.connect(mix);
  mix.connect(lim); lim.connect(dest); lim.connect(an);
  const buf = new Uint8Array(an.fftSize);
  const chain = {
    stream: dest.stream, out: lim, ctx,
    apply() {
      vol.gain.value = fx.micVol; rev.gain.value = fx.reverb * 1.25; ech.gain.value = fx.echo;
      pres.gain.value = fx.tone * 5; air.gain.value = fx.tone * 4;
      if (conv._room !== fx.room) { conv._room = fx.room; conv.buffer = irBuffer(ctx, fx.room); }
    },
    level() { an.getByteTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; } return Math.min(1, Math.sqrt(sum / buf.length) * 5); },
    close() { liveChains.delete(chain); try { src.disconnect(); } catch (e) {} try { ctx.close(); } catch (e) {} },
  };
  chain.apply(); liveChains.add(chain);
  return chain;
}
function setFx(patch) {
  if ('preset' in patch && PRESETS[patch.preset]) { const p = PRESETS[patch.preset]; Object.assign(fx, { reverb: p.reverb, echo: p.echo, tone: p.tone, room: p.room }); }
  else if ('reverb' in patch || 'echo' in patch || 'tone' in patch) fx.preset = 'custom';
  Object.assign(fx, patch);
  for (const c of liveChains) c.apply();
  if (audio) audio.volume = Math.max(0, Math.min(1, fx.accVol));
  remoteAudio.volume = Math.max(0, Math.min(1, .85 * fx.accVol));
  if ('headphone' in patch && rawStream) { const t = rawStream.getAudioTracks()[0]; if (t && t.applyConstraints) t.applyConstraints({ echoCancellation: !fx.headphone }).catch(() => {}); }
  saveFx(); listeners.fx.forEach(f => { try { f(); } catch (e) {} });
}

/* ---------- 麦克风 ---------- */
let rawStream = null, chain = null;
function setStatus(t) { const s = $('karaokeMicStatus'); if (s) s.textContent = t; }
async function micOn() {
  if (micStream) return micStream;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setStatus('此环境不支持麦克风（需要 HTTPS 或 APK）'); throw new Error('no-mic'); }
  try {
    // 唱歌和说话不一样：降噪会把长音吃掉，自动增益会让音量忽大忽小，所以都关掉。
    // 回声消除只在「外放伴奏」时需要（防止伴奏漏进麦克风）；戴耳机时关掉音质更好。
    rawStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: !fx.headphone, noiseSuppression: false, autoGainControl: false, channelCount: 1 }, video: false });
  } catch (err) {
    setStatus(err.name === 'NotAllowedError' ? '麦克风权限被拒绝，请在系统设置中允许' : '麦克风启动失败：' + err.message);
    throw err;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  try {
    const ctx = new AC({ latencyHint: 'interactive' }); if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
    chain = buildChain(ctx, rawStream); micStream = chain.stream;
  } catch (e) { micStream = rawStream; chain = null; }      // 极端情况下（浏览器不支持 Web Audio）退回原始麦克风
  const b = $('karaokeMic'); if (b) b.textContent = '🔴 关闭麦克风';
  setStatus('麦克风已开启（好友可以听到你）');
  listeners.mic.forEach(f => f(true, micStream));
  return micStream;
}
function micOff() {
  if (!micStream) return;
  if (rawStream) rawStream.getTracks().forEach(t => t.stop()); micStream.getTracks().forEach(t => t.stop());
  if (chain) chain.close(); chain = null; micStream = null; rawStream = null;
  const b = $('karaokeMic'); if (b) b.textContent = '🎙 开启麦克风';
  setStatus('麦克风已关闭');
  listeners.mic.forEach(f => f(false, null));
}
function micStreamNow() { return micStream; }
function micLevel() { return chain ? chain.level() : 0; }

/* ---------- 面板按钮 ---------- */
$('karaokePlay')?.addEventListener('click', () => play(current ? current.name : '小幸运', audio && audio.currentTime || 0));
$('karaokePause')?.addEventListener('click', () => pause());
$('karaokeMic')?.addEventListener('click', () => { if (micStream) micOff(); else micOn().catch(() => {}); });
if (audio) audio.addEventListener('ended', () => { showBar(''); listeners.local.forEach(f => f('stop')); });

/* ---------- 麦克风测试（设置面板）：走和演唱时同一条效果链，戴耳机勾「回放」就能听到混响效果 ---------- */
let mt = null;
function mtStatus(t) { const s = $('micTestStatus'); if (s) s.textContent = t; }
async function micTestStart() {
  if (mt) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { mtStatus('此环境不支持麦克风（需要 HTTPS 或 APK）'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: !fx.headphone, noiseSuppression: false, autoGainControl: false }, video: false }); }
  catch (err) { mtStatus(err.name === 'NotAllowedError' ? '麦克风权限被拒绝，请在系统设置里允许' : '麦克风启动失败：' + err.message); return; }
  const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC({ latencyHint: 'interactive' });
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
  const ch = buildChain(ctx, stream), loopG = ctx.createGain(); loopG.gain.value = 0; ch.out.connect(loopG); loopG.connect(ctx.destination);
  let peak = 0, raf = 0; const t0 = performance.now(); mt = { stream, chain: ch, stop: null };
  const tick = () => {
    const lvl = ch.level(); peak = Math.max(peak, lvl / 5);
    const m = $('micMeter'); if (m) m.style.width = (lvl * 100).toFixed(0) + '%';
    loopG.gain.value = $('micLoop') && $('micLoop').checked ? 1 : 0;
    if (peak > 0.02) mtStatus('✅ 麦克风正常，能听到你的声音');
    else if (performance.now() - t0 > 4000) mtStatus('❌ 没检测到声音：请检查麦克风权限、是否静音，或靠近一点说话');
    raf = requestAnimationFrame(tick);
  };
  mt.stop = () => {
    cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); ch.close();
    mt = null; const b = $('micTestBtn'); if (b) b.textContent = '🎙 开始测试'; const m = $('micMeter'); if (m) m.style.width = '0%';
  };
  const b = $('micTestBtn'); if (b) b.textContent = '⏹ 停止测试'; mtStatus('请对着手机说话…'); tick();
}
$('micTestBtn')?.addEventListener('click', () => { if (mt) { mt.stop(); mtStatus('已停止'); } else micTestStart(); });
setInterval(() => { const p = $('setPanel'); if (mt && p && p.hidden) mt.stop(); }, 500);   // 关掉设置面板自动停止

/* ---------- 音效面板（点歌机里 + 设置里各挂一份，数据互通） ---------- */
const fxViews = [];
function mountFx(root) {
  if (!root) return;
  root.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'fxBox'; root.appendChild(wrap);
  const chips = document.createElement('div'); chips.className = 'fxChips'; wrap.appendChild(chips);
  const chipBtns = {};
  Object.entries(PRESETS).forEach(([k, p]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = p.name; b.onclick = () => setFx({ preset: k }); chips.appendChild(b); chipBtns[k] = b; });
  const sliders = {};
  const row = (key, label, min, max, step, fmt) => {
    const r = document.createElement('label'); r.className = 'fxRow'; const t = document.createElement('span'); t.textContent = label;
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
    const v = document.createElement('em');
    inp.addEventListener('input', () => setFx({ [key]: parseFloat(inp.value) }));
    r.append(t, inp, v); wrap.appendChild(r); sliders[key] = [inp, v, fmt];
  };
  const pct = v => Math.round(v * 100) + '%';
  row('reverb', '混响', 0, 1, .01, pct); row('echo', '回声', 0, .8, .01, pct); row('tone', '明亮度', 0, 1, .01, pct);
  row('micVol', '麦克风音量', 0, 2, .01, pct); row('accVol', '伴奏音量', 0, 1, .01, pct); row('voiceVol', '听别人唱歌的音量', 0, 1, .01, pct);
  const hp = document.createElement('label'); hp.className = 'fxHp'; const cb = document.createElement('input'); cb.type = 'checkbox';
  cb.addEventListener('change', () => setFx({ headphone: cb.checked })); hp.append(cb, document.createTextNode(' 我戴着耳机（关闭回声消除，音质更好；外放伴奏时请不要勾）')); wrap.appendChild(hp);
  const meter = document.createElement('div'); meter.className = 'meter'; const mi = document.createElement('i'); meter.appendChild(mi); wrap.appendChild(meter);
  const view = { root, sync() {
    Object.entries(chipBtns).forEach(([k, b]) => b.classList.toggle('on', fx.preset === k));
    Object.entries(sliders).forEach(([k, [inp, v, f]]) => { if (document.activeElement !== inp) inp.value = fx[k]; v.textContent = f(fx[k]); });
    cb.checked = !!fx.headphone;
  }, mi };
  fxViews.push(view); view.sync();
}
listeners.fx.push(() => fxViews.forEach(v => v.sync()));
setInterval(() => { const lv = micLevel(); fxViews.forEach(v => { if (v.root.isConnected && v.root.offsetParent) v.mi.style.width = (lv * 100).toFixed(0) + '%'; }); }, 100);

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
(function enableLyricDrag() {              // 歌词条可拖动：位置会记住，双击恢复默认
  const b = bar(); if (!b) return;
  const KEY = 'lyricBarPos';
  const par = () => b.offsetParent || document.body;
  function place(cx, cy) {
    const p = par(), w = b.offsetWidth, h = b.offsetHeight;
    cx = Math.max(w / 2, Math.min(cx, p.clientWidth - w / 2));
    cy = Math.max(h / 2, Math.min(cy, p.clientHeight - h / 2));
    b.style.left = cx + 'px'; b.style.top = cy + 'px';
    b.style.bottom = 'auto'; b.style.transform = 'translate(-50%,-50%)';
    return [cx, cy];
  }
  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!s) return;
      const p = par(); place(s.x * p.clientWidth, s.y * p.clientHeight);
    } catch (e) {}
  }
  let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
  b.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    const r = b.getBoundingClientRect(), pr = par().getBoundingClientRect();
    ox = r.left + r.width / 2 - pr.left; oy = r.top + r.height / 2 - pr.top;
    sx = e.clientX; sy = e.clientY; dragging = true;
    try { b.setPointerCapture(e.pointerId); } catch (_) {}
    b.style.cursor = 'grabbing';
  });
  b.addEventListener('pointermove', e => {
    if (!dragging) return; e.stopPropagation();
    place(ox + e.clientX - sx, oy + e.clientY - sy);
  });
  const end = e => {
    if (!dragging) return; dragging = false; b.style.cursor = 'grab';
    try {
      const p = par(), r = b.getBoundingClientRect(), pr = p.getBoundingClientRect();
      localStorage.setItem(KEY, JSON.stringify({
        x: (r.left + r.width / 2 - pr.left) / p.clientWidth,
        y: (r.top + r.height / 2 - pr.top) / p.clientHeight }));
    } catch (_) {}
  };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  b.addEventListener('dblclick', () => {
    b.style.left = b.style.top = b.style.bottom = b.style.transform = '';
    try { localStorage.removeItem(KEY); } catch (_) {}
  });
  window.addEventListener('resize', restore);
  restore();
})();

window.Karaoke = {
  play, pause, seek, duration, position, playing, songName, hasSong,
  lyricNow, setSongConfig, applyLocal, getSongConfig, songNames, rawLrc, fileLrc, onCfg(f) { listeners.cfg.push(f); },
  micOn, micOff, micStream: micStreamNow, micLevel,
  fx: { get: () => Object.assign({}, fx), set: setFx, presets: PRESETS, onChange(f) { listeners.fx.push(f); } }, mountFx,
  remoteStart, remoteSync, remoteStop, remotePlaying, remoteFromId,
  onMic(f) { listeners.mic.push(f); }, onLocal(f) { listeners.local.push(f); },
};
})();
