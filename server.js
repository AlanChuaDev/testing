// STAR PLAZA 联机服务器：房间同步 + 聊天（过滤/限速）+ 舞台队列 + 组队 + 举报/拉黑 + WebRTC 语音信令 + K歌同步
// 部署在 Render（Web Service）：Build = npm install，Start = node server.js
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const MAX_ROOM = 40; // 每个房间最多人数
const MAX_TEAM = 5; // 队伍最多人数
const TEAM_OFFLINE_KEEP = 5 * 60 * 1000; // 队员掉线后，位置保留 5 分钟（重连自动归队）
const INVITE_TTL = 30 * 1000;
const STAGE_GRACE = 25 * 1000; // 轮到你后，走上舞台的时间
const MUTE_MS = 15 * 60 * 1000; // 被多人举报后的临时禁言时长
const REPORT_MUTE_N = 3; // 30 分钟内被 3 个不同的人举报 → 临时禁言

// 歌曲表（和前端共用 js/songs.js）；读不到就退化成「只限制长度」
let SongData = null;
try { SongData = require("./js/songs.js"); } catch (e) { console.warn("js/songs.js not found, song validation relaxed"); }

// ---------- GM：歌词 / 歌曲延迟校准（保存后全服更新）----------
// 环境变量（Render → Environment）：
//   GM_KEY                      GM 密钥（必填；没设置就完全禁用 GM）
//   UPSTASH_REDIS_REST_URL      可选：Upstash Redis 地址（设置后配置/举报记录永久保存，重启不丢）
//   UPSTASH_REDIS_REST_TOKEN    可选：Upstash Redis 令牌
//   BAD_WORDS                   可选：额外的屏蔽词，逗号分隔
// 没配 Upstash 时只存在本机文件里：Render 免费版休眠/重启后会丢，需要重新保存。
const GM_KEY = process.env.GM_KEY || "";
const UP_URL = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, "");
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const CFG_KEY = "starplaza:songcfg";
const REPORT_KEY = "starplaza:reports";
const CFG_FILE = path.join(process.env.DATA_DIR || __dirname, "songcfg.json");
let songCfg = {}; // { 歌名: { offset: 毫秒(-10000~10000), lrc: 歌词全文，空 = 用仓库里的文件 } }
let gmFailTimes = []; // 全局失败登录时间，用来防暴力猜密钥

function cleanOneCfg(c) {
  c = c && typeof c === "object" ? c : {};
  return {
    offset: Math.max(-10000, Math.min(10000, Math.round(Number(c.offset) || 0))),
    lrc: typeof c.lrc === "string" ? c.lrc.replace(/\u0000/g, "").slice(0, 12000) : "",
  };
}
function cleanAllCfg(o) {
  const out = {};
  if (!o || typeof o !== "object") return out;
  for (const k of Object.keys(o).slice(0, 50)) {
    const name = String(k).slice(0, 40);
    if (name) out[name] = cleanOneCfg(o[k]);
  }
  return out;
}
async function upstash(cmd) {
  const r = await fetch(UP_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + UP_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(5000),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status);
  return j.result;
}
async function loadCfg() {
  try {
    if (UP_URL && UP_TOKEN) {
      const v = await upstash(["GET", CFG_KEY]);
      if (v) songCfg = cleanAllCfg(JSON.parse(v));
      console.log("songcfg loaded from Upstash:", Object.keys(songCfg).length, "songs");
    } else if (fs.existsSync(CFG_FILE)) {
      songCfg = cleanAllCfg(JSON.parse(fs.readFileSync(CFG_FILE, "utf8")));
      console.log("songcfg loaded from file:", Object.keys(songCfg).length, "songs");
    }
  } catch (e) { console.error("load songcfg failed:", e.message); }
}
async function saveCfg() { // 返回保存到了哪里："upstash" | "disk" | "memory"
  const text = JSON.stringify(songCfg);
  if (UP_URL && UP_TOKEN) {
    try { await upstash(["SET", CFG_KEY, text]); return "upstash"; }
    catch (e) { console.error("save to Upstash failed:", e.message); }
  }
  try { fs.writeFileSync(CFG_FILE, text); return "disk"; }
  catch (e) { console.error("save to file failed:", e.message); return "memory"; }
}
let saveChain = Promise.resolve();
function safeEq(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- 聊天过滤 ----------
const BAD_ZH = [
  "傻逼", "傻比", "沙比", "煞笔", "傻b", "傻屄", "草泥马", "操你", "草你", "肏你", "艹你", "日你", "干你娘", "幹你娘", "干你妈", "他妈的", "妈的", "你妈", "鸡巴", "屌你", "婊子", "贱人", "骚货", "去死", "死全家", "狗娘养", "操逼", "做爱",
  "约炮", "援交", "招嫖", "裸聊", "色情", "博彩", "赌场", "刷单", "代充", "加微信", "加我微信", "加qq", "懒叫", "冚家铲", "柒头", "仆街",
];
const BAD_EN = ["fuck", "fuk", "fck", "shit", "bitch", "cunt", "dick", "pussy", "asshole", "nigger", "nigga", "faggot", "whore", "slut", "bastard", "babi", "sial", "pukimak", "puki", "cibai", "lanjiao", "kanina", "knn", "ccb"];
const extra = String(process.env.BAD_WORDS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
for (const w of extra) (/^[\x00-\x7f]+$/.test(w) ? BAD_EN : BAD_ZH).push(w);
const EN_RE = BAD_EN.map((w) => new RegExp("(?<![a-z])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z])", "gi"));
const ZH_WORDS = BAD_ZH.map((w) => w.toLowerCase());

function maskBad(s) { // 返回 { text, hit }
  let hit = false;
  // 1) 中文 / 混合词：去掉空格标点后匹配（"傻 逼"、"傻.逼" 也能抓到），只替换命中的那几个字
  const keep = []; let sk = "";
  for (let i = 0; i < s.length; i++) {
    const n = s[i].normalize("NFKC").toLowerCase();
    for (const c of n) if (/[一-鿿a-z0-9]/.test(c)) { sk += c; keep.push(i); }
  }
  const mask = new Array(s.length).fill(false);
  for (const w of ZH_WORDS) {
    let p = 0;
    while ((p = sk.indexOf(w, p)) >= 0) { hit = true; for (let k = p; k < p + w.length; k++) mask[keep[k]] = true; p += w.length; }
  }
  let out = ""; for (let i = 0; i < s.length; i++) out += mask[i] ? "*" : s[i];
  // 2) 英文 / 马来语：按单词边界匹配，避免误伤 class、Scunthorpe 这类正常词
  for (const re of EN_RE) out = out.replace(re, (m) => { hit = true; return "*".repeat(m.length); });
  return { text: out, hit };
}
function maskLinks(s) { // 网址、长数字（电话 / QQ / 微信号）一律打码，防广告
  let hit = false;
  const rep = (m) => { hit = true; return "*".repeat(Math.min(m.length, 8)); };
  s = s.replace(/(https?:\/\/|www\.)\S+/gi, rep);
  s = s.replace(/\b[a-z0-9-]{2,}\.(com|net|org|my|cc|xyz|top|link|me|io|vip|club|site|shop)\b\S*/gi, rep);
  s = s.replace(/\d[\d\s\-.]{6,}\d/g, rep);
  return { text: s, hit };
}
function filterText(s) {
  const a = maskLinks(s), b = maskBad(a.text);
  return { text: b.text, hit: a.hit || b.hit };
}

// ---------- 账号 / 好友 / 私信（Firebase）----------
let SocialMod = null; try { SocialMod = require("./social.js"); } catch (e) { console.warn("social.js not found:", e.message); }
const AUTH = SocialMod ? SocialMod.createAuth() : null;
const S = AUTH ? SocialMod.create({ store: AUTH.store, filterText }) : null;
let BondsMod = null; try { BondsMod = require("./bonds.js"); } catch (e) { console.warn("bonds.js not found:", e.message); }
const B = S && BondsMod ? BondsMod.create({ store: AUTH.store }) : null;
let WalletMod = null, SD = null; try { WalletMod = require("./wallet.js"); SD = require("./js/shopdata.js"); } catch (e) { console.warn("wallet.js / shopdata.js not found:", e.message); }
const W = S && WalletMod ? WalletMod.create({ store: AUTH.store }) : null;   // 钱包：金币 / 签到 / 商店 / 礼物（只有登录用户有）   // 好友亲密度（没登录服务 / 没 bonds.js 时关闭）
const UE = (m) => { const e = new Error(m); e.user = true; return e; };
const byPubWs = new Map(); // pub -> 当前在线的连接（登录用户）

// ---------- 基础 ----------
const myTime = () => new Date(Date.now() + 8 * 3600e3).toISOString().replace("T", " ").slice(0, 19) + " (MY)"; // 马来西亚时间 UTC+8
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("STAR PLAZA multiplayer server is running. online=" + wss.clients.size);
});

