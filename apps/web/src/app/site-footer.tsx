import Link from "next/link";

const sponsors = [
  ["阿里云海外轻量服务器", "适合自用CPA反代、开发测试和 AI 工具备用机可用；2核2G 配置新人低至 68 元/年起，首购享85折优惠。", "推广"],
  ["腾讯云境外轻量服务器", "适合小团队搭建sub2api自用中转、openclaw等；2核4G配置活动低至 199 元/年起，新老同享。", "推广"],
  ["PackyAPI：致力于高可用的中转", "PackyAPI 提供可靠高效的 API 中转服务，一句话接入主流大模型，统一域名、统一密钥、智能容灾切换。", "赞助"],
  ["OpenCode Go：国产模型编程订阅", "支持 GLM、Kimi、Qwen、MiniMax、DeepSeek 等主流国产开放模型。提供月度上限约 $60 用量。", "推广"],
  ["Spaceship 低价数字 .xyz 域名", "6 至 9 位纯数字 .xyz 域名低至 ¥4.55/年，适合个人项目、API 入口和 Agent 服务快速配域名。", "推广"],
  ["合聚 API：低价接入，高效稳定，畅享全球主流 AI 能力", "支持 OpenAI、Anthropic、Google、字节跳动 SeeDance 视频生成模型，统一接口接入，稳定、高速、低成本开启 AI 能力。", "赞助"],
  ["VMCard｜企业级虚拟卡平台", "覆盖 GPT/Claude 订阅、云服务、广告投放等主流海外支付场景，支持 API 自动开卡与批量开卡。", "赞助推广"],
] as const;

export function SiteFooter() {
  return <footer className="priceai-footer"><nav className="priceai-footer-actions" aria-label="返回首页核心内容"><Link className="priceai-footer-button primary" href="/?home=1#channels">↑　先选购买路径</Link><Link className="priceai-footer-button" href="/?home=1#baseline">↑　直接看全网底价</Link></nav><section className="priceai-sponsors" aria-label="底部赞助展示区广告位"><div className="priceai-sponsor-head"><h2>赞助商列表</h2><Link href="/commercial#slots">成为赞助商</Link></div><div className="priceai-sponsor-grid">{sponsors.map(([name,text,label])=><a href="/commercial" key={name}><span className="priceai-sponsor-image" /><div className="priceai-sponsor-copy"><div><h3>{name}</h3><em>{label}</em></div><p>{text}</p></div></a>)}</div></section></footer>;
}
