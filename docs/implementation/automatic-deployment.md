# PriceAI 自动发布

## 发布链路（2026-09-14 镜像迁移）

`main` → Actions 检查 → CI 构建 Web、共享 Worker → GHCR → 镜像冒烟测试 → 生产逐个拉取/部署 digest → 三服务健康和线上页面验收 → 推进 `codex/production`。

生产机器不运行 PriceAI Docker build。三个 Dokploy 应用保持原有域名、数据库、环境、网络和卷，Provider 改为 Docker；两个 Worker 使用同一镜像，各自独立运行。Channel 的命令是 `/usr/bin/tini -g -- node --import tsx apps/worker/src/channel-worker.ts`，Official 对应 `official-subscriptions.ts`。Dokploy 的 command 覆盖 ENTRYPOINT，因此网关将 command 设为 `/usr/bin/tini -g --`，将 node 及各入口路径放入 args，避免丢失 tini 或重复继承默认 CMD。

`.github/workflows/production.yml` 串行执行整个发布，不取消正在部署的版本。PR 只检查。部署前检查 main 是否仍指向当前提交，防止过时运行覆盖新版本。发布分支是成功上线的比较基线，不再触发源码构建。

## 文档与依赖缓存

`release-changes.mjs` 只豁免根 README、LICENSE 和 `docs/`。工作流、Dockerfile、锁文件、构建配置、应用内 Markdown 和未知路径均触发检查/发布。main 与上次成功发布比较，避免前一次失败/取消的代码改动被后来的文档提交掩盖。纯文档运行只执行轻量路径检查，不构建或部署。手动运行可强制重新检查发布。

两个 Dockerfile 先复制根和全部 workspace 清单，再 npm ci，最后复制源码；Worker 的系统包、npm、Chromium 分层。新增 workspace 时，清单完整性测试会提醒更新 Dockerfile。CI 使用两个独立 GHA cache scope，并在首次构建后修改一个源码输入，实际验证 npm 和 Chromium 安装层仍为 CACHED。

仓库文档、本地运维交接文件和工作流不进入镜像。发布指纹涵盖 apps/packages/deploy/scripts、Dockerfile、根依赖与锁文件、tsconfig 和 `.dockerignore`。Web 保留启动迁移所需依赖，不在本次迁移中改动数据库迁移方案。

## 凭据与部署入口

仓库 Secrets：`PRICEAI_DEPLOY_SSH_KEY`、`PRICEAI_DEPLOY_KNOWN_HOSTS`。这是专用受限密钥，不复用日常管理员私钥；服务器 authorized_keys 使用 `restrict,command="/usr/local/sbin/priceai-release-gateway"`，不能执行任意 shell、转发或访问其他应用。脚本是 root 所有，仅接受 deploy/rollback/status、两个固定 PriceAI 仓库的 sha256 digest 和合法版本标识。

CI 使用短期 `GITHUB_TOKEN` 上传/拉取 GHCR。网关验证架构、revision、源码指纹标签，再调用 Dokploy 本机部署 webhook。为避免给 CI 一个全站管理员 API token，网关仅定向更新 Dokploy 0.28.8 的三条 application 配置；这依赖当前 Dokploy schema，升级 Dokploy 时应先验证兼容性。每次变更前保存完整配置到 `/etc/priceai-release/before-*.json`，其中可能含凭据，禁止公开。

自动部署开关常态关闭，仅在网关调用本机 webhook 时短暂打开，随后关闭。部署记录仍出现在 Dokploy。短期 registry 密码在完成或失败时从 application 清除，并恢复 Dokploy 原有 GHCR 登录项；镜像可能保持私有，日后应从 Actions 重新发布/回滚取得新令牌，不依赖 Dokploy 的手动拉取按钮或过期令牌。

服务器安装脚本需要单独通过管理员 SSH 更新；推送仓库不会让 CI 获得修改 root 网关的权限。

## 验收与回滚

CI 检查类型、单元测试、临时 PostgreSQL 迁移与 SQL 集成、生产构建。镜像测试使用实际 digest，核对运行时指纹、启动 Chromium、启动 Web 并自动迁移临时库；随后停止临时 PostgreSQL，断言 `/api/health` 为 503。

生产按 Web、Official、Channel 顺序部署，逐个等待 Dokploy done、运行镜像一致、Docker health=healthy。最后检查公网 readiness、数据库和源码版本，再由 Actions 验证首页及卡网页面。失败即停止推进，保留 pending 清单和配置备份；不自动回退数据库。

`/etc/priceai-release/current.json`、`previous.json` 保存已验证版本的两种 digest；不含 registry token。Actions 手动运行勾选 `rollback`，可直接恢复上一个已验证镜像版本，不重新构建，不撤销数据库迁移。如果存在失败/中断的 pending.json，则恢复 current.json（最近成功版本），而不是跳过它去恢复更老的 previous.json。首次镜像迁移尚无 previous.json，旧的本地命名镜像与迁移前配置备份保留用于管理员恢复；后续两次成功版本后具备镜像自动回滚入口。普通修复仍通过 main 提交发布。

## 容量和告警

网关在磁盘使用率达到 85%、可用空间低于 15 GiB，或 inode 使用率达到 85% 时拒绝开始部署。

`priceai-capacity-maintenance.timer` 每天运行：清理超过 24 小时的可回收构建缓存，以 4GB 为保留目标；仅删除旧 PriceAI 镜像引用，保留 current/previous/pending，且不强制删除被容器使用的镜像。发布与清理共用锁。清理不是磁盘硬配额，不处理数据库卷，也不修改其他项目的日志设置。

`.github/workflows/production-monitor.yml` 约每 15 分钟从 GitHub 外部检查磁盘、inode、三服务和公网数据库 readiness；超过 80% 或可用空间少于 20 GiB 会失败。`PRICEAI_MONITOR_ENABLED=true` 才启用。Actions 调度可能延迟，通知是否送达由用户 GitHub Actions 通知设置决定；这不是已经接通 Telegram/邮件的独立告警系统。

## 运维状态

本次初始状态：三个应用和 PriceAI 数据库均停止；磁盘 92%、约13GB可用。已关闭三个应用旧自动构建，安全备份配置；清理可再生成的构建缓存和无标签旧镜像后，磁盘约62%、58GB可用，数据库卷和当前命名镜像保留。最终提交、CI、恢复运行和生产指纹以交接记录中的最终验收为准。
