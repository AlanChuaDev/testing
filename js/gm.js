/* gm.js — GM 控制中心：左侧分类导航 + 右侧独立工作区。
   分类：总览 / 举报中心 / 在线玩家 / 玩家资料 / 传送管理 / 音乐调试 / 全服管理 / GM设置。
   所有管理操作都由服务器再次校验 GM 身份（Render 的 GM_KEY），这里没有任何密钥，前端隐藏按钮不等于权限。 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
let isGM = false, song = '', offset = 0, timer = 0, taTimer = 0, autoTimer = 0, seeking = false, musicReady = false;
let page = 'overview', players = [], reports = [], rFilter = 'pending', sel = null, selPid = null, selReport = -1;
window.GM = { isGM: false, invisible: false };

const REASONS = { harass: '骚扰/辱骂', porn: '色情内容', ad: '广告/刷屏', other: '其他' };
const STATUS = { handled: '已处理', dismissed: '已驳回', mute: '已禁言', kick: '已踢出房间' };
const VIS = { public: '公开', friends: '好友可见', private: '私密' };
const statusLabel = s => STATUS[s] || '待处理';
const roomLabel = r => r ? String(r).replace(/^sv1:/, '') : '未进入场景';
const fmtAt = t => { try { return t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '未知'; } catch (e) { return String(t || ''); } };
const msg = t => { const m = $('gmMsg'); if (m) m.textContent = t; };
const loginMsg = t => { const m = $('gmLoginMsg'); if (m) m.textContent = t; };
const consoleMsg = t => { const el = $('gmConsoleMsg'); if (el) el.textContent = t; };
const clampOff = v => Math.max(-10000, Math.min(10000, Math.round(v)));
const fmtOff = v => (v > 0 ? '+' : '') + v + ' ms';
const mmss = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + s.toFixed(1).padStart(4, '0'); };
const fmtT = t => { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const mutedText = ms => ms > 0 ? '禁言中（还剩约 ' + Math.max(1, Math.ceil(ms / 60000)) + ' 分钟）' : '正常';
function node(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function gmBtn(parent, label, fn, cls) { const b = node('button', 'chip' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.onclick = fn; parent.appendChild(b); return b; }

/* ---------- LRC：把某一行的时间戳平移 d 秒（整数厘秒，避免 59.999 → 60.00 进位错误） ---------- */
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

