"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { MODEL_ICON_ENTRIES } from "../model-icons";
import "./ice-cube-logo.css";

type Axis = "x" | "y" | "z";

const STUDIO_HDR_URL = "/env/empty_warehouse_01_1k.hdr";

const SHELL_SIZE = 1.16;
const SHELL_HALF = SHELL_SIZE * 0.5;
const CORE_SIZE = 0.5;
const DECAL_SIZE = 0.92;
const DECAL_LIFT = 0.035;

const FACE_DECALS: Array<{ face: number; axis: Axis; sign: 1 | -1; rotY: number; rotX: number }> = [
  { face: 0, axis: "x", sign: 1, rotY: Math.PI / 2, rotX: 0 },
  { face: 1, axis: "x", sign: -1, rotY: -Math.PI / 2, rotX: 0 },
  { face: 2, axis: "y", sign: 1, rotY: 0, rotX: -Math.PI / 2 },
  { face: 3, axis: "y", sign: -1, rotY: 0, rotX: Math.PI / 2 },
  { face: 4, axis: "z", sign: 1, rotY: 0, rotX: 0 },
  { face: 5, axis: "z", sign: -1, rotY: Math.PI, rotX: 0 },
];

function shellGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xe4f3fb,
    metalness: 0,
    roughness: 0.12,
    transmission: 0.92,
    thickness: 0.32,
    ior: 1.5,
    attenuationColor: new THREE.Color(0x7ec4ee),
    attenuationDistance: 1.15,
    clearcoat: 1,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.62,
    specularIntensity: 0.55,
    specularColor: new THREE.Color(0xecf7ff),
    transparent: false,
    opacity: 1,
    dispersion: 0.04,
  });
}

function iceCoreMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x5aaed8,
    metalness: 0,
    roughness: 0.48,
    transmission: 0,
    ior: 1.33,
    clearcoat: 0,
    envMapIntensity: 0,
    specularIntensity: 0.12,
    emissive: new THREE.Color(0x2f86c4),
    emissiveIntensity: 0.18,
  });
}

function decalMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    toneMapped: false,
  });
}

function easeOutBack(t: number) {
  const c1 = 0.38;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function snapCoord(value: number, half: number) {
  return value >= 0 ? half : -half;
}

function snapQuaternion(quaternion: THREE.Quaternion) {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  const snap = (angle: number) => Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  euler.x = snap(euler.x);
  euler.y = snap(euler.y);
  euler.z = snap(euler.z);
  quaternion.setFromEuler(euler);
}

function isDarkTheme() {
  return document.documentElement.dataset.theme === "dark";
}

function iceNoise(x: number, y: number, z: number, seed: number) {
  let value = 0;
  let amplitude = 0.52;
  let frequency = 2.35;
  for (let octave = 0; octave < 4; octave += 1) {
    value += amplitude
      * Math.sin(x * frequency + seed)
      * Math.sin(y * frequency * 1.17 + seed * 1.7)
      * Math.sin(z * frequency * 0.89 + seed * 2.3);
    amplitude *= 0.48;
    frequency *= 1.82;
  }
  return value;
}

function meltIceGeometry(geometry: THREE.BufferGeometry, size: number, amount: number, seed: number) {
  const position = geometry.getAttribute("position");
  if (!position) return geometry;
  const half = size * 0.5;
  const vertex = new THREE.Vector3();
  const direction = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const edge = Math.min(1, (
      (Math.abs(vertex.x) / half) * (Math.abs(vertex.y) / half)
      + (Math.abs(vertex.y) / half) * (Math.abs(vertex.z) / half)
      + (Math.abs(vertex.z) / half) * (Math.abs(vertex.x) / half)
    ) * 0.92);
    direction.copy(vertex);
    if (direction.lengthSq() < 1e-6) continue;
    direction.normalize();
    const wave = iceNoise(vertex.x, vertex.y, vertex.z, seed);
    vertex.addScaledVector(direction, amount * (0.32 + 0.68 * edge) * wave);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function drawingPixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  const zoom = window.visualViewport?.scale ?? 1;
  return Math.min(Math.max(dpr * zoom, 1), 4);
}

function createCrystalEnvironment(renderer: THREE.WebGLRenderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x7eb8d8);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0.12);
  pmrem.dispose();
  return target;
}

