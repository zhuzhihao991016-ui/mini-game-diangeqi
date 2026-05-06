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
import { applyChallengeLevelToBoard, createChallengeLevels } from '../core/level/ChallengeLevels'
import { unlockChallengeLevel } from '../state/ChallengeProgress'
import UITheme from '../ui/theme'
import { getActiveAppearanceTheme } from '../ui/AppearanceThemes'
import { drawImageAsset, getImageAsset, preloadImageAssets } from '../assets/ImageAssets'
import SoundEffects from '../assets/SoundEffects'
import { getGameSettings } from '../state/SettingsState'

const DEFAULT_PLAYER_NAMES = {
  p1: '玩家一',
  p2: '玩家二'
}

const CHALLENGE_TUTORIALS = {
  hole: {
    title: '新机制：镂空格',
    body: '黄底红虚线的区域是镂空格，这里不能得分。',
    accent: UITheme.colors.danger
  },
  obstacleCell: {
    title: '新机制：障碍格',
    body: '障碍格不能被占领，相关边会被封锁。规划路线时要把它当作不可用区域。',
    accent: UITheme.colors.obstacle
  },
  obstacleEdge: {
    title: '新机制：障碍边',
    body: '障碍边无法点击占领，它会改变格子的封闭节奏。找到可用边再落子。',
    accent: UITheme.colors.obstacle
  },
  doubleCell: {
    title: '新机制：双倍得分格',
    body: '带 X2 的格子在连续收格时可以提供更高分值。尽量把它留到可以追加行动的时机。',
    accent: UITheme.colors.warning
  },
  chainDoubleCell: {
    title: '进阶机制：连锁双倍得分',
    body: 'X2 不是单独收下就翻倍，必须一次落子同时闭合多个格子才会激活。制造连锁收格时，优先把 X2 放进同一次收格里。',
    accent: UITheme.colors.warning
  },
  bombCell: {
    title: '新机制：炸弹格',
    body: '带 B 的炸弹格被收下后会清除周边格的占领。落子前先判断它会不会连带改变局面。',
    accent: UITheme.colors.danger
  },
  freezeCell: {
    title: '新机制：冰冻格',
    body: '带 ICE 的冰冻格初始会像障碍一样被封住，周边格被闭合后才会解冻变成可争夺格。',
    accent: UITheme.colors.primary
  },
  quantumCell: {
    title: '新机制：量子格',
    body: '带 Q 的量子格会成对联动。收下其中一个时，信息会复制给它的配对格。',
    accent: UITheme.colors.purple
  }
}

