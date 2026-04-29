import BaseScene from './BaseScene'
import MenuScene from './MenuScene'
import GameEngine from '../core/engine/GameEngine'
import BoardFactory from '../core/board/BoardFactory'
import Renderer from '../render/Renderer'
import BoardRenderer from '../render/BoardRenderer'
import GameOverPanel from '../render/GameOverPanel'
import HitTest from '../input/HitTest'
import ClaimEdgeAction from '../core/action/ClaimEdgeAction'
import AnimationManager from '../animation/AnimationManager'
import SimpleAI from '../ai/SimpleAI'

const PLAYER_COLORS = {
  p1: '#4A90E2',
  p2: '#E24A4A'
}

const DEFAULT_PLAYER_NAMES = {
  p1: '\u73a9\u5bb6\u4e00',
  p2: '\u73a9\u5bb6\u4e8c'
}

export default class BattleScene extends BaseScene {
  constructor({ canvas, ctx, inputManager, sceneManager, width, height, rows = 3, cols = 3,  boardType = 'square', mode = 'local_2p', aiDifficulty = 'easy', onlineManager = null, userManager = null, leaderboardManager = null }) {
    super()
  
    this.canvas = canvas
    this.ctx = ctx
    this.inputManager = inputManager
    this.sceneManager = sceneManager
  
    this.width = width
    this.height = height
  
    this.rows = rows
    this.cols = cols
    this.boardType = boardType
    this.mode = mode
    this.aiDifficulty = aiDifficulty
    this.userManager = userManager || wx.__userManager || null
    this.leaderboardManager = leaderboardManager || wx.__leaderboardManager || null
  
    this.renderer = new Renderer(ctx, canvas)
    this.boardRenderer = new BoardRenderer(ctx)
    this.gameOverPanel = new GameOverPanel(ctx, canvas, this.width, this.height)
    this.animationManager = new AnimationManager()

    this.clientId = Math.random().toString(36).slice(2)

    this.onlineManager = onlineManager
    this.localPlayerId = onlineManager && typeof onlineManager.getLocalGamePlayerId === 'function'
    ? onlineManager.getLocalGamePlayerId()
    : 'p1'

    this.rematchRequested = false
    this.lastRoomRoundIndex = null
    this.frameSyncInitialized = false

    this.roomPaused = false
    this.roomPauseText = ''
    this.playerNames = { ...DEFAULT_PLAYER_NAMES }
  
    this.backButton = {
      x: 20,
      y: 20,
      width: 120,
      height: 44
    }
  
    this.ai = new SimpleAI({ difficulty: this.aiDifficulty })
    this.resultRecorded = false

    this.resetGame()
  }

  resetGame() {
    let board

    if (this.boardType === 'hex') {
      board = BoardFactory.createHexBoard(3) // 半径3
    } else {
      board = BoardFactory.createSquareBoard(this.rows, this.cols)
    }

    this.engine = new GameEngine({
      board,
      players: [
        { id: 'p1', name: this.getPlayerDisplayName('p1') },
        { id: 'p2', name: this.getPlayerDisplayName('p2') }
      ]
    })
  
    this.layout = this.createBoardLayout()
  
    this.animationManager = new AnimationManager()
    this.resultRecorded = false

    this.hitTest = new HitTest({
      board,
      originX: this.layout.originX,
      originY: this.layout.originY,
      cellSize: this.layout.cellSize,
      hitRange: Math.max(14, this.layout.cellSize * 0.3),
      type: this.boardType
    })

    if (this.mode === 'online' && !this.frameSyncInitialized) {
      this.initFrameSync()
      this.frameSyncInitialized = true
    }
  }