/* ---------- 音乐调试 ---------- */
function preview() {                // 草稿只应用到本机，保存后才全服生效
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
function ensureMusic() {
  const s = $('gmSong');
  if (!s.children.length) Karaoke.songNames().forEach(n => { const o = document.createElement('option'); o.value = o.textContent = n; s.appendChild(o); });
  if (!musicReady) { musicReady = true; loadSong(s.value || Karaoke.songNames()[0]); }
}
function stopPreview() { if (window.Karaoke && Karaoke.playing()) Karaoke.pause(true); }
function tick() {                   // 每 0.1 秒刷新当前句 / 进度（只在音乐调试页）
  const p = $('gmPanel'); if (!p || p.hidden || page !== 'music') return;
  const L = Karaoke.lyricNow();
  $('gmCur').textContent = L ? L.cur : '（点「试听」开始播放）';
  $('gmNext').textContent = L && L.next ? '下一句：' + L.next : '';
  $('gmTime').textContent = L ? '播放 ' + mmss(L.t) : '';
  const sk = $('gmSeek'), d = Karaoke.duration(), pos = Karaoke.songName() === song ? Karaoke.position() : 0;
  if (!seeking) { sk.max = d || 300; sk.value = pos; }
  $('gmSeekT').textContent = fmtT(pos) + ' / ' + fmtT(d);
}

/* ---------- 导航 / 页面 ---------- */
function refreshPage() {
  if (!isGM || !window.Net) return;
  if (page === 'overview') Net.send({ type: 'gm_overview' });
  else if (page === 'reports') Net.send({ type: 'gm_reports' });
  else if (page === 'players' || page === 'server' || page === 'profile' || page === 'teleport') Net.send({ type: 'gm_players' });
  else if (page === 'settings') Net.send({ type: 'gm_action_log' });
}
function show(p) {
  if (page === 'music' && p !== 'music') stopPreview();
  page = p;
  document.querySelectorAll('#gmNav button').forEach(b => b.classList.toggle('on', b.dataset.page === p));
  document.querySelectorAll('#gmPanel .gmPage').forEach(d => { d.hidden = d.id !== 'gmPage-' + p; });
  $('gmPanel').querySelector('.gmPages').scrollTop = 0;
  if (p === 'music') ensureMusic();
  if (p === 'profile' || p === 'teleport') renderSel();
  if (p === 'server') renderServer();
  refreshPage();
}
function enter(on) {
  $('gmLogin').hidden = on; $('gmShell').hidden = !on; $('gmHeadInfo').hidden = !on;
  if (on) { show(page); Net.send({ type: 'gm_players' }); Net.send({ type: 'gm_reports' }); }
}
function open() {
  $('setPanel').hidden = true; $('gmPanel').hidden = false; enter(isGM);
  if (!timer) timer = setInterval(tick, 100);
  if (!autoTimer) autoTimer = setInterval(() => { if (!$('gmPanel').hidden) refreshPage(); }, 15000);   // 面板开着时每 15 秒自动刷新当前页
}
function setInvUI(on) {
  window.GM.invisible = !!on;
  $('gmInvisible').textContent = on ? '👁 关闭隐身' : '👁 开启隐身';
  const pill = $('gmStatePill'); pill.textContent = on ? '隐身中' : '现身中'; pill.classList.toggle('inv', !!on);
  $('gmStState').textContent = on ? '隐身' : '现身';
}
/* 飞行加速（穿墙）：开关 + 倍数；真正的移动逻辑在 game.js 的 moveEnt / FLY */
function setFly(on) {
  const F = window.GMFly; if (!F) return; F.on = !!on;
  $('gmFly').textContent = on ? '🚀 关闭飞行加速' : '🚀 开启飞行加速'; $('flyFab').classList.toggle('on', !!on);
}
function updateBadge(n) { const b = $('gmNavBadge'); b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n); }

/* ---------- 总览 ---------- */
function renderOverview(m) {
  $('gmStOnline').textContent = m.online; $('gmStPending').textContent = m.pending; $('gmStMuted').textContent = m.muted;
  $('gmOnlineCount').textContent = String(m.online); updateBadge(m.pending); setInvUI(!!m.invisible);
  const h = Math.floor(m.uptime / 3600), mi = Math.floor((m.uptime % 3600) / 60);
  $('gmUptime').textContent = '服务器已运行 ' + (h ? h + ' 小时 ' : '') + mi + ' 分钟';
  const root = $('gmRoomList'); root.replaceChildren();
  if (!m.rooms.length) { root.appendChild(node('p', 'hint', '当前没有人在场景里')); return; }
  m.rooms.forEach(r => { const c = node('div', 'gmListItem'); c.style.cursor = 'default'; c.append(node('strong', '', roomLabel(r.name)), node('span', 'gmTag', r.n + ' 人')); root.appendChild(c); });
}

