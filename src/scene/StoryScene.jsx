import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles } from "@react-three/drei";
import { STORY } from "../config/story.js";

const roomTargets = {
  welcome: { camera: [0, 3.5, 15], target: [0, 2.5, -1] },
  room1: { camera: [0, 2.7, 4.6], target: [0, 1.8, -1] },
  hall1: { camera: [4.15, 2.55, -11], target: [4.15, 1.8, -20] },
  room2: { camera: [4.15, 2.7, -44], target: [0, 1.8, -49] },
  hall2: { camera: [4.15, 2.55, -57], target: [4.15, 1.8, -66] },
  room3: { camera: [4.15, 2.35, -89], target: [0, 1.7, -94] },
  ending: { camera: [4.15, 2.35, -89], target: [0, 1.7, -94] },
};

const doorTargets = {
  welcome: { camera: [0, 2.35, 7.9], target: [0, 1.8, 5.78] },
  room1: { camera: [4.15, 2.25, -2.6], target: [4.15, 1.8, -6] },
  hall1: { camera: [4.15, 2.25, -36.5], target: [4.15, 1.8, -40] },
  room2: { camera: [4.15, 2.25, -48.5], target: [4.15, 1.8, -52] },
  hall2: { camera: [4.15, 2.25, -82.5], target: [4.15, 1.8, -86] },
};

const cameraBounds = {
  room1: [-5.15, 5.15, -5.5, 5.15],
  room2: [-5.15, 5.15, -51.5, -40.85],
  hall1: [1.25, 7.05, -37.2, -7.2],
  hall2: [1.25, 7.05, -83.2, -53.2],
  room3: [-5.15, 5.15, -97.3, -86.85],
};

function SceneCamera({ stage, doorApproaching, doorPrompt, movement, onDoorReached, reducedMotion }) {
  const { camera } = useThree();
  const controls = useRef();
  const onDoorReachedRef = useRef(onDoorReached);
  const transition = useRef({ elapsed: 0, duration: 1.45, fromCamera: new THREE.Vector3(), toCamera: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3(), notifyDoor: false, completed: true });
  const lookAt = useRef(new THREE.Vector3(0, 1.8, 0));
  const walkVelocity = useRef(new THREE.Vector3());
  const vectors = useMemo(() => ({
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    desired: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
  }), []);
  const destinationMode = doorTargets[stage] && (doorApproaching || doorPrompt) ? "door" : "room";

  useEffect(() => { onDoorReachedRef.current = onDoorReached; }, [onDoorReached]);

  useEffect(() => {
    const destination = destinationMode === "door" ? doorTargets[stage] : roomTargets[stage];
    const state = transition.current;
    state.elapsed = 0;
    state.completed = false;
    state.notifyDoor = doorApproaching && destinationMode === "door";
    walkVelocity.current.set(0, 0, 0);
    state.fromCamera.copy(camera.position);
    state.fromTarget.copy(controls.current?.target || lookAt.current);
    state.toCamera.set(...destination.camera);
    state.toTarget.set(...destination.target);
    state.duration = reducedMotion ? 0.01 : THREE.MathUtils.clamp(state.fromCamera.distanceTo(state.toCamera) / 5.5, 1.35, 6.3);
    if (controls.current) controls.current.enabled = false;
  }, [stage, destinationMode, reducedMotion, camera]);

  useFrame((_, delta) => {
    const state = transition.current;
    if (state.elapsed < state.duration) {
      state.elapsed += delta;
      const t = Math.min(state.elapsed / state.duration, 1);
      const smooth = t * t * t * (t * (t * 6 - 15) + 10);
      camera.position.lerpVectors(state.fromCamera, state.toCamera, smooth);
      lookAt.current.lerpVectors(state.fromTarget, state.toTarget, smooth);
      camera.lookAt(lookAt.current);
      if (controls.current) {
        controls.current.target.copy(lookAt.current);
        controls.current.enabled = t >= 1;
        controls.current.update();
      }
      if (t >= 1 && !state.completed) {
        state.completed = true;
        if (state.notifyDoor) onDoorReachedRef.current?.();
      }
      return;
    }

    if (!controls.current?.enabled || !movement) return;
    const forwardAmount = Number(movement.forward) - Number(movement.back);
    const sideAmount = Number(movement.right) - Number(movement.left);
    vectors.forward.subVectors(controls.current.target, camera.position);
    vectors.forward.y = 0;
    if (vectors.forward.lengthSq() > 0) vectors.forward.normalize();
    vectors.right.crossVectors(vectors.forward, vectors.up).normalize();
    vectors.desired.copy(vectors.forward).multiplyScalar(forwardAmount).addScaledVector(vectors.right, sideAmount);
    if (vectors.desired.lengthSq() > 1) vectors.desired.normalize();
    vectors.desired.multiplyScalar(3.2);
    const rate = vectors.desired.lengthSq() ? 5.2 : 7;
    walkVelocity.current.lerp(vectors.desired, 1 - Math.exp(-rate * delta));
    vectors.offset.copy(walkVelocity.current).multiplyScalar(delta);
    const bounds = cameraBounds[stage];
    if (!bounds) return;
    const nextX = THREE.MathUtils.clamp(camera.position.x + vectors.offset.x, bounds[0], bounds[1]);
    const nextZ = THREE.MathUtils.clamp(camera.position.z + vectors.offset.z, bounds[2], bounds[3]);
    vectors.offset.set(nextX - camera.position.x, 0, nextZ - camera.position.z);
    camera.position.add(vectors.offset);
    controls.current.target.add(vectors.offset);
    controls.current.update();
  });

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} enablePan={false} minDistance={2.5} maxDistance={20} minPolarAngle={0.75} maxPolarAngle={1.85} rotateSpeed={0.42} zoomSpeed={0.6} />;
}

function Floor({ width = 12, depth = 12, z = 0, dark = false }) {
  return (
    <mesh position={[0, -0.08, z]} receiveShadow>
      <boxGeometry args={[width, 0.16, depth]} />
      <meshStandardMaterial color={dark ? "#38232a" : "#593d3d"} roughness={0.74} metalness={0.12} />
    </mesh>
  );
}

