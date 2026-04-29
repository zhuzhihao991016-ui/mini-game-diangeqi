export default class Button {
  constructor({ x, y, width, height, text, onClick, disabled = false }) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.text = text
    this.onClick = onClick
    this.disabled = disabled
  }

  draw(ctx) {
    ctx.save()

    ctx.fillStyle = this.disabled ? '#999' : '#222'
    ctx.fillRect(this.x, this.y, this.width, this.height)

    ctx.fillStyle = '#fff'
    ctx.font = '22px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      this.text,
      this.x + this.width / 2,
      this.y + this.height / 2
    )

    ctx.restore()
  }

  hitTest(x, y) {
    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height
    )
  }

  click() {
    if (this.disabled) return
    if (this.onClick) this.onClick()
  }
}