/* ==========================================================
   AVENMARK AVI RUNNER
   GAME ENGINE
========================================================== */

(() => {
    "use strict";

    /* ======================================================
       ELEMENTS
    ====================================================== */

    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas ? canvas.getContext("2d") : null;

    if (!canvas || !ctx) {
        console.error("Avenmark Avi Runner: game canvas not found.");
        return;
    }

    const scoreElement =
        document.getElementById("score") ||
        document.getElementById("current-score");

    const highScoreElement =
        document.getElementById("highScore") ||
        document.getElementById("high-score");

    const speedSlider =
        document.getElementById("speedSlider") ||
        document.getElementById("speed-slider");

    const soundToggle =
        document.getElementById("soundToggle") ||
        document.getElementById("sound-toggle");

    const pauseButton =
        document.getElementById("pauseButton") ||
        document.getElementById("pause-button");

    const resetButton =
        document.getElementById("resetButton") ||
        document.getElementById("reset-button");

    const startScreen = document.getElementById("startScreen");
    const gameOverScreen = document.getElementById("gameOverScreen");

    const startButton =
        document.getElementById("startButton") ||
        document.getElementById("start-button");

    const restartButton =
        document.getElementById("restartButton") ||
        document.getElementById("restart-button");

    const gameOverScore =
        document.getElementById("gameOverScore") ||
        document.getElementById("game-over-score");


    /* ======================================================
       AVENMARK DESIGN TOKENS
    ====================================================== */

    const AVENMARK = {
        background: "#F5F5F2",
        dark: "#2F2F2F",
        blue: "#103159",
        copper: "#C47A45",
        white: "#F5F5F2",
        muted: "#777777",
        line: "rgba(47, 47, 47, 0.10)"
    };


    /* ======================================================
       GAME SETTINGS
    ====================================================== */

    const WORLD = {
        gravity: 0.72,
        jumpPower: -13.4,
        baseSpeed: 6.2,
        maxSpeedMultiplier: 1.45,
        minSpeedMultiplier: 0.88,
        groundHeight: 76,
        startingDistance: 520
    };

    let speedMultiplier = 1;
    let gameSpeed = WORLD.baseSpeed;

    let running = false;
    let paused = false;
    let gameOver = false;

    let score = 0;
    let highScore = Number(
        localStorage.getItem("avenmarkAviHighScore") || 0
    );

    let lastTime = 0;
    let scoreAccumulator = 0;

    let nextObstacleDistance = WORLD.startingDistance;

    let animationFrame = null;

    let soundEnabled = true;
    let audioContext = null;


    /* ======================================================
       CANVAS
    ====================================================== */

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();

        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener("resize", resizeCanvas);

    resizeCanvas();


    /* ======================================================
       HELPERS
    ====================================================== */

    function width() {
        return canvas.getBoundingClientRect().width;
    }

    function height() {
        return canvas.getBoundingClientRect().height;
    }

    function groundY() {
        return height() - WORLD.groundHeight;
    }

    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }


    /* ======================================================
       AUDIO
       Original tiny synthesized Avenmark sound set.
    ====================================================== */

    function initializeAudio() {
        if (audioContext) return;

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) return;

        audioContext = new AudioContext();
    }

    function playTone(
        frequency,
        duration = 0.08,
        type = "sine",
        volume = 0.025
    ) {
        if (!soundEnabled) return;

        initializeAudio();

        if (!audioContext) return;

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(
            frequency,
            audioContext.currentTime
        );

        gain.gain.setValueAtTime(
            volume,
            audioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(
            audioContext.currentTime + duration
        );
    }

    function playJumpSound() {
        playTone(520, 0.07, "sine", 0.022);

        setTimeout(() => {
            playTone(690, 0.08, "sine", 0.018);
        }, 30);
    }

    function playScoreSound() {
        playTone(740, 0.06, "triangle", 0.018);
        setTimeout(() => {
            playTone(920, 0.08, "triangle", 0.014);
        }, 45);
    }

    function playGameOverSound() {
        playTone(300, 0.13, "sine", 0.025);

        setTimeout(() => {
            playTone(220, 0.18, "sine", 0.018);
        }, 100);
    }


    /* ======================================================
       AVI
    ====================================================== */

    const avi = {
        x: 90,
        y: 0,
        width: 48,
        height: 66,

        velocityY: 0,

        grounded: true,

        runCycle: 0,

        reset() {
            this.x = Math.max(45, width() * 0.11);
            this.y = groundY() - this.height;
            this.velocityY = 0;
            this.grounded = true;
            this.runCycle = 0;
        },

        jump() {
            if (!running || paused || gameOver) return;

            if (!this.grounded) return;

            this.velocityY = WORLD.jumpPower;
            this.grounded = false;

            playJumpSound();
        },

        update(delta) {
            this.velocityY += WORLD.gravity * delta;

            this.y += this.velocityY * delta;

            const floor = groundY() - this.height;

            if (this.y >= floor) {
                this.y = floor;
                this.velocityY = 0;
                this.grounded = true;
            }

            if (this.grounded) {
                this.runCycle += delta * gameSpeed * 0.11;
            }
        },

        draw() {
            const x = this.x;
            const y = this.y;

            const runningOffset =
                this.grounded
                    ? Math.sin(this.runCycle) * 1.5
                    : 0;

            ctx.save();

            /*
             * Backpack
             */

            ctx.fillStyle = AVENMARK.dark;

            roundRect(
                ctx,
                x + 3,
                y + 22,
                11,
                30,
                5
            );

            ctx.fill();

            /*
             * Helmet
             */

            ctx.beginPath();

            ctx.arc(
                x + 25,
                y + 17,
                16,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = AVENMARK.dark;
            ctx.fill();

            /*
             * Helmet glass
             */

            ctx.beginPath();

            ctx.arc(
                x + 25,
                y + 17,
                11,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = AVENMARK.background;
            ctx.fill();

            /*
             * Small blue reflection
             */

            ctx.beginPath();

            ctx.arc(
                x + 22,
                y + 13,
                5,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = AVENMARK.blue;
            ctx.globalAlpha = 0.9;
            ctx.fill();

            ctx.globalAlpha = 1;

            /*
             * Body
             */

            ctx.fillStyle = AVENMARK.dark;

            roundRect(
                ctx,
                x + 13,
                y + 29,
                27,
                25,
                8
            );

            ctx.fill();

            /*
             * Copper Avenmark detail
             */

            ctx.fillStyle = AVENMARK.copper;

            roundRect(
                ctx,
                x + 20,
                y + 34,
                13,
                7,
                2
            );

            ctx.fill();

            /*
             * Laptop held in front.
             */

            const laptopX = x + 31;
            const laptopY = y + 35;

            ctx.fillStyle = AVENMARK.blue;

            roundRect(
                ctx,
                laptopX,
                laptopY,
                20,
                14,
                3
            );

            ctx.fill();

            ctx.fillStyle = AVENMARK.background;

            roundRect(
                ctx,
                laptopX + 3,
                laptopY + 3,
                14,
                8,
                1.5
            );

            ctx.fill();

            /*
             * Laptop copper mark.
             */

            ctx.fillStyle = AVENMARK.copper;

            ctx.fillRect(
                laptopX + 8,
                laptopY + 6,
                4,
                2
            );

            /*
             * Legs
             */

            const legOffset =
                this.grounded
                    ? Math.sin(this.runCycle) * 4
                    : 0;

            ctx.strokeStyle = AVENMARK.dark;
            ctx.lineWidth = 7;
            ctx.lineCap = "round";

            ctx.beginPath();

            ctx.moveTo(
                x + 20,
                y + 51
            );

            ctx.lineTo(
                x + 17 - legOffset,
                y + 64
            );

            ctx.stroke();

            ctx.beginPath();

            ctx.moveTo(
                x + 34,
                y + 51
            );

            ctx.lineTo(
                x + 37 + legOffset,
                y + 64
            );

            ctx.stroke();

            /*
             * Boots
             */

            ctx.lineWidth = 6;

            ctx.beginPath();

            ctx.moveTo(
                x + 14 - legOffset,
                y + 64
            );

            ctx.lineTo(
                x + 21 - legOffset,
                y + 64
            );

            ctx.stroke();

            ctx.beginPath();

            ctx.moveTo(
                x + 34 + legOffset,
                y + 64
            );

            ctx.lineTo(
                x + 41 + legOffset,
                y + 64
            );

            ctx.stroke();

            ctx.restore();
        }
    };


    /* ======================================================
       TERRAIN
    ====================================================== */

    const terrain = {
        craters: [],
        debris: [],

        reset() {
            this.craters = [];
            this.debris = [];

            let x = 100;

            while (x < width() + 500) {
                x += random(160, 300);

                this.craters.push({
                    x,
                    width: random(24, 58),
                    depth: random(4, 10)
                });
            }

            x = 180;

            while (x < width() + 700) {
                x += random(230, 430);

                this.debris.push({
                    x,
                    size: random(2, 5),
                    rotation: random(0, Math.PI),
                    type: Math.random() > 0.5 ? 1 : 2
                });
            }
        },

        update(delta) {
            const movement =
                gameSpeed * delta;

            for (const crater of this.craters) {
                crater.x -= movement;
            }

            for (const piece of this.debris) {
                piece.x -= movement;
            }

            this.craters = this.craters.filter(
                crater => crater.x + crater.width > -100
            );

            this.debris = this.debris.filter(
                piece => piece.x > -100
            );

            let furthestCrater =
                this.craters.reduce(
                    (max, crater) =>
                        Math.max(max, crater.x),
                    width()
                );

            while (furthestCrater < width() + 300) {
                const newCrater = {
                    x: furthestCrater + random(170, 300),
                    width: random(24, 58),
                    depth: random(4, 10)
                };

                this.craters.push(newCrater);

                furthestCrater =
                    newCrater.x;
            }

            let furthestDebris =
                this.debris.reduce(
                    (max, piece) =>
                        Math.max(max, piece.x),
                    width()
                );

            while (furthestDebris < width() + 600) {
                const newPiece = {
                    x: furthestDebris + random(260, 450),
                    size: random(2, 5),
                    rotation: random(0, Math.PI),
                    type: Math.random() > 0.5 ? 1 : 2
                };

                this.debris.push(newPiece);

                furthestDebris =
                    newPiece.x;
            }
        },

        draw() {
            const y = groundY();

            /*
             * Terrain line
             */

            ctx.strokeStyle =
                "rgba(47,47,47,0.22)";

            ctx.lineWidth = 1;

            ctx.beginPath();

            ctx.moveTo(0, y);
            ctx.lineTo(width(), y);

            ctx.stroke();

            /*
             * Subtle ground texture
             */

            ctx.strokeStyle =
                "rgba(47,47,47,0.07)";

            for (const crater of this.craters) {
                ctx.beginPath();

                ctx.ellipse(
                    crater.x + crater.width / 2,
                    y + 2,
                    crater.width / 2,
                    crater.depth,
                    0,
                    0,
                    Math.PI
                );

                ctx.stroke();
            }

            /*
             * Small debris
             */

            for (const piece of this.debris) {
                ctx.save();

                ctx.translate(
                    piece.x,
                    y - 5
                );

                ctx.rotate(piece.rotation);

                ctx.fillStyle =
                    "rgba(47,47,47,0.20)";

                if (piece.type === 1) {
                    ctx.fillRect(
                        -piece.size,
                        -piece.size,
                        piece.size * 2,
                        piece.size
                    );
                } else {
                    ctx.beginPath();

                    ctx.arc(
                        0,
                        0,
                        piece.size,
                        0,
                        Math.PI * 2
                    );

                    ctx.fill();
                }

                ctx.restore();
            }
        }
    };


    /* ======================================================
       UFO OBSTACLES
    ====================================================== */

    const ufos = [];

    function createUFO() {
        const altitude =
            groundY() -
            random(72, 120);

        ufos.push({
            x: width() + random(30, 100),
            y: altitude,
            width: 54,
            height: 25,
            speedOffset: random(0.96, 1.04),
            bob: random(0, Math.PI * 2)
        });
    }

    function updateUFOs(delta) {
        for (const ufo of ufos) {
            ufo.x -=
                gameSpeed *
                delta *
                ufo.speedOffset;

            ufo.bob += delta * 0.06;

            ufo.y +=
                Math.sin(ufo.bob) * 0.15;
        }

        while (
            ufos.length &&
            ufos[0].x + ufos[0].width < -100
        ) {
            ufos.shift();
        }
    }

    function drawUFO(ufo) {
        const x = ufo.x;
        const y = ufo.y;

        ctx.save();

        /*
         * UFO body
         */

        ctx.fillStyle = AVENMARK.dark;

        ctx.beginPath();

        ctx.ellipse(
            x + ufo.width / 2,
            y + 15,
            ufo.width / 2,
            10,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /*
         * UFO dome
         */

        ctx.fillStyle = AVENMARK.background;

        ctx.beginPath();

        ctx.ellipse(
            x + ufo.width / 2,
            y + 10,
            14,
            9,
            0,
            Math.PI,
            Math.PI * 2
        );

        ctx.fill();

        /*
         * Copper light
         */

        ctx.fillStyle = AVENMARK.copper;

        ctx.beginPath();

        ctx.arc(
            x + ufo.width / 2,
            y + 17,
            3,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /*
         * Tiny side lights
         */

        ctx.fillStyle = AVENMARK.copper;

        ctx.beginPath();

        ctx.arc(
            x + 13,
            y + 15,
            2,
            0,
            Math.PI * 2
        );

        ctx.arc(
            x + ufo.width - 13,
            y + 15,
            2,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    }


    /* ======================================================
       STARS
    ====================================================== */

    const stars = [];

    function createStars() {
        stars.length = 0;

        const count =
            Math.max(
                20,
                Math.floor(width() / 42)
            );

        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width(),
                y: Math.random() * Math.max(150, groundY() * 0.72),
                size: random(0.7, 1.6),
                alpha: random(0.35, 0.8),
                speed: random(0.04, 0.12)
            });
        }
    }

    function updateStars(delta) {
        for (const star of stars) {
            star.x -= star.speed * gameSpeed * delta;

            if (star.x < -5) {
                star.x = width() + 5;
                star.y =
                    Math.random() *
                    Math.max(150, groundY() * 0.72);
            }
        }
    }

    function drawStars() {
        for (const star of stars) {
            ctx.globalAlpha = star.alpha;

            ctx.fillStyle = AVENMARK.copper;

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

        ctx.globalAlpha = 1;
    }


    /* ======================================================
       500 POINT MESSAGE
    ====================================================== */

    let lastMilestone = 0;
    let milestoneMessage = "";
    let milestoneTimer = 0;

    function checkMilestone() {
        const milestone =
            Math.floor(score / 500) * 500;

        if (
            milestone >= 500 &&
            milestone > lastMilestone
        ) {
            lastMilestone = milestone;

            milestoneMessage =
                "Continue plz :)";

            milestoneTimer = 180;

            playScoreSound();
        }
    }

    function drawMilestone() {
        if (milestoneTimer <= 0) return;

        milestoneTimer--;

        const fade =
            milestoneTimer < 35
                ? milestoneTimer / 35
                : 1;

        ctx.save();

        ctx.globalAlpha = fade;

        ctx.font =
            '600 15px "Montserrat", sans-serif';

        ctx.textAlign = "center";

        ctx.fillStyle = AVENMARK.copper;

        ctx.fillText(
            milestoneMessage,
            width() / 2,
            48
        );

        ctx.restore();
    }


    /* ======================================================
       BACKGROUND
    ====================================================== */

    function drawBackground() {
        ctx.fillStyle = AVENMARK.background;

        ctx.fillRect(
            0,
            0,
            width(),
            height()
        );

        drawStars();
    }


    /* ======================================================
       SCORE
    ====================================================== */

    function updateScore(delta) {
        scoreAccumulator += delta;

        /*
         * Score rises steadily rather than being
         * tied to frame rate.
         */

        if (scoreAccumulator >= 1) {
            const points =
                Math.floor(scoreAccumulator);

            score += points;

            scoreAccumulator -= points;

            checkMilestone();

            updateScoreDisplay();
        }
    }

    function updateScoreDisplay() {
        if (scoreElement) {
            scoreElement.textContent =
                String(score).padStart(5, "0");
        }

        if (highScoreElement) {
            highScoreElement.textContent =
                String(highScore).padStart(5, "0");
        }

        if (gameOverScore) {
            gameOverScore.textContent =
                String(score).padStart(5, "0");
        }
    }


    /* ======================================================
       COLLISION
    ====================================================== */

    function getAviHitbox() {
        return {
            x: avi.x + 9,
            y: avi.y + 5,
            width: 37,
            height: 59
        };
    }

    function getUFOHitbox(ufo) {
        return {
            x: ufo.x + 5,
            y: ufo.y + 4,
            width: ufo.width - 10,
            height: 20
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
        const aviBox =
            getAviHitbox();

        for (const ufo of ufos) {
            if (
                intersects(
                    aviBox,
                    getUFOHitbox(ufo)
                )
            ) {
                endGame();
                return;
            }
        }
    }


    /* ======================================================
       OBSTACLE SPAWNING
    ====================================================== */

    function updateObstacleSpawner(delta) {
        nextObstacleDistance -=
            gameSpeed * delta;

        if (nextObstacleDistance <= 0) {
            createUFO();

            /*
             * Keep UFOs comfortably spaced.
             * Difficulty increases gradually through speed,
             * not by filling the screen.
             */

            const difficulty =
                clamp(score / 5000, 0, 1);

            nextObstacleDistance =
                random(
                    470 - difficulty * 60,
                    720 - difficulty * 80
                );
        }
    }


    /* ======================================================
       GAME STATE
    ====================================================== */

    function startGame() {
        initializeAudio();

        if (
            audioContext &&
            audioContext.state === "suspended"
        ) {
            audioContext.resume();
        }

        running = true;
        paused = false;
        gameOver = false;

        if (startScreen) {
            startScreen.classList.add("hidden");
        }

        if (gameOverScreen) {
            gameOverScreen.classList.add("hidden");
        }

        resetGameState();

        if (!animationFrame) {
            lastTime = performance.now();

            animationFrame =
                requestAnimationFrame(loop);
        }
    }

    function resetGameState() {
        score = 0;
        scoreAccumulator = 0;

        lastMilestone = 0;
        milestoneMessage = "";
        milestoneTimer = 0;

        nextObstacleDistance =
            WORLD.startingDistance;

        ufos.length = 0;

        gameSpeed =
            WORLD.baseSpeed *
            speedMultiplier;

        avi.reset();

        terrain.reset();

        createStars();

        updateScoreDisplay();
    }

    function resetGame() {
        running = true;
        paused = false;
        gameOver = false;

        if (startScreen) {
            startScreen.classList.add("hidden");
        }

        if (gameOverScreen) {
            gameOverScreen.classList.add("hidden");
        }

        resetGameState();

        playTone(
            440,
            0.06,
            "sine",
            0.014
        );
    }

    function endGame() {
        running = false;
        paused = false;
        gameOver = true;

        if (score > highScore) {
            highScore = score;

            localStorage.setItem(
                "avenmarkAviHighScore",
                String(highScore)
            );
        }

        updateScoreDisplay();

        if (gameOverScreen) {
            gameOverScreen.classList.remove("hidden");
        }

        playGameOverSound();
    }

    function togglePause() {
        if (!running && !paused) return;

        paused = !paused;

        if (pauseButton) {
            pauseButton.textContent =
                paused ? "Resume" : "Pause";
        }
    }


    /* ======================================================
       GAME UPDATE
    ====================================================== */

    function update(delta) {
        if (!running || paused || gameOver) {
            return;
        }

        gameSpeed =
            WORLD.baseSpeed *
            speedMultiplier;

        updateScore(delta);

        avi.update(delta);

        terrain.update(delta);

        updateStars(delta);

        updateUFOs(delta);

        updateObstacleSpawner(delta);

        checkCollisions();
    }


    /* ======================================================
       DRAW
    ====================================================== */

    function draw() {
        drawBackground();

        terrain.draw();

        for (const ufo of ufos) {
            drawUFO(ufo);
        }

        avi.draw();

        drawMilestone();
    }


    /* ======================================================
       MAIN LOOP
    ====================================================== */

    function loop(timestamp) {
        animationFrame = null;

        let delta =
            (timestamp - lastTime) / 16.6667;

        lastTime = timestamp;

        /*
         * Prevent a giant physics jump after the
         * browser tab has been backgrounded.
         */

        delta = clamp(delta, 0, 2);

        update(delta);

        draw();

        animationFrame =
            requestAnimationFrame(loop);
    }


    /* ======================================================
       INPUT
    ====================================================== */

    function handleJump(event) {
        /*
         * Do not hijack buttons or sliders.
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
            event.code === "Space" ||
            event.code === "ArrowUp" ||
            event.type === "pointerdown"
        ) {
            event.preventDefault();

            if (!running && !gameOver) {
                startGame();
                return;
            }

            if (gameOver) {
                resetGame();
                return;
            }

            avi.jump();
        }
    }

    document.addEventListener(
        "keydown",
        handleJump
    );

    canvas.addEventListener(
        "pointerdown",
        handleJump
    );


    /* ======================================================
       PAUSE
    ====================================================== */

    if (pauseButton) {
        pauseButton.addEventListener(
            "click",
            () => {
                togglePause();
            }
        );
    }


    /* ======================================================
       RESET
    ====================================================== */

    if (resetButton) {
        resetButton.addEventListener(
            "click",
            () => {
                resetGame();
            }
        );
    }


    /* ======================================================
       START
    ====================================================== */

    if (startButton) {
        startButton.addEventListener(
            "click",
            () => {
                startGame();
            }
        );
    }


    /* ======================================================
       RESTART
    ====================================================== */

    if (restartButton) {
        restartButton.addEventListener(
            "click",
            () => {
                resetGame();
            }
        );
    }


    /* ======================================================
       SPEED SLIDER
    ====================================================== */

    if (speedSlider) {
        /*
         * Normal speed is the default.
         * Only a modest amount of slowdown is allowed.
         */

        speedSlider.value = "1";

        speedSlider.addEventListener(
            "input",
            () => {
                speedMultiplier =
                    clamp(
                        Number(speedSlider.value),
                        WORLD.minSpeedMultiplier,
                        WORLD.maxSpeedMultiplier
                    );

                gameSpeed =
                    WORLD.baseSpeed *
                    speedMultiplier;
            }
        );
    }


    /* ======================================================
       SOUND TOGGLE
    ====================================================== */

    if (soundToggle) {
        soundEnabled =
            soundToggle.checked !== false;

        soundToggle.addEventListener(
            "change",
            () => {
                soundEnabled =
                    soundToggle.checked;
            }
        );
    }


    /* ======================================================
       MOBILE / TOUCH
    ====================================================== */

    document.addEventListener(
        "touchstart",
        event => {
            if (
                event.target === canvas
            ) {
                event.preventDefault();
            }
        },
        { passive: false }
    );


    /* ======================================================
       UTILITY: ROUNDED RECTANGLE
    ====================================================== */

    function roundRect(
        context,
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

        context.beginPath();

        context.moveTo(
            x + r,
            y
        );

        context.arcTo(
            x + width,
            y,
            x + width,
            y + height,
            r
        );

        context.arcTo(
            x + width,
            y + height,
            x,
            y + height,
            r
        );

        context.arcTo(
            x,
            y + height,
            x,
            y,
            r
        );

        context.arcTo(
            x,
            y,
            x + width,
            y,
            r
        );

        context.closePath();
    }


    /* ======================================================
       INITIALIZATION
    ====================================================== */

    function initialize() {
        resizeCanvas();

        avi.reset();

        terrain.reset();

        createStars();

        updateScoreDisplay();

        draw();

        /*
         * The game itself waits for the user's first action.
         * This keeps audio/browser autoplay policies happy.
         */

        running = false;
        paused = false;
        gameOver = false;
    }

    initialize();

})();
