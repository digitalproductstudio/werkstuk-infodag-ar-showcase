// Flag to indicate if onboarding is still active.
let onboardingActive = true;

/* ---------------------------
         Onboarding
--------------------------- */
const driverObj = window.driver.js.driver({
    showProgress: true,
    opacity: 0.75,
    steps: [
        { popover: { 
            title: "Welcome to Ball Invader", 
            description: "Use your voice to Reload by saying Reload, Restart or Play Again to play it Again, Reset to put the timer back in 20, Say Home to go back to the main show page, Say IMD or Join to go to the IMD website. You can also hover your hand over the 'Reload' text to reload bullets!", 
            side: "top", 
            align: "start" 
        } }
    ],
    onDestroyed: () => {
        // Set the flag to false once onboarding is closed,
        // then start the game.
        onboardingActive = false;
        startGame();
    }
});
driverObj.drive();

/* ---------------------------
         Game Variables
--------------------------- */
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
    lastShootTime = 0, score = 0, timeLeft = 30, gameActive = true,
    timerInterval, handClosed = false;

// Hover timer and tracking variables
let reloadHoverTimer = null;
let isHovering = false;
let hoverIndicator = 0; // For visual feedback during hover

const CONFIG = {
    ballSpawnInterval: 1000, 
    minBallSpeed: 1.5, 
    maxBallSpeed: 3.5,
    ballRadius: 15, 
    bulletRadius: 5, 
    bulletSpeed: 5, 
    cursorRadius: 10,
    shootCooldown: 300, 
    multiDirectionBullets: 10, 
    gameTime: 30,
    hoverReloadTime: 200 // Time required to hover for reload (ms)
};

const DIRECTIONS = ["top", "right", "bottom", "left"];

/* ---------------------------
         Ball Spawning
--------------------------- */
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

/* ---------------------------
        Reload Bullets
--------------------------- */
const reloadBullets = () => {
    if (bulletCount === 50) return;
    bulletCount = 50;
    bulletDisplay.innerText = `Bullets: ${bulletCount}`;
    bulletDisplay.style.color = 'white';
    bulletDisplay.style.cursor = 'default';
    bulletDisplay.style.textDecoration = 'none';
    bulletDisplay.onclick = null;
    
    // Reset hover tracking
    isHovering = false;
    hoverIndicator = 0;
    if (reloadHoverTimer) {
        clearTimeout(reloadHoverTimer);
        reloadHoverTimer = null;
    }
    
    playSound('./assets/sounds/reload.mp3');
};

/* ---------------------------
        Timer Setup
--------------------------- */
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

/* ---------------------------
      Update Cursor & Game
--------------------------- */
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
        
        // Check if cursor is hovering over the "Reload" text when bullet count is 0
        if (bulletCount === 0) {
            checkCursorOverReload();
        }
    }

    updateBalls();
    updateBullets();
    drawExplosions();
    checkBallHitsCursor();
    
    // Draw hover progress indicator if currently hovering
    if (isHovering && bulletCount === 0) {
        drawHoverIndicator();
    }
};

/* ---------------------------
   Draw Hover Progress Indicator
--------------------------- */
const drawHoverIndicator = () => {
    const bulletRect = bulletDisplay.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    // Convert screen coordinates to canvas coordinates
    const canvasX = ((bulletRect.left + bulletRect.width/2) - canvasRect.left) * (canvas.width / canvasRect.width);
    const canvasY = (bulletRect.bottom - canvasRect.top + 15) * (canvas.height / canvasRect.height);
    
    // Draw progress bar background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(canvasX - 25, canvasY, 50, 5);
    
    // Draw progress
    ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
    const progress = (hoverIndicator / CONFIG.hoverReloadTime) * 50;
    ctx.fillRect(canvasX - 25, canvasY, progress, 5);
};

