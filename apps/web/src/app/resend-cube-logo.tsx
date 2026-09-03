"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { MODEL_ICON_ENTRIES } from "./model-icons";

export function ResendCubeLogo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer | undefined;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let intersectionObserver: IntersectionObserver | undefined;
    let environmentTarget: THREE.WebGLRenderTarget | undefined;
    let disposed = false;
    let isVisible = true;
    let pageVisible = document.visibilityState !== "hidden";
    const iconTextures: THREE.CanvasTexture[] = [];

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
      camera.position.set(0, 0.06, 7.2);

      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      environmentTarget = pmrem.fromScene(room, 0.035);
      scene.environment = environmentTarget.texture;
      room.dispose();
      pmrem.dispose();

      const cube = new THREE.Group();
      const geometry = new RoundedBoxGeometry(1.16, 1.16, 1.16, 4, 0.105);
      const tileColors = [0xffffff, 0xf8f9fa, 0xf1f3f5, 0xfafafa] as const;
      const iconColors = [
        ["#008f6a", "#18b887"],
        ["#bd4e2f", "#de714d"],
        ["#2f6ff2", "#8745c6", "#d43e72"],
        ["#d91f5f", "#ef4f32"],
        ["#244cf0", "#0089ef"],
        ["#5145cf", "#812cdb"],
        ["#1264d6", "#009abb"],
        ["#007f91", "#21a25e"],
      ] as const;
      const materials = MODEL_ICON_ENTRIES.map((_, index) => {
        const tileColor = tileColors[index % tileColors.length] ?? tileColors[0];
        return new THREE.MeshPhysicalMaterial({
          color: tileColor,
          metalness: 0.04,
          roughness: 0.3,
          clearcoat: 0.72,
          clearcoatRoughness: 0.12,
          envMapIntensity: 0.72,
        });
      });
      const cubelets: THREE.Mesh[] = [];
      const spacing = 1.27;
      const coordinates = [-0.5, 0.5] as const;
      let cubeletIndex = 0;

      for (const z of coordinates) {
        for (const y of [...coordinates].reverse()) {
          for (const x of coordinates) {
            const material = materials[cubeletIndex];
            if (!material) continue;
            const mesh = new THREE.Mesh(geometry, material);
            const base = new THREE.Vector3(x * spacing, y * spacing, z * spacing);
            mesh.position.copy(base);
            mesh.userData.base = base;
            mesh.userData.phase = cubeletIndex * 0.73;
            cube.add(mesh);
            cubelets.push(mesh);
            cubeletIndex += 1;
          }
        }
      }

      const imageLoader = new THREE.ImageLoader();
      const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      MODEL_ICON_ENTRIES.forEach(([, path], index) => {
        imageLoader.load(path, (image) => {
          if (disposed) return;

          const tile = document.createElement("canvas");
          tile.width = 512;
          tile.height = 512;
          const context = tile.getContext("2d");
          if (!context) return;

          const tileColor = tileColors[index % tileColors.length] ?? tileColors[0];
          const baseColor = `#${tileColor.toString(16).padStart(6, "0")}`;
          context.fillStyle = baseColor;
          context.fillRect(0, 0, tile.width, tile.height);

          const iconLayer = document.createElement("canvas");
          iconLayer.width = tile.width;
          iconLayer.height = tile.height;
          const iconContext = iconLayer.getContext("2d");
          if (!iconContext) return;

          iconContext.drawImage(image, 60, 60, 392, 392);
          iconContext.globalCompositeOperation = "source-in";
          const colors = iconColors[index] ?? iconColors[0];
          const iconGradient = iconContext.createLinearGradient(92, 92, 420, 420);
          colors.forEach((color, colorIndex) => {
            iconGradient.addColorStop(colorIndex / Math.max(1, colors.length - 1), color);
          });
          iconContext.fillStyle = iconGradient;
          iconContext.fillRect(0, 0, iconLayer.width, iconLayer.height);
          context.drawImage(iconLayer, 0, 0);

          const texture = new THREE.CanvasTexture(tile);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAnisotropy;
          const emissiveTexture = new THREE.CanvasTexture(iconLayer);
          emissiveTexture.colorSpace = THREE.SRGBColorSpace;
          emissiveTexture.anisotropy = maxAnisotropy;
          iconTextures.push(texture, emissiveTexture);
          const material = materials[index];
          if (!material) return;
          material.map = texture;
          material.emissive.set(0xffffff);
          material.emissiveMap = emissiveTexture;
          material.emissiveIntensity = 0.46;
          material.needsUpdate = true;
        });
      });

      cube.rotation.set(-0.4, 0.58, -0.07);
      scene.add(cube);

      const key = new THREE.RectAreaLight(0xffffff, 7.2, 4.5, 1.2);
      key.position.set(-3.6, 4.8, 4.2);
      key.lookAt(0, 0, 0);
      scene.add(key);

      const rim = new THREE.RectAreaLight(0xb9d5ff, 3.4, 1.8, 4.4);
      rim.position.set(4.2, 1.1, -1.3);
      rim.lookAt(0, 0, 0);
      scene.add(rim);

      const sweep = new THREE.PointLight(0xeaf3ff, 5.2, 11, 1.8);
      sweep.position.set(-3.2, 2.8, 4.3);
      scene.add(sweep);

      const clock = new THREE.Clock();

      const resize = () => {
        if (!renderer) return;
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };

      const renderFrame = () => {
        animationFrame = 0;
        if (disposed || !renderer || !isVisible || !pageVisible) return;

        const elapsed = clock.getElapsedTime();
        const motionTime = reducedMotion ? 2.4 : elapsed;
        cube.rotation.x = -0.4 + Math.sin(motionTime * 0.24) * 0.055;
        cube.rotation.y = 0.58 + motionTime * 0.28;
        cube.rotation.z = -0.07 + Math.sin(motionTime * 0.18) * 0.025;
        cube.position.y = Math.sin(motionTime * 0.52) * 0.045;

        for (const mesh of cubelets) {
          const base = mesh.userData.base as THREE.Vector3;
          const phase = mesh.userData.phase as number;
          const pulse = Math.sin(motionTime * 0.56 + phase) * 0.014;
          mesh.position.set(base.x * (1 + pulse), base.y * (1 + pulse), base.z * (1 + pulse));
          mesh.rotation.x = Math.sin(motionTime * 0.22 + phase) * 0.006;
          mesh.rotation.y = Math.cos(motionTime * 0.2 + phase) * 0.006;
        }

        sweep.position.x = Math.sin(motionTime * 0.45) * 4.2;

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

      intersectionObserver = new IntersectionObserver(([entry]) => {
        isVisible = entry?.isIntersecting ?? true;
        if (isVisible) startRendering();
        else stopRendering();
      });
      intersectionObserver.observe(canvas);

      document.addEventListener("visibilitychange", handleVisibility);
      resize();
      startRendering();

      return () => {
        disposed = true;
        stopRendering();
        document.removeEventListener("visibilitychange", handleVisibility);
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        geometry.dispose();
        iconTextures.forEach((texture) => texture.dispose());
        materials.forEach((material) => material.dispose());
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
    <span className="priceai-cube-logo" aria-hidden="true">
      {!failed && <canvas ref={canvasRef} className="priceai-cube-logo-canvas" />}
      {failed && (
        <span className="priceai-cube-logo-fallback">
          {MODEL_ICON_ENTRIES.slice(0, 4).map(([name, path]) => <img src={path} alt="" key={name} />)}
        </span>
      )}
    </span>
  );
}
