const ASSET_PATHS = {
  robot: 'src/assets/image/mascot-robot.png',
  avatarBlue: 'src/assets/image/avatar-player-blue.png',
  avatarRed: 'src/assets/image/avatar-player-red.png',
  crown: 'src/assets/image/icon-crown.png',
  titleThemeMinimal: 'src/assets/image/title-theme-minimal.png',
  titleThemeMechanical: 'src/assets/image/title-theme-mechanical.png',
  titleThemeSteampunk: 'src/assets/image/title-theme-steampunk.png',
  titleThemeBlackGold: 'src/assets/image/title-theme-black-gold.png',
  titleThemeCartoon: 'src/assets/image/title-theme-playful.png',
  titleThemeGuofeng: 'src/assets/image/title-theme-guofeng.png',
  titleThemeHanddrawn: 'src/assets/image/title-theme-handdrawn.png',
  titleThemePanda: 'src/assets/image/title-theme-panda-alpha.png',
  menuBackground: 'src/assets/image/menu-background.jpg',
  themeBgMinimal: 'src/assets/image/theme-bg-minimal.jpg',
  themeBgMechanical: 'src/assets/image/theme-bg-mechanical.jpg',
  themeBgSteampunk: 'src/assets/image/theme-bg-steampunk.jpg',
  themeBgBlackGold: 'src/assets/image/theme-bg-black-gold.jpg',
  themeBgCartoon: 'src/assets/image/theme-bg-cartoon.jpg',
  themeBgGuofeng: 'src/assets/image/theme-bg-guofeng.jpg',
  themeBgHanddrawn: 'src/assets/image/theme-bg-handdrawn.jpg',
  themeBgPanda: 'src/assets/image/theme-bg-panda.jpg'
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
