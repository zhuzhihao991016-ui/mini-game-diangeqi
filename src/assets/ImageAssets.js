const ASSET_PATHS = {
  robot: 'src/assets/image/mascot-robot.png',
  avatarBlue: 'src/assets/image/avatar-player-blue.png',
  avatarRed: 'src/assets/image/avatar-player-red.png',
  crown: 'src/assets/image/icon-crown.png',
  menuBackground: 'src/assets/image/menu-background.png'
}

const cache = {}

function createImageElement(src) {
  let image = null

  if (typeof wx !== 'undefined' && wx.createImage) {
    image = wx.createImage()
  } else if (typeof Image !== 'undefined') {
    image = new Image()
  }

  if (!image) return null

  image.loaded = false
  image.onload = () => {
    image.loaded = true
  }
  image.onerror = () => {
    image.failed = true
  }
  image.src = src

  return image
}

export function getImageAsset(name) {
  const src = ASSET_PATHS[name]
  if (!src) return null
  if (!cache[name]) cache[name] = createImageElement(src)
  return cache[name]
}

export function preloadImageAssets() {
  Object.keys(ASSET_PATHS).forEach(getImageAsset)
}

export function drawImageAsset(ctx, name, x, y, width, height) {
  const image = getImageAsset(name)
  if (!image || image.failed || !image.loaded) return false

  ctx.drawImage(image, x, y, width, height)
  return true
}

export default {
  getImageAsset,
  preloadImageAssets,
  drawImageAsset
}
