## Context

全新仓库，无任何既有代码（仅有 OpenSpec 骨架）。系统由两个可独立部署的进程组成：Tauri 客户端（截图端）与 Node.js 服务端（接收 + 分析 + 展示端），通过局域网 HTTP 通信。需求动机与范围见 proposal.md；各能力的行为契约见 `specs/*/spec.md`，本文只记录技术决策与理由。

## Goals / Non-Goals

**Goals:**

- 一套代码同时支持 Windows 与 macOS 客户端；服务端跨平台（Node 天然满足）
- 截图 → 分析 → 归档全链路异步，多张截图并发分析互不阻塞
- 供应商可插拔：不改代码即可接入任何 OpenAI 兼容或 Anthropic 协议的端点
- 前端工程可低改造成 Tauri 桌面应用（预留迁移路径）

**Non-Goals:**

- 服务端自动发现（mDNS/UDP 广播）——初版手动配置 IP+端口
- 截图离线缓存与补发——不可达即静默丢弃
- 用户体系、鉴权、多客户端管理——局域网信任环境，无认证
- 本地模型（Ollama 等）——只做云端 API
- 流式逐字输出解答——初版一次性返回完整结果，SSE 只推状态

## Decisions

### 整体拓扑与仓库结构

```
snap-solver/                      (单一 git 仓库, npm workspaces)
  client/                           Tauri 2 应用
    src/                            React 设置窗口 (Vite 构建)
    src-tauri/                      Rust 薄壳
  server/                           Node.js 20+ (ESM, TypeScript)
    src/                            Fastify 服务
    web/                            React 网页前端 (Vite 构建, 由 Fastify 托管静态产物)
  openspec/
```

单仓库 npm workspaces：服务端与两个前端共享 TypeScript 类型定义（协议类型、session 状态枚举），避免两端漂移。

### 客户端：Tauri 2 + Rust 薄壳，而非 Node 客户端

**决策**：客户端能力全部由 Rust 侧承担——全局热键用 `tauri-plugin-global-shortcut`，截图用 `xcap` crate（Win/macOS 均支持，返回内存位图，不触发系统 UI），HTTP 发送用 `reqwest`，托盘用 Tauri 原生 API。React 设置窗口只负责配置表单与热键录制（网页内捕获 keydown 组合，发给 Rust 侧注册）。

**理由**：`tauri-plugin-global-shortcut` 是维护中的一等公民插件，在 macOS 上的权限表现（输入监控）比 Node 生态的 `uiohook-napi`（社区fork、预编译二进制兼容性差）可靠得多；xcap 静默截图在两个平台都是纯内存操作。Tauri 产物约 10MB，Electron 方案约 150MB 被否掉。

**备选已否**：纯 Node 客户端（热键/截图库质量不足）、Electron（体积）、Tauri 设置页改为 localhost 网页（既然要托盘常驻+未来桌面化，Tauri 一步到位，且与网页前端共享 React 技术栈）。

### 通信协议：单向 HTTP POST + SSE 下行

```
 客户端                     服务端
   │  POST /api/screenshots  │   Content-Type: multipart/form-data
   │ ───────────────────────>│   字段: image (PNG), clientTs
   │  202 { sessionId }      │   落盘后立即返回, 不等分析
   │                         │
 浏览器                      │
   │  GET /api/events (SSE)  │   事件: session.created / .started /
   │ <═══════════════════════│        .done / .failed
   │  GET /api/records[...]  │   历史列表/详情 (JSON)
   │  GET /api/health        │   连接检测
```

**决策**：截图上行用 HTTP POST（multipart），前端实时更新用 SSE，不用 WebSocket。

**理由**：数据流天然单向——客户端只发，浏览器只收状态。SSE 是 HTTP 长连接，Fastify 原生支持，断线自动重连由浏览器 EventSource 免费获得；WebSocket 的双向能力没有任何需求用到。

### 分析编排：进程内并发调度器，无外部队列

**决策**：一个进程内 `AnalysisScheduler`：session 创建即落盘（状态 pending），调度器维护 `running` 计数，小于上限（默认 5，可配）时立即启动下一个 pending；LLM 调用是单次非流式请求，结果按预定义 JSON schema 解析（`{isQuiz, type, answer, reasoning, code?}`）。状态变更时同步写 SQLite 并广播 SSE。

```
  POST ──> 落盘 + INSERT session(pending) ──> scheduler.tick()
                                                │
              running < max ────────────────────┤
                                                v
                                       LLM 调用 (adapter)
                                                │
                          done ──> UPDATE + 归档记录 + SSE 广播
                          failed -> UPDATE (error)  + SSE 广播
```


**理由**：并发上限个位数、单进程部署，引入 Redis/BullMQ 之类是纯负担。better-sqlite3 是同步驱动，写状态零异步复杂度。

**关键不变量**：图像落盘与 session 行插入在同一请求处理内完成并先于 202 响应——任何"已确认"的 session 在崩溃后都可从磁盘恢复（启动时将 analyzing 状态的孤儿 session 重置为 pending 重新调度）。

### LLM 适配层：两条协议路径 + 结构化输出约定

**决策**：供应商配置为 `{id, name, protocol: "openai"|"anthropic", baseURL, apiKey, model}`，存 SQLite 配置表。两个 adapter 函数，签名统一为 `analyze(imagePng: Buffer, prompt: string, cfg) → Promise<QuizResult>`：

