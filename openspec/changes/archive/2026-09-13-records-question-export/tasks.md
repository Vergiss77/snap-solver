# Tasks: records-question-export

## 1. 分析契约与存储

- [x] 1.1 `llm/prompt.ts` 默认提示词新增"转写题目原文"步骤与 JSON `question` 字段；`parseQuizResult` 宽容解析 `question`（非字符串/空白 → undefined）；shared 类型 `QuizResult.question?` 与 `RecordDetail.question`；验证：`npm run typecheck` 通过，缺失/非法 question 的样例解析不失败
- [x] 1.2 `db.ts` records 表 `question TEXT` 幂等迁移 + `insertRecord`/`getRecordDetail` 带出；调度器 `archive()` 透传；验证：旧库（无该列）启动自动加列，新分析记录详情含 question

## 2. 看板展示与导出

- [x] 2.1 `SessionView.tsx` 答题区在题旨标题下展示题目描述区块（空则不渲染），元信息行加"导出 Markdown"按钮（done 且 detail 就绪可用）；验证：新旧记录展示分别正确
- [x] 2.2 `export.ts`：`renderMarkdown(detail)`（H1 题旨、元信息行、题目描述/解答/思路分节、fenced 代码带语言）+ `download(filename, content)`（Blob 下载，文件名净化）；验证：单条导出文件内容结构完整
- [x] 2.3 历史操作栏加"导出 (n)"（n=0 禁用，与删除共用选中集互不干扰）：并发拉取选中题详情（并发上限 8），按列表顺序合并分节导出单个 `.md`；拉取失败的跳过并附注；验证：选中 3 题导出为单文件三节，中途被删的题跳过有附注

## 3. 回归

- [x] 3.1 `npm run typecheck` 与 `npm run build`（web）通过；测试服务端走真实 LLM 链路：新分析记录详情含题目描述、答题区展示与单条/批量导出内容正确；逐条核对 spec delta 各 scenario