function WallWithDoorway({ z, openingX = null, color }) {
  if (openingX === null) return <mesh position={[0, 3, z]} receiveShadow><boxGeometry args={[12, 6, 0.24]} /><meshStandardMaterial color={color} roughness={0.92} /></mesh>;
  const openingWidth = 2.15;
  const openingHeight = 3.6;
  const leftEdge = openingX - openingWidth / 2;
  const rightEdge = openingX + openingWidth / 2;
  const leftWidth = leftEdge + 6;
  const rightWidth = 6 - rightEdge;
  return <group>
    {leftWidth > 0 && <mesh position={[-6 + leftWidth / 2, 3, z]} receiveShadow><boxGeometry args={[leftWidth, 6, 0.24]} /><meshStandardMaterial color={color} roughness={0.92} /></mesh>}
    {rightWidth > 0 && <mesh position={[rightEdge + rightWidth / 2, 3, z]} receiveShadow><boxGeometry args={[rightWidth, 6, 0.24]} /><meshStandardMaterial color={color} roughness={0.92} /></mesh>}
    <mesh position={[openingX, openingHeight + (6 - openingHeight) / 2, z]} receiveShadow><boxGeometry args={[openingWidth, 6 - openingHeight, 0.24]} /><meshStandardMaterial color={color} roughness={0.92} /></mesh>
  </group>;
}

function RoomShell({ warmer = false, lights = true, frontDoorX = null, backDoorX = null }) {
  const backWallColor = warmer ? STORY.theme.rose : "#49343a";
  return <group>
    <Floor />
    <WallWithDoorway z={-6} openingX={backDoorX} color={backWallColor} />
    <WallWithDoorway z={6} openingX={frontDoorX} color="#49343a" />
    <mesh position={[-6, 3, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
      <boxGeometry args={[12, 6, 0.22]} /><meshStandardMaterial color="#35272d" roughness={0.94} />
    </mesh>
    <mesh position={[6, 3, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
      <boxGeometry args={[12, 6, 0.22]} /><meshStandardMaterial color="#37272d" roughness={0.94} />
    </mesh>
    {lights && <>
      <pointLight position={[-3.7, 4.25, 0.8]} color="#ffc98c" intensity={12} distance={11} decay={2} />
      <pointLight position={[3.4, 4.35, -1.7]} color="#f5ad90" intensity={8} distance={10} decay={2} />
    </>}
  </group>;
}

function Door({ x = 4.15, z = -5.78, onClick, open = false, rotation = 0 }) {
  const leaf = useRef();
  const openAngle = Math.PI * 0.48;
  const swing = useRef(open ? openAngle : 0);
  const handleOver = () => { if (onClick) document.body.style.cursor = "pointer"; };
  const handleOut = () => { document.body.style.cursor = ""; };
  useFrame((_, delta) => {
    swing.current = THREE.MathUtils.damp(swing.current, open ? openAngle : 0, 1.8, delta);
    if (leaf.current) leaf.current.rotation.y = swing.current;
  });
  return <group position={[x, 0, z]} rotation={[0, rotation, 0]} onClick={(event) => { event.stopPropagation(); onClick?.(); }} onPointerOver={handleOver} onPointerOut={handleOut}>
    {[[-0.96, 1.72], [0.96, 1.72]].map(([dx, y]) => <mesh key={dx} position={[dx, y, 0.02]}>
      <boxGeometry args={[0.12, 3.5, 0.3]} /><meshStandardMaterial color={STORY.theme.champagne} metalness={0.48} roughness={0.33} />
    </mesh>)}
    <mesh position={[0, 3.43, 0.01]}>
      <boxGeometry args={[2.04, 0.12, 0.3]} /><meshStandardMaterial color={STORY.theme.champagne} metalness={0.52} roughness={0.34} emissive="#785237" emissiveIntensity={0.18} />
    </mesh>
    <group ref={leaf} position={[-0.84, 0, 0]}>
      <mesh position={[0.84, 1.67, 0]} castShadow>
        <boxGeometry args={[1.72, 3.28, 0.22]} /><meshStandardMaterial color={STORY.theme.rose} roughness={0.56} metalness={0.06} />
      </mesh>
      <mesh position={[0.84, 1.72, 0.13]}>
        <boxGeometry args={[1.4, 2.75, 0.035]} /><meshStandardMaterial color="#75444b" roughness={0.48} />
      </mesh>
      <mesh position={[1.37, 1.58, 0.24]}>
        <sphereGeometry args={[0.075, 16, 12]} /><meshStandardMaterial color={STORY.theme.champagne} metalness={0.76} roughness={0.2} emissive="#b8733a" emissiveIntensity={0.24} />
      </mesh>
      <mesh position={[0.84, 2.83, 0.24]}>
        <torusGeometry args={[0.24, 0.018, 8, 32]} /><meshStandardMaterial color={STORY.theme.champagne} metalness={0.7} roughness={0.24} emissive="#9e7150" emissiveIntensity={0.22} />
      </mesh>
      <mesh position={[0.84, 1.65, 0.22]} onClick={(event) => { event.stopPropagation(); onClick?.(); }}>
        <boxGeometry args={[2.12, 3.8, 0.32]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
    {onClick && <pointLight position={[0, 3.67, 0]} color="#ffe0a5" intensity={open ? 2.4 : 1.3} distance={3.4} />}
  </group>;
}

function WallMessage({ heading, message, x = -0.76, z = -5.84, width = 4.05, reducedMotion = false, lit = true }) {
  const elapsed = useRef(0);
  const drawnCount = useRef(-1);
  const lines = message.split("\n").slice(0, 10);
  const totalCharacters = lines.join("\n").length;
  const hasArabic = /[\u0600-\u06ff]/.test(message);
  const hasHeading = Boolean(heading?.trim());
  const compactText = lines.length > 8;
  const { texture, canvas } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900; canvas.height = 520;
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 4;
    return { texture: result, canvas };
  }, []);
  useEffect(() => { elapsed.current = 0; drawnCount.current = -1; }, [heading, message]);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const revealSpeed = totalCharacters > 220 ? 44 : 25;
    const visibleCharacters = reducedMotion ? totalCharacters : Math.min(totalCharacters, Math.max(0, Math.floor((elapsed.current - 0.45) * revealSpeed)));
    if (visibleCharacters === drawnCount.current) return;
    drawnCount.current = visibleCharacters;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(37, 24, 29, .76)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(229, 190, 143, .66)";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
    if (hasHeading) {
      ctx.fillStyle = STORY.theme.champagne;
      ctx.direction = /[\u0600-\u06ff]/.test(heading) ? "rtl" : "ltr";
      ctx.font = /[\u0600-\u06ff]/.test(heading)
        ? '500 28px "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, serif'
        : "500 24px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(heading.toUpperCase(), 450, 76);
    }
    ctx.fillStyle = STORY.theme.ivory;
    ctx.direction = hasArabic ? "rtl" : "ltr";
    const lineHeight = compactText ? 34 : lines.length > 6 ? 40 : lines.length > 5 ? 47 : 55;
    ctx.font = hasArabic
      ? `${compactText ? 23 : 28}px "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, serif`
      : `${compactText ? 23 : lines.length > 5 ? 30 : 34}px Georgia, serif`;
    let remaining = visibleCharacters;
    lines.forEach((line, index) => {
      const shown = line.slice(0, Math.max(0, remaining));
      const firstLineY = hasHeading ? (compactText ? 132 : lines.length > 6 ? 142 : 156) : 100;
      if (shown) ctx.fillText(shown, 450, firstLineY + index * lineHeight, 760);
      remaining -= line.length + 1;
    });
    texture.needsUpdate = true;
  });
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={[x, 3.38, z]}>
    <mesh position={[0, 0, -0.15]}>
      <boxGeometry args={[width + 0.2, 2.62, 0.1]} /><meshStandardMaterial color="#cda977" metalness={0.48} roughness={0.38} />
    </mesh>
    <mesh>
      <planeGeometry args={[width, 2.43]} /><meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
    {lit && <pointLight position={[0, 1.35, 0.5]} color="#ffd9a3" intensity={4.6} distance={5.4} decay={2} />}
  </group>;
}

function PhotoImage({ src }) {
  const texture = useLoader(THREE.TextureLoader, src);
  useEffect(() => { texture.colorSpace = THREE.SRGBColorSpace; }, [texture]);
  return <mesh position={[0, 0, 0.085]}><planeGeometry args={[0.86, 1.52]} /><meshBasicMaterial map={texture} /></mesh>;
}

function PhotoFrame({ position, tint = "#d99ba4", src = "" }) {
  return <group position={position}>
    <mesh><boxGeometry args={[1.18, 1.85, 0.12]} /><meshStandardMaterial color="#c9a375" metalness={0.48} roughness={0.32} /></mesh>
    <mesh position={[0, 0, 0.067]}><boxGeometry args={[0.96, 1.68, 0.025]} /><meshStandardMaterial color="#38242b" roughness={0.52} /></mesh>
    {src ? <Suspense fallback={null}><PhotoImage src={src} /></Suspense> : <>
      <mesh position={[0, 0, 0.085]}><planeGeometry args={[0.86, 1.52]} /><meshStandardMaterial color={tint} roughness={0.82} emissive={tint} emissiveIntensity={0.12} /></mesh>
      <mesh position={[0, -0.12, 0.11]}><sphereGeometry args={[0.22, 20, 16]} /><meshStandardMaterial color="#f3c9b3" roughness={0.85} /></mesh>
      <mesh position={[0, 0.19, 0.11]}><sphereGeometry args={[0.15, 20, 16]} /><meshStandardMaterial color="#f3c9b3" roughness={0.85} /></mesh>
      <mesh position={[-0.08, 0.2, 0.2]}><sphereGeometry args={[0.018, 8, 6]} /><meshBasicMaterial color="#fff6de" /></mesh>
    </>}
  </group>;
}

function Candle({ position, scale = 1, lit = true }) {
  const flame = useRef();
  useFrame(({ clock }) => {
    if (flame.current) flame.current.intensity = 1.7 + Math.sin(clock.elapsedTime * 7 + position[0]) * 0.24;
  });
  return <group position={position} scale={scale}>
    <mesh position={[0, 0.23, 0]} castShadow><cylinderGeometry args={[0.13, 0.14, 0.46, 18]} /><meshStandardMaterial color="#f2dfc7" roughness={0.48} /></mesh>
    <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}><sphereGeometry args={[0.12, 12, 10]} /><meshBasicMaterial color="#ffc77e" /></mesh>
    {lit && <pointLight ref={flame} position={[0, 0.58, 0]} color="#ffb35b" intensity={1.7} distance={3.8} decay={2} />}
  </group>;
}

