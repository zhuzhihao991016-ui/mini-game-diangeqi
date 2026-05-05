# AGENTS.md

## 项目简报

这是一个微信小游戏项目，入口为根目录 `game.js`，使用微信小游戏 Canvas 2D API 绘制界面与棋盘。游戏主体是点格棋 / Dots and Boxes，支持本地双人、人机对战、好友房联网对战，并包含方格棋盘、六边形棋盘、娱乐模式棋盘和闯关用混合形状棋盘。

客户端根目录没有 `package.json`、构建脚本或自动化测试配置，主要运行环境是微信开发者工具。根目录 `project.config.json` 配置了微信小程序 appid 与 ES6 增强，`game.json` 设置竖屏方向。`online-server/` 是独立 Node.js 服务端，拥有自己的 `package.json`。

## 文件操作限制

- 禁止批量删除文件和目录。
- 不要使用 `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 需要删除文件时，只能一次删除一个明确路径的文件。
- 如果需要批量删除文件，应该停止工作，并请求用户手动删除。

## 运行入口

- `game.js`：实际小游戏入口。创建 canvas、设置 DPR、初始化 `GameApp`，初始化云托管 WebSocket 联网管理器，并创建 `UserManager`、`InfernoLeaderboard`。
- `src/main/GameApp.js`：应用容器。绑定分享进入参数，创建 `SceneManager`、`InputManager`、`GameLoop`，默认进入 `MenuScene`，并触发用户登录初始化。
- `src/main/GameLoop.js`：基于 `requestAnimationFrame` 的 update/render 循环。
- `src/main/main.js`：旧入口，引用 `../game-app`，当前项目中不存在该文件，正常开发时不要优先使用它。
- `online-server/server.js`：云托管服务端入口，提供 WebSocket 好友房、用户登录、排行榜接口和 MySQL/内存 fallback。

## 核心模块地图

- `src/scene/`：场景层。
  - `MenuScene.js`：主菜单、模式选择、棋盘选择、昵称修改、排行榜、闯关选择。
  - `BattleScene.js`：对局场景，负责输入处理、AI 回合、在线输入、撤销/提示、闯关推进、排行榜结果记录、渲染玩家卡片和结算面板。
  - `OnlineRoomScene.js`：好友房创建、加入、分享、恢复房间并进入在线对局。
  - `TutorialScene.js`、`OnlineMatchScene.js`：教程和在线匹配相关场景。
- `src/core/`：纯游戏逻辑。
  - `board/`：棋盘、格子、边、棋盘工厂。`BoardFactory` 是当前实际使用的棋盘创建入口，支持 square、hex、mixed-shape。
  - `engine/`：`GameEngine`、`RuleEngine`、`TurnManager`、`VictoryJudge`，负责落边、闭合格子、额外回合、计分和胜负判断。
  - `action/`：动作模型与队列，核心动作为 `ClaimEdgeAction`。
  - `mode/FunModeSetup.js`：娱乐模式配置，包含双倍分格、障碍格、障碍边。
  - `level/ChallengeLevels.js`：生成 20 个闯关关卡，校验布局连通性和尺寸，并按难度分配 AI。
  - `player/`：玩家模型。
- `src/ai/SimpleAI.js`：AI 逻辑。`easy` 使用得分边/安全边/低风险边策略，`hard` 增加链式闭合评估，`inferno` 增加控链、双交叉、有限 minimax 搜索。
- `src/render/`：Canvas 渲染。
  - `BoardRenderer.js`：方格、六边形、混合形状棋盘绘制。
  - `GameOverPanel.js`、`GuideRenderer.js`、`Renderer.js` 及 `layers/`：结算、引导、渲染辅助。
- `src/input/`：触摸与命中测试。
  - `InputManager.js`：集中注册微信 `wx.onTouchStart`。
  - `HitTest.js`：把触摸坐标映射到最近可点击边。
- `src/Network/`：联网层。
  - `NetManager.js`：云托管 WebSocket 连接、HELLO、心跳、重连、消息收发。
  - `RoomManager.js`：房间创建、加入、准备、落边、重赛、悔棋、离开，并把服务端事件适配成游戏内事件。
  - `FrameSyncManager.js`：保留的同步适配层，目前主要转发房间和落边事件。
  - `SyncProtocol.js`：消息类型与 JSON 编解码。
- `src/user/UserManager.js`：用户登录、本地资料缓存、昵称更新。
- `src/state/InfernoLeaderboard.js`：炼狱 3x3、炼狱 6x6、闯关排行榜客户端缓存与云托管接口适配。
- `src/state/ChallengeProgress.js`：闯关解锁进度本地存储。
- `online-server/`：好友房与排行榜服务端。
  - 依赖 `express`、`express-ws`、`mysql2`。
  - HTTP 接口包含 `/api/users/login`、`/api/users/nickname`、`/api/leaderboard/inferno-3x3`、`/api/leaderboard/inferno-6x6`、`/api/leaderboard/challenge` 及对应 `/result`。
  - WebSocket 路径为 `/ws` 和 `/ws/.websocket`。

## 当前已知风险

- 多个文件中的中文字符串和注释仍有 mojibake 乱码，不只是显示问题。`game.js`、`BattleScene.js`、`RoomManager.js`、`SimpleAI.js`、`online-server/server.js`、`docs/*.md` 都能看到受影响内容。
- `online-server/server.js` 至少存在明显的乱码破坏字符串闭合风险，例如部分 `sendError` 文案和挑战排行榜建表 SQL 默认昵称；服务端语法检查可能失败。
- `src/scene/BattleScene.js` 中有大量乱码注释/日志，但核心文案已有一部分改为 `\u` 转义。修复时不要把乱码继续复制扩散。
- `src/core/config/GameConfig.js` 和 `src/core/config/BoardConfig.js` 为空文件。
- `src/core/board/square-board-generator.js` 与 `hex-board-generator.js` 使用 CommonJS 导出，且看起来不是当前主路径；实际棋盘创建走 `BoardFactory.js`。
- 联网配置在 `game.js` 中硬编码了云环境 `prod-d8go30yrm27b9e5e5`、服务名 `express-al2u` 和路径 `/ws`，修改前需要确认目标环境。
- `online-server/` 有 `package.json`，但根目录没有统一安装或测试脚本。不要假设根目录可直接 `npm test`。
- `online-server.zip` 是打包产物，修改服务端源码后如果需要同步压缩包，应先确认发布流程。

## 开发约定

- 优先保持现有 ES module 风格：客户端使用 `import` / `export default`。`online-server/` 使用 CommonJS。
- 微信小游戏运行时代码可以使用 `wx.*` API；纯规则层应尽量避免依赖 `wx`，便于后续测试。
- 场景切换统一通过 `SceneManager.setScene(scene)`，场景进入时注册触摸处理，退出时清理触摸处理。
- 棋盘规则改动优先落在 `src/core/`，渲染改动优先落在 `src/render/`，不要把规则判断写进渲染层。
- 方格棋盘边 ID 当前形如 `h_${x}_${y}`、`v_${x}_${y}`；六边形边 ID 当前形如 `e_${cellA}_${cellB}`；混合形状边 ID 由布局点坐标生成。联网协议传输的是边 ID，改 ID 规则会影响在线对局兼容性。
- 在线对局中服务端玩家 ID 会通过座位映射到本地 `p1` / `p2`，相关逻辑在 `RoomManager.toLocalGamePlayerId()`。
- 好友房服务端现在支持重赛投票、悔棋投票、断线暂停和恢复。修改 `MessageType`、房间状态字段、历史快照或边 ID 解析前，需要同时检查客户端和服务端。
- UI 文案修复时统一使用 UTF-8，避免再次引入乱码。修复乱码后应重新检查字符串闭合和模板字符串插值。
- 排行榜同时有客户端本地缓存和服务端 MySQL/内存 fallback；改排序规则时需要同步 `InfernoLeaderboard.js` 与 `online-server/server.js`。
- 用户昵称最长按 12 个字符处理，客户端和服务端都有裁剪逻辑。

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
  - `online-server/server.js`
- 手动验证路径：
  - 主菜单进入本地双人方格 3x3 对局。
  - 主菜单进入人机方格 3x3 对局，并分别试普通、困难、炼狱 AI。
  - 主菜单进入六边形对局。
  - 主菜单进入娱乐模式，确认双倍格、障碍格/边显示和计分。
  - 主菜单进入闯关模式，完成关卡后解锁下一关并记录排行榜。
  - 创建好友房、分享/复制房间号、另一端加入、双方进入在线对局。
  - 在线断线重连、悔棋、重赛、退出房间。
  - 排行榜刷新、失败次数累计、通关后上榜。

## 给后续代理的注意事项

- 不要把乱码当作业务文案继续复制扩散；先确认原意或按上下文恢复中文。
- 不要随意删除 `wx.__userManager`、`wx.__leaderboardManager`、`wx.__roomManager`、`wx.__frameSyncManager` 等调试挂载，它们在真机调试中有用。
- 不要在没有确认服务端协议的情况下修改 `MessageType`、房间状态字段或边 ID 格式。
- 不要把根目录 `project.private.config.json` 中的本地配置当成通用团队配置。
- 不要把 `online-server/server.js` 的内存 fallback 当作持久化方案；生产排行榜需要 MySQL 环境变量和表结构正确。
- 如果需要做大改动，优先先建立最小可运行检查或规则测试，避免 Canvas/UI 问题掩盖核心规则回归。

## 微信开发者工具 CLI

- 本机微信开发者工具 CLI 路径：`E:\Program Files\微信小程序\微信web开发者工具\cli.bat`。
- PowerShell 中调用时必须给路径加引号，并用调用运算符：`& "E:\Program Files\微信小程序\微信web开发者工具\cli.bat" --lang zh -h`。
- 不确定参数时先查帮助：`cli.bat -h` 或 `cli.bat --lang zh -h`；子命令也可以查帮助，例如 `preview --lang zh -h`。
- 常用命令：
  - `login` / `islogin`：登录和检查登录状态。
  - `open --project <项目路径>`：打开工具或指定项目。
  - `preview --project <项目路径>`：生成预览二维码，可配合 `--qr-format`、`--qr-output`、`--result-output`、`--info-output`、`--debug`。
  - `auto-preview`：自动预览并获取信息。
  - `upload -v <版本号> --project <项目路径>`：上传项目代码；只有用户明确要求上传时才执行。
  - `build-npm`：构建小程序 npm。
  - `auto` / `auto-replay`：自动化能力和回放窗口。
  - `close` / `quit`：关闭项目窗口或退出 IDE；执行前需确认用户意图。
  - `cache` / `reset-fileutils`：清理工具缓存或重置文件工具；清理大范围缓存前需确认。
  - `cloud env list`、`cloud functions list/info/deploy/inc-deploy/download`：云开发相关操作；部署类命令需用户明确授权。
- 本项目如需通过 IDE 口径验证编译，优先尝试 `preview --project "C:\Users\zhuzh\WeChatProjects\minigame-1" --debug` 并读取输出；若 CLI 要求登录或打开 IDE，按报错继续处理。
- 当前机器上曾观察到 `cli.bat --lang zh -h` 启动后抛出 `EEXIST: file already exists, mkdir 'C:\Users\zhuzh\AppData\Local\微信开发者工具'`。这属于本地 CLI/工具状态问题，不应当成项目编译错误；不要为规避该问题递归删除微信开发者工具本地目录或缓存，需用户明确确认后再处理。
