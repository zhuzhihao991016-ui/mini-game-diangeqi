import BaseScene from './BaseScene'
import BattleScene from './BattleScene'
import TutorialScene from './TutorialScene'
import OnlineRoomScene from './OnlineRoomScene'
import { getSceneSafeLayout } from '../utils/SafeArea'
import { createChallengeLevels } from '../core/level/ChallengeLevels'
import { getUnlockedChallengeLevel } from '../state/ChallengeProgress'

const BRAND_COLOR = '#4A90E2'
const DANGER_COLOR = '#E24A4A'
const TEXT_COLOR = '#222222'

const T = {
  loginFallback: '\u767b\u5f55\u5931\u8d25\uff0c\u6682\u7528\u672c\u5730\u8eab\u4efd',
  start: '\u4f20\u7edf\u6a21\u5f0f',
  editName: '\u4fee\u6539\u6635\u79f0',
  leaderboard: '\u70bc\u72f1\u6392\u884c\u699c',
  tutorial: '\u65b0\u624b\u6559\u7a0b',
  aiMode: '\u5355\u4eba\uff08\u4eba\u673a\uff09',
  funMode: '\u5a31\u4e50\u6a21\u5f0f',
  challengeMode: '\u95ef\u5173\u6a21\u5f0f',
  challengeSelect: '\u9009\u62e9\u5173\u5361',
  challengeLocked: '\u672a\u89e3\u9501',
  onlineMode: '\u53cc\u4eba\uff08\u8054\u7f51\uff09',
  localMode: '\u53cc\u4eba\uff08\u672c\u5730\uff09',
  easyAi: '\u666e\u901a AI',
  hardAi: '\u56f0\u96be AI\uff08\u8fde\u9501\u8ba1\u7b97\uff09',
  infernoAi: '\u70bc\u72f1 AI\uff08\u641c\u7d22\u63a7\u94fe\uff09',
  square: '\u65b9\u683c\u68cb\u76d8',
  hex: '\u516d\u8fb9\u5f62\u68cb\u76d8\uff08\u534a\u5f84 3\uff09',
  size3: '3 x 3 - \u5165\u95e8',
  size6: '6 x 6 - \u8fdb\u9636',
  size9: '9 x 9 - \u4e13\u5bb6',
  userMissing: '\u7528\u6237\u6a21\u5757\u672a\u521d\u59cb\u5316',
  nameUpdated: '\u6635\u79f0\u5df2\u66f4\u65b0',
  title: '\u5708\u5730\u4e3a\u738b',
  difficulty: '\u9009\u62e9 AI \u96be\u5ea6',
  home: '\u8bf7\u9009\u62e9\u64cd\u4f5c',
  playStyle: '\u9009\u62e9\u73a9\u6cd5',
  mode: '\u9009\u62e9\u6e38\u620f\u6a21\u5f0f',
  board: '\u9009\u62e9\u68cb\u76d8\u7c7b\u578b',
  leaderboardTitle: '3 x 3 \u70bc\u72f1\u901a\u5173\u699c',
  leaderboardTitle6: '6 x 6 \u70bc\u72f1\u901a\u5173\u699c',
  leaderboardTitleChallenge: '\u95ef\u5173\u6392\u884c\u699c',
  leaderboardEmpty: '\u6682\u65e0\u901a\u5173\u8bb0\u5f55',
  leaderboardHint: '\u6309\u901a\u5173\u524d\u5931\u8d25\u6b21\u6570\u5347\u5e8f\u6392\u5217',
  leaderboardChallengeHint: '\u6309\u6700\u9ad8\u5173\u5361\u548c\u8bc4\u5206\u964d\u5e8f\u6392\u5217',
  leaderboardLoading: '\u6392\u884c\u699c\u52a0\u8f7d\u4e2d...',
  failuresBeforeClear: '\u5931\u8d25\u6b21\u6570',
  challengeRankValue: '\u5173\u5361',
  challengeScoreValue: '\u8bc4\u5206',
  inferno3: '3x3',
  inferno6: '6x6',
  challengeRank: '\u95ef\u5173',
  player: '\u73a9\u5bb6',
  loggingIn: '\u767b\u5f55\u4e2d...',
  nicknameLabel: '\u6635\u79f0\uff1a',
  playerIdLabel: 'PlayerID\uff1a',
  back: '\u8fd4\u56de'
}

