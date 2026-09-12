# Delta: web-dashboard

## MODIFIED Requirements

### Requirement: 服务端配置界面

网页前端 SHALL 提供服务端配置界面， MUST 包含：监听端口、LLM 供应商管理（增删改、协议类型、设为生效）、分析并发上限、分析提示词编辑与编程语言配置。供应商表单 SHALL 提供服务商预设下拉（含 Kimi、DeepSeek、OpenAI、Anthropic 与"其他"，默认选中 Kimi），选择预设时自动预填名称、协议、baseURL 与推荐模型且全部可继续编辑，选择"其他"时不预填。提示词编辑框 MUST 预置当前生效提示词全文（未自定义时为内置默认提示词），并提供恢复默认入口；界面 MUST 提示用户保留提示词中的 JSON 输出结构约定。除端口外的配置修改 MUST 即时生效；端口修改提示需重启服务端。预设下拉仅为输入辅助，MUST NOT 限制用户填写任意供应商参数。

#### Scenario: 修改并发上限

- **WHEN** 用户在配置界面修改最大并发数并保存
- **THEN** 新的上限立即约束后续 session 的调度

#### Scenario: 配置供应商并设为生效

- **WHEN** 用户在配置界面新增供应商并设为生效
- **THEN** 后续新 session 使用该供应商发起分析

#### Scenario: 选择服务商预设

- **WHEN** 用户在新增供应商表单选择预设（如 Kimi）
- **THEN** 名称、协议、baseURL 与推荐模型自动填入且可编辑；切换为"其他"时字段恢复为空

#### Scenario: 编辑分析提示词

- **WHEN** 用户在提示词编辑框修改内容并保存
- **THEN** 后续新 session 使用自定义提示词；点击恢复默认后回退为内置默认提示词