/* ---------- 在线玩家 ---------- */
function renderPlayers() {
  const root = $('gmPlayers'); root.replaceChildren();
  $('gmOnlineCount').textContent = String(players.length);
  const q = ($('gmPlayerSearch').value || '').trim().toLowerCase();
  const list = players.filter(p => !q || [p.name, p.pub, roomLabel(p.room)].join(' ').toLowerCase().includes(q));
  if (!list.length) { root.appendChild(node('p', 'hint', players.length ? '没有符合搜索的玩家' : '当前没有在线玩家')); return; }
  list.forEach(p => {
    const card = node('div', 'gmListItem' + (p.pid === selPid ? ' sel' : ''));
    const title = node('strong', '', p.name || '玩家');
    if (p.isGM) title.appendChild(node('span', 'gmTag ok', 'GM'));
    if (p.invisible) title.appendChild(node('span', 'gmTag', '隐身'));
    if (p.muted > 0) title.appendChild(node('span', 'gmTag warn', '禁言中'));
    if (window.Net && p.pid === Net.myId()) title.appendChild(node('span', 'gmTag', '我'));
    card.append(title, node('div', 'sub', roomLabel(p.room) + ' · ID ' + String(p.pub || '').slice(0, 7)));
    card.onclick = () => selectPlayer(p, true);
    root.appendChild(card);
  });
}
function selectPlayer(p, go) {
  sel = p; selPid = p.pid || null; renderSel(); renderPlayers();
  const box = $('gmPfInfo'); box.replaceChildren(); box.append(node('span', '', '资料'), node('div', '', '加载中…'));
  if (p.pub) Net.send({ type: 'gm_profile', pub: p.pub });
  if (go) show('profile');
}
function syncSelection() {          // 玩家列表刷新后，让选中的玩家保持最新（或标成离线）
  if (!sel) return;
  const now = sel.pid ? players.find(p => p.pid === sel.pid) : (sel.pub ? players.find(p => p.pub === sel.pub) : null);
  if (now) { sel = now; selPid = now.pid; } else if (sel.pid) { sel = Object.assign({}, sel, { offline: true }); }
  renderSel();
}
function renderSel() {
  const has = !!sel;
  $('gmProfileEmpty').hidden = has; $('gmProfileBox').hidden = !has;
  $('gmTpEmpty').hidden = has; $('gmTpBox').hidden = !has;
  if (!has) return;
  const name = sel.name || '玩家';
  $('gmPfAvatar').textContent = [...name][0] || '?';
  $('gmPfName').textContent = name + (sel.offline ? '（已离线）' : '');
  $('gmPfScene').textContent = sel.offline ? '该玩家当前不在线' : roomLabel(sel.room);
  $('gmTpName').textContent = name;
  $('gmTpScene').textContent = sel.offline ? '该玩家当前不在线' : '所在：' + roomLabel(sel.room);
}
function fillInfo(p, pub) {
  const box = $('gmPfInfo'); box.replaceChildren();
  const rows = p ? [
    ['昵称', p.name || ''], ['性别', p.gender || '未设置'], ['简介', p.bio || '未填写'],
    ['Instagram', p.ig || '未填写'], ['Facebook', p.fb || '未填写'],
    ['隐私设置', VIS[p.visibility] || p.visibility || '未知'], ['用户编号', pub],
    ['所在场景', sel && !sel.offline ? roomLabel(sel.room) : '不在线'], ['禁言状态', mutedText(sel && sel.muted)]
  ] : [['提示', '找不到资料（可能是游客，没有保存过资料）'], ['用户编号', pub]];
  rows.forEach(([k, v]) => { box.appendChild(node('span', '', k)); box.appendChild(node('div', '', v)); });
}
function playerAct(action, minutes) {
  if (!sel || !sel.pid || sel.offline) return consoleMsg('玩家不在线，无法操作');
  if (action === 'kick' && !confirm('确定请出 ' + (sel.name || '玩家') + '？')) return;
  Net.send({ type: 'gm_action', pid: sel.pid, action, minutes });
  setTimeout(() => Net.send({ type: 'gm_players' }), 400);
}

