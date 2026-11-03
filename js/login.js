/* login.js — 创建角色 / 进入游戏（资料保存在本机；联机用昵称+外观）。 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const HAIRS = ['#2a1a14', '#5b3a29', '#8a5a3a', '#d8b26a', '#c94f6a', '#3b3f7a', '#e8e8f0', '#141414', '#7a4fd0'];
const TOPS = ['#ef6a5b', '#2fb3a3', '#f6b92b', '#6c8cf0', '#c779d9', '#ff9d5c', '#5ac26e', '#f4f4f8', '#2b2b3a', '#ff7ab6'];
const BOTS = ['#f4f4f8', '#2d3a5a', '#3d5a4a', '#e8a0b8', '#2b2b3a', '#c9b48a', '#8b5cf6'];
const SKINC = ['#ffd6be', '#f5c9a8', '#e0a98a', '#c78d70'];
const pick = a => a[(Math.random() * a.length) | 0];
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let resolve; window.loginReady = new Promise(r => resolve = r);
let profile = lsGet('sc_profile', null);
let outfit = Object.assign({ hair: pick(HAIRS), top: pick(TOPS), bottom: pick(BOTS), socks: null, shoes: null, bottomType: 'shorts', choker: true, skin: 0, scale: 1 }, lsGet('sc_outfit', null) || {});

function sw(list, key, row, isSkin) {
  row.innerHTML = '';
  list.forEach((c, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.background = c;
    const v = isSkin ? i : c; if (outfit[key] === v) b.classList.add('on');
    b.onclick = () => { outfit[key] = v; renderOutfit(); }; row.appendChild(b);
  });
}
function renderOutfit() {
  sw(HAIRS, 'hair', $('lgHair')); sw(TOPS, 'top', $('lgTop')); sw(BOTS, 'bottom', $('lgBot')); sw(SKINC, 'skin', $('lgSkin'), true);
  $('lgSkirt').classList.toggle('on', outfit.bottomType === 'skirt'); $('lgShorts').classList.toggle('on', outfit.bottomType !== 'skirt');
}
function show(mode) {
  $('lgAuth').hidden = mode !== 'auth';
  $('lgWelcome').hidden = mode !== 'welcome'; $('lgCreate').hidden = mode !== 'create';
  if (mode === 'welcome') $('lgName').textContent = profile.name;
  if (mode === 'create') { $('lgInput').value = profile ? profile.name : ''; renderOutfit(); }
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
$('lgRandom').onclick = () => { outfit.hair = pick(HAIRS); outfit.top = pick(TOPS); outfit.bottom = pick(BOTS); outfit.skin = (Math.random() * 4) | 0; outfit.bottomType = Math.random() < .45 ? 'skirt' : 'shorts'; renderOutfit(); };
$('lgSkirt').onclick = () => { outfit.bottomType = 'skirt'; renderOutfit(); };
$('lgShorts').onclick = () => { outfit.bottomType = 'shorts'; renderOutfit(); };
$('lgGo').onclick = () => {
  const name = $('lgInput').value.replace(/[<>]/g, '').trim().slice(0, 12);
  if (name.length < 1) { $('lgErr').textContent = '请先给角色起个名字'; return; }
  profile = { uid: (profile && profile.uid) || ((crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2)), name };
  lsSet('sc_profile', profile); lsSet('sc_outfit', outfit); lsSet('sc_new_char', true); enter();   // [创建面板] sc_new_char：进游戏后自动弹出创建人物面板
};
$('lgEnter').onclick = enter;
$('lgNew').onclick = () => show('create');

/* ---------- 登录门槛：必须用 ID+密码 或 Google 登录，才能进入游戏 ---------- */
let authOK = false, authMode = 'in', authBusy = false;
const afterAuth = () => show(profile ? 'welcome' : 'create');
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
