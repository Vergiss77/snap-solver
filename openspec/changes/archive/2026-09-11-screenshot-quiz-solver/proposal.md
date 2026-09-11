## Why

用户在两台电脑间需要一条"截图 → 题目识别 → 自动解答 → 归档"的流水线：在一台电脑上以全局快捷键无感截图，另一台电脑上的服务端接收截图并调用云端多模态大模型完成题型分类（选择/填空/简答/编程）与解答生成，结果只在服务端的网页界面展示并自动归档为题目记录。当前项目中不存在任何实现，这是从零搭建整个系统。

## What Changes

- 新增 **Tauri 客户端**（Windows + macOS）：注册可配置的全局快捷键，触发时静默全屏截图（前台无任何显示），通过局域网 HTTP POST 发送到服务端；服务端不可达时静默丢弃截图。
- 新增 **客户端设置窗口**（Tauri + React）：配置快捷键组合、服务端地址与端口，提供"按下以录制"的热键录入和连接测试按钮。macOS 上所需的屏幕录制/输入监控权限由用户在使用前于系统设置中授予一次。
- 新增 **Node.js 服务端**（Fastify）：监听可配置端口，接收截图并为每张截图创建独立的分析会话（session）。
- 新增 **并发分析编排**：每个 session 独立调用 LLM，互不阻塞；新截图到达时前台立即展示新 session 的进度，旧 session 在后台继续分析直至完成；最大并发数可配置（默认全并发，上限防止意外超额）。
- 新增 **多供应商 LLM 适配层**：以 `{baseURL, apiKey, model}` 自由组合配置供应商（GPT、Claude、Gemini、GLM、Kimi、DeepSeek 等），适配 OpenAI 兼容协议与 Anthropic 协议两条路径；模型能力不做硬编码假设。
- 新增 **题目归档**：分析完成的 session 自动持久化为一道题目记录（截图原图、题型分类、解答/思路/代码、时间戳），存储为 SQLite 单文件 + 图片文件。
- 新增 **React 网页前端**：默认聚焦最新 session 的分析进度与结果（SSE 实时推送），侧边栏展示历史题目列表，可回顾任意历史记录；技术选型考虑未来迁移为桌面应用（Tauri 壳）。

## Capabilities

### New Capabilities

- `client-screenshot-capture`: Tauri 客户端的核心捕获能力——可配置全局快捷键、静默全屏截图、截图发送到服务端、服务端不可达时静默丢弃。
- `client-settings-ui`: Tauri 客户端的 React 设置窗口——快捷键录制与配置、服务端地址/端口配置、连接测试。
- `screenshot-ingest-api`: 服务端 HTTP 接收能力——可配置监听端口、接收截图与元信息、会话创建与落盘、连接检测端点。
- `analysis-orchestration`: 服务端并发分析编排——每张截图一个独立 session、并发调 LLM（可配上限）、题型分类与解答生成（编程题含代码）、状态流转与失败处理。
- `llm-provider-adapters`: 多供应商适配层——`{baseURL, apiKey, model}` 配置模型、OpenAI 兼容协议与 Anthropic 协议两条调用路径。
- `quiz-archive`: 题目持久化——session 完成后自动归档为题目记录（截图、题型、解答、时间戳），SQLite 存储，历史查询。
- `web-dashboard`: React 网页前端——最新 session 的实时进度/结果展示（SSE）、历史题目列表与详情回顾、服务端配置（端口、供应商、并发上限）。

### Modified Capabilities

（无——项目无任何既有 spec。）

## Impact

- **新增代码**：`client/`（Tauri 应用：Rust 薄壳 + React 设置窗口）、`server/`（Node.js + Fastify 服务 + React 网页前端）。全部为新建，无既有代码改动。
- **新增依赖**：客户端侧 `tauri`、`tauri-plugin-global-shortcut`、截图 crate（`xcap` 或 `screenshots`）、`reqwest`、React；服务端侧 `fastify`、`better-sqlite3`、`openai`、`@anthropic-ai/sdk`、React + Vite。
- **外部系统**：局域网内客户端→服务端 HTTP 通信；云端 LLM API（OpenAI 兼容端点与 Anthropic 端点）。
- **平台约束**：macOS 客户端需要用户预先授予"屏幕录制"与"输入监控"权限；Windows 开箱即用。
- **已知风险**：Kimi Code 订阅端点（`https://api.kimi.com/coding/v1`）的图片输入支持在文档与实际行为间存在冲突证据，实施中包含一次实测验证（spike），不通则以其他视觉模型作为默认供应商，不影响架构。
