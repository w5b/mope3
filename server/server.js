const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});
const tmx = require("tmx-parser");

let players = [];
let playersServerData = {};
const FPS = 60;
let previousTime = Date.now();

let game = {
  playersConnected: 0,
  map: {
    layers: {
      0: {},
    },
    tiles: {
      0: {},
    },
  },
};

tmx.parseFile("./Map.tmx", function (err, map) {
  if (err) throw err;
  game.map.layers[0] = map.layers[0];
  game.map.tiles[0] = map.layers[0].tiles;
});

function loop(ws) {
  const player = players.find((p) => p.id === ws.id);
  if (!player) return;
  const mouse = playersServerData[ws.id].mouse;
  const canvas = playersServerData[ws.id].canvas;
  const speed = playersServerData[ws.id].speed;
  const clicked = playersServerData[ws.id].click;
  const dx = mouse.x - canvas.width / 2;
  const dy = mouse.y - canvas.height / 2;
  const distance = Math.sqrt(dx * dx + dy * dy);

  boost(ws, clicked, dx, dy, distance, speed);

  if (distance > 0) {
    if (playersServerData[ws.id].speed == 5) {
      player.x += (dx / distance) * playersServerData[ws.id].speed * playersServerData[ws.id].acceleration;
      player.y += (dy / distance) * playersServerData[ws.id].speed * playersServerData[ws.id].acceleration;
    } else {
      player.x += playersServerData[ws.id].currDelta.x * playersServerData[ws.id].speed * playersServerData[ws.id].acceleration;
      player.y += playersServerData[ws.id].currDelta.y * playersServerData[ws.id].speed * playersServerData[ws.id].acceleration;
    }
  }
  lerp(player, ws, distance);

  if (player.message != "") {
    const timeNow = Date.now();
    const timePassed = timeNow - playersServerData[ws.id].messageStart;
    if (timePassed >= 3001) player.message = "";
  }

  io.emit("players", players);
}

io.on("connection", (ws) => {
  console.log(`New client: ${ws.id}`);
  game.playersConnected++;
  ws.emit("playersConnected", game.playersConnected);
  players.push({
    id: ws.id,
    x: 0,
    y: 0,
    width: 500,
    height: 500,
    rotateAngle: 0,
    angle: 0,
    message: "",
    name: "",
    color: "black",
  });

  playersServerData[ws.id] = {
    mouse: {
      x: 0,
      y: 0,
    },

    canvas: {
      width: 0,
      height: 0,
    },

    speed: 5,
    acceleration: 1,
    click: false,
    messageStart: 0,
    sizeSet: false,
    currDelta: {
      x: null,
      y: null,
    },
    decrease: false,
    boostTime: Date.now(),
  };

  ws.on("mouse", (data) => {
    playersServerData[ws.id].mouse.x = data.x;
    playersServerData[ws.id].mouse.y = data.y;
  });

  ws.on("canvas", (data) => {
    playersServerData[ws.id].canvas = {
      width: data.width,
      height: data.height,
    };
  });

  ws.on("click", () => (playersServerData[ws.id].click = true));

  ws.on("PING", () => ws.emit("PONG", "ping"));

  ws.on("chatMessage", (data) => {
    if (data.length > 20) return;
    const player = players.find((p) => p.id === ws.id);
    playersServerData[ws.id].messageStart = Date.now();
    player.message = data;
  });

  ws.on("disconnect", () => {
    console.log(`Client disconnected: ${ws.id}`);
    game.playersConnected--;
    ws.emit("playersConnected", game.playersConnected);
    players.splice(
      players.findIndex((player) => player.id === ws.id),
      1
    );
    delete playersServerData[ws.id];
  });

  ws.on("playerName", (data) => {
    if (data.length > 14 || data === "") data = "jerryKing";
    const player = players.find((p) => p.id === ws.id);
    player.name = data;
  });

  ws.on("admin", (data) => {
    if (data === "AdminJerry") {
      const player = players.find((p) => p.id === ws.id);
      player.color = "red";
    }
  });

  setInterval(() => {
    loop(ws);
  }, 1000 / FPS);
});

server.listen(3000);

function getAngle({ x, y }, { a, b }) {
  return Math.atan2(y - b, x - a);
}

function lerp(player, ws, distance) {
  target =
    getAngle(
      { x: playersServerData[ws.id].mouse.x, y: playersServerData[ws.id].mouse.y },
      { a: playersServerData[ws.id].canvas.width / 2, b: playersServerData[ws.id].canvas.height / 2 }
    ) -
    Math.PI / 2;
  if (target && distance && distance > 3) {
    let d = target - player.rotateAngle;
    if (d > Math.PI) player.rotateAngle += 2 * Math.PI;
    else if (d < -Math.PI) player.rotateAngle -= 2 * Math.PI;
    player.rotateAngle += (target - player.rotateAngle) * 0.05;
  }
}

function boost(ws, clicked, dx, dy, distance, speed) {
  if (clicked) {
    if (playersServerData[ws.id].currDelta.x == null) {
      playersServerData[ws.id].currDelta.x = dx / distance;
      playersServerData[ws.id].currDelta.y = dy / distance;
    }
    playersServerData[ws.id].speed = Math.min(speed + 4, 25);
  }

  if (playersServerData[ws.id].speed == 25) {
    playersServerData[ws.id].decrease = true;
  }

  if (playersServerData[ws.id].decrease == true) {
    playersServerData[ws.id].speed = Math.max(speed - 1, 5);
  }

  if (playersServerData[ws.id].speed == 5) {
    playersServerData[ws.id].decrease = false;
    playersServerData[ws.id].click = false;
    playersServerData[ws.id].currDelta.x = null;
    playersServerData[ws.id].currDelta.y = null;
  }
}
