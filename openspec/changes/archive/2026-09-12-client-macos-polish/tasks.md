# Tasks: client-macos-polish

## 1. macOS 后台形态

- [x] 1.1 `lib.rs` setup 中 `#[cfg(target_os = "macos")]` 调用 `set_activation_policy(ActivationPolicy::Accessory)`；验证：macOS 构建运行后 dock 无图标，托盘菜单"打开设置/退出"功能正常
- [x] 1.2 制作单色剪影托盘图标（粗轮廓几何形，16/22px），macOS 下 `TrayIconBuilder.icon_as_template(true)` 并使用该图标，Windows 下维持默认图标；验证：菜单栏图标随系统明暗主题正确反色，Windows 托盘图标不变

## 2. 设置窗口美化

- [x] 2.1 `client/src/styles.css` 重写：复制服务端薰衣草 tokens（色板/字体/圆角/阴影），按 520px 单列表单尺度重写组件样式（输入框 mist 描边 + 紫色焦点环、主按钮实心 Deep Iris、次按钮幽灵描边、权限状态用胶囊徽记）；验证：窗口打开呈现与看板同源的浅色薰衣草风格
- [x] 2.2 `App.tsx` / `HotkeyRecorder.tsx` 仅调整 className 与结构包装以套用新样式；验证：快捷键录制、测试连接、保存、权限展示全部功能不变（逐个手动操作验证）

## 3. 回归

- [x] 3.1 `npm run tauri -w @snap-solver/client -- build` 构建通过；macOS 实机走一遍 spec delta scenario（关闭窗口 dock 无图标、托盘唤出设置、退出）；验证：截图→发送主链路不受样式与后台形态改动影响
