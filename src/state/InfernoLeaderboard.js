const STORAGE_KEY = 'dots_inferno_3x3_leaderboard'
const DEFAULT_NICKNAME = '\u73a9\u5bb6'
const MAX_RECORDS = 20
const LIST_PATH = '/api/leaderboard/inferno-3x3'
const RESULT_PATH = '/api/leaderboard/inferno-3x3/result'

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
    this.listPath = options.listPath || LIST_PATH
    this.resultPath = options.resultPath || RESULT_PATH
    this.data = this.load()
    this.lastError = null
  }

  load() {
    const stored = wx.getStorageSync(STORAGE_KEY)

    if (stored && typeof stored === 'object') {
      return {
        localPlayerId: stored.localPlayerId || createLocalPlayerId(),
        records: Array.isArray(stored.records) ? stored.records : [],
        pendingFailures: stored.pendingFailures && typeof stored.pendingFailures === 'object'
          ? stored.pendingFailures
          : {}
      }
    }

    return {
      localPlayerId: createLocalPlayerId(),
      records: [],
      pendingFailures: {}
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

  async refresh(limit = MAX_RECORDS) {
    try {
      const res = await this.callContainer(`${this.listPath}?limit=${limit}`, {}, 'GET')
      const records = res && res.data && Array.isArray(res.data.records)
        ? res.data.records
        : []

      this.data.records = records.map(record => ({
        playerId: record.playerId || '',
        nickname: sanitizeNickname(record.nickname),
        failuresBeforeClear: Number(record.failuresBeforeClear) || 0,
        clearedAt: Number(record.clearedAt) || 0
      }))
      this.lastError = null
      this.save()
    } catch (err) {
      this.lastError = err
      console.warn('刷新炼狱排行榜失败，使用本地缓存:', err)
    }

    return this.getRecords(limit)
  }

  recordGameResult({ playerId, nickname, won }) {
    const id = playerId || this.data.localPlayerId
    const name = sanitizeNickname(nickname)
    const failures = this.data.pendingFailures[id] || 0

    if (!won) {
      this.data.pendingFailures[id] = failures + 1
      this.save()
      this.submitGameResult({
        playerId: id,
        nickname: name,
        won: false
      })
      return null
    }

    const record = {
      playerId: id,
      nickname: name,
      failuresBeforeClear: failures,
      clearedAt: now()
    }

    const existingIndex = this.data.records.findIndex(item => item.playerId === id)

    if (existingIndex >= 0) {
      const existing = this.data.records[existingIndex]
      if (failures <= existing.failuresBeforeClear) {
        this.data.records[existingIndex] = record
      } else {
        this.data.records[existingIndex] = {
          ...existing,
          nickname: name
        }
      }
    } else {
      this.data.records.push(record)
    }

    this.data.pendingFailures[id] = 0
    this.data.records = this.getRecords()
    this.save()
    this.submitGameResult({
      playerId: id,
      nickname: name,
      won,
      failuresBeforeClear: failures
    })

    return record
  }

  async submitGameResult({ playerId, nickname, won, failuresBeforeClear = 0 }) {
    try {
      const res = await this.callContainer(this.resultPath, {
        playerId,
        nickname: sanitizeNickname(nickname),
        won: !!won,
        failuresBeforeClear: Number(failuresBeforeClear) || 0
      })
      const records = res && res.data && Array.isArray(res.data.records)
        ? res.data.records
        : null

      if (records) {
        this.data.records = records.map(record => ({
          playerId: record.playerId || '',
          nickname: sanitizeNickname(record.nickname),
          failuresBeforeClear: Number(record.failuresBeforeClear) || 0,
          clearedAt: Number(record.clearedAt) || 0
        }))
        this.save()
      }

      this.lastError = null
    } catch (err) {
      this.lastError = err
      console.warn('提交炼狱排行榜结果失败，已保留本地记录:', err)
    }
  }

  getRecords(limit = MAX_RECORDS) {
    return this.data.records
      .slice()
      .sort((a, b) => {
        if (a.failuresBeforeClear !== b.failuresBeforeClear) {
          return a.failuresBeforeClear - b.failuresBeforeClear
        }

        return a.clearedAt - b.clearedAt
      })
      .slice(0, limit)
  }
}
