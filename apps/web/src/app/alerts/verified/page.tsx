
export default async function AlertVerifiedPage({ searchParams }: { searchParams: Promise<{ error?: string; unsubscribed?: string }> }) {
  const query = await searchParams;
  const title = query.unsubscribed ? "提醒已取消" : query.error ? "链接无效或已使用" : "提醒已确认";
  return <main><section className="status-shell"><span className="section-kicker">邮箱提醒</span><h1>{title}</h1><p>可以安全关闭此页。每封提醒邮件都会包含取消链接。</p></section></main>;
}
