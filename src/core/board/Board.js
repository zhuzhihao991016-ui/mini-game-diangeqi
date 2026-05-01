export default class Board {
  constructor({ rows, cols }) {
    this.rows = rows
    this.cols = cols

    this.cells = new Map()
    this.edges = new Map()
  }

  addCell(cell) {
    this.cells.set(cell.id, cell)
  }

  addEdge(edge) {
    this.edges.set(edge.id, edge)
  }

  getCell(cellId) {
    return this.cells.get(cellId)
  }

  getEdge(edgeId) {
    return this.edges.get(edgeId)
  }

  getAdjacentCellsByEdge(edgeId) {
    const edge = this.getEdge(edgeId)

    if (!edge) return []

    return edge.adjacentCellIds
      .map(cellId => this.getCell(cellId))
      .filter(Boolean)
  }

  isAllCellsClosed() {
    for (const cell of this.cells.values()) {
      if (cell.isObstacle) continue
      if (!cell.isOwned()) return false
    }

    return true
  }
}
