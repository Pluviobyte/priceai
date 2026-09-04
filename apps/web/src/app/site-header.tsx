"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BrandLockup, SITE_NAME } from "./site-brand";

export type HeaderSection =
  | "home"
  | "subscriptions"
  | "official"
  | "api"
  | "transit"
  | "channels"
  | "changes"
  | "submit"
  | "methodology"
  | "status"
  | "guides";

type NavKey = HeaderSection | "merchant-feed" | "wholesale" | "commercial" | "support";
type NavLink = { key: NavKey; label: string; href: string; note?: string };
type NavGroup = { id: string; kicker: string; summary: string; links: readonly NavLink[] };
type Edition = "blue" | "green";

const THEME_KEY = "priceai-theme";
const EDITION_KEY = "priceai-color-theme";

/**
 * 主导航按购买路径分组，而不是平铺频道：
 * 用户先认出“账号归谁、钱付给谁”这一层，再进入对应的比价工具页。
 */
const PURCHASE_GROUPS: readonly NavGroup[] = [
  {
    id: "subscription",
    kicker: "订阅",
    summary: "会员、成品号与代充",
    links: [
      { key: "official", label: "官方订阅", href: "/official-prices", note: "官网正价与地区价" },
      { key: "channels", label: "卡网订阅", href: "/channels", note: "第三方渠道的有货价" },
    ],
  },
  {
    id: "api",
    kicker: "API",
    summary: "接口计费与中转站",
    links: [
      { key: "api", label: "官方 API", href: "/official-api", note: "厂商计费与额度限制" },
      { key: "transit", label: "中转 API", href: "/api-transit", note: "倍率、稳定性与延迟" },
    ],
  },
];

const RESEARCH_LINKS: readonly NavLink[] = [
  { key: "changes", label: "异动", href: "/changes", note: "降价、补货与售罄" },
  { key: "guides", label: "指南", href: "/guides", note: "买前必读与购买路径" },
  { key: "methodology", label: "数据说明", href: "/methodology", note: "排序口径与责任边界" },
  { key: "status", label: "数据健康", href: "/status", note: "采集与发布状态" },
];

const PARTICIPATE_LINKS: readonly NavLink[] = [
  { key: "submit", label: "提交店铺", href: "/submit", note: "公开店铺进入预检" },
  { key: "merchant-feed", label: "商家 Feed", href: "/merchant-feed", note: "直连 Feed 提高时效" },
  { key: "wholesale", label: "批发合作", href: "/wholesale" },
  { key: "commercial", label: "赞助合作", href: "/commercial" },
  { key: "support", label: "支持作者", href: "/support" },
];

const PRIMARY_LINKS: readonly NavLink[] = [
  { key: "home", label: "首页", href: "/" },
  ...PURCHASE_GROUPS.flatMap((group) => group.links),
  { key: "guides", label: "指南", href: "/guides", note: "买前必读与购买路径" },
];
const MENU_RESEARCH_LINKS = RESEARCH_LINKS.filter((link) => link.key !== "guides");

function isActive(active: HeaderSection, key: NavKey) {
  if (key === "channels") return active === "channels" || active === "subscriptions";
  return active === key;
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 隐私模式或禁用存储时静默失败，主题仍在当前页面生效。
  }
}

