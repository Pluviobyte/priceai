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
        </div>
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
