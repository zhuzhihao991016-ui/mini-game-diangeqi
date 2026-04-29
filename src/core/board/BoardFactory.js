import Board from './Board'
import Cell from './Cell'
import Edge from './Edge'

export default class BoardFactory {
  static createSquareBoard(rows, cols) {
    const board = new Board({ rows, cols })

    this.createHorizontalEdges(board, rows, cols)
    this.createVerticalEdges(board, rows, cols)
    this.createCells(board, rows, cols)
    board.type = 'square'

    return board
  }

  static createHorizontalEdges(board, rows, cols) {
    for (let y = 0; y <= rows; y++) {
      for (let x = 0; x < cols; x++) {
        const edge = new Edge({
          id: `h_${x}_${y}`,
          type: 'horizontal',
          x,
          y
        })

        board.addEdge(edge)
      }
    }
  }

  static createVerticalEdges(board, rows, cols) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x <= cols; x++) {
        const edge = new Edge({
          id: `v_${x}_${y}`,
          type: 'vertical',
          x,
          y
        })

        board.addEdge(edge)
      }
    }
  }

  static createCells(board, rows, cols) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const top = `h_${x}_${y}`
        const right = `v_${x + 1}_${y}`
        const bottom = `h_${x}_${y + 1}`
        const left = `v_${x}_${y}`

        const cellId = `c_${x}_${y}`

        const cell = new Cell({
          id: cellId,
          x,
          y,
          edgeIds: [top, right, bottom, left]
        })

        board.addCell(cell)

        board.getEdge(top).adjacentCellIds.push(cellId)
        board.getEdge(right).adjacentCellIds.push(cellId)
        board.getEdge(bottom).adjacentCellIds.push(cellId)
        board.getEdge(left).adjacentCellIds.push(cellId)
      }
    }
  }

  static createHexBoard(radius) {
    const board = new Board({ rows: 0, cols: 0 })
    board.type = 'hex'
    board.radius = radius
  
    const edgeMap = new Map()
  
    for (let q = -radius + 1; q <= radius - 1; q++) {
      for (let r = -radius + 1; r <= radius - 1; r++) {
        if (Math.abs(q + r) >= radius) continue
  
        const cellId = `c_${q}_${r}`
        const edgeIds = []
  
        for (let d = 0; d < 6; d++) {
          const edgeId = this.getHexEdgeKey(q, r, d)
  
          if (!edgeMap.has(edgeId)) {
            const edge = new Edge({
              id: edgeId,
              type: 'hex',
              q,
              r,
              direction: d
            })
  
            edgeMap.set(edgeId, edge)
            board.addEdge(edge)
          }
  
          edgeIds.push(edgeId)
        }
  
        const cell = new Cell({
          id: cellId,
          x: q,
          y: r,
          edgeIds
        })
  
        board.addCell(cell)
  
        edgeIds.forEach(eid => {
          board.getEdge(eid).adjacentCellIds.push(cellId)
        })
      }
    }
    let inner = 0
    let boundary = 0
    let invalid = 0
    
    for (const edge of board.edges.values()) {
      if (edge.adjacentCellIds.length === 1) {
        boundary++
      } else if (edge.adjacentCellIds.length === 2) {
        inner++
      } else {
        invalid++
        console.warn('异常边:', edge.id, edge.adjacentCellIds)
      }
    }
    
    console.log('hex cells:', board.cells.size)
    console.log('hex edges:', board.edges.size)
    console.log('inner edges:', inner)
    console.log('boundary edges:', boundary)
    console.log('invalid edges:', invalid)
    return board
  }

  hexToPixel(q, r, size) {
    return {
      x: size * Math.sqrt(3) * (q + r / 2),
      y: size * 1.5 * r
    }
  }

  static getHexCorners(cx, cy, size = 1) {
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

  static getHexEdgeKey(q, r, d) {
    const directions = [
      [1, 0],    // 0 east
      [0, 1],    // 1 southeast
      [-1, 1],   // 2 southwest
      [-1, 0],   // 3 west
      [0, -1],   // 4 northwest
      [1, -1]    // 5 northeast
    ]
  
    const [dq, dr] = directions[d]
    const nq = q + dq
    const nr = r + dr
  
    const a = `c_${q}_${r}`
    const b = `c_${nq}_${nr}`
  
    return a < b ? `e_${a}_${b}` : `e_${b}_${a}`
  }
}