export default class MenuScene extends BaseScene {
  constructor({ canvas, ctx, inputManager, sceneManager, width, height, userManager = null, leaderboardManager = null }) {
    super()

    this.canvas = canvas
    this.ctx = ctx
    this.inputManager = inputManager
    this.sceneManager = sceneManager
    this.width = width
    this.height = height
    this.userManager = userManager || wx.__userManager || null
    this.leaderboardManager = leaderboardManager || wx.__leaderboardManager || null
    this.page = 'home'
    this.selectedMode = null
    this.selectedBoardType = 'square'
    this.selectedAiDifficulty = 'easy'
    this.selectedPlayStyle = 'classic'
    this.buttons = []
    this.toastText = ''
    this.toastTimer = 0
    this.leaderboardLoading = false
    this.selectedLeaderboardKey = 'inferno-3x3'
    this.challengeLevels = []
    this.unlockedChallengeLevel = 1
    this.safeLayout = getSceneSafeLayout(this.width, this.height)
  }

  y(value) {
    return value + this.safeLayout.insets.top
  }

  bottomY(offset) {
    return this.height - this.safeLayout.insets.bottom - offset
  }

  onEnter() {
    this.inputManager.clearTouchStartHandlers()
    this.inputManager.onTouchStart((x, y) => {
      for (const button of this.buttons) {
        if (button.hitTest(x, y)) {
          button.click()
          return
        }
      }
    })

    this.buildHomeButtons()

    if (this.userManager && this.userManager.ensureLogin) {
      this.userManager.ensureLogin().then(() => {
        if (this.page === 'home') this.buildHomeButtons()
      }).catch(() => this.showToast(T.loginFallback))
    }
  }

  update(deltaTime) {
    if (this.toastTimer > 0) this.toastTimer -= deltaTime
  }

  render() {
    const ctx = this.ctx

    ctx.fillStyle = '#EFEFEF'
    ctx.fillRect(0, 0, this.width, this.height)
    this.drawTitleCard()
    this.drawSubtitle()
    if (this.page === 'leaderboard') this.drawLeaderboard()
    if (this.page === 'challenge-select') this.drawChallengeSelect()
    if (this.page === 'home') this.drawUserPanel()
    for (const button of this.buttons) button.draw(ctx)
    if (this.toastTimer > 0) this.drawToast()
  }

