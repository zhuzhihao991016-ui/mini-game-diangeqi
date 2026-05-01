import EventEmitter from '../utils/EventEmitter'
import { MessageType } from './SyncProtocol'

export default class RoomManager extends EventEmitter {
  constructor(netManager) {
    super()

    this.netManager = netManager

    this.roomId = null
    this.playerId = null
    this.roomState = null

    // 兼容旧 OnlineRoomScene 的 this.onlineManager.room.roomInfo.playerList
    this.room = null

    this.waiters = {}

    this.bindNetEvents()
  }

  bindNetEvents() {
    this.netManager.on(MessageType.CONNECTED, payload => {
      this.playerId = payload.playerId
      this.emit(MessageType.CONNECTED, payload)
    })

    this.netManager.on(MessageType.ROOM_CREATED, payload => {
      this.roomId = payload.roomId
      this.playerId = payload.playerId || this.playerId

      this.resolveWaiter(MessageType.ROOM_CREATED, payload)
      this.emit(MessageType.ROOM_CREATED, payload)
    })

    this.netManager.on(MessageType.ROOM_JOINED, payload => {
      this.roomId = payload.roomId
      this.playerId = payload.playerId || this.playerId

      this.resolveWaiter(MessageType.ROOM_JOINED, payload)
      this.emit(MessageType.ROOM_JOINED, payload)
    })

    this.netManager.on(MessageType.ROOM_STATE, payload => {
      this.roomState = payload

      if (payload && payload.roomId) {
        this.roomId = payload.roomId
      }

      this.updateLegacyRoom(payload)

      this.emit(MessageType.ROOM_STATE, payload)
      this.emit('roomUpdate', payload)

      if (payload && payload.phase === 'playing') {
        this.emit('ready', payload)
      }
    })

    this.netManager.on(MessageType.PLAYER_JOINED, payload => {
      this.emit(MessageType.PLAYER_JOINED, payload)
    })

    this.netManager.on(MessageType.PLAYER_LEFT, payload => {
      this.emit(MessageType.PLAYER_LEFT, payload)
    })

    this.netManager.on(MessageType.EDGE_CLAIMED, payload => {
      this.emit(MessageType.EDGE_CLAIMED, payload)

      // 兼容 BattleScene 旧的 onFrame(({ inputs }) => ...)
      this.emit('frame', {
        inputs: [
          {
            type: 'CLICK_EDGE',
            edgeId: payload.edgeId,
            playerId: this.toLocalGamePlayerId(payload.playerId),
            remotePlayerId: payload.playerId,
            completedBoxes: payload.completedBoxes || []
          }
        ]
      })
    })

    this.netManager.on(MessageType.GAME_OVER, payload => {
      this.emit(MessageType.GAME_OVER, payload)
    })

    this.netManager.on(MessageType.REMATCH_VOTE, payload => {
      this.emit(MessageType.REMATCH_VOTE, payload)
      this.emit('rematchVote', payload)
    })

    this.netManager.on(MessageType.UNDO_VOTE, payload => {
      this.emit(MessageType.UNDO_VOTE, payload)
      this.emit('undoVote', payload)
    })

    this.netManager.on(MessageType.ROOM_UNDO, payload => {
      this.emit(MessageType.ROOM_UNDO, payload)
      this.emit('roomUndo', payload)
    })
    
    this.netManager.on(MessageType.ROOM_RESET, payload => {
      this.emit(MessageType.ROOM_RESET, payload)
      this.emit('roomReset', payload)
    })

    this.netManager.on(MessageType.ROOM_RESUMED, payload => {
      this.roomId = payload.roomId
      this.playerId = payload.playerId || this.playerId
    
      this.emit(MessageType.ROOM_RESUMED, payload)
    })

    this.netManager.on(MessageType.LEFT_ROOM, payload => {
      this.roomId = null
      this.roomState = null
      this.room = null

      wx.removeStorageSync('dots_last_room_id')

      this.emit(MessageType.LEFT_ROOM, payload)
    })

    this.netManager.on(MessageType.ERROR, payload => {
      this.rejectAllWaiters(payload)
      this.emit(MessageType.ERROR, payload)
      this.emit('error', payload)
    })

    this.netManager.on('close', payload => {
      this.emit('close', payload)
    })
  }

  updateLegacyRoom(roomState) {
    if (!roomState) {
      this.room = null
      return
    }

    this.room = {
      roomId: roomState.roomId,
      roomInfo: {
        roomId: roomState.roomId,
        phase: roomState.phase,
        board: roomState.board || null,
        currentTurnPlayerId: roomState.currentTurnPlayerId,
        playerList: (roomState.players || []).map(player => ({
          playerId: player.playerId,
          nickname: player.nickname,
          seat: player.seat,
          ready: player.ready,
          online: player.online
        }))
      }
    }
  }

