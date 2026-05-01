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

    return {
      success: true,
      closedCells,
      extraTurn: closedCells.length > 0
    }
  }
}
