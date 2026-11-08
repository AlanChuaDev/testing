/* notice.js — 「通知」面板：左边 通告 / 更新 / 活动，右边是内容列表；GM 在 GM 面板「通知中心」里发布。有新通知时按钮上显示红点。 */
(() => {
'use strict';
if (!window.Net) return;
const $ = id => document.getElementById(id);
const KINDS = [['notice', '📣 通告'], ['update', '🆕 更新'], ['event', '🎉 活动']];
const SEEN = 'sc_notice_seen';
let list = [], kind = 'notice', panel = null, side = null, main = null, ready = false;
const seenAt = () => { try { return Number(localStorage.getItem(SEEN)) || 0; } catch (e) { return 0; } };
const markSeen = () => { try { localStorage.setItem(SEEN, String(Date.now())); } catch (e) {} };
const toast = (m, ms) => { const g = window.__game; if (g && g.api && g.api.toast) g.api.toast(m, ms); };
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const when = at => { const d = new Date(at), p = n => String(n).padStart(2, '0'); return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
const newCount = k => list.filter(i => i.at > seenAt() && (!k || i.kind === k)).length;

const css = document.createElement('style');
css.textContent = `
button[data-act="notice"]{position:relative}
button[data-act="notice"].hasNew::after{content:"";position:absolute;top:5px;right:7px;width:11px;height:11px;border-radius:50%;background:#ff3b3b;border:2px solid #1b1640}
#noticePanel .ntShell{display:flex;min-height:200px;max-height:calc(100vh - 110px)}
#noticePanel .ntSide{width:96px;flex:none;display:flex;flex-direction:column;gap:6px;padding:10px 8px;border-right:1px solid #ffffff1f}
#noticePanel .ntSide button{position:relative;padding:10px 4px;border-radius:10px;background:#ffffff12;color:#fff;font-weight:800;font-size:13px}
#noticePanel .ntSide button.on{background:linear-gradient(#ff7ad1,#c63aa6)}
#noticePanel .ntSide button i{position:absolute;top:4px;right:4px;width:9px;height:9px;border-radius:50%;background:#ff3b3b}
#noticePanel .ntMain{flex:1;min-width:0;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:10px 14px 14px}
#noticePanel .ntItem{padding:10px 0;border-bottom:1px solid #ffffff14}
#noticePanel .ntItem b{display:block;font-size:15px}
#noticePanel .ntItem small{opacity:.6}
#noticePanel .ntItem p{margin:6px 0 0;white-space:pre-wrap;line-height:1.55;opacity:.92}
`;
document.head.appendChild(css);

function dot() { const b = document.querySelector('button[data-act="notice"]'); if (b) b.classList.toggle('hasNew', newCount() > 0); }
function ensure() {
  if (panel) return;
  panel = document.createElement('section'); panel.className = 'sheet'; panel.id = 'noticePanel'; panel.hidden = true;
  panel.innerHTML = '<header><h2>📢 通知</h2><button class="x" type="button">✕</button></header><div class="ntShell"><div class="ntSide" id="ntSide"></div><div class="ntMain" id="ntMain"></div></div>';
  document.body.appendChild(panel); side = panel.querySelector('#ntSide'); main = panel.querySelector('#ntMain');
  panel.querySelector('.x').onclick = () => { panel.hidden = true; markSeen(); dot(); };
}
function render() {
  if (!panel) return; side.textContent = ''; main.textContent = '';
  KINDS.forEach(([k, t]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = kind === k ? 'on' : ''; b.textContent = t;
    if (newCount(k)) { const i = document.createElement('i'); b.append(i); }
    b.onclick = () => { kind = k; render(); }; side.append(b);
  });
  const items = list.filter(i => i.kind === kind);
  if (!ready) main.innerHTML = '<p class="hint">加载中…</p>';
  else if (!items.length) main.innerHTML = '<p class="hint">暂时没有内容。</p>';
  else items.forEach(i => { const d = document.createElement('div'); d.className = 'ntItem'; d.innerHTML = '<b>' + esc(i.title) + '</b><small>' + when(i.at) + '</small><p>' + esc(i.body) + '</p>'; main.append(d); });
}
function open() {
  ensure(); document.querySelectorAll('.sheet').forEach(p => { p.hidden = true; });
  const firstNew = KINDS.find(([k]) => newCount(k)); if (firstNew) kind = firstNew[0];
  panel.hidden = false; render(); Net.send({ type: 'notice_get' });
  setTimeout(() => { markSeen(); dot(); }, 1200);   // 看过了：红点消失
}
Net.on('notices', m => { list = Array.isArray(m.list) ? m.list : []; ready = true; dot(); if (panel && !panel.hidden) render(); });
Net.on('notice_new', m => { if (!m.item) return; list = [m.item].concat(list.filter(i => i.id !== m.item.id)); dot(); toast('📢 新通知：' + m.item.title, 3200); if (panel && !panel.hidden) render(); });
Net.on('joined', () => Net.send({ type: 'notice_get' }));
setTimeout(() => { if (Net.connected) Net.send({ type: 'notice_get' }); dot(); }, 1500);
window.Notice = { open, list: () => list };
})();
