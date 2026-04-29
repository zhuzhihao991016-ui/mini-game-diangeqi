export default class Renderer {
  constructor(ctx, canvas) {
    this.ctx = ctx
    this.canvas = canvas
  }

  clear() {
    const ctx = this.ctx
  
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // ⭐
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.restore()
  }
}