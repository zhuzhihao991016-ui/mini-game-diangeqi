export default class SimpleAI {
  constructor() {}

  getAction({ board, playerId }) {
    // 1️⃣ 找能闭合的边
    const scoringEdges = this.getScoringEdges(board)

    if (scoringEdges.length > 0) {
      return this.pickRandom(scoringEdges)
    }

    // 2️⃣ 找安全边（不会变成三边格）
    const safeEdges = this.getSafeEdges(board)

    if (safeEdges.length > 0) {
      return this.pickRandom(safeEdges)
    }

    // 3️⃣ 没办法了，选“最不坏”的边
    const leastBadEdges = this.getLeastBadEdges(board)

    return this.pickRandom(leastBadEdges)
  }

  // -------------------------
  // 1️⃣ 能闭合格子的边
  // -------------------------
  getScoringEdges(board) {
    const result = []
  
    for (const edge of board.edges.values()) {
      if (edge.ownerId) continue
  
      const cells = board.getAdjacentCellsByEdge(edge.id)
  
      for (const cell of cells) {
        const count = this.countClaimedEdges(board, cell)
        const total = cell.edgeIds.length
  
        if (count === total - 1) {
          result.push(edge)
          break
        }
      }
    }
  
    return result
  }

  // -------------------------
  // 2️⃣ 安全边（不会变三边格）
  // -------------------------
  getSafeEdges(board) {
    const result = []
  
    for (const edge of board.edges.values()) {
      if (edge.ownerId) continue
  
      const cells = board.getAdjacentCellsByEdge(edge.id)
  
      let safe = true
  
      for (const cell of cells) {
        const count = this.countClaimedEdges(board, cell)
        const total = cell.edgeIds.length
  
        // 下一步会变成“可得分局面”
        if (count === total - 2) {
          safe = false
          break
        }
      }
  
      if (safe) {
        result.push(edge)
      }
    }
  
    return result
  }

  // -------------------------
  // 3️⃣ 最不坏（避免送连锁）
  // -------------------------
  getLeastBadEdges(board) {
    let minRisk = Infinity
    const candidates = []
  
    for (const edge of board.edges.values()) {
      if (edge.ownerId) continue
  
      const cells = board.getAdjacentCellsByEdge(edge.id)
  
      let risk = 0
  
      for (const cell of cells) {
        const count = this.countClaimedEdges(board, cell)
        const total = cell.edgeIds.length
  
        if (count === total - 2) {
          risk += 1
        }
      }
  
      if (risk < minRisk) {
        minRisk = risk
        candidates.length = 0
        candidates.push(edge)
      } else if (risk === minRisk) {
        candidates.push(edge)
      }
    }
  
    return candidates
  }
  // -------------------------
  // 工具函数
  // -------------------------
  countClaimedEdges(board, cell) {
    let count = 0

    for (const edgeId of cell.edgeIds) {
      const edge = board.getEdge(edgeId)
      if (edge.ownerId) count++
    }

    return count
  }

  pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)]
  }
}