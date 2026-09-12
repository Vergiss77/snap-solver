# Design: server-provider-presets

## Context

供应商配置走 `ConfigPanel.tsx` 表单 + `/api/providers` 系列接口；全局设置（当前仅 `maxConcurrency`）走 settings KV 表（`db.ts` 的 `getSetting/setSetting`）。提示词为 `llm/prompt.ts` 的 `ANALYSIS_PROMPT` 常量，分析调用在 `llm/index.ts` 两条协议路径中直接引用。动机见 proposal.md；实施顺序上依赖 `quiz-display-enhancements` 先落地（默认提示词届时已含 title 约定）。

## Goals / Non-Goals

**Goals:**

- 预设下拉纯前端辅助输入，服务端零感知
- 提示词与编程语言进 settings KV，分析时读取并拼装
- 未配置时行为与现状完全一致

**Non-Goals:**

- 不做流式输出（明确排除）
- 不做提示词版本管理/多份预设切换
- 不改供应商管理的既有接口形状

## Decisions

### 1. 预设下拉：纯前端常量表

前端内置预设表 `{ label, name, protocol, baseUrl, modelHint }`（Kimi 默认选中；DeepSeek/OpenAI/Anthropic/其他）。选择即填充表单字段，之后完全可编辑。不存服务端、不进 API——它只是一次性输入辅助，满足 llm-provider-adapters "不对具体供应商做硬编码假设"的约束（约束针对分析链路，表单预填不构成假设）。

### 2. 提示词配置：settings KV `analysisPrompt`，空值回退内置常量

- `GET /api/settings` 响应扩展 `{ maxConcurrency, analysisPrompt, codeLanguage }`；保存接口同字段扩展
- 分析调用处：`const prompt = settings.analysisPrompt?.trim() || ANALYSIS_PROMPT`，再按需追加语言指令
- 前端 textarea 的预填值 = 服务端返回的生效提示词（即自定义值或内置默认全文），这样用户看到的是"真实将会发送的文本"，编辑起点透明
- "恢复默认"= 保存空字符串（服务端回退），UI 重新拉取后显示内置全文

### 3. 编程语言注入：末尾追加独立指令，不用占位符

```
finalPrompt = userPrompt + (lang ? `\n\n附加要求：若截图为编程题，代码实现必须使用 ${lang}。` : "")
```

理由（探索阶段已确认）：占位符嵌在正文里会被用户编辑时随手删掉；独立追加物理隔离，正文随便改。语言选项为下拉（Python 默认 / Java / C++ / JavaScript / Go / Rust / 不指定），存 KV `codeLanguage`，空串即不注入。

### 4. JSON 契约保护只靠既有宽容解析 + UI 提示

提示词框下放一行小字"可修改指令内容，请保留末尾 JSON 输出结构"。不加结构校验/拦截——`parseQuizResult` 已是宽容解析，破坏契约的最坏结果就是该 session failed 并记录原因（spec 已覆盖此场景）。

## Risks / Trade-offs

- **预设表内置在前端，vendor 改 URL 后过时** → 预填可编辑、有"其他"兜底；过时只影响初始值
- **DeepSeek 预设不支持视觉** → 经用户确认不加提示文案；预填可编辑、有"其他"兜底，选错后分析失败会在 session 错误中体现
- **自定义提示词导致大面积 failed** → 恢复默认按钮一键回退；rawResponse 已落库便于排查

## Migration Plan

纯增量：settings KV 新键缺省即回退，无迁移。回滚 = revert，残留 KV 键无害。

## Open Questions

无。