/* ---------------------------
   Check Cursor Over Reload
--------------------------- */
const checkCursorOverReload = () => {
    // Get the position and dimensions of the bulletDisplay element
    const bulletRect = bulletDisplay.getBoundingClientRect();
    
    // Convert canvas coordinates to screen coordinates
    const canvasRect = canvas.getBoundingClientRect();
    const screenX = (cursor.x / canvas.width) * canvasRect.width + canvasRect.left;
    const screenY = (cursor.y / canvas.height) * canvasRect.height + canvasRect.top;
    
    // Check if cursor is over the Reload text
    if (screenX >= bulletRect.left && screenX <= bulletRect.right &&
        screenY >= bulletRect.top && screenY <= bulletRect.bottom) {
        
        // Set hovering flag for visual feedback
        isHovering = true;
        
        // Increase hover timer
        if (!reloadHoverTimer) {
            const startTime = Date.now();
            hoverIndicator = 0;
            
            // Use requestAnimationFrame for smoother visual feedback
            const updateHover = () => {
                const elapsed = Date.now() - startTime;
                hoverIndicator = elapsed;
                
                if (elapsed >= CONFIG.hoverReloadTime) {
                    // Time threshold reached, reload bullets
                    reloadBullets();
                    reloadHoverTimer = null;
                } else if (isHovering) {
                    // Keep updating if still hovering
                    reloadHoverTimer = requestAnimationFrame(updateHover);
                }
            };
            
            reloadHoverTimer = requestAnimationFrame(updateHover);
        }
    } else {
        // Clear hover state if cursor moves away
        isHovering = false;
        hoverIndicator = 0;
        
        if (reloadHoverTimer) {
            cancelAnimationFrame(reloadHoverTimer);
            reloadHoverTimer = null;
        }
    }
};

const isHandClosed = landmarks =>
    [8, 12, 16, 20].every(i => Math.abs(landmarks[i].y - landmarks[i - 2].y) < 0.05);

/* ---------------------------
   Fire Multi-Direction Bullets
--------------------------- */
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

/* ---------------------------
         Draw Cursor
--------------------------- */
const drawCursor = () => {
    // Draw cursor glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(255, 255, 0, 0.7)";
    
    // Draw cursor
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, CONFIG.cursorRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Reset shadow effects
    ctx.shadowBlur = 0;
};

/* ---------------------------
       Shoot Single Bullet
--------------------------- */
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
            
            // Add visual hint for hover to reload
            const hint = document.createElement('div');
            hint.textContent = '(Hover to reload)';
            hint.style.fontSize = '12px';
            hint.style.color = 'orange';
            hint.style.position = 'absolute';
            hint.style.left = (bulletDisplay.offsetLeft) + 'px';
            hint.style.top = (bulletDisplay.offsetTop + bulletDisplay.offsetHeight + 15) + 'px';
            hint.id = 'hover-hint';
            if (!document.getElementById('hover-hint')) {
                document.body.appendChild(hint);
            }
        } else {
            bulletDisplay.innerText = `Bullets: ${bulletCount}`;
            bulletDisplay.style.color = 'white';
            bulletDisplay.style.cursor = 'default';
            bulletDisplay.style.textDecoration = 'none';
            bulletDisplay.onclick = null;
            
            // Remove hover hint if exists
            const hint = document.getElementById('hover-hint');
            if (hint) hint.remove();
        }

        playSound('./assets/sounds/pew.mp3');
    }
};

/* ---------------------------
      Play Sound Function
--------------------------- */
const playSound = src => {
    const sound = new Audio(src);
    sound.volume = 0.7; // Slightly reduce volume
    sound.play().catch(e => console.warn('Sound error:', e));
};

/* ---------------------------
         Update Bullets
--------------------------- */
const updateBullets = () => {
    ctx.fillStyle = "cyan";
    bullets.forEach((bullet, i) => {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;
        
        // Add bullet glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(0, 255, 255, 0.7)";
        
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, CONFIG.bulletRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Reset shadow for next drawing operations
        ctx.shadowBlur = 0;

        // Remove bullets off screen
        if (bullet.y < -CONFIG.bulletRadius ||
            bullet.y > canvas.height + CONFIG.bulletRadius ||
            bullet.x < -CONFIG.bulletRadius ||
            bullet.x > canvas.width + CONFIG.bulletRadius) {
            bullets.splice(i, 1);
        }
    });
    checkBulletCollision();
};

/* ---------------------------
    Draw Slimy 3D Blob Balls
--------------------------- */
function drawBlobBall(ball) {
    const x = ball.x, y = ball.y, r = ball.radius;
    ctx.save();
    ctx.translate(x, y);

    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';

    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "rgba(120,255,120,1)");
    grad.addColorStop(0.5, "rgba(0,180,0,0.8)");
    grad.addColorStop(1, "rgba(0,100,0,0.6)");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.bezierCurveTo(r, -r * 0.5, r * 0.6, -r, 0, -r);
    ctx.bezierCurveTo(-r * 0.4, -r, -r, -r * 0.4, -r, 0);
    ctx.bezierCurveTo(-r, r * 0.5, -r * 0.3, r, 0, r);
    ctx.bezierCurveTo(r * 0.7, r, r, r * 0.6, r, 0);
    ctx.closePath();
    ctx.fill();

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

