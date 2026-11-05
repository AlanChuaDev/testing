// social.js — 账号资料 / 好友 / 私信 / 黑名单（服务器端逻辑）。
// 数据存在 Firebase Firestore（只有服务器用 Admin SDK 读写，客户端规则是"全部拒绝"）。
// 没配 FIREBASE_SERVICE_ACCOUNT 时：社交功能关闭（游客模式）；本地测试可设 DEV_AUTH=1 用内存数据库。
//
// 集合：
//   profiles/{pub}   { name, nameLower, gender, bio, ig, fb, visibility, nameChangedAt, createdAt }
//   names/{sha1}     { pub, name }                  昵称唯一性（create 是原子的）
//   friends/{pub}    { friends:[pub], inReq:[pub], outReq:[pub] }
//   blocks/{pub}     { list:[{pub,name}] }
//   inbox/{pub}      { unread:{ 对方pub: 数量 } }
//   dms/{conv}/msgs/{auto} { from, text, at }       conv = 两个 pub 排序后用 _ 连接
// pub = sha256("sp:fb:" + firebase uid) 的前 16 位十六进制；Firebase uid 不会出现在别的玩家那里。
const crypto = require("crypto");

const MAX_FRIENDS = 100, MAX_INREQ = 50, MAX_BLOCKS = 200, NAME_COOLDOWN = 24 * 3600 * 1000, KEEP_DM = 500, BIO_MAX = 100;
const GENDERS = ["male", "female", "other", "secret"];
const VIS = ["public", "friends", "private"];

/* ---------------- 存储适配器 ---------------- */
function nest(field, val) { const ks = field.split("."); const o = {}; let c = o; ks.forEach((k, i) => { if (i === ks.length - 1) c[k] = val; else c = c[k] = {}; }); return o; }

function memoryStore() {
  const docs = new Map(), subs = new Map(), key = (c, i) => c + "/" + i, clone = (x) => JSON.parse(JSON.stringify(x));
  const getp = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const setp = (o, p, v) => { const ks = p.split("."); let c = o; for (let i = 0; i < ks.length - 1; i++) c = c[ks[i]] = c[ks[i]] || {}; c[ks[ks.length - 1]] = v; };
  return {
    kind: "memory",
    async get(c, i) { const d = docs.get(key(c, i)); return d ? clone(d) : null; },
    async set(c, i, d) { docs.set(key(c, i), clone(d)); },
    async merge(c, i, d) { docs.set(key(c, i), Object.assign(docs.get(key(c, i)) || {}, clone(d))); },
    async del(c, i) { docs.delete(key(c, i)); },
    async create(c, i, d) { if (docs.has(key(c, i))) return false; docs.set(key(c, i), clone(d)); return true; },
    async arrayAdd(c, i, f, v) { const d = docs.get(key(c, i)) || {}; const a = d[f] = d[f] || []; if (!a.includes(v)) a.push(v); docs.set(key(c, i), d); },
    async arrayRemove(c, i, f, v) { const d = docs.get(key(c, i)) || {}; d[f] = (d[f] || []).filter((x) => x !== v); docs.set(key(c, i), d); },
    async incr(c, i, f, n) { const d = docs.get(key(c, i)) || {}; setp(d, f, (getp(d, f) || 0) + n); docs.set(key(c, i), d); },
    async setField(c, i, f, v) { const d = docs.get(key(c, i)) || {}; setp(d, f, v); docs.set(key(c, i), d); },
    async push(path, d) { (subs.get(path) || subs.set(path, []).get(path)).push(clone(d)); },
    async last(path, n) { return clone((subs.get(path) || []).slice(-n)); },
    async count(path) { return (subs.get(path) || []).length; },
    async trim(path, keep) { const a = subs.get(path) || []; if (a.length > keep) subs.set(path, a.slice(-keep)); },
  };
}

