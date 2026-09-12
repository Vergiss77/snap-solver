# Proposal: ci-release-pipeline

## Why

目前项目的客户端（Tauri 2）与服务端（Node 直跑 TS）都只能在本机手工构建，用户想使用必须自备 Rust 工具链与 Node ≥24 环境。需要一条推送 tag 即自动构建、产出可直接下载的 Release 的 CI 流水线，降低使用门槛。

## What Changes

- 新增 `.github/workflows/release.yml`：推送 `v*` tag 触发，自动创建同名 GitHub Release 并上传构建产物
- 客户端矩阵构建（`tauri-apps/tauri-action`）：Windows（.exe + NSIS 安装包）、macOS Apple Silicon（.app/.dmg，target `aarch64-apple-darwin`）、macOS Intel（target `x86_64-apple-darwin`）；不做代码签名/公证（接受用户手动绕过系统警告，README 补充说明）
- 服务端打包 job：CI 内先构建 `server/web/dist`，再将 `server/`、`shared/`、预构建的 web 静态资源与启动说明打成 `snap-solver-server-<version>.tar.gz` 上传到同一 Release（方案 2，用户侧仍需 Node ≥24 + `npm install --omit=dev`）
- master 日常推送不触发构建，仅 tag 发版
- README 更新：下载安装说明（含未签名包的 SmartScreen / Gatekeeper 绕过方法）
- 无业务代码改动，无产品行为变化

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。本次为纯 CI/工具链变更，不涉及任何 spec 级行为变化，`.openspec.yaml` 已设置 `skip_specs: true`。

## Impact

- **新增**：`.github/workflows/release.yml`
- **修改**：`README.md`（下载与安装章节）、`client/src-tauri/tauri.conf.json` 不改动（发版时人工 bump version 后再打 tag，流程写入 design）
- **依赖**：GitHub Actions 免费额度（仓库为 public 则无限制）；`tauri-apps/tauri-action` 官方 action
- **风险**：未签名包在 Windows/macOS 上有安全警告（已确认接受）；Tauri Rust 编译单次约 10-20 分钟
