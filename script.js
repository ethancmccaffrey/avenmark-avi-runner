/* ==========================================================
   AVENMARK AVI RUNNER
   ENGINE & GAME LOGIC - PROFESSIONAL BUILD
========================================================== */

'use strict';

/* ==========================================================
   CANVAS & DOM SETUP
========================================================== */

const $ = (id) => document.getElementById(id);

const canvas = $('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

const DOM = {
  start: $('start-screen'),
  gameover: $('game-over-screen'),
  pause: $('pause-screen'),
  rocketIntro: $('rocket-intro'),
  startBtn: $('start-button'),
  restartBtn: $('restart-button'),
  resumeBtn: $('resume-button'),
  pauseBtn: $('pause-button'),
  resetBtn: $('reset-button'),
  scoreDisplay: $('score-display'),
  highScoreDisplay: $('high-score-display'),
  finalScore: $('final-score'),
  speedSlider: $('speed-slider'),
  speedValue: $('speed-value'),
  soundToggle: $('sound-toggle'),
  continueMessage: $('continue-message'),
};

/* ==========================================================
   COLOR & THEME SYSTEM
========================================================== */

const COLORS = {
  bg: '#0B1929',
  surface: '#1A2F4A',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  accentOrange: '#FF6B35',
  accentCyan: '#00D9FF',
  rocketBody: '#2A2A2A',
  rocketStripe: '#FF6B35',
  rocketWindow: '#87CEEB',
  craterDark: '#0A0E16',
  craterMid: '#1C2D40',
  moonLight: '#D4D4D4',
  ufoBody: '#2A2A2A',
  ufoGlow: '#00D9FF',
  flameA: '#FF6B35',
  flameB: '#FFB347',
};

/* ==========================================================
   CANVAS & LAYOUT STATE
========================================================== */

let canvasWidth = 1;
let canvasHeight = 1;
let devicePixelRatio = 1;
let groundY = 1;

/* ==========================================================
   GAME STATE
========================================================== */

let gameRunning = 0;
let gamePaused = 0;
let gameScore = 0;
let highScore = +localStorage.getItem('avenmark-avi-high-score') || 0;
let speedMultiplier = 1;
let introActive = 0;
let soundEnabled = 1;
let lastFrameTime = performance.now();

const BASE_SPEED = 5.05;

/* ==========================================================
   ASTRONAUT OBJECT
========================================================== */

const astronaut = {
  x: 80,
  y: 0,
  width: 64,
  height: 78,
  velocityY: 0,
  gravity: 0.62,
  jumpForce: -12.8,
  grounded: 1,
  runTime: 0,
  animationFrame: 0,
};

/* ==========================================================
   OBSTACLES & EFFECTS
========================================================== */

let obstacles = [];
let particles = [];
let dustTrail = [];

/* ==========================================================
   UTILITY FUNCTIONS
========================================================== */

function getSpeedMultiplier() {
  if (!speedMultiplier) return 0.84;
  if (speedMultiplier === 1) return 1;
  return 1 + (speedMultiplier - 1) * 0.28;
}

function getCurrentSpeed() {
  return BASE_SPEED * getSpeedMultiplier();
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

function resetAstronaut() {
  astronaut.x = Math.max(46, canvasWidth * 0.105);
  astronaut.y = groundY - astronaut.height;
  astronaut.velocityY = 0;
  astronaut.grounded = 1;
  astronaut.runTime = 0;
  astronaut.animationFrame = 0;
}

/* ==========================================================
   INPUT HANDLERS
========================================================== */

function handleJump() {
  if (gameRunning && !gamePaused && !introActive && astronaut.grounded) {
    astronaut.velocityY = astronaut.jumpForce;
    astronaut.grounded = 0;
    playJumpSound();
    emitJumpParticles();
  }
}

function handlePause() {
  if (gameRunning && !introActive) {
    gamePaused = !gamePaused;
    DOM.pauseBtn.textContent = gamePaused ? 'Resume' : 'Pause';
    DOM.pause.classList.toggle('hidden', !gamePaused);
  }
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    handleJump();
  }
  if (e.code === 'KeyP') {
    handlePause();
  }
});

canvas.addEventListener('click', handleJump);

/* ==========================================================
   OBSTACLE MANAGEMENT
========================================================== */

function clearObstacles() {
  obstacles.length = 0;
}

function addCrater(x) {
  obstacles.push({
    type: 'crater',
    x: x,
    width: randomInt(30, 76),
    height: randomInt(13, 23),
  });
}

function addUFO(x) {
  obstacles.push({
    type: 'ufo',
    x: x,
    width: randomInt(54, 72),
    height: randomInt(27, 34),
    yOffset: random(90, 160),
    bobPhase: random(0, Math.PI * 2),
    bobSpeed: random(0.0015, 0.0026),
  });
}

function sortObstacles() {
  obstacles.sort((a, b) => a.x - b.x);
}

function generateInitialObstacles() {
  clearObstacles();
  let spawnX = canvasWidth + 320;

  // Generate 8 craters
  for (let i = 0; i < 8; i++) {
    spawnX += random(320, 600);
    addCrater(spawnX);
  }

  spawnX = canvasWidth + 950;

  // Generate 5 UFOs
  for (let i = 0; i < 5; i++) {
    spawnX += random(650, 1000);
    addUFO(spawnX);
  }

  sortObstacles();
}

function spawnNextObstacle() {
  const lastObstacle = obstacles[obstacles.length - 1];
  const spawnX =
    (lastObstacle ? lastObstacle.x + lastObstacle.width : canvasWidth + 400) +
    random(330, 650);

  if (lastObstacle?.type === 'crater') {
    addUFO(spawnX);
  } else {
    addCrater(spawnX);
  }

  sortObstacles();
}

