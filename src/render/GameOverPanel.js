const PLAYER_COLORS = {
  p1: '#4A90E2',
  p2: '#E24A4A'
}

const PLAYER_NAMES = {
  p1: '玩家一',
  p2: '玩家二'
}

export default class GameOverPanel {
  constructor(ctx, canvas, width, height) {
    this.ctx = ctx
    this.canvas = canvas
    this.width = width
    this.height = height

    this.restartButton = {
      x: 0,
      y: 0,
      width: 200,
      height: 52
    }

    this.menuButton = {
      x: 0,
      y: 0,
      width: 200,
      height: 52
    }
  }

  draw(state, options = {}) {
    const ctx = this.ctx
    const W = this.width
    const H = this.height
    const localPlayerId = options.localPlayerId || null
    const restartText = options.restartText || '再来一局'

    ctx.save()

    // ── 半透明遮罩 ──────────────────────────────────────────
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(0, 0, W, H)

    // ── 面板尺寸与位置 ──────────────────────────────────────
    const panelW = W - 48
    const panelH = 400
    const panelX = 24
    const panelY = (H - panelH) / 2

    // ── 面板白色圆角底色 ────────────────────────────────────
    this._roundRect(ctx, panelX, panelY, panelW, panelH, 18)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()

    // ── 顶部彩色装饰条（胜者色，平局用灰色）────────────────
    const accentColor = state.winnerId
      ? PLAYER_COLORS[state.winnerId]
      : '#AAAAAA'

    this._roundRectTop(ctx, panelX, panelY, panelW, 6, 18)
    ctx.fillStyle = accentColor
    ctx.fill()

    // ── 标题：游戏结束 ──────────────────────────────────────
    ctx.fillStyle = '#222222'
    ctx.font = 'bold 22px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('游戏结束', W / 2, panelY + 44)

    // ── 胜负结果 ────────────────────────────────────────────
    let resultText = '势均力敌，平局！'
    if (state.winnerId) {
      const winnerName = this.getPlayerName(state.winnerId, localPlayerId)
      resultText = `${winnerName} 获胜！`
    }

    ctx.font = 'bold 26px Arial'
    ctx.fillStyle = accentColor
    ctx.fillText(resultText, W / 2, panelY + 96)

    // ── 分数卡片区域 ────────────────────────────────────────
    const cardY = panelY + 128
    const cardGap = 12
    const cardW = (panelW - 48 - cardGap) / 2
    const cardH = 86

    const playerIds = Object.keys(state.scores)

    playerIds.forEach((pid, index) => {
      const cardX = panelX + 24 + index * (cardW + cardGap)
      const score = state.scores[pid]
      const color = PLAYER_COLORS[pid] ?? '#AAAAAA'
      const name = this.getPlayerName(pid, localPlayerId)
      const isWinner = state.winnerId === pid
      const isMe = localPlayerId === pid

      // 卡片底色
      this._roundRect(ctx, cardX, cardY, cardW, cardH, 12)
      ctx.fillStyle = isWinner ? color : '#F5F5F5'
      ctx.fill()

      // 顶部细线（非胜者卡片用彩色细线点缀）
      if (!isWinner) {
        this._roundRectTop(ctx, cardX, cardY, cardW, 4, 12)
        ctx.fillStyle = color
        ctx.fill()
      }

      // 胜者皇冠标记
      if (isWinner) {
        ctx.font = '18px Arial'
        ctx.fillStyle = '#FFD700'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('♛', cardX + cardW / 2, cardY + 15)
      }

      // 玩家名称
      ctx.font = 'bold 15px Arial'
      ctx.fillStyle = isWinner ? 'rgba(255,255,255,0.9)' : '#666666'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name, cardX + cardW / 2, cardY + 30)

      // “我”标记
      if (isMe) {
        const tagW = 42
        const tagH = 20
        const tagX = cardX + cardW / 2 - tagW / 2
        const tagY = cardY + 45

        this._roundRect(ctx, tagX, tagY, tagW, tagH, 10)
        ctx.fillStyle = isWinner ? 'rgba(255,255,255,0.22)' : color
        ctx.fill()

        ctx.font = 'bold 12px Arial'
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText('我', tagX + tagW / 2, tagY + tagH / 2 + 1)
      }

      // 分数
      ctx.font = 'bold 30px Arial'
      ctx.fillStyle = isWinner ? '#FFFFFF' : color
      ctx.fillText(`${score}`, cardX + cardW / 2, cardY + 70)
    })

    // ── 底部按钮区域 ────────────────────────────────────────
    const btnW = panelW - 48
    const btnH = 48
    const btnX = panelX + 24
    const restartBtnY = panelY + panelH - 24 - btnH * 2 - 12
    const menuBtnY = panelY + panelH - 24 - btnH

    this.restartButton.x = btnX
    this.restartButton.y = restartBtnY
    this.restartButton.width = btnW
    this.restartButton.height = btnH

    this.menuButton.x = btnX
    this.menuButton.y = menuBtnY
    this.menuButton.width = btnW
    this.menuButton.height = btnH

    // 再来一局按钮
    this._drawButton({
      x: btnX,
      y: restartBtnY,
      width: btnW,
      height: btnH,
      text: restartText,
      color: accentColor,
      textColor: '#FFFFFF'
    })

    // 返回菜单按钮
    this._drawButton({
      x: btnX,
      y: menuBtnY,
      width: btnW,
      height: btnH,
      text: '返回菜单',
      color: '#F5F5F5',
      textColor: '#444444',
      leftColor: accentColor
    })

    ctx.restore()
  }

  getPlayerName(playerId, localPlayerId) {
    const baseName = PLAYER_NAMES[playerId] ?? playerId

    if (localPlayerId && localPlayerId === playerId) {
      return `${baseName}（我）`
    }

    return baseName
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
    ctx.font = 'bold 17px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + width / 2 + 3, y + height / 2)
  }

  isRestartButtonHit(x, y) {
    const btn = this.restartButton

    return (
      x >= btn.x &&
      x <= btn.x + btn.width &&
      y >= btn.y &&
      y <= btn.y + btn.height
    )
  }

  isMenuButtonHit(x, y) {
    const btn = this.menuButton

    return (
      x >= btn.x &&
      x <= btn.x + btn.width &&
      y >= btn.y &&
      y <= btn.y + btn.height
    )
  }

  // ─── 路径工具 ──────────────────────────────────────────────

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

  /** 仅顶部两角圆角（用于面板顶部装饰条）*/
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

  /** 仅左侧两角圆角（用于竖条装饰）*/
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