export default class GuideRenderer {
  constructor(ctx) {
    this.ctx = ctx

    this.highlightEdge = null
    this.highlightCell = null

    this.finger = null

    this.time = 0
  }

  update(deltaTime) {
    this.time += deltaTime
  }

  // ===== 高亮边 =====
  setHighlightEdge(edge) {
    this.highlightEdge = edge
  }

  // ===== 高亮格子 =====
  setHighlightCell(cell) {
    this.highlightCell = cell
  }

  // ===== 手指动画 =====
  setFinger(x, y) {
    this.finger = { x, y }
  }

  clearFinger() {
    this.finger = null
  }

  draw({ boardRenderer, board, originX, originY, cellSize }) {
    if (this.highlightCell) {
      this.drawCellHighlight(originX, originY, cellSize)
    }

    if (this.highlightEdge) {
      this.drawEdgeHighlight(originX, originY, cellSize)
    }

    if (this.finger) {
      this.drawFinger()
    }
  }

  // ===== 边高亮 =====
  drawEdgeHighlight(originX, originY, cellSize) {
    const ctx = this.ctx
    const edge = this.highlightEdge

    const line = this.getEdgeLine(edge, originX, originY, cellSize)

    const glow = 0.5 + 0.5 * Math.sin(this.time * 0.005)

    ctx.save()
    ctx.strokeStyle = '#FFD54F'
    ctx.globalAlpha = glow
    ctx.lineWidth = 10
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(line.x1, line.y1)
    ctx.lineTo(line.x2, line.y2)
    ctx.stroke()

    ctx.restore()
  }

  // ===== 格子高亮 =====
  drawCellHighlight(originX, originY, cellSize) {
    const ctx = this.ctx
    const cell = this.highlightCell

    const glow = 0.4 + 0.6 * Math.sin(this.time * 0.005)

    const x = originX + cell.x * cellSize
    const y = originY + cell.y * cellSize

    ctx.save()
    ctx.globalAlpha = glow
    ctx.fillStyle = '#FFD54F'
    ctx.fillRect(x, y, cellSize, cellSize)
    ctx.restore()
  }

  // ===== 手指 =====
  drawFinger() {
    const ctx = this.ctx

    const pulse = 0.8 + 0.2 * Math.sin(this.time * 0.01)

    ctx.save()

    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = 0.9

    ctx.beginPath()
    ctx.arc(this.finger.x, this.finger.y, 12 * pulse, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  // ===== 工具 =====
  getEdgeLine(edge, originX, originY, cellSize) {
    if (edge.type === 'horizontal') {
      return {
        x1: originX + edge.x * cellSize,
        y1: originY + edge.y * cellSize,
        x2: originX + (edge.x + 1) * cellSize,
        y2: originY + edge.y * cellSize
      }
    }

    return {
      x1: originX + edge.x * cellSize,
      y1: originY + edge.y * cellSize,
      x2: originX + edge.x * cellSize,
      y2: originY + (edge.y + 1) * cellSize
    }
  }
}