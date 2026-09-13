# Design: client-multi-hotkeys

## Context

客户端热键链路现状：`ClientConfig.hotkey: String` → `registered: Mutex<Option<Shortcut>>` → `save_config` 全量换绑（失败保旧）。录制框（`HotkeyRecorder.tsx`）强制要求修饰键。需求见 proposal.md；探索阶段已否决键盘钩子方案（双击触发不做），全程只用 OS 热键注册。

## Goals / Non-Goals

**Goals:**

- 多快捷键独立注册、逐键状态可见
- 单键白名单（F1–F12 / PrintScreen / ScrollLock / Pause / Insert）
- 旧配置无缝迁移

**Non-Goals:**

- 不做双击/长按等时序触发（需要键盘钩子，已否决）
- 不做每键绑定不同功能（所有键触发同一截图动作）
- 不改触发后的 HTTP 发送链路

## Decisions

### 1. 配置迁移：`hotkeys: Vec<String>`，serde 兼容旧字段

```rust
pub struct ClientConfig { pub server_host: String, pub server_port: u16, pub hotkeys: Vec<String> }
```

自定义 `Deserialize`（或 `#[serde(default)]` + 辅助字段）：旧 `config.json` 里的 `hotkey: "..."` 读入后包装为单元素数组；保存只写新格式。`hotkeys` 为空时回退默认值（防御手改配置）。

### 2. 注册状态：`Vec<HotkeyEntry>`，逐键 reconcile

```rust
struct HotkeyEntry { accelerator: String, shortcut: Option<Shortcut>, error: Option<String> }
```

`save_config` 语义改为 reconcile：逐个处理新列表——已注册且未变化的键保持不动；新增/变化的先注册成功再注销旧键；失败的记录 error 且不碰其他键。`ClientState` 上报 `hotkeys: Vec<{hotkey, active, error}>` 取代单一 `hotkeyActive/hotkeyError`（前端同步改）。`set_recording` 聚焦时注销全部、blur 后按当前配置重注册全部。

### 3. 单键白名单：前后端各一份常量，录制时校验

```
SINGLE_KEY_WHITELIST = F1..F12, PrintScreen, ScrollLock, Pause, Insert
```

校验规则：组合不含修饰键时，key 必须在白名单内，否则拒绝并提示"单键仅支持功能键类"。白名单与 `RESERVED` 一样在 Rust（注册前兜底）与 TS（录入即提示）各存一份。字母/数字/方向/编辑键依然强制修饰键——防止全局劫持后无法正常输入。

### 4. 设置窗口 UI：列表化

每个快捷键一行：录制输入框（复用 `HotkeyRecorder`）+ 状态圆点（绿=生效 / 红=失败+原因）+ 删除按钮；"添加快捷键"按钮追加一行；只剩一行时删除禁用。保存仍是一个按钮，提交整个列表。

## Risks / Trade-offs

- **白名单键被系统占用**（Win11 PrintScreen 唤出截图工具、macOS F 键亮度音量）→ 走逐键失败提示路径，不阻塞其他键
- **用户配多个键后忘记哪个生效** → 列表逐键状态常显
- **reconcile 部分失败留下中间态**（新键一半注册成功）→ 可接受：失败项标红，再次保存可重试；状态始终与"最后一次尝试"一致

## Migration Plan

旧 `config.json` 读取即迁移，首次保存后写新格式；无服务端变更。回滚 = revert，新格式配置里的 `hotkeys` 字段在老版本下被忽略、回退默认键（可接受的降级）。

## Open Questions

无。
