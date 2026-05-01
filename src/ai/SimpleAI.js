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
      if (!this.isEdgePlayable(edge)) continue
  
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
      if (!this.isEdgePlayable(edge)) continue
  
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
      if (!this.isEdgePlayable(edge)) continue
  
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

    const position = this.analyzeInfernoPosition(board)
    const scoringEdges = position.scoringEdges
    const openEdges = position.openEdges

    if (position.isControlPhase) {
      const doubleCross = this.getDoubleCrossAction(board, position)
      if (doubleCross) return doubleCross.edge

      if (scoringEdges.length > 0) {
        return this.pickBestByScore(scoringEdges, edge => (
          this.evaluateControlScoringMove(board, edge, position)
        ))
      }

      const controlMove = this.getControlChainAction(board, position)
      return controlMove ? controlMove.edge : this.getFallbackInfernoAction(board, playerId, position)
    }

    if (scoringEdges.length > 0) {
      const bestScoring = this.pickBestWithScore(scoringEdges, edge => (
        this.evaluateScoringMoveAftermath(board, edge)
      ))
      const controlCandidate = this.getControlChainAction(board, position, { preferNonScoring: true })

      if (controlCandidate && controlCandidate.score > bestScoring.score) {
        return controlCandidate.edge
      }

      return bestScoring.edge
    }

    if (position.safeEdges.length > 0) {
      if (openEdges.length > this.getSearchOpenEdgeLimit(board)) {
        return this.getFastInfernoAction(board, position)
      }

      const searchMove = this.getMinimaxAction(board, playerId, position)
      if (searchMove) return searchMove

      return this.getFastInfernoAction(board, position)
    }

    const controlMove = this.getControlChainAction(board, position)
    return controlMove ? controlMove.edge : this.getFallbackInfernoAction(board, playerId, position)
  }

  analyzeInfernoPosition(board) {
    const openEdges = this.getOpenEdges(board)
    const scoringEdges = this.getScoringEdges(board)
    const safeEdges = this.getSafeEdges(board)
    const totalEdges = board.edges.size
    const claimedRatio = totalEdges === 0 ? 1 : (totalEdges - openEdges.length) / totalEdges
    const sim = this.createSimulation(board)
    const threeEdgeCells = this.countThreeEdgeCellsInSimulation(board, sim)
    const chainInfo = this.analyzeChainsAndLoopsInSimulation(board, sim)
    const hasLongChain = chainInfo.components.some(component => component.size >= 3)
    const doubleCrossEdges = this.getDoubleCrossEdges(board, chainInfo)

    return {
      openEdges,
      scoringEdges,
      safeEdges,
      claimedRatio,
      threeEdgeCells,
      chainInfo,
      doubleCrossEdges,
      isControlPhase:
        safeEdges.length === 0 ||
        threeEdgeCells >= 2 ||
        hasLongChain ||
        claimedRatio >= 0.65
    }
  }

  evaluateControlScoringMove(board, edge, position) {
    const sim = this.createSimulation(board)
    const closedCount = this.claimEdgeInSimulation(board, sim, edge.id).length
    const ownForced = this.countForcedChainClosures(board, sim)
    const gained = closedCount + ownForced
    const after = this.describeSimulationPosition(board, sim)
    const opponentForced = this.countForcedChainClosures(board, this.cloneBasicSimulation(sim))
    const keepsControl = this.hasControlAfterMove(board, sim, position)
    const forcesOpponentOpenChain = this.forcesOpponentToOpenChain(board, sim)
    const givesLongChain = after.longChainExposure > 0 ? 1 : 0
    const givesLoop = after.loopExposure > 0 ? 1 : 0

    return gained * 80 +
      (keepsControl ? 300 : 0) +
      (forcesOpponentOpenChain ? 260 : 0) -
      givesLongChain * 350 -
      givesLoop * 420 -
      opponentForced * 120
  }

  evaluateScoringMoveAftermath(board, edge) {
    const sim = this.createSimulation(board)
    const closedCount = this.claimEdgeInSimulation(board, sim, edge.id).length
    const ownForced = this.countForcedChainClosures(board, sim)
    const opponentForced = this.countForcedChainClosures(board, this.cloneBasicSimulation(sim))
    const after = this.describeSimulationPosition(board, sim)

    return closedCount * 100 +
      ownForced * 80 -
      opponentForced * 120 +
      (after.safeEdges.length > 0 ? 40 : -180) -
      after.longChainExposure * 300 -
      after.loopExposure * 400
  }

  getFastInfernoAction(board, position = this.analyzeInfernoPosition(board)) {
    const safeEdges = position.safeEdges

    if (safeEdges.length > 0) {
      return this.pickBestByScore(safeEdges, edge => {
        const sim = this.createSimulation(board)
        this.claimEdgeInSimulation(board, sim, edge.id)
        const after = this.describeSimulationPosition(board, sim)
        const cells = board.getAdjacentCellsByEdge(edge.id)
        let score = 0

        for (const cell of cells) {
          const claimed = this.countClaimedEdges(board, cell)
          score += cell.edgeIds.length - claimed
        }

        return score * 10 +
          after.safeEdges.length * 4 -
          after.threeEdgeCells * 35 -
          after.longChainExposure * 90 -
          after.loopExposure * 120
      })
    }

    const leastBadEdges = this.getLeastBadEdges(board)
    return this.pickRandom(leastBadEdges)
  }

  getMinimaxAction(board, playerId, position = this.analyzeInfernoPosition(board)) {
    const openEdges = this.getInfernoSearchCandidates(board, position)
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

  getInfernoSearchCandidates(board, position) {
    const candidates = new Map()

    for (const edge of position.scoringEdges) candidates.set(edge.id, edge)
    for (const edge of position.safeEdges) candidates.set(edge.id, edge)

    const controlEdges = this.rankControlChainEdges(board, position)
      .slice(0, this.getBranchLimit(board))

    for (const item of controlEdges) candidates.set(item.edge.id, item.edge)

    for (const item of position.doubleCrossEdges) {
      candidates.set(item.edge.id, item.edge)
    }

    if (candidates.size === 0) {
      for (const edge of position.openEdges) candidates.set(edge.id, edge)
    }

    return Array.from(candidates.values())
  }

  getControlChainAction(board, position = this.analyzeInfernoPosition(board), options = {}) {
    const ranked = this.rankControlChainEdges(board, position, options)
    return ranked.length > 0 ? ranked[0] : null
  }

  rankControlChainEdges(board, position, options = {}) {
    const scoringIds = new Set(position.scoringEdges.map(edge => edge.id))
    const edges = position.openEdges.filter(edge => (
      !options.preferNonScoring || !scoringIds.has(edge.id)
    ))

    return edges
      .map(edge => ({
        edge,
        score: this.scoreControlChainEdge(board, edge, position)
      }))
      .sort((a, b) => b.score - a.score)
  }

  scoreControlChainEdge(board, edge, position) {
    const sim = this.createSimulation(board)
    const closedCount = this.claimEdgeInSimulation(board, sim, edge.id).length
    const giveaway = this.countForcedChainClosures(board, this.cloneBasicSimulation(sim))
    const after = this.describeSimulationPosition(board, sim)
    const currentComponent = position.chainInfo.edgeToComponent.get(edge.id)
    const componentSize = currentComponent ? currentComponent.size : 0
    const loopPenalty = currentComponent && currentComponent.isLoop ? 1 : 0
    const opensLargestChain = componentSize > 0 && componentSize === position.chainInfo.largestChainSize
    const forcesOpen = this.forcesOpponentToOpenChain(board, sim)

    return (forcesOpen ? 260 : 0) -
      giveaway * 120 -
      closedCount * 30 -
      loopPenalty * 420 -
      (opensLargestChain ? 90 : 0) -
      componentSize * 3 -
      after.loopExposure * 80
  }

  getDoubleCrossAction(board, position = this.analyzeInfernoPosition(board)) {
    if (!position.doubleCrossEdges || position.doubleCrossEdges.length === 0) return null

    const ranked = position.doubleCrossEdges
      .map(item => ({
        edge: item.edge,
        score: this.scoreDoubleCrossEdge(board, item, position)
      }))
      .sort((a, b) => b.score - a.score)

    return ranked[0]
  }

  getDoubleCrossEdges(board, chainInfo) {
    const result = []

    for (const component of chainInfo.components) {
      if (component.size < 3 || component.isLoop) continue

      for (const cell of component.cells) {
        for (const edgeId of cell.edgeIds) {
          const edge = board.getEdge(edgeId)
          if (!edge || !this.isEdgePlayable(edge)) continue

          const adjacentChainCells = edge.adjacentCellIds
            .map(cellId => board.getCell(cellId))
            .filter(adjacentCell => (
              adjacentCell &&
              component.cells.some(componentCell => componentCell.id === adjacentCell.id)
            ))

          if (adjacentChainCells.length !== 2) continue
          if (!this.isDoubleCrossSacrificeEdge(board, edge, adjacentChainCells)) continue

          result.push({
            edge,
            component,
            cells: adjacentChainCells
          })
        }
      }
    }

    return this.uniqueEdgeItems(result)
  }

  isDoubleCrossSacrificeEdge(board, edge, cells) {
    if (this.wouldScoreEdge(board, edge)) return false

    const sim = this.createSimulation(board)
    this.claimEdgeInSimulation(board, sim, edge.id)

    let createdThreats = 0

    for (const cell of cells) {
      if (sim.ownedCellIds.has(cell.id) || cell.isObstacle) continue
      if (this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 1) {
        createdThreats++
      }
    }

    if (createdThreats !== 2) return false

    return this.countForcedChainClosures(board, this.cloneBasicSimulation(sim)) === 2
  }

  scoreDoubleCrossEdge(board, item, position) {
    const sim = this.createSimulation(board)
    this.claimEdgeInSimulation(board, sim, item.edge.id)
    const opponentForced = this.countForcedChainClosures(board, this.cloneBasicSimulation(sim))
    const after = this.describeSimulationPosition(board, sim)
    const nextChains = after.chainInfo.components
      .filter(component => component.size >= 3)
      .length

    return 900 +
      nextChains * 260 -
      Math.abs(opponentForced - 2) * 260 -
      item.component.size * 8 -
      after.loopExposure * 220
  }

  wouldScoreEdge(board, edge) {
    return board.getAdjacentCellsByEdge(edge.id)
      .some(cell => this.countClaimedEdges(board, cell) === cell.edgeIds.length - 1)
  }

  uniqueEdgeItems(items) {
    const seen = new Set()
    const result = []

    for (const item of items) {
      if (seen.has(item.edge.id)) continue
      seen.add(item.edge.id)
      result.push(item)
    }

    return result
  }

  getFallbackInfernoAction(board, playerId, position = this.analyzeInfernoPosition(board)) {
    const scoringEdges = position.scoringEdges
    const controlMove = this.getControlChainAction(board, position, { preferNonScoring: true })

    if (scoringEdges.length > 0) {
      const bestScoring = this.pickBestWithScore(scoringEdges, edge => (
        this.evaluateControlScoringMove(board, edge, position)
      ))

      if (this.scoringMoveKeepsControl(board, bestScoring.edge, position)) {
        return bestScoring.edge
      }

      if (controlMove) return controlMove.edge
    }

    return controlMove ? controlMove.edge : this.getHardAction({ board, playerId })
  }

  scoringMoveKeepsControl(board, edge, position) {
    const sim = this.createSimulation(board)
    this.claimEdgeInSimulation(board, sim, edge.id)
    return this.hasControlAfterMove(board, sim, position)
  }

  isDoubleCrossCandidate(board, edge, position) {
    return position.doubleCrossEdges.some(item => item.edge.id === edge.id)
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
      if (cell.ownerId || cell.isObstacle) continue

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
          if (edge && this.isEdgePlayable(edge)) edgeToComponent.set(edgeId, component)
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
      if (!edge || !this.isEdgePlayable(edge)) continue

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

  describeSimulationPosition(board, sim) {
    const safeEdges = this.getSafeEdgesInSimulation(board, sim)
    const scoringEdges = this.getScoringEdgesInSimulation(board, sim)
    const chainInfo = this.analyzeChainsAndLoopsInSimulation(board, sim)
    let longChainExposure = 0
    let loopExposure = 0

    for (const component of chainInfo.components) {
      if (component.size >= 3) longChainExposure += component.size
      if (component.isLoop) loopExposure += component.size
    }

    return {
      safeEdges,
      scoringEdges,
      threeEdgeCells: this.countThreeEdgeCellsInSimulation(board, sim),
      chainInfo,
      longChainExposure,
      loopExposure
    }
  }

  getScoringEdgesInSimulation(board, sim) {
    const result = []

    for (const edge of board.edges.values()) {
      if (this.isEdgeClaimedInSimulation(edge, sim)) continue

      const closesCell = board.getAdjacentCellsByEdge(edge.id)
        .some(cell => {
          if (sim.ownedCellIds.has(cell.id) || cell.isObstacle) return false
          return this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 1
        })

      if (closesCell) result.push(edge)
    }

    return result
  }

  getSafeEdgesInSimulation(board, sim) {
    const result = []

    for (const edge of board.edges.values()) {
      if (this.isEdgeClaimedInSimulation(edge, sim)) continue

      const makesThree = board.getAdjacentCellsByEdge(edge.id)
        .some(cell => {
          if (sim.ownedCellIds.has(cell.id) || cell.isObstacle) return false
          return this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 2
        })

      if (!makesThree) result.push(edge)
    }

    return result
  }

  countThreeEdgeCellsInSimulation(board, sim) {
    let count = 0

    for (const cell of board.cells.values()) {
      if (sim.ownedCellIds.has(cell.id) || cell.isObstacle) continue

      if (this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 1) {
        count++
      }
    }

    return count
  }

  analyzeChainsAndLoopsInSimulation(board, sim) {
    const chainCells = []
    const cellSet = new Set()

    for (const cell of board.cells.values()) {
      if (sim.ownedCellIds.has(cell.id) || cell.isObstacle) continue

      if (this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 2) {
        chainCells.push(cell)
        cellSet.add(cell.id)
      }
    }

    const visited = new Set()
    const components = []
    const edgeToComponent = new Map()
    let largestChainSize = 0

    for (const cell of chainCells) {
      if (visited.has(cell.id)) continue

      const stack = [cell]
      const cells = []
      let degreeTwoCount = 0

      visited.add(cell.id)

      while (stack.length > 0) {
        const current = stack.pop()
        const neighbors = this.getOpenNeighborCellsInSimulation(board, sim, current, cellSet)

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

      largestChainSize = Math.max(largestChainSize, component.size)
      components.push(component)

      for (const componentCell of cells) {
        for (const edgeId of componentCell.edgeIds) {
          const edge = board.getEdge(edgeId)
          if (edge && !this.isEdgeClaimedInSimulation(edge, sim)) {
            edgeToComponent.set(edgeId, component)
          }
        }
      }
    }

    return {
      components,
      edgeToComponent,
      largestChainSize
    }
  }

  getOpenNeighborCellsInSimulation(board, sim, cell, allowedCellIds) {
    const result = []

    for (const edgeId of cell.edgeIds) {
      const edge = board.getEdge(edgeId)
      if (!edge || this.isEdgeClaimedInSimulation(edge, sim)) continue

      for (const cellId of edge.adjacentCellIds) {
        if (cellId !== cell.id && allowedCellIds.has(cellId)) {
          result.push(board.getCell(cellId))
        }
      }
    }

    return result
  }

  hasControlAfterMove(board, sim) {
    const after = this.describeSimulationPosition(board, sim)
    if (after.scoringEdges.length > 0) return true
    if (after.safeEdges.length > 0) return true
    return this.forcesOpponentToOpenChain(board, sim)
  }

  forcesOpponentToOpenChain(board, sim) {
    const after = this.describeSimulationPosition(board, sim)
    const hasLongChain = after.chainInfo.components.some(component => component.size >= 3)
    return after.scoringEdges.length === 0 && after.safeEdges.length === 0 && hasLongChain
  }

  createSearchSimulation(board, playerId) {
    const sim = this.createSimulation(board)
    const opponentId = this.getOpponentId(playerId)

    sim.scores = {
      [playerId]: 0,
      [opponentId]: 0
    }

    for (const cell of board.cells.values()) {
      if (!cell.ownerId || cell.isObstacle) continue
      if (!sim.scores[cell.ownerId]) sim.scores[cell.ownerId] = 0
      sim.scores[cell.ownerId] += cell.isDoubleScore && cell.doubleScoreActivated ? 2 : 1
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

  cloneBasicSimulation(sim) {
    return {
      claimedEdgeIds: new Set(sim.claimedEdgeIds),
      ownedCellIds: new Set(sim.ownedCellIds)
    }
  }

  claimEdgeInSearchSimulation(board, sim, edgeId, playerId) {
    const closedCells = this.claimEdgeInSimulation(board, sim, edgeId)

    if (!sim.scores[playerId]) sim.scores[playerId] = 0
    sim.scores[playerId] += closedCells.reduce((sum, cell) => (
      sum + (cell.isDoubleScore && closedCells.length > 1 ? 2 : 1)
    ), 0)

    return {
      closedCells,
      extraTurn: closedCells.length > 0
    }
  }

  getOpenEdgesInSimulation(board, sim) {
    const result = []

    for (const edge of board.edges.values()) {
      if (!this.isEdgeClaimedInSimulation(edge, sim)) result.push(edge)
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
        if (sim.ownedCellIds.has(cell.id) || cell.isObstacle) return false

        return this.countClaimedEdgesInSimulation(cell, sim) === cell.edgeIds.length - 1
      })
      .length

    if (closingCells > 0) return 1200 + closingCells * 120

    const makesThree = this.countTwoEdgeCellsAroundEdge(board, sim, edge)
    const chainRisk = this.countChainRiskAfterMove(board, sim, edge)
    const nextSim = this.cloneBasicSimulation(sim)
    this.claimEdgeInSimulation(board, nextSim, edge.id)
    const after = this.describeSimulationPosition(board, nextSim)
    const forcesOpen = this.forcesOpponentToOpenChain(board, nextSim)

    return (forcesOpen ? 220 : 0) -
      makesThree * 80 -
      chainRisk * 12 -
      after.longChainExposure * 40 -
      after.loopExposure * 70
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
    const after = this.describeSimulationPosition(board, sim)
    const control = this.hasControlAfterMove(board, sim) ? 1 : 0
    const forceOpponentOpen = this.forcesOpponentToOpenChain(board, sim) ? 1 : 0
    const opponentForced = this.countForcedChainClosures(board, this.cloneBasicSimulation(sim))

    return scoreDiff * 100 +
      control * 280 +
      after.safeEdges.length * 4 +
      forceOpponentOpen * 220 -
      opponentForced * 130 -
      after.threeEdgeCells * 50 -
      after.longChainExposure * 160 -
      after.loopExposure * 220
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
      if (this.isEdgePlayable(edge)) result.push(edge)
    }

    return result
  }

  createSimulation(board) {
    const claimedEdgeIds = new Set()
    const ownedCellIds = new Set()

    for (const edge of board.edges.values()) {
      if (!this.isEdgePlayable(edge)) claimedEdgeIds.add(edge.id)
    }

    for (const cell of board.cells.values()) {
      if (cell.ownerId || cell.isObstacle) ownedCellIds.add(cell.id)
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
      if (sim.ownedCellIds.has(cell.id) || cell.isObstacle) continue

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
      if (this.isEdgeClaimedInSimulation(edge, sim)) continue

      const closedCount = board.getAdjacentCellsByEdge(edge.id)
        .filter(cell => {
          if (sim.ownedCellIds.has(cell.id) || cell.isObstacle) return false

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
      if (sim.ownedCellIds.has(cell.id) || cell.isObstacle) continue

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
  pickBestWithScore(list, scoreFn) {
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

    return {
      edge: this.pickRandom(bestItems),
      score: bestScore
    }
  }

  countClaimedEdges(board, cell) {
    let count = 0

    for (const edgeId of cell.edgeIds) {
      const edge = board.getEdge(edgeId)
      if (!this.isEdgePlayable(edge)) count++
    }

    return count
  }

  isEdgePlayable(edge) {
    return !!edge && !edge.ownerId && !edge.isBlocked
  }

  isEdgeClaimedInSimulation(edge, sim) {
    return !this.isEdgePlayable(edge) || sim.claimedEdgeIds.has(edge.id)
  }

  pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)]
  }
}
