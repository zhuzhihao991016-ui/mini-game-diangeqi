import BaseScene from './BaseScene'
import BattleScene from './BattleScene'
import TutorialScene from './TutorialScene'
import OnlineRoomScene from './OnlineRoomScene'
import { getSceneSafeLayout } from '../utils/SafeArea'
import { createChallengeLevels } from '../core/level/ChallengeLevels'
import { getUnlockedChallengeLevel } from '../state/ChallengeProgress'
import UITheme from '../ui/theme'
import { drawImageAsset, getImageAsset, preloadImageAssets } from '../assets/ImageAssets'
import SoundEffects from '../assets/SoundEffects'
import { getGameSettings, updateGameSettings } from '../state/SettingsState'

const BRAND_COLOR = UITheme.colors.primary
const DANGER_COLOR = UITheme.colors.danger
const TEXT_COLOR = UITheme.colors.text
const REDEEM_STORAGE_KEY = 'dots_boxes_redeemed_codes'
const REDEEM_CODES = {
  DOTS2026: {
    type: 'unlock_challenge',
    message: '\u5df2\u89e3\u9501\u5168\u90e8\u95ef\u5173\u5173\u5361'
  }
}

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
    this.challengeSelectPage = 0
    this.settingsControls = []
    this.safeLayout = getSceneSafeLayout(this.width, this.height)
    preloadImageAssets()
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
      if (this.page === 'settings' && this.handleSettingsTouch(x, y)) {
        return
      }

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

    this.drawBackground()
    this.drawTitleCard()
    this.drawSubtitle()
    if (this.page === 'leaderboard') this.drawLeaderboard()
    if (this.page === 'challenge-select') this.drawChallengeSelect()
    if (this.page === 'settings') this.drawSettingsPanel()
    if (this.page === 'home') this.drawUserPanel()
    for (const button of this.buttons) button.draw(ctx)
    if (this.toastTimer > 0) this.drawToast()
  }

  buildHomeButtons() {
    this.page = 'home'
    this.buttons = []
    this.settingsControls = []
    const cx = this.width / 2
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
    const mainCount = 5
    const quickY = this.bottomY(56)
    const minGap = 8
    const preferredGap = UITheme.menu.gap
    const maxStartY = quickY - mainCount * h - (mainCount - 1) * minGap - 16
    const startY = Math.max(this.y(248), Math.min(this.y(270), maxStartY))
    const gap = Math.max(minGap, Math.min(preferredGap, (quickY - startY - mainCount * h - 16) / (mainCount - 1)))

    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.start, accentColor: BRAND_COLOR, variant: 'solid', icon: 'grid', onClick: () => { this.selectedPlayStyle = 'classic'; this.buildModeButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap), width: w, height: h, text: T.funMode, accentColor: UITheme.colors.secondary, variant: 'solid', icon: 'star', onClick: () => { this.selectedPlayStyle = 'fun'; this.buildModeButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap) * 2, width: w, height: h, text: T.challengeMode, accentColor: UITheme.colors.purple, variant: 'solid', icon: 'flag', onClick: () => this.buildChallengeSelectButtons() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap) * 3, width: w, height: h, text: T.onlineMode, accentColor: UITheme.colors.warning, variant: 'solid', icon: 'globe', onClick: () => { this.selectedPlayStyle = 'classic'; this.selectedMode = 'online'; this.selectedBoardType = 'square'; this.buildSquareSizeButtons() } }))
    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: startY + (h + gap) * 4,
      width: w,
      height: h,
      text: T.tutorial,
      accentColor: BRAND_COLOR,
      variant: 'solid',
      icon: 'book',
      onClick: () => this.sceneManager.setScene(new TutorialScene({
        canvas: this.canvas,
        ctx: this.ctx,
        inputManager: this.inputManager,
        sceneManager: this.sceneManager,
        width: this.width,
        height: this.height
      }))
    }))
    const quickGap = UITheme.menu.compactGap
    const quickW = (w - quickGap) / 2
    const quickButtonY = this.bottomY(56)
    this.buttons.push(this.createCard({ x: cx - w / 2, y: quickButtonY, width: quickW, height: UITheme.menu.compactH, text: T.leaderboard, accentColor: UITheme.colors.warning, variant: 'solid', compact: true, icon: 'trophy', onClick: () => this.buildLeaderboardButtons() }))
    this.buttons.push(this.createCard({ x: cx - w / 2 + quickW + quickGap, y: quickButtonY, width: quickW, height: UITheme.menu.compactH, text: '\u8bbe\u7f6e', accentColor: UITheme.colors.muted, variant: 'solid', compact: true, icon: 'gear', onClick: () => this.buildSettingsButtons() }))
  }

  buildSettingsButtons() {
    this.page = 'settings'
    this.buttons = []
    this.settingsControls = this.createSettingsControls()
    this.buttons.push(this.createBackCard(() => this.buildHomeButtons()))
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
        height: UITheme.menu.compactH,
        text: tab.text,
        accentColor: this.selectedLeaderboardKey === tab.key ? BRAND_COLOR : '#BBBBBB',
        compact: true,
        onClick: () => this.switchLeaderboard(tab.key)
      }))
    })
    this.buttons.push(this.createBackCard(() => this.buildHomeButtons()))

    this.refreshLeaderboard()
  }

  drawBackground() {
    const ctx = this.ctx
    if (this.drawMenuBackgroundImage(ctx)) return

    ctx.fillStyle = UITheme.colors.background
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.save()
    ctx.strokeStyle = '#D9F0FF'
    ctx.lineWidth = 1
    for (let x = 22; x < this.width; x += 34) {
      for (let y = this.y(66); y < this.height; y += 34) {
        ctx.globalAlpha = 0.24
        ctx.beginPath()
        ctx.arc(x, y, 1.2, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  drawMenuBackgroundImage(ctx) {
    const image = getImageAsset('menuBackground')
    if (!image || image.failed || !image.loaded) return false

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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(0, 0, this.width, this.height)
    return true
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
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
    const startY = this.getVerticalListStartY(3, h, UITheme.menu.gap, this.y(174))
    const gap = this.getVerticalListGap(startY, 3, h, UITheme.menu.gap, UITheme.menu.gap)

    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.aiMode, subText: '\u4e0e AI \u5bf9\u6218', accentColor: BRAND_COLOR, icon: 'robot', onClick: () => this.selectAiMode() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.localMode, subText: '\u540c\u5c4f\u5bf9\u6218', accentColor: UITheme.colors.secondary, icon: 'players', onClick: () => { this.selectedMode = 'local_2p'; this.buildBoardButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap) * 2, width: w, height: h, text: T.onlineMode, subText: '\u5728\u7ebf\u5339\u914d\u6216\u9080\u8bf7\u597d\u53cb', accentColor: UITheme.colors.danger, icon: 'globe', onClick: () => { this.selectedMode = 'online'; this.selectedBoardType = 'square'; this.buildSquareSizeButtons() } }))
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
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
    const startY = this.getVerticalListStartY(3, h, UITheme.menu.gap, this.y(174))
    const gap = this.getVerticalListGap(startY, 3, h, UITheme.menu.gap, UITheme.menu.gap)
    const difficulties = [
      { text: T.easyAi, value: 'easy' },
      { text: T.hardAi, value: 'hard' },
      { text: T.infernoAi, value: 'inferno' }
    ]

    difficulties.forEach((item, index) => {
      const colors = [UITheme.colors.secondary, UITheme.colors.warning, UITheme.colors.danger]
      this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + index * (h + gap), width: w, height: h, text: item.text, accentColor: colors[index], icon: item.value === 'inferno' ? 'devil' : 'robot', onClick: () => { this.selectedAiDifficulty = item.value; this.buildBoardButtons() } }))
    })
    this.buttons.push(this.createBackCard(() => this.buildModeButtons()))
  }

  buildBoardButtons() {
    this.page = 'board'
    this.buttons = []
    const cx = this.width / 2
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
    const startY = this.getVerticalListStartY(2, h, UITheme.menu.gap, this.y(174))
    const gap = this.getVerticalListGap(startY, 2, h, UITheme.menu.gap, UITheme.menu.gap)

    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.square, accentColor: BRAND_COLOR, icon: 'grid', onClick: () => { this.selectedBoardType = 'square'; this.isFunModeSelected() ? this.startGame(6, 6) : this.buildSquareSizeButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.hex, accentColor: UITheme.colors.purple, icon: 'hex', onClick: () => { this.selectedBoardType = 'hex'; this.startHexGame() } }))
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
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
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
    const startY = this.getVerticalListStartY(sizes.length, h, UITheme.menu.gap, this.y(174))
    const gap = this.getVerticalListGap(startY, sizes.length, h, UITheme.menu.gap, UITheme.menu.gap)
    sizes.forEach((item, index) => {
      this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + index * (h + gap), width: w, height: h, text: item.text, accentColor: index === 0 ? BRAND_COLOR : UITheme.colors.secondary, icon: 'grid', onClick: () => this.startGame(item.rows, item.cols) }))
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
    if (this.page === 'settings') {
      this.buildSettingsButtons()
    } else {
      this.buildHomeButtons()
    }
  }

  async redeemCode() {
    const code = await this.promptRedeemCode()
    if (!code) return
    if (code === 'INVALID') {
      this.showToast('\u5151\u6362\u7801\u683c\u5f0f\u65e0\u6548')
      return
    }

    const redeemedCodes = this.getRedeemedCodes()
    if (redeemedCodes.includes(code)) {
      this.showToast('\u5151\u6362\u7801\u5df2\u4f7f\u7528')
      return
    }

    const reward = REDEEM_CODES[code]
    if (!reward) {
      this.showToast('\u5151\u6362\u7801\u65e0\u6548')
      return
    }

    if (reward.type === 'unlock_challenge') {
      const challengeLevels = this.createChallengeLevelsForMenu()
      unlockChallengeLevel(challengeLevels.length, challengeLevels.length)
      this.unlockedChallengeLevel = getUnlockedChallengeLevel(challengeLevels.length)
    }

    this.saveRedeemedCodes([...redeemedCodes, code])
    this.showToast(reward.message)
  }

  promptRedeemCode() {
    return new Promise(resolve => {
      wx.showModal({
        title: '\u5151\u6362\u7801',
        editable: true,
        placeholderText: '\u8bf7\u8f93\u5165\u5151\u6362\u7801',
        success: res => {
          if (!res.confirm || !res.content) {
            resolve('')
            return
          }

          const code = `${res.content}`.trim().toUpperCase()
          resolve(/^[A-Z0-9-]{4,24}$/.test(code) ? code : 'INVALID')
        },
        fail: () => resolve('')
      })
    })
  }

  getRedeemedCodes() {
    try {
      const value = wx.getStorageSync(REDEEM_STORAGE_KEY)
      return Array.isArray(value) ? value : []
    } catch (err) {
      return []
    }
  }

  saveRedeemedCodes(codes) {
    try {
      wx.setStorageSync(REDEEM_STORAGE_KEY, codes)
    } catch (err) {
      console.warn('save redeemed codes failed:', err)
    }
  }

  buildChallengeSelectButtons(page = 0) {
    this.page = 'challenge-select'
    this.challengeLevels = this.createChallengeLevelsForMenu()
    this.unlockedChallengeLevel = getUnlockedChallengeLevel(this.challengeLevels.length)
    this.buttons = []

    const cols = 6
    const rows = 5
    const perPage = cols * rows
    const maxPage = Math.max(0, Math.ceil(this.challengeLevels.length / perPage) - 1)
    this.challengeSelectPage = Math.max(0, Math.min(maxPage, page))
    const pageStart = this.challengeSelectPage * perPage
    const visibleLevels = this.challengeLevels.slice(pageStart, pageStart + perPage)
    const gap = 8
    const gridX = 24
    const gridY = this.y(272)
    const cellW = (this.width - gridX * 2 - gap * (cols - 1)) / cols
    const cellH = 42

    visibleLevels.forEach((level, index) => {
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

    const pagerY = gridY + rows * (cellH + gap) + 12
    const pagerW = 92
    const pagerH = UITheme.menu.compactH
    if (this.challengeSelectPage > 0) {
      this.buttons.push(this.createCard({
        x: 24,
        y: pagerY,
        width: pagerW,
        height: pagerH,
        text: '\u4e0a\u4e00\u9875',
        accentColor: UITheme.colors.muted,
        compact: true,
        onClick: () => this.buildChallengeSelectButtons(this.challengeSelectPage - 1)
      }))
    }

    if (this.challengeSelectPage < maxPage) {
      this.buttons.push(this.createCard({
        x: this.width - 24 - pagerW,
        y: pagerY,
        width: pagerW,
        height: pagerH,
        text: '\u4e0b\u4e00\u9875',
        accentColor: UITheme.colors.primary,
        compact: true,
        onClick: () => this.buildChallengeSelectButtons(this.challengeSelectPage + 1)
      }))
    }

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
    if (this.selectedMode === 'online') {
      this.selectedBoardType = 'square'
      this.buildSquareSizeButtons()
      return
    }

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
    this.drawTopBar()

    if (this.page !== 'home') {
      ctx.fillStyle = UITheme.colors.text
      ctx.font = 'bold 18px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.getPageTitle(), this.width / 2, this.safeLayout.top + 17)
      return
    }

    const topY = Math.max(this.y(64), this.safeLayout.top + 48)
    drawImageAsset(ctx, 'crown', this.width / 2 - 25, topY, 50, 50)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = '#1B85D8'
    ctx.font = '900 44px Arial'
    ctx.fillText('\u5708\u5730\u4e3a\u738b', this.width / 2, topY + 78)

    ctx.fillStyle = '#FF7A1A'
    ctx.font = '900 26px Arial'
    ctx.fillText('\u70b9\u683c\u68cb', this.width / 2, topY + 120)
  }

  drawSubtitle() {
    const subtitleMap = { difficulty: '', home: '', mode: '', board: '', leaderboard: '', 'challenge-select': '' }
    this.ctx.fillStyle = UITheme.colors.muted
    this.ctx.font = '14px Arial'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(subtitleMap[this.page] || '', this.width / 2, this.y(180))
  }

  drawUserPanel() {
    const ctx = this.ctx
    const x = 20
    const y = this.safeLayout.top
    const h = 36
    const rightLimit = this.safeLayout.menuButton
      ? Math.max(this.width * 0.56, this.safeLayout.menuButton.left - 12)
      : this.width - 12
    const profile = this.userManager ? this.userManager.profile : null
    const nickname = profile && profile.nickname ? profile.nickname : T.player

    this.drawAvatar(ctx, x + 18, y + h / 2, BRAND_COLOR)
    ctx.fillStyle = TEXT_COLOR
    ctx.font = 'bold 13px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, nickname, x + 42, y + h / 2, Math.max(72, rightLimit - x - 54), 13, 9, 'bold', 'left')
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

    this.roundRect(ctx, x, y, w, h, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = TEXT_COLOR
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, this.getLeaderboardTitle(), x + 18, y + 30, w - 36, 18, 12, 'bold', 'left')

    ctx.fillStyle = UITheme.colors.muted
    this.drawFittedText(ctx, this.isChallengeLeaderboard() ? T.leaderboardChallengeHint : T.leaderboardHint, x + 18, y + 54, w - 36, 12, 9, '', 'left')

    if (this.leaderboardLoading && records.length === 0) {
      ctx.fillStyle = UITheme.colors.muted
      ctx.font = '15px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(T.leaderboardLoading, this.width / 2, y + h / 2 + 20)
      return
    }

    if (records.length === 0) {
      ctx.fillStyle = UITheme.colors.muted
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

      this.roundRect(ctx, x + 10, rowY - 14, w - 20, rowH - 2, 6)
      ctx.fillStyle = index % 2 === 0 ? UITheme.colors.primaryLight : UITheme.colors.surface
      ctx.fill()

      ctx.fillStyle = BRAND_COLOR
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(`${rank}.`, x + 18, rowY + 1)

      ctx.fillStyle = UITheme.colors.muted
      ctx.font = '13px Arial'
      ctx.textAlign = 'right'
      const rightText = this.isChallengeLeaderboard()
        ? `${T.challengeRankValue} ${record.bestLevel || 0}  ${T.challengeScoreValue} ${record.bestScore || 0}`
        : `${T.failuresBeforeClear} ${failures}`
      const rightMaxW = this.isChallengeLeaderboard() ? 128 : 92
      this.drawFittedText(ctx, rightText, x + w - 18, rowY + 1, rightMaxW, 13, 9, '', 'right')

      ctx.fillStyle = TEXT_COLOR
      const nameMaxW = Math.max(70, w - 86 - rightMaxW)
      this.drawFittedText(ctx, record.nickname || T.player, x + 50, rowY + 1, nameMaxW, 14, 9, 'bold', 'left')
    })
  }

  drawChallengeSelect() {
    const ctx = this.ctx
    const x = 20
    const y = this.y(202)
    const w = this.width - 40
    const h = Math.min(378, this.bottomY(118) - y)

    this.roundRect(ctx, x, y, w, h, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = TEXT_COLOR
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, T.challengeSelect, x + 18, y + 30, w - 36, 18, 12, 'bold', 'left')

    ctx.fillStyle = UITheme.colors.muted
    const cols = 6
    const rows = 5
    const perPage = cols * rows
    const maxPage = Math.max(0, Math.ceil((this.challengeLevels.length || 99) / perPage) - 1)
    const pageText = `${this.challengeSelectPage + 1}/${maxPage + 1}`
    this.drawFittedText(ctx, `已解锁 ${this.unlockedChallengeLevel}/${this.challengeLevels.length || 99}  第 ${pageText} 页`, x + 18, y + 54, w - 36, 12, 9, '', 'left')
  }

  createSettingsControls() {
    const panel = this.getSettingsPanelRect()
    const controlW = panel.width - 72

    return [
      this.createToggleControl({
        x: panel.x + panel.width - 72,
        y: panel.y + 78,
        width: 48,
        height: 28,
        getValue: () => getGameSettings().soundEnabled,
        onChange: value => updateGameSettings({ soundEnabled: value })
      }),
      this.createSliderControl({
        x: panel.x + 36,
        y: panel.y + 136,
        width: controlW,
        height: 34,
        getValue: () => getGameSettings().volume,
        onChange: value => updateGameSettings({ volume: value })
      }),
      this.createToggleControl({
        x: panel.x + panel.width - 72,
        y: panel.y + 208,
        width: 48,
        height: 28,
        getValue: () => getGameSettings().vibrationEnabled,
        onChange: value => updateGameSettings({ vibrationEnabled: value })
      }),
      this.createActionControl({
        x: panel.x + 36,
        y: panel.y + 266,
        width: controlW,
        height: 38,
        text: '\u4fee\u6539\u6635\u79f0',
        accentColor: UITheme.colors.primary,
        onClick: () => this.changeNickname()
      }),
      this.createActionControl({
        x: panel.x + 36,
        y: panel.y + 314,
        width: controlW,
        height: 38,
        text: '\u5151\u6362\u7801',
        accentColor: UITheme.colors.secondary,
        onClick: () => this.redeemCode()
      }),
      this.createActionControl({
        x: panel.x + 36,
        y: panel.y + 362,
        width: controlW,
        height: 38,
        text: '\u6d4b\u8bd5\u97f3\u6548\u548c\u632f\u52a8',
        accentColor: UITheme.colors.warning,
        onClick: () => {
          this.previewVibration()
        }
      })
    ]
  }

  handleSettingsTouch(x, y) {
    for (const control of this.settingsControls) {
      if (control.hitTest(x, y)) {
        control.click(x, y)
        return true
      }
    }

    return false
  }

  drawSettingsPanel() {
    const ctx = this.ctx
    const panel = this.getSettingsPanelRect()
    const settings = getGameSettings()

    ctx.save()
    this.roundRect(ctx, panel.x, panel.y, panel.width, panel.height, UITheme.radius.lg)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = UITheme.colors.text
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, '\u8bbe\u7f6e', panel.x + 24, panel.y + 34, panel.width - 48, 20, 14, 'bold', 'left')
    this.drawSettingsLabel('\u97f3\u6548', '', panel.y + 92)
    this.drawSettingsLabel('\u97f3\u91cf', `${Math.round(settings.volume * 100)}%`, panel.y + 128)
    this.drawSettingsLabel('\u632f\u52a8', '', panel.y + 222)

    for (const control of this.settingsControls) {
      control.draw(ctx)
    }

    ctx.restore()
  }

  drawSettingsLabel(label, value, y) {
    const ctx = this.ctx
    const panel = this.getSettingsPanelRect()

    ctx.fillStyle = UITheme.colors.text
    this.drawFittedText(ctx, label, panel.x + 36, y, panel.width - 150, 15, 10, 'bold', 'left')
    if (!value) return

    ctx.fillStyle = UITheme.colors.muted
    this.drawFittedText(ctx, value, panel.x + panel.width - 36, y, 108, 13, 9, '', 'right')
  }

  getSettingsPanelRect() {
    const width = Math.min(this.width - 40, 320)

    return {
      x: (this.width - width) / 2,
      y: Math.max(this.safeLayout.top + 58, this.y(86)),
      width,
      height: 418
    }
  }

  createToggleControl({ x, y, width, height, getValue, onChange }) {
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click() {
        onChange(!getValue())
        SoundEffects.play('button')
      },
      draw: ctx => {
        const enabled = getValue()
        ctx.save()
        this.roundRect(ctx, x, y, width, height, height / 2)
        ctx.fillStyle = enabled ? UITheme.colors.primary : UITheme.colors.disabled
        ctx.fill()
        ctx.fillStyle = UITheme.colors.surface
        ctx.beginPath()
        ctx.arc(enabled ? x + width - height / 2 : x + height / 2, y + height / 2, height / 2 - 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  createSliderControl({ x, y, width, height, getValue, onChange }) {
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click(px) {
        onChange(Math.max(0, Math.min(1, (px - x) / width)))
        SoundEffects.play('button')
      },
      draw: ctx => {
        const value = getValue()
        const barY = y + height / 2
        ctx.save()
        this.roundRect(ctx, x, barY - 4, width, 8, 4)
        ctx.fillStyle = UITheme.colors.line
        ctx.fill()
        this.roundRect(ctx, x, barY - 4, width * value, 8, 4)
        ctx.fillStyle = UITheme.colors.primary
        ctx.fill()
        ctx.fillStyle = UITheme.colors.surface
        ctx.strokeStyle = UITheme.colors.primary
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x + width * value, barY, 12, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  createActionControl({ x, y, width, height, text, accentColor, onClick }) {
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click() {
        SoundEffects.play('button')
        onClick()
      },
      draw: ctx => {
        ctx.save()
        this.roundRect(ctx, x, y, width, height, UITheme.radius.md)
        ctx.fillStyle = accentColor === UITheme.colors.warning
          ? UITheme.colors.warningLight
          : this.getCardFill(accentColor)
        ctx.fill()
        ctx.strokeStyle = accentColor
        ctx.stroke()
        ctx.fillStyle = accentColor === UITheme.colors.warning ? UITheme.colors.text : accentColor
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, x + width / 2, y + height / 2)
        ctx.restore()
      }
    }
  }

  previewVibration() {
    const settings = getGameSettings()
    if (!settings.vibrationEnabled) return
    if (typeof wx === 'undefined' || !wx || typeof wx.vibrateShort !== 'function') return

    try {
      wx.vibrateShort({ type: 'medium' })
    } catch (err) {
      try {
        wx.vibrateShort()
      } catch (fallbackErr) {
        console.warn('preview vibration failed:', fallbackErr)
      }
    }
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
    this.roundRect(ctx, tx, ty, tw, th, UITheme.radius.lg)
    ctx.fillStyle = 'rgba(24, 50, 74, 0.9)'
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.toastText, this.width / 2, ty + th / 2)
  }

  getVerticalListStartY(count, itemH, minGap, preferredStartY) {
    const bottomLimit = this.bottomY(78)
    const needed = count * itemH + (count - 1) * minGap
    const maxStartY = bottomLimit - needed
    return Math.max(this.y(76), Math.min(preferredStartY, maxStartY))
  }

  getMenuCardWidth() {
    return this.width - UITheme.menu.pageX * 2
  }

  getVerticalListGap(startY, count, itemH, preferredGap, minGap) {
    if (count <= 1) return 0
    const bottomLimit = this.bottomY(78)
    const available = bottomLimit - startY - count * itemH
    return Math.max(minGap, Math.min(preferredGap, available / (count - 1)))
  }

  drawFittedText(ctx, text, x, y, maxWidth, fontSize, minFontSize = 10, weight = 'bold', align = 'center') {
    const safeText = `${text}`
    let size = fontSize
    const fontWeight = weight ? `${weight} ` : ''

    while (size > minFontSize) {
      ctx.font = `${fontWeight}${size}px Arial`
      if (ctx.measureText(safeText).width <= maxWidth) break
      size -= 1
    }

    ctx.textAlign = align
    ctx.fillText(safeText, x, y)
  }

  createCard({ x, y, width, height, text, subText = '', accentColor, onClick, icon = '', variant = 'card', compact = false }) {
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click() {
        SoundEffects.play('button')
        onClick()
      },
      draw: ctx => {
        ctx.save()
        this.roundRect(ctx, x, y, width, height, UITheme.radius.md)
        if (variant === 'solid') {
          const gradient = ctx.createLinearGradient(x, y, x, y + height)
          gradient.addColorStop(0, accentColor)
          gradient.addColorStop(1, this.darken(accentColor, 0.16))
          ctx.fillStyle = gradient
          ctx.fill()
          this.drawCardIcon(ctx, icon, x + 30, y + height / 2, 16, '#FFFFFF')
          ctx.fillStyle = '#FFFFFF'
          ctx.textBaseline = 'middle'
          this.drawFittedText(ctx, text, x + width / 2 + (icon ? 8 : 0), y + height / 2, width - (icon ? 84 : 24), compact ? UITheme.menu.compactFont : UITheme.menu.itemFont, compact ? 9 : 12, 'bold', 'center')
        } else {
          ctx.fillStyle = this.getCardFill(accentColor)
          ctx.fill()
          ctx.strokeStyle = accentColor
          ctx.lineWidth = 1.4
          ctx.stroke()
          const hasSideIcon = !compact && icon
          if (hasSideIcon) {
            this.drawCardIcon(ctx, icon, x + 38, y + height / 2, Math.min(24, height * 0.32), accentColor)
          }
          ctx.fillStyle = this.getReadableCardTextColor(accentColor, compact)
          ctx.textBaseline = 'middle'
          const textX = hasSideIcon ? x + 74 : x + width / 2
          const textMaxW = hasSideIcon ? width - 92 : width - 18
          const textAlign = hasSideIcon ? 'left' : 'center'
          this.drawFittedText(ctx, text, textX, y + height / 2 - (subText ? 8 : 0), textMaxW, compact ? UITheme.menu.compactFont : UITheme.menu.itemFont, compact ? 9 : 12, 'bold', textAlign)
          if (subText) {
            ctx.fillStyle = UITheme.colors.muted
            this.drawFittedText(ctx, subText, x + 74, y + height / 2 + 15, width - 92, UITheme.menu.subFont, 9, '', 'left')
          }
        }
        ctx.restore()
      }
    }
  }

  createBackCard(onClick) {
    return this.createCard({ x: UITheme.menu.pageX, y: this.safeLayout.top, width: UITheme.menu.backW, height: UITheme.menu.backH, text: '\u2039', accentColor: UITheme.colors.text, compact: true, onClick })
  }

  createChallengeLevelCard({ x, y, width, height, level, unlocked, onClick }) {
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click() {
        SoundEffects.play('button')
        onClick()
      },
      draw: ctx => {
        ctx.save()
        this.roundRect(ctx, x, y, width, height, UITheme.radius.md)
        ctx.fillStyle = unlocked ? UITheme.colors.primaryLight : 'rgba(242, 244, 247, 0.92)'
        ctx.fill()
        ctx.strokeStyle = unlocked ? BRAND_COLOR : UITheme.colors.disabled
        ctx.lineWidth = 1
        ctx.stroke()
        this.roundRectLeft(ctx, x, y, 4, height, UITheme.radius.md)
        ctx.fillStyle = unlocked ? BRAND_COLOR : '#B8B8B8'
        ctx.fill()
        ctx.fillStyle = unlocked ? TEXT_COLOR : '#888888'
        ctx.font = 'bold 16px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${level.index}`, x + width / 2, y + height / 2 - 8)

        if (!unlocked) {
          ctx.fillStyle = '#C58A00'
          ctx.font = '10px Arial'
          ctx.textAlign = 'left'
          ctx.fillText('\uD83D\uDD12', x + 10, y + 13)
        }

        ctx.fillStyle = unlocked ? UITheme.colors.muted : '#999999'
        ctx.font = '10px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(this.getAiDifficultyShortLabel(level.aiDifficulty), x + width / 2, y + height / 2 + 11)
        ctx.restore()
      }
    }
  }

  getAiDifficultyShortLabel(difficulty) {
    if (difficulty === 'inferno') return '\u70bc\u72f1'
    if (difficulty === 'hard') return '\u56f0\u96be'
    return '\u666e\u901a'
  }

  getCardFill(accentColor) {
    if (accentColor === DANGER_COLOR) return UITheme.colors.dangerLight
    if (accentColor === UITheme.colors.secondary) return UITheme.colors.secondaryLight
    if (accentColor === UITheme.colors.purple) return UITheme.colors.purpleLight
    if (accentColor === UITheme.colors.warning) return UITheme.colors.warningLight
    return UITheme.colors.surface
  }

  getReadableCardTextColor(accentColor, compact = false) {
    if (compact || accentColor === UITheme.colors.warning) return UITheme.colors.text
    return accentColor
  }

  drawAvatar(ctx, x, y, color) {
    ctx.save()
    if (!drawImageAsset(ctx, 'avatarBlue', x - 18, y - 18, 36, 36)) {
      ctx.fillStyle = UITheme.colors.primaryLight
      ctx.beginPath()
      ctx.arc(x, y, 18, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y - 5, 6, 0, Math.PI * 2)
      ctx.fill()
      this.roundRect(ctx, x - 10, y + 4, 20, 8, 4)
      ctx.fill()
    }
    ctx.restore()
  }

  drawTopBar() {
    const ctx = this.ctx
    if (this.page === 'home') return
    const y = this.safeLayout.top + 17
    ctx.fillStyle = UITheme.colors.text
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('\u2039', 32, y)
  }

  getPageTitle() {
    const map = {
      mode: T.playStyle,
      difficulty: T.difficulty,
      board: T.board,
      leaderboard: this.getLeaderboardTitle(),
      'challenge-select': T.challengeSelect,
      settings: '\u8bbe\u7f6e'
    }
    return map[this.page] || T.title
  }

  drawCardIcon(ctx, icon, x, y, size, color) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = Math.max(2, size / 8)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (icon === 'robot' && drawImageAsset(ctx, 'robot', x - size * 1.25, y - size * 1.25, size * 2.5, size * 2.5)) {
      ctx.restore()
      return
    }

    if (icon === 'grid') {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.moveTo(x - size, y + i * size)
        ctx.lineTo(x + size, y + i * size)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + i * size, y - size)
        ctx.lineTo(x + i * size, y + size)
        ctx.stroke()
      }
    } else if (icon === 'players') {
      ctx.beginPath()
      ctx.arc(x - size * 0.45, y - size * 0.35, size * 0.35, 0, Math.PI * 2)
      ctx.arc(x + size * 0.45, y - size * 0.35, size * 0.35, 0, Math.PI * 2)
      ctx.fill()
      this.roundRect(ctx, x - size * 1.1, y + size * 0.15, size * 2.2, size * 0.75, size * 0.2)
      ctx.fill()
    } else if (icon === 'globe') {
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - size, y)
      ctx.lineTo(x + size, y)
      ctx.moveTo(x, y - size)
      ctx.quadraticCurveTo(x - size * 0.6, y, x, y + size)
      ctx.moveTo(x, y - size)
      ctx.quadraticCurveTo(x + size * 0.6, y, x, y + size)
      ctx.stroke()
    } else if (icon === 'star' || icon === 'trophy') {
      this.drawStar(ctx, x, y, size, color)
    } else if (icon === 'flag') {
      ctx.beginPath()
      ctx.moveTo(x - size * 0.7, y + size)
      ctx.lineTo(x - size * 0.7, y - size)
      ctx.lineTo(x + size * 0.8, y - size * 0.55)
      ctx.lineTo(x - size * 0.7, y - size * 0.1)
      ctx.stroke()
    } else if (icon === 'hex') {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 6
        const px = x + Math.cos(a) * size
        const py = y + Math.sin(a) * size
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    } else if (icon === 'book' || icon === 'edit' || icon === 'gear') {
      ctx.font = `bold ${size * 1.4}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const text = icon === 'book' ? '?' : icon === 'edit' ? '\u270e' : '\u2699'
      ctx.fillText(text, x, y)
    } else if (icon === 'devil') {
      ctx.font = `bold ${size * 1.2}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('AI', x, y)
    }
    ctx.restore()
  }

  drawStar(ctx, x, y, r, color) {
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? r : r * 0.45
      const angle = -Math.PI / 2 + i * Math.PI / 5
      const px = x + Math.cos(angle) * radius
      const py = y + Math.sin(angle) * radius
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  darken(hex, amount) {
    const raw = hex.replace('#', '')
    const num = parseInt(raw, 16)
    const r = Math.max(0, Math.floor(((num >> 16) & 255) * (1 - amount)))
    const g = Math.max(0, Math.floor(((num >> 8) & 255) * (1 - amount)))
    const b = Math.max(0, Math.floor((num & 255) * (1 - amount)))
    return `rgb(${r}, ${g}, ${b})`
  }

  drawMiniBoardMark(x, y, size, color) {
    const ctx = this.ctx
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - size, y - size)
    ctx.lineTo(x + size, y - size)
    ctx.lineTo(x + size, y + size)
    ctx.stroke()
    ctx.fillStyle = UITheme.colors.dot
    for (let dx = -1; dx <= 1; dx += 2) {
      for (let dy = -1; dy <= 1; dy += 2) {
        ctx.beginPath()
        ctx.arc(x + dx * size, y + dy * size, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
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
