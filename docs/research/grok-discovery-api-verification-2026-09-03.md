# Grok 来源发现接口核验（2026-09-03）

## 结论

来源发现实现使用 `POST https://api.x.ai/v1/responses`、`grok-4.6`，同时声明 `x_search` 与 `web_search`。请求限定最多 5 个工具轮次；返回文本里只抽取 URL，经过公网 URL/解析地址安全检查和去重后写入 `source_candidates`。它不会写入报价表，也不会把 X 帖子当价格证据。

## 一手依据

- [xAI X Search](https://docs.x.ai/developers/tools/x-search)：官方 Responses API 示例使用 `grok-4.6` 和 `{ "type": "x_search" }`。
- [xAI Tools Overview](https://docs.x.ai/developers/tools/overview)：官方示例确认 `web_search`、`x_search` 可以在同一 Responses 请求中启用。
- [xAI Tool Usage Details](https://docs.x.ai/developers/tools/tool-usage-details)：说明 Responses 输出中工具调用类型及 `max_turns` 的用途。

## 稳定性边界

缺少 `XAI_API_KEY` 时任务不会启动；429、鉴权失败或协议变化会记录失败的 discovery run，不影响现有来源和已发布价格。运营必须在候选后台将 URL 转入安全预检，之后仍需完整试采和人工审核。
