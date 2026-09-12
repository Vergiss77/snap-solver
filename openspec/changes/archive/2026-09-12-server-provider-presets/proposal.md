# Proposal: server-provider-presets

## Why

配置新供应商时需要手工查找并输入 baseURL 等参数，门槛高且易出错；分析提示词目前硬编码在服务端代码中，用户无法调整解题风格；编程题生成代码的语言不可控，模型自由发挥可能给出用户不熟悉的语言。

## What Changes

- **服务商预设下拉**：新增供应商表单顶部增加预设选择（Kimi 默认选中 / DeepSeek / OpenAI / Anthropic / 其他），选中自动预填名称、协议、baseUrl 与推荐模型，全部可继续编辑；选"其他"则全部留空
- **提示词可配置**：配置界面新增提示词 textarea，预置当前默认提示词全文（含 title 字段约定），可修改保存；留空或点"恢复默认"时回退内置提示词；界面提示需保留 JSON 输出结构
- **编程语言配置**：配置界面新增编程语言选择（如 Python/Java/C++/JavaScript 等），编程题按指定语言生成代码；语言指令作为独立语句追加在用户提示词末尾，不以占位符形式嵌入提示词正文
- 配置存服务端 settings KV，即时生效无需重启
- 不做流式输出（本期明确排除，后续单独评估）

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `analysis-orchestration`: 新增需求——分析提示词与编程语言可配置（提示词来自服务端设置、缺省回退内置默认；编程语言指令追加注入）
- `web-dashboard`: "服务端配置界面"需求扩展——新增服务商预设下拉、提示词编辑与编程语言配置项

## Impact

- **服务端**：`routes.ts` 设置接口扩展（prompt、codeLanguage 两项 KV）；`scheduler`/分析调用处改为读取生效提示词并拼接语言指令；`llm/prompt.ts` 默认提示词保持内置兜底
- **前端**：`ConfigPanel.tsx` 新增预设下拉、提示词 textarea（含恢复默认按钮）、编程语言选择
- **shared**：设置项类型扩展
- **数据库**：无 schema 变更（settings KV 表复用）
- **兼容性**：未配置时行为与现状完全一致（内置提示词、语言不限）

## Dependencies

依赖 `quiz-display-enhancements` 先落地（默认提示词需已含 title 字段约定，预置文本才是最终版）。