  buildHomeButtons() {
    this.page = 'home'
    this.buttons = []
    const cx = this.width / 2
    const w = this.width - 40
    const h = 54

    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(290), width: w, height: h, text: T.start, accentColor: BRAND_COLOR, onClick: () => { this.selectedPlayStyle = 'classic'; this.buildModeButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(354), width: w, height: h, text: T.funMode, accentColor: BRAND_COLOR, onClick: () => { this.selectedPlayStyle = 'fun'; this.buildModeButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(418), width: w, height: h, text: T.challengeMode, accentColor: BRAND_COLOR, onClick: () => this.buildChallengeSelectButtons() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(482), width: w, height: h, text: T.editName, accentColor: BRAND_COLOR, onClick: () => this.changeNickname() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(546), width: w, height: h, text: T.leaderboard, accentColor: BRAND_COLOR, onClick: () => this.buildLeaderboardButtons() }))
    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: this.y(610),
      width: w,
      height: h,
      text: T.tutorial,
      accentColor: BRAND_COLOR,
      onClick: () => this.sceneManager.setScene(new TutorialScene({
        canvas: this.canvas,
        ctx: this.ctx,
        inputManager: this.inputManager,
        sceneManager: this.sceneManager,
        width: this.width,
        height: this.height
      }))
    }))
  }

  buildLeaderboardButtons() {
    this.page = 'leaderboard'
    this.buttons = []
    const tabY = this.y(205)
    const gap = 8
    const tabW = (this.width - 40 - gap * 2) / 3
    const tabs = [
      { key: 'inferno-3x3', text: T.inferno3 },
      { key: 'inferno-6x6', text: T.inferno6 },
      { key: 'challenge', text: T.challengeRank }
    ]

    tabs.forEach((tab, index) => {
      this.buttons.push(this.createCard({
        x: 20 + index * (tabW + gap),
        y: tabY,
        width: tabW,
        height: 42,
        text: tab.text,
        accentColor: this.selectedLeaderboardKey === tab.key ? BRAND_COLOR : '#BBBBBB',
        onClick: () => this.switchLeaderboard(tab.key)
      }))
    })
    this.buttons.push(this.createBackCard(() => this.buildHomeButtons()))

    this.refreshLeaderboard()
  }

  switchLeaderboard(boardKey) {
    if (this.selectedLeaderboardKey === boardKey) return
    this.selectedLeaderboardKey = boardKey
    if (this.leaderboardManager && typeof this.leaderboardManager.setBoardKey === 'function') {
      this.leaderboardManager.setBoardKey(boardKey)
    }
    this.buildLeaderboardButtons()
  }

  refreshLeaderboard() {
    if (!this.leaderboardManager || typeof this.leaderboardManager.refresh !== 'function') return

    this.leaderboardLoading = true
    this.leaderboardManager.refresh(20, this.selectedLeaderboardKey).then(() => {
      this.leaderboardLoading = false
    }).catch(() => {
      this.leaderboardLoading = false
    })
  }

  buildModeButtons() {
    this.page = 'mode'
    this.buttons = []
    const cx = this.width / 2
    const w = this.width - 40
    const h = 58

    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(195), width: w, height: h, text: T.aiMode, accentColor: BRAND_COLOR, onClick: () => this.selectAiMode() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(268), width: w, height: h, text: T.onlineMode, accentColor: BRAND_COLOR, onClick: () => { this.selectedMode = 'online'; this.selectedBoardType = 'square'; this.buildBoardButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(341), width: w, height: h, text: T.localMode, accentColor: BRAND_COLOR, onClick: () => { this.selectedMode = 'local_2p'; this.buildBoardButtons() } }))
    this.buttons.push(this.createBackCard(() => this.buildHomeButtons()))
  }

  selectAiMode() {
    this.selectedMode = 'ai'

    if (this.isFunModeSelected()) {
      this.selectedAiDifficulty = 'hard'
      this.buildBoardButtons()
      return
    }

    this.buildDifficultyButtons()
  }

  buildDifficultyButtons() {
    this.page = 'difficulty'
    this.buttons = []
    const cx = this.width / 2
    const w = this.width - 40
    const h = 58
    const difficulties = [
      { text: T.easyAi, value: 'easy' },
      { text: T.hardAi, value: 'hard' },
      { text: T.infernoAi, value: 'inferno' }
    ]

    difficulties.forEach((item, index) => {
      this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(195 + index * 73), width: w, height: h, text: item.text, accentColor: BRAND_COLOR, onClick: () => { this.selectedAiDifficulty = item.value; this.buildBoardButtons() } }))
    })
    this.buttons.push(this.createBackCard(() => this.buildModeButtons()))
  }

  buildBoardButtons() {
    this.page = 'board'
    this.buttons = []
    const cx = this.width / 2
    const w = this.width - 40
    const h = 58

    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(195), width: w, height: h, text: T.square, accentColor: BRAND_COLOR, onClick: () => { this.selectedBoardType = 'square'; this.isFunModeSelected() ? this.startGame(6, 6) : this.buildSquareSizeButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(268), width: w, height: h, text: T.hex, accentColor: BRAND_COLOR, onClick: () => { this.selectedBoardType = 'hex'; this.startHexGame() } }))
    this.buttons.push(this.createBackCard(() => {
      if (this.selectedMode === 'ai' && !this.isFunModeSelected()) {
        this.buildDifficultyButtons()
        return
      }
      this.buildModeButtons()
    }))
  }

  buildSquareSizeButtons() {
    this.page = 'board'
    this.buttons = []
    const cx = this.width / 2
    const w = this.width - 40
    const h = 58
    const sizes = [
      { text: T.size3, rows: 3, cols: 3 },
      { text: T.size6, rows: 6, cols: 6 },
      { text: T.size9, rows: 9, cols: 9 }
    ]

    if (this.isFunModeSelected()) {
      this.startGame(6, 6)
      return
    }

    if (this.selectedMode === 'online') sizes.splice(2)
    sizes.forEach((item, index) => {
      this.buttons.push(this.createCard({ x: cx - w / 2, y: this.y(195 + index * 73), width: w, height: h, text: item.text, accentColor: BRAND_COLOR, onClick: () => this.startGame(item.rows, item.cols) }))
    })
    this.buttons.push(this.createBackCard(() => this.selectedMode === 'online' ? this.buildModeButtons() : this.buildBoardButtons()))
  }

  async changeNickname() {
    if (!this.userManager) {
      this.showToast(T.userMissing)
      return
    }
    const nickname = await this.userManager.promptNickname()
    if (!nickname) return
    await this.userManager.updateNickname(nickname)
    this.showToast(T.nameUpdated)
    this.buildHomeButtons()
  }

  buildChallengeSelectButtons() {
    this.page = 'challenge-select'
    this.challengeLevels = this.createChallengeLevelsForMenu()
    this.unlockedChallengeLevel = getUnlockedChallengeLevel(this.challengeLevels.length)
    this.buttons = []

    const cols = 4
    const gap = 8
    const gridX = 24
    const gridY = this.y(274)
    const cellW = (this.width - gridX * 2 - gap * (cols - 1)) / cols
    const cellH = 48

    this.challengeLevels.forEach((level, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const unlocked = level.index <= this.unlockedChallengeLevel

      this.buttons.push(this.createChallengeLevelCard({
        x: gridX + col * (cellW + gap),
        y: gridY + row * (cellH + gap),
        width: cellW,
        height: cellH,
        level,
        unlocked,
        onClick: () => {
          if (!unlocked) {
            this.showToast(T.challengeLocked)
            return
          }
          this.startChallengeMode(level.index, this.challengeLevels)
        }
      }))
    })

    this.buttons.push(this.createBackCard(() => this.buildHomeButtons()))
  }

  createChallengeLevelsForMenu() {
    return createChallengeLevels({
      maxWidth: this.width - 80,
      maxHeight: this.height - (this.safeLayout.insets.top + 210) - (this.safeLayout.insets.bottom + 190),
      minCellSize: 7
    })
  }

  startChallengeMode(levelIndex = 1, levels = null) {
    const challengeLevels = levels && levels.length > 0 ? levels : this.createChallengeLevelsForMenu()
    const safeIndex = Math.max(1, Math.min(challengeLevels.length, levelIndex))

    if (safeIndex > getUnlockedChallengeLevel(challengeLevels.length)) {
      this.showToast(T.challengeLocked)
      return
    }

    this.sceneManager.setScene(new BattleScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height,
      boardType: 'mixed-shape',
      mode: 'ai',
      aiDifficulty: challengeLevels[safeIndex - 1] ? challengeLevels[safeIndex - 1].aiDifficulty : 'easy',
      challengeMode: true,
      challengeLevelIndex: safeIndex,
      challengeLevels: challengeLevels,
      userManager: this.userManager,
      leaderboardManager: this.leaderboardManager
    }))
  }

  startGame(rows, cols) {
    if (this.selectedMode === 'online') {
      this.sceneManager.setScene(new OnlineRoomScene({
        canvas: this.canvas,
        ctx: this.ctx,
        inputManager: this.inputManager,
        sceneManager: this.sceneManager,
        width: this.width,
        height: this.height,
        rows,
        cols,
        boardType: 'square',
        isFunMode: this.isFunModeSelected(),
        onlineManager: wx.__roomManager,
        userManager: this.userManager
      }))
      return
    }

    this.sceneManager.setScene(new BattleScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height,
      rows,
      cols,
      boardType: this.selectedBoardType,
      mode: this.selectedMode,
      aiDifficulty: this.selectedAiDifficulty,
      isFunMode: this.isFunModeSelected(),
      userManager: this.userManager,
      leaderboardManager: this.leaderboardManager
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
      boardType: 'hex',
      mode: this.selectedMode,
      aiDifficulty: this.selectedAiDifficulty,
      isFunMode: this.isFunModeSelected(),
      userManager: this.userManager,
      leaderboardManager: this.leaderboardManager
    }))
  }

  isFunModeSelected() {
    return this.selectedPlayStyle === 'fun'
  }

  showToast(text) {
    this.toastText = text
    this.toastTimer = 1500
  }

  drawTitleCard() {
    const ctx = this.ctx
    const cardW = this.width - 40
    const cardH = 90
    const cardX = 20
    const cardY = this.y(70)

    this.roundRect(ctx, cardX, cardY, cardW, cardH, 5)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    this.roundRectLeft(ctx, cardX, cardY, 6, cardH, 14)
    ctx.fillStyle = BRAND_COLOR
    ctx.fill()
    ctx.fillStyle = TEXT_COLOR
    ctx.font = 'bold 30px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(T.title, this.width / 2, cardY + cardH / 2 - 10)
    ctx.fillStyle = BRAND_COLOR
    ctx.font = '13px Arial'
    ctx.fillText('Dots and Boxes', this.width / 2, cardY + cardH / 2 + 16)
  }

  drawSubtitle() {
    const subtitleMap = { difficulty: T.difficulty, home: T.playStyle, mode: T.mode, board: T.board, leaderboard: this.getLeaderboardTitle(), 'challenge-select': T.challengeSelect }
    this.ctx.fillStyle = '#999999'
    this.ctx.font = '14px Arial'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(subtitleMap[this.page] || '', this.width / 2, this.y(180))
  }

  drawUserPanel() {
    const ctx = this.ctx
    const x = 20
    const y = this.y(205)
    const w = this.width - 40
    const h = 72
    const profile = this.userManager ? this.userManager.profile : null
    const nickname = profile && profile.nickname ? profile.nickname : T.player
    const playerId = profile && profile.playerId ? profile.playerId : T.loggingIn

    this.roundRect(ctx, x, y, w, h, 6)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    this.roundRectLeft(ctx, x, y, 6, h, 12)
    ctx.fillStyle = BRAND_COLOR
    ctx.fill()
    ctx.fillStyle = TEXT_COLOR
    ctx.font = 'bold 17px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${T.nicknameLabel}${nickname}`, x + 18, y + 24)
    ctx.fillStyle = '#777777'
    ctx.font = '12px Arial'
    ctx.fillText(`${T.playerIdLabel}${playerId}`, x + 18, y + 50)
  }

  drawLeaderboard() {
    const ctx = this.ctx
    const x = 20
    const y = this.y(260)
    const w = this.width - 40
    const h = Math.min(390, this.bottomY(110) - y)
    const records = this.leaderboardManager && this.leaderboardManager.getRecords
      ? this.leaderboardManager.getRecords(8, this.selectedLeaderboardKey)
      : []

    this.roundRect(ctx, x, y, w, h, 6)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    this.roundRectLeft(ctx, x, y, 6, h, 12)
    ctx.fillStyle = BRAND_COLOR
    ctx.fill()

    ctx.fillStyle = TEXT_COLOR
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.getLeaderboardTitle(), x + 18, y + 30)

    ctx.fillStyle = '#777777'
    ctx.font = '12px Arial'
    ctx.fillText(this.isChallengeLeaderboard() ? T.leaderboardChallengeHint : T.leaderboardHint, x + 18, y + 54)

    if (this.leaderboardLoading && records.length === 0) {
      ctx.fillStyle = '#999999'
      ctx.font = '15px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(T.leaderboardLoading, this.width / 2, y + h / 2 + 20)
      return
    }

    if (records.length === 0) {
      ctx.fillStyle = '#999999'
      ctx.font = '15px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(T.leaderboardEmpty, this.width / 2, y + h / 2 + 20)
      return
    }

    const rowTop = y + 82
    const rowH = 32

    records.forEach((record, index) => {
      const rowY = rowTop + index * rowH
      const rank = index + 1
      const failures = record.failuresBeforeClear || 0

      ctx.fillStyle = index % 2 === 0 ? '#F7FAFF' : '#FFFFFF'
      ctx.fillRect(x + 10, rowY - 14, w - 20, rowH - 2)

      ctx.fillStyle = BRAND_COLOR
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(`${rank}.`, x + 18, rowY + 1)

      ctx.fillStyle = TEXT_COLOR
      ctx.font = 'bold 14px Arial'
      ctx.fillText(record.nickname || T.player, x + 50, rowY + 1)

      ctx.fillStyle = '#666666'
      ctx.font = '13px Arial'
      ctx.textAlign = 'right'
      if (this.isChallengeLeaderboard()) {
        ctx.fillText(`${T.challengeRankValue} ${record.bestLevel || 0}  ${T.challengeScoreValue} ${record.bestScore || 0}`, x + w - 18, rowY + 1)
      } else {
        ctx.fillText(`${T.failuresBeforeClear} ${failures}`, x + w - 18, rowY + 1)
      }
    })
  }

  drawChallengeSelect() {
    const ctx = this.ctx
    const x = 20
    const y = this.y(202)
    const w = this.width - 40
    const h = Math.min(378, this.bottomY(118) - y)

    this.roundRect(ctx, x, y, w, h, 6)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    this.roundRectLeft(ctx, x, y, 6, h, 12)
    ctx.fillStyle = BRAND_COLOR
    ctx.fill()

    ctx.fillStyle = TEXT_COLOR
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(T.challengeSelect, x + 18, y + 30)

    ctx.fillStyle = '#777777'
    ctx.font = '12px Arial'
    ctx.fillText(`已解锁 ${this.unlockedChallengeLevel}/${this.challengeLevels.length || 20}`, x + 18, y + 54)
  }

  getLeaderboardTitle() {
    if (this.selectedLeaderboardKey === 'inferno-6x6') return T.leaderboardTitle6
    if (this.selectedLeaderboardKey === 'challenge') return T.leaderboardTitleChallenge
    return T.leaderboardTitle
  }

  isChallengeLeaderboard() {
    return this.selectedLeaderboardKey === 'challenge'
  }

  drawToast() {
    const ctx = this.ctx
    const tw = 260
    const th = 46
    const tx = (this.width - tw) / 2
    const ty = this.bottomY(106)
    this.roundRect(ctx, tx, ty, tw, th, 10)
    ctx.fillStyle = 'rgba(34,34,34,0.88)'
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.toastText, this.width / 2, ty + th / 2)
  }

  createCard({ x, y, width, height, text, accentColor, onClick }) {
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click() {
        onClick()
      },
      draw: ctx => {
        ctx.save()
        this.roundRect(ctx, x, y, width, height, 5)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        this.roundRectLeft(ctx, x, y, 6, height, 14)
        ctx.fillStyle = accentColor
        ctx.fill()
        ctx.fillStyle = TEXT_COLOR
        ctx.font = 'bold 17px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, x + width / 2 + 3, y + height / 2)
        ctx.restore()
      }
    }
  }

  createBackCard(onClick) {
    return this.createCard({ x: 20, y: this.bottomY(66), width: 110, height: 40, text: T.back, accentColor: DANGER_COLOR, onClick })
  }

  createChallengeLevelCard({ x, y, width, height, level, unlocked, onClick }) {
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click() {
        onClick()
      },
      draw: ctx => {
        ctx.save()
        this.roundRect(ctx, x, y, width, height, 6)
        ctx.fillStyle = unlocked ? '#F7FAFF' : '#E6E6E6'
        ctx.fill()
        this.roundRectLeft(ctx, x, y, 5, height, 12)
        ctx.fillStyle = unlocked ? BRAND_COLOR : '#B8B8B8'
        ctx.fill()
        ctx.fillStyle = unlocked ? TEXT_COLOR : '#888888'
        ctx.font = 'bold 18px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(unlocked ? `${level.index}` : `\uD83D\uDD12 ${level.index}`, x + width / 2, y + height / 2 - 7)
        ctx.fillStyle = unlocked ? '#666666' : '#999999'
        ctx.font = '11px Arial'
        ctx.fillText(this.getAiDifficultyShortLabel(level.aiDifficulty), x + width / 2, y + height / 2 + 15)
        ctx.restore()
      }
    }
  }

  getAiDifficultyShortLabel(difficulty) {
    if (difficulty === 'inferno') return '\u70bc\u72f1'
    if (difficulty === 'hard') return '\u56f0\u96be'
    return '\u666e\u901a'
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

  roundRectLeft(ctx, x, y, w, h, r) {
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
}
