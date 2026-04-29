import BaseScene from './BaseScene'
import MenuScene from './MenuScene'
import BattleScene from './BattleScene'
import Button from '../ui/Button'

const BRAND_COLOR = '#4A90E2'
const DANGER_COLOR = '#E24A4A'

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
    onlineManager = null
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

    this.page = 'home'
    this.statusText = '请选择联机方式'
    this.roomId = ''
    this.inputRoomId = ''

    this.buttons = []

    this.onlineManager = onlineManager || wx.__roomManager || null
    this.onlineEventsBound = false
    this.active = true
    this.enteredBattle = false

    this.backButton = {
      x: 20,
      y: 20,
      width: 110,
      height: 40
    }
  }

  onEnter() {
    this.active = true
    this.enteredBattle = false
  
    this.inputManager.clearTouchStartHandlers()
  
    if (typeof this.enableShareMenu === 'function') {
      this.enableShareMenu()
    }
  
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
  
    // 1. 优先处理别人分享来的房间号
    const pendingRoomId = wx.getStorageSync('pending_join_room_id')
  
    if (pendingRoomId) {
      wx.removeStorageSync('pending_join_room_id')
  
      this.inputRoomId = String(pendingRoomId)
      this.roomId = ''
      this.page = 'join'
      this.statusText = `收到好友邀请，房间号：${this.inputRoomId}`
  
      this.showInviteJoinButtons()
      return
    }
  
    // 2. 再处理自己之前创建 / 加入过的房间
    const lastRoomId = wx.getStorageSync('dots_last_room_id')
  
    if (lastRoomId) {
      this.restoreLastRoom(String(lastRoomId))
      return
    }
  
    // 3. 没有待加入房间，也没有本地房间，才回首页
    this.buildHomeButtons()
  }

  enableShareMenu() {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: true
      })
    }
  
    if (wx.onShareAppMessage) {
      wx.onShareAppMessage(() => {
        const roomId = this.roomId || ''
  
        if (roomId) {
          return {
            title: `我在玩点格棋，房间号 ${roomId}，快来对战！`,
            query: `roomId=${encodeURIComponent(roomId)}&from=menu_share`,
            imageUrl: ''
          }
        }
  
        return {
          title: '一起来玩点格棋！',
          query: 'from=menu_share',
          imageUrl: ''
        }
      })
    }
  }

  showInviteJoinButtons() {
    this.buttons = []
  
    const cx = this.width / 2
    const w = this.width - 40
    const h = 58
  
    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: 300,
      width: w,
      height: h,
      text: '加入好友房',
      accentColor: BRAND_COLOR,
      onClick: () => this.joinFriendRoom()
    }))
  
    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: 375,
      width: w,
      height: h,
      text: '返回',
      accentColor: DANGER_COLOR,
      onClick: () => this.buildHomeButtons()
    }))
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

    for (const button of this.buttons) {
      button.draw(ctx)
    }
  }

  buildHomeButtons() {
    this.page = 'home'
    this.statusText = '请选择联机方式'
    this.buttons = []

    const cx = this.width / 2
    const w = this.width - 40
    const h = 58

    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: 230,
      width: w,
      height: h,
      text: '创建好友房',
      accentColor: BRAND_COLOR,
      onClick: () => this.createFriendRoom()
    }))

    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: 305,
      width: w,
      height: h,
      text: '加入好友房',
      accentColor: BRAND_COLOR,
      onClick: () => this.showJoinInput()
    }))
  }

  async createFriendRoom() {
    try {
      if (!this.onlineManager) {
        this.statusText = '联机模块未初始化'
        return
      }
  
      this.page = 'waiting'
      this.buttons = []
      this.statusText = '正在创建房间...'
  
      this.bindOnlineManagerEvents()
  
      const result = await this.onlineManager.createRoom({
        nickname: '玩家'
      })
  
      this.roomId = result.roomId
      this.statusText = '房间已创建，等待好友加入'
  
      this.buildWaitingButtons()
    } catch (err) {
      console.error(err)
      this.statusText = '创建失败，请稍后重试'
      this.buildHomeButtons()
    }
  }

  showJoinInput() {
    this.page = 'join'
    this.statusText = '请输入好友发来的房间号'
    this.buttons = []

    const cx = this.width / 2
    const w = this.width - 40
    const h = 58

    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: 260,
      width: w,
      height: h,
      text: '输入房间号',
      accentColor: BRAND_COLOR,
      onClick: () => this.promptRoomId()
    }))

    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: 335,
      width: w,
      height: h,
      text: '加入房间',
      accentColor: BRAND_COLOR,
      onClick: () => this.joinFriendRoom()
    }))
  }

  promptRoomId() {
    wx.showModal({
      title: '输入房间号',
      editable: true,
      placeholderText: '请输入 roomId',
      success: res => {
        if (res.confirm && res.content) {
          this.inputRoomId = String(res.content).trim()
          this.statusText = `已输入房间号：${this.inputRoomId}`
        }
      }
    })
  }

  async joinFriendRoom() {
    if (!this.inputRoomId) {
      this.statusText = '请先输入房间号'
      return
    }
  
    try {
      if (!this.onlineManager) {
        this.statusText = '联机模块未初始化'
        return
      }
  
      this.page = 'joining'
      this.buttons = []
      this.statusText = '正在加入房间...'
  
      this.bindOnlineManagerEvents()
  
      const result = await this.onlineManager.joinRoom({
        roomId: this.inputRoomId,
        nickname: '玩家'
      })
  
      this.roomId = result.roomId
      this.statusText = '加入成功，等待双方准备'
  
      this.tryEnterBattle()
    } catch (err) {
      console.error(err)
      this.statusText = '加入失败，请检查房间号'
      this.showJoinInput()
    }
  }

  buildWaitingButtons() {
    this.buttons = []
  
    const cx = this.width / 2
    const w = this.width - 40
    const h = 58
  
    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: 300,
      width: w,
      height: h,
      text: '微信邀请好友',
      accentColor: BRAND_COLOR,
      onClick: () => this.shareRoom()
    }))
  
    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: 375,
      width: w,
      height: h,
      text: '复制房间号',
      accentColor: BRAND_COLOR,
      onClick: () => this.copyRoomId()
    }))
  
    this.buttons.push(this.createCard({
      x: cx - w / 2,
      y: 450,
      width: w,
      height: h,
      text: '取消房间',
      accentColor: DANGER_COLOR,
      onClick: () => this.cancelRoom()
    }))
  }

  shareRoom() {
    if (!this.roomId) {
      this.statusText = '房间号不存在，无法邀请'
      return
    }
  
    if (!wx.shareAppMessage) {
      this.statusText = '当前微信版本不支持分享'
      return
    }
  
    wx.shareAppMessage({
      title: `我在玩点格棋，房间号 ${this.roomId}，快来对战！`,
      query: `roomId=${encodeURIComponent(this.roomId)}&from=share`,
      imageUrl: ''
    })
  
    this.statusText = '已打开微信邀请面板'
  }

  copyRoomId() {
    if (!this.roomId) return

    wx.setClipboardData({
      data: this.roomId,
      success: () => {
        this.statusText = '房间号已复制，发给好友即可'
      }
    })
  }

  cancelRoom() {
    if (this.onlineManager && !this.enteredBattle) {
      this.onlineManager.leaveRoom()
    }
  
    this.roomId = ''
    this.inputRoomId = ''
  
    this.buildHomeButtons()
  }

  bindOnlineManagerEvents() {
    if (!this.onlineManager || this.onlineEventsBound) return
  
    this.onlineEventsBound = true
  
    this.onlineManager.onRoomUpdate(roomState => {
      if (!this.active || this.enteredBattle) return
      if (!roomState) return
    
      if (roomState.roomId) {
        this.roomId = roomState.roomId
      }
    
      if (roomState.phase === 'waiting') {
        const players = roomState.players || []
    
        if (players.length < 2) {
          this.page = 'waiting'
          this.statusText = '房间已恢复，等待好友加入'
          this.buildWaitingButtons()
          return
        }
    
        this.statusText = '好友已加入，正在准备...'
      }
    
      this.tryEnterBattle()
    })
  
    this.onlineManager.onReady(() => {
      if (!this.active || this.enteredBattle) return
      this.enterBattle()
    })
  
    this.onlineManager.onError(err => {
      if (!this.active || this.enteredBattle) return
  
      console.error(err)
  
      if (err && err.message) {
        this.statusText = err.message
      } else if (err && err.code) {
        this.statusText = `联机异常：${err.code}`
      } else {
        this.statusText = '联机异常，请返回重试'
      }
    })
  }

  restoreLastRoom(roomId) {
    this.roomId = roomId
    this.inputRoomId = ''
    this.page = 'waiting'
    this.statusText = '正在恢复房间...'
  
    this.buildWaitingButtons()
  
    if (!this.onlineManager) {
      this.statusText = '联机模块未初始化'
      return
    }
  
    // 如果 RoomManager 已经有房间状态，直接尝试恢复界面
    if (this.onlineManager.roomState && this.onlineManager.roomState.roomId === roomId) {
      const phase = this.onlineManager.roomState.phase
  
      if (phase === 'waiting') {
        this.statusText = '房间已恢复，等待好友加入'
        return
      }
  
      if (phase === 'playing') {
        this.tryEnterBattle()
        return
      }
  
      if (phase === 'finished') {
        this.statusText = '上一局已结束'
        return
      }
    }
  
    // 如果 WebSocket 已断开，触发重连。
    // NetManager 重连成功后会发送 HELLO { clientKey, roomId }。
    if (
      this.onlineManager.netManager &&
      !this.onlineManager.netManager.connected &&
      typeof this.onlineManager.netManager.connect === 'function'
    ) {
      this.onlineManager.netManager.connect().catch(err => {
        console.error('恢复房间重连失败:', err)
        this.statusText = '恢复房间失败，请重新创建或加入'
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
    this.statusText = '等待好友加入...'
    return
  }

  if (roomInfo.phase === 'playing') {
    this.enterBattle()
    return
  }

  // 关键修复：
  // 房间已经结束时，OnlineRoomScene 不能再发送 PLAYER_READY。
  if (roomInfo.phase === 'finished') {
    return
  }

  if (roomInfo.phase !== 'waiting') {
    return
  }

  this.statusText = '好友已加入，正在准备...'

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
    onlineManager: this.onlineManager
  }))
}

  getRoomType() {
    if (this.boardType === 'hex') {
      return 'dots_hex_r3'
    }

    return `dots_square_${this.rows}x${this.cols}`
  }

  getOpenId() {
    return new Promise(resolve => {
      // 临时调试用。
      // 正式上线时，建议替换为你自己的登录 openId。
      let openId = wx.getStorageSync('debug_openid')

      if (!openId) {
        openId = `debug_${Math.random().toString(36).slice(2)}`
        wx.setStorageSync('debug_openid', openId)
      }

      resolve(openId)
    })
  }

  back() {
    if (this.page === 'home') {
      this.sceneManager.setScene(new MenuScene({
        canvas: this.canvas,
        ctx: this.ctx,
        inputManager: this.inputManager,
        sceneManager: this.sceneManager,
        width: this.width,
        height: this.height
      }))

      return
    }

    this.cancelRoom()
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

  drawTitle() {
    const ctx = this.ctx

    ctx.fillStyle = '#222'
    ctx.font = 'bold 28px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('好友房', this.width / 2, 120)
  }

  drawStatus() {
    const ctx = this.ctx

    ctx.fillStyle = '#777'
    ctx.font = '15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.statusText, this.width / 2, 175)
  }

  drawRoomInfo() {
    if (!this.roomId && !this.inputRoomId) return

    const ctx = this.ctx

    ctx.fillStyle = '#222'
    ctx.font = 'bold 18px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (this.roomId) {
      ctx.fillText(`房间号：${this.roomId}`, this.width / 2, 215)
    } else if (this.inputRoomId) {
      ctx.fillText(`准备加入：${this.inputRoomId}`, this.width / 2, 215)
    }
  }

  drawBackButton() {
    const ctx = this.ctx
    const b = this.backButton

    ctx.save()

    ctx.fillStyle = '#FFFFFF'
    this.roundRect(ctx, b.x, b.y, b.width, b.height, 8)
    ctx.fill()

    ctx.fillStyle = '#444'
    ctx.font = 'bold 15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('← 返回', b.x + b.width / 2, b.y + b.height / 2)

    ctx.restore()
  }

  createCard({ x, y, width, height, text, accentColor, onClick }) {
    const self = this

    return {
      hitTest(px, py) {
        return px >= x && px <= x + width && py >= y && py <= y + height
      },

      click() {
        onClick()
      },

      draw(ctx) {
        ctx.save()

        self.roundRect(ctx, x, y, width, height, 6)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()

        ctx.fillStyle = accentColor
        self.roundRect(ctx, x, y, 6, height, 6)
        ctx.fill()

        ctx.fillStyle = '#222'
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