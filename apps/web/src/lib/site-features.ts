/** Set to true when confirmed sponsors are ready, then rebuild/redeploy. */
export const SPONSORS_ENABLED: boolean = false;

/** Temporarily hide the official API sponsor slot without removing its markup. */
export const OFFICIAL_API_SPONSOR_ENABLED: boolean = false;

/** Temporarily hide the home purchase-path section without removing its content. */
export const PURCHASE_PATHS_ENABLED: boolean = false;

/** Temporarily hide official and transit API entry points; keep pages available for restoration. */
export const API_SECTIONS_ENABLED: boolean = false;

export function isApiSectionPath(path: string): boolean {
  return /^\/(?:official-api|api-transit)(?:[/?#]|$)/.test(path);
}
