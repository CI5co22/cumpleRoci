/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { playCelestialChime } from '../utils/audio';

// Interface for floating handwritten sentences spawned when tapping stars
interface FloatingText {
  id: string;
  text: string;
  x: number; // Screen X percentage
  y: number; // Screen Y percentage
  opacity: number;
  scale: number;
}

interface StarMemoryCard {
  id: string;
  image: string;
  text: string;
  title: string;
}

// Datos de las tarjetas de recuerdos de ensueño para Rocío
const STAR_MEMORIES = [
  { title: "El Destello de Rocío", text: "En un mundo de infinitas opciones, nuestros caminos se alinearon perfectamente bajo la luna silenciosa, Rocío.", image: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&q=80&w=600" },
  { title: "Ecos de Luz", text: "Incluso en la noche más profunda, una suave luz guía tus pasos, Rocío, susurrando secretos del mañana.", image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=600" },
  { title: "Mar Bioluminiscente", text: "El océano contiene reflejos del cosmos, brillando con tus hermosos sueños, Rocío.", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=600" },
  { title: "Jardín del Atardecer", text: "Un campo de flores de luz florece bajo tu toque, entonando una melodía de eterna primavera para Rocío.", image: "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&q=80&w=600" },
  { title: "Cuna de Sueños", text: "Descansa tu mente cansada sobre la luna plateada, donde nace la esperanza del mañana para Rocío.", image: "https://images.unsplash.com/photo-1532960401447-7dd05bef20b0?auto=crop&fit=crop&q=80&w=600" },
  { title: "Valle de los Vientos", text: "Deja que tus preocupaciones se disuelvan en el viento, Rocío. Eres una viajera de la luz.", image: "https://images.unsplash.com/photo-1500627869374-13cd993b1115?auto=format&fit=crop&q=80&w=600" },
];

// Coordenadas y frases en español de las estrellas interactivas, agrupadas para móviles con progresión de profundidad
const INTERACTIVE_STARS_DATA = [
  { id: '1', pos: new THREE.Vector3(0.0, 3.5, 38), text: "Mira al cielo, Rocío..." },
  { id: '2', pos: new THREE.Vector3(5.0, 3.0, 30), text: "Un mundo de magia te espera." },
  { id: '3', pos: new THREE.Vector3(6.5, 1.5, 22), text: "Escucha el susurro de la noche, Rocío." },
  { id: '4', pos: new THREE.Vector3(4.5, -0.2, 14), text: "Cada estrella guarda una promesa secreta." },
  { id: '5', pos: new THREE.Vector3(0.5, -1.8, 6), text: "Tu luz brilla más que el propio cosmos, Rocío." },
  { id: '6', pos: new THREE.Vector3(-4.5, 2.0, 32), text: "Flota suavemente a través de la hermosa oscuridad infinita." },
  { id: '7', pos: new THREE.Vector3(-5.5, 0.5, 24), text: "Tu corazón contiene un cielo entero, Rocío." },
  { id: '8', pos: new THREE.Vector3(-3.5, -1.5, 16), text: "La luna guía tus pensamientos más tiernos." },
  { id: '9', pos: new THREE.Vector3(-1.5, -2.5, 10), text: "Déjate llevar y forma parte de la brisa cósmica." },
  { id: '10', pos: new THREE.Vector3(2.5, -2.0, 12), text: "Incluso la chispa más pequeña puede iluminar la oscuridad, Rocío." },
  { id: '11', pos: new THREE.Vector3(4.0, 2.0, 18), text: "Cierra los ojos y contempla la belleza infinita." },
];

// Lines connecting the stars to form a gorgeous celestial constellation structure
const CONSTELLATION_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], // Upper arc
  [0, 4], [4, 5], [5, 6], [6, 7], [7, 3], // Mid Web
  [4, 8], [8, 9], [9, 10], [10, 7] // Lower arc
];

const FLOWER_COUNT = 1500; // Simplified particle counts for very clean, highly visible petals
const MAX_SPARKS = 1500;
const REQUIRED_STARS_TO_AWAKEN = 5;

export default function CelestialUniverse() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Floating text overlays absolute positioned over canvas
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  // Tracking scroll progress visually (virtual scroll)
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isCinematicActive, setIsCinematicActive] = useState(false);
  const [typedSentence, setTypedSentence] = useState('');
  const [isSentenceVisible, setIsSentenceVisible] = useState(false);
  const [hasStartedExploring, setHasStartedExploring] = useState(false);

  // Core gameplay states
  const [tappedStars, setTappedStars] = useState<Record<string, boolean>>({});
  const [unlockedMemory, setUnlockedMemory] = useState<StarMemoryCard | null>(null);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 1 hold value to bloom
  const [isHolding, setIsHolding] = useState(false);
  const [isTooFar, setIsTooFar] = useState<boolean>(true);
  const [coreScreen, setCoreScreen] = useState<{ x: number; y: number; dist: number; isNear: boolean }>({ x: 50, y: 50, dist: 999, isNear: false });
  const tooFarRef = useRef<boolean>(true);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Central star interaction states
  const [isCentralStarClicked, setIsCentralStarClicked] = useState(false);
  const [showCentralGuide, setShowCentralGuide] = useState(false);

  // Refs for tracking shooting state and animation triggers
  const isStarShooting = useRef(false);
  const isBloomTriggered = useRef(false);
  const holdIntervalRef = useRef<number | null>(null);

  // Refs for animation loop updates
  const scrollRef = useRef({
    current: 0,
    target: 0,
    touchStart: 0,
    isDragging: false,
    mouseX: 0,
    mouseY: 0,
    tiltX: 0,
    tiltY: 0,
    cursorWorld: new THREE.Vector3(0, 0, 0)
  });

  // ThreeJS instance refs
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    backgroundStars: THREE.Points;
    nebulaPoints: THREE.Points[];
    interactiveStarMeshes: THREE.Mesh[];
    starHomePositions: THREE.Vector3[];
    starCurrentOffsets: THREE.Vector3[];
    constellationLines: THREE.LineSegments;
    moonMesh: THREE.Mesh;
    stardustFlower: THREE.Points;
    stardustFlowerPositions: THREE.Vector3[];
    stardustFlowerTargets: THREE.Vector3[];
    sparkParticles: { pos: THREE.Vector3; vel: THREE.Vector3; size: number; age: number; maxAge: number; color: THREE.Color }[];
    sparkPoints: THREE.Points;
    bloomProgress: { value: number };
    bloomScale: { value: number };
    bloomBrighten: { value: number };
    centralStarMesh?: THREE.Mesh;
    centralGlowMesh?: THREE.Mesh;
    coreStarMesh?: THREE.Mesh;
    coreGlowMesh?: THREE.Mesh;
    solidFlowerPetals?: THREE.Group;
  } | null>(null);

  const tappedCount = Object.keys(tappedStars).length;
  const isReadyToAwaken = tappedCount >= REQUIRED_STARS_TO_AWAKEN;

  // Initialize ThreeJS Scene
  useEffect(() => {
    if (!canvasRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Scene & Camera setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070a, 0.015);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 50);

    // 2. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Helper: Canvas-generated soft radial gradient glow texture
    const createRadialGlowTexture = (color: string = '#ffffff', size: number = 64) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        
        // Let's parse the color to create a beautiful, rich gradient preserving the base hue!
        gradient.addColorStop(0, '#ffffff'); // highly intense white core for realistic glow physics
        gradient.addColorStop(0.12, color);
        
        // Create soft fade with transparency
        if (color.startsWith('#')) {
          const hex = color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.5)`);
          gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.15)`);
        } else if (color.startsWith('rgba')) {
          gradient.addColorStop(0.4, color.replace('1)', '0.5)').replace('0.8)', '0.4)'));
          gradient.addColorStop(0.7, color.replace('1)', '0.15)').replace('0.8)', '0.1)'));
        } else {
          gradient.addColorStop(0.4, 'rgba(255, 250, 240, 0.4)');
          gradient.addColorStop(0.7, 'rgba(235, 200, 255, 0.12)');
        }
        
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      }
      return new THREE.CanvasTexture(canvas);
    };

    const starTexture = createRadialGlowTexture('#ffffff', 32);
    const blueGlowTexture = createRadialGlowTexture('#00e5ff', 64); // Highly luminous electric cyan/blue

    // 3. Ambient Dust & Tiny Twinkling Stars (Distant Layer)
    const starCount = 2000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 120;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 20;
      starSizes[i] = 0.4 + Math.random() * 0.8;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.8,
      map: starTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7
    });

    const backgroundStars = new THREE.Points(starGeometry, starMaterial);
    scene.add(backgroundStars);

    // 4. Parallax Colorful Nebulae (Gris and Journey Inspired Blue Palette)
    const nebulaColors = [
      'rgba(0, 191, 255, 1)',   // Deep Sky Blue
      'rgba(30, 144, 255, 1)',  // Dodger Blue
      'rgba(72, 61, 139, 1)',   // Indigo / Slate Blue
      'rgba(64, 224, 208, 1)'   // Turquoise / Teal
    ];

    const nebulaPoints: THREE.Points[] = [];
    nebulaColors.forEach((color, index) => {
      const count = 120;
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      
      const offset = new THREE.Vector3(
        (index - 1.5) * 35 + (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 20,
        -15 - index * 10
      );

      for (let i = 0; i < count; i++) {
        pos[i * 3] = offset.x + (Math.random() - 0.5) * 45;
        pos[i * 3 + 1] = offset.y + (Math.random() - 0.5) * 35;
        pos[i * 3 + 2] = offset.z + (Math.random() - 0.5) * 25;
      }

      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));

      const mat = new THREE.PointsMaterial({
        size: 15 + Math.random() * 15,
        map: createRadialGlowTexture(color.replace('1)', '0.5)'), 128),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.12 + Math.random() * 0.08
      });

      const pts = new THREE.Points(geom, mat);
      scene.add(pts);
      nebulaPoints.push(pts);
    });

    // 5. The Soft Radiant Moon
    const moonGeo = new THREE.PlaneGeometry(16, 16);
    const moonTexture = createRadialGlowTexture('#fff9e6', 128);
    const moonMat = new THREE.MeshBasicMaterial({
      map: moonTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.6,
      depthWrite: false
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(15, 12, -15);
    scene.add(moonMesh);

    // 6. Interactive Star Nodes (Significantly Brighter & Larger Cyan Glows)
    const interactiveStarMeshes: THREE.Mesh[] = [];
    const starHomePositions: THREE.Vector3[] = [];
    const starCurrentOffsets: THREE.Vector3[] = [];

    const nodeGeo = new THREE.SphereGeometry(0.35, 16, 16);

    INTERACTIVE_STARS_DATA.forEach((data, index) => {
      const nodeMat = new THREE.MeshBasicMaterial({
        color: 0xfffcf0,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(nodeGeo, nodeMat);
      mesh.position.copy(data.pos);
      mesh.userData = { id: data.id, index, text: data.text, baseScale: 1.0, glowFactor: 1.0, isShooting: false };
      
      const glowGeo = new THREE.PlaneGeometry(5.5, 5.5); // Doubled size for massive radiant shine!
      const glowMat = new THREE.MeshBasicMaterial({
        map: blueGlowTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.95, // Higher opacity for maximum brightness
        depthWrite: false
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      mesh.add(glowMesh);

      // Agregar una esfera invisible grande como hitbox para facilitar clics y toques táctiles súper responsivos!
      const hitBoxGeo = new THREE.SphereGeometry(2.8, 12, 12);
      const hitBoxMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
        depthWrite: false
      });
      const hitBoxMesh = new THREE.Mesh(hitBoxGeo, hitBoxMat);
      hitBoxMesh.userData = { isHitBox: true };
      mesh.add(hitBoxMesh);

      scene.add(mesh);
      interactiveStarMeshes.push(mesh);
      starHomePositions.push(data.pos.clone());
      starCurrentOffsets.push(new THREE.Vector3(0, 0, 0));
    });

    // 7. Dynamic Constellation Lines
    const lineIndices: number[] = [];
    CONSTELLATION_CONNECTIONS.forEach(([a, b]) => {
      lineIndices.push(a, b);
    });

    const constellationGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(INTERACTIVE_STARS_DATA.length * 3);
    
    INTERACTIVE_STARS_DATA.forEach((data, i) => {
      linePositions[i * 3] = data.pos.x;
      linePositions[i * 3 + 1] = data.pos.y;
      linePositions[i * 3 + 2] = data.pos.z;
    });

    constellationGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    constellationGeo.setIndex(lineIndices);

    const constellationMat = new THREE.LineBasicMaterial({
      color: 0xe0f7fa,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending
    });

    const constellationLines = new THREE.LineSegments(constellationGeo, constellationMat);
    scene.add(constellationLines);

    // 8. SIMPLIFIED: 3D Sacred Geometry Stardust Flower with 8 Beautiful Highly-Visible Pointed Lotus Petals
    const flowerGeometry = new THREE.BufferGeometry();
    const flowerPositions = new Float32Array(FLOWER_COUNT * 3);
    const flowerColors = new Float32Array(FLOWER_COUNT * 3); // Per-vertex color arrays for blue theme gradients
    const stardustFlowerPositions: THREE.Vector3[] = [];
    const stardustFlowerTargets: THREE.Vector3[] = [];

    // Mathematically design a highly distinct 8-petal Lotus flower
    for (let i = 0; i < FLOWER_COUNT; i++) {
      // Starting coordinates (dispersed cosmic fog)
      const thetaVal = Math.random() * Math.PI * 2;
      const phiVal = Math.acos((Math.random() * 2) - 1);
      const dist = 30 + Math.random() * 45;
      const startX = dist * Math.sin(phiVal) * Math.cos(thetaVal);
      const startY = dist * Math.sin(phiVal) * Math.sin(thetaVal);
      const startZ = -10 + (Math.random() - 0.5) * 20;
      
      const startPos = new THREE.Vector3(startX, startY, startZ);
      stardustFlowerPositions.push(startPos);

      let targetX = 0;
      let targetY = 0;
      let targetZ = 0;

      let rCol = 1.0;
      let gCol = 1.0;
      let bCol = 1.0;

      if (i < 480) {
        // Redesigned central crown matching the image:
        // - A very dense dark navy/teal core at the very center (r < 0.6)
        // - Surrounded by beautiful golden/amber stamen tips on white/pale filaments (0.6 <= r < 1.85)
        const r = 0.1 + Math.pow(Math.random(), 1.15) * 1.75;
        const ang = Math.random() * Math.PI * 2;
        targetX = r * Math.cos(ang);
        targetY = r * Math.sin(ang);
        targetZ = (Math.random() - 0.5) * 0.35;

        if (r < 0.6) {
          // Dark natural greenish/black core in the center of the stamens
          rCol = 0.01;
          gCol = 0.06;
          bCol = 0.1;
        } else {
          // Yellow-gold / amber stamen pollen tips with elegant high contrast
          const isAmber = Math.random() > 0.4;
          rCol = isAmber ? 0.95 : 0.98;
          gCol = isAmber ? 0.75 : 0.90;
          bCol = isAmber ? 0.20 : 0.60;
        }
      } else {
        // Redesigned wide, circular, overlapping 5-petal structure that does not narrow to a thin point near the center!
        const petalIdx = i % 5;
        const baseAngle = petalIdx * (Math.PI * 2 / 5);
        
        // pct represents progression from base of petal to outer edge [0, 1]
        const pct = Math.pow(Math.random(), 0.95);
        const r_base = 0.65;
        const L = 8.5;
        const distFromCenter = r_base + pct * L;
        
        // Circular, wide-bodied petal width profile: broad base, rich middle, gently rounded tip
        const baseWidth = 3.0; // Thick base so it connects fully and looks robust
        const midWidth = 5.2;  // Beautifully broad body for a circular flowery presence
        const tipWidth = 1.6;  // Nicely rounded tip
        const widthProfile = baseWidth * (1.0 - pct) + midWidth * Math.sin(pct * Math.PI) + tipWidth * pct;
        
        // w represents position across the petal width [-0.5, 0.5]
        const w = (Math.random() - 0.5);
        const localX = distFromCenter;
        const localY = w * widthProfile;
        
        // Rotate the local 2D petal coordinate by the petal's base angle
        targetX = localX * Math.cos(baseAngle) - localY * Math.sin(baseAngle);
        targetY = localX * Math.sin(baseAngle) + localY * Math.cos(baseAngle);
        
        // Curve the petals elegantly upward/forward in 3D to form a cupped chalice-like organic shape
        targetZ = Math.sin(Math.PI * pct) * 1.6 - pct * 0.9 + (Math.random() - 0.5) * 0.12;

        // Radiant Sky Blue to Azure Base colors matching the photograph
        const baseR = THREE.MathUtils.lerp(0.08, 0.22, pct);
        const baseG = THREE.MathUtils.lerp(0.42, 0.68, pct);
        const baseB = THREE.MathUtils.lerp(0.88, 1.0, pct);

        // Compute deep navy/royal blue veins radiating from center (using w across the petal width)
        // High frequency sine wave along the width produces organic radial ridges/veins
        const veinStrength = Math.max(0, Math.cos(w * Math.PI * 5.0));
        
        // Saturated deep indigo/navy blue vein color
        const veinR = 0.02;
        const veinG = 0.15;
        const veinB = 0.48;

        // Blend veins more strongly towards the inner/middle region, exactly like the image
        const blendFactor = veinStrength * 0.8 * (1.0 - pct * 0.4);
        rCol = THREE.MathUtils.lerp(baseR, veinR, blendFactor);
        gCol = THREE.MathUtils.lerp(baseG, veinG, blendFactor);
        bCol = THREE.MathUtils.lerp(baseB, veinB, blendFactor);
      }

      stardustFlowerTargets.push(new THREE.Vector3(targetX, targetY, targetZ));

      flowerPositions[i * 3] = startPos.x;
      flowerPositions[i * 3 + 1] = startPos.y;
      flowerPositions[i * 3 + 2] = startPos.z;

      flowerColors[i * 3] = rCol;
      flowerColors[i * 3 + 1] = gCol;
      flowerColors[i * 3 + 2] = bCol;
    }

    flowerGeometry.setAttribute('position', new THREE.BufferAttribute(flowerPositions, 3));
    flowerGeometry.setAttribute('color', new THREE.BufferAttribute(flowerColors, 3));

    const flowerMat = new THREE.PointsMaterial({
      size: 0.58,
      map: starTexture,
      vertexColors: true, // Enable vertex coloring for stunning blue/cyan gradients!
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.0
    });

    const stardustFlower = new THREE.Points(flowerGeometry, flowerMat);
    scene.add(stardustFlower);

    // Create custom, mathematically beautiful 3D organic petals with gorgeous gradients
    const createPetalGeometry = () => {
      // 3.5 wide, 8.5 tall. Perfect dimensions for a classical, luxurious organic petal.
      const geom = new THREE.PlaneGeometry(3.5, 8.5, 12, 24);
      const posAttr = geom.attributes.position;
      
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i); // ranges from -4.25 to +4.25
        
        // Normalize y to progress [0, 1] from base (-4.25) to tip (+4.25)
        const pct = (y + 4.25) / 8.5;
        
        // Width envelope: start with a narrow organic base,
        // swell broad in the middle, and gracefully taper to a rounded pointed tip at the top (pct = 1)
        const widthFactor = Math.sin(pct * Math.PI) * (0.35 + 0.65 * Math.sin(pct * Math.PI * 0.5));
        const newX = x * widthFactor;
        posAttr.setX(i, newX);
        
        // 3D curved cupping:
        // Petal bends upward/forward in Z based on length (pct) and cups slightly inwards along the edges (X)
        const lengthCurve = Math.pow(pct, 1.8) * 2.5; // curved upward
        const widthCurve = -0.45 * (x * x) * Math.sin(pct * Math.PI); // cupped along the sides
        posAttr.setZ(i, lengthCurve + widthCurve);
        
        // Shift local Y origin so the base of the petal is at exactly Y = 0 (the flower center!)
        posAttr.setY(i, y + 4.25);
      }
      
      geom.computeVertexNormals();
      return geom;
    };

    const createPetalTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Linear gradient from base (bottom) to tip (top)
        const grad = ctx.createLinearGradient(0, 256, 0, 0);
        // Deep blue base, transition to cyan glow, with a pure white luminous tip/edge
        grad.addColorStop(0, 'rgba(8, 18, 54, 0.95)');     // Rich dark cosmic indigo base
        grad.addColorStop(0.3, 'rgba(12, 54, 150, 0.9)');  // Premium royal blue
        grad.addColorStop(0.65, 'rgba(0, 180, 240, 0.95)'); // Celestial glowing cyan
        grad.addColorStop(0.9, 'rgba(160, 240, 255, 0.98)');// Icy cyan glow near tip
        grad.addColorStop(1, 'rgba(255, 255, 255, 1)');     // Luminous pure white tip
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 256);
      }
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };

    const petalTex = createPetalTexture();
    const petalMaterial = new THREE.MeshBasicMaterial({
      map: petalTex,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.0 // controlled by bloomVal in the render loop
    });

    const solidFlowerPetals = new THREE.Group();
    const petalGeom = createPetalGeometry();
    const numPetals = 5;

    for (let p = 0; p < numPetals; p++) {
      const petalMesh = new THREE.Mesh(petalGeom, petalMaterial);
      
      // Rotate each petal around the Z axis to form a perfect 5-star ring
      const angle = p * (Math.PI * 2 / numPetals);
      petalMesh.rotation.z = angle;
      
      // Tilt the petal slightly outward around its local X-axis to bloom open beautifully
      petalMesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), 0.38);
      
      solidFlowerPetals.add(petalMesh);
    }
    
    scene.add(solidFlowerPetals);

    // 8.5 Central Star of Rocío (highly glowing central sphere, appears after blooming)
    const centralStarGeo = new THREE.SphereGeometry(0.65, 24, 24);
    const centralStarMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0 // starts invisible, fades in during finale
    });
    const centralStarMesh = new THREE.Mesh(centralStarGeo, centralStarMat);
    centralStarMesh.position.set(0, 0, 0);
    centralStarMesh.visible = false;
    centralStarMesh.userData = { isCentral: true };

    const centralGlowGeo = new THREE.PlaneGeometry(9.5, 9.5); // Large radiant cyan glow
    const centralGlowMat = new THREE.MeshBasicMaterial({
      map: blueGlowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.0,
      depthWrite: false
    });
    const centralGlowMesh = new THREE.Mesh(centralGlowGeo, centralGlowMat);
    centralStarMesh.add(centralGlowMesh);
    scene.add(centralStarMesh);

    // 8.6 Constellation Core Star (3D Star that player approaches and holds to bloom)
    const coreStarGeo = new THREE.SphereGeometry(0.55, 24, 24);
    const coreStarMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0
    });
    const coreStarMesh = new THREE.Mesh(coreStarGeo, coreStarMat);
    coreStarMesh.position.set(0, 0, 4);
    coreStarMesh.visible = false;

    const coreGlowGeo = new THREE.PlaneGeometry(8.0, 8.0);
    const coreGlowMat = new THREE.MeshBasicMaterial({
      map: createRadialGlowTexture('#fef3c7', 64),
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.0,
      depthWrite: false
    });
    const coreGlowMesh = new THREE.Mesh(coreGlowGeo, coreGlowMat);
    coreStarMesh.add(coreGlowMesh);
    scene.add(coreStarMesh);

    // 9. Interactive Particle Splash Engine (Spark Trails)
    const sparkParticles: { pos: THREE.Vector3; vel: THREE.Vector3; size: number; age: number; maxAge: number; color: THREE.Color }[] = [];
    const sparkGeometry = new THREE.BufferGeometry();
    const sparkPosArray = new Float32Array(MAX_SPARKS * 3);
    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPosArray, 3));

    const sparkMat = new THREE.PointsMaterial({
      size: 0.9,
      map: createRadialGlowTexture('#ffd180', 32),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.9
    });

    const sparkPoints = new THREE.Points(sparkGeometry, sparkMat);
    scene.add(sparkPoints);

    // Morph state variables driven by GSAP / hold progression
    const bloomProgress = { value: 0 };
    const bloomScale = { value: 1.0 };
    const bloomBrighten = { value: 0 };

    threeRef.current = {
      scene,
      camera,
      renderer,
      backgroundStars,
      nebulaPoints,
      interactiveStarMeshes,
      starHomePositions,
      starCurrentOffsets,
      constellationLines,
      moonMesh,
      stardustFlower,
      stardustFlowerPositions,
      stardustFlowerTargets,
      sparkParticles,
      sparkPoints,
      bloomProgress,
      bloomScale,
      bloomBrighten,
      centralStarMesh,
      centralGlowMesh,
      coreStarMesh,
      coreGlowMesh,
      solidFlowerPetals
    };

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Set up inputs (wheel, touch drag, device motion/mouse hover)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isCinematicActive) return;
      e.preventDefault();
      setHasStartedExploring(true);
      
      const delta = e.deltaY * 0.0006;
      // Scroll limit caps at 85% until constellation is awakened (5 stars tapped)
      const capLimit = isReadyToAwaken ? 1.0 : 0.85;
      scrollRef.current.target = Math.max(0, Math.min(capLimit, scrollRef.current.target + delta));
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isCinematicActive) return;
      scrollRef.current.touchStart = e.touches[0].clientY;
      scrollRef.current.isDragging = true;
      setHasStartedExploring(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isCinematicActive) return;
      if (!scrollRef.current.isDragging) return;

      const currentY = e.touches[0].clientY;
      const deltaY = scrollRef.current.touchStart - currentY;
      
      const capLimit = isReadyToAwaken ? 1.0 : 0.85;
      scrollRef.current.target = Math.max(0, Math.min(capLimit, scrollRef.current.target + deltaY * 0.0015));
      scrollRef.current.touchStart = currentY;

      const touch = e.touches[0];
      scrollRef.current.mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
      scrollRef.current.mouseY = -(touch.clientY / window.innerHeight) * 2 + 1;
    };

    const handleTouchEnd = () => {
      scrollRef.current.isDragging = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      scrollRef.current.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      scrollRef.current.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;

      scrollRef.current.tiltX = scrollRef.current.mouseX;
      scrollRef.current.tiltY = scrollRef.current.mouseY;
    };

    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      const tiltY = (e.beta - 45) / 45;
      const tiltX = e.gamma / 45;

      scrollRef.current.tiltX = Math.max(-1.5, Math.min(1.5, tiltX));
      scrollRef.current.tiltY = Math.max(-1.5, Math.min(1.5, tiltY));
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('deviceorientation', handleDeviceOrientation);
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    };
  }, [isCinematicActive, isReadyToAwaken]);

  // Unified Pointer events to cleanly separate dragging/scrolling from clicking/tapping
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerDownPos.current) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    pointerDownPos.current = null;

    // If movement is larger than 10 pixels, treat it as drag/scroll, NOT a tap!
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      return;
    }

    triggerStarClick(e.clientX, e.clientY);
  };

  const triggerStarClick = (clientX: number, clientY: number) => {
    if (!threeRef.current || isStarShooting.current) return;
    const { camera, interactiveStarMeshes, scene } = threeRef.current;

    // Convert to NDC
    const mouseX = (clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(clientY / window.innerHeight) * 2 + 1;

    // If cinematic is active, we ONLY check for central star clicks
    if (isCinematicActive) {
      const targets: THREE.Object3D[] = [];
      if (threeRef.current.centralStarMesh && threeRef.current.centralStarMesh.visible) {
        targets.push(threeRef.current.centralStarMesh);
      }
      if (targets.length === 0) return;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
      const intersects = raycaster.intersectObjects(targets, true);

      if (intersects.length > 0) {
        const star = intersects[0].object as THREE.Mesh;
        if (star.userData.isCentral || (star.parent && star.parent.userData.isCentral)) {
          setIsCentralStarClicked(true);
          playCelestialChime(3);
          playCelestialChime(6);
          playCelestialChime(9);
        }
      }
      return;
    }

    // Raycast to find click targets (recursive = true to check hitboxes!)
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
    const intersects = raycaster.intersectObjects(interactiveStarMeshes, true);

    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      let star = hitObj as THREE.Mesh;
      // If we hit the hitbox or glow, walk up to the parent node mesh
      if (hitObj.parent && hitObj.parent !== scene) {
        star = hitObj.parent as THREE.Mesh;
      }

      const { id, text, index } = star.userData;

      // Only allow tapping the active star in sequence, and only up to the limit!
      const currentActiveIndex = Object.keys(tappedStars).length;
      if (currentActiveIndex >= REQUIRED_STARS_TO_AWAKEN || index !== currentActiveIndex) {
        return; // Ignore click on non-active stars to guide the user sequence!
      }

      // Check distance to camera: Enforce distance check (must be within 18.0 units!)
      const distToCam = camera.position.distanceTo(star.position);
      if (distToCam > 18.0) {
        // Show temporary visual warning message right where they clicked!
        const worldPos = star.position.clone();
        const projPos = worldPos.project(camera);
        const screenX = (projPos.x * 0.5 + 0.5) * 100;
        const screenY = (-projPos.y * 0.5 + 0.5) * 100;

        const newId = Math.random().toString();
        const newText: FloatingText = {
          id: newId,
          text: "¡Muy lejos! Desliza para acercarte",
          x: screenX,
          y: screenY - 5,
          opacity: 0,
          scale: 0.8
        };

        setFloatingTexts(prev => [...prev, newText]);
        gsap.to(newText, {
          opacity: 1,
          scale: 1.0,
          y: screenY - 12,
          duration: 1.0,
          ease: 'power2.out',
          onUpdate: () => {
            setFloatingTexts(prev => prev.map(t => t.id === newId ? { ...t, opacity: newText.opacity, y: newText.y, scale: newText.scale } : t));
          },
          onComplete: () => {
            gsap.to(newText, {
              opacity: 0,
              y: screenY - 18,
              duration: 1.0,
              ease: 'power2.in',
              onUpdate: () => {
                setFloatingTexts(prev => prev.map(t => t.id === newId ? { ...t, opacity: newText.opacity, y: newText.y } : t));
              },
              onComplete: () => {
                setFloatingTexts(prev => prev.filter(t => t.id !== newId));
              }
            });
          }
        });
        return;
      }

      // Prevent shooting the same star twice
      if (tappedStars[id]) return;

      isStarShooting.current = true;
      star.userData.isShooting = true;

      // 1. Play beautiful ascending chime
      playCelestialChime(index);

      // 2. Compute 3D spot directly in front of camera
      const cameraPos = camera.position.clone();
      const lookDir = new THREE.Vector3();
      camera.getWorldDirection(lookDir);
      const targetPos = cameraPos.clone().add(lookDir.multiplyScalar(4.5));

      // 3. GSAP Animation: Detach and shoot extremely fast towards the camera (break 4th wall!)
      gsap.to(star.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: 1.5,
        ease: 'back.in(1.2)',
        onUpdate: () => {
          // Intense gold trail
          const sparks = threeRef.current?.sparkParticles;
          if (sparks) {
            for (let i = 0; i < 6; i++) {
              sparks.push({
                pos: star.position.clone(),
                vel: new THREE.Vector3(
                  (Math.random() - 0.5) * 3,
                  (Math.random() - 0.5) * 3,
                  (Math.random() - 0.5) * 3
                ),
                size: 0.4 + Math.random() * 0.6,
                age: 0,
                maxAge: 40,
                color: new THREE.Color('#ffe082')
              });
            }
          }
        },
        onComplete: () => {
          isStarShooting.current = false;
          star.userData.isShooting = false;
          
          // Hide mesh
          star.visible = false;

          // Massive, full-screen crash particle explosion!
          const sparks = threeRef.current?.sparkParticles;
          if (sparks) {
            const crashPos = star.position.clone();
            for (let i = 0; i < 140; i++) {
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos((Math.random() * 2) - 1);
              const spd = 6.0 + Math.random() * 9.0;
              const vel = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * spd,
                Math.sin(phi) * Math.sin(theta) * spd,
                (Math.random() - 0.5) * 4.0
              );
              sparks.push({
                pos: crashPos.clone(),
                vel,
                size: 0.6 + Math.random() * 0.8,
                age: 0,
                maxAge: 120 + Math.random() * 60,
                color: new THREE.Color(i % 2 === 0 ? '#ffb74d' : '#80deea')
              });
            }
          }

          // Lush double chime
          playCelestialChime(index + 3);
          playCelestialChime(index + 5);

          // Record as tapped & show gorgeous vintage polaroid card
          setTappedStars(prev => {
            const updated = { ...prev, [id]: true };
            const memoryIdx = Object.keys(updated).length - 1;
            const memoryCard = STAR_MEMORIES[memoryIdx % STAR_MEMORIES.length];
            setUnlockedMemory({
              id,
              image: memoryCard.image,
              title: memoryCard.title,
              text: memoryCard.text
            });
            return updated;
          });
        }
      });

      // Spawn temporary float text as well
      const worldPos = star.position.clone();
      const projPos = worldPos.project(camera);
      const screenX = (projPos.x * 0.5 + 0.5) * 100;
      const screenY = (-projPos.y * 0.5 + 0.5) * 100;

      const newId = Math.random().toString();
      const newText: FloatingText = {
        id: newId,
        text,
        x: screenX,
        y: screenY - 5,
        opacity: 0,
        scale: 0.8
      };

      setFloatingTexts(prev => [...prev, newText]);
      gsap.to(newText, {
        opacity: 1,
        scale: 1.1,
        y: screenY - 14,
        duration: 1.5,
        ease: 'power2.out',
        onUpdate: () => {
          setFloatingTexts(prev => prev.map(t => t.id === newId ? { ...t, opacity: newText.opacity, y: newText.y, scale: newText.scale } : t));
        },
        onComplete: () => {
          gsap.to(newText, {
            opacity: 0,
            y: screenY - 22,
            duration: 2.0,
            ease: 'power2.inOut',
            onUpdate: () => {
              setFloatingTexts(prev => prev.map(t => t.id === newId ? { ...t, opacity: newText.opacity, y: newText.y } : t));
            },
            onComplete: () => {
              setFloatingTexts(prev => prev.filter(t => t.id !== newId));
            }
          });
        }
      });
    } else {
      // Tap space effects: light-flower ring
      const vec = new THREE.Vector3(mouseX, mouseY, 0);
      vec.unproject(camera);
      const dir = vec.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      const clickWorldPos = camera.position.clone().add(dir.multiplyScalar(distance));

      const flowerPetals = 8;
      const glowColors = [0xe0f7fa, 0xfff9e6, 0xffd180]; // Original warm/celestial colors
      const col = new THREE.Color(glowColors[Math.floor(Math.random() * glowColors.length)]);
      
      const sparkParticles = threeRef.current.sparkParticles;
      for (let i = 0; i < flowerPetals; i++) {
        const angle = (i / flowerPetals) * Math.PI * 2;
        const vel = new THREE.Vector3(
          Math.cos(angle) * 3.5,
          Math.sin(angle) * 3.5,
          (Math.random() - 0.5) * 1.5
        );
        sparkParticles.push({
          pos: clickWorldPos.clone(),
          vel,
          size: 0.8,
          age: 0,
          maxAge: 75,
          color: col
        });
      }
    }
  };

  // Main Loop logic for ThreeJS animation
  useEffect(() => {
    let animFrameId: number;

    const renderLoop = () => {
      animFrameId = requestAnimationFrame(renderLoop);

      const three = threeRef.current;
      if (!three) return;

      const {
        scene,
        camera,
        renderer,
        backgroundStars,
        nebulaPoints,
        interactiveStarMeshes,
        starHomePositions,
        starCurrentOffsets,
        constellationLines,
        moonMesh,
        stardustFlower,
        stardustFlowerPositions,
        stardustFlowerTargets,
        sparkParticles,
        sparkPoints,
        bloomProgress,
        bloomScale,
        bloomBrighten
      } = three;

      const time = performance.now() * 0.001;

      // 1. Smoothly interpolate virtual scroll progress
      if (!isCinematicActive) {
        scrollRef.current.current += (scrollRef.current.target - scrollRef.current.current) * 0.06;
      }
      const scrollVal = scrollRef.current.current;
      setScrollProgress(scrollVal);

      // Update camera flight trajectory based on scroll
      if (!isCinematicActive) {
        camera.position.z = 50 - scrollVal * 42;
        camera.position.x = Math.sin(scrollVal * Math.PI * 1.2) * 16;
        camera.position.y = Math.cos(scrollVal * Math.PI * 0.8) * 6;
      }

      // Add gentle, elegant 3D tilt-parallax
      const targetCamX = camera.position.x + scrollRef.current.tiltX * 5.5;
      const targetCamY = camera.position.y + scrollRef.current.tiltY * 3.5;
      camera.position.x += (targetCamX - camera.position.x) * 0.08;
      camera.position.y += (targetCamY - camera.position.y) * 0.08;
      camera.lookAt(0, 0, 0);

      // 2. Slow orbital drift of background dust & nebulae
      backgroundStars.rotation.z = time * 0.004;
      backgroundStars.rotation.y = time * 0.002;

      nebulaPoints.forEach((pts, i) => {
        pts.rotation.z = time * (0.005 + i * 0.002);
        const scale = 1.0 + Math.sin(time * 0.4 + i) * 0.05;
        pts.scale.set(scale, scale, scale);
      });

      // Twinkle background stars
      const starSizes = backgroundStars.geometry.attributes.size.array as Float32Array;
      for (let i = 0; i < starSizes.length; i++) {
        starSizes[i] = (0.4 + Math.abs(Math.sin(time * 1.5 + i))) * 0.9;
      }
      backgroundStars.geometry.attributes.size.needsUpdate = true;

      // 3. Moon glow breathing and scroll opacity
      const moonOpacity = 0.6 - (scrollVal * 0.5) + (Math.sin(time * 0.6) * 0.08) + bloomBrighten.value * 0.4;
      (moonMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, Math.min(1.0, moonOpacity));
      const moonPulse = 1.0 + Math.sin(time * 0.5) * 0.03;
      moonMesh.scale.set(moonPulse, moonPulse, 1);

      // 4. Constellation Lines Reveal
      const linesOpacity = Math.max(0, Math.min(0.65, (scrollVal - 0.15) * 1.8));
      (constellationLines.material as THREE.LineBasicMaterial).opacity = linesOpacity * (1.0 - bloomProgress.value);

      const currentActiveIndex = Object.keys(tappedStars).length;

      // Update isTooFar state reactively for the active star to show guided feedback
      if (currentActiveIndex < REQUIRED_STARS_TO_AWAKEN && interactiveStarMeshes[currentActiveIndex]) {
        const activeStar = interactiveStarMeshes[currentActiveIndex];
        const dist = camera.position.distanceTo(activeStar.position);
        const tooFar = dist > 18.0;
        if (tooFar !== tooFarRef.current) {
          tooFarRef.current = tooFar;
          setIsTooFar(tooFar);
        }
      }

      // 5. Interactive Star Nodes repulsion physics
      const tempVec = new THREE.Vector3(scrollRef.current.mouseX, scrollRef.current.mouseY, 0.5);
      tempVec.unproject(camera);
      const direction = tempVec.sub(camera.position).normalize();
      const distToPlane = -camera.position.z / direction.z;
      const cursorWorld = camera.position.clone().add(direction.multiplyScalar(distToPlane));

      interactiveStarMeshes.forEach((mesh, idx) => {
        // If star has been tapped and is shooting, skip home repositions
        if (mesh.userData.isShooting) return;

        // If we have started blooming, hide completely!
        if (bloomProgress.value > 0.05) {
          mesh.visible = false;
          return;
        }

        // If star has been clicked and absorbed, keep it very dim and subtle inside the constellation
        if (tappedStars[mesh.userData.id]) {
          mesh.visible = true;
          mesh.scale.set(0.4, 0.4, 0.4);
          const glow = mesh.children[0] as THREE.Mesh;
          if (glow) {
            glow.scale.set(0.35, 0.35, 1.0);
            (glow.material as THREE.MeshBasicMaterial).opacity = 0.08 * (1.0 - bloomProgress.value);
          }
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.22 * (1.0 - bloomProgress.value);
          // Slowly lerp position back to home pos
          mesh.position.lerp(starHomePositions[idx], 0.1);
          return;
        }

        mesh.visible = true;

        const homePos = starHomePositions[idx];
        const offset = starCurrentOffsets[idx];
        const meshWorldPos = homePos.clone().add(offset);
        const distance = meshWorldPos.distanceTo(cursorWorld);
        const repulseRange = 9.0;
        
        const targetOffset = new THREE.Vector3(0, 0, 0);
        if (distance < repulseRange) {
          const force = (1.0 - distance / repulseRange) * 1.8;
          targetOffset.copy(meshWorldPos.clone().sub(cursorWorld).normalize().multiplyScalar(force));
          targetOffset.z *= 0.2;
        }

        offset.lerp(targetOffset, 0.07);
        mesh.position.copy(homePos).add(offset);

        const isActive = idx === currentActiveIndex && currentActiveIndex < REQUIRED_STARS_TO_AWAKEN;

        const glow = mesh.children[0] as THREE.Mesh;
        if (glow) {
          glow.rotation.z = time * 0.2 + idx;
          if (isActive) {
            const distToCam = camera.position.distanceTo(mesh.position);
            const isNear = distToCam <= 18.0;

            // Highly glowing active star! Pulsate much faster and scale up if near enough to be touched!
            const pulseSpeed = isNear ? 6.5 : 2.5;
            const pulseFactor = (isNear ? 2.6 : 1.6) + Math.sin(time * pulseSpeed + idx) * (isNear ? 0.7 : 0.3);
            glow.scale.set(pulseFactor, pulseFactor, 1.0);
            
            const baseOpacity = (isNear ? 1.0 : 0.6) + Math.sin(time * 5.0 + idx) * 0.05;
            (glow.material as THREE.MeshBasicMaterial).opacity = baseOpacity * (1.0 - bloomProgress.value);
            mesh.scale.set(isNear ? 1.6 : 1.0, isNear ? 1.6 : 1.0, isNear ? 1.6 : 1.0);
          } else {
            // Non-active stars are very dim and subtle
            const pulseFactor = 0.45 + Math.sin(time * 1.5 + idx) * 0.15;
            glow.scale.set(pulseFactor, pulseFactor, 1.0);
            (glow.material as THREE.MeshBasicMaterial).opacity = 0.12 * (1.0 - bloomProgress.value);
            mesh.scale.set(0.65, 0.65, 0.65);
          }
        }

        (mesh.material as THREE.MeshBasicMaterial).opacity = (isActive ? 1.0 : 0.35) * (1.0 - bloomProgress.value);
      });

      // Update 3D Core Star of the constellation if awakened
      if (isReadyToAwaken && three.coreStarMesh && three.coreGlowMesh) {
        if (bloomProgress.value < 0.95) {
          three.coreStarMesh.visible = true;
          // Fade in core star opacity smoothly
          const targetOpacity = Math.max(0, 1.0 - bloomProgress.value);
          const currentMat = three.coreStarMesh.material as THREE.MeshBasicMaterial;
          currentMat.opacity += (targetOpacity - currentMat.opacity) * 0.1;
          
          // Animate core glow pulse
          const pulseSpeed = 4.0 + holdProgress * 8.0; // pulses faster as they hold!
          const pulseFactor = (1.5 + holdProgress * 1.8) + Math.sin(time * pulseSpeed) * (0.2 + holdProgress * 0.4);
          three.coreGlowMesh.scale.set(pulseFactor, pulseFactor, 1.0);
          
          const coreGlowMat = three.coreGlowMesh.material as THREE.MeshBasicMaterial;
          coreGlowMat.opacity = (0.75 + holdProgress * 0.25) * (1.0 - bloomProgress.value);

          // Track screen projection of core star for 3D overlay
          if (!isCinematicActive) {
            const corePos = three.coreStarMesh.position.clone();
            corePos.project(camera);
            const screenX = (corePos.x * 0.5 + 0.5) * 100;
            const screenY = (-corePos.y * 0.5 + 0.5) * 100;
            const dist = camera.position.distanceTo(three.coreStarMesh.position);
            setCoreScreen({
              x: screenX,
              y: screenY,
              dist,
              isNear: dist <= 15.0
            });
          }
        } else {
          three.coreStarMesh.visible = false;
        }
      } else if (three.coreStarMesh) {
        three.coreStarMesh.visible = false;
      }

      // Verificación en vivo de hover sobre estrella activa para cambiar el cursor a 'pointer'
      let hoveredActiveStar = false;
      const hoverRaycaster = new THREE.Raycaster();
      hoverRaycaster.setFromCamera(new THREE.Vector2(scrollRef.current.mouseX, scrollRef.current.mouseY), camera);
      const hoverIntersects = hoverRaycaster.intersectObjects(interactiveStarMeshes, true);

      if (hoverIntersects.length > 0) {
        let hitObj = hoverIntersects[0].object;
        let starMesh = hitObj;
        if (hitObj.parent && hitObj.parent !== scene) {
          starMesh = hitObj.parent;
        }
        const currentActiveIndex = Object.keys(tappedStars).length;
        if (starMesh.userData.index === currentActiveIndex && currentActiveIndex < REQUIRED_STARS_TO_AWAKEN && !tappedStars[starMesh.userData.id]) {
          hoveredActiveStar = true;
        }
      }

      // También verificar estrella central si el modo cinemático está activo
      if (isCinematicActive && three.centralStarMesh && three.centralStarMesh.visible) {
        const centralIntersects = hoverRaycaster.intersectObjects([three.centralStarMesh], true);
        if (centralIntersects.length > 0) {
          hoveredActiveStar = true;
        }
      }

      const canvas = document.getElementById('webgl-universe-canvas');
      if (canvas) {
        canvas.style.cursor = hoveredActiveStar ? 'pointer' : 'default';
      }

      // Update lines representation buffer to map with moving stars
      const linePosAttr = constellationLines.geometry.attributes.position;
      interactiveStarMeshes.forEach((mesh, idx) => {
        // Only map if visible and not shooting
        if (mesh.visible && !mesh.userData.isShooting) {
          linePosAttr.setXYZ(idx, mesh.position.x, mesh.position.y, mesh.position.z);
        } else {
          // Send connections out of view to split broken line segments elegantly
          linePosAttr.setXYZ(idx, 9999, 9999, 9999);
        }
      });
      linePosAttr.needsUpdate = true;

      // 6. Particle Splash Engine Update
      const sparkPositions = sparkPoints.geometry.attributes.position.array as Float32Array;
      let activeSparks = 0;

      for (let i = sparkParticles.length - 1; i >= 0; i--) {
        const p = sparkParticles[i];
        p.age++;

        if (p.age >= p.maxAge) {
          sparkParticles.splice(i, 1);
          continue;
        }

        p.vel.multiplyScalar(0.975);
        p.vel.y += 0.012;
        p.pos.add(p.vel);

        if (activeSparks < MAX_SPARKS) {
          sparkPositions[activeSparks * 3] = p.pos.x;
          sparkPositions[activeSparks * 3 + 1] = p.pos.y;
          sparkPositions[activeSparks * 3 + 2] = p.pos.z;
          activeSparks++;
        }
      }

      for (let i = activeSparks; i < MAX_SPARKS; i++) {
        sparkPositions[i * 3] = 9999;
        sparkPositions[i * 3 + 1] = 9999;
        sparkPositions[i * 3 + 2] = 9999;
      }
      sparkPoints.geometry.attributes.position.needsUpdate = true;
      (sparkPoints.material as THREE.PointsMaterial).opacity = 0.95;

      // 7. Stardust Flower Morphing
      // Bloom value is driven directly by either holding progress OR the final cinematic timeline
      let bloomVal = bloomProgress.value;
      if (!isCinematicActive) {
        // Sync bloomProgress value to holdProgress state smoothly
        bloomProgress.value += (holdProgress - bloomProgress.value) * 0.1;
        bloomVal = bloomProgress.value;
      }

      // Slowly fade in flower particles as they get activated
      (stardustFlower.material as THREE.PointsMaterial).opacity = Math.min(0.95, bloomVal * 1.5);

      const flowerGeoPos = stardustFlower.geometry.attributes.position;
      const positions = flowerGeoPos.array as Float32Array;

      for (let i = 0; i < FLOWER_COUNT; i++) {
        const source = stardustFlowerPositions[i];
        const target = stardustFlowerTargets[i];

        const delayFactor = (i / FLOWER_COUNT) * 0.28;
        const particleProgress = Math.max(0, Math.min(1.0, (bloomVal - delayFactor) / (1.0 - delayFactor)));
        const easedProgress = Math.pow(particleProgress, 3);

        let x = THREE.MathUtils.lerp(source.x, target.x * bloomScale.value, easedProgress);
        let y = THREE.MathUtils.lerp(source.y, target.y * bloomScale.value, easedProgress);
        let z = THREE.MathUtils.lerp(source.z, target.z * bloomScale.value, easedProgress);

        // Swirling vortex physics when morphing is in progress
        if (particleProgress > 0 && particleProgress < 1.0) {
          const swirlRadius = (1.0 - easedProgress) * 7.5;
          const swirlSpeed = time * 2.8 + i * 0.02;
          x += Math.cos(swirlSpeed) * swirlRadius;
          y += Math.sin(swirlSpeed) * swirlRadius;
        }

        // Beautiful layered petal breathing once assembled
        if (particleProgress >= 1.0) {
          const petalIdx = i % 8;
          const petalFreq = time * 1.6 + petalIdx * 1.4;
          const drift = Math.sin(petalFreq) * 0.32;
          x += Math.cos(petalFreq) * drift;
          y += Math.sin(petalFreq) * drift;
          z += Math.sin(petalFreq * 0.5) * 0.18;
        }

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }
      flowerGeoPos.needsUpdate = true;

      // Spin flower gracefully
      stardustFlower.rotation.z = time * 0.04 + bloomVal * 0.45;

      // Sync 3D solid flower petals with stardustPoints!
      if (three.solidFlowerPetals) {
        three.solidFlowerPetals.rotation.z = stardustFlower.rotation.z;
        
        // Scale and animate flare based on bloom value
        const s = bloomVal * bloomScale.value;
        three.solidFlowerPetals.scale.set(s, s, s);
        
        // Dynamically adjust petal opacity according to bloom value (if not overridden by cinematic final timeline)
        if (!isCinematicActive) {
          const firstMesh = three.solidFlowerPetals.children[0] as THREE.Mesh;
          if (firstMesh && firstMesh.material) {
            (firstMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.95, bloomVal * 1.5);
          }
        }

        // Add small, natural, breathing micro-movements to the solid petals for an incredibly organic feel!
        three.solidFlowerPetals.children.forEach((petal, idx) => {
          const pMesh = petal as THREE.Mesh;
          const pulseSpeed = time * 1.5 + idx * 1.2;
          // Petal breathing: soft, tiny, organic wave on local tilt
          const tiltFactor = 0.38 + Math.sin(pulseSpeed) * 0.04 * bloomVal;
          pMesh.rotation.x = tiltFactor;
        });
      }

      // Gently animate the central star if visible
      if (threeRef.current.centralStarMesh && threeRef.current.centralStarMesh.visible) {
        threeRef.current.centralStarMesh.rotation.y = time * 0.25;
        if (threeRef.current.centralGlowMesh) {
          threeRef.current.centralGlowMesh.rotation.z = -time * 0.15;
          const centralPulse = 1.0 + Math.sin(time * 3.5) * 0.25; // elegant rapid star twinkle pulse
          threeRef.current.centralGlowMesh.scale.set(centralPulse, centralPulse, 1.0);
        }
      }

      // 8. Background sky illumination (Interpolates to rich, luminous sapphire cosmic blue)
      if (bloomBrighten.value > 0) {
        const colorVal = bloomBrighten.value;
        const colorR = THREE.MathUtils.lerp(0.0196, 0.03, colorVal);
        const colorG = THREE.MathUtils.lerp(0.0274, 0.12, colorVal);
        const colorB = THREE.MathUtils.lerp(0.0392, 0.32, colorVal);
        renderer.setClearColor(new THREE.Color(colorR, colorG, colorB), 1.0);
        scene.fog = new THREE.FogExp2(new THREE.Color(colorR, colorG, colorB), 0.015);
      } else {
        renderer.setClearColor(0x05070a, 1.0);
        scene.fog = new THREE.FogExp2(0x05070a, 0.015);
      }

      renderer.render(scene, camera);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [isCinematicActive, holdProgress, tappedStars]);

  // Handle Hold to Bloom triggers
  useEffect(() => {
    if (isHolding && !isCinematicActive) {
      // Increment hold interval
      holdIntervalRef.current = window.setInterval(() => {
        setHoldProgress(p => {
          const next = Math.min(1.0, p + 0.012);
          
          // Emit lovely spiraling spark sprays from the core while holding!
          const three = threeRef.current;
          if (three) {
            const sparks = three.sparkParticles;
            const angle = Math.random() * Math.PI * 2;
            const spd = 3.0 + Math.random() * 5.0;
            sparks.push({
              pos: new THREE.Vector3(0, 0, 0),
              vel: new THREE.Vector3(Math.cos(angle) * spd, Math.sin(angle) * spd, (Math.random() - 0.5) * 2),
              size: 0.4 + Math.random() * 0.8,
              age: 0,
              maxAge: 70 + Math.random() * 40,
              color: new THREE.Color('#ffe082')
            });
          }

          // Soft feedback chimes as it fills
          if (Math.random() < 0.15) {
            playCelestialChime(Math.floor(next * 10));
          }

          // Full Bloom Reached
          if (next >= 1.0 && !isBloomTriggered.current) {
            isBloomTriggered.current = true;
            triggerCinematicFinale();
            if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
          }

          return next;
        });
      }, 35);
    } else {
      // Decay hold when releasing (forces player to intentionally hold it down)
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (!isCinematicActive && !isBloomTriggered.current) {
        holdIntervalRef.current = window.setInterval(() => {
          setHoldProgress(p => {
            const next = Math.max(0, p - 0.02);
            if (next === 0) {
              if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
            }
            return next;
          });
        }, 40);
      }
    }

    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, [isHolding, isCinematicActive]);

  // Automated magical 20-second cinematic finale
  const triggerCinematicFinale = () => {
    setIsCinematicActive(true);
    
    const three = threeRef.current;
    if (!three) return;

    const { bloomProgress, bloomScale, bloomBrighten, camera } = three;

    const tl = gsap.timeline();

    playCelestialChime(1);
    setTimeout(() => playCelestialChime(4), 300);
    setTimeout(() => playCelestialChime(7), 600);
    setTimeout(() => playCelestialChime(9), 1000);

    // 1. Lock camera in central majestic view
    tl.to(camera.position, {
      x: 0,
      y: 0,
      z: 22,
      duration: 5.5,
      ease: 'power3.inOut'
    });

    // 2. Morph stardust fully into the flower
    tl.to(bloomProgress, {
      value: 1.0,
      duration: 6.5,
      ease: 'power2.out'
    }, 0);

    // 3. Flower blooms spectacularly! Scale up and disperse petals as galaxies
    tl.to(bloomScale, {
      value: 1.95,
      duration: 7.5,
      ease: 'power2.inOut',
      onStart: () => {
        const sparks = threeRef.current?.sparkParticles;
        const baseVec = new THREE.Vector3(0, 0, 0);
        if (sparks) {
          for (let i = 0; i < 200; i++) {
            const angle = (i / 200) * Math.PI * 2;
            const spd = 7.0 + Math.random() * 10.0;
            const vel = new THREE.Vector3(
              Math.cos(angle) * spd,
              Math.sin(angle) * spd,
              (Math.random() - 0.5) * 6.0
            );
            sparks.push({
              pos: baseVec.clone(),
              vel,
              size: 0.5 + Math.random() * 1.1,
              age: 0,
              maxAge: 130 + Math.random() * 160,
              color: new THREE.Color('#ffe082')
            });
          }
        }
      }
    }, 4.5);

    // 4. Sky transforms into glowing pastel dawn
    tl.to(bloomBrighten, {
      value: 1.0,
      duration: 9.0,
      ease: 'power1.inOut'
    }, 5.0);

    // 5. Spin majestic flower
    tl.to(three.stardustFlower.rotation, {
      z: '+=5.5',
      duration: 13.0,
      ease: 'power2.inOut'
    }, 3.0);

    // 6. Soft dissolve of core flower structure, merging into galaxies
    tl.to(three.stardustFlower.material, {
      opacity: 0.22,
      duration: 7.0,
      ease: 'power1.inOut'
    }, 11.0);

    if (three.solidFlowerPetals) {
      const firstMesh = three.solidFlowerPetals.children[0] as THREE.Mesh;
      if (firstMesh && firstMesh.material) {
        tl.to(firstMesh.material, {
          opacity: 0.15,
          duration: 7.0,
          ease: 'power1.inOut'
        }, 11.0);
      }
    }

    // 7. Letter-by-letter drawing of the magical sentence - starts earlier
    tl.call(() => {
      setIsSentenceVisible(true);
      typeOutSentence();
    }, undefined, 6.5);
  };

  const typeOutSentence = () => {
    const fullSentence = "El universo se volvió un poco más hermoso el día en que naciste, Rocío.";
    let currentText = "";
    let i = 0;

    const interval = setInterval(() => {
      if (i < fullSentence.length) {
        currentText += fullSentence[i];
        setTypedSentence(currentText);

        const three = threeRef.current;
        if (three) {
          const sparks = three.sparkParticles;
          const pos = new THREE.Vector3(
            (Math.random() - 0.5) * 16,
            -3 + (Math.random() - 0.5) * 3,
            6 + (Math.random() - 0.5) * 4
          );
          sparks.push({
            pos,
            vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 2.2, (Math.random() - 0.5) * 1.5),
            size: 0.5 + Math.random() * 0.7,
            age: 0,
            maxAge: 90,
            color: new THREE.Color('#ffecb3')
          });
        }

        if (fullSentence[i] !== ' ' && i % 4 === 0) {
          playCelestialChime(Math.floor(i / 4) % 10);
        }

        i++;
      } else {
        clearInterval(interval);
        
        // Reveal the Central Star of Rocío and its brilliant cyan glow plane ONLY after text finishes typing!
        const three = threeRef.current;
        if (three && three.centralStarMesh && three.centralGlowMesh) {
          three.centralStarMesh.visible = true;
          gsap.to(three.centralStarMesh.material, {
            opacity: 1.0,
            duration: 3.5,
            ease: 'power2.out'
          });
          gsap.to(three.centralGlowMesh.material, {
            opacity: 0.95,
            duration: 3.5,
            ease: 'power2.out'
          });
        }

        setTimeout(() => {
          playCelestialChime(1);
          playCelestialChime(4);
          playCelestialChime(8);
          // Gently reveal the central guide prompting them to press the center!
          setShowCentralGuide(true);
        }, 1200);
      }
    }, 55); // Sped up considerably from 180ms
  };

  return (
    <div
      id="celestial-experience-container"
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden select-none touch-none bg-[#05070a]"
    >
      {/* Design Theme Nebula Layer 1 - Deep Sapphire Blue Blur */}
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full bg-blue-950/20 blur-[120px] pointer-events-none z-0"></div>

      {/* Design Theme Nebula Layer 2 - Celestial Turquoise Blur */}
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-cyan-950/15 blur-[100px] pointer-events-none z-0"></div>

      {/* Design Theme Azure Glow for the Star Flower Core */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-200/5 blur-[80px] pointer-events-none z-0"></div>

      {/* Immersive WebGL Background Canvas */}
      <canvas
        id="webgl-universe-canvas"
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerUp={handleCanvasPointerUp}
        className="absolute top-0 left-0 w-full h-full block cursor-default z-10"
      />

      {/* Floating Poetic Sentences Overlay from Tapped Stars */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20 overflow-hidden">
        {floatingTexts.map(item => (
          <div
            key={item.id}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              opacity: item.opacity,
              transform: `translate(-50%, -50%) scale(${item.scale})`,
              textShadow: '0px 0px 4px rgba(0,0,0,1), 1px 1px 2px rgba(0,0,0,1), -1px -1px 2px rgba(0,0,0,1), 1px -1px 2px rgba(0,0,0,1), -1px 1px 2px rgba(0,0,0,1)'
            }}
            className="absolute font-caveat text-2xl sm:text-3xl text-amber-200 font-bold tracking-wide whitespace-nowrap transition-transform duration-75 select-none"
          >
            {item.text}
          </div>
        ))}
      </div>

      {/* Guided Feedback Banner for navigation & distances - Minimalist elegant toast */}
      {!isReadyToAwaken && !isCinematicActive && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none z-30 select-none text-center px-4 w-full max-w-xs sm:max-w-md transition-all duration-300">
          <div className="inline-block bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-lg">
            <span className="font-sans text-xs text-white/90 tracking-wide font-medium animate-fadeIn">
              {isTooFar ? "Desliza para acercarte a la estrella brillante" : "¡Estrella al alcance! Tócala para despertar el recuerdo"}
            </span>
          </div>
        </div>
      )}

      {/* Beautiful Screen Margins Indicators (Cinematic Minimalist Borders) */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#05070a]/70 to-transparent pointer-events-none z-20" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#05070a]/70 to-transparent pointer-events-none z-20" />

      {/* Bottom Scene Detail: Soft Horizon Glow from Design Theme */}
      <div className="absolute bottom-0 left-0 w-full h-[15%] bg-gradient-to-t from-white/5 to-transparent pointer-events-none z-20"></div>

      {/* Game/Interaction Guides and Status Indicators */}
      <div className="absolute top-8 right-8 flex flex-col items-end pointer-events-none z-30 select-none">
        <div className="flex items-center space-x-2.5 bg-black/30 backdrop-blur-md border border-white/5 px-4 py-2 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          <div className="relative w-2.5 h-2.5 flex items-center justify-center">
            <span className={`absolute block w-2.5 h-2.5 rounded-full ${isReadyToAwaken ? 'bg-amber-300 animate-ping' : 'bg-cyan-400'}`} />
            <span className={`relative block w-2 h-2 rounded-full ${isReadyToAwaken ? 'bg-amber-300' : 'bg-cyan-400'}`} />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/80">
            {tappedCount} / {REQUIRED_STARS_TO_AWAKEN} Fragmentos de memoria recuperados
          </span>
        </div>
        {/* Helper subtitle to explain tapping */}
        {!isReadyToAwaken && (
          <span className="font-caveat text-sm text-cyan-200/70 mt-2 tracking-wide animate-pulse max-w-xs text-right">
            Toca los nodos brillantes para liberar recuerdos y desbloquear el cielo...
          </span>
        )}
      </div>

      {/* Ambient Depth Indicator */}
      {!isCinematicActive && (
        <div
          id="universe-depth-gauge"
          className="absolute top-8 left-8 flex items-center space-x-3 pointer-events-none z-20 opacity-50 transition-opacity duration-500"
        >
          <div className="relative w-2 h-2">
            <span className="absolute block w-2 h-2 rounded-full bg-cyan-200 animate-ping opacity-75" />
            <span className="relative block w-2 h-2 rounded-full bg-cyan-300" />
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-cyan-200">
            Profundidad: {Math.round(scrollProgress * 100)}%
          </span>
        </div>
      )}

      {/* Gentle Scroll Hint at the start */}
      {!hasStartedExploring && !isCinematicActive && tappedCount === 0 && (
        <div
          id="scroll-indicator-hint"
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-30 transition-opacity duration-1000 animate-pulse"
        >
          <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3 text-center px-4">
            Desplázate o arrastra para volar por el espacio
          </span>
          <div className="w-[1px] h-10 bg-gradient-to-b from-white/30 via-white/10 to-transparent flex justify-center">
            <div className="w-1 h-1 rounded-full bg-white/60 animate-bounce mt-1" />
          </div>
        </div>
      )}

      {/* INTERACTIVE CELESTIAL CORE: Touch and Hold trigger when constellation awakened */}
      {isReadyToAwaken && !isCinematicActive && (
        <div
          id="celestial-hold-trigger-container"
          style={{
            position: 'absolute',
            left: `${coreScreen.x}%`,
            top: `${coreScreen.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          className="pointer-events-auto z-30 select-none flex flex-col items-center justify-center"
        >
          {/* Pulsing trigger core wrapper */}
          <div className="relative flex flex-col items-center space-y-4 text-center">
            
            {/* Guide Ring indicating connection if too far */}
            {!coreScreen.isNear && (
              <div className="absolute w-28 h-28 sm:w-32 sm:h-32 border border-dashed border-amber-300/30 rounded-full animate-spin-slow pointer-events-none" />
            )}

            <button
              id="celestial-core-trigger-btn"
              disabled={!coreScreen.isNear}
              onMouseDown={() => {
                if (coreScreen.isNear) setIsHolding(true);
              }}
              onMouseUp={() => setIsHolding(false)}
              onMouseLeave={() => setIsHolding(false)}
              onTouchStart={() => {
                if (coreScreen.isNear) setIsHolding(true);
              }}
              onTouchEnd={() => setIsHolding(false)}
              style={{
                boxShadow: coreScreen.isNear
                  ? `0 0 ${40 + holdProgress * 60}px rgba(254, 243, 199, ${0.25 + holdProgress * 0.65})`
                  : `0 0 15px rgba(254, 243, 199, 0.05)`,
                borderColor: coreScreen.isNear
                  ? `rgba(254, 243, 199, ${0.2 + holdProgress * 0.8})`
                  : `rgba(254, 243, 199, 0.05)`,
              }}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border backdrop-blur-md flex items-center justify-center transition-all duration-300 relative group ${
                coreScreen.isNear
                  ? "bg-gradient-to-tr from-amber-200/25 to-white/10 cursor-pointer active:scale-95"
                  : "bg-white/5 opacity-40 cursor-not-allowed"
              }`}
            >
              {/* Inner physical nucleus */}
              <div
                style={{
                  transform: `scale(${coreScreen.isNear ? (1.0 + holdProgress * 1.5) : 0.8})`,
                  backgroundColor: coreScreen.isNear
                    ? `rgba(254, 243, 199, ${0.75 + holdProgress * 0.25})`
                    : 'rgba(254, 243, 199, 0.3)'
                }}
                className={`w-5 h-5 rounded-full transition-all duration-100 flex items-center justify-center ${
                  coreScreen.isNear ? "bg-amber-100 shadow-[0_0_20px_#fef3c7]" : "bg-amber-300/40"
                }`}
              />

              {/* Shimmer rings (Only when near) */}
              {coreScreen.isNear && (
                <>
                  <div className="absolute inset-[-8px] border border-amber-200/15 rounded-full animate-pulse group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-[-18px] border border-white/5 rounded-full animate-ping opacity-30" />
                </>
              )}

              {/* Hold Progress Ring Border (Only active when near) */}
              {coreScreen.isNear && (
                <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    stroke="rgba(251, 191, 36, 0.75)"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1.0 - holdProgress)}`}
                    className="transition-all duration-75"
                  />
                </svg>
              )}
            </button>

            {/* Absolute bottom instructions overlay so it stays clean and perfectly legible against glowing backgrounds */}
            <div className="flex flex-col items-center space-y-1.5 px-4.5 py-2.5 w-56 max-w-xs bg-stone-950/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] mt-3">
              {coreScreen.isNear ? (
                <>
                  <span className="font-sans text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-amber-200 font-semibold animate-pulse">
                    {isHolding ? "Despertando el Cosmos..." : "Mantén Pulsado el Núcleo"}
                  </span>
                  <span className="font-caveat text-xs sm:text-sm text-amber-100/70 leading-tight">
                    Haz florecer la constelación
                  </span>
                </>
              ) : (
                <>
                  <span className="font-sans text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-cyan-300 font-medium">
                    Núcleo Divino Distante
                  </span>
                  <span className="font-caveat text-xs sm:text-sm text-cyan-200/70 leading-tight animate-pulse">
                    Desliza hacia abajo para aproximarte
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POLAROID MEMORY CARD OVERLAY */}
      {unlockedMemory && (
        <div
          id="polaroid-overlay"
          className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-black/45 backdrop-blur-sm transition-all duration-500"
          onClick={() => setUnlockedMemory(null)}
        >
          {/* Polaroid container */}
          <div
            className="bg-[#fcfbf9] text-stone-800 p-4 pb-8 rounded shadow-[0_24px_50px_rgba(0,0,0,0.7)] max-w-xs sm:max-w-sm w-full flex flex-col space-y-4 animate-scaleUp cursor-default transform rotate-1 select-none"
            onClick={e => e.stopPropagation()}
          >
            {/* Aspect image placeholder */}
            <div className="relative aspect-square w-full bg-stone-900 overflow-hidden border border-stone-200 shadow-inner">
              <img
                src={unlockedMemory.image}
                alt={unlockedMemory.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover grayscale-[25%] contrast-[105%]"
              />
              <div className="absolute inset-0 bg-amber-900/5 mix-blend-color-burn pointer-events-none" />
            </div>

            {/* Polaroid handwritten captions */}
            <div className="flex flex-col space-y-2.5 px-1.5 text-center">
              <h2 className="font-cinzel text-lg tracking-wider font-semibold text-stone-900 border-b border-stone-200/80 pb-1.5">
                {unlockedMemory.title}
              </h2>
              <p className="font-caveat text-xl text-stone-700 leading-relaxed max-w-[280px] mx-auto">
                "{unlockedMemory.text}"
              </p>
            </div>

            {/* Minimalist interactive hand close btn */}
            <button
              onClick={() => setUnlockedMemory(null)}
              className="mt-2 font-sans text-[10px] uppercase tracking-[0.25em] text-stone-400 hover:text-stone-700 active:scale-95 transition-all duration-200 border border-stone-200 py-1.5 rounded-sm hover:bg-stone-50 cursor-pointer text-center"
            >
              Continuar Viaje
            </button>
          </div>
        </div>
      )}

      {/* Cinematic Final Sentence Render with Design Theme Typography */}
      {isSentenceVisible && (
        <div
          id="cinematic-final-sentence"
          className="absolute inset-x-0 bottom-16 sm:bottom-24 flex items-end justify-center p-8 text-center pointer-events-none z-30 select-none"
        >
          <div className="max-w-2xl">
            <h1
              style={{
                fontFamily: "'Cinzel', 'Georgia', serif",
                textShadow: '0 0 20px rgba(255, 236, 179, 0.45), 0 0 40px rgba(255, 213, 79, 0.15)'
              }}
              className="text-2xl sm:text-3xl md:text-4xl text-amber-50 font-light italic leading-relaxed tracking-wider break-words selection:bg-transparent drop-shadow-lg shadow-white/20"
            >
              "{typedSentence}"
              <span className="inline-block w-[2px] h-[24px] sm:h-[32px] md:h-[40px] bg-amber-200/80 animate-pulse ml-1 align-middle" />
            </h1>
          </div>
        </div>
      )}

      {/* CENTRAL STAR TAP GUIDE */}
      {showCentralGuide && !isCentralStarClicked && (
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-35 flex flex-col items-center text-center pointer-events-none animate-fadeIn select-none px-6 w-full max-w-md">
          <div className="bg-black/50 backdrop-blur-md border border-cyan-400/25 px-5 py-3 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.2)] flex flex-col items-center">
            <span className="font-caveat text-base sm:text-lg text-cyan-100/90 tracking-wide">
              Toca la estrella brillante en el centro de la flor
            </span>
          </div>
        </div>
      )}

      {/* FINAL CELEBRATORY BIRTHDAY MODAL FOR ROCÍO */}
      {isCentralStarClicked && (
        <div
          id="birthday-celebration-overlay"
          className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-[#02050a]/90 backdrop-blur-md transition-all duration-75 animate-fadeIn"
        >
          {/* Custom magical falling background stars/particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 8}s`,
                  animationDuration: `${5 + Math.random() * 8}s`,
                  transform: `scale(${0.3 + Math.random() * 0.7})`
                }}
                className="absolute w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee] animate-floatDown"
              />
            ))}
          </div>

          {/* Majestic card container */}
          <div
            className="relative bg-gradient-to-b from-slate-900/90 to-[#050912]/95 border border-cyan-500/25 p-6 sm:p-8 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.3)] max-w-md w-full flex flex-col items-center text-center space-y-6 select-none animate-scaleUp"
          >
            {/* Elegant glowing background circle */}
            <div className="absolute -top-12 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-cyan-500/15 blur-xl pointer-events-none" />

            {/* Picture in an artistic circular stellar frame */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-gradient-to-tr from-cyan-400 via-amber-200 to-indigo-500 shadow-[0_0_30px_rgba(6,182,212,0.4)] overflow-hidden">
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-950">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600"
                  alt="Rocío"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover grayscale-[10%]"
                />
              </div>
            </div>

            {/* Content segment */}
            <div className="flex flex-col space-y-4">
              <h1 className="font-cinzel text-xl sm:text-2xl font-light tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-amber-100 to-cyan-200 drop-shadow">
                ROCÍO
              </h1>

              <p className="font-caveat text-xl sm:text-2xl text-cyan-100/95 leading-relaxed max-w-[320px] mx-auto">
                "En un universo lleno de estrellas, tú eres la más hermosa de todas."
              </p>

              <div className="h-[1px] w-1/2 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent mx-auto my-1" />

              <h2 className="font-cinzel text-2xl sm:text-3xl font-semibold tracking-wider text-amber-200 animate-pulse drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]">
                ¡Feliz Cumpleaños, Rocío! 🎂💖
              </h2>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
              <button
                onClick={() => {
                  // Simply close the modal and let Rocío gaze at her stunning full-bloom interactive universe
                  setIsCentralStarClicked(false);
                  playCelestialChime(2);
                }}
                className="w-full font-sans text-[11px] uppercase tracking-[0.2em] text-cyan-200 hover:text-white border border-cyan-400/30 hover:border-cyan-400 py-3 rounded-full bg-cyan-950/20 hover:bg-cyan-900/30 transition-all duration-300 cursor-pointer text-center font-medium"
              >
                Contemplar Flor
              </button>

              <button
                onClick={() => {
                  // Fully reload/restart the page to experience the beautiful celestial animation sequence again!
                  window.location.reload();
                }}
                className="w-full font-sans text-[11px] uppercase tracking-[0.2em] text-slate-900 bg-amber-200 hover:bg-amber-100 py-3 rounded-full transition-all duration-300 cursor-pointer text-center font-semibold shadow-[0_4px_15px_rgba(251,191,36,0.2)] active:scale-95"
              >
                Revivir Viaje
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