function Rose({ position, scale = 1, color = STORY.theme.rose }) {
  return <group position={position} scale={scale}>
    <mesh position={[0, 0.31, 0]} castShadow><cylinderGeometry args={[0.025, 0.04, 0.62, 8]} /><meshStandardMaterial color="#3b6243" roughness={0.8} /></mesh>
    <mesh position={[0.17, 0.2, 0]} rotation={[0.1, 0.1, -0.45]}><sphereGeometry args={[0.14, 10, 8]} /><meshStandardMaterial color="#557649" roughness={0.85} /></mesh>
    <mesh position={[0, 0.69, 0]}><dodecahedronGeometry args={[0.23, 1]} /><meshStandardMaterial color={color} roughness={0.43} /></mesh>
    <mesh position={[0, 0.71, 0.18]}><sphereGeometry args={[0.075, 8, 6]} /><meshStandardMaterial color={STORY.theme.blush} roughness={0.38} /></mesh>
  </group>;
}

function Vase({ position, size = 1 }) {
  return <group position={position} scale={size}>
    <mesh position={[0, 0.33, 0]} castShadow><latheGeometry args={[[
      new THREE.Vector2(0, 0), new THREE.Vector2(0.2, 0.04), new THREE.Vector2(0.31, 0.26),
      new THREE.Vector2(0.27, 0.48), new THREE.Vector2(0.16, 0.6), new THREE.Vector2(0.13, 0.76), new THREE.Vector2(0.19, 0.8),
    ], 24]} /><meshStandardMaterial color="#debca2" roughness={0.28} metalness={0.12} /></mesh>
    <Rose position={[-0.17, 0.89, 0]} scale={0.56} color="#b24458" />
    <Rose position={[0.18, 0.91, 0.02]} scale={0.57} color="#d07c83" />
    <Rose position={[0, 1.04, -0.12]} scale={0.5} color="#9f344a" />
  </group>;
}

