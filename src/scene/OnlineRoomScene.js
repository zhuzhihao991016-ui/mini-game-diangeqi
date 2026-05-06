import BaseScene from './BaseScene'
import MenuScene from './MenuScene'
import BattleScene from './BattleScene'
import { getSceneSafeLayout } from '../utils/SafeArea'
import UITheme from '../ui/theme'
import { getActiveAppearanceTheme } from '../ui/AppearanceThemes'
import { drawImageAsset, getImageAsset, preloadImageAssets } from '../assets/ImageAssets'
import SoundEffects from '../assets/SoundEffects'

const T = {
  chooseOnline: '请选择联机方式',
  inviteReceived: '收到好友邀请，房间号：',
  joinFriend: '加入好友房',
  createFriend: '创建好友房',
  onlineMissing: '联机模块未初始化',
  creating: '正在创建房间...',
  created: '房间已创建，等待好友加入',
  createFailed: '创建失败，请稍后重试',
  enterRoomId: '请输入好友发来的房间号',
  inputRoomId: '输入房间号',
  joinRoom: '加入房间',
  roomIdPlaceholder: '请输入 roomId',
  roomIdEntered: '已输入房间号：',
  roomIdRequired: '请先输入房间号',
  joining: '正在加入房间...',
  joined: '加入成功，等待双方准备',
  joinFailed: '加入失败，请检查房间号',
  share: '微信邀请好友',
  copy: '复制房间号',
  cancel: '取消房间',
  roomIdMissing: '房间号不存在，无法邀请',
  shareUnsupported: '当前微信版本不支持分享',
  shareOpened: '已打开微信邀请面板',
  copied: '房间号已复制，发给好友即可',
  preparing: '好友已加入，正在准备...',
  finished: '上一局已结束',
  restoring: '正在恢复房间...',
  restored: '房间已恢复，等待好友加入',
  restoreFailed: '恢复房间失败，请重新创建或加入',
  waitingFriend: '等待好友加入...',
  title: '好友房',
  roomIdLabel: '房间号：',
  joiningLabel: '准备加入：',
  back: '返回',
  shareTitle: '我在玩点格棋，房间号',
  shareSuffix: '，快来对战！',
  shareDefault: '一起来玩点格棋',
  player: '玩家'
}

export default class OnlineRoomScene extends BaseScene {
  constructor({
    canvas,
    ctx,
    inputManager,
    sceneManager,
    width,
    height,
    boardType = 'square',
    rows = 3,
    cols = 3,
    isFunMode = false,
    onlineManager = null,
    userManager = null
  }) {
    super()

    this.canvas = canvas
    this.ctx = ctx
    this.inputManager = inputManager
    this.sceneManager = sceneManager
    this.width = width
    this.height = height
    this.boardType = boardType
    this.rows = rows
    this.cols = cols
    this.isFunMode = !!isFunMode
    this.onlineManager = onlineManager || wx.__roomManager || null
    this.userManager = userManager || wx.__userManager || null
    this.page = 'home'
    this.statusText = T.chooseOnline
    this.roomId = ''
    this.inputRoomId = ''
    this.buttons = []
    this.onlineEventsBound = false
    this.active = true
    this.enteredBattle = false
    this.readySentForRoomId = ''
    this.safeLayout = getSceneSafeLayout(this.width, this.height)
    this.backButton = {
      x: UITheme.menu.pageX,
      y: this.safeLayout.top,
      width: UITheme.menu.backW,
      height: UITheme.menu.backH
    }
    preloadImageAssets()
  }

  y(value) {
    return value + this.safeLayout.insets.top
  }

  onEnter() {
    this.active = true
    this.enteredBattle = false
    this.inputManager.clearTouchStartHandlers()
    this.enableShareMenu()
    this.inputManager.onTouchStart((x, y) => {
      if (this.isBackButtonHit(x, y)) {
        SoundEffects.play('button')
        this.back()
        return
      }
      for (const button of this.buttons) {
        if (button.hitTest(x, y)) {
          button.click()
          return
        }
      }
    })
    this.bindOnlineManagerEvents()

    const pendingRoomId = wx.getStorageSync('pending_join_room_id')
    if (pendingRoomId) {
      wx.removeStorageSync('pending_join_room_id')
      this.inputRoomId = String(pendingRoomId)
      this.roomId = ''
      this.page = 'join'
      this.statusText = `${T.inviteReceived}${this.inputRoomId}`
      this.showInviteJoinButtons()
      return
    }

    const lastRoomId = wx.getStorageSync('dots_last_room_id')
    if (lastRoomId) {
      this.restoreLastRoom(String(lastRoomId))
      return
    }

    this.buildHomeButtons()
  }

