export default function AccountLoading() {
  return <main className="account-shell" aria-busy="true"><div className="account-heading"><h1>个人中心</h1></div><div className="account-layout"><aside className="account-sidebar"><p>个人资料</p><p>我的收藏</p><p>我的提交</p><p>账户设置</p></aside><section className="account-content"><p role="status">正在读取账户资料…</p></section></div></main>;
}