function Bed({ position = [-2.9, 0, 0.6] }) {
  return <group position={position}>
    <mesh position={[0, 0.3, 0.35]} castShadow><boxGeometry args={[3.2, 0.58, 4.25]} /><meshStandardMaterial color="#71434a" roughness={0.54} /></mesh>
    <mesh position={[0, 0.68, 0.45]} castShadow><boxGeometry args={[2.95, 0.3, 3.9]} /><meshStandardMaterial color="#f1dfcc" roughness={0.94} /></mesh>
    <mesh position={[0, 0.88, -0.95]} castShadow><boxGeometry args={[3.12, 1.63, 0.24]} /><meshStandardMaterial color="#74464b" roughness={0.42} /></mesh>
    <mesh position={[0, 0.88, 0.25]}><boxGeometry args={[2.75, 0.11, 2.1]} /><meshStandardMaterial color="#b77980" roughness={0.9} /></mesh>
    <mesh position={[-0.76, 0.92, -0.85]} rotation={[0.1, -0.08, 0.1]}><boxGeometry args={[1.06, 0.22, 0.72]} /><meshStandardMaterial color="#fff0e1" roughness={0.92} /></mesh>
    <mesh position={[0.76, 0.92, -0.85]} rotation={[0.1, 0.08, -0.1]}><boxGeometry args={[1.06, 0.22, 0.72]} /><meshStandardMaterial color="#fff0e1" roughness={0.92} /></mesh>
    <mesh position={[0, 0.52, 2.45]}><boxGeometry args={[3.4, 0.7, 0.2]} /><meshStandardMaterial color="#cfac84" roughness={0.44} /></mesh>
    <mesh position={[0, 0.22, 0.55]}><boxGeometry args={[3.28, 0.09, 4.15]} /><meshStandardMaterial color="#d5b68e" metalness={0.25} roughness={0.4} /></mesh>
  </group>;
}

function BedsideTable({ position }) {
  return <group position={position}>
    <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.95, 0.9, 0.8]} /><meshStandardMaterial color="#704b48" roughness={0.48} /></mesh>
    <mesh position={[0, 0.93, 0]}><boxGeometry args={[1.05, 0.12, 0.88]} /><meshStandardMaterial color="#d2aa7b" roughness={0.34} metalness={0.2} /></mesh>
    <mesh position={[0, 0.48, 0.42]}><boxGeometry args={[0.62, 0.06, 0.025]} /><meshStandardMaterial color="#c79574" metalness={0.45} /></mesh>
    <mesh position={[0, 0.48, 0.45]}><sphereGeometry args={[0.045, 12, 10]} /><meshStandardMaterial color="#e4bf83" metalness={0.75} /></mesh>
  </group>;
}

function WindowView({ lit = true }) {
  return <group position={[-5.86, 2.75, 0.15]} rotation={[0, Math.PI / 2, 0]}>
    <mesh><planeGeometry args={[3.15, 2.65]} /><meshBasicMaterial color="#e78f7e" /></mesh>
    <mesh position={[0, 0.35, -0.02]}><planeGeometry args={[3.05, 1.5]} /><meshBasicMaterial color="#f0b788" /></mesh>
    <mesh position={[0, 1.06, 0]}><planeGeometry args={[3.1, 0.08]} /><meshStandardMaterial color="#d6b27c" metalness={0.48} /></mesh>
    <mesh position={[0, -0.14, 0]}><boxGeometry args={[0.075, 2.66, 0.09]} /><meshStandardMaterial color="#d6b27c" metalness={0.48} /></mesh>
    <mesh position={[0, 0, 0.04]}><boxGeometry args={[3.35, 2.83, 0.12]} /><meshBasicMaterial color="#e8c28e" wireframe /></mesh>
    <mesh position={[0, 0, 0.07]}><boxGeometry args={[0.075, 2.68, 0.1]} /><meshStandardMaterial color="#d9b57e" metalness={0.58} /></mesh>
    {lit && <pointLight position={[0, 0.1, -1.3]} color="#f7a47c" intensity={8} distance={7} decay={2} />}
  </group>;
}

function HeartDecoration({ lit = true }) {
  const shape = useMemo(() => {
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.9);
    heart.bezierCurveTo(-1.8, 0.2, -1.2, 1.65, -0.05, 1.16);
    heart.bezierCurveTo(1.25, 1.8, 1.7, 0.3, 0, -0.9);
    return heart;
  }, []);
  return <group position={[0.05, 4.15, -5.77]}>
    <mesh scale={[0.86, 0.86, 0.86]}><extrudeGeometry args={[shape, { depth: 0.13, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.08, bevelThickness: 0.08 }]} /><meshStandardMaterial color="#b85567" metalness={0.24} roughness={0.28} emissive="#6d253b" emissiveIntensity={0.24} /></mesh>
    {lit && <pointLight position={[0, 0, 0.6]} color="#f78f9c" intensity={2.8} distance={4.5} />}
  </group>;
}

function RoomDecor({ stage, onAdvance, reducedMotion, active = true, doorOpen = false }) {
  const first = stage === "room1";
  const second = stage === "room2";
  return <group>
    <RoomShell warmer={first} lights={active} frontDoorX={first ? 0 : second ? 4.15 : null} backDoorX={4.15} />
    {first && <Door x={0} z={5.78} open />}
    {first && <>
      <Bed />
      <BedsideTable position={[-4.9, 0, 0.2]} /><Candle position={[-4.9, 1.03, 0.2]} scale={0.7} lit={active} />
      <BedsideTable position={[-0.85, 0, 0.2]} /><Vase position={[-0.85, 1.02, 0.2]} size={0.74} />
      <PhotoFrame position={[-4.55, 3.6, -5.79]} src={STORY.photos?.[0]} /><PhotoFrame position={[2, 3.58, -5.79]} src={STORY.photos?.[1]} />
      <Vase position={[4.95, 0, -3.8]} size={0.74} />
      <Candle position={[4.9, 0, -2.5]} scale={0.8} lit={active} />
    </>}
    {second && <>
      <WindowView lit={active} />
      <HeartDecoration lit={active} />
      <mesh position={[0, 0.16, 1.1]}><cylinderGeometry args={[2.25, 2.3, 0.28, 48]} /><meshStandardMaterial color="#805754" roughness={0.86} /></mesh>
      <mesh position={[0, 0.35, 1.1]}><cylinderGeometry args={[1.75, 1.92, 0.12, 48]} /><meshStandardMaterial color="#a47668" roughness={0.8} /></mesh>
      <Vase position={[-4.7, 0, -3.8]} size={0.85} /><Vase position={[4.75, 0, -3.4]} size={0.82} />
      <Candle position={[-4.6, 0, -1.8]} scale={0.9} lit={active} /><Candle position={[4.55, 0, -1.7]} scale={0.9} lit={active} />
      <PhotoFrame position={[-4.4, 3.35, -5.79]} src={STORY.photos?.[2]} />
    </>}
    <WallMessage heading={first ? STORY.roomOneTitle : ""} message={first ? STORY.roomOneMessage : STORY.roomTwoMessage} x={first ? -0.78 : -0.6} width={first ? 4.05 : 4.48} reducedMotion={reducedMotion || !active} lit={active} />
    <Door onClick={onAdvance} open={doorOpen} />
  </group>;
}

