/* =========================================================
   AVENMARK AVI RUNNER
   script.js

   Main game engine
   ========================================================= */


/* =========================================================
   GAME CONFIGURATION
   ========================================================= */

const GAME = {
    FPS: 60,

    BASE_SPEED: 390,
    MAX_SPEED: 820,
    SPEED_INCREMENT: 0.055,

    GRAVITY: 2350,
    JUMP_VELOCITY: -850,

    STARTING_LIVES: 1,

    SCORE_RATE: 0.022,

    MIN_OBSTACLE_GAP: 310,
    MAX_OBSTACLE_GAP: 650,

    STAR_COUNT: 100,
    SHOOTING_STAR_CHANCE: 0.0025,

    GROUND_HEIGHT: 76,

    PLAYER_WIDTH: 48,
    PLAYER_HEIGHT: 62,

    COLLISION_PADDING: 8,

    HIGH_SCORE_KEY: "avenmark-avi-runner-high-score"
};


/* =========================================================
   DOM REFERENCES
   ========================================================= */

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const gameContainer = document.getElementById("game-container");

const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const pauseScreen = document.getElementById("pause-screen");

const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const resumeButton = document.getElementById("resume-button");

const touchJump = document.getElementById("touch-jump");

const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("high-score");

const finalScoreElement = document.getElementById("final-score");
const finalHighScoreElement = document.getElementById("final-high-score");

const statusText = document.getElementById("status-text");
const statusIndicator = document.getElementById("status-indicator");


/* =========================================================
   CANVAS STATE
   ========================================================= */

let canvasWidth = 0;
let canvasHeight = 0;
let devicePixelRatio = 1;


/* =========================================================
   GAME STATE
   ========================================================= */

const GameState = {
    READY: "ready",
    RUNNING: "running",
    PAUSED: "paused",
    GAME_OVER: "game-over"
};

let gameState = GameState.READY;

let lastTime = 0;
let elapsedTime = 0;

let currentSpeed = GAME.BASE_SPEED;
let score = 0;

let highScore = loadHighScore();

let distance = 0;

let animationFrame = null;

let obstacleTimer = 0;
let nextObstacleDistance = 500;

let groundOffset = 0;


/* =========================================================
   WORLD OBJECTS
   ========================================================= */

let stars = [];
let shootingStars = [];
let obstacles = [];
let particles = [];
let backgroundObjects = [];


/* =========================================================
   PLAYER
   ========================================================= */

const player = {
    x: 0,
    y: 0,

    width: GAME.PLAYER_WIDTH,
    height: GAME.PLAYER_HEIGHT,

    velocityY: 0,

    grounded: true,
    jumping: false,

    squash: 1,
    stretch: 1,

    blinkTimer: 0,
    blinkInterval: 2.7,

    animationTime: 0,
    runFrame: 0,

    reset() {
        this.width = GAME.PLAYER_WIDTH;
        this.height = GAME.PLAYER_HEIGHT;

        this.x = Math.max(
            55,
            canvasWidth * 0.12
        );

        this.y =
            canvasHeight -
            GAME.GROUND_HEIGHT -
            this.height;

        this.velocityY = 0;

        this.grounded = true;
        this.jumping = false;

        this.squash = 1;
        this.stretch = 1;

        this.blinkTimer = 0;
        this.blinkInterval = 2.7;

        this.animationTime = 0;
        this.runFrame = 0;
    },

    jump() {
        if (gameState !== GameState.RUNNING) {
            return;
        }

        if (!this.grounded) {
            return;
        }

        this.velocityY = GAME.JUMP_VELOCITY;

        this.grounded = false;
        this.jumping = true;

        this.squash = 0.86;
        this.stretch = 1.14;

        createJumpParticles();
    },

    update(deltaTime) {
        this.animationTime += deltaTime;

        this.blinkTimer += deltaTime;

        if (this.blinkTimer >= this.blinkInterval) {
            this.blinkTimer = 0;

            this.blinkInterval =
                2.2 +
                Math.random() * 3.8;
        }

        if (!this.grounded) {
            this.velocityY += GAME.GRAVITY * deltaTime;

            this.y += this.velocityY * deltaTime;

            this.stretch = this.velocityY < 0
                ? 1.08
                : 0.96;

            this.squash = 1;

            const groundY =
                canvasHeight -
                GAME.GROUND_HEIGHT -
                this.height;

            if (this.y >= groundY) {
                this.y = groundY;

                this.velocityY = 0;

                this.grounded = true;
                this.jumping = false;

                this.squash = 1.12;
                this.stretch = 0.92;

                createLandingParticles();
            }
        }

        this.squash +=
            (1 - this.squash) *
            Math.min(1, deltaTime * 11);

        this.stretch +=
            (1 - this.stretch) *
            Math.min(1, deltaTime * 11);

        if (this.grounded) {
            this.runFrame =
                Math.floor(
                    this.animationTime * 10
                ) % 2;
        }
    },

    getCollisionBox() {
        return {
            x:
                this.x +
                GAME.COLLISION_PADDING,

            y:
                this.y +
                GAME.COLLISION_PADDING,

            width:
                this.width -
                GAME.COLLISION_PADDING * 2,

            height:
                this.height -
                GAME.COLLISION_PADDING * 2
        };
    },

    draw() {
        drawAvi(
            this.x + this.width / 2,
            this.y + this.height / 2,
            this.squash,
            this.stretch
        );
    }
};


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initialize() {
    resizeCanvas();

    createStars();
    createBackgroundObjects();

    player.reset();

    updateScoreDisplay();

    setStatus("READY");

    draw();

    if (!animationFrame) {
        animationFrame = requestAnimationFrame(gameLoop);
    }
}