function assignFaceIcons(iconCount: number) {
  const faces = Array.from({ length: 8 }, () => Array.from({ length: 6 }, () => -1));
  const groups: Array<[cubelets: number[], face: number]> = [
    [[1, 3, 5, 7], 0],
    [[0, 2, 4, 6], 1],
    [[0, 1, 4, 5], 2],
    [[2, 3, 6, 7], 3],
    [[4, 5, 6, 7], 4],
    [[0, 1, 2, 3], 5],
  ];
  const usage = Array.from({ length: iconCount }, () => 0);

  const takeIcon = (blocked: Set<number>) => {
    let best = 0;
    let bestUsage = Number.POSITIVE_INFINITY;
    for (let icon = 0; icon < iconCount; icon += 1) {
      if (blocked.has(icon)) continue;
      const used = usage[icon] ?? 0;
      if (used < bestUsage) {
        best = icon;
        bestUsage = used;
      }
    }
    if (bestUsage === Number.POSITIVE_INFINITY) {
      for (let icon = 0; icon < iconCount; icon += 1) {
        const used = usage[icon] ?? 0;
        if (used < bestUsage) {
          best = icon;
          bestUsage = used;
        }
      }
    }
    usage[best] = (usage[best] ?? 0) + 1;
    return best;
  };

  for (const [cubelets, face] of groups) {
    const usedOnFace = new Set<number>();
    for (const cubelet of cubelets) {
      const cubeletFaces = faces[cubelet];
      if (!cubeletFaces) continue;
      const usedOnCubelet = new Set(cubeletFaces.filter((icon) => icon >= 0));
      const icon = takeIcon(new Set([...usedOnFace, ...usedOnCubelet]));
      cubeletFaces[face] = icon;
      usedOnFace.add(icon);
    }
  }

  return faces;
}

export type IceCubeLogoProps = {
  size?: number;
};

