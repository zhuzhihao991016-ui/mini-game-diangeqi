import BaseScene from './BaseScene'
import MenuScene from './MenuScene'
import BattleScene from './BattleScene'
import { getSceneSafeLayout } from '../utils/SafeArea'
import UITheme from '../ui/theme'
import { drawImageAsset, preloadImageAssets } from '../assets/ImageAssets'
import SoundEffects from '../assets/SoundEffects'

const BRAND_COLOR = UITheme.colors.primary
const DANGER_COLOR = UITheme.colors.danger

const T = {
  chooseOnline: '\u8bf7\u9009\u62e9\u8054\u673a\u65b9\u5f0f',
  inviteReceived: '\u6536\u5230\u597d\u53cb\u9080\u8bf7\uff0c\u623f\u95f4\u53f7\uff1a',
  joinFriend: '\u52a0\u5165\u597d\u53cb\u623f',
  createFriend: '\u521b\u5efa\u597d\u53cb\u623f',
  onlineMissing: '\u8054\u673a\u6a21\u5757\u672a\u521d\u59cb\u5316',
  creating: '\u6b63\u5728\u521b\u5efa\u623f\u95f4...',
  created: '\u623f\u95f4\u5df2\u521b\u5efa\uff0c\u7b49\u5f85\u597d\u53cb\u52a0\u5165',
  createFailed: '\u521b\u5efa\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5',
  enterRoomId: '\u8bf7\u8f93\u5165\u597d\u53cb\u53d1\u6765\u7684\u623f\u95f4\u53f7',
  inputRoomId: '\u8f93\u5165\u623f\u95f4\u53f7',
  joinRoom: '\u52a0\u5165\u623f\u95f4',
  roomIdPlaceholder: '\u8bf7\u8f93\u5165 roomId',
  roomIdEntered: '\u5df2\u8f93\u5165\u623f\u95f4\u53f7\uff1a',
  roomIdRequired: '\u8bf7\u5148\u8f93\u5165\u623f\u95f4\u53f7',
  joining: '\u6b63\u5728\u52a0\u5165\u623f\u95f4...',
  joined: '\u52a0\u5165\u6210\u529f\uff0c\u7b49\u5f85\u53cc\u65b9\u51c6\u5907',
  joinFailed: '\u52a0\u5165\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u623f\u95f4\u53f7',
  share: '\u5fae\u4fe1\u9080\u8bf7\u597d\u53cb',
  copy: '\u590d\u5236\u623f\u95f4\u53f7',
  cancel: '\u53d6\u6d88\u623f\u95f4',
  roomIdMissing: '\u623f\u95f4\u53f7\u4e0d\u5b58\u5728\uff0c\u65e0\u6cd5\u9080\u8bf7',
  shareUnsupported: '\u5f53\u524d\u5fae\u4fe1\u7248\u672c\u4e0d\u652f\u6301\u5206\u4eab',
  shareOpened: '\u5df2\u6253\u5f00\u5fae\u4fe1\u9080\u8bf7\u9762\u677f',
  copied: '\u623f\u95f4\u53f7\u5df2\u590d\u5236\uff0c\u53d1\u7ed9\u597d\u53cb\u5373\u53ef',
  preparing: '\u597d\u53cb\u5df2\u52a0\u5165\uff0c\u6b63\u5728\u51c6\u5907...',
  finished: '\u4e0a\u4e00\u5c40\u5df2\u7ed3\u675f',
  restoring: '\u6b63\u5728\u6062\u590d\u623f\u95f4...',
  restored: '\u623f\u95f4\u5df2\u6062\u590d\uff0c\u7b49\u5f85\u597d\u53cb\u52a0\u5165',
  restoreFailed: '\u6062\u590d\u623f\u95f4\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u521b\u5efa\u6216\u52a0\u5165',
  waitingFriend: '\u7b49\u5f85\u597d\u53cb\u52a0\u5165...',
  title: '\u597d\u53cb\u623f',
  roomIdLabel: '\u623f\u95f4\u53f7\uff1a',
  joiningLabel: '\u51c6\u5907\u52a0\u5165\uff1a',
  back: '\u8fd4\u56de',
  shareTitle: '\u6211\u5728\u73a9\u70b9\u683c\u68cb\uff0c\u623f\u95f4\u53f7',
  shareSuffix: '\uff0c\u5feb\u6765\u5bf9\u6218\uff01',
  shareDefault: '\u4e00\u8d77\u6765\u73a9\u70b9\u683c\u68cb',
  player: '\u73a9\u5bb6'
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
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.createFriend, subText: '\u521b\u5efa\u623f\u95f4\uff0c\u9080\u8bf7\u597d\u53cb', accentColor: BRAND_COLOR, icon: 'create', onClick: () => this.createFriendRoom() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.joinFriend, subText: '\u8f93\u5165\u623f\u95f4\u53f7\u52a0\u5165', accentColor: UITheme.colors.secondary, icon: 'join', onClick: () => this.showJoinInput() }))
  }

  showInviteJoinButtons() {
    this.buttons = []
    const cx = this.width / 2
    const w = this.getMenuCardWidth()
    const h = UITheme.menu.cardH
    const startY = this.getVerticalListStartY(2, h, UITheme.menu.gap, this.y(260))
    const gap = this.getVerticalListGap(startY, 2, h, UITheme.menu.gap, UITheme.menu.gap)
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.joinFriend, accentColor: BRAND_COLOR, onClick: () => this.joinFriendRoom() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.back, accentColor: DANGER_COLOR, onClick: () => this.buildHomeButtons() }))
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
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.inputRoomId, accentColor: BRAND_COLOR, onClick: () => this.promptRoomId() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.joinRoom, accentColor: BRAND_COLOR, onClick: () => this.joinFriendRoom() }))
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
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY, width: w, height: h, text: T.share, accentColor: BRAND_COLOR, onClick: () => this.shareRoom() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + h + gap, width: w, height: h, text: T.copy, accentColor: BRAND_COLOR, onClick: () => this.copyRoomId() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: startY + (h + gap) * 2, width: w, height: h, text: T.cancel, accentColor: DANGER_COLOR, onClick: () => this.cancelRoom() }))
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
      this.statusText = error && error.message ? error.message : '\u8054\u673a\u53d1\u751f\u9519\u8bef'
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
    ctx.fillStyle = UITheme.colors.text
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
    ctx.fillStyle = UITheme.colors.muted
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
    this.roundRect(ctx, x, y, w, 42, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.primaryLight
    ctx.fill()
    ctx.strokeStyle = BRAND_COLOR
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = UITheme.colors.text
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, text, this.width / 2, y + 21, w - 22, 18, 11, 'bold', 'center')
  }

  drawBackButton() {
    const ctx = this.ctx
    const b = this.backButton
    ctx.save()
    this.roundRect(ctx, b.x, b.y, b.width, b.height, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = UITheme.colors.text
    ctx.font = `bold ${UITheme.menu.compactFont}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this.drawFittedText(ctx, '\u2039', b.x + b.width / 2, b.y + b.height / 2, b.width - 12, 24, 14, 'bold', 'center')
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
        ctx.save()
        this.roundRect(ctx, x, y, width, height, UITheme.radius.md)
        ctx.fillStyle = accentColor === DANGER_COLOR ? UITheme.colors.dangerLight : this.getCardFill(accentColor)
        ctx.fill()
        ctx.strokeStyle = accentColor
        ctx.lineWidth = 1.4
        ctx.stroke()
        if (icon) {
          this.drawCardIcon(ctx, icon, x + 38, y + height / 2, Math.min(24, height * 0.32), accentColor)
        }
        ctx.fillStyle = accentColor
        ctx.textBaseline = 'middle'
        this.drawFittedText(ctx, text, subText ? x + 74 : x + width / 2, y + height / 2 - (subText ? 8 : 0), subText ? width - 92 : width - 28, UITheme.menu.itemFont, 12, 'bold', subText ? 'left' : 'center')
        if (subText) {
          ctx.fillStyle = UITheme.colors.muted
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
    ctx.fillStyle = UITheme.colors.background
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.save()
    ctx.strokeStyle = '#D9F0FF'
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

  getCardFill(accentColor) {
    if (accentColor === UITheme.colors.secondary) return UITheme.colors.secondaryLight
    if (accentColor === UITheme.colors.warning) return UITheme.colors.warningLight
    if (accentColor === UITheme.colors.danger) return UITheme.colors.dangerLight
    return UITheme.colors.surface
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
}
