import BaseScene from './BaseScene'
import BattleScene from './BattleScene'
import Button from '../ui/Button'
import TutorialScene from './TutorialScene'
import OnlineMatchScene from './OnlineMatchScene'
import OnlineRoomScene from './OnlineRoomScene'

// 与 BattleScene 保持一致的色系
const BRAND_COLOR = '#4A90E2'   // 主色（蓝）
const DANGER_COLOR = '#E24A4A'  // 返回/危险色（红）

export default class MenuScene extends BaseScene {
  constructor({ canvas, ctx, inputManager, sceneManager, width, height }) {
    super()

    this.canvas = canvas
    this.ctx = ctx
    this.inputManager = inputManager
    this.sceneManager = sceneManager

    this.width = width
    this.height = height

    this.page = 'home'
    this.selectedMode = null
    this.buttons = []

    this.toastText = ''
    this.toastTimer = 0
  }

  onEnter() {
    this.inputManager.clearTouchStartHandlers()

    this.inputManager.onTouchStart((x, y) => {
      for (const button of this.buttons) {
        if (button.hitTest(x, y)) {
          button.click()
          break
        }
      }
    })

    this.buildHomeButtons()
  }

  update(deltaTime) {
    if (this.toastTimer > 0) {
      this.toastTimer -= deltaTime
    }
  }

  render() {
    const ctx = this.ctx
    const W = this.width
    const H = this.height

    // ── 淡灰色背景（与 BattleScene 一致）───────────────────
    ctx.fillStyle = '#EFEFEF'
    ctx.fillRect(0, 0, W, H)

    this._drawTitleCard()
    this._drawSubtitle()

    for (const button of this.buttons) {
      button.draw(ctx)
    }

    if (this.toastTimer > 0) {
      this._drawToast()
    }
  }

  // ─── 标题卡片 ──────────────────────────────────────────────
  _drawTitleCard() {
    const ctx = this.ctx
    const W = this.width

    const cardW = W - 40
    const cardH = 90
    const cardX = 20
    const cardY = 70

    // 白色圆角底色
    this._roundRect(ctx, cardX, cardY, cardW, cardH, 5)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()

    // 左侧品牌色竖条
    this._roundRectLeft(ctx, cardX, cardY, 6, cardH, 14)
    ctx.fillStyle = BRAND_COLOR
    ctx.fill()

    // 游戏标题
    ctx.fillStyle = '#222222'
    ctx.font = 'bold 30px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('圈地为王', W / 2, cardY + cardH / 2 - 10)

    // 副标题
    ctx.fillStyle = BRAND_COLOR
    ctx.font = '13px Arial'
    ctx.fillText('Dots and Boxes', W / 2, cardY + cardH / 2 + 16)
  }

