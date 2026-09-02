export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="后台导航">
      <a href="/admin">分类审核</a>
      <a href="/admin/sources">来源与运行</a>
      <a href="/admin/submissions">渠道投稿</a>
      <a href="/admin/anomalies">异常队列</a>
      <a href="/">公开首页</a>
    </nav>
  );
}
