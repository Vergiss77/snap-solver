# Delta: quiz-archive

## ADDED Requirements

### Requirement: 记录批量删除

服务端 SHALL 提供批量删除题目记录的接口，接收一组 session ID。删除 MUST 同时清除：sessions 与 records 表中的对应数据行、数据目录下对应的截图图像文件。删除不可恢复，接口 MUST NOT 提供静默恢复路径。删除完成后服务端 MUST 通过 SSE 通知所有已连接看板记录列表已变化。不存在或已被删除的 ID MUST 被容忍（跳过而非报错）。

#### Scenario: 批量删除选中题目

- **WHEN** 前端提交一组待删除的 session ID
- **THEN** 这些 session 的数据行与截图文件被清除，接口返回实际删除数量，已连接看板收到列表变更推送

#### Scenario: 删除后不可查询

- **WHEN** 某条记录被删除后，前端再按 ID 请求其详情
- **THEN** 接口返回未找到，历史列表中不再出现该记录

#### Scenario: 部分 ID 不存在

- **WHEN** 提交的 ID 列表中包含已不存在或已被删除的 ID
- **THEN** 存在的记录正常删除，不存在的 ID 被跳过，接口照常返回成功与实际删除数量
