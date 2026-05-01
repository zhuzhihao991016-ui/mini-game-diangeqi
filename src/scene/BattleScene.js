import BaseScene from './BaseScene'
import MenuScene from './MenuScene'
import GameEngine from '../core/engine/GameEngine'
import BoardFactory from '../core/board/BoardFactory'
import { setupFunModeBoard } from '../core/mode/FunModeSetup'
import Renderer from '../render/Renderer'
import BoardRenderer from '../render/BoardRenderer'
import GameOverPanel from '../render/GameOverPanel'
import HitTest from '../input/HitTest'
import ClaimEdgeAction from '../core/action/ClaimEdgeAction'
import AnimationManager from '../animation/AnimationManager'
import SimpleAI from '../ai/SimpleAI'
import { getSceneSafeLayout } from '../utils/SafeArea'
import { createChallengeLevels } from '../core/level/ChallengeLevels'
import { unlockChallengeLevel } from '../state/ChallengeProgress'

const PLAYER_COLORS = {
  p1: '#4A90E2',
  p2: '#E24A4A'
}

const DEFAULT_PLAYER_NAMES = {
  p1: '\u73a9\u5bb6\u4e00',
  p2: '\u73a9\u5bb6\u4e8c'
}

export default class BattleScene extends BaseScene {
  constructor({ canvas, ctx, inputManager, sceneManager, width, height, rows = 3, cols = 3,  boardType = 'square', mode = 'local_2p', aiDifficulty = 'easy', isFunMode = false, funModeSeed = '', onlineManager = null, userManager = null, leaderboardManager = null, challengeMode = false, challengeLevelIndex = 1, challengeLevels = null }) {
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
    this.isFunMode = !!isFunMode
    this.funModeSeed = funModeSeed || ''
    this.challengeMode = !!challengeMode
    this.challengeLevelIndex = challengeLevelIndex || 1
    this.challengeLevels = challengeLevels || null
    this.currentChallengeLevel = null
    this.userManager = userManager || wx.__userManager || null
    this.leaderboardManager = leaderboardManager || wx.__leaderboardManager || null
  
    this.renderer = new Renderer(ctx, canvas)
    this.boardRenderer = new BoardRenderer(ctx)
    this.gameOverPanel = new GameOverPanel(ctx, canvas, this.width, this.height)
    this.animationManager = new AnimationManager()
    this.safeLayout = getSceneSafeLayout(this.width, this.height)

    this.clientId = Math.random().toString(36).slice(2)

    this.onlineManager = onlineManager
    this.localPlayerId = onlineManager && typeof onlineManager.getLocalGamePlayerId === 'function'
    ? onlineManager.getLocalGamePlayerId()
    : 'p1'

    this.rematchRequested = false
    this.undoRequested = false
    this.lastRoomRoundIndex = null
    this.frameSyncInitialized = false

    this.roomPaused = false
    this.roomPauseText = ''
    this.playerNames = { ...DEFAULT_PLAYER_NAMES }
  
    this.backButton = {
      x: 20,
      y: this.safeLayout.top,
      width: 120,
      height: 44
    }

    this.undoButton = {
      x: this.width - 204,
      y: 20,
      width: 88,
      height: 44
    }

    this.hintButton = {
      x: this.width - 108,
      y: 20,
      width: 88,
      height: 44
    }
  
    this.ai = new SimpleAI({ difficulty: this.aiDifficulty })
    this.aiThinking = false
    this.aiThinkTimer = null
    this.undoStack = []
    this.hintEdgeId = null
    this.turnCoverVisible = false
    this.turnCoverPlayerId = null
    this.resultRecorded = false
    this.lastAppliedRoomStateKey = ''

    this.resetGame()
  }

