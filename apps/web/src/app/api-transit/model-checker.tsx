"use client";

import { useState, type FormEvent } from "react";

interface CheckResult { endpoint: string; modelCount: number; models: string[]; latencyMs: number; test?: { model: string; success: boolean; latencyMs: number; status: number } }

export function ModelChecker() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setResult(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/transit/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: form.get("endpoint"), apiKey: form.get("apiKey"), model: form.get("model") || undefined }) });
      const body = await response.json() as CheckResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "check_failed");
      setResult(body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "check_failed"); }
    finally { setPending(false); }
  }
  return <section className="model-checker"><div><span className="section-kicker">Bring your own key</span><h2>一次性模型检测</h2><p>Key 只用于本次请求，不写入数据库、日志或 Cookie。留空模型名时只读取 <code>/models</code>。</p></div><form onSubmit={submit}>
    <label>API Base URL<input name="endpoint" type="url" placeholder="https://example.com/v1" required maxLength={500} /></label>
    <label>API Key<input name="apiKey" type="password" autoComplete="off" required maxLength={4096} /></label>
    <label>可选模型<input name="model" placeholder="model-id" maxLength={200} /></label>
    <button disabled={pending} type="submit">{pending ? "检测中…" : "开始检测"}</button>
  </form>{error && <p className="form-error">{error}</p>}{result && <div className="check-result"><b>{result.modelCount} 个模型 · {result.latencyMs} ms</b>{result.test && <span>推理测试：{result.test.success ? "成功" : `失败 HTTP ${result.test.status}`} · {result.test.latencyMs} ms</span>}<details><summary>展开模型列表</summary><pre>{result.models.join("\n")}</pre></details></div>}</section>;
}
