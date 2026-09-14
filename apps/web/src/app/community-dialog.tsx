"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./community-dialog.module.css";

export type CommunityPlatform = "qq" | "wechat" | "telegram" | "all";

export function CommunityDialog({ platform, onClose }: { platform: CommunityPlatform | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const groups = [
    { platform: "qq", name: "QQ" },
    { platform: "wechat", name: "微信" },
    { platform: "telegram", name: "TG" },
  ].filter(group => platform === "all" || group.platform === platform);
  const name = groups[0]?.name ?? "QQ";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!platform || !dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [platform]);

  return (
    <dialog ref={dialogRef} className={`${styles.dialog} ${platform === "all" ? styles.allPlatforms : ""}`} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.content}>
        <button type="button" className={styles.close} aria-label="关闭交流群弹窗" onClick={onClose} autoFocus>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <header className={styles.heading}>
          <span className={styles.platform}>{platform !== "all" && <img src={`/social-icons/${platform === "wechat" ? "wechat" : platform === "telegram" ? "telegram" : "qq"}.svg`} alt="" />}{platform === "all" ? "QQ、微信和TG交流群" : `${name}交流群`}</span>
          <h2 id={titleId}>一起交流 AI 的更多可能</h2>
          <p id={descriptionId}>交流 AI 订阅价格、渠道信息与平台使用反馈。</p>
        </header>
        <div className={styles.groups}>
          {groups.map(({ platform: groupPlatform, name: groupName }) => {
            const group = { title: `加入 PriceAI ${groupName}交流群`, description: "交流比价信息与使用经验。" };
            return (
            <section className={styles.group} key={group.title}>
              <img className={styles.groupIcon} src={`/social-icons/${groupPlatform}.svg`} alt="" />
              <h3>{group.title}</h3>
              <p>{group.description}</p>
              <div className={styles.placeholder} role="img" aria-label={`${group.title}，${groupPlatform === "telegram" ? "邀请链接待更新" : "二维码占位，暂不可扫描"}`}>
                {groupPlatform === "telegram" ? <img src="/social-icons/telegram.svg" alt="" width="76" height="76" /> : <svg width="76" height="76" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <rect x="6" y="6" width="18" height="18" rx="2" /><rect x="40" y="6" width="18" height="18" rx="2" /><rect x="6" y="40" width="18" height="18" rx="2" />
                  <path d="M14 14h2v2h-2zM48 14h2v2h-2zM14 48h2v2h-2zM40 40h7v7h11M40 52v6M52 58h6M58 34v5M32 8v12M8 32h12M32 32h6M32 44v14" />
                </svg>}
                <strong>{groupPlatform === "telegram" ? "邀请链接待更新" : "二维码待更新"}</strong>
                <span>{groupPlatform === "telegram" ? "暂未提供入群链接" : "占位展示 · 暂不可扫描"}</span>
              </div>
              <span className={styles.pending}>准备中，敬请期待</span>
            </section>
          ); })}
        </div>
      </div>
    </dialog>
  );
}
