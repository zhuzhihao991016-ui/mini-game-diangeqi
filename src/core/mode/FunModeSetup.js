const DOUBLE_CELL_COUNT = 2
const OBSTACLE_CELL_COUNT = 2
const OBSTACLE_EDGE_COUNT = 2

function createRandom(seed) {
  if (!seed) return Math.random

  let hash = 2166136261
  const text = String(seed)

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return function random() {
    hash += 0x6D2B79F5
    let value = hash
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function shuffle(list, random = Math.random) {
  const result = list.slice()

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }

  return result
}

function pickCells(board, count, excludedIds = new Set(), random = Math.random) {
  return shuffle(Array.from(board.cells.values()), random)
    .filter(cell => !excludedIds.has(cell.id))
    .slice(0, count)
}

function canUseObstacleEdge(board, edge) {
  if (!edge || edge.isBlocked || edge.ownerId) return false

  return board.getAdjacentCellsByEdge(edge.id)
    .every(cell => !cell.isObstacle)
}

export function setupFunModeBoard(board, options = {}) {
  const random = createRandom(options.seed)
  const doubleCells = pickCells(board, DOUBLE_CELL_COUNT, new Set(), random)
  const reservedCellIds = new Set(doubleCells.map(cell => cell.id))
  const obstacleCells = pickCells(board, OBSTACLE_CELL_COUNT, reservedCellIds, random)

  for (const cell of doubleCells) {
    cell.isDoubleScore = true
  }

  for (const cell of obstacleCells) {
    cell.isObstacle = true
    reservedCellIds.add(cell.id)

    for (const edgeId of cell.edgeIds) {
      const edge = board.getEdge(edgeId)
      if (edge) {
        edge.isBlocked = true
        edge.blockReason = 'cell'
      }
    }
  }

  const obstacleEdges = shuffle(Array.from(board.edges.values()), random)
    .filter(edge => canUseObstacleEdge(board, edge))
    .slice(0, OBSTACLE_EDGE_COUNT)

  for (const edge of obstacleEdges) {
    edge.isBlocked = true
    edge.isObstacleEdge = true
    edge.blockReason = 'edge'
  }

  board.funMode = true
  board.funModeMeta = {
    doubleCellIds: doubleCells.map(cell => cell.id),
    obstacleCellIds: obstacleCells.map(cell => cell.id),
    obstacleEdgeIds: obstacleEdges.map(edge => edge.id),
    seed: options.seed || ''
  }

  return board
}
