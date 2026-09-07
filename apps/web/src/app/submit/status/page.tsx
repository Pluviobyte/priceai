import { getPublicSubmissionStatus } from "@/lib/public-submissions";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  submitted: "已提交，等待安全预检",
  prechecked: "安全预检完成，正在识别与试采集",
  trial_crawled: "试采集完成",
  review: "等待人工审核",
  approved: "已通过并进入采集队列",
  rejected: "未通过收录检查",
};

export default async function SubmissionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const validId = typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const submission = validId ? await getPublicSubmissionStatus(id) : null;
  return (
    <main>

      <section className="status-shell">
        <span className="section-kicker">投稿进度</span>
        {submission ? (
          <>
            <h1>{labels[submission.status] ?? submission.status}</h1>
            <dl className="status-details">
              <div><dt>店铺</dt><dd>{submission.name ?? submission.url}</dd></div>
              <div><dt>系统识别</dt><dd>{submission.detectedCollectorKind ?? "等待识别"}</dd></div>
              <div><dt>提交编号</dt><dd>{submission.id}</dd></div>
            </dl>
            <p>页面可稍后刷新查看进度。如需补充证据，可在报价或商家页面提交纠错。</p>
          </>
        ) : (
          <><h1>未找到这条投稿</h1><p>请从提交成功后的状态链接进入，或重新提交店铺。</p></>
        )}
      </section>
    </main>
  );
}