function Icon({ name, size = 18 }: { name: "search" | "moon" | "sun" | "menu" | "close" | "message" | "user" | "github"; size?: number }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    message: <path d="M2.99 16.34a2 2 0 0 1 .1 1.17l-1.07 3.29a1 1 0 0 0 1.24 1.17l3.41-1a2 2 0 0 1 1.1.09 10 10 0 1 0-4.78-4.72Z" />,
    user: <><path d="M2 21a8 8 0 0 1 13.29-6" /><circle cx="10" cy="8" r="5" /><path d="M19 16v6M22 19h-6" /></>,
    github: <path fill="currentColor" stroke="none" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.24c-3.22.7-3.9-1.36-3.9-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.19 1.78 1.19 1.04 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.68 0-1.25.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a10.98 10.98 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.84 1.18 3.09 0 4.4-2.71 5.38-5.29 5.67.42.36.78 1.06.78 2.14v3.18c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

function SearchForm({ id, inputRef }: { id: string; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  return (
    <form className="site-search" role="search" action="/search">
      <label className="sr-only" htmlFor={id}>搜索产品、商家或原始标题</label>
      <Icon name="search" size={16} />
      <input ref={inputRef} id={id} name="q" type="search" placeholder="搜索产品、商家或原始标题" autoComplete="off" spellCheck={false} />
      <kbd aria-hidden="true">/</kbd>
    </form>
  );
}

function EditionSwitch({ edition, onSelect }: { edition: Edition; onSelect: (next: Edition) => void }) {
  return (
    <div className="site-edition" role="group" aria-label="站点配色">
      <button type="button" aria-pressed={edition === "blue"} onClick={() => onSelect("blue")}><i className="blue" />蓝色版</button>
      <button type="button" aria-pressed={edition === "green"} onClick={() => onSelect("green")}><i className="green" />绿色版</button>
    </div>
  );
}

export function SiteHeader({ active = "home" }: { active?: HeaderSection }) {
  const pathname = usePathname();
  const baseId = useId();
  const [dark, setDark] = useState(false);
  const [edition, setEdition] = useState<Edition>("blue");
  const [stuck, setStuck] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const moreId = `${baseId}-more`;
  const drawerId = `${baseId}-drawer`;
  const loginHref = `/login?next=${encodeURIComponent(pathname || "/")}`;

  // 读取已保存的外观偏好。layout 里的内联脚本已在首屏前应用，这里只同步控件状态。
  useEffect(() => {
    const root = document.documentElement;
    const nextDark = readStorage(THEME_KEY) === "dark";
    const storedEdition = readStorage(EDITION_KEY);
    const nextEdition: Edition = storedEdition === "green" || storedEdition === "blue" ? storedEdition : root.dataset.brandTheme === "green" ? "green" : "blue";
    setDark(nextDark);
    setEdition(nextEdition);
    root.dataset.theme = nextDark ? "dark" : "light";
    root.dataset.brandTheme = nextEdition;
  }, []);

  // 与 New API 一致：越过 20px 后将宽导航收拢为居中的轻量浮动栏。
  useEffect(() => {
    const update = () => setStuck(window.scrollY > 20);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      const toggle = menuToggleRef.current;
      if (toggle && document.contains(toggle)) toggle.focus();
    };
  }, [drawerOpen]);

  // 按 “/” 直接聚焦搜索框；正在输入时不拦截。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const input = searchRef.current;
      if (!input || !input.offsetParent) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    writeStorage(THEME_KEY, next ? "dark" : "light");
  }

  function selectEdition(next: Edition) {
    setEdition(next);
    document.documentElement.dataset.brandTheme = next;
    writeStorage(EDITION_KEY, next);
  }

  function renderNavLink(link: NavLink) {
    const current = isActive(active, link.key);
    return <Link href={link.href} aria-current={current ? "page" : undefined} key={link.key}>{link.label}</Link>;
  }

  function renderMenuLink(link: NavLink) {
    const current = isActive(active, link.key);
    return (
      <Link href={link.href} aria-current={current ? "page" : undefined} key={link.key}>
        {link.label}
        {link.note && <small>{link.note}</small>}
      </Link>
    );
  }

  function renderDrawerLink(link: NavLink) {
    const current = isActive(active, link.key);
    return (
      <Link href={link.href} aria-current={current ? "page" : undefined} onClick={() => setDrawerOpen(false)} key={link.key}>
        {link.label}
        {link.note && <small>{link.note}</small>}
      </Link>
    );
  }

  return (
    <>
      <header className={`site-header${stuck ? " is-stuck" : ""}`}>
        <div className="site-header-frame">
          <div className="site-header-bar">
            <BrandLockup tagline={false} />
            <nav className="site-nav" aria-label="主导航">
              {PRIMARY_LINKS.map(renderNavLink)}
            </nav>

            <div className="site-header-actions">
              <span className="site-header-divider" aria-hidden="true" />
              <div className="site-desktop-actions">
                <div className="site-nav-more" ref={moreRef}>
                  <button className="site-icon-button site-social-button" type="button" aria-expanded={moreOpen} aria-controls={moreId} aria-label="打开聊天与站点工具" title="聊天与站点工具" onClick={() => setMoreOpen((open) => !open)}>
                    <Icon name="message" size={17} />
                  </button>
                  {moreOpen && (
                    <div className="site-menu" id={moreId}>
                      <SearchForm id={`${baseId}-q`} inputRef={searchRef} />
                      <div className="site-menu-section">
                        <span className="site-menu-label">动态与数据</span>
                        {MENU_RESEARCH_LINKS.map(renderMenuLink)}
                      </div>
                      <div className="site-menu-section">
                        <span className="site-menu-label">参与</span>
                        {PARTICIPATE_LINKS.map(renderMenuLink)}
                      </div>
                      <div className="site-menu-section">
                        <span className="site-menu-label">外观</span>
                        <button className="site-menu-action" type="button" onClick={toggleTheme} aria-pressed={dark}>
                          <Icon name={dark ? "sun" : "moon"} size={16} />
                          <span>{dark ? "切换到浅色模式" : "切换到深色模式"}</span>
                        </button>
                        <EditionSwitch edition={edition} onSelect={selectEdition} />
                      </div>
                    </div>
                  )}
                </div>
                <Link className="site-icon-button site-social-button" href="/?qqGroup=1" aria-label="加入 QQ 交流群" title="QQ 交流群">
                  <img src="/social-icons/qq.svg" alt="" />
                </Link>
                <Link className="site-icon-button site-social-button" href="/support?contact=wechat" aria-label="通过微信联系" title="微信联系">
                  <img src="/social-icons/wechat.svg" alt="" />
                </Link>
                <a className="site-icon-button site-social-button" href="https://t.me/dimthink" target="_blank" rel="noopener noreferrer" aria-label="通过 Telegram 联系" title="Telegram">
                  <img src="/social-icons/telegram.svg" alt="" />
                </a>
                <a className="site-icon-button site-social-button site-github-button" href="https://github.com/Pluviobyte/priceai" target="_blank" rel="noopener noreferrer" aria-label="打开 PriceAI GitHub 仓库" title="GitHub">
                  <Icon name="github" size={18} />
                </a>
                <Link className="site-icon-button site-social-button site-account-button" href={loginHref} aria-label="登录个人账户" title="登录个人账户">
                  <Icon name="user" size={17} />
                </Link>
              </div>
              <button ref={menuToggleRef} className="site-icon-button site-menu-toggle" type="button" aria-expanded={drawerOpen} aria-controls={drawerId} aria-label="打开站点菜单" onClick={() => setDrawerOpen(true)}>
                <Icon name="menu" size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="site-drawer" id={drawerId} role="dialog" aria-modal="true" aria-label={`${SITE_NAME} 站点菜单`}>
          <div className="site-drawer-inner">
            <div className="site-drawer-head">
              <BrandLockup tagline={false} />
              <button ref={drawerCloseRef} className="site-icon-button" type="button" aria-label="关闭菜单" onClick={() => setDrawerOpen(false)}>
                <Icon name="close" />
              </button>
            </div>
            <SearchForm id={`${baseId}-drawer-q`} />
            <nav className="site-drawer-nav" aria-label="全部栏目">
              {PURCHASE_GROUPS.map((group) => (
                <section className="site-drawer-section" key={group.id}>
                  <h2>{group.kicker}</h2>
                  <p>{group.summary}</p>
                  {group.links.map(renderDrawerLink)}
                </section>
              ))}
              <section className="site-drawer-section">
                <h2>数据与说明</h2>
                <p>看异动、读指南、核对排序口径</p>
                {RESEARCH_LINKS.map(renderDrawerLink)}
              </section>
              <section className="site-drawer-section">
                <h2>参与</h2>
                <p>提交渠道、合作与支持</p>
                {PARTICIPATE_LINKS.map(renderDrawerLink)}
              </section>
            </nav>
            <div className="site-drawer-foot">
              <Link className="site-outline-link" href={loginHref}>登录</Link>
              <button className="site-outline-link" type="button" onClick={toggleTheme} aria-pressed={dark}>
                <Icon name={dark ? "sun" : "moon"} size={16} />
                {dark ? "浅色模式" : "深色模式"}
              </button>
              <EditionSwitch edition={edition} onSelect={selectEdition} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
