/* auth.js — 账号（Firebase Auth）：进游戏自动匿名登录；可绑定邮箱 + 密码，换设备时用邮箱登录找回。
   Firebase 加载失败（被墙 / 离线）时 Auth.ready=false，游戏照常以游客身份玩，只是没有好友 / 资料 / 私信。 */
(() => {
'use strict';
const MSG = {
  'auth/email-already-in-use': '这个邮箱已经被注册了，请直接用「登录」',
  'auth/credential-already-in-use': '这个邮箱已经绑定了别的账号，请用「登录」',
  'auth/invalid-email': '邮箱格式不对',
  'auth/weak-password': '密码太短（至少 6 位）',
  'auth/wrong-password': '邮箱或密码不对', 'auth/invalid-credential': '邮箱或密码不对', 'auth/user-not-found': '邮箱或密码不对',
  'auth/too-many-requests': '尝试次数太多，请稍后再试',
  'auth/network-request-failed': '网络不通，请检查网络',
  'auth/operation-not-allowed': 'Firebase 里还没开启 邮箱/密码 登录',
  'auth/unauthorized-domain': 'Firebase 里还没授权这个网址（Authentication → 设置 → 已获授权的网域）',
};
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
  async signOut() { await auth.signOut(); await auth.signInAnonymously(); reconnect(); },
  async resetPassword(email) { await auth.sendPasswordResetEmail(email); },
};
init();
})();
