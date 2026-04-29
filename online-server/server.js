const express = require('express')
const expressWs = require('express-ws')
const https = require('https')
let mysql = null

try {
  mysql = require('mysql2/promise')
} catch (err) {
  console.warn('mysql2 unavailable, leaderboard will use memory fallback:', err.message)
}

const app = express()
expressWs(app)
app.use(express.json())

const PORT = process.env.PORT || 80
const WECHAT_APPID = process.env.WECHAT_APPID || ''
const WECHAT_SECRET = process.env.WECHAT_SECRET || ''
const MYSQL_HOST = process.env.MYSQL_HOST || '10.3.106.236'
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306)
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'dots_game'
const MYSQL_USER = process.env.MYSQL_USER || 'root'
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || ''
const MYSQL_LEADERBOARD_TABLE = normalizeSqlIdentifier(
  process.env.MYSQL_LEADERBOARD_TABLE || 'inferno_3x3_leaderboard',
  'inferno_3x3_leaderboard'
)

const DEFAULT_BOARD_ROWS = 3
const DEFAULT_BOARD_COLS = 3
const SUPPORTED_BOARD_SIZES = new Set(['3x3', '6x6'])

const DISCONNECT_GRACE_MS = 90 * 1000
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000

const rooms = new Map()
const clients = new Map()
const clientKeyToPlayerId = new Map()
const usersByOpenId = new Map()
const openIdByPlayerId = new Map()
const infernoLeaderboardRecords = new Map()
const infernoPendingFailures = new Map()
const mysqlPool = initMysqlPool()
let infernoTableReady = false

function normalizeSqlIdentifier(value, fallback) {
  const text = String(value || '').trim()
  return /^[A-Za-z0-9_]+$/.test(text) ? text : fallback
}

function quoteIdentifier(value) {
  return `\`${normalizeSqlIdentifier(value, 'inferno_3x3_leaderboard')}\``
}

function initMysqlPool() {
  if (!mysql) return null

  if (!MYSQL_PASSWORD) {
    console.warn('MYSQL_PASSWORD is not configured, leaderboard will use memory fallback')
    return null
  }

  try {
    return mysql.createPool({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      database: MYSQL_DATABASE,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: 'utf8mb4'
    })
  } catch (err) {
    console.warn('mysql pool init failed, leaderboard will use memory fallback:', err.message)
    return null
  }
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeNickname(value) {
  const nickname = String(value || '').trim()

  if (!nickname) return '玩家'

  return nickname.slice(0, 12)
}

function getOpenIdFromHeaders(req) {
  return (
    req.headers['x-wx-openid'] ||
    req.headers['x-wx-from-openid'] ||
    req.headers['x-cloudbase-openid'] ||
    ''
  )
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let raw = ''

      res.on('data', chunk => {
        raw += chunk
      })

      res.on('end', () => {
        try {
          resolve(JSON.parse(raw))
        } catch (err) {
          reject(err)
        }
      })
    }).on('error', reject)
  })
}

async function resolveOpenId(req, code) {
  const headerOpenId = getOpenIdFromHeaders(req)

  if (headerOpenId) {
    return String(headerOpenId)
  }

  if (code && WECHAT_APPID && WECHAT_SECRET) {
    const url = 'https://api.weixin.qq.com/sns/jscode2session'
      + `?appid=${encodeURIComponent(WECHAT_APPID)}`
      + `&secret=${encodeURIComponent(WECHAT_SECRET)}`
      + `&js_code=${encodeURIComponent(code)}`
      + '&grant_type=authorization_code'

    const data = await getJson(url)

    if (data && data.openid) {
      return String(data.openid)
    }
  }

  return ''
}

function upsertUser({ openId, nickname }) {
  const now = Date.now()
  const current = usersByOpenId.get(openId)

  if (current) {
    current.nickname = normalizeNickname(nickname || current.nickname)
    current.updatedAt = now
    return current
  }

  const user = {
    openId,
    playerId: createId('player'),
    nickname: normalizeNickname(nickname),
    createdAt: now,
    updatedAt: now
  }

  usersByOpenId.set(openId, user)
  openIdByPlayerId.set(user.playerId, openId)

  return user
}

function getUserByPlayerId(playerId) {
  const openId = openIdByPlayerId.get(playerId)

  return openId ? usersByOpenId.get(openId) : null
}

