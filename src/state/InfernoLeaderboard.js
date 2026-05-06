const STORAGE_KEY = 'dots_leaderboards_v2'
const DEFAULT_NICKNAME = '玩家'
const MAX_RECORDS = 20
const DEFAULT_BOARD_KEY = 'inferno-3x3'

const LEADERBOARD_CONFIG = {
  'inferno-3x3': {
    listPath: '/api/leaderboard/inferno-3x3',
    resultPath: '/api/leaderboard/inferno-3x3/result',
    sortType: 'inferno'
  },
  'inferno-6x6': {
    listPath: '/api/leaderboard/inferno-6x6',
    resultPath: '/api/leaderboard/inferno-6x6/result',
    sortType: 'inferno'
  },
  challenge: {
    listPath: '/api/leaderboard/challenge',
    resultPath: '/api/leaderboard/challenge/result',
    sortType: 'challenge'
  }
}

function now() {
  return Date.now()
}

function sanitizeNickname(value) {
  const text = String(value || '').trim()
  return (text || DEFAULT_NICKNAME).slice(0, 12)
}

function createLocalPlayerId() {
  return `local_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export default class InfernoLeaderboard {
  constructor(options = {}) {
    this.envId = options.envId || ''
    this.serviceName = options.serviceName || ''
    this.boardKey = options.boardKey || DEFAULT_BOARD_KEY
    this.data = this.load()
    this.lastError = null
    this.ensureBoardData(this.boardKey)
  }

  getConfig(boardKey = this.boardKey) {
    return LEADERBOARD_CONFIG[boardKey] || LEADERBOARD_CONFIG[DEFAULT_BOARD_KEY]
  }

  ensureBoardData(boardKey = this.boardKey) {
    if (!this.data.boards) this.data.boards = {}
    if (!this.data.boards[boardKey]) {
      this.data.boards[boardKey] = {
        records: [],
        pendingFailures: {}
      }
    }

    return this.data.boards[boardKey]
  }

  setBoardKey(boardKey) {
    if (!LEADERBOARD_CONFIG[boardKey]) return this.boardKey
    this.boardKey = boardKey
    this.ensureBoardData(boardKey)
    this.save()
    return this.boardKey
  }

  load() {
    const stored = wx.getStorageSync(STORAGE_KEY)

    if (stored && typeof stored === 'object' && stored.boards) {
      return {
        localPlayerId: stored.localPlayerId || createLocalPlayerId(),
        boards: stored.boards
      }
    }

    const legacy = wx.getStorageSync('dots_inferno_3x3_leaderboard')
    if (legacy && typeof legacy === 'object') {
      return {
        localPlayerId: legacy.localPlayerId || createLocalPlayerId(),
        boards: {
          [DEFAULT_BOARD_KEY]: {
            records: Array.isArray(legacy.records) ? legacy.records : [],
            pendingFailures: legacy.pendingFailures && typeof legacy.pendingFailures === 'object'
              ? legacy.pendingFailures
              : {}
          }
        }
      }
    }

    return {
      localPlayerId: createLocalPlayerId(),
      boards: {}
    }
  }

  save() {
    wx.setStorageSync(STORAGE_KEY, this.data)
  }

  callContainer(path, data = {}, method = 'POST') {
    return new Promise((resolve, reject) => {
      if (!wx.cloud || !wx.cloud.callContainer) {
        reject(new Error('wx.cloud.callContainer unavailable'))
        return
      }

      wx.cloud.callContainer({
        config: {
          env: this.envId
        },
        service: this.serviceName,
        path,
        method,
        header: {
          'content-type': 'application/json'
        },
        data,
        success: resolve,
        fail: reject
      })
    })
  }

  normalizeRecord(record, sortType = 'inferno') {
    if (sortType === 'challenge') {
      return {
        playerId: record.playerId || '',
        nickname: sanitizeNickname(record.nickname),
        bestLevel: Number(record.bestLevel) || 0,
        bestScore: Number(record.bestScore) || 0,
        clearedAt: Number(record.clearedAt) || 0
      }
    }

    return {
      playerId: record.playerId || '',
      nickname: sanitizeNickname(record.nickname),
      failuresBeforeClear: Number(record.failuresBeforeClear) || 0,
      clearedAt: Number(record.clearedAt) || 0
    }
  }

  async refresh(limit = MAX_RECORDS, boardKey = this.boardKey) {
    this.setBoardKey(boardKey)
    const config = this.getConfig(boardKey)
    const boardData = this.ensureBoardData(boardKey)

    try {
      const res = await this.callContainer(`${config.listPath}?limit=${limit}`, {}, 'GET')
      const records = res && res.data && Array.isArray(res.data.records)
        ? res.data.records
        : []

      boardData.records = records.map(record => this.normalizeRecord(record, config.sortType))
      this.lastError = null
      this.save()
    } catch (err) {
      this.lastError = err
      console.warn('刷新排行榜失败，使用本地缓存:', err)
    }

    return this.getRecords(limit, boardKey)
  }

  recordGameResult({ playerId, nickname, won, boardKey = this.boardKey, challengeLevel = 0, challengeScore = 0 }) {
    this.setBoardKey(boardKey)
    const config = this.getConfig(boardKey)
    const id = playerId || this.data.localPlayerId
    const name = sanitizeNickname(nickname)

    if (config.sortType === 'challenge') {
      return this.recordChallengeResult({
        playerId: id,
        nickname: name,
        won,
        challengeLevel,
        challengeScore,
        boardKey
      })
    }

    const boardData = this.ensureBoardData(boardKey)
    const failures = boardData.pendingFailures[id] || 0

    if (!won) {
      boardData.pendingFailures[id] = failures + 1
      this.save()
      this.submitGameResult({
        playerId: id,
        nickname: name,
        won: false,
        boardKey
      })
      return null
    }

    const record = {
      playerId: id,
      nickname: name,
      failuresBeforeClear: failures,
      clearedAt: now()
    }

    const existingIndex = boardData.records.findIndex(item => item.playerId === id)
    if (existingIndex >= 0) {
      const existing = boardData.records[existingIndex]
      if (failures <= existing.failuresBeforeClear) {
        boardData.records[existingIndex] = record
      } else {
        boardData.records[existingIndex] = {
          ...existing,
          nickname: name
        }
      }
    } else {
      boardData.records.push(record)
    }

    boardData.pendingFailures[id] = 0
    boardData.records = this.getRecords(MAX_RECORDS, boardKey)
    this.save()
    this.submitGameResult({
      playerId: id,
      nickname: name,
      won,
      failuresBeforeClear: failures,
      boardKey
    })

    return record
  }

  recordChallengeResult({ playerId, nickname, won, challengeLevel = 0, challengeScore = 0, boardKey = 'challenge' }) {
    if (!won) return null

    const boardData = this.ensureBoardData(boardKey)
    const record = {
      playerId,
      nickname,
      bestLevel: Number(challengeLevel) || 0,
      bestScore: Number(challengeScore) || 0,
      clearedAt: now()
    }
    const existingIndex = boardData.records.findIndex(item => item.playerId === playerId)

    if (existingIndex >= 0) {
      const existing = boardData.records[existingIndex]
      const isBetter = record.bestLevel > existing.bestLevel ||
        (record.bestLevel === existing.bestLevel && record.bestScore > existing.bestScore)

      boardData.records[existingIndex] = isBetter ? record : {
        ...existing,
        nickname
      }
    } else {
      boardData.records.push(record)
    }

    boardData.records = this.getRecords(MAX_RECORDS, boardKey)
    this.save()
    this.submitGameResult({
      playerId,
      nickname,
      won,
      challengeLevel: record.bestLevel,
      challengeScore: record.bestScore,
      boardKey
    })

    return record
  }

  async submitGameResult({ playerId, nickname, won, failuresBeforeClear = 0, challengeLevel = 0, challengeScore = 0, boardKey = this.boardKey }) {
    const config = this.getConfig(boardKey)
    const boardData = this.ensureBoardData(boardKey)

    try {
      const res = await this.callContainer(config.resultPath, {
        playerId,
        nickname: sanitizeNickname(nickname),
        won: !!won,
        failuresBeforeClear: Number(failuresBeforeClear) || 0,
        challengeLevel: Number(challengeLevel) || 0,
        challengeScore: Number(challengeScore) || 0
      })
      const records = res && res.data && Array.isArray(res.data.records)
        ? res.data.records
        : null

      if (records) {
        boardData.records = records.map(record => this.normalizeRecord(record, config.sortType))
        this.save()
      }

      this.lastError = null
    } catch (err) {
      this.lastError = err
      console.warn('提交排行榜结果失败，已保留本地记录:', err)
    }
  }

  getRecords(limit = MAX_RECORDS, boardKey = this.boardKey) {
    const config = this.getConfig(boardKey)
    const boardData = this.ensureBoardData(boardKey)

    return boardData.records
      .slice()
      .sort((a, b) => {
        if (config.sortType === 'challenge') {
          if ((a.bestLevel || 0) !== (b.bestLevel || 0)) {
            return (b.bestLevel || 0) - (a.bestLevel || 0)
          }
          if ((a.bestScore || 0) !== (b.bestScore || 0)) {
            return (b.bestScore || 0) - (a.bestScore || 0)
          }
          return (a.clearedAt || 0) - (b.clearedAt || 0)
        }

        if (a.failuresBeforeClear !== b.failuresBeforeClear) {
          return a.failuresBeforeClear - b.failuresBeforeClear
        }

        return a.clearedAt - b.clearedAt
      })
      .slice(0, limit)
  }
}
