const LEVEL_COUNT = 20
const MIN_GRID_SIZE = 7

function createRandom(seed) {
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

function key(x, y) {
  return `${x}_${y}`
}

function parseKey(cellKey) {
  const [x, y] = cellKey.split('_').map(Number)
  return { x, y }
}

function getNeighbors(x, y) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ]
}

function shuffle(list, random) {
  const result = list.slice()

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }

  return result
}

function createCandidateLayout(seed, targetCells, gridSize) {
  const random = createRandom(seed)
  const occupied = new Set()
  const start = Math.floor(gridSize / 2)

  occupied.add(key(start, start))

  let attempts = 0
  while (occupied.size < targetCells && attempts < targetCells * 80) {
    attempts++
    const base = parseKey(shuffle(Array.from(occupied), random)[0])
    const candidates = shuffle(getNeighbors(base.x, base.y), random)
      .filter(point => (
        point.x >= 0 &&
        point.y >= 0 &&
        point.x < gridSize &&
        point.y < gridSize &&
        !occupied.has(key(point.x, point.y))
      ))

    if (candidates.length === 0) continue

    const point = candidates[0]
    occupied.add(key(point.x, point.y))
  }

  return Array.from(occupied).map((cellKey, index) => {
    const { x, y } = parseKey(cellKey)

    return {
      id: `challenge_c_${index}_${x}_${y}`,
      kind: 'challenge-square',
      gridX: x,
      gridY: y,
      points: [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1]
      ]
    }
  })
}

function edgeKey(a, b) {
  const keyA = `${a[0]}_${a[1]}`
  const keyB = `${b[0]}_${b[1]}`
  return keyA < keyB ? `${keyA}__${keyB}` : `${keyB}__${keyA}`
}

function getLayoutMetrics(layout) {
  const minX = Math.min(...layout.flatMap(shape => shape.points.map(point => point[0])))
  const minY = Math.min(...layout.flatMap(shape => shape.points.map(point => point[1])))
  const maxX = Math.max(...layout.flatMap(shape => shape.points.map(point => point[0])))
  const maxY = Math.max(...layout.flatMap(shape => shape.points.map(point => point[1])))

  return {
    minX,
    minY,
    maxX,
    maxY,
    widthUnits: maxX - minX,
    heightUnits: maxY - minY
  }
}

function normalizeToOrigin(layout) {
  const metrics = getLayoutMetrics(layout)

  return layout.map(shape => ({
    ...shape,
    gridX: shape.gridX - metrics.minX,
    gridY: shape.gridY - metrics.minY,
    points: shape.points.map(point => [
      point[0] - metrics.minX,
      point[1] - metrics.minY
    ])
  }))
}

export function validateChallengeLayout(layout, options = {}) {
  if (!Array.isArray(layout) || layout.length === 0) {
    return { valid: false, reason: 'EMPTY_LAYOUT' }
  }

  const cellKeys = new Set()
  const edgeUse = new Map()

  for (const shape of layout) {
    if (!shape || !Array.isArray(shape.points) || shape.points.length !== 4) {
      return { valid: false, reason: 'INVALID_CELL_SHAPE' }
    }

    const cellKey = key(shape.gridX, shape.gridY)
    if (cellKeys.has(cellKey)) return { valid: false, reason: 'OVERLAPPING_CELL' }
    cellKeys.add(cellKey)

    shape.points.forEach((point, index) => {
      const next = shape.points[(index + 1) % shape.points.length]
      const id = edgeKey(point, next)
      edgeUse.set(id, (edgeUse.get(id) || 0) + 1)
    })
  }

  for (const count of edgeUse.values()) {
    if (count > 2) return { valid: false, reason: 'EDGE_OVERLAP' }
  }

  const first = cellKeys.values().next().value
  const queue = [first]
  const visited = new Set([first])

  while (queue.length > 0) {
    const current = parseKey(queue.shift())

    for (const point of getNeighbors(current.x, current.y)) {
      const nextKey = key(point.x, point.y)
      if (!cellKeys.has(nextKey) || visited.has(nextKey)) continue
      visited.add(nextKey)
      queue.push(nextKey)
    }
  }

  if (visited.size !== cellKeys.size) {
    return { valid: false, reason: 'DISCONNECTED_LAYOUT' }
  }

  const metrics = getLayoutMetrics(layout)
  const minGridSize = options.minGridSize || MIN_GRID_SIZE
  if (metrics.widthUnits < minGridSize || metrics.heightUnits < minGridSize) {
    return { valid: false, reason: 'BOARD_TOO_SMALL' }
  }

  if (options.maxWidth && options.maxHeight && options.minCellSize) {
    const cellSize = Math.floor(Math.min(
      options.maxWidth / metrics.widthUnits,
      options.maxHeight / metrics.heightUnits
    ))

    if (cellSize < options.minCellSize) {
      return { valid: false, reason: 'CELL_SIZE_TOO_SMALL' }
    }
  }

  return { valid: true, metrics, edgeCount: edgeUse.size }
}

export function scoreChallengeLayout(layout) {
  const metrics = getLayoutMetrics(layout)
  const cellKeys = new Set(layout.map(shape => key(shape.gridX, shape.gridY)))
  let innerConnections = 0
  let deadEnds = 0

  for (const shape of layout) {
    let degree = 0
    for (const neighbor of getNeighbors(shape.gridX, shape.gridY)) {
      if (cellKeys.has(key(neighbor.x, neighbor.y))) degree++
    }
    innerConnections += degree
    if (degree <= 1) deadEnds++
  }

  innerConnections = innerConnections / 2

  const density = layout.length / (metrics.widthUnits * metrics.heightUnits)
  const boundaryComplexity = Math.max(0, layout.length * 4 - innerConnections * 2)

  return Math.round(
    layout.length * 10 +
    boundaryComplexity * 4 +
    deadEnds * 18 +
    (1 - density) * 80 +
    Math.max(metrics.widthUnits, metrics.heightUnits) * 6
  )
}

function getAiDifficultyForLevel(index) {
  if (index <= 6) return 'easy'
  if (index <= 16) return 'hard'
  return 'inferno'
}

export function createChallengeLevels(options = {}) {
  const maxWidth = options.maxWidth || 320
  const maxHeight = options.maxHeight || 360
  const minCellSize = options.minCellSize || 7
  const candidates = []
  let seedIndex = 0

  while (candidates.length < 80 && seedIndex < 360) {
    seedIndex++
    const gridSize = MIN_GRID_SIZE + (seedIndex % 4)
    const targetCells = Math.min(
      gridSize * gridSize,
      18 + Math.floor(seedIndex * 0.45) + Math.floor(createRandom(`target:${seedIndex}`)() * 12)
    )
    const seed = `challenge:${seedIndex}`
    const layout = normalizeToOrigin(createCandidateLayout(seed, targetCells, gridSize))
    const validation = validateChallengeLayout(layout, {
      minGridSize: MIN_GRID_SIZE,
      maxWidth,
      maxHeight,
      minCellSize
    })

    if (!validation.valid) continue

    candidates.push({
      seed,
      layout,
      score: scoreChallengeLayout(layout),
      meta: validation.metrics
    })
  }

  return candidates
    .sort((a, b) => a.score - b.score)
    .slice(0, LEVEL_COUNT)
    .map((item, index) => ({
      ...item,
      id: `challenge_level_${index + 1}`,
      index: index + 1,
      aiDifficulty: getAiDifficultyForLevel(index + 1)
    }))
}

export function getChallengeLevel(index, options = {}) {
  const levels = createChallengeLevels(options)
  return levels[Math.max(0, Math.min(levels.length - 1, index - 1))]
}