function publicUser(user) {
  return {
    openId: user.openId,
    playerId: user.playerId,
    nickname: user.nickname,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

function getLeaderboardPlayerId(value) {
  return String(value || '').trim().slice(0, 80)
}

function sortInfernoLeaderboardRecords(records) {
  return records
    .slice()
    .sort((a, b) => {
      if (a.failuresBeforeClear !== b.failuresBeforeClear) {
        return a.failuresBeforeClear - b.failuresBeforeClear
      }

      return a.clearedAt - b.clearedAt
    })
}

function publicInfernoLeaderboardRecord(record, index = 0) {
  return {
    rank: index + 1,
    playerId: record.playerId,
    nickname: record.nickname,
    failuresBeforeClear: record.failuresBeforeClear,
    clearedAt: record.clearedAt
  }
}

function getMemoryInfernoLeaderboard(limit = 20) {
  return sortInfernoLeaderboardRecords(Array.from(infernoLeaderboardRecords.values()))
    .slice(0, limit)
    .map(publicInfernoLeaderboardRecord)
}

function recordMemoryInfernoGameResult({ playerId, nickname, won, failuresBeforeClear }) {
  const id = getLeaderboardPlayerId(playerId)

  if (!id) {
    return null
  }

  const user = getUserByPlayerId(id)
  const name = normalizeNickname(nickname || (user && user.nickname) || '')
  const serverFailures = infernoPendingFailures.get(id) || 0
  const clientFailures = Number.isFinite(failuresBeforeClear) && failuresBeforeClear >= 0
    ? Math.floor(failuresBeforeClear)
    : 0
  const failures = Math.max(serverFailures, clientFailures)

  if (!won) {
    infernoPendingFailures.set(id, failures + 1)
    return null
  }

  const now = Date.now()
  const nextRecord = {
    playerId: id,
    nickname: name,
    failuresBeforeClear: failures,
    clearedAt: now
  }
  const current = infernoLeaderboardRecords.get(id)

  if (!current || failures <= current.failuresBeforeClear) {
    infernoLeaderboardRecords.set(id, nextRecord)
  } else if (current.nickname !== name) {
    current.nickname = name
  }

  infernoPendingFailures.set(id, 0)

  return infernoLeaderboardRecords.get(id)
}

function normalizeLeaderboardRow(row) {
  return {
    playerId: getLeaderboardPlayerId(row.player_id || row.playerId),
    nickname: normalizeNickname(row.nickname),
    pendingFailures: Number(row.pending_failures ?? row.pendingFailures) || 0,
    failuresBeforeClear: Number(row.failures_before_clear ?? row.failuresBeforeClear) || 0,
    clearedAt: Number(row.cleared_at ?? row.clearedAt) || 0,
    hasCleared: !!Number(row.has_cleared ?? row.hasCleared),
    createdAt: Number(row.created_at ?? row.createdAt) || Date.now(),
    updatedAt: Number(row.updated_at ?? row.updatedAt) || Date.now()
  }
}

async function ensureInfernoLeaderboardTable() {
  if (!mysqlPool || infernoTableReady) return

  try {
    await mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(MYSQL_LEADERBOARD_TABLE)} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        player_id VARCHAR(80) NOT NULL,
        nickname VARCHAR(24) NOT NULL DEFAULT '玩家',
        pending_failures INT UNSIGNED NOT NULL DEFAULT 0,
        has_cleared TINYINT(1) NOT NULL DEFAULT 0,
        failures_before_clear INT UNSIGNED NOT NULL DEFAULT 0,
        cleared_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_at BIGINT UNSIGNED NOT NULL,
        updated_at BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_player_id (player_id),
        KEY idx_rank (has_cleared, failures_before_clear, cleared_at),
        KEY idx_updated_at (updated_at)
      ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
    `)
    infernoTableReady = true
  } catch (err) {
    console.error('ensure mysql leaderboard table failed:', err)
    throw err
  }
}

async function findInfernoLeaderboardRow(playerId) {
  await ensureInfernoLeaderboardTable()

  if (!mysqlPool) return null

  const [rows] = await mysqlPool.execute(
    `SELECT
      player_id,
      nickname,
      pending_failures,
      has_cleared,
      failures_before_clear,
      cleared_at,
      created_at,
      updated_at
    FROM ${quoteIdentifier(MYSQL_LEADERBOARD_TABLE)}
    WHERE player_id = ?
    LIMIT 1`,
    [playerId]
  )

  return rows.length > 0 ? normalizeLeaderboardRow(rows[0]) : null
}

async function saveInfernoLeaderboardRow(record) {
  await ensureInfernoLeaderboardTable()

  if (!mysqlPool) return null

  await mysqlPool.execute(
    `INSERT INTO ${quoteIdentifier(MYSQL_LEADERBOARD_TABLE)} (
      player_id,
      nickname,
      pending_failures,
      has_cleared,
      failures_before_clear,
      cleared_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      nickname = VALUES(nickname),
      pending_failures = VALUES(pending_failures),
      has_cleared = VALUES(has_cleared),
      failures_before_clear = VALUES(failures_before_clear),
      cleared_at = VALUES(cleared_at),
      updated_at = VALUES(updated_at)`,
    [
      record.playerId,
      record.nickname,
      record.pendingFailures,
      record.hasCleared ? 1 : 0,
      record.failuresBeforeClear,
      record.clearedAt,
      record.createdAt,
      record.updatedAt
    ]
  )

  return record
}

async function getPublicInfernoLeaderboard(limit = 20) {
  if (!mysqlPool) {
    return getMemoryInfernoLeaderboard(limit)
  }

  try {
    await ensureInfernoLeaderboardTable()
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20))
    const [rows] = await mysqlPool.execute(
      `SELECT
        player_id,
        nickname,
        failures_before_clear,
        cleared_at
      FROM ${quoteIdentifier(MYSQL_LEADERBOARD_TABLE)}
      WHERE has_cleared = 1
      ORDER BY failures_before_clear ASC, cleared_at ASC
      LIMIT ${safeLimit}`
    )

    return rows
      .map(normalizeLeaderboardRow)
      .map(publicInfernoLeaderboardRecord)
  } catch (err) {
    console.error('load mysql leaderboard failed, use memory fallback:', err)
    return getMemoryInfernoLeaderboard(limit)
  }
}

async function recordInfernoGameResult(payload) {
  if (!mysqlPool) {
    return recordMemoryInfernoGameResult(payload)
  }

  const id = getLeaderboardPlayerId(payload.playerId)
  if (!id) return null

  try {
    const user = getUserByPlayerId(id)
    const name = normalizeNickname(payload.nickname || (user && user.nickname) || '')
    const current = await findInfernoLeaderboardRow(id)
    const now = Date.now()
    const serverFailures = current ? current.pendingFailures : 0
    const clientFailures = Number.isFinite(payload.failuresBeforeClear) && payload.failuresBeforeClear >= 0
      ? Math.floor(payload.failuresBeforeClear)
      : 0
    const failures = Math.max(serverFailures, clientFailures)

    if (!payload.won) {
      await saveInfernoLeaderboardRow({
        playerId: id,
        nickname: name,
        pendingFailures: failures + 1,
        hasCleared: current ? current.hasCleared : false,
        failuresBeforeClear: current ? current.failuresBeforeClear : 0,
        clearedAt: current ? current.clearedAt : 0,
        createdAt: current ? current.createdAt : now,
        updatedAt: now
      })

      return null
    }

    const shouldReplaceBest = !current || !current.hasCleared || failures <= current.failuresBeforeClear
    const nextRecord = {
      playerId: id,
      nickname: name,
      pendingFailures: 0,
      hasCleared: true,
      failuresBeforeClear: shouldReplaceBest ? failures : current.failuresBeforeClear,
      clearedAt: shouldReplaceBest ? now : current.clearedAt,
      createdAt: current ? current.createdAt : now,
      updatedAt: now
    }
    const saved = await saveInfernoLeaderboardRow(nextRecord)

    return publicInfernoLeaderboardRecord(saved, 0)
  } catch (err) {
    console.error('save mysql leaderboard failed, use memory fallback:', err)
    return recordMemoryInfernoGameResult(payload)
  }
}

function createRoomId() {
  let roomId

  do {
    roomId = String(Math.floor(100000 + Math.random() * 900000))
  } while (rooms.has(roomId))

  return roomId
}

function send(ws, type, payload = {}) {
  if (!ws || ws.readyState !== ws.OPEN) return

  ws.send(JSON.stringify({
    type,
    payload,
    serverTime: Date.now()
  }))
}

function sendError(ws, message, code = 'ERROR') {
  send(ws, 'ERROR', {
    code,
    message
  })
}

function normalizeBoardConfig(payload = {}) {
  const board = payload.board || {}
  const boardType = String(payload.boardType || board.boardType || board.type || 'square')
  const rows = Number(payload.rows || board.rows || DEFAULT_BOARD_ROWS)
  const cols = Number(payload.cols || board.cols || DEFAULT_BOARD_COLS)

  if (boardType !== 'square') {
    return null
  }

  if (!Number.isInteger(rows) || !Number.isInteger(cols)) {
    return null
  }

  if (!SUPPORTED_BOARD_SIZES.has(`${rows}x${cols}`)) {
    return null
  }

  return {
    boardType: 'square',
    rows,
    cols
  }
}

function getBoardPointRows(room) {
  return (room.board && room.board.rows ? room.board.rows : DEFAULT_BOARD_ROWS) + 1
}

function getBoardPointCols(room) {
  return (room.board && room.board.cols ? room.board.cols : DEFAULT_BOARD_COLS) + 1
}

function broadcastRoom(room, type, payload = {}) {
  for (const player of room.players) {
    const client = clients.get(player.playerId)

    if (client && client.ws && client.ws.readyState === client.ws.OPEN) {
      send(client.ws, type, payload)
    }
  }
}

function serializeRoom(room) {
  return {
    roomId: room.roomId,
    phase: room.phase,
    paused: !!room.paused,
    pauseReason: room.pauseReason || '',
    roundIndex: room.roundIndex || 1,
    rematchVotes: Array.from(room.rematchVotes || []),
    players: room.players.map(player => ({
      playerId: player.playerId,
      nickname: player.nickname,
      seat: player.seat,
      ready: player.ready,
      online: player.online
    })),
    currentTurnPlayerId: room.currentTurnPlayerId,
    edges: Array.from(room.edges.entries()).map(([edgeId, ownerPlayerId]) => ({
      edgeId,
      ownerPlayerId
    })),
    boxes: Array.from(room.boxes.entries()).map(([boxId, ownerPlayerId]) => ({
      boxId,
      ownerPlayerId
    })),
    scores: room.scores,
    board: room.board || {
      boardType: 'square',
      rows: DEFAULT_BOARD_ROWS,
      cols: DEFAULT_BOARD_COLS
    }
  }
}

function broadcastRoomState(room) {
  broadcastRoom(room, 'ROOM_STATE', serializeRoom(room))
}

function getRoom(roomId) {
  if (!roomId) return null
  return rooms.get(String(roomId))
}

function getClient(ws) {
  if (!ws || !ws.playerId) return null
  return clients.get(ws.playerId)
}

function findPlayer(room, playerId) {
  return room.players.find(player => player.playerId === playerId)
}

function parseEdgeId(room, edgeId) {
  if (typeof edgeId !== 'string') return null

  const id = edgeId.trim()
  if (!id) return null

  const parts = id.split('_')
  if (parts.length !== 3) return null

  const direction = parts[0]
  const x = Number(parts[1])
  const y = Number(parts[2])

  if (direction !== 'h' && direction !== 'v') return null
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null

  const pointRows = getBoardPointRows(room)
  const pointCols = getBoardPointCols(room)

  // h_x_y：水平边，从点(x,y)到点(x+1,y)
  if (direction === 'h') {
    if (x < 0 || x >= pointCols - 1) return null
    if (y < 0 || y >= pointRows) return null
  }

  // v_x_y：垂直边，从点(x,y)到点(x,y+1)
  if (direction === 'v') {
    if (x < 0 || x >= pointCols) return null
    if (y < 0 || y >= pointRows - 1) return null
  }

  return {
    direction,
    x,
    y
  }
}

function cellId(row, col) {
  return `c_${row}_${col}`
}

function hasEdge(room, edgeId) {
  return room.edges.has(edgeId)
}

function checkBoxCompleted(room, row, col) {
  return (
    hasEdge(room, `h_${col}_${row}`) &&
    hasEdge(room, `h_${col}_${row + 1}`) &&
    hasEdge(room, `v_${col}_${row}`) &&
    hasEdge(room, `v_${col + 1}_${row}`)
  )
}

function getCompletedBoxesAfterClaim(room, edgeId) {
  const parsed = parseEdgeId(room, edgeId)

  if (!parsed) return []

  const completedBoxes = []
  const { direction, x, y } = parsed

  if (direction === 'h') {
    if (y > 0) {
      const row = y - 1
      const col = x
      const id = cellId(row, col)

      if (!room.boxes.has(id) && checkBoxCompleted(room, row, col)) {
        completedBoxes.push(id)
      }
    }

    if (y < getBoardPointRows(room) - 1) {
      const row = y
      const col = x
      const id = cellId(row, col)

      if (!room.boxes.has(id) && checkBoxCompleted(room, row, col)) {
        completedBoxes.push(id)
      }
    }
  }

  if (direction === 'v') {
    if (x > 0) {
      const row = y
      const col = x - 1
      const id = cellId(row, col)

      if (!room.boxes.has(id) && checkBoxCompleted(room, row, col)) {
        completedBoxes.push(id)
      }
    }

    if (x < getBoardPointCols(room) - 1) {
      const row = y
      const col = x
      const id = cellId(row, col)

      if (!room.boxes.has(id) && checkBoxCompleted(room, row, col)) {
        completedBoxes.push(id)
      }
    }
  }

  return completedBoxes
}

function getNextTurnPlayerId(room, currentPlayerId) {
  const onlinePlayers = room.players.filter(player => player.online)

  if (onlinePlayers.length === 0) return null

  const index = onlinePlayers.findIndex(player => player.playerId === currentPlayerId)

  if (index < 0) {
    return onlinePlayers[0].playerId
  }

  return onlinePlayers[(index + 1) % onlinePlayers.length].playerId
}

function isGameOver(room) {
  const pointRows = getBoardPointRows(room)
  const pointCols = getBoardPointCols(room)
  const totalBoxes = (pointRows - 1) * (pointCols - 1)

  const totalEdges =
    pointRows * (pointCols - 1) +
    pointCols * (pointRows - 1)

  // 正常情况：所有格子都被围住
  if (room.boxes.size >= totalBoxes) {
    return true
  }

  // 兜底情况：所有边都被占用
  // 即使服务端围格计算暂时和客户端有偏差，也能正确结束本局。
  if (room.edges.size >= totalEdges) {
    return true
  }

  return false
}

function ensureFinishedIfGameOver(room) {
  if (!room) return false

  if (room.phase === 'finished') {
    return true
  }

  if (!isGameOver(room)) {
    return false
  }

  room.phase = 'finished'
  room.rematchVotes = new Set()
  room.updatedAt = Date.now()

  return true
}

function getWinnerPlayerId(room) {
  let winnerPlayerId = null
  let bestScore = -1
  let tie = false

  for (const player of room.players) {
    const score = room.scores[player.playerId] || 0

    if (score > bestScore) {
      winnerPlayerId = player.playerId
      bestScore = score
      tie = false
    } else if (score === bestScore) {
      tie = true
    }
  }

  return tie ? null : winnerPlayerId
}

function removePlayerFromRoom(playerId, reason = 'leave') {
  const client = clients.get(playerId)

  if (!client || !client.roomId) return

  const room = rooms.get(client.roomId)

  if (!room) {
    client.roomId = null
    return
  }

  const player = findPlayer(room, playerId)

  if (player) {
    player.online = false
    player.ready = false
  }

  client.roomId = null

  broadcastRoom(room, 'PLAYER_LEFT', {
    roomId: room.roomId,
    playerId,
    reason
  })

  const onlinePlayers = room.players.filter(item => item.online)

  if (onlinePlayers.length === 0) {
    rooms.delete(room.roomId)
    console.log('Room removed:', room.roomId)
    return
  }

  if (room.phase === 'playing') {
    room.phase = 'waiting'
    room.currentTurnPlayerId = onlinePlayers[0].playerId
  }

  room.updatedAt = Date.now()
  broadcastRoomState(room)
}

function scheduleRoomCleanup(room) {
  if (!room) return

  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer)
  }

  room.cleanupTimer = setTimeout(() => {
    const latestRoom = rooms.get(room.roomId)
    if (!latestRoom) return

    const onlinePlayers = latestRoom.players.filter(player => player.online)

    if (onlinePlayers.length === 0) {
      rooms.delete(latestRoom.roomId)
      console.log('Room removed after ttl:', latestRoom.roomId)
      return
    }

    latestRoom.cleanupTimer = null
  }, EMPTY_ROOM_TTL_MS)
}

function markPlayerDisconnected(playerId, reason = 'disconnect') {
  const client = clients.get(playerId)
  if (!client || !client.roomId) return

  const room = rooms.get(client.roomId)
  if (!room) return

  const player = findPlayer(room, playerId)
  if (!player) return

  player.online = false
  player.ready = false
  player.disconnectedAt = Date.now()
  room.updatedAt = Date.now()

  broadcastRoom(room, 'PLAYER_LEFT', {
    roomId: room.roomId,
    playerId,
    reason
  })

  const onlinePlayers = room.players.filter(item => item.online)

  if (room.phase === 'playing') {
    // 不建议立刻退回 waiting。
    // 更好的做法是保留 playing 状态，但暂停对局，等对方重连。
    room.paused = true
    room.pauseReason = 'player_disconnected'
  }

  broadcastRoomState(room)

  if (onlinePlayers.length === 0) {
    scheduleRoomCleanup(room)
  }
}

function handleCreateRoom(ws, payload) {
  const client = getClient(ws)

  if (!client) {
    sendError(ws, '?????', 'CLIENT_NOT_FOUND')
    return
  }

  if (client.roomId) {
    removePlayerFromRoom(client.playerId, 'create_new_room')
  }

  const board = normalizeBoardConfig(payload)

  if (!board) {
    sendError(ws, '???????????', 'UNSUPPORTED_BOARD')
    return
  }

  const roomId = createRoomId()

  const player = {
    playerId: client.playerId,
    nickname: normalizeNickname(payload.nickname || client.nickname || '玩家1'),
    seat: 1,
    ready: false,
    online: true
  }

  const room = {
    roomId,
    phase: 'waiting',
    players: [player],
    currentTurnPlayerId: player.playerId,
    edges: new Map(),
    boxes: new Map(),
    scores: {
      [player.playerId]: 0
    },
    board,
    rematchVotes: new Set(),
    roundIndex: 1,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  rooms.set(roomId, room)
  client.roomId = roomId

  console.log('Room created:', roomId, player.playerId)

  send(ws, 'ROOM_CREATED', {
    roomId,
    playerId: player.playerId,
    board: room.board,
    players: room.players
  })

  broadcastRoomState(room)
}

function handleJoinRoom(ws, payload) {
  const client = getClient(ws)

  if (!client) {
    sendError(ws, '?????', 'CLIENT_NOT_FOUND')
    return
  }

  const roomId = String(payload.roomId || '')
  const room = getRoom(roomId)

  if (!room) {
    sendError(ws, '房间不存在', 'ROOM_NOT_FOUND')
    return
  }

  const existingPlayer = findPlayer(room, client.playerId)

  if (existingPlayer) {
    existingPlayer.online = true
    client.roomId = roomId
    send(ws, 'ROOM_JOINED', {
      roomId,
      playerId: client.playerId,
      board: room.board,
      players: room.players
    })
    broadcastRoomState(room)
    return
  }

  if (room.players.length >= 2) {
    sendError(ws, '房间已满', 'ROOM_FULL')
    return
  }

  if (client.roomId) {
    removePlayerFromRoom(client.playerId, 'join_new_room')
  }

  const player = {
    playerId: client.playerId,
    nickname: normalizeNickname(payload.nickname || client.nickname || '玩家2'),
    seat: room.players.length + 1,
    ready: false,
    online: true
  }

  room.players.push(player)
  room.scores[player.playerId] = 0
  room.rematchVotes = new Set()
  room.updatedAt = Date.now()
  client.roomId = roomId

  console.log('Room joined:', roomId, player.playerId)

  send(ws, 'ROOM_JOINED', {
    roomId,
    playerId: player.playerId,
    board: room.board,
    players: room.players
  })

  broadcastRoom(room, 'PLAYER_JOINED', {
    roomId,
    player
  })

  broadcastRoomState(room)
}

function handlePlayerReady(ws, payload) {
  const client = getClient(ws)
  const room = getRoom(payload.roomId)

  if (!client || !room) {
    sendError(ws, '房间不存在', 'ROOM_NOT_FOUND')
    return
  }

  const player = findPlayer(room, client.playerId)

  if (!player || !player.online) {
    sendError(ws, '你不在该房间中', 'NOT_IN_ROOM')
    return
  }

  // 关键修复：
  // PLAYER_READY 只允许从 waiting 阶段进入 playing。
  // 如果房间已经 playing 或 finished，绝不能再用 ready 改 phase。
  if (room.phase !== 'waiting') {
    console.log('Ignore PLAYER_READY because room is not waiting:', {
      roomId: room.roomId,
      phase: room.phase,
      playerId: client.playerId
    })

    broadcastRoomState(room)
    return
  }

  player.ready = true
  room.updatedAt = Date.now()

  const allReady =
    room.players.length === 2 &&
    room.players.every(item => item.ready && item.online)

  if (allReady) {
    room.phase = 'playing'
    room.rematchVotes = new Set()
    room.currentTurnPlayerId = room.players[0].playerId
    room.updatedAt = Date.now()
  }

  broadcastRoomState(room)
}

function handleClaimEdge(ws, payload) {
  const client = getClient(ws)
  const room = getRoom(payload.roomId)

  if (!client || !room) {
    sendError(ws, '房间不存在', 'ROOM_NOT_FOUND')
    return
  }

  if (room.phase !== 'playing') {
    sendError(ws, '游戏尚未开始', 'GAME_NOT_STARTED')
    return
  }

  const player = findPlayer(room, client.playerId)

  if (!player || !player.online) {
    sendError(ws, '你不在该房间中', 'NOT_IN_ROOM')
    return
  }

  if (room.currentTurnPlayerId !== client.playerId) {
    sendError(ws, '还没轮到你', 'NOT_YOUR_TURN')
    return
  }

  const edgeId = payload.edgeId

  if (!parseEdgeId(room, edgeId)) {
    sendError(ws, '非法边 ID', 'INVALID_EDGE')
    return
  }

  if (room.edges.has(edgeId)) {
    sendError(ws, '这条边已经被占用', 'EDGE_ALREADY_CLAIMED')
    return
  }

  room.edges.set(edgeId, client.playerId)

  const completedBoxes = getCompletedBoxesAfterClaim(room, edgeId)

  for (const id of completedBoxes) {
    room.boxes.set(id, client.playerId)
  }

  if (completedBoxes.length > 0) {
    room.scores[client.playerId] = (room.scores[client.playerId] || 0) + completedBoxes.length
    room.currentTurnPlayerId = client.playerId
  } else {
    room.currentTurnPlayerId = getNextTurnPlayerId(room, client.playerId)
  }

  ensureFinishedIfGameOver(room)

  room.updatedAt = Date.now()

  broadcastRoom(room, 'EDGE_CLAIMED', {
    roomId: room.roomId,
    playerId: client.playerId,
    edgeId,
    completedBoxes
  })

  broadcastRoomState(room)

  if (room.phase === 'finished') {
    broadcastRoom(room, 'GAME_OVER', {
      roomId: room.roomId,
      scores: room.scores,
      winnerPlayerId: getWinnerPlayerId(room)
    })
  }
}

function resetRoomForRematch(room) {
  room.phase = 'playing'
  room.edges = new Map()
  room.boxes = new Map()
  room.scores = {}

  for (const player of room.players) {
    player.ready = true
    room.scores[player.playerId] = 0
  }

  room.rematchVotes = new Set()
  room.roundIndex = (room.roundIndex || 1) + 1

  const onlinePlayers = room.players.filter(player => player.online)
  room.currentTurnPlayerId = onlinePlayers.length > 0
    ? onlinePlayers[0].playerId
    : null

  room.updatedAt = Date.now()
}

function handleRematchRequest(ws, payload) {
  const client = getClient(ws)
  const room = getRoom(payload.roomId)

  if (!client || !room) {
    sendError(ws, '房间不存在', 'ROOM_NOT_FOUND')
    return
  }

  const player = findPlayer(room, client.playerId)

  if (!player || !player.online) {
    sendError(ws, '你不在该房间中', 'NOT_IN_ROOM')
    return
  }

  ensureFinishedIfGameOver(room)

  if (room.phase !== 'finished') {
    sendError(ws, '当前还不能再来一局', 'REMATCH_NOT_ALLOWED')
    return
  }

  if (!room.rematchVotes) {
    room.rematchVotes = new Set()
  }

  room.rematchVotes.add(client.playerId)
  room.updatedAt = Date.now()

  broadcastRoom(room, 'REMATCH_VOTE', {
    roomId: room.roomId,
    playerId: client.playerId,
    votes: Array.from(room.rematchVotes),
    required: room.players.filter(item => item.online).length
  })

  broadcastRoomState(room)

  const onlinePlayers = room.players.filter(item => item.online)

  const allOnlinePlayersVoted = onlinePlayers.length >= 2 &&
    onlinePlayers.every(item => room.rematchVotes.has(item.playerId))

  if (!allOnlinePlayersVoted) {
    return
  }

  console.log('Rematch accepted:', {
    roomId: room.roomId,
    votes: Array.from(room.rematchVotes),
    roundIndexBefore: room.roundIndex
  })

  resetRoomForRematch(room)

  console.log('Room reset for rematch:', {
    roomId: room.roomId,
    roundIndexAfter: room.roundIndex,
    phase: room.phase,
    edgesSize: room.edges.size,
    boxesSize: room.boxes.size,
    rematchVotes: Array.from(room.rematchVotes)
  })


  broadcastRoom(room, 'ROOM_RESET', {
    roomId: room.roomId,
    roundIndex: room.roundIndex,
    currentTurnPlayerId: room.currentTurnPlayerId
  })

  broadcastRoomState(room)
}

function handleLeaveRoom(ws, payload) {
  const client = getClient(ws)
  if (!client) return

  const roomId = client.roomId || payload.roomId

  removePlayerFromRoom(client.playerId, 'leave')

  send(ws, 'LEFT_ROOM', {
    roomId
  })
}

function handleMessage(ws, raw) {
  let msg

  try {
    msg = JSON.parse(raw.toString())
  } catch (err) {
    sendError(ws, '消息不是合法 JSON', 'INVALID_JSON')
    return
  }

  const type = msg.type
  const payload = msg.payload || {}

  console.log('message:', type, payload)

  switch (type) {
    case 'PING':
      send(ws, 'PONG', {
        time: Date.now()
      })
      break

    case 'CREATE_ROOM':
      handleCreateRoom(ws, payload)
      break

    case 'JOIN_ROOM':
      handleJoinRoom(ws, payload)
      break

    case 'PLAYER_READY':
      handlePlayerReady(ws, payload)
      break

    case 'CLAIM_EDGE':
      handleClaimEdge(ws, payload)
      break

    case 'REMATCH_REQUEST':
      handleRematchRequest(ws, payload)
      break

    case 'LEAVE_ROOM':
      handleLeaveRoom(ws, payload)
      break

    case 'HELLO':
      handleHello(ws, payload)
      break

    default:
      sendError(ws, `未知消息类型：${type}`, 'UNKNOWN_MESSAGE_TYPE')
      break
  }
}

function handleSocket(ws, req) {
  const playerId = createId('p')

  ws.playerId = playerId

  clients.set(playerId, {
    playerId,
    clientKey: null,
    openId: '',
    nickname: '',
    ws,
    roomId: null,
    connectedAt: Date.now(),
    lastSeenAt: Date.now()
  })

  console.log('WebSocket connected:', req.url, playerId)

  // 可以先发一个 CONNECTED_TEMP，也可以不发。
  send(ws, 'CONNECTED_TEMP', {
    playerId
  })

  ws.on('message', raw => {
    const client = clients.get(ws.playerId)

    if (client) {
      client.lastSeenAt = Date.now()
    }

    handleMessage(ws, raw)
  })

  ws.on('close', (code, reason) => {
    const stablePlayerId = ws.playerId

    console.log('WebSocket closed:', stablePlayerId, code, reason.toString())

    markPlayerDisconnected(stablePlayerId, 'disconnect')

    const client = clients.get(stablePlayerId)
    if (client) {
      client.ws = null
      client.closedAt = Date.now()
    }
  })

  ws.on('error', err => {
    console.error('WebSocket error:', ws.playerId, err)
  })
}

function handleHello(ws, payload) {
  const clientKey = String(payload.clientKey || '').trim()
  const resumeRoomId = payload.roomId ? String(payload.roomId) : ''
  const userPlayerId = String(payload.userPlayerId || '').trim()
  const openId = String(payload.openId || '').trim()
  const nickname = normalizeNickname(payload.nickname || '')

  if (!clientKey) {
    sendError(ws, '缺少 clientKey', 'CLIENT_KEY_REQUIRED')
    return
  }

  const currentClient = getClient(ws)
  if (!currentClient) {
    sendError(ws, '?????', 'CLIENT_NOT_FOUND')
    return
  }

  let stablePlayerId = userPlayerId || clientKeyToPlayerId.get(clientKey)

  if (!stablePlayerId) {
    stablePlayerId = currentClient.playerId
  }

  clientKeyToPlayerId.set(clientKey, stablePlayerId)

  // 如果当前 ws 临时 playerId 和稳定 playerId 不一致，需要迁移 ws。
  if (stablePlayerId !== currentClient.playerId) {
    clients.delete(currentClient.playerId)

    let stableClient = clients.get(stablePlayerId)

    if (!stableClient) {
      stableClient = {
        playerId: stablePlayerId,
        clientKey,
        openId,
        nickname,
        ws,
        roomId: null,
        connectedAt: Date.now(),
        lastSeenAt: Date.now()
      }
    }

    stableClient.ws = ws
    stableClient.clientKey = clientKey
    stableClient.openId = openId || stableClient.openId || ''
    stableClient.nickname = nickname || stableClient.nickname || ''
    stableClient.lastSeenAt = Date.now()

    ws.playerId = stablePlayerId
    clients.set(stablePlayerId, stableClient)
  } else {
    currentClient.clientKey = clientKey
    currentClient.openId = openId || currentClient.openId || ''
    currentClient.nickname = nickname || currentClient.nickname || ''
  }

  const client = clients.get(stablePlayerId)

  if (client && client.roomId && client.nickname) {
    const room = getRoom(client.roomId)
    const player = room ? findPlayer(room, stablePlayerId) : null

    if (player && player.nickname !== client.nickname) {
      player.nickname = client.nickname
      room.updatedAt = Date.now()
      broadcastRoomState(room)
    }
  }

  // 尝试恢复房间
  if (resumeRoomId) {
    const room = getRoom(resumeRoomId)
    const player = room ? findPlayer(room, stablePlayerId) : null

    if (room && player) {
      player.online = true
      player.disconnectedAt = null
      client.roomId = room.roomId

      room.paused = false
      room.pauseReason = ''
      room.updatedAt = Date.now()

      send(ws, 'ROOM_RESUMED', {
        roomId: room.roomId,
        playerId: stablePlayerId,
        board: room.board
      })

      broadcastRoomState(room)
    }
  }

  send(ws, 'CONNECTED', {
    playerId: stablePlayerId,
    nickname: client.nickname || ''
  })
}

app.post('/api/users/login', async (req, res) => {
  try {
    const code = String((req.body && req.body.code) || '').trim()
    const nickname = normalizeNickname(req.body && req.body.nickname)
    let openId = await resolveOpenId(req, code)

    if (!openId) {
      openId = String((req.body && req.body.openId) || '').trim()
    }

    if (!openId) {
      res.status(400).json({
        error: 'OPENID_REQUIRED',
        message: '无法获取微信 openid，请检查云托管 openid 透传或 WECHAT_APPID/WECHAT_SECRET 配置'
      })
      return
    }

    const user = upsertUser({
      openId,
      nickname
    })

    res.json({
      user: publicUser(user)
    })
  } catch (err) {
    console.error('user login failed:', err)
    res.status(500).json({
      error: 'USER_LOGIN_FAILED',
      message: '用户登录失败'
    })
  }
})

app.post('/api/users/nickname', (req, res) => {
  const playerId = String((req.body && req.body.playerId) || '').trim()
  const nickname = normalizeNickname(req.body && req.body.nickname)
  const user = getUserByPlayerId(playerId)

  if (!user) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: '用户不存在'
    })
    return
  }

  user.nickname = nickname
  user.updatedAt = Date.now()

  res.json({
    user: publicUser(user)
  })
})

app.get('/api/leaderboard/inferno-3x3', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20))

    res.json({
      records: await getPublicInfernoLeaderboard(limit)
    })
  } catch (err) {
    console.error('leaderboard list failed:', err)
    res.status(500).json({
      error: 'LEADERBOARD_LIST_FAILED',
      message: 'failed to load leaderboard'
    })
  }
})

app.post('/api/leaderboard/inferno-3x3/result', async (req, res) => {
  try {
    const playerId = getLeaderboardPlayerId(req.body && req.body.playerId)
    const nickname = normalizeNickname(req.body && req.body.nickname)
    const won = !!(req.body && req.body.won)
    const failuresBeforeClear = Number(req.body && req.body.failuresBeforeClear)

    if (!playerId) {
      res.status(400).json({
        error: 'PLAYER_ID_REQUIRED',
        message: 'playerId is required'
      })
      return
    }

    const record = await recordInfernoGameResult({
      playerId,
      nickname,
      won,
      failuresBeforeClear
    })

    res.json({
      record,
      records: await getPublicInfernoLeaderboard()
    })
  } catch (err) {
    console.error('leaderboard result failed:', err)
    res.status(500).json({
      error: 'LEADERBOARD_RESULT_FAILED',
      message: 'failed to save leaderboard result'
    })
  }
})

app.get('/', (req, res) => {
  res.send('dots online server running')
})

app.get('/health', (req, res) => {
  res.send('ok')
})

app.ws('/ws', handleSocket)
app.ws('/ws/.websocket', handleSocket)

app.listen(PORT, () => {
  console.log(`server listening on port ${PORT}`)
})
