/* auth.js — 账号（Firebase Auth）：进游戏自动匿名登录；可绑定邮箱 + 密码，换设备时用邮箱登录找回。
   Firebase 加载失败（被墙 / 离线）时 Auth.ready=false，游戏照常以游客身份玩，只是没有好友 / 资料 / 私信。 */
(() => {
'use strict';
const MSG = {
  'auth/email-already-in-use': '这个 ID 已经被注册了，请换一个，或直接登录',
  'auth/invalid-id': 'ID 只能用英文字母、数字、下划线，3–20 位',
  'auth/password-mismatch': '两次输入的密码不一样',
  'auth/credential-already-in-use': '这个邮箱已经绑定了别的账号，请用「登录」',
  'auth/invalid-email': '邮箱格式不对',
  'auth/weak-password': '密码太短（至少 6 位）',
  'auth/wrong-password': 'ID 或密码不对', 'auth/invalid-credential': 'ID 或密码不对', 'auth/user-not-found': 'ID 或密码不对',
  'auth/too-many-requests': '尝试次数太多，请稍后再试',
  'auth/network-request-failed': '网络不通，请检查网络',
  'auth/operation-not-allowed': 'Firebase 里还没开启 邮箱/密码 登录',
  'auth/popup-blocked': '浏览器拦截了登录弹窗，请允许弹出窗口后再试',
  'auth/popup-closed-by-user': '已取消 Google 登录', 'auth/cancelled-popup-request': '已取消 Google 登录',
  'auth/operation-not-supported-in-this-environment': '这个环境不支持 Google 弹窗登录（APK 里需要另外接原生登录）',
  'auth/account-exists-with-different-credential': '这个邮箱已经用别的方式注册过，请先用邮箱密码登录',
  'auth/unauthorized-domain': 'Firebase 里还没授权这个网址（Authentication → 设置 → 已获授权的网域）',
};
const ID_DOMAIN = '@starplaza.app';             // ID 账号在 Firebase 里用「ID@starplaza.app」当邮箱（不是真实邮箱，不会发邮件，所以 ID 账号不能用邮件找回密码）
const idEmail = id => { id = String(id || '').trim(); if (!/^[A-Za-z0-9_]{3,20}$/.test(id)) throw { code: 'auth/invalid-id' }; return id.toLowerCase() + ID_DOMAIN; };
const err = e => MSG[e && e.code] || ('出错了：' + ((e && (e.code || e.message)) || e));
let auth = null, ready = false, initP = null;

function init() {
  if (initP) return initP;
  initP = new Promise(res => {
    try {
      if (!window.firebase || !window.FIREBASE_CONFIG) return res(false);
      firebase.initializeApp(window.FIREBASE_CONFIG);
      auth = firebase.auth();
      const t = setTimeout(() => res(false), 8000);
      const un = auth.onAuthStateChanged(u => {
        clearTimeout(t); un();
        if (u) { ready = true; return res(true); }
        auth.signInAnonymously().then(() => { ready = true; res(true); }).catch(e => { console.warn('anon sign-in failed', e); res(false); });
      });
    } catch (e) { console.warn('firebase init failed', e); res(false); }
  });
  return initP;
}
async function getToken() {
  if (!(await Promise.race([init(), new Promise(r => setTimeout(() => r(false), 9000))])) || !auth || !auth.currentUser) return null;
  try { return await auth.currentUser.getIdToken(); } catch (e) { return null; }
}
const user = () => (auth && auth.currentUser) || null;
const reconnect = () => { if (window.Net && Net.reauth) Net.reauth(); };

window.Auth = {
  init, getToken, err,
  get ready() { return ready; },
  get email() { const u = user(); return (u && u.email) || ''; },
  get anon() { const u = user(); return !u || u.isAnonymous; },
  async linkEmail(email, pw) {                // 把当前账号绑定邮箱（好友、资料都保留）
    const u = user(); if (!u) throw { code: 'auth/network-request-failed' };
    await u.linkWithCredential(firebase.auth.EmailAuthProvider.credential(email, pw));
    await u.getIdToken(true); reconnect();
  },
  async signIn(email, pw) {                   // 用已有邮箱登录（会换成那个账号）
    await auth.signInWithEmailAndPassword(email, pw); reconnect();
  },
  async googleLogin() {                        // Google 登录：游客账号先「绑定」（好友、资料保留）；这个 Google 已经有账号时返回 { cred }，由界面确认后切换
    const prov = new firebase.auth.GoogleAuthProvider(); prov.setCustomParameters({ prompt: 'select_account' });
    const u = user();
    if (u && u.isAnonymous) {
      try { await u.linkWithPopup(prov); await u.getIdToken(true); reconnect(); return { linked: true }; }
      catch (e) { if (e && e.code === 'auth/credential-already-in-use' && e.credential) return { cred: e.credential }; throw e; }
    }
    await auth.signInWithPopup(prov); reconnect(); return { signed: true };
  },
  async googleSwitch(cred) { await auth.signInWithCredential(cred); reconnect(); },   // 切换成已有的 Google 账号（当前游客资料不合并）
  async signOut() { await auth.signOut(); location.reload(); },     // 退出后刷新页面，回到登录页（必须重新登录才能进游戏）
  get label() { const e = this.email; return e.endsWith(ID_DOMAIN) ? e.slice(0, -ID_DOMAIN.length) : e; },   // 显示用：ID 账号显示 ID，Google / 邮箱账号显示邮箱
  async idRegister(id, pw) {                   // 用 ID + 密码注册；这台设备原来的游客资料会直接变成这个账号（好友、资料保留）
    const email = idEmail(id), u = user(); if (!u) throw { code: 'auth/network-request-failed' };
    if (u.isAnonymous) { await u.linkWithCredential(firebase.auth.EmailAuthProvider.credential(email, pw)); await u.getIdToken(true); }
    else await auth.createUserWithEmailAndPassword(email, pw);
    reconnect();
  },
  async idLogin(id, pw) { await auth.signInWithEmailAndPassword(idEmail(id), pw); reconnect(); },
  async resetPassword(email) { await auth.sendPasswordResetEmail(email); },
};
init();
})();
