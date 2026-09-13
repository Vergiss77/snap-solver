# Tasks: client-multi-hotkeys

## 1. Rust 侧：配置与注册

- [x] 1.1 `ClientConfig` 迁移为 `hotkeys: Vec<String>`（serde 兼容旧 `hotkey` 字段，空列表回退默认）；`AppState.registered` 改为逐键条目集合；`snapshot` 上报 `hotkeys: Vec<{hotkey, active, error}>`；验证：`cargo check` 通过，旧 `config.json`（含 `hotkey` 字段）加载后等价于单元素列表
- [x] 1.2 `save_config` 改为 reconcile：未变化的已注册键不动，新键先注册成功再替换，失败键记录 error 不影响其余；`set_recording` 聚焦时注销全部、blur 重注册全部；验证：手动构造部分占用场景，成功键照常触发、失败键仅自身标错
- [x] 1.3 Rust 侧注册前兜底校验：非修饰键单键须在白名单（F1–F12/PrintScreen/ScrollLock/Pause/Insert）内，否则返回与 RESERVED 同类的拒绝错误；验证：直接调 `save_config` 提交 `"S"` 被拒，`"F5"` 通过

## 2. 前端：列表化与校验

- [x] 2.1 `HotkeyRecorder.tsx` 白名单校验（与 Rust 常量同步）：无修饰键时仅接受白名单按键，提示语说明规则；显示层 `Command/Control` 替换逻辑保留；验证：录入 `F5` 接受、录入 `S` / `Escape` 拒绝并提示
- [x] 2.2 `App.tsx` 快捷键区改为列表：每行录制框 + 逐键状态徽记（生效/失败原因）+ 删除按钮（单行禁用），底部"添加快捷键"；保存提交整个 `hotkeys` 数组并展示逐键结果；`ipc.ts` 类型同步；验证：添加 3 个键（含 1 个必失败项）保存后状态逐键正确，删除回到 1 个键后删除按钮禁用

## 3. 回归

- [x] 3.1 `npm run tauri -w @snap-solver/client -- build` 通过；macOS 实机：配 2 个键（一个组合键 + 一个 F 键）均可触发截图→服务端入库；重启客户端后配置与注册状态保持；验证：触发链路与托盘行为不受改动影响
