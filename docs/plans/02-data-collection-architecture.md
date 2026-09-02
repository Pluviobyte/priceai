# 数据采集与系统架构方案

## 1. 总体流水线

```text
X / Grok / 搜索 / 商家投稿 / 聚合站
                    ↓
             Source Candidates
                    ↓
        URL 安全检查与来源身份解析
                    ↓
      系统指纹识别、Probe 与人工准入
                    ↓
               Source Registry
                    ↓
          Scheduler + Job Queue
                    ↓
 API Adapter / HTML Adapter / Browser Worker
                    ↓
            Raw Crawl Snapshot
                    ↓
  分页、数量、字段、价格和库存完整性校验
                    ↓
          Raw Offers 原始事实层
                    ↓
     商品分类、属性抽取、异常检测与审核
                    ↓
      Canonical Product 与有效报价层
                    ↓
            Publish Generation
                    ↓
      搜索、比价、商家页、历史与公共 API
```

## 2. 推荐技术栈

```text
Web 与管理后台：Next.js + TypeScript
数据库：PostgreSQL
队列与调度：Redis + BullMQ
HTTP 采集：Node.js undici/fetch 或 Python httpx Worker
浏览器兜底：独立 Playwright Worker
原始证据与快照：Cloudflare R2 / S3
搜索：PostgreSQL Full Text + pg_trgm
监控：OpenTelemetry + Sentry/兼容错误平台 + 指标面板
```

建议仓库结构：

```text
apps/web                    前台、后台、公共 API
apps/worker                 调度和采集任务
packages/collector-sdk      适配器统一接口
packages/classifier         商品分类与属性抽取
packages/schema             共享类型和数据校验
packages/source-signatures  发卡系统指纹
packages/ranking            排序和最低价口径
```

浏览器 Worker 与 Web 服务隔离，且不能直接访问生产数据库内网。采集结果通过受限队列或写入接口进入 staging。

## 3. 来源发现

候选来源包括：

- 商家和用户投稿；
- Grok/X 中的商家发布、上新和店铺链接；
- 搜索引擎；
- 公开社区；
- 其他比价站的公开 feed；
- 已知发卡平台的搜索、热词和店铺目录。

候选只保存：`merchant_name`、`candidate_url`、`discovery_url`、`platform_hint`、`discovered_at` 和发现方式。不能直接成为正式报价。

## 4. 采集器接口

```ts
interface CollectorAdapter {
  kind: string;

  probe(sourceUrl: string): Promise<ProbeResult>;

  resolveSourceIdentity(
    sourceUrl: string
  ): Promise<SourceIdentity>;

  fetchCatalog(
    source: SourceIdentity,
    cursor?: string
  ): Promise<CatalogPage>;

  validateSnapshot(
    pages: CatalogPage[]
  ): Promise<SnapshotValidation>;

  normalizeItem(
    item: unknown,
    context: CollectorContext
  ): RawOfferInput;
}
```

每轮结果必须返回：

```text
run_status: success / partial / failed
complete_snapshot
expected_total
parsed_total
duplicate_total
source_item_id
raw_title
raw_description
raw_price
currency
stock_count
stock_state
category_raw
product_url
source_updated_at
captured_at
raw_payload_hash
```

## 5. 首批适配器

### Shop API / LDXP 类

典型能力：店铺信息、分类、商品列表、商品详情、价格与数值库存。店铺身份应使用 `platform_kind + shop_token`，不能只使用共享域名。

典型路径：

```text
/shopApi/Shop/info
/shopApi/Shop/categoryList
/shopApi/Shop/goodsList
/shopApi/Shop/goodsInfo
```

### Kami / 异次元类

典型路径：`/user/api/index/commodity`。需要识别分页、商品分类、库存和不同部署版本的字段差异。

### 独角数卡类

典型路径：`/api/v1/public/products`。优先使用公开 API，HTML 只作证据补充和故障降级。

### 其他适配器

- 自定义公开 JSON；
- JSON-LD 或页面内嵌状态；
- 通用 HTML 商品卡片；
- 已知站点专用适配器；
- Playwright 浏览器兜底。

识别顺序：

```text
后台明确指定 collector_kind
→ 已知平台路径/域名
→ 探测公开接口特征
→ 检查 HTML 框架指纹
→ 轻量浏览器试采集
→ unsupported，进入适配器待办
```