  waitFor(type, timeout = 8000) {
    return new Promise((resolve, reject) => {
      if (!this.waiters[type]) {
        this.waiters[type] = []
      }

      const timer = setTimeout(() => {
        this.waiters[type] = (this.waiters[type] || []).filter(item => item.resolve !== resolve)
        reject(new Error(`${type} timeout`))
      }, timeout)

      this.waiters[type].push({
        resolve,
        reject,
        timer
      })
    })
  }

  resolveWaiter(type, payload) {
    const list = this.waiters[type]

    if (!list || list.length === 0) return

    const waiter = list.shift()

    clearTimeout(waiter.timer)
    waiter.resolve(payload)
  }

  rejectAllWaiters(error) {
    Object.keys(this.waiters).forEach(type => {
      const list = this.waiters[type] || []

      for (const waiter of list) {
        clearTimeout(waiter.timer)
        waiter.reject(error)
      }

      this.waiters[type] = []
    })
  }

  createRoom(options = {}) {
    const waiter = this.waitFor(MessageType.ROOM_CREATED)
    const nickname = options.nickname || '玩家1'

    this.netManager.send(MessageType.CREATE_ROOM, {
      nickname,
      boardType: options.boardType || 'square',
      rows: options.rows || 3,
      cols: options.cols || 3,
      isFunMode: !!options.isFunMode
    })

    return waiter
  }

  joinRoom(options = {}) {
    const waiter = this.waitFor(MessageType.ROOM_JOINED)
    const roomId = String(options.roomId || '')
    const nickname = options.nickname || '玩家2'

    this.netManager.send(MessageType.JOIN_ROOM, {
      roomId,
      nickname
    })

    return waiter
  }

  ready() {
    if (!this.roomId) {
      console.warn('当前没有房间，无法 ready')
      return
    }

    this.netManager.send(MessageType.PLAYER_READY, {
      roomId: this.roomId
    })
  }

  startFrameSync() {
    // 兼容旧 OnlineRoomScene。
    // 这里的“开始帧同步”实际就是告诉服务端：我已准备。
    this.ready()
  }

  claimEdge(edgeId) {
    if (!this.roomId) {
      console.warn('当前没有房间，无法 claimEdge')
      return
    }

    this.netManager.send(MessageType.CLAIM_EDGE, {
      roomId: this.roomId,
      edgeId
    })
  }

  sendInput(input) {
    if (!input) return

    if (input.type === 'CLICK_EDGE') {
      this.claimEdge(input.edgeId)
    }
  }

  requestRematch() {
    if (!this.roomId) {
      console.warn('当前没有房间，无法 requestRematch')
      return
    }
  
    this.netManager.send(MessageType.REMATCH_REQUEST, {
      roomId: this.roomId
    })
  }

  requestUndo() {
    if (!this.roomId) {
      console.warn('当前没有房间，无法 requestUndo')
      return
    }

    this.netManager.send(MessageType.UNDO_REQUEST, {
      roomId: this.roomId
    })
  }

  leaveRoom() {
    if (!this.roomId) return

    this.netManager.send(MessageType.LEAVE_ROOM, {
      roomId: this.roomId
    })
  }

  onRoomUpdate(callback) {
    return this.on('roomUpdate', callback)
  }

  onReady(callback) {
    return this.on('ready', callback)
  }

  onFrame(callback) {
    return this.on('frame', callback)
  }

  onRematchVote(callback) {
    return this.on('rematchVote', callback)
  }

  onUndoVote(callback) {
    return this.on('undoVote', callback)
  }

  onRoomUndo(callback) {
    return this.on('roomUndo', callback)
  }
  
  onRoomReset(callback) {
    return this.on('roomReset', callback)
  }

  onError(callback) {
    return this.on('error', callback)
  }

  isMyTurn() {
    if (!this.roomState || !this.playerId) return false

    return this.roomState.currentTurnPlayerId === this.playerId
  }

  getMyPlayer() {
    if (!this.roomState || !this.playerId) return null

    return (this.roomState.players || []).find(player => {
      return player.playerId === this.playerId
    }) || null
  }

  getOpponentPlayer() {
    if (!this.roomState || !this.playerId) return null

    return (this.roomState.players || []).find(player => {
      return player.playerId !== this.playerId
    }) || null
  }

  getPlayerSeat(playerId) {
    if (!this.roomState || !this.roomState.players) return null

    const player = this.roomState.players.find(item => {
      return item.playerId === playerId
    })

    return player ? player.seat : null
  }

  toLocalGamePlayerId(serverPlayerId) {
    const seat = this.getPlayerSeat(serverPlayerId)

    if (seat === 1) return 'p1'
    if (seat === 2) return 'p2'

    return 'p1'
  }

  getLocalGamePlayerId() {
    return this.toLocalGamePlayerId(this.playerId)
  }

  getCurrentGamePlayerId() {
    if (!this.roomState) return 'p1'

    return this.toLocalGamePlayerId(this.roomState.currentTurnPlayerId)
  }
}
