// Shops see in their own statistics which visits came from here. A tag the shop already
// put on its link is its own and stays as it is.
export function withReferralTags(url: URL): URL {
  const tagged = new URL(url);
  for (const [key, value] of [["utm_source", "priceai"], ["utm_medium", "referral"], ["utm_campaign", "price_compare"]] as const) {
    if (!tagged.searchParams.has(key)) tagged.searchParams.set(key, value);
  }
  return tagged;
}
