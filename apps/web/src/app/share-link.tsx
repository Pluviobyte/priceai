"use client";

import { useState } from "react";

export function ShareLink({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const data = { title, text: `${title} 比价`, url: window.location.href };
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2_000); }
  }
  return <button className="share-button" type="button" onClick={() => void share()}>{copied ? "已复制链接" : "分享当前筛选"}</button>;
}
