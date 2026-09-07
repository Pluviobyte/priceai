/** Migrated homepage entries. Publish destinations and offers only after verification. */
export type Sponsor = {
  id: string;
  name: string;
  mark: string;
  category: string;
  disclosure: string;
  summary: string;
  href?: string;
};

export const sponsors: readonly Sponsor[] = [
  { id: "aliyun", name: "阿里云", mark: "阿", category: "海外轻量服务器", disclosure: "推广", summary: "面向个人项目、开发测试与 AI 工具的云服务器。" },
  { id: "tencent-cloud", name: "腾讯云", mark: "腾", category: "境外轻量服务器", disclosure: "推广", summary: "面向小团队与自用工具的轻量云基础设施。" },
  { id: "packyapi", name: "PackyAPI", mark: "P", category: "模型 API 中转", disclosure: "赞助", summary: "统一接口接入主流大模型，简化多供应商调用。" },
  { id: "opencode-go", name: "OpenCode Go", mark: "Go", category: "AI 编程订阅", disclosure: "推广", summary: "面向开发者的国产模型编程订阅与工具服务。" },
  { id: "spaceship", name: "Spaceship", mark: "S", category: "域名与项目入口", disclosure: "推广", summary: "为个人项目、API 入口和 Agent 服务配置域名。" },
  { id: "heju-api", name: "合聚 API", mark: "合", category: "多模型 API 接入", disclosure: "赞助", summary: "通过统一接口接入文本、图像与视频模型服务。" },
  { id: "vmcard", name: "VMCard", mark: "V", category: "企业级虚拟卡", disclosure: "赞助推广", summary: "面向海外订阅、云服务和企业支付的虚拟卡工具。" },
];
