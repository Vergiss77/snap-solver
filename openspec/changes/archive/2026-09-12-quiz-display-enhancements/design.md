# Design: quiz-display-enhancements

## Context

分析链路：提示词（`ANALYSIS_PROMPT` 常量）要求 LLM 输出单个 JSON → `parseQuizResult` 宽容解析 → `records` 表落库（SQLite，`settings` 之外的结构化表用 CREATE TABLE IF NOT EXISTS）→ SSE 推送 `SessionSummary` → 看板展示。耗时数据现成（`createdAt`/`finishedAt` 已落库）。动机见 proposal.md。

## Goals / Non-Goals

**Goals:**

- 提示词 JSON 契约新增 `title` 字段，解析层宽容兜底
- `records` 表加 `title` 列，存量数据平滑迁移
- 看板标题区与历史列表展示"题型——题旨"，标题区展示耗时
- 代码块底色从 `#26114a` 调浅

**Non-Goals:**

- 不改提示词其余部分的措辞与 JSON 结构（除新增 title 外）
- 不做 title 的后台补生成（老记录保持空 title 回退显示）
- 不动 SSE 事件类型与连接机制

## Decisions

### 1. title 走"提示词契约 + 宽容解析"路线，不加二次调用

在 `ANALYSIS_PROMPT` 的 JSON 示例中加 `"title": "不超过15字的题旨概括"` 与一条指令；`parseQuizResult` 对 title 只做"是字符串且非空则取，否则 undefined"的处理，不进 VALID_TYPES 式强校验。理由：title 是展示增强而非核心数据，不值得为它增加一次 LLM 调用或让分析失败。

### 2. records 表迁移：启动时 `ALTER TABLE ... ADD COLUMN title TEXT`，捕获"列已存在"错误

项目无迁移框架，现有 schema 用 CREATE TABLE IF NOT EXISTS。启动时尝试 ALTER，忽略 duplicate column 错误即可；新库则直接由 CREATE TABLE 带上 title 列（两处都要改，保持建表语句与迁移路径一致）。老记录 title 为 NULL。

### 3. shared 类型：`SessionSummary` 与 `RecordDetail` 增加 `title: string | null`

`QuizResult` 增加 `title?: string`。SSE 摘要自然携带，前端无需新接口。

### 4. 前端展示规则

- 标题：`{typeLabel}——{title}`；title 空时仅 `{typeLabel}`。历史列表条目第二行（meta 行）保持现状，title 并入第一行题型文字
- 耗时：仅在 status 为 done 且 `finishedAt` 存在时显示，格式 `耗时 12.3s`（<60s）或 `耗时 2m 05s`；放在主视图标题区状态徽记旁，等宽字体小号
- 计算用 `createdAt`（到服务端时刻）而非 clientTs（客户端截图时刻），口径为"服务端分析耗时"，避免设备时钟差异

### 5. 代码块底色

`pre` 背景从 `--deep-iris` `#26114a` 调浅为 `#3d2b5e`（保持紫调、提升与浅色文字的对比层次），hljs 高亮色板不变。

### 6. 答题区宽度：侧缘拖拽手柄，双侧对称调整

- `.session-view .column` 的 `max-width` 改为 CSS 变量 `--column-w` 驱动（默认 760px），`.paper` 的 68ch 限制放宽为 100% 跟随列宽——行长约束统一由列宽承担
- 列两侧各一个 8px 宽的拖拽热区手柄（细竖线，hover 显现 `--royal-amethyst`），pointer 事件中 `width = clamp(600, startWidth + 2·Δx, 1280)`——单侧拖动、双侧镜像，保持居中
- 宽度写 `localStorage`（键如 `snap-solver.columnWidth`），加载时读取；纯浏览端偏好，不进服务端设置
- 窄屏（<760px）媒体查询下手柄 `display: none`，列恢复自适应
- 备选的顶栏滑块方案因不如拖拽直觉被否

## Risks / Trade-offs

- **LLM 可能不输出 title 或输出超长 title** → 宽容解析留空回退；超长不截断（提示词约束即可，截断反而可能截出半句话）
- **提示词变长略增 token 成本** → 单条指令 + 一个字段示例，增量可忽略
- **ALTER TABLE 在极端损坏库上失败** → 启动即抛错，与现状（CREATE TABLE 失败同样抛错）行为一致

## Migration Plan

随服务端正常发版；首次启动自动加列。回滚 = revert 代码，title 列残留无害（旧代码不读该列）。

## Open Questions

无。
