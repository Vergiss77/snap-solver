# Design: beautify-web-dashboard

## Context

服务端看板（`server/web`）为 React 19 + Vite 工程，样式集中在单个 `styles.css`，无 UI 框架，代码高亮用 highlight.js。页面是解答内容的唯一展示端，核心行为是阅读，且常在局域网内用另一台设备（含手机窄屏）浏览。spec `web-dashboard` 要求前端工程结构便于后续迁移到 Tauri 壳。动机见 proposal.md。

**视觉方向（2026-09-12 修订）**：初版"暗夜书房"深色方案被否，改为学习 Wiza 式浅色薰衣草 SaaS 风格——白底 + 紫罗兰墨色 + Mist Violet 氛围晕染。该风格参考自一份临时风格文档，其设计令牌已全部内联到本文件与 `styles.css`，代码库不依赖该临时文件存在。

## Goals / Non-Goals

**Goals:**

- 确立浅色薰衣草视觉系统：Canvas 白底、Deep Iris 标题/主按钮、Royal Amethyst 链接/焦点、Mist Violet 氛围晕染与胶囊标签
- 全部样式收敛到 CSS 自定义属性（design tokens），组件只用语义化 class，不改状态/SSE/API 逻辑
- 窄屏（<760px）响应式收敛：历史侧栏收为可展开抽屉，主视图单列居中
- 纯 CSS 动效（新题淡入、完成态 staggered reveal、分析中呼吸圆点），零 JS 动画依赖

**Non-Goals:**

- 不改动任何功能行为、事件流、API 契约（spec 四条需求语义不变，已 `skip_specs`）
- 不引入 UI 组件库、CSS-in-JS、动画库或新的 npm 运行时依赖
- 不做暗色主题与主题切换——本期只交付浅色一套
- 不改动 `api.ts`、`useEvents.ts` 与共享类型包

## Decisions

### 1. Design tokens 全部走 `:root` CSS 变量，组件只用语义 class

色板（单色紫罗兰家族 + 安静中性色）：

| Token | 值 | 用途 |
|---|---|---|
| `--deep-iris` | `#26114a` | 标题、实心主按钮底、代码块底 |
| `--plum-velvet` | `#312749` | 导航/条目标题文字 |
| `--royal-amethyst` | `#3e0079` | 链接、焦点环、强调描边（不作正文色） |
| `--mist-violet` | `#edecff` | 氛围晕染、选中态、胶囊标签底 |
| `--canvas` / `--paper` / `--mist` | `#ffffff` / `#f6f7fa` / `#e6e2e3` | 页面底 / 次级表面 / 发丝描边 |
| `--ash` / `--slate` / `--charcoal` | `#9491a1` / `#615e6e` / `#333333` | 辅助 / 次要 / 正文文字 |
| `--ok` / `--err` | `#2e7d4f` / `#b3261e`（配同色系浅底） | 状态语义色，低饱和不破坏紫调 |

形状与投影遵循同一签名：矩形表面一律 8px 圆角；胶囊（状态徽记、章节标、导航按钮）一律 1440px；投影只用蓝调轻投影（最大 32px blur / 6% 透明度），不用重阴影。

**为什么不引 CSS 框架**：体量小，且 Tailwind 式类名噪音会污染需要迁移 Tauri 的 JSX。备选（沿用深色方向微调）因用户明确要求浅色薰衣草风格被否。

### 2. 字体：Inter + Plus Jakarta Sans + JetBrains Mono，Google Fonts 外链 + 降级栈

- UI/正文：`"Inter", "PingFang SC", sans-serif`，紧凑区间 12–16px（caption 12 / body-sm 14 / body 16）
- 标题：`"Plus Jakarta Sans"` 500，line-height 严格 1.0，Deep Iris——紧行高营造几何感（Britti Sans 的指定替代）
- 代码/时间戳：`"JetBrains Mono", ui-monospace, monospace`
- `display=swap` + 系统字体降级，局域网离线时布局不崩

### 3. 版式语言：浮动顶栏 + 数据表侧栏 + 白卡解答区

- 顶栏做成**浮动白色胶囊条**（外边距 + 8px 圆角 + 轻投影），左侧 logo 组合（紫渐变三角标 + Inter 700 字标），连接状态为胶囊标签（ok=苔绿浅底 / bad=赭红浅底）
- 页面顶部铺**白到 Mist Violet 的垂直渐变氛围**，且渐变永远衬在白色内容表面之下（不直接在渐变上排深色正文）
- 历史侧栏为数据表式行：发丝分隔线、hover `--paper`、选中 `--mist-violet` 底 + 2px Amethyst 左线；状态徽记全部胶囊化（`分析中…` 紫底呼吸点 / `已完成` 绿底 / `失败` 红底）
- 截图：白框卡片（8px 内边距）+ 分层轻投影，浮在氛围渐变上
- 答案/思路排为白卡（1px `--mist` 描边，8px 圆角，max-width 68ch）；章节标（答案/解题思路/代码实现）做成 Mist Violet + Amethyst 的**胶囊标签**
- 代码块用 Deep Iris 深紫底 + 暮光束（twilight beam）色系 hljs 高亮（keyword `#cf8aff` / string `#ffad74` / number `#ff9ad5` 等），深紫"夜景"嵌在浅色界面中成为视觉锚点

### 4. 按钮分级与表单

- 主按钮：实心 Deep Iris 底 + 白字；次按钮：1px Deep Iris 描边幽灵款；危险操作：赭红文字按钮；顶栏按钮一律胶囊形
- input/select：1px `--mist` 描边、8px 圆角、placeholder 用 `--ash`；聚焦 = Amethyst 描边 + 2px 紫色焦点环
- 供应商列表为白卡容器 + 发丝分隔行，`生效中` 行整行 Mist Violet 底

### 5. 响应式与动效

- <760px：侧栏收为白色抽屉（transform 滑入 + 淡紫遮罩 `rgba(38,17,74,.18)`），顶栏出现"历史"胶囊按钮；标题降级到 24px
- 动效纯 CSS 三处：新 session 卡片淡入上移、完成时答案/思路/代码 staggered reveal、`分析中` 呼吸圆点

## Risks / Trade-offs

- **Google Fonts 在离线局域网不可达，界面退回系统字体** → `display=swap` + `PingFang SC`/`ui-sans-serif` 降级栈，视觉降级但布局不崩
- **浅色主题下截图（多为深色/白底混杂）与白框卡片的融合度** → 白框 + 轻投影作为"相框"可兼容两种截图色调
- **中文正文用 Inter 会回退到 PingFang SC** → 字重 400/500/700 在苹方上均有对应，观感差异可接受
- **样式重写范围大，可能误伤行为钩子** → JSX 只增改 className/结构包装，事件处理与条件渲染逐行保持

## Migration Plan

纯前端静态资源变更：`vite build` 后由服务端托管，刷新即可。回滚 = `git revert` 重新构建。无数据迁移、无 API 版本问题。

## Open Questions

无。
