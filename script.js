/* ==========================================================
   AVENMARK AVI RUNNER
   FINAL GAME ENGINE
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
const rocketIntro = document.getElementById("rocket-intro");

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
    space: "#103159",
    spaceDeep: "#071D38",
    spaceMid: "#123F70",
    white: "#FFFFFF"
};

/* ==========================================================
   CANVAS
========================================================== */

let width = 1;
let height = 1;
let groundY = 1;
let dpr = 1;

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);

    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    groundY = height * 0.78;

    if (avi) {
        avi.x = Math.max(46, width * 0.105);

        if (avi.grounded) {
            avi.y = groundY - avi.height;
        }
    }

    if (gameStarted && !introRunning) {
        drawGame();
    }
}

window.addEventListener("resize", resizeCanvas);

/* ==========================================================
   GAME STATE
========================================================== */

let running = false;
let paused = false;
let gameStarted = false;
let introRunning = false;

let animationFrame = null;
let lastTime = 0;

let score = 0;
let highScore = Number(
    localStorage.getItem("avenmark-avi-high-score") || 0
);

let speedSetting = 1;

let worldDistance = 0;

const BASE_SPEED = 5.05;

/*
    0 = slightly slower than normal
    1 = normal
    2-5 = progressively faster
*/

function getSpeedMultiplier() {
    if (speedSetting === 0) return 0.84;
    if (speedSetting === 1) return 1.0;

    return 1 + (speedSetting - 1) * 0.28;
}

function getGameSpeed() {
    return BASE_SPEED * getSpeedMultiplier();
}

/* ==========================================================
   WORLD MILESTONES
========================================================== */

let lastContinueMilestone = 0;
let lastSkyMilestone = 0;

let skyMode = "copper";

function updateMilestones() {
    const currentScore = Math.floor(score);

    /*
        Continue plz every 1500.
    */

    const continueMilestone =
        Math.floor(currentScore / 1500);

    if (
        continueMilestone > 0 &&
        continueMilestone > lastContinueMilestone
    ) {
        lastContinueMilestone = continueMilestone;
        showContinueMessage();
    }

    /*
        Sky changes every 2500.

        0-2499  copper
        2500-4999 blue
        5000-7499 copper
        7500-9999 blue
        etc.
    */

    const skyMilestone =
        Math.floor(currentScore / 2500);

    if (skyMilestone !== lastSkyMilestone) {
        lastSkyMilestone = skyMilestone;

        skyMode =
            skyMilestone % 2 === 0
                ? "copper"
                : "nebula";

        createSkyTransition();
    }
}

/* ==========================================================
   SKY TRANSITION
========================================================== */

let skyTransition = 0;

function createSkyTransition() {
    skyTransition = 1;
}

/* ==========================================================
   AVI
========================================================== */

const avi = {
    x: 80,
    y: 0,

    width: 66,
    height: 82,

    velocityY: 0,

    gravity: 0.62,
    jumpForce: -12.8,

    grounded: true,

    runTime: 0,
    jumpTime: 0
};

function resetAvi() {
    avi.x = Math.max(46, width * 0.105);
    avi.y = groundY - avi.height;

    avi.velocityY = 0;
    avi.grounded = true;

    avi.runTime = 0;
    avi.jumpTime = 0;
}

function jump() {
    if (!running || paused || introRunning) return;

    if (avi.grounded) {
        avi.velocityY = avi.jumpForce;
        avi.grounded = false;
        avi.jumpTime = 0;

        playJumpSound();
    }
}

/* ==========================================================
   OBSTACLE SYSTEM
==========================================================

   IMPORTANT:
   Craters and UFOs share one obstacle timeline.

   This means they can NEVER be generated on top of
   one another.

========================================================== */

const obstacles = [];

let obstacleCursor = 0;

function clearObstacles() {
    obstacles.length = 0;
    obstacleCursor = 0;
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(random(min, max + 1));
}

/* ==========================================================
   OBSTACLE CREATION
========================================================== */

function createCraters() {
    clearObstacles();

    obstacleCursor = width + 320;

    /*
        Large, intentional gaps.

        We deliberately create fewer craters than before.
    */

    for (let i = 0; i < 8; i++) {
        obstacleCursor += random(320, 600);

        createCrater(obstacleCursor);
    }

    /*
        Add UFOs separately into the same timeline.
        They are never allowed to share a location
        with a crater.
    */

    let ufoCursor = width + 950;

    for (let i = 0; i < 5; i++) {
        ufoCursor += random(650, 1000);

        createUFO(ufoCursor);
    }

    sortObstacles();
}

function createCrater(x) {
    const widthSize = randomInt(30, 76);

    obstacles.push({
        type: "crater",

        x,

        width: widthSize,
        height: randomInt(13, 23),

        passed: false,

        /*
            Unique shape values make each crater
            look naturally different.
        */

        rim: random(0.85, 1.2),
        depth: random(0.65, 1.0),

        leftSlope: random(0.8, 1.15),
        rightSlope: random(0.8, 1.15)
    });
}

