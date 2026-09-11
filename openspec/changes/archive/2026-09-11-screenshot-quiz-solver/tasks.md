## 1. 仓库与工程脚手架

- [x] 1.1 初始化 npm workspaces 根工程（`client/`、`server/`），配置 TypeScript strict、共享协议类型包（session 状态枚举、API 请求/响应类型），验证 `npm install` 与 `tsc --noEmit` 通过
- [x] 1.2 初始化 `server/`（Node 20+ ESM + Fastify + better-sqlite3），`GET /api/health` 返回 `{name, version}`，验证 `curl http://127.0.0.1:17890/api/health` 返回 2xx
- [x] 1.3 初始化 `server/web/`（React + Vite），开发期代理到 Fastify，构建产物由 Fastify 静态托管，验证浏览器打开服务端地址能看到占位页

## 2. Spike：高风险项实测

- [x] 2.1 实测 Kimi Code 端点 vision：用 `https://api.kimi.com/coding/v1` + 订阅 key 分别按 OpenAI 与 Anthropic 协议发送含 base64 图片的请求，记录实际行为（支持/拒绝/忽略图片），结论写入 design.md 的 Open Questions 并据此选定默认供应商；验证方式：真实 API 响应可复现
- [x] 2.2 macOS 真机验证 `tauri-plugin-global-shortcut` 注册热键与 `xcap` 静默截图链路（授予屏幕录制/输入监控权限后），验证截图无系统 UI 反馈且图像内容正确；不通过则评估 `screenshots` crate 替代并更新 design.md

## 3. 服务端：接收与存储

- [x] 3.1 实现数据层：SQLite 表（sessions/records/providers/settings，见 design.md）+ 数据目录初始化 + 图片落盘，验证进程重启后数据可完整读回
- [x] 3.2 实现 `POST /api/screenshots`（multipart：image + clientTs）：先落盘与 INSERT session(pending) 再返回 202 + sessionId；验证用 curl 提交 PNG 后磁盘出现 `images/<id>.png` 且 DB 有对应行
- [x] 3.3 实现无效请求处理（缺图/不可解码 → 4xx，不建 session 不写盘），验证 curl 提交损坏数据返回 4xx 且无磁盘/DB 残留
- [x] 3.4 实现 `GET /api/images/:sessionId` 按 session 读图返回，验证浏览器可直接查看已接收截图
- [x] 3.5 实现启动恢复：将崩溃遗留的 analyzing 状态 session 重置为 pending，验证手动改库后重启进程该 session 被重新调度

## 4. 服务端：LLM 适配层与分析编排

- [x] 4.1 实现 OpenAI 兼容协议 adapter（chat/completions + base64 image_url，宽容 JSON 解析：提取首个 `{...}` 块），验证对任一真实 OpenAI 兼容端点调用返回结构化 QuizResult
- [x] 4.2 实现 Anthropic 协议 adapter（messages + image block，同样宽容解析），验证对 Anthropic 端点调用返回结构化 QuizResult
- [x] 4.3 设计并固化分析提示词（是否题目 → 分类选择/填空/简答/编程 → 解答+思路，编程题含代码，仅输出严格 JSON），验证对真实题目截图返回的 JSON 字段齐全
- [x] 4.4 实现 AnalysisScheduler：pending → analyzing → done/failed 状态机、可配最大并发数（默认 5）、超限排队按到达顺序启动；验证并发提交 6+ 张截图时同时运行数不超过上限且全部最终完成
- [x] 4.5 失败路径：LLM 错误（401/超时/解析失败）→ session failed + 记录供应商错误详情 + 原始响应文本，不自动重试；验证用错误 apiKey 时 session 进入 failed 且错误信息包含供应商状态码
- [x] 4.6 实现 `GET /api/events` SSE：session.created/started/done/failed 事件广播；验证两个浏览器标签同时连接都能收到事件，断线后 EventSource 自动重连

## 5. 服务端：归档与查询接口

