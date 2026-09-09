# PriceAI 自动发布

## 发布流程

`main` 推送 → GitHub Actions 检查 → 快进 `codex/production` → Dokploy 自动部署。

工作流是 `.github/workflows/production.yml`。PR 只检查；只有 main 的成功运行才能推进发布分支。检查包含 npm ci、全工作区类型检查和测试、临时 PostgreSQL 迁移、卡网 SQL 集成测试及全工作区构建。CI 数据库与生产环境独立，不需要生产数据库凭据。

发布分支只指向已经检查过的原始提交，不生成额外提交，不强制推送。过时运行如果发现 main 已推进，会跳过发布。部署任务串行，避免较旧提交覆盖新版本。不要直接向 `codex/production` 推送开发代码。

Dokploy 中三个应用保留 GitHub Provider、On Push 和 Autodeploy，只把 Branch 设为 `codex/production`：

| 服务 | Dockerfile | Stage |
| --- | --- | --- |
| PriceAI Web | Dockerfile | 默认 |
| PriceAI Official Worker | Dockerfile.worker | 默认/official |
| PriceAI Channel Worker | Dockerfile.worker | channels |

服务器是现有 `64.186.227.21` Dokploy，域名是 `https://priceai.io`。数据库、域名、环境变量及数据卷保持现有配置。构建仍由 Dokploy 执行；Actions 提前验证源码，不上传镜像，也不新增长期部署密钥。`GITHUB_TOKEN` 的写权限仅授予发布 job。

## 验证与故障

Web 启动时计算 `scripts/release-fingerprint.mjs` 定义的源码指纹，`/api/health` 返回 `release` 字段且禁止缓存。Actions 等待最多 15 分钟，确认指纹与本次检查一致，再检查首页和两种卡网视图。更新指纹范围时必须保证 Docker 构建上下文和 Actions 源码具有相同文件，依赖、编译产物、隐藏文件和本地环境文件不参与计算。

Actions 成功表示 Web 新代码已就绪，两个 Worker 的运行状态仍在 Dokploy Deployments/Monitoring 中查看。发布分支推进并不表示所有服务已同时更新；数据库变更必须兼容滚动部署。任何检查失败都不会推进发布分支；上线验证失败则工作流标红，保留部署记录，查看 Dokploy 的构建和运行日志。

如果外部 GitHub webhook 未触发，核对 Dokploy GitHub App 的 push 订阅、分支、Autodeploy 及 webhook delivery；不要改为监听 main 来绕过检查。

## 手动重试与回退

Actions 页面运行 `Check and deploy PriceAI`，选择 main，可以重新检查。发布分支已是同一个 SHA 时不会生成新的 push 事件，因此仅重新运行 Actions 不会强制重建同一版本；需要时在 Dokploy 对目标服务点击 Deploy。

普通代码回退用 main 上的 `git revert` 创建新提交，再走相同检查发布流程。紧急回退可以使用 Dokploy 已配置的历史镜像回滚能力；不要假定历史镜像一定保留。数据库迁移不会随应用回退自动撤销，涉及破坏性变更必须单独设计恢复方案。

## 官方参考

- [Dokploy Auto Deploy](https://docs.dokploy.com/docs/core/auto-deploy)
- [GitHub workflow triggers and GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
