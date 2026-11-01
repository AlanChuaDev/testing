// STAR PLAZA 联机服务器：房间同步 + 聊天 + WebRTC 语音信令 + K歌同步
// 部署在 Render（Web Service）：Build = npm install，Start = node server.js
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const MAX_ROOM = 40; // 每个房间最多人数

// ---------- GM：歌词 / 歌曲延迟校准（保存后全服更新）----------
// 环境变量（Render → Environment）：
//   GM_KEY                      GM 密钥（必填；没设置就完全禁用 GM）
//   UPSTASH_REDIS_REST_URL      可选：Upstash Redis 地址（设置后配置永久保存，重启不丢）
//   UPSTASH_REDIS_REST_TOKEN    可选：Upstash Redis 令牌
// 没配 Upstash 时只存在本机文件里：Render 免费版休眠/重启后会丢，需要重新保存。
const GM_KEY = process.env.GM_KEY || "";
const UP_URL = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, "");
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const CFG_KEY = "starplaza:songcfg";
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

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("STAR PLAZA multiplayer server is running. online=" + wss.clients.size);
});

const wss = new WebSocket.Server({ server: httpServer, maxPayload: 64 * 1024 });
const rooms = new Map(); // room -> Map(playerId -> {ws, info, state})

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function sendToRoom(room, data, except = null) {
  const players = rooms.get(room);
  if (!players) return;
  for (const p of players.values()) if (p.ws !== except) send(p.ws, data);
}
function roomCount(room) {
  const r = rooms.get(room);
  return r ? r.size : 0;
}
function cleanName(s) {
  s = String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim();
  return s.slice(0, 12) || "玩家";
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

function leaveRoom(ws) {
  if (!ws.room || !ws.playerId) return;
  const room = ws.room, playerId = ws.playerId;
  const players = rooms.get(room);
  ws.room = null;
  if (players) {
    players.delete(playerId);
    sendToRoom(room, { type: "playerLeft", playerId });
    if (players.size === 0) rooms.delete(room);
    else sendToRoom(room, { type: "count", n: players.size });
  }
}

wss.on("connection", (ws) => {
  ws.playerId = crypto.randomUUID();
  ws.room = null;
  ws.isAlive = true;
  ws.msgCount = 0;
  ws.msgWindow = Date.now();
  ws.on("pong", () => { ws.isAlive = true; });

  send(ws, { type: "connected", playerId: ws.playerId });
  send(ws, { type: "songcfg", cfg: songCfg }); // 新玩家一连上就拿到 GM 保存的歌词 / 延迟

  ws.on("message", (raw) => {
    // 简单限速：每秒最多 60 条
    const now = Date.now();
    if (now - ws.msgWindow > 1000) { ws.msgWindow = now; ws.msgCount = 0; }
    if (++ws.msgCount > 60) return;

    let m;
    try { m = JSON.parse(raw.toString()); } catch { return send(ws, { type: "error", message: "Invalid JSON" }); }
    if (!m || typeof m.type !== "string") return;

    if (m.type === "ping") return send(ws, { type: "pong", t: m.t, ts: Date.now() });

    // GM 登录：密钥只在服务器端比对，客户端代码里没有
    if (m.type === "gm_login") {
      if (!GM_KEY) return send(ws, { type: "gmFail", message: "服务器没有设置 GM_KEY，GM 功能未启用" });
      const now2 = Date.now();
      gmFailTimes = gmFailTimes.filter((t) => now2 - t < 10 * 60 * 1000);
      if (gmFailTimes.length >= 20 || (ws.gmBlockUntil && now2 < ws.gmBlockUntil)) {
        return send(ws, { type: "gmFail", message: "尝试次数太多，请稍后再试" });
      }
      if (safeEq(m.key || "", GM_KEY)) { ws.isGM = true; ws.gmFails = 0; return send(ws, { type: "gmOk" }); }
      gmFailTimes.push(now2);
      ws.gmFails = (ws.gmFails || 0) + 1;
      if (ws.gmFails >= 5) { ws.gmFails = 0; ws.gmBlockUntil = now2 + 60 * 1000; }
      return send(ws, { type: "gmFail", message: "密钥不对" });
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

    if (m.type === "join") {
      const room = String(m.room || "").trim();
      if (!room || room.length > 40) return send(ws, { type: "error", message: "Invalid room name" });
      if (roomCount(room) >= MAX_ROOM) return send(ws, { type: "error", message: "房间已满" });
      leaveRoom(ws);
      if (!rooms.has(room)) rooms.set(room, new Map());
      const players = rooms.get(room);
      ws.info = { name: cleanName(m.name), outfit: cleanOutfit(m.outfit) };
      // 告诉新玩家：房间里已有的人
      for (const [pid, p] of players.entries()) {
        send(ws, { type: "playerJoined", playerId: pid, info: p.info, state: p.state });
      }
      ws.room = room;
      players.set(ws.playerId, { ws, info: ws.info, state: null });
      sendToRoom(room, { type: "playerJoined", playerId: ws.playerId, info: ws.info, state: null }, ws);
      send(ws, { type: "joined", room, playerId: ws.playerId });
      sendToRoom(room, { type: "count", n: players.size });
      return;
    }

    if (m.type === "outfit") {
      if (!ws.room) return;
      const p = rooms.get(ws.room)?.get(ws.playerId);
      if (!p) return;
      p.info = ws.info = { name: p.info.name, outfit: cleanOutfit(m.outfit) };
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
      const text = String(m.text || "").replace(/[\u0000-\u001f]/g, "").slice(0, 80);
      if (!text) return;
      const ch = ["world", "team", "family"].includes(m.ch) ? m.ch : "world";
      const msg = { type: "chat", playerId: ws.playerId, name: ws.info ? ws.info.name : "玩家", ch, text };
      if (ch === "world") {
        for (const c of wss.clients) if (c !== ws) send(c, msg); // 世界频道：所有在线玩家
      } else if (ws.room) {
        sendToRoom(ws.room, msg, ws); // 其他频道：同房间
      }
      return;
    }

    // WebRTC 信令：只在同房间内点对点转发
    if (m.type === "rtc") {
      if (!ws.room) return;
      const target = rooms.get(ws.room)?.get(String(m.to));
      if (!target) return;
      send(target.ws, { type: "rtc", from: ws.playerId, kind: m.kind, role: m.role, data: m.data });
      return;
    }

    // K歌同步（伴奏进度）：广播给同房间的人
    if (m.type === "karaoke") {
      if (!ws.room) return;
      sendToRoom(ws.room, {
        type: "karaoke", from: ws.playerId, action: m.action,
        song: String(m.song || "").slice(0, 40), pos: num(m.pos), ts: num(m.ts),
      }, ws);
      return;
    }
  });

  ws.on("close", () => leaveRoom(ws));
  ws.on("error", () => leaveRoom(ws));
});

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
