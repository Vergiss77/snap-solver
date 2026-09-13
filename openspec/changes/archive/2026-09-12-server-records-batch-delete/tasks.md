# Tasks: server-records-batch-delete

## 1. 服务端：批量删除

- [x] 1.1 `db.ts` 新增批量删除：事务内删 `records` + `sessions` 行，返回实际删除数；随后按 `image_path` 清理截图文件（缺失容忍）；验证：对含多条记录的测试库调用后，行与文件均不存在，不存在 ID 静默跳过
- [x] 1.2 `routes.ts` 新增 `POST /api/records/batch-delete`（body `{ids: string[]}`，校验为非空字符串数组），删除完成后广播 SSE `records-changed`；`api.ts` 看板侧封装；验证：curl 删除后返回 `{deleted}`，SSE 客户端收到事件
- [x] 1.3 调度器取消语义：启动任务前检查 session 存在性（pending 被删则跳过）；`archive()` 写库前发现 session 已删则丢弃结果不推送完成事件；验证：删除 analyzing 会话后其 LLM 结果落地时不产生记录与事件，重启不复活已删会话

## 2. 看板：多选与删除

- [x] 2.1 `HistoryList.tsx` 条目左侧选框（点击阻止冒泡，不触发跳转），头部操作栏：全选/全不选 + "删除 (n)"（n=0 禁用）；选中集存 React state；验证：勾选/全选/全不选状态正确，条目点击跳转行为不变
- [x] 2.2 删除流程：`confirm()` 二次确认（文案含数量与"不可恢复"）→ 调批量删除接口 → 本地移除条目；主视图正在展示被删题目时回到等待态；收到 SSE `records-changed` 时刷新列表并清掉失效选中项；验证：双开看板，一端删除后另一端列表同步

## 3. 回归

- [x] 3.1 `npm run typecheck` 与 `npm run build`（web）通过；起测试服务端走完整链路：截图→分析→归档→多选删除→列表/详情/文件三方确认清除；逐条核对 spec delta 中 quiz-archive / analysis-orchestration / web-dashboard 的 scenario
