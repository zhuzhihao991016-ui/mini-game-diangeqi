import GameLoop from './GameLoop'
import SceneManager from '../scene/SceneManager'
import MenuScene from '../scene/MenuScene'
import InputManager from '../input/InputManager'

function consumeInviteQuery(options) {
  if (!options || !options.query) return

  const roomId = options.query.roomId

  if (roomId) {
    wx.setStorageSync('pending_join_room_id', String(roomId))
    console.log('收到好友房邀请 roomId:', roomId)
  }
}

export default class GameApp {
  constructor(canvas, ctx, options = {}) {
    this.canvas = canvas
    this.ctx = ctx

    this.width = options.width
    this.height = options.height
    this.dpr = options.dpr || 1

    this.sceneManager = new SceneManager()
    this.inputManager = new InputManager(canvas, this.dpr)
    this.userManager = options.userManager || wx.__userManager || null
    this.leaderboardManager = options.leaderboardManager || wx.__leaderboardManager || null

    this.loop = new GameLoop({
      update: this.update.bind(this),
      render: this.render.bind(this)
    })

    this.shareEventsBound = false
  }

  start() {
    this.bindInviteEvents()

    const menuScene = new MenuScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height,
      userManager: this.userManager,
      leaderboardManager: this.leaderboardManager
    })

    this.sceneManager.setScene(menuScene)
    this.loop.start()

    if (this.userManager && this.userManager.ensureLogin) {
      this.userManager.ensureLogin().catch(err => {
        console.warn('用户资料初始化失败:', err)
      })
    }
  }

  bindInviteEvents() {
    if (this.shareEventsBound) return

    this.shareEventsBound = true

    // 处理冷启动：用户第一次从分享卡片进入小游戏
    if (wx.getLaunchOptionsSync) {
      consumeInviteQuery(wx.getLaunchOptionsSync())
    } else if (wx.getLaunchOptionSync) {
      consumeInviteQuery(wx.getLaunchOptionSync())
    }

    // 处理热启动：小游戏在后台，用户再次从分享卡片回到前台
    if (wx.onShow) {
      wx.onShow(options => {
        consumeInviteQuery(options)
      })
    }
  }

  update(deltaTime) {
    this.sceneManager.update(deltaTime)
  }

  render() {
    const ctx = this.ctx

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    this.sceneManager.render()
  }
}