/* ---------------------------
    Bullet Collision Check
--------------------------- */
const checkBulletCollision = () => {
    balls.forEach((ball, i) => {
        bullets.forEach((bullet, j) => {
            if (Math.hypot(ball.x - bullet.x, ball.y - bullet.y) < ball.radius + CONFIG.bulletRadius) {
                explosions.push({ x: ball.x, y: ball.y, size: ball.radius, color: "orange" });
                balls.splice(i, 1);
                bullets.splice(j, 1);
                scoreDisplay.innerText = `Score: ${++score}`;
            }
        });
    });
};

/* ---------------------------
   Check Ball Hits Cursor
--------------------------- */
const checkBallHitsCursor = () => {
    if (balls.some(ball =>
        Math.hypot(ball.x - cursor.x, ball.y - cursor.y) < ball.radius + CONFIG.cursorRadius
    )) {
        gameOver(true);
    }
};

/* ---------------------------
        Draw Explosions
--------------------------- */
const drawExplosions = () => {
    explosions.forEach((explosion, i) => {
        // Add glow effect to explosions
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 165, 0, 0.7)';
        
        ctx.fillStyle = explosion.color || "orange";
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.size, 0, 2 * Math.PI);
        ctx.fill();
        
        // Reset shadow effects
        ctx.shadowBlur = 0;
        
        if ((explosion.size -= 0.5) <= 0) explosions.splice(i, 1);
    });
};

/* ---------------------------
         Game Over
--------------------------- */
const gameOver = (death = false) => {
    gameActive = false;
    clearInterval(timerInterval);
    
    // Clean up hover elements
    const hint = document.getElementById('hover-hint');
    if (hint) hint.remove();
    
    if (death) {
        playSound('./assets/sounds/death.mp3');
        // Add explosion effect at cursor position
        for (let i = 0; i < 10; i++) {
            explosions.push({ 
                x: cursor.x + (Math.random() - 0.5) * 30, 
                y: cursor.y + (Math.random() - 0.5) * 30, 
                size: 15 + Math.random() * 10,
                color: ['orange', 'red', 'yellow'][Math.floor(Math.random() * 3)]
            });
        }
        
        // Add slight delay to show explosion before game over screen
        setTimeout(() => {
            gameOverScreen.style.display = 'block';
            finalScore.innerText = score;
        }, 500);
    } else {
        gameOverScreen.style.display = 'block';
        finalScore.innerText = score;
    }
};

/* ---------------------------
      Reset Timer & Restart
--------------------------- */
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
    timeLeft = 30;
    gameActive = true;
    
    // Reset hover state
    isHovering = false;
    hoverIndicator = 0;
    if (reloadHoverTimer) {
        cancelAnimationFrame(reloadHoverTimer);
        reloadHoverTimer = null;
    }

    scoreDisplay.innerText = `Score: ${score}`;
    timerDisplay.innerText = `Time: ${timeLeft}`;
    gameOverScreen.style.display = 'none';
    bulletDisplay.innerText = `Bullets: ${bulletCount}`;
    bulletDisplay.style.color = 'white';
    bulletDisplay.style.cursor = 'default';
    bulletDisplay.style.textDecoration = 'none';
    bulletDisplay.onclick = null;
    
    // Remove hover hint if exists
    const hint = document.getElementById('hover-hint');
    if (hint) hint.remove();

    startTimer();
}

/* ---------------------------
        Voice Commands
--------------------------- */
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.lang = 'en-US';

recognition.onresult = function (event) {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
    console.log("Recognized Command:", transcript);
    handleVoiceCommand(transcript);
};

// Make sure recognition restarts if it ends
recognition.onend = function() {
    recognition.start();
};

// Only allow non-onboarding voice commands if onboarding is finished.
function handleVoiceCommand(transcript) {
    if (onboardingActive) {
        // While onboarding is active, allow only commands to close it.
        const onboardingCloseCommands = ["close", "stop", "end", "quit", "destroy", "exit", "next", "skip"];
        if (onboardingCloseCommands.some(cmd => transcript.includes(cmd))) {
            driverObj.destroy();
        }
        return; // Ignore any other commands while onboarding is active.
    }
    
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
        "imd": () => window.open("https://www.arteveldehogeschool.be/nl/opleidingen/bachelor/interactive-media-development", "_blank")
    };

    for (const [command, action] of Object.entries(commands)) {
        if (transcript.includes(command)) {
            action();
            return;
        }
    }
}

/* ---------------------------
         Start Game
--------------------------- */
// The game will only start once the onboarding driver is closed.
function startGame() {
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
    
    new Camera(video, {
        onFrame: async () => await hands.send({ image: video }),
        width: 640,
        height: 480
    }).start();

    startTimer();
    window.restartGame = restartGame;
}

// Start voice recognition immediately.
recognition.start();