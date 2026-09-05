# 卡网订阅目录

`/channels` 提供按规格比价、全部报价、卡网商家三个视图。`/subscriptions` 复用同一页面。搜索、筛选、排序、每页 24 条的分页均由服务端执行，条件保存在 URL。

## 数据来源

复用现有采集、审核和发布流程，读取 `publication_channels.card_prices` 当前发布批次。页面不发起抓取、不写入演示报价。只有启用且未暂停/移除的来源、有效商家和标准商品会出现；隔离报价与 API 额度排除。

数据库未连接时显示服务不可用并提供重试；连接成功但无已发布报价时显示待接入；筛选无匹配时提供清空筛选。

采集 Worker 后续更新并发布数据后，再次加载页面即可获取新报价。部署时仍需配置真实 `DATABASE_URL`，启动采集服务，并完成渠道收录审核和价格发布。

## 比价口径

- 按标准商品、交付方式、天数、币种、地区、账号归属、质保类型及质保时长分组。
- 期限未知的报价独立列出，不生成最低价。
- 最低价仅取 24 小时内核验、可购买、明确有货/少量库存且数量不为零的报价。
- 库存未知、缺货、过期报价可在全部状态中查阅，但不计入有货最低价。
- 不同币种不直接比较数字。价格排序先按币种分段，再按各自金额排序。
- 规格跳转用分组键保持完整条件，避免将同一产品的其他地区或质保混入。

报价复用现有 `/products/[slug]`、`/merchants/[slug]`、`/out/[offerId]` 和举报入口。举报提交后的目录显示接收提示。

## 验证

在仓库根目录运行：

```sh
node --import tsx --test apps/web/tests/channel-catalog.test.ts
```

默认运行筛选参数测试。设置 `CHANNEL_TEST_DATABASE_URL` 后启用 PostgreSQL 集成测试；测试通过独立连接创建会话临时表，不修改应用数据，连接关闭即清理。

```sh
CHANNEL_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/TEST_DB node --import tsx --test apps/web/tests/channel-catalog.test.ts
npm run typecheck --workspace @price-radar/web
npm run build --workspace @price-radar/web
```
