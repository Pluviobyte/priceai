"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
export function FavoriteButton({ kind, slug, initialSaved }: { kind: "product" | "merchant"; slug: string; initialSaved?: boolean }) {
  const [saved, setSaved] = useState(initialSaved ?? false);
  const [ready, setReady] = useState(initialSaved !== undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (initialSaved !== undefined) { setSaved(initialSaved); setReady(true); return; }
    const controller = new AbortController();
    fetch(`/api/account/favorites?${new URLSearchParams({ kind, slug })}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { setSaved(data.saved); setReady(true); })
      .catch(() => { if (!controller.signal.aborted) { setError("收藏状态暂时无法读取，请刷新重试"); } });
    return () => controller.abort();
  }, [kind, slug, initialSaved]);
  return <div className="favorite-control"><button type="button" className="account-secondary" aria-pressed={saved} disabled={busy || !ready} onClick={async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/account/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, slug, saved: !saved }) });
      if (response.status === 401) { router.push(`/login?next=${encodeURIComponent(pathname)}`); return; }
      if (!response.ok) throw new Error((await response.json()).error);
      setSaved((await response.json()).saved); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "收藏失败，请重试"); }
    finally { setBusy(false); }
  }}><span aria-hidden="true">{saved ? "★" : "☆"}</span> {busy ? "正在保存…" : saved ? "取消收藏" : "收藏"}</button>{error && <small role="alert">{error}</small>}</div>;
}
