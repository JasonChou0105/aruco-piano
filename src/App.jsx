import { useEffect, useRef } from "react";
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

  if (!videoWidth || !videoHeight) return;

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

    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    let animationId;

    function drawLoop() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const halfWidth = width / 2;

      canvas.width = width;
      canvas.height = height;

      ctx.clearRect(0, 0, width, height);

      drawVideoCover(ctx, video, 0, 0, halfWidth, height);
      drawVideoCover(ctx, video, halfWidth, 0, halfWidth, height);

      animationId = requestAnimationFrame(drawLoop);
    }

    drawLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  useEffect(() => {
    const container = threeRef.current;
    if (!container) return;

    let animationId;

    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setScissorTest(true);
    renderer.setClearColor(0x000000, 0);

    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(2, 4, 5);
    scene.add(directionalLight);

    const piano = createPiano();

    piano.position.set(0, -0.8, 0);
    piano.rotation.x = -0.4;
    piano.scale.set(1.2, 1.2, 1.2);

    scene.add(piano);

    const leftCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / 2 / window.innerHeight,
      0.01,
      100,
    );

    const rightCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / 2 / window.innerHeight,
      0.01,
      100,
    );

    leftCamera.position.set(-EYE_SEPARATION / 2, 0, 4);
    rightCamera.position.set(EYE_SEPARATION / 2, 0, 4);

    function renderStereo() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const halfWidth = width / 2;

      renderer.clear();

      leftCamera.aspect = halfWidth / height;
      rightCamera.aspect = halfWidth / height;

      leftCamera.updateProjectionMatrix();
      rightCamera.updateProjectionMatrix();

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

    function handleResize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
    };
  }, []);

  return (
    <div className="app">
      <video
        ref={videoRef}
        className="hidden-video"
        playsInline
        muted
        autoPlay
      />

      <canvas ref={cameraCanvasRef} className="camera-canvas" />

      <div ref={threeRef} className="three-layer" />
    </div>
  );
}