function updateObstacles(deltaTime) {
  const moveDistance = (getCurrentSpeed() * deltaTime) / 16.6667;

  for (let obstacle of obstacles) {
    obstacle.x -= moveDistance;
    if (obstacle.type === 'ufo') {
      obstacle.bobPhase += obstacle.bobSpeed * deltaTime;
    }
  }

  // Remove off-screen obstacles
  while (obstacles.length && obstacles[0].x + obstacles[0].width < -120) {
    obstacles.shift();
  }

  // Spawn new obstacles
  while (obstacles.length < 7) {
    spawnNextObstacle();
  }
}

/* ==========================================================
   COLLISION DETECTION
========================================================== */

function checkCollisions() {
  for (let obstacle of obstacles) {
    const aLeft = astronaut.x;
    const aRight = astronaut.x + astronaut.width;
    const aTop = astronaut.y;
    const aBottom = astronaut.y + astronaut.height;

    const oLeft = obstacle.x;
    const oRight = obstacle.x + obstacle.width;
    const oTop =
      obstacle.type === 'crater' ? groundY - obstacle.height : groundY - obstacle.yOffset;
    const oBottom = groundY;

    if (aRight > oLeft && aLeft < oRight && aBottom > oTop && aTop < oBottom) {
      return true;
    }
  }
  return false;
}

/* ==========================================================
   PHYSICS & UPDATE
========================================================== */

function updateAstronaut(deltaTime) {
  astronaut.runTime += deltaTime;

  // Apply gravity
  astronaut.velocityY += astronaut.gravity;

  // Update position
  astronaut.y += astronaut.velocityY;

  // Ground collision
  if (astronaut.y + astronaut.height >= groundY) {
    astronaut.y = groundY - astronaut.height;
    astronaut.velocityY = 0;
    astronaut.grounded = 1;
  } else {
    astronaut.grounded = 0;
  }

  // Update animation frame
  astronaut.animationFrame = Math.floor((astronaut.runTime / 50) % 4);

  // Emit dust particles when grounded
  if (astronaut.grounded && Math.random() < 0.15) {
    emitDustTrail();
  }
}

function updateParticles(deltaTime) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2; // gravity
    p.life -= deltaTime;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  for (let i = dustTrail.length - 1; i >= 0; i--) {
    const d = dustTrail[i];
    d.x -= getCurrentSpeed() * 0.05;
    d.opacity -= 0.015;

    if (d.opacity <= 0) {
      dustTrail.splice(i, 1);
    }
  }
}

function update(deltaTime) {
  if (!gameRunning || gamePaused || introActive) return;

  updateAstronaut(deltaTime);
  updateObstacles(deltaTime);
  updateParticles(deltaTime);

  // Increment score
  gameScore += Math.floor(getCurrentSpeed() * 0.1);
  DOM.scoreDisplay.textContent = gameScore;

  // Check collisions
  if (checkCollisions()) {
    endGame();
  }
}

/* ==========================================================
   PARTICLE EFFECTS
========================================================== */

function emitJumpParticles() {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: astronaut.x + astronaut.width / 2,
      y: astronaut.y + astronaut.height,
      vx: random(-2, 2),
      vy: random(-3, -1),
      life: 400,
      color: COLORS.accentCyan,
      size: random(3, 6),
    });
  }
}

function emitDustTrail() {
  dustTrail.push({
    x: astronaut.x,
    y: groundY,
    size: random(4, 8),
    opacity: 0.8,
    color: COLORS.accentOrange,
  });
}

/* ==========================================================
   DRAWING FUNCTIONS
========================================================== */

function drawCrater(crater) {
  const x = crater.x;
  const y = groundY;
  const w = crater.width;
  const h = crater.height;

  ctx.save();

  // Crater shadow
  ctx.fillStyle = COLORS.craterDark;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y, w / 2.2, h * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crater rim (3D effect)
  ctx.strokeStyle = COLORS.craterMid;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + w / 2, y - h * 0.3, w / 2, Math.PI, 0, false);
  ctx.stroke();

  // Crater depth gradient
  const grad = ctx.createRadialGradient(x + w / 2, y - h * 0.4, 0, x + w / 2, y, w / 2);
  grad.addColorStop(0, 'rgba(26, 47, 74, 0.4)');
  grad.addColorStop(1, 'rgba(10, 14, 22, 0.8)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y - h * 0.2, w / 2.4, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawUFO(ufo) {
  const x = ufo.x;
  const yBase = groundY - ufo.yOffset;
  const y = yBase + Math.sin(ufo.bobPhase) * 8;
  const w = ufo.width;
  const h = ufo.height;

  ctx.save();

  // UFO body (disc)
  const bodyGrad = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
  bodyGrad.addColorStop(0, '#3A3A3A');
  bodyGrad.addColorStop(0.5, COLORS.ufoBody);
  bodyGrad.addColorStop(1, '#1A1A1A');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y, w / 2, h / 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // UFO dome
  ctx.fillStyle = COLORS.ufoGlow;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(x + w / 2, y - h / 3, w / 4, 0, Math.PI * 2);
  ctx.fill();

  // UFO lights
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = COLORS.ufoGlow;
  for (let i = 0; i < 3; i++) {
    const lightX = x + (w / 4) + (i * (w / 6));
    const lightY = y + h / 4;
    ctx.beginPath();
    ctx.arc(lightX, lightY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // UFO beam
  ctx.strokeStyle = COLORS.ufoGlow;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x + w / 3, y + h / 2);
  ctx.lineTo(x + w / 3 - 20, groundY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + (2 * w) / 3, y + h / 2
