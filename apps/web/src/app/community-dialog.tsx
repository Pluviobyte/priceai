"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./community-dialog.module.css";

export type CommunityPlatform = "qq" | "wechat";

export function CommunityDialog({ platform, onClose }: { platform: CommunityPlatform | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const name = platform === "wechat" ? "微信" : "QQ";

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
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.content}>
        <button type="button" className={styles.close} aria-label="关闭交流群弹窗" onClick={onClose} autoFocus>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <header className={styles.heading}>
          <span className={styles.platform}><img src={`/social-icons/${platform === "wechat" ? "wechat" : "qq"}.svg`} alt="" />{name}交流群</span>
          <h2 id={titleId}>一起交流 AI 的更多可能</h2>
          <p id={descriptionId}>选择你感兴趣的交流群。入群二维码正在准备中。</p>
        </header>
        <div className={styles.groups}>
          {[
            { title: `加入 PriceAI ${name}交流群`, description: "交流 AI 订阅价格、渠道信息与平台使用反馈。" },
            { title: `加入 AI使用技巧 ${name}交流群`, description: "分享提示词、实用工具与日常 AI 使用经验。" },
          ].map((group) => (
            <section className={styles.group} key={group.title}>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
              <div className={styles.placeholder} role="img" aria-label={`${group.title}，二维码占位，暂不可扫描`}>
                <svg width="76" height="76" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <rect x="6" y="6" width="18" height="18" rx="2" /><rect x="40" y="6" width="18" height="18" rx="2" /><rect x="6" y="40" width="18" height="18" rx="2" />
                  <path d="M14 14h2v2h-2zM48 14h2v2h-2zM14 48h2v2h-2zM40 40h7v7h11M40 52v6M52 58h6M58 34v5M32 8v12M8 32h12M32 32h6M32 44v14" />
                </svg>
                <strong>二维码待更新</strong>
                <span>占位展示 · 暂不可扫描</span>
              </div>
              <span className={styles.pending}>准备中，敬请期待</span>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}
