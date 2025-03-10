document.addEventListener("DOMContentLoaded", () => {
    const welcomeScreen = document.getElementById("welcome-screen");
    const cameraContainer = document.getElementById("camera-container");
    const cursor = document.getElementById("cursor");
    const interactivePanel = document.getElementById("interactive-panel");

    function startExperience() {
        welcomeScreen.classList.add("slide-out");
        setTimeout(() => {
            welcomeScreen.style.display = "none";
            cameraContainer.style.opacity = "1";
            interactivePanel.classList.remove("hidden");
            startCamera();
        }, 800);
    }

    async function startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraContainer.srcObject = stream;

        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7,
        });

        hands.onResults(onResults);

        const camera = new Camera(cameraContainer, {
            onFrame: async () => {
                await hands.send({ image: cameraContainer });
            },
            width: 640,
            height: 480,
        });
        camera.start();
    }

    function onResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            let handX = (landmarks[0].x + landmarks[5].x + landmarks[9].x) / 3;
            let handY = (landmarks[0].y + landmarks[5].y + landmarks[9].y) / 3;
            let screenX = window.innerWidth * (1 - handX);
            let screenY = window.innerHeight * handY;
            
            cursor.style.left = `${screenX}px`;
            cursor.style.top = `${screenY}px`;
        }
    }

    window.startExperience = startExperience;
});