  initFrameSync() {
    if (!this.onlineManager) {
      console.warn('online mode requires onlineManager')
      return
    }
  
    this.localPlayerId = typeof this.onlineManager.getLocalGamePlayerId === 'function'
      ? this.onlineManager.getLocalGamePlayerId()
      : this.localPlayerId
  
    if (this.onlineManager.roomState) {
      this.lastRoomRoundIndex = this.onlineManager.roomState.roundIndex || 1
    }
  
    this.onlineManager.onReady(() => {
      console.log('frame sync started')
  
      this.localPlayerId = typeof this.onlineManager.getLocalGamePlayerId === 'function'
        ? this.onlineManager.getLocalGamePlayerId()
        : this.localPlayerId
    })
  
    this.onlineManager.onFrame(({ inputs }) => {
      for (const input of inputs) {
        this.applyFrameInput(input)
      }
    })
  
    if (typeof this.onlineManager.onRematchVote === 'function') {
      this.onlineManager.onRematchVote(payload => {
        console.log('rematch vote:', payload)
  
        if (
          payload &&
          payload.votes &&
          payload.votes.indexOf(this.onlineManager.playerId) >= 0
        ) {
          this.rematchRequested = true
        }
      })
    }
  
    if (typeof this.onlineManager.onRoomReset === 'function') {
      this.onlineManager.onRoomReset(payload => {
        console.log('room reset:', payload)
        this.applyOnlineRoomReset(payload)
      })
    }
  
    this.onlineManager.onRoomUpdate(roomState => {
      if (!roomState) return
    
      // 同步服务端暂停状态。
      // 服务端建议在 serializeRoom(room) 里带上：
      // paused: !!room.paused,
      // pauseReason: room.pauseReason || ''
      this.roomPaused = !!roomState.paused
      this.updatePlayerNamesFromRoom(roomState)
    
      if (this.roomPaused) {
        if (roomState.pauseReason === 'player_disconnected') {
          this.roomPauseText = '\u5bf9\u65b9\u6682\u65f6\u79bb\u7ebf\uff0c\u7b49\u5f85\u91cd\u8fde...'
        } else {
          this.roomPauseText = '\u623f\u95f4\u6682\u65f6\u6682\u505c\uff0c\u7b49\u5f85\u6062\u590d...'
        }
      } else {
        this.roomPauseText = ''
      }
    
      const nextRoundIndex = roomState.roundIndex || 1
    
      if (
        this.lastRoomRoundIndex !== null &&
        nextRoundIndex !== this.lastRoomRoundIndex &&
        roomState.phase === 'playing'
      ) {
        console.log('room round changed by ROOM_STATE:', {
          prev: this.lastRoomRoundIndex,
          next: nextRoundIndex
        })
    
        this.applyOnlineRoomReset(roomState)
      }
    
      this.lastRoomRoundIndex = nextRoundIndex
    })
  
    this.onlineManager.onError(err => {
      console.error('online error', err)
    
      if (err && err.code === 'REMATCH_NOT_ALLOWED') {
        this.rematchRequested = false
      }
    })
  }

  drawPauseTip() {
    const ctx = this.ctx
    const text = this.roomPauseText || '等待对方重连...'
  
    ctx.save()
  
    const w = this.width - 60
    const h = 52
    const x = 30
    const y = this.height / 2 - 26
  
    this._roundRect(ctx, x, y, w, h, 10)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fill()
  
    ctx.fillStyle = '#333'
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, this.width / 2, y + h / 2)
  
