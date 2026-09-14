import { ModelIcon, type ModelIconName } from "./model-icons";
import { ChannelIcon } from "./channel-icons";

/** The three places an official price can be read at. */
export const CHANNEL_NAMES: Record<string, string> = { web: "官网直购", app_store: "iOS Store", google_play: "Google Play" };

const vendorIcons: Record<string, ModelIconName> = { openai: "openai", anthropic: "claude", google: "gemini", xai: "grok" };
const vendorNames: Record<string, string> = { openai: "ChatGPT", anthropic: "Claude", google: "Gemini", xai: "Grok" };

/**
 * Two prices for the same plan are not the same offer if they were read at different
 * stores: the store decides the tax treatment, the purchase eligibility and who ends up
 * holding the subscription. This marks which one a number came from. Buying direct
 * carries the vendor's own mark, so the caller passes the vendor it is showing.
 *
 * It renders the mark alone rather than a finished badge, because the four places that
 * state a channel are shaped differently — a pill, a table cell, a caption, a header.
 */
export function ChannelMark({ channel, vendor, className = "priceai-channel-mark" }: { channel: string; vendor?: string; className?: string }) {
  if (channel === "app_store") return <ChannelIcon name="apple" label="Apple" className={className} />;
  if (channel === "google_play") return <ChannelIcon name="google" label="Google" className={className} />;
  const key = vendor?.toLowerCase() ?? "";
  const icon = vendorIcons[key];
  return icon ? <ModelIcon name={icon} label={vendorNames[key] ?? key} className={className} /> : null;
}
