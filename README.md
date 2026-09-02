# AI Price Intelligence

面向 AI 订阅、账号、充值与 API 服务的价格情报和渠道核验平台。

## 当前状态

项目处于实现阶段。完整产品范围见 [方案总索引](./docs/plans/README.md)，当前实施进度见 [开发状态](./docs/implementation/status.md)。

## 本地启动

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## 工作区

```text
apps/web                    Next.js 前台与管理后台
apps/worker                 BullMQ 采集与发布 Worker
packages/schema             共享领域类型与验证
packages/database           PostgreSQL / Drizzle Schema
packages/collector-sdk      采集器公共接口
packages/classifier         商品分类和属性抽取
packages/source-signatures  发卡系统探测
packages/ranking            报价可用性与排序口径
```

