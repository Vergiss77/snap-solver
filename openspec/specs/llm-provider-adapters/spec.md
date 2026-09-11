# Llm Provider Adapters Specification

## Purpose

多供应商 LLM 适配层：以 baseURL + API Key + 模型名的自由组合接入各家云端多模态大模型，统一为服务端分析流程提供图像问答能力，供应商协议差异对上层透明。

## Requirements

### Requirement: 供应商配置

服务端 SHALL 支持配置一个或多个 LLM 供应商，每个供应商配置 MUST 由 `{baseURL, apiKey, model}` 三元组加协议类型构成，并指定其中一个为当前生效供应商。配置 MUST 可在网页界面修改并即时生效，无需重启服务端。系统 MUST NOT 对具体供应商或模型能力做硬编码假设。

#### Scenario: 添加供应商

- **WHEN** 用户在配置中新增一个供应商（baseURL、apiKey、model、协议类型）并设为生效
- **THEN** 后续 session 的分析请求发往该供应商的 baseURL，使用其 apiKey 与 model

#### Scenario: 切换生效供应商

- **WHEN** 用户将生效供应商从 A 切换为 B
- **THEN** 切换后创建的新 session 使用 B 发起分析，进行中的 session 继续使用 A 直至完成

### Requirement: 双协议适配

适配层 SHALL 支持两种调用协议：OpenAI 兼容协议（适用于 GPT、DeepSeek、GLM、Kimi、Gemini OpenAI 兼容端点等）与 Anthropic 协议。对上层分析流程，两条路径 MUST 暴露统一的"图像 + 提示词 → 结构化文本结果"接口。

#### Scenario: OpenAI 兼容供应商调用

- **WHEN** 生效供应商配置为 OpenAI 兼容协议
- **THEN** 适配层以 OpenAI Chat Completions 格式发送包含 base64 图像的请求并解析响应文本

#### Scenario: Anthropic 供应商调用

- **WHEN** 生效供应商配置为 Anthropic 协议
- **THEN** 适配层以 Anthropic Messages 格式发送包含 base64 图像的请求并解析响应文本

### Requirement: 供应商错误透传

供应商调用产生的错误（HTTP 状态码、错误消息、超时）SHALL 被保留并传递给分析编排层记录，MUST NOT 被吞掉或替换为无信息量的通用错误。

#### Scenario: 鉴权失败

- **WHEN** 供应商返回 401/403
- **THEN** 对应 session 进入 failed 状态，错误详情包含供应商返回的状态码与消息

### Requirement: 模型列表加载

服务端 SHALL 提供按供应商连接参数（协议、baseURL、apiKey）拉取可用模型列表的接口，供配置界面以可筛选下拉选项呈现；模型字段 MUST 同时保留自由输入能力（列表加载失败或模型不在列表中时不阻塞配置）。apiKey MUST 仅通过请求体传输，不出现在 URL 中。

#### Scenario: 拉取模型列表成功

- **WHEN** 用户填写协议、baseURL、apiKey 后点击"加载模型"，且端点支持模型列表查询
- **THEN** 模型输入框获得可供选择的模型 id 下拉选项

#### Scenario: 端点不支持模型列表

- **WHEN** 目标端点无模型列表接口或返回错误
- **THEN** 界面显示具体错误（含 HTTP 状态码与消息），模型字段仍可手动输入

### Requirement: 供应商连通性测试

服务端 SHALL 提供对一组供应商连接参数（协议、baseURL、apiKey、model）发起最小化真实调用的测试接口，返回成功（含往返延迟）或具体错误；该测试 MUST NOT 创建分析 session 或写入任何持久化记录。

#### Scenario: 连通性测试成功

- **WHEN** 用户填写完整供应商参数并点击"测试连通性"，且端点可用
- **THEN** 界面显示成功与往返耗时

#### Scenario: 连通性测试失败

- **WHEN** 端点鉴权失败、模型不存在或网络不可达
- **THEN** 界面显示失败原因（HTTP 状态码与供应商错误消息），不产生任何 session 或归档记录