/* ---------- 举报中心 ---------- */
function renderReports() {
  const root = $('gmReportsList'); root.replaceChildren();
  updateBadge(reports.filter(r => !r.status).length);
  const all = reports.slice().reverse();
  const list = rFilter === 'pending' ? all.filter(r => !r.status) : all;
  if (!list.length) root.appendChild(node('p', 'hint', rFilter === 'pending' ? '没有待处理的举报 🎉' : '目前没有举报记录'));
  list.forEach(r => {
    const card = node('div', 'gmListItem' + (r._idx === selReport ? ' sel' : ''));
    const title = node('strong', '', (r.targetName || '玩家') + ' · ' + (REASONS[r.reason] || '其他'));
    title.appendChild(node('span', 'gmTag' + (r.status ? ' ok' : ' warn'), statusLabel(r.status)));
    card.append(title, node('div', 'sub', '举报人：' + (r.reporterName || '玩家') + ' · ' + fmtAt(r.at)));
    card.onclick = () => { selReport = r._idx; renderReports(); };
    root.appendChild(card);
  });
  renderReportDetail();
}
function renderReportDetail() {
  const box = $('gmReportDetail'); box.replaceChildren();
  const r = reports.find(x => x._idx === selReport);
  if (!r) { box.appendChild(node('p', 'hint', '从左边选一条举报，这里会显示详情和处理按钮。')); return; }
  box.appendChild(node('h4', '', (r.targetName || '玩家') + ' · ' + (REASONS[r.reason] || '其他')));
  [['举报人', r.reporterName || '玩家'], ['时间', fmtAt(r.at)], ['场景', r.room ? roomLabel(r.room) : '未知'], ['状态', statusLabel(r.status)]]
    .forEach(([k, v]) => box.appendChild(node('div', '', k + '：' + v)));
  if (r.handledBy) box.appendChild(node('div', '', '处理人：' + r.handledBy + ' · ' + fmtAt(r.handledAt)));
  box.appendChild(node('h3', '', '聊天证据'));
  if (r.recent && r.recent.length) r.recent.forEach(x => box.appendChild(node('div', 'ev', (x.name || '玩家') + '：' + x.text)));
  else box.appendChild(node('p', 'hint', '没有保存聊天证据'));
  const row = node('div', 'gmRow');
  gmBtn(row, '查看玩家资料', () => {
    Net.send({ type: 'gm_players' });
    const on = players.find(p => p.pub === r.target);
    selectPlayer(on || { pub: r.target, name: r.targetName, room: null, offline: true }, true);
  });
  [['标记处理', 'handled'], ['驳回', 'dismissed'], ['禁言15分', 'mute'], ['踢出房间', 'kick']].forEach(([label, action]) =>
    gmBtn(row, label, () => {
      if ((action === 'mute' || action === 'kick') && !confirm('确认对 ' + (r.targetName || '玩家') + ' 执行「' + label + '」？')) return;
      Net.send({ type: 'gm_report_action', index: r._idx, action });
    }, action === 'kick' ? 'danger' : ''));
  box.appendChild(row);
}

/* ---------- 全服管理 ---------- */
function renderServer() {
  const s = $('gmSvPlayer'), keep = s.value; s.replaceChildren();
  const others = players.filter(p => !(window.Net && p.pid === Net.myId()));
  if (!others.length) { const o = node('option', '', '（没有其他在线玩家）'); o.value = ''; s.appendChild(o); }
  else others.forEach(p => { const o = node('option', '', (p.name || '玩家') + ' · ' + roomLabel(p.room) + (p.muted > 0 ? ' · 禁言中' : '')); o.value = p.pid; s.appendChild(o); });
  if (keep && [...s.options].some(o => o.value === keep)) s.value = keep;
  const root = $('gmMutedList'); root.replaceChildren();
  const muted = players.filter(p => p.muted > 0);
  if (!muted.length) { root.appendChild(node('p', 'hint', '没有在线的禁言玩家')); return; }
  muted.forEach(p => {
    const c = node('div', 'gmListItem'); c.style.cursor = 'default';
    c.append(node('strong', '', p.name || '玩家'), node('div', 'sub', mutedText(p.muted)));
    const row = node('div', 'gmRow');
    gmBtn(row, '解除禁言', () => { Net.send({ type: 'gm_action', pid: p.pid, action: 'unmute' }); setTimeout(() => Net.send({ type: 'gm_players' }), 400); });
    c.appendChild(row); root.appendChild(c);
  });
}

/* ---------- 退出 GM ---------- */
function loggedOut(closePanel) {
  isGM = false; window.GM.isGM = false; setInvUI(false); stopPreview();
  if (window.__game && __game.me) __game.me.isGM = false;
  const b = $('gmOpen'); b.classList.remove('gmAdminBtn');
  $('gmEntry').hidden = true; $('gmFab').hidden = true; $('flyFab').hidden = true; setFly(false);      // 退出后，普通界面里再也看不到任何 GM 入口
  if (closePanel === true) $('gmPanel').hidden = true;
  players = []; reports = []; sel = null; selPid = null; selReport = -1; updateBadge(0);
  enter(false);
}

