import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.querySelector("#vivid-canvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const previewMode = new URLSearchParams(window.location.search).has("preview");

if (previewMode) document.body.classList.add("preview-mode");

try {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101010);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  camera.position.set(0, 0.15, 12.5);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.025).texture;
  pmrem.dispose();

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 15),
    new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;

        float ring(vec2 p, float radius, float width) {
          return exp(-pow((length(p) - radius) / width, 2.0));
        }

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 p = (vUv - 0.5) * vec2(1.0, 1.55);
          float drift = sin(uTime * 0.18) * 0.018;
          float red = ring(p + vec2(0.045 + drift, -0.02), 0.41, 0.055);
          float cyan = ring(p - vec2(0.04, 0.015 + drift), 0.405, 0.05);
          float lime = ring(p + vec2(-0.005, 0.038), 0.39, 0.043);
          float halo = exp(-length(p * vec2(0.86, 1.0)) * 3.35);
          float grain = (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.012;
          vec3 color = vec3(0.013, 0.014, 0.015);
          color += vec3(0.045, 0.055, 0.065) * halo;
          color += vec3(0.22, 0.012, 0.018) * red * 0.24;
          color += vec3(0.008, 0.11, 0.19) * cyan * 0.28;
          color += vec3(0.01, 0.12, 0.045) * lime * 0.16;
          color += grain;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );
  background.position.z = -7;
  scene.add(background);

  const artifact = new THREE.Group();
  scene.add(artifact);

  const shellGeometry = new RoundedBoxGeometry(1.56, 1.56, 1.56, 6, 0.065);
  const coreGeometry = new RoundedBoxGeometry(1.43, 1.43, 1.43, 5, 0.04);
  const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.58, 1.58, 1.58), 18);

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb9c7cb,
    metalness: 0.02,
    roughness: 0.055,
    transmission: 0.84,
    thickness: 1.65,
    ior: 1.44,
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    attenuationColor: new THREE.Color(0x27323a),
    attenuationDistance: 2.4,
    envMapIntensity: 1.75,
    transparent: true,
    opacity: 0.96,
  });

  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    metalness: 0.54,
    roughness: 0.24,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.08,
  });

  const edgeMaterials = [
    new THREE.LineBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending }),
    new THREE.LineBasicMaterial({ color: 0x2a7fff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }),
    new THREE.LineBasicMaterial({ color: 0x2aff2a, transparent: true, opacity: 0.54, blending: THREE.AdditiveBlending }),
    new THREE.LineBasicMaterial({ color: 0xfffdf9, transparent: true, opacity: 0.74, blending: THREE.AdditiveBlending }),
  ];

  const layout = [
    [-0.79, 1.65, 0.02],
    [0.79, 1.65, 0],
    [0.79, 0.07, 0.02],
    [-0.79, -1.51, 0],
    [0.79, -1.51, 0.03],
  ];
  const pieces = [];

  for (let index = 0; index < layout.length; index += 1) {
    const piece = new THREE.Group();
    const shell = new THREE.Mesh(shellGeometry, shellMaterial.clone());
    const core = new THREE.Mesh(coreGeometry, coreMaterial.clone());
    core.scale.setScalar(0.91);
    piece.add(core, shell);

    const offsets = [-0.032, 0.034, 0.0, 0.0];
    for (let edgeIndex = 0; edgeIndex < edgeMaterials.length; edgeIndex += 1) {
      const edges = new THREE.LineSegments(outlineGeometry, edgeMaterials[edgeIndex]);
      edges.position.x = offsets[edgeIndex];
      edges.position.y = edgeIndex === 2 ? 0.026 : edgeIndex === 3 ? -0.006 : 0;
      edges.position.z = edgeIndex === 3 ? 0.018 : 0;
      piece.add(edges);
    }

    piece.position.set(...layout[index]);
    piece.userData.home = piece.position.clone();
    piece.userData.phase = index * 0.83;
    artifact.add(piece);
    pieces.push(piece);
  }

  artifact.rotation.set(-0.22, -0.58, 0.23);
  artifact.scale.setScalar(0.9);

  const whiteKey = new THREE.RectAreaLight(0xfffdf9, 12, 4.8, 2.1);
  whiteKey.position.set(-4.6, 5.2, 4.2);
  whiteKey.lookAt(0, 0.2, 0);
  scene.add(whiteKey);

  const redLight = new THREE.PointLight(0xff2a2a, 11, 13, 2);
  redLight.position.set(-4.2, -0.4, 2.8);
  const cyanLight = new THREE.PointLight(0x2a7fff, 13, 13, 2);
  cyanLight.position.set(4.4, 0.3, 3.1);
  const limeLight = new THREE.PointLight(0x2aff2a, 5.5, 10, 2);
  limeLight.position.set(0.4, 4.7, 1.4);
  scene.add(redLight, cyanLight, limeLight);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.72, 0.7, 0.18);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  window.addEventListener("pointermove", (event) => {
    pointerTarget.set(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
  }, { passive: true });

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize, { passive: true });
  resize();

  const clock = new THREE.Clock();
  const render = () => {
    const elapsed = clock.getElapsedTime();
    const motionTime = reducedMotion ? 2.4 : elapsed;
    pointer.lerp(pointerTarget, 0.035);

    artifact.rotation.x = -0.22 + Math.sin(motionTime * 0.23) * 0.08 - pointer.y * 0.16;
    artifact.rotation.y = -0.58 + Math.sin(motionTime * 0.2) * 0.28 + pointer.x * 0.3;
    artifact.rotation.z = 0.23 + Math.sin(motionTime * 0.16) * 0.055;
    artifact.position.y = Math.sin(motionTime * 0.38) * 0.07;

    for (const piece of pieces) {
      const { home, phase } = piece.userData;
      piece.position.x = home.x + Math.sin(motionTime * 0.38 + phase) * 0.025;
      piece.position.y = home.y + Math.cos(motionTime * 0.34 + phase) * 0.03;
      piece.position.z = home.z + Math.sin(motionTime * 0.3 + phase) * 0.045;
      piece.rotation.x = Math.sin(motionTime * 0.22 + phase) * 0.022;
      piece.rotation.y = Math.cos(motionTime * 0.24 + phase) * 0.026;
    }

    background.material.uniforms.uTime.value = motionTime;
    redLight.intensity = 10.5 + Math.sin(motionTime * 0.72) * 1.2;
    cyanLight.intensity = 12.5 + Math.cos(motionTime * 0.66) * 1.1;
    composer.render();
    requestAnimationFrame(render);
  };
  render();
} catch (error) {
  console.error(error);
  document.body.classList.add("webgl-failed");
}
