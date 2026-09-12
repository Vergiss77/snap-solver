# snap-solver

局域网截图解题工具：一台电脑按快捷键静默截屏，另一台电脑上的服务端自动调用多模态大模型识别题目（选择/填空/简答/编程）并生成解答，结果在网页界面实时展示并自动归档。

```
客户端 (Tauri, Win/macOS)                服务端 (Node.js)
  全局热键 Ctrl+Shift+S                    监听 :17890
  静默全屏截图 ────── HTTP POST ──────▶   并发分析 (每截图一个独立会话)
  离线静默丢弃                             LLM 适配层 (OpenAI 兼容 / Anthropic)
                                           SQLite 归档 + React 网页看板 (SSE 实时推送)
```

## 功能

- **静默截图**：全局热键触发，前台无任何窗口、音效或闪烁；服务端不可达时静默丢弃
- **自动解题**：单次 LLM 调用完成题目判定、分类（选择/填空/简答/编程）与解答生成，编程题附带完整代码
- **并发分析**：每张截图独立会话、独立 LLM 上下文；旧题未完成时新题后台并行分析（上限可配，默认 5）
- **网页看板**：实时推送分析进度（SSE），历史题目列表与回顾，供应商/并发配置界面
- **多供应商**：OpenAI 兼容协议 + Anthropic 协议双路径，baseURL/apiKey/model 自由组合；支持模型列表加载与连通性测试
- **崩溃恢复**：截图落盘先于应答，重启后中断的分析自动重跑

## 环境要求

| 组件 | 要求 |
|---|---|
| 服务端 | Node.js ≥ 24（直跑 TypeScript + 内置 `node:sqlite`，无需编译工具） |
| 网页前端 | 构建需 Node.js；已构建的 `server/web/dist` 可直接使用 |
| 客户端构建 | Rust stable + Tauri 2 前置（Windows 需 VS C++ 生成工具；macOS 需 Xcode CLT） |
| 客户端运行 | Windows 10/11 或 macOS（macOS 需预先授予"屏幕录制"与"输入监控"权限） |

## 快速开始

```bash
npm install                 # 安装 workspace 依赖

# 服务端
cd server
node src/index.ts           # 监听 0.0.0.0:17890, 数据存 ./data

# 网页前端 (改动后需重新构建)
npm run build -w @snap-solver/web

# 客户端 (开发模式, 需要 Rust 工具链)
npm run tauri -w @snap-solver/client -- dev

# 客户端 (发布构建, 产出内嵌前端的独立 exe 与安装包)
npm run tauri -w @snap-solver/client -- build
# 产物: client/src-tauri/target/release/snap-solver-client.exe
#       client/src-tauri/target/release/bundle/  (NSIS/MSI 安装包)
```

## 下载安装（免构建）

推送 `v*` tag 会触发 GitHub Actions 自动构建并发布到 [Releases](../../releases) 页面，直接下载对应产物即可，无需 Rust / 前端构建工具链。

**客户端**（按平台选一）：

| 平台 | 产物 |
|---|---|
| Windows 10/11 | `.exe` NSIS 安装包 |
| macOS (Apple Silicon) | `aarch64` 的 `.dmg` |
| macOS (Intel) | `x86_64` 的 `.dmg` |

安装包未做代码签名，首次运行需手动放行：

- **Windows**：SmartScreen 弹窗 →"更多信息"→"仍要运行"
- **macOS**：右键 app →"打开"（或在 系统设置 → 隐私与安全性 中点"仍要打开"）；随后按需授予"屏幕录制"与"输入监控"权限

**服务端**：下载 `snap-solver-server-<版本>.tar.gz`，解压后：

```bash
cd server
npm install --omit=dev
node src/index.ts        # 监听 0.0.0.0:17890, 需 Node.js ≥ 24
```

包内已含预构建的网页看板（`server/web/dist`），无需自行构建前端。

## 使用

1. **配置供应商**：浏览器打开 `http://<服务端IP>:17890` → 右上角"配置" → 新增供应商。Kimi Code 订阅示例：
   - 协议 `OpenAI 兼容`，Base URL `https://api.kimi.com/coding/v1`，模型 `kimi-for-coding`
   - 点"加载模型"可从端点拉取可选模型，"测试连通性"验证参数是否正确
2. **设为生效**：在供应商列表点"设为生效"
3. **客户端**：启动后驻留系统托盘（无窗口）→ 托盘菜单"打开设置"→ 填服务端 IP 与端口 →"测试连接"→ 保存。快捷键默认 `Ctrl+Shift+S`，聚焦输入框按下新组合即可修改
4. **截图解题**：屏幕上调出题目，按热键；网页看板实时显示分析与解答

## 跨设备部署

- **服务端到另一台机器**：拷贝 `package.json`、`package-lock.json`、`shared/`、`server/`（含 `web/dist`）→ 目标机 `npm install` → `node server/src/index.ts`。防火墙放行 TCP 17890
- **客户端到另一台机器**：拷贝 release 版 `snap-solver-client.exe`（自包含，**不要用 `target/debug/` 下的版本**——debug 版设置窗口依赖 Vite 开发服务器）。设置中填入服务端 IP 即可

## 配置项

| 项 | 位置 | 说明 |
|---|---|---|
| 监听端口 | 启动参数 `--port` 或环境变量 `PORT`（默认 17890） | 修改需重启服务端 |
| 数据目录 | `--data-dir` 或 `DATA_DIR`（默认 `./data`） | 含 `app.db` 与截图 `images/` |
| 并发上限 | 网页配置界面（默认 5） | 即时生效 |
| 供应商 | 网页配置界面 | 增删改、设为生效，即时生效 |
| 热键/服务端地址 | 客户端托盘 → 设置 | 保存即生效 |

## 项目结构

```
shared/      客户端与服务端共享的 TypeScript 类型 (协议、状态枚举)
server/      Node.js 服务端: Fastify API、分析调度器、LLM 适配层、SQLite 持久化
server/web/  React 网页看板 (Vite 构建, 由服务端托管)
client/      Tauri 2 客户端: Rust 薄壳 (热键/截图/托盘/发送) + React 设置窗口
openspec/    OpenSpec 变更与规格
```

## 发版流程

```bash
# 1. 同步版本号: client/src-tauri/tauri.conf.json 与 client/package.json 的 version
# 2. 提交后打 tag 并推送
git tag v0.2.0
git push origin v0.2.0
```

推送 `v*` tag 后，`.github/workflows/release.yml` 自动构建三平台客户端安装包与服务端 tar 包并发布到 Releases。构建失败时修复后删除远端 tag（`git push origin :v0.2.0`）重打即可。

## 已知说明

- 局域网信任环境，服务端无鉴权——请勿暴露到公网
- macOS 首次使用需在系统设置中授予屏幕录制与输入监控权限
- 截图以原始 PNG 直发 LLM，大图会占用更多 token；费用敏感可自行加压缩
