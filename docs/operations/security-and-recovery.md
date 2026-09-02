# 安全隔离与恢复运行手册

## 进程边界

- Web 使用 `DATABASE_URL`（`price_radar_web`），不持有 Redis 或浏览器执行权限。
- 普通 Worker 使用 `WORKER_DATABASE_URL`，只运行 API/HTML/Feed 采集、发布和通知。
- Browser Worker 使用 `BROWSER_DATABASE_URL`（`price_radar_browser`），独立队列 `browser-source-jobs`、默认并发 1；它只能写采集运行、原始快照、租约和遥测。完整抓取后只向主 Worker 发发布消息。
- Browser Collector 拒绝登录、验证码和 WAF 绕过，禁用下载、Service Worker、图片、媒体与字体。

生产环境先以 `psql -v web_password=... -v worker_password=... -v browser_password=... -f deploy/database-roles.sql` 建立三个不同账号。对象存储也应给主 Worker 与 Browser Worker 分配不同 Access Key，并将 Browser Key 限定在原始证据前缀。

## 备份与恢复

`scripts/backup.sh /明确的备份目录` 生成 PostgreSQL custom dump、对象存储镜像、清单和逐文件 SHA-256。备份目录必须进入加密、异地且有保留期的存储。

恢复必须明确指定新数据库和新桶，并用 `CONFIRM_RESTORE` 二次确认：

```bash
RESTORE_DATABASE=price_radar_restore RESTORE_BUCKET=price-radar-restore CONFIRM_RESTORE=price_radar_restore scripts/restore.sh /backup/path
```

`scripts/restore-drill.sh /backup/path` 会恢复到隔离数据库/桶，比较来源、原始快照和发布代数后删除演练数据库。上线后每月至少执行一次，记录时间、备份 ID、计数和异常。