const wss = new WebSocket.Server({ server: httpServer, maxPayload: 64 * 1024 });
const rooms = new Map(); // room -> Map(playerId -> {ws, info, state})
const byPid = new Map(); // playerId -> ws
const mutes = new Map(); // pub -> 禁言到期时间
/* 封号：pub -> { until(0=永久), name, by, at }；整份存在 Firestore gm/bans 一个文档里，重启不丢；到期自动失效 */
const bans = new Map();
const bansReady = (async () => { if (!S) return; try { const d = await S.store.get("gm", "bans"); for (const [p, b] of Object.entries((d && d.list) || {})) bans.set(p, b); } catch (e) { console.warn("bans load failed:", e.message); } })();
function saveBans() { if (!S) return; const o = {}; for (const [p, b] of bans) if (!b.until || b.until > Date.now()) o[p] = b; S.store.set("gm", "bans", { list: o }).catch((e) => console.warn("bans save failed:", e.message)); }
function banOf(pub) { const b = bans.get(pub); if (!b) return null; if (b.until && b.until <= Date.now()) { bans.delete(pub); saveBans(); return null; } return b; }
const BAN_MINS = [15, 30, 60, 1440, 4320, 0];   // 15 分 / 30 分 / 1 小时 / 1 天 / 3 天 / 永久(0)
const GM_MAX_GIFT = 100000;                     // GM 单次最多送多少金币
const reportLog = []; // 最近的举报记录（内存里留 300 条）
const gmActionLog = []; // GM 管理操作审计（内存留 200 条）
const reportsOn = new Map(); // targetPub -> [{ by, at }]

