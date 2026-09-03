import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.querySelector("#resend-canvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const previewMode = new URLSearchParams(window.location.search).has("preview");

if (previewMode) document.body.classList.add("preview-mode");

try {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  camera.position.set(0, 0.25, 12.2);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  pmrem.dispose();

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 14),
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
        void main() {
          vec2 p = vUv - 0.5;
          float vignette = 1.0 - smoothstep(0.12, 0.78, length(p * vec2(1.0, 1.25)));
          float sweepY = 0.31 + p.x * 0.12 + sin(uTime * 0.22) * 0.022;
          float beam = exp(-pow((vUv.y - sweepY) * 24.0, 2.0));
          float halo = exp(-length(p * vec2(0.8, 1.2)) * 5.2);
          vec3 color = vec3(0.0015);
          color += vec3(0.035, 0.038, 0.042) * halo * vignette;
          color += vec3(0.09, 0.085, 0.072) * beam * 0.32;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );
  backdrop.position.z = -5;
  scene.add(backdrop);

  const cube = new THREE.Group();
  scene.add(cube);

  const geometry = new RoundedBoxGeometry(1.12, 1.12, 1.12, 5, 0.095);
  const materials = [
    new THREE.MeshPhysicalMaterial({
      color: 0x020304,
      metalness: 0.9,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
      envMapIntensity: 1.42,
    }),
    new THREE.MeshPhysicalMaterial({
      color: 0x050607,
      metalness: 0.82,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.2,
    }),
    new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      metalness: 0.94,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.055,
      envMapIntensity: 1.55,
    }),
  ];

  const cubelets = [];
  const spacing = 1.2;
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const mesh = new THREE.Mesh(geometry, materials[(x + y * 2 + z * 3 + 12) % materials.length]);
        const base = new THREE.Vector3(x * spacing, y * spacing, z * spacing);
        mesh.position.copy(base);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.base = base;
        mesh.userData.phase = (x + 2) * 0.71 + (y + 2) * 1.17 + (z + 2) * 0.43;
        cube.add(mesh);
        cubelets.push(mesh);
      }
    }
  }

  cube.rotation.set(-0.34, 0.56, -0.055);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 15),
    new THREE.MeshStandardMaterial({
      color: 0x010101,
      metalness: 0.15,
      roughness: 0.72,
      transparent: true,
      opacity: 0.88,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -3.05, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const key = new THREE.RectAreaLight(0xffffff, 8.5, 5.8, 1.3);
  key.position.set(-3.8, 5.8, 4.6);
  key.lookAt(0, 0, 0);
  scene.add(key);

  const rim = new THREE.RectAreaLight(0xc9d2dc, 5.8, 2.2, 5.5);
  rim.position.set(5.2, 1.2, -1.4);
  rim.lookAt(0, 0.2, 0);
  scene.add(rim);

  const spot = new THREE.SpotLight(0xffe9c4, 16, 24, Math.PI / 7, 0.75, 1.6);
  spot.position.set(-5, 7, 6);
  spot.target.position.set(0, -0.7, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  scene.add(spot, spot.target);

  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  window.addEventListener("pointermove", (event) => {
    pointerTarget.set(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
  }, { passive: true });

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize, { passive: true });
  resize();

  const clock = new THREE.Clock();
  const render = () => {
    const elapsed = clock.getElapsedTime();
    const motionTime = reducedMotion ? 1.7 : elapsed;
    pointer.lerp(pointerTarget, 0.035);

    cube.rotation.x = -0.34 + Math.sin(motionTime * 0.24) * 0.075 - pointer.y * 0.17;
    cube.rotation.y = 0.56 + motionTime * 0.17 + pointer.x * 0.26;
    cube.rotation.z = -0.055 + Math.sin(motionTime * 0.18) * 0.035;
    cube.position.y = Math.sin(motionTime * 0.58) * 0.08;

    for (const mesh of cubelets) {
      const { base, phase } = mesh.userData;
      const pulse = Math.sin(motionTime * 0.62 + phase) * 0.018;
      mesh.position.set(base.x * (1 + pulse), base.y * (1 + pulse), base.z * (1 + pulse));
      mesh.rotation.x = Math.sin(motionTime * 0.27 + phase) * 0.008;
      mesh.rotation.y = Math.cos(motionTime * 0.24 + phase) * 0.008;
    }

    backdrop.material.uniforms.uTime.value = motionTime;
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };
  render();
} catch (error) {
  console.error(error);
  document.body.classList.add("webgl-failed");
}
