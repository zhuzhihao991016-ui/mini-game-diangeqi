const SETTINGS_KEY = 'dots_boxes_settings'

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  volume: 0.8,
  vibrationEnabled: true,
  appearanceThemeId: 'minimal'
}

let cachedSettings = null

export function getGameSettings() {
  if (cachedSettings) return cachedSettings

  let stored = {}

  try {
    stored = typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function'
      ? wx.getStorageSync(SETTINGS_KEY) || {}
      : {}
  } catch (err) {
    stored = {}
  }

  cachedSettings = normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...stored
  })

  return cachedSettings
}

export function updateGameSettings(patch) {
  cachedSettings = normalizeSettings({
    ...getGameSettings(),
    ...patch
  })

  try {
    if (typeof wx !== 'undefined' && wx && typeof wx.setStorageSync === 'function') {
      wx.setStorageSync(SETTINGS_KEY, cachedSettings)
    }
  } catch (err) {
    console.warn('save game settings failed:', err)
  }

  return cachedSettings
}

function normalizeSettings(settings) {
  return {
    soundEnabled: settings.soundEnabled !== false,
    volume: clampNumber(settings.volume, 0, 1, DEFAULT_SETTINGS.volume),
    vibrationEnabled: settings.vibrationEnabled !== false,
    appearanceThemeId: normalizeThemeId(settings.appearanceThemeId)
  }
}

function normalizeThemeId(value) {
  const text = typeof value === 'string' ? value : DEFAULT_SETTINGS.appearanceThemeId
  return /^[a-z0-9-]+$/.test(text) ? text : DEFAULT_SETTINGS.appearanceThemeId
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}
