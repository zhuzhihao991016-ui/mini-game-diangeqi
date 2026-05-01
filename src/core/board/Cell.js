export default class Cell {
  constructor({ id, x, y, edgeIds }) {
    this.id = id
    this.x = x
    this.y = y

    this.edgeIds = edgeIds
    this.ownerId = null
    this.isDoubleScore = false
    this.isObstacle = false
  }

  isOwned() {
    return this.ownerId !== null
  }

  isClosed(board) {
    return this.edgeIds.every(edgeId => {
      const edge = board.getEdge(edgeId)
      return edge && edge.isClaimed()
    })
  }

  setOwner(playerId) {
    this.ownerId = playerId
  }
}
