"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ProfileForm({ name }: { name: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return <form className="account-profile-form" onSubmit={async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: form.get("nickname") }) });
      if (!response.ok) throw new Error((await response.json()).error);
      setMessage("昵称已保存"); router.refresh(); window.dispatchEvent(new Event("focus"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败，请稍后重试"); }
    finally { setBusy(false); }
  }}><label htmlFor="account-nickname">昵称</label><input id="account-nickname" name="nickname" defaultValue={name} minLength={1} maxLength={40} required autoComplete="nickname" aria-describedby="nickname-hint" /><p id="nickname-hint">用于本站显示，不会修改你的 Google 或 GitHub 资料。</p><div><button className="account-primary" disabled={busy}>{busy ? "正在保存…" : "保存修改"}</button><span role="status">{message}</span></div></form>;
}
