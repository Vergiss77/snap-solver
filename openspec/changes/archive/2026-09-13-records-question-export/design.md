# Design: records-question-export

## Context

分析契约现状：`QuizResult`（type/title/answer/reasoning/code/codeLanguage），提示词在 `llm/prompt.ts` 定义 JSON 结构并宽容解析。records 表已有 `title` 迁移先例（try/catch `ALTER TABLE` 忽略重复列）。看板批量操作（多选/删除）刚落地，操作栏在 `HistoryList.tsx`。需求见 proposal.md。

## Goals / Non-Goals

**Goals:**

- LLM 转写题目原文入库、答题区可见
- 单条 + 多选合并的 Markdown 导出，纯前端实现

**Non-Goals:**

- 不导出截图图片（单文件 md 中图片引用不可达；base64 内嵌臃肿，均排除）
- 不做导出格式定制（模板/PDF/docx）
- 不改批量删除既有交互

## Decisions

### 1. `question` 字段：沿 title 的全套既有模式

- 提示词加"转写题目原文"步骤与 JSON 字段 `question`（string）
- `parseQuizResult` 宽容解析：非字符串或空白 → `undefined`，与 title 同一容错路径
- records 表 `question TEXT` 列，`ALTER TABLE` 幂等迁移；`insertRecord`/`getRecordDetail` 带出；列表摘要（`SessionSummary`）不带——描述较长，只在详情返回
- 调度器 `archive()` 透传 `result.question ?? null`
- 存量记录与"非题目"类型均为 null，前端不渲染该区块

### 2. 导出：纯前端拼接 + Blob 下载

```
单条: SessionView 已有 detail → renderMarkdown(detail) → Blob → a[download] 点击
批量: 对选中 ids 并发 api.recordDetail(id) → 按列表顺序 renderMarkdown 分节 → 单个 Blob
```

- `export.ts` 工具模块：`renderMarkdown(detail): string`（题旨标题作 H1，题型/时间作元信息行，题目描述/解答/思路分节，代码包 fenced block 带语言）+ `download(filename, content)`（Blob + URL.createObjectURL）
- 文件名：单条用题旨标题（无标题回退 `题目-<短id>`），批量用 `snap-solver-导出-<日期>.md`；文件名净化非法字符
- 代码语言缺失时 fence 不带标注；`codeLanguage` 值（如 `cpp`）直接作 fence 语言
- 批量拉取失败（如记录中途被删）跳过该题并在下载内容尾部附注，不整体失败

### 3. UI 落点

- 答题区顶部元信息行（题型/耗时旁）加"导出 Markdown"幽灵按钮，仅 done 且 detail 已加载时可用
- 历史操作栏在"删除 (n)"旁加"导出 (n)"，同样 n=0 禁用；与删除共用选中集，互不影响

## Risks / Trade-offs

- **LLM 对新字段的遵从度**：宽容解析兜底，缺失即空不影响主流程；提示词改动对存量自定义提示词用户不生效（他们的提示词无 question 指令）→ 行为等同"该字段恒为空"，可接受，配置界面提示词预置全文会随默认值更新
- **批量并发拉取大列表**：全选几百题时并发请求详情 → 局域网场景量级可控；设并发上限（如 8）顺序消费

## Migration Plan

`ALTER TABLE records ADD COLUMN question TEXT` 幂等迁移，旧记录为 NULL。回滚 = revert，残留列无害。

## Open Questions

无。
