import EventEmitter from '../utils/EventEmitter'
import { MessageType } from './SyncProtocol'

export default class FrameSyncManager extends EventEmitter {
  constructor(options = {}) {
    super()

    this.roomManager = options.roomManager || null
    this.gameApp = options.gameApp || null

    this.latestRoomState = null

    if (this.roomManager) {
      this.bindRoomManager(this.roomManager)
    }
  }

  bindRoomManager(roomManager) {
    this.roomManager = roomManager

    roomManager.on(MessageType.ROOM_STATE, roomState => {
      this.applyRoomState(roomState)
    })

    roomManager.on(MessageType.EDGE_CLAIMED, payload => {
      this.applyEdgeClaimed(payload)
    })

    roomManager.on(MessageType.GAME_OVER, payload => {
      this.applyGameOver(payload)
    })
  }

  bindGameApp(gameApp) {
    this.gameApp = gameApp
  }

  applyRoomState(roomState) {
    this.latestRoomState = roomState

    console.log('FrameSyncManager applyRoomState:', roomState)

    if (this.gameApp && typeof this.gameApp.applyOnlineRoomState === 'function') {
      this.gameApp.applyOnlineRoomState(roomState)
    }

    this.emit(MessageType.ROOM_STATE, roomState)
  }

  applyEdgeClaimed(payload) {
    console.log('FrameSyncManager applyEdgeClaimed:', payload)

    if (this.gameApp && typeof this.gameApp.applyOnlineEdgeClaimed === 'function') {
      this.gameApp.applyOnlineEdgeClaimed(payload)
    }

    this.emit(MessageType.EDGE_CLAIMED, payload)
  }

  applyGameOver(payload) {
    console.log('FrameSyncManager applyGameOver:', payload)

    if (this.gameApp && typeof this.gameApp.applyOnlineGameOver === 'function') {
      this.gameApp.applyOnlineGameOver(payload)
    }

    this.emit(MessageType.GAME_OVER, payload)
  }

  claimEdge(edgeId) {
    if (!this.roomManager) {
      console.warn('FrameSyncManager 未绑定 RoomManager')
      return
    }

    this.roomManager.claimEdge(edgeId)
  }
}