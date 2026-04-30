const MessageType = {
  CONNECTED: 'CONNECTED',

  PING: 'PING',
  PONG: 'PONG',

  CREATE_ROOM: 'CREATE_ROOM',
  ROOM_CREATED: 'ROOM_CREATED',

  JOIN_ROOM: 'JOIN_ROOM',
  ROOM_JOINED: 'ROOM_JOINED',

  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_READY: 'PLAYER_READY',
  PLAYER_LEFT: 'PLAYER_LEFT',

  CLAIM_EDGE: 'CLAIM_EDGE',
  EDGE_CLAIMED: 'EDGE_CLAIMED',

  ROOM_STATE: 'ROOM_STATE',
  GAME_OVER: 'GAME_OVER',

  REMATCH_REQUEST: 'REMATCH_REQUEST',
  REMATCH_VOTE: 'REMATCH_VOTE',
  ROOM_RESET: 'ROOM_RESET',
  UNDO_REQUEST: 'UNDO_REQUEST',
  UNDO_VOTE: 'UNDO_VOTE',
  ROOM_UNDO: 'ROOM_UNDO',

  HELLO: 'HELLO',
  CONNECTED_TEMP: 'CONNECTED_TEMP',
  ROOM_RESUMED: 'ROOM_RESUMED',

  LEAVE_ROOM: 'LEAVE_ROOM',
  LEFT_ROOM: 'LEFT_ROOM',

  ERROR: 'ERROR'
}

function createMessage(type, payload = {}) {
  return {
    type,
    payload,
    clientTime: Date.now()
  }
}

function encodeMessage(type, payload = {}) {
  return JSON.stringify(createMessage(type, payload))
}

function decodeMessage(raw) {
  if (typeof raw !== 'string') {
    return null
  }

  try {
    const msg = JSON.parse(raw)

    if (!msg || typeof msg.type !== 'string') {
      return null
    }

    if (!msg.payload) {
      msg.payload = {}
    }

    return msg
  } catch (err) {
    return null
  }
}

function isRoomStateMessage(msg) {
  return msg && msg.type === MessageType.ROOM_STATE
}

function isErrorMessage(msg) {
  return msg && msg.type === MessageType.ERROR
}

export default {
  MessageType,
  createMessage,
  encodeMessage,
  decodeMessage,
  isRoomStateMessage,
  isErrorMessage
}

export {
  MessageType,
  createMessage,
  encodeMessage,
  decodeMessage,
  isRoomStateMessage,
  isErrorMessage
}
