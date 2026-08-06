/* ==========================================================
   AVENMARK AVI RUNNER
   GAME ENGINE
========================================================== */

"use strict";

/* ==========================================================
   DOM
========================================================== */

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const pauseScreen = document.getElementById("pause-screen");

const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const resumeButton = document.getElementById("resume-button");

const pauseButton = document.getElementById("pause-button");
const resetButton = document.getElementById("reset-button");

const scoreDisplay = document.getElementById("score-display");
const highScoreDisplay = document.getElementById("high-score-display");
const finalScoreDisplay = document.getElementById("final-score");

const speedSlider = document.getElementById("speed-slider");
const speedValue = document.getElementById("speed-value");

const soundToggle = document.getElementById("sound-toggle");
const soundLabel = document.getElementById("sound-label");

const continueMessage = document.getElementById("continue-message");

/* ==========================================================
   COLORS
========================================================== */

const COLORS = {
    bg: "#F5F5F2",
    dark: "#2F2F2F",
    copper: "#C47A45",
    space: "#103159"
};

/* ==========================================================
   CANVAS
========================================================== */

let width = 0;
let height = 0;
let groundY = 0;
let dpr = 1;

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    groundY = height * 0.78;

    if (avi) {
        avi.y = groundY - avi.height;
    }
}

window.addEventListener("resize", resizeCanvas);

/* ==========================================================
   GAME STATE
========================================================== */

let running = false;
let paused = false;
let gameStarted = false;

let animationFrame = null;
let lastTime = 0;

let score = 0;
let highScore = Number(localStorage.getItem("avenmark-avi-high-score") || 0);

let distance = 0;
let obstacleTimer = 0;

let speedSetting = 1;

/*
    0 = slightly slower
    1 = normal
    2+ = progressively faster
*/

const BASE_SPEED = 6.0;

function getSpeedMultiplier() {
    if (speedSetting === 0) return 0.86;
    if (speedSetting === 1) return 1.0;

    return 1 + ((speedSetting - 1) * 0.24);
}

function getGameSpeed() {
    return BASE_SPEED * getSpeedMultiplier();
}

/* ==========================================================
   SKY STATE
========================================================== */

let skyMode = "stars";
let lastSkyMilestone = 0;

function updateSkyMode() {
    const milestone = Math.floor(score / 2500);

    if (milestone !== lastSkyMilestone) {
        lastSkyMilestone = milestone;

        skyMode = milestone % 2 === 0
            ? "stars"
            : "nebula";
    }
}

/* ==========================================================
   AVI
========================================================== */

const avi = {
    x: 90,
    y: 0,

    width: 52,
    height: 70,

    velocityY: 0,

    gravity: 0.58,
    jumpForce: -12.5,

    grounded: true,

    runTime: 0
};

function resetAvi() {
    avi.x = Math.max(45, width * 0.10);
    avi.y = groundY - avi.height;
    avi.velocityY = 0;
    avi.grounded = true;
    avi.runTime = 0;
}

function jump() {
    if (!running || paused) return;

    if (avi.grounded) {
        avi.velocityY = avi.jumpForce;
        avi.grounded = false;

        playJumpSound();
    }
}

/* ==========================================================
   CRATERS
========================================================== */

const craters = [];

function createCrater(x = width + 50) {
    const size = random(25, 65);

    craters.push({
        x,
        width: size,
        height: random(7, 15),
        depth: random(3, 8),
        passed: false
    });
}

function initializeCraters() {
    craters.length = 0;

    let x = 140;

    while (x < width + 200) {
        x += random(130, 280);
        createCrater(x);
    }
}

function updateCraters(delta) {
    const movement = getGameSpeed() * delta * 0.07;

    for (const crater of craters) {
        crater.x -= movement;
    }

    while (
        craters.length &&
        craters[0].x + craters[0].width < -100
    ) {
        craters.shift();
    }

    const last = craters[craters.length - 1];

    if (last && last.x < width + 50) {
        createCrater(
            last.x +
            last.width +
            random(150, 300)
        );
    }
}

function drawCrater(crater) {
    const x = crater.x;
    const y = groundY + 3;

    /*
        A shallow elliptical depression.
        The outer edge gives it a clear crater silhouette,
        while the inner shape makes the depression readable.
    */

    ctx.save();

    ctx.strokeStyle = "rgba(47,47,47,0.28)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(
        x + crater.width / 2,
        y,
        crater.width / 2,
        crater.height,
        0,
        0,
        Math.PI * 2
    );
    ctx.stroke();

    ctx.fillStyle = "rgba(47,47,47,0.055)";

    ctx.beginPath();
    ctx.ellipse(
        x + crater.width / 2,
        y + 1,
        crater.width / 2 - 2,
        crater.depth + 2,
        0,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
}