function makeRand(i, salt = 0) {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function FloatingPetals({ count = 38, range = 9, low = 0.5, high = 5.1, reducedMotion = false }) {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (makeRand(i, 1) - 0.5) * range,
    y: low + makeRand(i, 2) * (high - low),
    z: (makeRand(i, 3) - 0.5) * range,
    phase: makeRand(i, 4) * Math.PI * 2,
    speed: 0.11 + makeRand(i, 5) * 0.2,
    size: 0.09 + makeRand(i, 6) * 0.12,
  })), [count, range, low, high]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const time = reducedMotion ? 0 : clock.elapsedTime;
    data.forEach((petal, index) => {
      const y = low + ((petal.y - low - time * petal.speed + high - low) % (high - low));
      dummy.position.set(petal.x + Math.sin(time * 0.38 + petal.phase) * 0.21, y, petal.z + Math.cos(time * 0.26 + petal.phase) * 0.18);
      dummy.rotation.set(Math.sin(time * 0.45 + petal.phase) * 0.65, petal.phase + time * 0.28, Math.cos(time * 0.39 + petal.phase) * 0.7);
      dummy.scale.set(petal.size * 1.35, petal.size * 0.42, petal.size * 0.84);
      dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, count]}>
    <sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color="#df8d99" roughness={0.52} metalness={0.05} side={THREE.DoubleSide} />
  </instancedMesh>;
}

function FloorPetals({ count = 72, zRange = 11, xRange = 9 }) {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    if (!ref.current) return;
    for (let i = 0; i < count; i += 1) {
      dummy.position.set((makeRand(i, 11) - 0.5) * xRange, 0.025 + makeRand(i, 12) * 0.035, (makeRand(i, 13) - 0.5) * zRange);
      dummy.rotation.set(-Math.PI / 2 + (makeRand(i, 14) - 0.5) * 0.3, 0, makeRand(i, 15) * Math.PI * 2);
      const size = 0.09 + makeRand(i, 16) * 0.14;
      dummy.scale.set(size * 1.35, size * 0.42, size * 0.85);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      const color = new THREE.Color().setHSL(0.96 + makeRand(i, 17) * 0.07, 0.45 + makeRand(i, 18) * 0.2, 0.4 + makeRand(i, 19) * 0.22);
      ref.current.setColorAt(i, color);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [count, xRange, zRange, dummy]);
  return <instancedMesh ref={ref} args={[undefined, undefined, count]}>
    <sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color="#fff" roughness={0.6} side={THREE.DoubleSide} />
  </instancedMesh>;
}

function RoseArch({ position, scale = 1 }) {
  return <group position={position} scale={scale}>
    <mesh position={[-1.1, 2.05, 0]}><cylinderGeometry args={[0.075, 0.1, 4.1, 10]} /><meshStandardMaterial color="#43533a" roughness={0.8} /></mesh>
    <mesh position={[1.1, 2.05, 0]}><cylinderGeometry args={[0.075, 0.1, 4.1, 10]} /><meshStandardMaterial color="#43533a" roughness={0.8} /></mesh>
    <mesh position={[0, 4.05, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.075, 0.075, 2.35, 10]} /><meshStandardMaterial color="#43533a" roughness={0.8} /></mesh>
    {Array.from({ length: 5 }, (_, i) => <Rose key={i} position={[-1.05 + i * 0.52, 3.9 + Math.sin(i * 1.7) * 0.1, 0]} scale={0.85} color={i % 2 ? "#ba5265" : "#d47b86"} />)}
    {Array.from({ length: 3 }, (_, i) => <Rose key={`side-${i}`} position={i % 2 ? [-1.13, 1.15 + i * 1.05, 0] : [1.13, 1.15 + i * 1.05, 0]} scale={0.78} color={i % 2 ? "#b2475c" : "#d78089"} />)}
  </group>;
}

function HallScene({ onAdvance, reducedMotion, active = true, doorOpen = false }) {
  const repeat = 4;
  return <group>
    <Floor width={6.5} depth={34} z={-7} dark />
    <mesh position={[-3.35, 3, -7]}><boxGeometry args={[0.22, 6, 34]} /><meshStandardMaterial color="#38232c" roughness={0.85} /></mesh>
    <mesh position={[3.35, 3, -7]}><boxGeometry args={[0.22, 6, 34]} /><meshStandardMaterial color="#38232c" roughness={0.85} /></mesh>
    <mesh position={[0, 6.02, -7]}><boxGeometry args={[6.7, 0.15, 34]} /><meshStandardMaterial color="#251921" roughness={0.9} /></mesh>
    <mesh position={[0, 0.012, -7]}><boxGeometry args={[3.6, 0.04, 34]} /><meshStandardMaterial color="#805854" roughness={0.65} metalness={0.13} /></mesh>
    {Array.from({ length: repeat }, (_, i) => <group key={i} position={[0, 0, 3 - i * 8]}>
      <RoseArch position={[0, 0, 0]} scale={[2.05, 0.83, 1]} />
      <mesh position={[-2.85, 4.95, 0]}><sphereGeometry args={[0.12, 14, 10]} /><meshStandardMaterial color="#ffe1a8" emissive="#ffbf75" emissiveIntensity={2.4} /></mesh>
      <mesh position={[2.85, 4.95, 0]}><sphereGeometry args={[0.12, 14, 10]} /><meshStandardMaterial color="#ffe1a8" emissive="#ffbf75" emissiveIntensity={2.4} /></mesh>
    </group>)}
    {active && <>
      <pointLight position={[-2.8, 4.8, 0]} color="#ffc986" intensity={9} distance={11} />
      <pointLight position={[2.8, 4.8, -9]} color="#ffd196" intensity={11} distance={12} />
      <pointLight position={[0, 4, -19]} color="#f5a3ad" intensity={8} distance={11} />
    </>}
    <AmbientRoseBouquets />
    <FloorPetals count={150} zRange={32} xRange={5.2} />
    <FloatingPetals count={reducedMotion || !active ? 0 : 58} range={5.2} low={0.5} high={5.4} reducedMotion={reducedMotion} />
    {active && !reducedMotion && <Sparkles count={46} scale={[5.8, 5.2, 31]} size={2} speed={0.2} color="#ffe0ac" opacity={0.62} position={[0, 2.6, -8]} />}
    <Door x={0} z={-23.9} onClick={onAdvance} open={doorOpen} />
  </group>;
}

