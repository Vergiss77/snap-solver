# Tasks: ci-release-pipeline

## 1. Release workflow 骨架

- [x] 1.1 新建 `.github/workflows/release.yml`：`on.push.tags: ['v*']`，声明 `contents: write` 权限（上传 Release 产物需要）；验证：workflow 文件语法合法（`npx yaml` 解析或 actionlint 通过，或推送后 GitHub 页面无语法报错）

## 2. 客户端矩阵构建 job

- [x] 2.1 添加 `client` job：三格矩阵（windows-latest 默认 target / macos-latest + aarch64-apple-darwin / macos-latest + x86_64-apple-darwin），步骤为 checkout → setup-node 24（cache npm）→ `npm install` → `tauri-apps/tauri-action`；验证：推送测试 tag 后三格全部构建成功
- [x] 2.2 配置 `tauri-action` 的 tagName/releaseName 取自 `github.ref_name`，产物自动上传同名 Release；验证：Release 页面出现 Windows 的 .exe/NSIS 与两个 macOS 的 .dmg，均可下载

## 3. 服务端 tar 包 job

- [x] 3.1 添加 `server-bundle` job（ubuntu-latest）：checkout → setup-node 24 → `npm install` → `npm run build -w @snap-solver/web` 成功产出 `server/web/dist`；验证：job 日志中 vite build 成功
- [x] 3.2 打 `snap-solver-server-<version>.tar.gz`（含 server/src、server/package.json、shared/、server/web/dist、启动说明），用 `gh release upload` 或 `softprops/action-gh-release` 上传到同一 Release；验证：Release 页面出现该 tar 包且可下载
- [x] 3.3 本机模拟验证 tar 包可用：解压到干净目录 → `npm install --omit=dev` → `node server/src/index.ts` 能启动并托管看板；验证：浏览器访问看板正常加载

## 4. 文档与收尾

- [x] 4.1 README 新增"下载安装"章节：Release 下载对应平台安装包；Windows SmartScreen 与 macOS Gatekeeper（右键→打开）绕过说明；服务端 tar 包的解压/安装/启动步骤；验证：文档步骤与实际产物一一对应
- [x] 4.2 README 补充发版流程：bump `tauri.conf.json` 与 `client/package.json` version → commit → `git tag v<x.y.z>` → push tag；验证：流程文档化
- [x] 4.3 端到端验证：推送一个真实 tag（如 v0.1.0），确认 Release 自动创建、四类产物（exe/NSIS、dmg-arm64、dmg-x64、server tar.gz）齐全且可下载；验证后如产物无误即完成，有误则修复 workflow 重打 tag
