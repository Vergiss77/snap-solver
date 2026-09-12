# Proposal: quiz-display-enhancements

## Why

看板题目信息密度不足：标题只有题型（"选择题"），无法快速区分题目内容；分析耗时不可见，用户无法感知 LLM 响应速度；代码块深紫底色偏暗，阅读吃力。

## What Changes

- **AI 题旨标题**：分析提示词的 JSON 输出新增 `title` 字段（≤15 字概括题旨）；题目记录与 SSE 摘要携带 title；看板标题与历史列表显示"题型——题旨"（如"选择题——求二叉树最大深度"），老记录或解析缺失 title 时回退为仅题型名
- **解题耗时显示**：看板主视图标题区展示分析耗时（`finishedAt - createdAt`，秒级），数据字段已存在，纯前端呈现
- **代码块底色调浅**：Deep Iris `#26114a` 调整为更亮的紫（浅色界面下的代码可读性）
- **答题区宽度可调**：阅读列支持侧缘手柄拖拽，左右对称拉伸/缩窄（600–1280px 钳制），宽度按浏览端 localStorage 持久化，窄屏禁用

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `analysis-orchestration`: "题型分类与解答生成"需求扩展——分析输出新增题旨标题（title）字段
- `quiz-archive`: "自动归档"与"历史查询"需求扩展——题目记录与列表摘要新增 title 字段
- `web-dashboard`: "最新会话实时视图"与"历史题目浏览"需求扩展——标题区展示题旨与分析耗时

## Impact

- **提示词**：`ANALYSIS_PROMPT` JSON 结构新增 `title`；`parseQuizResult` 宽容解析（title 缺失/非法时留空，不致分析失败）
- **数据库**：`records` 表新增 `title` 列（SQLite ALTER TABLE 迁移，老数据为 NULL）
- **API/SSE**：`SessionSummary` 与 `RecordDetail` 增加 `title` 字段（shared 类型变更）
- **前端**：`SessionView.tsx` / `HistoryList.tsx` 标题与耗时展示；`styles.css` 代码块配色
- **客户端**：无影响