/* =========================================================
   CANVAS RESIZING
   ========================================================= */

function resizeCanvas() {
    const rect =
        gameContainer.getBoundingClientRect();

    devicePixelRatio =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    canvasWidth = Math.max(
        1,
        Math.floor(rect.width)
    );

    canvasHeight = Math.max(
        1,
        Math.floor(rect.height)
    );

    canvas.width =
        Math.floor(
            canvasWidth * devicePixelRatio
        );

    canvas.height =
        Math.floor(
            canvasHeight * devicePixelRatio
        );

    canvas.style.width =
        `${canvasWidth}px`;

    canvas.style.height =
        `${canvasHeight}px`;

    ctx.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
    );

    player.x = Math.max(
        55,
        canvasWidth * 0.12
    );

    if (
        gameState === GameState.READY ||
        gameState === GameState.GAME_OVER
    ) {
        player.reset();
    }
}


/* =========================================================
   START GAME
   ========================================================= */

function startGame() {
    resetGame();

    gameState = GameState.RUNNING;

    hideOverlay(startScreen);
    hideOverlay(gameOverScreen);
    hideOverlay(pauseScreen);

    setStatus("MISSION ACTIVE");

    lastTime = performance.now();
}


/* =========================================================
   RESET GAME
   ========================================================= */

function resetGame() {
    score = 0;

    distance = 0;

    elapsedTime = 0;

    currentSpeed =
        GAME.BASE_SPEED;

    obstacleTimer = 0;

    nextObstacleDistance =
        randomRange(
            GAME.MIN_OBSTACLE_GAP,
            GAME.MAX_OBSTACLE_GAP
        );

    groundOffset = 0;

    obstacles = [];
    particles = [];
    shootingStars = [];

    player.reset();

    updateScoreDisplay();
}


/* =========================================================
   GAME LOOP
   ========================================================= */

function gameLoop(timestamp) {
    if (!lastTime) {
        lastTime = timestamp;
    }

    let deltaTime =
        (timestamp - lastTime) / 1000;

    lastTime = timestamp;

    deltaTime =
        Math.min(deltaTime, 0.05);

    if (gameState === GameState.RUNNING) {
        update(deltaTime);
    }

    draw();

    animationFrame =
        requestAnimationFrame(gameLoop);
}


/* =========================================================
   GAME UPDATE
   ========================================================= */

function update(deltaTime) {
    elapsedTime += deltaTime;

    distance +=
        currentSpeed *
        deltaTime;

    score +=
        GAME.SCORE_RATE *
        currentSpeed *
        deltaTime;

    currentSpeed =
        Math.min(
            GAME.MAX_SPEED,
            GAME.BASE_SPEED +
            elapsedTime * 5.2
        );

    groundOffset +=
        currentSpeed *
        deltaTime;

    player.update(deltaTime);

    updateStars(deltaTime);
    updateBackgroundObjects(deltaTime);
    updateObstacles(deltaTime);
    updateParticles(deltaTime);
    updateShootingStars(deltaTime);

    spawnShootingStars();

    updateScoreDisplay();

    checkCollisions();
}


/* =========================================================
   SCORE
   ========================================================= */

function getDisplayedScore() {
    return Math.floor(score);
}

function updateScoreDisplay() {
    const displayed =
        formatScore(getDisplayedScore());

    scoreElement.textContent =
        displayed;

    highScoreElement.textContent =
        formatScore(highScore);
}

function formatScore(value) {
    return String(
        Math.max(0, Math.floor(value))
    ).padStart(5, "0");
}


/* =========================================================
   HIGH SCORE
   ========================================================= */

function loadHighScore() {
    try {
        const stored =
            localStorage.getItem(
                GAME.HIGH_SCORE_KEY
            );

        const parsed =
            Number(stored);

        return Number.isFinite(parsed)
            ? parsed
            : 0;
    } catch {
        return 0;
    }
}

function saveHighScore(value) {
    try {
        localStorage.setItem(
            GAME.HIGH_SCORE_KEY,
            String(value)
        );
    } catch {
        /* Local storage may be unavailable. */
    }
}


/* =========================================================
   GAME OVER
   ========================================================= */

