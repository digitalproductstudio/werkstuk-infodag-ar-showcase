const video = document.getElementById('video'),
    canvas = document.getElementById('canvas'),
    ctx = canvas.getContext('2d'),
    scoreDisplay = document.getElementById('score'),
    timerDisplay = document.getElementById('timer'),
    gameOverScreen = document.getElementById('gameOver'),
    finalScore = document.getElementById('finalScore');
 
    let bulletCount = 50; // Start with 20 bullets
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
 
const createBall = () => {
    if (!gameActive) return;
    let direction = DIRECTIONS[Math.floor(Math.random() * 4)], x, y;
    if (direction === "top") [x, y] = [Math.random() * canvas.width, -CONFIG.ballRadius];
    if (direction === "right") [x, y] = [canvas.width + CONFIG.ballRadius, Math.random() * canvas.height];
    if (direction === "bottom") [x, y] = [Math.random() * canvas.width, canvas.height + CONFIG.ballRadius];
    if (direction === "left") [x, y] = [-CONFIG.ballRadius, Math.random() * canvas.height];
 
    balls.push({ x, y, radius: CONFIG.ballRadius, speed: CONFIG.minBallSpeed + Math.random() * (CONFIG.maxBallSpeed - CONFIG.minBallSpeed), direction });
};
 
setInterval(createBall, CONFIG.ballSpawnInterval);
 
const reloadBullets = () => {
    if (bulletCount === 50) return;
    bulletCount = 50;
    bulletDisplay.innerText = `Bullets: ${bulletCount}`;
    playSound('./assets/sounds/reload.mp3');
};
 
 
const startTimer = () => {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timeLeft > 0) timerDisplay.innerText = `Time: ${--timeLeft}`;
        else gameOver();
    }, 1000);
};
 
const hands = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.75, minTrackingConfidence: 0.75 });
hands.onResults(results => gameActive && updateCursor(results));
 
new Camera(video, { onFrame: async () => await hands.send({ image: video }), width: 640, height: 480 }).start();
 
const updateCursor = results => {
    if (video.videoWidth && video.videoHeight) [canvas.width, canvas.height] = [video.videoWidth, video.videoHeight];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (results.multiHandLandmarks.length > 0) {
        let landmarks = results.multiHandLandmarks[0], closed = isHandClosed(landmarks);
        if (!handClosed && closed) fireMultiBullets();
        handClosed = closed;
        [cursor.x, cursor.y] = [(1 - landmarks[8].x) * canvas.width, landmarks[8].y * canvas.height];
        drawCursor();
        shootBullet();
    }
    updateBalls();
    updateBullets();
    drawExplosions();
    checkBallHitsCursor();
};
 
const isHandClosed = landmarks => [8, 12, 16, 20].every(i => Math.abs(landmarks[i].y - landmarks[i - 2].y) < 0.05);
 
const fireMultiBullets = () => {
    if (bulletCount >= CONFIG.multiDirectionBullets) {
        for (let i = 0; i < CONFIG.multiDirectionBullets; i++) {
            let angle = (i * 360 / CONFIG.multiDirectionBullets) * Math.PI / 180;
            bullets.push({ x: cursor.x, y: cursor.y, dx: Math.cos(angle) * CONFIG.bulletSpeed, dy: Math.sin(angle) * CONFIG.bulletSpeed });
        }
        bulletCount -= CONFIG.multiDirectionBullets; // Decrease bullet count
        bulletDisplay.innerText = `Bullets: ${bulletCount}`; // Update bullet count on screen
        playSound('./assets/sounds/multi-shot.mp3');
    }
};
 
 
const drawCursor = () => {
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, CONFIG.cursorRadius, 0, 2 * Math.PI);
    ctx.fill();
};
 
const shootBullet = () => {
    if (Date.now() - lastShootTime > CONFIG.shootCooldown && bulletCount > 0) {
        bullets.push({ x: cursor.x, y: cursor.y, dx: 0, dy: -CONFIG.bulletSpeed });
        lastShootTime = Date.now();
        bulletCount--; // Decrease bullet count
        // if the bullet count is 0, display "Reload" instead of the actual count
        if (bulletCount === 0) {
            bulletDisplay.innerText = `Reload`;
            bulletDisplay.style.color = "red";
        } else {
            bulletDisplay.innerText = `Bullets: ${bulletCount}`;
            bulletDisplay.style.color = "white";
        }
       
        playSound('./assets/sounds/pew.mp3');
    }
};
 
 
const playSound = src => new Audio(src).play().catch(e => console.warn('Sound error:', e));
 
const updateBullets = () => {
    ctx.fillStyle = "cyan";
    bullets.forEach((bullet, i) => {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, CONFIG.bulletRadius, 0, 2 * Math.PI);
        ctx.fill();
        if (bullet.y < -CONFIG.bulletRadius || bullet.y > canvas.height + CONFIG.bulletRadius || bullet.x < -CONFIG.bulletRadius || bullet.x > canvas.width + CONFIG.bulletRadius)
            bullets.splice(i, 1);
    });
    checkBulletCollision();
};
 
const updateBalls = () => {
    ctx.fillStyle = "red";
    balls.forEach(ball => {
        let dx = cursor.x - ball.x, dy = cursor.y - ball.y, dist = Math.hypot(dx, dy);
        if (dist > 0) [ball.x, ball.y] = [ball.x + (dx / dist) * ball.speed, ball.y + (dy / dist) * ball.speed];
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
        ctx.fill();
    });
};
 
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
 
const checkBallHitsCursor = () => {
    if (balls.some(ball => Math.hypot(ball.x - cursor.x, ball.y - cursor.y) < ball.radius + CONFIG.cursorRadius)) gameOver(true);
};
 
const drawExplosions = () => {
    ctx.fillStyle = "orange";
    explosions.forEach((explosion, i) => {
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.size, 0, 2 * Math.PI);
        ctx.fill();
        if ((explosion.size -= 0.5) <= 0) explosions.splice(i, 1);
    });
};
 
const gameOver = (death = false) => {
    gameActive = false;
    clearInterval(timerInterval);
    if (death) playSound('./assets/sounds/death.mp3');
    gameOverScreen.style.display = 'block';
    finalScore.innerText = score;
};
 
const resetTimer = () => {
    clearInterval(timerInterval);
    timeLeft = CONFIG.gameTime;
    timerDisplay.innerText = `Time: ${timeLeft}`;
    startTimer();
};
 
 
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
 
    startTimer();
}
 
// 🎤 Voice Command Setup
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.lang = 'en-US';
 
recognition.onresult = function (event) {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
    console.log("Recognized Command:", transcript);
 
    handleVoiceCommand(transcript);
};
 
// 🎯 Function to Handle Commands
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
            return; // Exit after executing the command
        }
    }
}
 
// 🔄 Restart recognition when it stops
// recognition.onend = () => recognition.start();
 
// 🚀 Start voice recognition automatically
recognition.start();
 
startTimer();
window.restartGame = restartGame;