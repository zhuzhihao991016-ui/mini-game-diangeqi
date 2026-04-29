export default class InputManager {
  constructor(canvas) {
    this.canvas = canvas
    this.touchStartHandlers = []

    wx.onTouchStart((event) => {
      const touch = event.touches[0]
      if (!touch) return

      for (const handler of this.touchStartHandlers) {
        handler(touch.clientX, touch.clientY)
      }
    })
  }

  onTouchStart(handler) {
    this.touchStartHandlers.push(handler)
  }

  clearTouchStartHandlers() {
    this.touchStartHandlers = []
  }
}