# Tasks: server-provider-presets

## 1. 设置接口扩展

- [x] 1.1 `GET /api/settings` 与保存接口扩展 `analysisPrompt`、`codeLanguage` 两个字段（settings KV 读写，空串语义=回退/不注入）；验证：curl 保存与读取往返一致，`npm run typecheck` 通过
- [x] 1.2 分析调用处改为读取生效提示词（`settings.analysisPrompt?.trim() || ANALYSIS_PROMPT`）并按 `codeLanguage` 非空时末尾追加语言指令；两条协议路径（OpenAI/Anthropic）共用同一拼装函数；验证：未配置时走内置提示词（行为与现状一致），配置后新 session 的 LLM 请求体包含自定义提示词与语言指令

## 2. 配置界面

- [x] 2.1 供应商表单加预设下拉（Kimi 默认选中 / DeepSeek / OpenAI / Anthropic / 其他），选中预填 name/protocol/baseUrl/model 且可编辑，"其他"留空；DeepSeek 选项附"无视觉模型"提示文案；验证：切换各预设字段填充正确，编辑后不被覆盖
- [x] 2.2 提示词 textarea：加载时预填服务端生效提示词全文，可保存，"恢复默认"按钮（保存空串后重新拉取显示内置全文），下方 JSON 结构提示小字；验证：保存自定义提示词后新分析生效，恢复默认后回退
- [x] 2.3 编程语言下拉（不指定 / Python / Java / C++ / JavaScript / Go / Rust），保存即生效；验证：配置 Python 后编程题代码为 Python

## 3. 回归

- [x] 3.1 `npm run build`（web）与 `npm run typecheck` 通过；逐条核对 spec delta 中 analysis-orchestration / web-dashboard 的 scenario；验证：未配置任何新项时整条链路与现状行为一致
