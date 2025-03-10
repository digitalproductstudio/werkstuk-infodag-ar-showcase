const video = document.getElementById('video'),
    canvas = document.getElementById('canvas'),
    ctx = canvas.getContext('2d'),
    scoreDisplay = document.getElementById('score'),
    timerDisplay = document.getElementById('timer'),
    gameOverScreen = document.getElementById('gameOver'),
    finalScore = document.getElementById('finalScore');

let bulletCount = 50; 
const bulletDisplay = document.getElementById("bullets");
bulletDisplay.innerText = `Bullets: ${bulletCount}`;

let balls = [], bullets = [], explosions = [],
    cursor = { x: 320, y: 400 },
    lastShootTime = 0, score = 0, timeLeft = 20, gameActive = true,
    timerInterval, handClosed = false;

const CONFIG = {
    ballSpawnInterval: 1000, minBallSpeed: 1.5, maxBallSpeed: 3.5,
    ballRadius: 15, bulletRadius: 5, bulletSpeed: 5, cursorRadius: 10,
    shootCooldown: 300, multiDirectionBullets: 10, gameTime: 20
};

const DIRECTIONS = ["top", "right", "bottom", "left"];

// Spawn new ball
const createBall = () => {
    if (!gameActive) return;
    let direction = DIRECTIONS[Math.floor(Math.random() * 4)], x, y;
    if (direction === "top") [x, y] = [Math.random() * canvas.width, -CONFIG.ballRadius];
    if (direction === "right") [x, y] = [canvas.width + CONFIG.ballRadius, Math.random() * canvas.height];
    if (direction === "bottom") [x, y] = [Math.random() * canvas.width, canvas.height + CONFIG.ballRadius];
    if (direction === "left") [x, y] = [-CONFIG.ballRadius, Math.random() * canvas.height];

    balls.push({
        x, y,
        radius: CONFIG.ballRadius,
        speed: CONFIG.minBallSpeed + Math.random() * (CONFIG.maxBallSpeed - CONFIG.minBallSpeed),
        direction
    });
};
setInterval(createBall, CONFIG.ballSpawnInterval);

// Reload bullets
const reloadBullets = () => {
    if (bulletCount === 50) return;
    bulletCount = 50;
    bulletDisplay.innerText = `Bullets: ${bulletCount}`;
    bulletDisplay.style.color = 'white';
    bulletDisplay.style.cursor = 'default';
    bulletDisplay.style.textDecoration = 'none';
    bulletDisplay.onclick = null;
    playSound('./assets/sounds/reload.mp3');
};

// Timer setup
const startTimer = () => {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timerDisplay.innerText = `Time: ${--timeLeft}`;
        } else {
            gameOver();
        }
    }, 1000);
};

// MediaPipe Hands setup
const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.75,
    minTrackingConfidence: 0.75
});
hands.onResults(results => gameActive && updateCursor(results));

// Start camera
new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: 640,
    height: 480
}).start();

const updateCursor = results => {
    if (video.videoWidth && video.videoHeight) {
        [canvas.width, canvas.height] = [video.videoWidth, video.videoHeight];
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks.length > 0) {
        let landmarks = results.multiHandLandmarks[0],
            closed = isHandClosed(landmarks);

        // Detect fist closing to fire multi-bullets
        if (!handClosed && closed) fireMultiBullets();
        handClosed = closed;

        // Update cursor position (mirrored)
        [cursor.x, cursor.y] = [
            (1 - landmarks[8].x) * canvas.width,
            landmarks[8].y * canvas.height
        ];

        drawCursor();
        shootBullet();
    }

    updateBalls();
    updateBullets();
    drawExplosions();
    checkBallHitsCursor();
};

const isHandClosed = landmarks =>
    [8, 12, 16, 20].every(i => Math.abs(landmarks[i].y - landmarks[i - 2].y) < 0.05);

