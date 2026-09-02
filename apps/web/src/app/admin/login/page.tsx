export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="admin-shell login-shell">
      <section className="login-card">
        <span className="section-kicker">内部工具</span>
        <h1>审核后台</h1>
        <p>请输入管理账号。系统管理员、运营和审核员拥有不同操作权限；会话仅保存在 HttpOnly Cookie 中，有效期 8 小时。</p>
        {error ? <div className="form-error">密码错误，或后台尚未配置安全密钥。</div> : null}
        <form action="/api/admin/session" method="post" className="admin-login-form">
          <label htmlFor="username">管理账号</label>
          <input id="username" name="username" minLength={2} maxLength={80} defaultValue="admin" required autoComplete="username" />
          <label htmlFor="password">管理员密码</label>
          <input id="password" name="password" type="password" minLength={12} required autoComplete="current-password" />
          <button type="submit">登录</button>
        </form>
        <a href="/">返回公开首页</a>
      </section>
    </main>
  );
}
