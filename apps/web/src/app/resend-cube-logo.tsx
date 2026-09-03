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
    let isEngaged = false;
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
      renderer.toneMappingExposure = 1.02;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
      camera.position.set(0, 0.06, 6.95);

      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      environmentTarget = pmrem.fromScene(room, 0.035);
      scene.environment = environmentTarget.texture;
      room.dispose();
      pmrem.dispose();

      const cube = new THREE.Group();
      const geometry = new RoundedBoxGeometry(1.16, 1.16, 1.16, 4, 0.072);
      const tileColors = [0xe7ecef, 0xdce3e7, 0xf0f3f4, 0xd5dde2] as const;
      const createCubeMaterial = (color: number) => new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.48,
        roughness: 0.3,
        clearcoat: 0.16,
        clearcoatRoughness: 0.34,
        envMapIntensity: 1.08,
      });
      const iconMaterials = MODEL_ICON_ENTRIES.map(() => {
        return new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0.2,
          roughness: 0.34,
          clearcoat: 0.12,
          clearcoatRoughness: 0.38,
          envMapIntensity: 0.78,
        });
      });
      const neutralMaterials = tileColors.map((tileColor) => createCubeMaterial(tileColor));
      const cubelets: THREE.Mesh[] = [];
      const spacing = 1.27;
      const coordinates = [-0.5, 0.5] as const;
      const iconFacesByCubelet: Record<number, Array<[face: number, icon: number]>> = {
        0: [[2, 6]],
        1: [[0, 4], [2, 7]],
        3: [[0, 5]],
        4: [[4, 0]],
        5: [[4, 1]],
        6: [[4, 2]],
        7: [[4, 3]],
      };
      let cubeletIndex = 0;

      for (const z of coordinates) {
        for (const y of [...coordinates].reverse()) {
          for (const x of coordinates) {
            const neutralMaterial = neutralMaterials[cubeletIndex % neutralMaterials.length];
            if (!neutralMaterial) continue;
            const faceMaterials: THREE.Material[] = Array.from({ length: 6 }, () => neutralMaterial);
            for (const [faceIndex, iconIndex] of iconFacesByCubelet[cubeletIndex] ?? []) {
              const iconMaterial = iconMaterials[iconIndex];
              if (iconMaterial) faceMaterials[faceIndex] = iconMaterial;
            }
            const mesh = new THREE.Mesh(geometry, faceMaterials);
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
      MODEL_ICON_ENTRIES.forEach(([name, path], index) => {
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

          if (name === "kimi") {
            iconContext.fillStyle = "#111318";
            iconContext.beginPath();
            iconContext.roundRect(58, 58, 396, 396, 92);
            iconContext.fill();
          }
          iconContext.drawImage(image, 60, 60, 392, 392);
          context.drawImage(iconLayer, 0, 0);

          const texture = new THREE.CanvasTexture(tile);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAnisotropy;
          iconTextures.push(texture);
          const material = iconMaterials[index];
          if (!material) return;
          material.map = texture;
          material.needsUpdate = true;
        });
      });

      cube.rotation.set(-0.4, 0.58, -0.07);
      scene.add(cube);

      const key = new THREE.RectAreaLight(0xffffff, 4.8, 4.5, 1.2);
      key.position.set(-3.6, 4.8, 4.2);
      key.lookAt(0, 0, 0);
      scene.add(key);

      const rim = new THREE.RectAreaLight(0xb9d5ff, 2.25, 1.8, 4.4);
      rim.position.set(4.2, 1.1, -1.3);
      rim.lookAt(0, 0, 0);
      scene.add(rim);

      const sweep = new THREE.PointLight(0xeaf3ff, 3.1, 11, 1.8);
      sweep.position.set(-3.2, 2.8, 4.3);
      scene.add(sweep);

      const clock = new THREE.Clock();
      let motionTime = reducedMotion ? 2.4 : 0;
      let yawRotation = 0.58;
      let engagement = 0;
      const brandLink = canvas.closest<HTMLElement>(".priceai-brand");

      const engage = () => { isEngaged = true; };
      const disengage = () => { isEngaged = false; };

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

        const delta = reducedMotion ? 0 : Math.min(clock.getDelta(), 0.05);
        engagement += ((isEngaged ? 1 : 0) - engagement) * Math.min(1, delta * 4.5);
        motionTime += delta * (1 + engagement * 0.32);
        yawRotation += delta * (0.15 + engagement * 0.07);

        cube.rotation.x = -0.4 + Math.sin(motionTime * 0.36) * 0.065;
        cube.rotation.y = yawRotation + Math.sin(motionTime * 0.48) * 0.035;
        cube.rotation.z = -0.07 + Math.sin(motionTime * 0.27) * 0.028;
        cube.position.y = Math.sin(motionTime * 0.62) * 0.038;

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
        brandLink?.removeEventListener("pointerenter", engage);
        brandLink?.removeEventListener("pointerleave", disengage);
        brandLink?.removeEventListener("focus", engage);
        brandLink?.removeEventListener("blur", disengage);
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        geometry.dispose();
        iconTextures.forEach((texture) => texture.dispose());
        iconMaterials.forEach((material) => material.dispose());
        neutralMaterials.forEach((material) => material.dispose());
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
