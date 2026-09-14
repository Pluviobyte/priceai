# PriceAI 公开账户登录

公开用户采用 Google / GitHub OAuth 授权码流程，`/admin/login` 和 `price_radar_admin` 管理会话保持独立。公开登录不会赋予管理员权限。

## 环境配置（仅 Web）

- `PUBLIC_BASE_URL=https://priceai.io`：固定授权回调站点，禁止使用请求 Host 动态拼接。
- `USER_SESSION_SECRET`：独立的随机密钥，至少 32 字符；不要复用管理员密钥。
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`

秘密只写入部署平台的受保护环境配置，不提交 Git。未配置时相应登录按钮禁用并标注“即将开放”。

## 提供商设置

Google Web OAuth 客户端：
- 来源：`https://priceai.io`
- 回调：`https://priceai.io/api/auth/google/callback`
- 首页：`https://priceai.io`
- 隐私说明：`https://priceai.io/privacy`
- scope：`openid email profile`。不请求 Gmail 邮件或 offline access。
- 面向外部用户；上线前核对 Google 发布状态及品牌审核要求。

GitHub OAuth App：
- Homepage：`https://priceai.io`
- Redirect URI：`https://priceai.io/api/auth/github/callback`
- 不启用 wildcard 或 device flow，保留访问令牌到期选项。
- scope：`user:email`。不申请仓库或组织权限。

## 会话与验证

两个提供商均使用随机 state、S256 PKCE、10 分钟加密临时 Cookie。启动授权和退出仅接受同源 POST。回调校验 state/提供商/过期时间，并清除临时 Cookie；返回地址限制为站内公开页面。外部调用超时 10 秒、禁止跟随重定向和缓存，不记录授权码、令牌或凭据。

身份通过提供商认证 API 核验，Google 要求 verified email，GitHub 仅展示 verified primary email。身份是提供商加稳定用户 ID，不按邮箱自动合并账户。用户资料放在 jose A256GCM 加密会话中，生产使用独立 `__Host-`、Secure、HttpOnly、SameSite=Lax Cookie，最长 7 天。提供商 access/refresh token 不持久保存。当前不写入用户数据库，没有收藏或其他持久账户数据功能。

退出会清除本浏览器 Cookie。无中心化逐会话撤销；泄露时轮换 `USER_SESSION_SECRET` 可使全部会话失效。撤销第三方授权后，已有本站会话在退出或到期前仍有效。

上线验收需分别实测两种提供商：成功授权返回原页面、取消授权、过期回调、刷新仍登录、账户资料、退出、普通用户无法进入管理后台。

参考：[GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)、[Google Web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)。
