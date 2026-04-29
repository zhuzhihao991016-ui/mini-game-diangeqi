import GameApp from './src/main/GameApp'
import NetManager from './src/Network/NetManager'
import RoomManager from './src/Network/RoomManager'
import FrameSyncManager from './src/Network/FrameSyncManager'
import { MessageType } from './src/Network/SyncProtocol'

const windowInfo = wx.getWindowInfo()

const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')

const dpr = windowInfo.pixelRatio || 1
const width = windowInfo.windowWidth
const height = windowInfo.windowHeight

canvas.width = Math.floor(width * dpr)
canvas.height = Math.floor(height * dpr)

const CLOUD_ENV_ID = 'prod-d8go30yrm27b9e5e5'
const CLOUD_SERVICE_NAME = 'express-al2u'
const CLOUD_WS_PATH = '/ws'

wx.cloud.init({
  env: CLOUD_ENV_ID
})

const app = new GameApp(canvas, ctx, {
  width,
  height,
  dpr
})

app.start()

const netManager = new NetManager({
  envId: CLOUD_ENV_ID,
  serviceName: CLOUD_SERVICE_NAME,
  path: CLOUD_WS_PATH
})

const roomManager = new RoomManager(netManager)

const frameSyncManager = new FrameSyncManager({
  roomManager,
  gameApp: app
})

// 方便真机调试时在控制台手动调用
wx.__netManager = netManager
wx.__roomManager = roomManager
wx.__frameSyncManager = frameSyncManager

netManager.on('open', () => {
  console.log('联机 WebSocket 已打开')
})

netManager.on(MessageType.CONNECTED, payload => {
  console.log('联机服务已连接，playerId:', payload.playerId)
})

roomManager.on(MessageType.ROOM_CREATED, payload => {
  console.log('房间创建成功:', payload.roomId)
})

roomManager.on(MessageType.ROOM_JOINED, payload => {
  console.log('加入房间成功:', payload.roomId)
})

roomManager.on(MessageType.ROOM_STATE, payload => {
  console.log('房间状态:', payload)
})

roomManager.on(MessageType.EDGE_CLAIMED, payload => {
  console.log('边被占用:', payload)
})

roomManager.on(MessageType.GAME_OVER, payload => {
  console.log('游戏结束:', payload)
})

roomManager.on(MessageType.ERROR, payload => {
  console.error('联机错误:', payload)
})

netManager.connect().then(() => {
  console.log('NetManager connected')

  // 调试阶段不要自动创建房间，否则两台手机都会各自创建房间。
  // 用真机控制台手动执行：
  // wx.__roomManager.createRoom('玩家A')
  // wx.__roomManager.joinRoom('123456', '玩家B')
  // wx.__roomManager.ready()
  // wx.__roomManager.claimEdge('h-0-0')
}).catch(err => {
  console.error('NetManager connect failed:', err)
})