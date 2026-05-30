(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;
  const LEVEL_LINES = 10;
  const COLORS = {
    I: "#55d8ff",
    J: "#5e7cff",
    L: "#ffa64d",
    O: "#ffe066",
    S: "#6df58f",
    T: "#c77dff",
    Z: "#ff607d",
  };
  const SHAPES = {
    I: [[1, 1, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    T: [[0, 1, 0], [1, 1, 1]],
    Z: [[1, 1, 0], [0, 1, 1]],
  };
  const SCORE_TABLE = [0, 40, 100, 300, 1200];
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const nextCanvas = document.getElementById("next");
  const nextCtx = nextCanvas.getContext("2d");
  const cinemaCanvas = document.getElementById("cinematic");
  const cinemaCtx = cinemaCanvas.getContext("2d");
  const boardWrap = document.querySelector(".board-wrap");
  const fade = document.getElementById("fade");
  const intro = document.getElementById("introOverlay");
  const startButton = document.getElementById("startButton");
  const textBox = document.getElementById("cinematicText");
  const mainMusic = document.getElementById("musicMain");
  const cinemaMusic = document.getElementById("musicCinema");
  const volume = document.getElementById("volume");
  const gamepadStatus = document.getElementById("gamepadStatus");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const linesEl = document.getElementById("lines");

  let board = makeBoard();
  let bag = [];
  let current = createPiece();
  let next = createPiece();
  let score = 0;
  let level = 1;
  let lines = 0;
  let dropCounter = 0;
  let dropInterval = getDropInterval();
  let lastTime = 0;
  let running = false;
  let paused = true;
  let cinematicStarted = false;
  let touchSoftDrop = false;
  let keySoftDrop = false;
  let gamepadSoftDrop = false;
  let gamepadPrevious = {};
  let audioUnlocked = false;

  function makeBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function refillBag() {
    bag = Object.keys(SHAPES);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }

  function createPiece() {
    if (!bag.length) refillBag();
    const type = bag.pop();
    return {
      type,
      matrix: SHAPES[type].map((row) => row.slice()),
      x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
      y: -1,
    };
  }

  function getDropInterval() {
    return Math.max(95, 780 * Math.pow(0.82, level - 1));
  }

  function drawCell(context, x, y, size, color, alpha = 1) {
    context.save();
    context.globalAlpha = alpha;
    const px = x * size;
    const py = y * size;
    const grad = context.createLinearGradient(px, py, px + size, py + size);
    grad.addColorStop(0, lighten(color, 24));
    grad.addColorStop(0.54, color);
    grad.addColorStop(1, darken(color, 22));
    context.fillStyle = grad;
    context.shadowColor = "rgba(0,0,0,.35)";
    context.shadowBlur = 8;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(255,255,255,.22)";
    context.lineWidth = 1;
    context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
    context.restore();
  }

  function lighten(hex, amount) {
    return shade(hex, amount);
  }

  function darken(hex, amount) {
    return shade(hex, -amount);
  }

  function shade(hex, amount) {
    const value = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (value >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (value & 255) + amount));
    return `rgb(${r},${g},${b})`;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#070b13";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,.045)";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * BLOCK + 0.5, 0);
      ctx.lineTo(x * BLOCK + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * BLOCK + 0.5);
      ctx.lineTo(canvas.width, y * BLOCK + 0.5);
      ctx.stroke();
    }
    board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) drawCell(ctx, x, y, BLOCK, COLORS[cell]);
      });
    });
    drawGhost();
    drawMatrix(ctx, current.matrix, current.x, current.y, BLOCK, COLORS[current.type]);
  }

  function drawGhost() {
    const ghost = { ...current, matrix: current.matrix.map((row) => row.slice()) };
    while (!collides(ghost, 0, 1)) ghost.y++;
    drawMatrix(ctx, ghost.matrix, ghost.x, ghost.y, BLOCK, COLORS[ghost.type], 0.18);
  }

  function drawMatrix(context, matrix, offsetX, offsetY, size, color, alpha = 1) {
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value && y + offsetY >= 0) drawCell(context, x + offsetX, y + offsetY, size, color, alpha);
      });
    });
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextCtx.fillStyle = "rgba(7,11,19,.58)";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const size = 24;
    const width = next.matrix[0].length * size;
    const height = next.matrix.length * size;
    const x = Math.floor((nextCanvas.width - width) / 2 / size);
    const y = Math.floor((nextCanvas.height - height) / 2 / size);
    drawMatrix(nextCtx, next.matrix, x, y, size, COLORS[next.type]);
  }

  function collides(piece, moveX = 0, moveY = 0, matrix = piece.matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const nx = piece.x + x + moveX;
        const ny = piece.y + y + moveY;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function merge() {
    current.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value && current.y + y >= 0) board[current.y + y][current.x + x] = current.type;
      });
    });
  }

  function rotate() {
    if (paused) return;
    const rotated = current.matrix[0].map((_, index) => current.matrix.map((row) => row[index]).reverse());
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collides(current, kick, 0, rotated)) {
        current.x += kick;
        current.matrix = rotated;
        return;
      }
    }
  }

  function move(dir) {
    if (!paused && !collides(current, dir, 0)) current.x += dir;
  }

  function playerDrop(manual = false) {
    if (paused) return;
    if (!collides(current, 0, 1)) {
      current.y++;
      if (manual) score += 1;
      dropCounter = 0;
      updateHud();
      return;
    }
    lockPiece();
  }

  function hardDrop() {
    if (paused) return;
    let distance = 0;
    while (!collides(current, 0, 1)) {
      current.y++;
      distance++;
    }
    score += distance * 2;
    lockPiece();
  }

  function lockPiece() {
    merge();
    clearLines();
    current = next;
    next = createPiece();
    if (collides(current, 0, 0)) resetGame();
    drawNext();
    updateHud();
  }

  function clearLines() {
    let cleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (!board[y][x]) continue outer;
      }
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
    if (!cleared) return;
    lines += cleared;
    score += SCORE_TABLE[cleared] * level;
    const newLevel = Math.floor(lines / LEVEL_LINES) + 1;
    if (newLevel !== level) {
      level = newLevel;
      dropInterval = getDropInterval();
      if (level >= 10 && !cinematicStarted) startCinematic();
    }
  }

  function resetGame() {
    board = makeBoard();
    current = createPiece();
    next = createPiece();
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = getDropInterval();
    updateHud();
    drawNext();
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString("fr-FR");
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function update(time = 0) {
    const delta = time - lastTime;
    lastTime = time;
    if (running && !paused) {
      dropCounter += delta;
      if ((touchSoftDrop || keySoftDrop || gamepadSoftDrop) && dropCounter > 42) playerDrop(true);
      if (dropCounter > dropInterval) playerDrop(false);
      pollGamepad();
    } else {
      pollGamepad();
    }
    draw();
    requestAnimationFrame(update);
  }

  function startGame() {
    intro.classList.add("hidden");
    running = true;
    paused = false;
    unlockAudio();
  }

  function unlockAudio() {
    audioUnlocked = true;
    mainMusic.volume = Number(volume.value);
    mainMusic.play().catch(() => {});
  }

  function fadeAudio(audio, to, duration, done) {
    const from = audio.volume;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      audio.volume = from + (to - from) * t;
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }

  async function startCinematic() {
    cinematicStarted = true;
    paused = true;
    running = false;
    fade.classList.add("show");
    fadeAudio(mainMusic, 0, 1500, () => {
      mainMusic.pause();
      mainMusic.currentTime = 0;
    });
    await wait(1500);
    board = makeBoard();
    current = { type: "T", matrix: [], x: 0, y: 0 };
    boardWrap.classList.add("is-cinematic");
    fade.classList.remove("show");
    cinemaMusic.volume = 0;
    if (audioUnlocked) cinemaMusic.play().catch(() => {});
    fadeAudio(cinemaMusic, Number(volume.value), 3200);
    runHeartCinematic();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function makeHeartTargets() {
    const cols = 25;
    const rows = 23;
    const cell = 10;
    const offsetX = (cinemaCanvas.width - cols * cell) / 2;
    const offsetY = 148;
    const targets = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = (x / (cols - 1)) * 2.8 - 1.4;
        const ny = 1.28 - (y / (rows - 1)) * 2.58;
        const heart = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * Math.pow(ny, 3);
        if (heart <= 0) {
          targets.push({
            tx: offsetX + x * cell,
            ty: offsetY + y * cell,
            size: cell,
            color: ["#ff477e", "#ff5d91", "#ff739f", "#f7356d"][Math.floor(Math.random() * 4)],
            delay: y * 74 + Math.random() * 620,
          });
        }
      }
    }
    return targets;
  }

  function runHeartCinematic() {
    const targets = makeHeartTargets();
    const particles = [];
    const blocks = targets.map((target) => ({
      ...target,
      x: target.tx + (Math.random() - 0.5) * 80,
      y: -40 - Math.random() * 520,
      vy: 0,
      landed: false,
      bounce: 0,
    }));
    const start = performance.now();
    let messagesStarted = false;

    function frame(now) {
      const elapsed = now - start;
      cinemaCtx.clearRect(0, 0, cinemaCanvas.width, cinemaCanvas.height);
      drawCinemaBackground(elapsed);
      let landedCount = 0;
      blocks.forEach((block) => {
        if (elapsed < block.delay) return;
        if (!block.landed) {
          block.vy += 0.32;
          block.y += block.vy;
          block.x += (block.tx - block.x) * 0.035;
          if (block.y >= block.ty) {
            block.y = block.ty;
            block.landed = true;
            block.bounce = 1;
            spawnParticles(particles, block.tx + block.size / 2, block.ty + block.size / 2, block.color, 3);
          }
        } else {
          landedCount++;
          block.bounce *= 0.86;
        }
        const beat = landedCount === blocks.length ? 1 + Math.sin(now / 560) * 0.035 : 1;
        drawCinemaBlock(block, beat);
      });
      updateParticles(particles);
      if (landedCount === blocks.length && !messagesStarted) {
        messagesStarted = true;
        setTimeout(showFinalMessages, 2000);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function drawCinemaBackground(time) {
    const gradient = cinemaCtx.createRadialGradient(150, 300, 12, 150, 300, 290);
    gradient.addColorStop(0, "rgba(255,95,136,.22)");
    gradient.addColorStop(0.5, "rgba(20,13,28,.88)");
    gradient.addColorStop(1, "#030406");
    cinemaCtx.fillStyle = gradient;
    cinemaCtx.fillRect(0, 0, cinemaCanvas.width, cinemaCanvas.height);
    cinemaCtx.fillStyle = `rgba(255,170,192,${0.10 + Math.sin(time / 900) * 0.035})`;
    cinemaCtx.beginPath();
    cinemaCtx.arc(150, 282, 132, 0, Math.PI * 2);
    cinemaCtx.fill();
  }

  function drawCinemaBlock(block, beat) {
    const size = block.size;
    const cx = 150;
    const cy = 276;
    const x = cx + (block.x + size / 2 - cx) * beat - size / 2;
    const y = cy + (block.y + size / 2 - cy) * beat - size / 2 - Math.sin(block.bounce * Math.PI) * 5;
    cinemaCtx.save();
    cinemaCtx.shadowColor = "rgba(255,65,122,.58)";
    cinemaCtx.shadowBlur = 12;
    cinemaCtx.fillStyle = block.color;
    cinemaCtx.fillRect(x + 1, y + 1, size - 2, size - 2);
    cinemaCtx.fillStyle = "rgba(255,255,255,.18)";
    cinemaCtx.fillRect(x + 3, y + 3, size - 6, 4);
    cinemaCtx.strokeStyle = "rgba(255,255,255,.18)";
    cinemaCtx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    cinemaCtx.restore();
  }

  function spawnParticles(particles, x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 2.5,
        vy: (Math.random() - 0.8) * 2.5,
        life: 42 + Math.random() * 30,
        color,
      });
    }
  }

  function updateParticles(particles) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.035;
      p.life--;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      cinemaCtx.globalAlpha = Math.min(1, p.life / 34);
      cinemaCtx.fillStyle = p.color;
      cinemaCtx.beginPath();
      cinemaCtx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      cinemaCtx.fill();
      cinemaCtx.globalAlpha = 1;
    }
  }

  async function showFinalMessages() {
    addLine("❤️ Bonne fête Maman ❤️", "headline");
    await wait(2300);
    addLine("Merci pour tout ce que tu fais pour moi.", "body");
    await wait(2500);
    addLine("Je t'aime.", "body");
    await wait(3500);
    typeLine("Ce jeu n'est pas parfait... Mais il a été codé spécialement pour toi.");
  }

  function addLine(text, className) {
    const line = document.createElement("div");
    line.className = `line ${className}`;
    line.textContent = text;
    textBox.appendChild(line);
  }

  function typeLine(text) {
    const line = document.createElement("div");
    line.className = "line typed";
    textBox.appendChild(line);
    let i = 0;
    const timer = setInterval(() => {
      line.textContent = text.slice(0, i);
      i++;
      if (i > text.length) clearInterval(timer);
    }, 56);
  }

  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (!pad) {
      gamepadSoftDrop = false;
      gamepadStatus.textContent = "Manette : recherche";
      gamepadStatus.classList.remove("connected");
      return;
    }
    gamepadStatus.textContent = "Manette : connectée";
    gamepadStatus.classList.add("connected");
    const pressed = {
      left: pad.buttons[14]?.pressed || pad.axes[0] < -0.55,
      right: pad.buttons[15]?.pressed || pad.axes[0] > 0.55,
      down: pad.buttons[13]?.pressed || pad.axes[1] > 0.55,
      rotate: pad.buttons[0]?.pressed,
      drop: pad.buttons[2]?.pressed,
    };
    if (pressed.left && !gamepadPrevious.left) move(-1);
    if (pressed.right && !gamepadPrevious.right) move(1);
    if (pressed.rotate && !gamepadPrevious.rotate) rotate();
    if (pressed.drop && !gamepadPrevious.drop) hardDrop();
    gamepadSoftDrop = pressed.down;
    gamepadPrevious = pressed;
  }

  document.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    if (!audioUnlocked) unlockAudio();
    if (event.code === "ArrowLeft") move(-1);
    if (event.code === "ArrowRight") move(1);
    if (event.code === "ArrowUp") rotate();
    if (event.code === "ArrowDown") {
      keySoftDrop = true;
      playerDrop(true);
    }
    if (event.code === "Space") hardDrop();
  });

  document.addEventListener("keyup", (event) => {
    if (event.code === "ArrowDown") keySoftDrop = false;
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!audioUnlocked) unlockAudio();
      if (action === "left") move(-1);
      if (action === "right") move(1);
      if (action === "rotate") rotate();
      if (action === "drop") hardDrop();
      if (action === "down") {
        touchSoftDrop = true;
        playerDrop(true);
      }
    });
    button.addEventListener("pointerup", () => {
      if (action === "down") touchSoftDrop = false;
    });
    button.addEventListener("pointerleave", () => {
      if (action === "down") touchSoftDrop = false;
    });
  });

  volume.addEventListener("input", () => {
    const value = Number(volume.value);
    if (!cinematicStarted) mainMusic.volume = value;
    cinemaMusic.volume = value;
  });

  startButton.addEventListener("click", startGame);
  window.addEventListener("gamepadconnected", () => pollGamepad());
  updateHud();
  drawNext();
  requestAnimationFrame(update);
})();
