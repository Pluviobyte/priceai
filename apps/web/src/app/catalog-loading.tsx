import styles from "./catalog-loading.module.css";

export function CatalogLoading({ title }: { title: string }) {
  return <main className={`priceai-catalog-shell ${styles.shell}`} aria-busy="true">
    <header><p className="priceai-kicker">PriceAI · 公开价格</p><p className={styles.title}>{title}</p></header>
    <span className="sr-only" role="status">正在读取页面数据</span>
    <div className={styles.filters} aria-hidden="true" />
    <div className={styles.rows} aria-hidden="true">{[0, 1, 2, 3].map(row => <div key={row}><span /><span /><span /></div>)}</div>
  </main>;
}
