import UITheme from '../ui/theme'

export default class BoardRenderer {
  constructor(ctx) {
    this.ctx = ctx
    this.obstacleColor = UITheme.colors.obstacle
  }

  draw({ board, originX, originY, cellSize, animationManager, highlightedEdgeId = null }) {
    if (board.type === 'hex') {
      this.drawHex(board, originX, originY, cellSize, animationManager, highlightedEdgeId)
    } else if (board.type === 'mixed-shape') {
      this.drawMixedShape(board, originX, originY, cellSize, animationManager, highlightedEdgeId)
    } else {
      this.drawSpecialCells({ board, originX, originY, cellSize })
      this.drawCells({ board, originX, originY, cellSize, animationManager })
      this.drawEdges({ board, originX, originY, cellSize, animationManager, highlightedEdgeId })
      this.drawPoints({ board, originX, originY, cellSize })
    }
  }

  drawMixedShape(board, originX, originY, cellSize, animationManager, highlightedEdgeId = null) {
    this.drawMixedShapeSpecialCells(board, originX, originY, cellSize)
    this.drawMixedShapeCells(board, originX, originY, cellSize, animationManager)
    this.drawMixedShapeEdges(board, originX, originY, cellSize, animationManager, highlightedEdgeId)
    this.drawMixedShapePoints(board, originX, originY, cellSize)
  }

  getMixedShapePoint(point, originX, originY, cellSize) {
    return {
      x: originX + point.unitX * cellSize,
      y: originY + point.unitY * cellSize
    }
  }

  getMixedShapeEdgeLine(edge, originX, originY, cellSize) {
    return {
      x1: originX + edge.unitX1 * cellSize,
      y1: originY + edge.unitY1 * cellSize,
      x2: originX + edge.unitX2 * cellSize,
      y2: originY + edge.unitY2 * cellSize
    }
  }

  drawMixedShapeSpecialCells(board, originX, originY, cellSize) {
    for (const cell of board.cells.values()) {
      const center = this.getMixedShapePoint(cell.center, originX, originY, cellSize)
      const points = Array.isArray(cell.points)
        ? cell.points.map(point => this.getMixedShapePoint(point, originX, originY, cellSize))
        : []

      if (cell.isFrozen) {
        this.drawMixedShapeTint(points, UITheme.colors.primaryLight, UITheme.colors.primary)
        this.drawCellMarker(center.x, center.y, cellSize, 'ICE', UITheme.colors.primary)
        continue
      }

      if (cell.isObstacle) {
        this.drawMixedShapeTint(points, 'rgba(170, 179, 189, 0.18)', this.obstacleColor)
        this.drawObstacleCellRect(center.x - cellSize * 0.28, center.y - cellSize * 0.28, cellSize * 0.56, cellSize * 0.56)
        continue
      }

      if (cell.isBomb) {
        this.drawCellMarker(center.x, center.y, cellSize, 'B', UITheme.colors.danger)
      }

      if (cell.isQuantum) {
        this.drawCellMarker(center.x, center.y + cellSize * 0.18, cellSize * 0.76, 'Q', UITheme.colors.purple)
      }

      if (cell.isDoubleScore) {
        this.drawDoubleScoreLabel(center.x, center.y, cellSize)
      }
    }
  }

