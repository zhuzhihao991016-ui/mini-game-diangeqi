const STORAGE_KEY = 'dots_challenge_progress'
const DEFAULT_UNLOCKED_LEVEL = 1

function normalizeUnlockedLevel(value, maxLevel = 99) {
  const level = Math.floor(Number(value) || DEFAULT_UNLOCKED_LEVEL)
  return Math.max(DEFAULT_UNLOCKED_LEVEL, Math.min(maxLevel, level))
}

export function getUnlockedChallengeLevel(maxLevel = 99) {
  const stored = wx.getStorageSync(STORAGE_KEY)
  if (!stored || typeof stored !== 'object') return DEFAULT_UNLOCKED_LEVEL

  return normalizeUnlockedLevel(stored.unlockedLevel, maxLevel)
}

export function unlockChallengeLevel(level, maxLevel = 99) {
  const nextLevel = normalizeUnlockedLevel(level, maxLevel)
  const currentLevel = getUnlockedChallengeLevel(maxLevel)
  const unlockedLevel = Math.max(currentLevel, nextLevel)

  wx.setStorageSync(STORAGE_KEY, {
    unlockedLevel,
    updatedAt: Date.now()
  })

  return unlockedLevel
}