/* ==========================================================
   UFO OBSTACLES
========================================================== */

const ufos = [];

function createUFO(x = width + 100) {
    const flyingHeight = random(95, 185);

    ufos.push({
        x,
        y: groundY - flyingHeight,

        width: random(42, 58),
        height: random(17, 23),

        passed: false,

        drift: random(0, Math.PI * 2)
    });
}

function initializeUFOs() {
    ufos.length = 0;

    let x = width + 350;

    for (let i = 0; i < 3; i++) {
        x += random(450, 750);
        createUFO(x);
    }
}

function updateUFOs(delta) {
    const movement = getGameSpeed() * delta * 0.07;

    for (const ufo of ufos) {
        ufo.x -= movement;

        ufo.drift += delta * 0.002;

        ufo.y += Math.sin(ufo.drift) * 0.12;
    }

    while (
        ufos.length &&
        ufos[0].x + ufos[0].width < -100
    ) {
        ufos.shift();
    }

    const last = ufos[ufos.length - 1];

    if (last && last.x < width + 100) {
        createUFO(
            last.x +
            random(500, 850)
        );
    }
}

function drawUFO(ufo) {
    const cx = ufo.x + ufo.width / 2;
    const cy = ufo.y + ufo.height / 2;

    ctx.save();

    /*
        Deliberately simple.
        The UFO should read almost like a Chrome Dino obstacle,
        not like a detailed spaceship illustration.
    */

    ctx.fillStyle = COLORS.space;

    ctx.beginPath();
    ctx.ellipse(
        cx,
        cy,
        ufo.width / 2,
        ufo.height / 2.2,
        0,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = COLORS.bg;

    ctx.beginPath();
    ctx.ellipse(
        cx,
        cy - 3,
        ufo.width * 0.24,
        ufo.height * 0.32,
        0,
        Math.PI,
        Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = COLORS.copper;

    ctx.beginPath();
    ctx.arc(
        cx,
        cy + ufo.height * 0.36,
        2.5,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
}

/* ==========================================================
   STARS
========================================================== */

const stars = [];

function initializeStars() {
    stars.length = 0;

    for (let i = 0; i < 45; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * (groundY * 0.75),
            size: random(1, 2.3),
            alpha: random(0.35, 0.85)
        });
    }
}

function drawStars() {
    ctx.save();

    for (const star of stars) {
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = COLORS.copper;

        ctx.beginPath();
        ctx.arc(
            star.x,
            star.y,
            star.size,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
}

/* ==========================================================
   BLUE NEBULA
========================================================== */

function drawNebula() {
    const gradient = ctx.createRadialGradient(
        width * 0.52,
        height * 0.30,
        10,
        width * 0.52,
        height * 0.30,
        width * 0.75
    );

    gradient.addColorStop(0, "rgba(16,49,89,0.16)");
    gradient.addColorStop(0.45, "rgba(16,49,89,0.08)");
    gradient.addColorStop(1, "rgba(16,49,89,0)");

    ctx.fillStyle = gradient;

    ctx.fillRect(
        0,
        0,
        width,
        groundY
    );

    /*
        Sparse copper points remain in the nebula so the
        Avenmark identity doesn't disappear completely.
    */

    ctx.save();

    for (let i = 0; i < 18; i++) {
        const x = ((i * 173) + 70) % width;
        const y = ((i * 71) + 38) % Math.max(100, groundY * 0.72);

        ctx.globalAlpha = 0.45;

        ctx.fillStyle = COLORS.copper;

        ctx.beginPath();
        ctx.arc(x, y, 1.3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/* ==========================================================
   TERRAIN
========================================================== */

function drawTerrain() {
    ctx.save();

    ctx.strokeStyle = COLORS.dark;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    ctx.globalAlpha = 0.08;

    ctx.beginPath();

    for (let x = 0; x <= width; x += 32) {
        const bump =
            Math.sin(x * 0.028) * 2 +
            Math.sin(x * 0.071) * 1.3;

        ctx.lineTo(x, groundY + bump);
    }

    ctx.stroke();

    ctx.restore();
}

/* ==========================================================
   AVI DRAWING
========================================================== */

function drawAvi() {
    const x = avi.x;
    const y = avi.y;

    const bob =
        avi.grounded
            ? Math.sin(avi.runTime * 0.018) * 1.5
            : 0;

    ctx.save();
    ctx.translate(x, y + bob);

    /*
        Avi faces RIGHT.
        The shapes are intentionally simple and clean.
    */

    const runPhase =
        Math.sin(avi.runTime * 0.025);

    /* Backpack */
    ctx.fillStyle = COLORS.dark;

    roundRect(
        ctx,
        2,
        27,
        13,
        27,
        5
    );

    ctx.fill();

    /* Backpack copper detail */
    ctx.fillStyle = COLORS.copper;

    roundRect(
        ctx,
        4,
        33,
        4,
        10,
        2
    );

    ctx.fill();

    /* Body */
    ctx.fillStyle = COLORS.dark;

    roundRect(
        ctx,
        14,
        28,
        27,
        29,
        9
    );

    ctx.fill();

    /* Chest panel */
    ctx.fillStyle = COLORS.bg;

    roundRect(
        ctx,
        23,
        34,
        12,
        9,
        2
    );

    ctx.fill();

    /* Copper chest mark */
    ctx.fillStyle = COLORS.copper;

    ctx.fillRect(
        26,
        36,
        6,
        2
    );

    /* Helmet */
    ctx.fillStyle = COLORS.dark;

    ctx.beginPath();
    ctx.arc(
        34,
        18,
        17,
        0,
        Math.PI * 2
    );
    ctx.fill();

    /* Helmet glass */
    ctx.fillStyle = COLORS.bg;

    ctx.beginPath();

    /*
        Offset toward the RIGHT so the face reads as
        directional rather than front-facing.
    */

    ctx.ellipse(
        39,
        18,
        11,
        10,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /* Small face indication */
    ctx.fillStyle = COLORS.dark;

    ctx.beginPath();
    ctx.arc(
        44,
        17,
        1.4,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /* Arm holding laptop */
    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(20, 34);
    ctx.lineTo(38, 47);
    ctx.stroke();

    /* Laptop screen */
    ctx.fillStyle = COLORS.dark;

    roundRect(
        ctx,
        34,
        43,
        17,
        11,
        2
    );

    ctx.fill();

    /* Laptop screen */
    ctx.fillStyle = COLORS.bg;

    roundRect(
        ctx,
        36,
        45,
        13,
        7,
        1.5
    );

    ctx.fill();

    /* Laptop base */
    ctx.fillStyle = COLORS.dark;

    ctx.beginPath();
    ctx.moveTo(32, 54);
    ctx.lineTo(53, 54);
    ctx.lineTo(56, 58);
    ctx.lineTo(30, 58);
    ctx.closePath();
    ctx.fill();

    /* Copper laptop indicator */
    ctx.fillStyle = COLORS.copper;

    ctx.fillRect(
        43,
        47,
        4,
        1.5
    );

    /* Legs */
    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 8;

    const legOffset =
        avi.grounded
            ? runPhase * 4
            : 0;

    ctx.beginPath();
    ctx.moveTo(21, 54);
    ctx.lineTo(17 + legOffset, 67);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(34, 54);
    ctx.lineTo(38 - legOffset, 67);
    ctx.stroke();

    /* Boots */
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.moveTo(14 + legOffset, 67);
    ctx.lineTo(21 + legOffset, 67);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(35 - legOffset, 67);
    ctx.lineTo(42 - legOffset, 67);
    ctx.stroke();

    ctx.restore();
}

/* ==========================================================
   HELPERS
========================================================== */

function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);

    ctx.beginPath();

    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);

    ctx.quadraticCurveTo(
        x + w,
        y,
        x + w,
        y + radius
    );

    ctx.lineTo(
        x + w,
        y + h - radius
    );

    ctx.quadraticCurveTo(
        x + w,
        y + h,
        x + w - radius,
        y + h
    );

    ctx.lineTo(
        x + radius,
        y + h
    );

    ctx.quadraticCurveTo(
        x,
        y + h,
        x,
        y + h - radius
    );

    ctx.lineTo(
        x,
        y + radius
    );

    ctx.quadraticCurveTo(
        x,
        y,
        x + radius,
        y
    );

    ctx.closePath();
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

/* ==========================================================
   COLLISION
========================================================== */

function getAviHitbox() {
    return {
        x: avi.x + 15,
        y: avi.y + 8,
        width: 34,
        height: 57
    };
}

function intersects(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function checkCollisions() {
    const player = getAviHitbox();

    for (const ufo of ufos) {
        const hitbox = {
            x: ufo.x + 5,
            y: ufo.y + 3,
            width: ufo.width - 10,
            height: ufo.height - 5
        };

        if (intersects(player, hitbox)) {
            endGame();
            return;
        }
    }
}

/* ==========================================================
   SCORE
========================================================== */

function updateScore(delta) {
    score += delta * 0.006 * getSpeedMultiplier();

    const displayedScore = Math.floor(score);

    scoreDisplay.textContent = displayedScore.toString();

    if (displayedScore > highScore) {
        highScore = displayedScore;

        highScoreDisplay.textContent =
            highScore.toString();

        localStorage.setItem(
            "avenmark-avi-high-score",
            highScore.toString()
        );
    }

    updateSkyMode();

    const continueMilestone =
        Math.floor(displayedScore / 1500);

    if (
        continueMilestone > 0 &&
        displayedScore % 1500 < 2
    ) {
        showContinueMessage();
    }
}

let continueTimeout = null;

function showContinueMessage() {
    clearTimeout(continueTimeout);

    continueMessage.classList.add("show");

    continueTimeout = setTimeout(() => {
        continueMessage.classList.remove("show");
    }, 1100);
}

/* ==========================================================
   PHYSICS
========================================================== */

function updateAvi(delta) {
    if (!avi.grounded) {
        avi.velocityY += avi.gravity * delta * 0.06;

        avi.y += avi.velocityY * delta * 0.06;

        if (avi.y >= groundY - avi.height) {
            avi.y = groundY - avi.height;
            avi.velocityY = 0;
            avi.grounded = true;
        }
    }

    avi.runTime += delta;
}

/* ==========================================================
   DRAW
========================================================== */

function drawBackground() {
    ctx.fillStyle = COLORS.bg;

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    if (skyMode === "stars") {
        drawStars();
    } else {
        drawNebula();
    }
}

function drawGame() {
    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    drawBackground();

    for (const crater of craters) {
        drawCrater(crater);
    }

    for (const ufo of ufos) {
        drawUFO(ufo);
    }

    drawTerrain();
    drawAvi();
}

/* ==========================================================
   GAME LOOP
========================================================== */

function gameLoop(timestamp) {
    if (!running) return;

    if (!lastTime) {
        lastTime = timestamp;
    }

    const delta = Math.min(
        timestamp - lastTime,
        40
    );

    lastTime = timestamp;

    if (!paused) {
        updateAvi(delta);
        updateCraters(delta);
        updateUFOs(delta);

        updateScore(delta);
        checkCollisions();
    }

    drawGame();

    animationFrame =
        requestAnimationFrame(gameLoop);
}

/* ==========================================================
   START
========================================================== */

function startGame() {
    ensureAudio();

    running = true;
    paused = false;
    gameStarted = true;

    score = 0;
    distance = 0;
    lastSkyMilestone = 0;
    skyMode = "stars";

    resetAvi();

    initializeStars();
    initializeCraters();
    initializeUFOs();

    scoreDisplay.textContent = "0";
    highScoreDisplay.textContent =
        highScore.toString();

    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");

    pauseButton.textContent = "Pause";
    pauseButton.classList.remove("active");

    lastTime = 0;

    cancelAnimationFrame(animationFrame);

    animationFrame =
        requestAnimationFrame(gameLoop);

    playStartSound();
}

/* ==========================================================
   GAME OVER
========================================================== */

function endGame() {
    if (!running) return;

    running = false;
    paused = false;

    cancelAnimationFrame(animationFrame);

    finalScoreDisplay.textContent =
        `Score ${Math.floor(score)}`;

    gameOverScreen.classList.remove("hidden");

    pauseButton.textContent = "Pause";
    pauseButton.classList.remove("active");

    playGameOverSound();
}

/* ==========================================================
   RESET
========================================================== */

function resetGame() {
    running = false;
    paused = false;

    cancelAnimationFrame(animationFrame);

    score = 0;
    skyMode = "stars";
    lastSkyMilestone = 0;

    resetAvi();

    initializeStars();
    initializeCraters();
    initializeUFOs();

    scoreDisplay.textContent = "0";

    startScreen.classList.remove("hidden");
    gameOverScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");

    pauseButton.textContent = "Pause";
    pauseButton.classList.remove("active");

    drawGame();
}

/* ==========================================================
   PAUSE
========================================================== */

function togglePause() {
    if (!gameStarted || !running) return;

    paused = !paused;

    if (paused) {
        pauseScreen.classList.remove("hidden");
        pauseButton.textContent = "Resume";
        pauseButton.classList.add("active");

        playPauseSound();
    } else {
        pauseScreen.classList.add("hidden");
        pauseButton.textContent = "Pause";
        pauseButton.classList.remove("active");

        lastTime = 0;
        playResumeSound();
    }
}

/* ==========================================================
   SPEED
========================================================== */

speedSlider.addEventListener("input", () => {
    speedSetting = Number(speedSlider.value);

    speedValue.textContent =
        speedSetting.toString();
});

/* ==========================================================
   SOUND ENGINE
========================================================== */

let audioContext = null;

let soundEnabled = true;

function ensureAudio() {
    if (!audioContext) {
        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) return;

        audioContext = new AudioContext();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function playTone(
    frequency,
    duration,
    volume,
    type = "sine",
    slideTo = null
) {
    if (!soundEnabled) return;

    ensureAudio();

    if (!audioContext) return;

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    oscillator.type = type;

    oscillator.frequency.setValueAtTime(
        frequency,
        audioContext.currentTime
    );

    if (slideTo !== null) {
        oscillator.frequency.exponentialRampToValueAtTime(
            slideTo,
            audioContext.currentTime + duration
        );
    }

    /*
        Louder than the previous version, but still
        bounded so it doesn't become an obnoxious blast.
    */

    gain.gain.setValueAtTime(
        0.0001,
        audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        Math.min(volume, 0.25),
        audioContext.currentTime + 0.008
    );

    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(
        audioContext.currentTime + duration + 0.02
    );
}

function playStartSound() {
    playTone(440, 0.09, 0.17, "triangle", 520);

    setTimeout(() => {
        playTone(660, 0.12, 0.18, "triangle", 740);
    }, 80);
}

function playJumpSound() {
    playTone(380, 0.12, 0.16, "square", 650);
}

function playGameOverSound() {
    playTone(300, 0.15, 0.18, "triangle", 220);

    setTimeout(() => {
        playTone(220, 0.22, 0.17, "triangle", 150);
    }, 120);
}

function playPauseSound() {
    playTone(420, 0.08, 0.14, "sine", 330);
}

function playResumeSound() {
    playTone(330, 0.08, 0.14, "sine", 440);
}

/* ==========================================================
   SOUND TOGGLE
========================================================== */

soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    soundToggle.classList.toggle(
        "active",
        soundEnabled
    );

    soundToggle.setAttribute(
        "aria-pressed",
        soundEnabled.toString()
    );

    soundLabel.textContent =
        soundEnabled ? "On" : "Off";

    if (soundEnabled) {
        ensureAudio();
        playTone(520, 0.09, 0.16, "triangle", 650);
    }
});

/* ==========================================================
   CONTROLS
========================================================== */

startButton.addEventListener(
    "click",
    startGame
);

restartButton.addEventListener(
    "click",
    startGame
);

resumeButton.addEventListener(
    "click",
    togglePause
);

pauseButton.addEventListener(
    "click",
    togglePause
);

resetButton.addEventListener(
    "click",
    resetGame
);

/* ==========================================================
   KEYBOARD
========================================================== */

window.addEventListener("keydown", (event) => {

    if (
        event.code === "Space" ||
        event.code === "ArrowUp"
    ) {
        event.preventDefault();

        if (!gameStarted || !running) {
            startGame();
            return;
        }

        jump();
    }

    if (event.code === "KeyP") {
        togglePause();
    }

    if (event.code === "KeyR") {
        resetGame();
    }
});

/* ==========================================================
   POINTER / TOUCH
========================================================== */

canvas.addEventListener(
    "pointerdown",
    () => {
        if (!gameStarted || !running) {
            startGame();
            return;
        }

        jump();
    }
);

/* ==========================================================
   INITIALIZE
========================================================== */

resizeCanvas();

resetAvi();
initializeStars();
initializeCraters();
initializeUFOs();

highScoreDisplay.textContent =
    highScore.toString();

speedSlider.value = "1";
speedSetting = 1;
speedValue.textContent = "1";

drawGame();