function firestoreStore(admin) {
  const db = admin.firestore(); db.settings({ ignoreUndefinedProperties: true });
  const FV = admin.firestore.FieldValue, ref = (c, i) => db.collection(c).doc(i);
  return {
    kind: "firestore",
    async get(c, i) { const s = await ref(c, i).get(); return s.exists ? s.data() : null; },
    async set(c, i, d) { await ref(c, i).set(d); },
    async merge(c, i, d) { await ref(c, i).set(d, { merge: true }); },
    async del(c, i) { await ref(c, i).delete(); },
    async create(c, i, d) { try { await ref(c, i).create(d); return true; } catch (e) { if (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message))) return false; throw e; } },
    async arrayAdd(c, i, f, v) { await ref(c, i).set({ [f]: FV.arrayUnion(v) }, { merge: true }); },
    async arrayRemove(c, i, f, v) { await ref(c, i).set({ [f]: FV.arrayRemove(v) }, { merge: true }); },
    async incr(c, i, f, n) { await ref(c, i).set(nest(f, FV.increment(n)), { merge: true }); },
    async setField(c, i, f, v) { await ref(c, i).set(nest(f, v), { merge: true }); },
    async push(path, d) { await db.collection(path).add(d); },
    async last(path, n) { const s = await db.collection(path).orderBy("at", "desc").limit(n).get(); return s.docs.map((x) => x.data()).reverse(); },
    async count(path) { const s = await db.collection(path).count().get(); return s.data().count; },
    async trim(path, keep) {
      const total = await this.count(path); if (total <= keep) return;
      const s = await db.collection(path).orderBy("at", "asc").limit(total - keep).get();
      const b = db.batch(); s.docs.forEach((d) => b.delete(d.ref)); await b.commit();
    },
  };
}

