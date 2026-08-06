/* ==========================================================
   AVENMARK AVI RUNNER
   GAME ENGINE
========================================================== */

(() => {
    "use strict";

    /* ==========================================================
       ELEMENTS
    ========================================================== */

    const canvas = document.getElementById("game-canvas");
    const ctx = canvas ? canvas.getContext("2d") : null;

    const startScreen = document.getElementById("start-screen");
    const gameOverScreen = document.getElementById("game-over-screen");

    const startButton = document.getElementById("start-button");
    const restartButton = document.getElementById("restart-button");

    const pauseButton = document.getElementById("pause-button");
    const resetButton = document.getElementById("reset-button");

    const scoreElement = document.getElementById("score");
    const highScoreElement = document.getElementById("high-score");

    const gameOverScoreElement = document.getElementById("game-over-score");
    const gameOverHighScoreElement =
        document.getElementById("game-over-high-score");

    const speedSlider = document.getElementById("speed-slider");
    const speedValue = document.getElementById("speed-value");

    const soundToggle = document.getElementById("sound-toggle");

    if (!canvas || !ctx) {
        console.error("Avenmark Avi Runner: game canvas was not found.");
        return;
    }

    /* ==========================================================
       CANVAS
    ========================================================== */

    let width = 0;
    let height = 0;
    let groundY = 0;
    let dpr = 1;

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();

        width = Math.max(320, rect.width);
        height = Math.max(220, rect.height);

        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        groundY = height * 0.79;

        if (!game.running) {
            draw();
        }
    }

    window.addEventListener("resize", resizeCanvas);

    /* ==========================================================
       AVENMARK COLORS
    ========================================================== */

    const COLORS = {
        background: "#F5F5F2",
        dark: "#2F2F2F",
        blue: "#103159",
        copper: "#C47A45",
        white: "#F5F5F2",
        muted: "#8B8B86",
        soft: "#DCDCD5"
    };

    /* ==========================================================
       GAME STATE
    ========================================================== */

    const game = {
        running: false,
        paused: false,
        gameOver: false,

        score: 0,
        highScore: Number(localStorage.getItem("avenmarkAviHighScore")) || 0,

        distance: 0,

        baseSpeed: 6,
        speedMultiplier: 1,

        lastTime: 0,
        animationFrame: null,

        nextObstacle: 900,

        nextMessage: 500,

        message: "",
        messageTimer: 0,

        stars: [],
        debris: []
    };

    /* ==========================================================
       AVI
    ========================================================== */

    const avi = {
        x: 110,
        y: 0,

        width: 48,
        height: 70,

        velocityY: 0,

        gravity: 0.72,
        jumpStrength: -14.2,

        grounded: true,

        runFrame: 0,
        runTimer: 0,

        reset() {
            this.x = Math.max(55, width * 0.12);
            this.y = groundY - this.height;

            this.velocityY = 0;
            this.grounded = true;

            this.runFrame = 0;
            this.runTimer = 0;
        },

        jump() {
            if (!game.running || game.paused || game.gameOver) {
                return;
            }

            if (!this.grounded) {
                return;
            }

            this.velocityY = this.jumpStrength;
            this.grounded = false;

            playSound("jump");
        },

        update(dt) {
            if (!game.running || game.paused || game.gameOver) {
                return;
            }

            this.velocityY += this.gravity * dt;
            this.y += this.velocityY * dt;

            const floor = groundY - this.height;

            if (this.y >= floor) {
                this.y = floor;
                this.velocityY = 0;

                if (!this.grounded) {
                    playSound("land");
                }

                this.grounded = true;
            }

            if (this.grounded) {
                this.runTimer += dt;

                if (this.runTimer > 7) {
                    this.runTimer = 0;
                    this.runFrame = this.runFrame ? 0 : 1;
                }
            }
        }
    };

    /* ==========================================================
       OBSTACLES
    ========================================================== */

    const obstacles = [];

    function createCraters() {
        const crater = {
            type: "crater",

            x: width + 100,

            width: 58 + Math.random() * 38,
            height: 16 + Math.random() * 7,

            passed: false
        };

        crater.y = groundY - crater.height + 2;

        obstacles.push(crater);
    }

    function createUFO() {
        const ufo = {
            type: "ufo",

            x: width + 100,

            width: 62,
            height: 30,

            y:
                groundY -
                85 -
                Math.random() * 70,

            passed: false,

            bob: Math.random() * Math.PI * 2
        };

        obstacles.push(ufo);
    }

    function spawnObstacle() {
        const canFly = game.score > 180;

        if (canFly && Math.random() < 0.27) {
            createUFO();
        } else {
            createCraters();
        }

        const speedFactor = Math.min(game.score / 1200, 1);

        game.nextObstacle =
            720 +
            Math.random() * 580 -
            speedFactor * 170;
    }

    function updateObstacles(dt) {
        if (!game.running || game.paused || game.gameOver) {
            return;
        }

        const speed = game.baseSpeed * game.speedMultiplier;

        game.nextObstacle -= speed * dt;

        if (game.nextObstacle <= 0) {
            spawnObstacle();
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];

            obstacle.x -= speed * dt;

            if (obstacle.type === "ufo") {
                obstacle.bob += 0.035 * dt;
                obstacle.y += Math.sin(obstacle.bob) * 0.18;
            }

            if (
                !obstacle.passed &&
                obstacle.x + obstacle.width < avi.x
            ) {
                obstacle.passed = true;
            }

            if (obstacle.x + obstacle.width < -100) {
                obstacles.splice(i, 1);
            }
        }
    }

    /* ==========================================================
       COLLISION
    ========================================================== */

    function getAviHitbox() {
        return {
            x: avi.x + 9,
            y: avi.y + 7,
            width: avi.width - 18,
            height: avi.height - 10
        };
    }

    function getObstacleHitbox(obstacle) {
        if (obstacle.type === "crater") {
            return {
                x: obstacle.x + 6,
                y: obstacle.y + 3,
                width: obstacle.width - 12,
                height: obstacle.height - 2
            };
        }

        return {
            x: obstacle.x + 8,
            y: obstacle.y + 5,
            width: obstacle.width - 16,
            height: obstacle.height - 8
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
        if (!game.running || game.gameOver) {
            return;
        }

        const aviBox = getAviHitbox();

        for (const obstacle of obstacles) {
            if (intersects(aviBox, getObstacleHitbox(obstacle))) {
                endGame();
                return;
            }
        }
    }

    /* ==========================================================
       SCORE
    ========================================================== */

    function updateScore(dt) {
        if (!game.running || game.paused || game.gameOver) {
            return;
        }

        game.distance += game.baseSpeed * game.speedMultiplier * dt;

        game.score = Math.floor(game.distance / 10);

        if (game.score > game.highScore) {
            game.highScore = game.score;

            localStorage.setItem(
                "avenmarkAviHighScore",
                String(game.highScore)
            );
        }

        if (game.score >= game.nextMessage) {
            showAvenmarkMessage(game.nextMessage);
            game.nextMessage += 500;
        }

        updateScoreUI();
    }

    function updateScoreUI() {
        if (scoreElement) {
            scoreElement.textContent = String(game.score).padStart(5, "0");
        }

        if (highScoreElement) {
            highScoreElement.textContent =
                String(game.highScore).padStart(5, "0");
        }
    }

    function showAvenmarkMessage(points) {
        game.message = `Continue plz :)`;
        game.messageTimer = 150;

        playSound("message");

        /*
         * The score milestone itself is enough context.
         * The message floats quietly in the sky instead of
         * becoming a giant game announcement.
         */
        void points;
    }

    /* ==========================================================
       SPEED
    ========================================================== */

    function readSpeed() {
        if (!speedSlider) {
            return;
        }

        let value = Number(speedSlider.value);

        if (!Number.isFinite(value)) {
            value = 1;
        }

        /*
         * 0 = slightly slower
         * 1 = normal
         * 2+ = increasingly faster
         */

        if (value === 0) {
            game.speedMultiplier = 0.82;
        } else {
            game.speedMultiplier = value;
        }

        if (speedValue) {
            speedValue.textContent = String(value);
        }
    }

    if (speedSlider) {
        speedSlider.min = "0";
        speedSlider.max = "4";

        /*
         * Normal speed is the default.
         */
        speedSlider.value = "1";

        speedSlider.addEventListener("input", readSpeed);
    }

    readSpeed();

    /* ==========================================================
       SOUND
    ========================================================== */

    let audioContext = null;
    let soundEnabled = true;

    if (soundToggle) {
        soundEnabled =
            soundToggle.checked !== false;

        /*
         * Explicitly start ON.
         */
        soundToggle.checked = true;

        soundToggle.addEventListener("change", () => {
            soundEnabled = soundToggle.checked;

            if (soundEnabled) {
                playSound("toggle");
            }
        });
    }

    function getAudioContext() {
        if (!audioContext) {
            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContext) {
                return null;
            }

            audioContext = new AudioContext();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        return audioContext;
    }

    /*
     * Original lightweight Avenmark sounds.
     * No external audio file is required.
     */

    function playSound(type) {
        if (!soundEnabled) {
            return;
        }

        const audio = getAudioContext();

        if (!audio) {
            return;
        }

        const oscillator = audio.createOscillator();
        const gain = audio.createGain();

        oscillator.connect(gain);
        gain.connect(audio.destination);

        const now = audio.currentTime;

        let frequency = 440;
        let duration = 0.08;
        let wave = "sine";

        if (type === "jump") {
            frequency = 520;
            duration = 0.10;
            wave = "triangle";
        }

        if (type === "land") {
            frequency = 180;
            duration = 0.045;
            wave = "sine";
        }

        if (type === "message") {
            frequency = 660;
            duration = 0.16;
            wave = "sine";
        }

        if (type === "toggle") {
            frequency = 740;
            duration = 0.06;
            wave = "sine";
        }

        if (type === "gameover") {
            frequency = 130;
            duration = 0.24;
            wave = "triangle";
        }

        oscillator.type = wave;

        oscillator.frequency.setValueAtTime(
            frequency,
            now
        );

        if (type === "gameover") {
            oscillator.frequency.exponentialRampToValueAtTime(
                75,
                now + duration
            );
        }

        gain.gain.setValueAtTime(0.0001, now);

        gain.gain.exponentialRampToValueAtTime(
            0.045,
            now + 0.008
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + duration
        );

        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
    }

    /* ==========================================================
       STARS
    ========================================================== */

    function createStars() {
        game.stars = [];

        const count = Math.max(
            22,
            Math.floor(width / 28)
        );

        for (let i = 0; i < count; i++) {
            game.stars.push({
                x: Math.random() * width,
                y: Math.random() * groundY * 0.72,

                size:
                    Math.random() > 0.85
                        ? 2
                        : 1,

                speed:
                    0.08 +
                    Math.random() * 0.24
            });
        }
    }

    function updateStars(dt) {
        if (!game.running || game.paused) {
            return;
        }

        const movement =
            game.baseSpeed *
            game.speedMultiplier;

        for (const star of game.stars) {
            star.x -= movement * star.speed * dt;

            if (star.x < -5) {
                star.x = width + 5;
                star.y = Math.random() * groundY * 0.72;
            }
        }
    }

    /* ==========================================================
       SPACE DEBRIS
    ========================================================== */

    function createDebris() {
        game.debris = [];

        /*
         * Deliberately sparse.
         * The sky should feel quiet rather than crowded.
         */

        const count = Math.max(
            4,
            Math.floor(width / 210)
        );

        for (let i = 0; i < count; i++) {
            game.debris.push({
                x: Math.random() * width,
                y:
                    60 +
                    Math.random() *
                        (groundY * 0.48),

                size:
                    2 +
                    Math.random() * 2,

                speed:
                    0.04 +
                    Math.random() * 0.08
            });
        }
    }

    function updateDebris(dt) {
        if (!game.running || game.paused) {
            return;
        }

        const movement =
            game.baseSpeed *
            game.speedMultiplier;

        for (const piece of game.debris) {
            piece.x -= movement * piece.speed * dt;

            if (piece.x < -10) {
                piece.x =
                    width +
                    60 +
                    Math.random() * 150;

                piece.y =
                    60 +
                    Math.random() *
                        (groundY * 0.48);
            }
        }
    }

    /* ==========================================================
       DRAW — BACKGROUND
    ========================================================== */

    function drawBackground() {
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, width, height);

        /*
         * The only strong color in the sky is the Avenmark blue.
         * Stars remain copper.
         */

        for (const star of game.stars) {
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

        for (const piece of game.debris) {
            ctx.fillStyle = COLORS.blue;

            ctx.beginPath();
            ctx.arc(
                piece.x,
                piece.y,
                piece.size,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }

    /* ==========================================================
       DRAW — GROUND
    ========================================================== */

    function drawGround() {
        ctx.strokeStyle = COLORS.dark;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(width, groundY);
        ctx.stroke();

        /*
         * Small, restrained terrain marks.
         * No giant detailed landscape.
         */

        const offset =
            (game.distance * 0.75) % 90;

        for (let x = -90 + offset; x < width + 90; x += 90) {
            ctx.strokeStyle =
                "rgba(47,47,47,0.16)";

            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(x, groundY + 5);
            ctx.lineTo(x + 18, groundY + 5);
            ctx.stroke();
        }
    }

    /* ==========================================================
       DRAW — AVI
    ========================================================== */

    function drawAvi() {
        const x = avi.x;
        const y = avi.y;

        ctx.save();

        /*
         * Backpack
         */
        ctx.fillStyle = COLORS.blue;

        roundRect(
            ctx,
            x - 5,
            y + 22,
            13,
            31,
            5
        );

        ctx.fill();

        /*
         * Helmet outer shell
         */
        ctx.fillStyle = COLORS.dark;

        ctx.beginPath();
        ctx.arc(
            x + 24,
            y + 17,
            17,
            0,
            Math.PI * 2
        );
        ctx.fill();

        /*
         * Helmet glass
         */
        ctx.fillStyle = COLORS.blue;

        ctx.beginPath();
        ctx.arc(
            x + 24,
            y + 17,
            11,
            0,
            Math.PI * 2
        );
        ctx.fill();

        /*
         * Body
         */
        ctx.fillStyle = COLORS.white;

        roundRect(
            ctx,
            x + 10,
            y + 30,
            29,
            27,
            9
        );

        ctx.fill();

        /*
         * Avenmark copper chest detail
         */
        ctx.fillStyle = COLORS.copper;

        roundRect(
            ctx,
            x + 18,
            y + 37,
            12,
            4,
            2
        );

        ctx.fill();

        /*
         * Laptop — intentionally visible in Avi's hands.
         */
        drawLaptop(
            x + 28,
            y + 47
        );

        /*
         * Legs
         */
        ctx.strokeStyle = COLORS.dark;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";

        const running =
            avi.grounded &&
            game.running &&
            !game.paused;

        const legOffset =
            running
                ? avi.runFrame
                    ? 5
                    : -5
                : 0;

        ctx.beginPath();
        ctx.moveTo(x + 19, y + 55);
        ctx.lineTo(
            x + 16 - legOffset,
            y + 68
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 32, y + 55);
        ctx.lineTo(
            x + 35 + legOffset,
            y + 68
        );
        ctx.stroke();

        /*
         * Boots
         */
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.moveTo(
            x + 13 - legOffset,
            y + 68
        );
        ctx.lineTo(
            x + 21 - legOffset,
            y + 68
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(
            x + 32 + legOffset,
            y + 68
        );
        ctx.lineTo(
            x + 40 + legOffset,
            y + 68
        );
        ctx.stroke();

        ctx.restore();
    }

    function drawLaptop(x, y) {
        ctx.save();

        /*
         * Screen
         */
        ctx.fillStyle = COLORS.dark;

        roundRect(
            ctx,
            x - 5,
            y - 11,
            18,
            12,
            2
        );

        ctx.fill();

        ctx.fillStyle = COLORS.copper;

        ctx.fillRect(
            x - 2,
            y - 8,
            12,
            6
        );

        /*
         * Base
         */
        ctx.fillStyle = COLORS.dark;

        ctx.beginPath();
        ctx.moveTo(x - 7, y + 1);
        ctx.lineTo(x + 15, y + 1);
        ctx.lineTo(x + 18, y + 4);
        ctx.lineTo(x - 10, y + 4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    /* ==========================================================
       DRAW — CRATER
    ========================================================== */

    function drawCrater(obstacle) {
        ctx.save();

        ctx.fillStyle = COLORS.dark;

        ctx.beginPath();

        ctx.ellipse(
            obstacle.x + obstacle.width / 2,
            groundY + 2,
            obstacle.width / 2,
            obstacle.height / 2,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /*
         * Small inner highlight keeps it readable
         * without making it overly detailed.
         */

        ctx.strokeStyle =
            "rgba(245,245,242,0.38)";

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.arc(
            obstacle.x + obstacle.width * 0.58,
            groundY + 1,
            obstacle.width * 0.18,
            Math.PI * 1.05,
            Math.PI * 1.85
        );

        ctx.stroke();

        ctx.restore();
    }

    /* ==========================================================
       DRAW — UFO
    ========================================================== */

    function drawUFO(obstacle) {
        const x = obstacle.x;
        const y = obstacle.y;

        ctx.save();

        /*
         * UFO silhouette.
         * Minimal enough to belong beside Chrome-Dino-style
         * obstacles, but clearly an Avenmark UFO.
         */

        ctx.fillStyle = COLORS.blue;

        ctx.beginPath();

        ctx.ellipse(
            x + obstacle.width / 2,
            y + 16,
            obstacle.width / 2,
            10,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /*
         * Dome
         */
        ctx.fillStyle = COLORS.dark;

        ctx.beginPath();

        ctx.arc(
            x + obstacle.width / 2,
            y + 12,
            10,
            Math.PI,
            0
        );

        ctx.fill();

        /*
         * Copper UFO lights
         */
        ctx.fillStyle = COLORS.copper;

        const lightY = y + 21;

        for (let i = 0; i < 3; i++) {
            ctx.beginPath();

            ctx.arc(
                x + 17 + i * 14,
                lightY,
                2,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        ctx.restore();
    }

    /* ==========================================================
       DRAW — OBSTACLES
    ========================================================== */

    function drawObstacles() {
        for (const obstacle of obstacles) {
            if (obstacle.type === "crater") {
                drawCrater(obstacle);
            } else {
                drawUFO(obstacle);
            }
        }
    }

    /* ==========================================================
       DRAW — MILESTONE MESSAGE
    ========================================================== */

    function drawMessage() {
        if (
            !game.message ||
            game.messageTimer <= 0
        ) {
            return;
        }

        const progress =
            game.messageTimer < 30
                ? game.messageTimer / 30
                : 1;

        ctx.save();

        ctx.globalAlpha =
            Math.min(1, progress);

        ctx.fillStyle = COLORS.blue;

        ctx.font =
            '600 14px "Montserrat", sans-serif';

        ctx.textAlign = "center";

        ctx.fillText(
            game.message,
            width / 2,
            height * 0.25
        );

        ctx.restore();
    }

    /* ==========================================================
       DRAW
    ========================================================== */

    function draw() {
        drawBackground();
        drawGround();
        drawObstacles();
        drawAvi();
        drawMessage();
    }

    /* ==========================================================
       GAME LOOP
    ========================================================== */

    function gameLoop(timestamp) {
        if (!game.lastTime) {
            game.lastTime = timestamp;
        }

        let dt =
            (timestamp - game.lastTime) / 16.6667;

        game.lastTime = timestamp;

        /*
         * Prevent a browser tab switch or frame hitch
         * from launching Avi across the screen.
         */
        dt = Math.min(dt, 2);

        if (game.messageTimer > 0) {
            game.messageTimer -= dt;
        } else {
            game.message = "";
        }

        if (
            game.running &&
            !game.paused &&
            !game.gameOver
        ) {
            avi.update(dt);
            updateObstacles(dt);
            updateStars(dt);
            updateDebris(dt);
            updateScore(dt);

            checkCollisions();
        }

        draw();

        game.animationFrame =
            requestAnimationFrame(gameLoop);
    }

    /* ==========================================================
       START
    ========================================================== */

    function startGame() {
        ensureAudio();

        game.running = true;
        game.paused = false;
        game.gameOver = false;

        game.score = 0;
        game.distance = 0;

        game.nextObstacle = 850;
        game.nextMessage = 500;

        game.message = "";
        game.messageTimer = 0;

        obstacles.length = 0;

        avi.reset();

        updateScoreUI();

        if (startScreen) {
            startScreen.classList.remove("visible");
            startScreen.setAttribute(
                "aria-hidden",
                "true"
            );
        }

        if (gameOverScreen) {
            gameOverScreen.classList.remove("visible");
            gameOverScreen.setAttribute(
                "aria-hidden",
                "true"
            );
        }

        if (pauseButton) {
            pauseButton.textContent = "Pause";
            pauseButton.setAttribute(
                "aria-label",
                "Pause game"
            );
        }

        game.lastTime = performance.now();

        draw();
    }

    /* ==========================================================
       GAME OVER
    ========================================================== */

    function endGame() {
        if (game.gameOver) {
            return;
        }

        game.gameOver = true;
        game.running = false;

        playSound("gameover");

        if (gameOverScoreElement) {
            gameOverScoreElement.textContent =
                String(game.score).padStart(5, "0");
        }

        if (gameOverHighScoreElement) {
            gameOverHighScoreElement.textContent =
                String(game.highScore).padStart(5, "0");
        }

        if (gameOverScreen) {
            gameOverScreen.classList.add("visible");
            gameOverScreen.setAttribute(
                "aria-hidden",
                "false"
            );
        }
    }

    /* ==========================================================
       PAUSE
    ========================================================== */

    function togglePause() {
        if (!game.running || game.gameOver) {
            return;
        }

        game.paused = !game.paused;

        if (game.paused) {
            if (pauseButton) {
                pauseButton.textContent = "Resume";
                pauseButton.setAttribute(
                    "aria-label",
                    "Resume game"
                );
            }
        } else {
            if (pauseButton) {
                pauseButton.textContent = "Pause";
                pauseButton.setAttribute(
                    "aria-label",
                    "Pause game"
                );
            }

            game.lastTime = performance.now();
        }

        draw();
    }

    /* ==========================================================
       RESET
    ========================================================== */

    function resetGame() {
        game.running = false;
        game.paused = false;
        game.gameOver = false;

        game.score = 0;
        game.distance = 0;

        game.nextObstacle = 850;
        game.nextMessage = 500;

        game.message = "";
        game.messageTimer = 0;

        obstacles.length = 0;

        avi.reset();

        updateScoreUI();

        if (pauseButton) {
            pauseButton.textContent = "Pause";
            pauseButton.setAttribute(
                "aria-label",
                "Pause game"
            );
        }

        if (gameOverScreen) {
            gameOverScreen.classList.remove("visible");
            gameOverScreen.setAttribute(
                "aria-hidden",
                "true"
            );
        }

        if (startScreen) {
            startScreen.classList.add("visible");
            startScreen.setAttribute(
                "aria-hidden",
                "false"
            );
        }

        draw();
    }

    /* ==========================================================
       AUDIO INITIALIZATION
    ========================================================== */

    function ensureAudio() {
        if (!soundEnabled) {
            return;
        }

        getAudioContext();
    }

    /* ==========================================================
       INPUT
    ========================================================== */

    function handleJumpInput(event) {
        if (event) {
            /*
             * Don't steal keyboard input from controls.
             */
            if (
                event.target &&
                (
                    event.target.tagName === "BUTTON" ||
                    event.target.tagName === "INPUT"
                )
            ) {
                return;
            }

            if (
                event.type === "keydown" &&
                (
                    event.code !== "Space" &&
                    event.code !== "ArrowUp" &&
                    event.code !== "KeyW"
                )
            ) {
                return;
            }

            if (
                event.type === "keydown" &&
                event.repeat
            ) {
                return;
            }

            if (
                event.type === "keydown" &&
                event.code === "Space"
            ) {
                event.preventDefault();
            }
        }

        if (!game.running && !game.gameOver) {
            startGame();
            return;
        }

        avi.jump();
    }

    window.addEventListener(
        "keydown",
        handleJumpInput
    );

    canvas.addEventListener(
        "pointerdown",
        event => {
            event.preventDefault();
            handleJumpInput();
        }
    );

    /* ==========================================================
       BUTTONS
    ========================================================== */

    if (startButton) {
        startButton.addEventListener(
            "click",
            startGame
        );
    }

    if (restartButton) {
        restartButton.addEventListener(
            "click",
            startGame
        );
    }

    if (pauseButton) {
        pauseButton.addEventListener(
            "click",
            togglePause
        );
    }

    if (resetButton) {
        resetButton.addEventListener(
            "click",
            resetGame
        );
    }

    /* ==========================================================
       TOUCH / MOBILE
    ========================================================== */

    let touchStartY = 0;

    canvas.addEventListener(
        "touchstart",
        event => {
            if (!event.touches.length) {
                return;
            }

            touchStartY =
                event.touches[0].clientY;
        },
        { passive: true }
    );

    canvas.addEventListener(
        "touchend",
        event => {
            if (!event.changedTouches.length) {
                return;
            }

            const touchEndY =
                event.changedTouches[0].clientY;

            const difference =
                touchStartY - touchEndY;

            /*
             * A swipe upward or ordinary tap can jump.
             */
            if (difference > 25 || Math.abs(difference) < 25) {
                handleJumpInput();
            }
        },
        { passive: true }
    );

    /* ==========================================================
       UTILITY
    ========================================================== */

    function roundRect(
        context,
        x,
        y,
        w,
        h,
        radius
    ) {
        const r = Math.min(
            radius,
            w / 2,
            h / 2
        );

        context.beginPath();

        context.moveTo(x + r, y);
        context.arcTo(
            x + w,
            y,
            x + w,
            y + h,
            r
        );

        context.arcTo(
            x + w,
            y + h,
            x,
            y + h,
            r
        );

        context.arcTo(
            x,
            y + h,
            x,
            y,
            r
        );

        context.arcTo(
            x,
            y,
            x + w,
            y,
            r
        );

        context.closePath();
    }

    /* ==========================================================
       INITIALIZE
    ========================================================== */

    function initialize() {
        resizeCanvas();

        avi.reset();

        createStars();
        createDebris();

        updateScoreUI();
        readSpeed();

        /*
         * Make sure the game begins in a clean,
         * not-running state.
         */
        game.running = false;
        game.paused = false;
        game.gameOver = false;

        if (startScreen) {
            startScreen.classList.add("visible");
            startScreen.setAttribute(
                "aria-hidden",
                "false"
            );
        }

        if (gameOverScreen) {
            gameOverScreen.classList.remove("visible");
            gameOverScreen.setAttribute(
                "aria-hidden",
                "true"
            );
        }

        draw();

        game.lastTime = performance.now();

        game.animationFrame =
            requestAnimationFrame(gameLoop);
    }

    initialize();

})();