  // ─── 页面提示文字 ──────────────────────────────────────────
  _drawSubtitle() {
    const ctx = this.ctx
    const W = this.width

    const subtitleMap = {
      home:  '请选择操作',
      mode:  '选择游戏模式',
      board: '选择棋盘类型',
    }
    const text = subtitleMap[this.page] ?? ''

    ctx.fillStyle = '#999999'
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, W / 2, 180)
  }

  // ─── Toast ────────────────────────────────────────────────
  _drawToast() {
    const ctx = this.ctx
    const W = this.width
    const H = this.height

    const tw = 260
    const th = 46
    const tx = (W - tw) / 2
    const ty = H - 130

    this._roundRect(ctx, tx, ty, tw, th, 10)
    ctx.fillStyle = 'rgba(34,34,34,0.88)'
    ctx.fill()

    ctx.fillStyle = '#FFFFFF'
    ctx.font = '15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.toastText, W / 2, ty + th / 2)
  }

  // ─── 页面构建 ──────────────────────────────────────────────

  buildHomeButtons() {
    this.page = 'home'
    this.buttons = []

    const cx = this.width / 2
    const w = this.width - 40
    const h = 58

    // 主按钮：开始游戏（品牌色）
    this.buttons.push(this._createCard({
      x: cx - w / 2, y: 200,
      width: w, height: h,
      text: '开始游戏',
      accentColor: BRAND_COLOR,
      onClick: () => this.buildModeButtons()
    }))

    // 次要按钮：新手教程（灰色）
    this.buttons.push(this._createCard({
      x: cx - w / 2, y: 275,
      width: w, height: h,
      text: '新手教程',
      accentColor: BRAND_COLOR,
      onClick: () => {
        this.sceneManager.setScene(new TutorialScene({
          canvas: this.canvas,
          ctx: this.ctx,
          inputManager: this.inputManager,
          sceneManager: this.sceneManager,
          width: this.width,
          height: this.height
        }))
      }
    }))
  }

  buildModeButtons() {
    this.page = 'mode'
    this.buttons = []

    const cx = this.width / 2
    const w = this.width - 40
    const h = 58

    this.buttons.push(this._createCard({
      x: cx - w / 2, y: 195,
      width: w, height: h,
      text: '单人（人机）',
      accentColor: BRAND_COLOR,
      onClick: () => {
        this.selectedMode = 'ai'
        this.buildBoardButtons()
      }
    }))

    this.buttons.push(this._createCard({
      x: cx - w / 2,
      y: 268,
      width: w,
      height: h,
      text: '双人（联网）',
      accentColor: BRAND_COLOR,
      onClick: () => {
        this.sceneManager.setScene(new OnlineRoomScene({
          canvas: this.canvas,
          ctx: this.ctx,
          inputManager: this.inputManager,
          sceneManager: this.sceneManager,
          width: this.width,
          height: this.height,
          boardType: 'square',
          rows: 3,
          cols: 3,
          onlineManager: wx.__roomManager
        }))
      }
    }))

    this.buttons.push(this._createCard({
      x: cx - w / 2, y: 341,
      width: w, height: h,
      text: '双人（本地）',
      accentColor: BRAND_COLOR,
      onClick: () => {
        this.selectedMode = 'local_2p'
        this.buildBoardButtons()
      }
    }))

    this.buttons.push(this._createBackCard(() => this.buildHomeButtons()))
  }

  buildBoardButtons() {
    this.page = 'board'
    this.buttons = []
  
    const cx = this.width / 2
    const w = this.width - 40
    const h = 58
  
    // ── 方格棋盘 ─────────────────────────
    this.buttons.push(this._createCard({
      x: cx - w / 2,
      y: 195,
      width: w,
      height: h,
      text: '方格棋盘',
      accentColor: BRAND_COLOR,
      onClick: () => {
        this.selectedBoardType = 'square'
        this.buildSquareSizeButtons()
      }
    }))
  
    // ── 六边形棋盘 ⭐新增 ─────────────────
    this.buttons.push(this._createCard({
      x: cx - w / 2,
      y: 268,
      width: w,
      height: h,
      text: '六边形棋盘（半径3）',
      accentColor: BRAND_COLOR,
      onClick: () => {
        this.selectedBoardType = 'hex'
        this.startHexGame()
      }
    }))
  
    this.buttons.push(this._createBackCard(() => this.buildModeButtons()))
  }

  buildSquareSizeButtons() {
    this.buttons = []
  
    const cx = this.width / 2
    const w = this.width - 40
    const h = 58
  
    const sizes = [
      { text: '3 × 3  —  入门', rows: 3, cols: 3 },
      { text: '6 × 6  —  进阶', rows: 6, cols: 6 },
      { text: '9 × 9  —  专家', rows: 9, cols: 9 },
    ]
  
    sizes.forEach((item, index) => {
      this.buttons.push(this._createCard({
        x: cx - w / 2,
        y: 195 + index * 73,
        width: w,
        height: h,
        text: item.text,
        accentColor: BRAND_COLOR,
        onClick: () => this.startGame(item.rows, item.cols)
      }))
    })
  
    this.buttons.push(this._createBackCard(() => this.buildBoardButtons()))
  }

  startGame(rows, cols) {
    this.sceneManager.setScene(new BattleScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height,
      rows,
      cols,
      boardType: this.selectedBoardType, // ⭐关键
      mode: this.selectedMode
    }))
  }

  startHexGame() {
    this.sceneManager.setScene(new BattleScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height,
      boardType: 'hex',   // ⭐关键
      mode: this.selectedMode
    }))
  }

  showToast(text) {
    this.toastText = text
    this.toastTimer = 1500
  }

  // ─── 卡片式按钮工厂 ────────────────────────────────────────

  /**
   * 创建与玩家卡片同风格的按钮
   * 实际上返回一个鸭子对象，包含 hitTest / click / draw 三个方法
   */
  _createCard({ x, y, width, height, text, accentColor, onClick }) {
    const self = this
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click() { onClick() },
      draw(ctx) {
        ctx.save()

        // 白色圆角底色
        self._roundRect(ctx, x, y, width, height, 5)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()

        // 左侧彩色竖条
        self._roundRectLeft(ctx, x, y, 6, height, 14)
        ctx.fillStyle = accentColor
        ctx.fill()

        // 文字
        ctx.fillStyle = '#222222'
        ctx.font = 'bold 17px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, x + width / 2 + 3, y + height / 2)

        ctx.restore()
      }
    }
  }

  /**
   * 返回按钮（红色竖条，放置于底部）
   */
  _createBackCard(onClick) {
    const x = 20
    const y = this.height - 90
    const width = 110
    const height = 40

    const self = this
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click() { onClick() },
      draw(ctx) {
        ctx.save()

        self._roundRect(ctx, x, y, width, height, 4)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()

        self._roundRectLeft(ctx, x, y, 5, height, 10)
        ctx.fillStyle = '#4A90E2'
        ctx.fill()

        ctx.fillStyle = '#444444'
        ctx.font = 'bold 15px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('← 返回', x + width / 2 + 3, y + height / 2)

        ctx.restore()
      }
    }
  }

  // ─── 路径工具（与 BattleScene 完全一致）───────────────────

  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y,     x + w, y + r,     r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x,      y + h, x,      y + h - r, r)
    ctx.lineTo(x,      y + r)
    ctx.arcTo(x,      y,     x + r,  y,         r)
    ctx.closePath()
  }

  _roundRectLeft(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y,     x + r, y,     r)
    ctx.closePath()
  }
}