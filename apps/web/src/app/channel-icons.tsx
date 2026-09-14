/**
 * A price is only comparable once you know where it was read. These mark the store
 * behind a quote; the vendor's own mark (see model-icons) stands for buying direct.
 */
export const CHANNEL_ICON_PATHS = {
  apple: "/channel-icons/apple.svg",
  google: "/channel-icons/google.svg",
} as const;

export type ChannelIconName = keyof typeof CHANNEL_ICON_PATHS;

export function ChannelIcon({ name, label, className }: { name: ChannelIconName; label: string; className?: string }) {
  return <img className={className} src={CHANNEL_ICON_PATHS[name]} alt={`${label} 图标`} width="16" height="16" />;
}
