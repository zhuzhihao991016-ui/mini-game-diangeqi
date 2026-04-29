import EventEmitter from '../utils/EventEmitter'

const STORAGE_KEY = 'dots_user_profile'
const DEFAULT_NICKNAME = '\u73a9\u5bb6'

function createFallbackId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeNickname(value) {
  const text = String(value || '').trim()

  if (!text) return DEFAULT_NICKNAME

  return text.slice(0, 12)
}

export default class UserManager extends EventEmitter {
  constructor(options = {}) {
    super()

    this.envId = options.envId || ''
    this.serviceName = options.serviceName || ''
    this.loginPath = options.loginPath || '/api/users/login'
    this.nicknamePath = options.nicknamePath || '/api/users/nickname'
    this.profile = this.loadLocalProfile()
    this.loginPromise = null
  }

  loadLocalProfile() {
    const stored = wx.getStorageSync(STORAGE_KEY)

    if (stored && typeof stored === 'object') {
      return {
        openId: stored.openId || '',
        playerId: stored.playerId || '',
        nickname: sanitizeNickname(stored.nickname || DEFAULT_NICKNAME),
        createdAt: stored.createdAt || 0,
        updatedAt: stored.updatedAt || 0
      }
    }

    return {
      openId: '',
      playerId: '',
      nickname: DEFAULT_NICKNAME,
      createdAt: 0,
      updatedAt: 0
    }
  }

  saveLocalProfile(profile) {
    this.profile = {
      ...this.profile,
      ...profile,
      nickname: sanitizeNickname(profile.nickname || this.profile.nickname)
    }

    wx.setStorageSync(STORAGE_KEY, this.profile)
    this.emit('profileChanged', this.profile)

    return this.profile
  }

  async ensureLogin() {
    if (this.profile.playerId && this.profile.openId) {
      return this.profile
    }

    if (!this.loginPromise) {
      this.loginPromise = this.login().finally(() => {
        this.loginPromise = null
      })
    }

    return this.loginPromise
  }

  async login() {
    const code = await this.getWxLoginCode()
    const nickname = this.getNickname()

    try {
      const res = await this.callContainer(this.loginPath, {
        code,
        nickname
      })

      const user = res && res.data && res.data.user

      if (!user || !user.playerId) {
        throw new Error('login response missing user.playerId')
      }

      return this.saveLocalProfile(user)
    } catch (err) {
      console.warn('\u7528\u6237\u767b\u5f55\u5931\u8d25\uff0c\u4f7f\u7528\u672c\u5730\u4e34\u65f6\u8d44\u6599:', err)

      const fallback = {
        openId: this.profile.openId || wx.getStorageSync('debug_openid') || createFallbackId('debug_openid'),
        playerId: this.profile.playerId || wx.getStorageSync('debug_player_id') || createFallbackId('p_local'),
        nickname,
        createdAt: this.profile.createdAt || Date.now(),
        updatedAt: Date.now()
      }

      wx.setStorageSync('debug_openid', fallback.openId)
      wx.setStorageSync('debug_player_id', fallback.playerId)

      return this.saveLocalProfile(fallback)
    }
  }

  getWxLoginCode() {
    return new Promise(resolve => {
      if (!wx.login) {
        resolve('')
        return
      }

      wx.login({
        success: res => resolve(res.code || ''),
        fail: () => resolve('')
      })
    })
  }

  callContainer(path, data) {
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
        method: 'POST',
        header: {
          'content-type': 'application/json'
        },
        data,
        success: resolve,
        fail: reject
      })
    })
  }

  async updateNickname(nickname) {
    const nextNickname = sanitizeNickname(nickname)
    const profile = await this.ensureLogin()

    try {
      const res = await this.callContainer(this.nicknamePath, {
        playerId: profile.playerId,
        nickname: nextNickname
      })

      const user = res && res.data && res.data.user

      if (user && user.playerId) {
        return this.saveLocalProfile(user)
      }
    } catch (err) {
      console.warn('\u540c\u6b65\u6635\u79f0\u5931\u8d25\uff0c\u4ec5\u66f4\u65b0\u672c\u5730\u8d44\u6599:', err)
    }

    return this.saveLocalProfile({
      nickname: nextNickname,
      updatedAt: Date.now()
    })
  }

  promptNickname() {
    return new Promise(resolve => {
      wx.showModal({
        title: '\u4fee\u6539\u6635\u79f0',
        editable: true,
        placeholderText: '\u8bf7\u8f93\u5165\u6635\u79f0\uff0c\u6700\u591a 12 \u4e2a\u5b57',
        success: res => {
          if (res.confirm && res.content) {
            resolve(sanitizeNickname(res.content))
            return
          }

          resolve('')
        },
        fail: () => resolve('')
      })
    })
  }

  getNickname() {
    return sanitizeNickname(this.profile.nickname)
  }

  getPlayerId() {
    return this.profile.playerId || ''
  }

  getOpenId() {
    return this.profile.openId || ''
  }

  onProfileChanged(callback) {
    return this.on('profileChanged', callback)
  }
}
