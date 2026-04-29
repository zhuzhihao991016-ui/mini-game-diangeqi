import BaseScene from './BaseScene'
import BattleScene from './BattleScene'
import MenuScene from './MenuScene'

export default class OnlineMatchScene extends BaseScene {
  constructor({
    canvas,
    ctx,
    inputManager,
    sceneManager,
    width,
    height,
    boardType = 'square',
    rows = 3,
    cols = 3
  }) {
    super()

    this.canvas = canvas
    this.ctx = ctx
    this.inputManager = inputManager
    this.sceneManager = sceneManager

    this.width = width
    this.height = height

    this.boardType = boardType
    this.rows = rows
    this.cols = cols

    this.statusText = '准备匹配...'
    this.roomId = null
    this.onlineManager = null

    this.backButton = {
      x: 20,
      y: 20,
      width: 120,
      height: 44
    }
  }

  onEnter() {
    this.inputManager.clearTouchStartHandlers()

    this.inputManager.onTouchStart((x, y) => {
      if (this.isBackButtonHit(x, y)) {
        this.sceneManager.setScene(new MenuScene({
          canvas: this.canvas,
          ctx: this.ctx,
          inputManager: this.inputManager,
          sceneManager: this.sceneManager,
          width: this.width,
          height: this.height
        }))
      }
    })

    this.startMatch()
  }

  async startMatch() {
    try {
      this.statusText = '正在初始化联机服务...'

      const openId = await this.getOpenId()

      this.statusText = '正在匹配玩家...'

      const result = await this.onlineManager.matchRoom({
        nickname: '玩家'
      })

      this.roomId = result.roomId

      this.statusText = '匹配成功，等待帧同步开始...'

      this.onlineManager.onReady(() => {
        this.enterBattle()
      })
    } catch (err) {
      console.error(err)
      this.statusText = '匹配失败，请稍后重试'
    }
  }

  getRoomType() {
    if (this.boardType === 'hex') {
      return 'dots_hex_r3'
    }

    return `dots_square_${this.rows}x${this.cols}`
  }

  /**
   * 这里你需要替换成你项目里的登录逻辑。
   * openId 必须是真实且稳定的玩家唯一标识。
   */
  getOpenId() {
    return new Promise((resolve, reject) => {
      // 临时调试用，不建议线上使用
      const fakeOpenId = wx.getStorageSync('debug_openid') ||
        `debug_${Math.random().toString(36).slice(2)}`

      wx.setStorageSync('debug_openid', fakeOpenId)

      resolve(fakeOpenId)
    })
  }

  enterBattle() {
    this.sceneManager.setScene(new BattleScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height,
      rows: this.rows,
      cols: this.cols,
      boardType: this.boardType,
      mode: 'online',
      onlineManager: this.onlineManager
    }))
  }

  update() {}

  render() {
    const ctx = this.ctx

    ctx.fillStyle = '#EFEFEF'
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.fillStyle = '#222'
    ctx.font = 'bold 26px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('联网对战', this.width / 2, 150)

    ctx.fillStyle = '#777'
    ctx.font = '16px Arial'
    ctx.fillText(this.statusText, this.width / 2, 220)

    if (this.roomId) {
      ctx.font = '13px Arial'
      ctx.fillText(`房间ID：${this.roomId}`, this.width / 2, 255)
    }

    this.drawBackButton()
  }

  isBackButtonHit(x, y) {
    const b = this.backButton

    return (
      x >= b.x &&
      x <= b.x + b.width &&
      y >= b.y &&
      y <= b.y + b.height
    )
  }

  drawBackButton() {
    const ctx = this.ctx
    const b = this.backButton

    ctx.save()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(b.x, b.y, b.width, b.height)

    ctx.fillStyle = '#444'
    ctx.font = 'bold 15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('← 返回', b.x + b.width / 2, b.y + b.height / 2)
    ctx.restore()
  }
}