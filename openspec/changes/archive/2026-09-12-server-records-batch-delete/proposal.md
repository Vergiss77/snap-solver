# Proposal: server-records-batch-delete

## Why

历史题目只进不出，长期使用后看板积累大量无用题目（误触发截图、非题目内容），无法清理；需要批量选择与删除能力。

## What Changes

- **题目多选**：看板历史列表每项左侧增加选框，提供全选/全不选；选中态仅在浏览端会话内有效
- **批量删除**：选中后可批量删除题目——session 记录、分析结果与截图文件一并清除，不可恢复；删除前二次确认（显示选中数量）
- **进行中可删**：pending/analyzing 会话同样可删，删除时取消其分析任务；崩溃恢复（重启重跑）不再处理已删除会话
- **实时同步**：删除完成后通过 SSE 通知所有已连接看板刷新列表

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `quiz-archive`: 新增记录删除能力（数据行 + 截图文件的原子清理、批量删除 API）
- `analysis-orchestration`: 新增删除触发的任务取消语义
- `web-dashboard`: 历史列表增加多选与批量操作交互

## Impact

- **服务端**：`db.ts` 新增批量删除（事务内删 sessions/records 行）、删除时清理 `images/` 截图文件；`routes.ts` 新增批量删除接口；调度器支持任务取消并在完成回调中容忍 session 已不存在；SSE 事件类型扩展
- **看板前端**：`HistoryList.tsx` 选框与批量操作栏；`api.ts` 删除接口封装
- **客户端 / shared**：shared 增加 SSE 事件类型（如复用现有事件机制则零改动）
