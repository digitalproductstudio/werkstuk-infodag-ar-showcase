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
        description: "Use your voice to Reload by saying Reload, Restart or Play Again to play it Again, Reset to put the timer back in 30, Say Home, back, menu or main to go back to the main show page, Say IMD or Join to go to the IMD website. You can also hover your hand over the 'Reload' text to reload bullets, close your hand to fire multi-directional bullets, enjoy!", 
        side: "top", 
        align: "start" 
      } }
  ],
  onDestroyed: () => {
    // Set the flag to false once onboarding is closed, then start the game.
    onboardingActive = false;
    startGame();
  }
});
driverObj.drive();


// New globals for hand-missing state and countdown
let handMissing = false;
let handCountdown = 10;
let handCountdownInterval = null;

// Start a countdown from 10 to 0. When it reaches 0, hide the message and end the game.
function startCountdown() {
  handCountdown = 10;
  updateCountdownDisplay(handCountdown);
  handCountdownInterval = setInterval(() => {
    handCountdown--;
    updateCountdownDisplay(handCountdown);
    if (handCountdown <= 0) {
      clearInterval(handCountdownInterval);
      handCountdownInterval = null;
      // Hide the container that holds the warning and countdown
      const handMessageContainer = document.getElementById('hand-message-container');
      if (handMessageContainer) {
        handMessageContainer.style.display = 'none';
      }
      gameOver(true); // End game if hand isn't detected in time.
    }
  }, 1000);
}

// Cancel the countdown and hide its display.
function clearCountdown() {
  if (handCountdownInterval) {
    clearInterval(handCountdownInterval);
    handCountdownInterval = null;
  }
  hideCountdownDisplay();
}

// Update the countdown element's text.
function updateCountdownDisplay(time) {
  const countdownElem = document.getElementById('hand-countdown');
  if (countdownElem) {
    countdownElem.innerText = time;
    countdownElem.style.display = 'block';
  }
}

// Hide the countdown display.
function hideCountdownDisplay() {
  const countdownElem = document.getElementById('hand-countdown');
  if (countdownElem) {
    countdownElem.style.display = 'none';
  }
}


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
    // Only create balls if a hand is detected
    if (handMissing) return;
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


const isReloadGesture = landmarks => {
    // Check if the index finger is extended (tip is above the first knuckle)
    const indexExtended = landmarks[8].y < landmarks[6].y;
    // Check if the middle finger is extended
    const middleExtended = landmarks[12].y < landmarks[10].y;
    // Check if the ring finger is curled (tip is below the joint)
    const ringCurled = landmarks[16].y > landmarks[14].y;
    // Check if the pinky is curled
    const pinkyCurled = landmarks[20].y > landmarks[18].y;
    
    return indexExtended && middleExtended && ringCurled && pinkyCurled;
};

