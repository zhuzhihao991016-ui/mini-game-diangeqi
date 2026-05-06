import UITheme from '../ui/theme'
import { drawImageAsset, preloadImageAssets } from '../assets/ImageAssets'

const PLAYER_COLORS = {
  p1: UITheme.colors.p1,
  p2: UITheme.colors.p2
}

const PLAYER_NAMES = {
  p1: '玩家一',
  p2: '玩家二'
}

const FONT_FAMILY = 'Arial, sans-serif'
const TROPHY_SYMBOL = '🏆︎'

export default class GameOverPanel {
  constructor(ctx, canvas, width, height) {
    this.ctx = ctx
    this.canvas = canvas
    this.width = width
    this.height = height
    this.restartButton = { x: 0, y: 0, width: 200, height: 52 }
    this.menuButton = { x: 0, y: 0, width: 200, height: 52 }
    this.playerNames = { ...PLAYER_NAMES }
    preloadImageAssets()
  }

  draw(state, options = {}) {
    const ctx = this.ctx
    const W = this.width
    const H = this.height
    const localPlayerId = options.localPlayerId || null
    const restartText = options.restartText || '再来一局'
    this.playerNames = { ...PLAYER_NAMES, ...(options.playerNames || {}) }

    ctx.save()
    ctx.fillStyle = 'rgba(24, 50, 74, 0.58)'
    ctx.fillRect(0, 0, W, H)

    const panelW = Math.min(W - 32, 360)
    const compact = H < 680
    const panelH = Math.min(Math.max(compact ? 344 : 392, H * (compact ? 0.62 : 0.56)), H - 40)
    const panelX = (W - panelW) / 2
    const panelY = Math.max(20, (H - panelH) / 2)
    const accentColor = state.winnerId ? PLAYER_COLORS[state.winnerId] : '#AAAAAA'
    const padding = Math.max(18, Math.min(24, panelW * 0.07))

    this._roundRect(ctx, panelX, panelY, panelW, panelH, UITheme.radius.lg)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()

    this._roundRectTop(ctx, panelX, panelY, panelW, 6, UITheme.radius.lg)
    ctx.fillStyle = accentColor
    ctx.fill()

    ctx.fillStyle = UITheme.colors.text
    ctx.font = `bold 22px ${FONT_FAMILY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('游戏结束', W / 2, panelY + (compact ? 32 : 42))
    if (!compact) {
      drawImageAsset(ctx, 'crown', W / 2 - 26, panelY + 55, 52, 52)
    } else {
      drawImageAsset(ctx, 'crown', W / 2 - 18, panelY + 42, 36, 36)
    }

    let resultText = '势均力敌，平局！'
    if (state.winnerId) {
      resultText = `${TROPHY_SYMBOL} ${this.getPlayerName(state.winnerId, localPlayerId)} 获胜！`
    }

    ctx.font = `bold 25px ${FONT_FAMILY}`
    ctx.fillStyle = accentColor
    this._drawFittedText(resultText, W / 2, panelY + (compact ? 90 : 116), panelW - padding * 2, compact ? 22 : 25, 16, 'bold')

    const cardY = panelY + (compact ? 112 : 148)
    const cardGap = 10
    const cardW = (panelW - padding * 2 - cardGap) / 2
    const cardH = compact ? 82 : 100
    const playerIds = Object.keys(state.scores)

    playerIds.forEach((pid, index) => {
      const cardX = panelX + padding + index * (cardW + cardGap)
      const score = state.scores[pid]
      const color = PLAYER_COLORS[pid] || '#AAAAAA'
      const name = this.getPlayerName(pid, localPlayerId)
      const isWinner = state.winnerId === pid
      const isMe = localPlayerId === pid

      this._roundRect(ctx, cardX, cardY, cardW, cardH, 8)
      ctx.fillStyle = isWinner ? color : UITheme.colors.surfaceTint
      ctx.fill()

      if (!isWinner) {
        this._roundRectTop(ctx, cardX, cardY, cardW, 4, 8)
        ctx.fillStyle = color
        ctx.fill()
      }

      const trophyY = cardY + (compact ? 16 : 20)
      const nameY = isWinner ? cardY + (compact ? 35 : 43) : cardY + (compact ? 25 : 31)

      if (isWinner) {
        ctx.font = `22px ${FONT_FAMILY}`
        ctx.fillStyle = UITheme.colors.warning
        ctx.fillText(TROPHY_SYMBOL, cardX + cardW / 2, trophyY)
      }

      ctx.font = `bold 15px ${FONT_FAMILY}`
      ctx.fillStyle = isWinner ? 'rgba(255,255,255,0.92)' : UITheme.colors.muted
      this._drawFittedText(name, cardX + cardW / 2, nameY, cardW - 18, 15, 11, 'bold')

      if (isMe) {
        const tagW = 42
        const tagH = 18
        const tagX = cardX + cardW / 2 - tagW / 2
        const tagY = cardY + (compact ? 42 : 53)
        this._roundRect(ctx, tagX, tagY, tagW, tagH, 9)
        ctx.fillStyle = isWinner ? 'rgba(255,255,255,0.22)' : color
        ctx.fill()
        ctx.font = `bold 12px ${FONT_FAMILY}`
        ctx.fillStyle = UITheme.colors.surface
        ctx.fillText('我', tagX + tagW / 2, tagY + tagH / 2 + 1)
      }

      ctx.font = `bold ${compact ? 25 : 30}px ${FONT_FAMILY}`
      ctx.fillStyle = isWinner ? UITheme.colors.surface : color
      ctx.fillText(`${score}`, cardX + cardW / 2, cardY + cardH - (compact ? 14 : 18))
    })

    const btnW = panelW - padding * 2
    const btnH = compact ? 42 : 48
    const btnX = panelX + padding
    const bottomPad = compact ? 16 : 24
    const btnGap = compact ? 8 : 12
    const restartBtnY = panelY + panelH - bottomPad - btnH * 2 - btnGap
    const menuBtnY = panelY + panelH - bottomPad - btnH

    this.restartButton = { x: btnX, y: restartBtnY, width: btnW, height: btnH }
    this.menuButton = { x: btnX, y: menuBtnY, width: btnW, height: btnH }

    this._drawButton({ x: btnX, y: restartBtnY, width: btnW, height: btnH, text: restartText, color: accentColor, textColor: '#FFFFFF' })
    this._drawButton({ x: btnX, y: menuBtnY, width: btnW, height: btnH, text: '返回菜单', color: UITheme.colors.surfaceTint, textColor: UITheme.colors.text, leftColor: accentColor })
    ctx.restore()
  }

  getPlayerName(playerId, localPlayerId) {
    const baseName = this.playerNames[playerId] || PLAYER_NAMES[playerId] || playerId
    return localPlayerId && localPlayerId === playerId ? `${baseName}（我）` : baseName
  }

  _drawButton({ x, y, width, height, text, color, textColor, leftColor = 'rgba(0,0,0,0.15)' }) {
    const ctx = this.ctx
    this._roundRect(ctx, x, y, width, height, UITheme.radius.md)
    ctx.fillStyle = color
    ctx.fill()
    this._roundRectLeft(ctx, x, y, 6, height, UITheme.radius.md)
    ctx.fillStyle = leftColor
    ctx.fill()
    ctx.fillStyle = textColor
    ctx.font = `bold 17px ${FONT_FAMILY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this._drawFittedText(text, x + width / 2 + 3, y + height / 2, width - 28, 17, 12, 'bold')
  }

  isRestartButtonHit(x, y) {
    const btn = this.restartButton
    return x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height
  }

  isMenuButtonHit(x, y) {
    const btn = this.menuButton
    return x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height
  }

  _roundRect(ctx, x, y, w, h, r) {
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

  _roundRectTop(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
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
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  _drawFittedText(text, x, y, maxWidth, fontSize, minFontSize = 10, weight = '') {
    const ctx = this.ctx
    const safeText = `${text}`
    const fontWeight = weight ? `${weight} ` : ''
    let size = fontSize

    while (size > minFontSize) {
      ctx.font = `${fontWeight}${size}px ${FONT_FAMILY}`
      if (ctx.measureText(safeText).width <= maxWidth) break
      size -= 1
    }

    ctx.fillText(safeText, x, y)
  }
}
