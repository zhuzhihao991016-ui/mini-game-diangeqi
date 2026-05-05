import BaseScene from './BaseScene'
import BattleScene from './BattleScene'
import MenuScene from './MenuScene'
import { getSceneSafeLayout } from '../utils/SafeArea'
import SoundEffects from '../assets/SoundEffects'
import UITheme from '../ui/theme'

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

    this.safeLayout = getSceneSafeLayout(this.width, this.height)

    this.backButton = {
      x: UITheme.menu.pageX,
      y: this.safeLayout.top,
      width: UITheme.menu.backW,
      height: UITheme.menu.backH
    }
  }

  y(value) {
    return value + this.safeLayout.insets.top
  }

  onEnter() {
    this.inputManager.clearTouchStartHandlers()

    this.inputManager.onTouchStart((x, y) => {
      if (this.isBackButtonHit(x, y)) {
        SoundEffects.play('button')
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

    ctx.fillStyle = UITheme.colors.background
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.fillStyle = UITheme.colors.text
    ctx.font = `bold ${UITheme.menu.titleFont}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('联网对战', this.width / 2, this.safeLayout.top + 17)

    ctx.fillStyle = UITheme.colors.muted
    ctx.font = '14px Arial'
    ctx.fillText(this.statusText, this.width / 2, this.y(220))

    if (this.roomId) {
      ctx.font = '13px Arial'
      ctx.fillText(`房间ID：${this.roomId}`, this.width / 2, this.y(255))
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
    this.roundRect(ctx, b.x, b.y, b.width, b.height, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = UITheme.colors.text
    ctx.font = `bold ${UITheme.menu.compactFont}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('\u2039', b.x + b.width / 2, b.y + b.height / 2)
    ctx.restore()
  }

  roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }
}
