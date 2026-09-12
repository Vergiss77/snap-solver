# Tasks: quiz-display-enhancements

## 1. 提示词与解析

- [x] 1.1 `server/src/llm/prompt.ts`：`ANALYSIS_PROMPT` 的 JSON 结构与指令新增 `title` 字段（不超过 15 字题旨概括，非题目时省略）；验证：提示词全文包含 title 字段说明且其余结构不变
- [x] 1.2 `parseQuizResult` 宽容解析 title：非空字符串则保留，否则 `undefined`；验证：用缺 title / title 为非字符串 / title 正常的三份样例 JSON 手动调用解析，行为符合预期且现有字段解析不受影响

## 2. 类型与存储

- [x] 2.1 shared 类型：`QuizResult` 增加 `title?: string`，`SessionSummary`/`RecordDetail` 增加 `title: string | null`；验证：`npm run typecheck` 通过
- [x] 2.2 `server/src/db.ts`：CREATE TABLE 语句与启动迁移（ALTER TABLE ADD COLUMN title TEXT，忽略 duplicate column 错误）双路径；记录写入/查询透传 title；验证：在含旧数据的 `server/data` 上启动服务端无报错，`/api/records` 返回的记录带 `title: null`
- [x] 2.3 分析编排层（scheduler）把 `QuizResult.title` 写入记录；验证：一次真实截图分析完成后，记录详情接口返回非空 title

## 3. 看板展示

- [x] 3.1 `SessionView.tsx`：标题改为 `题型——题旨`（题旨空时仅题型），标题区状态徽记旁显示耗时（done 且 finishedAt 存在时，格式 `耗时 12.3s` / `耗时 2m 05s`，等宽小号）；验证：完成态 session 显示耗时，老记录显示仅题型标题
- [x] 3.2 `HistoryList.tsx`：条目第一行显示 `题型——题旨`（空则仅题型）；验证：列表中新记录显示题旨、老记录不出现异常字符
- [x] 3.3 `styles.css`：`pre` 底色改为 `#3d2b5e`；验证：编程题代码块底色明显变浅且 hljs 高亮仍清晰
- [x] 3.4 答题区宽度拖拽：`.column` 限宽改由 `--column-w` 驱动（默认 760px，`.paper` 放宽为 100% 跟随），列两侧 8px 拖拽手柄（hover 显紫色），拖动按 `clamp(600, startWidth + 2·Δx, 1280)` 对称增减，宽度存 localStorage 并在加载时读取，<760px 手柄隐藏；验证：拖任一侧手柄左右镜像拉伸、刷新后宽度保持、窄屏无手柄

## 4. 回归

- [x] 4.1 全量回归：`npm run build`（web）与 `npm run typecheck` 通过；新截图走完整链路（创建→分析→完成→归档→SSE→看板展示 title 与耗时）；验证：spec delta 中 analysis-orchestration / quiz-archive / web-dashboard 的各 scenario 逐条人工核对
