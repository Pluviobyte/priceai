import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../site-header";
import { ModelChecker } from "../model-checker";

export const metadata: Metadata = { title: "一次性模型检测 | PriceAI" };

export default function TransitDetectorPage() {
  return <div className="priceai-page"><SiteHeader active="transit" /><main className="priceai-detail-shell priceai-detector-shell"><Link className="priceai-detail-back" href="/api-transit">← 返回中转榜</Link><section className="priceai-detail-hero"><div><span>Bring your own key</span><h1>一次性模型检测</h1><p>检查 OpenAI 兼容端点公开的模型列表，并可选执行一次最小推理请求。密钥只用于当前请求。</p></div></section><aside className="priceai-official-note"><b>安全说明</b><p>API Key 不写入数据库、Cookie 或持久日志。仍建议使用临时、低额度密钥，并在检测后轮换。</p></aside><ModelChecker /></main></div>;
}
