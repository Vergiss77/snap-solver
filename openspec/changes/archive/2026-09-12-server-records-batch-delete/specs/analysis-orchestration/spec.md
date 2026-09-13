# Delta: analysis-orchestration

## ADDED Requirements

### Requirement: 删除触发的任务取消

删除 session 时，若其仍处于 pending 或 analyzing 状态，服务端 SHALL 取消其分析：pending 的 session MUST NOT 再被调度启动；analyzing 的 session 的 LLM 响应到达后 MUST 被丢弃（不写入归档、不推送完成事件）。服务端重启后的中断重跑 MUST 跳过已删除的 session。取消本身 MUST NOT 产生错误事件或影响其他 session。

#### Scenario: 删除等待中的会话

- **WHEN** 一个 pending 状态的 session 被删除
- **THEN** 它不再进入 analyzing，调度器如同它从未存在

#### Scenario: 删除分析中的会话

- **WHEN** 一个 analyzing 状态的 session 被删除，随后其 LLM 响应到达
- **THEN** 响应被丢弃，不产生归档记录，看板不出现该题完成的推送

#### Scenario: 重启后不复活已删会话

- **WHEN** 删除进行中会话后服务端重启
- **THEN** 崩溃恢复逻辑不重新调度该 session