function endGame() {
    if (gameState === GameState.GAME_OVER) {
        return;
    }

    gameState = GameState.GAME_OVER;

    const finalScore =
        getDisplayedScore();

    if (finalScore > highScore) {
        highScore = finalScore;

        saveHighScore(highScore);
    }

    finalScoreElement.textContent =
        formatScore(finalScore);

    finalHighScoreElement.textContent =
        formatScore(highScore);

    updateScoreDisplay();

    setStatus("MISSION ENDED");

    createCrashParticles();

    showOverlay(gameOverScreen);
}


/* =========================================================
   PAUSE
   ========================================================= */

function pauseGame() {
    if (gameState !== GameState.RUNNING) {
        return;
    }

    gameState = GameState.PAUSED;

    setStatus("PAUSED");

    showOverlay(pauseScreen);
}

function resumeGame() {
    if (gameState !== GameState.PAUSED) {
        return;
    }

    gameState = GameState.RUNNING;

    lastTime = performance.now();

    hideOverlay(pauseScreen);

    setStatus("MISSION ACTIVE");
}


/* =========================================================
   OVERLAY HELPERS
   ========================================================= */

function showOverlay(element) {
    element.classList.remove("hidden");
}

function hideOverlay(element) {
    element.classList.add("hidden");
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(text) {
    statusText.textContent = text;

    if (gameState === GameState.RUNNING) {
        statusIndicator.style.opacity = "1";
    } else {
        statusIndicator.style.opacity = "0.45";
    }
}


/* =========================================================
   STARS
   ========================================================= */

function createStars() {
    stars = [];

    for (
        let i = 0;
        i < GAME.STAR_COUNT;
        i++
    ) {
        stars.push({
            x: Math.random() * canvasWidth,

            y:
                Math.random() *
                Math.max(
                    100,
                    canvasHeight * 0.72
                ),

            radius:
                randomRange(0.35, 1.55),

            alpha:
                randomRange(0.25, 0.9),

            speed:
                randomRange(0.025, 0.13),

            twinkle:
                randomRange(0.5, 2.2),

            phase:
                Math.random() * Math.PI * 2
        });
    }
}

function updateStars(deltaTime) {
    for (const star of stars) {
        star.x -=
            currentSpeed *
            star.speed *
            deltaTime;

        if (star.x < -5) {
            star.x =
                canvasWidth + 5;

            star.y =
                Math.random() *
                Math.max(
                    100,
                    canvasHeight * 0.72
                );
        }

        star.phase +=
            star.twinkle *
            deltaTime;
    }
}

function drawStars() {
    for (const star of stars) {
        const alpha =
            star.alpha *
            (
                0.7 +
                Math.sin(star.phase) * 0.3
            );

        ctx.globalAlpha =
            Math.max(0.08, alpha);

        ctx.fillStyle =
            "#FFFFFF";

        ctx.beginPath();

        ctx.arc(
            star.x,
            star.y,
            star.radius,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}


/* =========================================================
   BACKGROUND SPACE OBJECTS
   ========================================================= */

function createBackgroundObjects() {
    backgroundObjects = [];

    const count =
        Math.max(
            3,
            Math.floor(canvasWidth / 260)
        );

    for (let i = 0; i < count; i++) {
        backgroundObjects.push({
            x:
                Math.random() *
                canvasWidth,

            y:
                randomRange(
                    canvasHeight * 0.18,
                    canvasHeight * 0.55
                ),

            size:
                randomRange(18, 46),

            speed:
                randomRange(0.025, 0.075),

            type:
                Math.random() > 0.5
                    ? "planet"
                    : "moon",

            alpha:
                randomRange(0.08, 0.2)
        });
    }
}

function updateBackgroundObjects(deltaTime) {
    for (const object of backgroundObjects) {
        object.x -=
            currentSpeed *
            object.speed *
            deltaTime;

        if (
            object.x <
            -object.size * 2
        ) {
            object.x =
                canvasWidth +
                object.size * 2;

            object.y =
                randomRange(
                    canvasHeight * 0.18,
                    canvasHeight * 0.55
                );
        }
    }
}

function drawBackgroundObjects() {
    for (const object of backgroundObjects) {
        ctx.save();

        ctx.globalAlpha =
            object.alpha;

        if (object.type === "planet") {
            drawPlanet(
                object.x,
                object.y,
                object.size
            );
        } else {
            drawMoon(
                object.x,
                object.y,
                object.size
            );
        }

        ctx.restore();
    }
}


/* =========================================================
   PLANET
   ========================================================= */

function drawPlanet(x, y, size) {
    const gradient =
        ctx.createRadialGradient(
            x - size * 0.35,
            y - size * 0.4,
            size * 0.1,
            x,
            y,
            size
        );

    gradient.addColorStop(
        0,
        "#FFFFFF"
    );

    gradient.addColorStop(
        1,
        "#6078A8"
    );

    ctx.fillStyle = gradient;

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        size,
        0,
        Math.PI * 2
    );

    ctx.fill();
}


/* =========================================================
   MOON
   ========================================================= */

function drawMoon(x, y, size) {
    ctx.fillStyle =
        "#AAB7D0";

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        size,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.globalAlpha *= 0.4;

    ctx.fillStyle =
        "#596783";

    ctx.beginPath();

    ctx.arc(
        x - size * 0.3,
        y - size * 0.15,
        size * 0.18,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.arc(
        x + size * 0.25,
        y + size * 0.3,
        size * 0.12,
        0,
        Math.PI * 2
    );

    ctx.fill();
}


/* =========================================================
   SHOOTING STARS
   ========================================================= */

function spawnShootingStars() {
    if (
        Math.random() >
        GAME.SHOOTING_STAR_CHANCE
    ) {
        return;
    }

    shootingStars.push({
        x:
            randomRange(
                canvasWidth * 0.4,
                canvasWidth + 100
            ),

        y:
            randomRange(
                20,
                canvasHeight * 0.45
            ),

        length:
            randomRange(30, 85),

        speed:
            randomRange(500, 850),

        life: 0,

        maxLife:
            randomRange(0.4, 0.9)
    });
}

function updateShootingStars(deltaTime) {
    for (
        let i = shootingStars.length - 1;
        i >= 0;
        i--
    ) {
        const star =
            shootingStars[i];

        star.life += deltaTime;

        star.x -=
            star.speed *
            deltaTime;

        star.y +=
            star.speed *
            0.32 *
            deltaTime;

        if (
            star.life >=
            star.maxLife
        ) {
            shootingStars.splice(i, 1);
        }
    }
}

function drawShootingStars() {
    for (const star of shootingStars) {
        const alpha =
            1 -
            star.life /
            star.maxLife;

        ctx.save();

        ctx.globalAlpha =
            Math.max(0, alpha);

        const gradient =
            ctx.createLinearGradient(
                star.x,
                star.y,
                star.x + star.length,
                star.y - star.length * 0.32
            );

        gradient.addColorStop(
            0,
            "rgba(255,255,255,0)"
        );

        gradient.addColorStop(
            1,
            "rgba(255,255,255,0.85)"
        );

        ctx.strokeStyle =
            gradient;

        ctx.lineWidth = 1.5;

        ctx.beginPath();

        ctx.moveTo(
            star.x,
            star.y
        );

        ctx.lineTo(
            star.x + star.length,
            star.y -
                star.length * 0.32
        );

        ctx.stroke();

        ctx.restore();
    }
}


/* =========================================================
   OBSTACLES
   =========================================================

   The cactus system from the original Dino game is replaced
   with space obstacles.
   ========================================================= */

const OBSTACLE_TYPES = [
    {
        type: "asteroid",
        width: 42,
        height: 42,
        minScale: 0.85,
        maxScale: 1.2
    },

    {
        type: "satellite",
        width: 54,
        height: 44,
        minScale: 0.85,
        maxScale: 1.1
    },

    {
        type: "spaceRock",
        width: 34,
        height: 50,
        minScale: 0.8,
        maxScale: 1.15
    }
];


function createObstacle() {
    const type =
        OBSTACLE_TYPES[
            Math.floor(
                Math.random() *
                OBSTACLE_TYPES.length
            )
        ];

    const scale =
        randomRange(
            type.minScale,
            type.maxScale
        );

    const obstacle = {
        type: type.type,

        x:
            canvasWidth + 40,

        y: 0,

        width:
            type.width * scale,

        height:
            type.height * scale,

        scale,

        rotation:
            randomRange(
                -0.25,
                0.25
            ),

        rotationSpeed:
            randomRange(
                -0.8,
                0.8
            ),

        passed: false,

        getCollisionBox() {
            return {
                x:
                    this.x +
                    this.width * 0.15,

                y:
                    this.y +
                    this.height * 0.12,

                width:
                    this.width * 0.7,

                height:
                    this.height * 0.76
            };
        }
    };

    obstacle.y =
        canvasHeight -
        GAME.GROUND_HEIGHT -
        obstacle.height;

    return obstacle;
}


function updateObstacles(deltaTime) {
    obstacleTimer += deltaTime;

    const distanceToNext =
        nextObstacleDistance;

    if (
        obstacles.length === 0 ||
        distance >=
            distanceToNext
    ) {
        const obstacle =
            createObstacle();

        obstacles.push(obstacle);

        nextObstacleDistance =
            distance +
            calculateObstacleGap();
    }

    for (
        let i = obstacles.length - 1;
        i >= 0;
        i--
    ) {
        const obstacle =
            obstacles[i];

        obstacle.x -=
            currentSpeed *
            deltaTime;

        obstacle.rotation +=
            obstacle.rotationSpeed *
            deltaTime;

        if (
            !obstacle.passed &&
            obstacle.x +
                obstacle.width <
                player.x
        ) {
            obstacle.passed = true;

            createPassParticles();
        }

        if (
            obstacle.x +
                obstacle.width <
            -100
        ) {
            obstacles.splice(i, 1);
        }
    }
}


function calculateObstacleGap() {
    const speedFactor =
        currentSpeed /
        GAME.BASE_SPEED;

    const difficulty =
        Math.min(
            1.4,
            speedFactor
        );

    const minimum =
        GAME.MIN_OBSTACLE_GAP /
        difficulty;

    const maximum =
        GAME.MAX_OBSTACLE_GAP /
        difficulty;

    return randomRange(
        minimum,
        maximum
    );
}


function drawObstacles() {
    for (const obstacle of obstacles) {
        if (obstacle.type === "asteroid") {
            drawAsteroid(obstacle);
        }

        if (obstacle.type === "satellite") {
            drawSatellite(obstacle);
        }

        if (obstacle.type === "spaceRock") {
            drawSpaceRock(obstacle);
        }
    }
}


/* =========================================================
   ASTEROID
   ========================================================= */

function drawAsteroid(obstacle) {
    const cx =
        obstacle.x +
        obstacle.width / 2;

    const cy =
        obstacle.y +
        obstacle.height / 2;

    const radius =
        obstacle.width / 2;

    ctx.save();

    ctx.translate(cx, cy);

    ctx.rotate(
        obstacle.rotation
    );

    ctx.fillStyle =
        "#7C879D";

    ctx.beginPath();

    const points = 9;

    for (let i = 0; i < points; i++) {
        const angle =
            (
                Math.PI * 2 /
                points
            ) * i;

        const variation =
            0.75 +
            Math.sin(i * 5.7) *
            0.15;

        const r =
            radius *
            variation;

        const px =
            Math.cos(angle) * r;

        const py =
            Math.sin(angle) * r;

        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }

    ctx.closePath();

    ctx.fill();

    ctx.fillStyle =
        "rgba(30,38,55,0.42)";

    ctx.beginPath();

    ctx.arc(
        -radius * 0.22,
        -radius * 0.15,
        radius * 0.18,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.arc(
        radius * 0.22,
        radius * 0.25,
        radius * 0.13,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}


/* =========================================================
   SATELLITE
   ========================================================= */

function drawSatellite(obstacle) {
    const cx =
        obstacle.x +
        obstacle.width / 2;

    const cy =
        obstacle.y +
        obstacle.height / 2;

    ctx.save();

    ctx.translate(cx, cy);

    ctx.rotate(
        obstacle.rotation * 0.3
    );

    /* Solar panels */

    ctx.fillStyle =
        "#455A82";

    ctx.fillRect(
        -obstacle.width * 0.48,
        -obstacle.height * 0.16,
        obstacle.width * 0.28,
        obstacle.height * 0.32
    );

    ctx.fillRect(
        obstacle.width * 0.2,
        -obstacle.height * 0.16,
        obstacle.width * 0.28,
        obstacle.height * 0.32
    );

    /* Panel lines */

    ctx.strokeStyle =
        "rgba(255,255,255,0.2)";

    ctx.lineWidth = 1;

    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();

        ctx.moveTo(
            -obstacle.width * 0.45 +
                i * 5,
            -obstacle.height * 0.16
        );

        ctx.lineTo(
            -obstacle.width * 0.45 +
                i * 5,
            obstacle.height * 0.16
        );

        ctx.stroke();

        ctx.beginPath();

        ctx.moveTo(
            obstacle.width * 0.23 +
                i * 5,
            -obstacle.height * 0.16
        );

        ctx.lineTo(
            obstacle.width * 0.23 +
                i * 5,
            obstacle.height * 0.16
        );

        ctx.stroke();
    }

    /* Main body */

    ctx.fillStyle =
        "#AAB4C7";

    ctx.fillRect(
        -obstacle.width * 0.18,
        -obstacle.height * 0.28,
        obstacle.width * 0.36,
        obstacle.height * 0.56
    );

    /* Dish */

    ctx.strokeStyle =
        "#D7DFEF";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(
        0,
        -obstacle.height * 0.36,
        obstacle.width * 0.16,
        Math.PI,
        Math.PI * 2
    );

    ctx.stroke();

    /* Antenna */

    ctx.beginPath();

    ctx.moveTo(
        0,
        -obstacle.height * 0.35
    );

    ctx.lineTo(
        0,
        -obstacle.height * 0.52
    );

    ctx.stroke();

    ctx.fillStyle =
        "#FFFFFF";

    ctx.beginPath();

    ctx.arc(
        0,
        -obstacle.height * 0.55,
        2,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}


/* =========================================================
   SPACE ROCK
   ========================================================= */

function drawSpaceRock(obstacle) {
    const cx =
        obstacle.x +
        obstacle.width / 2;

    const cy =
        obstacle.y +
        obstacle.height / 2;

    ctx.save();

    ctx.translate(cx, cy);

    ctx.rotate(
        obstacle.rotation
    );

    ctx.fillStyle =
        "#56647D";

    ctx.beginPath();

    ctx.moveTo(
        0,
        -obstacle.height / 2
    );

    ctx.lineTo(
        obstacle.width * 0.42,
        -obstacle.height * 0.2
    );

    ctx.lineTo(
        obstacle.width * 0.35,
        obstacle.height * 0.38
    );

    ctx.lineTo(
        -obstacle.width * 0.08,
        obstacle.height / 2
    );

    ctx.lineTo(
        -obstacle.width * 0.48,
        obstacle.height * 0.18
    );

    ctx.lineTo(
        -obstacle.width * 0.38,
        -obstacle.height * 0.32
    );

    ctx.closePath();

    ctx.fill();

    ctx.fillStyle =
        "rgba(25,32,48,0.4)";

    ctx.beginPath();

    ctx.arc(
        -obstacle.width * 0.15,
        -obstacle.height * 0.12,
        obstacle.width * 0.1,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}


/* =========================================================
   COLLISION
   ========================================================= */

function checkCollisions() {
    const playerBox =
        player.getCollisionBox();

    for (const obstacle of obstacles) {
        const obstacleBox =
            obstacle.getCollisionBox();

        if (
            rectanglesOverlap(
                playerBox,
                obstacleBox
            )
        ) {
            endGame();

            return;
        }
    }
}


function rectanglesOverlap(a, b) {
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


/* =========================================================
   PARTICLES
   ========================================================= */

function createParticle(
    x,
    y,
    options = {}
) {
    particles.push({
        x,
        y,

        velocityX:
            options.velocityX ??
            randomRange(-80, 80),

        velocityY:
            options.velocityY ??
            randomRange(-120, -40),

        life: 0,

        maxLife:
            options.maxLife ??
            randomRange(0.3, 0.7),

        size:
            options.size ??
            randomRange(1, 3),

        gravity:
            options.gravity ??
            120,

        alpha:
            options.alpha ??
            0.8,

        type:
            options.type ??
            "star"
    });
}


function updateParticles(deltaTime) {
    for (
        let i = particles.length - 1;
        i >= 0;
        i--
    ) {
        const particle =
            particles[i];

        particle.life += deltaTime;

        particle.x +=
            particle.velocityX *
            deltaTime;

        particle.y +=
            particle.velocityY *
            deltaTime;

        particle.velocityY +=
            particle.gravity *
            deltaTime;

        if (
            particle.life >=
            particle.maxLife
        ) {
            particles.splice(i, 1);
        }
    }
}


function drawParticles() {
    for (const particle of particles) {
        const lifeRatio =
            particle.life /
            particle.maxLife;

        ctx.globalAlpha =
            particle.alpha *
            (1 - lifeRatio);

        ctx.fillStyle =
            "#FFFFFF";

        ctx.beginPath();

        ctx.arc(
            particle.x,
            particle.y,
            particle.size,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}


function createJumpParticles() {
    for (let i = 0; i < 7; i++) {
        createParticle(
            player.x +
                player.width * 0.5,
            player.y +
                player.height,

            {
                velocityX:
                    randomRange(-80, 80),

                velocityY:
                    randomRange(
                        -60,
                        20
                    ),

                size:
                    randomRange(
                        1,
                        2.5
                    ),

                maxLife:
                    randomRange(
                        0.25,
                        0.5
                    )
            }
        );
    }
}


function createLandingParticles() {
    for (let i = 0; i < 9; i++) {
        createParticle(
            player.x +
                player.width * 0.5,
            player.y +
                player.height,

            {
                velocityX:
                    randomRange(
                        -100,
                        100
                    ),

                velocityY:
                    randomRange(
                        -80,
                        -25
                    ),

                size:
                    randomRange(
                        1,
                        2.8
                    ),

                maxLife:
                    randomRange(
                        0.25,
                        0.55
                    )
            }
        );
    }
}


function createPassParticles() {
    const obstacle =
        obstacles.find(
            item => item.passed
        );

    if (!obstacle) {
        return;
    }

    for (let i = 0; i < 3; i++) {
        createParticle(
            player.x,
            player.y +
                player.height * 0.35,

            {
                velocityX:
                    randomRange(
                        -20,
                        30
                    ),

                velocityY:
                    randomRange(
                        -60,
                        10
                    ),

                size:
                    randomRange(
                        1,
                        2
                    ),

                maxLife:
                    0.35
            }
        );
    }
}


function createCrashParticles() {
    const centerX =
        player.x +
        player.width / 2;

    const centerY =
        player.y +
        player.height / 2;

    for (let i = 0; i < 28; i++) {
        createParticle(
            centerX,
            centerY,

            {
                velocityX:
                    randomRange(
                        -260,
                        260
                    ),

                velocityY:
                    randomRange(
                        -280,
                        100
                    ),

                gravity: 420,

                size:
                    randomRange(
                        1,
                        4
                    ),

                maxLife:
                    randomRange(
                        0.45,
                        1.1
                    ),

                alpha: 0.9
            }
        );
    }
}


/* =========================================================
   AVI
   ========================================================= */

function drawAvi(
    centerX,
    centerY,
    squash,
    stretch
) {
    ctx.save();

    ctx.translate(
        centerX,
        centerY
    );

    ctx.scale(
        squash,
        stretch
    );

    const bodyWidth = 29;
    const bodyHeight = 37;

    const helmetRadius = 19;

    /* Backpack */

    ctx.fillStyle =
        "#AAB5C8";

    roundRect(
        -bodyWidth * 0.62,
        -4,
        8,
        27,
        4
    );

    ctx.fill();

    /* Helmet outer shell */

    ctx.fillStyle =
        "#DCE4F1";

    ctx.beginPath();

    ctx.arc(
        0,
        -22,
        helmetRadius,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /* Helmet dark visor */

    ctx.fillStyle =
        "#17243C";

    ctx.beginPath();

    ctx.ellipse(
        0,
        -21,
        14,
        11,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /* Visor reflection */

    ctx.fillStyle =
        "rgba(255,255,255,0.28)";

    ctx.beginPath();

    ctx.ellipse(
        -4,
        -25,
        5,
        3,
        -0.35,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /* Body suit */

    ctx.fillStyle =
        "#EEF2F8";

    roundRect(
        -bodyWidth / 2,
        -3,
        bodyWidth,
        bodyHeight,
        9
    );

    ctx.fill();

    /* Chest panel */

    ctx.fillStyle =
        "#334765";

    roundRect(
        -9,
        5,
        18,
        11,
        3
    );

    ctx.fill();

    /* Avenmark chest mark */

    ctx.fillStyle =
        "#FFFFFF";

    ctx.fillRect(
        -4,
        8,
        8,
        2
    );

    ctx.fillRect(
        -2,
        6,
        2,
        7
    );

    /* Left arm */

    ctx.fillStyle =
        "#D7DFEB";

    if (player.runFrame === 0) {
        roundRect(
            -21,
            1,
            9,
            24,
            4
        );
    } else {
        roundRect(
            -20,
            4,
            9,
            21,
            4
        );
    }

    ctx.fill();

    /* Right arm */

    if (player.runFrame === 0) {
        roundRect(
            12,
            4,
            9,
            21,
            4
        );
    } else {
        roundRect(
            12,
            1,
            9,
            24,
            4
        );
    }

    ctx.fill();

    /* Legs */

    ctx.fillStyle =
        "#D4DDEA";

    if (player.runFrame === 0) {
        roundRect(
            -12,
            27,
            9,
            18,
            4
        );

        roundRect(
            4,
            28,
            9,
            16,
            4
        );
    } else {
        roundRect(
            -12,
            29,
            9,
            15,
            4
        );

        roundRect(
            4,
            27,
            9,
            18,
            4
        );
    }

    ctx.fill();

    /* Boots */

    ctx.fillStyle =
        "#66748B";

    roundRect(
        -14,
        41,
        12,
        5,
        2
    );

    ctx.fill();

    roundRect(
        3,
        41,
        12,
        5,
        2
    );

    ctx.fill();

    /* Helmet outline */

    ctx.strokeStyle =
        "rgba(255,255,255,0.65)";

    ctx.lineWidth = 1.4;

    ctx.beginPath();

    ctx.arc(
        0,
        -22,
        helmetRadius,
        0,
        Math.PI * 2
    );

    ctx.stroke();

    /* Tiny helmet light */

    ctx.fillStyle =
        "#FFFFFF";

    ctx.beginPath();

    ctx.arc(
        13,
        -28,
        1.5,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
}


/* =========================================================
   GROUND / HORIZON
   ========================================================= */

function drawGround() {
    const groundY =
        canvasHeight -
        GAME.GROUND_HEIGHT;

    /* Main horizon */

    ctx.strokeStyle =
        "rgba(255,255,255,0.18)";

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(
        0,
        groundY
    );

    ctx.lineTo(
        canvasWidth,
        groundY
    );

    ctx.stroke();

    /* Horizon glow */

    const glow =
        ctx.createLinearGradient(
            0,
            groundY - 15,
            0,
            groundY + 20
        );

    glow.addColorStop(
        0,
        "rgba(255,255,255,0.07)"
    );

    glow.addColorStop(
        1,
        "rgba(255,255,255,0)"
    );

    ctx.fillStyle = glow;

    ctx.fillRect(
        0,
        groundY - 15,
        canvasWidth,
        35
    );

    /* Moving surface marks */

    ctx.strokeStyle =
        "rgba(255,255,255,0.08)";

    ctx.lineWidth = 1;

    const spacing = 55;

    const offset =
        groundOffset %
        spacing;

    for (
        let x = -spacing + offset;
        x < canvasWidth + spacing;
        x += spacing
    ) {
        ctx.beginPath();

        ctx.moveTo(
            x,
            groundY + 12
        );

        ctx.lineTo(
            x + 22,
            groundY + 12
        );

        ctx.stroke();
    }

    /* Lower subtle lines */

    ctx.strokeStyle =
        "rgba(255,255,255,0.035)";

    for (
        let y = groundY + 28;
        y < canvasHeight;
        y += 15
    ) {
        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            canvasWidth,
            y
        );

        ctx.stroke();
    }
}


/* =========================================================
   BACKGROUND
   ========================================================= */

function drawBackground() {
    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            canvasHeight
        );

    gradient.addColorStop(
        0,
        "#070B19"
    );

    gradient.addColorStop(
        0.55,
        "#0B1328"
    );

    gradient.addColorStop(
        1,
        "#050813"
    );

    ctx.fillStyle =
        gradient;

    ctx.fillRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );

    /* Soft central glow */

    const glow =
        ctx.createRadialGradient(
            canvasWidth * 0.53,
            canvasHeight * 0.38,
            0,
            canvasWidth * 0.53,
            canvasHeight * 0.38,
            canvasWidth * 0.7
        );

    glow.addColorStop(
        0,
        "rgba(50,72,120,0.18)"
    );

    glow.addColorStop(
        1,
        "rgba(50,72,120,0)"
    );

    ctx.fillStyle =
        glow;

    ctx.fillRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );
}


/* =========================================================
   DRAW
   ========================================================= */

function draw() {
    if (!canvasWidth || !canvasHeight) {
        return;
    }

    ctx.clearRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );

    drawBackground();

    drawBackgroundObjects();

    drawStars();

    drawShootingStars();

    drawGround();

    drawObstacles();

    player.draw();

    drawParticles();

    drawMissionProgress();
}


/* =========================================================
   MISSION PROGRESS
   ========================================================= */

function drawMissionProgress() {
    const barWidth =
        Math.min(
            150,
            canvasWidth * 0.22
        );

    const barHeight = 2;

    const x =
        canvasWidth -
        barWidth -
        20;

    const y =
        canvasHeight -
        GAME.GROUND_HEIGHT +
        31;

    ctx.fillStyle =
        "rgba(255,255,255,0.08)";

    ctx.fillRect(
        x,
        y,
        barWidth,
        barHeight
    );

    const progress =
        Math.min(
            1,
            elapsedTime / 60
        );

    ctx.fillStyle =
        "rgba(255,255,255,0.32)";

    ctx.fillRect(
        x,
        y,
        barWidth * progress,
        barHeight
    );
}


/* =========================================================
   INPUT
   ========================================================= */

function handleJumpInput(event) {
    if (event) {
        event.preventDefault();
    }

    if (gameState === GameState.READY) {
        startGame();

        return;
    }

    if (gameState === GameState.GAME_OVER) {
        startGame();

        return;
    }

    if (gameState === GameState.PAUSED) {
        resumeGame();

        return;
    }

    player.jump();
}


/* =========================================================
   KEYBOARD INPUT
   ========================================================= */

window.addEventListener(
    "keydown",
    event => {
        const key =
            event.key.toLowerCase();

        if (
            key === " " ||
            key === "arrowup" ||
            key === "w"
        ) {
            event.preventDefault();

            handleJumpInput(event);

            return;
        }

        if (key === "p") {
            event.preventDefault();

            if (
                gameState ===
                GameState.RUNNING
            ) {
                pauseGame();
            } else if (
                gameState ===
                GameState.PAUSED
            ) {
                resumeGame();
            }

            return;
        }

        if (key === "escape") {
            if (
                gameState ===
                GameState.RUNNING
            ) {
                pauseGame();
            }
        }
    },
    {
        passive: false
    }
);


/* =========================================================
   TOUCH / POINTER INPUT
   ========================================================= */

touchJump.addEventListener(
    "pointerdown",
    event => {
        event.preventDefault();

        handleJumpInput(event);
    },
    {
        passive: false
    }
);


canvas.addEventListener(
    "pointerdown",
    event => {
        if (
            event.pointerType ===
            "touch"
        ) {
            event.preventDefault();

            handleJumpInput(event);
        }
    },
    {
        passive: false
    }
);


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

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
    resumeGame
);


/* =========================================================
   WINDOW EVENTS
   ========================================================= */

window.addEventListener(
    "resize",
    () => {
        resizeCanvas();

        createStars();
        createBackgroundObjects();

        draw();
    }
);


/* =========================================================
   VISIBILITY / TAB PAUSING
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {
        if (
            document.hidden &&
            gameState ===
            GameState.RUNNING
        ) {
            pauseGame();
        }
    }
);


/* =========================================================
   UTILITIES
   ========================================================= */

function randomRange(min, max) {
    return (
        Math.random() *
            (max - min) +
        min
    );
}


function roundRect(
    x,
    y,
    width,
    height,
    radius
) {
    const r =
        Math.min(
            radius,
            width / 2,
            height / 2
        );

    ctx.beginPath();

    ctx.moveTo(
        x + r,
        y
    );

    ctx.arcTo(
        x + width,
        y,
        x + width,
        y + height,
        r
    );

    ctx.arcTo(
        x + width,
        y + height,
        x,
        y + height,
        r
    );

    ctx.arcTo(
        x,
        y + height,
        x,
        y,
        r
    );

    ctx.arcTo(
        x,
        y,
        x + width,
        y,
        r
    );

    ctx.closePath();
}


/* =========================================================
   INITIALIZE
   ========================================================= */

initialize();
