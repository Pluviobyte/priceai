"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { IceCubeLogoProps } from "./ice-cube-logo";
import "./ice-cube-logo.css";

// The poster is one frame of the live cube. Every page shows it at once; three.js (about
// 150 KB compressed) loads only on a wide screen with a fine pointer, after the page has
// finished loading and the browser is idle, so the logo never delays the price table.
function CubePoster({ size }: IceCubeLogoProps) {
  return (
    <span className="priceai-ice-cube-logo" aria-hidden="true" style={size ? { width: size, height: size, flexBasis: size } : undefined}>
      <span className="priceai-ice-cube-logo-glow" />
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 48px brand image needs no optimisation pass. */}
      <img className="priceai-ice-cube-logo-poster" src="/brand/cube-poster.png" alt="" width={size ?? 48} height={size ?? 48} decoding="async" />
    </span>
  );
}

const LiveIceCubeLogo = dynamic(() => import("./ice-cube-logo").then((module) => module.IceCubeLogo), {
  ssr: false,
  loading: () => <CubePoster />,
});

export function LazyIceCubeLogo({ size }: IceCubeLogoProps) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    const roomy = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (!roomy || reducedMotion || saveData) return;
    let idleHandle = 0;
    const start = () => {
      const whenIdle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1_500));
      idleHandle = whenIdle(() => setLive(true), { timeout: 5_000 });
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (idleHandle) (window.cancelIdleCallback ?? window.clearTimeout)(idleHandle);
    };
  }, []);
  const props = size === undefined ? {} : { size };
  return live ? <LiveIceCubeLogo {...props} /> : <CubePoster {...props} />;
}

// The rollback variant also draws with three.js; loaded on demand, it stays out of every page's bundle.
export const ClassicCubeLogo = dynamic(() => import("../resend-cube-logo").then((module) => module.ResendCubeLogo), { ssr: false });
