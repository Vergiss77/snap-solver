# Design: server-records-batch-delete

## Context

记录链路：`sessions` 表（状态机 + `image_path`）与 `records` 表（join `session_id`），截图存 `data/images/`。路由仅有 GET；调度器（`scheduler.ts`）为每 session 跑 LLM 任务，重启时从 sessions 表恢复中断会话。SSE 已有 session 状态事件流。需求与删除语义见 proposal.md。

## Goals / Non-Goals

**Goals:**

- 批量删除：数据行 + 截图文件一并清除
- 进行中会话可删：pending 不再调度，analyzing 结果丢弃
- 删除后所有看板即时刷新（SSE）

**Non-Goals:**

- 不做回收站/软删除/恢复
- 不做按条件清理（如"删除 30 天前"）——选中删除是唯一入口
- 不做其他批量操作（导出、重跑等），但 API 形态不堵死后续扩展

## Decisions

### 1. 删除接口：`POST /api/records/batch-delete`，body `{ ids: string[] }`

用 POST 而非 DELETE 带 body（代理/框架兼容性更好，且语义是"批量操作"而非单一资源删除）。服务端事务内删除 `records` 与 `sessions` 行（先 records 后 sessions），随后按 `image_path` 删除截图文件（文件缺失容忍）。返回 `{ deleted: number }`。ID 不存在跳过——天然幂等。

### 2. 进行中会话的取消：以"删除标记"为准，不维护任务句柄

调度器启动任务前查一次 session 是否仍存在（pending→不存在即跳过）；任务完成后 `archive()` 写库前发现 session 行已不存在（外键写入失败/查询为空）即直接丢弃结果。崩溃恢复逻辑天然跳过已删行（查不出来）。这样无需引入 AbortController/任务注册表——LLM 请求照跑完但结果落空，成本是一次作废的 LLM 调用，换来零新增状态机。

### 3. SSE 通知：复用现有事件通道，新增 `records-changed` 事件

删除完成后广播 `{ type: "records-changed" }`；看板收到后重新拉取列表。若主视图正在展示被删 session，回到"等待客户端截图"空态。选中集合存 React state（内存），不做持久化。

### 4. 看板交互

- 每条目左侧 checkbox（点击不触发条目选中跳转——阻止冒泡）
- 列表头部操作栏：全选 / 全不选 + "删除 (n)" 按钮（n=0 时禁用）
- 确认用浏览器 `confirm()` 还是自定义弹层：用 `confirm()`，文案含数量（"将删除 N 条题目及其截图，不可恢复"）——看板内部工具，系统确认框足够且零样式负担
- 进行中的条目同样可选可删（需求定案"全部可删"）

## Risks / Trade-offs

- **analyzing 中删除浪费一次 LLM 调用** → 接受的代价（见决策 2），调用本身无破坏性
- **删除与并发分析完成同时发生** → 事务内删行 + 写库前查存在性，两种交错都收敛到"结果丢弃"
- **多看板同时操作** → 接口幂等 + SSE 广播刷新，后删者对已删 ID 静默跳过

## Migration Plan

纯增量：新接口 + 新 SSE 事件，无表结构变更。回滚 = revert。

## Open Questions

无。
