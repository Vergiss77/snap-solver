# Delta: analysis-orchestration

## ADDED Requirements

### Requirement: 分析提示词与编程语言配置

分析流程使用的提示词 SHALL 来自服务端设置项；未设置或设置为空字符串时 MUST 回退到服务端内置的默认提示词。设置界面 SHALL 提供编程语言配置项；当配置了编程语言时，分析请求 MUST 在用户提示词末尾追加一条独立指令要求编程题使用该语言编写代码，该指令 MUST NOT 以占位符形式嵌入提示词正文。两项配置修改 MUST 即时生效于后续新 session，无需重启服务端。

#### Scenario: 默认提示词回退

- **WHEN** 设置项中提示词为空或从未配置
- **THEN** 分析使用服务端内置默认提示词，行为与未配置时完全一致

#### Scenario: 自定义提示词生效

- **WHEN** 用户保存了自定义提示词后新截图到达
- **THEN** 新 session 的 LLM 请求使用该自定义提示词

#### Scenario: 编程语言注入

- **WHEN** 配置了编程语言（如 Python）且 LLM 判定截图为编程题
- **THEN** 生成的代码实现为该语言（LLM 请求中包含对应语言指令）

#### Scenario: 提示词破坏输出契约

- **WHEN** 自定义提示词导致 LLM 响应无法按既有宽容规则解析
- **THEN** 该 session 按既有失败处理进入 failed 并记录原因，其他 session 不受影响