function AmbientRoseBouquets() {
  return <group>
    {Array.from({ length: 16 }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      const z = 4 - Math.floor(i / 2) * 3.3;
      return <group key={i} position={[side * 2.45, 0, z]}>
        <mesh position={[0, 0.33, 0]}><cylinderGeometry args={[0.36, 0.4, 0.65, 18]} /><meshStandardMaterial color="#684348" roughness={0.42} /></mesh>
        <Rose position={[-0.13, 0.72, 0]} scale={0.72} color="#af4358" /><Rose position={[0.14, 0.78, 0.08]} scale={0.7} color="#d27783" /><Rose position={[0, 0.84, -0.12]} scale={0.68} color="#94354c" />
      </group>;
    })}
  </group>;
}

function Pedestal() {
  return <group position={[0, 0, -0.5]}>
    <mesh position={[0, 0.17, 0]} castShadow><cylinderGeometry args={[1.13, 1.32, 0.34, 48]} /><meshStandardMaterial color="#a77a5a" metalness={0.42} roughness={0.34} /></mesh>
    <mesh position={[0, 0.88, 0]} castShadow><cylinderGeometry args={[0.72, 0.95, 1.15, 40]} /><meshStandardMaterial color="#57353c" roughness={0.49} metalness={0.16} /></mesh>
    <mesh position={[0, 1.49, 0]} castShadow><cylinderGeometry args={[1.12, 0.78, 0.22, 48]} /><meshStandardMaterial color="#d6ad7a" metalness={0.55} roughness={0.28} /></mesh>
    <mesh position={[0, 1.63, 0]}><cylinderGeometry args={[0.94, 0.95, 0.09, 48]} /><meshStandardMaterial color="#744751" roughness={0.78} /></mesh>
    {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} position={[Math.cos(i * Math.PI / 3) * 1.14, 0.17, Math.sin(i * Math.PI / 3) * 1.14]}>
      <sphereGeometry args={[0.055, 12, 10]} /><meshStandardMaterial color="#e5bf83" metalness={0.72} roughness={0.21} />
    </mesh>)}
  </group>;
}

function RingBox({ open, reducedMotion, active }) {
  const lid = useRef();
  const ring = useRef();
  const lidProgress = useRef(0);
  const ringProgress = useRef(0);
  const spotlight = useRef();
  const boxLight = useRef();
  const spotlightTarget = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }, delta) => {
    lidProgress.current = THREE.MathUtils.damp(lidProgress.current, open ? 1 : 0, reducedMotion ? 20 : 1.7, delta);
    const riseTarget = open ? THREE.MathUtils.smoothstep(lidProgress.current, 0.22, 0.78) : 0;
    ringProgress.current = THREE.MathUtils.damp(ringProgress.current, riseTarget, reducedMotion ? 20 : 1.35, delta);
    if (lid.current) lid.current.rotation.x = -lidProgress.current * 1.28;
    if (ring.current) {
      ring.current.visible = (lidProgress.current > 0.62 && ringProgress.current > 0.04) || ringProgress.current > 0.92;
      ring.current.position.y = 0.12 + ringProgress.current * 1.12 + (open && !reducedMotion ? Math.sin(clock.elapsedTime * 1.35) * 0.025 : 0);
      ring.current.rotation.y = open && !reducedMotion ? clock.elapsedTime * 0.24 : 0;
      ring.current.scale.setScalar(0.62 + ringProgress.current * 0.3);
    }
    if (spotlight.current) spotlight.current.intensity = THREE.MathUtils.damp(spotlight.current.intensity, active && open ? 48 : 0, reducedMotion ? 20 : 1.5, delta);
    if (boxLight.current) boxLight.current.intensity = THREE.MathUtils.damp(boxLight.current.intensity, active && open ? 3.5 : 0, reducedMotion ? 20 : 1.7, delta);
  });
  return <group position={[0, 1.68, -0.5]}>
    <mesh position={[0, -0.18, 0]} castShadow><boxGeometry args={[0.91, 0.11, 0.76]} /><meshStandardMaterial color="#6f263e" roughness={0.36} /></mesh>
    <mesh position={[0, 0, 0.32]} castShadow><boxGeometry args={[0.91, 0.38, 0.12]} /><meshStandardMaterial color="#6f263e" roughness={0.36} /></mesh>
    <mesh position={[0, 0, -0.32]} castShadow><boxGeometry args={[0.91, 0.38, 0.12]} /><meshStandardMaterial color="#6f263e" roughness={0.36} /></mesh>
    <mesh position={[0.4, 0, 0]} castShadow><boxGeometry args={[0.12, 0.38, 0.76]} /><meshStandardMaterial color="#6f263e" roughness={0.36} /></mesh>
    <mesh position={[-0.4, 0, 0]} castShadow><boxGeometry args={[0.12, 0.38, 0.76]} /><meshStandardMaterial color="#6f263e" roughness={0.36} /></mesh>
    <mesh position={[0, -0.11, 0]}><boxGeometry args={[0.62, 0.035, 0.46]} /><meshStandardMaterial color="#bd8d7e" roughness={0.86} /></mesh>
    <mesh position={[0, -0.015, 0]}><boxGeometry args={[0.93, 0.055, 0.78]} /><meshStandardMaterial color="#c59b6e" metalness={0.55} roughness={0.3} /></mesh>
    <group ref={lid} position={[0, 0.22, -0.32]}>
      <mesh position={[0, 0.1, 0.32]} castShadow><boxGeometry args={[0.94, 0.2, 0.78]} /><meshStandardMaterial color="#782e45" roughness={0.34} /></mesh>
      <mesh position={[0, 0.205, 0.32]}><boxGeometry args={[0.94, 0.025, 0.78]} /><meshStandardMaterial color="#d4aa77" metalness={0.56} roughness={0.3} /></mesh>
    </group>
    <primitive object={spotlightTarget} position={[0, 1.28, 0]} />
    <group ref={ring} position={[0, 0.12, 0]}>
      <mesh castShadow><torusGeometry args={[0.34, 0.06, 16, 48]} /><meshStandardMaterial color="#e8c275" metalness={0.88} roughness={0.16} emissive="#6a4925" emissiveIntensity={0.08} /></mesh>
      <mesh position={[0, 0.39, 0]} castShadow><octahedronGeometry args={[0.235, 0]} /><meshPhysicalMaterial color="#fffaff" transmission={0.04} thickness={0.8} roughness={0.055} metalness={0.02} clearcoat={1} clearcoatRoughness={0.04} ior={2.2} emissive="#d8edff" emissiveIntensity={0.42} /></mesh>
      <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.095, 0.055, 0.13, 8]} /><meshStandardMaterial color="#e6c174" metalness={0.88} roughness={0.14} /></mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x * 0.13, 0.32, z * 0.13]}><sphereGeometry args={[0.035, 8, 6]} /><meshStandardMaterial color="#efcf8c" metalness={0.86} roughness={0.18} /></mesh>))}
    </group>
    <pointLight ref={boxLight} position={[0, 1.45, 0]} color="#d9edff" intensity={0} distance={4.5} decay={2} />
    {active && <spotLight ref={spotlight} target={spotlightTarget} position={[0, 5.5, 3.5]} color="#fff1d5" intensity={0} angle={0.32} penumbra={0.78} distance={12} decay={1.8} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />}
  </group>;
}

