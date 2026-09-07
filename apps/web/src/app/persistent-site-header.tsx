"use client";

import { usePathname } from "next/navigation";
import { SiteHeader, type HeaderSection } from "./site-header";
import { SPONSORS_ENABLED } from "@/lib/site-features";

const sections: Record<string, HeaderSection> = {
  "official-prices": "official",
  channels: "channels",
  subscriptions: "subscriptions",
  products: "subscriptions",
  brands: "subscriptions",
  merchants: "subscriptions",
  search: "subscriptions",
  "official-api": "api",
  "api-transit": "transit",
  changes: "changes",
  guides: "guides",
  docs: "docs",
  "account-safety": "account-safety",
  methodology: "methodology",
  status: "status",
  submit: "submit",
  "merchant-feed": "submit",
  commercial: "home",
  support: "home",
  wholesale: "home",
};

/** Shared layout ownership keeps the WebGL canvas alive during client navigation. */
export function PersistentSiteHeader() {
  const pathname = usePathname() || "/";
  const segment = pathname.split("/")[1] ?? "";
  const active = pathname === "/" ? "home"
    : pathname === "/sponsors" && SPONSORS_ENABLED ? "sponsors"
    : pathname === "/alerts/status" || pathname === "/alerts/verified" ? "home"
    : sections[segment];

  // Login, admin, hidden sponsors and standalone utilities keep their existing shell.
  if (!active) return null;
  return <SiteHeader active={active} />;
}
