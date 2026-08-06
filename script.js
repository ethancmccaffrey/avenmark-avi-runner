/* ==========================================================
   AVENMARK AVI RUNNER
   GAME ENGINE
========================================================== */

(() => {

    "use strict";


    /* ========================================================
       DOM
    ======================================================== */

    const canvas =
        document.getElementById("game-canvas");

    const ctx =
        canvas.getContext("2d");


    const startScreen =
        document.getElementById("start-screen");

    const pauseScreen =
        document.getElementById("pause-screen");

    const gameOverScreen =
        document.getElementById("game-over-screen");


    const startButton =
        document.getElementById("start-button");

    const pauseButton =
        document.getElementById("pause-button");

    const resetButton =
        document.getElementById("reset-button");

    const resumeButton =
        document.getElementById("resume-button");

    const restartButton =
        document.getElementById("restart-button");


    const scoreDisplay =
        document.getElementById("score-display");

    const highScoreDisplay =
        document.getElementById("high-score-display");

    const finalScoreDisplay =
        document.getElementById("final-score");


    const speedSlider =
        document.getElementById("speed-slider");

    const speedValue =
        document.getElementById("speed-value");

    const soundToggle =
        document.getElementById("sound-toggle");


    /* ========================================================
       CONSTANTS
    ======================================================== */

    const COLORS = {

        bg: "#F5F5F2",

        dark: "#2F2F2F",

        blue: "#103159",

        copper: "#C47A45",

        muted:
            "rgba(47, 47, 47, 0.28)"
    };


    const SPEEDS = {

        0: 0.86,
        1: 1.00,
        2: 1.12,
        3: 1.26,
        4: 1.42
    };


    /* ========================================================
       GAME STATE
    ======================================================== */

    let state = "ready";

    let animationFrame = null;

    let lastTime = 0;

    let elapsed = 0;

    let distance = 0;

    let score = 0;

    let highScore =
        Number(
            localStorage.getItem(
                "avenmark-avi-high-score"
            )
        ) || 0;


    let speedLevel = 1;

    let gameSpeed =
        SPEEDS[speedLevel];


    let groundOffset = 0;

    let obstacleTimer = 0;

    let nextObstacle =
        randomBetween(1050, 1650);


    let debrisTimer = 0;

    let nextDebris =
        randomBetween(500, 1100);


    let messageTimer = 0;

    let currentMessage = "";

    let messageAlpha = 0;


    /* ========================================================
       PLAYER
    ======================================================== */

    const avi = {

        x: 100,

        y: 0,

        width: 54,

        height: 70,

        velocityY: 0,

        gravity: 0.00245,

        jumpForce: -0.84,

        grounded: true,

        bob: 0
    };


    /* ========================================================
       WORLD
    ======================================================== */

    let groundY = 0;

    let obstacles = [];

    let debris = [];

    let stars = [];


    /* ========================================================
       AUDIO
    ======================================================== */

    let audioContext = null;

    let masterGain = null;

    let soundEnabled = true;


    function initAudio() {

        if (audioContext) {
            return;
        }

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {
            return;
        }

        audioContext =
            new AudioContext();

        masterGain =
            audioContext.createGain();

        masterGain.gain.value =
            soundEnabled ? 0.055 : 0;

        masterGain.connect(
            audioContext.destination
        );
    }


    async function resumeAudio() {

        initAudio();

        if (
            audioContext &&
            audioContext.state === "suspended"
        ) {

            try {
                await audioContext.resume();
            } catch {
                // Browser declined audio resume.
            }
        }
    }


    function playTone(
        frequency,
        duration,
        type = "sine",
        volume = 0.05
    ) {

        if (
            !soundEnabled ||
            !audioContext ||
            !masterGain
        ) {
            return;
        }

        const oscillator =
            audioContext.createOscillator();

        const gain =
            audioContext.createGain();

        oscillator.type = type;

        oscillator.frequency.setValueAtTime(
            frequency,
            audioContext.currentTime
        );

        gain.gain.setValueAtTime(
            0,
            audioContext.currentTime
        );

        gain.gain.linearRampToValueAtTime(
            volume,
            audioContext.currentTime + 0.012
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);

        gain.connect(masterGain);

        oscillator.start();

        oscillator.stop(
            audioContext.currentTime + duration + 0.02
        );
    }


    function playJumpSound() {

        playTone(
            520,
            0.12,
            "triangle",
            0.07
        );

        window.setTimeout(() => {

            playTone(
                720,
                0.10,
                "triangle",
                0.04
            );

        }, 35);
    }


    function playCrashSound() {

        playTone(
            115,
            0.18,
            "sawtooth",
            0.06
        );

        window.setTimeout(() => {

            playTone(
                75,
                0.22,
                "sine",
                0.04
            );

        }, 60);
    }


    function playMilestoneSound() {

        playTone(
            660,
            0.10,
            "triangle",
            0.045
        );

        window.setTimeout(() => {

            playTone(
                880,
                0.14,
                "triangle",
                0.045
            );

        }, 80);
    }


    /* ========================================================
       RESIZE
    ======================================================== */

    function resizeCanvas() {

        const rect =
            canvas.getBoundingClientRect();

        const dpr =
            Math.min(
                window.devicePixelRatio || 1,
                2
            );

        canvas.width =
            Math.max(
                1,
                Math.floor(rect.width * dpr)
            );

        canvas.height =
            Math.max(
                1,
                Math.floor(rect.height * dpr)
            );

        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );

        groundY =
            rect.height * 0.76;

        avi.x =
            Math.max(
                55,
                rect.width * 0.115
            );

        if (avi.grounded) {

            avi.y =
                groundY - avi.height;
        }

        createStars();

        draw();
    }


    window.addEventListener(
        "resize",
        resizeCanvas
    );


    /* ========================================================
       STARS
    ======================================================== */

    function createStars() {

        const width =
            canvas.clientWidth;

        const height =
            canvas.clientHeight;

        stars = [];

        const count =
            Math.max(
                30,
                Math.floor(width / 24)
            );

        for (let i = 0; i < count; i++) {

            stars.push({

                x:
                    Math.random() * width,

                y:
                    Math.random() *
                    Math.max(
                        50,
                        height * 0.57
                    ),

                size:
                    randomBetween(
                        0.7,
                        1.8
                    ),

                alpha:
                    randomBetween(
                        0.20,
                        0.62
                    ),

                drift:
                    randomBetween(
                        0.04,
                        0.14
                    )
            });
        }
    }


    /* ========================================================
       DRAWING HELPERS
    ======================================================== */

    function roundedRect(
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


    function drawStars() {

        for (const star of stars) {

            ctx.globalAlpha =
                star.alpha;

            ctx.fillStyle =
                COLORS.copper;

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


    /* ========================================================
       UFO
    ======================================================== */

    function drawUFO(obstacle) {

        const x = obstacle.x;
        const y = obstacle.y;

        const width =
            obstacle.width;

        const height =
            obstacle.height;

        ctx.save();

        ctx.translate(
            x + width / 2,
            y + height / 2
        );

        const hover =
            Math.sin(
                elapsed * 0.005 +
                obstacle.seed
            ) * 2;

        ctx.translate(
            0,
            hover
        );


        /* top dome */

        ctx.fillStyle =
            COLORS.bg;

        ctx.strokeStyle =
            COLORS.blue;

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.ellipse(
            0,
            -height * 0.10,
            width * 0.23,
            height * 0.25,
            0,
            Math.PI,
            0
        );

        ctx.fill();

        ctx.stroke();


        /* body */

        ctx.beginPath();

        ctx.ellipse(
            0,
            0,
            width * 0.49,
            height * 0.19,
            0,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            COLORS.blue;

        ctx.fill();


        /* copper center */

        ctx.fillStyle =
            COLORS.copper;

        ctx.beginPath();

        ctx.ellipse(
            0,
            2,
            width * 0.18,
            height * 0.075,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();


        /* tiny lights */

        ctx.fillStyle =
            COLORS.copper;

        for (let i = -1; i <= 1; i++) {

            ctx.beginPath();

            ctx.arc(
                i * width * 0.25,
                height * 0.06,
                1.5,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        ctx.restore();
    }


    /* ========================================================
       CRATER
    ======================================================== */

    function drawCrater(obstacle) {

        const x = obstacle.x;
        const y = obstacle.y;

        const width =
            obstacle.width;

        const height =
            obstacle.height;


        ctx.save();

        /* subtle outer lip */

        ctx.fillStyle =
            "rgba(47,47,47,0.11)";

        ctx.beginPath();

        ctx.ellipse(
            x + width / 2,
            y + height * 0.68,
            width / 2,
            height * 0.34,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();


        /* crater interior */

        ctx.fillStyle =
            "rgba(47,47,47,0.17)";

        ctx.beginPath();

        ctx.ellipse(
            x + width / 2,
            y + height * 0.62,
            width * 0.36,
            height * 0.22,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();


        /* small lip highlight */

        ctx.strokeStyle =
            "rgba(196,122,69,0.24)";

        ctx.lineWidth = 1.4;

        ctx.beginPath();

        ctx.arc(
            x + width * 0.50,
            y + height * 0.56,
            width * 0.34,
            Math.PI * 1.08,
            Math.PI * 1.92
        );

        ctx.stroke();

        ctx.restore();
    }


    /* ========================================================
       DEBRIS
    ======================================================== */

    function drawDebrisPiece(piece) {

        ctx.save();

        ctx.translate(
            piece.x,
            piece.y
        );

        ctx.rotate(piece.rotation);

        ctx.fillStyle =
            "rgba(47,47,47,0.28)";

        ctx.beginPath();

        ctx.moveTo(
            -piece.size,
            piece.size * .3
        );

        ctx.lineTo(
            -piece.size * .3,
            -piece.size
        );

        ctx.lineTo(
            piece.size,
            -piece.size * .25
        );

        ctx.lineTo(
            piece.size * .25,
            piece.size
        );

        ctx.closePath();

        ctx.fill();

        ctx.restore();
    }


    /* ========================================================
       AVI
    ======================================================== */

    function drawAvi() {

        const x = avi.x;
        const y =
            avi.y +
            Math.sin(avi.bob) * 1.2;

        const w =
            avi.width;

        const h =
            avi.height;


        ctx.save();

        ctx.translate(
            x,
            y
        );


        /* shadow */

        if (avi.grounded) {

            ctx.fillStyle =
                "rgba(47,47,47,0.12)";

            ctx.beginPath();

            ctx.ellipse(
                w * 0.52,
                h + 5,
                w * 0.48,
                5,
                0,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }


        /* backpack */

        ctx.fillStyle =
            COLORS.blue;

        roundedRect(
            w * 0.03,
            h * 0.36,
            w * 0.21,
            h * 0.39,
            6
        );

        ctx.fill();


        /* helmet */

        ctx.fillStyle =
            COLORS.bg;

        ctx.strokeStyle =
            COLORS.blue;

        ctx.lineWidth = 2;

        ctx.beginPath();

        ctx.arc(
            w * 0.50,
            h * 0.21,
            w * 0.25,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.stroke();


        /* visor */

        ctx.fillStyle =
            COLORS.blue;

        roundedRect(
            w * 0.36,
            h * 0.12,
            w * 0.28,
            h * 0.18,
            7
        );

        ctx.fill();


        /* body */

        ctx.fillStyle =
            COLORS.bg;

        ctx.strokeStyle =
            COLORS.blue;

        ctx.lineWidth = 2;

        roundedRect(
            w * 0.28,
            h * 0.38,
            w * 0.44,
            h * 0.38,
            8
        );

        ctx.fill();

        ctx.stroke();


        /* Avenmark copper detail */

        ctx.fillStyle =
            COLORS.copper;

        roundedRect(
            w * 0.46,
            h * 0.43,
            w * 0.09,
            h * 0.15,
            2
        );

        ctx.fill();


        /* legs */

        ctx.strokeStyle =
            COLORS.blue;

        ctx.lineWidth = 5;

        ctx.lineCap = "round";

        const running =
            Math.sin(
                elapsed * 0.025
            );

        ctx.beginPath();

        ctx.moveTo(
            w * 0.40,
            h * 0.74
        );

        ctx.lineTo(
            w * (0.32 + running * 0.10),
            h * 0.96
        );

        ctx.stroke();


        ctx.beginPath();

        ctx.moveTo(
            w * 0.60,
            h * 0.74
        );

        ctx.lineTo(
            w * (0.70 - running * 0.10),
            h * 0.96
        );

        ctx.stroke();


        /* boots */

        ctx.lineWidth = 6;

        ctx.beginPath();

        ctx.moveTo(
            w * (0.27 + running * 0.10),
            h * 0.97
        );

        ctx.lineTo(
            w * (0.39 + running * 0.10),
            h * 0.97
        );

        ctx.stroke();


        ctx.beginPath();

        ctx.moveTo(
            w * (0.64 - running * 0.10),
            h * 0.97
        );

        ctx.lineTo(
            w * (0.76 - running * 0.10),
            h * 0.97
        );

        ctx.stroke();


        /* laptop */

        const laptopX =
            w * 0.63;

        const laptopY =
            h * 0.48;


        /* laptop screen */

        ctx.fillStyle =
            COLORS.blue;

        roundedRect(
            laptopX,
            laptopY,
            w * 0.25,
            h * 0.17,
            3
        );

        ctx.fill();


        /* screen face */

        ctx.fillStyle =
            COLORS.bg;

        roundedRect(
            laptopX + 3,
            laptopY + 3,
            w * 0.19,
            h * 0.10,
            2
        );

        ctx.fill();


        /* copper screen mark */

        ctx.fillStyle =
            COLORS.copper;

        ctx.fillRect(
            laptopX + 7,
            laptopY + 7,
            5,
            2
        );


        /* laptop base */

        ctx.fillStyle =
            COLORS.blue;

        ctx.beginPath();

        ctx.moveTo(
            laptopX - 4,
            laptopY + h * 0.17
        );

        ctx.lineTo(
            laptopX + w * 0.28,
            laptopY + h * 0.17
        );

        ctx.lineTo(
            laptopX + w * 0.23,
            laptopY + h * 0.21
        );

        ctx.lineTo(
            laptopX,
            laptopY + h * 0.21
        );

        ctx.closePath();

        ctx.fill();


        /* arms holding laptop */

        ctx.strokeStyle =
            COLORS.blue;

        ctx.lineWidth = 5;

        ctx.beginPath();

        ctx.moveTo(
            w * 0.34,
            h * 0.47
        );

        ctx.lineTo(
            w * 0.66,
            h * 0.54
        );

        ctx.stroke();


        ctx.beginPath();

        ctx.moveTo(
            w * 0.66,
            h * 0.49
        );

        ctx.lineTo(
            w * 0.76,
            h * 0.55
        );

        ctx.stroke();


        ctx.restore();
    }


    /* ========================================================
       GROUND
    ======================================================== */

    function drawGround(width) {

        ctx.strokeStyle =
            "rgba(47,47,47,0.30)";

        ctx.lineWidth = 1.4;

        ctx.beginPath();

        ctx.moveTo(
            0,
            groundY + 1
        );

        ctx.lineTo(
            width,
            groundY + 1
        );

        ctx.stroke();


        /* very subtle lunar marks */

        const spacing = 120;

        for (
            let x = -spacing + groundOffset;
            x < width + spacing;
            x += spacing
        ) {

            ctx.strokeStyle =
                "rgba(47,47,47,0.08)";

            ctx.beginPath();

            ctx.moveTo(
                x,
                groundY + 13
            );

            ctx.lineTo(
                x + 28,
                groundY + 13
            );

            ctx.stroke();
        }
    }


    /* ========================================================
       CONTINUE MESSAGE
    ======================================================== */

    function drawMessage(width) {

        if (
            !currentMessage ||
            messageAlpha <= 0
        ) {
            return;
        }

        ctx.save();

        ctx.globalAlpha =
            messageAlpha;

        ctx.fillStyle =
            COLORS.copper;

        ctx.font =
            "700 12px Montserrat, sans-serif";

        ctx.textAlign = "center";

        ctx.fillText(
            currentMessage,
            width / 2,
            48
        );

        ctx.restore();
    }


    /* ========================================================
       DRAW
    ======================================================== */

    function draw() {

        const width =
            canvas.clientWidth;

        const height =
            canvas.clientHeight;

        if (!width || !height) {
            return;
        }


        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        ctx.fillStyle =
            COLORS.bg;

        ctx.fillRect(
            0,
            0,
            width,
            height
        );


        drawStars();

        drawGround(width);


        for (const piece of debris) {

            drawDebrisPiece(piece);
        }


        for (const obstacle of obstacles) {

            if (obstacle.type === "ufo") {

                drawUFO(obstacle);

            } else {

                drawCrater(obstacle);
            }
        }


        drawAvi();

        drawMessage(width);
    }


    /* ========================================================
       GAME LOOP
    ======================================================== */

    function gameLoop(timestamp) {

        if (state !== "running") {

            animationFrame = null;

            return;
        }


        if (!lastTime) {

            lastTime = timestamp;
        }


        let delta =
            timestamp - lastTime;

        lastTime =
            timestamp;


        delta =
            Math.min(
                delta,
                40
            );


        update(delta);

        draw();


        animationFrame =
            requestAnimationFrame(
                gameLoop
            );
    }


    /* ========================================================
       UPDATE
    ======================================================== */

    function update(delta) {

        elapsed += delta;


        const movement =
            gameSpeed *
            delta;


        distance += movement;

        score =
            Math.floor(
                distance / 12
            );


        groundOffset -=
            movement * 0.65;

        if (groundOffset < -120) {

            groundOffset += 120;
        }


        avi.bob +=
            delta * 0.018;


        updateAvi(delta);

        updateObstacles(movement);

        updateDebris(movement);

        updateMessage(delta);

        updateScore();


        if (
            score > 0 &&
            score % 500 === 0 &&
            Math.floor(
                distance / 12
            ) !==
            Math.floor(
                (distance - movement) / 12
            )
        ) {

            currentMessage =
                "Continue plz :)";

            messageAlpha = 1;

            messageTimer = 1900;

            playMilestoneSound();
        }
    }


    /* ========================================================
       AVI UPDATE
    ======================================================== */

    function updateAvi(delta) {

        if (!avi.grounded) {

            avi.velocityY +=
                avi.gravity *
                delta;

            avi.y +=
                avi.velocityY *
                delta;


            if (
                avi.y >=
                groundY - avi.height
            ) {

                avi.y =
                    groundY - avi.height;

                avi.velocityY = 0;

                avi.grounded = true;
            }
        }
    }


    /* ========================================================
       OBSTACLES
    ======================================================== */

    function updateObstacles(movement) {

        obstacleTimer += movement;

        if (
            obstacleTimer >=
            nextObstacle
        ) {

            spawnObstacle();

            obstacleTimer = 0;

            const difficulty =
                Math.min(
                    score / 3500,
                    1
                );

            const minimum =
                850 -
                difficulty * 170;

            const maximum =
                1450 -
                difficulty * 260;

            nextObstacle =
                randomBetween(
                    minimum,
                    maximum
                );
        }


        for (
            let i = obstacles.length - 1;
            i >= 0;
            i--
        ) {

            const obstacle =
                obstacles[i];

            obstacle.x -= movement;


            if (
                obstacle.x +
                obstacle.width <
                -40
            ) {

                obstacles.splice(
                    i,
                    1
                );

                continue;
            }


            if (
                collision(
                    avi,
                    obstacle
                )
            ) {

                endGame();

                return;
            }
        }
    }


    function spawnObstacle() {

        const width =
            canvas.clientWidth;

        const useUFO =
            score >= 250 &&
            Math.random() < 0.38;


        if (useUFO) {

            const obstacleWidth =
                randomBetween(
                    48,
                    62
                );

            const obstacleHeight =
                randomBetween(
                    27,
                    34
                );

            obstacles.push({

                type: "ufo",

                x:
                    width + 40,

                y:
                    groundY -
                    randomBetween(
                        78,
                        132
                    ),

                width:
                    obstacleWidth,

                height:
                    obstacleHeight,

                seed:
                    Math.random() * 100
            });

        } else {

            const obstacleWidth =
                randomBetween(
                    48,
                    72
                );

            const obstacleHeight =
                randomBetween(
                    19,
                    27
                );

            obstacles.push({

                type: "crater",

                x:
                    width + 40,

                y:
                    groundY -
                    obstacleHeight * 0.75,

                width:
                    obstacleWidth,

                height:
                    obstacleHeight
            });
        }
    }


    /* ========================================================
       DEBRIS
    ======================================================== */

    function updateDebris(movement) {

        debrisTimer += movement;

        if (
            debrisTimer >=
            nextDebris
        ) {

            spawnDebris();

            debrisTimer = 0;

            nextDebris =
                randomBetween(
                    650,
                    1300
                );
        }


        for (
            let i = debris.length - 1;
            i >= 0;
            i--
        ) {

            const piece =
                debris[i];

            piece.x -=
                movement * 0.65;

            piece.rotation +=
                0.002 * movement;


            if (
                piece.x <
                -20
            ) {

                debris.splice(
                    i,
                    1
                );
            }
        }
    }


    function spawnDebris() {

        const width =
            canvas.clientWidth;

        debris.push({

            x:
                width + 30,

            y:
                randomBetween(
                    groundY + 17,
                    groundY + 35
                ),

            size:
                randomBetween(
                    2,
                    4
                ),

            rotation:
                Math.random() *
                Math.PI * 2
        });
    }


    /* ========================================================
       COLLISION
    ======================================================== */

    function collision(
        player,
        obstacle
    ) {

        let px =
            player.x +
            player.width * 0.25;

        let py =
            player.y +
            player.height * 0.12;

        let pw =
            player.width * 0.52;

        let ph =
            player.height * 0.83;


        if (
            obstacle.type === "ufo"
        ) {

            return (
                px <
                    obstacle.x +
                    obstacle.width * 0.82 &&

                px + pw >
                    obstacle.x +
                    obstacle.width * 0.18 &&

                py <
                    obstacle.y +
                    obstacle.height * 0.80 &&

                py + ph >
                    obstacle.y +
                    obstacle.height * 0.20
            );
        }


        return (
            px <
                obstacle.x +
                obstacle.width * 0.90 &&

            px + pw >
                obstacle.x +
                obstacle.width * 0.10 &&

            py + ph >
                obstacle.y +
                obstacle.height * 0.30
        );
    }


    /* ========================================================
       MESSAGE
    ======================================================== */

    function updateMessage(delta) {

        if (!currentMessage) {
            return;
        }

        messageTimer -= delta;

        if (messageTimer <= 0) {

            messageAlpha -=
                delta / 450;

            if (messageAlpha <= 0) {

                messageAlpha = 0;

                currentMessage = "";
            }
        }
    }


    /* ========================================================
       SCORE
    ======================================================== */

    function updateScore() {

        scoreDisplay.textContent =
            score.toString();

        highScoreDisplay.textContent =
            highScore.toString();
    }


    /* ========================================================
       START
    ======================================================== */

    async function startGame() {

        await resumeAudio();

        state = "running";

        hideScreen(
            startScreen
        );

        hideScreen(
            gameOverScreen
        );

        hideScreen(
            pauseScreen
        );


        pauseButton.disabled = false;

        resetButton.disabled = false;


        lastTime = 0;

        if (!animationFrame) {

            animationFrame =
                requestAnimationFrame(
                    gameLoop
                );
        }
    }


    /* ========================================================
       PAUSE
    ======================================================== */

    function pauseGame() {

        if (
            state !== "running"
        ) {
            return;
        }

        state = "paused";

        hideScreen(
            startScreen
        );

        hideScreen(
            gameOverScreen
        );

        showScreen(
            pauseScreen
        );

        pauseButton.textContent =
            "Resume";

        if (animationFrame) {

            cancelAnimationFrame(
                animationFrame
            );

            animationFrame = null;
        }

        draw();
    }


    /* ========================================================
       RESUME
    ======================================================== */

    async function resumeGame() {

        if (
            state !== "paused"
        ) {
            return;
        }

        await resumeAudio();

        state = "running";

        hideScreen(
            pauseScreen
        );

        pauseButton.textContent =
            "Pause";

        lastTime = 0;

        animationFrame =
            requestAnimationFrame(
                gameLoop
            );
    }


    /* ========================================================
       RESET
    ======================================================== */

    function resetGame() {

        state = "ready";

        if (animationFrame) {

            cancelAnimationFrame(
                animationFrame
            );

            animationFrame = null;
        }


        distance = 0;

        score = 0;

        elapsed = 0;

        lastTime = 0;

        obstacleTimer = 0;

        debrisTimer = 0;

        nextObstacle =
            randomBetween(
                1050,
                1650
            );

        nextDebris =
            randomBetween(
                500,
                1100
            );


        obstacles = [];

        debris = [];


        currentMessage = "";

        messageAlpha = 0;

        messageTimer = 0;


        avi.velocityY = 0;

        avi.grounded = true;

        avi.y =
            groundY -
            avi.height;


        pauseButton.textContent =
            "Pause";


        showScreen(
            startScreen
        );

        hideScreen(
            pauseScreen
        );

        hideScreen(
            gameOverScreen
        );


        updateScore();

        draw();
    }


    /* ========================================================
       GAME OVER
    ======================================================== */

    function endGame() {

        if (
            state === "gameover"
        ) {
            return;
        }


        state = "gameover";


        if (score > highScore) {

            highScore = score;

            localStorage.setItem(
                "avenmark-avi-high-score",
                highScore.toString()
            );
        }


        finalScoreDisplay.textContent =
            score.toString();


        updateScore();

        playCrashSound();


        showScreen(
            gameOverScreen
        );

        hideScreen(
            pauseScreen
        );

        hideScreen(
            startScreen
        );


        pauseButton.textContent =
            "Pause";


        if (animationFrame) {

            cancelAnimationFrame(
                animationFrame
            );

            animationFrame = null;
        }

        draw();
    }


    /* ========================================================
       JUMP
    ======================================================== */

    async function jump() {

        if (
            state !== "running"
        ) {
            return;
        }

        if (
            !avi.grounded
        ) {
            return;
        }

        await resumeAudio();

        avi.grounded = false;

        avi.velocityY =
            avi.jumpForce;

        playJumpSound();
    }


    /* ========================================================
       SCREEN HELPERS
    ======================================================== */

    function showScreen(screen) {

        screen.classList.add(
            "active"
        );
    }


    function hideScreen(screen) {

        screen.classList.remove(
            "active"
        );
    }


    /* ========================================================
       CONTROLS
    ======================================================== */

    startButton.addEventListener(
        "click",
        startGame
    );


    restartButton.addEventListener(
        "click",
        async () => {

            resetGame();

            await startGame();
        }
    );


    resumeButton.addEventListener(
        "click",
        resumeGame
    );


    pauseButton.addEventListener(
        "click",
        async () => {

            if (
                state === "running"
            ) {

                pauseGame();

            } else if (
                state === "paused"
            ) {

                await resumeGame();
            }
        }
    );


    resetButton.addEventListener(
        "click",
        resetGame
    );


    speedSlider.addEventListener(
        "input",
        () => {

            speedLevel =
                Number(
                    speedSlider.value
                );

            gameSpeed =
                SPEEDS[speedLevel];

            speedValue.textContent =
                speedLevel.toString();
        }
    );


    soundToggle.addEventListener(
        "change",
        async () => {

            soundEnabled =
                soundToggle.checked;

            initAudio();

            if (
                audioContext &&
                audioContext.state ===
                "suspended"
            ) {

                await resumeAudio();
            }

            if (masterGain) {

                masterGain.gain.setTargetAtTime(

                    soundEnabled
                        ? 0.055
                        : 0,

                    audioContext.currentTime,

                    0.025
                );
            }

            if (soundEnabled) {

                playTone(
                    520,
                    0.08,
                    "triangle",
                    0.035
                );
            }
        }
    );


    /* ========================================================
       KEYBOARD
    ======================================================== */

    window.addEventListener(
        "keydown",
        async (event) => {

            if (
                event.code === "Space" ||
                event.code === "ArrowUp" ||
                event.code === "KeyW"
            ) {

                event.preventDefault();

                if (
                    state === "ready"
                ) {

                    await startGame();

                    return;
                }

                if (
                    state === "gameover"
                ) {

                    resetGame();

                    await startGame();

                    return;
                }

                if (
                    state === "paused"
                ) {

                    await resumeGame();

                    return;
                }

                await jump();
            }


            if (
                event.code === "KeyP"
            ) {

                if (
                    state === "running"
                ) {

                    pauseGame();

                } else if (
                    state === "paused"
                ) {

                    await resumeGame();
                }
            }
        }
    );


    /* ========================================================
       POINTER / TOUCH
    ======================================================== */

    canvas.addEventListener(
        "pointerdown",
        async () => {

            if (
                state === "running"
            ) {

                await jump();
            }
        }
    );


    /* ========================================================
       UTILITIES
    ======================================================== */

    function randomBetween(
        min,
        max
    ) {

        return (
            Math.random() *
            (max - min) +
            min
        );
    }


    /* ========================================================
       INITIALIZATION
    ======================================================== */

    function initialize() {

        soundEnabled =
            soundToggle.checked;

        speedLevel =
            Number(
                speedSlider.value
            );

        gameSpeed =
            SPEEDS[speedLevel];


        highScoreDisplay.textContent =
            highScore.toString();

        scoreDisplay.textContent =
            "0";


        resizeCanvas();

        resetGame();
    }


    initialize();

})();
