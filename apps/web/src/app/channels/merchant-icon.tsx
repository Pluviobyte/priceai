"use client";

import { useState } from "react";
import { merchantIconUrl } from "@/lib/merchant-icon";
import styles from "./channels.module.css";

export function MerchantIcon({ source, name }: { source: string | null; name: string }) {
  const src = merchantIconUrl(source);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <span className={`${styles.mark} ${styles.merchantIcon}`} aria-hidden="true">
    <span style={{ visibility: src && loadedSrc === src && failedSrc !== src ? "hidden" : "visible" }}>{Array.from(name)[0] || "店"}</span>
    {src && failedSrc !== src && <img src={src} alt="" width={28} height={28}
      loading="lazy" decoding="async" referrerPolicy="no-referrer"
      style={{ visibility: loadedSrc === src ? "visible" : "hidden" }}
      onLoad={() => setLoadedSrc(src)} onError={() => setFailedSrc(src)} />}
  </span>;
}