const pubOf = (uid) => crypto.createHash("sha256").update("sp:" + uid).digest("hex").slice(0, 16);

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function isBlocked(a, b) { // 任意一方拉黑了另一方
  return !!((a.blocks && b.pub && a.blocks.has(b.pub)) || (b.blocks && a.pub && b.blocks.has(a.pub)));
}
function sendToRoom(room, data, except = null, from = null) {
  const players = rooms.get(room);
  if (!players) return;
  for (const p of players.values()) {
    if (p.ws === except) continue;
    if (from && isBlocked(from, p.ws)) continue;
    send(p.ws, data);
  }
}
function roomCount(room) {
  const r = rooms.get(room);
  return r ? r.size : 0;
}
function cleanName(s) {
  s = String(s || "").normalize("NFKC").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 12);
  if (!s) return "玩家";
  if (/^(?:g\s*m|gm|管理员|官方)$/i.test(s.replace(/\s+/g, ""))) return "玩家";
  const f = filterText(s);
  return f.hit ? "玩家" : s;
}
function cleanFace(f) {   // [创建面板] 脸部选项：数字限制在 0~30，颜色只收 #rrggbb，布尔收 true/false；其余字段丢弃
  const out = {};
  if (!f || typeof f !== "object") return out;
  for (const k of Object.keys(f).slice(0, 24)) {
    const v = f[k];
    if (!/^[A-Za-z]{1,12}$/.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.max(0, Math.min(30, Math.round(v)));
    else if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
  }
  return out;
}
function cleanOutfit(o) {
  if (!o || typeof o !== "object") return {};
  const out = {};
  for (const k of ["hair", "top", "bottom", "socks", "shoes"]) {
    out[k] = typeof o[k] === "string" && /^#[0-9a-fA-F]{6}$/.test(o[k]) ? o[k] : null;
  }
  out.bottomType = o.bottomType === "skirt" ? "skirt" : "shorts";
  out.choker = o.choker !== false;
  out.skin = Math.max(0, Math.min(7, parseInt(o.skin) || 0));   // [创建面板] 肤色扩到 8 种
  out.scale = Math.max(0.85, Math.min(1.15, Number(o.scale) || 1));
  // [创建面板] 创建人物新增的外观字段（性别 / 发型 / 耳朵 / 套装 / 脸）。不加这几行，别的玩家就看不到你的脸型和性别。
  out.gender = o.gender === "m" ? "m" : "f";
  out.hairStyle = Math.max(0, Math.min(9, parseInt(o.hairStyle) || 0));
  out.mhair = Math.max(0, Math.min(9, parseInt(o.mhair) || 0));
  out.ear = Math.max(0, Math.min(6, parseInt(o.ear) || 0));
  out.shape = Math.max(0, Math.min(11, parseInt(o.shape) || 0));   // [创建面板] 脸型 0~11
  out.set = o.set === "hoodie" ? "hoodie" : null;
  out.face = cleanFace(o.face);
  return out;
}
const cleanOwned = (a) => (Array.isArray(a) ? a : []).map((x) => String(x)).filter((x) => /^[a-z0-9_]{1,20}$/.test(x)).slice(0, 20);
function saveLook(ws, outfit, owned) { // 外观绑定账号：存进 Firestore looks/{pub}（登录用户才存，改动 2 秒后合并写一次）
  if (!ws.authed || !ws.pub) return;
  const o = cleanOutfit(outfit), ow = owned === undefined ? (ws.look ? ws.look.owned : []) : cleanOwned(owned);
  ws.look = { outfit: o, owned: ow };
  clearTimeout(ws.lookT);
  ws.lookT = setTimeout(() => { S.store.set("looks", ws.pub, { outfit: ws.look.outfit, owned: ws.look.owned, at: Date.now() }).catch((e) => console.warn("look save failed:", e.message)); }, 2000);
}
function num(v, d = 0) {
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}
function cleanState(s) {
  if (!s || typeof s !== "object") return null;
  const out = {
    x: num(s.x), y: num(s.y), z: num(s.z), yaw: num(s.yaw),
    mv: s.mv ? 1 : 0, run: s.run ? 1 : 0, sing: s.sing ? 1 : 0,
    pz: typeof s.pz === "string" ? s.pz.slice(0, 12) : null,
    sc: Math.max(0, Math.min(999, Math.floor(num(s.sc)))),   // 骑踏板：(车位+1)*100 + 颜色序号
    sit: null,
  };
  if (s.sit && typeof s.sit === "object") {
    out.sit = { x: num(s.sit.x), z: num(s.sit.z), h: num(s.sit.h), yaw: num(s.sit.yaw) };
  }
  return out;
}

let onlineTimer = null;
function pushOnline() { // 全服在线人数（防抖）
  if (onlineTimer) return;
  onlineTimer = setTimeout(() => {
    onlineTimer = null;
    const n = wss.clients.size;
    for (const c of wss.clients) send(c, { type: "online", n });
  }, 800);
}

const withPresence = (v) => { v.friends.forEach((f) => { const w = byPubWs.get(f.pub); f.online = !!w; f.room = w ? w.room : null; }); return v; };
async function withBonds(me, v) { // 给每个好友附上亲密度（等级 / 进度条 / 今天问暖了没）
  if (B) { try { const bm = await B.view(me, v.friends.map((f) => f.pub)); v.friends.forEach((f) => { f.bond = bm[f.pub] || null; }); } catch (e) { console.warn("bond view failed:", e.message); } }
  return v;
}
async function pushFriends(pub) { // 把最新的好友列表推给在线的人
  const w = byPubWs.get(pub); if (!w || !S) return;
  const v = await S.friendsView(pub); w.friendSet = new Set(v.friends.map((f) => f.pub)); send(w, Object.assign({ type: "friends" }, await withBonds(pub, withPresence(v))));
}
function bondNotify(a, b, r) { // 升级了 / 完成累计任务：通知双方，并刷新好友列表上的进度条
  if (!r || (!r.gained && !(r.rewards && r.rewards.length))) return;
  if (r.rewards && r.rewards.length) {
    const wa = byPubWs.get(a), wb = byPubWs.get(b);
    for (const rw of r.rewards) {
      const text = "🎉 互动任务完成：" + rw.name + " " + rw.goal + rw.unit + "，亲密度 +" + rw.xp;
      if (wa) send(wa, { type: "toast", message: text }); if (wb) send(wb, { type: "toast", message: text });
    }
  }
  if (r.levelUp) {
    const wa = byPubWs.get(a), wb = byPubWs.get(b);
    if (wa) send(wa, { type: "toast", message: "💞 你和 " + ((wb && wb.name) || "好友") + " 的亲密度升到 Lv." + r.levelUp + " 了！" });
    if (wb) send(wb, { type: "toast", message: "💞 你和 " + ((wa && wa.name) || "好友") + " 的亲密度升到 Lv." + r.levelUp + " 了！" });
  }
  pushFriends(a).catch(() => {}); pushFriends(b).catch(() => {});
}
const bondGain = (a, b, kind, n) => { if (!B) return; B.gain(a, b, kind, n).then((r) => bondNotify(a, b, r)).catch((e) => console.warn("bond gain failed:", e.message)); };   // 其他功能加亲密度统一走这个：bondGain(甲pub, 乙pub, "duet" | "gift" | ..., 数量)

// 每分钟一次：互为好友、同在一张地图 / 同一个队伍的，各加 1 点（每天有上限，GM 隐身的不算）
setInterval(async () => {
  if (!B) return;
  try {
    const seen = new Set();
    for (const ws of [...byPubWs.values()]) {
      if (!ws.friendSet || !ws.friendSet.size || ws.gmInvisible || !ws.room) continue;
      for (const p of ws.friendSet) {
        const w = byPubWs.get(p); if (!w || w.gmInvisible || !w.room || !w.friendSet || !w.friendSet.has(ws.pub)) continue;
        const key = ws.pub < p ? ws.pub + "_" + p : p + "_" + ws.pub; if (seen.has(key)) continue; seen.add(key);
        if (w.room === ws.room) bondGain(ws.pub, p, "room", 1);
        const ta = teamOf.get(ws.pub); if (ta && ta === teamOf.get(p)) bondGain(ws.pub, p, "team", 1);
      }
    }
  } catch (e) { console.warn("bond tick failed:", e.message); }
}, 60000);
function presence(ws) { // 我上线 / 下线 / 换地图：告诉在线的好友
  for (const p of ws.friendSet || []) { const w = byPubWs.get(p); if (w) send(w, { type: "presence", pub: ws.pub, name: ws.name, online: !ws.closed, room: ws.closed ? null : ws.room }); }
}

// ---------- 舞台队列（服务器说了算：每个房间一个队列）----------
const stages = new Map(); // room -> { queue: [], cur: null }
const stageView = (s) => ({
  queue: s.queue.map((q) => ({ pid: q.pid, name: q.name, song: q.song, artist: q.artist, dur: q.dur })),
  cur: s.cur ? { pid: s.cur.pid, name: s.cur.name, song: s.cur.song, artist: s.cur.artist, dur: s.cur.dur, phase: s.cur.phase, end: s.cur.end } : null,
  ts: Date.now(),
});
function stageSend(room, s) { sendToRoom(room, Object.assign({ type: "stage" }, stageView(s))); }
function stagePromote(s) {
  if (!s.cur && s.queue.length) {
    const q = s.queue.shift();
    s.cur = Object.assign({}, q, { phase: "wait", end: Date.now() + STAGE_GRACE });
  }
}
function stageAfter(room, s) { // 变化后：推进 + 广播 + 空了就清掉
  stagePromote(s);
  stageSend(room, s);
  if (!s.cur && !s.queue.length) stages.delete(room);
}
function stageDrop(ws, room) { // 玩家离开房间 / 掉线：退出队列，正在唱的话换下一位
  const s = stages.get(room); if (!s) return;
  const n = s.queue.length;
  s.queue = s.queue.filter((q) => q.pid !== ws.playerId);
  let changed = s.queue.length !== n;
  if (s.cur && s.cur.pid === ws.playerId) { s.cur = null; changed = true; }
  if (changed) stageAfter(room, s);
}
setInterval(() => {
  const now = Date.now();
  for (const [room, s] of [...stages.entries()]) {
    if (s.cur && s.cur.phase === "wait" && now > s.cur.end) {
      const w = byPid.get(s.cur.pid); if (w) send(w, { type: "stage_skip", reason: "noshow" });
      s.cur = null; stageAfter(room, s);
    } else if (s.cur && s.cur.phase === "sing" && now > s.cur.end + 4000) { // 演唱端没报告结束，兜底
      s.cur = null; stageAfter(room, s);
    }
  }
}, 500);

// ---------- 队伍 ----------
// ---------- 通知中心（通告 / 更新 / 活动）：GM 在面板里发布，所有玩家在「通知」里查看；存在 Firestore 的 notices/main ----------
let noticeCache = null;
const noticeStore = () => (AUTH && AUTH.store) || null;
async function noticesLoad() {
  if (noticeCache) return noticeCache;
  let d = null; try { const st = noticeStore(); d = st ? await st.get("notices", "main") : null; } catch (e) { console.warn("notices load failed:", e.message); }
  noticeCache = d && Array.isArray(d.list) ? d.list : [];
  if (!noticeCache.length) { // 第一次：放两条示例，GM 之后可以在面板里删掉 / 新增
    const at = Date.now();
    noticeCache = [
      { id: "n" + at, kind: "update", title: "新功能：签到、商店、礼物、好友亲密度", body: "· 点左上角金币：每日签到、商店（称号 / 头像框 / 气泡 / 名字颜色）、送礼物。\n· 好友列表里能看到亲密度等级和进度条，每天可以问暖。\n· 点好友旁边的「互动」可以查看亲密度任务。", at },
      { id: "n" + (at + 1), kind: "notice", title: "欢迎来到星光广场", body: "有问题可以点击玩家举报，GM 会处理。祝你玩得开心！", at: at + 1 },
    ];
    noticesSave();
  }
  return noticeCache;
}
async function noticesSave() { const st = noticeStore(); if (st) { try { await st.set("notices", "main", { list: noticeCache }); } catch (e) { console.warn("notices save failed:", e.message); } } }
const NOTICE_KINDS = { notice: 1, update: 1, event: 1 };

// teams: id -> { id, leader(pub), members: Map(pub -> {pub, name, pid|null, offlineAt|null}), banned: Set(pub) }
const teams = new Map();
const teamOf = new Map(); // pub -> teamId
const invites = new Map(); // invId -> { from: pid, to: pid, at }

function teamView(t) {
  return {
    id: t.id, leader: t.leader,
    members: [...t.members.values()].map((m) => {
      const c = m.pid ? byPid.get(m.pid) : null;
      return { pub: m.pub, name: m.name, pid: c ? m.pid : null, room: c ? c.room : null, online: !!c, mic: !!(c && c.vMic), spk: c ? c.vSpk !== false : true };
    }),
  };
}
function teamSend(t) {
  const v = teamView(t);
  for (const m of t.members.values()) { const c = m.pid && byPid.get(m.pid); if (c) send(c, { type: "team", team: v }); }
}
function teamMembersWs(t) {
  const out = [];
  for (const m of t.members.values()) { const c = m.pid && byPid.get(m.pid); if (c) out.push(c); }
  return out;
}
function teamNew(leaderWs) {
  const id = crypto.randomBytes(9).toString("hex");
  const t = { id, leader: leaderWs.pub, members: new Map(), banned: new Set() };
  teams.set(id, t);
  teamAdd(t, leaderWs);
  return t;
}
function teamAdd(t, ws) {
  t.members.set(ws.pub, { pub: ws.pub, name: ws.name || "玩家", pid: ws.playerId, offlineAt: null });
  teamOf.set(ws.pub, t.id);
  ws.teamId = t.id;
}
function teamRemove(t, pub, why) {
  const m = t.members.get(pub); if (!m) return;
  t.members.delete(pub); teamOf.delete(pub);
  const c = m.pid && byPid.get(m.pid);
  if (c) { c.teamId = null; send(c, { type: "team", team: null, reason: why || "你已离开队伍" }); }
  if (t.members.size < 2) { // 只剩一个人：队伍解散
    for (const r of t.members.values()) { teamOf.delete(r.pub); const w = r.pid && byPid.get(r.pid); if (w) { w.teamId = null; send(w, { type: "team", team: null, reason: "队伍已解散" }); } }
    teams.delete(t.id); return;
  }
  if (t.leader === pub) {
    const next = [...t.members.values()].find((x) => x.pid) || [...t.members.values()][0];
    t.leader = next.pub;
  }
  teamSend(t);
}
function teamOfWs(ws) { return ws.pub && teams.get(teamOf.get(ws.pub)) || null; }
function attachTeam(ws, claim) { // 新连接 / 重连：认回自己的队伍
  const t = teamOfWs(ws);
  if (t) { // 服务器还记得（掉线 < 5 分钟）：直接换上新的连接
    const m = t.members.get(ws.pub); m.pid = ws.playerId; m.name = ws.name || m.name; m.offlineAt = null; ws.teamId = t.id;
    teamSend(t); return;
  }
  if (!claim || typeof claim.id !== "string" || claim.id.length > 40) return;
  // 服务器重启过（Render 免费版休眠）：凭队伍号（只有队员知道）重建 / 归队
  let t2 = teams.get(claim.id);
  if (!t2) { t2 = { id: claim.id, leader: ws.pub, members: new Map(), banned: new Set() }; teams.set(t2.id, t2); }
  if (t2.banned.has(ws.pub) || t2.members.size >= MAX_TEAM) { send(ws, { type: "team", team: null, reason: "原来的队伍已不能加入" }); if (!t2.members.size) teams.delete(t2.id); return; }
  if (claim.leader === ws.pub) t2.leader = ws.pub;
  teamAdd(t2, ws); teamSend(t2);
}
setInterval(() => { // 清理：掉线太久的队员、过期邀请
  const now = Date.now();
  for (const t of [...teams.values()]) {
    for (const m of [...t.members.values()]) if (!m.pid && m.offlineAt && now - m.offlineAt > TEAM_OFFLINE_KEEP && teams.has(t.id)) teamRemove(t, m.pub, "掉线太久，已移出队伍");
    if (teams.has(t.id) && ![...t.members.values()].some((m) => m.pid) && ![...t.members.values()].some((m) => now - (m.offlineAt || now) < TEAM_OFFLINE_KEEP)) teams.delete(t.id);
  }
  for (const [id, v] of invites) if (now - v.at > INVITE_TTL) invites.delete(id);
}, 15000);

// ---------- 聊天限速 / 禁言 ----------
function chatGate(ws, raw) { // 返回 { ok, text } 或 { ok:false, msg }
  const now = Date.now();
  if (!ws.isGM) {
    const mu = ws.pub && mutes.get(ws.pub);
    if (mu && mu > now) return { ok: false, msg: "你被多人举报，已被临时禁言，还剩 " + Math.ceil((mu - now) / 60000) + " 分钟" };
    if (ws.chatCool && now < ws.chatCool) return { ok: false, msg: "发言太频繁，请稍后再试" };
    ws.chatLog = (ws.chatLog || []).filter((t) => now - t < 10000);
    if (ws.chatLog.length && now - ws.chatLog[ws.chatLog.length - 1] < 1000) return { ok: false, msg: "发言太快啦，慢一点" };
    if (ws.chatLog.length >= 6) { ws.chatCool = now + 8000; return { ok: false, msg: "发言太频繁，请 8 秒后再试" }; }
    const norm = raw.replace(/\s+/g, "").toLowerCase();
    if (ws.lastChat && ws.lastChat.t === norm && now - ws.lastChat.at < 15000) return { ok: false, msg: "请不要重复发送相同内容" };
    ws.chatLog.push(now); ws.lastChat = { t: norm, at: now };
  }
  const f = filterText(raw); // GM 也必须经过内容过滤
  if (!f.text.replace(/[\s*]/g, "")) return { ok: false, msg: "消息包含不允许的内容" };
  return { ok: true, text: f.text, hit: f.hit };
}

// ---------- 举报 ----------
async function persistReport(rec) {
  console.log("REPORT", JSON.stringify(rec));
  if (UP_URL && UP_TOKEN) {
    try { await upstash(["RPUSH", REPORT_KEY, JSON.stringify(rec)]); await upstash(["LTRIM", REPORT_KEY, "-500", "-1"]); }
    catch (e) { console.error("save report failed:", e.message); }
  }
}

wss.on("connection", (ws) => {
  ws.playerId = crypto.randomUUID();
  ws.pub = pubOf("guest:" + ws.playerId); // hello 之后换成按设备 uid 算的稳定编号
  ws.name = "玩家";
  ws.blocks = new Set();
  ws.room = null;
  ws.teamId = null;
  ws.isAlive = true;
  ws.msgCount = 0;
  ws.msgWindow = Date.now();
  ws.recent = [];
  byPid.set(ws.playerId, ws);
  ws.on("pong", () => { ws.isAlive = true; });

  send(ws, { type: "connected", playerId: ws.playerId });
  send(ws, { type: "songcfg", cfg: songCfg }); // 新玩家一连上就拿到 GM 保存的歌词 / 延迟
  pushOnline();

  ws.q = Promise.resolve();
  const onMessage = async (raw) => {
    if (ws.kicked) return;   // 已被顶号的旧连接：它再发什么都不处理
    // 简单限速：每秒最多 60 条
    const now = Date.now();
    if (now - ws.msgWindow > 1000) { ws.msgWindow = now; ws.msgCount = 0; }
    if (++ws.msgCount > 60) return;

    let m;
    try { m = JSON.parse(raw.toString()); } catch { return send(ws, { type: "error", message: "Invalid JSON" }); }
    if (!m || typeof m.type !== "string") return;

    if (m.type === "ping") return send(ws, { type: "pong", t: m.t, ts: Date.now() });

    // 身份：登录用户用 Firebase 凭证验证；没登录（Firebase 没加载 / 没配置）就是游客，只能玩基础功能
    if (m.type === "hello") {
      if (ws.helloDone) return;
      ws.helloDone = true;
      if (m.token && AUTH) {
        try { const a = await AUTH.verify(m.token); ws.fuid = a.uid; ws.pub = pubOf("fb:" + a.uid); ws.authed = true; kickDup(ws); ws.acct = { anon: a.anon, email: a.email }; await bansReady; const bn = banOf(ws.pub); if (bn) { console.log("BANNED_LOGIN", myTime(), JSON.stringify(bn.name || ""), "pub=" + ws.pub); ws.kicked = true; send(ws, { type: "banned", until: bn.until, name: bn.name }); setTimeout(() => { try { ws.close(4003, "banned"); } catch {} }, 300); setTimeout(() => { try { ws.terminate(); } catch {} }, 2500); return; } }
        catch (e) { send(ws, { type: "auth_fail", message: "登录凭证无效，已作为游客进入" }); }
      }
      if (!ws.authed) { const uid = String(m.uid || ""); if (uid.length >= 8 && uid.length <= 80) ws.pub = pubOf(uid); ws.name = cleanName(m.name); ws.blocks = new Set((Array.isArray(m.blocks) ? m.blocks : []).slice(0, 200).map((x) => String(x).slice(0, 16))); }
      else {
        try {
          const prof = await S.ensureProfile(ws.pub, m.name); ws.name = prof.name;
          const bl = await S.getBlocks(ws.pub); let list = bl.list;
          if (!bl.exists && Array.isArray(m.blocksDetail) && m.blocksDetail.length) list = (await S.setBlocks(ws.pub, m.blocksDetail)).list;
          ws.blocks = new Set(list.map((x) => x.pub)); send(ws, { type: "blocks_sync", list });
          byPubWs.set(ws.pub, ws);
          send(ws, { type: "me_profile", profile: S.publicMe(prof), acct: ws.acct });
          await pushFriends(ws.pub); presence(ws);
          try { const lk = await S.store.get("looks", ws.pub); ws.look = lk && lk.outfit ? { outfit: cleanOutfit(lk.outfit), owned: cleanOwned(lk.owned) } : null; send(ws, { type: "me_look", has: !!ws.look, outfit: ws.look ? ws.look.outfit : null, owned: ws.look ? ws.look.owned : [] }); } catch (e) { console.warn("look load failed:", e.message); }
          if (W) { try { const wv = await W.view(ws.pub); ws.cos = wv.equip; send(ws, Object.assign({ type: "wallet" }, wv)); } catch (e) { console.warn("wallet load failed:", e.message); } }
        } catch (e) { console.error("account load failed:", e.message); ws.authed = false; ws.name = cleanName(m.name); ws.blocks = new Set(); send(ws, { type: "auth_fail", message: "账号服务暂时不可用，已作为游客进入" }); }
      }
      send(ws, { type: "hello_ok", pub: ws.pub, authed: !!ws.authed });
      ws.joinAt = Date.now(); console.log("JOIN", myTime(), JSON.stringify(ws.name || ""), ws.authed ? (ws.acct && ws.acct.anon ? "anon" : "account") : "guest", "pub=" + ws.pub, "online=" + wss.clients.size);
      attachTeam(ws, m.team);
      return;
    }

    if (m.type === "blocks") { // 更新黑名单（登录用户会保存到账号里）
      const detail = (Array.isArray(m.detail) ? m.detail : (Array.isArray(m.list) ? m.list.map((x) => ({ pub: x })) : []));
      if (ws.authed) { const r = await S.setBlocks(ws.pub, detail); ws.blocks = new Set(r.list.map((x) => x.pub)); for (const rp of r.removed) { pushFriends(rp); } pushFriends(ws.pub); }
      else ws.blocks = new Set(detail.slice(0, 200).map((x) => String(x.pub).slice(0, 16)));
      const t = teamOfWs(ws);
      if (t) for (const mem of t.members.values()) if (ws.blocks.has(mem.pub)) { teamRemove(t, ws.pub, "你拉黑了队友，已退出队伍"); break; }
      return;
    }

    // GM 登录：密钥只在服务器端比对，客户端代码里没有
    if (m.type === "gm_login") {
      if (!GM_KEY) return send(ws, { type: "gmFail", message: "服务器没有设置 GM_KEY，GM 功能未启用" });
      const now2 = Date.now();
      gmFailTimes = gmFailTimes.filter((t) => now2 - t < 10 * 60 * 1000);
      if (gmFailTimes.length >= 20 || (ws.gmBlockUntil && now2 < ws.gmBlockUntil)) {
        return send(ws, { type: "gmFail", message: "尝试次数太多，请稍后再试" });
      }
      if (safeEq(m.key || "", GM_KEY)) {
        ws.isGM = true; ws.gmFails = 0;
        if (ws.room) {
          const meP = rooms.get(ws.room)?.get(ws.playerId); if (meP) meP.info.isGM = true;
          sendToRoom(ws.room, { type: "gmBadge", playerId: ws.playerId, isGM: true });
        }
        return send(ws, { type: "gmOk" });
      }
      gmFailTimes.push(now2);
      ws.gmFails = (ws.gmFails || 0) + 1;
      if (ws.gmFails >= 5) { ws.gmFails = 0; ws.gmBlockUntil = now2 + 60 * 1000; }
      return send(ws, { type: "gmFail", message: "密钥不对" });
    }

    // GM 管理玩家：服务端再次校验当前连接的 GM 身份，目标只能是其他在线玩家
    if (m.type === "gm_action") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const target = byPid.get(String(m.pid || ""));
      if (!target || target === ws || !target.pub) return send(ws, { type: "gmActionResult", ok: false, message: "目标玩家不在线或不能对自己操作" });
      let action = String(m.action || "");
      const targetRoom = target.room || null;
      const now = Date.now();
      if (action === "mute") {
        const mins = [15, 60, 1440].includes(Number(m.minutes)) ? Number(m.minutes) : 15;
        mutes.set(target.pub, now + mins * 60000);
        send(target, { type: "error", message: "GM 已禁言你 " + (mins === 1440 ? "24 小时" : mins + " 分钟") });
        send(ws, { type: "gmActionResult", ok: true, message: "已禁言 " + target.name + "（" + mins + " 分钟）" });
      } else if (action === "unmute") {
        mutes.delete(target.pub);
        send(target, { type: "toast", message: "GM 已解除你的禁言" });
        send(ws, { type: "gmActionResult", ok: true, message: "已解除 " + target.name + " 的禁言" });
      } else if (action === "kick") {
        const targetName = target.name;
        send(target, { type: "gmKicked", message: "你已被 GM 請出当前房间" });
        if (target.room) leaveRoom(target);
        send(ws, { type: "gmActionResult", ok: true, message: "已请出 " + targetName });
      } else if (action === "ban") {
        if (!target.authed) return send(ws, { type: "gmActionResult", ok: false, message: "只能封已登录的账号（游客没有账号可封）" });
        if (target.isGM) return send(ws, { type: "gmActionResult", ok: false, message: "不能封 GM" });
        const mins = BAN_MINS.includes(Number(m.minutes)) ? Number(m.minutes) : 60;
        const until = mins ? now + mins * 60000 : 0, nm = target.name;
        bans.set(target.pub, { until, name: nm, by: ws.name, at: now }); saveBans();
        target.kicked = true; send(target, { type: "banned", until, name: nm });
        onClose(target); try { target.close(4003, "banned"); } catch {} setTimeout(() => { try { target.terminate(); } catch {} }, 2500);
        send(ws, { type: "gmActionResult", ok: true, message: "已封号 " + nm + "（" + (mins ? (mins >= 1440 ? mins / 1440 + " 天" : mins >= 60 ? mins / 60 + " 小时" : mins + " 分钟") : "永久") + "）" });
      } else if (action === "coins") {
        const n = Math.round(Number(m.amount) || 0);
        if (!W) return send(ws, { type: "gmActionResult", ok: false, message: "钱包没有启用" });
        if (!target.authed) return send(ws, { type: "gmActionResult", ok: false, message: "只能送给已登录的账号（游客没有钱包）" });
        if (!Number.isSafeInteger(n) || n < 1 || n > GM_MAX_GIFT) return send(ws, { type: "gmActionResult", ok: false, message: "数额要在 1 ~ " + GM_MAX_GIFT + " 之间" });
        let total; try { total = await W.grant(target.pub, n); } catch (e) { return send(ws, { type: "gmActionResult", ok: false, message: "送金币失败：" + e.message }); }
        try { send(target, Object.assign({ type: "wallet" }, await W.view(target.pub))); } catch {}
        send(target, { type: "toast", message: "🎁 GM 送了你 " + n + " 金币" });
        send(ws, { type: "gmActionResult", ok: true, message: "已送给 " + target.name + " " + n + " 金币（对方现在有 " + total + "）" });
        action = "coins:" + n;
      } else return send(ws, { type: "gmActionResult", ok: false, message: "未知管理操作" });
      const rec = { at: new Date(now).toISOString(), by: ws.name, action, target: target.name, room: targetRoom };
      gmActionLog.push(rec); if (gmActionLog.length > 200) gmActionLog.shift();
      console.log("GM_ACTION", JSON.stringify(rec));
      return;
    }

    // GM 总览：在线人数 / 待处理举报 / 禁言人数 / 房间分布（只有 GM 连接能拿到）
    if (m.type === "gm_overview") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const nowO = Date.now();
      const online = [...byPid.values()].filter((c) => !c.closed).length;
      const pending = reportLog.filter((r) => !r.status).length;
      let muted = 0; for (const t of mutes.values()) if (t > nowO) muted++;
      const roomList = [...rooms.entries()].map(([name, pl]) => ({ name, n: pl.size })).sort((a, b) => b.n - a.n).slice(0, 20);
      return send(ws, { type: "gmOverview", online, pending, muted, invisible: !!ws.gmInvisible, uptime: Math.floor(process.uptime()), rooms: roomList });
    }

    // 退出 GM 模式：服务器收回权限、取消隐身、去掉 GM 徽章
    if (m.type === "gm_logout") {
      if (!ws.isGM) return send(ws, { type: "gmLoggedOut" });
      const wasInv = !!ws.gmInvisible, roomL = ws.room || null;
      const recL = { at: new Date().toISOString(), by: ws.name, action: "gm_logout", target: ws.name, room: roomL };
      gmActionLog.push(recL); if (gmActionLog.length > 200) gmActionLog.shift();
      ws.isGM = false; ws.gmInvisible = false;
      if (ws.room) {
        const ent = rooms.get(ws.room)?.get(ws.playerId);
        if (ent) { ent.info.isGM = false; ws.info = ent.info; }
        sendToRoom(ws.room, { type: "gmBadge", playerId: ws.playerId, isGM: false });
        if (wasInv) sendToRoom(ws.room, { type: "playerJoined", playerId: ws.playerId, info: ws.info, state: ent ? ent.state : null }, ws);
      }
      return send(ws, { type: "gmLoggedOut" });
    }

    if (m.type === "gm_action_log") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      return send(ws, { type: "gmActionLog", list: gmActionLog.slice(-50) });
    }

    // GM 保存：只有登录过的连接才能改；改完广播给所有在线玩家，并持久化
    if (m.type === "gm_save") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const song = String(m.song || "").trim().slice(0, 40);
      if (!song) return;
      const c = cleanOneCfg(m.cfg);
      if (c.offset === 0 && !c.lrc) delete songCfg[song]; else songCfg[song] = c;
      for (const cl of wss.clients) send(cl, { type: "songcfg", cfg: songCfg });
      console.log("GM saved song config:", song, "offset=" + c.offset, "customLrc=" + !!c.lrc);
      saveChain = saveChain.then(saveCfg).then((mode) => send(ws, { type: "gmSaved", song, persist: mode }));
      return;
    }

    // GM 查看举报记录
    if (m.type === "gm_reports") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      return send(ws, { type: "gmReports", list: reportLog.slice(-50).map((r,i)=>Object.assign({ _idx: Math.max(0,reportLog.length-50)+i },r)) });
    }

    if (m.type === "gm_players") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const list = [...byPid.values()].filter(c => !c.closed).map(c => ({ pid:c.playerId, pub:c.pub, name:c.name, room:c.room, isGM:!!c.isGM, invisible:!!c.gmInvisible, muted:((mutes.get(c.pub)||0)>Date.now()?(mutes.get(c.pub)-Date.now()):0), state:c.room ? (rooms.get(c.room)?.get(c.playerId)?.state || null) : null }));
      return send(ws, { type:"gmPlayers", list, n:list.length, invisible:!!ws.gmInvisible });
    }

    if (m.type === "gm_bans") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      await bansReady; const list = []; for (const [pub] of bans) { const b = banOf(pub); if (b) list.push({ pub, name: b.name, until: b.until, by: b.by, at: b.at }); }
      return send(ws, { type: "gmBans", list });
    }
    if (m.type === "gm_unban") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const pub = String(m.pub || "").slice(0, 32), b = bans.get(pub);
      if (!b) return send(ws, { type: "gmActionResult", ok: false, message: "这个账号没有被封" });
      bans.delete(pub); saveBans();
      const rec = { at: new Date().toISOString(), by: ws.name, action: "unban", target: b.name, room: null }; gmActionLog.push(rec); if (gmActionLog.length > 200) gmActionLog.shift(); console.log("GM_ACTION", JSON.stringify(rec));
      send(ws, { type: "gmActionResult", ok: true, message: "已解封 " + (b.name || "玩家") });
      return send(ws, { type: "gmBans", list: [...bans].map(([p, x]) => banOf(p) && { pub: p, name: x.name, until: x.until, by: x.by, at: x.at }).filter(Boolean) });
    }

    if (m.type === "gm_invisible") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      ws.gmInvisible = !!m.on;
      const room = ws.room, players = room && rooms.get(room), ent = players && players.get(ws.playerId);
      if (room && ent) {
        if (ws.gmInvisible) sendToRoom(room, { type:"playerLeft", playerId:ws.playerId }, ws);
        else sendToRoom(room, { type:"playerJoined", playerId:ws.playerId, info:ent.info, state:ent.state }, ws);
      }
      const rec={at:new Date().toISOString(),by:ws.name,action:ws.gmInvisible?"invisible_on":"invisible_off",target:ws.name,room};
      gmActionLog.push(rec); if(gmActionLog.length>200)gmActionLog.shift();
      return send(ws,{type:"gmInvisible",on:ws.gmInvisible});
    }

    if (m.type === "gm_profile") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const pub=String(m.pub||"").slice(0,16); if(!/^[0-9a-f]{16}$/.test(pub)||!S) return send(ws,{type:"gmProfile",pub,profile:null});
      const profile=await S.getProfile(pub); // GM管理用途：返回完整资料，不套用玩家隐私过滤
      const rec={at:new Date().toISOString(),by:ws.name,action:"view_private_profile",target:profile?.name||pub,room:ws.room};
      gmActionLog.push(rec); if(gmActionLog.length>200)gmActionLog.shift();
      return send(ws,{type:"gmProfile",pub,profile:profile?{name:profile.name,gender:profile.gender,bio:profile.bio,ig:profile.ig,fb:profile.fb,visibility:profile.visibility}:null});
    }

    if (m.type === "gm_report_action") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const idx=Number(m.index), action=String(m.action||"");
      if(!Number.isInteger(idx)||idx<0||idx>=reportLog.length||!['handled','dismissed','mute','kick'].includes(action)) return send(ws,{type:"gmReportActionResult",ok:false,message:"举报或操作参数无效"});
      const rec=reportLog[idx]; rec.status=action; rec.handledAt=new Date().toISOString(); rec.handledBy=ws.name;
      const target=[...byPid.values()].find(c=>c.pub===rec.target);
      if(action==='mute'&&target){mutes.set(target.pub,Date.now()+15*60000);send(target,{type:"error",message:"GM 已根据举报禁言你 15 分钟"});}
      if(action==='kick'&&target){send(target,{type:"gmKicked",message:"你已被 GM 请出当前房间"});if(target.room)leaveRoom(target);}
      const audit={at:rec.handledAt,by:ws.name,action:"report_"+action,target:rec.targetName,room:rec.room};gmActionLog.push(audit);if(gmActionLog.length>200)gmActionLog.shift();
      return send(ws,{type:"gmReportActionResult",ok:true,message:"举报已更新为："+action});
    }

    if (m.type === "notice_get") { return send(ws, { type: "notices", list: await noticesLoad() }); }   // 所有人都能看
    if (m.type === "gm_notice_add" || m.type === "gm_notice_del") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const list = await noticesLoad(), clean = (t, n) => String(t || "").replace(/[\u0000-\u0008\u000b-\u001f<>]/g, "").trim().slice(0, n);
      if (m.type === "gm_notice_add") {
        const kind = NOTICE_KINDS[m.kind] ? m.kind : "notice", title = clean(m.title, 40), body = clean(m.body, 600);
        if (!title) return send(ws, { type: "gmActionResult", ok: false, message: "标题不能为空" });
        const item = { id: "n" + Date.now(), kind, title, body, at: Date.now() };
        list.unshift(item); if (list.length > 60) list.length = 60; await noticesSave();
        for (const client of wss.clients) send(client, { type: "notice_new", item });
        gmActionLog.push({ at: new Date().toISOString(), by: ws.name, action: "notice_add", target: title, room: "全服" }); if (gmActionLog.length > 200) gmActionLog.shift();
        send(ws, { type: "notices", list }); return send(ws, { type: "gmActionResult", ok: true, message: "通知已发布" });
      }
      const i = list.findIndex((x) => x.id === String(m.id || "")); if (i < 0) return send(ws, { type: "gmActionResult", ok: false, message: "找不到这条通知" });
      list.splice(i, 1); await noticesSave(); send(ws, { type: "notices", list }); return send(ws, { type: "gmActionResult", ok: true, message: "通知已删除" });
    }
    if (m.type === "gm_announcement") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const text=String(m.text||"").replace(/[\u0000-\u001f<>]/g,"").trim().slice(0,120); if(!text)return send(ws,{type:"gmActionResult",ok:false,message:"公告内容不能为空"});
      const notice={type:"gmNotice",name:ws.name,text,at:Date.now()}; for(const client of wss.clients)send(client,notice);
      const rec={at:new Date().toISOString(),by:ws.name,action:"announcement",target:text,room:"全服"};gmActionLog.push(rec);if(gmActionLog.length>200)gmActionLog.shift();
      return send(ws,{type:"gmActionResult",ok:true,message:"全服公告已发布"});
    }

    if (m.type === "gm_teleport") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const target=byPid.get(String(m.pid||"")); if(!target||target===ws) return send(ws,{type:"gmActionResult",ok:false,message:"目标玩家不在线或不能传送到自己"});
      const ent=target.room&&rooms.get(target.room)?.get(target.playerId); if(!ent||!ent.state) return send(ws,{type:"gmActionResult",ok:false,message:"目标玩家位置暂不可用"});
      send(ws,{type:"gmTeleport",room:target.room,state:ent.state,targetName:target.name});
      const audit={at:new Date().toISOString(),by:ws.name,action:"teleport_to",target:target.name,room:target.room};gmActionLog.push(audit);if(gmActionLog.length>200)gmActionLog.shift();
      return;
    }

    if (m.type === "join") {
      const room = String(m.room || "").trim();
      if (!room || room.length > 40) return send(ws, { type: "error", message: "Invalid room name" });
      if (roomCount(room) >= MAX_ROOM) return send(ws, { type: "error", message: "房间已满" });
      leaveRoom(ws);
      if (!rooms.has(room)) rooms.set(room, new Map());
      const players = rooms.get(room);
      if (!ws.authed) ws.name = cleanName(m.name);
      if (ws.authed && !ws.look && m.hasLocal) saveLook(ws, m.outfit, m.owned);   // 账号还没存过外观：把这台设备上的存上去
      ws.info = { name: ws.name, outfit: (ws.authed && ws.look) ? ws.look.outfit : cleanOutfit(m.outfit), pub: ws.pub, isGM: !!ws.isGM, cos: ws.cos || null };   // 账号里存过外观就以账号为准
      // 告诉新玩家：房间里已有的人
      for (const [pid, p] of players.entries()) {
        if (p.ws.gmInvisible && !ws.isGM) continue;
        send(ws, { type: "playerJoined", playerId: pid, info: p.info, state: p.state });
      }
      ws.room = room;
      players.set(ws.playerId, { ws, info: ws.info, state: null });
      if (!ws.gmInvisible) sendToRoom(room, { type: "playerJoined", playerId: ws.playerId, info: ws.info, state: null }, ws);
      send(ws, { type: "joined", room, playerId: ws.playerId });
      sendToRoom(room, { type: "count", n: players.size });
      const st = stages.get(room);
      send(ws, Object.assign({ type: "stage" }, st ? stageView(st) : { queue: [], cur: null, ts: Date.now() }));
      const t = teamOfWs(ws); if (t) { const mem = t.members.get(ws.pub); if (mem) mem.name = ws.name; teamSend(t); } // 队友能看到我在哪张地图
      presence(ws);
      return;
    }

    if (m.type === "outfit") {
      if (!ws.room) return;
      const p = rooms.get(ws.room)?.get(ws.playerId);
      if (!p) return;
      p.info = ws.info = { name: p.info.name, outfit: cleanOutfit(m.outfit), pub: ws.pub, isGM: !!ws.isGM, cos: ws.cos || null };
      saveLook(ws, m.outfit, m.owned);
      sendToRoom(ws.room, { type: "outfit", playerId: ws.playerId, outfit: p.info.outfit }, ws);
      return;
    }

    if (m.type === "state") {
      if (!ws.room) return;
      const p = rooms.get(ws.room)?.get(ws.playerId);
      if (!p) return;
      const st = cleanState(m.state);
      if (!st) return;
      p.state = st;
      if (!ws.gmInvisible) sendToRoom(ws.room, { type: "state", playerId: ws.playerId, state: st }, ws);
      return;
    }

    if (m.type === "chat") {
      const text = String(m.text || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
      if (!text) return;
      const ch = ["world", "team", "family"].includes(m.ch) ? m.ch : "world";
      let t = null;
      if (ch === "team") { t = teamOfWs(ws); if (!t) return send(ws, { type: "error", message: "你还没有队伍" }); }
      if (ch === "family" && !ws.room) return;
      const g = chatGate(ws, text);
      if (!g.ok) return send(ws, { type: "error", message: g.msg });
      ws.recent.push({ ch, text, at: Date.now() }); if (ws.recent.length > 6) ws.recent.shift();
      const msg = { type: "chat", playerId: ws.playerId, pub: ws.pub, name: ws.gmInvisible ? "玩家" : ws.name, isGM: !!ws.isGM && !ws.gmInvisible, ch, text: g.text };
      if (ch === "world") {
        for (const c of wss.clients) if (c !== ws && !isBlocked(ws, c)) send(c, msg); // 世界频道：所有在线玩家（拉黑的人看不到）
      } else if (ch === "team") {
        for (const c of teamMembersWs(t)) if (c !== ws && !isBlocked(ws, c)) send(c, msg); // 组队频道：只有队员，不分地图
      } else {
        sendToRoom(ws.room, msg, ws, ws); // 家族频道：同房间
      }
      return;
    }

    // ----- 组队 -----
    if (m.type === "team_invite") {
      const to = byPid.get(String(m.to));
      if (!to || to === ws) return;
      if (!ws.room || to.room !== ws.room) return send(ws, { type: "error", message: "对方不在这里了" });
      if (isBlocked(ws, to)) return send(ws, { type: "error", message: "无法邀请该玩家" });
      const mu = mutes.get(ws.pub); if (mu && mu > Date.now()) return send(ws, { type: "error", message: "禁言期间不能发邀请" });
      ws.invLog = (ws.invLog || []).filter((t) => Date.now() - t < 60000);
      if (ws.invLog.length >= 8) return send(ws, { type: "error", message: "邀请太频繁，请稍后再试" });
      const t = teamOfWs(ws);
      if (t && t.leader !== ws.pub) return send(ws, { type: "error", message: "只有队长可以邀请" });
      if (t && t.members.size >= MAX_TEAM) return send(ws, { type: "error", message: "队伍已满（最多 " + MAX_TEAM + " 人）" });
      if (teamOfWs(to)) return send(ws, { type: "error", message: "对方已经在别的队伍里" });
      ws.invLog.push(Date.now());
      const id = crypto.randomBytes(6).toString("hex");
      invites.set(id, { from: ws.playerId, to: to.playerId, at: Date.now() });
      send(to, { type: "team_invited", inv: id, from: ws.playerId, name: ws.name, size: t ? t.members.size : 1 });
      send(ws, { type: "team_sent", name: to.name });
      return;
    }
    if (m.type === "team_accept" || m.type === "team_decline") {
      const inv = invites.get(String(m.inv));
      if (!inv || inv.to !== ws.playerId) return send(ws, { type: "error", message: "邀请已过期" });
      invites.delete(String(m.inv));
      const from = byPid.get(inv.from);
      if (m.type === "team_decline") { if (from) send(from, { type: "team_msg", text: ws.name + " 拒绝了组队邀请" }); return; }
      if (!from) return send(ws, { type: "error", message: "邀请人已离线" });
      if (isBlocked(ws, from)) return;
      if (teamOfWs(ws)) return send(ws, { type: "error", message: "你已经在队伍里了" });
      let t = teamOfWs(from);
      if (t && (t.leader !== from.pub || t.members.size >= MAX_TEAM)) return send(ws, { type: "error", message: "队伍已满或邀请失效" });
      if (!t) t = teamNew(from);
      teamAdd(t, ws);
      teamSend(t);
      for (const c of teamMembersWs(t)) send(c, { type: "team_msg", text: "🎉 " + ws.name + " 加入了队伍" });
      return;
    }
    if (m.type === "team_leave") {
      const t = teamOfWs(ws); if (!t) return;
      const name = ws.name;
      teamRemove(t, ws.pub, "你已离开队伍");
      if (teams.has(t.id)) for (const c of teamMembersWs(t)) send(c, { type: "team_msg", text: name + " 离开了队伍" });
      return;
    }
    if (m.type === "team_kick") {
      const t = teamOfWs(ws); if (!t || t.leader !== ws.pub) return;
      const pub = String(m.pub || ""); if (pub === ws.pub || !t.members.has(pub)) return;
      t.banned.add(pub);
      teamRemove(t, pub, "你被队长移出了队伍");
      return;
    }
    if (m.type === "team_voice") { // 队员把自己的麦克风 / 喇叭开关状态报给队伍（队伍面板里每个人都能看到）
      ws.vMic = !!m.mic; ws.vSpk = m.spk !== false;
      const t = teamOfWs(ws); if (t) teamSend(t);
      return;
    }
    if (m.type === "team_transfer") { // 队长转移队长
      const t = teamOfWs(ws); if (!t || t.leader !== ws.pub) return send(ws, { type: "error", message: "只有队长可以转移队长" });
      const pub = String(m.pub || ""), tm = t.members.get(pub); if (!tm || pub === ws.pub) return;
      t.leader = pub; teamSend(t);
      for (const c of teamMembersWs(t)) send(c, { type: "team_msg", text: "👑 " + tm.name + " 成为了新队长" });
      return;
    }

    // ----- 资料 / 好友 / 私信（需要登录）-----
    if (/^(profile_|name_set|name_check|name_first|friends?_|dm_|care$|bond_|wallet_|sign_in$|shop_|gift_)/.test(m.type)) {   // 问暖 / 钱包 / 签到 / 商店 / 礼物 的消息也要走这里（以前漏了，所以点了没反应）
      if (!S) throw UE("社交功能暂未开启");
      if (!ws.authed) throw UE("请先登录：点左上角「我」→ 账号");
      const pubArg = () => { const p = String(m.pub || "").slice(0, 16); if (!/^[0-9a-f]{16}$/.test(p)) throw UE("参数不对"); return p; };
      if (m.type === "profile_get") { const pub = m.pub ? pubArg() : ws.pub; return send(ws, { type: "profile", pub, profile: await S.viewProfile(ws.pub, pub) }); }
      if (m.type === "profile_set") { const p = await S.setProfile(ws.pub, m); return send(ws, { type: "me_profile", profile: S.publicMe(p), acct: ws.acct, saved: true }); }
      if (m.type === "name_check" || m.type === "name_first") { // 新账号取名：先查名字能不能用；点完成时当场占下
        const op = m.type === "name_check" ? "check" : "first";
        if (op === "check") { const now = Date.now(); if (now - (ws.ncAt || 0) < 300) return; ws.ncAt = now; }
        try {
          if (op === "check") return send(ws, { type: "name_result", op, ok: true, name: await S.nameFree(ws.pub, m.name), q: m.q });
          const p = await S.setFirstName(ws.pub, m.name); ws.name = p.name;
          if (ws.info) ws.info.name = p.name; const pl = ws.room && rooms.get(ws.room)?.get(ws.playerId); if (pl) pl.info.name = p.name;
          if (ws.room) sendToRoom(ws.room, { type: "rename", playerId: ws.playerId, name: p.name }, ws);
          const t = teamOfWs(ws); if (t) { const mem = t.members.get(ws.pub); if (mem) mem.name = p.name; teamSend(t); }
          presence(ws); send(ws, { type: "me_profile", profile: S.publicMe(p), acct: ws.acct });
          return send(ws, { type: "name_result", op, ok: true, name: p.name, q: m.q });
        } catch (e) { if (e && e.user) return send(ws, { type: "name_result", op, ok: false, reason: e.message, q: m.q }); throw e; }
      }
      if (m.type === "name_set") {
        const p = await S.setName(ws.pub, m.name); ws.name = p.name;
        if (ws.info) ws.info.name = p.name; const pl = ws.room && rooms.get(ws.room)?.get(ws.playerId); if (pl) pl.info.name = p.name;
        if (ws.room) sendToRoom(ws.room, { type: "rename", playerId: ws.playerId, name: p.name }, ws);
        const t = teamOfWs(ws); if (t) { const mem = t.members.get(ws.pub); if (mem) mem.name = p.name; teamSend(t); }
        presence(ws); return send(ws, { type: "me_profile", profile: S.publicMe(p), acct: ws.acct, saved: true, renamed: true });
      }
      if (m.type === "friends_get") { const v = await S.friendsView(ws.pub); ws.friendSet = new Set(v.friends.map((f) => f.pub)); return send(ws, Object.assign({ type: "friends" }, await withBonds(ws.pub, withPresence(v)))); }
      if (m.type === "friend_request") {
        const to = pubArg(), r = await S.request(ws.pub, to), tw = byPubWs.get(to);
        if (r.auto) { send(ws, { type: "toast", message: "你们已成为好友 🎉" }); if (tw) send(tw, { type: "toast", message: ws.name + " 和你成为了好友 🎉" }); }
        else { send(ws, { type: "toast", message: "已发送好友申请" }); if (tw) send(tw, { type: "friend_req", pub: ws.pub, name: ws.name }); }
        await pushFriends(ws.pub); await pushFriends(to); return;
      }
      if (m.type === "friend_accept") { const from = pubArg(); await S.accept(ws.pub, from); const fw = byPubWs.get(from); send(ws, { type: "toast", message: "已添加好友 🎉" }); if (fw) send(fw, { type: "toast", message: ws.name + " 同意了你的好友申请 🎉" }); await pushFriends(ws.pub); await pushFriends(from); presence(ws); return; }
      if (m.type === "friend_decline") { const from = pubArg(); await S.decline(ws.pub, from); await pushFriends(ws.pub); await pushFriends(from); return; }
      if (m.type === "friend_remove") { const o = pubArg(); await S.unfriend(ws.pub, o); await pushFriends(ws.pub); await pushFriends(o); return; }
      if (m.type === "dm_send") {
        const to = pubArg(), text = String(m.text || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200);
        if (!text) return;
        const tw = byPubWs.get(to); if (tw && isBlocked(ws, tw)) throw UE("对方没有收到这条消息");
        const g = chatGate(ws, text); if (!g.ok) throw UE(g.msg);
        const r = await S.sendDm(ws.pub, to, g.text);
        send(ws, { type: "dm", pub: to, mine: true, text: g.text, at: r.at });
        if (tw) send(tw, { type: "dm", pub: ws.pub, name: ws.name, mine: false, text: g.text, at: r.at });
        bondGain(ws.pub, to, "dm", 1);
        return;
      }
      /* ---------- 钱包 / 签到 / 商店 / 礼物（需要登录） ---------- */
      if (m.type === "wallet_get" || m.type === "wallet_delta" || m.type === "sign_in" || m.type === "shop_buy" || m.type === "shop_equip" || m.type === "gift_send") {
        if (!W || !ws.authed) { if (m.type !== "wallet_get" && m.type !== "wallet_delta") throw UE("请先登录账号"); return; }
        const sendWallet = async (extra) => send(ws, Object.assign({ type: "wallet" }, await W.view(ws.pub), extra || {}));
        if (m.type === "wallet_get") return sendWallet();
        if (m.type === "wallet_delta") { const r = await W.apply(ws.pub, m.delta); return sendWallet(r.ok ? (r.capped ? { note: "earn_cap" } : {}) : { note: r.reason || "rejected" }); }
        if (m.type === "sign_in") {
          const r = await W.signIn(ws.pub);
          if (r.done) { send(ws, { type: "toast", message: "今天已经签到过了，明天再来 📅" }); return sendWallet(); }
          send(ws, { type: "sign_ok", reward: r.reward, streak: r.streak }); return sendWallet();
        }
        if (m.type === "shop_buy") {
          let it; try { it = await W.buy(ws.pub, String(m.id || "")); } catch (e) { throw UE(e.message); }
          send(ws, { type: "shop_ok", id: it.id, name: it.name }); return sendWallet();
        }
        if (m.type === "shop_equip") {
          let eq; try { eq = await W.equip(ws.pub, String(m.slot || ""), m.id ? String(m.id) : null); } catch (e) { throw UE(e.message); }
          ws.cos = eq; if (ws.info) ws.info.cos = eq;
          if (ws.room && !ws.gmInvisible) sendToRoom(ws.room, { type: "cos", playerId: ws.playerId, cos: eq }, ws);
          return sendWallet();
        }
        if (m.type === "gift_send") {
          const to = pubArg(); if (to === ws.pub) throw UE("不能送给自己");
          const tw = byPubWs.get(to); if (!tw) throw UE("对方现在不在线");
          if (isBlocked(ws, tw)) throw UE("送不出去");
          const gid = String(m.gift || ""); if (!SD.giftById[gid]) throw UE("没有这个礼物");
          const nowT = Date.now(); if (ws.giftT && nowT - ws.giftT < 400) throw UE("送得太快啦"); ws.giftT = nowT;
          let g; try { g = await W.gift(ws.pub, to, gid); } catch (e) { throw UE(e.message); }
          const fx = { type: "gift_fx", gift: g.id, fromPid: ws.playerId, fromName: ws.name, toPid: tw.playerId, toName: tw.name };
          if (ws.room) sendToRoom(ws.room, fx); else send(ws, fx);
          if (tw.room !== ws.room) send(tw, fx);
          send(tw, { type: "toast", message: "🎁 " + ws.name + " 送了你 " + g.icon + g.name });
          if (ws.friendSet && ws.friendSet.has(to)) {
            bondGain(ws.pub, to, "gift", Math.max(1, Math.round(g.price / 5)));   // 送给好友：亲密度 = 价格 ÷ 5
            try { // 在私信里提示对方（只有好友之间能发私信）
              const text = "🎁 送了你 " + g.icon + g.name, sr = await S.sendDm(ws.pub, to, text);
              send(ws, { type: "dm", pub: to, mine: true, text, at: sr.at });
              send(tw, { type: "dm", pub: ws.pub, name: ws.name, mine: false, text, at: sr.at });
            } catch (e) { /* 对方拉黑了你等情况：私信发不出，不影响送礼 */ }
          }
          return sendWallet();
        }
        return;
      }
      if (m.type === "bond_detail") { // 互动面板：和某个好友的亲密度任务进度
        if (!B) throw UE("暂时不能查看互动");
        const to = pubArg(), f = await S.getF(ws.pub); if (!f.friends.includes(to)) throw UE("需要先成为好友");
        return send(ws, Object.assign({ type: "bond_detail", pub: to }, await B.detail(ws.pub, to)));
      }
      if (m.type === "care") { // 每日问暖：给好友发一句问候，双方亲密度增加；每人每天对每个好友一次
        if (!B) throw UE("暂时不能问暖");
        const to = pubArg(), f = await S.getF(ws.pub); if (!f.friends.includes(to)) throw UE("需要先成为好友");
        if ((await B.careStatus(ws.pub, to)).done) return send(ws, { type: "toast", message: "今天已经问暖过 TA 了，明天再来 💌" });
        const text = B.greeting(), tw = byPubWs.get(to);
        if (tw && isBlocked(ws, tw)) throw UE("对方没有收到这条消息");
        const sr = await S.sendDm(ws.pub, to, text);   // 对方拉黑了你的话这里会报错，不会加亲密度
        send(ws, { type: "dm", pub: to, mine: true, text, at: sr.at });
        if (tw) send(tw, { type: "dm", pub: ws.pub, name: ws.name, mine: false, text, at: sr.at });
        const r = await B.care(ws.pub, to);
        send(ws, { type: "care_ok", pub: to, gained: r.gained, streak: r.streak });
        bondNotify(ws.pub, to, r);
        return;
      }
      if (m.type === "dm_history") { const o = pubArg(); return send(ws, { type: "dm_history", pub: o, msgs: await S.dmHistory(ws.pub, o, 50) }); }
      if (m.type === "dm_read") { await S.dmRead(ws.pub, pubArg()); return; }
      return;
    }

    // ----- 举报 -----
    if (m.type === "report") {
      let target = byPid.get(String(m.pid)); const tpub = target ? target.pub : String(m.pub || "").slice(0, 16);
      if (!target && !(/^[0-9a-f]{16}$/.test(tpub) && S && ws.authed)) return;
      if (target === ws || tpub === ws.pub) return;
      const reason = ["harass", "porn", "ad", "other"].includes(m.reason) ? m.reason : "other";
      const nowT = Date.now();
      ws.repLog = (ws.repLog || []).filter((t) => nowT - t < 3600000);
      if (ws.repLog.length >= 10) return send(ws, { type: "error", message: "举报太频繁，请稍后再试" });
      const list = (reportsOn.get(tpub) || []).filter((r) => nowT - r.at < 30 * 60000);
      if (list.some((r) => r.by === ws.pub)) return send(ws, { type: "toast", message: "你已经举报过这位玩家了，我们会处理" });
      ws.repLog.push(nowT); list.push({ by: ws.pub, at: nowT }); reportsOn.set(tpub, list);
      const tname = target ? target.name : ((await S.getProfile(tpub)) || {}).name || "玩家";
      const recent = target ? target.recent.slice(-5) : await S.dmEvidence(tpub, ws.pub, 5);
      const rec = { at: new Date(nowT).toISOString(), reporter: ws.pub, reporterName: ws.name, target: tpub, targetName: tname, reason, room: target ? target.room : null, recent };
      reportLog.push(rec); if (reportLog.length > 300) reportLog.shift();
      persistReport(rec);
      const distinct = new Set(list.map((r) => r.by)).size;
      if (distinct >= REPORT_MUTE_N && !(target && target.isGM)) {
        mutes.set(tpub, nowT + MUTE_MS);
        if (target) send(target, { type: "error", message: "你被多名玩家举报，已被临时禁言 15 分钟" });
        console.log("AUTO-MUTE", tpub, tname, "reports=" + distinct);
      }
      send(ws, { type: "toast", message: "已收到举报，谢谢你。你也可以直接拉黑对方" });
      return;
    }

    // ----- 舞台队列 -----
    if (m.type === "stage_join") {
      if (!ws.room) return;
      const song = String(m.song || "").slice(0, 40);
      const info = SongData ? SongData.byName[song] : null;
      if (SongData && !info) return send(ws, { type: "error", message: "没有这首歌" });
      const dur = info ? info.dur : Math.max(20, Math.min(600, Math.round(num(m.dur, 120))));
      const mu = mutes.get(ws.pub); if (mu && mu > Date.now()) return send(ws, { type: "error", message: "禁言期间不能上台" });
      let s = stages.get(ws.room); if (!s) { s = { queue: [], cur: null }; stages.set(ws.room, s); }
      if ((s.cur && s.cur.pid === ws.playerId) || s.queue.some((q) => q.pid === ws.playerId)) return send(ws, { type: "error", message: "你已经点过歌啦" });
      if (s.queue.length >= 8) return send(ws, { type: "error", message: "排队的人太多了，稍后再点" });
      s.queue.push({ pid: ws.playerId, name: ws.name, song, artist: info ? info.artist : "", dur });
      stageAfter(ws.room, s);
      return;
    }
    if (m.type === "stage_leave" || m.type === "stage_done" || m.type === "stage_arrived") {
      const s = ws.room && stages.get(ws.room); if (!s) return;
      if (m.type === "stage_arrived") {
        if (s.cur && s.cur.pid === ws.playerId && s.cur.phase === "wait") { s.cur.phase = "sing"; s.cur.end = Date.now() + s.cur.dur * 1000; stageSend(ws.room, s); }
        return;
      }
      if (m.type === "stage_done" && !(s.cur && s.cur.pid === ws.playerId && s.cur.phase === "sing")) return;
      stageDrop(ws, ws.room);
      return;
    }

    // WebRTC 信令：K 歌语音只在同房间转发；队伍语音（role = team）在队友之间转发，不分地图
    if (m.type === "rtc") {
      const mu = mutes.get(ws.pub);
      if (mu && mu > Date.now() && m.kind === "offer") return;
      if (m.role === "team") {
        const t = teamOfWs(ws); const target = byPid.get(String(m.to));
        if (!t || !target || teamOfWs(target) !== t || isBlocked(ws, target)) return;
        send(target, { type: "rtc", from: ws.playerId, kind: m.kind, role: "team", data: m.data });
        return;
      }
      if (!ws.room) return;
      const target = rooms.get(ws.room)?.get(String(m.to));
      if (!target || isBlocked(ws, target.ws)) return;
      send(target.ws, { type: "rtc", from: ws.playerId, kind: m.kind, role: m.role, data: m.data });
      return;
    }

    // K歌同步（伴奏进度）：广播给同房间的人（拉黑的人收不到）
    if (m.type === "karaoke") {
      if (!ws.room) return;
      sendToRoom(ws.room, {
        type: "karaoke", from: ws.playerId, action: m.action,
        song: String(m.song || "").slice(0, 40), pos: num(m.pos), ts: num(m.ts),
      }, ws, ws);
      return;
    }
  };

  // 同一个连接的消息按顺序处理（hello 要先于 join 处理完）
  ws.on("message", (raw) => { ws.q = ws.q.then(() => onMessage(raw)).catch((e) => { if (e && e.user) send(ws, { type: "error", message: e.message }); else console.error("handler error:", e); }); });
  ws.on("close", () => onClose(ws));
  ws.on("error", () => onClose(ws));
});

