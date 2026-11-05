/* profile.js — 「我」资料面板 / 查看别人资料 / 好友 / 私信 / 账号（绑定邮箱）。
   依赖 window.Net、window.Auth、window.__game。所有来自网络的文字一律用 textContent，不拼 innerHTML。
   需要登录（Firebase）才能用；没登录时面板会提示，游戏其它功能不受影响。 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k.startsWith('on')) el[k] = v; else el.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const toast = (m, ms) => { const g = window.__game; if (g && g.api) g.api.toast(m, ms); };
const send = o => window.Net && Net.send(o);
const GENDER = { secret: '保密', male: '男', female: '女', other: '其他' };
const VIS = { public: ['🌍 公开', '所有人都能看到'], friends: ['👥 好友可见', '加了好友才能看到'], private: ['🔒 私密', '只有你自己能看到'] };

const S = { authed: false, acct: null, me: null, friends: [], inReq: [], outReq: [], presence: {}, dmPub: null, dmName: '', dmMsgs: [], unread: {}, viewPub: null };

/* ---------- 面板外壳 ---------- */
function sheet(id, title, small) {
  const el = h('section', { class: 'sheet' + (small ? ' small' : ''), id, hidden: '' },
    h('header', null, h('h2', { text: title }), h('button', { class: 'x', type: 'button', text: '✕', onclick: () => { el.hidden = true; if (id === 'dmP') { S.dmPub = null; } } })),
    h('div', { class: 'pfBody' }));
  el.hidden = true; document.body.append(el); return el;
}
const meP = sheet('meP', '👤 我 · 个人资料'), vwP = sheet('vwP', '👤 玩家资料', true), frP = sheet('frP', '👥 好友', true), dmP = sheet('dmP', '💬 私信', true);
const body = p => p.querySelector('.pfBody');
function show(p) { document.querySelectorAll('.sheet').forEach(x => { if (x !== p) x.hidden = true; }); p.hidden = false; }
const needLogin = () => h('p', { class: 'hint pfPad', text: window.Auth && Auth.ready ? '正在登录账号…请稍等几秒再试。' : '账号服务没有连上（网络问题或 Firebase 被拦截）。游戏可以继续玩，但好友 / 资料 / 私信暂时不能用。' });

/* ---------- 我的资料 ---------- */
function renderMe() {
  const b = body(meP); b.textContent = '';
  if (!S.authed || !S.me) { b.append(needLogin()); return; }
  const m = S.me, left = Math.max(0, (m.nextNameAt || 0) - Date.now());
  const nm = h('input', { type: 'text', maxlength: '12', value: m.name, placeholder: '昵称（1–12 字）' });
  const gd = h('select', null, ...Object.entries(GENDER).map(([k, v]) => h('option', { value: k, text: v, selected: m.gender === k ? '' : null })));
  const bio = h('textarea', { maxlength: '100', rows: '3', placeholder: '自我介绍（100 字以内）' }); bio.value = m.bio || '';
  const ig = h('input', { type: 'text', maxlength: '100', placeholder: 'Instagram 用户名或链接', value: m.ig || '' });
  const fb = h('input', { type: 'text', maxlength: '100', placeholder: 'Facebook 用户名或链接', value: m.fb || '' });
  let vis = m.visibility;
  const visRow = h('div', { class: 'pfVis' });
  const drawVis = () => { visRow.textContent = ''; Object.entries(VIS).forEach(([k, [t]]) => visRow.append(h('button', { type: 'button', class: 'chip' + (vis === k ? ' on' : ''), text: t, onclick: () => { vis = k; drawVis(); visNote.textContent = VIS[k][1]; } }))); };
  const visNote = h('p', { class: 'hint', text: VIS[vis][1] });
  drawVis();
  const nameBtn = h('button', { class: 'chip', type: 'button', text: left ? '改名（' + fmtLeft(left) + '后可改）' : '保存昵称', onclick: () => { if (left) return toast('昵称每天只能改一次'); send({ type: 'name_set', name: nm.value }); } });
  if (left) nameBtn.disabled = true;
  b.append(
    h('div', { class: 'pfPad' },
      h('label', { text: '昵称（每天只能改一次，不能和别人重名）' }), h('div', { class: 'pfRow' }, nm, nameBtn),
      h('label', { text: '性别' }), gd,
      h('label', { text: '自我介绍' }), bio,
      h('label', { text: 'Instagram' }), ig,
      h('label', { text: 'Facebook' }), fb,
      h('label', { text: '谁能看到我的资料（性别、介绍、IG、FB）' }), visRow, visNote,
      h('p', { class: 'hint', text: '昵称永远公开；其它内容按上面的设置显示。IG / FB 只接受 instagram.com / facebook.com 的链接或用户名。' }),
      h('button', { class: 'chip on pfSave', type: 'button', text: '💾 保存资料', onclick: () => send({ type: 'profile_set', gender: gd.value, bio: bio.value, ig: ig.value, fb: fb.value, visibility: vis }) })),
    accountBox());
}
const fmtLeft = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.ceil(m / 60) + ' 小时' : m + ' 分钟'; };

