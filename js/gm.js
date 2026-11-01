/* gm.js — GM 工具：在游戏里校准歌词延迟、编辑歌词，保存后全服更新。
   入口：⚙ 设置 → 最下面的「🛠 GM」。密钥只在服务器（Render 的 GM_KEY）验证，这里没有任何密钥。 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
let isGM = false, song = '', offset = 0, timer = 0, taTimer = 0;
const msg = t => { const m = $('gmMsg'); if (m) m.textContent = t; };
const loginMsg = t => { const m = $('gmLoginMsg'); if (m) m.textContent = t; };
const clampOff = v => Math.max(-10000, Math.min(10000, Math.round(v)));
const fmtOff = v => (v > 0 ? '+' : '') + v + ' ms';
const mmss = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + s.toFixed(1).padStart(4, '0'); };

/* LRC 里把某一行的时间戳平移 d 秒（用整数厘秒，避免 59.999 → 60.00 这类进位错误） */
function nudgeLine(text, ri, d) {
  const L = text.split(/\r?\n/); if (ri < 0 || ri >= L.length) return text;
  L[ri] = L[ri].replace(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g, (_, mm, ss, fr) => {
    const cs = Math.max(0, Math.round((Number(mm) * 60 + Number(ss) + (fr ? Number('0.' + fr) : 0) + d) * 100));
    const m = Math.floor(cs / 6000), s = (cs % 6000) / 100;
    return '[' + String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0') + ']';
  });
  return L.join('\n');
}
window.__gmNudgeLine = nudgeLine;   // 方便测试

function preview() {                // 把面板里的草稿应用到本机（还没保存到服务器，别的玩家看不到）
  if (!song || !window.Karaoke) return;
  Karaoke.applyLocal(song, { offset, lrc: $('gmLrc').value });
  $('gmOffVal').textContent = fmtOff(offset);
}
async function loadSong(name) {
  song = name; const c = Karaoke.getSongConfig(name);
  offset = c.offset; $('gmLrc').value = c.lrc || await Karaoke.rawLrc(name);
  $('gmOffVal').textContent = fmtOff(offset); msg('');
  Karaoke.applyLocal(name, { offset, lrc: $('gmLrc').value });
}
function showEdit(on) {
  $('gmLogin').hidden = on; $('gmEdit').hidden = !on; $('gmEdit2').hidden = !on;
  if (on) {
    const sel = $('gmSong'); if (!sel.children.length) Karaoke.songNames().forEach(n => { const o = document.createElement('option'); o.value = o.textContent = n; sel.appendChild(o); });
    loadSong(sel.value || Karaoke.songNames()[0]);
  }
}
function tick() {                   // 面板打开时每 0.1 秒刷新：当前句、下一句、播放时间
  const p = $('gmPanel'); if (!p || p.hidden) return;
  const L = Karaoke.lyricNow();
  $('gmCur').textContent = L ? L.cur : '（点「试听」开始播放）';
  $('gmNext').textContent = L && L.next ? '下一句：' + L.next : '';
  $('gmTime').textContent = L ? '播放 ' + mmss(L.t) : '';
}
function open() { $('setPanel').hidden = true; $('gmPanel').hidden = false; showEdit(isGM); if (!timer) timer = setInterval(tick, 100); }
function stopPreview() { if (window.Karaoke && Karaoke.playing()) Karaoke.pause(true); }

function bind() {
  $('gmOpen').onclick = open;
  $('gmLoginBtn').onclick = () => {
    if (!window.Net || !Net.connected) return loginMsg('还没连上服务器，等右上角显示「在线」后再试');
    loginMsg('验证中…'); Net.send({ type: 'gm_login', key: $('gmKey').value });
  };
  $('gmKey').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('gmLoginBtn').click(); });
  Net.on('gmOk', () => { isGM = true; $('gmKey').value = ''; loginMsg(''); if (!$('gmPanel').hidden) showEdit(true); });
  Net.on('gmFail', m => loginMsg(m.message || '登录失败'));
  Net.on('gmError', m => { msg('❌ ' + (m.message || '出错了')); if (m.code === 'auth') { isGM = false; stopPreview(); showEdit(false); loginMsg(m.message || ''); } });
  Net.on('gmSaved', m => msg(m.persist === 'upstash' ? '✅ 已保存，全服已更新，并永久保存' : '✅ 已保存，全服已更新。⚠ 服务器没有配置永久存储（Upstash），服务器重启后需要重新保存'));

  $('gmSong').onchange = () => { stopPreview(); loadSong($('gmSong').value); };
  document.querySelectorAll('#gmPanel [data-off]').forEach(b => b.onclick = () => { offset = clampOff(offset + Number(b.dataset.off)); preview(); });
  $('gmOffReset').onclick = () => { offset = 0; preview(); };
  $('gmPlay').onclick = () => { if (Karaoke.playing()) return; Karaoke.play(song, Karaoke.songName() === song ? Karaoke.position() : 0, true); };   // quiet：只在本机试听，不打扰房间里的人
  $('gmPause').onclick = () => Karaoke.pause(true);
  $('gmBack').onclick = () => Karaoke.seek(Karaoke.position() - 5);
  $('gmFwd').onclick = () => Karaoke.seek(Karaoke.position() + 5);
  document.querySelectorAll('#gmPanel [data-line]').forEach(b => b.onclick = () => {
    const L = Karaoke.lyricNow(); if (!L || L.ri < 0) return msg('先点「试听」，等歌词出现后再微调当前句');
    const ta = $('gmLrc'); ta.value = nudgeLine(ta.value, L.ri, Number(b.dataset.line)); preview();
  });
  $('gmLrc').addEventListener('input', () => { clearTimeout(taTimer); taTimer = setTimeout(preview, 300); });
  $('gmLrc').addEventListener('keydown', e => e.stopPropagation());
  $('gmReset').onclick = async () => { if (!confirm('恢复成仓库里的原始歌词，并把延迟清零？（要点「保存」才会生效到全服）')) return; offset = 0; $('gmLrc').value = await Karaoke.fileLrc(song); preview(); msg('已恢复原版，点「保存并全服更新」后生效'); };
  $('gmSave').onclick = async () => {
    if (!Net.connected) return msg('❌ 没连上服务器');
    const txt = $('gmLrc').value, file = await Karaoke.fileLrc(song);
    const lrc = txt.trim() === (file || '').trim() ? '' : txt;       // 和仓库文件一样就不存，继续用文件
    msg('保存中…'); Net.send({ type: 'gm_save', song, cfg: { offset, lrc } });
  };
  // 服务器重新下发配置后（比如重连），如果面板开着且你没在编辑，就同步一下显示
  Karaoke.onCfg(() => { if (isGM && !$('gmPanel').hidden && document.activeElement !== $('gmLrc')) { const c = Karaoke.getSongConfig(song); offset = c.offset; $('gmOffVal').textContent = fmtOff(offset); } });
}
if (window.Net && window.Karaoke && $('gmOpen')) bind();
else addEventListener('load', () => { if (window.Net && window.Karaoke && $('gmOpen')) bind(); });
})();
