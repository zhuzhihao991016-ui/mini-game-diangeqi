import EventEmitter from '../utils/EventEmitter'
import SyncProtocol, { MessageType } from './SyncProtocol'

function createLocalId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function getStableClientKey() {
  let clientKey = wx.getStorageSync('dots_client_key')

  if (!clientKey) {
    clientKey = createLocalId('ck')
    wx.setStorageSync('dots_client_key', clientKey)
  }

  return clientKey
}

export default class NetManager extends EventEmitter {
  constructor(options = {}) {
    super()

    this.envId = options.envId || ''
    this.serviceName = options.serviceName || ''
    this.path = options.path || '/ws'

    this.socketTask = null
    this.connected = false
    this.connecting = false

    this.playerId = null
    this.clientKey = getStableClientKey()

    this.heartbeatTimer = null
    this.heartbeatInterval = options.heartbeatInterval || 10000

    this.autoReconnect = options.autoReconnect !== false
    this.reconnectTimer = null
    this.reconnectDelay = options.reconnectDelay || 1200
    this.maxReconnectDelay = options.maxReconnectDelay || 8000
    this.currentReconnectDelay = this.reconnectDelay

    this.manualClosed = false
  }

  connect() {
    if (this.connected) {
      return Promise.resolve()
    }

    if (this.connecting) {
      return Promise.resolve()
    }

    this.manualClosed = false
    this.connecting = true

    console.log('准备连接云托管 WebSocket:', {
      env: this.envId,
      service: this.serviceName,
      path: this.path
    })

    return new Promise((resolve, reject) => {
      wx.cloud.connectContainer({
        config: {
          env: this.envId
        },
        service: this.serviceName,
        path: this.path,

        success: res => {
          console.log('connectContainer success:', res)

          this.socketTask = res.socketTask

          this.socketTask.onOpen(() => {
            this.connected = true
            this.connecting = false
            this.currentReconnectDelay = this.reconnectDelay

            console.log('WebSocket 连接成功')

            this.startHeartbeat()
            this.emit('open')

            // 关键：连接建立后，立刻向服务端声明稳定身份。
            this.sendHello()

            resolve()
          })

          this.socketTask.onMessage(res => {
            this.handleRawMessage(res.data)
          })

          this.socketTask.onError(err => {
            console.error('WebSocket 错误：', err)

            this.emit('error', err)
          })

          this.socketTask.onClose(res => {
            console.log('WebSocket 已关闭：', res)

            this.connected = false
            this.connecting = false
            this.socketTask = null

            this.stopHeartbeat()
            this.emit('close', res)

            if (this.autoReconnect && !this.manualClosed) {
              this.scheduleReconnect()
            }
          })
        },

        fail: err => {
          console.error('connectContainer fail:', err)

          this.connected = false
          this.connecting = false

          reject(err)
          this.emit('error', err)

          if (this.autoReconnect && !this.manualClosed) {
            this.scheduleReconnect()
          }
        }
      })
    })
  }

  sendHello() {
    const roomId = this.getLastRoomId()

    this.send(MessageType.HELLO, {
      clientKey: this.clientKey,
      roomId
    })
  }

  handleRawMessage(raw) {
    const msg = SyncProtocol.decodeMessage(raw)

    if (!msg) {
      console.warn('收到无法解析的网络消息:', raw)
      return
    }

    console.log('收到服务端消息:', msg)

    if (msg.type === MessageType.CONNECTED) {
      this.playerId = msg.payload.playerId
    }

    if (msg.type === MessageType.ROOM_RESUMED) {
      this.playerId = msg.payload.playerId || this.playerId

      if (msg.payload.roomId) {
        this.setLastRoomId(msg.payload.roomId)
      }
    }

    if (msg.type === MessageType.ROOM_CREATED || msg.type === MessageType.ROOM_JOINED) {
      if (msg.payload.roomId) {
        this.setLastRoomId(msg.payload.roomId)
      }

      if (msg.payload.playerId) {
        this.playerId = msg.payload.playerId
      }
    }

    if (msg.type === MessageType.LEFT_ROOM) {
      this.clearLastRoomId()
    }

    this.emit(msg.type, msg.payload)
    this.emit('message', msg)
  }

  send(type, payload = {}) {
    if (!this.socketTask || !this.connected) {
      console.warn('WebSocket 未连接，发送失败:', type, payload)
      return false
    }

    this.socketTask.send({
      data: SyncProtocol.encodeMessage(type, payload),
      fail: err => {
        console.error('WebSocket 发送失败:', type, err)
        this.emit('error', err)
      }
    })

    return true
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return

    const delay = this.currentReconnectDelay

    console.log(`准备重连 WebSocket，延迟 ${delay}ms`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null

      this.connect().catch(err => {
        console.error('WebSocket 重连失败:', err)
      })

      this.currentReconnectDelay = Math.min(
        this.currentReconnectDelay * 1.5,
        this.maxReconnectDelay
      )
    }, delay)
  }

  startHeartbeat() {
    this.stopHeartbeat()

    this.heartbeatTimer = setInterval(() => {
      this.send(MessageType.PING, {
        time: Date.now()
      })
    }, this.heartbeatInterval)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  getLastRoomId() {
    return wx.getStorageSync('dots_last_room_id') || ''
  }

  setLastRoomId(roomId) {
    if (!roomId) return

    wx.setStorageSync('dots_last_room_id', String(roomId))
  }

  clearLastRoomId() {
    wx.removeStorageSync('dots_last_room_id')
  }

  close(options = {}) {
    const manual = options.manual !== false

    this.manualClosed = manual

    this.stopHeartbeat()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socketTask) {
      this.socketTask.close({})
      this.socketTask = null
    }

    this.connected = false
    this.connecting = false
  }
}