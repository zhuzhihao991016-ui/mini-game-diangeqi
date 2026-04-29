# AGENTS.md

## 项目简报

这是一个微信小游戏项目，入口为根目录 `game.js`，使用微信小游戏 Canvas 2D API 绘制界面与棋盘。游戏主体是点格棋 / Dots and Boxes，支持本地双人、人机对战、好友房联网对战，并包含方格棋盘与六边形棋盘两类棋盘。

当前项目没有 `package.json`、构建脚本或自动化测试配置，主要运行环境应是微信开发者工具。根目录的 `project.config.json` 配置了微信小程序 appid 与 ES6 增强，`game.json` 设置竖屏方向。

## 运行入口

- `game.js`：实际小游戏入口。创建 canvas、设置 DPR、初始化 `GameApp`，并初始化云托管 WebSocket 联网管理器。
- `src/main/GameApp.js`：应用容器。绑定分享进入参数，创建 `SceneManager`、`InputManager`、`GameLoop`，默认进入 `MenuScene`。
- `src/main/GameLoop.js`：基于 `requestAnimationFrame` 的 update/render 循环。
- `src/main/main.js`：看起来是旧入口，引用 `../game-app`，当前项目中不存在该文件，正常开发时不要优先使用它。

## 核心模块地图

- `src/scene/`：场景层。
  - `MenuScene.js`：主菜单、模式选择、棋盘选择。
  - `BattleScene.js`：对局场景，负责输入处理、AI 回合、在线输入、渲染玩家卡片、结算面板。
  - `OnlineRoomScene.js`：好友房创建、加入、分享、恢复房间并进入在线对局。
  - `TutorialScene.js`、`OnlineMatchScene.js`：教程和在线匹配相关场景。
- `src/core/`：纯游戏逻辑。
  - `board/`：棋盘、格子、边、棋盘工厂。`BoardFactory` 是当前实际使用的棋盘创建入口。
  - `engine/`：`GameEngine`、`RuleEngine`、`TurnManager`、`VictoryJudge`，负责落边、闭合格子、额外回合、计分和胜负判断。
  - `action/`：动作模型与队列，核心动作为 `ClaimEdgeAction`。
  - `player/`：玩家模型。
- `src/render/`：Canvas 渲染。
  - `BoardRenderer.js`：方格和六边形棋盘绘制。
  - `GameOverPanel.js`、`GuideRenderer.js`、`Renderer.js` 及 `layers/`：结算、引导、渲染辅助。
- `src/input/`：触摸与命中测试。
  - `InputManager.js`：集中注册微信 `wx.onTouchStart`。
  - `HitTest.js`：把触摸坐标映射到最近可点击边。
- `src/Network/`：联网层。
  - `NetManager.js`：云托管 WebSocket 连接、心跳、重连、消息收发。
  - `RoomManager.js`：房间创建、加入、准备、落边、重赛、离开，并把服务端事件适配成游戏内事件。
  - `FrameSyncManager.js`：保留的同步适配层，目前主要转发房间和落边事件。
  - `SyncProtocol.js`：消息类型与 JSON 编解码。
- `src/ai/SimpleAI.js`：简单 AI，优先得分边，其次安全边，最后选择风险最低边。

## 当前已知风险

- 多个文件中的中文字符串和注释已经乱码，且不只是显示问题。`src/scene/OnlineRoomScene.js` 至少存在字符串未闭合导致的语法错误，静态检查会失败。
- `src/scene/BattleScene.js` 也有多处可疑乱码字符串，建议修复编码后再做完整语法检查。
- `src/core/config/GameConfig.js` 和 `src/core/config/BoardConfig.js` 为空文件。
- `src/core/board/square-board-generator.js` 与 `hex-board-generator.js` 使用 CommonJS 导出，且看起来不是当前主路径；实际棋盘创建走 `BoardFactory.js`。
- 联网配置在 `game.js` 中硬编码了云环境、服务名和路径，修改前需要确认目标环境。
- 没有自动测试、lint 或格式化配置。改动核心规则时建议至少补充可在本地 Node 环境运行的轻量规则测试。

## 开发约定

- 优先保持现有 ES module 风格：`import` / `export default`。
- 微信小游戏运行时代码可以使用 `wx.*` API；纯规则层应尽量避免依赖 `wx`，便于后续测试。
- 场景切换统一通过 `SceneManager.setScene(scene)`，场景进入时注册触摸处理，退出时清理触摸处理。
- 棋盘规则改动优先落在 `src/core/`，渲染改动优先落在 `src/render/`，不要把规则判断写进渲染层。
- 方格棋盘边 ID 当前形如 `h_${x}_${y}`、`v_${x}_${y}`；六边形边 ID 当前形如 `e_${cellA}_${cellB}`。联网协议传输的是边 ID，改 ID 规则会影响在线对局兼容性。
- 在线对局中服务端玩家 ID 会通过座位映射到本地 `p1` / `p2`，相关逻辑在 `RoomManager.toLocalGamePlayerId()`。
- UI 文案修复时统一使用 UTF-8，避免再次引入乱码。修复乱码后应重新检查字符串闭合和模板字符串插值。

## 建议验证

- 在微信开发者工具中导入根目录，确认 `game.js` 作为小游戏入口运行。
- 修复编码问题后，对关键文件做语法检查，至少覆盖：
  - `game.js`
  - `src/main/GameApp.js`
  - `src/scene/MenuScene.js`
  - `src/scene/BattleScene.js`
  - `src/scene/OnlineRoomScene.js`
  - `src/core/engine/GameEngine.js`
  - `src/Network/*.js`
- 手动验证路径：
  - 主菜单进入本地双人方格 3x3 对局。
  - 主菜单进入人机方格 3x3 对局。
  - 主菜单进入六边形对局。
  - 创建好友房、分享/复制房间号、另一端加入、双方进入在线对局。
  - 在线断线重连、重赛、退出房间。

## 给后续代理的注意事项

- 不要把乱码当作业务文案继续复制扩散；先确认原意或按上下文恢复中文。
- 不要随意删除 `wx.__roomManager`、`wx.__frameSyncManager` 等调试挂载，它们在真机调试中有用。
- 不要在没有确认服务端协议的情况下修改 `MessageType`、房间状态字段或边 ID 格式。
- 不要把根目录 `project.private.config.json` 中的本地配置当成通用团队配置。
- 如果需要做大改动，优先先建立最小可运行检查或规则测试，避免 Canvas/UI 问题掩盖核心规则回归。
