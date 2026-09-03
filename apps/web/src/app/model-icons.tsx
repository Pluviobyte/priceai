export const MODEL_ICON_PATHS = {
  openai: "/model-icons/openai.svg",
  claude: "/model-icons/claude-official.svg",
  gemini: "/model-icons/gemini-official.svg",
  grok: "/model-icons/grok.svg",
  deepseek: "/model-icons/deepseek-official.svg",
  qwen: "/model-icons/qwen-official.svg",
  kimi: "/model-icons/kimi-official.svg",
  zhipu: "/model-icons/zhipu-official.svg",
  minimax: "/model-icons/minimax-official.svg",
  doubao: "/model-icons/doubao-official.svg",
  perplexity: "/model-icons/perplexity-official.svg",
  mistral: "/model-icons/mistral-official.svg",
  metaai: "/model-icons/metaai-official.svg",
  cohere: "/model-icons/cohere-official.svg",
  hunyuan: "/model-icons/hunyuan-official.svg",
  yi: "/model-icons/yi-official.svg",
} as const;

export type ModelIconName = keyof typeof MODEL_ICON_PATHS;

export const MODEL_ICON_ENTRIES = Object.entries(MODEL_ICON_PATHS) as Array<[ModelIconName, string]>;

export function ModelIcon({ name, label, className }: { name: ModelIconName; label: string; className?: string }) {
  return <img className={className} src={MODEL_ICON_PATHS[name]} alt={`${label} 图标`} width="24" height="24" />;
}
