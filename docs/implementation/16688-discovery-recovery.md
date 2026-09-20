# 16688 货源广场发现失败（2026-09-19）

## 现象与证据

本地按当前采集器的请求复现：`POST /index/SourceCategory/tree` 成功，`POST /index/SourceGoods/list` 使用 `page_no=1, page_size=20, source_category_id=1` 返回：

```json
{"code":0,"msg":"未开启货源商品列表","data":null}
```

16688 当前首页加载的公开前端脚本 `https://16688.oss-accelerate.aliyuncs.com/assets/index/20260917-030914/assets/index.722fa0d0.js` 仍使用上述接口和参数。按其前端逻辑增加匿名访客 UUID 请求头及 cookie 后，仍得到相同业务响应。没有发现可替换的新接口；不能通过客户端修改替平台开启列表。

生产只读查询显示，检查前一小时该发现任务失败 51 次，最近几次错误均为上述消息。分类接口、货源广场发现接口与已有店铺商品采集是不同路径，不把这个错误解释为全部 16688 采集不可用。

## 共享调度修复（2026-09-20）

同一缺陷也导致 `priceai_merchants` 在收到 429 后每小时重试约 50 次。先用现有 `SOURCE_DIRECTORY_PROVIDERS` 将它单独暂停，保留其他三个目录、既有来源采集和杭州链路，再发布共享修复。

- 保留 `lastSuccessfulDiscoveryAt` 语义；共享调度读取最近尝试，成功按原周期执行，失败按持久化的绝对 `retryAt` 等待。
- 429、401/403、16688 明确“未开启货源商品列表”至少等待 24 小时。其他失败 15 分钟起指数退避，最长 24 小时。HTTP `Retry-After` 秒数及日期都被保留，更长的服务端等待不被本地上限截断。
- 未提供成功间隔的 CLI 可以立即复查成功记录，但同样遵守失败冷却。跳过/延期不新增运行记录。
- 每个 provider 用独立 PostgreSQL 会话的 advisory lock 防止并发；网络期间不持有数据库事务。只有本协议标记的 running 记录，在重新取得同一个锁、证明旧会话已消失后才标为 interrupted。历史无归属记录不按年龄自动改写。
- 持续模式有独立的串行发现循环，包含目录、16688、已采目录链接、Telegram 和 GitHub；不再只在启动时运行后三者。成功周期仍为每天，GitHub 每 7 天。每次发现最长 30 分钟，退出信号会取消请求及候选入库。
- GitHub/Telegram 网络和非正常 HTTP 错误不再伪装成空成功；不存在的 README/频道仍按缺失处理。16688 详情请求也不再吞掉限流错误。
- 目录链接与 Telegram 种子改为读取 `sources.latest_complete_run_id`，不排序历史采集记录；只读查询限制为 5 秒、锁等待 500 毫秒。
- 监控使用既有 discovery 元数据：每小时超过 max(4, 正常每小时次数×4) 报告频率异常；24 小时超过 max(12, 正常每日次数×4) 保留历史频率警告；连续失败、从未执行、到期超过 35 分钟仍未运行、running 超过 35 分钟分别报告。启动有 35 分钟宽限。暂停来源显示 paused。
- 受限 SSH 网关新增固定的 `discovery-status` 只读动作，既有约 15 分钟 GitHub 巡检会检查它。故障通知仍依赖账户的 Actions 通知设置；没有另行配置外部消息渠道。

## 发布与回退

本次无数据库结构迁移、大表删除或 vacuum 操作。Web 和共享 Worker 镜像在 GitHub CI 构建；DMIT 仅拉取镜像。发布时观察其他容器运行/健康状态、内存与磁盘；I/O 等待单独作为观测指标，不能仅凭其尖峰停止杭州采集。

上线前保留 `priceai_merchants` 临时暂停；新代码验收后恢复来源配置，它会基于旧 429 记录继续冷却满 24 小时。旧代码回退前必须再次从目录 allowlist 排除该来源，避免恢复失败重试循环。网关脚本需管理员单独备份和同步；不要把仓库提交等同于远程网关已更新。

## 验证

本地 PostgreSQL 回归覆盖：429 后重建连接不重复请求、16688 24 小时冷却及到期恢复、`Retry-After`、普通错误退避、并发互斥、只回收有归属的孤儿记录、GitHub/Telegram 真失败、只读查询和监控。HTTP 使用测试响应，不访问真实平台。调度测试连续跑三轮，确认所有渠道均参与、失败隔离、全程串行和退出取消。

```sh
POLICY_TEST_DATABASE_URL=postgres://priceai_test@127.0.0.1:55439/postgres \
node --import tsx --test packages/pipeline/src/discovery-platforms.integration.test.ts
```

429 回归在原代码上得到 `2 !== 1`，共享退避后通过。CI 纳入 PostgreSQL 集成测试。实际部署版本和生产观察结果记录在本地运维交接文件中；上游恢复必须等自然到期后的请求验证，本修复不代表 16688 或 priceai.cc 已恢复。