export function IceCubeLogo({ size }: IceCubeLogoProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer | undefined;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let intersectionObserver: IntersectionObserver | undefined;
    let themeObserver: MutationObserver | undefined;
    let environmentTarget: THREE.WebGLRenderTarget | undefined;
    let disposed = false;
    let isVisible = true;
    let pageVisible = document.visibilityState !== "hidden";
    let isEngaged = false;
    const iconTextures: THREE.CanvasTexture[] = [];

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(drawingPixelRatio());
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      const applyTheme = () => {
        if (!renderer) return;
        renderer.toneMappingExposure = isDarkTheme() ? 0.98 : 0.88;
      };

      const scene = new THREE.Scene();
      const frustum = 2.82;
      const camera = new THREE.OrthographicCamera(-frustum, frustum, frustum, -frustum, 0.1, 30);
      camera.position.set(0, 0.42, 8);
      camera.lookAt(0, 0, 0);
      applyTheme();

      environmentTarget = createCrystalEnvironment(renderer);
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 0.55;

      const cube = new THREE.Group();
      const iceGeometries: THREE.BufferGeometry[] = [];
      const decalGeometry = new THREE.PlaneGeometry(DECAL_SIZE, DECAL_SIZE);
      const shellMaterial = shellGlassMaterial();
      const coreMaterial = iceCoreMaterial();
      const iconMaterials = MODEL_ICON_ENTRIES.map(() => decalMaterial());

      new RGBELoader().load(STUDIO_HDR_URL, (hdr) => {
        if (disposed || !renderer) {
          hdr.dispose();
          return;
        }
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const envScene = new THREE.Scene();
        envScene.background = hdr;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const studio = pmrem.fromScene(envScene, 0.08);
        hdr.dispose();
        pmrem.dispose();
        environmentTarget?.dispose();
        environmentTarget = studio;
        scene.environment = studio.texture;
        scene.environmentIntensity = 0.5;
        shellMaterial.envMap = studio.texture;
        shellMaterial.envMapIntensity = 0.62;
        shellMaterial.needsUpdate = true;
        coreMaterial.envMapIntensity = 0;
        renderer.render(scene, camera);
      });
      const cubelets: THREE.Group[] = [];
      const spacing = 1.36;
      const half = spacing * 0.5;
      const coordinates = [-0.5, 0.5] as const;
      const faceIcons = assignFaceIcons(MODEL_ICON_ENTRIES.length);
      let cubeletIndex = 0;

      for (const z of coordinates) {
        for (const y of [...coordinates].reverse()) {
          for (const x of coordinates) {
            const cubelet = new THREE.Group();
            const cubeletIcons = faceIcons[cubeletIndex] ?? [];
            const seed = 1.7 + cubeletIndex * 2.13;
            const shellGeometry = meltIceGeometry(
              new RoundedBoxGeometry(SHELL_SIZE, SHELL_SIZE, SHELL_SIZE, 8, 0.055),
              SHELL_SIZE,
              0.02,
              seed,
            );
            const coreGeometry = meltIceGeometry(
              new RoundedBoxGeometry(CORE_SIZE, CORE_SIZE, CORE_SIZE, 8, 0.11),
              CORE_SIZE,
              0.032,
              seed + 0.37,
            );
            iceGeometries.push(shellGeometry, coreGeometry);
            cubelet.add(new THREE.Mesh(coreGeometry, coreMaterial));
            cubelet.add(new THREE.Mesh(shellGeometry, shellMaterial));

            for (const layout of FACE_DECALS) {
              const coord = layout.axis === "x" ? x : layout.axis === "y" ? y : z;
              if (coord * layout.sign <= 0) continue;
              const iconIndex = cubeletIcons[layout.face] ?? -1;
              const material = iconIndex >= 0 ? iconMaterials[iconIndex] : undefined;
              if (!material) continue;
              const decal = new THREE.Mesh(decalGeometry, material);
              decal.position[layout.axis] = layout.sign * (SHELL_HALF + DECAL_LIFT);
              decal.rotation.set(layout.rotX, layout.rotY, 0);
              cubelet.add(decal);
            }

            const base = new THREE.Vector3(x * spacing, y * spacing, z * spacing);
            cubelet.position.copy(base);
            cubelet.userData.base = base;
            cube.add(cubelet);
            cubelets.push(cubelet);
            cubeletIndex += 1;
          }
        }
      }

      const imageLoader = new THREE.ImageLoader();
      const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
      const paintAndRender = () => {
        if (!disposed && renderer) renderer.render(scene, camera);
      };
      MODEL_ICON_ENTRIES.forEach(([name, path], index) => {
        imageLoader.load(path, (image) => {
          if (disposed) return;

          const tile = document.createElement("canvas");
          tile.width = 1024;
          tile.height = 1024;
          const context = tile.getContext("2d");
          if (!context) return;

          context.clearRect(0, 0, tile.width, tile.height);

          if (name === "kimi") {
            context.fillStyle = "rgba(17, 19, 24, 0.88)";
            context.beginPath();
            context.roundRect(152, 152, 720, 720, 160);
            context.fill();
          }
          context.shadowColor = "rgba(6, 18, 36, 0.7)";
          context.shadowBlur = 28;
          context.shadowOffsetY = 4;
          context.drawImage(image, 120, 120, 784, 784);
          context.shadowColor = "transparent";
          context.shadowBlur = 0;
          context.shadowOffsetY = 0;

          const texture = new THREE.CanvasTexture(tile);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAnisotropy;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          iconTextures.push(texture);
          const material = iconMaterials[index];
          if (!material) return;
          material.map = texture;
          material.needsUpdate = true;
          paintAndRender();
        });
      });

      cube.rotation.set(-0.4, 0.52, -0.06);
      cube.scale.setScalar(1);
      scene.add(cube);

      const twistGroup = new THREE.Group();
      let twist: {
        axis: Axis;
        to: number;
        elapsed: number;
        duration: number;
        meshes: THREE.Group[];
      } | null = null;
      let nextTwistIn = reducedMotion ? Number.POSITIVE_INFINITY : 3.4 + Math.random() * 1.8;
      let hoverBurst = 0;

      const coreLight = new THREE.PointLight(0x7ec8ee, 0.22, 3.2, 2.0);
      coreLight.position.set(0, 0, 0);
      cube.add(coreLight);

      const clock = new THREE.Clock();
      let motionTime = reducedMotion ? 2.4 : 0;
      let yawRotation = 0.52;
      let engagement = 0;
      const brandLink = canvas.closest<HTMLElement>(".priceai-brand, .priceai-cube-stage");
      const axes: Axis[] = ["x", "y", "z"];

      const engage = () => {
        isEngaged = true;
        if (!twist && !reducedMotion) nextTwistIn = Math.min(nextTwistIn, 0.32);
      };
      const disengage = () => { isEngaged = false; hoverBurst = 0; };

      const finishTwist = () => {
        if (!twist) return;
        twistGroup.rotation[twist.axis] = twist.to;
        for (const mesh of twist.meshes) {
          cube.attach(mesh);
          mesh.position.set(
            snapCoord(mesh.position.x, half),
            snapCoord(mesh.position.y, half),
            snapCoord(mesh.position.z, half),
          );
          snapQuaternion(mesh.quaternion);
          (mesh.userData.base as THREE.Vector3).copy(mesh.position);
        }
        cube.remove(twistGroup);
        twistGroup.rotation.set(0, 0, 0);
        twist = null;
      };

      const startTwist = () => {
        if (twist || reducedMotion) return;
        const axis = axes[Math.floor(Math.random() * axes.length)];
        if (!axis) return;
        const layerSign = Math.random() < 0.5 ? 1 : -1;
        const direction = Math.random() < 0.5 ? 1 : -1;
        const meshes = cubelets.filter((mesh) => {
          const base = mesh.userData.base as THREE.Vector3;
          return layerSign > 0 ? base[axis] > 0 : base[axis] < 0;
        });
        if (meshes.length !== 4) return;

        twistGroup.rotation.set(0, 0, 0);
        cube.add(twistGroup);
        for (const mesh of meshes) twistGroup.attach(mesh);

        twist = {
          axis,
          to: (Math.PI / 2) * direction,
          elapsed: 0,
          duration: isEngaged ? 0.42 : 0.58,
          meshes,
        };
      };

      const scheduleNextTwist = () => {
        if (reducedMotion) {
          nextTwistIn = Number.POSITIVE_INFINITY;
          return;
        }
        if (isEngaged && hoverBurst < 1) {
          hoverBurst += 1;
          nextTwistIn = 0.38;
          return;
        }
        hoverBurst = 0;
        nextTwistIn = isEngaged ? 1.25 + Math.random() * 0.45 : 3.4 + Math.random() * 1.8;
      };

      const resize = () => {
        if (!renderer) return;
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        renderer.setPixelRatio(drawingPixelRatio());
        renderer.setSize(width, height, false);
        const aspect = width / height;
        if (aspect >= 1) {
          camera.left = -frustum * aspect;
          camera.right = frustum * aspect;
          camera.top = frustum;
          camera.bottom = -frustum;
        } else {
          camera.left = -frustum;
          camera.right = frustum;
          camera.top = frustum / aspect;
          camera.bottom = -frustum / aspect;
        }
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      };

      const renderFrame = () => {
        animationFrame = 0;
        if (disposed || !renderer || !isVisible || !pageVisible) return;

        const delta = reducedMotion ? 0 : Math.min(clock.getDelta(), 0.05);
        engagement += ((isEngaged ? 1 : 0) - engagement) * Math.min(1, delta * 4.5);
        motionTime += delta * (1 + engagement * 0.22);
        yawRotation += delta * (0.2 + engagement * 0.1);
        cube.rotation.x = -0.4;
        cube.rotation.y = yawRotation;
        cube.rotation.z = -0.06;
        cube.position.y = 0;

        if (!reducedMotion) {
          if (twist) {
            twist.elapsed += delta;
            const t = Math.min(1, twist.elapsed / twist.duration);
            twistGroup.rotation[twist.axis] = twist.to * easeOutBack(t);
            if (t >= 1) {
              finishTwist();
              scheduleNextTwist();
            }
          } else {
            nextTwistIn -= delta;
            if (nextTwistIn <= 0) startTwist();
          }
        }

        coreLight.intensity = 0.22 + engagement * 0.08;

        renderer.render(scene, camera);
        if (!reducedMotion) animationFrame = window.requestAnimationFrame(renderFrame);
      };

      const startRendering = () => {
        if (!animationFrame && !disposed && isVisible && pageVisible) {
          animationFrame = window.requestAnimationFrame(renderFrame);
        }
      };

      const stopRendering = () => {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      };

      const handleVisibility = () => {
        pageVisible = document.visibilityState !== "hidden";
        if (pageVisible) startRendering();
        else stopRendering();
      };

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);

      let pixelRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      const handlePixelRatio = () => {
        pixelRatioQuery.removeEventListener("change", handlePixelRatio);
        pixelRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        pixelRatioQuery.addEventListener("change", handlePixelRatio);
        resize();
      };
      pixelRatioQuery.addEventListener("change", handlePixelRatio);
      window.visualViewport?.addEventListener("resize", resize);
      window.addEventListener("resize", resize);

      intersectionObserver = new IntersectionObserver(([entry]) => {
        isVisible = entry?.isIntersecting ?? true;
        if (isVisible) startRendering();
        else stopRendering();
      });
      intersectionObserver.observe(canvas);

      themeObserver = new MutationObserver(applyTheme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      brandLink?.addEventListener("pointerenter", engage);
      brandLink?.addEventListener("pointerleave", disengage);
      brandLink?.addEventListener("focus", engage);
      brandLink?.addEventListener("blur", disengage);
      document.addEventListener("visibilitychange", handleVisibility);
      resize();
      startRendering();

      return () => {
        disposed = true;
        stopRendering();
        document.removeEventListener("visibilitychange", handleVisibility);
        pixelRatioQuery.removeEventListener("change", handlePixelRatio);
        window.visualViewport?.removeEventListener("resize", resize);
        window.removeEventListener("resize", resize);
        brandLink?.removeEventListener("pointerenter", engage);
        brandLink?.removeEventListener("pointerleave", disengage);
        brandLink?.removeEventListener("focus", engage);
        brandLink?.removeEventListener("blur", disengage);
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        themeObserver?.disconnect();
        if (twist) finishTwist();
        iceGeometries.forEach((geometry) => geometry.dispose());
        decalGeometry.dispose();
        shellMaterial.dispose();
        coreMaterial.dispose();
        iconTextures.forEach((texture) => texture.dispose());
        iconMaterials.forEach((material) => material.dispose());
        environmentTarget?.dispose();
        renderer?.dispose();
      };
    } catch (error) {
      console.error("Unable to initialize the PriceAI cube logo", error);
      setFailed(true);
      renderer?.dispose();
      environmentTarget?.dispose();
    }
  }, []);

  return (
    <span
      className="priceai-cube-logo"
      aria-hidden="true"
      style={size ? { width: size, height: size, flexBasis: size } : undefined}
    >
      <span className="priceai-cube-logo-glow" />
      {!failed && <canvas ref={canvasRef} className="priceai-cube-logo-canvas" />}
      {failed && (
        <span className="priceai-cube-logo-fallback">
          {MODEL_ICON_ENTRIES.slice(0, 4).map(([name, path]) => <img src={path} alt="" key={name} />)}
        </span>
      )}
    </span>
  );
}
