import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminDashboard } from "@/lib/admin-data";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

const anomalyLabels: Record<string, string> = {
  implausible_price: "价格不合理",
  stock_conflict: "库存矛盾",
  unclassified_product: "未分类商品",
  low_classification_confidence: "低置信分类",
  large_price_change: "价格大幅变化",
  peer_price_outlier: "同类价格离群",
};

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const dashboard = await getAdminDashboard();

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="section-kicker">运营与数据治理</span>
          <h1>审核后台</h1>
        </div>
        <AdminNav />
      </header>

      <section className="admin-summary">
        <article><b>{dashboard.reviews.length}</b><span>待审核商品</span></article>
        {dashboard.anomalies.map((anomaly) => (
          <article key={`${anomaly.kind}:${anomaly.severity}`}>
            <b>{anomaly.count}</b>
            <span>{anomalyLabels[anomaly.kind] ?? anomaly.kind} · {anomaly.severity}</span>
          </article>
        ))}
      </section>

      <section className="review-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">分类队列</span>
            <h2>逐条确认商品归属</h2>
          </div>
          <a href="/api/admin/classification-rule-patch">导出人工判断规则补丁 JSON</a>
        </div>
        {dashboard.reviews.length > 0 ? (
          <form className="batch-review" action="/api/admin/reviews/batch" method="post">
            <div className="batch-review-list">
              {dashboard.reviews.map((item) => (
                <label key={item.matchId}>
                  <input type="checkbox" name="matchIds" value={item.matchId} />
                  <span><b>{item.title}</b><small>{item.sourceName} · {item.productSlug ?? "未归类"}</small></span>
                </label>
              ))}
            </div>
            <div className="batch-review-controls">
              <select name="canonicalProductSlug" defaultValue="">
                <option value="">保留各自当前分类</option>
                {dashboard.products.map((product) => <option value={product.slug} key={product.slug}>{product.name}</option>)}
              </select>
              <input name="reason" minLength={2} placeholder="批量审核理由" required />
              <button name="action" value="approve" type="submit">批量确认当前分类</button>
              <button name="action" value="correct" type="submit">批量修正为所选产品</button>
              <button className="danger" name="action" value="reject" type="submit">批量排除</button>
            </div>
          </form>
        ) : null}
        <div className="review-list">
          {dashboard.reviews.length === 0 ? (
            <div className="empty-state">当前没有待审核商品。</div>
          ) : dashboard.reviews.map((item) => (
            <article className="review-card" key={item.matchId}>
              <div className="review-facts">
                <span>{item.sourceName}</span>
                <span>{item.category ?? "未分类目录"}</span>
                <span>置信度 {Number(item.confidence).toFixed(2)}</span>
              </div>
              <h3>{item.title}</h3>
              <div className="review-price">{item.price ? `¥${Number(item.price).toFixed(2)}` : "价格缺失"}</div>
              <form action={`/api/admin/reviews/${item.matchId}`} method="post" className="review-form">
                <label>
                  标准产品
                  <select name="canonicalProductSlug" defaultValue={item.productSlug ?? ""}>
                    <option value="">请选择</option>
                    {dashboard.products.map((product) => (
                      <option value={product.slug} key={product.slug}>{product.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  审核理由
                  <input name="reason" minLength={2} placeholder="说明判断依据" required />
                </label>
                <div className="review-actions">
                  <button type="submit" name="action" value="approve">确认当前分类</button>
                  <button type="submit" name="action" value="correct">修正并通过</button>
                  <button className="danger" type="submit" name="action" value="reject">排除商品</button>
                </div>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