function ProposalRoom({ stage, reducedMotion, active }) {
  const [opened, setOpened] = useState(stage === "ending" || reducedMotion);
  useEffect(() => {
    if (!active) { setOpened(false); return undefined; }
    if (stage === "ending" || reducedMotion) { setOpened(true); return undefined; }
    setOpened(false);
    const timer = window.setTimeout(() => setOpened(true), 1650);
    return () => window.clearTimeout(timer);
  }, [stage, reducedMotion, active]);
  return <group>
    <RoomShell warmer lights={active} frontDoorX={4.15} />
    <mesh position={[0, 0.05, -3.3]}><cylinderGeometry args={[3.6, 3.9, 0.1, 64]} /><meshStandardMaterial color="#4a2b35" roughness={0.86} /></mesh>
    <mesh position={[0, 0.12, -3.3]}><cylinderGeometry args={[2.8, 2.9, 0.12, 64]} /><meshStandardMaterial color="#74424b" roughness={0.86} /></mesh>
    <Pedestal />
    <RingBox open={opened} reducedMotion={reducedMotion} active={active} />
    <Vase position={[-4.45, 0, -4.45]} size={1.2} /><Vase position={[4.65, 0, -4.4]} size={1.18} />
    <Vase position={[-4.85, 0, 1.2]} size={1.05} /><Vase position={[4.8, 0, 0.4]} size={1.05} />
    <Candle position={[-3.55, 0, -4.1]} scale={1.1} lit={active} /><Candle position={[3.65, 0, -4.1]} scale={1.1} lit={active} />
    <Candle position={[-4.7, 0, -2.6]} scale={0.85} lit={active} /><Candle position={[4.6, 0, -2.7]} scale={0.85} lit={active} />
    {active && <>
      <pointLight position={[0, 5.45, 0.7]} color="#ffddac" intensity={opened ? 9 : 4} distance={13} />
      <pointLight position={[0, 4.65, -4.3]} color="#ffeac2" intensity={opened ? 14 : 3} distance={7} />
    </>}
    <FloorPetals count={142} zRange={10.5} xRange={10} />
    <FloatingPetals count={reducedMotion || !active ? 0 : opened ? 92 : 38} range={10.5} low={0.5} high={5.5} reducedMotion={reducedMotion} />
    {active && !reducedMotion && <Sparkles count={126} scale={[10, 5.8, 10]} size={2.2} speed={0.16} color="#ffe2ae" opacity={0.72} position={[0, 2.8, -0.5]} />}
  </group>;
}

function ExteriorHouse({ onAdvance, doorOpen }) {
  const roof = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-5, 0); shape.lineTo(0, 3.1); shape.lineTo(5, 0); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 6.5, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.12, bevelThickness: 0.12 });
  }, []);
  useEffect(() => () => roof.dispose(), [roof]);
  return <group position={[0, 0, 3.66]}>
    <mesh position={[-2.9125, 2.4, -1.15]} castShadow receiveShadow><boxGeometry args={[3.675, 4.8, 6.4]} /><meshStandardMaterial color="#8d6260" roughness={0.88} /></mesh>
    <mesh position={[2.9125, 2.4, -1.15]} castShadow receiveShadow><boxGeometry args={[3.675, 4.8, 6.4]} /><meshStandardMaterial color="#8d6260" roughness={0.88} /></mesh>
    <mesh position={[0, 4.2, -1.15]} castShadow receiveShadow><boxGeometry args={[2.15, 1.2, 6.4]} /><meshStandardMaterial color="#8d6260" roughness={0.88} /></mesh>
    <mesh geometry={roof} position={[0, 4.6, -4.25]} castShadow><meshStandardMaterial color="#473038" roughness={0.82} /></mesh>
    <mesh position={[0, 0.1, 2.3]}><boxGeometry args={[2.2, 0.2, 2.1]} /><meshStandardMaterial color="#a27a64" roughness={0.7} /></mesh>
    <Door x={0} z={2.12} onClick={onAdvance} open={doorOpen} rotation={0} />
    {[-3.05, 3.05].map((x) => <group key={x} position={[x, 2.85, 2.12]}>
      <mesh><boxGeometry args={[1.38, 1.72, 0.16]} /><meshStandardMaterial color="#d3b382" metalness={0.22} /></mesh>
      <mesh position={[0, 0, 0.1]}><planeGeometry args={[1.16, 1.49]} /><meshBasicMaterial color="#ffd0a0" /></mesh>
      <mesh position={[0, 0, 0.16]}><boxGeometry args={[0.055, 1.51, 0.08]} /><meshStandardMaterial color="#c79d6f" /></mesh>
      <pointLight position={[0, 0.2, 0.4]} color="#ffd29a" intensity={2.6} distance={4} />
    </group>)}
    <mesh position={[0, 4.36, 2.2]}><boxGeometry args={[4.2, 0.42, 0.22]} /><meshStandardMaterial color="#e2bb86" roughness={0.44} metalness={0.28} /></mesh>
    <mesh position={[0, 5.95, -1.2]}><boxGeometry args={[0.18, 0.65, 0.18]} /><meshStandardMaterial color="#44323a" /></mesh>
    <Floor width={35} depth={34} z={12} dark />
    <mesh position={[0, -0.01, 5.5]}><boxGeometry args={[4.2, 0.055, 11]} /><meshStandardMaterial color="#8e685b" roughness={0.72} /></mesh>
    {[-6.3, 6.3].map((x) => <group key={x} position={[x, 0, 3]}>
      <mesh position={[0, 0.75, 0]}><cylinderGeometry args={[0.58, 0.66, 1.5, 20]} /><meshStandardMaterial color="#75524d" roughness={0.48} /></mesh>
      <Rose position={[-0.19, 1.52, 0]} scale={1.3} color="#a9364c" /><Rose position={[0.2, 1.53, 0.1]} scale={1.25} color="#d27b83" /><Rose position={[0, 1.67, -0.15]} scale={1.15} color="#c65367" />
    </group>)}
    <pointLight position={[0, 7.1, 4]} color="#ffc98d" intensity={22} distance={16} />
    <ambientLight color="#e6b0a2" intensity={0.45} /><hemisphereLight color="#ffdfbc" groundColor="#1b1218" intensity={0.66} />
  </group>;
}