// Fire multi-direction bullets
const fireMultiBullets = () => {
    if (bulletCount >= CONFIG.multiDirectionBullets) {
        for (let i = 0; i < CONFIG.multiDirectionBullets; i++) {
            let angle = (i * 360 / CONFIG.multiDirectionBullets) * Math.PI / 180;
            bullets.push({
                x: cursor.x,
                y: cursor.y,
                dx: Math.cos(angle) * CONFIG.bulletSpeed,
                dy: Math.sin(angle) * CONFIG.bulletSpeed
            });
        }
        bulletCount -= CONFIG.multiDirectionBullets;
        bulletDisplay.innerText = `Bullets: ${bulletCount}`;
        playSound('./assets/sounds/multi-shot.mp3');
    }
};

// Draw cursor
const drawCursor = () => {
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, CONFIG.cursorRadius, 0, 2 * Math.PI);
    ctx.fill();
};

// Fire single bullet
const shootBullet = () => {
    if (Date.now() - lastShootTime > CONFIG.shootCooldown && bulletCount > 0) {
        bullets.push({ x: cursor.x, y: cursor.y, dx: 0, dy: -CONFIG.bulletSpeed });
        lastShootTime = Date.now();
        bulletCount--;

        // If out of bullets, show "Reload" clickable
        if (bulletCount === 0) {
            bulletDisplay.innerText = 'Reload';
            bulletDisplay.style.color = 'red';
            bulletDisplay.style.cursor = 'pointer';
            bulletDisplay.style.textDecoration = 'underline';
            bulletDisplay.onclick = reloadBullets;
            // make it reload when tracked hand is on the top of the word
            if (cursor.y < bulletDisplay.offsetTop + bulletDisplay.offsetHeight) {
                reloadBullets;
            }
        } else {
            bulletDisplay.innerText = `Bullets: ${bulletCount}`;
            bulletDisplay.style.color = 'white';
            bulletDisplay.style.cursor = 'default';
            bulletDisplay.style.textDecoration = 'none';
            bulletDisplay.onclick = null;
        }

        playSound('./assets/sounds/pew.mp3');
    }
};

// Play audio
const playSound = src =>
    new Audio(src).play().catch(e => console.warn('Sound error:', e));

// Update bullets
const updateBullets = () => {
    ctx.fillStyle = "cyan";
    bullets.forEach((bullet, i) => {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, CONFIG.bulletRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Remove bullets off screen
        if (bullet.y < -CONFIG.bulletRadius ||
            bullet.y > canvas.height + CONFIG.bulletRadius ||
            bullet.x < -CONFIG.bulletRadius ||
            bullet.x > canvas.width + CONFIG.bulletRadius
        ) {
            bullets.splice(i, 1);
        }
    });
    checkBulletCollision();
};

// Draw the slimy 3D blob ball
function drawBlobBall(ball) {
    const x = ball.x, y = ball.y, r = ball.radius;
    ctx.save();
    ctx.translate(x, y);

    // Add a soft shadow for extra depth and blur.
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';

    // Create a radial gradient with a slimy, glossy look.
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "rgba(120,255,120,1)"); // bright, gooey highlight
    grad.addColorStop(0.5, "rgba(0,180,0,0.8)");  // mid-tone
    grad.addColorStop(1, "rgba(0,100,0,0.6)");    // darker edge
    ctx.fillStyle = grad;

    // Blob shape via Bézier curves
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.bezierCurveTo(r, -r * 0.5, r * 0.6, -r, 0, -r);
    ctx.bezierCurveTo(-r * 0.4, -r, -r, -r * 0.4, -r, 0);
    ctx.bezierCurveTo(-r, r * 0.5, -r * 0.3, r, 0, r);
    ctx.bezierCurveTo(r * 0.7, r, r, r * 0.6, r, 0);
    ctx.closePath();
    ctx.fill();

    // Slimy outline
    ctx.strokeStyle = "rgba(0,150,0,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