    ctx.restore()
  }

  applyActionWithAnimation(action) {
    const result = this.engine.handleAction(action)
  
    if (result && result.success) {
      this.animationManager.playEdge(action.edgeId, action.playerId)
  
      for (const cell of result.closedCells) {
        this.animationManager.playCell(cell.id, action.playerId)
      }

      this.recordInfernoLeaderboardResult()
    }
  
    return result
  }

  recordInfernoLeaderboardResult() {
    if (this.resultRecorded) return
    if (!this.leaderboardManager || typeof this.leaderboardManager.recordGameResult !== 'function') return
    if (this.mode !== 'ai') return
    if (this.aiDifficulty !== 'inferno') return
    if (this.boardType !== 'square' || this.rows !== 3 || this.cols !== 3) return

    const state = this.engine.getState()
    if (!state || state.status !== 'finished') return

    this.resultRecorded = true

    this.leaderboardManager.recordGameResult({
      playerId: this.userManager && typeof this.userManager.getPlayerId === 'function'
        ? this.userManager.getPlayerId()
        : '',
      nickname: this.getPlayerDisplayName('p1'),
      won: state.winnerId === 'p1'
    })
  }

  applyFrameInput(input) {
    if (!input || input.type !== 'CLICK_EDGE') return
  
    const action = new ClaimEdgeAction({
      playerId: input.playerId,
      edgeId: input.edgeId
    })
  
    this.applyActionWithAnimation(action)
  }

  applyOnlineRoomReset(payload) {
    console.log('applyOnlineRoomReset:', payload)
  
    this.rematchRequested = false
  
    if (payload && payload.roundIndex) {
      this.lastRoomRoundIndex = payload.roundIndex
    }
  
    this.resetGame()
  
    this.localPlayerId = this.onlineManager && typeof this.onlineManager.getLocalGamePlayerId === 'function'
      ? this.onlineManager.getLocalGamePlayerId()
      : this.localPlayerId
  }

  updatePlayerNamesFromRoom(roomState) {
    if (!roomState || !Array.isArray(roomState.players)) return

    for (const player of roomState.players) {
      if (!player) continue

      const localId = this.onlineManager && typeof this.onlineManager.toLocalGamePlayerId === 'function'
        ? this.onlineManager.toLocalGamePlayerId(player.playerId)
        : null

      if (localId && player.nickname) {
        this.playerNames[localId] = player.nickname
      }
    }
  }

  getPlayerDisplayName(playerId) {
    if (this.mode === 'online') {
      this.updatePlayerNamesFromRoom(this.onlineManager && this.onlineManager.roomState)
      return this.playerNames[playerId] || DEFAULT_PLAYER_NAMES[playerId] || playerId
    }

    if (playerId === 'p1' && this.userManager && typeof this.userManager.getNickname === 'function') {
      return this.userManager.getNickname()
    }

    if (this.mode === 'ai' && playerId === 'p2') {
      return 'AI'
    }

    return DEFAULT_PLAYER_NAMES[playerId] || playerId
  }

  createBoardLayout() {
    const paddingX = 40
    const topY = 110
    const bottomPad = 110
  
    const maxWidth = this.width - paddingX * 2
    const maxHeight = this.height - topY - bottomPad
  
    let cellSize
    let originX
    let originY
  
    if (this.boardType === 'hex') {
      const radius = 3
  
      const hexWidth = Math.sqrt(3) * (2 * radius - 1)
      const hexHeight = 1.5 * (2 * radius - 2) + 2
  
      cellSize = Math.floor(
        Math.min(
          maxWidth / hexWidth,
          maxHeight / hexHeight
        )
      )
  
      // 六边形棋盘：origin 是中心点
      originX = this.width / 2
      originY = topY + maxHeight / 2
    } else {
      cellSize = Math.floor(
        Math.min(
          maxWidth / this.cols,
          maxHeight / this.rows
        )
      )
  
      const boardWidth = this.cols * cellSize
      const boardHeight = this.rows * cellSize
  
      // 方格棋盘：origin 是左上角
      originX = (this.width - boardWidth) / 2
      originY = topY + (maxHeight - boardHeight) / 2
    }
  
    return {
      cellSize,
      originX,
      originY
    }
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

  onEnter() {
    this.inputManager.clearTouchStartHandlers()
  
    this.inputManager.onTouchStart((x, y) => {
      if (this.isBackButtonHit(x, y)) {
        this.returnToMenu()
        return
      }
  
      const state = this.engine.getState()
  
      if (state.status === 'finished') {
        if (this.gameOverPanel.isRestartButtonHit(x, y)) {
          if (this.mode === 'online') {
            this.requestOnlineRematch()
          } else {
            this.resetGame()
          }
          return
        }

        if (
          typeof this.gameOverPanel.isMenuButtonHit === 'function' &&
          this.gameOverPanel.isMenuButtonHit(x, y)
        ) {
          this.returnToMenu()
          return
        }

        return
      }
  
      const edge = this.hitTest.getEdgeByPoint(x, y)

      if (!edge) return
      if (edge.ownerId) return
      
      if (this.mode === 'online') {
        if (this.roomPaused) {
          console.log('room paused, waiting for opponent reconnect')
          return
        }
      
        this.localPlayerId = this.onlineManager && typeof this.onlineManager.getLocalGamePlayerId === 'function'
          ? this.onlineManager.getLocalGamePlayerId()
          : this.localPlayerId
      
        if (this.engine.getCurrentPlayerId() !== this.localPlayerId) {
          console.log('\u8fd8\u6ca1\u8f6e\u5230\u6211', {
            current: this.engine.getCurrentPlayerId(),
            local: this.localPlayerId
          })
          return
        }
      
        this.onlineManager.sendInput({
          type: 'CLICK_EDGE',
          edgeId: edge.id,
          playerId: this.localPlayerId,
          clientId: this.clientId
        })
      
        return
      }
      
      const action = new ClaimEdgeAction({
        playerId: this.engine.getCurrentPlayerId(),
        edgeId: edge.id
      })
      
      this.applyActionWithAnimation(action)
    })
  }

  onExit() {
    this.inputManager.clearTouchStartHandlers()
  }

  requestOnlineRematch() {
    if (!this.onlineManager) return
  
    const state = this.engine.getState()
  
    if (!state || state.status !== 'finished') {
      console.log('\u672c\u5730\u6e38\u620f\u5c1a\u672a\u7ed3\u675f\uff0c\u4e0d\u80fd\u8bf7\u6c42\u518d\u6765\u4e00\u5c40')
      return
    }
  
    if (this.rematchRequested) {
      console.log('\u5df2\u7ecf\u8bf7\u6c42\u518d\u6765\u4e00\u5c40\uff0c\u7b49\u5f85\u5bf9\u65b9\u786e\u8ba4')
      return
    }
  
    this.rematchRequested = true
    console.log('\u8bf7\u6c42\u5728\u7ebf\u518d\u6765\u4e00\u5c40')
  
    if (typeof this.onlineManager.requestRematch === 'function') {
      this.onlineManager.requestRematch()
    }
  }

  returnToMenu() {
    if (this.mode === 'online' && this.onlineManager) {
      this.onlineManager.leaveRoom()
    }
  
    this.sceneManager.setScene(new MenuScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height,
      userManager: this.userManager,
      leaderboardManager: this.leaderboardManager
    }))
  }

  update(deltaTime) {
    this.animationManager.update(deltaTime)
    const state = this.engine.getState()

    // 只在人机模式 + AI回合 执行
    if (this.mode === 'ai' && state.currentPlayerId === 'p2') {
      this.runAI()
    }
  }

  runAI() {
    if (this.aiThinking) return
  
    this.aiThinking = true
  
    setTimeout(() => {
      const actionEdge = this.ai.getAction({
        board: this.engine.board,
        playerId: 'p2'
      })
  
      if (!actionEdge) {
        this.aiThinking = false
        return
      }
  
      const action = new ClaimEdgeAction({
        playerId: 'p2',
        edgeId: actionEdge.id
      })
  
      this.applyActionWithAnimation(action)
  
      this.aiThinking = false
    }, 300)
  }

  render() {
    this.ctx.fillStyle = '#EFEFEF'
    this.ctx.fillRect(0, 0, this.width, this.height)
  
    this.boardRenderer.draw({
      board: this.engine.board,
      originX: this.layout.originX,
      originY: this.layout.originY,
      cellSize: this.layout.cellSize,
      animationManager: this.animationManager
    })
  
    const state = this.engine.getState()
    this.drawPlayerCard('p2', state, 'top')
    this.drawPlayerCard('p1', state, 'bottom')
  
    this.drawBackButton()
  
    if (state.status === 'finished') {
      this.gameOverPanel.draw(state, {
        localPlayerId: this.mode === 'online' ? this.localPlayerId : null,
        playerNames: {
          p1: this.getPlayerDisplayName('p1'),
          p2: this.getPlayerDisplayName('p2')
        },
        restartText: this.mode === 'online' && this.rematchRequested
          ? '\u7b49\u5f85\u5bf9\u65b9\u786e\u8ba4...'
          : '\u518d\u6765\u4e00\u5c40'
      })
    }
  
    if (this.mode === 'online' && this.roomPaused && state.status !== 'finished') {
      this.drawPauseTip()
    }
  }

  /**
   * Draw player info card
   * @param {'p1'|'p2'} playerId
   * @param {object} state
   * @param {'top'|'bottom'} position
   */
    drawPlayerCard(playerId, state, position) {
      const ctx = this.ctx
      const W = this.width
      const H = this.height
    
      const cardW = W - 40
      const cardH = 72
      const cardX = 20
      const cardY = position === 'top'
        ? 120
        : H - cardH - 120
    
      const color = PLAYER_COLORS[playerId]
      const score = state.scores[playerId] ?? 0
      const total = this.engine.board.cells.size
      const isMe = this.mode === 'online' && this.localPlayerId === playerId
      const name = this.getPlayerDisplayName(playerId)
    
      const isCurrent = state.currentPlayerId === playerId && state.status !== 'finished'
    
      ctx.save()
    
      // ── 卡片底色 ──────────────────────────────────────────
      this._roundRect(ctx, cardX, cardY, cardW, cardH, 5)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
    
      // ── 当前回合：左侧彩色竖条高亮 ────────────────────────
      if (isCurrent) {
        this._roundRectLeft(ctx, cardX, cardY, 6, cardH, 14)
        ctx.fillStyle = color
        ctx.fill()
      }
    
      // ── 玩家色块圆点 ──────────────────────────────────────
      const dotR = 16
      const dotX = cardX + 30
      const dotY = cardY + cardH / 2
    
      ctx.beginPath()
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    
      // ── 玩家名称 ──────────────────────────────────────────
      const nameX = cardX + 58
      const nameY = cardY + cardH / 2 - 10
    
      ctx.fillStyle = '#222222'
      ctx.font = 'bold 18px Arial'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(name, nameX, nameY)
    
      // ── “我”识别小标签：根据名字宽度动态定位 ───────────────
      if (isMe) {
        const nameWidth = ctx.measureText(name).width
    
        const tagGap = 8
        const tagW = 28
        const tagH = 18
    
        // 右侧分数区域大概从这里开始，避免标签贴到分数
        const scoreSafeX = cardX + cardW - 90
    
        let tagX = nameX + nameWidth + tagGap
        // 如果屏幕很窄，防止标签超到分数区域
        if (tagX + tagW > scoreSafeX) {
          tagX = scoreSafeX - tagW
        }
    
        const tagY = nameY - tagH / 2
    
        this._roundRect(ctx, tagX, tagY, tagW, tagH, 9)
        ctx.fillStyle = color
        ctx.fill()
    
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('\u6211', tagX + tagW / 2, tagY + tagH / 2 + 1)
      }
    
      // ── “当前回合”标签 ────────────────────────────────────
      if (isCurrent) {
        ctx.fillStyle = color
        ctx.font = '13px Arial'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText('\u5f53\u524d\u56de\u5408', nameX, cardY + cardH / 2 + 12)
      }
    
      // ── 右侧分数 ──────────────────────────────────────────
      ctx.textAlign = 'right'
      ctx.font = 'bold 28px Arial'
      ctx.fillStyle = color
      ctx.fillText(`${score}`, cardX + cardW - 56, cardY + cardH / 2)
    
      ctx.font = '13px Arial'
      ctx.fillStyle = '#999999'
      ctx.fillText(`/ ${total}`, cardX + cardW - 18, cardY + cardH / 2)
    
      // ── 进度条 ────────────────────────────────────────────
      const barX = cardX + 58
      const barY = cardY + cardH - 12
      const barW = cardW - 58 - 20
      const barH = 4
    
      this._roundRect(ctx, barX, barY, barW, barH, 2)
      ctx.fillStyle = '#E0E0E0'
      ctx.fill()
    
      const ratio = total > 0 ? score / total : 0
    
      if (ratio > 0) {
        this._roundRect(ctx, barX, barY, barW * ratio, barH, 2)
        ctx.fillStyle = color
        ctx.fill()
      }
    
      ctx.restore()
    }

    /**
 * 四角均为圆角的矩形路径（兼容微信小游戏）
 */
  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y,     x + w, y + r,     r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x,     y + h, x,     y + h - r, r)
    ctx.lineTo(x,     y + r)
    ctx.arcTo(x,     y,     x + r, y,         r)
    ctx.closePath()
  }

/**
 * 仅左侧两角为圆角（用于左侧竖条），右侧为直角
 */
  _roundRectLeft(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w, y)           // 右上直角
    ctx.lineTo(x + w, y + h)       // 右下直角
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)  // 左下圆角
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)          // 左上圆角
    ctx.closePath()
  }

  drawBackButton() {
    const ctx = this.ctx
    const b = this.backButton

    ctx.save()

    // ── 白色圆角卡片底色 ────────────────────────────────────
    this._roundRect(ctx, b.x, b.y, b.width, b.height, 10)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()

    // ── 左侧红色竖条（与玩家卡片语言一致）──────────────────
    this._roundRectLeft(ctx, b.x, b.y, 5, b.height, 10)
  ctx.fillStyle = '#4A90E2'
  ctx.fill()

  // ── 箭头 + 文字 ─────────────────────────────────────────
  ctx.fillStyle = '#444444'
  ctx.font = 'bold 15px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('← 返回', b.x + b.width / 2 + 3, b.y + b.height / 2)

  ctx.restore()
}
}
