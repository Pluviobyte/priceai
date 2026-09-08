/**
 * Multi-tenant storefront platforms and network-free candidate identity.
 *
 * LDXP (链动小铺) serves the same shop token space through several domains and
 * rotates the public one (pay.ldxp.cn → wzyp.cn in 2026-09). 16688 is a separate
 * platform with its own shop numbers. catfk.com runs the same LDXP software but
 * has its own token space, so it must stay a separate platform kind.
 */
export interface PlatformFamily {
  key: string;
  platformKind: string;
  hosts: readonly string[];
  primaryOrigin: string;
  shopPath: RegExp;
  itemPath: RegExp;
  /** Path segment the platform uses for single product pages. */
  itemSegment: "item" | "goods";
}

const SHOP_TOKEN = "[A-Za-z0-9._~-]{1,128}";

export const LDXP_FAMILY: PlatformFamily = {
  key: "ldxp",
  platformKind: "ldxp_shop_api",
  hosts: ["wzyp.cn", "www.wzyp.cn", "pay.ldxp.cn", "www.ldxp.cn", "ldxp.cn"],
  primaryOrigin: "https://wzyp.cn",
  shopPath: new RegExp(`^/shop/(${SHOP_TOKEN})/?$`),
  itemPath: new RegExp(`^/item/(${SHOP_TOKEN})/?$`),
  itemSegment: "item",
};

export const SIXTEEN688_FAMILY: PlatformFamily = {
  key: "16688",
  platformKind: "shop_api_16688",
  hosts: ["www.16688.com.cn", "16688.com.cn"],
  primaryOrigin: "https://www.16688.com.cn",
  shopPath: new RegExp(`^/shop/(${SHOP_TOKEN})/?$`),
  itemPath: new RegExp(`^/goods/(${SHOP_TOKEN})/?$`),
  itemSegment: "goods",
};

export const PLATFORM_FAMILIES: readonly PlatformFamily[] = [LDXP_FAMILY, SIXTEEN688_FAMILY];

const GENERIC_SHOP_PATH = new RegExp(`^/shop/(${SHOP_TOKEN})/?$`);
const GENERIC_ITEM_PATH = new RegExp(`^/item/(${SHOP_TOKEN})/?$`);

export function familyForHost(hostname: string): PlatformFamily | undefined {
  const host = hostname.toLowerCase();
  return PLATFORM_FAMILIES.find((family) => family.hosts.includes(host));
}

export function familyForPlatformKind(platformKind: string): PlatformFamily | undefined {
  return PLATFORM_FAMILIES.find((family) => family.platformKind === platformKind);
}

/** Platform kind used by Shop API deployments: one shared kind per LDXP token space. */
export function shopApiPlatformKind(hostname: string): string {
  const family = familyForHost(hostname);
  if (family) return family.platformKind;
  return `shop_api@${hostname.toLowerCase()}`;
}

/** Alternate origins to retry when a family host redirects or fails, primary first. */
export function failoverOrigins(origin: string): string[] {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return [];
  }
  const family = familyForHost(hostname);
  if (!family) return [];
  const origins = [family.primaryOrigin, ...family.hosts.map((host) => `https://${host}`)];
  return [...new Set(origins)].filter((candidate) => candidate !== new URL(origin).origin);
}

export type CandidateIdentityKind = "shop" | "item" | "host";

export interface CandidateIdentity {
  /** Platform kind the collectors will report for this shop, or "web" for self-hosted sites. */
  platformKind: string;
  /** Known only when the URL itself names the shop (token, shop number, or hostname). */
  platformMerchantId?: string;
  kind: CandidateIdentityKind;
  /** URL rewritten onto the family's current primary origin. */
  canonicalUrl: string;
  platformHint: string;
}

function normalizeUrl(input: string | URL): URL | null {
  try {
    const url = typeof input === "string" ? new URL(input.trim()) : new URL(input.toString());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    return url;
  } catch {
    return null;
  }
}

/**
 * Derives the dedupe identity of a discovered URL without touching the network.
 * Returns null for URLs that cannot name a shop (platform home pages, invalid URLs).
 */
export function resolveCandidateIdentity(input: string | URL): CandidateIdentity | null {
  const url = normalizeUrl(input);
  if (!url) return null;
  const family = familyForHost(url.hostname);
  const path = url.pathname;
  if (family) {
    const shop = family.shopPath.exec(path);
    if (shop?.[1]) {
      return {
        platformKind: family.platformKind,
        platformMerchantId: shop[1],
        kind: "shop",
        canonicalUrl: `${family.primaryOrigin}/shop/${shop[1]}`,
        platformHint: family.key,
      };
    }
    const item = family.itemPath.exec(path);
    if (item?.[1]) {
      return {
        platformKind: family.platformKind,
        kind: "item",
        canonicalUrl: `${family.primaryOrigin}/${family.itemSegment}/${item[1]}`,
        platformHint: family.key,
      };
    }
    return null;
  }
  const shop = GENERIC_SHOP_PATH.exec(path);
  if (shop?.[1]) {
    return {
      platformKind: shopApiPlatformKind(url.hostname),
      platformMerchantId: shop[1],
      kind: "shop",
      canonicalUrl: `${url.origin}/shop/${shop[1]}`,
      platformHint: "shop_api",
    };
  }
  const item = GENERIC_ITEM_PATH.exec(path);
  if (item?.[1]) {
    return {
      platformKind: shopApiPlatformKind(url.hostname),
      kind: "item",
      canonicalUrl: `${url.origin}/item/${item[1]}`,
      platformHint: "shop_api",
    };
  }
  return {
    platformKind: "web",
    platformMerchantId: url.hostname,
    kind: "host",
    canonicalUrl: `${url.origin}/`,
    platformHint: "web",
  };
}

/** Rewrites a URL on a retired family host onto the family's primary origin. */
export function canonicalizeFamilyUrl(input: string | URL): string | null {
  const url = normalizeUrl(input);
  if (!url) return null;
  const family = familyForHost(url.hostname);
  if (!family) return url.toString();
  return `${family.primaryOrigin}${url.pathname}`;
}
