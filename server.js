const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Multiplayer server is running");
});

const wss = new WebSocket.Server({
  server: httpServer,
  maxPayload: 64 * 1024
});

const rooms = new Map();

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function sendToRoom(room, data, except = null) {
  const players = rooms.get(room);
  if (!players) return;

  for (const player of players.values()) {
    if (player.ws !== except) {
      send(player.ws, data);
    }
  }
}

function leaveRoom(ws) {
  if (!ws.room || !ws.playerId) return;

  const room = ws.room;
  const playerId = ws.playerId;
  const players = rooms.get(room);

  if (players) {
    players.delete(playerId);

    sendToRoom(room, {
      type: "playerLeft",
      playerId
    });

    if (players.size === 0) {
      rooms.delete(room);
    }
  }

  ws.room = null;
  ws.playerId = null;
}

wss.on("connection", (ws) => {
  ws.playerId = crypto.randomUUID();
  ws.room = null;

  send(ws, {
    type: "connected",
    playerId: ws.playerId
  });

  ws.on("message", (raw) => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", message: "Invalid JSON" });
      return;
    }

    if (message.type === "join") {
      const room = String(message.room || "").trim();

      if (!room || room.length > 40) {
        send(ws, { type: "error", message: "Invalid room name" });
        return;
      }

      leaveRoom(ws);

      if (!rooms.has(room)) {
        rooms.set(room, new Map());
      }

      const players = rooms.get(room);

      // Send the joining player the current room members.
      for (const [playerId, player] of players.entries()) {
        send(ws, {
          type: "playerJoined",
          playerId,
          state: player.state
        });
      }

      ws.room = room;

      players.set(ws.playerId, {
        ws,
        state: null
      });

      // Tell the other players someone joined.
      sendToRoom(room, {
        type: "playerJoined",
        playerId: ws.playerId,
        state: null
      }, ws);

      send(ws, {
        type: "joined",
        room,
        playerId: ws.playerId
      });

      return;
    }

    if (message.type === "state") {
      if (!ws.room) return;

      const players = rooms.get(ws.room);
      if (!players) return;

      const player = players.get(ws.playerId);
      if (!player) return;

      player.state = message.state;

      sendToRoom(ws.room, {
        type: "state",
        playerId: ws.playerId,
        state: message.state
      }, ws);

      return;
    }

    if (message.type === "chat") {
      if (!ws.room) return;

      const text = String(message.text || "").slice(0, 300);

      sendToRoom(ws.room, {
        type: "chat",
        playerId: ws.playerId,
        text
      });
    }
  });

  ws.on("close", () => {
    leaveRoom(ws);
  });

  ws.on("error", () => {
    leaveRoom(ws);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplayer server listening on port ${PORT}`);
});