const CHALLENGE_TUTORIAL_ORDER = [
  'hole',
  'obstacleCell',
  'obstacleEdge',
  'doubleCell',
  'chainDoubleCell',
  'bombCell',
  'freezeCell',
  'quantumCell'
]

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
    preloadImageAssets()

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
      x: this.challengeMode ? 14 : this.width / 2 - 21,
      y: this.safeLayout.top + 64,
      width: 42,
      height: 34
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
    this.comboAnimations = []
    this.comboChain = {
      playerId: null,
      count: 0
    }
    this.challengeTutorialQueue = []
    this.activeChallengeTutorial = null
    this.challengeTutorialButton = null
    this.soundTimers = []
    this.lastGameEndSoundKey = ''

    this.resetGame()
  }

  resetGame() {
    this.clearSoundTimers()
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
      applyChallengeLevelToBoard(board, this.currentChallengeLevel)
      board.challengeMeta = {
        ...(board.challengeMeta || {}),
        level: this.currentChallengeLevel.index,
        score: this.currentChallengeLevel.score,
        aiDifficulty: this.currentChallengeLevel.aiDifficulty,
        boardType: this.currentChallengeLevel.boardType,
        boardSize: this.currentChallengeLevel.boardSize
      }
      this.prepareChallengeTutorials()
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
    this.comboAnimations = []
    this.comboChain = {
      playerId: null,
      count: 0
    }
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
    this.lastGameEndSoundKey = ''

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
          this.roomPauseText = '对方暂时离线，等待重连...'
        } else {
          this.roomPauseText = '房间暂时暂停，等待恢复...'
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
  
    this._roundRect(ctx, x, y, w, h, UITheme.radius.lg)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()
  
    ctx.fillStyle = UITheme.colors.text
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, this.width / 2, y + h / 2)
    ctx.restore()
  }

  applyActionWithAnimation(action) {
    const previousStatus = this.engine.status
    const result = this.engine.handleAction(action)
  
    if (result && result.success) {
      if (this.isAiAssistEnabled()) {
        this.hintEdgeId = null
      }

      this.animationManager.playEdge(action.edgeId, action.playerId)
  
      for (const cell of result.closedCells) {
        this.animationManager.playCell(cell.id, action.playerId)
      }

      this.playActionSounds(result)
      this.updateComboChain(result, action.playerId)

      this.recordLeaderboardResult()
      this.playGameEndSound(previousStatus)
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
    unlockChallengeLevel(this.challengeLevelIndex + 1, this.challengeLevels ? this.challengeLevels.length : 99)
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
    const previousStatus = this.engine.status
    const previousEdgeCount = this.getClaimedEdgeCount()
    const previousCellCount = this.getOwnedCellCount()

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
    this.playRoomStateDiffSounds({
      previousEdgeCount,
      nextEdgeCount: Object.keys(edgeOwners).length,
      previousCellCount,
      nextCellCount: Object.keys(cellOwners).length
    })
    this.playGameEndSound(previousStatus)
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

    const topY = Math.max(this.safeLayout.insets.top + 210, this.safeLayout.top + 140)
    const bottomPad = this.safeLayout.insets.bottom + 190
    this.challengeLevels = createChallengeLevels({
      maxWidth: this.width - 80,
      maxHeight: this.height - topY - bottomPad,
      minCellSize: 7
    })
  }

  createBoardLayout() {
    const paddingX = 34
    const topY = Math.max(this.safeLayout.insets.top + 132, this.safeLayout.top + 82)
    const bottomPad = this.safeLayout.insets.bottom + 118
  
    const maxWidth = this.width - paddingX * 2
    const maxHeight = Math.max(120, this.height - topY - bottomPad)
  
    let cellSize
    let originX
    let originY
  
    if (this.boardType === 'hex') {
      const radius = 3
  
      const hexWidth = Math.sqrt(3) * (2 * radius - 1)
      const hexHeight = 1.5 * (2 * radius - 2) + 2
  
      cellSize = Math.max(12, Math.floor(
        Math.min(
          maxWidth / hexWidth,
          maxHeight / hexHeight
        )
      ))
  
      // 六边形棋盘：origin 是中心点
      originX = this.width / 2
      originY = topY + maxHeight / 2
    } else if (this.boardType === 'mixed-shape') {
      const meta = this.engine && this.engine.board && this.engine.board.layoutMeta
        ? this.engine.board.layoutMeta
        : { widthUnits: this.cols, heightUnits: this.rows }

      cellSize = Math.max(10, Math.floor(
        Math.min(
          maxWidth / Math.max(1, meta.widthUnits),
          maxHeight / Math.max(1, meta.heightUnits)
        )
      ))

      const boardWidth = meta.widthUnits * cellSize
      const boardHeight = meta.heightUnits * cellSize

      originX = (this.width - boardWidth) / 2
      originY = topY + (maxHeight - boardHeight) / 2
    } else {
      cellSize = Math.max(12, Math.floor(
        Math.min(
          maxWidth / this.cols,
          maxHeight / this.rows
        )
      ))
  
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

  _drawFittedText(text, x, y, maxWidth, fontSize, minFontSize = 10, weight = '') {
    const ctx = this.ctx
    const safeText = `${text}`
    const fontWeight = weight ? `${weight} ` : ''
    let size = fontSize

    while (size > minFontSize) {
      ctx.font = `${fontWeight}${size}px Arial`
      if (ctx.measureText(safeText).width <= maxWidth) break
      size -= 1
    }

    ctx.fillText(safeText, x, y)
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

  prepareChallengeTutorials() {
    if (!this.challengeMode || !this.currentChallengeLevel) {
      this.challengeTutorialQueue = []
      this.activeChallengeTutorial = null
      return
    }

    const current = this.getChallengeMechanicSet(this.currentChallengeLevel)
    const previous = new Set()
    const levels = Array.isArray(this.challengeLevels) ? this.challengeLevels : []
    const currentIndex = this.currentChallengeLevel.index || this.challengeLevelIndex

    for (const level of levels) {
      if (!level || level.index >= currentIndex) continue
      for (const key of this.getChallengeMechanicSet(level)) {
        previous.add(key)
      }
    }

    this.challengeTutorialQueue = CHALLENGE_TUTORIAL_ORDER
      .filter(key => current.has(key) && !previous.has(key))
      .map(key => ({
        key,
        ...CHALLENGE_TUTORIALS[key]
      }))

    this.activeChallengeTutorial = this.challengeTutorialQueue.shift() || null
    this.challengeTutorialButton = null
  }

  getChallengeMechanicSet(level) {
    const result = new Set()
    const special = level && level.special ? level.special : {}

    if (Array.isArray(special.missingCells) && special.missingCells.length > 0) {
      result.add('hole')
    }

    for (const cell of special.cells || []) {
      if (!cell || !cell.type) continue
      result.add(cell.type)
      if (cell.type === 'doubleCell') {
        result.add('chainDoubleCell')
      }
    }

    if (Array.isArray(special.edges) && special.edges.length > 0) {
      result.add('obstacleEdge')
    }

    return result
  }

  hasActiveChallengeTutorial() {
    return !!this.activeChallengeTutorial
  }

  advanceChallengeTutorial() {
    this.activeChallengeTutorial = this.challengeTutorialQueue.shift() || null
    this.challengeTutorialButton = null
  }

  updateAssistButtonLayout() {
    const buttonGap = 12
    const y = this.height - this.safeLayout.bottom - this.undoButton.height - 14

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
      if (this.hasActiveChallengeTutorial()) {
        if (!this.challengeTutorialButton || this.isButtonHit(this.challengeTutorialButton, x, y)) {
          this.playButtonSound()
          this.advanceChallengeTutorial()
        }
        return
      }

      if (this.turnCoverVisible) {
        this.hideTurnCover()
        return
      }

      if (this.isBackButtonHit(x, y)) {
        this.playButtonSound()
        this.returnToMenu()
        return
      }

      if (this.canShowUndoButton()) {
        if (this.isButtonHit(this.getUndoButton(), x, y)) {
          this.playButtonSound()
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
          this.playButtonSound()
          this.showHint()
          return
        }
      }
  
      const state = this.engine.getState()
  
      if (state.status === 'finished') {
        if (this.gameOverPanel.isRestartButtonHit(x, y)) {
          this.playButtonSound()
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
          this.playButtonSound()
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
          console.log('还没轮到我', {
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
    this.clearSoundTimers()
    this.aiThinking = false
    this.inputManager.clearTouchStartHandlers()
  }

  requestOnlineRematch() {
    if (!this.onlineManager) return
  
    const state = this.engine.getState()
  
    if (!state || state.status !== 'finished') {
      console.log('本地游戏尚未结束，不能请求再来一局')
      return
    }
  
    if (this.rematchRequested) {
      console.log('已经请求再来一局，等待对方确认')
      return
    }
  
    this.rematchRequested = true
    console.log('请求在线再来一局')
  
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
    this.updateComboAnimations(deltaTime)
    if (this.hasActiveChallengeTutorial()) return

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
        doubleScoreActivated: !!cell.doubleScoreActivated,
        isObstacle: !!cell.isObstacle,
        isFrozen: !!cell.isFrozen
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
        cell.isObstacle = !!cellSnapshot.isObstacle
        cell.isFrozen = !!cellSnapshot.isFrozen
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
    this.comboAnimations = []
    this.comboChain = {
      playerId: null,
      count: 0
    }
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
    this.drawBattleBackground()
  
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
    this.drawComboAnimations()
  
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

    if (this.hasActiveChallengeTutorial()) {
      this.drawChallengeTutorialOverlay()
    }
  }

  drawBattleBackground() {
    const ctx = this.ctx
    const theme = getActiveAppearanceTheme()
    const image = getImageAsset((theme.background && theme.background.imageAsset) || 'menuBackground')

    if (image && !image.failed && image.loaded) {
      const imageRatio = image.width / image.height
      const canvasRatio = this.width / this.height
      let drawW = this.width
      let drawH = this.height
      let drawX = 0
      let drawY = 0

      if (imageRatio > canvasRatio) {
        drawH = this.height
        drawW = drawH * imageRatio
        drawX = (this.width - drawW) / 2
      } else {
        drawW = this.width
        drawH = drawW / imageRatio
        drawY = (this.height - drawH) / 2
      }

      ctx.drawImage(image, drawX, drawY, drawW, drawH)
      ctx.fillStyle = theme.background.imageOverlay || 'rgba(244, 252, 255, 0.78)'
      ctx.fillRect(0, 0, this.width, this.height)
      return
    }

    ctx.fillStyle = theme.colors.background
    ctx.fillRect(0, 0, this.width, this.height)
  }

  getRestartText(state) {
    if (this.mode === 'online' && this.rematchRequested) {
      return '等待对方确认...'
    }

    if (this.challengeMode) {
      if (state.winnerId === 'p1' && this.challengeLevelIndex < this.challengeLevels.length) {
        return '下一关'
      }

      return '重试本关'
    }

    return '再来一局'
  }

  drawChallengeHud() {
    const ctx = this.ctx
    const meta = this.currentChallengeLevel
    if (!meta) return

    const text = `闯关 ${meta.index}/${this.challengeLevels.length || 99}  评分 ${meta.score}  ${this.getAiDifficultyLabel(meta.aiDifficulty)}`
    const x = this.width / 2
    const y = this.backButton.y + this.backButton.height / 2
    const w = Math.min(this.width - 170, 260)
    const h = 34

    ctx.save()
    this._roundRect(ctx, x - w / 2, y - h / 2, w, h, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = UITheme.colors.text
    ctx.font = 'bold 13px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y + 1)
    ctx.restore()
  }

  getAiDifficultyLabel(difficulty) {
    if (difficulty === 'inferno') return '炼狱 AI'
    if (difficulty === 'hard') return '困难 AI'
    return '普通 AI'
  }

  getPlayerColor(playerId) {
    const colors = getActiveAppearanceTheme().colors
    if (playerId === 'p1') return colors.p1
    if (playerId === 'p2') return colors.p2
    return colors.primary
  }

  /**
   * Draw player info card
   * @param {'p1'|'p2'} playerId
   * @param {object} state
   * @param {'top'|'bottom'} position
   */
    drawPlayerCard(playerId, state, position) {
      this.drawCompactPlayerCard(playerId, state)
      return
      const ctx = this.ctx
      const W = this.width
      const H = this.height
    
      const cardW = W - 40
      const cardH = 72
      const cardX = 20
      const cardY = position === 'top'
        ? this.safeLayout.insets.top + 120
        : H - this.safeLayout.insets.bottom - cardH - 88
    
      const color = this.getPlayerColor(playerId)
      const score = state.scores[playerId] ?? 0
      const total = this.engine.getMaxScore()
      const isMe = this.mode === 'online' && this.localPlayerId === playerId
      const name = this.getPlayerDisplayName(playerId)
    
      const isCurrent = state.currentPlayerId === playerId && state.status !== 'finished'
    
      ctx.save()
    
      // ── 卡片底色 ──────────────────────────────────────────
      this._roundRect(ctx, cardX, cardY, cardW, cardH, UITheme.radius.md)
      ctx.fillStyle = UITheme.colors.surface
      ctx.fill()
      ctx.strokeStyle = isCurrent ? color : UITheme.colors.line
      ctx.lineWidth = 1
      ctx.stroke()
    
      // Highlight current turn.
      if (isCurrent) {
        this._roundRectLeft(ctx, cardX, cardY, 6, cardH, UITheme.radius.md)
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
    
      ctx.fillStyle = UITheme.colors.text
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
    
        ctx.fillStyle = UITheme.colors.surface
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('我', tagX + tagW / 2, tagY + tagH / 2 + 1)
      }
    
      // Current turn label.
      if (isCurrent) {
        ctx.fillStyle = color
        ctx.font = '13px Arial'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText('当前回合', nameX, cardY + cardH / 2 + 12)
      }
    
      // ── 右侧分数 ──────────────────────────────────────────
      ctx.textAlign = 'right'
      ctx.font = 'bold 28px Arial'
      ctx.fillStyle = color
      ctx.fillText(`${score}`, cardX + cardW - 56, cardY + cardH / 2)
    
      ctx.font = '13px Arial'
      ctx.fillStyle = UITheme.colors.muted
      ctx.fillText(`/ ${total}`, cardX + cardW - 18, cardY + cardH / 2)
    
      // Score progress bar.
      const barX = cardX + 58
      const barY = cardY + cardH - 12
      const barW = cardW - 58 - 20
      const barH = 4
    
      this._roundRect(ctx, barX, barY, barW, barH, 2)
      ctx.fillStyle = UITheme.colors.line
      ctx.fill()
    
      const ratio = total > 0 ? score / total : 0
    
      if (ratio > 0) {
        this._roundRect(ctx, barX, barY, barW * ratio, barH, 2)
        ctx.fillStyle = color
        ctx.fill()
      }
    
      ctx.restore()
    }

  drawCompactPlayerCard(playerId, state) {
    const ctx = this.ctx
    const cardW = Math.min(132, (this.width - 54) / 2)
    const cardH = 58
    const cardX = playerId === 'p1' ? 14 : this.width - cardW - 14
    const cardY = this.safeLayout.top
    const color = this.getPlayerColor(playerId)
    const score = state.scores[playerId] ?? 0
    const total = this.engine.getMaxScore()
    const ratio = total > 0 ? score / total : 0
    const name = this.getPlayerDisplayName(playerId)
    const avatar = playerId === 'p1' ? 'avatarBlue' : 'avatarRed'
    const isCurrent = state.currentPlayerId === playerId && state.status !== 'finished'
    const isMe = this.mode === 'online' && this.localPlayerId === playerId

    ctx.save()
    this._roundRect(ctx, cardX, cardY, cardW, cardH, 8)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = isCurrent ? UITheme.colors.warning : 'rgba(255,255,255,0.65)'
    ctx.lineWidth = isCurrent ? 2 : 1
    ctx.stroke()

    if (isCurrent) {
      ctx.fillStyle = UITheme.colors.warning
      ctx.beginPath()
      ctx.arc(cardX + cardW - 14, cardY + 12, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    if (!drawImageAsset(ctx, avatar, cardX + 6, cardY + 8, 42, 42)) {
      ctx.fillStyle = UITheme.colors.surface
      ctx.beginPath()
      ctx.arc(cardX + 27, cardY + 29, 19, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    this._drawFittedText(name, cardX + 50, cardY + 17, cardW - 86, 12, 9, 'bold')

    ctx.font = 'bold 10px Arial'
    if (isMe) {
      ctx.fillStyle = 'rgba(255,255,255,0.24)'
      this._roundRect(ctx, cardX + 50, cardY + 27, 30, 16, 8)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'center'
      ctx.fillText('我', cardX + 65, cardY + 35)
    } else if (isCurrent) {
      ctx.fillStyle = UITheme.colors.warning
      ctx.fillText('回合', cardX + 50, cardY + 35)
    }

    ctx.textAlign = 'right'
    ctx.font = 'bold 28px Arial'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(`${score}`, cardX + cardW - 12, cardY + 37)

    const barX = cardX + 50
    const barY = cardY + cardH - 8
    const barW = cardW - 62
    this._roundRect(ctx, barX, barY, barW, 4, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.fill()
    if (ratio > 0) {
      this._roundRect(ctx, barX, barY, barW * ratio, 4, 2)
      ctx.fillStyle = UITheme.colors.warning
      ctx.fill()
    }
    ctx.restore()
  }

  drawCompactBackButton() {
    const ctx = this.ctx
    const b = this.backButton
    ctx.save()
    this._roundRect(ctx, b.x, b.y, b.width, b.height, UITheme.radius.md)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = UITheme.colors.text
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('‹', b.x + b.width / 2, b.y + b.height / 2 - 1)
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
    this.drawCompactBackButton()
    return
    const ctx = this.ctx
    const b = this.backButton

    ctx.save()

    // ── 白色圆角卡片底色 ────────────────────────────────────
    this._roundRect(ctx, b.x, b.y, b.width, b.height, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()

    // ── 左侧红色竖条（与玩家卡片语言一致）──────────────────
    this._roundRectLeft(ctx, b.x, b.y, 5, b.height, UITheme.radius.md)
  ctx.fillStyle = UITheme.colors.primary
  ctx.fill()

  // ── 箭头 + 文字 ─────────────────────────────────────────
  ctx.fillStyle = UITheme.colors.text
  ctx.font = 'bold 15px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('← 返回', b.x + b.width / 2 + 3, b.y + b.height / 2)

  ctx.restore()
}

  drawAssistButtons() {
    if (!this.canShowUndoButton()) return
    this.updateAssistButtonLayout()

    const undoEnabled = this.isOnlineUndoEnabled()
      ? this.canRequestOnlineUndo()
      : this.canUndoPlayerMove()
    const undoText = this.isOnlineUndoEnabled() && this.undoRequested
      ? '等待同意'
      : this.hasPendingOnlineUndoFromOpponent()
        ? '同意悔棋'
        : '悔棋'

    this.drawAssistButton(this.getUndoButton(), undoText, undoEnabled)

    if (this.isAiAssistEnabled()) {
      this.drawAssistButton(this.hintButton, '提示', this.canUseAiAssist())
    }
  }

  drawAssistButton(button, text, enabled) {
    const ctx = this.ctx

    ctx.save()

    this._roundRect(ctx, button.x, button.y, button.width, button.height, UITheme.radius.md)
    ctx.fillStyle = enabled ? UITheme.colors.surface : 'rgba(255, 255, 255, 0.68)'
    ctx.fill()
    ctx.strokeStyle = enabled ? UITheme.colors.warning : UITheme.colors.disabled
    ctx.lineWidth = 1
    ctx.stroke()

    this._roundRectLeft(ctx, button.x, button.y, 5, button.height, UITheme.radius.md)
    ctx.fillStyle = enabled ? UITheme.colors.warning : UITheme.colors.disabled
    ctx.fill()

    ctx.fillStyle = enabled ? UITheme.colors.text : UITheme.colors.muted
    ctx.font = 'bold 15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, button.x + button.width / 2 + 2, button.y + button.height / 2)

    ctx.restore()
  }

  updateComboChain(result, playerId) {
    const closedCount = result && Array.isArray(result.closedCells)
      ? result.closedCells.length
      : 0

    if (closedCount <= 0) {
      this.comboChain = {
        playerId: null,
        count: 0
      }
      return
    }

    if (this.comboChain.playerId === playerId && this.comboChain.count > 0) {
      this.comboChain.count += 1
    } else {
      this.comboChain = {
        playerId,
        count: 1
      }
    }

    if (this.comboChain.count >= 3) {
      this.playComboAnimation(this.comboChain.count, playerId)
    }
  }

  playComboAnimation(comboCount, playerId) {
    if (comboCount < 3) return

    this.comboAnimations.push({
      text: `COMBOX${comboCount}`,
      playerId,
      time: 0,
      duration: 880
    })
  }

  updateComboAnimations(deltaTime) {
    for (let i = this.comboAnimations.length - 1; i >= 0; i--) {
      const item = this.comboAnimations[i]
      item.time += deltaTime
      if (item.time >= item.duration) {
        this.comboAnimations.splice(i, 1)
      }
    }
  }

  playActionSounds(result) {
    if (!result || !result.success) return

    this.playSound('claim')

    if (Array.isArray(result.closedCells) && result.closedCells.length > 0) {
      this.playSoundDelayed('close', 35)
      this.vibrateShortDelayed(35)
    }
  }

  playRoomStateDiffSounds({ previousEdgeCount, nextEdgeCount, previousCellCount, nextCellCount }) {
    if (nextEdgeCount > previousEdgeCount) {
      this.playSound('claim')
    }

    if (nextCellCount > previousCellCount) {
      this.playSoundDelayed('close', 35)
      this.vibrateShortDelayed(35)
    }
  }

  playGameEndSound(previousStatus) {
    const state = this.engine.getState()
    if (!state || previousStatus === 'finished' || state.status !== 'finished') return

    const perspective = this.getEndSoundPerspective()
    const soundKey = `${this.getLocalStateKey()}:${perspective}`
    if (soundKey === this.lastGameEndSoundKey) return

    this.lastGameEndSoundKey = soundKey

    if (!state.winnerId) return

    const won = state.winnerId === perspective
    this.playSoundDelayed(won ? 'win' : 'lose', 120)

    if (won) {
      this.vibrateWinDelayed(120)
    }
  }

  getEndSoundPerspective() {
    if (this.mode === 'online') {
      return this.localPlayerId || 'p1'
    }

    return 'p1'
  }

  getClaimedEdgeCount() {
    let count = 0

    for (const edge of this.engine.board.edges.values()) {
      if (edge.ownerId) count += 1
    }

    return count
  }

  getOwnedCellCount() {
    let count = 0

    for (const cell of this.engine.board.cells.values()) {
      if (cell.ownerId) count += 1
    }

    return count
  }

  playSound(name) {
    SoundEffects.play(name)
  }

  playButtonSound() {
    this.playSound('button')
  }

  playSoundDelayed(name, delay) {
    const timer = setTimeout(() => {
      const index = this.soundTimers.indexOf(timer)
      if (index >= 0) {
        this.soundTimers.splice(index, 1)
      }
      SoundEffects.play(name)
    }, delay)

    this.soundTimers.push(timer)
  }

  vibrateShortDelayed(delay) {
    const timer = setTimeout(() => {
      const index = this.soundTimers.indexOf(timer)
      if (index >= 0) {
        this.soundTimers.splice(index, 1)
      }
      this.vibrateShort()
    }, delay)

    this.soundTimers.push(timer)
  }

  vibrateWinDelayed(delay) {
    const timer = setTimeout(() => {
      const index = this.soundTimers.indexOf(timer)
      if (index >= 0) {
        this.soundTimers.splice(index, 1)
      }

      const settings = getGameSettings()
      if (!settings.vibrationEnabled) return

      if (typeof wx !== 'undefined' && wx && typeof wx.vibrateLong === 'function') {
        wx.vibrateLong()
        return
      }

      this.vibrateShort()
    }, delay)

    this.soundTimers.push(timer)
  }

  vibrateShort(type = null) {
    const settings = getGameSettings()
    if (!settings.vibrationEnabled) return
    if (typeof wx === 'undefined' || !wx || typeof wx.vibrateShort !== 'function') return

    try {
      wx.vibrateShort({ type: type || 'medium' })
    } catch (err) {
      try {
        wx.vibrateShort()
      } catch (fallbackErr) {
        console.warn('vibrate short failed:', fallbackErr)
      }
    }
  }

  clearSoundTimers() {
    for (const timer of this.soundTimers) {
      clearTimeout(timer)
    }

    this.soundTimers = []
  }

  drawComboAnimations() {
    if (!this.comboAnimations.length) return

    const combo = this.comboAnimations[this.comboAnimations.length - 1]
    const t = Math.min(1, combo.time / combo.duration)
    const intro = Math.min(1, t / 0.22)
    const outro = t > 0.68 ? 1 - (t - 0.68) / 0.32 : 1
    const alpha = Math.max(0, Math.min(1, intro * outro))
    const scale = 0.86 + 0.18 * this.easeOutBack(intro)
    const lift = 12 * t
    const color = this.getPlayerColor(combo.playerId) || getActiveAppearanceTheme().colors.primary
    const w = Math.max(128, Math.min(188, this.width - 116))
    const h = 34
    const y = this.getComboAnimationY() - lift
    const ctx = this.ctx

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(this.width / 2, y + h / 2)
    ctx.scale(scale, scale)

    this._roundRect(ctx, -w / 2, -h / 2, w, h, UITheme.radius.md)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = color
    ctx.font = 'bold 22px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(combo.text, 0, 1)

    ctx.restore()
  }

  getComboAnimationY() {
    const controlsBottom = Math.max(
      this.backButton.y + this.backButton.height,
      this.safeLayout.top + 58
    )
    const boardTop = this.getBoardVisualTop()
    const gapTop = controlsBottom + 8
    const gapBottom = boardTop - 40

    if (gapBottom >= gapTop) {
      return (gapTop + gapBottom) / 2
    }

    return Math.min(
      boardTop + 10,
      this.height - this.safeLayout.bottom - 166
    )
  }

  getBoardVisualTop() {
    if (this.boardType === 'hex') {
      const radius = 3
      return this.layout.originY - this.layout.cellSize * (1.5 * (radius - 1) + 1)
    }

    if (this.boardType === 'mixed-shape') {
      return this.layout.originY
    }

    return this.layout.originY
  }

  easeOutBack(t) {
    t = Math.min(1, Math.max(0, t))
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }

  drawTurnCover() {
    const ctx = this.ctx
    const playerId = this.turnCoverPlayerId || this.engine.getCurrentPlayerId()
    const playerName = this.getPlayerDisplayName(playerId)

    ctx.save()

    ctx.fillStyle = 'rgba(24, 50, 74, 0.72)'
    ctx.fillRect(0, 0, this.width, this.height)

    const panelW = Math.min(this.width - 64, 300)
    const panelH = 136
    const panelX = (this.width - panelW) / 2
    const panelY = this.height / 2 - panelH / 2
    this._roundRect(ctx, panelX, panelY, panelW, panelH, UITheme.radius.lg)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = UITheme.colors.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.font = 'bold 28px Arial'
    ctx.fillText(`切换到${playerName}`, this.width / 2, this.height / 2 - 24)

    ctx.font = '18px Arial'
    ctx.fillStyle = UITheme.colors.muted
    ctx.fillText('点击任意处继续', this.width / 2, this.height / 2 + 24)
    ctx.restore()
  }

  drawChallengeTutorialOverlay() {
    const tutorial = this.activeChallengeTutorial
    if (!tutorial) return

    if (tutorial.key === 'hole') {
      this.drawHoleTutorialBubble(tutorial)
      return
    }

    const ctx = this.ctx
    const panelW = Math.min(this.width - 48, 324)
    const panelH = 206
    const panelX = (this.width - panelW) / 2
    const panelY = Math.max(this.safeLayout.top + 96, this.height / 2 - panelH / 2)
    const accent = tutorial.accent || UITheme.colors.primary
    const buttonW = 112
    const buttonH = 38
    const buttonX = panelX + panelW - buttonW - 18
    const buttonY = panelY + panelH - buttonH - 18

    this.challengeTutorialButton = {
      x: buttonX,
      y: buttonY,
      width: buttonW,
      height: buttonH
    }

    ctx.save()
    ctx.fillStyle = 'rgba(24, 50, 74, 0.58)'
    ctx.fillRect(0, 0, this.width, this.height)

    this._roundRect(ctx, panelX, panelY, panelW, panelH, UITheme.radius.lg)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = accent
    this._roundRect(ctx, panelX, panelY, 8, panelH, UITheme.radius.lg)
    ctx.fill()

    ctx.fillStyle = UITheme.colors.text
    ctx.font = 'bold 19px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(tutorial.title, panelX + 24, panelY + 20)

    ctx.fillStyle = UITheme.colors.muted
    ctx.font = '15px Arial'
    this.drawWrappedText(tutorial.body, panelX + 24, panelY + 58, panelW - 48, 22, 4)

    ctx.fillStyle = accent
    this._roundRect(ctx, buttonX, buttonY, buttonW, buttonH, UITheme.radius.md)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.challengeTutorialQueue.length > 0 ? '下一个' : '知道了', buttonX + buttonW / 2, buttonY + buttonH / 2)
    ctx.restore()
  }

  drawHoleTutorialBubble(tutorial) {
    const ctx = this.ctx
    const target = this.getFirstHoleMarkerCenter()

    if (!target) {
      this.drawChallengeTutorialOverlayCard(tutorial)
      return
    }

    const accent = tutorial.accent || UITheme.colors.danger
    const bubbleW = Math.min(this.width - 42, 304)
    const bubbleH = 168
    const gap = 28
    let bubbleX = (this.width - bubbleW) / 2
    let bubbleY = target.y > this.height * 0.5
      ? Math.max(this.safeLayout.top + 76, target.y - bubbleH - gap)
      : Math.min(this.height - this.safeLayout.bottom - bubbleH - 76, target.y + gap)

    if (bubbleY < this.safeLayout.top + 72) {
      bubbleY = this.safeLayout.top + 72
    }

    const buttonW = 104
    const buttonH = 36
    const buttonX = bubbleX + bubbleW - buttonW - 16
    const buttonY = bubbleY + bubbleH - buttonH - 14

    this.challengeTutorialButton = {
      x: buttonX,
      y: buttonY,
      width: buttonW,
      height: buttonH
    }

    ctx.save()
    ctx.fillStyle = 'rgba(24, 50, 74, 0.38)'
    ctx.fillRect(0, 0, this.width, this.height)

    this.drawHoleTargetPulse(target, accent)

    const anchorX = Math.max(bubbleX + 34, Math.min(bubbleX + bubbleW - 34, target.x))
    const anchorY = target.y < bubbleY ? bubbleY : bubbleY + bubbleH

    ctx.beginPath()
    ctx.moveTo(anchorX - 13, anchorY)
    ctx.lineTo(anchorX + 13, anchorY)
    ctx.lineTo(target.x, target.y)
    ctx.closePath()
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.stroke()

    this._roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, UITheme.radius.lg)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(bubbleX + 28, bubbleY + 28, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', bubbleX + 28, bubbleY + 29)

    ctx.fillStyle = UITheme.colors.text
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(tutorial.title, bubbleX + 48, bubbleY + 18)

    ctx.fillStyle = UITheme.colors.muted
    ctx.font = '15px Arial'
    this.drawWrappedText(tutorial.body, bubbleX + 18, bubbleY + 52, bubbleW - 36, 21, 3)

    ctx.fillStyle = accent
    this._roundRect(ctx, buttonX, buttonY, buttonW, buttonH, UITheme.radius.md)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.challengeTutorialQueue.length > 0 ? '下一个' : '知道了', buttonX + buttonW / 2, buttonY + buttonH / 2)
    ctx.restore()
  }

  drawChallengeTutorialOverlayCard(tutorial) {
    const savedKey = tutorial.key
    tutorial.key = ''
    this.drawChallengeTutorialOverlay()
    tutorial.key = savedKey
  }

  getFirstHoleMarkerCenter() {
    const special = this.engine && this.engine.board && this.engine.board.challengeMeta
      ? this.engine.board.challengeMeta.special
      : null
    const markers = special && Array.isArray(special.holeMarkers) ? special.holeMarkers : []
    const marker = markers.find(item => item && Array.isArray(item.points) && item.points.length >= 3)

    if (!marker) return null

    const points = marker.points.map(point => ({
      x: this.layout.originX + point[0] * this.layout.cellSize,
      y: this.layout.originY + point[1] * this.layout.cellSize
    }))

    const total = points.reduce((sum, point) => {
      sum.x += point.x
      sum.y += point.y
      return sum
    }, { x: 0, y: 0 })

    return {
      x: total.x / points.length,
      y: total.y / points.length,
      radius: Math.max(24, this.layout.cellSize * 0.58)
    }
  }

  drawHoleTargetPulse(target, accent) {
    const ctx = this.ctx
    const time = Date.now() / 650
    const pulse = 0.5 + 0.5 * Math.sin(time)
    const radius = target.radius + pulse * 8

    ctx.save()
    ctx.strokeStyle = accent
    ctx.lineWidth = 3
    ctx.shadowColor = accent
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(target.x, target.y, radius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
    ctx.beginPath()
    ctx.arc(target.x, target.y, Math.max(10, target.radius * 0.72), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines) {
    const ctx = this.ctx
    const chars = `${text}`.split('')
    const lines = []
    let line = ''

    for (const char of chars) {
      const next = line + char
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line)
        line = char
        if (lines.length >= maxLines) break
      } else {
        line = next
      }
    }

    if (line && lines.length < maxLines) {
      lines.push(line)
    }

    lines.forEach((item, index) => {
      ctx.fillText(item, x, y + index * lineHeight)
    })
  }
}
