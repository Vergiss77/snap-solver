# Proposal: client-multi-hotkeys

## Why

客户端仅支持单个快捷键，用户希望在多台设备/不同场景下用不同组合触发同一截图功能；同时部分用户希望用 F 类功能键单按触发，免去修饰键组合。

## What Changes

- **多快捷键**：配置从 `hotkey: string` 迁移为 `hotkeys: string[]`（老配置加载时自动迁移为单元素数组），所有快捷键均触发相同的静默截图功能
- **逐键独立注册**：每个快捷键独立注册、独立显示成功/失败状态；单个键注册失败（被占用/系统保留）不影响其他键生效
- **单键白名单**：F1–F12、PrintScreen、ScrollLock、Pause、Insert 允许不带修饰键单独作为快捷键；其余按键仍强制要求修饰键（防止字母/编辑键被全局劫持导致无法输入）
- 设置窗口改为快捷键列表管理（添加/删除/逐键录制），保留"录制时暂停全局热键"机制（扩展为暂停全部已注册键）
- 仅使用 OS 热键注册机制，不引入键盘钩子/被动监听

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `client-screenshot-capture`: 触发源从单一快捷键变为快捷键集合，任一命中即触发
- `client-settings-ui`: 快捷键管理从单值录入变为列表管理（增删、逐键状态），录入校验引入单键白名单

## Impact

- **客户端 Rust**：`ClientConfig` 结构迁移（serde 兼容旧 `hotkey` 字段）、`registered` 状态改为集合、`save_config` 换绑逻辑改为逐键 reconcile、`set_recording` 暂停/恢复全部注册键
- **客户端前端**：`App.tsx` 快捷键区改为列表 + 添加按钮；`HotkeyRecorder.tsx` 白名单校验与逐键状态展示
- **配置兼容**：旧 `config.json`（含 `hotkey` 字段）读取时自动迁移，保存时写新格式
- **服务端 / shared**：无影响（触发后的 HTTP 协议不变）
