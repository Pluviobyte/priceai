export const MODEL_ICON_PATHS = {
  openai: "/model-icons/openai.svg",
  claude: "/model-icons/claude.svg",
  gemini: "/model-icons/gemini.svg",
  grok: "/model-icons/grok.svg",
  deepseek: "/model-icons/deepseek.svg",
  qwen: "/model-icons/qwen.svg",
  kimi: "/model-icons/kimi.svg",
  zhipu: "/model-icons/zhipu.svg",
} as const;

export type ModelIconName = keyof typeof MODEL_ICON_PATHS;

export const MODEL_ICON_ENTRIES = Object.entries(MODEL_ICON_PATHS) as Array<[ModelIconName, string]>;

export function ModelIcon({ name, label, className }: { name: ModelIconName; label: string; className?: string }) {
  return <img className={className} src={MODEL_ICON_PATHS[name]} alt={`${label} 图标`} width="24" height="24" />;
}
