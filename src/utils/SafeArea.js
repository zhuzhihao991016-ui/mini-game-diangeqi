export function getSafeAreaInsets(width = 0, height = 0) {
  let info = null

  if (typeof wx !== 'undefined') {
    if (wx.getWindowInfo) {
      info = wx.getWindowInfo()
    } else if (wx.getSystemInfoSync) {
      info = wx.getSystemInfoSync()
    }
  }

  const windowWidth = (info && (info.windowWidth || info.screenWidth)) || width
  const windowHeight = (info && (info.windowHeight || info.screenHeight)) || height
  const safeArea = info && info.safeArea

  if (!safeArea) {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }

  return {
    top: Math.max(0, safeArea.top || 0),
    right: Math.max(0, windowWidth - safeArea.right),
    bottom: Math.max(0, windowHeight - safeArea.bottom),
    left: Math.max(0, safeArea.left || 0)
  }
}

export function getMenuButtonRect() {
  if (typeof wx === 'undefined' || !wx.getMenuButtonBoundingClientRect) {
    return null
  }

  try {
    const rect = wx.getMenuButtonBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return null
    return rect
  } catch (err) {
    return null
  }
}

export function getSceneSafeLayout(width, height) {
  const insets = getSafeAreaInsets(width, height)
  const menuButton = getMenuButtonRect()
  const top = menuButton
    ? Math.max(insets.top + 18, menuButton.bottom + 8)
    : insets.top + 18

  return {
    insets,
    menuButton,
    top,
    bottom: insets.bottom + 24
  }
}
