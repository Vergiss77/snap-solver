# Design: client-macos-polish

## Context

客户端为 Tauri 2：Rust 侧 `lib.rs`（托盘、热键、截图、发送），前端是独立的小型 React 设置窗口（`client/src/`，`styles.css` 仅 27 行）。托盘图标当前用 `app.default_window_icon()`（彩色应用图标）。服务端看板已建立薰衣草浅色视觉体系（tokens 见 `server/web/src/styles.css`）。动机见 proposal.md。

## Goals / Non-Goals

**Goals:**

- 设置窗口视觉与服务端看板一致（同色系 tokens、按钮分级、输入框焦点环）
- macOS：Accessory 激活策略隐藏 dock 图标；菜单栏托盘图标 template 化
- Windows 行为零变化

**Non-Goals:**

- 不改 IPC 接口、快捷键录制逻辑、配置持久化格式
- 不做 Windows 任务栏图标定制
- 不重设计托盘菜单结构

## Decisions

### 1. dock 隐藏：`app.set_activation_policy(ActivationPolicy::Accessory)`，macOS 条件编译

在 `setup` 中 `#[cfg(target_os = "macos")]` 调用。Accessory 策略下应用无 dock 图标、无应用菜单，托盘照常——正是"后台代理"形态。设置窗口由托盘菜单唤出，`show() + set_focus()` 现成逻辑不变。备选（Info.plist `LSUIElement`）效果相同但写死进 bundle，运行时策略更明确可控，选运行时 API。

### 2. 菜单栏 template 图标

`TrayIconBuilder` 加 `.icon_as_template(true)`（macOS 特有 API），图标文件换为单色剪影 PNG（黑形白透，系统按菜单栏明暗自动反色）。制作方式：从现有 icon 派生一个简化几何剪影（如闪电/相机轮廓），放 `icons/tray-template.png`，加入 `bundle.resources` 或经 `tauri::include_image!` 嵌入。Windows 分支继续用默认彩色图标（`icon_as_template` 在非 macOS 上无效/忽略，用 cfg 分支处理图标选择）。

### 3. 设置窗口视觉同步：拷贝 tokens、按窗口尺度裁剪

把服务端 `styles.css` 的 `:root` tokens（色板/字体/圆角/阴影）原样复制到客户端 `styles.css`，组件样式按设置窗口的实际元素重写（表单、按钮、权限状态区、热键录入框）——设置窗口是单列窄表单（520x640），不需要看板的侧栏/卡片版式。字体沿用 Google Fonts 外链 + 系统降级（与服务端同一策略）。

## Risks / Trade-offs

- **Accessory 策略下首次启动无任何可见反馈**（dock 无图标、窗口默认隐藏）→ 菜单栏有托盘图标即入口；README 已知说明补一句
- **template 图标制作质量**（剪影太细会在菜单栏糊掉）→ 用粗轮廓几何形，16/22px 双尺寸
- **客户端离线时 Google Fonts 不可达** → 与服务端同一降级栈，布局不崩

## Migration Plan

客户端重新构建发布即可；配置格式不变，老配置直接兼容。回滚 = revert 重出包。

## Open Questions

无。
