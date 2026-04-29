export default class HitTest {
  constructor({ board, originX, originY, cellSize, hitRange, type = 'square' }) {
    this.board = board
    this.originX = originX
    this.originY = originY
    this.cellSize = cellSize
    this.hitRange = hitRange
    this.type = type 
  }

  getEdgeByPoint(x, y) {
    let nearestEdge = null
    let nearestDistance = Infinity

    for (const edge of this.board.edges.values()) {
      if (edge.ownerId) continue  // ⭐关键修复

      const line = this.getEdgeLine(edge)
      const distance = this.pointToSegmentDistance(x, y, line.x1, line.y1, line.x2, line.y2)

      if (distance < this.hitRange && distance < nearestDistance) {
        nearestDistance = distance
        nearestEdge = edge
      }
    }

    return nearestEdge
  }

  getEdgeLine(edge) {
    if (this.type === 'hex') {
      return this.getHexEdgeLine(edge)
    }
  
    return this.getSquareEdgeLine(edge)
  }

  getSquareEdgeLine(edge) {
    const size = this.cellSize
    const ox = this.originX
    const oy = this.originY
  
    if (edge.type === 'horizontal') {
      return {
        x1: ox + edge.x * size,
        y1: oy + edge.y * size,
        x2: ox + (edge.x + 1) * size,
        y2: oy + edge.y * size
      }
    }
  
    return {
      x1: ox + edge.x * size,
      y1: oy + edge.y * size,
      x2: ox + edge.x * size,
      y2: oy + (edge.y + 1) * size
    }
  }

  getHexEdgeLine(edge) {
    if (edge.direction === undefined) return null
  
    const size = this.cellSize
    const ox = this.originX
    const oy = this.originY
  
    const center = this.hexToPixel(edge.q, edge.r, size)
  
    const cx = center.x + ox
    const cy = center.y + oy
  
    const corners = this.getHexCorners(cx, cy, size)
  
    const p1 = corners[edge.direction]
    const p2 = corners[(edge.direction + 1) % 6]
  
    return {
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y
    }
  }

  hexToPixel(q, r, size) {
    return {
      x: size * Math.sqrt(3) * (q + r / 2),
      y: size * 1.5 * r
    }
  }

  getHexCorners(cx, cy, size) {
    const corners = []
  
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 30)
      corners.push({
        x: cx + size * Math.cos(angle),
        y: cy + size * Math.sin(angle)
      })
    }
  
    return corners
  }

  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1
    const dy = y2 - y1

    if (dx === 0 && dy === 0) {
      return Math.hypot(px - x1, py - y1)
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = Math.max(0, Math.min(1, t))

    const closestX = x1 + t * dx
    const closestY = y1 + t * dy

    return Math.hypot(px - closestX, py - closestY)
  }
}