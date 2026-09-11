# Proposal: beautify-web-dashboard

## Why

服务端 React 看板（`server/web`）目前只有一套兜底的深色"后台系统"样式：系统默认字体栈、均摊的灰蓝色板、裸表单控件，没有任何视觉性格。这个页面是解答内容的唯一展示端，核心行为是"读"（读题、读答案、读思路、读代码），且常在局域网内用另一台设备（含手机）浏览——当前样式在长文阅读体验和窄屏可用性上都欠缺打磨。

## What Changes

- 对服务端网页前端做整体视觉重塑，采用"暗夜书房"美学方向：暖墨色底 + 琥珀金单一点缀色 + 衬线标题/正文 + 等宽代码字体的编辑排版风格
- 重塑范围：顶栏、新题到达 banner、历史侧栏、会话详情视图（截图、答案、思路、代码块）、配置面板（表单控件、供应商列表、按钮）
- 新增响应式收敛：窄屏（<760px）下历史侧栏收为可展开抽屉/横条，主视图单列居中
- 重写 `styles.css` 为基于 CSS 变量的主题化样式；仅调整各组件的 JSX 结构与 className，不改动状态管理、SSE 事件流与 API 调用逻辑
- 不引入 UI 框架与动画库；入场/状态动效用纯 CSS 实现，保持后续迁移 Tauri 壳零负担
- 无功能行为变更：spec `web-dashboard` 的四条需求（实时视图、历史浏览、配置界面、构建部署形态）全部保持原语义

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。本次为纯视觉/样式变更，不涉及任何 spec 级行为变化，`.openspec.yaml` 已设置 `skip_specs: true`。

## Impact

- **代码**：`server/web/src/styles.css`（重写）、`App.tsx` / `HistoryList.tsx` / `SessionView.tsx` / `ConfigPanel.tsx`（仅 JSX 结构与 className 调整）、`index.html`（字体引入）
- **依赖**：新增 Google Fonts 外链（Source Serif 4 / Noto Serif SC / JetBrains Mono），不新增 npm 运行时依赖；需考虑局域网离线场景下字体加载失败的优雅降级
- **API / 服务端**：无影响
- **迁移**：纯 CSS + 结构化 class 命名，保持迁移到 Tauri 壳的便利性（spec 要求）
