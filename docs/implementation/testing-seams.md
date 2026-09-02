# 建议确认的行为测试边界

TDD 测试只通过公开接口验证行为，不耦合内部实现。建议确认以下 seam：

1. **CollectorAdapter**：给定公开响应 fixture，输出完整、部分或失败的标准采集结果。
2. **SourceProbe**：给定来源 URL 与公开响应特征，识别平台、店铺身份和适配器类型。
3. **OfferClassifier**：给定原始标题和描述，输出标准产品、交付方式、属性、风险事实及置信度。
4. **OfferEligibility**：给定价格、库存、新鲜度和异常状态，决定是否参与默认最低价。
5. **SnapshotPublisher**：只有完整且通过校验的 staging generation 可以原子发布；失败版本不覆盖上一版。
6. **Public Query API**：通过 HTTP 验证商品列表、报价筛选、商家详情和来源证据。
7. **Submission API**：通过 HTTP 验证 URL 安全、限流、重复提交和状态迁移。
8. **Admin Workflow**：通过服务层验证审核、人工修正、举报处理和审计日志。

用户确认这些 seam 后，核心行为按 red → green 的垂直切片实现。