## 6. 原始事实与分类

无论分类是否正确，先保存源站原始事实，不用清洗后的字段覆盖原始数据。

分类采用三层模型：

1. 权益产品：ChatGPT Plus、Claude Max 5x 等；
2. 交付方式：自己账号充值、成品号、卡密、团队席位、拼车、网页共享、反代；
3. 商品属性：期限、地区、账号归属、接码、邮箱、质保、自动发货、可用端、共享、发票等。

首版分类技术：

```text
确定性规则
+ 同义词词典
+ 否定词/冲突规则
+ 低置信度人工审核
```

LLM 只能用于提取候选属性、发现同义词和解释低置信度原因，不能无审计地直接决定线上最低价。每次分类输出：

```text
classification
confidence
matched_rules
conflicting_signals
classifier_version
```

## 7. 完整性与失败保护

| 本轮状态 | 数据处理 | 前台行为 |
|---|---|---|
| 完整成功，商品存在 | 更新价格、库存和确认时间 | 正常展示 |
| 完整成功，旧商品消失 | 标记下架或缺货 | 退出最低价 |
| 部分成功 | 只更新本轮看到的商品 | 不批量下架旧数据 |
| 失败，旧数据仍新鲜 | 保留旧报价 | 显示上次确认和本次失败 |
| 连续失败且旧数据过期 | 报价降级 | 退出最低价或隐藏 |
| 库存与状态冲突 | 进入异常队列 | 不参与最低价 |

至少分别保存：

- `last_checked_at`：最后尝试检查；
- `last_success_at`：来源最后有效采集成功；
- `offer_verified_at`：该报价最后在原站确认。

## 8. 价格与库存校验

自动隔离条件包括：

- 价格为空、非有限数字或币种无法识别；
- 将库存、销量、商品编号、`20x` 等误认为价格；
- `stock_count = 0` 但状态为有货；
- 本轮商品数量骤降；
- API 声称的总数与分页抓取数不一致；
- 同一源商品在同一轮出现冲突价格；
- 价格相对历史中位数异常偏离；
- 返回验证码、登录或 WAF 页面；
- HTML 解析器选择器命中异常数量。

异常时原始快照照常保存，但有效报价层不更新或标记隔离。

## 9. Staging 与原子发布

```text
创建 crawl_run
→ 结果写入 staging snapshot
→ 校验分页、数量、字段与哈希
→ 判定 success / partial / failed
→ 更新 raw facts
→ 执行分类和异常检测
→ 生成 publish_generation
→ 原子切换 latest_generation
```

前端消费正式 generation 或只读 API，不直接查询仍在变化的采集 staging。

## 10. 调度策略

初始默认周期可设为 30 分钟，同时采用自适应调度：

- 高频变价店铺提高频率；
- 稳定店铺降低频率；
- 新来源短期提高频率；
- 连续失败指数退避；
- 浏览器来源低频采集；
- 相同 `hostname + platform_kind` 共享并发与限速预算。

必须支持随机抖动、`Retry-After`、单源熔断、任务去重、整轮截止时间和 429/5xx/超时的有限重试。

## 11. URL 投稿与 SSRF 防护

- 只允许 HTTP/HTTPS；
- 阻止 localhost、私网、链路本地和云元数据地址；
- DNS 解析后检查所有目标 IP；
- 每次重定向重新检查目标；
- 限制重定向次数、响应大小和请求时间；
- 采集请求不携带用户 Cookie、认证头；
- 限制投稿频率、批量和来源；
- 使用蜜罐和审核队列；
- 采集 Worker 使用隔离网络和最小权限。

## 12. 官方与中转数据管线

### 官方订阅

配置 App ID、地区和套餐映射；批量读取 App Store/Google Play/官网公开页；保留原币价格、证据 URL、抓取时间和汇率来源；无法精确匹配 SKU 的价格区间不得参与最低价。

### 官方 API

以厂商定价文档为主，保存模型 ID、输入/输出/缓存价格、图片/视频单位、免费层、速率限制、来源 URL、核验时间和文档版本。

### 中转 API

价格来源、稳定性来源分开：

- 站点公开模型目录/倍率页；
- 站点公开监测页；
- 平台自己的无敏感数据探测；
- 人工核验资料。

中转 API 作为独立模块开发，不能复用卡网商品表强行表达全部模型和监控指标。

