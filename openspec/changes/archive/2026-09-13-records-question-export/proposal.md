# Proposal: records-question-export

## Why

答题区只有解答内容，用户看不到 LLM 从截图中识别出的题目原文，无法核对"AI 是否看对了题"；同时题目记录无法导出，难以整理成可分享的笔记/错题本。

## What Changes

- **题目描述字段**：LLM 分析契约新增 `question`（截图中题目原文的转写），宽容解析缺失回退空；records 表加列迁移；答题区在解答前展示题目描述，历史记录为空则不显示
- **Markdown 导出**：答题区提供"导出 Markdown"按钮下载当前题目的 `.md`；历史列表多选后支持"导出 (n)"，将选中题目合并为单个分节 `.md` 下载。导出内容含题旨标题、题型、题目描述、解答、思路与代码，不含截图图片
- 导出为纯前端拼接（复用详情接口逐条拉取），服务端无新增接口

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `analysis-orchestration`: 分析输出契约新增题目描述字段
- `quiz-archive`: 记录新增题目描述字段（存量空值兼容）
- `web-dashboard`: 答题区展示题目描述；新增 Markdown 导出（单条 + 多选合并）

## Impact

- **服务端**：`llm/prompt.ts` 提示词契约加 `question`；`parseQuizResult` 解析新字段；`db.ts` records 加列（幂等迁移）与查询带出；调度器归档写入
- **看板前端**：`SessionView.tsx` 题目描述区块与单条导出；`HistoryList.tsx`/操作栏批量导出入口；`api.ts` 无需新增接口
- **shared**：`QuizResult.question?`、`RecordDetail.question`
- **客户端**：无影响
