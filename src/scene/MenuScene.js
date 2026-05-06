import BaseScene from './BaseScene'
import BattleScene from './BattleScene'
import TutorialScene from './TutorialScene'
import OnlineRoomScene from './OnlineRoomScene'
import { getSceneSafeLayout } from '../utils/SafeArea'
import { createChallengeLevels } from '../core/level/ChallengeLevels'
import { getUnlockedChallengeLevel } from '../state/ChallengeProgress'
import UITheme from '../ui/theme'
import { getActiveAppearanceTheme, getAppearanceThemeOptions } from '../ui/AppearanceThemes'
import { drawImageAsset, getImageAsset, preloadImageAssets } from '../assets/ImageAssets'
import SoundEffects from '../assets/SoundEffects'
import { getGameSettings, updateGameSettings } from '../state/SettingsState'

const REDEEM_STORAGE_KEY = 'dots_boxes_redeemed_codes'
const REDEEM_CODES = {
  DOTS2026: {
    type: 'unlock_challenge',
    message: '已解锁全部闯关关卡'
  }
}

const T = {
  loginFallback: '登录失败，暂用本地身份',
  start: '传统模式',
  editName: '修改昵称',
  leaderboard: '炼狱排行榜',
  appearance: '外观',
  tutorial: '新手教程',
  aiMode: '单人（人机）',
  funMode: '娱乐模式',
  challengeMode: '闯关模式',
  challengeSelect: '选择关卡',
  challengeLocked: '未解锁',
  onlineMode: '双人（联网）',
  localMode: '双人（本地）',
  easyAi: '普通 AI',
  hardAi: '困难 AI（连锁计算）',
  infernoAi: '炼狱 AI（搜索控链）',
  square: '方格棋盘',
  hex: '六边形棋盘（半径 3）',
  size3: '3 x 3 - 入门',
  size6: '6 x 6 - 进阶',
  size9: '9 x 9 - 专家',
  userMissing: '用户模块未初始化',
  nameUpdated: '昵称已更新',
  title: '圈地为王',
  difficulty: '选择 AI 难度',
  home: '请选择操作',
  playStyle: '选择玩法',
  mode: '选择游戏模式',
  board: '选择棋盘类型',
  leaderboardTitle: '3 x 3 炼狱通关榜',
  leaderboardTitle6: '6 x 6 炼狱通关榜',
  leaderboardTitleChallenge: '闯关排行榜',
  leaderboardEmpty: '暂无通关记录',
  leaderboardHint: '按通关前失败次数升序排列',
  leaderboardChallengeHint: '按最高关卡和评分降序排列',
  leaderboardLoading: '排行榜加载中...',
  failuresBeforeClear: '失败次数',
  challengeRankValue: '关卡',
  challengeScoreValue: '评分',
  inferno3: '3x3',
  inferno6: '6x6',
  challengeRank: '闯关',
  player: '玩家',
  loggingIn: '登录中...',
  nicknameLabel: '昵称：',
  playerIdLabel: 'PlayerID：',
  back: '返回'
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
    if (this.page === 'appearance') this.drawAppearancePanel()
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

    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.start, accentColor: this.getBrandColor(), variant: 'solid', icon: 'grid', onClick: () => { this.selectedPlayStyle = 'classic'; this.buildModeButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap), width: w, height: h, text: T.funMode, accentColor: UITheme.colors.secondary, variant: 'solid', icon: 'star', onClick: () => { this.selectedPlayStyle = 'fun'; this.buildModeButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap) * 2, width: w, height: h, text: T.challengeMode, accentColor: UITheme.colors.purple, variant: 'solid', icon: 'flag', onClick: () => this.buildChallengeSelectButtons() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap) * 3, width: w, height: h, text: T.onlineMode, accentColor: UITheme.colors.warning, variant: 'solid', icon: 'globe', onClick: () => { this.selectedPlayStyle = 'classic'; this.selectedMode = 'online'; this.selectedBoardType = 'square'; this.buildSquareSizeButtons() } }))
    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: startY + (h + gap) * 4,
      width: w,
      height: h,
      text: T.tutorial,
      accentColor: this.getBrandColor(),
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
    const quickGap = 8
    const quickW = (w - quickGap * 2) / 3
    const quickButtonY = this.bottomY(56)
    this.buttons.push(this.createCard({ x: cx - w / 2, y: quickButtonY, width: quickW, height: UITheme.menu.compactH, text: T.leaderboard, accentColor: UITheme.colors.warning, variant: 'solid', compact: true, icon: 'trophy', onClick: () => this.buildLeaderboardButtons() }))
    this.buttons.push(this.createCard({ x: cx - w / 2 + quickW + quickGap, y: quickButtonY, width: quickW, height: UITheme.menu.compactH, text: T.appearance, accentColor: UITheme.colors.primary, variant: 'solid', compact: true, icon: 'palette', onClick: () => this.buildAppearanceButtons() }))
    this.buttons.push(this.createCard({ x: cx - w / 2 + (quickW + quickGap) * 2, y: quickButtonY, width: quickW, height: UITheme.menu.compactH, text: '设置', accentColor: UITheme.colors.muted, variant: 'solid', compact: true, icon: 'gear', onClick: () => this.buildSettingsButtons() }))
  }

  buildAppearanceButtons() {
    this.page = 'appearance'
    this.buttons = []
    this.settingsControls = []
    const panel = this.getAppearancePanelRect()
    const themes = getAppearanceThemeOptions()
    const cols = 2
    const gap = 10
    const cardW = (panel.width - 28 * 2 - gap) / cols
    const rows = Math.ceil(themes.length / cols)
    const availableH = panel.y + panel.height - (panel.y + 62) - 20
    const cardH = Math.max(76, Math.min(94, (availableH - gap * (rows - 1)) / rows))
    const startX = panel.x + 28
    const startY = panel.y + 62

    themes.forEach((theme, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      this.buttons.push(this.createAppearanceThemeCard({
        x: startX + col * (cardW + gap),
        y: startY + row * (cardH + gap),
        width: cardW,
        height: cardH,
        theme,
        onClick: () => this.selectAppearanceTheme(theme.id)
      }))
    })

    this.buttons.push(this.createBackCard(() => this.buildHomeButtons()))
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
        accentColor: this.selectedLeaderboardKey === tab.key ? this.getBrandColor() : '#BBBBBB',
        compact: true,
        onClick: () => this.switchLeaderboard(tab.key)
      }))
    })
    this.buttons.push(this.createBackCard(() => this.buildHomeButtons()))

    this.refreshLeaderboard()
  }

  drawBackground() {
    const ctx = this.ctx
    const theme = getActiveAppearanceTheme()
    if (this.drawMenuBackgroundImage(ctx)) return

    ctx.fillStyle = theme.colors.background
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.save()
    this.drawThemedBackgroundPattern(theme, 0, 0, this.width, this.height, 0.24)
    ctx.restore()
  }

  drawMenuBackgroundImage(ctx) {
    const theme = getActiveAppearanceTheme()
    const image = getImageAsset((theme.background && theme.background.imageAsset) || 'menuBackground')
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
    ctx.fillStyle = theme.background.imageOverlay || 'rgba(255, 255, 255, 0.08)'
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

    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.aiMode, subText: '与 AI 对战', accentColor: this.getBrandColor(), icon: 'robot', onClick: () => this.selectAiMode() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.localMode, subText: '同屏对战', accentColor: UITheme.colors.secondary, icon: 'players', onClick: () => { this.selectedMode = 'local_2p'; this.buildBoardButtons() } }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap) * 2, width: w, height: h, text: T.onlineMode, subText: '在线匹配或邀请好友', accentColor: UITheme.colors.danger, icon: 'globe', onClick: () => { this.selectedMode = 'online'; this.selectedBoardType = 'square'; this.buildSquareSizeButtons() } }))
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

    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.square, accentColor: this.getBrandColor(), icon: 'grid', onClick: () => { this.selectedBoardType = 'square'; this.isFunModeSelected() ? this.startGame(6, 6) : this.buildSquareSizeButtons() } }))
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
      this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + index * (h + gap), width: w, height: h, text: item.text, accentColor: index === 0 ? this.getBrandColor() : UITheme.colors.secondary, icon: 'grid', onClick: () => this.startGame(item.rows, item.cols) }))
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
      this.showToast('兑换码格式无效')
      return
    }

    const redeemedCodes = this.getRedeemedCodes()
    if (redeemedCodes.includes(code)) {
      this.showToast('兑换码已使用')
      return
    }

    const reward = REDEEM_CODES[code]
    if (!reward) {
      this.showToast('兑换码无效')
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
        title: '兑换码',
        editable: true,
        placeholderText: '请输入兑换码',
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

    const cols = 4
    const rows = 5
    const perPage = cols * rows
    const maxPage = Math.max(0, Math.ceil(this.challengeLevels.length / perPage) - 1)
    this.challengeSelectPage = Math.max(0, Math.min(maxPage, page))
    const pageStart = this.challengeSelectPage * perPage
    const visibleLevels = this.challengeLevels.slice(pageStart, pageStart + perPage)
    const gap = 13
    const gridX = 34
    const gridY = this.y(274)
    const cellW = (this.width - gridX * 2 - gap * (cols - 1)) / cols
    const cellH = 62

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

    const pagerY = gridY + rows * cellH + (rows - 1) * gap + 18
    const pagerW = 92
    const pagerH = UITheme.menu.compactH
    if (this.challengeSelectPage > 0) {
      this.buttons.push(this.createCard({
        x: gridX + 8,
        y: pagerY,
        width: pagerW,
        height: pagerH,
        text: '上一页',
        accentColor: UITheme.colors.muted,
        compact: true,
        onClick: () => this.buildChallengeSelectButtons(this.challengeSelectPage - 1)
      }))
    }

    if (this.challengeSelectPage < maxPage) {
      this.buttons.push(this.createCard({
        x: this.width - gridX - pagerW - 8,
        y: pagerY,
        width: pagerW,
        height: pagerH,
        text: '下一页',
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
    const titleAssetName = this.getThemeTitleAssetName()
    const titleImage = getImageAsset(titleAssetName)
    const maxTitleWidth = Math.min(this.width - 40, 452)
    const maxTitleHeight = 213
    let titleWidth = maxTitleWidth
    let titleHeight = maxTitleWidth / 1.5

    if (titleImage && titleImage.loaded && !titleImage.failed && titleImage.width && titleImage.height) {
      const imageAspect = titleImage.width / titleImage.height
      titleWidth = Math.min(maxTitleWidth, maxTitleHeight * imageAspect)
      titleHeight = titleWidth / imageAspect
    }

    const titleX = this.width / 2 - titleWidth / 2
    const titleY = topY - 6 + Math.max(0, (maxTitleHeight - titleHeight) / 2)
    const drewTitle = drawImageAsset(ctx, titleAssetName, titleX, titleY, titleWidth, titleHeight)

    if (drewTitle) return

    drawImageAsset(ctx, 'crown', this.width / 2 - 25, topY, 50, 50)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.fillStyle = '#1B85D8'
    ctx.font = '900 44px Arial'
    ctx.fillText('圈地为王', this.width / 2, topY + 78)

    ctx.fillStyle = '#FF7A1A'
    ctx.font = '900 26px Arial'
    ctx.fillText('点格棋', this.width / 2, topY + 120)
  }

  getThemeTitleAssetName() {
    const themeId = (getActiveAppearanceTheme() && getActiveAppearanceTheme().id) || 'minimal'
    if (themeId === 'minimal') return 'titleThemeMinimal'
    if (themeId === 'mechanical') return 'titleThemeMechanical'
    if (themeId === 'steampunk') return 'titleThemeSteampunk'
    if (themeId === 'black-gold') return 'titleThemeBlackGold'
    if (themeId === 'cartoon') return 'titleThemeCartoon'
    if (themeId === 'guofeng') return 'titleThemeGuofeng'
    if (themeId === 'handdrawn') return 'titleThemeHanddrawn'
    if (themeId === 'panda') return 'titleThemePanda'
    return 'titleThemeMinimal'
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

    this.drawAvatar(ctx, x + 18, y + h / 2, this.getBrandColor())
    ctx.fillStyle = this.getTextColor()
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
    const colors = this.getActiveColors()

    this.drawThemePanelShell(ctx, x, y, w, h, colors.warning)

    ctx.fillStyle = this.getTextColor()
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, this.getLeaderboardTitle(), x + 18, y + 30, w - 36, 18, 12, 'bold', 'left')

    ctx.fillStyle = colors.muted
    this.drawFittedText(ctx, this.isChallengeLeaderboard() ? T.leaderboardChallengeHint : T.leaderboardHint, x + 18, y + 54, w - 36, 12, 9, '', 'left')

    if (this.leaderboardLoading && records.length === 0) {
      ctx.fillStyle = colors.muted
      ctx.font = '15px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(T.leaderboardLoading, this.width / 2, y + h / 2 + 20)
      return
    }

    if (records.length === 0) {
      ctx.fillStyle = colors.muted
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

      this.drawThemeListRow(ctx, x + 10, rowY - 14, w - 20, rowH - 2, index)

      ctx.fillStyle = this.getBrandColor()
      ctx.font = 'bold 14px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(`${rank}.`, x + 18, rowY + 1)

      ctx.fillStyle = colors.muted
      ctx.font = '13px Arial'
      ctx.textAlign = 'right'
      const rightText = this.isChallengeLeaderboard()
        ? `${T.challengeRankValue} ${record.bestLevel || 0}  ${T.challengeScoreValue} ${record.bestScore || 0}`
        : `${T.failuresBeforeClear} ${failures}`
      const rightMaxW = this.isChallengeLeaderboard() ? 128 : 92
      this.drawFittedText(ctx, rightText, x + w - 18, rowY + 1, rightMaxW, 13, 9, '', 'right')

      ctx.fillStyle = this.getTextColor()
      const nameMaxW = Math.max(70, w - 86 - rightMaxW)
      this.drawFittedText(ctx, record.nickname || T.player, x + 50, rowY + 1, nameMaxW, 14, 9, 'bold', 'left')
    })
  }

  drawChallengeSelect() {
    const ctx = this.ctx
    const x = 20
    const y = this.y(202)
    const w = this.width - 40
    const h = Math.min(510, this.bottomY(56) - y)
    const colors = this.getActiveColors()

    this.drawThemePanelShell(ctx, x, y, w, h, colors.purple)

    ctx.fillStyle = this.getTextColor()
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, T.challengeSelect, x + 18, y + 30, w - 36, 18, 12, 'bold', 'left')

    ctx.fillStyle = colors.muted
    const cols = 4
    const rows = 5
    const perPage = cols * rows
    const maxPage = Math.max(0, Math.ceil((this.challengeLevels.length || 99) / perPage) - 1)
    const pageText = `${this.challengeSelectPage + 1}/${maxPage + 1}`
    const progressW = Math.min(210, Math.max(150, w * 0.46))
    const progressX = x + w - 18 - progressW
    const progressY = y + 51
    const hintMaxW = Math.max(104, progressX - (x + 18) - 14)
    this.drawFittedText(ctx, `已解锁 ${this.unlockedChallengeLevel}/${this.challengeLevels.length || 99}  第 ${pageText} 页`, x + 18, y + 54, hintMaxW, 12, 9, '', 'left')

    const ratio = Math.max(0, Math.min(1, this.unlockedChallengeLevel / (this.challengeLevels.length || 99)))
    this.roundRect(ctx, progressX, progressY, progressW, 6, 3)
    ctx.fillStyle = colors.line
    ctx.fill()
    this.roundRect(ctx, progressX, progressY, progressW * ratio, 6, 3)
    ctx.fillStyle = colors.purple
    ctx.fill()
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
        text: '修改昵称',
        accentColor: UITheme.colors.primary,
        onClick: () => this.changeNickname()
      }),
      this.createActionControl({
        x: panel.x + 36,
        y: panel.y + 314,
        width: controlW,
        height: 38,
        text: '兑换码',
        accentColor: UITheme.colors.secondary,
        onClick: () => this.redeemCode()
      }),
      this.createActionControl({
        x: panel.x + 36,
        y: panel.y + 362,
        width: controlW,
        height: 38,
        text: '测试音效和振动',
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
    const colors = this.getActiveColors()

    ctx.save()
    this.drawThemePanelShell(ctx, panel.x, panel.y, panel.width, panel.height, colors.primary)

    ctx.fillStyle = colors.text
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, '设置', panel.x + 24, panel.y + 34, panel.width - 48, 20, 14, 'bold', 'left')
    this.drawSettingsLabel('音效', '', panel.y + 92)
    this.drawSettingsLabel('音量', `${Math.round(settings.volume * 100)}%`, panel.y + 128)
    this.drawSettingsLabel('振动', '', panel.y + 222)

    for (const control of this.settingsControls) {
      control.draw(ctx)
    }

    ctx.restore()
  }

  selectAppearanceTheme(themeId) {
    updateGameSettings({ appearanceThemeId: themeId })
    this.showToast('外观已切换')
    this.buildAppearanceButtons()
  }

  drawAppearancePanel() {
    const ctx = this.ctx
    const panel = this.getAppearancePanelRect()
    const active = getActiveAppearanceTheme()

    ctx.save()
    this.roundRect(ctx, panel.x, panel.y, panel.width, panel.height, UITheme.radius.lg)
    ctx.fillStyle = active.colors.surface
    ctx.fill()
    ctx.strokeStyle = active.colors.line
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = active.colors.text
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, '外观方案', panel.x + 24, panel.y + 34, panel.width - 48, 20, 14, 'bold', 'left')
    ctx.fillStyle = active.colors.muted
    this.drawFittedText(ctx, active.philosophy, panel.x + panel.width - 24, panel.y + 34, 150, 11, 9, '', 'right')
    ctx.restore()
  }

  getAppearancePanelRect() {
    const width = Math.min(this.width - 28, 360)
    const top = Math.max(this.safeLayout.top + 54, this.y(78))
    const bottom = this.bottomY(72)

    return {
      x: (this.width - width) / 2,
      y: top,
      width,
      height: Math.max(320, bottom - top)
    }
  }

  createAppearanceThemeCard({ x, y, width, height, theme, onClick }) {
    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },
      click() {
        SoundEffects.play('button')
        onClick()
      },
      draw: ctx => {
        const active = getActiveAppearanceTheme().id === theme.id
        ctx.save()
        this.roundRect(ctx, x, y, width, height, UITheme.radius.md)
        ctx.fillStyle = theme.colors.surface
        ctx.fill()
        ctx.strokeStyle = active ? theme.colors.warning : theme.colors.line
        ctx.lineWidth = active ? 2 : 1
        ctx.stroke()

        ctx.save()
        this.roundRect(ctx, x + 8, y + 8, width - 16, 38, 6)
        ctx.clip()
        ctx.fillStyle = theme.colors.background
        ctx.fillRect(x + 8, y + 8, width - 16, 38)
        this.drawThemedBackgroundPattern(theme, x + 8, y + 8, width - 16, 38, 0.34)
        this.drawThemePreviewBoard(ctx, theme, x + width - 56, y + 15, 36)
        ctx.restore()

        this.drawThemeSwatches(ctx, theme, x + 12, y + 55)
        this.drawThemeButtonPreview(ctx, theme, x + width - 55, y + 53, 40, 18)

        ctx.fillStyle = theme.colors.text
        this.drawFittedText(ctx, theme.name, x + 12, y + height - 17, width - 44, 13, 9, 'bold', 'left')
        if (active) {
          ctx.fillStyle = theme.colors.warning
          ctx.font = 'bold 14px Arial'
          ctx.textAlign = 'right'
          ctx.textBaseline = 'middle'
          ctx.fillText('✓', x + width - 14, y + height - 17)
        }
        ctx.restore()
      }
    }
  }

  drawThemeSwatches(ctx, theme, x, y) {
    const colors = [theme.colors.primary, theme.colors.secondary, theme.colors.warning, theme.colors.danger]
    colors.forEach((color, index) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x + index * 14, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  drawThemePreviewBoard(ctx, theme, x, y, size) {
    const step = size / 2
    ctx.save()
    ctx.strokeStyle = theme.board.emptyEdge
    ctx.lineWidth = Math.max(2, theme.board.emptyWidth)
    ctx.lineCap = 'round'
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(x, y + i * step)
      ctx.lineTo(x + size, y + i * step)
      ctx.moveTo(x + i * step, y)
      ctx.lineTo(x + i * step, y + size)
      ctx.stroke()
    }

    ctx.globalAlpha = theme.board.cellAlpha
    ctx.fillStyle = theme.colors.p1
    this.roundRect(ctx, x + 3, y + 3, step - 6, step - 6, 4)
    ctx.fill()
    ctx.fillStyle = theme.colors.p2
    this.roundRect(ctx, x + step + 3, y + step + 3, step - 6, step - 6, 4)
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.strokeStyle = theme.colors.p1
    ctx.lineWidth = theme.board.claimedWidth
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + step, y)
    ctx.stroke()
    ctx.strokeStyle = theme.colors.p2
    ctx.beginPath()
    ctx.moveTo(x + step, y + size)
    ctx.lineTo(x + size, y + size)
    ctx.stroke()

    ctx.fillStyle = theme.board.dot
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 2; col++) {
        ctx.beginPath()
        ctx.arc(x + col * step, y + row * step, Math.max(2.5, theme.board.dotRadius * 0.55), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  drawThemeButtonPreview(ctx, theme, x, y, width, height) {
    this.drawThemeButtonShell(ctx, {
      x,
      y,
      width,
      height,
      color: theme.colors.primary,
      solid: true,
      compact: true,
      themeOverride: theme
    })
  }

  drawSettingsLabel(label, value, y) {
    const ctx = this.ctx
    const panel = this.getSettingsPanelRect()
    const colors = this.getActiveColors()

    ctx.fillStyle = colors.text
    this.drawFittedText(ctx, label, panel.x + 36, y, panel.width - 150, 15, 10, 'bold', 'left')
    if (!value) return

    ctx.fillStyle = colors.muted
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
        const colors = this.getActiveColors()
        ctx.save()
        this.roundRect(ctx, x, y, width, height, height / 2)
        ctx.fillStyle = enabled ? colors.primary : colors.disabled
        ctx.fill()
        ctx.strokeStyle = enabled ? this.lighten(colors.primary, 0.16) : colors.line
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = colors.surface
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
        const colors = this.getActiveColors()
        const barY = y + height / 2
        ctx.save()
        this.roundRect(ctx, x, barY - 4, width, 8, 4)
        ctx.fillStyle = colors.line
        ctx.fill()
        this.roundRect(ctx, x, barY - 4, width * value, 8, 4)
        ctx.fillStyle = colors.primary
        ctx.fill()
        ctx.fillStyle = colors.surface
        ctx.strokeStyle = colors.primary
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
        const color = this.resolveThemeColor(accentColor)
        ctx.save()
        this.drawThemeButtonShell(ctx, { x, y, width, height, color, solid: false, compact: true })
        ctx.fillStyle = color === this.getActiveColors().warning ? this.getActiveColors().text : color
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

  drawFittedText(ctx, text, x, y, maxWidth, fontSize, minFontSize = 10, weight = 'bold', align = 'center', stroke = false) {
    const safeText = `${text}`
    let size = fontSize
    const fontWeight = weight ? `${weight} ` : ''

    while (size > minFontSize) {
      ctx.font = `${fontWeight}${size}px Arial`
      if (ctx.measureText(safeText).width <= maxWidth) break
      size -= 1
    }

    ctx.textAlign = align
    if (stroke) {
      const fillStyle = ctx.fillStyle
      const strokeStyle = this.getAdaptiveTextStrokeStyle(fillStyle)
      ctx.save()
      if (strokeStyle) {
        ctx.lineJoin = 'round'
        ctx.lineWidth = Math.max(2, Math.ceil(size * 0.16))
        ctx.strokeStyle = strokeStyle
        ctx.strokeText(safeText, x, y)
      }
      ctx.restore()
      ctx.fillStyle = fillStyle
    }
    ctx.fillText(safeText, x, y)
  }

  drawThemePanelShell(ctx, x, y, width, height, accentColor) {
    const theme = getActiveAppearanceTheme()
    const colors = theme.colors
    const style = theme.buttonStyle || 'minimal'
    const radius = style === 'mechanical' || style === 'black-gold'
      ? Math.min(6, UITheme.radius.md)
      : style === 'cartoon' || style === 'panda'
        ? Math.min(14, UITheme.radius.lg)
        : UITheme.radius.lg

    ctx.save()
    this.drawThemeButtonShell(ctx, {
      x,
      y,
      width,
      height,
      color: accentColor,
      solid: false,
      compact: false,
      themeOverride: theme
    })

    this.roundRect(ctx, x + 7, y + 7, width - 14, height - 14, Math.max(4, radius - 2))
    ctx.fillStyle = this.withAlpha(colors.surface, style === 'black-gold' ? 0.86 : 0.92)
    ctx.fill()
    ctx.strokeStyle = this.withAlpha(accentColor, style === 'minimal' ? 0.18 : 0.32)
    ctx.lineWidth = 1
    ctx.stroke()

    if (style === 'mechanical') {
      ctx.strokeStyle = this.withAlpha(accentColor, 0.58)
      ctx.lineWidth = 2
      const cut = 18
      ;[[x + 14, y + 14, 1, 1], [x + width - 14, y + 14, -1, 1], [x + 14, y + height - 14, 1, -1], [x + width - 14, y + height - 14, -1, -1]].forEach(([px, py, sx, sy]) => {
        ctx.beginPath()
        ctx.moveTo(px, py + sy * cut)
        ctx.lineTo(px, py)
        ctx.lineTo(px + sx * cut, py)
        ctx.stroke()
      })
    } else if (style === 'steampunk') {
      ctx.fillStyle = colors.warning
      ;[[x + 18, y + 18], [x + width - 18, y + 18], [x + 18, y + height - 18], [x + width - 18, y + height - 18]].forEach(([px, py]) => {
        ctx.beginPath()
        ctx.arc(px, py, 3, 0, Math.PI * 2)
        ctx.fill()
      })
    } else if (style === 'black-gold') {
      ctx.strokeStyle = this.withAlpha(colors.warning, 0.5)
      ctx.lineWidth = 1
      this.roundRect(ctx, x + 12, y + 12, width - 24, height - 24, Math.max(2, radius - 2))
      ctx.stroke()
    } else if (style === 'cartoon') {
      ctx.fillStyle = this.withAlpha('#FFFFFF', 0.32)
      this.roundRect(ctx, x + 18, y + 14, width - 36, 8, 4)
      ctx.fill()
    } else if (style === 'handdrawn') {
      ctx.strokeStyle = this.withAlpha(accentColor, 0.42)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(x + 18, y + 17)
      ctx.quadraticCurveTo(x + width * 0.28, y + 9, x + width - 18, y + 19)
      ctx.moveTo(x + 18, y + height - 18)
      ctx.quadraticCurveTo(x + width * 0.62, y + height - 8, x + width - 20, y + height - 17)
      ctx.stroke()
    } else if (style === 'panda') {
      ctx.strokeStyle = this.withAlpha(colors.secondary, 0.5)
      ctx.lineWidth = 2
      for (let px = x + 28; px < x + width - 20; px += 38) {
        ctx.beginPath()
        ctx.moveTo(px, y + 14)
        ctx.lineTo(px - 5, y + height - 14)
        ctx.stroke()
      }
    } else if (style === 'guofeng') {
      ctx.strokeStyle = this.withAlpha(accentColor, 0.42)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(x + 24, y + 18)
      ctx.quadraticCurveTo(x + width * 0.5, y + 5, x + width - 24, y + 18)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + 24, y + height - 18)
      ctx.quadraticCurveTo(x + width * 0.5, y + height - 5, x + width - 24, y + height - 18)
      ctx.stroke()
    }
    ctx.restore()
  }

  drawThemeListRow(ctx, x, y, width, height, index) {
    const colors = this.getActiveColors()
    const accent = index < 3 ? colors.warning : colors.primary

    ctx.save()
    this.drawThemeButtonShell(ctx, {
      x,
      y,
      width,
      height,
      color: accent,
      solid: false,
      compact: true
    })
    ctx.globalAlpha = index % 2 === 0 ? 0.5 : 0.22
    ctx.fillStyle = index % 2 === 0 ? this.getCardFill(colors.primary) : colors.surface
    this.roundRect(ctx, x + 3, y + 3, width - 6, height - 6, 5)
    ctx.fill()
    ctx.restore()
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
        const color = this.resolveThemeColor(accentColor)
        ctx.save()
        this.drawThemeButtonShell(ctx, { x, y, width, height, color, solid: variant === 'solid', compact })
        if (variant === 'solid') {
          const textColor = this.getSolidButtonTextColor()
          this.drawCardIcon(ctx, icon, x + 30, y + height / 2, 16, textColor)
          ctx.fillStyle = textColor
          ctx.textBaseline = 'middle'
          this.drawFittedText(ctx, text, x + width / 2 + (icon ? 8 : 0), y + height / 2, width - (icon ? 84 : 24), compact ? UITheme.menu.compactFont : UITheme.menu.itemFont, compact ? 9 : 12, 'bold', 'center', true)
        } else {
          const hasSideIcon = !compact && icon
          if (hasSideIcon) {
            this.drawCardIcon(ctx, icon, x + 38, y + height / 2, Math.min(24, height * 0.32), color)
          }
          ctx.fillStyle = this.getReadableCardTextColor(color, compact)
          ctx.textBaseline = 'middle'
          const textX = hasSideIcon ? x + 74 : x + width / 2
          const textMaxW = hasSideIcon ? width - 92 : width - 18
          const textAlign = hasSideIcon ? 'left' : 'center'
          this.drawFittedText(ctx, text, textX, y + height / 2 - (subText ? 8 : 0), textMaxW, compact ? UITheme.menu.compactFont : UITheme.menu.itemFont, compact ? 9 : 12, 'bold', textAlign, true)
          if (subText) {
            ctx.fillStyle = this.getActiveColors().muted
            this.drawFittedText(ctx, subText, x + 74, y + height / 2 + 15, width - 92, UITheme.menu.subFont, 9, '', 'left', true)
          }
        }
        ctx.restore()
      }
    }
  }

  createBackCard(onClick) {
    return this.createCard({ x: UITheme.menu.pageX, y: this.safeLayout.top, width: UITheme.menu.backW, height: UITheme.menu.backH, text: '‹', accentColor: UITheme.colors.text, compact: true, onClick })
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
        const colors = this.getActiveColors()
        const color = unlocked ? this.getChallengeLevelAccent(level.aiDifficulty) : colors.disabled
        const textColor = unlocked ? colors.text : colors.muted
        ctx.save()
        this.drawThemeButtonShell(ctx, { x, y, width, height, color, solid: false, compact: true })
        ctx.globalAlpha = unlocked ? 0.5 : 0.22
        ctx.fillStyle = unlocked ? this.getCardFill(color) : colors.surfaceTint
        this.roundRect(ctx, x + 3, y + 3, width - 6, height - 6, 5)
        ctx.fill()
        ctx.globalAlpha = 1

        ctx.fillStyle = textColor
        ctx.font = 'bold 19px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${level.index}`, x + width / 2, y + height / 2 - 10)

        if (!unlocked) {
          ctx.strokeStyle = colors.warning
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.arc(x + 15, y + 17, 4.5, Math.PI, Math.PI * 2)
          ctx.stroke()
          this.roundRect(ctx, x + 10.5, y + 17, 9, 7, 2)
          ctx.fillStyle = colors.warning
          ctx.fill()
        }

        ctx.fillStyle = unlocked ? colors.muted : colors.disabled
        ctx.font = '11px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(this.getAiDifficultyShortLabel(level.aiDifficulty), x + width / 2, y + height / 2 + 15)
        ctx.restore()
      }
    }
  }

  getAiDifficultyShortLabel(difficulty) {
    if (difficulty === 'inferno') return '炼狱'
    if (difficulty === 'hard') return '困难'
    return '普通'
  }

  getChallengeLevelAccent(difficulty) {
    const colors = this.getActiveColors()
    if (difficulty === 'inferno') return colors.danger
    if (difficulty === 'hard') return colors.warning
    return colors.purple
  }

  getCardFill(accentColor) {
    const colors = this.getActiveColors()
    if (accentColor === colors.danger) return colors.dangerLight
    if (accentColor === colors.secondary) return colors.secondaryLight
    if (accentColor === colors.purple) return colors.purpleLight
    if (accentColor === colors.warning) return colors.warningLight
    return colors.surface
  }

  getReadableCardTextColor(accentColor, compact = false) {
    const colors = this.getActiveColors()
    if (compact || accentColor === colors.warning) return colors.text
    return accentColor
  }

  getSolidButtonTextColor() {
    const style = getActiveAppearanceTheme().buttonStyle
    if (style === 'cartoon') return '#FFFFFF'
    if (style === 'guofeng') return '#FFFDF6'
    return '#FFFFFF'
  }

  drawThemeButtonShell(ctx, { x, y, width, height, color, solid = false, compact = false, themeOverride = null }) {
    const theme = themeOverride || getActiveAppearanceTheme()
    const style = theme.buttonStyle || 'minimal'
    const colors = theme.colors
    const radius = style === 'mechanical' || style === 'black-gold'
      ? Math.min(5, UITheme.radius.md)
      : style === 'cartoon' || style === 'panda'
        ? Math.min(12, height / 3)
        : UITheme.radius.md

    ctx.save()

    if (style === 'mechanical') {
      this.drawMechanicalButton(ctx, { x, y, width, height, color, solid, radius, compact, theme })
    } else if (style === 'steampunk') {
      this.drawSteampunkButton(ctx, { x, y, width, height, color, solid, radius, compact, theme })
    } else if (style === 'black-gold') {
      this.drawBlackGoldButton(ctx, { x, y, width, height, color, solid, radius, compact, theme })
    } else if (style === 'cartoon') {
      this.drawCartoonButton(ctx, { x, y, width, height, color, solid, radius, compact, theme })
    } else if (style === 'guofeng') {
      this.drawGuofengButton(ctx, { x, y, width, height, color, solid, radius, compact, theme })
    } else if (style === 'handdrawn') {
      this.drawHanddrawnButton(ctx, { x, y, width, height, color, solid, radius, compact, theme })
    } else if (style === 'panda') {
      this.drawPandaButton(ctx, { x, y, width, height, color, solid, radius, compact, theme })
    } else {
      this.drawMinimalButton(ctx, { x, y, width, height, color, solid, radius, compact, theme })
    }

    if (!compact && solid) {
      ctx.globalAlpha = 0.22
      ctx.fillStyle = '#FFFFFF'
      this.roundRect(ctx, x + 10, y + 8, width - 20, Math.max(2, height * 0.08), Math.max(1, radius / 2))
      ctx.fill()
    }

    ctx.restore()
  }

  drawMinimalButton(ctx, { x, y, width, height, color, solid, radius }) {
    this.roundRect(ctx, x, y, width, height, radius)
    if (solid) {
      const gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, this.darken(color, 0.12))
      ctx.fillStyle = gradient
      ctx.fill()
    } else {
      ctx.fillStyle = this.getCardFill(color)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.4
      ctx.stroke()
    }
  }

  drawMechanicalButton(ctx, { x, y, width, height, color, solid, radius, theme }) {
    const colors = theme.colors
    this.cutCornerRect(ctx, x, y, width, height, Math.min(10, height * 0.18))
    const gradient = ctx.createLinearGradient(x, y, x, y + height)
    gradient.addColorStop(0, solid ? this.lighten(color, 0.1) : colors.surfaceTint)
    gradient.addColorStop(0.52, solid ? color : colors.surface)
    gradient.addColorStop(1, solid ? this.darken(color, 0.24) : colors.surfaceTint)
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.strokeStyle = solid ? this.lighten(color, 0.25) : color
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.strokeStyle = this.withAlpha('#FFFFFF', 0.18)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 12, y + height - 8)
    ctx.lineTo(x + width - 12, y + height - 8)
    ctx.stroke()
    ctx.fillStyle = solid ? this.withAlpha('#FFFFFF', 0.42) : color
    ;[[x + 12, y + 12], [x + width - 12, y + 12], [x + 12, y + height - 12], [x + width - 12, y + height - 12]].forEach(([px, py]) => {
      ctx.beginPath()
      ctx.arc(px, py, radius * 0.38, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  drawSteampunkButton(ctx, { x, y, width, height, color, solid, radius, theme }) {
    const colors = theme.colors
    this.roundRect(ctx, x, y, width, height, radius)
    const gradient = ctx.createLinearGradient(x, y, x, y + height)
    gradient.addColorStop(0, solid ? this.lighten(color, 0.2) : colors.surfaceTint)
    gradient.addColorStop(0.48, solid ? color : colors.surface)
    gradient.addColorStop(1, solid ? this.darken(color, 0.28) : colors.primaryLight)
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.strokeStyle = colors.warning
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = this.withAlpha('#000000', 0.28)
    ctx.lineWidth = 1
    this.roundRect(ctx, x + 5, y + 5, width - 10, height - 10, Math.max(3, radius - 2))
    ctx.stroke()
    ctx.fillStyle = colors.warning
    for (let px = x + 14; px <= x + width - 14; px += Math.max(22, width / 6)) {
      ctx.beginPath()
      ctx.arc(px, y + height - 8, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  drawBlackGoldButton(ctx, { x, y, width, height, color, solid, radius, theme }) {
    const colors = theme.colors
    this.roundRect(ctx, x, y, width, height, radius)
    const gradient = ctx.createLinearGradient(x, y, x, y + height)
    gradient.addColorStop(0, solid ? this.lighten(color, 0.12) : '#211B10')
    gradient.addColorStop(0.45, solid ? color : '#15120B')
    gradient.addColorStop(1, solid ? this.darken(color, 0.42) : '#080808')
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.strokeStyle = colors.warning
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = this.withAlpha('#FFF6D8', 0.26)
    ctx.lineWidth = 1
    this.roundRect(ctx, x + 4, y + 4, width - 8, height - 8, Math.max(2, radius - 1))
    ctx.stroke()
  }

  drawCartoonButton(ctx, { x, y, width, height, color, solid, radius, theme }) {
    const colors = theme.colors
    this.roundRect(ctx, x, y + 3, width, height, radius)
    ctx.fillStyle = this.darken(color, solid ? 0.32 : 0.18)
    ctx.fill()
    this.roundRect(ctx, x, y, width, height - 3, radius)
    ctx.fillStyle = solid ? color : this.getCardFill(color)
    ctx.fill()
    ctx.strokeStyle = colors.text
    ctx.lineWidth = 2.4
    ctx.stroke()
    ctx.fillStyle = this.withAlpha('#FFFFFF', solid ? 0.35 : 0.6)
    this.roundRect(ctx, x + 12, y + 8, width - 24, Math.max(5, height * 0.14), 5)
    ctx.fill()
  }

  drawGuofengButton(ctx, { x, y, width, height, color, solid, radius, theme }) {
    const colors = theme.colors
    this.roundRect(ctx, x, y, width, height, radius)
    ctx.fillStyle = solid ? color : colors.surface
    ctx.fill()
    ctx.strokeStyle = solid ? colors.warning : color
    ctx.lineWidth = solid ? 1.8 : 1.4
    ctx.stroke()
    ctx.strokeStyle = this.withAlpha(solid ? '#FFFDF6' : color, 0.45)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + 10, y + 8)
    ctx.quadraticCurveTo(x + width * 0.5, y + 2, x + width - 10, y + 8)
    ctx.stroke()
    ctx.fillStyle = this.withAlpha(colors.warning, solid ? 0.4 : 0.22)
    ctx.beginPath()
    ctx.arc(x + width - 16, y + height / 2, Math.min(7, height * 0.18), 0, Math.PI * 2)
    ctx.fill()
  }

  drawHanddrawnButton(ctx, { x, y, width, height, color, solid, radius, compact, theme }) {
    const colors = theme.colors
    const paper = solid ? this.lighten(color, 0.08) : colors.surface
    const ink = solid ? this.darken(color, 0.34) : color
    const shade = solid ? this.darken(color, 0.22) : colors.surfaceTint

    this.drawSketchBlob(ctx, x + 3, y + 4, width - 3, height - 2, radius, [
      [0, 1], [1, 0], [-1, 1], [0, -1]
    ])
    ctx.fillStyle = this.withAlpha(colors.text, 0.14)
    ctx.fill()

    this.drawSketchBlob(ctx, x, y, width - 2, height - 2, radius, [
      [0, 0], [2, -1], [-1, 1], [1, 2]
    ])
    ctx.fillStyle = paper
    ctx.fill()

    if (solid) {
      ctx.fillStyle = this.withAlpha('#FFFFFF', 0.18)
      this.drawSketchBlob(ctx, x + 7, y + 6, width - 16, Math.max(7, height * 0.18), 5, [
        [0, 0], [1, -1], [-1, 0], [1, 1]
      ])
      ctx.fill()
    } else {
      ctx.fillStyle = this.withAlpha(shade, 0.58)
      this.drawSketchBlob(ctx, x + 7, y + 6, width - 16, height - 13, Math.max(5, radius - 4), [
        [0, 0], [1, -1], [-1, 1], [0, 1]
      ])
      ctx.fill()
    }

    ctx.strokeStyle = ink
    ctx.lineWidth = solid ? 2.8 : 2.2
    this.drawSketchBlob(ctx, x, y, width - 2, height - 2, radius, [
      [0, 0], [2, -1], [-1, 1], [1, 2]
    ])
    ctx.stroke()
    ctx.strokeStyle = this.withAlpha(colors.text, solid ? 0.36 : 0.26)
    ctx.lineWidth = 1.1
    this.drawSketchBlob(ctx, x + 2, y + 2, width - 5, height - 5, Math.max(3, radius - 3), [
      [1, -1], [-1, 0], [0, 1], [2, 0]
    ])
    ctx.stroke()

    ctx.strokeStyle = this.withAlpha(solid ? '#FFFFFF' : colors.warning, solid ? 0.48 : 0.56)
    ctx.lineWidth = Math.max(2, height * 0.08)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + width * 0.18, y + height - 10)
    ctx.quadraticCurveTo(x + width * 0.48, y + height - 15, x + width * 0.82, y + height - 11)
    ctx.stroke()

    ctx.strokeStyle = this.withAlpha(colors.text, 0.18)
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      const yy = y + 10 + i * Math.max(6, height * 0.18)
      ctx.beginPath()
      ctx.moveTo(x + 12, yy)
      ctx.quadraticCurveTo(x + width * 0.42, yy - 3 + i, x + width - 13, yy + 1)
      ctx.stroke()
    }

    if (!compact) {
      const tapeW = Math.min(34, width * 0.18)
      const tapeH = Math.min(13, height * 0.24)
      ctx.fillStyle = this.withAlpha(colors.warningLight, 0.78)
      this.drawSketchBlob(ctx, x + width - tapeW - 9, y - 3, tapeW, tapeH, 3, [
        [0, 0], [1, -1], [-1, 0], [1, 1]
      ])
      ctx.fill()
      ctx.strokeStyle = this.withAlpha(colors.text, 0.18)
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  drawSketchBlob(ctx, x, y, width, height, radius, jitter) {
    const r = Math.min(radius, width / 2, height / 2)
    const j = jitter || [[0, 0], [0, 0], [0, 0], [0, 0]]
    ctx.beginPath()
    ctx.moveTo(x + r + j[0][0], y + j[0][1])
    ctx.lineTo(x + width - r + j[1][0], y + j[1][1])
    ctx.quadraticCurveTo(x + width + j[1][0], y + j[1][1], x + width + j[1][0], y + r + j[1][1])
    ctx.lineTo(x + width + j[2][0], y + height - r + j[2][1])
    ctx.quadraticCurveTo(x + width + j[2][0], y + height + j[2][1], x + width - r + j[2][0], y + height + j[2][1])
    ctx.lineTo(x + r + j[3][0], y + height + j[3][1])
    ctx.quadraticCurveTo(x + j[3][0], y + height + j[3][1], x + j[3][0], y + height - r + j[3][1])
    ctx.lineTo(x + j[0][0], y + r + j[0][1])
    ctx.quadraticCurveTo(x + j[0][0], y + j[0][1], x + r + j[0][0], y + j[0][1])
    ctx.closePath()
  }

  drawPandaButton(ctx, { x, y, width, height, color, solid, radius, compact, theme }) {
    const colors = theme.colors
    this.roundRect(ctx, x, y + 3, width, height, radius)
    ctx.fillStyle = this.withAlpha(colors.dot, solid ? 0.22 : 0.12)
    ctx.fill()
    this.roundRect(ctx, x, y, width, height - 3, radius)
    ctx.fillStyle = solid ? color : colors.surface
    ctx.fill()
    ctx.strokeStyle = colors.dot
    ctx.lineWidth = 2.2
    ctx.stroke()
    ctx.strokeStyle = solid ? this.withAlpha('#FFFFFF', 0.55) : colors.secondary
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + 14, y + height - 10)
    ctx.quadraticCurveTo(x + width * 0.5, y + height - 18, x + width - 14, y + height - 10)
    ctx.stroke()
    if (!compact) {
      ctx.fillStyle = solid ? '#FFFFFF' : colors.primaryLight
      ctx.beginPath()
      ctx.arc(x + width - 20, y + 18, Math.min(8, height * 0.18), 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = colors.dot
      ctx.beginPath()
      ctx.arc(x + width - 23, y + 17, 1.5, 0, Math.PI * 2)
      ctx.arc(x + width - 17, y + 17, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
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
    ctx.fillText('‹', 32, y)
  }

  getPageTitle() {
    const map = {
      mode: T.playStyle,
      difficulty: T.difficulty,
      board: T.board,
      leaderboard: this.getLeaderboardTitle(),
      'challenge-select': T.challengeSelect,
      settings: '设置',
      appearance: T.appearance
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
    } else if (icon === 'palette') {
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.stroke()
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 3 + i * Math.PI / 3
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * size * 0.42, y + Math.sin(a) * size * 0.35, size * 0.16, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(x + size * 0.38, y + size * 0.38, size * 0.18, 0, Math.PI * 2)
      ctx.fillStyle = this.getActiveColors().surface
      ctx.fill()
    } else if (icon === 'book' || icon === 'edit' || icon === 'gear') {
      ctx.font = `bold ${size * 1.4}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const text = icon === 'book' ? '?' : icon === 'edit' ? '✎' : '⚙'
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

  lighten(hex, amount) {
    const raw = hex.replace('#', '')
    const num = parseInt(raw, 16)
    const r = Math.min(255, Math.floor(((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * amount))
    const g = Math.min(255, Math.floor(((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * amount))
    const b = Math.min(255, Math.floor((num & 255) + (255 - (num & 255)) * amount))
    return `rgb(${r}, ${g}, ${b})`
  }

  withAlpha(color, alpha) {
    if (typeof color !== 'string') return `rgba(0,0,0,${alpha})`
    if (color.startsWith('rgba')) return color
    if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
    if (!color.startsWith('#')) return color

    const raw = color.slice(1)
    if (raw.length !== 6) return color
    const num = parseInt(raw, 16)
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`
  }

  getAdaptiveTextStrokeStyle(color) {
    const luminance = this.getColorLuminance(color)
    if (luminance === null) return null
    if (luminance >= 0.78) return 'rgba(0, 0, 0, 0.82)'
    if (luminance <= 0.34) return 'rgba(255, 255, 255, 0.88)'
    return null
  }

  getColorLuminance(color) {
    const rgb = this.parseColorToRgb(color)
    if (!rgb) return null
    const [r, g, b] = rgb.map(value => {
      const normalized = value / 255
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  parseColorToRgb(color) {
    if (typeof color !== 'string') return null
    const value = color.trim()
    if (value.startsWith('#')) {
      const raw = value.slice(1)
      if (raw.length !== 6) return null
      const num = parseInt(raw, 16)
      if (Number.isNaN(num)) return null
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
    }
    const rgbaMatch = value.match(/^rgba?\(([^)]+)\)$/i)
    if (!rgbaMatch) return null
    const parts = rgbaMatch[1].split(',').map(part => Number.parseFloat(part.trim()))
    if (parts.length < 3 || parts.slice(0, 3).some(part => Number.isNaN(part))) return null
    return parts.slice(0, 3).map(part => Math.max(0, Math.min(255, part)))
  }

  cutCornerRect(ctx, x, y, width, height, cut) {
    ctx.beginPath()
    ctx.moveTo(x + cut, y)
    ctx.lineTo(x + width - cut, y)
    ctx.lineTo(x + width, y + cut)
    ctx.lineTo(x + width, y + height - cut)
    ctx.lineTo(x + width - cut, y + height)
    ctx.lineTo(x + cut, y + height)
    ctx.lineTo(x, y + height - cut)
    ctx.lineTo(x, y + cut)
    ctx.closePath()
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

  getActiveColors() {
    return getActiveAppearanceTheme().colors
  }

  getBrandColor() {
    return this.getActiveColors().primary
  }

  getDangerColor() {
    return this.getActiveColors().danger
  }

  getTextColor() {
    return this.getActiveColors().text
  }

  resolveThemeColor(color) {
    const colors = this.getActiveColors()
    const map = {
      [UITheme.colors.primary]: colors.primary,
      [UITheme.colors.secondary]: colors.secondary,
      [UITheme.colors.warning]: colors.warning,
      [UITheme.colors.danger]: colors.danger,
      [UITheme.colors.purple]: colors.purple,
      [UITheme.colors.muted]: colors.muted,
      [UITheme.colors.text]: colors.text,
      [UITheme.colors.disabled]: colors.disabled
    }

    return map[color] || color
  }

  drawThemedBackgroundPattern(theme, x, y, width, height, alpha = 0.24) {
    const ctx = this.ctx
    const pattern = theme.background && theme.background.pattern
      ? theme.background.pattern
      : 'pin'
    const colors = theme.colors

    ctx.save()
    ctx.globalAlpha = alpha

    if (pattern === 'circuit') {
      ctx.strokeStyle = colors.primary
      ctx.lineWidth = 1
      for (let px = x + 18; px < x + width; px += 42) {
        ctx.beginPath()
        ctx.moveTo(px, y)
        ctx.lineTo(px, y + height)
        ctx.stroke()
      }
      ctx.strokeStyle = colors.line
      for (let py = y + 22; py < y + height; py += 42) {
        ctx.beginPath()
        ctx.moveTo(x, py)
        ctx.lineTo(x + width, py)
        ctx.stroke()
      }
      ctx.fillStyle = colors.warning
      for (let px = x + 38; px < x + width; px += 84) {
        for (let py = y + 38; py < y + height; py += 84) {
          ctx.beginPath()
          ctx.arc(px, py, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else if (pattern === 'rivets') {
      ctx.strokeStyle = colors.line
      ctx.lineWidth = 1
      for (let py = y + 24; py < y + height; py += 44) {
        ctx.beginPath()
        ctx.moveTo(x, py)
        ctx.lineTo(x + width, py)
        ctx.stroke()
      }
      ctx.fillStyle = colors.warning
      for (let px = x + 26; px < x + width; px += 40) {
        for (let py = y + 26; py < y + height; py += 40) {
          ctx.beginPath()
          ctx.arc(px, py, 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else if (pattern === 'luxury') {
      ctx.strokeStyle = colors.primary
      ctx.lineWidth = 1
      for (let px = x - height; px < x + width; px += 48) {
        ctx.beginPath()
        ctx.moveTo(px, y + height)
        ctx.lineTo(px + height, y)
        ctx.stroke()
      }
      ctx.fillStyle = colors.warning
      for (let px = x + 34; px < x + width; px += 72) {
        ctx.beginPath()
        ctx.arc(px, y + height * 0.22, 2, 0, Math.PI * 2)
        ctx.arc(px + 24, y + height * 0.72, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (pattern === 'confetti') {
      const confetti = [colors.primary, colors.secondary, colors.warning, colors.danger, colors.purple]
      for (let i = 0; i < 40; i++) {
        const px = x + ((i * 37) % Math.max(1, width))
        const py = y + ((i * 53) % Math.max(1, height))
        ctx.fillStyle = confetti[i % confetti.length]
        this.roundRect(ctx, px, py, 7, 3, 1.5)
        ctx.fill()
      }
    } else if (pattern === 'ink') {
      ctx.strokeStyle = colors.line
      ctx.lineWidth = 1
      for (let i = 0; i < 9; i++) {
        const px = x + width * (i + 1) / 10
        ctx.beginPath()
        ctx.moveTo(px, y)
        ctx.quadraticCurveTo(px - 18, y + height * 0.5, px + 8, y + height)
        ctx.stroke()
      }
      ctx.fillStyle = colors.primary
      ctx.beginPath()
      ctx.arc(x + width * 0.78, y + height * 0.2, 9, 0, Math.PI * 2)
      ctx.fill()
    } else if (pattern === 'sketch') {
      ctx.strokeStyle = colors.line
      ctx.lineWidth = 1.2
      ctx.lineCap = 'round'
      for (let i = 0; i < 14; i++) {
        const px = x + ((i * 47) % Math.max(1, width))
        const py = y + ((i * 31) % Math.max(1, height))
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.quadraticCurveTo(px + 18, py - 7, px + 34, py + 6)
        ctx.stroke()
      }
      const marks = [colors.primary, colors.secondary, colors.warning, colors.danger]
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = marks[i % marks.length]
        ctx.beginPath()
        ctx.arc(x + ((i * 41) % Math.max(1, width)), y + ((i * 59) % Math.max(1, height)), 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (pattern === 'bamboo') {
      ctx.strokeStyle = colors.secondary
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (let px = x + 18; px < x + width; px += 54) {
        ctx.beginPath()
        ctx.moveTo(px, y)
        ctx.lineTo(px - 10, y + height)
        ctx.stroke()
        for (let py = y + 22; py < y + height; py += 42) {
          ctx.beginPath()
          ctx.moveTo(px - 5, py)
          ctx.lineTo(px + 12, py - 6)
          ctx.stroke()
        }
      }
      ctx.fillStyle = colors.dot
      for (let i = 0; i < 4; i++) {
        const cx = x + width * (0.18 + i * 0.22)
        const cy = y + height * (0.18 + (i % 2) * 0.52)
        ctx.globalAlpha = alpha * 0.72
        ctx.beginPath()
        ctx.arc(cx - 5, cy - 5, 3.2, 0, Math.PI * 2)
        ctx.arc(cx + 5, cy - 5, 3.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = alpha
        ctx.fillStyle = colors.surface
        ctx.beginPath()
        ctx.arc(cx, cy, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = colors.dot
      }
    } else {
      ctx.strokeStyle = colors.line
      ctx.lineWidth = 1
      for (let px = x + 22; px < x + width; px += 34) {
        for (let py = y + 22; py < y + height; py += 34) {
          ctx.beginPath()
          ctx.arc(px, py, 1.2, 0, Math.PI * 2)
          ctx.stroke()
        }
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