function createUFO(x) {
    obstacles.push({
        type: "ufo",

        x,

        width: randomInt(54, 72),
        height: randomInt(27, 34),

        yOffset: random(90, 160),

        passed: false,

        bob: random(0, Math.PI * 2),

        bobSpeed: random(0.0015, 0.0026)
    });
}

function sortObstacles() {
    obstacles.sort((a, b) => a.x - b.x);
}

/* ==========================================================
   OBSTACLE SPAWNING
========================================================== */

function getLastObstacle() {
    if (!obstacles.length) return null;

    return obstacles[obstacles.length - 1];
}

function spawnNextObstacle() {
    const last = getLastObstacle();

    let startX =
        last
            ? last.x + last.width
            : width + 400;

    /*
        Minimum spacing guarantees that obstacles
        never visually merge.
    */

    const gap = random(330, 650);

    startX += gap;

    /*
        Alternate intelligently rather than randomly
        stacking objects together.

        Ground -> air -> ground -> air...
    */

    let nextType = "crater";

    if (last) {
        nextType =
            last.type === "crater"
                ? "ufo"
                : "crater";
    }

    if (nextType === "crater") {
        createCrater(startX);
    } else {
        createUFO(startX);
    }

    sortObstacles();
}

/* ==========================================================
   OBSTACLE UPDATE
========================================================== */

function updateObstacles(delta) {
    /*
        Convert milliseconds into stable movement.
    */

    const frameScale = delta / 16.6667;

    const movement =
        getGameSpeed() * frameScale;

    for (const obstacle of obstacles) {
        obstacle.x -= movement;

        if (obstacle.type === "ufo") {
            obstacle.bob +=
                obstacle.bobSpeed * delta;
        }
    }

    /*
        Remove objects far off-screen.
    */

    while (
        obstacles.length &&
        obstacles[0].x +
            obstacles[0].width <
            -120
    ) {
        obstacles.shift();
    }

    /*
        Maintain a healthy amount of future terrain.
    */

    while (
        obstacles.length < 7
    ) {
        spawnNextObstacle();
    }
}

/* ==========================================================
   CRATER DRAWING
========================================================== */