- [x] 5.1 session done 时自动写 records 行（题型、解答、思路、代码、时间戳），failed 保留记录与 error；验证完成后 DB 记录字段完整
- [x] 5.2 实现 `GET /api/records`（时间倒序摘要列表）与 `GET /api/records/:id`（完整详情），验证顺序正确且详情字段齐全

## 6. 网页前端（server/web）

- [x] 6.1 实现 SSE 订阅 hook 与主视图：默认聚焦最新 session，分析中/完成/失败三态展示，代码块 highlight.js 高亮；验证截图后页面无刷新实时呈现结果
- [x] 6.2 实现历史侧边列表（时间倒序摘要 + 状态标识）与详情视图（截图原图 + 解答全文）；浏览历史时新题到达仅提示不强制切换，旧 session 后台完成时列表条目状态原地更新；验证两条交互均符合 spec 场景
- [x] 6.3 实现配置界面：供应商增删改（协议类型、baseURL、apiKey、model）、设为生效、并发上限（即时生效）、端口（提示需重启）；验证修改生效供应商后新 session 走新供应商（DB/日志可查）
- [x] 6.4 断线兜底：SSE 重连后拉一次全量最新状态；验证杀服务端再重启，前端自动恢复且状态正确

## 7. 客户端（client/，Tauri 2）

- [x] 7.1 初始化 Tauri 2 工程 + `tauri-plugin-global-shortcut` + `xcap` + `reqwest`，托盘常驻（打开设置/退出），验证 Windows 上托盘图标出现且退出干净注销热键
- [x] 7.2 Rust 侧实现截图流程：热键触发 → xcap 捕获主屏 → PNG 编码 → reqwest multipart POST 到配置的服务端；验证按热键 1 秒内服务端收到完整截图，全程无窗口/音效/闪烁
- [x] 7.3 离线静默丢弃：连接失败/超时直接丢弃不缓存不提示；验证服务端关闭时连按热键客户端无任何可见反馈且进程正常
- [x] 7.4 连续触发并行处理：前一张未发完再按热键互不阻塞；验证快速连按两次服务端收到两个 session
- [x] 7.5 React 设置窗口：热键录制（keydown 捕获组合、无效组合拒绝、保存即热重注册）、服务端地址/端口配置持久化、测试连接按钮（调 `/api/health`，成功/失败分类展示）；验证改热键后立即生效、测试连接对在线/离线服务端显示正确
- [x] 7.6 权限状态检测与引导：macOS 屏幕录制/输入监控缺失时设置窗口显示状态与引导说明（含打开系统设置入口），且不发送黑屏/空图；验证未授权机器上状态正确显示
- [x] 7.7 热键注册失败处理：组合被占用时设置窗口显示失败状态并保留上一次有效热键；验证与系统占用组合冲突时行为符合 spec

## 8. 端到端验收

- [x] 8.1 全链路验收（Windows 客户端 + 服务端）：配好供应商 → 按热键截一道选择题 → 网页实时看到分类与解答 → 历史列表出现该题；再截编程题验证代码高亮与归档
- [x] 8.2 并发验收：分析进行中连截两题，验证旧题后台完成、前台展示新题、两题均正确归档
- [x] 8.3 macOS 客户端全链路验收（授权后）：截图、发送、设置窗口、权限状态均符合 spec
- [x] 8.4 跨设备验收：手机/第三台设备浏览器访问服务端网页，实时推送与历史浏览正常

## 9. 供应商管理增强

- [x] 9.1 服务端实现 POST /api/providers/models（按协议+baseURL+apiKey 拉取模型列表，apiKey 走请求体）与 POST /api/providers/test（最小化真实调用测连通，返回延迟或错误详情，不落库不建 session），验证 curl 对 Kimi 端点拉列表与测试均返回预期结果
- [x] 9.2 配置界面加"加载模型"（input+datalist 下拉可选、可自由输入、失败显示具体错误）与"测试连通性"按钮（显示成功+耗时/失败原因），验证浏览器内两按钮对真实 Kimi 参数的行为
