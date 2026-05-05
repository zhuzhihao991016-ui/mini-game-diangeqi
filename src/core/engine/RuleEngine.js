export default class RuleEngine {
  applyAction({ board, action }) {
    if (action.type !== 'CLAIM_EDGE') {
      return {
        success: false,
        reason: 'UNKNOWN_ACTION'
      }
    }

    const edge = board.getEdge(action.edgeId)

    if (!edge) {
      return {
        success: false,
        reason: 'EDGE_NOT_FOUND'
      }
    }

    if (edge.isClaimed()) {
      return {
        success: false,
        reason: 'EDGE_ALREADY_CLAIMED'
      }
    }

    edge.claim(action.playerId)

    const closedCells = []

    const adjacentCells = board.getAdjacentCellsByEdge(edge.id)

    for (const cell of adjacentCells) {
      if (cell.isObstacle) continue

      if (!cell.isOwned() && cell.isClosed(board)) {
        cell.setOwner(action.playerId)
        closedCells.push(cell)
      }
    }

    const specialClosedCells = this.applyChallengeSpecials({
      board,
      action,
      closedCells
    })

    for (const cell of specialClosedCells) {
      if (!closedCells.some(item => item.id === cell.id)) {
        closedCells.push(cell)
      }
    }

    return {
      success: true,
      closedCells,
      extraTurn: closedCells.length > 0
    }
  }

  applyChallengeSpecials({ board, action, closedCells }) {
    if (!board || !board.challengeMeta || !Array.isArray(closedCells) || closedCells.length === 0) {
      return []
    }

    const additionalClosedCells = []
    const pendingQuantumCells = closedCells.filter(cell => cell.isQuantum)
    const processedQuantumIds = new Set()

    while (pendingQuantumCells.length > 0) {
      const sourceCell = pendingQuantumCells.shift()
      if (!sourceCell || processedQuantumIds.has(sourceCell.id)) continue
      processedQuantumIds.add(sourceCell.id)

      const quantumResult = this.transferQuantumCell({
        board,
        sourceCell,
        fallbackPlayerId: action.playerId
      })

      for (const cell of quantumResult.closedCells) {
        if (!additionalClosedCells.some(item => item.id === cell.id)) {
          additionalClosedCells.push(cell)
        }
        if (cell.isQuantum && !processedQuantumIds.has(cell.id)) {
          pendingQuantumCells.push(cell)
        }
      }
    }

    this.unlockFrozenCells(board)

    const bombSources = [...closedCells, ...additionalClosedCells]
      .filter(cell => cell && cell.isBomb)

    for (const bombCell of bombSources) {
      this.applyBombCell(board, bombCell)
    }

    this.unlockFrozenCells(board)

    return additionalClosedCells.filter(cell => cell.ownerId)
  }

  transferQuantumCell({ board, sourceCell, fallbackPlayerId }) {
    const result = { closedCells: [] }
    const pairCell = this.getQuantumPairCell(board, sourceCell)

    if (!pairCell || pairCell.id === sourceCell.id || pairCell.isObstacle) {
      return result
    }

    const changedEdges = []
    pairCell.ownerId = sourceCell.ownerId || fallbackPlayerId

    const edgeCount = Math.min(sourceCell.edgeIds.length, pairCell.edgeIds.length)
    for (let index = 0; index < edgeCount; index++) {
      const sourceEdge = board.getEdge(sourceCell.edgeIds[index])
      const targetEdge = board.getEdge(pairCell.edgeIds[index])
      if (!sourceEdge || !targetEdge || targetEdge.isBlocked) continue

      const previousOwnerId = targetEdge.ownerId
      targetEdge.ownerId = sourceEdge.ownerId || null

      if (previousOwnerId !== targetEdge.ownerId) {
        changedEdges.push(targetEdge)
      }
    }

    result.closedCells.push(pairCell)

    for (const edge of changedEdges) {
      const adjacentCells = board.getAdjacentCellsByEdge(edge.id)

      for (const cell of adjacentCells) {
        if (!cell || cell.isObstacle || cell.isOwned()) continue
        if (!cell.isClosed(board)) continue

        cell.setOwner(edge.ownerId || pairCell.ownerId || fallbackPlayerId)
        result.closedCells.push(cell)
      }
    }

    return result
  }

  getQuantumPairCell(board, sourceCell) {
    if (!sourceCell || !sourceCell.quantumPairId) return null

    for (const cell of board.cells.values()) {
      if (
        cell.id !== sourceCell.id &&
        cell.isQuantum &&
        cell.quantumPairId === sourceCell.quantumPairId
      ) {
        return cell
      }
    }

    return null
  }

  unlockFrozenCells(board) {
    const frozenCells = Array.from(board.cells.values()).filter(cell => cell.isFrozen)

    for (const cell of frozenCells) {
      const neighbors = this.getNeighborCells(board, cell)
      if (!neighbors.some(neighbor => neighbor && neighbor.ownerId)) continue

      cell.isFrozen = false
      cell.isObstacle = false
    }
  }

  applyBombCell(board, bombCell) {
    if (!bombCell || !bombCell.ownerId) return

    const affectedCells = this.getBombAffectedCells(board, bombCell)
      .filter(cell => cell && cell.id !== bombCell.id && !cell.isObstacle)
    const affectedIds = new Set(affectedCells.map(cell => cell.id))
    const edgeIdsToCheck = new Set()

    for (const cell of affectedCells) {
      cell.ownerId = null
      cell.doubleScoreActivated = false
      for (const edgeId of cell.edgeIds) {
        edgeIdsToCheck.add(edgeId)
      }
    }

    for (const edgeId of edgeIdsToCheck) {
      const edge = board.getEdge(edgeId)
      if (!edge || edge.isBlocked || !edge.ownerId) continue
      if (bombCell.edgeIds.indexOf(edge.id) >= 0) continue

      const adjacentIds = edge.adjacentCellIds || []
      const touchesFarCell = adjacentIds.some(cellId => (
        cellId !== bombCell.id &&
        !affectedIds.has(cellId)
      ))

      if (touchesFarCell) continue

      edge.ownerId = null
    }
  }

  getBombAffectedCells(board, bombCell) {
    const meta = board.challengeMeta || {}
    if (meta.boardType === 'square') {
      return this.getSquareBombAffectedCells(board, bombCell)
    }

    return this.getNeighborCells(board, bombCell)
  }

  getSquareBombAffectedCells(board, bombCell) {
    const x = Number.isFinite(bombCell.gridX) ? bombCell.gridX : Math.floor(bombCell.x)
    const y = Number.isFinite(bombCell.gridY) ? bombCell.gridY : Math.floor(bombCell.y)
    const cells = []

    for (const cell of board.cells.values()) {
      const cx = Number.isFinite(cell.gridX) ? cell.gridX : Math.floor(cell.x)
      const cy = Number.isFinite(cell.gridY) ? cell.gridY : Math.floor(cell.y)
      const dx = Math.abs(cx - x)
      const dy = Math.abs(cy - y)

      if (dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0)) {
        cells.push(cell)
      }
    }

    return cells
  }

  getNeighborCells(board, cell) {
    const neighbors = new Map()

    for (const edgeId of cell.edgeIds) {
      const edge = board.getEdge(edgeId)
      if (!edge) continue

      for (const cellId of edge.adjacentCellIds) {
        if (cellId === cell.id) continue
        const neighbor = board.getCell(cellId)
        if (neighbor) neighbors.set(neighbor.id, neighbor)
      }
    }

    return Array.from(neighbors.values())
  }
}