function drawCrater(obstacle) {
    const x = obstacle.x;
    const y = groundY + 2;

    const w = obstacle.width;
    const h = obstacle.height;

    ctx.save();

    /*
        Outer rim.
    */

    ctx.strokeStyle =
        "rgba(47,47,47,0.42)";

    ctx.lineWidth = 2.4;

    ctx.beginPath();

    ctx.moveTo(
        x,
        y
    );

    ctx.bezierCurveTo(
        x + w * 0.14,
        y - h * 0.72,
        x + w * 0.30,
        y - h * 1.05,
        x + w * 0.50,
        y - h * 0.94
    );

    ctx.bezierCurveTo(
        x + w * 0.70,
        y - h * 1.05,
        x + w * 0.87,
        y - h * 0.72,
        x + w,
        y
    );

    ctx.stroke();

    /*
        Dark inner depression.
    */

    ctx.fillStyle =
        "rgba(47,47,47,0.15)";

    ctx.beginPath();

    ctx.ellipse(
        x + w * 0.50,
        y - h * 0.24,
        w * 0.34,
        h * 0.47,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /*
        Inner shadow.
    */

    ctx.strokeStyle =
        "rgba(47,47,47,0.28)";

    ctx.lineWidth = 1.5;

    ctx.beginPath();

    ctx.ellipse(
        x + w * 0.50,
        y - h * 0.30,
        w * 0.25,
        h * 0.25,
        0,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    /*
        Small irregular edge highlights.
    */

    ctx.strokeStyle =
        "rgba(196,122,69,0.24)";

    ctx.lineWidth = 1.4;

    ctx.beginPath();

    ctx.moveTo(
        x + w * 0.14,
        y - h * 0.38
    );

    ctx.quadraticCurveTo(
        x + w * 0.25,
        y - h * 0.72,
        x + w * 0.37,
        y - h * 0.80
    );

    ctx.stroke();

    ctx.restore();
}

/* ==========================================================
   UFO DRAWING
========================================================== */

function getUFOY(ufo) {
    return (
        groundY -
        ufo.yOffset +
        Math.sin(ufo.bob) * 5
    );
}

function drawUFO(ufo) {
    const x = ufo.x;
    const y = getUFOY(ufo);

    const w = ufo.width;
    const h = ufo.height;

    const cx = x + w / 2;

    ctx.save();

    /*
        Main saucer body.
    */

    ctx.fillStyle = COLORS.space;

    ctx.beginPath();

    ctx.ellipse(
        cx,
        y + h * 0.58,
        w * 0.50,
        h * 0.30,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /*
        Upper dome.
    */

    ctx.fillStyle =
        "rgba(16,49,89,0.94)";

    ctx.beginPath();

    ctx.ellipse(
        cx,
        y + h * 0.40,
        w * 0.24,
        h * 0.34,
        0,
        Math.PI,
        Math.PI * 2
    );

    ctx.fill();

    /*
        Dome glass.
    */

    ctx.fillStyle =
        "rgba(245,245,242,0.92)";

    ctx.beginPath();

    ctx.ellipse(
        cx,
        y + h * 0.37,
        w * 0.17,
        h * 0.20,
        0,
        Math.PI,
        Math.PI * 2
    );

    ctx.fill();

    /*
        Copper underside lights.
    */

    const lightY = y + h * 0.72;

    ctx.fillStyle = COLORS.copper;

    for (let i = 0; i < 5; i++) {
        const lightX =
            x +
            w * (0.22 + i * 0.14);

        ctx.beginPath();

        ctx.arc(
            lightX,
            lightY,
            2.2,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    /*
        Soft UFO glow.
    */

    const glow =
        ctx.createRadialGradient(
            cx,
            y + h * 0.85,
            1,
            cx,
            y + h * 0.85,
            w * 0.45
        );

    glow.addColorStop(
        0,
        "rgba(196,122,69,0.18)"
    );

    glow.addColorStop(
        1,
        "rgba(196,122,69,0)"
    );

    ctx.fillStyle = glow;

    ctx.fillRect(
        x - w * 0.2,
        y + h * 0.55,
        w * 1.4,
        h * 0.9
    );

    ctx.restore();
}

/* ==========================================================
   STARS
========================================================== */

const stars = [];

function initializeStars() {
    stars.length = 0;

    const count =
        Math.max(
            50,
            Math.floor(width * 0.07)
        );

    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * width,

            y:
                Math.random() *
                Math.max(100, groundY * 0.75),

            size: random(0.8, 2.2),

            alpha: random(0.35, 0.95),

            twinkle:
                random(0, Math.PI * 2)
        });
    }
}

function drawCopperStars(timestamp) {
    ctx.save();

    for (const star of stars) {
        const pulse =
            0.78 +
            Math.sin(
                timestamp * 0.001 +
                star.twinkle
            ) *
                0.18;

        ctx.globalAlpha =
            star.alpha * pulse;

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
   BLUE GALAXY / NEBULA
========================================================== */

const nebulaClouds = [];

function initializeNebula() {
    nebulaClouds.length = 0;

    for (let i = 0; i < 8; i++) {
        nebulaClouds.push({
            x: random(-width * 0.2, width * 1.2),
            y: random(30, groundY * 0.58),
            radius: random(90, 230),
            alpha: random(0.07, 0.18)
        });
    }
}

function drawNebula(timestamp) {
    /*
        Deep-space base.
    */

    const background =
        ctx.createLinearGradient(
            0,
            0,
            0,
            groundY
        );

    background.addColorStop(
        0,
        "#071D38"
    );

    background.addColorStop(
        0.48,
        "#0B2C50"
    );

    background.addColorStop(
        1,
        "#103159"
    );

    ctx.fillStyle = background;

    ctx.fillRect(
        0,
        0,
        width,
        groundY
    );

    /*
        Large visible nebula clouds.
    */

    for (const cloud of nebulaClouds) {
        const gradient =
            ctx.createRadialGradient(
                cloud.x,
                cloud.y,
                0,
                cloud.x,
                cloud.y,
                cloud.radius
            );

        gradient.addColorStop(
            0,
            `rgba(57,124,190,${cloud.alpha})`
        );

        gradient.addColorStop(
            0.45,
            `rgba(28,81,137,${cloud.alpha * 0.65})`
        );

        gradient.addColorStop(
            1,
            "rgba(7,29,56,0)"
        );

        ctx.fillStyle = gradient;

        ctx.fillRect(
            cloud.x - cloud.radius,
            cloud.y - cloud.radius,
            cloud.radius * 2,
            cloud.radius * 2
        );
    }

    /*
        Galaxy streak.
    */

    ctx.save();

    ctx.translate(
        width * 0.52,
        groundY * 0.34
    );

    ctx.rotate(-0.16);

    const galaxy =
        ctx.createLinearGradient(
            -width * 0.55,
            0,
            width * 0.55,
            0
        );

    galaxy.addColorStop(
        0,
        "rgba(35,92,150,0)"
    );

    galaxy.addColorStop(
        0.25,
        "rgba(66,136,193,0.08)"
    );

    galaxy.addColorStop(
        0.5,
        "rgba(113,172,219,0.16)"
    );

    galaxy.addColorStop(
        0.75,
        "rgba(66,136,193,0.08)"
    );

    galaxy.addColorStop(
        1,
        "rgba(35,92,150,0)"
    );

    ctx.fillStyle = galaxy;

    ctx.fillRect(
        -width * 0.65,
        -65,
        width * 1.3,
        130
    );

    ctx.restore();

    /*
        Bright blue-white stars.
    */

    ctx.save();

    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        const pulse =
            0.65 +
            Math.sin(
                timestamp * 0.0013 +
                star.twinkle
            ) *
                0.25;

        ctx.globalAlpha =
            Math.min(
                1,
                star.alpha * pulse
            );

        ctx.fillStyle =
            i % 7 === 0
                ? "#C9E6FF"
                : "#FFFFFF";

        ctx.beginPath();

        ctx.arc(
            star.x,
            star.y,
            Math.max(
                0.8,
                star.size * 0.85
            ),
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();

    /*
        A few larger galaxy stars.
    */

    ctx.save();

    for (let i = 0; i < 9; i++) {
        const x =
            ((i * 263) + 91) %
            width;

        const y =
            ((i * 109) + 55) %
            Math.max(
                120,
                groundY * 0.65
            );

        ctx.globalAlpha =
            0.65 +
            Math.sin(
                timestamp * 0.001 +
                i
            ) *
                0.2;

        ctx.fillStyle = "#DCEEFF";

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            1.7,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.restore();
}

/* ==========================================================
   TERRAIN
========================================================== */

function drawTerrain() {
    ctx.save();

    ctx.strokeStyle =
        skyMode === "nebula"
            ? "rgba(245,245,242,0.42)"
            : "rgba(47,47,47,0.30)";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.moveTo(
        0,
        groundY
    );

    ctx.lineTo(
        width,
        groundY
    );

    ctx.stroke();

    /*
        Tiny surface texture.
    */

    ctx.globalAlpha =
        skyMode === "nebula"
            ? 0.16
            : 0.08;

    ctx.lineWidth = 1;

    ctx.beginPath();

    for (
        let x = 0;
        x <= width;
        x += 30
    ) {
        const bump =
            Math.sin(x * 0.028) * 1.8 +
            Math.sin(x * 0.071) * 1.1;

        if (x === 0) {
            ctx.moveTo(
                x,
                groundY + bump
            );
        } else {
            ctx.lineTo(
                x,
                groundY + bump
            );
        }
    }

    ctx.stroke();

    ctx.restore();
}

/* ==========================================================
   AVI CHARACTER
==========================================================

   Avi is deliberately drawn as a friendly character.

   He faces RIGHT.

   The laptop is clearly identifiable.

========================================================== */

function drawAvi(timestamp) {
    const x = avi.x;
    const y = avi.y;

    const runningAnimation =
        Math.sin(
            avi.runTime * 0.020
        );

    const legSwing =
        avi.grounded
            ? runningAnimation * 5
            : 0;

    const armSwing =
        avi.grounded
            ? runningAnimation * 2
            : 0;

    const bob =
        avi.grounded
            ? Math.abs(
                Math.sin(
                    avi.runTime * 0.020
                )
            ) * 1.5
            : 0;

    ctx.save();

    ctx.translate(
        x,
        y + bob
    );

    /*
        Backpack.
    */

    ctx.fillStyle = COLORS.dark;

    roundRect(
        ctx,
        8,
        31,
        14,
        30,
        5
    );

    ctx.fill();

    ctx.fillStyle =
        COLORS.copper;

    roundRect(
        ctx,
        11,
        38,
        4,
        11,
        2
    );

    ctx.fill();

    /*
        Legs behind body.
    */

    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";

    ctx.beginPath();

    ctx.moveTo(
        28,
        58
    );

    ctx.lineTo(
        23 + legSwing,
        73
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
        43,
        58
    );

    ctx.lineTo(
        48 - legSwing,
        73
    );

    ctx.stroke();

    /*
        Boots.
    */

    ctx.lineWidth = 6;

    ctx.beginPath();

    ctx.moveTo(
        20 + legSwing,
        73
    );

    ctx.lineTo(
        28 + legSwing,
        73
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
        45 - legSwing,
        73
    );

    ctx.lineTo(
        53 - legSwing,
        73
    );

    ctx.stroke();

    /*
        Body.
    */

    ctx.fillStyle = COLORS.dark;

    roundRect(
        ctx,
        19,
        28,
        29,
        33,
        10
    );

    ctx.fill();

    /*
        Chest panel.
    */

    ctx.fillStyle = COLORS.bg;

    roundRect(
        ctx,
        27,
        35,
        13,
        11,
        3
    );

    ctx.fill();

    ctx.fillStyle =
        COLORS.copper;

    ctx.fillRect(
        30,
        38,
        7,
        2
    );

    /*
        Neck.
    */

    ctx.fillStyle = COLORS.dark;

    roundRect(
        ctx,
        28,
        22,
        13,
        11,
        4
    );

    ctx.fill();

    /*
        Helmet.
    */

    ctx.fillStyle = COLORS.dark;

    ctx.beginPath();

    ctx.arc(
        37,
        18,
        18,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /*
        Helmet glass.

        Offset toward the RIGHT so Avi
        clearly faces right.
    */

    ctx.fillStyle =
        "#E7E9E7";

    ctx.beginPath();

    ctx.ellipse(
        42,
        18,
        12,
        11,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /*
        Glass reflection.
    */

    ctx.strokeStyle =
        "rgba(255,255,255,0.72)";

    ctx.lineWidth = 1.5;

    ctx.beginPath();

    ctx.arc(
        44,
        15,
        6,
        Math.PI * 1.1,
        Math.PI * 1.7
    );

    ctx.stroke();

    /*
        Small visor edge / face direction cue.
    */

    ctx.fillStyle =
        COLORS.copper;

    ctx.beginPath();

    ctx.arc(
        49,
        19,
        1.6,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /*
        Rear arm.
    */

    ctx.strokeStyle = COLORS.dark;
    ctx.lineWidth = 8;

    ctx.beginPath();

    ctx.moveTo(
        22,
        36
    );

    ctx.lineTo(
        17 - armSwing,
        49
    );

    ctx.stroke();

    /*
        Forward arm holding laptop.
    */

    ctx.beginPath();

    ctx.moveTo(
        43,
        37
    );

    ctx.lineTo(
        51 + armSwing,
        49
    );

    ctx.stroke();

    /*
        LAPTOP SCREEN.

        Much more obviously a laptop now.
    */

    const laptopX = 44;
    const laptopY = 43;

    /*
        Screen shell.
    */

    ctx.fillStyle =
        COLORS.dark;

    roundRect(
        ctx,
        laptopX,
        laptopY,
        22,
        15,
        2.5
    );

    ctx.fill();

    /*
        Screen.
    */

    ctx.fillStyle =
        COLORS.bg;

    roundRect(
        ctx,
        laptopX + 2.5,
        laptopY + 2.5,
        17,
        9,
        1.2
    );

    ctx.fill();

    /*
        Screen detail.
    */

    ctx.fillStyle =
        COLORS.copper;

    ctx.fillRect(
        laptopX + 6,
        laptopY + 5,
        8,
        1.5
    );

    ctx.fillRect(
        laptopX + 6,
        laptopY + 8,
        5,
        1
    );

    /*
        Laptop hinge.
    */

    ctx.fillStyle =
        COLORS.dark;

    ctx.fillRect(
        laptopX + 2,
        laptopY + 13,
        18,
        2
    );

    /*
        Laptop base.
    */

    ctx.beginPath();

    ctx.moveTo(
        laptopX - 4,
        laptopY + 15
    );

    ctx.lineTo(
        laptopX + 22,
        laptopY + 15
    );

    ctx.lineTo(
        laptopX + 26,
        laptopY + 19
    );

    ctx.lineTo(
        laptopX - 7,
        laptopY + 19
    );

    ctx.closePath();

    ctx.fill();

    /*
        Small copper indicator.
    */

    ctx.fillStyle =
        COLORS.copper;

    ctx.beginPath();

    ctx.arc(
        laptopX + 9,
        laptopY + 16.5,
        1,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}

/* ==========================================================
   DRAW HELPERS
========================================================== */

function roundRect(
    context,
    x,
    y,
    w,
    h,
    radius
) {
    const r =
        Math.min(
            radius,
            w / 2,
            h / 2
        );

    context.beginPath();

    context.moveTo(
        x + r,
        y
    );

    context.lineTo(
        x + w - r,
        y
    );

    context.quadraticCurveTo(
        x + w,
        y,
        x + w,
        y + r
    );

    context.lineTo(
        x + w,
        y + h - r
    );

    context.quadraticCurveTo(
        x + w,
        y + h,
        x + w - r,
        y + h
    );

    context.lineTo(
        x + r,
        y + h
    );

    context.quadraticCurveTo(
        x,
        y + h,
        x,
        y + h - r
    );

    context.lineTo(
        x,
        y + r
    );

    context.quadraticCurveTo(
        x,
        y,
        x + r,
        y
    );

    context.closePath();
}

/* ==========================================================
   COLLISION SYSTEM
========================================================== */

function getAviHitbox() {
    /*
        Deliberately excludes the backpack and tiny edges
        to make collisions feel fair.
    */

    return {
        x: avi.x + 18,
        y: avi.y + 9,

        width: 43,
        height: 63
    };
}

function getCraterHitbox(crater) {
    /*
        The crater's actual dangerous region is the
        depression itself.

        It sits directly on the ground.
    */

    return {
        x: crater.x + crater.width * 0.10,

        y:
            groundY -
            Math.max(
                7,
                crater.height * 0.78
            ),

        width:
            crater.width * 0.80,

        height:
            Math.max(
                10,
                crater.height * 0.92
            )
    };
}

function getUFOHitbox(ufo) {
    const y = getUFOY(ufo);

    return {
        x: ufo.x + 7,

        y: y + 5,

        width: ufo.width - 14,

        height: ufo.height - 9
    };
}

function intersects(a, b) {
    return (
        a.x <
            b.x + b.width &&
        a.x + a.width >
            b.x &&
        a.y <
            b.y + b.height &&
        a.y + a.height >
            b.y
    );
}

function checkCollisions() {
    const player =
        getAviHitbox();

    for (const obstacle of obstacles) {
        let hitbox;

        if (
            obstacle.type ===
            "crater"
        ) {
            hitbox =
                getCraterHitbox(
                    obstacle
                );
        } else {
            hitbox =
                getUFOHitbox(
                    obstacle
                );
        }

        if (
            intersects(
                player,
                hitbox
            )
        ) {
            endGame();
            return true;
        }
    }

    return false;
}

/* ==========================================================
   SCORE
========================================================== */

function updateScore(delta) {
    const frameScale =
        delta / 16.6667;

    score +=
        0.075 *
        getSpeedMultiplier() *
        frameScale;

    const displayedScore =
        Math.floor(score);

    scoreDisplay.textContent =
        displayedScore.toString();

    if (
        displayedScore >
        highScore
    ) {
        highScore =
            displayedScore;

        highScoreDisplay.textContent =
            highScore.toString();

        localStorage.setItem(
            "avenmark-avi-high-score",
            highScore.toString()
        );
    }

    updateMilestones();
}

/* ==========================================================
   CONTINUE MESSAGE
========================================================== */

let continueTimeout = null;

function showContinueMessage() {
    clearTimeout(
        continueTimeout
    );

    continueMessage.classList.add(
        "show"
    );

    continueTimeout =
        setTimeout(() => {
            continueMessage.classList.remove(
                "show"
            );
        }, 1200);
}

/* ==========================================================
   AVI PHYSICS
========================================================== */

function updateAvi(delta) {
    const frameScale =
        delta / 16.6667;

    if (!avi.grounded) {
        avi.velocityY +=
            avi.gravity *
            frameScale;

        avi.y +=
            avi.velocityY *
            frameScale;

        avi.jumpTime +=
            delta;

        if (
            avi.y >=
            groundY -
                avi.height
        ) {
            avi.y =
                groundY -
                avi.height;

            avi.velocityY = 0;
            avi.grounded = true;
            avi.jumpTime = 0;
        }
    }

    avi.runTime += delta;
}

/* ==========================================================
   BACKGROUND
========================================================== */

function drawBackground(timestamp) {
    if (skyMode === "nebula") {
        drawNebula(timestamp);
    } else {
        ctx.fillStyle =
            COLORS.bg;

        ctx.fillRect(
            0,
            0,
            width,
            height
        );

        drawCopperStars(timestamp);
    }

    /*
        Smooth visual transition flash.
    */

    if (skyTransition > 0) {
        ctx.save();

        ctx.globalAlpha =
            skyTransition * 0.12;

        ctx.fillStyle =
            skyMode === "nebula"
                ? COLORS.space
                : COLORS.copper;

        ctx.fillRect(
            0,
            0,
            width,
            groundY
        );

        ctx.restore();

        skyTransition -=
            0.025;

        if (
            skyTransition < 0
        ) {
            skyTransition = 0;
        }
    }
}

/* ==========================================================
   COMPLETE DRAW
========================================================== */

function drawGame(timestamp = 0) {
    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    drawBackground(
        timestamp
    );

    /*
        Obstacles are drawn before Avi
        so Avi remains visually dominant.
    */

    for (
        const obstacle of obstacles
    ) {
        if (
            obstacle.type ===
            "crater"
        ) {
            drawCrater(
                obstacle
            );
        } else {
            drawUFO(
                obstacle
            );
        }
    }

    drawTerrain();

    drawAvi(timestamp);
}

/* ==========================================================
   ROCKET INTRO
==========================================================

   Sequence:

   Start
      ↓
   rocket appears
      ↓
   rocket exits
      ↓
   Avi drops in
      ↓
   Avi lands
      ↓
   running begins

========================================================== */

function playRocketIntro() {
    return new Promise((resolve) => {
        introRunning = true;

        rocketIntro.classList.remove(
            "hidden"
        );

        /*
            The CSS handles the rocket visual.
            The canvas handles Avi's actual entrance.
        */

        const introDuration =
            1050;

        const start =
            performance.now();

        function introFrame(now) {
            const elapsed =
                now - start;

            const progress =
                Math.min(
                    1,
                    elapsed /
                        introDuration
                );

            /*
                Hide the normal start UI.
            */

            startScreen.classList.add(
                "hidden"
            );

            /*
                Rocket layer stays visible
                until the final part.
            */

            if (
                progress >= 0.72
            ) {
                rocketIntro.classList.add(
                    "hidden"
                );
            }

            /*
                Avi drops from above.
            */

            const dropStart =
                -avi.height - 30;

            const dropEnd =
                groundY -
                avi.height;

            const dropProgress =
                Math.max(
                    0,
                    Math.min(
                        1,
                        (progress -
                            0.48) /
                            0.52
                    )
                );

            const eased =
                1 -
                Math.pow(
                    1 -
                        dropProgress,
                    3
                );

            if (
                progress < 0.48
            ) {
                avi.y =
                    dropStart;
            } else {
                avi.y =
                    dropStart +
                    (dropEnd -
                        dropStart) *
                        eased;
            }

            /*
                Tiny landing squash.
            */

            if (
                progress >= 0.94
            ) {
                avi.y =
                    groundY -
                    avi.height;
            }

            drawGame(now);

            if (
                progress < 1
            ) {
                requestAnimationFrame(
                    introFrame
                );
            } else {
                rocketIntro.classList.add(
                    "hidden"
                );

                avi.y =
                    groundY -
                    avi.height;

                avi.grounded = true;

                introRunning = false;

                resolve();
            }
        }

        requestAnimationFrame(
            introFrame
        );
    });
}

/* ==========================================================
   GAME LOOP
========================================================== */

function gameLoop(timestamp) {
    if (!running) {
        return;
    }

    if (!lastTime) {
        lastTime = timestamp;
    }

    const delta =
        Math.min(
            timestamp -
                lastTime,
            40
        );

    lastTime = timestamp;

    if (!paused && !introRunning) {
        updateAvi(delta);

        updateObstacles(delta);

        updateScore(delta);

        /*
            Collision is checked AFTER movement.
            This prevents the old crater bug where
            craters were visible but harmless.
        */

        if (
            checkCollisions()
        ) {
            drawGame(timestamp);
            return;
        }
    }

    drawGame(timestamp);

    animationFrame =
        requestAnimationFrame(
            gameLoop
        );
}

/* ==========================================================
   START GAME
========================================================== */

async function startGame() {
    if (
        introRunning
    ) {
        return;
    }

    ensureAudio();

    running = true;
    paused = false;
    gameStarted = true;

    score = 0;

    worldDistance = 0;

    lastContinueMilestone = 0;
    lastSkyMilestone = 0;

    skyMode = "copper";
    skyTransition = 0;

    resetAvi();

    initializeStars();
    initializeNebula();
    createCraters();

    scoreDisplay.textContent =
        "0";

    highScoreDisplay.textContent =
        highScore.toString();

    startScreen.classList.add(
        "hidden"
    );

    gameOverScreen.classList.add(
        "hidden"
    );

    pauseScreen.classList.add(
        "hidden"
    );

    pauseScreen.setAttribute(
        "aria-hidden",
        "true"
    );

    pauseButton.textContent =
        "Pause";

    pauseButton.classList.remove(
        "active"
    );

    cancelAnimationFrame(
        animationFrame
    );

    lastTime = 0;

    /*
        Play the intro before the
        normal runner loop.
    */

    await playRocketIntro();

    if (!running) {
        return;
    }

    playStartSound();

    lastTime = 0;

    animationFrame =
        requestAnimationFrame(
            gameLoop
        );
}

/* ==========================================================
   GAME OVER
========================================================== */

function endGame() {
    if (!running) {
        return;
    }

    running = false;
    paused = false;
    introRunning = false;

    cancelAnimationFrame(
        animationFrame
    );

    const finalScore =
        Math.floor(score);

    finalScoreDisplay.textContent =
        `Score ${finalScore}`;

    gameOverScreen.classList.remove(
        "hidden"
    );

    gameOverScreen.setAttribute(
        "aria-hidden",
        "false"
    );

    pauseScreen.classList.add(
        "hidden"
    );

    pauseScreen.setAttribute(
        "aria-hidden",
        "true"
    );

    pauseButton.textContent =
        "Pause";

    pauseButton.classList.remove(
        "active"
    );

    playGameOverSound();

    drawGame();
}

/* ==========================================================
   RESET
========================================================== */

function resetGame() {
    running = false;
    paused = false;
    gameStarted = false;
    introRunning = false;

    cancelAnimationFrame(
        animationFrame
    );

    rocketIntro.classList.add(
        "hidden"
    );

    score = 0;

    worldDistance = 0;

    lastContinueMilestone = 0;
    lastSkyMilestone = 0;

    skyMode = "copper";
    skyTransition = 0;

    resetAvi();

    initializeStars();
    initializeNebula();
    createCraters();

    scoreDisplay.textContent =
        "0";

    highScoreDisplay.textContent =
        highScore.toString();

    startScreen.classList.remove(
        "hidden"
    );

    gameOverScreen.classList.add(
        "hidden"
    );

    pauseScreen.classList.add(
        "hidden"
    );

    gameOverScreen.setAttribute(
        "aria-hidden",
        "true"
    );

    pauseScreen.setAttribute(
        "aria-hidden",
        "true"
    );

    pauseButton.textContent =
        "Pause";

    pauseButton.classList.remove(
        "active"
    );

    lastTime = 0;

    drawGame();
}

/* ==========================================================
   PAUSE
========================================================== */

function togglePause() {
    if (
        !gameStarted ||
        !running ||
        introRunning
    ) {
        return;
    }

    paused = !paused;

    if (paused) {
        pauseScreen.classList.remove(
            "hidden"
        );

        pauseScreen.setAttribute(
            "aria-hidden",
            "false"
        );

        pauseButton.textContent =
            "Resume";

        pauseButton.classList.add(
            "active"
        );

        playPauseSound();
    } else {
        pauseScreen.classList.add(
            "hidden"
        );

        pauseScreen.setAttribute(
            "aria-hidden",
            "true"
        );

        pauseButton.textContent =
            "Pause";

        pauseButton.classList.remove(
            "active"
        );

        lastTime = 0;

        playResumeSound();
    }
}

/* ==========================================================
   SPEED
========================================================== */

speedSlider.addEventListener(
    "input",
    () => {
        speedSetting =
            Number(
                speedSlider.value
            );

        speedValue.textContent =
            speedSetting.toString();
    }
);

/* ==========================================================
   AUDIO
========================================================== */

let audioContext = null;
let soundEnabled = true;

function ensureAudio() {
    if (!soundEnabled) {
        return;
    }

    if (!audioContext) {
        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {
            return;
        }

        audioContext =
            new AudioContext();
    }

    if (
        audioContext.state ===
        "suspended"
    ) {
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
    if (!soundEnabled) {
        return;
    }

    ensureAudio();

    if (!audioContext) {
        return;
    }

    const now =
        audioContext.currentTime;

    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();

    oscillator.type = type;

    oscillator.frequency.setValueAtTime(
        frequency,
        now
    );

    if (
        slideTo !== null
    ) {
        oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(
                20,
                slideTo
            ),
            now + duration
        );
    }

    /*
        Stronger than the previous sound,
        while still keeping it controlled.
    */

    const peak =
        Math.min(
            0.32,
            Math.max(
                0.04,
                volume
            )
        );

    gain.gain.setValueAtTime(
        0.0001,
        now
    );

    gain.gain.exponentialRampToValueAtTime(
        peak,
        now + 0.012
    );

    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + duration
    );

    oscillator.connect(gain);
    gain.connect(
        audioContext.destination
    );

    oscillator.start(now);

    oscillator.stop(
        now +
            duration +
            0.025
    );
}

function playStartSound() {
    playTone(
        440,
        0.10,
        0.22,
        "triangle",
        540
    );

    setTimeout(() => {
        playTone(
            580,
            0.10,
            0.22,
            "triangle",
            700
        );
    }, 85);

    setTimeout(() => {
        playTone(
            740,
            0.14,
            0.24,
            "triangle",
            900
        );
    }, 170);
}

function playJumpSound() {
    playTone(
        360,
        0.12,
        0.22,
        "square",
        650
    );
}

function playGameOverSound() {
    playTone(
        310,
        0.14,
        0.23,
        "triangle",
        240
    );

    setTimeout(() => {
        playTone(
            230,
            0.20,
            0.22,
            "triangle",
            145
        );
    }, 120);
}

function playPauseSound() {
    playTone(
        430,
        0.09,
        0.18,
        "sine",
        330
    );
}

function playResumeSound() {
    playTone(
        330,
        0.09,
        0.18,
        "sine",
        460
    );
}

/* ==========================================================
   SOUND TOGGLE
========================================================== */

soundToggle.addEventListener(
    "click",
    () => {
        soundEnabled =
            !soundEnabled;

        soundToggle.classList.toggle(
            "active",
            soundEnabled
        );

        soundToggle.setAttribute(
            "aria-pressed",
            soundEnabled.toString()
        );

        soundLabel.textContent =
            soundEnabled
                ? "On"
                : "Off";

        if (soundEnabled) {
            ensureAudio();

            playTone(
                520,
                0.09,
                0.20,
                "triangle",
                660
            );
        }
    }
);

/* ==========================================================
   BUTTON CONTROLS
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

window.addEventListener(
    "keydown",
    (event) => {
        if (
            event.code === "Space" ||
            event.code === "ArrowUp"
        ) {
            event.preventDefault();

            if (
                !gameStarted ||
                !running
            ) {
                startGame();
                return;
            }

            jump();
        }

        if (
            event.code === "KeyP"
        ) {
            togglePause();
        }

        if (
            event.code === "KeyR"
        ) {
            resetGame();
        }
    }
);

/* ==========================================================
   POINTER / TOUCH
========================================================== */

canvas.addEventListener(
    "pointerdown",
    () => {
        if (
            !gameStarted ||
            !running
        ) {
            startGame();
            return;
        }

        jump();
    }
);

/* ==========================================================
   INITIALIZATION
========================================================== */

resizeCanvas();

resetAvi();

initializeStars();

initializeNebula();

createCraters();

highScoreDisplay.textContent =
    highScore.toString();

speedSlider.value = "1";

speedSetting = 1;

speedValue.textContent = "1";

drawGame();
