"use client";
export default function AccountError({ reset }: { reset: () => void }) {
  return <main className="account-shell"><h1>个人中心暂时无法加载</h1><p>你的登录状态不会因此清除，请稍后重试。</p><button className="account-primary" onClick={reset}>重新加载</button></main>;
}
