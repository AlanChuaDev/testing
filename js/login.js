/* login.js — 创建角色 / 进入游戏（资料保存在本机；联机用昵称+外观）。 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const pick = a => a[(Math.random() * a.length) | 0];
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let resolve; window.loginReady = new Promise(r => resolve = r);
let profile = lsGet('sc_profile', null);
function show(mode) {
  $('lgAuth').hidden = mode !== 'auth';
  $('lgWelcome').hidden = mode !== 'welcome';
  if (mode === 'welcome') $('lgName').textContent = profile.name;
  const needServer = !(window.NET_CONFIG && NET_CONFIG.server);
  $('lgServerRow').hidden = !needServer; if (needServer) $('lgServer').value = localStorage.getItem('sc_server') || '';
}
function enter() {
  if (!(window.NET_CONFIG && NET_CONFIG.server)) {
    const v = $('lgServer').value.trim();
    if (v) { try { localStorage.setItem('sc_server', v); } catch (e) {} }
  }
  window.Profile = profile;
  $('login').classList.add('done'); setTimeout(() => $('login').remove(), 400);
  resolve();
}
/* 新账号：登录完直接进游戏，昵称和外观都在「创建人物」面板里一起做（js/creator.js） */
function startNew() {
  profile = { uid: (profile && profile.uid) || ((crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2)), name: '' };
  lsSet('sc_profile', profile); lsSet('sc_new_char', true); enter();
}
$('lgEnter').onclick = enter;
$('lgNew').onclick = () => { lsSet('sc_open_creator', true); enter(); };   // 「修改角色」：进游戏后直接打开创建面板

/* ---------- 登录门槛：必须用 ID+密码 或 Google 登录，才能进入游戏 ---------- */
let authOK = false, authMode = 'in', authBusy = false;
const afterAuth = () => (profile && profile.name) ? show('welcome') : startNew();
const authErr = t => { $('lgAuthErr').textContent = t || ''; };
function setAuthMode(m) {
  authMode = m; authErr('');
  $('lgTabIn').classList.toggle('on', m === 'in'); $('lgTabUp').classList.toggle('on', m === 'up');
  $('lgPw2Row').hidden = m !== 'up'; $('lgAuthGo').textContent = m === 'up' ? '注册并登录' : '登录';
  $('lgPw').autocomplete = m === 'up' ? 'new-password' : 'current-password';
}
async function authRun(fn) {
  if (authBusy) return; authBusy = true; authErr('');
  try { await fn(); afterAuth(); } catch (e) { authErr(window.Auth ? Auth.err(e) : String(e)); }
  authBusy = false;
}
$('lgTabIn').onclick = () => setAuthMode('in');
$('lgTabUp').onclick = () => setAuthMode('up');
$('lgAuthGo').onclick = () => {
  if (!authOK) return location.reload();                       // 账号服务没连上：点一下重新加载
  authRun(async () => {
    const id = $('lgId').value, pw = $('lgPw').value;
    if (authMode === 'up') { if (pw !== $('lgPw2').value) throw { code: 'auth/password-mismatch' }; await Auth.idRegister(id, pw); }
    else await Auth.idLogin(id, pw);
  });
};
$('lgGoogle').onclick = () => {
  if (!authOK) return location.reload();
  authRun(async () => { const r = await Auth.googleLogin(); if (r && r.cred) await Auth.googleSwitch(r.cred); });   // 这个 Google 已有账号就直接切过去
};
['lgId', 'lgPw', 'lgPw2'].forEach(id => $(id).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('lgAuthGo').click(); }));
(async function start() {
  authErr('');
  const ok = window.Auth ? await Promise.race([Auth.init(), new Promise(r => setTimeout(() => r(false), 10000))]) : false;
  authOK = !!ok;
  if (ok && !Auth.anon) return afterAuth();                    // 已经登录过：直接进
  show('auth'); setAuthMode('in');
  if (!ok) { authErr('账号服务连不上（网络不通或 Firebase 被拦截）。必须登录才能进入游戏，请检查网络后点「登录」重试。'); $('lgAuthGo').textContent = '重试'; }
})();
})();