const updateBalls = () => {
    balls.forEach(ball => {
        let dx = cursor.x - ball.x,
            dy = cursor.y - ball.y,
            dist = Math.hypot(dx, dy);
        if (dist > 0) {
            ball.x += (dx / dist) * ball.speed;
            ball.y += (dy / dist) * ball.speed;
        }
        drawBlobBall(ball);
    });
};

// Bullet collision check
const checkBulletCollision = () => {
    balls.forEach((ball, i) => {
        bullets.forEach((bullet, j) => {
            if (Math.hypot(ball.x - bullet.x, ball.y - bullet.y) < ball.radius + CONFIG.bulletRadius) {
                explosions.push({ x: ball.x, y: ball.y, size: ball.radius });
                balls.splice(i, 1);
                bullets.splice(j, 1);
                scoreDisplay.innerText = `Score: ${++score}`;
            }
        });
    });
};

// Check if ball hits cursor
const checkBallHitsCursor = () => {
    if (balls.some(ball =>
        Math.hypot(ball.x - cursor.x, ball.y - cursor.y) < ball.radius + CONFIG.cursorRadius
    )) {
        gameOver(true);
    }
};

// Draw explosions
const drawExplosions = () => {
    ctx.fillStyle = "orange";
    explosions.forEach((explosion, i) => {
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.size, 0, 2 * Math.PI);
        ctx.fill();
        if ((explosion.size -= 0.5) <= 0) explosions.splice(i, 1);
    });
};

// Game Over
const gameOver = (death = false) => {
    gameActive = false;
    clearInterval(timerInterval);
    if (death) playSound('./assets/sounds/death.mp3');
    gameOverScreen.style.display = 'block';
    finalScore.innerText = score;
};

// Reset timer
const resetTimer = () => {
    clearInterval(timerInterval);
    timeLeft = CONFIG.gameTime;
    timerDisplay.innerText = `Time: ${timeLeft}`;
    startTimer();
};

// Restart game
function restartGame() {
    clearInterval(timerInterval);
    bulletCount = 50;
    balls = [];
    bullets = [];
    explosions = [];
    cursor = { x: 320, y: 400 };
    lastShootTime = 0;
    score = 0;
    timeLeft = 20;
    gameActive = true;

    scoreDisplay.innerText = `Score: ${score}`;
    timerDisplay.innerText = `Time: ${timeLeft}`;
    gameOverScreen.style.display = 'none';
    bulletDisplay.innerText = `Bullets: ${bulletCount}`;
    bulletDisplay.style.color = 'white';
    bulletDisplay.style.cursor = 'default';
    bulletDisplay.style.textDecoration = 'none';
    bulletDisplay.onclick = null;

    startTimer();
}

// Voice Command Setup
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.lang = 'en-US';

recognition.onresult = function (event) {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
    console.log("Recognized Command:", transcript);

    handleVoiceCommand(transcript);
};

// Handle voice commands
function handleVoiceCommand(transcript) {
    const commands = {
        "reload": () => reloadBullets(),
        "restart": () => window.restartGame(),
        "play again": () => window.restartGame(),
        "try again": () => window.restartGame(),
        "reset": () => resetTimer(),
        "home": () => (window.location.href = "./index.html"),
        "back": () => (window.location.href = "./index.html"),
        "menu": () => (window.location.href = "./index.html"),
        "main": () => (window.location.href = "./index.html"),
        "join": () => window.open("https://www.arteveldehogeschool.be/nl/opleidingen/bachelor/interactive-media-development", "_blank"),
        "school": () => window.open("https://www.arteveldehogeschool.be/nl/opleidingen/bachelor/interactive-media-development", "_blank"),
        "imd": () => window.open("https://www.arteveldehogeschool.be/nl/opleidingen/bachelor/interactive-media-development", "_blank"),
    };

    for (const [command, action] of Object.entries(commands)) {
        if (transcript.includes(command)) {
            action();
            return;
        }
    }
}

// Optional: restart recognition on end
// recognition.onend = () => recognition.start();

// Start voice recognition & timer
recognition.start();
startTimer();
window.restartGame = restartGame;