  onExit() {
    this.active = false
    this.inputManager.clearTouchStartHandlers()
  }

  update() {}

  render() {
    const ctx = this.ctx

    this.drawBackground()
    this.drawTitle()
    this.drawStatus()
    this.drawRoomInfo()
    this.drawBackButton()
    for (const button of this.buttons) button.draw(ctx)
  }

  enableShareMenu() {
    if (wx.showShareMenu) wx.showShareMenu({ withShareTicket: true })
    if (wx.onShareAppMessage) {
      wx.onShareAppMessage(() => {
        if (this.roomId) {
          return { title: `${T.shareTitle} ${this.roomId}${T.shareSuffix}`, query: `roomId=${encodeURIComponent(this.roomId)}&from=menu_share`, imageUrl: '' }
        }
        return { title: T.shareDefault, query: 'from=menu_share', imageUrl: '' }
      })
    }
  }

  buildHomeButtons() {
    this.page = 'home'
    this.statusText = T.chooseOnline
    this.buttons = []
    const cx = this.width / 2
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
    const startY = this.getVerticalListStartY(2, h, UITheme.menu.gap, this.y(190))
    const gap = this.getVerticalListGap(startY, 2, h, UITheme.menu.gap, UITheme.menu.gap)
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.createFriend, subText: '创建房间，邀请好友', accentColor: this.getBrandColor(), icon: 'create', onClick: () => this.createFriendRoom() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.joinFriend, subText: '输入房间号加入', accentColor: UITheme.colors.secondary, icon: 'join', onClick: () => this.showJoinInput() }))
  }

  showInviteJoinButtons() {
    this.buttons = []
    const cx = this.width / 2
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
    const startY = this.getVerticalListStartY(2, h, UITheme.menu.gap, this.y(260))
    const gap = this.getVerticalListGap(startY, 2, h, UITheme.menu.gap, UITheme.menu.gap)
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.joinFriend, accentColor: this.getBrandColor(), onClick: () => this.joinFriendRoom() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.back, accentColor: UITheme.colors.danger, onClick: () => this.buildHomeButtons() }))
  }

  async createFriendRoom() {
    try {
      if (!this.onlineManager) {
        this.statusText = T.onlineMissing
        return
      }
      await this.ensureUserReady()
      this.page = 'waiting'
      this.buttons = []
      this.statusText = T.creating
      this.bindOnlineManagerEvents()
      const result = await this.onlineManager.createRoom({ boardType: this.boardType, rows: this.rows, cols: this.cols, isFunMode: this.isFunMode, nickname: this.getNickname() })
      this.applyRoomBoard(result && result.board)
      this.roomId = result.roomId
      this.statusText = T.created
      this.buildWaitingButtons()
    } catch (err) {
      console.error(err)
      this.statusText = T.createFailed
      this.buildHomeButtons()
    }
  }

  showJoinInput() {
    this.page = 'join'
    this.statusText = T.enterRoomId
    this.buttons = []
    const cx = this.width / 2
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
    const startY = this.getVerticalListStartY(2, h, UITheme.menu.gap, this.y(210))
    const gap = this.getVerticalListGap(startY, 2, h, UITheme.menu.gap, UITheme.menu.gap)
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.inputRoomId, accentColor: this.getBrandColor(), onClick: () => this.promptRoomId() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.joinRoom, accentColor: this.getBrandColor(), onClick: () => this.joinFriendRoom() }))
  }

  promptRoomId() {
    wx.showModal({
      title: T.inputRoomId,
      editable: true,
      placeholderText: T.roomIdPlaceholder,
      success: res => {
        if (res.confirm && res.content) {
          this.inputRoomId = String(res.content).trim()
          this.statusText = `${T.roomIdEntered}${this.inputRoomId}`
        }
      }
    })
  }

  async joinFriendRoom() {
    if (!this.inputRoomId) {
      this.statusText = T.roomIdRequired
      return
    }
    try {
      if (!this.onlineManager) {
        this.statusText = T.onlineMissing
        return
      }
      await this.ensureUserReady()
      this.page = 'joining'
      this.buttons = []
      this.statusText = T.joining
      this.bindOnlineManagerEvents()
      const result = await this.onlineManager.joinRoom({ roomId: this.inputRoomId, nickname: this.getNickname() })
      this.applyRoomBoard(result && result.board)
      this.roomId = result.roomId
      this.statusText = T.joined
      this.tryEnterBattle()
    } catch (err) {
      console.error(err)
      this.statusText = T.joinFailed
      this.showJoinInput()
    }
  }

  buildWaitingButtons() {
    this.buttons = []
    const cx = this.width / 2
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
    const startY = this.getVerticalListStartY(3, h, UITheme.menu.gap, this.y(280))
    const gap = this.getVerticalListGap(startY, 3, h, UITheme.menu.gap, UITheme.menu.gap)
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.share, accentColor: this.getBrandColor(), onClick: () => this.shareRoom() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.copy, accentColor: this.getBrandColor(), onClick: () => this.copyRoomId() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap) * 2, width: w, height: h, text: T.cancel, accentColor: UITheme.colors.danger, onClick: () => this.cancelRoom() }))
  }

  shareRoom() {
    if (!this.roomId) {
      this.statusText = T.roomIdMissing
      return
    }
    if (!wx.shareAppMessage) {
      this.statusText = T.shareUnsupported
      return
    }
    wx.shareAppMessage({ title: `${T.shareTitle} ${this.roomId}${T.shareSuffix}`, query: `roomId=${encodeURIComponent(this.roomId)}&from=share`, imageUrl: '' })
    this.statusText = T.shareOpened
  }

  copyRoomId() {
    if (!this.roomId) return
    wx.setClipboardData({ data: this.roomId, success: () => { this.statusText = T.copied } })
  }

  cancelRoom() {
    if (this.onlineManager && !this.enteredBattle) this.onlineManager.leaveRoom()
    this.roomId = ''
    this.inputRoomId = ''
    this.buildHomeButtons()
  }

  bindOnlineManagerEvents() {
    if (!this.onlineManager || this.onlineEventsBound) return
    this.onlineEventsBound = true
    this.onlineManager.onRoomUpdate(roomState => {
      if (!this.active || this.enteredBattle || !roomState) return
      if (roomState.roomId) this.roomId = roomState.roomId
      this.applyRoomBoard(roomState.board)
      if (roomState.phase === 'waiting') {
        const players = roomState.players || []
        this.statusText = players.length >= 2 ? T.preparing : T.created
        if (this.page === 'waiting') this.buildWaitingButtons()
        if (players.length >= 2) this.tryEnterBattle()
      }
      if (roomState.phase === 'playing') this.tryEnterBattle()
      if (roomState.phase === 'finished') this.statusText = T.finished
    })
    this.onlineManager.onReady(() => this.tryEnterBattle())
    this.onlineManager.onError(error => {
      if (!this.active || this.enteredBattle) return
      this.statusText = error && error.message ? error.message : '联机发生错误'
    })
  }

  restoreLastRoom(roomId) {
    this.roomId = roomId
    this.inputRoomId = ''
    this.page = 'waiting'
    this.statusText = T.restoring
    this.buildWaitingButtons()
    if (!this.onlineManager) {
      this.statusText = T.onlineMissing
      return
    }
    if (this.onlineManager.roomState && this.onlineManager.roomState.roomId === roomId) {
      this.applyRoomBoard(this.onlineManager.roomState.board)
      if (this.onlineManager.roomState.phase === 'waiting') {
        this.statusText = T.restored
        return
      }
      if (this.onlineManager.roomState.phase === 'playing') {
        this.tryEnterBattle()
        return
      }
      if (this.onlineManager.roomState.phase === 'finished') {
        this.statusText = T.finished
        return
      }
    }
    if (this.onlineManager.netManager && !this.onlineManager.netManager.connected && typeof this.onlineManager.netManager.connect === 'function') {
      this.onlineManager.netManager.connect().catch(err => {
        console.error('restore room reconnect failed:', err)
        this.statusText = T.restoreFailed
        this.buildHomeButtons()
      })
    }
  }

  tryEnterBattle() {
    if (!this.active || this.enteredBattle) return
    if (!this.onlineManager || !this.onlineManager.room) return
    const roomInfo = this.onlineManager.room.roomInfo
    if (!roomInfo) return
    const players = roomInfo.playerList || []
    if (players.length < 2) {
      this.statusText = T.waitingFriend
      return
    }
    if (roomInfo.phase === 'playing') {
      this.enterBattle()
      return
    }
    if (roomInfo.phase !== 'waiting') return
    this.statusText = T.preparing
    if (this.readySentForRoomId === roomInfo.roomId) return
    this.readySentForRoomId = roomInfo.roomId
    this.onlineManager.startFrameSync()
  }

  enterBattle() {
    if (this.enteredBattle) return
    this.enteredBattle = true
    this.active = false
    this.sceneManager.setScene(new BattleScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height,
      rows: this.rows,
      cols: this.cols,
      boardType: this.boardType,
      mode: 'online',
      isFunMode: this.isFunMode,
      funModeSeed: `${this.roomId || (this.onlineManager && this.onlineManager.roomId) || ''}:1`,
      onlineManager: this.onlineManager,
      userManager: this.userManager
    }))
  }

  applyRoomBoard(board) {
    if (!board) return
    if (board.boardType) this.boardType = board.boardType
    if (board.rows) this.rows = board.rows
    if (board.cols) this.cols = board.cols
    if (board.isFunMode !== undefined) this.isFunMode = !!board.isFunMode
  }

  async ensureUserReady() {
    if (this.userManager && this.userManager.ensureLogin) await this.userManager.ensureLogin()
  }

  getNickname() {
    if (this.userManager && this.userManager.getNickname) return this.userManager.getNickname()
    return T.player
  }

  back() {
    if (this.page === 'home') {
      this.sceneManager.setScene(new MenuScene({
        canvas: this.canvas,
        ctx: this.ctx,
        inputManager: this.inputManager,
        sceneManager: this.sceneManager,
        width: this.width,
        height: this.height,
        userManager: this.userManager
      }))
      return
    }
    this.cancelRoom()
  }

  isBackButtonHit(x, y) {
    const b = this.backButton
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
  }

  drawTitle() {
    const ctx = this.ctx
    const colors = this.getActiveColors()
    ctx.fillStyle = colors.text
    ctx.font = `bold ${UITheme.menu.titleFont}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(T.title, this.width / 2, this.safeLayout.top + 17)

    if (this.page === 'home') {
      const avatarY = Math.max(this.y(86), this.safeLayout.top + 56)
      drawImageAsset(ctx, 'avatarBlue', this.width / 2 - 88, avatarY, 82, 82)
      drawImageAsset(ctx, 'avatarRed', this.width / 2 + 8, avatarY, 82, 82)
    }
  }

  drawStatus() {
    const ctx = this.ctx
    const colors = this.getActiveColors()
    ctx.fillStyle = colors.muted
    ctx.font = '14px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, this.statusText, this.width / 2, this.y(this.page === 'home' ? 166 : 122), this.width - 44, 15, 10, '', 'center')
  }

  drawRoomInfo() {
    if (!this.roomId && !this.inputRoomId) return
    const ctx = this.ctx
    const text = this.roomId ? `${T.roomIdLabel}${this.roomId}` : `${T.joiningLabel}${this.inputRoomId}`
    const w = Math.min(this.width - 64, 270)
    const x = (this.width - w) / 2
    const y = this.y(196)
    const colors = this.getActiveColors()
    this.drawThemeButtonShell(ctx, { x, y, width: w, height: 46, color: colors.primary, solid: false, compact: true })
    ctx.fillStyle = colors.text
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, text, this.width / 2, y + 23, w - 22, 18, 11, 'bold', 'center')
  }

  drawBackButton() {
    const ctx = this.ctx
    const b = this.backButton
    ctx.save()
    const colors = this.getActiveColors()
    this.drawThemeButtonShell(ctx, { x: b.x, y: b.y, width: b.width, height: b.height, color: colors.text, solid: false, compact: true })
    ctx.fillStyle = colors.text
    ctx.font = `bold ${UITheme.menu.compactFont}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, '‹', b.x + b.width / 2, b.y + b.height / 2, b.width - 12, 24, 14, 'bold', 'center')
    ctx.restore()
  }

  createCard({ x, y, width, height, text, subText = '', accentColor, onClick, icon = '' }) {
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
        const colors = this.getActiveColors()
        ctx.save()
        this.drawThemeButtonShell(ctx, { x, y, width, height, color, solid: false })
        if (icon) {
          this.drawCardIcon(ctx, icon, x + 38, y + height / 2, Math.min(24, height * 0.32), color)
        }
        ctx.fillStyle = color === colors.warning ? colors.text : color
        ctx.textBaseline = 'middle'
        this.drawFittedText(ctx, text, subText ? x + 74 : x + width / 2, y + height / 2 - (subText ? 8 : 0), subText ? width - 92 : width - 28, UITheme.menu.itemFont, 12, 'bold', subText ? 'left' : 'center')
        if (subText) {
          ctx.fillStyle = colors.muted
          this.drawFittedText(ctx, subText, x + 74, y + height / 2 + 15, width - 92, UITheme.menu.subFont, 9, '', 'left')
        }
        ctx.restore()
      }
    }
  }

  getVerticalListStartY(count, itemH, minGap, preferredStartY) {
    const bottomLimit = this.height - this.safeLayout.insets.bottom - 42
    const needed = count * itemH + (count - 1) * minGap
    const maxStartY = bottomLimit - needed
    return Math.max(this.y(146), Math.min(preferredStartY, maxStartY))
  }

  getMenuCardWidth() {
    return this.width - UITheme.menu.pageX * 2
  }

  getVerticalListGap(startY, count, itemH, preferredGap, minGap) {
    if (count <= 1) return 0
    const bottomLimit = this.height - this.safeLayout.insets.bottom - 42
    const available = bottomLimit - startY - count * itemH
    return Math.max(minGap, Math.min(preferredGap, available / (count - 1)))
  }

  drawFittedText(ctx, text, x, y, maxWidth, fontSize, minFontSize = 10, weight = 'bold', align = 'center') {
    const safeText = `${text}`
    const fontWeight = weight ? `${weight} ` : ''
    let size = fontSize

    while (size > minFontSize) {
      ctx.font = `${fontWeight}${size}px Arial`
      if (ctx.measureText(safeText).width <= maxWidth) break
      size -= 1
    }

    ctx.textAlign = align
    ctx.fillText(safeText, x, y)
  }

  drawBackground() {
    const ctx = this.ctx
    const theme = getActiveAppearanceTheme()
    const colors = theme.colors
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
      ctx.fillStyle = theme.background.imageOverlay || 'rgba(255,255,255,0.08)'
      ctx.fillRect(0, 0, this.width, this.height)
      return
    }

    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, this.width, this.height)
  }

  getCardFill(accentColor) {
    const colors = this.getActiveColors()
    if (accentColor === colors.secondary) return colors.secondaryLight
    if (accentColor === colors.warning) return colors.warningLight
    if (accentColor === colors.danger) return colors.dangerLight
    if (accentColor === colors.purple) return colors.purpleLight
    return colors.surface
  }

  drawThemeButtonShell(ctx, { x, y, width, height, color, solid = false, compact = false }) {
    const theme = getActiveAppearanceTheme()
    const style = theme.buttonStyle || 'minimal'
    const colors = theme.colors
    const radius = style === 'mechanical' || style === 'black-gold'
      ? Math.min(5, UITheme.radius.md)
      : style === 'cartoon' || style === 'panda'
        ? Math.min(14, UITheme.radius.lg)
        : UITheme.radius.md

    if (style === 'mechanical') {
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
      ctx.fillStyle = solid ? this.withAlpha('#FFFFFF', 0.42) : color
      ;[[x + 12, y + 12], [x + width - 12, y + 12], [x + 12, y + height - 12], [x + width - 12, y + height - 12]].forEach(([px, py]) => {
        ctx.beginPath()
        ctx.arc(px, py, 2, 0, Math.PI * 2)
        ctx.fill()
      })
      return
    }

    this.roundRect(ctx, x, y, width, height, radius)
    if (style === 'steampunk') {
      const gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, solid ? this.lighten(color, 0.2) : colors.surfaceTint)
      gradient.addColorStop(0.48, solid ? color : colors.surface)
      gradient.addColorStop(1, solid ? this.darken(color, 0.28) : colors.primaryLight)
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.strokeStyle = colors.warning
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = colors.warning
      for (let px = x + 14; px <= x + width - 14; px += Math.max(22, width / 6)) {
        ctx.beginPath()
        ctx.arc(px, y + height - 8, 2, 0, Math.PI * 2)
        ctx.fill()
      }
      return
    }

    if (style === 'black-gold') {
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
      return
    }

    if (style === 'cartoon') {
      this.roundRect(ctx, x, y + 3, width, height, radius)
      ctx.fillStyle = this.darken(color, solid ? 0.32 : 0.18)
      ctx.fill()
      this.roundRect(ctx, x, y, width, height - 3, radius)
      ctx.fillStyle = solid ? color : this.getCardFill(color)
      ctx.fill()
      ctx.strokeStyle = colors.text
      ctx.lineWidth = 2.4
      ctx.stroke()
      if (!compact) {
        ctx.fillStyle = this.withAlpha('#FFFFFF', solid ? 0.35 : 0.6)
        this.roundRect(ctx, x + 12, y + 8, width - 24, Math.max(5, height * 0.14), 5)
        ctx.fill()
      }
      return
    }

    if (style === 'guofeng') {
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
      return
    }

    if (style === 'handdrawn') {
      const paper = solid ? this.lighten(color, 0.08) : colors.surface
      const ink = solid ? this.darken(color, 0.34) : color
      this.drawSketchBlob(ctx, x + 3, y + 4, width - 3, height - 2, radius, [[0, 1], [1, 0], [-1, 1], [0, -1]])
      ctx.fillStyle = this.withAlpha(colors.text, 0.14)
      ctx.fill()
      this.drawSketchBlob(ctx, x, y, width - 2, height - 2, radius, [[0, 0], [2, -1], [-1, 1], [1, 2]])
      ctx.fillStyle = paper
      ctx.fill()
      ctx.strokeStyle = ink
      ctx.lineWidth = solid ? 2.8 : 2.2
      this.drawSketchBlob(ctx, x, y, width - 2, height - 2, radius, [[0, 0], [2, -1], [-1, 1], [1, 2]])
      ctx.stroke()
      ctx.strokeStyle = this.withAlpha(colors.text, 0.26)
      ctx.lineWidth = 1.1
      this.drawSketchBlob(ctx, x + 2, y + 2, width - 5, height - 5, Math.max(3, radius - 3), [[1, -1], [-1, 0], [0, 1], [2, 0]])
      ctx.stroke()
      ctx.strokeStyle = this.withAlpha(solid ? '#FFFFFF' : colors.warning, solid ? 0.48 : 0.56)
      ctx.lineWidth = Math.max(2, height * 0.08)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x + width * 0.18, y + height - 10)
      ctx.quadraticCurveTo(x + width * 0.48, y + height - 15, x + width * 0.82, y + height - 11)
      ctx.stroke()
      return
    }

    if (style === 'panda') {
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
      return
    }

    if (solid) {
      const gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, this.darken(color, 0.12))
      ctx.fillStyle = gradient
    } else {
      ctx.fillStyle = this.getCardFill(color)
    }
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.4
    ctx.stroke()
  }

  getActiveColors() {
    return getActiveAppearanceTheme().colors
  }

  getBrandColor() {
    return this.getActiveColors().primary
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
      [UITheme.colors.text]: colors.text
    }
    return map[color] || color
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

  drawCardIcon(ctx, icon, x, y, size, color) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = Math.max(2, size / 8)
    ctx.lineCap = 'round'
    if (icon === 'create' || icon === 'join') {
      ctx.beginPath()
      ctx.arc(x - size * 0.45, y - size * 0.35, size * 0.36, 0, Math.PI * 2)
      ctx.arc(x + size * 0.45, y - size * 0.35, size * 0.36, 0, Math.PI * 2)
      ctx.fill()
      this.roundRect(ctx, x - size * 1.1, y + size * 0.12, size * 2.2, size * 0.78, size * 0.22)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(x + size * 0.95, y + size * 0.52, size * 0.45, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.beginPath()
      ctx.moveTo(x + size * 0.95, y + size * 0.27)
      ctx.lineTo(x + size * 0.95, y + size * 0.77)
      ctx.moveTo(x + size * 0.7, y + size * 0.52)
      ctx.lineTo(x + size * 1.2, y + size * 0.52)
      ctx.stroke()
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
}
