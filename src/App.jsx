import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import "./App.css";

const EYE_SEPARATION = 0.05;

function createPiano() {
  const piano = new THREE.Group();

  const whiteKeys = 8;
  const whiteWidth = 0.35;

  for (let i = 0; i < whiteKeys; i++) {
    const key = new THREE.Mesh(
      new THREE.BoxGeometry(whiteWidth, 0.08, 1.2),
      new THREE.MeshStandardMaterial({ color: "white" }),
    );

    key.position.x = (i - whiteKeys / 2) * whiteWidth;
    piano.add(key);
  }

  const blackPositions = [0, 1, 3, 4, 5];

  for (const i of blackPositions) {
    const key = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: "black" }),
    );

    key.position.x = (i - whiteKeys / 2 + 0.5) * whiteWidth;
    key.position.y = 0.1;
    key.position.z = -0.25;
    piano.add(key);
  }

  return piano;
}

function drawVideoCover(ctx, video, x, y, width, height) {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  if (!videoWidth || !videoHeight || !width || !height) return;

  const videoRatio = videoWidth / videoHeight;
  const targetRatio = width / height;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = videoWidth;
  let sourceHeight = videoHeight;

  if (videoRatio > targetRatio) {
    sourceWidth = videoHeight * targetRatio;
    sourceX = (videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = videoWidth / targetRatio;
    sourceY = (videoHeight - sourceHeight) / 2;
  }

  ctx.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

export default function App() {
  const videoRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const threeRef = useRef(null);
  const appRef = useRef(null);

  const [isLandscape, setIsLandscape] = useState(
    window.innerWidth > window.innerHeight,
  );

  const [isFullscreen, setIsFullscreen] = useState(false);

  async function enterFullscreen() {
    const app = appRef.current;
    if (!app) return;

    try {
      if (app.requestFullscreen) {
        await app.requestFullscreen();
      } else if (app.webkitRequestFullscreen) {
        await app.webkitRequestFullscreen();
      }

      if (screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock("landscape");
        } catch (err) {
          console.warn("Could not lock orientation:", err);
        }
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }

  useEffect(() => {
    function checkOrientation() {
      setIsLandscape(window.innerWidth > window.innerHeight);
    }

    function checkFullscreen() {
      const fullscreenElement =
        document.fullscreenElement || document.webkitFullscreenElement;

      setIsFullscreen(Boolean(fullscreenElement));
    }

    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    document.addEventListener("fullscreenchange", checkFullscreen);
    document.addEventListener("webkitfullscreenchange", checkFullscreen);

    checkOrientation();
    checkFullscreen();

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);

      document.removeEventListener("fullscreenchange", checkFullscreen);
      document.removeEventListener("webkitfullscreenchange", checkFullscreen);
    };
  }, []);

  useEffect(() => {
    let stream = null;
    let cancelled = false;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled || !videoRef.current) return;

        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        await videoRef.current.play();
      } catch (err) {
        console.error("Camera error:", err);
      }
    }

    startCamera();

    return () => {
      cancelled = true;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = cameraCanvasRef.current;
    const app = appRef.current;

    if (!video || !canvas || !app) return;

    const ctx = canvas.getContext("2d");
    let animationId;

    function drawLoop() {
      const rect = app.getBoundingClientRect();

      const cssWidth = rect.width;
      const cssHeight = rect.height;

      const dpr = window.devicePixelRatio || 1;

      const canvasWidth = Math.floor(cssWidth * dpr);
      const canvasHeight = Math.floor(cssHeight * dpr);

      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }

      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const halfWidth = cssWidth / 2;

      drawVideoCover(ctx, video, 0, 0, halfWidth, cssHeight);
      drawVideoCover(ctx, video, halfWidth, 0, halfWidth, cssHeight);

      animationId = requestAnimationFrame(drawLoop);
    }

    drawLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  useEffect(() => {
    const container = threeRef.current;
    const app = appRef.current;

    if (!container || !app) return;

    let animationId;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setScissorTest(true);
    renderer.setClearColor(0x000000, 0);

    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(2, 4, 5);
    scene.add(directionalLight);

    const piano = createPiano();

    piano.position.set(0, -0.75, 0);
    piano.rotation.x = -0.4;
    piano.scale.set(1.2, 1.2, 1.2);

    scene.add(piano);

    const leftCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
    const rightCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);

    leftCamera.position.set(-EYE_SEPARATION / 2, 0, 4);
    rightCamera.position.set(EYE_SEPARATION / 2, 0, 4);

    function renderStereo() {
      const rect = app.getBoundingClientRect();

      const width = rect.width;
      const height = rect.height;
      const halfWidth = width / 2;

      renderer.setSize(width, height, false);

      leftCamera.aspect = halfWidth / height;
      rightCamera.aspect = halfWidth / height;

      leftCamera.updateProjectionMatrix();
      rightCamera.updateProjectionMatrix();

      renderer.clear();

      renderer.setViewport(0, 0, halfWidth, height);
      renderer.setScissor(0, 0, halfWidth, height);
      renderer.render(scene, leftCamera);

      renderer.setViewport(halfWidth, 0, halfWidth, height);
      renderer.setScissor(halfWidth, 0, halfWidth, height);
      renderer.render(scene, rightCamera);
    }

    function animate() {
      animationId = requestAnimationFrame(animate);
      renderStereo();
    }

    animate();

    return () => {
      cancelAnimationFrame(animationId);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
    };
  }, []);

  return (
    <div ref={appRef} className="app">
      {!isLandscape && (
        <div className="rotate-warning">
          Rotate your phone sideways for AR glasses mode
        </div>
      )}

      {!isFullscreen && (
        <button className="fullscreen-button" onClick={enterFullscreen}>
          Enter Fullscreen
        </button>
      )}

      <video
        ref={videoRef}
        className="hidden-video"
        playsInline
        muted
        autoPlay
      />

      <canvas ref={cameraCanvasRef} className="camera-canvas" />

      <div className="divider" />

      <div ref={threeRef} className="three-layer" />
    </div>
  );
}
