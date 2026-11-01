// STAR PLAZA 联机服务器：房间同步 + 聊天 + WebRTC 语音信令 + K歌同步
// 部署在 Render（Web Service）：Build = npm install，Start = node server.js
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;
const MAX_ROOM = 40; // 每个房间最多人数

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

  ws.on("message", (raw) => {
    // 简单限速：每秒最多 60 条
    const now = Date.now();
    if (now - ws.msgWindow > 1000) { ws.msgWindow = now; ws.msgCount = 0; }
    if (++ws.msgCount > 60) return;

    let m;
    try { m = JSON.parse(raw.toString()); } catch { return send(ws, { type: "error", message: "Invalid JSON" }); }
    if (!m || typeof m.type !== "string") return;

    if (m.type === "ping") return send(ws, { type: "pong", t: m.t, ts: Date.now() });

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

httpServer.listen(PORT, "0.0.0.0", () => console.log("Multiplayer server listening on port " + PORT));