function accountBox() {
  const A = window.Auth, box = h('div', { class: 'pfPad pfAcct' }, h('h3', { text: '🔑 账号' }));
  if (!A || !A.ready) return box;
  const email = h('input', { type: 'email', placeholder: '邮箱', autocomplete: 'email' }), pw = h('input', { type: 'password', placeholder: '密码（至少 6 位）', autocomplete: 'new-password' });
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok, 2200); } catch (e) { toast(A.err(e), 3200); } };
  if (A.anon) {
    const gLogin = async () => {
      try {
        const r = await A.googleLogin();
        if (r && r.cred) { if (confirm('这个 Google 账号已经有游戏资料。登录后会切换成那个账号，这台设备当前的游客资料不会合并。继续？')) { await A.googleSwitch(r.cred); toast('登录成功', 2200); } }
        else toast(r && r.linked ? '已用 Google 绑定 ✅' : '登录成功', 2200);
      } catch (e) { toast(A.err(e), 3200); }
    };
    box.append(h('p', { class: 'hint', text: '现在是「游客账号」：只保存在这台设备上，清除浏览器数据或换手机就找不回来了。用 Google 登录（或绑定邮箱）后好友和资料都会保留，换设备登录同一个账号即可。' }),
      h('div', { class: 'pfRow' }, h('button', { class: 'chip on', type: 'button', text: '🔵 用 Google 登录 / 绑定', onclick: gLogin })), email, pw,
      h('div', { class: 'pfRow' },
        h('button', { class: 'chip on', type: 'button', text: '绑定邮箱', onclick: () => run(() => A.linkEmail(email.value.trim(), pw.value), '已绑定邮箱 ✅') }),
        h('button', { class: 'chip', type: 'button', text: '登录已有账号', onclick: () => { if (confirm('登录后会切换成那个账号，这台设备当前的游客资料不会合并。继续？')) run(() => A.signIn(email.value.trim(), pw.value), '登录成功'); } }),
        h('button', { class: 'chip', type: 'button', text: '忘记密码', onclick: () => run(() => A.resetPassword(email.value.trim()), '重置邮件已发送（也看看垃圾箱）') })));
  } else {
    const gBind = async () => {
      try {
        const r = await A.linkGoogle();
        if (r && r.cred) {
          if (confirm('这个 Google 账号已经有另一个游戏账号，两个账号的数据无法合并。\n点「确定」= 切换到那个 Google 账号（当前账号的好友、金币、外观不会搬过去）\n点「取消」= 不绑定，继续用当前账号')) { await A.googleSwitch(r.cred); toast('已切换账号', 2200); }
        } else { toast('已绑定 Google ✅ 以后可以用 Google 登录这个账号', 3000); if (!meP.hidden) renderMe(); }
      } catch (e) { toast(A.err(e), 3200); }
    };
    box.append(h('p', { text: '已登录：' + A.label }), A.googleLinked
      ? h('p', { class: 'hint', text: '🔵 已绑定 Google：' + (A.googleEmail || '') })
      : h('div', { class: 'pfRow' }, h('button', { class: 'chip on', type: 'button', text: '🔵 绑定 Google', onclick: gBind }), h('span', { class: 'hint', text: ' 绑定后好友、金币、外观都保留，换设备也能用 Google 登录' })),
      h('button', { class: 'chip', type: 'button', text: '退出账号', onclick: () => { if (confirm('退出后需要重新登录才能进入游戏。确定？')) run(() => A.signOut()); } }));
  }
  return box;
}