  drawMixedShapeTint(points, fillStyle, strokeStyle) {
    if (!Array.isArray(points) || points.length === 0) return

    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = fillStyle
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  drawMixedShapeCells(board, originX, originY, cellSize, animationManager) {
    const ctx = this.ctx

    for (const cell of board.cells.values()) {
      if (!cell.ownerId || !Array.isArray(cell.points)) continue

      const progress = animationManager
        ? animationManager.getCellProgress(cell.id)
        : 1
      const center = this.getMixedShapePoint(cell.center, originX, originY, cellSize)
      const points = cell.points.map(point => {
        const screenPoint = this.getMixedShapePoint(point, originX, originY, cellSize)
        return {
          x: center.x + (screenPoint.x - center.x) * progress,
          y: center.y + (screenPoint.y - center.y) * progress
        }
      })

      ctx.save()
      ctx.globalAlpha = cell.isDoubleScore && cell.doubleScoreActivated ? 0.36 : 0.25
      ctx.fillStyle = this.getPlayerColor(cell.ownerId)
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  drawMixedShapeEdges(board, originX, originY, cellSize, animationManager, highlightedEdgeId = null) {
    for (const edge of board.edges.values()) {
      const line = this.getMixedShapeEdgeLine(edge, originX, originY, cellSize)

      if (edge.isObstacleEdge) {
        this.drawObstacleEdge(line)
        continue
      }

      if (edge.isBlocked) {
        this.drawBlockedCellEdge(line)
        continue
      }

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

  drawMixedShapePoints(board, originX, originY, cellSize) {
    const ctx = this.ctx
    const pointSet = new Set()

    for (const edge of board.edges.values()) {
      const line = this.getMixedShapeEdgeLine(edge, originX, originY, cellSize)
      pointSet.add(`${line.x1.toFixed(1)}_${line.y1.toFixed(1)}`)
      pointSet.add(`${line.x2.toFixed(1)}_${line.y2.toFixed(1)}`)
    }

    ctx.fillStyle = UITheme.colors.dot

    pointSet.forEach(value => {
      const [x, y] = value.split('_').map(Number)
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

drawHex(board, originX, originY, size, animationManager, highlightedEdgeId = null) {
  this.drawHexSpecialCells(board, originX, originY, size)
  this.drawHexCells(board, originX, originY, size, animationManager)
  this.drawHexEdges(board, originX, originY, size, animationManager, highlightedEdgeId)
  this.drawHexPoints(board, originX, originY, size)
}

  drawSpecialCells({ board, originX, originY, cellSize }) {
    for (const cell of board.cells.values()) {
      const x = originX + cell.x * cellSize
      const y = originY + cell.y * cellSize

      if (cell.isObstacle) {
        if (cell.isFrozen) {
          this.drawFrozenCellRect(x, y, cellSize, cellSize)
          continue
        }

        this.drawObstacleCellRect(x, y, cellSize, cellSize)
        continue
      }

      if (cell.isBomb) {
        this.drawCellMarker(x + cellSize / 2, y + cellSize / 2, cellSize, 'B', UITheme.colors.danger)
      }

      if (cell.isQuantum) {
        this.drawCellMarker(x + cellSize / 2, y + cellSize * 0.72, cellSize * 0.72, 'Q', UITheme.colors.purple)
      }

      if (cell.isDoubleScore) {
        this.drawDoubleScoreLabel(x + cellSize / 2, y + cellSize / 2, cellSize)
      }
    }
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
    if (cell.isDoubleScore && cell.doubleScoreActivated) {
      ctx.globalAlpha = 0.36
    }
    ctx.fillStyle = color
    this.roundRect(ctx, x, y, size, size, radius)
    ctx.fill()
    ctx.restore()
  }

  drawEdges({ board, originX, originY, cellSize, animationManager, highlightedEdgeId = null }) {
    for (const edge of board.edges.values()) {
      const line = this.getEdgeLine(edge, originX, originY, cellSize)

      if (edge.isObstacleEdge) {
        this.drawObstacleEdge(line)
        continue
      }

      if (edge.isBlocked) {
        this.drawBlockedCellEdge(line)
        continue
      }

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

    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 3
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(line.x1, line.y1)
    ctx.lineTo(line.x2, line.y2)
    ctx.stroke()
  }

  drawHighlightedEdge(line) {
    const ctx = this.ctx

    ctx.save()
    ctx.strokeStyle = UITheme.colors.warning
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(255, 196, 61, 0.45)'
    ctx.shadowBlur = 8

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
        ctx.fillStyle = UITheme.colors.dot
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

  drawObstacleEdge(line) {
    this.drawBlockedCellEdge(line, 6)
  }

  drawBlockedCellEdge(line, lineWidth = 5) {
    const ctx = this.ctx

    ctx.save()
    ctx.strokeStyle = this.obstacleColor
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(line.x1, line.y1)
    ctx.lineTo(line.x2, line.y2)
    ctx.stroke()
    ctx.restore()
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
    if (playerId === 'p1') return UITheme.colors.p1
    if (playerId === 'p2') return UITheme.colors.p2
    if (playerId === 'p3') return UITheme.colors.secondary
    if (playerId === 'p4') return UITheme.colors.warning
    return UITheme.colors.text
  }

  drawDoubleScoreLabel(cx, cy, size) {
    const ctx = this.ctx

    ctx.save()
    ctx.fillStyle = UITheme.colors.warning
    ctx.font = `bold ${Math.max(22, Math.floor(size * 0.46))}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('X2', cx, cy + 1)
    ctx.restore()
  }

  drawObstacleCellRect(x, y, width, height) {
    const ctx = this.ctx
    const pad = Math.max(5, Math.min(width, height) * 0.18)

    ctx.save()
    ctx.strokeStyle = this.obstacleColor
    ctx.lineWidth = Math.max(6, Math.min(width, height) * 0.12)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + pad, y + pad)
    ctx.lineTo(x + width - pad, y + height - pad)
    ctx.moveTo(x + width - pad, y + pad)
    ctx.lineTo(x + pad, y + height - pad)
    ctx.stroke()
    ctx.restore()
  }

  drawFrozenCellRect(x, y, width, height) {
    const ctx = this.ctx

    ctx.save()
    ctx.fillStyle = 'rgba(223, 240, 255, 0.72)'
    ctx.strokeStyle = UITheme.colors.primary
    ctx.lineWidth = Math.max(2, Math.min(width, height) * 0.06)
    this.roundRect(ctx, x + 4, y + 4, width - 8, height - 8, Math.min(8, width / 5))
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    this.drawCellMarker(x + width / 2, y + height / 2, Math.min(width, height), 'ICE', UITheme.colors.primary)
  }

  drawCellMarker(cx, cy, size, text, color) {
    const ctx = this.ctx

    ctx.save()
    ctx.fillStyle = color
    ctx.font = `bold ${Math.max(12, Math.floor(size * 0.28))}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, cx, cy)
    ctx.restore()
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

      if (edge.isObstacleEdge) {
        this.drawObstacleEdge(line)
        continue
      }

      if (edge.isBlocked) {
        this.drawBlockedCellEdge(line)
        continue
      }
  
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

  drawHexSpecialCells(board, originX, originY, size) {
    const ctx = this.ctx

    for (const cell of board.cells.values()) {
      const center = this.hexToPixel(cell.x, cell.y, size)
      const cx = center.x + originX
      const cy = center.y + originY

      if (cell.isObstacle) {
        if (cell.isFrozen) {
          this.drawCellMarker(cx, cy, size, 'ICE', UITheme.colors.primary)
          continue
        }

        const corners = this.getHexCorners(cx, cy, size * 0.82)

        ctx.save()
        ctx.beginPath()
        ctx.moveTo(corners[0].x, corners[0].y)
        for (let i = 1; i < corners.length; i++) {
          ctx.lineTo(corners[i].x, corners[i].y)
        }
        ctx.closePath()
        ctx.clip()
        this.drawObstacleCellRect(cx - size * 0.7, cy - size * 0.62, size * 1.4, size * 1.24)
        ctx.restore()
        continue
      }

      if (cell.isDoubleScore) {
        this.drawDoubleScoreLabel(cx, cy, size)
      }

      if (cell.isBomb) {
        this.drawCellMarker(cx, cy, size, 'B', UITheme.colors.danger)
      }

      if (cell.isQuantum) {
        this.drawCellMarker(cx, cy + size * 0.24, size * 0.72, 'Q', UITheme.colors.purple)
      }
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
      if (cell.isDoubleScore && cell.doubleScoreActivated) {
        ctx.globalAlpha = 0.36
      }
  
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
  
    ctx.fillStyle = UITheme.colors.dot
  
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