- OpenAI 路径：`POST {baseURL}/chat/completions`，messages 含 `image_url: data:image/png;base64,...`
- Anthropic 路径：`POST {baseURL}/messages`，content 含 `image` block

题型分类不靠第二个模型/第二步调用，而是**单次调用 + 系统提示词约定**：要求模型只输出严格 JSON（两种协议都支持 `response_format`/工具强制 JSON 的手段，初版用提示词约定 + 宽容解析：提取第一个 `{...}` 块）。解析失败 → session failed，不静默猜测。

**理由**：提示词一次完成"是否题目 + 分类 + 解答"是质量/成本/延迟的最优平衡点；多步 agent（OCR→分类→分 solver）对初版是过度设计。不引 Vercel AI SDK——它统一接口的同时也隐藏了各家 vision 格式差异，而我们只有两条路径，手写 adapter 约 100 行且完全可控。

### 持久化：SQLite + 文件系统混合

```
  server/data/
    app.db                  node:sqlite (Node 内置)
      sessions(id, status, image_path, client_ts, created_at, finished_at, error, raw_response)
      records(session_id FK, quiz_type, answer, reasoning, code, ...)
      providers(id, name, protocol, base_url, api_key, model, is_active)
      settings(key, value)  -- 端口、并发上限等
    images/<sessionId>.png
```

**决策**：结构化数据进 SQLite，图像只存路径。图像通过 `GET /api/images/:sessionId` 由服务端读文件返回，不开放静态目录。

**理由**：SQLite 单文件满足全部查询需求（倒序列表、按 ID 详情）；图像进 BLOB 会让 db 文件膨胀且无益。配置也进 SQLite 而非配置文件——网页界面改配置即时生效，不需要双写文件；端口例外，仍从环境变量/命令行读（改端口本来就要重启）。

**实施调整（2026-09-11）**：SQLite 驱动由 `better-sqlite3` 改为 Node 25 内置的 `node:sqlite`——同为同步 API、零原生编译依赖（better-sqlite3 在 Node 25 上需 node-gyp + MSVC 工具链）。服务端 `node src/index.ts` 直跑 TypeScript（strip-only 模式），代码相应避开构造参数属性等非可擦除语法。

### 前端：React + Vite 双工程，共享规范

客户端设置窗口（`client/src`）与服务端网页前端（`server/web`）是两个独立 Vite 工程，但共享：React 18+、TypeScript strict、函数组件 + hooks、fetch 封装层模式。服务端前端用 SSE hook 订阅事件流驱动 session 视图，历史列表用 SWR 式拉取。代码高亮用 `highlight.js`（编程题代码块）。**不引状态管理框架**——SSE 事件 + 少量 useState/useReducer 足够。

### macOS 权限策略

客户端启动时 Rust 侧检测屏幕录制权限（`screencapturekit`/`xcap` 返回错误或全黑图可探测），热键注册失败也可探测；设置窗口展示权限状态与"打开系统设置"深链接。授权本身由用户在系统设置完成——应用不尝试自动化授权流程。

## Risks / Trade-offs

- [Kimi Code 端点 vision 支持证据冲突（文档称支持图片，社区 issue 称不支持）] → 实施第一步做 spike 实测；不通则默认供应商指向 GLM-4V 或其他已验证视觉模型。适配层不因此改变。
- [macOS 上 xcap/全局热键在沙盒外的权限行为存在版本差异，可能截图全黑或热键静默失效] → 权限状态检测 + 设置窗口显式引导；spike 阶段在 macOS 真机验证截图与热键链路。
- [单次 LLM 调用的 JSON 输出并非 100% 稳定，模型可能输出多余文字] → 宽容解析（提取首个 JSON 块）+ 解析失败计入 failed 并保留原始响应文本供排查；不自动重试，避免费用放大。
- [better-sqlite3 同步驱动在 LLM 长等待期间阻塞事件循环的风险] → 所有 DB 写操作都是毫秒级小事务，与网络等待交错无实际影响；若未来记录量上万再评估。
- [局域网无鉴权，同网段任何人可提交截图/查看记录] → 明确接受（个人工具场景）；在设计中记录此假设，未来加 token 只需在 Fastify 加一层 hook。
- [SSE 在浏览器标签页休眠时可能断连] → EventSource 自动重连；重连后前端拉一次全量最新状态兜底，不依赖事件流完整性。

## Migration Plan

全新项目，无迁移。交付顺序见 tasks.md：服务端先行（可用 curl 模拟客户端验证全链路），客户端后做，macOS 适配与 Kimi spike 穿插其中。

## Open Questions
- ~~Kimi Code 端点 vision 行为~~ **已实测（2026-09-11）**：`https://api.kimi.com/coding/v1` 的 OpenAI 与 Anthropic 两条协议路径均接受 base64 图片输入（HTTP 200，正确识别选择题并给出答案）。推荐配置：protocol=openai, baseURL=`https://api.kimi.com/coding/v1`, model=`kimi-for-coding`。实测发现模型可能用中文输出 type 枚举（如 "选择"），parser 已加中文别名映射。
- 截图默认压缩策略（原始 PNG 可能数 MB，影响 LLM 请求体大小与费用）——初版原图直发，若实测费用/延迟不可接受再加缩放参数，属配置级改动。
