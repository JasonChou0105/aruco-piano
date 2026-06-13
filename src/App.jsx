import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./App.css";

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

export default function App() {
  const videoRef = useRef(null);
  const threeRef = useRef(null);

  useEffect(() => {
    let stream = null;
    let cancelled = false;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
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
    const container = threeRef.current;
    if (!container) return;

    let animationId;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100);
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(2, 4, 5);
    scene.add(light);

    const piano = createPiano();
    piano.position.set(0, -0.8, 0);
    piano.rotation.x = -0.4;
    scene.add(piano);

    function animate() {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
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
    <div className="app">
      <video ref={videoRef} className="camera" playsInline muted />
      <div ref={threeRef} className="three-layer" />
    </div>
  );
}
