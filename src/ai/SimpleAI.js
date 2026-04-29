export default class SimpleAI {
  constructor({ difficulty = 'easy' } = {}) {
    this.difficulty = difficulty
    this.searchTimedOut = false
  }

  getAction({ board, playerId }) {
    if (this.difficulty === 'inferno') {
      return this.getInfernoAction({ board, playerId })
    }

    if (this.difficulty === 'hard') {
      return this.getHardAction({ board, playerId })
    }

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

  getHardAction({ board, playerId }) {
    const scoringEdges = this.getScoringEdges(board)

    if (scoringEdges.length > 0) {
      return this.pickBestByScore(scoringEdges, edge => {
        const sim = this.createSimulation(board)
        const closedCount = this.claimEdgeInSimulation(board, sim, edge.id).length

        return closedCount + this.countForcedChainClosures(board, sim)
      })
    }

    const safeEdges = this.getSafeEdges(board)

    if (safeEdges.length > 0) {
      return this.pickBestByScore(safeEdges, edge => {
        const sim = this.createSimulation(board)
        this.claimEdgeInSimulation(board, sim, edge.id)

        return -this.countTwoEdgeCellsAroundEdge(board, sim, edge)
      })
    }

    const openEdges = this.getOpenEdges(board)

    return this.pickBestByScore(openEdges, edge => {
      const sim = this.createSimulation(board)
      this.claimEdgeInSimulation(board, sim, edge.id)

      return -this.countForcedChainClosures(board, sim)
    })
  }

  getInfernoAction({ board, playerId }) {
    this.searchTimedOut = false

    const scoringEdges = this.getScoringEdges(board)
    const openEdges = this.getOpenEdges(board)

    if (scoringEdges.length > 0) {
      return this.pickBestByScore(scoringEdges, edge => {
        const sim = this.createSimulation(board)
        const closedCount = this.claimEdgeInSimulation(board, sim, edge.id).length

        return closedCount * 100 + this.countForcedChainClosures(board, sim)
      })
    }

    if (this.shouldUseFastInfernoStrategy(board, openEdges.length)) {
      return this.getFastInfernoAction(board)
    }

    const endgameMove = this.getEndgameChainAction(board)

    if (endgameMove) {
      return endgameMove
    }

    const searchMove = this.getMinimaxAction(board, playerId)

    if (searchMove) {
      return searchMove
    }

    return this.getHardAction({ board, playerId })
  }

  shouldUseFastInfernoStrategy(board, openEdgeCount) {
    const totalEdges = board.edges.size
    const claimedEdges = totalEdges - openEdgeCount
    const claimedRatio = totalEdges === 0 ? 1 : claimedEdges / totalEdges

    if (claimedRatio < 0.45) return true

    const safeEdges = this.getSafeEdges(board)
    if (safeEdges.length === 0) return false

    return openEdgeCount > this.getSearchOpenEdgeLimit(board)
  }

  getFastInfernoAction(board) {
    const safeEdges = this.getSafeEdges(board)

    if (safeEdges.length > 0) {
      return this.pickBestByScore(safeEdges, edge => {
        const cells = board.getAdjacentCellsByEdge(edge.id)
        let score = 0

        for (const cell of cells) {
          const claimed = this.countClaimedEdges(board, cell)
          score += cell.edgeIds.length - claimed
        }

        return score
      })
    }

    const leastBadEdges = this.getLeastBadEdges(board)
    return this.pickRandom(leastBadEdges)
  }

  getMinimaxAction(board, playerId) {
    const safeEdges = this.getSafeEdges(board)
    const openEdges = safeEdges.length > 0 ? safeEdges : this.getOpenEdges(board)
    if (openEdges.length === 0) return null

    const allOpenEdgeCount = this.getOpenEdges(board).length
    if (allOpenEdgeCount > this.getSearchOpenEdgeLimit(board)) return null

    const depth = this.getSearchDepth(board, allOpenEdgeCount)
    const deadline = Date.now() + this.getSearchTimeBudget(board, allOpenEdgeCount)
    const sim = this.createSearchSimulation(board, playerId)
    const moves = this.orderSearchMoves(board, sim, openEdges, playerId).slice(0, this.getBranchLimit(board))

    this.searchTimedOut = false

    let bestScore = -Infinity
    const bestMoves = []
    let alpha = -Infinity
    const beta = Infinity

    for (const edge of moves) {
      if (Date.now() >= deadline) {
        this.searchTimedOut = true
        break
      }

      const nextSim = this.cloneSearchSimulation(sim)
      const result = this.claimEdgeInSearchSimulation(board, nextSim, edge.id, playerId)
      const nextPlayerId = result.extraTurn ? playerId : this.getOpponentId(playerId)
      const score = this.minimax(board, nextSim, nextPlayerId, playerId, depth - 1, alpha, beta, deadline)

      if (score > bestScore) {
        bestScore = score
        bestMoves.length = 0
        bestMoves.push(edge)
      } else if (score === bestScore) {
        bestMoves.push(edge)
      }

      alpha = Math.max(alpha, bestScore)
    }

    return bestMoves.length > 0 ? this.pickRandom(bestMoves) : null
  }

  minimax(board, sim, currentPlayerId, aiPlayerId, depth, alpha, beta, deadline) {
    const openEdges = this.getOpenEdgesInSimulation(board, sim)

    if (depth <= 0 || openEdges.length === 0 || Date.now() >= deadline) {
      if (Date.now() >= deadline) this.searchTimedOut = true
      return this.evaluateSearchSimulation(board, sim, aiPlayerId)
    }

    const maximizing = currentPlayerId === aiPlayerId
    const moves = this.orderSearchMoves(board, sim, openEdges, currentPlayerId).slice(0, this.getBranchLimit(board))

    if (maximizing) {
      let value = -Infinity

      for (const edge of moves) {
        const nextSim = this.cloneSearchSimulation(sim)
        const result = this.claimEdgeInSearchSimulation(board, nextSim, edge.id, currentPlayerId)
        const nextPlayerId = result.extraTurn ? currentPlayerId : this.getOpponentId(currentPlayerId)

        value = Math.max(
          value,
          this.minimax(board, nextSim, nextPlayerId, aiPlayerId, depth - 1, alpha, beta, deadline)
        )
        alpha = Math.max(alpha, value)

        if (beta <= alpha || this.searchTimedOut) break
      }

      return value
    }

    let value = Infinity

    for (const edge of moves) {
      const nextSim = this.cloneSearchSimulation(sim)
      const result = this.claimEdgeInSearchSimulation(board, nextSim, edge.id, currentPlayerId)
      const nextPlayerId = result.extraTurn ? currentPlayerId : this.getOpponentId(currentPlayerId)

      value = Math.min(
        value,
        this.minimax(board, nextSim, nextPlayerId, aiPlayerId, depth - 1, alpha, beta, deadline)
      )
      beta = Math.min(beta, value)

      if (beta <= alpha || this.searchTimedOut) break
    }

    return value
  }

  getEndgameChainAction(board) {
    const safeEdges = this.getSafeEdges(board)
    const openEdges = this.getOpenEdges(board)

    if (safeEdges.length > 0 || openEdges.length === 0) return null

    const chainInfo = this.analyzeChainsAndLoops(board)
    if (chainInfo.components.length === 0) return null

    return this.pickBestByScore(openEdges, edge => {
      const sim = this.createSimulation(board)
      this.claimEdgeInSimulation(board, sim, edge.id)

      const giveaway = this.countForcedChainClosures(board, sim)
      const affected = this.getEdgeComponentSize(board, chainInfo, edge.id)
      const loopPenalty = this.isEdgeInLoop(board, chainInfo, edge.id) ? 1 : 0

      return -giveaway * 100 - affected * 3 - loopPenalty
    })
  }

  analyzeChainsAndLoops(board) {
    const chainCells = []
    const cellSet = new Set()

    for (const cell of board.cells.values()) {
      if (cell.ownerId) continue

      if (this.countClaimedEdges(board, cell) === cell.edgeIds.length - 2) {
        chainCells.push(cell)
        cellSet.add(cell.id)
      }
    }

    const visited = new Set()
    const components = []
    const edgeToComponent = new Map()

    for (const cell of chainCells) {
      if (visited.has(cell.id)) continue

      const stack = [cell]
      const cells = []
      let degreeTwoCount = 0

      visited.add(cell.id)

      while (stack.length > 0) {
        const current = stack.pop()
        const neighbors = this.getOpenNeighborCells(board, current, cellSet)

        cells.push(current)

        if (neighbors.length === 2) degreeTwoCount++

        for (const neighbor of neighbors) {
          if (visited.has(neighbor.id)) continue

          visited.add(neighbor.id)
          stack.push(neighbor)
        }
      }

      const component = {
        cells,
        size: cells.length,
        isLoop: cells.length > 2 && degreeTwoCount === cells.length
      }

      components.push(component)

      for (const componentCell of cells) {
        for (const edgeId of componentCell.edgeIds) {
          const edge = board.getEdge(edgeId)
          if (edge && !edge.ownerId) edgeToComponent.set(edgeId, component)
        }
      }
    }

    return {
      components,
      edgeToComponent
    }
  }

  getOpenNeighborCells(board, cell, allowedCellIds) {
    const result = []

    for (const edgeId of cell.edgeIds) {
      const edge = board.getEdge(edgeId)
      if (!edge || edge.ownerId) continue

      for (const cellId of edge.adjacentCellIds) {
        if (cellId !== cell.id && allowedCellIds.has(cellId)) {
          result.push(board.getCell(cellId))
        }
      }
    }

    return result
  }

  getEdgeComponentSize(board, chainInfo, edgeId) {
    const component = chainInfo.edgeToComponent.get(edgeId)
    return component ? component.size : 0
  }

  isEdgeInLoop(board, chainInfo, edgeId) {
    const component = chainInfo.edgeToComponent.get(edgeId)
    return !!component && component.isLoop
  }

  createSearchSimulation(board, playerId) {
    const sim = this.createSimulation(board)
    const opponentId = this.getOpponentId(playerId)

    sim.scores = {
      [playerId]: 0,
      [opponentId]: 0
    }

    for (const cell of board.cells.values()) {
      if (!cell.ownerId) continue
      if (!sim.scores[cell.ownerId]) sim.scores[cell.ownerId] = 0
      sim.scores[cell.ownerId]++
    }

    return sim
  }

  cloneSearchSimulation(sim) {
    return {
      claimedEdgeIds: new Set(sim.claimedEdgeIds),
      ownedCellIds: new Set(sim.ownedCellIds),
      scores: Object.assign({}, sim.scores)
    }
  }

  claimEdgeInSearchSimulation(board, sim, edgeId, playerId) {
    const closedCells = this.claimEdgeInSimulation(board, sim, edgeId)

    if (!sim.scores[playerId]) sim.scores[playerId] = 0
    sim.scores[playerId] += closedCells.length

    return {
      closedCells,
      extraTurn: closedCells.length > 0
    }
  }

  getOpenEdgesInSimulation(board, sim) {
    const result = []

    for (const edge of board.edges.values()) {
      if (!sim.claimedEdgeIds.has(edge.id)) result.push(edge)
    }

    return result
  }

  orderSearchMoves(board, sim, edges, playerId) {
    return edges
      .map(edge => ({
        edge,
        score: this.getMoveOrderingScore(board, sim, edge)
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.edge)
  }

  getMoveOrderingScore(board, sim, edge) {
    const closingCells = board.getAdjacentCellsByEdge(edge.id)
      .filter(cell => {
        if (sim.ownedCellIds.has(cell.id)) return false

        return this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 1
      })
      .length

    if (closingCells > 0) return 1000 + closingCells * 100

    const makesThree = this.countTwoEdgeCellsAroundEdge(board, sim, edge)
    const chainRisk = this.countChainRiskAfterMove(board, sim, edge)

    return -makesThree * 80 - chainRisk * 12
  }

  countChainRiskAfterMove(board, sim, edge) {
    const nextSim = {
      claimedEdgeIds: new Set(sim.claimedEdgeIds),
      ownedCellIds: new Set(sim.ownedCellIds)
    }

    this.claimEdgeInSimulation(board, nextSim, edge.id)

    return this.countForcedChainClosures(board, nextSim)
  }

  evaluateSearchSimulation(board, sim, aiPlayerId) {
    const opponentId = this.getOpponentId(aiPlayerId)
    const aiScore = sim.scores[aiPlayerId] || 0
    const opponentScore = sim.scores[opponentId] || 0
    const scoreDiff = aiScore - opponentScore
    const openEdges = this.getOpenEdgesInSimulation(board, sim)
    let safeEdges = 0
    let opponentThreats = 0
    let chainExposure = 0

    for (const edge of openEdges) {
      const makesThree = this.countTwoEdgeCellsAroundEdge(board, sim, edge)
      const closesNow = board.getAdjacentCellsByEdge(edge.id)
        .some(cell => {
          if (sim.ownedCellIds.has(cell.id)) return false

          return this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 1
        })

      if (makesThree === 0 && !closesNow) safeEdges++
      if (closesNow) opponentThreats++
      if (makesThree > 0) chainExposure += makesThree
    }

    return scoreDiff * 100 + safeEdges * 3 - opponentThreats * 45 - chainExposure * 12
  }

  getSearchDepth(board, openEdgeCount) {
    const cellCount = board.cells.size

    if (openEdgeCount <= 8) return 8
    if (openEdgeCount <= 12) return 7
    if (openEdgeCount <= 18) return 5
    if (cellCount <= 9) return 4
    if (cellCount <= 25) return 4
    if (cellCount <= 36) return 4
    return 3
  }

  getBranchLimit(board) {
    const cellCount = board.cells.size

    if (cellCount <= 9) return 10
    if (cellCount <= 36) return 8
    return 6
  }

  getSearchOpenEdgeLimit(board) {
    const cellCount = board.cells.size

    if (cellCount <= 9) return 18
    if (cellCount <= 25) return 16
    if (cellCount <= 36) return 14
    return 12
  }

  getSearchTimeBudget(board, openEdgeCount) {
    if (openEdgeCount <= 8) return 42
    if (board.cells.size <= 9) return 34
    return 26
  }

  getOpponentId(playerId) {
    return playerId === 'p1' ? 'p2' : 'p1'
  }

  getOpenEdges(board) {
    const result = []

    for (const edge of board.edges.values()) {
      if (!edge.ownerId) result.push(edge)
    }

    return result
  }

  createSimulation(board) {
    const claimedEdgeIds = new Set()
    const ownedCellIds = new Set()

    for (const edge of board.edges.values()) {
      if (edge.ownerId) claimedEdgeIds.add(edge.id)
    }

    for (const cell of board.cells.values()) {
      if (cell.ownerId) ownedCellIds.add(cell.id)
    }

    return {
      claimedEdgeIds,
      ownedCellIds
    }
  }

  claimEdgeInSimulation(board, sim, edgeId) {
    if (sim.claimedEdgeIds.has(edgeId)) return []

    sim.claimedEdgeIds.add(edgeId)

    const closedCells = []

    for (const cell of board.getAdjacentCellsByEdge(edgeId)) {
      if (sim.ownedCellIds.has(cell.id)) continue

      if (this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length) {
        sim.ownedCellIds.add(cell.id)
        closedCells.push(cell)
      }
    }

    return closedCells
  }

  countForcedChainClosures(board, sim) {
    let total = 0

    while (true) {
      const edge = this.findBestScoringEdgeInSimulation(board, sim)

      if (!edge) break

      const closedCells = this.claimEdgeInSimulation(board, sim, edge.id)

      if (closedCells.length === 0) break

      total += closedCells.length
    }

    return total
  }

  findBestScoringEdgeInSimulation(board, sim) {
    let bestEdges = []
    let bestClosedCount = 0

    for (const edge of board.edges.values()) {
      if (sim.claimedEdgeIds.has(edge.id)) continue

      const closedCount = board.getAdjacentCellsByEdge(edge.id)
        .filter(cell => {
          if (sim.ownedCellIds.has(cell.id)) return false

          return this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 1
        })
        .length

      if (closedCount <= 0) continue

      if (closedCount > bestClosedCount) {
        bestClosedCount = closedCount
        bestEdges = [edge]
      } else if (closedCount === bestClosedCount) {
        bestEdges.push(edge)
      }
    }

    return this.pickRandom(bestEdges)
  }

  countTwoEdgeCellsAroundEdge(board, sim, edge) {
    let count = 0

    for (const cell of board.getAdjacentCellsByEdge(edge.id)) {
      if (sim.ownedCellIds.has(cell.id)) continue

      if (this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 2) {
        count++
      }
    }

    return count
  }

  countClaimedEdgesInSimulation(cell, sim) {
    let count = 0

    for (const edgeId of cell.edgeIds) {
      if (sim.claimedEdgeIds.has(edgeId)) count++
    }

    return count
  }

  pickBestByScore(list, scoreFn) {
    let bestScore = -Infinity
    const bestItems = []

    for (const item of list) {
      const score = scoreFn(item)

      if (score > bestScore) {
        bestScore = score
        bestItems.length = 0
        bestItems.push(item)
      } else if (score === bestScore) {
        bestItems.push(item)
      }
    }

    return this.pickRandom(bestItems)
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
