# Delta: client-settings-ui

## MODIFIED Requirements

### Requirement: 托盘常驻与权限引导

客户端 SHALL 以系统托盘图标常驻运行，托盘菜单 MUST 提供"打开设置"与"退出"入口。macOS 下进程驻留时 MUST NOT 在 dock 栏显示应用图标（后台代理形态），托盘（菜单栏）图标 MUST 使用 template 单色图标以融入系统菜单栏主题；Windows 下托盘行为保持现状。设置窗口 MUST 显示当前系统权限状态（macOS 的屏幕录制与输入监控），并在缺失时给出引导说明。

#### Scenario: 从托盘打开设置

- **WHEN** 用户点击托盘图标菜单中的"打开设置"
- **THEN** 设置窗口显示到前台，展示当前快捷键、服务端配置、连接状态与权限状态

#### Scenario: 退出客户端

- **WHEN** 用户点击托盘菜单中的"退出"
- **THEN** 客户端注销全局热键并终止进程

#### Scenario: macOS 下关闭设置窗口

- **WHEN** macOS 用户关闭设置窗口
- **THEN** 窗口隐藏、dock 栏不出现应用图标，进程继续驻留，菜单栏托盘图标仍在且可通过菜单重新打开设置
