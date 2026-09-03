export const MODEL_ICON_PATHS = {
  openai: "/model-icons/openai.svg",
  claude: "/model-icons/claude-official.svg",
  gemini: "/model-icons/gemini-official.svg",
  grok: "/model-icons/grok.svg",
  deepseek: "/model-icons/deepseek-official.svg",
  qwen: "/model-icons/qwen-official.svg",
  kimi: "/model-icons/kimi-official.svg",
  zhipu: "/model-icons/zhipu-official.svg",
} as const;

export type ModelIconName = keyof typeof MODEL_ICON_PATHS;

export const MODEL_ICON_ENTRIES = Object.entries(MODEL_ICON_PATHS) as Array<[ModelIconName, string]>;

export function ModelIcon({ name, label, className }: { name: ModelIconName; label: string; className?: string }) {
  return <img className={className} src={MODEL_ICON_PATHS[name]} alt={`${label} 图标`} width="24" height="24" />;
}
