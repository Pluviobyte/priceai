export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="后台导航">
      <a href="/admin">分类审核</a>
      <a href="/admin/sources">来源与运行</a>
      <a href="/admin/submissions">渠道投稿</a>
      <a href="/admin/discovery">来源发现</a>
      <a href="/admin/anomalies">异常队列</a>
      <a href="/admin/reports">用户举报</a>
      <a href="/admin/generations">发布与回滚</a>
      <a href="/admin/quality">质量报表</a>
      <a href="/admin/audit">审计日志</a>
      <a href="/api/admin/classification-rule-patch">规则补丁</a>
      <a href="/admin/announcements">顶部横幅</a>
      <a href="/admin/sponsorships">广告与赞助</a>
      <a href="/">公开首页</a>
    </nav>
  );
}
