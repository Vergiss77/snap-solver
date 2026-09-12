# Analysis Orchestration Specification

## Purpose

服务端的并发分析编排：为每张接收到的截图创建独立会话，并发调用多模态 LLM 完成题型分类与解答生成，新会话不打断进行中的旧会话，分析结果实时可推送。

## Requirements

### Requirement: 独立分析会话

每张接收到的截图 SHALL 对应一个独立的分析会话（session），拥有自己的 LLM 上下文；不同 session 之间 MUST NOT 共享对话历史。session 状态机 MUST 至少包含：待分析（pending）→ 分析中（analyzing）→ 已完成（done）/ 失败（failed）。

#### Scenario: 新截图创建新上下文

- **WHEN** 服务端接收到一张新截图
- **THEN** 创建全新 session，其 LLM 请求不包含任何历史 session 的对话内容

#### Scenario: 上一题未完成时新截图到达

- **WHEN** 一个 session 仍处于 analyzing 状态时新截图到达
- **THEN** 旧 session 继续在后台分析，新 session 正常创建并启动分析，两者互不阻塞

### Requirement: 并发控制

服务端 SHALL 并发执行多个 session 的 LLM 分析，同时进行中的 LLM 请求数 MUST NOT 超过配置的最大并发上限（存在默认值）；超出上限的 session 保持 pending 并按到达顺序启动。

#### Scenario: 并发数未达上限

- **WHEN** 当前进行中的分析数小于上限时新 session 创建
- **THEN** 该 session 立即进入 analyzing 状态

#### Scenario: 达到并发上限

- **WHEN** 进行中的分析数等于上限时新 session 创建
- **THEN** 该 session 保持 pending，直到某个进行中的 session 结束后按到达顺序启动

### Requirement: 题型分类与解答生成

分析流程 SHALL 将截图图像发送给配置的多模态 LLM，要求其判断图像内容是否为题目；若是题目，MUST 分类为选择题、填空题、简答题或编程题之一，生成对应的解答与解题思路，并生成一个不超过 15 字的题旨标题（概括题目所问，如"求二叉树最大深度"）；若为编程题，解答 MUST 包含可运行的代码。题旨标题缺失或无法解析时 MUST 留空回退，MUST NOT 因此导致分析失败。

#### Scenario: 识别为选择题

- **WHEN** LLM 判定截图为选择题
- **THEN** 分析结果包含题型标记"选择题"、正确选项、逐项解析思路与题旨标题

#### Scenario: 识别为编程题

- **WHEN** LLM 判定截图为编程题
- **THEN** 分析结果包含题型标记"编程题"、解题思路、完整代码实现与题旨标题

#### Scenario: 非题目内容

- **WHEN** LLM 判定截图内容不是题目（如桌面、网页、聊天窗口）
- **THEN** 分析结果标记为"非题目"，不含解答内容，该 session 照常完成并归档

#### Scenario: 题旨标题缺失

- **WHEN** LLM 响应中题旨标题字段缺失或格式非法
- **THEN** 该字段按空值处理，分析照常完成，其余字段不受影响

### Requirement: 分析失败处理

LLM 调用失败（网络错误、鉴权失败、限流、响应无法解析）时，session SHALL 进入 failed 状态并记录错误原因；失败 MUST NOT 影响其他 session，且服务端 MUST NOT 自动重试。

#### Scenario: LLM 调用失败

- **WHEN** 某 session 的 LLM 请求返回错误或超时
- **THEN** 该 session 状态变为 failed 并记录错误原因，其他 session 的分析不受影响

### Requirement: 实时进度推送

session 的每次状态变更 SHALL 实时推送到当前连接的网页前端，前端无需轮询或刷新即可感知。

#### Scenario: 状态变更推送

- **WHEN** 任一 session 发生状态变更（创建、开始分析、完成、失败）
- **THEN** 所有已连接的网页前端在数秒内收到包含 session ID 与新状态的事件
