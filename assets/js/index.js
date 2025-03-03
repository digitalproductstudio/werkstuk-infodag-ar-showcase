   // Driver.js Onboarding
   const driver = window.driver.js.driver;
   const driverObj = driver({
       showProgress: true,
       opacity: 0.75,
       steps: [
           {
               element: "#bubble-link",
               popover: {
                   title: "External Link",
                   description: "Collect this bubble to join the course!",
                   side: "top",
                   align: "start"
               }
           },
           {
               element: "#bubble-color",
               popover: {
                   title: "Color Change",
                   description: "Collect this bubble to change its color.",
                   side: "top",
                   align: "start"
               }
           },
           {
               element: "#bubble-rotate",
               popover: {
                   title: "Rotation Effect",
                   description: "Collect this bubble to start spinning.",
                   side: "top",
                   align: "start"
               }
           },
           {
               element: "#bubble-grow",
               popover: {
                   title: "Ball Invader",
                   description: "Collect this bubble to play Ball Invader.",
                   side: "top",
                   align: "start"
               }
           },
           {
               popover: {
                   title: "You're Ready!",
                   description: "Collect the bubbles to interact with them!",
               }
           }
       ]
   });

   function startExperience() {
       const welcomeScreen = document.getElementById("welcome-screen");

       // Apply fade-out animation
       welcomeScreen.classList.add("slide-out");

       // Delay camera and elements until animation is done
       setTimeout(() => {
           welcomeScreen.style.display = "none"; // Hide the welcome screen completely
           document.getElementById("camera-container").style.opacity = "1";
           document.getElementById("camera-container").style.visibility = "visible";
           document.getElementById("cursor").style.opacity = "1";
           document.getElementById("cursor").style.visibility = "visible";

           document.querySelectorAll(".bubble").forEach(bubble => {
               bubble.style.opacity = "1";
               bubble.style.visibility = "visible";
           });

           startCamera();
           setTimeout(() => driverObj.drive(), 500);
       }, 800); // Match the slide-out animation duration
   }

   const videoElement = document.getElementById("camera-container");
   const cursor = document.getElementById("cursor");

   // Initialize MediaPipe Hands
   const hands = new Hands({
       locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
   });

   hands.setOptions({
       maxNumHands: 1, // Track only one hand
       modelComplexity: 1, 
       minDetectionConfidence: 0.7,
       minTrackingConfidence: 0.7,
   });

   hands.onResults(onResults);

   async function startCamera() {
       const stream = await navigator.mediaDevices.getUserMedia({ video: true });
       videoElement.srcObject = stream;

       const camera = new Camera(videoElement, {
           onFrame: async () => {
               await hands.send({ image: videoElement });
           },
           width: 640,
           height: 480,
       });

       camera.start();
   }

   function onResults(results) {
       if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
           const landmarks = results.multiHandLandmarks[0]; // Get first detected hand

           // ✅ Calculate full hand center using multiple key landmarks
           let handX = (landmarks[0].x + landmarks[1].x + landmarks[5].x + landmarks[9].x + landmarks[17].x) / 5;
           let handY = (landmarks[0].y + landmarks[1].y + landmarks[5].y + landmarks[9].y + landmarks[17].y) / 5;

           // ✅ Fix X-coordinate for flipped video
           let screenX = window.innerWidth * (1 - handX); // Flip X-axis
           let screenY = window.innerHeight * handY;

           // Move virtual cursor to hand center
           cursor.style.left = `${screenX}px`;
           cursor.style.top = `${screenY}px`;

           // Detect if the hand is over a bubble
           let element = document.elementFromPoint(screenX, screenY);
           if (element && element.classList.contains("bubble")) {
               handleBubbleClick(element.dataset.type);
           }
       }
   }

   let lastClickedBubble = null; // Store last clicked bubble
   let clickCooldown = false; // Prevent spamming

   function handleBubbleClick(type) {
       let bubble = document.getElementById(`bubble-${type}`);

       // ✅ Prevent duplicate clicks
       if (clickCooldown && lastClickedBubble === bubble) return;

       console.log("Bubble action triggered:", type);
       lastClickedBubble = bubble;
       clickCooldown = true;

       // Open External Link (only once)
       if (type === "link") {
        window.open("https://www.arteveldehogeschool.be/nl/opleidingen/bachelor/interactive-media-development", "_blank");
    }

       // Change Color
       if (type === "color") {
           let colors = ["red", "green", "blue", "yellow", "purple", "orange"];
           let newColor = colors[Math.floor(Math.random() * colors.length)];
           bubble.style.backgroundColor = newColor;
       }

       // Rotate
       if (type === "rotate") {
           bubble.style.transition = "transform 1s linear";
           bubble.style.transform = "rotate(360deg)";
           setTimeout(() => {
               bubble.style.transform = "rotate(0deg)";
           }, 1000);
       }

       if (type === "grow") {
        let gameUrl = "./game.html";
        console.log("Navigating to:", gameUrl);
        window.open(gameUrl, "_self");
    }
    

       // ✅ Reset cooldown after 1 second (prevent multiple clicks on the same bubble)
       setTimeout(() => {
           clickCooldown = false;
           lastClickedBubble = null;
       }, 1000);
   }

   startCamera();