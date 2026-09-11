# Tasks: beautify-web-dashboard

## 1. 设计令牌与全局基底

- [x] 1.1 重写 `styles.css` 开头为 `:root` design tokens（色板、字体栈、间距、圆角、投影，值见 design.md 决策 1/2），并设置全局 `body` 基底与 `color-scheme: dark`；验证：页面加载后 `getComputedStyle(document.body).backgroundColor` 为 `#12100e`
- [x] 1.2 在 `index.html` 引入 Google Fonts（Source Serif 4、Noto Serif SC、JetBrains Mono，`display=swap`）并配置完整降级栈；验证：断网/离线打开页面时文字仍以系统衬线/等宽渲染且布局不崩

## 2. 顶栏与全局框架

- [x] 2.1 重塑顶栏：等宽小号字距拉开的 `SNAP SOLVER` 字标、连接状态改为 6px 圆点（`.conn.ok` 琥珀绿脉冲 / `.conn.bad` 赭红）+ 文字、配置按钮降级为无边框文字按钮；验证：断开 SSE 时圆点变红并显示"重连中…"
- [x] 2.2 重塑新题到达 banner：纸张色底、细金线描边、文字按钮；验证：浏览历史时新截图到达，banner 出现且两个按钮行为不变

## 3. 历史侧栏

- [x] 3.1 条目去灰块化：纯文字行（题型 + 时间戳等宽小号），选中项左侧 2px 金线 + 米白文字，hover 微亮；验证：点击切换条目时选中态正确迁移
- [x] 3.2 状态徽记文字化：`排队中 / 分析中… / 已完成 / 失败`，`分析中` 配呼吸圆点 CSS 动画；验证：SSE 推送状态变化时徽记实时更新且无布局跳动

## 4. 会话详情主视图

- [x] 4.1 答案/思路区排为"纸张卡片"：`max-width: 68ch`、行高 1.8、`--paper` 底色；`h2` 章节标（字距 0.3em + 下方 1px 金线）；验证：长答案在宽屏下不超出 68 字符宽度，阅读区居中
- [x] 4.2 截图样式：细描边 + 柔和投影 + 小圆角；验证：截图加载后呈现卡片质感且不变形
- [x] 4.3 代码块：更深底色 + 细金边，hljs 自配暖色主题（keyword/string/comment/number 等约 10 个 token 映射到本主题色板）；验证：编程题代码高亮颜色与主题一致，横向滚动正常
- [x] 4.4 入场/完成动效：新 session 卡片淡入上移，完成时答案/思路/代码三节 staggered reveal（animation-delay 递增）；验证：纯 CSS 实现，无新增 JS 动画依赖

## 5. 配置面板

- [x] 5.1 表单控件主题化：input/select 用 `--bg-sunken` 底 + `--line` 描边、聚焦时琥珀金焦点环；按钮分级（主按钮金边、次按钮无边框文字式、删除为赭红文字）；验证：Tab 聚焦可见焦点环，加载模型/测试连通性/保存/删除行为不变
- [x] 5.2 供应商列表重塑：`生效中` 文字徽记（苔绿）、行 hover、编辑载入表单；验证：设为生效/编辑/删除全流程功能正常

## 6. 响应式与收尾

- [x] 6.1 窄屏（<760px）：侧栏收为抽屉（顶栏"历史"按钮切换，transform 滑入 + 遮罩），主视图单列居中；验证：Chrome DevTools 375px 宽度下抽屉开合正常、内容不溢出
- [x] 6.2 全量回归：构建通过（`cd server/web && npm run build`），逐条核对 spec `web-dashboard` 四需求场景（实时更新、历史回顾、后台完成不打断、配置即时生效）行为无变化
