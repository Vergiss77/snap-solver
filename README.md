# snap-solver

局域网截图解题工具：一台电脑按快捷键静默截屏，另一台（或同一台）电脑上的服务端自动调用多模态大模型识别题目（选择/填空/简答/编程）并生成解答，结果在网页界面实时展示并自动归档。

```
客户端 (Windows / macOS)                 服务端 (Node.js)
  全局热键 Ctrl+Shift+S                    监听 :17890
  静默全屏截图 ────── HTTP POST ──────▶   并发分析 (每截图一个独立会话)
  离线静默丢弃                             SQLite 归档 + 网页看板 (实时推送)
```

## 功能

- **静默截图**：全局热键触发，前台无任何窗口、音效或闪烁；服务端不可达时静默丢弃
- **自动解题**：单次 LLM 调用完成题目判定、分类（选择/填空/简答/编程）与解答生成，编程题附带完整代码
- **并发分析**：每张截图独立会话、独立 LLM 上下文；旧题未完成时新题后台并行分析（上限可配，默认 5）
- **网页看板**：实时推送分析进度，历史题目列表与回顾，供应商/提示词/并发配置界面
- **多供应商**：OpenAI 兼容协议 + Anthropic 协议双路径，内置 Kimi / DeepSeek / OpenAI / Anthropic 预设一键填充
- **崩溃恢复**：截图落盘先于应答，重启后中断的分析自动重跑

## 第一步：下载安装

到 [Releases](../../releases) 页面下载最新版本，无需任何开发环境。

**服务端**（运行看板和 LLM 分析的机器，任选一台常开电脑）：

下载 `snap-solver-server-<版本>.tar.gz`，解压后（需安装 [Node.js ≥ 24](https://nodejs.org/)）：

```bash
cd server
npm install --omit=dev
node src/index.ts        # 监听 0.0.0.0:17890
```

看到监听提示即启动成功，保持窗口开着即可。包内已含网页看板，无需其他操作。

**客户端**（截图的机器，按平台选一）：

| 平台 | 产物 |
|---|---|
| Windows 10/11 | `.exe` NSIS 安装包 |
| macOS (Apple Silicon) | `aarch64` 的 `.dmg` |
| macOS (Intel) | `x86_64` 的 `.dmg` |

安装包未做代码签名，首次运行需手动放行：

- **Windows**：SmartScreen 弹窗 →"更多信息"→"仍要运行"
- **macOS**：右键 app →"打开"（或在 系统设置 → 隐私与安全性 中点"仍要打开"）；随后在系统提示中授予"屏幕录制"与"输入监控"权限

## 第二步：查服务端机器的局域网 IP

客户端和浏览器都要用服务端机器的局域网 IP 来连接。在**运行服务端的机器**上查询：

- **Windows**：`Win+R` 输入 `cmd` 回车，执行 `ipconfig`，找到当前网卡下的 `IPv4 地址`（形如 `192.168.x.x`）
- **macOS**：系统设置 → Wi-Fi → 当前网络"详细信息"里查看 IP 地址；或终端执行 `ipconfig getifaddr en0`

防火墙若弹出提示，请放行 TCP 端口 `17890`。

## 第三步：配置与使用

1. **打开看板**：浏览器访问 `http://<服务端IP>:17890`（服务端本机也可用 `http://127.0.0.1:17890`）
2. **配置供应商**：右上角"配置" → 新增供应商 → 从"服务商预设"下拉选择（默认 Kimi），名称/协议/Base URL/推荐模型会自动填好，只需填入自己的 API Key。"加载模型"可拉取该端点可选模型，"测试连通性"验证参数，保存后在列表点"设为生效"
3. **（可选）调优分析**：同一配置页可修改分析提示词（预置全文，可改后保存，"恢复默认"一键回退）、指定编程题的代码语言、调整并发上限
4. **配置客户端**：启动后驻留系统托盘/菜单栏（macOS 下 dock 不出现图标，菜单栏有闪电图标）→ 托盘菜单"打开设置" → 填服务端 IP 与端口 →"测试连接"通过 → 保存。快捷键默认 `Ctrl+Shift+S`，聚焦输入框按下新组合即可修改
5. **截图解题**：屏幕上调出题目，按热键；看板实时显示分析进度与解答，历史题目在左侧列表随时回顾

> 服务端和客户端在同一台机器上也可以：客户端主机直接填 `127.0.0.1`。

## 配置项速查

| 项 | 位置 | 说明 |
|---|---|---|
| 监听端口 | 启动参数 `--port` 或环境变量 `PORT`（默认 17890） | 修改需重启服务端 |
| 数据目录 | `--data-dir` 或 `DATA_DIR`（默认 `./data`） | 含 `app.db` 与截图 `images/` |
| 供应商 / 提示词 / 编程语言 / 并发上限 | 看板 → 配置 | 即时生效，无需重启 |
| 热键 / 服务端地址 | 客户端托盘 → 打开设置 | 保存即生效 |

## 已知说明

- 局域网信任环境，服务端无鉴权——请勿暴露到公网
- macOS 首次使用需授予屏幕录制与输入监控权限
- 截图以原始 PNG 直发 LLM，大图会占用更多 token；费用敏感可自行加压缩

---

<details>
<summary>开发者：源码构建与发版</summary>

环境要求：Node.js ≥ 24（服务端直跑 TypeScript + 内置 `node:sqlite`）；客户端构建需 Rust stable + Tauri 2 前置（Windows 需 VS C++ 生成工具；macOS 需 Xcode CLT）。

```bash
npm install                             # 安装 workspace 依赖
cd server && node src/index.ts          # 服务端开发运行
npm run build -w @snap-solver/web       # 构建网页看板
npm run tauri -w @snap-solver/client -- dev    # 客户端开发模式
npm run tauri -w @snap-solver/client -- build  # 客户端发布构建
```

项目结构：

```
shared/      客户端与服务端共享的 TypeScript 类型 (协议、状态枚举)
server/      Node.js 服务端: Fastify API、分析调度器、LLM 适配层、SQLite 持久化
server/web/  React 网页看板 (Vite 构建, 由服务端托管)
client/      Tauri 2 客户端: Rust 薄壳 (热键/截图/托盘/发送) + React 设置窗口
openspec/    OpenSpec 变更与规格
```

发版：同步 `client/src-tauri/tauri.conf.json` 与 `client/package.json` 的 version 后打 tag 推送：

```bash
git tag v0.2.0 && git push origin v0.2.0
```

推送 `v*` tag 触发 `.github/workflows/release.yml` 自动构建三平台客户端安装包与服务端 tar 包并发布到 Releases。构建失败时修复后删除远端 tag（`git push origin :v0.2.0`）重打即可。

</details>