/* ---------- 看别人的资料 ---------- */
function renderView(p) {
  const b = body(vwP); b.textContent = '';
  if (!p) { b.append(h('p', { class: 'hint pfPad', text: '找不到这个玩家的资料（对方可能是游客）。' })); return; }
  const rel = relation(p.pub), link = (v, host) => { if (!v) return null; const a = h('a', { href: /^https?:\/\//.test(v) ? v : 'https://' + host + '/' + v, target: '_blank', rel: 'noopener noreferrer nofollow', text: v.replace(/^https?:\/\/(www\.)?/, '') }); return a; };
  b.append(h('div', { class: 'pfPad' },
    h('h3', { class: 'pfName', text: p.name }),
    p.hidden ? h('p', { class: 'hint', text: p.visibility === 'private' ? '🔒 对方的资料是私密的' : '🔒 加为好友后才能看到对方的资料' })
      : [h('p', { text: '性别：' + (GENDER[p.gender] || '保密') }), h('p', { class: 'pfBio', text: p.bio || '（这个人很懒，什么都没写）' }),
        p.ig ? h('p', null, 'Instagram：', link(p.ig, 'instagram.com')) : null, p.fb ? h('p', null, 'Facebook：', link(p.fb, 'facebook.com')) : null],
    p.self ? null : h('div', { class: 'pfRow' },
      rel === 'friend' ? h('button', { class: 'chip on', type: 'button', text: '💬 私信', onclick: () => openDm(p.pub, p.name) })
        : h('button', { class: 'chip on', type: 'button', text: rel === 'out' ? '⏳ 申请已发送' : rel === 'in' ? '✅ 同意好友申请' : '➕ 加好友', disabled: rel === 'out' ? '' : null, onclick: () => { send({ type: rel === 'in' ? 'friend_accept' : 'friend_request', pub: p.pub }); vwP.hidden = true; } }))));
}

/* ---------- 好友列表 ---------- */
function renderFriends() {
  const b = body(frP); b.textContent = '';
  if (!S.authed) { b.append(needLogin()); return; }
  const wrap = h('div', { class: 'pfPad' });
  if (S.inReq.length) { wrap.append(h('h3', { text: '好友申请' })); S.inReq.forEach(r => wrap.append(h('div', { class: 'frRow' }, h('span', { class: 'frN', text: r.name || '玩家' }),
    h('button', { class: 'chip on', type: 'button', text: '同意', onclick: () => send({ type: 'friend_accept', pub: r.pub }) }), h('button', { class: 'chip', type: 'button', text: '拒绝', onclick: () => send({ type: 'friend_decline', pub: r.pub }) })))); }
  wrap.append(h('h3', { text: '我的好友（' + S.friends.length + '）' }));
  if (!S.friends.length) wrap.append(h('p', { class: 'hint', text: '还没有好友。点场景里的玩家 → 加好友。' }));
  const bondLine = f => {                       // 亲密度：等级 + 进度条 + 每日问暖
    const b = f.bond; if (!b) return null;
    const pct = b.maxed ? 100 : Math.max(0, Math.min(100, Math.round(100 * b.into / Math.max(1, b.need))));
    return h('div', { class: 'frBond' }, h('span', { class: 'frLv', text: '💞 Lv.' + b.level }),
      h('div', { class: 'frBar', title: b.maxed ? '亲密度已满级' : '距离下一级 ' + (b.need - b.into) }, h('i', { style: 'width:' + pct + '%' })),
      h('span', { class: 'frXp', text: b.maxed ? 'MAX' : b.into + '/' + b.need }),
      h('button', { class: 'chip' + (b.careDone ? '' : ' on'), type: 'button', text: b.careDone ? '✔ 已问暖' : '💌 问暖', disabled: b.careDone ? '' : null, onclick: () => send({ type: 'care', pub: f.pub }) }));
  };
  [...S.friends].sort((a, c) => (c.online ? 1 : 0) - (a.online ? 1 : 0)).forEach(f => wrap.append(h('div', { class: 'frItem' }, h('div', { class: 'frRow' },
    h('i', { class: 'frDot' + (f.online ? ' on' : '') }), h('span', { class: 'frN', text: f.name || '玩家' }), f.unread ? h('b', { class: 'frUn', text: f.unread > 99 ? '99+' : String(f.unread) }) : null,
    h('button', { class: 'chip', type: 'button', text: '资料', onclick: () => viewProfile(f.pub) }), h('button', { class: 'chip on', type: 'button', text: '私信', onclick: () => openDm(f.pub, f.name) }),
    h('button', { class: 'chip', type: 'button', text: '🎁', title: '送礼物', onclick: () => { if (window.Shop) Shop.openGift(f.pub, f.name); } }),
    h('button', { class: 'chip', type: 'button', text: '✕', title: '删除好友', onclick: () => { if (confirm('删除好友「' + (f.name || '') + '」？')) send({ type: 'friend_remove', pub: f.pub }); } })), bondLine(f))));
  b.append(wrap);
}
function totalUnread() { return S.friends.reduce((n, f) => n + (f.unread || 0), 0) + S.inReq.length; }
function badge() {
  const btn = document.querySelector('[data-act="friends"]'); if (!btn) return;
  let d = btn.querySelector('.dot'); const n = totalUnread();
  if (n && !d) { d = h('i', { class: 'dot' }); btn.append(d); } else if (!n && d) d.remove();
}

/* ---------- 私信 ---------- */
function renderDm() {
  const b = body(dmP); b.textContent = '';
  dmP.querySelector('h2').textContent = '💬 ' + (S.dmName || '私信');
  const list = h('div', { class: 'dmList', id: 'dmList' });
  S.dmMsgs.forEach(m => list.append(h('div', { class: 'dmMsg' + (m.mine ? ' me' : '') }, h('span', { text: m.text }))));
  const inp = h('input', { type: 'text', maxlength: '200', placeholder: '输入消息…', enterkeyhint: 'send' });
  const form = h('form', { class: 'dmForm', onsubmit: e => { e.preventDefault(); const t = inp.value.trim(); if (!t) return; send({ type: 'dm_send', pub: S.dmPub, text: t }); inp.value = ''; } }, inp, h('button', { class: 'chip on', type: 'submit', text: '发送' }));
  inp.addEventListener('keydown', e => e.stopPropagation());
  b.append(list, form); list.scrollTop = list.scrollHeight;
}
function openDm(pub, name) {
  if (!S.authed) return toast('请先登录账号');
  S.dmPub = pub; S.dmName = name || (S.friends.find(f => f.pub === pub) || {}).name || '好友'; S.dmMsgs = [];
  renderDm(); show(dmP); send({ type: 'dm_history', pub }); send({ type: 'dm_read', pub });
  const f = S.friends.find(x => x.pub === pub); if (f) { f.unread = 0; badge(); }
}
function viewProfile(pub) { if (!S.authed) return toast('请先登录账号'); S.viewPub = pub; body(vwP).textContent = ''; body(vwP).append(h('p', { class: 'hint pfPad', text: '加载中…' })); show(vwP); send({ type: 'profile_get', pub }); }
function relation(pub) {
  if (S.friends.some(f => f.pub === pub)) return 'friend';
  if (S.outReq.includes(pub)) return 'out';
  if (S.inReq.some(r => r.pub === pub)) return 'in';
  return 'none';
}

/* ---------- 服务器消息 ---------- */
function on(t, fn) { if (window.Net) Net.on(t, fn); }
on('hello_ok', m => { S.authed = !!m.authed; if (!S.authed) { S.me = null; S.friends = []; S.inReq = []; S.outReq = []; badge(); } });
on('me_profile', m => {
  S.authed = true; S.me = m.profile; S.acct = m.acct;
  const g = window.__game; if (g && g.me) g.me.name = m.profile.name;
  if (window.Profile) Profile.name = m.profile.name; $('pname').textContent = m.profile.name;
  if (window.Auth) Auth.setDisplayName(m.profile.name);   // 昵称记到账号上，换设备登录直接用
  try { const lp = JSON.parse(localStorage.getItem('sc_profile') || 'null'); if (lp && lp.name !== m.profile.name) { lp.name = m.profile.name; localStorage.setItem('sc_profile', JSON.stringify(lp)); } } catch (e) {}
  if (m.saved) toast(m.renamed ? '昵称已更新 ✅' : '资料已保存 ✅');
  if (!meP.hidden) renderMe();
});
on('profile', m => { if (m.pub === S.viewPub && !vwP.hidden) renderView(m.profile); });
on('friends', m => {
  S.friends = m.friends || []; S.inReq = m.inReq || []; S.outReq = m.outReq || [];
  badge(); if (!frP.hidden) renderFriends(); if (!vwP.hidden && S.viewPub) send({ type: 'profile_get', pub: S.viewPub });
});
on('care_ok', m => { toast('💌 已问暖，亲密度 +' + (m.gained || 0) + (m.streak > 1 ? '（连续 ' + m.streak + ' 天）' : ''), 2600); });
on('friend_req', m => { toast('👥 ' + (m.name || '有人') + ' 想加你为好友', 3000); });
on('presence', m => { const f = S.friends.find(x => x.pub === m.pub); if (f) { f.online = m.online; f.room = m.room; if (!frP.hidden) renderFriends(); if (m.online && m.name) toast('💚 好友 ' + m.name + ' 上线了', 1800); } });
on('dm_history', m => { if (m.pub !== S.dmPub) return; S.dmMsgs = (m.msgs || []).map(x => ({ mine: !!x.mine, text: x.text, at: x.at })); renderDm(); });
on('dm', m => {
  if (m.pub === S.dmPub && !dmP.hidden) { S.dmMsgs.push({ mine: !!m.mine, text: m.text, at: m.at }); renderDm(); if (!m.mine) send({ type: 'dm_read', pub: m.pub }); return; }
  if (!m.mine) {
    const f = S.friends.find(x => x.pub === m.pub); if (f) f.unread = (f.unread || 0) + 1;
    toast('💬 ' + (m.name || (f && f.name) || '好友') + '：' + String(m.text).slice(0, 30), 3000); badge(); if (!frP.hidden) renderFriends();
  }
});
on('auth_fail', m => { S.authed = false; if (m && m.message) toast(m.message, 3000); });

/* ---------- 对外接口 ---------- */
window.Friends = {
  get authed() { return S.authed; },
  relation, viewProfile, openDm,
  open() { renderFriends(); show(frP); if (S.authed) send({ type: 'friends_get' }); },
  openMe() { renderMe(); show(meP); },
};
})();
