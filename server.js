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
const UE = (m) => { const e = new Error(m); e.user = true; return e; };
const byPubWs = new Map(); // pub -> 当前在线的连接（登录用户）

// ---------- 基础 ----------
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("STAR PLAZA multiplayer server is running. online=" + wss.clients.size);
});

const wss = new WebSocket.Server({ server: httpServer, maxPayload: 64 * 1024 });
const rooms = new Map(); // room -> Map(playerId -> {ws, info, state})
const byPid = new Map(); // playerId -> ws
const mutes = new Map(); // pub -> 禁言到期时间
const reportLog = []; // 最近的举报记录（内存里留 300 条）
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
function reservedName(s) {
  const n = String(s || "").normalize("NFKC").toLowerCase().replace(/[\s\u200b-\u200f\u202a-\u202e._-]/g, "");
  return n === "gm" || n.includes("管理员") || n.includes("官方") || n.includes("管理員");
}
function cleanName(s, allowReserved = false) {
  s = String(s || "").normalize("NFKC").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 12);
  if (!s) return "玩家";
  const f = filterText(s);
  return f.hit || (!allowReserved && reservedName(s)) ? "玩家" : s;
}
function cleanOutfit(o) {
  if (!o || typeof o !== "object") return {};
  const out = {};
  for (const k of ["hair", "top", "bottom", "socks", "shoes"]) {
    out[k] = typeof o[k] === "string" && /^#[0-9a-fA-F]{6}$/.test(o[k]) ? o[k] : null;
  }
  out.bottomType = o.bottomType === "skirt" ? "skirt" : "shorts";
  out.choker = o.choker !== false;
  out.skin = Math.max(0, Math.min(3, parseInt(o.skin) || 0));
  out.scale = Math.max(0.85, Math.min(1.15, Number(o.scale) || 1));
  return out;
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
async function pushFriends(pub) { // 把最新的好友列表推给在线的人
  const w = byPubWs.get(pub); if (!w || !S) return;
  const v = await S.friendsView(pub); w.friendSet = new Set(v.friends.map((f) => f.pub)); send(w, Object.assign({ type: "friends" }, withPresence(v)));
}
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
// teams: id -> { id, leader(pub), members: Map(pub -> {pub, name, pid|null, offlineAt|null}), banned: Set(pub) }
const teams = new Map();
const teamOf = new Map(); // pub -> teamId
const invites = new Map(); // invId -> { from: pid, to: pid, at }

function teamView(t) {
  return {
    id: t.id, leader: t.leader,
    members: [...t.members.values()].map((m) => {
      const c = m.pid ? byPid.get(m.pid) : null;
      return { pub: m.pub, name: m.name, pid: c ? m.pid : null, room: c ? c.room : null, online: !!c };
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
  if (ws.isGM) { const f = filterText(raw); return f.text.replace(/[\s*]/g, "") ? { ok: true, text: f.text, hit: f.hit } : { ok: false, msg: "消息包含不允许的内容" }; }
  const mu = Math.max(Number(ws.gmMuteUntil) || 0, Number(ws.pub && mutes.get(ws.pub)) || 0);
  if (mu && mu > now) return { ok: false, msg: "你被多人举报，已被临时禁言，还剩 " + Math.ceil((mu - now) / 60000) + " 分钟" };
  if (ws.chatCool && now < ws.chatCool) return { ok: false, msg: "发言太频繁，请稍后再试" };
  ws.chatLog = (ws.chatLog || []).filter((t) => now - t < 10000);
  if (ws.chatLog.length && now - ws.chatLog[ws.chatLog.length - 1] < 1000) return { ok: false, msg: "发言太快啦，慢一点" };
  if (ws.chatLog.length >= 6) { ws.chatCool = now + 8000; return { ok: false, msg: "发言太频繁，请 8 秒后再试" }; }
  const norm = raw.replace(/\s+/g, "").toLowerCase();
  if (ws.lastChat && ws.lastChat.t === norm && now - ws.lastChat.at < 15000) return { ok: false, msg: "请不要重复发送相同内容" };
  const f = filterText(raw);
  if (!f.text.replace(/[\s*]/g, "")) return { ok: false, msg: "消息包含不允许的内容" };
  ws.chatLog.push(now); ws.lastChat = { t: norm, at: now };
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
        try { const a = await AUTH.verify(m.token); ws.fuid = a.uid; ws.pub = pubOf("fb:" + a.uid); ws.authed = true; ws.acct = { anon: a.anon, email: a.email }; }
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
        } catch (e) { console.error("account load failed:", e.message); ws.authed = false; ws.name = cleanName(m.name); ws.blocks = new Set(); send(ws, { type: "auth_fail", message: "账号服务暂时不可用，已作为游客进入" }); }
      }
      send(ws, { type: "hello_ok", pub: ws.pub, authed: !!ws.authed });
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
        if (ws.info) { ws.info.isGM = true; if (ws.room) sendToRoom(ws.room, { type: "rename", playerId: ws.playerId, name: ws.name, isGM: true }, ws); }
        return send(ws, { type: "gmOk" });
      }
      gmFailTimes.push(now2);
      ws.gmFails = (ws.gmFails || 0) + 1;
      if (ws.gmFails >= 5) { ws.gmFails = 0; ws.gmBlockUntil = now2 + 60 * 1000; }
      return send(ws, { type: "gmFail", message: "密钥不对" });
    }

    // GM 管理：仅当前通过口令验证的 WebSocket 连接可执行；目标由服务器按玩家 ID 查找。
    if (m.type === "gm_moderate") {
      if (!ws.isGM) return send(ws, { type: "gmError", code: "auth", message: "没有 GM 权限，请重新登录" });
      const target = byPid.get(String(m.pid || ""));
      if (!target || target === ws) return send(ws, { type: "gmError", message: "目标玩家不存在或不能对自己操作" });
      const action = String(m.action || "");
      if (action === "mute") { target.gmMuteUntil = Date.now() + 15 * 60 * 1000; if (target.pub) mutes.set(target.pub, target.gmMuteUntil); send(target, { type: "error", message: "GM 已将你禁言 15 分钟" }); }
      else if (action === "unmute") { target.gmMuteUntil = 0; if (target.pub) mutes.delete(target.pub); send(target, { type: "toast", message: "GM 已解除你的禁言" }); }
      else if (action === "kick") { send(target, { type: "error", message: "你已被 GM 请离游戏" }); try { target.close(4001, "GM kick"); } catch (_) {} }
      else return send(ws, { type: "gmError", message: "未知管理操作" });
      send(ws, { type: "gmModerated", action, name: target.name }); return;
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
      return send(ws, { type: "gmReports", list: reportLog.slice(-50) });
    }

    if (m.type === "join") {
      const room = String(m.room || "").trim();
      if (!room || room.length > 40) return send(ws, { type: "error", message: "Invalid room name" });
      if (roomCount(room) >= MAX_ROOM) return send(ws, { type: "error", message: "房间已满" });
      leaveRoom(ws);
      if (!rooms.has(room)) rooms.set(room, new Map());
      const players = rooms.get(room);
      if (!ws.authed) ws.name = cleanName(m.name);
      ws.info = { name: ws.name, outfit: cleanOutfit(m.outfit), pub: ws.pub, isGM: !!ws.isGM };
      // 告诉新玩家：房间里已有的人
      for (const [pid, p] of players.entries()) {
        send(ws, { type: "playerJoined", playerId: pid, info: p.info, state: p.state });
      }
      ws.room = room;
      players.set(ws.playerId, { ws, info: ws.info, state: null });
      sendToRoom(room, { type: "playerJoined", playerId: ws.playerId, info: ws.info, state: null }, ws);
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
      p.info = ws.info = { name: p.info.name, outfit: cleanOutfit(m.outfit), pub: ws.pub };
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
      sendToRoom(ws.room, { type: "state", playerId: ws.playerId, state: st }, ws);
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
      const msg = { type: "chat", playerId: ws.playerId, pub: ws.pub, name: ws.name, isGM: !!ws.isGM, ch, text: g.text };
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

    // ----- 资料 / 好友 / 私信（需要登录）-----
    if (/^(profile_|name_set|friends?_|dm_)/.test(m.type)) {
      if (!S) throw UE("社交功能暂未开启");
      if (!ws.authed) throw UE("请先登录：点左上角「我」→ 账号");
      const pubArg = () => { const p = String(m.pub || "").slice(0, 16); if (!/^[0-9a-f]{16}$/.test(p)) throw UE("参数不对"); return p; };
      if (m.type === "profile_get") { const pub = m.pub ? pubArg() : ws.pub; return send(ws, { type: "profile", pub, profile: await S.viewProfile(ws.pub, pub) }); }
      if (m.type === "profile_set") { const p = await S.setProfile(ws.pub, m); return send(ws, { type: "me_profile", profile: S.publicMe(p), acct: ws.acct, saved: true }); }
      if (m.type === "name_set") {
        const p = await S.setName(ws.pub, m.name, !!ws.isGM); ws.name = p.name;
        if (ws.info) { ws.info.name = p.name; ws.info.isGM = !!ws.isGM; } const pl = ws.room && rooms.get(ws.room)?.get(ws.playerId); if (pl) { pl.info.name = p.name; pl.info.isGM = !!ws.isGM; }
        if (ws.room) sendToRoom(ws.room, { type: "rename", playerId: ws.playerId, name: p.name, isGM: !!ws.isGM }, ws);
        const t = teamOfWs(ws); if (t) { const mem = t.members.get(ws.pub); if (mem) mem.name = p.name; teamSend(t); }
        presence(ws); return send(ws, { type: "me_profile", profile: S.publicMe(p), acct: ws.acct, saved: true, renamed: true });
      }
      if (m.type === "friends_get") { const v = await S.friendsView(ws.pub); ws.friendSet = new Set(v.friends.map((f) => f.pub)); return send(ws, Object.assign({ type: "friends" }, withPresence(v))); }
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
function onClose(ws) {
  if (ws.closed) return; ws.closed = true;
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
}, 25000);

loadCfg().finally(() => {
  httpServer.listen(PORT, "0.0.0.0", () => console.log("Multiplayer server listening on port " + PORT));
});
