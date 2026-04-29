import BaseScene from './BaseScene'
import MenuScene from './MenuScene'
import BattleScene from './BattleScene'

const BRAND_COLOR = '#4A90E2'
const DANGER_COLOR = '#E24A4A'

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
    this.backButton = { x: 20, y: 20, width: 110, height: 40 }
  }

  onEnter() {
    this.active = true
    this.enteredBattle = false
    this.inputManager.clearTouchStartHandlers()
    this.enableShareMenu()
    this.inputManager.onTouchStart((x, y) => {
      if (this.isBackButtonHit(x, y)) {
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
    ctx.fillStyle = '#EFEFEF'
    ctx.fillRect(0, 0, this.width, this.height)
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
    const w = this.width - 40
    const h = 58
    this.buttons.push(this.createCard({ x: cx - w / 2, y: 230, width: w, height: h, text: T.createFriend, accentColor: BRAND_COLOR, onClick: () => this.createFriendRoom() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: 305, width: w, height: h, text: T.joinFriend, accentColor: BRAND_COLOR, onClick: () => this.showJoinInput() }))
  }

  showInviteJoinButtons() {
    this.buttons = []
    const cx = this.width / 2
    const w = this.width - 40
    const h = 58
    this.buttons.push(this.createCard({ x: cx - w / 2, y: 300, width: w, height: h, text: T.joinFriend, accentColor: BRAND_COLOR, onClick: () => this.joinFriendRoom() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: 375, width: w, height: h, text: T.back, accentColor: DANGER_COLOR, onClick: () => this.buildHomeButtons() }))
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
      const result = await this.onlineManager.createRoom({ boardType: this.boardType, rows: this.rows, cols: this.cols, nickname: this.getNickname() })
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
    const w = this.width - 40
    const h = 58
    this.buttons.push(this.createCard({ x: cx - w / 2, y: 260, width: w, height: h, text: T.inputRoomId, accentColor: BRAND_COLOR, onClick: () => this.promptRoomId() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: 335, width: w, height: h, text: T.joinRoom, accentColor: BRAND_COLOR, onClick: () => this.joinFriendRoom() }))
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
    const w = this.width - 40
    const h = 58
    this.buttons.push(this.createCard({ x: cx - w / 2, y: 300, width: w, height: h, text: T.share, accentColor: BRAND_COLOR, onClick: () => this.shareRoom() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: 375, width: w, height: h, text: T.copy, accentColor: BRAND_COLOR, onClick: () => this.copyRoomId() }))
    this.buttons.push(this.createCard({ x: cx - w / 2, y: 450, width: w, height: h, text: T.cancel, accentColor: DANGER_COLOR, onClick: () => this.cancelRoom() }))
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
      onlineManager: this.onlineManager,
      userManager: this.userManager
    }))
  }

  applyRoomBoard(board) {
    if (!board) return
    if (board.boardType) this.boardType = board.boardType
    if (board.rows) this.rows = board.rows
    if (board.cols) this.cols = board.cols
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
    ctx.fillStyle = '#222222'
    ctx.font = 'bold 28px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(T.title, this.width / 2, 120)
  }

  drawStatus() {
    const ctx = this.ctx
    ctx.fillStyle = '#777777'
    ctx.font = '15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.statusText, this.width / 2, 175)
  }

  drawRoomInfo() {
    if (!this.roomId && !this.inputRoomId) return
    const ctx = this.ctx
    ctx.fillStyle = '#222222'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.roomId ? `${T.roomIdLabel}${this.roomId}` : `${T.joiningLabel}${this.inputRoomId}`, this.width / 2, 215)
  }

  drawBackButton() {
    const ctx = this.ctx
    const b = this.backButton
    ctx.save()
    this.roundRect(ctx, b.x, b.y, b.width, b.height, 8)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.fillStyle = '#444444'
    ctx.font = 'bold 15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(T.back, b.x + b.width / 2, b.y + b.height / 2)
    ctx.restore()
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
        this.roundRect(ctx, x, y, width, height, 6)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        this.roundRect(ctx, x, y, 6, height, 6)
        ctx.fillStyle = accentColor
        ctx.fill()
        ctx.fillStyle = '#222222'
        ctx.font = 'bold 17px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, x + width / 2, y + height / 2)
        ctx.restore()
      }
    }
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