  resetGame() {
    let board

    if (this.challengeMode) {
      this.ensureChallengeLevels()
      this.currentChallengeLevel = this.challengeLevels[this.challengeLevelIndex - 1] || this.challengeLevels[0]
      this.aiDifficulty = this.currentChallengeLevel.aiDifficulty
      this.ai = new SimpleAI({ difficulty: this.aiDifficulty })
      this.boardType = 'mixed-shape'
      board = BoardFactory.createMixedShapeBoard({
        layout: this.currentChallengeLevel.layout,
        cellSize: 1,
        padding: 0
      })
      board.challengeMeta = {
        level: this.currentChallengeLevel.index,
        score: this.currentChallengeLevel.score,
        aiDifficulty: this.currentChallengeLevel.aiDifficulty
      }
    } else if (this.boardType === 'hex') {
      board = BoardFactory.createHexBoard(3) // 半径3
    } else {
      board = BoardFactory.createSquareBoard(this.rows, this.cols)
    }

    if (this.isFunMode) {
      setupFunModeBoard(board, { seed: this.getFunModeSeed() })
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
    this.undoStack = []
    this.hintEdgeId = null
    this.turnCoverVisible = false
    this.turnCoverPlayerId = null
    this.aiThinking = false
    if (this.aiThinkTimer) {
      clearTimeout(this.aiThinkTimer)
      this.aiThinkTimer = null
    }
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

    if (typeof this.onlineManager.onUndoVote === 'function') {
      this.onlineManager.onUndoVote(payload => {
        console.log('undo vote:', payload)

        if (
          payload &&
          payload.votes &&
          payload.votes.indexOf(this.onlineManager.playerId) >= 0
        ) {
          this.undoRequested = true
        }
      })
    }

    if (typeof this.onlineManager.onRoomUndo === 'function') {
      this.onlineManager.onRoomUndo(payload => {
        console.log('room undo:', payload)
        this.undoRequested = false

        if (payload && payload.roomState) {
          this.applyRoomStateToLocalGame(payload.roomState)
        }
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
      this.updateOnlineUndoState(roomState)
      this.applyAuthoritativeRoomState(roomState)
    
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
      if (this.isAiAssistEnabled()) {
        this.hintEdgeId = null
      }

      this.animationManager.playEdge(action.edgeId, action.playerId)
  
      for (const cell of result.closedCells) {
        this.animationManager.playCell(cell.id, action.playerId)
      }

      this.recordLeaderboardResult()
    }
  
    return result
  }

  recordLeaderboardResult() {
    if (this.resultRecorded) return

    const state = this.engine.getState()
    if (!state || state.status !== 'finished') return

    if (this.challengeMode) {
      this.recordChallengeLeaderboardResult(state)
      return
    }

    if (this.mode !== 'ai') return
    if (!this.leaderboardManager || typeof this.leaderboardManager.recordGameResult !== 'function') return
    if (this.aiDifficulty !== 'inferno') return
    if (this.boardType !== 'square') return
    if (!((this.rows === 3 && this.cols === 3) || (this.rows === 6 && this.cols === 6))) return

    this.resultRecorded = true

    this.leaderboardManager.recordGameResult({
      playerId: this.userManager && typeof this.userManager.getPlayerId === 'function'
        ? this.userManager.getPlayerId()
        : '',
      nickname: this.getPlayerDisplayName('p1'),
      won: state.winnerId === 'p1',
      boardKey: this.rows === 6 ? 'inferno-6x6' : 'inferno-3x3'
    })
  }

  recordChallengeLeaderboardResult(state) {
    if (state.winnerId !== 'p1') return

    this.resultRecorded = true
    unlockChallengeLevel(this.challengeLevelIndex + 1, this.challengeLevels ? this.challengeLevels.length : 20)
    if (!this.leaderboardManager || typeof this.leaderboardManager.recordGameResult !== 'function') return

    this.leaderboardManager.recordGameResult({
      playerId: this.userManager && typeof this.userManager.getPlayerId === 'function'
        ? this.userManager.getPlayerId()
        : '',
      nickname: this.getPlayerDisplayName('p1'),
      won: true,
      boardKey: 'challenge',
      challengeLevel: this.challengeLevelIndex,
      challengeScore: this.currentChallengeLevel ? this.currentChallengeLevel.score : 0
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

  getRoomStateKey(roomState) {
    if (!roomState) return ''

    const edgeKey = (roomState.edges || [])
      .map(item => {
        const ownerId = this.onlineManager && typeof this.onlineManager.toLocalGamePlayerId === 'function'
          ? this.onlineManager.toLocalGamePlayerId(item.ownerPlayerId)
          : item.ownerPlayerId

        return `${item.edgeId}:${ownerId}`
      })
      .sort()
      .join(',')
    const boxKey = (roomState.boxes || [])
      .map(item => {
        const ownerId = this.onlineManager && typeof this.onlineManager.toLocalGamePlayerId === 'function'
          ? this.onlineManager.toLocalGamePlayerId(item.ownerPlayerId)
          : item.ownerPlayerId

        return `${item.boxId}:${ownerId}`
      })
      .sort()
      .join(',')
    const currentPlayerId = this.onlineManager && typeof this.onlineManager.toLocalGamePlayerId === 'function'
      ? this.onlineManager.toLocalGamePlayerId(roomState.currentTurnPlayerId)
      : roomState.currentTurnPlayerId

    return [
      roomState.phase || '',
      currentPlayerId || '',
      edgeKey,
      boxKey
    ].join('|')
  }

  getLocalStateKey() {
    const edgeKey = Array.from(this.engine.board.edges.values())
      .filter(edge => edge.ownerId)
      .map(edge => `${edge.id}:${edge.ownerId}`)
      .sort()
      .join(',')
    const boxKey = Array.from(this.engine.board.cells.values())
      .filter(cell => cell.ownerId)
      .map(cell => `${cell.id}:${cell.ownerId}`)
      .sort()
      .join(',')

    return [
      this.engine.status,
      this.engine.getCurrentPlayerId(),
      edgeKey,
      boxKey
    ].join('|')
  }

  applyAuthoritativeRoomState(roomState) {
    if (this.mode !== 'online') return
    if (!roomState || !Array.isArray(roomState.edges)) return

    const key = this.getRoomStateKey(roomState)
    if (!key || key === this.lastAppliedRoomStateKey) return
    if (key === this.getLocalStateKey()) {
      this.lastAppliedRoomStateKey = key
      return
    }

    this.lastAppliedRoomStateKey = key
    this.applyRoomStateToLocalGame(roomState)
  }

  applyRoomStateToLocalGame(roomState) {
    if (!roomState) return
    this.updateFunModeSeedFromRoom(roomState)

    const edgeOwners = {}
    const cellOwners = {}
    const playerScores = { p1: 0, p2: 0 }

    for (const item of roomState.edges || []) {
      const localOwnerId = this.onlineManager && typeof this.onlineManager.toLocalGamePlayerId === 'function'
        ? this.onlineManager.toLocalGamePlayerId(item.ownerPlayerId)
        : item.ownerPlayerId

      edgeOwners[item.edgeId] = localOwnerId
    }

    for (const item of roomState.boxes || []) {
      const localOwnerId = this.onlineManager && typeof this.onlineManager.toLocalGamePlayerId === 'function'
        ? this.onlineManager.toLocalGamePlayerId(item.ownerPlayerId)
        : item.ownerPlayerId

      cellOwners[item.boxId] = localOwnerId
    }

    for (const player of roomState.players || []) {
      const localId = this.onlineManager && typeof this.onlineManager.toLocalGamePlayerId === 'function'
        ? this.onlineManager.toLocalGamePlayerId(player.playerId)
        : player.playerId

      playerScores[localId] = roomState.scores && roomState.scores[player.playerId]
        ? roomState.scores[player.playerId]
        : 0
    }

    const currentLocalPlayerId = this.onlineManager && typeof this.onlineManager.toLocalGamePlayerId === 'function'
      ? this.onlineManager.toLocalGamePlayerId(roomState.currentTurnPlayerId)
      : roomState.currentTurnPlayerId
    const currentIndex = this.engine.players.findIndex(player => player.id === currentLocalPlayerId)

    this.restoreGameSnapshot({
      edgeOwners,
      cellOwners,
      playerScores,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
      status: roomState.phase === 'finished' ? 'finished' : 'playing',
      winnerId: this.getLocalWinnerIdFromRoomState(roomState),
      resultRecorded: this.resultRecorded
    })

    this.lastAppliedRoomStateKey = this.getRoomStateKey(roomState)
  }

  getLocalWinnerIdFromRoomState(roomState) {
    if (!roomState || roomState.phase !== 'finished' || !roomState.scores) return null

    let winnerPlayerId = null
    let bestScore = -1
    let tie = false

    for (const player of roomState.players || []) {
      const score = roomState.scores[player.playerId] || 0

      if (score > bestScore) {
        winnerPlayerId = player.playerId
        bestScore = score
        tie = false
      } else if (score === bestScore) {
        tie = true
      }
    }

    if (tie || !winnerPlayerId) return null

    return this.onlineManager && typeof this.onlineManager.toLocalGamePlayerId === 'function'
      ? this.onlineManager.toLocalGamePlayerId(winnerPlayerId)
      : winnerPlayerId
  }

  applyOnlineRoomReset(payload) {
    console.log('applyOnlineRoomReset:', payload)
  
    this.rematchRequested = false
  
    if (payload && payload.roundIndex) {
      this.lastRoomRoundIndex = payload.roundIndex
    }
  
    this.updateFunModeSeedFromRoom(payload)
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

  ensureChallengeLevels() {
    if (this.challengeLevels && this.challengeLevels.length > 0) return

    const topY = this.safeLayout.insets.top + 210
    const bottomPad = this.safeLayout.insets.bottom + 190
    this.challengeLevels = createChallengeLevels({
      maxWidth: this.width - 80,
      maxHeight: this.height - topY - bottomPad,
      minCellSize: 7
    })
  }

  createBoardLayout() {
    const paddingX = 40
    const topY = this.safeLayout.insets.top + 210
    const bottomPad = this.safeLayout.insets.bottom + 190
  
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
    } else if (this.boardType === 'mixed-shape') {
      const meta = this.engine && this.engine.board && this.engine.board.layoutMeta
        ? this.engine.board.layoutMeta
        : { widthUnits: this.cols, heightUnits: this.rows }

      cellSize = Math.floor(
        Math.min(
          maxWidth / Math.max(1, meta.widthUnits),
          maxHeight / Math.max(1, meta.heightUnits)
        )
      )

      const boardWidth = meta.widthUnits * cellSize
      const boardHeight = meta.heightUnits * cellSize

      originX = (this.width - boardWidth) / 2
      originY = topY + (maxHeight - boardHeight) / 2
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

  updateFunModeSeedFromRoom(roomState) {
    if (!this.isFunMode || !roomState) return

    const roomId = roomState.roomId || (this.onlineManager && this.onlineManager.roomId) || ''
    const roundIndex = roomState.roundIndex || 1

    if (roomId) {
      this.funModeSeed = `${roomId}:${roundIndex}`
    }
  }

  getFunModeSeed() {
    if (this.funModeSeed) return this.funModeSeed

    if (this.mode === 'online' && this.onlineManager) {
      const roomState = this.onlineManager.roomState || {}
      const roomId = roomState.roomId || this.onlineManager.roomId || ''
      const roundIndex = roomState.roundIndex || 1

      if (roomId) return `${roomId}:${roundIndex}`
    }

    return ''
  }

  updateAssistButtonLayout() {
    const buttonGap = 12
    const y = this.height - this.safeLayout.bottom - this.undoButton.height

    if (this.isAiAssistEnabled()) {
      const totalWidth = this.undoButton.width + this.hintButton.width + buttonGap
      const startX = (this.width - totalWidth) / 2

      this.undoButton.x = startX
      this.hintButton.x = startX + this.undoButton.width + buttonGap
    } else {
      this.undoButton.x = (this.width - this.undoButton.width) / 2
      this.hintButton.x = this.undoButton.x
    }

    this.undoButton.y = y
    this.hintButton.y = y
  }


  isBackButtonHit(x, y) {
    return this.isButtonHit(this.backButton, x, y)
  }

  isButtonHit(button, x, y) {
    const b = button
  
    return (
      x >= b.x &&
      x <= b.x + b.width &&
      y >= b.y &&
      y <= b.y + b.height
    )
  }

  onEnter() {
    this.updateAssistButtonLayout()
    this.inputManager.clearTouchStartHandlers()
  
    this.inputManager.onTouchStart((x, y) => {
      if (this.turnCoverVisible) {
        this.hideTurnCover()
        return
      }

      if (this.isBackButtonHit(x, y)) {
        this.returnToMenu()
        return
      }

      if (this.canShowUndoButton()) {
        if (this.isButtonHit(this.getUndoButton(), x, y)) {
          if (this.mode === 'online') {
            this.requestOnlineUndo()
          } else {
            this.undoPlayerMove()
          }
          return
        }
      }

      if (this.isAiAssistEnabled()) {
        if (this.isButtonHit(this.hintButton, x, y)) {
          this.showHint()
          return
        }
      }
  
      const state = this.engine.getState()
  
      if (state.status === 'finished') {
        if (this.gameOverPanel.isRestartButtonHit(x, y)) {
          if (this.mode === 'online') {
            this.requestOnlineRematch()
          } else if (this.challengeMode) {
            this.goToNextChallengeLevel()
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
      if (edge.isClaimed()) return
      
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

      const snapshot = this.shouldRecordUndoForAction(action)
        ? this.createGameSnapshot()
        : null
      
      const result = this.applyActionWithAnimation(action)

      if (snapshot && result && result.success) {
        this.undoStack.push(snapshot)
      }

      this.showLocalTurnCoverAfterAction(result)
    })
  }

  onExit() {
    if (this.aiThinkTimer) {
      clearTimeout(this.aiThinkTimer)
      this.aiThinkTimer = null
    }
    this.aiThinking = false
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

  goToNextChallengeLevel() {
    if (!this.challengeMode) return

    const state = this.engine.getState()
    if (!state || state.winnerId !== 'p1') {
      this.resetGame()
      return
    }

    if (this.challengeLevelIndex < this.challengeLevels.length) {
      this.challengeLevelIndex += 1
    }

    this.resetGame()
  }

  requestOnlineUndo() {
    if (!this.onlineManager || !this.canRequestOnlineUndo()) return

    this.undoRequested = true
    console.log('请求在线悔棋')

    if (typeof this.onlineManager.requestUndo === 'function') {
      this.onlineManager.requestUndo()
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
  
    this.aiThinkTimer = setTimeout(() => {
      this.aiThinkTimer = null
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

  isAiAssistEnabled() {
    return this.mode === 'ai' && this.aiDifficulty !== 'inferno'
  }

  isLocalUndoEnabled() {
    return this.mode === 'local_2p'
  }

  isOnlineUndoEnabled() {
    return this.mode === 'online'
  }

  canShowUndoButton() {
    return this.isAiAssistEnabled() || this.isLocalUndoEnabled() || this.isOnlineUndoEnabled()
  }

  getUndoButton() {
    return this.undoButton
  }

  canUseAiAssist() {
    const state = this.engine.getState()

    return (
      this.isAiAssistEnabled() &&
      !this.challengeMode &&
      !this.aiThinking &&
      state.status === 'playing' &&
      state.currentPlayerId === 'p1'
    )
  }

  canUndoPlayerMove() {
    const state = this.engine.getState()

    return (
      this.canShowUndoButton() &&
      !this.aiThinking &&
      !this.turnCoverVisible &&
      this.undoStack.length > 0 &&
      (
        this.isLocalUndoEnabled() ||
        state.status === 'finished' ||
        state.currentPlayerId === 'p1'
      )
    )
  }

  canRequestOnlineUndo() {
    const state = this.engine.getState()
    const roomState = this.onlineManager && this.onlineManager.roomState

    return (
      this.isOnlineUndoEnabled() &&
      !this.roomPaused &&
      !this.undoRequested &&
      state.status === 'playing' &&
      roomState &&
      roomState.phase === 'playing' &&
      roomState.canUndo === true
    )
  }

  hasPendingOnlineUndoFromOpponent() {
    if (!this.isOnlineUndoEnabled()) return false

    const roomState = this.onlineManager && this.onlineManager.roomState
    const votes = roomState && roomState.undoVotes ? roomState.undoVotes : []

    return votes.length > 0 && votes.indexOf(this.onlineManager.playerId) < 0
  }

  updateOnlineUndoState(roomState) {
    if (!this.isOnlineUndoEnabled() || !roomState) return

    const votes = roomState.undoVotes || []
    this.undoRequested = votes.indexOf(this.onlineManager.playerId) >= 0
  }

  shouldRecordUndoForAction(action) {
    if (this.isLocalUndoEnabled()) {
      return !!action && this.engine.getState().status === 'playing'
    }

    return (
      this.isAiAssistEnabled() &&
      action &&
      action.playerId === 'p1' &&
      this.engine.getCurrentPlayerId() === 'p1'
    )
  }

  createGameSnapshot() {
    const edgeOwners = {}
    const cellOwners = {}
    const playerScores = {}

    for (const edge of this.engine.board.edges.values()) {
      edgeOwners[edge.id] = edge.ownerId
    }

    for (const cell of this.engine.board.cells.values()) {
      cellOwners[cell.id] = {
        ownerId: cell.ownerId,
        doubleScoreActivated: !!cell.doubleScoreActivated
      }
    }

    for (const player of this.engine.players) {
      playerScores[player.id] = player.score
    }

    return {
      edgeOwners,
      cellOwners,
      playerScores,
      currentIndex: this.engine.turnManager.currentIndex,
      status: this.engine.status,
      winnerId: this.engine.winnerId,
      resultRecorded: this.resultRecorded
    }
  }

  restoreGameSnapshot(snapshot) {
    if (!snapshot) return

    for (const edge of this.engine.board.edges.values()) {
      edge.ownerId = snapshot.edgeOwners[edge.id] || null
    }

    for (const cell of this.engine.board.cells.values()) {
      const cellSnapshot = snapshot.cellOwners[cell.id]

      if (cellSnapshot && typeof cellSnapshot === 'object') {
        cell.ownerId = cellSnapshot.ownerId || null
        cell.doubleScoreActivated = !!cellSnapshot.doubleScoreActivated
      } else {
        cell.ownerId = cellSnapshot || null
        cell.doubleScoreActivated = false
      }
    }

    for (const player of this.engine.players) {
      player.score = snapshot.playerScores[player.id] || 0
    }

    this.engine.turnManager.currentIndex = snapshot.currentIndex || 0
    this.engine.status = snapshot.status || 'playing'
    this.engine.winnerId = snapshot.winnerId || null
    this.resultRecorded = !!snapshot.resultRecorded
    this.animationManager = new AnimationManager()
    this.hintEdgeId = null
  }

  undoPlayerMove() {
    if (!this.canUndoPlayerMove()) return

    const snapshot = this.undoStack.pop()
    if (!snapshot) return

    this.restoreGameSnapshot(snapshot)
  }

  showLocalTurnCoverAfterAction(result) {
    if (!this.isLocalUndoEnabled()) return
    if (!result || !result.success || result.extraTurn) return

    const state = this.engine.getState()
    if (!state || state.status !== 'playing') return

    this.turnCoverVisible = true
    this.turnCoverPlayerId = state.currentPlayerId
  }

  hideTurnCover() {
    this.turnCoverVisible = false
    this.turnCoverPlayerId = null
  }

  showHint() {
    if (!this.canUseAiAssist()) return

    const edge = this.ai.getAction({
      board: this.engine.board,
      playerId: 'p1'
    })

    this.hintEdgeId = edge && !edge.ownerId ? edge.id : null
  }

  render() {
    this.ctx.fillStyle = '#EFEFEF'
    this.ctx.fillRect(0, 0, this.width, this.height)
  
    this.boardRenderer.draw({
      board: this.engine.board,
      originX: this.layout.originX,
      originY: this.layout.originY,
      cellSize: this.layout.cellSize,
      animationManager: this.animationManager,
      highlightedEdgeId: this.hintEdgeId
    })

    if (this.challengeMode) {
      this.drawChallengeHud()
    }
  
    const state = this.engine.getState()
    this.drawPlayerCard('p2', state, 'top')
    this.drawPlayerCard('p1', state, 'bottom')
  
    this.drawBackButton()
    this.drawAssistButtons()
  
    if (state.status === 'finished') {
      this.gameOverPanel.draw(state, {
        localPlayerId: this.mode === 'online' ? this.localPlayerId : null,
        playerNames: {
          p1: this.getPlayerDisplayName('p1'),
          p2: this.getPlayerDisplayName('p2')
        },
        restartText: this.getRestartText(state)
      })
    }
  
    if (this.mode === 'online' && this.roomPaused && state.status !== 'finished') {
      this.drawPauseTip()
    }

    if (this.turnCoverVisible) {
      this.drawTurnCover()
    }
  }

  getRestartText(state) {
    if (this.mode === 'online' && this.rematchRequested) {
      return '\u7b49\u5f85\u5bf9\u65b9\u786e\u8ba4...'
    }

    if (this.challengeMode) {
      if (state.winnerId === 'p1' && this.challengeLevelIndex < this.challengeLevels.length) {
        return '\u4e0b\u4e00\u5173'
      }

      return '\u91cd\u8bd5\u672c\u5173'
    }

    return '\u518d\u6765\u4e00\u5c40'
  }

  drawChallengeHud() {
    const ctx = this.ctx
    const meta = this.currentChallengeLevel
    if (!meta) return

    const text = `\u95ef\u5173 ${meta.index}/20  \u8bc4\u5206 ${meta.score}  ${this.getAiDifficultyLabel(meta.aiDifficulty)}`
    const x = this.width / 2
    const y = this.safeLayout.insets.top + 92
    const w = Math.min(this.width - 170, 260)
    const h = 34

    ctx.save()
    this._roundRect(ctx, x - w / 2, y - h / 2, w, h, 8)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.fill()
    ctx.fillStyle = '#444444'
    ctx.font = 'bold 13px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y + 1)
    ctx.restore()
  }

  getAiDifficultyLabel(difficulty) {
    if (difficulty === 'inferno') return '\u70bc\u72f1 AI'
    if (difficulty === 'hard') return '\u56f0\u96be AI'
    return '\u666e\u901a AI'
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
        ? this.safeLayout.insets.top + 120
        : H - this.safeLayout.insets.bottom - cardH - 88
    
      const color = PLAYER_COLORS[playerId]
      const score = state.scores[playerId] ?? 0
      const total = this.engine.getMaxScore()
      const isMe = this.mode === 'online' && this.localPlayerId === playerId
      const name = this.getPlayerDisplayName(playerId)
    
      const isCurrent = state.currentPlayerId === playerId && state.status !== 'finished'
    
      ctx.save()
    
      // ── 卡片底色 ──────────────────────────────────────────
      this._roundRect(ctx, cardX, cardY, cardW, cardH, 5)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
    
      // Highlight current turn.
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
    
      // Keep the local player tag beside the name.
      if (isMe) {
        const nameWidth = ctx.measureText(name).width
    
        const tagGap = 8
        const tagW = 28
        const tagH = 18
    
        // 右侧分数区域大概从这里开始，避免标签贴到分数
        const scoreSafeX = cardX + cardW - 90
    
        let tagX = nameX + nameWidth + tagGap
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
    
      // Current turn label.
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
    
      // Score progress bar.
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
  ctx.fillText('\u2190 \u8fd4\u56de', b.x + b.width / 2 + 3, b.y + b.height / 2)

  ctx.restore()
}

  drawAssistButtons() {
    if (!this.canShowUndoButton()) return
    this.updateAssistButtonLayout()

    const undoEnabled = this.isOnlineUndoEnabled()
      ? this.canRequestOnlineUndo()
      : this.canUndoPlayerMove()
    const undoText = this.isOnlineUndoEnabled() && this.undoRequested
      ? '\u7b49\u5f85\u540c\u610f'
      : this.hasPendingOnlineUndoFromOpponent()
        ? '\u540c\u610f\u6094\u68cb'
        : '\u6094\u68cb'

    this.drawAssistButton(this.getUndoButton(), undoText, undoEnabled)

    if (this.isAiAssistEnabled()) {
      this.drawAssistButton(this.hintButton, '\u63d0\u793a', this.canUseAiAssist())
    }
  }

  drawAssistButton(button, text, enabled) {
    const ctx = this.ctx

    ctx.save()

    this._roundRect(ctx, button.x, button.y, button.width, button.height, 10)
    ctx.fillStyle = enabled ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)'
    ctx.fill()

    this._roundRectLeft(ctx, button.x, button.y, 5, button.height, 10)
    ctx.fillStyle = enabled ? '#F5A623' : '#BDBDBD'
    ctx.fill()

    ctx.fillStyle = enabled ? '#444444' : '#999999'
    ctx.font = 'bold 15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, button.x + button.width / 2 + 2, button.y + button.height / 2)

    ctx.restore()
  }

  drawTurnCover() {
    const ctx = this.ctx
    const playerId = this.turnCoverPlayerId || this.engine.getCurrentPlayerId()
    const playerName = this.getPlayerDisplayName(playerId)

    ctx.save()

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.font = 'bold 28px Arial'
    ctx.fillText(`\u5207\u6362\u5230${playerName}`, this.width / 2, this.height / 2 - 24)

    ctx.font = '18px Arial'
    ctx.fillText('\u70b9\u51fb\u4efb\u610f\u5904\u7ee7\u7eed', this.width / 2, this.height / 2 + 24)
    ctx.restore()
  }
}
