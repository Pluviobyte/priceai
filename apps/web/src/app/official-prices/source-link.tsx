import { isPricingInterface } from "@/lib/official-subscription-links";

export function OfficialSourceLink({ url, label = "官方价格来源" }: { url: string; label?: string }) {
  if (isPricingInterface(url)) return <details><summary>采集接口（核验依据）</summary><small>此链接用于采集价格，直接访问可能返回错误；订阅请通过套餐详情的“前往官方”入口。</small><a href={url} target="_blank" rel="noopener noreferrer nofollow">查看原始接口 ↗</a></details>;
  return <a href={url} target="_blank" rel="noopener noreferrer nofollow">{label} ↗</a>;
}