function bind() {
  $('gmOpen').onclick = open;
  $('gmFab').onclick = open;
  $('gmFly').onclick = $('flyFab').onclick = () => { if (!window.GM.isGM || !window.GMFly) return; setFly(!window.GMFly.on); if (window.__game && __game.api) __game.api.toast(window.GMFly.on ? '🚀 飞行加速已开启（' + window.GMFly.mul + ' 倍，穿墙）' : '飞行加速已关闭', 1600); };
  $('gmFlySpeed').onchange = () => { if (window.GMFly) window.GMFly.mul = +$('gmFlySpeed').value || 4; };
  /* 隐藏入口：在「设置」里连点标题 7 次才会出现 GM 密钥输入框；普通玩家界面上没有任何 GM 字样 */
  /* 监听整个设置面板的标题栏（捕获阶段），手机上点到标题文字、空白处都算；点关闭按钮不算 */
  let taps = 0, tapT = 0;
  const sp = $('setPanel');
  if (sp) sp.addEventListener('click', e => {
    const t = e.target; if (!t || !t.closest || !t.closest('header') || t.closest('.x')) return;
    const n = Date.now(); taps = n - tapT < 1500 ? taps + 1 : 1; tapT = n;
    if (taps >= 7) { taps = 0; open(); }
  }, true);
  window.GM.open = open;                       // 兜底：控制台输入 GM.open() 也能打开
  /* 兜底入口：网址带 #gm 或 ?gm=1，进游戏后自动弹出 GM 密钥框（等 joined 之后，避免被切场景时的 closePanels 关掉） */
  if (/[#&?]gm(=1)?(&|$)/.test(location.hash + location.search)) {
    let done = false;
    Net.on('joined', () => { if (done) return; done = true; setTimeout(open, 800); });
  }
  $('gmNav').querySelectorAll('button').forEach(b => b.onclick = () => show(b.dataset.page));
  document.querySelectorAll('#gmPanel [data-goto]').forEach(b => b.onclick = () => show(b.dataset.goto));
  ['gmKey', 'gmPlayerSearch', 'gmAnnouncementText', 'gmLrc'].forEach(id => $(id).addEventListener('keydown', e => e.stopPropagation()));   // 打字时不触发游戏热键

  /* 登录 / 退出 */
  $('gmLoginBtn').onclick = () => {
    if (!window.Net || !Net.connected) return loginMsg('还没连上服务器，等右上角显示「在线」后再试');
    loginMsg('验证中…'); Net.send({ type: 'gm_login', key: $('gmKey').value });
  };
  $('gmKey').addEventListener('keydown', e => { if (e.key === 'Enter') $('gmLoginBtn').click(); });
  $('gmLogout').onclick = () => { if (confirm('退出 GM 模式？退出后需要重新输入密钥。')) Net.send({ type: 'gm_logout' }); };

  /* 总览 */
  $('gmRefreshOverview').onclick = () => Net.send({ type: 'gm_overview' });
  $('gmQuickInvis').onclick = $('gmInvisible').onclick = () => Net.send({ type: 'gm_invisible', on: !window.GM.invisible });

  /* 举报中心 */
  document.querySelectorAll('#gmPanel [data-rf]').forEach(b => b.onclick = () => {
    rFilter = b.dataset.rf; document.querySelectorAll('#gmPanel [data-rf]').forEach(x => x.classList.toggle('on', x === b)); renderReports();
  });
  $('gmRefreshReports').onclick = () => Net.send({ type: 'gm_reports' });

  /* 在线玩家 / 玩家资料 / 传送 */
  $('gmRefreshPlayers').onclick = () => Net.send({ type: 'gm_players' });
  $('gmPlayerSearch').addEventListener('input', renderPlayers);
  document.querySelectorAll('#gmPage-profile [data-act]').forEach(b => b.onclick = () => playerAct(b.dataset.act, Number(b.dataset.min) || undefined));
  $('gmTpBtn').onclick = () => {
    if (!sel || !sel.pid || sel.offline) return consoleMsg('该玩家不在线');
    if (!sel.room) return consoleMsg('该玩家不在场景中');
    Net.send({ type: 'gm_teleport', pid: sel.pid });
  };

  /* 全服管理 */
  $('gmAnnouncementText').addEventListener('input', () => { $('gmAnnCount').textContent = $('gmAnnouncementText').value.length + '/120'; });
  $('gmAnnouncementSend').onclick = () => {
    const el = $('gmAnnouncementText'), text = el.value.trim();
    if (!text) return consoleMsg('先输入公告内容');
    if (confirm('确定发布全服公告？')) { Net.send({ type: 'gm_announcement', text }); el.value = ''; $('gmAnnCount').textContent = '0/120'; }
  };
  $('gmSvRefresh').onclick = () => Net.send({ type: 'gm_players' });
  document.querySelectorAll('#gmPage-server [data-svact]').forEach(b => b.onclick = () => {
    const pid = $('gmSvPlayer').value; if (!pid) return consoleMsg('先选择一位在线玩家');
    const action = b.dataset.svact, p = players.find(x => x.pid === pid);
    if (action === 'kick' && !confirm('确定请出 ' + (p ? p.name : '该玩家') + '？')) return;
    Net.send({ type: 'gm_action', pid, action, minutes: Number(b.dataset.min) || undefined });
    setTimeout(() => Net.send({ type: 'gm_players' }), 400);
  });

  /* GM 设置 */
  $('gmRefreshAudit').onclick = () => Net.send({ type: 'gm_action_log' });

  /* ----- 服务器消息 ----- */
  Net.on('gmOk', () => {
    isGM = true; window.GM.isGM = true; if (window.__game && __game.me) __game.me.isGM = true;
    $('gmKey').value = ''; loginMsg('');
    $('gmOpen').classList.add('gmAdminBtn'); $('gmEntry').hidden = false; $('gmFab').hidden = false; $('flyFab').hidden = false;   // 验证通过后才出现入口
    if (!$('gmPanel').hidden) enter(true);
  });
  Net.on('gmFail', m => loginMsg(m.message || '登录失败'));
  Net.on('gmLoggedOut', () => loggedOut(true));
  Net.on('gmError', m => { msg('❌ ' + (m.message || '出错了')); consoleMsg('❌ ' + (m.message || '出错了')); if (m.code === 'auth') { loggedOut(); loginMsg(m.message || ''); } });
  Net.on('gmActionResult', m => { const t = m.message || (m.ok ? '操作成功' : '操作失败'); consoleMsg((m.ok ? '✅ ' : '❌ ') + t); if (window.__game && __game.api) __game.api.toast(t, 2200); });
  Net.on('gmOverview', renderOverview);
  Net.on('gmPlayers', m => { players = m.list || []; setInvUI(!!m.invisible); renderPlayers(); syncSelection(); if (page === 'server') renderServer(); });
  Net.on('gmReports', m => { reports = m.list || []; renderReports(); });
  Net.on('gmProfile', m => { if (sel && sel.pub === m.pub) fillInfo(m.profile, m.pub); });
  Net.on('gmInvisible', m => { setInvUI(!!m.on); consoleMsg(m.on ? '已开启隐身模式（普通玩家不可见）' : '已关闭隐身模式（普通玩家可见）'); });
  Net.on('gmActionLog', m => { const t = $('gmAdminLog'); if (t) t.textContent = (m.list || []).slice().reverse().map(x => `${fmtAt(x.at)} · ${x.by} → ${x.target} · ${x.action}`).join('\n') || '暂无管理记录'; });
  Net.on('gmReportActionResult', m => { consoleMsg((m.ok ? '✅ ' : '❌ ') + (m.message || '举报处理完成')); if (m.ok) Net.send({ type: 'gm_reports' }); });
  Net.on('gmTeleport', m => {
    const scene = String(m.room || '').replace(/^sv1:/, ''), st = m.state || {};
    const doTeleport = () => {
      if (!window.__game || !__game.me) return;
      const G = __game; G.me.x = Number(st.x || 0) + 1.2; G.me.z = Number(st.z || 0) + 1.2; G.me.y = G.scene.heightAt(G.me.x, G.me.z); G.me.vx = G.me.vz = 0; G.target = null;
      G.cam.target = [G.me.x, 0, G.me.z - (G.scene.camera.lead == null ? 2 : G.scene.camera.lead)];
      Net.send({ type: 'state', state: { x: G.me.x, y: G.me.y, z: G.me.z, yaw: G.me.yaw, mv: 0, run: 0, sing: 0, pz: null, sit: null } });
      consoleMsg('已传送到 ' + (m.targetName || '玩家') + ' 身边');
    };
    if (scene && scene !== __game.sceneId) { __game.api.goTo(scene); setTimeout(doTeleport, 600); } else doTeleport();
  });
  Net.on('gmSaved', m => msg((m.persist === 'upstash' ? '✅ 已保存，全服已更新，并永久保存' : '✅ 已保存，全服已更新。⚠ 服务器没有配置永久存储（Upstash），服务器重启后需要重新保存') + '　试听已停止，点「⏮ 从头」可以重新听。'));
  new MutationObserver(() => { if ($('gmPanel').hidden) { stopPreview(); seeking = false; } }).observe($('gmPanel'), { attributes: true, attributeFilter: ['hidden'] });   // 关掉面板就停止试听

  /* ----- 音乐调试 ----- */
  $('gmSong').onchange = () => { stopPreview(); loadSong($('gmSong').value); };
  document.querySelectorAll('#gmPanel [data-off]').forEach(b => b.onclick = () => { offset = clampOff(offset + Number(b.dataset.off)); preview(); });
  $('gmOffReset').onclick = () => { offset = 0; preview(); };
  $('gmPlay').onclick = () => {          // 从暂停位置继续；播完就从头。quiet：只在本机试听
    if (Karaoke.playing()) return;
    const same = Karaoke.songName() === song, d = Karaoke.duration(); let pos = same ? Karaoke.position() : 0;
    if (same && d && pos >= d - 0.5) pos = 0;
    Karaoke.play(song, pos, true);
  };
  $('gmRestart').onclick = () => { stopPreview(); Karaoke.play(song, 0, true); };
  $('gmPause').onclick = () => Karaoke.pause(true);
  const sk = $('gmSeek');
  sk.addEventListener('pointerdown', () => { seeking = true; });
  ['pointerup', 'pointercancel', 'change'].forEach(e => sk.addEventListener(e, () => { seeking = false; }));
  sk.addEventListener('input', () => { const v = Number(sk.value); if (Karaoke.songName() === song) Karaoke.seek(v); else Karaoke.play(song, v, true); });
  $('gmBack').onclick = () => Karaoke.seek(Karaoke.position() - 5);
  $('gmFwd').onclick = () => Karaoke.seek(Karaoke.position() + 5);
  document.querySelectorAll('#gmPanel [data-line]').forEach(b => b.onclick = () => {
    const L = Karaoke.lyricNow(); if (!L || L.ri < 0) return msg('先点「试听」，等歌词出现后再微调当前句');
    const ta = $('gmLrc'); ta.value = nudgeLine(ta.value, L.ri, Number(b.dataset.line)); preview();
  });
  $('gmLrc').addEventListener('input', () => { clearTimeout(taTimer); taTimer = setTimeout(preview, 300); });
  $('gmReset').onclick = async () => { if (!confirm('恢复成仓库里的原始歌词，并把延迟清零？（要点「保存」才会生效到全服）')) return; offset = 0; $('gmLrc').value = await Karaoke.fileLrc(song); preview(); msg('已恢复原版，点「保存并全服更新」后生效'); };
  $('gmSave').onclick = async () => {
    if (!Net.connected) return msg('❌ 没连上服务器');
    const txt = $('gmLrc').value, file = await Karaoke.fileLrc(song);
    const lrc = txt.trim() === (file || '').trim() ? '' : txt;       // 和仓库文件一样就不存，继续用文件
    stopPreview(); msg('保存中…'); Net.send({ type: 'gm_save', song, cfg: { offset, lrc } });
  };
  Karaoke.onCfg(() => { if (isGM && !$('gmPanel').hidden && page === 'music' && document.activeElement !== $('gmLrc')) { const c = Karaoke.getSongConfig(song); offset = c.offset; $('gmOffVal').textContent = fmtOff(offset); } });
}
if (window.Net && window.Karaoke && $('gmOpen')) bind();
else addEventListener('load', () => { if (window.Net && window.Karaoke && $('gmOpen')) bind(); });
})();