function ConnectedHome({ stage, onApproach, doorApproaching, doorPrompt, reducedMotion }) {
  const showRoomOneDoor = stage === "room1" ? onApproach : undefined;
  const showRoomTwoDoor = stage === "room2" ? onApproach : undefined;
  const activeProposal = stage === "room3" || stage === "ending";
  return <>
    <group position={[0, 0, 0]}>
      <RoomDecor stage="room1" onAdvance={showRoomOneDoor} active={stage === "room1"} doorOpen={(stage === "room1" && (doorApproaching || doorPrompt)) || stage === "hall1"} reducedMotion={reducedMotion} />
      <FloorPetals count={58} zRange={10.5} xRange={10} />
      {stage === "room1" && <FloatingPetals count={reducedMotion ? 0 : 34} range={9.5} reducedMotion={reducedMotion} />}
      {stage === "room1" && !reducedMotion && <Sparkles count={34} scale={[9, 4.5, 9]} size={1.6} speed={0.15} color="#f8d7ab" opacity={0.48} position={[0, 2.8, -0.5]} />}
    </group>
    <group position={[4.15, 0, -16]}>
      <HallScene active={stage === "hall1"} doorOpen={(stage === "hall1" && (doorApproaching || doorPrompt)) || stage === "room2"} reducedMotion={reducedMotion} />
    </group>
    <group position={[0, 0, -46]}>
      <RoomDecor stage="room2" onAdvance={showRoomTwoDoor} active={stage === "room2"} doorOpen={(stage === "room2" && (doorApproaching || doorPrompt)) || stage === "hall2"} reducedMotion={reducedMotion} />
      <FloorPetals count={58} zRange={10.5} xRange={10} />
      {stage === "room2" && <FloatingPetals count={reducedMotion ? 0 : 34} range={9.5} reducedMotion={reducedMotion} />}
      {stage === "room2" && !reducedMotion && <Sparkles count={34} scale={[9, 4.5, 9]} size={1.6} speed={0.15} color="#f8d7ab" opacity={0.48} position={[0, 2.8, -0.5]} />}
    </group>
    <group position={[4.15, 0, -62]}>
      <HallScene active={stage === "hall2"} doorOpen={(stage === "hall2" && (doorApproaching || doorPrompt)) || stage === "room3" || stage === "ending"} reducedMotion={reducedMotion} />
    </group>
    <group position={[0, 0, -92]}>
      <ProposalRoom stage={stage} reducedMotion={reducedMotion} active={activeProposal} />
    </group>
  </>;
}

function SceneContent({ stage, onAdvance, onDoorReached, doorApproaching, doorPrompt, movement, reducedMotion }) {
  const isHall = stage.startsWith("hall");
  const isWelcome = stage === "welcome";
  return <>
    <color attach="background" args={[isHall ? "#22151d" : isWelcome ? "#24171c" : "#271820"]} />
    <fog attach="fog" args={[isHall ? "#281921" : "#291921", isHall ? 18 : 14, isHall ? 68 : 46]} />
    {!isWelcome && <>
      <ambientLight color="#e9c1ac" intensity={0.4} />
      <hemisphereLight color="#f8dcb8" groundColor="#271820" intensity={0.4} />
    </>}
    {isWelcome ? <ExteriorHouse onAdvance={onAdvance} doorOpen={doorApproaching || doorPrompt} /> : <ConnectedHome stage={stage} onApproach={onAdvance} doorApproaching={doorApproaching} doorPrompt={doorPrompt} reducedMotion={reducedMotion} />}
    {isWelcome && !reducedMotion && <Sparkles count={70} scale={[14, 8, 7]} size={2.2} speed={0.12} color="#ffe5b8" opacity={0.66} position={[0, 4, 0]} />}
    <SceneCamera stage={stage} doorApproaching={doorApproaching} doorPrompt={doorPrompt} movement={movement} onDoorReached={onDoorReached} reducedMotion={reducedMotion} />
  </>;
}

export default function StoryScene({ stage, onAdvance, onDoorReached, doorApproaching, doorPrompt, movement, reducedMotion }) {
  return <Canvas
    shadows
    dpr={[1, 1.5]}
    camera={{ position: roomTargets.welcome.camera, fov: 42, near: 0.1, far: 180 }}
    gl={{ antialias: true, powerPreference: "low-power", alpha: false }}
    onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.12; }}
  >
    <SceneContent stage={stage} onAdvance={onAdvance} onDoorReached={onDoorReached} doorApproaching={doorApproaching} doorPrompt={doorPrompt} movement={movement} reducedMotion={reducedMotion} />
  </Canvas>;
}
