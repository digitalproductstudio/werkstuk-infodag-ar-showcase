// Driver.js Onboarding
const driverObj = window.driver.js.driver({
    showProgress: true,
    opacity: 0.75,
    steps: [
      { popover: { title: "Welcome to the IMD AR Showcase!", description: "Use your voice or click to navigate! Say 'next', 'continue', 'forward', 'back', 'previous', to move through the steps, 'skip' or 'close' to exit.", side: "top", align: "start" } },
      { element: "#bubble-link", popover: { title: "External Link", description: "Collect this bubble to join the course!", side: "top", align: "start" } },
      { element: "#bubble-color", popover: { title: "3D Portal", description: "Collect this bubble to open a 3D portal!", side: "top", align: "start" } },
      { element: "#bubble-rotate", popover: { title: "Blob Physics", description: "Collect this bubble to play with 3D blobs!", side: "top", align: "start" } },
      { element: "#bubble-grow", popover: { title: "Ball Invader", description: "Collect this bubble to play Ball Invader.", side: "top", align: "start" } },
      { popover: { title: "You're Ready!", description: "Collect the bubbles to interact with them!" } }
    ],
    onDestroyed() { new Audio('./assets/sounds/bubbles.mp3').play(); }
  });
  
  function startExperience() {
    setup3DEnvironment();
    startCamera();
    setTimeout(() => driverObj.drive(), 500);
  }
  
  function setup3DEnvironment() {
    const style = document.createElement('style');
    style.textContent = `
      body { overflow-x:hidden; position:fixed; width:100%; height:100%; margin:0; padding:0; }
      @keyframes portal-spin { 0% { transform: translate(-50%,-50%) rotate3d(1,1,1,0deg); } 100% { transform: translate(-50%,-50%) rotate3d(1,1,1,360deg); } }
      @keyframes portal-pulse { 0% { opacity:0.7; box-shadow:0 0 30px #4a00e0,0 0 80px #8e2de2; } 50% { opacity:0.9; box-shadow:0 0 60px #4a00e0,0 0 100px #8e2de2; } 100% { opacity:0.7; box-shadow:0 0 30px #4a00e0,0 0 80px #8e2de2; } }
      @keyframes float-particle { 0% { transform:translate(0,0) rotate(0deg); opacity:1; } 100% { transform:translate(var(--x),var(--y)) rotate(var(--r)); opacity:0; } }
      #cursor { transition: opacity 0.3s ease-out, visibility 0.3s; }
      .portal-ring { position:absolute; border:15px solid #8e2de2; border-radius:50%; transform:translate(-50%,-50%); box-shadow:0 0 30px #4a00e0,0 0 80px #8e2de2; animation: portal-spin 8s linear infinite, portal-pulse 3s ease-in-out infinite; pointer-events:none; }
      .gravity-container { position:absolute; width:300px; height:300px; border-radius:50%; background:radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 100%); transform:translate(-50%,-50%); pointer-events:none; overflow:hidden; }
      .blob { position:absolute; background:rgba(255,255,255,0.8); animation: blob-morph 5s ease-in-out infinite; transform-origin:center center; pointer-events:none; will-change:transform, border-radius; }
    `;
    document.head.appendChild(style);
  }
  
  const videoElement = document.getElementById("camera-container"),
        cursor = document.getElementById("cursor");
  
  const hands = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
  hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
  hands.onResults(onResults);
  
  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    new Camera(videoElement, {
      onFrame: async () => await hands.send({ image: videoElement }),
      width: 640,
      height: 480
    }).start();
  }
  
  let handDetected = false, lastHandDetection = 0,
      handDetectionTimeout = 500,
      blobsActive = false, blobs = [],
      gravityCenterX = 0, gravityCenterY = 0,
      blobContainer = null,
      portalActive = false, portalElement = null, portalTimeout = null,
      lastClickedBubble = null, clickCooldown = false;
  
  function onResults(results) {
    const now = Date.now();
    if (results.multiHandLandmarks?.length) {
      handDetected = true; lastHandDetection = now;
      const landmarks = results.multiHandLandmarks[0];
      cursor.style.visibility = "visible";
      cursor.style.opacity = "1";
      let handX = (landmarks[0].x + landmarks[1].x + landmarks[5].x + landmarks[9].x + landmarks[17].x) / 5,
          handY = (landmarks[0].y + landmarks[1].y + landmarks[5].y + landmarks[9].y + landmarks[17].y) / 5,
          screenX = window.innerWidth * (1 - handX),
          screenY = window.innerHeight * handY;
      cursor.style.left = `${screenX}px`;
      cursor.style.top = `${screenY}px`;
      updateBlobPhysics(screenX, screenY);
      let el = document.elementFromPoint(screenX, screenY);
      if (el) {
        if (el.id === "modal-close-btn") closeInfoModal();
        else if (el.classList.contains("bubble")) handleBubbleClick(el.dataset.type);
      }
    } else if (now - lastHandDetection > handDetectionTimeout) {
      handDetected = false;
      cursor.style.visibility = "hidden";
      cursor.style.opacity = "0";
      if (portalActive) cleanupPortalEffect();
      if (blobsActive) cleanupBlobPhysics();
    }
  }
  
  function updateBlobPhysics(x, y) {
    if (!blobsActive) return;
    gravityCenterX = x; gravityCenterY = y;
    if (blobContainer) { blobContainer.style.left = `${x}px`; blobContainer.style.top = `${y}px`; }
    blobs.forEach(blob => {
      const blobX = parseFloat(blob.style.left), blobY = parseFloat(blob.style.top),
            dx = gravityCenterX - blobX, dy = gravityCenterY - blobY,
            distance = Math.sqrt(dx * dx + dy * dy);
      let force = Math.min(4, 180 / (distance + 10)) + (Math.random() * 0.5 - 0.25);
      blob.vx += (dx / distance) * force;
      blob.vy += (dy / distance) * force;
      blob.vx *= 0.98; blob.vy *= 0.98;
      blob.style.left = `${blobX + blob.vx}px`;
      blob.style.top = `${blobY + blob.vy}px`;
      const speed = Math.sqrt(blob.vx ** 2 + blob.vy ** 2),
            maxTilt = 30,
            tiltX = (blob.vy / 10) * maxTilt,
            tiltY = (-blob.vx / 10) * maxTilt;
      blob.style.transform = `perspective(800px) translateZ(${speed * 2}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      let normalized = Math.min(1, distance / 300),
          size = blob.baseSize * (1 - normalized * 0.3);
      blob.style.width = `${size}px`;
      blob.style.height = `${size}px`;
      let newBlobX = parseFloat(blob.style.left), newBlobY = parseFloat(blob.style.top),
          newDx = newBlobX - gravityCenterX, newDy = newBlobY - gravityCenterY,
          newDistance = Math.sqrt(newDx ** 2 + newDy ** 2);
      if (newDistance > 150 - size / 2) {
        let nx = newDx / newDistance, ny = newDy / newDistance,
            dot = blob.vx * nx + blob.vy * ny;
        blob.style.left = `${gravityCenterX + nx * (150 - size / 2)}px`;
        blob.style.top = `${gravityCenterY + ny * (150 - size / 2)}px`;
        blob.vx = (blob.vx - 2 * dot * nx) * 0.8;
        blob.vy = (blob.vy - 2 * dot * ny) * 0.8;
      }
    });
  }
  
  function handleBubbleClick(type) {
    const bubble = document.getElementById(`bubble-${type}`);
    if (clickCooldown && lastClickedBubble === bubble) return;
    lastClickedBubble = bubble; clickCooldown = true;
    if (type === "link") window.open("https://www.arteveldehogeschool.be/nl/opleidingen/bachelor/interactive-media-development", "_blank");
    if (type === "color") {
      cleanupPortalEffect();
      const r = bubble.getBoundingClientRect();
      createPortalEffect(r.left + r.width / 2, r.top + r.height / 2);
      bubble.style.animation = "none"; bubble.offsetHeight;
      bubble.style.transform = "scale(1.2)";
      bubble.style.boxShadow = "0 0 30px currentColor, 0 0 60px white";
      setTimeout(() => {
        bubble.style.animation = "pulse 2s infinite alternate";
        bubble.style.transform = "scale(1)";
        bubble.style.boxShadow = "0 0 15px currentColor, 0 0 30px rgba(255,255,255,0.3)";
      }, 5000);
      new Audio('./assets/sounds/portal.mp3').play();
    }
    if (type === "rotate") {
      cleanupBlobPhysics();
      const r = bubble.getBoundingClientRect();
      createBlobPhysics(r.left + r.width / 2, r.top + r.height / 2);
      bubble.style.animation = "none"; bubble.offsetHeight;
      bubble.style.transform = "scale(1.2)";
      bubble.style.boxShadow = "0 0 30px currentColor, 0 0 60px white";
      setTimeout(() => {
        bubble.style.animation = "pulse 2s infinite alternate";
        bubble.style.transform = "scale(1)";
        bubble.style.boxShadow = "0 0 15px currentColor, 0 0 30px rgba(255,255,255,0.3)";
        if (!handDetected) cleanupBlobPhysics();
      }, 12000);
    }
    if (type === "grow") {
      window.open("./game.html", "_self");
    }
    if (type === "info") openInfoModal();
    setTimeout(() => { clickCooldown = false; lastClickedBubble = null; }, 1000);
  }
  
  function openInfoModal() {
    document.getElementById("info-modal")?.remove();
    const modal = document.createElement("div");
    modal.id = "info-modal";
    Object.assign(modal.style, {
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)", width: "300px", padding: "20px",
      background: "rgba(20,20,20,0.95)", border: "2px solid rgba(255,255,255,0.2)",
      borderRadius: "12px", boxShadow: "0 0 20px rgba(255,255,255,0.3)",
      color: "white", textAlign: "center", zIndex: "1000", opacity: "0",
      transition: "opacity 0.3s ease-in-out"
    });
    const p = document.createElement("p");
    p.innerText = "Made by Karim and Mohamad Matar.";
    p.style.fontSize = "18px"; p.style.marginBottom = "15px"; modal.appendChild(p);
    const img = document.createElement("img");
    img.src = "./assets/logo/artevelde.png"; // Check that this path is correct!
  img.alt = "Artevelde University College";
  Object.assign(img.style, {
    width: "100%",
    height: "auto",
    borderRadius: "8px",
    marginBottom: "15px"
  });
  modal.appendChild(img);
    const btn = document.createElement("button");
    btn.id = "modal-close-btn";
    btn.innerText = "Close";
    Object.assign(btn.style, {
      padding: "10px 20px", border: "none",
      background: "rgba(255,255,255,0.2)", color: "white", fontSize: "16px",
      cursor: "pointer", borderRadius: "8px", transition: "background 0.2s"
    });
    btn.onmouseover = () => btn.style.background = "rgba(255,255,255,0.4)";
    btn.onmouseleave = () => btn.style.background = "rgba(255,255,255,0.2)";
    btn.onclick = closeInfoModal;
    modal.appendChild(btn);
    document.body.appendChild(modal);
    setTimeout(() => modal.style.opacity = "1", 10);
  }
  
  function closeInfoModal() {
    const modal = document.getElementById("info-modal");
    if (modal) { modal.style.opacity = "0"; setTimeout(() => modal.remove(), 300); }
  }
  
  function createPortalEffect(x, y) {
    portalActive = true;
    portalElement = document.createElement('div');
    portalElement.className = 'portal-ring';
    portalElement.style.left = `${x}px`;
    portalElement.style.top = `${y}px`;
    portalElement.style.width = portalElement.style.height = '0';
    document.body.appendChild(portalElement);
    setTimeout(() => {
      portalElement.style.transition = 'width 1.5s cubic-bezier(0.34,1.56,0.64,1), height 1.5s cubic-bezier(0.34,1.56,0.64,1)';
      portalElement.style.width = portalElement.style.height = '300px';
    }, 10);
    for (let i = 0; i < 30; i++) {
      setTimeout(() => { portalElement && createPortalParticle(x, y); }, 1500 + i * 100);
    }
    portalTimeout = setTimeout(cleanupPortalEffect, 5000);
  }
  
  function createPortalParticle(x, y) {
    const particle = document.createElement('div'),
          size = 5 + Math.random() * 10;
    particle.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background-color:hsl(${260 + Math.random() * 60},100%,${70 + Math.random() * 30}%);left:${x}px;top:${y}px;transform:translate(-50%,-50%);box-shadow:0 0 10px currentColor;z-index:1000;pointer-events:none;`;
    const angle = Math.random() * Math.PI * 2,
          distance = 100 + Math.random() * 150,
          xDest = Math.cos(angle) * distance,
          yDest = Math.sin(angle) * distance,
          rotation = Math.random() * 360;
    particle.style.setProperty('--x', `${xDest}px`);
    particle.style.setProperty('--y', `${yDest}px`);
    particle.style.setProperty('--r', `${rotation}deg`);
    particle.style.animation = `float-particle ${1 + Math.random() * 2}s ease-out forwards`;
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 3000);
  }
  
  function cleanupPortalEffect() {
    if (portalElement) {
      portalElement.style.transition = 'width 0.8s cubic-bezier(0.34,1.56,0.64,1), height 0.8s cubic-bezier(0.34,1.56,0.64,1), opacity 0.8s ease-in-out';
      portalElement.style.width = portalElement.style.height = '0';
      portalElement.style.opacity = '0';
      setTimeout(() => { portalElement?.remove(); portalElement = null; }, 800);
    }
    portalActive = false;
    portalTimeout && (clearTimeout(portalTimeout), portalTimeout = null);
  }
  
  function createBlobPhysics(x, y) {
    blobsActive = true; gravityCenterX = x; gravityCenterY = y;
    blobContainer = document.createElement('div');
    blobContainer.className = 'gravity-container';
    blobContainer.style.left = `${x}px`;
    blobContainer.style.top = `${y}px`;
    document.body.appendChild(blobContainer);
    for (let i = 0; i < 12; i++) {
      const blob = document.createElement('div');
      blob.className = 'blob';
      const size = 20 + Math.random() * 25;
      blob.baseSize = size;
      const angle = Math.random() * Math.PI * 2,
            distance = Math.random() * 120,
            blobX = x + Math.cos(angle) * distance,
            blobY = y + Math.sin(angle) * distance;
      blob.style.left = `${blobX}px`;
      blob.style.top = `${blobY}px`;
      blob.style.width = blob.style.height = `${size}px`;
      blob.style.animationDelay = `${Math.random() * 5}s`;
      blob.vx = (Math.random() - 0.5) * 8;
      blob.vy = (Math.random() - 0.5) * 8;
      const hue = Math.random() * 360,
            sat = 70 + Math.random() * 30,
            light = 60 + Math.random() * 20;
      blob.style.background = `radial-gradient(circle at 30% 30%, hsla(${hue}, ${sat}%, ${light + 15}%,0.9), hsla(${hue}, ${sat}%, ${light}%,0.8))`;
      blob.style.boxShadow = `0 0 15px hsla(${hue}, ${sat}%, ${light}%,0.6)`;
      blob.style.willChange = "transform, border-radius";
      document.body.appendChild(blob);
      blobs.push(blob);
    }
    if (!window.blobPhysicsInterval) {
      window.blobPhysicsInterval = setInterval(() => {
        blobsActive ? updateBlobPhysics(gravityCenterX, gravityCenterY) : (clearInterval(window.blobPhysicsInterval), window.blobPhysicsInterval = null);
      }, 16);
    }
  }
  
  function cleanupBlobPhysics() {
    blobsActive = false;
    blobs.forEach(blob => {
      if (blob.parentNode) {
        blob.style.transition = "opacity 0.5s ease-out, transform 0.5s ease-out";
        blob.style.opacity = "0";
        blob.style.transform = "scale(0.5)";
        setTimeout(() => blob.remove(), 500);
      }
    });
    blobs = [];
    blobContainer && (blobContainer.remove(), blobContainer = null);
    window.blobPhysicsInterval && (clearInterval(window.blobPhysicsInterval), window.blobPhysicsInterval = null);
  }
  
  startExperience();
  
  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;  // Keep recognition running
recognition.interimResults = true; // Capture words faster
recognition.lang = 'en-US';

recognition.onresult = event => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript.trim().toLowerCase();
    }

    const commands = {
        go: startExperience, begin: startExperience, start: startExperience,
        imd: () => handleBubbleClick("link"), school: () => handleBubbleClick("link"), join: () => handleBubbleClick("link"),
        game: () => handleBubbleClick("grow"), "play game": () => handleBubbleClick("grow"),
        next: () => driverObj.moveNext(), continue: () => driverObj.moveNext(), forward: () => driverObj.moveNext(),
        back: () => driverObj.movePrevious(), previous: () => driverObj.movePrevious(),
        restart: () => driverObj.restart(),
        exit: () => driverObj.destroy(), close: () => driverObj.destroy(), skip: () => driverObj.destroy()
    };

    for (const [cmd, action] of Object.entries(commands)) {
        if (transcript.includes(cmd)) {
            console.log(`Command detected: ${cmd}`);
            action();
            recognition.abort(); // Stop to avoid duplicate triggers
            setTimeout(() => recognition.start(), 100); // Restart immediately
            break;
        }
    }
};

// Restart immediately when stopped
recognition.onend = () => {
    setTimeout(() => recognition.start(), 100);
};

// Start recognition
recognition.start();
