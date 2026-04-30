export default class BoardRenderer {
  constructor(ctx) {
    this.ctx = ctx
  }

  draw({ board, originX, originY, cellSize, animationManager, highlightedEdgeId = null }) {
    if (board.type === 'hex') {
      this.drawHex(board, originX, originY, cellSize, animationManager, highlightedEdgeId)
    } else {
      this.drawCells({ board, originX, originY, cellSize, animationManager })
      this.drawEdges({ board, originX, originY, cellSize, animationManager, highlightedEdgeId })
      this.drawPoints({ board, originX, originY, cellSize })
    }
  }

drawHex(board, originX, originY, size, animationManager, highlightedEdgeId = null) {
  this.drawHexCells(board, originX, originY, size, animationManager)
  this.drawHexEdges(board, originX, originY, size, animationManager, highlightedEdgeId)
  this.drawHexPoints(board, originX, originY, size)
}

  drawCells({ board, originX, originY, cellSize, animationManager }) {
    for (const cell of board.cells.values()) {
      if (!cell.ownerId) continue

      const progress = animationManager
        ? animationManager.getCellProgress(cell.id)
        : 1

      this.drawCellFill({
        cell,
        originX,
        originY,
        cellSize,
        progress
      })
    }
  }

  drawCellFill({ cell, originX, originY, cellSize, progress }) {
    const ctx = this.ctx

    const color = this.getPlayerColor(cell.ownerId)
    const maxSize = cellSize - 12
    const size = maxSize * progress

    const centerX = originX + cell.x * cellSize + cellSize / 2
    const centerY = originY + cell.y * cellSize + cellSize / 2

    const x = centerX - size / 2
    const y = centerY - size / 2
    const radius = Math.min(12, size / 4)

    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.fillStyle = color
    this.roundRect(ctx, x, y, size, size, radius)
    ctx.fill()
    ctx.restore()
  }

  drawEdges({ board, originX, originY, cellSize, animationManager, highlightedEdgeId = null }) {
    for (const edge of board.edges.values()) {
      const line = this.getEdgeLine(edge, originX, originY, cellSize)

      if (!edge.ownerId) {
        if (edge.id === highlightedEdgeId) {
          this.drawHighlightedEdge(line)
        } else {
          this.drawEmptyEdge(line)
        }
        continue
      }

      const progress = animationManager
        ? animationManager.getEdgeProgress(edge.id)
        : 1

      this.drawClaimedEdge(line, edge.ownerId, progress)
    };
  }

  drawEmptyEdge(line) {
    const ctx = this.ctx

    ctx.strokeStyle = '#aaa'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(line.x1, line.y1)
    ctx.lineTo(line.x2, line.y2)
    ctx.stroke()
  }

  drawHighlightedEdge(line) {
    const ctx = this.ctx

    ctx.save()
    ctx.strokeStyle = '#F5A623'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(245, 166, 35, 0.55)'
    ctx.shadowBlur = 10

    ctx.beginPath()
    ctx.moveTo(line.x1, line.y1)
    ctx.lineTo(line.x2, line.y2)
    ctx.stroke()

    ctx.restore()
  }

  drawClaimedEdge(line, playerId, progress) {
    const ctx = this.ctx

    const midX = (line.x1 + line.x2) / 2
    const midY = (line.y1 + line.y2) / 2

    const halfX = (line.x2 - line.x1) / 2 * progress
    const halfY = (line.y2 - line.y1) / 2 * progress

    ctx.strokeStyle = this.getPlayerColor(playerId)
    ctx.lineWidth = 6
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(midX - halfX, midY - halfY)
    ctx.lineTo(midX + halfX, midY + halfY)
    ctx.stroke()
  }

  drawPoints({ board, originX, originY, cellSize }) {
    const ctx = this.ctx

    for (let y = 0; y <= board.rows; y++) {
      for (let x = 0; x <= board.cols; x++) {
        ctx.fillStyle = '#333'
        ctx.beginPath()
        ctx.arc(
          originX + x * cellSize,
          originY + y * cellSize,
          5,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
    }
  }

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

  getPlayerColor(playerId) {
    if (playerId === 'p1') return '#4A90E2'
    if (playerId === 'p2') return '#E24A4A'
    if (playerId === 'p3') return '#2ecc71'
    if (playerId === 'p4') return '#f1c40f'
    return '#333'
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

  drawHexEdges(board, originX, originY, size, animationManager, highlightedEdgeId = null) {
    for (const edge of board.edges.values()) {
      const line = this.getHexEdgeLine(edge, originX, originY, size)
  
      if (!line) continue
  
      if (!edge.ownerId) {
        if (edge.id === highlightedEdgeId) {
          this.drawHighlightedEdge(line)
        } else {
          this.drawEmptyEdge(line)
        }
        continue
      }
  
      const progress = animationManager
        ? animationManager.getEdgeProgress(edge.id)
        : 1
  
      this.drawClaimedEdge(line, edge.ownerId, progress)
    }
  }

  getHexEdgeLine(edge, originX, originY, size) {
    if (edge.direction === undefined) return null
  
    const center = this.hexToPixel(edge.q, edge.r, size)
  
    const cx = center.x + originX
    const cy = center.y + originY
  
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

  drawHexCells(board, originX, originY, size, animationManager) {
    const ctx = this.ctx
  
    for (const cell of board.cells.values()) {
      if (!cell.ownerId) continue
  
      const progress = animationManager
        ? animationManager.getCellProgress(cell.id)
        : 1
  
      const center = this.hexToPixel(cell.x, cell.y, size)
  
      const cx = center.x + originX
      const cy = center.y + originY
  
      const corners = this.getHexCorners(cx, cy, size * 0.98 * progress)
  
      ctx.save()
      ctx.globalAlpha = 0.25
      ctx.fillStyle = this.getPlayerColor(cell.ownerId)
  
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y)
      }
      ctx.closePath()
      ctx.fill()
  
      ctx.restore()
    }
  }

  drawHexPoints(board, originX, originY, size) {
    const ctx = this.ctx
    const pointSet = new Set()
  
    for (const edge of board.edges.values()) {
      const line = this.getHexEdgeLine(edge, originX, originY, size)
      if (!line) continue
  
      const key1 = `${line.x1.toFixed(1)}_${line.y1.toFixed(1)}`
      const key2 = `${line.x2.toFixed(1)}_${line.y2.toFixed(1)}`
  
      pointSet.add(key1)
      pointSet.add(key2)
    }
  
    ctx.fillStyle = '#333'
  
    pointSet.forEach(key => {
      const [x, y] = key.split('_').map(Number)
  
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }
}
