# Design: ci-release-pipeline

## Context

Monorepo（npm workspaces）：`client/` 是 Tauri 2 + React 桌面客户端（Rust 编译出原生安装包），`server/` 是 Node ≥24 直跑 TypeScript 的 Fastify 服务端，`server/web/` 是 Vite 构建的看板，`shared/` 为共享类型包（导出裸 `.ts` 源码）。仓库托管在 GitHub，无既有 CI。动机与范围见 proposal.md。

## Goals / Non-Goals

**Goals:**

- 推 `v*` tag → 自动创建 GitHub Release，挂载三平台客户端安装包与服务端 tar 包
- 全流程在一个 workflow 文件内完成，不引入发布工具链（如 release-please、changesets）
- 构建可复现：CI 内从零 `npm install` + 构建 web + 打包

**Non-Goals:**

- 不做代码签名/公证（Windows SmartScreen、macOS Gatekeeper 警告由用户在 README 指引下手动绕过）
- 不做 Linux 客户端、不做服务端 SEA 单文件可执行
- 不做自动版本号 bump 与 changelog 生成（发版 = 人工 bump `tauri.conf.json` version → 打 tag）
- 不做 master 分支的持续构建/测试门禁（本期只发版，不加 CI test）

## Decisions

### 1. 触发：仅 `push: tags: ['v*']`

master 推送不构建。理由：Tauri Rust 编译单平台约 10-20 分钟，每次 push 构建浪费 CI 时间；tag 与 `tauri.conf.json` 的 version 字段天然对齐，发版动作显式化。备选（push master 构建 nightly pre-release）因无此需求被否。

### 2. 客户端：`tauri-apps/tauri-action` 官方 action + 三目标矩阵

矩阵三格：

| Runner | target | 产物 |
|---|---|---|
| `windows-latest` | （默认） | `snap-solver-client.exe`、NSIS 安装包 |
| `macos-latest` | `aarch64-apple-darwin`（默认） | `.app` / `.dmg`（Apple Silicon） |
| `macos-latest` | `x86_64-apple-darwin` | `.dmg`（Intel） |

- 每格步骤：checkout → setup-node（`node-version: 24`，`cache: npm`）→ `npm install`（根目录，workspaces 全量安装，client 构建只用到 client workspace）→ `tauri-action`（自带 Rust 工具链与缓存，`tagName`/`releaseName` 取自 tag，产物自动上传 Release）
- `tauri-action` 在 tag 推送时会自动创建 draft Release 并上传 bundle 产物；三个矩阵格共享同一 Release（action 内置并发安全处理）
- **不配 `TAURI_SIGNING_*`  secrets**：bundle 直接未签名产出

### 3. 服务端：独立 job 打 tar 包

- runner `ubuntu-latest`：checkout → setup-node 24 → `npm install` → `npm run build -w @snap-solver/web`
- 打包内容：`server/src`、`server/package.json`、`shared/`（server 依赖其裸 TS 源码）、`server/web/dist`（预构建）、`README` 启动说明片段
- 包名 `snap-solver-server-<tag去v>.tar.gz`，用 `softprops/action-gh-release` 或 `gh release upload` 上传到同一 Release
- 用户侧：`tar xzf` → `npm install --omit=dev` → `node server/src/index.ts`（仍需 Node ≥24，README 写明）
- 备选（pkg/SEA 单文件 exe）因 Node 24 直跑 TS 与 SEA 打包链不兼容、复杂度高被否

### 4. 版本一致性约定

发版流程（写入 README）：改 `client/src-tauri/tauri.conf.json` 与 `client/package.json` 的 version → commit → `git tag v<x.y.z>` → push tag。CI 不校验 tag 与 conf 版本一致性（第一版不引入校验脚本，靠流程约定）。

## Risks / Trade-offs

- **未签名包被系统拦截** → 已确认接受；README 补充 SmartScreen"仍要运行"与 macOS"右键打开"指引
- **Tauri 构建慢（Rust 全量编译）** → action 内置 Rust cache；矩阵并行后整体约 20 分钟，可接受
- **public 仓库的 Release 任何人可下载** → 本工具无敏感内容，安装包不含用户配置（API key 存服务端本地 data 目录），可接受
- **服务端 tar 包仍需用户装 Node 24** → 已在 README 环境要求中说明；如未来有诉求再评估 SEA
- **macOS 双 target 使 CI 时间翻倍** → 用户明确要 Intel 支持，接受

## Migration Plan

纯新增 workflow：合入 master 后，打第一个 tag（如 `v0.1.0`）即验证整条流水线。失败时不影响任何现有代码，删 tag 重打即可。回滚 = 删除 `.github/workflows/release.yml`。

## Open Questions

无。
