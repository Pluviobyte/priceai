"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_ANNOUNCEMENT_CONFIG,
  type AnnouncementKind,
  type SiteAnnouncementConfig,
} from "@/lib/site-announcements";

function AnnouncementIcon({ kind }: { kind: AnnouncementKind }) {
  if (kind === "community") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 19.5c.4-3.5 2.4-5.5 6-5.5s5.6 2 6 5.5M14 13c4.4 0 6.8 2.1 7.2 5.5" /></svg>;
  }
  if (kind === "service") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h3l2-5 4 10 2-5h7M5 4v4M3 6h4M17 18h4M19 16v4" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" /></svg>;
}

export function AnnouncementBanner() {
  const [config, setConfig] = useState<SiteAnnouncementConfig>(DEFAULT_ANNOUNCEMENT_CONFIG);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/announcements", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("announcement_fetch_failed")))
      .then((next: SiteAnnouncementConfig) => {
        if (Array.isArray(next.announcements)) setConfig(next);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setCurrentIndex((index) => Math.min(index, Math.max(0, config.announcements.length - 1)));
  }, [config.announcements.length]);

  useEffect(() => {
    if (!config.rotationEnabled || paused || config.announcements.length < 2) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % config.announcements.length);
    }, config.rotationIntervalMs);
    return () => window.clearInterval(interval);
  }, [config.rotationEnabled, config.rotationIntervalMs, config.announcements.length, paused]);

  if (!config.announcements.length) return null;
  const announcement = config.announcements[currentIndex] ?? config.announcements[0];
  if (!announcement) return null;

  return (
    <aside
      className={`site-announcement kind-${announcement.kind}`}
      aria-label="站点公告"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="site-announcement-inner" key={announcement.id}>
        <span className="site-announcement-badge"><AnnouncementIcon kind={announcement.kind} />{announcement.badge}</span>
        <a className="site-announcement-copy" href={announcement.destinationUrl}>
          <strong>{announcement.title}</strong>
          {announcement.description && <span>{announcement.description}</span>}
        </a>
        <a className="site-announcement-cta" href={announcement.destinationUrl}>{announcement.actionLabel}<span aria-hidden="true">→</span></a>
        {config.announcements.length > 1 && (
          <div className="site-announcement-pages" role="group" aria-label="切换站点公告">
            {config.announcements.map((item, index) => (
              <button
                type="button"
                className={index === currentIndex ? "active" : ""}
                aria-label={`查看公告 ${index + 1}：${item.title}`}
                aria-pressed={index === currentIndex}
                onClick={() => setCurrentIndex(index)}
                key={item.id}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
