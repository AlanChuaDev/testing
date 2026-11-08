/* bond.js — 好友「互动」面板：和某个好友的亲密度等级、今日任务、累计任务（都带进度条）。数据来自服务器 bonds.js 的 detail()。 */
(() => {
'use strict';
if (!window.Net) return;
const $ = id => document.getElementById(id);
const toast = (m, ms) => { const g = window.__game; if (g && g.api && g.api.toast) g.api.toast(m, ms); };
let panel = null, body = null, who = null, data = null;

const css = document.createElement('style');
css.textContent = `
#bondPanel .bdBody{padding:10px 14px 14px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;max-height:calc(100vh - 120px)}
#bondPanel h4{margin:14px 0 6px;font-size:13px;opacity:.8}
#bondPanel .bdLv{display:flex;align-items:center;gap:8px}
#bondPanel .bdLv b{color:#ffd36e;font-size:16px;white-space:nowrap}
#bondPanel .bdRow{padding:7px 0;border-bottom:1px solid #ffffff14}
#bondPanel .bdTop{display:flex;justify-content:space-between;gap:8px;font-size:13px}
#bondPanel .bdTop small{opacity:.7;text-align:right}
#bondPanel .bdBar{height:8px;border-radius:99px;background:#ffffff1f;overflow:hidden;margin-top:5px}
#bondPanel .bdBar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#ff8fd8,#ffd36e)}
#bondPanel .bdRow.done .bdBar i{background:#59d38a}
#bondPanel .bdRow.lock{opacity:.5}
`;
document.head.appendChild(css);

function ensure() {
  if (panel) return;
  panel = document.createElement('section'); panel.className = 'sheet'; panel.id = 'bondPanel'; panel.hidden = true;
  panel.innerHTML = '<header><h2 id="bdTitle">💞 互动</h2><button class="x" type="button">✕</button></header><div class="bdBody" id="bdBody"></div>';
  document.body.appendChild(panel); body = panel.querySelector('#bdBody');
  panel.querySelector('.x').onclick = () => { panel.hidden = true; };
}
function open(pub, name) {
  ensure(); who = { pub, name: name || '好友' }; data = null;
  document.querySelectorAll('.sheet').forEach(p => { p.hidden = true; });
  panel.hidden = false; $('bdTitle').textContent = '💞 与 ' + who.name + ' 的互动'; render();
  Net.send({ type: 'bond_detail', pub });
}
const pct = (a, b) => Math.max(0, Math.min(100, Math.round(100 * a / Math.max(1, b))));
const fmt = n => (Math.round(n * 10) / 10).toString();
function row(name, right, p, cls) {
  const d = document.createElement('div'); d.className = 'bdRow' + (cls ? ' ' + cls : '');
  d.innerHTML = '<div class="bdTop"><span>' + name + '</span><small>' + right + '</small></div><div class="bdBar"><i style="width:' + p + '%"></i></div>';
  return d;
}
function render() {
  if (!body) return; body.textContent = '';
  if (!data) { body.innerHTML = '<p class="hint">加载中…</p>'; return; }
  const lv = document.createElement('div'); lv.className = 'bdLv';
  lv.innerHTML = '<b>💞 Lv.' + data.level + '</b><div class="bdBar" style="flex:1"><i style="width:' + (data.maxed ? 100 : pct(data.into, data.need)) + '%"></i></div><small>' + (data.maxed ? 'MAX' : data.into + '/' + data.need) + '</small>';
  body.append(lv);
  const h1 = document.createElement('h4'); h1.textContent = '今日任务（每天 0 点刷新）'; body.append(h1);
  data.daily.forEach(d => {
    if (d.locked) { body.append(row(d.name, '功能暂未开通', 0, 'lock')); return; }
    const done = d.got >= d.cap;
    body.append(row(d.name, (d.id === 'care' ? (done ? '已完成 · ' : '未完成 · ') + d.note : d.got + '/' + d.cap + ' ' + d.unit), pct(d.got, d.cap), done ? 'done' : ''));
  });
  const h2 = document.createElement('h4'); h2.textContent = '累计任务（完成一档自动奖励亲密度）'; body.append(h2);
  data.tasks.forEach(t => {
    if (t.locked) { body.append(row(t.name, '功能暂未开通', 0, 'lock')); return; }
    if (t.all) { body.append(row(t.name, '全部完成 ✔', 100, 'done')); return; }
    const cur = t.cur / t.div, goal = t.goal / t.div;
    body.append(row(t.name + '（第 ' + (t.tier + 1) + '/' + t.tiers + ' 档）', fmt(cur) + '/' + fmt(goal) + ' ' + t.unit + ' · 奖励 +' + t.xp, pct(t.cur, t.goal)));
  });
  const tip = document.createElement('p'); tip.className = 'hint'; tip.textContent = '累计从这个版本开始统计；亲密度只在好友之间增长。'; body.append(tip);
}
Net.on('bond_detail', m => { if (who && m.pub === who.pub) { data = m; if (panel && !panel.hidden) render(); } });
window.Bond = { open };
})();
