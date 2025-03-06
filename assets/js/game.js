const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');
const gameOverScreen = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');

let balls = [],
    bullets = [],
    explosions = [];
let cursor = {
    x: 320,
    y: 400
};
let lastShootTime = 0,
    score = 0,
    timeLeft = 20,
    gameActive = true;
let timerInterval;

// 🏀 Create Balls
function createBall() {
    if (!gameActive) return;
    balls.push({
        x: Math.random() * canvas.width,
        y: 0,
        speed: 2 + Math.random() * 3,
        radius: 15
    });
}
setInterval(createBall, 1000);

// ⏳ Timer Countdown
function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            timerDisplay.innerText = `Time: ${timeLeft}`;
        } else {
            gameOver();
        }
    }, 1000);
}

// ✋ Hand Tracking
const hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.75,
    minTrackingConfidence: 0.75
});
hands.onResults(results => {
    if (gameActive) updateCursor(results);
});

const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 640,
    height: 480
});
camera.start();

// 🎯 Cursor Updates
function updateCursor(results) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks.length > 0) {
        let landmark = results.multiHandLandmarks[0][8]; // Index Finger Tip
        cursor.x = (1 - landmark.x) * canvas.width;
        cursor.y = landmark.y * canvas.height;

        drawCursor();
        shootBullet();
    }

    updateBalls();
    updateBullets();
    drawExplosions();
    checkBallHitsCursor();
}

function drawCursor() {
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 10, 0, 2 * Math.PI);
    ctx.fill();
}

function shootBullet() {
    let now = Date.now();
    if (now - lastShootTime > 300) {
        bullets.push({ x: cursor.x, y: cursor.y });
        lastShootTime = now;
        new Audio('./assets/sounds/pew.mp3').play();
    }
}

function updateBullets() {
    ctx.fillStyle = "cyan";
    bullets.forEach((bullet, index) => {
        bullet.y -= 5;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        if (bullet.y < 0) bullets.splice(index, 1);
    });
    checkBulletCollision();
}

function updateBalls() {
    ctx.fillStyle = "red";
    balls.forEach((ball, index) => {
        ball.y += ball.speed;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
        ctx.fill();
        if (ball.y > canvas.height) balls.splice(index, 1);
    });
}

function checkBulletCollision() {
    balls.forEach((ball, i) => {
        bullets.forEach((bullet, j) => {
            if (Math.hypot(ball.x - bullet.x, ball.y - bullet.y) < ball.radius + 5) {
                explosions.push({ x: ball.x, y: ball.y, size: 15 });
                balls.splice(i, 1);
                bullets.splice(j, 1);
                score++;
                scoreDisplay.innerText = `Score: ${score}`;
            }
        });
    });
}

function checkBallHitsCursor() {
    balls.forEach(ball => {
        if (Math.hypot(ball.x - cursor.x, ball.y - cursor.y) < ball.radius + 10) {
            gameOver(true);
        }
    });
}

function drawExplosions() {
    ctx.fillStyle = "orange";
    explosions.forEach((explosion, index) => {
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.size, 0, 2 * Math.PI);
        ctx.fill();
        explosion.size--;
        if (explosion.size <= 0) explosions.splice(index, 1);
    });
}

function gameOver(death = false) {
    gameActive = false;
    clearInterval(timerInterval);
    if (death) new Audio('./assets/sounds/scream.mp3').play();
    gameOverScreen.style.display = 'block';
    finalScore.innerText = score;
}

function restartGame() {
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
        "restart": () => window.restartGame(),
        "play again": () => window.restartGame(),
        "try again": () => window.restartGame(),
        "reset": () => window.restartGame(),

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
recognition.onend = () => recognition.start();

// 🚀 Start voice recognition automatically
recognition.start();

startTimer();
window.restartGame = restartGame;