/* ---------------------------
      Update Cursor & Game
--------------------------- */
const updateCursor = results => {
    // Ensure the canvas size matches the video
    if (video.videoWidth && video.videoHeight) {
      [canvas.width, canvas.height] = [video.videoWidth, video.videoHeight];
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get the hand message container element
    const handMessageContainer = document.getElementById('hand-message-container');
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      // Hand detected – if it was previously missing, clear the countdown and reset flag.
      if (handMissing) {
        handMissing = false;
        clearCountdown();
      }
      // Hide the container that shows warning and countdown
      if (handMessageContainer) {
        handMessageContainer.style.display = 'none';
      }
      
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
      
      // When bullet count is zero, check for the reload gesture (peace sign ✌️)
      if (bulletCount === 0) {
        if (isReloadGesture(landmarks)) {
          reloadBullets();
        } else {
          // Fallback: if gesture isn't present, you might still want to show the hover-based reload indicator.
          checkCursorOverReload();
        }
      }
    } else {
      // No hand detected – show the container (with the warning and countdown)
      if (handMessageContainer) {
        handMessageContainer.style.display = 'block';
      }
      // Start the countdown if not already running
      if (!handMissing) {
        handMissing = true;
        startCountdown();
      }
    }
    
    // Always update game elements (balls, bullets, explosions)
    updateBalls();
    updateBullets();
    drawExplosions();
    
    // Only check collisions if a hand is detected.
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      checkBallHitsCursor();
    }
    
    // Draw hover progress indicator if needed.
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
    const bulletRect = bulletDisplay.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const screenX = (cursor.x / canvas.width) * canvasRect.width + canvasRect.left;
    const screenY = (cursor.y / canvas.height) * canvasRect.height + canvasRect.top;
    
    if (screenX >= bulletRect.left && screenX <= bulletRect.right &&
        screenY >= bulletRect.top && screenY <= bulletRect.bottom) {
        
        isHovering = true;
        
        if (!reloadHoverTimer) {
            const startTime = Date.now();
            hoverIndicator = 0;
            
            const updateHover = () => {
                const elapsed = Date.now() - startTime;
                hoverIndicator = elapsed;
                
                if (elapsed >= CONFIG.hoverReloadTime) {
                    reloadBullets();
                    reloadHoverTimer = null;
                } else if (isHovering) {
                    reloadHoverTimer = requestAnimationFrame(updateHover);
                }
            };
            
            reloadHoverTimer = requestAnimationFrame(updateHover);
        }
    } else {
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
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(255, 255, 0, 0.7)";
    
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, CONFIG.cursorRadius, 0, 2 * Math.PI);
    ctx.fill();
    
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

        if (bulletCount === 0) {
            bulletDisplay.innerText = 'Reload';
            bulletDisplay.style.color = 'red';
            bulletDisplay.style.cursor = 'pointer';
            bulletDisplay.style.textDecoration = 'underline';
            bulletDisplay.onclick = reloadBullets;
            

            const gameContainer = document.getElementById('game-container');

            const hint = document.createElement('div');
            hint.textContent = "Flash a ✌️ to reload!";
            hint.style.whiteSpace = 'pre-line'; // Ensures line breaks are respected
            hint.style.fontSize = '16px'; // Increased size for better visibility
            hint.style.color = 'orange';
            hint.style.position = 'absolute';
            hint.style.left = bulletDisplay.offsetLeft + 'px';
            hint.style.top = (bulletDisplay.offsetTop + bulletDisplay.offsetHeight + 15) + 'px';
            hint.style.padding = '5px 10px';
            hint.style.borderRadius = '5px';
            hint.style.background = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent background for better contrast
            hint.style.fontWeight = 'bold';
            hint.style.transition = 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out';
            hint.id = 'hover-hint';
            
            // Add a pulsing effect using CSS animation
            hint.style.animation = 'pulse 1.5s infinite alternate';
            
            // Append only if it doesn't already exist
            if (!document.getElementById('hover-hint')) {
                gameContainer.appendChild(hint);
            }
            
            // Add a keyframe animation for pulsing
            const style = document.createElement('style');
            style.innerHTML = `
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(1.1); opacity: 0.8; }
                }
            `;
            document.head.appendChild(style);
            
            
            if (!document.getElementById('hover-hint')) {
                document.body.appendChild(hint);
            }
            
        } else {
            bulletDisplay.innerText = `Bullets: ${bulletCount}`;
            bulletDisplay.style.color = 'white';
            bulletDisplay.style.cursor = 'default';
            bulletDisplay.style.textDecoration = 'none';
            bulletDisplay.onclick = null;
            
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
    sound.volume = 0.7;
    sound.play().catch(e => console.warn('Sound error:', e));
};

/* ---------------------------
         Update Bullets
--------------------------- */
const updateBullets = () => {
    ctx.fillStyle = "cyan";
    bullets.forEach((bullet, i) => {
      if (!handMissing) {
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;
      }
      
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(0, 255, 255, 0.7)";
      
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, CONFIG.bulletRadius, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      if (bullet.y < -CONFIG.bulletRadius ||
          bullet.y > canvas.height + CONFIG.bulletRadius ||
          bullet.x < -CONFIG.bulletRadius ||
          bullet.x > canvas.width + CONFIG.bulletRadius) {
        bullets.splice(i, 1);
      }
    });
    if (!handMissing) {
      checkBulletCollision();
    }
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
        if (!handMissing) {
            let dx = cursor.x - ball.x,
                dy = cursor.y - ball.y,
                dist = Math.hypot(dx, dy);
            if (dist > 0) {
                ball.x += (dx / dist) * ball.speed;
                ball.y += (dy / dist) * ball.speed;
            }
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
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 165, 0, 0.7)';
        
        ctx.fillStyle = explosion.color || "orange";
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.size, 0, 2 * Math.PI);
        ctx.fill();
        
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
    
    const hint = document.getElementById('hover-hint');
    if (hint) hint.remove();
    
    if (death) {
        playSound('./assets/sounds/death.mp3');
        for (let i = 0; i < 10; i++) {
            explosions.push({ 
                x: cursor.x + (Math.random() - 0.5) * 30, 
                y: cursor.y + (Math.random() - 0.5) * 30, 
                size: 15 + Math.random() * 10,
                color: ['orange', 'red', 'yellow'][Math.floor(Math.random() * 3)]
            });
        }
        
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
    // Reset hand-related state
    handMissing = false;
    clearCountdown();
    
    bulletCount = 50;
    balls = [];
    bullets = [];
    explosions = [];
    cursor = { x: 320, y: 400 };
    lastShootTime = 0;
    score = 0;
    timeLeft = 30;
    gameActive = true;
    
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

recognition.onend = function() {
    recognition.start();
};

function handleVoiceCommand(transcript) {
    if (onboardingActive) {
      const onboardingCloseCommands = ["close", "stop", "end", "quit", "destroy", "exit", "next", "skip"];
      if (onboardingCloseCommands.some(cmd => transcript.includes(cmd))) {
        driverObj.destroy();
      }
      return; // Ignore other commands during onboarding.
    }
    
    // If the game is over, ignore "reload" and "reset" commands.
    if (!gameActive && (transcript.includes("reload") || transcript.includes("reset"))) {
      return;
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

recognition.start();