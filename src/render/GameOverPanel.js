const PLAYER_COLORS = {
  p1: '#4A90E2',
  p2: '#E24A4A'
}

const PLAYER_NAMES = {
  p1: '\u73a9\u5bb6\u4e00',
  p2: '\u73a9\u5bb6\u4e8c'
}

const FONT_FAMILY = 'Arial, sans-serif'
const TROPHY_SYMBOL = '\uD83C\uDFC6\uFE0E'

export default class GameOverPanel {
  constructor(ctx, canvas, width, height) {
    this.ctx = ctx
    this.canvas = canvas
    this.width = width
    this.height = height
    this.restartButton = { x: 0, y: 0, width: 200, height: 52 }
    this.menuButton = { x: 0, y: 0, width: 200, height: 52 }
    this.playerNames = { ...PLAYER_NAMES }
  }

  draw(state, options = {}) {
    const ctx = this.ctx
    const W = this.width
    const H = this.height
    const localPlayerId = options.localPlayerId || null
    const restartText = options.restartText || '\u518d\u6765\u4e00\u5c40'
    this.playerNames = { ...PLAYER_NAMES, ...(options.playerNames || {}) }

    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(0, 0, W, H)

    const panelW = Math.min(W - 32, 360)
    const panelH = Math.min(Math.max(392, H * 0.56), H - 56)
    const panelX = (W - panelW) / 2
    const panelY = Math.max(28, (H - panelH) / 2)
    const accentColor = state.winnerId ? PLAYER_COLORS[state.winnerId] : '#AAAAAA'
    const padding = Math.max(18, Math.min(24, panelW * 0.07))

    this._roundRect(ctx, panelX, panelY, panelW, panelH, 14)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()

    this._roundRectTop(ctx, panelX, panelY, panelW, 6, 14)
    ctx.fillStyle = accentColor
    ctx.fill()

    ctx.fillStyle = '#222222'
    ctx.font = `bold 22px ${FONT_FAMILY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('\u6e38\u620f\u7ed3\u675f', W / 2, panelY + 42)

    let resultText = '\u52bf\u5747\u529b\u654c\uff0c\u5e73\u5c40\uff01'
    if (state.winnerId) {
      resultText = `${TROPHY_SYMBOL} ${this.getPlayerName(state.winnerId, localPlayerId)} \u83b7\u80dc\uff01`
    }

    ctx.font = `bold 25px ${FONT_FAMILY}`
    ctx.fillStyle = accentColor
    this._drawFittedText(resultText, W / 2, panelY + 90, panelW - padding * 2, 25, 18, 'bold')

    const cardY = panelY + 122
    const cardGap = 10
    const cardW = (panelW - padding * 2 - cardGap) / 2
    const cardH = 100
    const playerIds = Object.keys(state.scores)

    playerIds.forEach((pid, index) => {
      const cardX = panelX + padding + index * (cardW + cardGap)
      const score = state.scores[pid]
      const color = PLAYER_COLORS[pid] || '#AAAAAA'
      const name = this.getPlayerName(pid, localPlayerId)
      const isWinner = state.winnerId === pid
      const isMe = localPlayerId === pid

      this._roundRect(ctx, cardX, cardY, cardW, cardH, 8)
      ctx.fillStyle = isWinner ? color : '#F7F8FA'
      ctx.fill()

      if (!isWinner) {
        this._roundRectTop(ctx, cardX, cardY, cardW, 4, 8)
        ctx.fillStyle = color
        ctx.fill()
      }

      const trophyY = cardY + 20
      const nameY = isWinner ? cardY + 43 : cardY + 31

      if (isWinner) {
        ctx.font = `22px ${FONT_FAMILY}`
        ctx.fillStyle = '#FFD700'
        ctx.fillText(TROPHY_SYMBOL, cardX + cardW / 2, trophyY)
      }

      ctx.font = `bold 15px ${FONT_FAMILY}`
      ctx.fillStyle = isWinner ? 'rgba(255,255,255,0.9)' : '#666666'
      this._drawFittedText(name, cardX + cardW / 2, nameY, cardW - 18, 15, 11, 'bold')

      if (isMe) {
        const tagW = 42
        const tagH = 18
        const tagX = cardX + cardW / 2 - tagW / 2
        const tagY = cardY + 53
        this._roundRect(ctx, tagX, tagY, tagW, tagH, 9)
        ctx.fillStyle = isWinner ? 'rgba(255,255,255,0.22)' : color
        ctx.fill()
        ctx.font = `bold 12px ${FONT_FAMILY}`
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText('\u6211', tagX + tagW / 2, tagY + tagH / 2 + 1)
      }

      ctx.font = `bold 30px ${FONT_FAMILY}`
      ctx.fillStyle = isWinner ? '#FFFFFF' : color
      ctx.fillText(`${score}`, cardX + cardW / 2, cardY + cardH - 18)
    })

    const btnW = panelW - padding * 2
    const btnH = 48
    const btnX = panelX + padding
    const restartBtnY = panelY + panelH - 24 - btnH * 2 - 12
    const menuBtnY = panelY + panelH - 24 - btnH

    this.restartButton = { x: btnX, y: restartBtnY, width: btnW, height: btnH }
    this.menuButton = { x: btnX, y: menuBtnY, width: btnW, height: btnH }

    this._drawButton({ x: btnX, y: restartBtnY, width: btnW, height: btnH, text: restartText, color: accentColor, textColor: '#FFFFFF' })
    this._drawButton({ x: btnX, y: menuBtnY, width: btnW, height: btnH, text: '\u8fd4\u56de\u83dc\u5355', color: '#F5F5F5', textColor: '#444444', leftColor: accentColor })
    ctx.restore()
  }

  getPlayerName(playerId, localPlayerId) {
    const baseName = this.playerNames[playerId] || PLAYER_NAMES[playerId] || playerId
    return localPlayerId && localPlayerId === playerId ? `${baseName}\uff08\u6211\uff09` : baseName
  }

  _drawButton({ x, y, width, height, text, color, textColor, leftColor = 'rgba(0,0,0,0.15)' }) {
    const ctx = this.ctx
    this._roundRect(ctx, x, y, width, height, 12)
    ctx.fillStyle = color
    ctx.fill()
    this._roundRectLeft(ctx, x, y, 6, height, 12)
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
