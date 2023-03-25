let ws;
const canvas = document.getElementById("canvas");

function init() {
  const PLAY_BUTTON = document.getElementById("playGame");
  PLAY_BUTTON.addEventListener("click", () => {
    document.getElementById("gameMenu").style.display = "none";
    ws = io.connect("ws://localhost:3000");
    ws.emit("playerName", document.getElementById("name").value);
    const ctx = canvas.getContext("2d");

    let previousDelta,
      fps = 0,
      fpsInterval = 1000,
      lastFpsCalcTime = Date.now();

    let ping;

    let mouse = {
      x: 0,
      y: 0,
    };

    let camera = {
      x: 0,
      y: 0,
    };

    let game = {
      playersConnected: 0,
    };

    let players = [];
    let chatOpen = false;
    let chatHeight = 50;
    let lockMovement = false;

    const PLAYER_IMG = new Image();
    PLAYER_IMG.src = "https://mope.io/assets/t/3/skins/land/dragon/0/dragon.png";

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    function loop(currentDelta) {
      handleCamera();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      lockMovement ? ws.emit("mouse", { x: canvas.width / 2, y: canvas.height / 2 }) : ws.emit("mouse", { x: mouse.x, y: mouse.y });
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillRect(500 - camera.x, 500 - camera.y, 500, 500);
      for (const player of players) {
        if (
          player.x - camera.x > canvas.width + 150 ||
          player.y - camera.y > canvas.height + 150 ||
          player.x - camera.x < -150 ||
          player.y - camera.y < -150
        )
          continue;
        const scale = Math.min(canvas.width, canvas.height) / 500;
        player.width = 160 * scale;
        player.height = 160 * scale;
        chatMessage(player);
        ctx.fillStyle = player.color;
        ctx.save();
        ctx.translate(player.x - camera.x, player.y - camera.y);
        ctx.rotate(player.rotateAngle);
        ctx.drawImage(PLAYER_IMG, -player.width / 2, -player.height / 2, player.width, player.height);
        ctx.restore();
        ctx.font = "40px Arial";
        ctx.strokeStyle = "black";
        ctx.fillStyle = "white";
        ctx.strokeText(player.name, player.x - camera.x, player.y - camera.y + player.height / 2 - 20);
        ctx.fillText(player.name, player.x - camera.x, player.y - camera.y + player.height / 2 - 20);
        ctx.font = "20px Arial";
      }

      const elapsed = Date.now() - lastFpsCalcTime;
      if (elapsed > fpsInterval) {
        fps = parseInt(1000 / (currentDelta - previousDelta));
        lastFpsCalcTime = Date.now();
      }

      ctx.fillStyle = "white";
      ctx.fillText("FPS: " + fps, canvas.width - 60, 30);
      ctx.fillText("Ping: " + (ping ?? "N/A ") + "ms", canvas.width - 60, 60);
      ctx.fillText(game.playersConnected + " online", canvas.width - 60, 90);
      ctx.fillStyle = "black";
      previousDelta = currentDelta;
      requestAnimationFrame(loop);
    }

    loop(0);

    window.onmousemove = (e) => {
      if (e.clientX && e.clientY) {
        (mouse.x = e.clientX - canvas.getBoundingClientRect().left), (mouse.y = e.clientY - canvas.getBoundingClientRect().top);
      }
    };

    canvas.addEventListener("click", () => {
      ws.emit("click", true);
    });

    window.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "Enter":
          switch (chatOpen) {
            case false:
              document.getElementById("chat").style.display = "block";
              document.getElementById("chat").focus();
              chatOpen = !chatOpen;
              break;
            case true:
              document.getElementById("chat").style.display = "none";

              if (document.getElementById("chat").value != "") ws.emit("chatMessage", document.getElementById("chat").value);
              document.getElementById("chat").value = "";
              chatOpen = !chatOpen;
              break;
          }
          break;
        case "Escape":
          lockMovement = !lockMovement;
      }
    });

    function calculatePing() {
      const startTime = Date.now();
      ws.emit("PING", "ping");
      ws.on("PONG", () => {
        ping = Date.now() - startTime;
      });
    }

    function handleCamera() {
      const localPlayer = players.find((player) => player.id === ws.id);
      if (localPlayer) {
        camera.x = localPlayer.x - canvas.width / 2;
        camera.y = localPlayer.y - canvas.height / 2;
      }
    }

    function chatMessage(player) {
      if (player.message != "") {
        let textSize = ctx.measureText(player.message).width;
        ctx.fillStyle = "black";
        ctx.globalAlpha = 0.2;
        ctx.fillRect(player.x - camera.x - textSize / 2, player.y - camera.y - player.height / 2, textSize, chatHeight);
        ctx.fillStyle = "white";
        ctx.globalAlpha = 1;
        ctx.fillText(player.message, player.x - camera.x, player.y - camera.y - player.height / 2 + chatHeight / 2);
        ctx.fillStyle = "black";
      }
    }

    ws.on("players", (data) => (players = data));

    ws.on("playersConnected", (data) => (game.playersConnected = data));

    ws.on("connect", () => {
      ws.emit("canvas", { width: canvas.width, height: canvas.height });
      setTimeout(() => {
        calculatePing();
      }, 1000);
    });
  });
}
init();

window.onresize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (ws) ws.emit("canvas", { width: canvas.width, height: canvas.height });
};

function imAdmin(key) {
  ws.emit("admin", key);
}