/* ---------------- 逻辑 ---------------- */
function create({ store, filterText }) {
  const profCache = new Map(), blockCache = new Map(), dmCount = new Map(); // pub -> { v, at }
  const PROF_TTL = 10 * 60 * 1000;
  const sha = (s) => crypto.createHash("sha1").update(s).digest("hex");
  const nameKey = (n) => n.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const conv = (a, b) => [a, b].sort().join("_");
  const E = (message) => { const e = new Error(message); e.user = true; return e; };

  function reservedName(s) {
    const n = String(s || "").normalize("NFKC").toLowerCase().replace(/[\s\u200b-\u200f\u202a-\u202e._-]/g, "");
    return n === "gm" || n.includes("管理员") || n.includes("官方") || n.includes("管理員");
  }
  function cleanName(raw, allowReserved = false) { // 返回合法昵称，不合法就抛错
    let s = String(raw == null ? "" : raw).normalize("NFKC").replace(/[\u0000-\u001f<>​-‏‪-‮]/g, "").replace(/\s+/g, " ").trim();
    if (!s) throw E("昵称不能为空");
    if ([...s].length > 12) throw E("昵称最多 12 个字");
    if (/[*\/\\]/.test(s)) throw E("昵称里不能有 * / \\ 这些符号");
    if (filterText(s).hit) throw E("昵称包含不允许的内容");
    if (!allowReserved && reservedName(s)) throw E("普通玩家不能使用 GM / 管理员 / 官方等昵称");
    return s;
  }
  function cleanLink(raw, site) { // 只接受 instagram / facebook 的用户名或链接，统一存成 https 链接
    let s = String(raw || "").trim(); if (!s) return "";
    const hosts = site === "ig" ? ["instagram.com", "www.instagram.com", "instagr.am"] : ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com", "fb.me"];
    const base = site === "ig" ? "https://www.instagram.com/" : "https://www.facebook.com/";
    if (/^https?:\/\//i.test(s) || /^(www\.)?(instagram|facebook|fb)\./i.test(s)) {
      try { const u = new URL(/^https?:/i.test(s) ? s : "https://" + s); if (!hosts.includes(u.hostname.toLowerCase())) throw 0; const p = (u.pathname + (u.search.startsWith("?id=") ? u.search : "")).replace(/\/+$/, ""); if (p.length < 2 || p.length > 120 || /[<>"'\s]/.test(p)) throw 0; return base.replace(/\/$/, "") + p; }
      catch (e) { throw E(site === "ig" ? "Instagram 链接不正确（只能是 instagram.com 的链接或用户名）" : "Facebook 链接不正确（只能是 facebook.com 的链接或用户名）"); }
    }
    s = s.replace(/^@/, "");
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(s)) throw E(site === "ig" ? "Instagram 用户名只能用字母、数字、点、下划线" : "Facebook 用户名只能用字母、数字、点、下划线");
    return base + s;
  }

  async function getProfile(pub, fresh) {
    const c = profCache.get(pub);
    if (c && !fresh && Date.now() - c.at < PROF_TTL) return c.v;
    const v = await store.get("profiles", pub); profCache.set(pub, { v, at: Date.now() }); return v;
  }
  const putProfile = (pub, v) => profCache.set(pub, { v, at: Date.now() });

  async function claimName(pub, wanted) { // 抢一个没人用的昵称；重名就在后面加数字
    const base = cleanName(wanted || "玩家");
    for (let i = 0; i < 8; i++) {
      const cand = i === 0 ? base : ([...base].slice(0, 12 - 3).join("") + String(Math.floor(Math.random() * 900) + 100));
      if (i > 0 && filterText(cand).hit) continue;
      if (await store.create("names", sha(nameKey(cand)), { pub, name: cand })) return cand;
    }
    return "玩家" + crypto.randomBytes(3).toString("hex");
  }
  async function ensureProfile(pub, wantedName) {
    let p = await getProfile(pub, true);
    if (p) return p;
    let name; try { name = await claimName(pub, wantedName); } catch (e) { name = await claimName(pub, "玩家"); }
    p = { name, nameLower: nameKey(name), gender: "secret", bio: "", ig: "", fb: "", visibility: "friends", nameChangedAt: 0, createdAt: Date.now() };
    await store.set("profiles", pub, p); putProfile(pub, p); return p;
  }
  async function setName(pub, raw, allowReserved = false) {
    const name = cleanName(raw, allowReserved), p = await ensureProfile(pub, name), now = Date.now();
    if (p.nameChangedAt && now - p.nameChangedAt < NAME_COOLDOWN) { const h = Math.ceil((NAME_COOLDOWN - (now - p.nameChangedAt)) / 3600000); throw E("昵称每 24 小时只能改一次，还要等约 " + h + " 小时"); }
    if (name === p.name) throw E("和现在的昵称一样");
    const k = nameKey(name);
    if (k !== p.nameLower) {
      if (!(await store.create("names", sha(k), { pub, name }))) { const ex = await store.get("names", sha(k)); if (!ex || ex.pub !== pub) throw E("这个昵称已经有人用了"); }
      await store.del("names", sha(p.nameLower));
    }
    const np = Object.assign({}, p, { name, nameLower: k, nameChangedAt: now });
    await store.merge("profiles", pub, { name, nameLower: k, nameChangedAt: now }); putProfile(pub, np); return np;
  }
  async function nameFree(pub, raw) { // 只检查，不占用：名字合法吗？被别人用了吗？
    const name = cleanName(raw), ex = await store.get("names", sha(nameKey(name)));
    if (ex && ex.pub !== pub) throw E("这个昵称已经有人用了，换一个吧");
    return name;
  }
  async function setFirstName(pub, raw) { // 新账号第一次取名：当场占下，不加数字、不算 24 小时冷却
    const p = await ensureProfile(pub, null);
    if (p.named || p.nameChangedAt) throw E("昵称已经设置过了，想改名请在「我」里改");
    const name = cleanName(raw), k = nameKey(name);
    if (k !== p.nameLower) {
      if (!(await store.create("names", sha(k), { pub, name }))) { const ex = await store.get("names", sha(k)); if (!ex || ex.pub !== pub) throw E("这个昵称已经有人用了，换一个吧"); }
      await store.del("names", sha(p.nameLower));
    }
    const np = Object.assign({}, p, { name, nameLower: k, named: true });
    await store.merge("profiles", pub, { name, nameLower: k, named: true }); putProfile(pub, np); return np;
  }
  async function setProfile(pub, d) {
    const p = await ensureProfile(pub, null); d = d || {};
    const gender = GENDERS.includes(d.gender) ? d.gender : p.gender, visibility = VIS.includes(d.visibility) ? d.visibility : p.visibility;
    let bio = String(d.bio == null ? p.bio : d.bio).replace(/[\u0000-\u0008\u000b-\u001f<>]/g, "").trim();
    if ([...bio].length > BIO_MAX) throw E("简介最多 " + BIO_MAX + " 个字");
    const f = filterText(bio); if (f.hit) throw E("简介包含不允许的内容（网址 / 联系方式 / 脏话），请修改");
    const ig = d.ig === undefined ? p.ig : cleanLink(d.ig, "ig"), fb = d.fb === undefined ? p.fb : cleanLink(d.fb, "fb");
    const patch = { gender, visibility, bio, ig, fb }, np = Object.assign({}, p, patch);
    await store.merge("profiles", pub, patch); putProfile(pub, np); return np;
  }

  /* ---- 好友 ---- */
  const emptyF = () => ({ friends: [], inReq: [], outReq: [] });
  async function getF(pub) { const d = await store.get("friends", pub); return Object.assign(emptyF(), d || {}); }
  async function getBlocks(pub) {
    const c = blockCache.get(pub); if (c) return c;
    const d = await store.get("blocks", pub), v = { exists: !!d, list: (d && d.list) || [] }; blockCache.set(pub, v); return v;
  }
  const blockedEither = async (a, b) => (await getBlocks(a)).list.some((x) => x.pub === b) || (await getBlocks(b)).list.some((x) => x.pub === a);
  async function setBlocks(pub, detail) {
    const seen = new Set(), list = [];
    for (const x of (Array.isArray(detail) ? detail : []).slice(0, MAX_BLOCKS)) { const p = String(x && x.pub || "").slice(0, 16); if (/^[0-9a-f]{16}$/.test(p) && p !== pub && !seen.has(p)) { seen.add(p); list.push({ pub: p, name: String(x.name || "玩家").slice(0, 12) }); } }
    await store.set("blocks", pub, { list }); blockCache.set(pub, { exists: true, list });
    const removed = []; for (const b of list) { const f = await getF(pub); if (f.friends.includes(b.pub)) { await unfriend(pub, b.pub); removed.push(b.pub); } }
    return { list, removed };
  }
  async function unfriend(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) for (const f of ["friends", "inReq", "outReq"]) await store.arrayRemove("friends", x, f, y);
  }
  async function request(me, to) {
    if (me === to) throw E("不能加自己");
    const tp = await getProfile(to); if (!tp) throw E("找不到这位玩家");
    if (await blockedEither(me, to)) throw E("无法添加这位玩家");
    const f = await getF(me), t = await getF(to);
    if (f.friends.includes(to)) throw E("你们已经是好友了");
    if (f.friends.length >= MAX_FRIENDS) throw E("你的好友已满（最多 " + MAX_FRIENDS + " 人）");
    if (f.outReq.includes(to)) throw E("已经发送过申请了，等对方同意");
    if (f.inReq.includes(to)) return { auto: await accept(me, to) };      // 对方早就申请过我 → 直接成为好友
    if (t.inReq.length >= MAX_INREQ) throw E("对方的好友申请太多了，请稍后再试");
    await store.arrayAdd("friends", to, "inReq", me); await store.arrayAdd("friends", me, "outReq", to);
    return { sent: true };
  }
  async function accept(me, from) {
    const f = await getF(me); if (!f.inReq.includes(from)) throw E("这个申请已经失效了");
    const t = await getF(from);
    if (f.friends.length >= MAX_FRIENDS || t.friends.length >= MAX_FRIENDS) throw E("好友已满，无法添加");
    for (const [x, y] of [[me, from], [from, me]]) { await store.arrayRemove("friends", x, "inReq", y); await store.arrayRemove("friends", x, "outReq", y); await store.arrayAdd("friends", x, "friends", y); }
    return true;
  }
  async function decline(me, from) { await store.arrayRemove("friends", me, "inReq", from); await store.arrayRemove("friends", from, "outReq", me); }
  async function names(pubs) { const out = {}; for (const p of pubs) { const pr = await getProfile(p); out[p] = pr ? pr.name : "玩家"; } return out; }
  async function friendsView(me) {
    const f = await getF(me), nm = await names([...f.friends, ...f.inReq]), inbox = (await store.get("inbox", me)) || {};
    return { friends: f.friends.map((p) => ({ pub: p, name: nm[p], unread: (inbox.unread && inbox.unread[p]) || 0 })), inReq: f.inReq.map((p) => ({ pub: p, name: nm[p] })), outReq: f.outReq.slice(), };
  }

  /* ---- 看别人的资料：按对方设置的可见性过滤 ---- */
  async function viewProfile(viewer, target) {
    const p = await getProfile(target); if (!p) return null;
    const self = viewer === target, f = self ? null : await getF(viewer);
    const friend = !!(f && f.friends.includes(target)), out = !!(f && f.outReq.includes(target)), inc = !!(f && f.inReq.includes(target));
    const can = self || p.visibility === "public" || (p.visibility === "friends" && friend);
    const v = { pub: target, name: p.name, visibility: p.visibility, hidden: !can, self, friend, outReq: out, inReq: inc };
    if (can) Object.assign(v, { gender: p.gender, bio: p.bio, ig: p.ig, fb: p.fb });
    return v;
  }
  const publicMe = (p) => ({ name: p.name, gender: p.gender, bio: p.bio, ig: p.ig, fb: p.fb, visibility: p.visibility, nextNameAt: p.nameChangedAt ? p.nameChangedAt + NAME_COOLDOWN : 0 });

  /* ---- 私信 ---- */
  async function sendDm(me, to, text) {
    const f = await getF(me); if (!f.friends.includes(to)) throw E("需要先成为好友才能私信");
    const bt = await getBlocks(to); if (bt.list.some((x) => x.pub === me)) throw E("对方没有收到这条消息");
    const path = "dms/" + conv(me, to) + "/msgs", at = Date.now();
    await store.push(path, { from: me, text, at });
    await store.incr("inbox", to, "unread." + me, 1);
    let n = dmCount.has(path) ? dmCount.get(path) + 1 : (await store.count(path));
    if (n > KEEP_DM + 40) { await store.trim(path, KEEP_DM); n = KEEP_DM; }
    dmCount.set(path, n); return { at };
  }
  async function dmHistory(me, other, n) {
    const f = await getF(me); if (!f.friends.includes(other)) throw E("需要先成为好友");
    return (await store.last("dms/" + conv(me, other) + "/msgs", Math.min(100, n || 50))).map((m) => ({ mine: m.from === me, text: m.text, at: m.at }));
  }
  const dmRead = (me, other) => store.setField("inbox", me, "unread." + other, 0);
  async function dmEvidence(from, to, n) { try { return (await store.last("dms/" + conv(from, to) + "/msgs", 12)).filter((m) => m.from === from).slice(-n).map((m) => m.text); } catch (e) { return []; } }

  return { store, cleanName, cleanLink, ensureProfile, getProfile, setName, nameFree, setFirstName, setProfile, publicMe, viewProfile, getF, friendsView, request, accept, decline, unfriend, getBlocks, setBlocks, sendDm, dmHistory, dmRead, dmEvidence, E, MAX_FRIENDS };
}

/* ---------------- 登录凭证验证 ---------------- */
function createAuth() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    try {
      const admin = require("firebase-admin");
      let cred = JSON.parse(sa); if (cred.private_key) cred.private_key = String(cred.private_key).replace(/\\n/g, "\n");
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      console.log("Firebase Admin ready, project:", cred.project_id);
      return {
        mode: "firebase", store: firestoreStore(admin),
        async verify(token) { const d = await admin.auth().verifyIdToken(String(token)); return { uid: d.uid, anon: !!(d.firebase && d.firebase.sign_in_provider === "anonymous"), email: d.email || "" }; },
      };
    } catch (e) { console.error("Firebase init failed — social features OFF:", e.message); return null; }
  }
  if (process.env.DEV_AUTH === "1") { // 仅本地测试：token 写成 dev:<uid>[:email]，数据放内存。线上不要设置 DEV_AUTH。
    console.warn("DEV_AUTH=1 — in-memory store, fake tokens (LOCAL TESTING ONLY)");
    return { mode: "dev", store: memoryStore(), async verify(token) { const m = /^dev:([\w-]{3,40})(?::(.*))?$/.exec(String(token)); if (!m) throw new Error("bad dev token"); return { uid: m[1], anon: !m[2], email: m[2] || "" }; } };
  }
  console.warn("No FIREBASE_SERVICE_ACCOUNT — social features OFF (guest mode only)");
  return null;
}

module.exports = { create, createAuth, memoryStore, firestoreStore };