function leaveRoom(ws) {
  if (!ws.room || !ws.playerId) return;
  const room = ws.room, playerId = ws.playerId;
  const players = rooms.get(room);
  stageDrop(ws, room);
  ws.room = null;
  if (players) {
    players.delete(playerId);
    sendToRoom(room, { type: "playerLeft", playerId });
    if (players.size === 0) rooms.delete(room);
    else sendToRoom(room, { type: "count", n: players.size });
  }
}
function kickDup(ws) { // 顶号：同一个账号再连上来，立刻把旧连接踢掉并清掉旧人物（刷新 / 两个标签页 / 两台设备都不会出现两个一样的人）
  for (const c of [...wss.clients]) {
    if (c === ws || c.closed || !c.authed || c.pub !== ws.pub) continue;
    console.log("KICK", myTime(), JSON.stringify(c.name || ""), "pub=" + c.pub, "旧连接被新登录顶掉");
    c.kicked = true; send(c, { type: "kicked", reason: "这个账号在别处登录了" });
    onClose(c);                                                    // 马上清掉旧人物 / 舞台排队 / 在线状态
    try { c.close(4001, "dup"); } catch {}
    setTimeout(() => { try { c.terminate(); } catch {} }, 2000);   // 给它 2 秒把「被顶号」的消息发出去
  }
}
function onClose(ws) {
  if (ws.closed) return; ws.closed = true;
  if (ws.joinAt) { const mins = Math.max(0, Math.round((Date.now() - ws.joinAt) / 60000)); console.log("LEAVE", myTime(), JSON.stringify(ws.name || ""), "pub=" + ws.pub, "stayed=" + mins + "min", "online=" + Math.max(0, wss.clients.size - 1)); }
  leaveRoom(ws);
  byPid.delete(ws.playerId);
  if (ws.authed && byPubWs.get(ws.pub) === ws) { byPubWs.delete(ws.pub); presence(ws); }
  const t = teamOfWs(ws);
  if (t) { const m = t.members.get(ws.pub); if (m && m.pid === ws.playerId) { m.pid = null; m.offlineAt = Date.now(); teamSend(t); } }
  pushOnline();
}

// 心跳：清理死连接，同时让 Render 认为服务有流量
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 12000);   // 12 秒检查一次：没回应的残留连接最多 24 秒内清掉（以前 25 秒一轮，最长 50 秒）

loadCfg().finally(() => {
  httpServer.listen(PORT, "0.0.0.0", () => console.log("Multiplayer server listening on port " + PORT));
});
