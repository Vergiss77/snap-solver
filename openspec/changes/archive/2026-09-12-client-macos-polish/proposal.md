# Proposal: client-macos-polish

## Why

Tauri 客户端设置窗口仍是裸样式，与服务端看板的浅色薰衣草风格不一致；macOS 下作为常驻托盘工具，dock 图标多余（设置窗口关闭即隐藏，dock 图标无意义）；托盘图标为彩色应用图标，在 macOS 菜单栏中突兀。

## What Changes

- **设置窗口美化**：`client/src/styles.css` 与窗口结构对齐服务端看板的薰衣草视觉体系（同款色板/字体/圆角/按钮分级/输入框焦点环），纯样式与 className 调整，不动 IPC 与逻辑
- **macOS dock 图标隐藏**：设置 `ActivationPolicy::Accessory`，进程常驻后台时 dock 不显示图标；托盘菜单入口不变
- **macOS 菜单栏图标单色化**：托盘图标改用 template 单色图标（`icon_as_template`），融入系统菜单栏明暗主题
- Windows 行为不变（托盘图标照常、无 dock 概念）

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `client-settings-ui`: "托盘常驻与权限引导"需求扩展——macOS 下进程驻留时 dock 栏不显示图标；托盘图标在 macOS 为 template 单色图标

## Impact

- **客户端 Rust**：`lib.rs` setup 中 macOS 条件编译设置 activation policy 与 template 图标
- **客户端前端**：`client/src/styles.css` 重写、`App.tsx`/`HotkeyRecorder.tsx` 仅 className/结构调整
- **资源**：菜单栏 template 图标（可用现有 icon 派生的单色 PNG，或极简几何图形）
- **服务端 / shared**：无影响
