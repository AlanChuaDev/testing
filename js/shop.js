/* shop.js — 金币钱包 / 每日签到 / 商店 / 礼物（客户端）。
   金币由服务器保管（登录账号）：玩法里赚钱、花钱仍然是原来的写法（G.coinCount 改动），这里把改动自动上报给服务器，
   服务器再把真实余额发回来。商品表在 js/shopdata.js，服务器逻辑在 wallet.js。 */
(() => {
'use strict';
const SD = window.ShopData; if (!SD || !window.Net) return;
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let S = null, G = null, auth = false;               // S = 服务器发来的钱包；auth = 钱包已由服务器接管
let tab = 'sign', cat = 'title', giftTo = null, giftSel = 'rose';
let cur = 0, pending = 0, flushT = 0, syncing = false, lastNote = '', lastNoteAt = 0;
const toast = (m, ms) => (G && G.api && G.api.toast ? G.api.toast(m, ms) : null);

/* ---------- 金币：改动自动上报 ---------- */
function installCoins() {
  if (!G || G.__coinHook) return; G.__coinHook = true; cur = G.coinCount || 0;
  Object.defineProperty(G, 'coinCount', { configurable: true, enumerable: true,
    get() { return cur; },
    set(v) { v = Number(v) || 0; const d = Math.round(v - cur); cur = v; if (auth && !syncing && d) queue(d); } });
}
function queue(d) { pending += d; clearTimeout(flushT); flushT = setTimeout(flush, 500); }
function flush() { if (!pending) return; const d = pending; pending = 0; Net.send({ type: 'wallet_delta', delta: d }); }

function applyWallet(m) {
  const first = !auth; auth = true; S = m;
  if (G) { installCoins(); syncing = true; cur = m.coins + pending; syncing = false; const el = $('coinN'); if (el) el.textContent = fmt(cur); G.me && (G.me.cos = m.equip || null); }
  applyFrame();
  const now = Date.now();
  if (m.note && (m.note !== lastNote || now - lastNoteAt > 8000)) {
    lastNote = m.note; lastNoteAt = now;
    if (m.note === 'earn_cap') toast('今天从玩法里能赚的金币已达上限（' + fmt(m.earnCap) + '）', 3000);
    else if (m.note === 'no_coins') toast('金币不够啦', 2000);
  }
  if (panel && !panel.hidden) render();
  return first;
}
function applyFrame() {
  const av = $('avatar'); if (!av) return;
  const f = S && SD.look(S.equip) && SD.look(S.equip).frame;
  av.style.borderColor = f ? f.color : ''; av.style.boxShadow = f ? '0 0 10px ' + f.glow + ', 0 0 2px ' + f.color : '';
}

Net.on('wallet', m => applyWallet(m));
Net.on('sign_ok', m => toast('📅 签到成功！+' + m.reward + ' 金币（连续 ' + m.streak + ' 天）', 3200));
Net.on('shop_ok', m => toast('🛍 购买成功：' + m.name + '，记得点「装备」', 2800));
Net.on('gift_fx', m => giftFx(m));

const bootT = setInterval(() => { if (window.__game && window.__game.me) { clearInterval(bootT); G = window.__game; installCoins(); if (S) applyWallet(S); bindCoinChip(); } }, 250);
function bindCoinChip() { const c = $('coins'); if (c) { c.style.cursor = 'pointer'; c.title = '签到 / 商店 / 礼物'; c.addEventListener('click', () => open('sign')); } }

/* ---------- 面板 ---------- */
let panel = null, bodyEl = null;
const css = document.createElement('style');
css.textContent = `
#shopPanel .shHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 14px 0}
#shopPanel .shCoin{font-size:18px;font-weight:900;color:#ffd36e}
#shopPanel .shTabs,#shopPanel .shCats{display:flex;gap:6px;padding:8px 14px 0;flex-wrap:wrap}
#shopPanel .shBody{padding:10px 14px 14px;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;max-height:calc(100vh - 170px)}
#shopPanel .shGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:8px 0}
#shopPanel .shDay{padding:8px 2px;border-radius:10px;background:#ffffff12;text-align:center;font-size:12px;line-height:1.4}
#shopPanel .shDay b{display:block;font-size:14px;color:#ffd36e}
#shopPanel .shDay.done{background:#3e9b62;opacity:.9}#shopPanel .shDay.today{outline:2px solid #ffd36e;background:#ffffff22}
#shopPanel .shRow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #ffffff14}
#shopPanel .shPre{min-width:92px;display:flex;justify-content:center}
#shopPanel .shInfo{flex:1;min-width:0}#shopPanel .shInfo small{opacity:.7}
#shopPanel .shTitle{padding:2px 8px;border-radius:99px;font-size:12px;font-weight:800}
#shopPanel .shFrame{width:34px;height:34px;border-radius:9px;border:3px solid;background:#b9a6f0;display:inline-block}
#shopPanel .shBub{padding:4px 9px;border-radius:9px;font-size:12px;font-weight:600}
#shopPanel .shGifts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
#shopPanel .shGift{padding:10px 4px;border-radius:12px;background:#ffffff12;text-align:center;border:2px solid transparent}
#shopPanel .shGift.on{border-color:#ffd36e;background:#ffffff22}#shopPanel .shGift i{display:block;font-size:30px;font-style:normal}
#shopPanel select{width:100%;padding:8px;border-radius:10px;background:#ffffff14;color:#fff;border:1px solid #ffffff30}
#shopPanel .big{width:100%;padding:11px;font-size:15px;font-weight:900;margin-top:6px}
@keyframes giftUp{0%{transform:translate(-50%,0) scale(.5);opacity:0}15%{opacity:1}100%{transform:translate(-50%,-38vh) scale(1.6);opacity:0}}
.giftFly{position:fixed;left:50%;bottom:28%;font-size:54px;pointer-events:none;z-index:60;animation:giftUp 2.2s ease-out forwards}
`;
document.head.appendChild(css);

function ensurePanel() {
  if (panel) return;
  panel = document.createElement('section'); panel.className = 'sheet'; panel.id = 'shopPanel'; panel.hidden = true;
  panel.innerHTML = '<header><h2>🛍 签到 · 商店 · 礼物</h2><button class="x" type="button">✕</button></header><div class="shHead"><span class="shCoin" id="shCoin"></span><small id="shEarn" style="opacity:.7"></small></div><div class="shTabs" id="shTabs"></div><div class="shBody" id="shBody"></div>';
  document.body.appendChild(panel); bodyEl = panel.querySelector('#shBody');
  panel.querySelector('.x').onclick = () => { panel.hidden = true; };
}
function open(t) {
  ensurePanel(); document.querySelectorAll('.sheet').forEach(p => { p.hidden = true; });
  tab = t || tab; panel.hidden = false; if (auth) Net.send({ type: 'wallet_get' }); render();
}
function openGift(pub, name) { giftTo = pub ? { pub, name: name || '好友' } : null; open('gift'); }

const btn = (text, cls, fn, dis) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (cls ? ' ' + cls : ''); b.textContent = text; if (dis) b.disabled = true; b.onclick = fn; return b; };

function render() {
  if (!panel) return;
  $('shCoin').textContent = '🪙 ' + fmt(cur);
  $('shEarn').textContent = S ? '今日玩法已赚 ' + fmt(S.earned) + ' / ' + fmt(S.earnCap) : '';
  const tabs = $('shTabs'); tabs.textContent = '';
  [['sign', '📅 签到'], ['shop', '🛍 商店'], ['gift', '🎁 礼物']].forEach(([k, t]) => tabs.append(btn(t, tab === k ? 'on' : '', () => { tab = k; render(); })));
  bodyEl.textContent = '';
  if (!auth || !S) { bodyEl.innerHTML = '<p class="hint">登录账号后才能使用签到、商店和礼物。（如果已经登录，请稍等几秒，或刷新页面）</p>'; return; }
  if (tab === 'sign') renderSign(); else if (tab === 'shop') renderShop(); else renderGift();
}

function renderSign() {
  const n = SD.SIGN_REWARDS.length, cells = document.createElement('div'); cells.className = 'shGrid';
  SD.SIGN_REWARDS.forEach((r, i) => { const d = document.createElement('div'); d.className = 'shDay' + (S.signed ? (i <= S.slot ? ' done' : '') : (i < S.slot ? ' done' : '')) + (i === S.slot ? ' today' : ''); d.innerHTML = '第' + (i + 1) + '天<b>' + r + '</b>🪙'; cells.append(d); });
  const p = document.createElement('p'); p.className = 'hint'; p.textContent = '已连续签到 ' + S.streak + ' 天。每天签到领金币，连续 7 天后奖励重新循环；断签一天就从第 1 天重新开始。';
  const b = btn(S.signed ? '✔ 今天已签到，明天再来' : '📅 签到领取 ' + S.todayReward + ' 金币', 'on big', () => Net.send({ type: 'sign_in' }), S.signed);
  bodyEl.append(cells, p, b);
}

function preview(it) {
  if (it.slot === 'title') return '<span class="shTitle" style="background:' + it.bg + ';color:' + it.fg + '">' + esc(it.name) + '</span>';
  if (it.slot === 'frame') return '<span class="shFrame" style="border-color:' + it.color + ';box-shadow:0 0 9px ' + it.glow + '"></span>';
  if (it.slot === 'bubble') return '<span class="shBub" style="background:' + it.bg + ';color:' + it.fg + '">你好呀～</span>';
  return '<b style="color:' + it.color + '">玩家名字</b>';
}
function renderShop() {
  const cats = document.createElement('div'); cats.className = 'shCats'; cats.style.padding = '0 0 6px';
  Object.keys(SD.SLOTS).forEach(k => cats.append(btn(SD.SLOTS[k], cat === k ? 'on' : '', () => { cat = k; render(); })));
  bodyEl.append(cats);
  const have = new Set(S.items);
  SD.ITEMS.filter(i => i.slot === cat).forEach(it => {
    const row = document.createElement('div'); row.className = 'shRow';
    const owned = have.has(it.id), worn = S.equip && S.equip[it.slot] === it.id;
    row.innerHTML = '<div class="shPre">' + preview(it) + '</div><div class="shInfo"><b>' + esc(it.name) + '</b><br><small>' + (owned ? (worn ? '使用中' : '已拥有') : '🪙 ' + fmt(it.price)) + '</small></div>';
    row.append(owned ? btn(worn ? '卸下' : '装备', worn ? '' : 'on', () => Net.send({ type: 'shop_equip', slot: it.slot, id: worn ? null : it.id })) : btn('购买', 'on', () => { if (confirm('花 ' + it.price + ' 金币购买「' + it.name + '」？')) Net.send({ type: 'shop_buy', id: it.id }); }));
    bodyEl.append(row);
  });
}

function candidates() {
  const list = [], seen = new Set();
  if (giftTo) { list.push(giftTo); seen.add(giftTo.pub); }
  (Net.remotes() || []).forEach(e => { if (e.pub && !seen.has(e.pub)) { seen.add(e.pub); list.push({ pub: e.pub, name: e.name }); } });
  return list;
}
function renderGift() {
  const list = candidates();
  const sel = document.createElement('select'); sel.id = 'shTo';
  if (!list.length) sel.innerHTML = '<option value="">（附近没有可以送礼的玩家）</option>';
  list.forEach(c => { const o = document.createElement('option'); o.value = c.pub; o.textContent = '送给：' + c.name; sel.append(o); });
  if (giftTo) sel.value = giftTo.pub;
  sel.onchange = () => { const c = list.find(x => x.pub === sel.value); giftTo = c || null; };
  const grid = document.createElement('div'); grid.className = 'shGifts';
  SD.GIFTS.forEach(g => { const d = document.createElement('div'); d.className = 'shGift' + (giftSel === g.id ? ' on' : ''); d.innerHTML = '<i>' + g.icon + '</i>' + esc(g.name) + '<br><small>🪙 ' + g.price + '</small>'; d.onclick = () => { giftSel = g.id; render(); }; grid.append(d); });
  const g = SD.giftById[giftSel];
  const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = '送给好友还能增加亲密度（亲密度 = 礼物价格 ÷ 5）。对方需要在线。';
  const go = btn('🎁 送出 ' + g.icon + g.name + ' · 🪙' + g.price, 'on big', () => { const to = sel.value; if (!to) return toast('先选一个要送的人', 1800); Net.send({ type: 'gift_send', pub: to, gift: giftSel }); }, !list.length);
  bodyEl.append(sel, grid, hint, go);
}

/* ---------- 礼物特效 ---------- */
function giftFx(m) {
  const g = SD.giftById[m.gift]; if (!g || !G) return;
  const myId = Net.myId(), toE = m.toPid === myId ? G.me : Net.remote(m.toPid);
  if (toE && G.api.setBubble) G.api.setBubble(toE, g.icon + ' ' + g.name);
  if (G.api.addMsg) G.api.addMsg('world', '', '🎁 ' + m.fromName + ' 送给 ' + m.toName + ' ' + g.icon + g.name, false, true);
  if (m.fromPid === myId || m.toPid === myId) {
    const n = g.price >= 300 ? 10 : g.price >= 100 ? 5 : 1;
    for (let i = 0; i < n; i++) setTimeout(() => { const f = document.createElement('div'); f.className = 'giftFly'; f.textContent = g.icon; f.style.marginLeft = (Math.random() * 40 - 20) + 'vw'; f.style.fontSize = (36 + Math.random() * 30) + 'px'; document.body.appendChild(f); setTimeout(() => f.remove(), 2300); }, i * 140);
  }
}

window.Shop = { open, openGift, wallet: () => S };
})();
