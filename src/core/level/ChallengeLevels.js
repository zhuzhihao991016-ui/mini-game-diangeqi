const LEVEL_COUNT = 99

const LEVEL_SEGMENTS = [
  { start: 1, end: 10, boardType: 'square', size: 3, style: 'tiny' },
  { start: 11, end: 15, boardType: 'square', size: 3, style: 'fun-lite' },
  { start: 16, end: 35, boardType: 'square', size: 5, style: 'mid' },
  { start: 36, end: 50, boardType: 'square', size: 6, style: 'advanced' },
  { start: 51, end: 80, boardType: 'square', size: 7, style: 'large' },
  { start: 81, end: 99, boardType: 'hex', size: 4, style: 'hex' }
]

const SPECIAL_TYPES = {
  obstacleCell: 'obstacleCell',
  obstacleEdge: 'obstacleEdge',
  doubleCell: 'doubleCell',
  freezeCell: 'freezeCell',
  bombCell: 'bombCell',
  quantumCell: 'quantumCell'
}

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

function key(x, y) {
  return `${x}_${y}`
}

function parseKey(cellKey) {
  const [x, y] = cellKey.split('_').map(Number)
  return { x, y }
}

function getSquareNeighbors(x, y) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ]
}

function getHexNeighbors(q, r) {
  return [
    { q: q + 1, r },
    { q: q + 1, r: r - 1 },
    { q, r: r - 1 },
    { q: q - 1, r },
    { q: q - 1, r: r + 1 },
    { q, r: r + 1 }
  ]
}

function edgeKey(a, b) {
  const keyA = `${a[0]}_${a[1]}`
  const keyB = `${b[0]}_${b[1]}`
  return keyA < keyB ? `${keyA}__${keyB}` : `${keyB}__${keyA}`
}

function normalizeToOrigin(layout) {
  if (layout.length === 0) return layout

  const minX = Math.min(...layout.flatMap(shape => shape.points.map(point => point[0])))
  const minY = Math.min(...layout.flatMap(shape => shape.points.map(point => point[1])))

  return layout.map(shape => ({
    ...shape,
    gridX: shape.gridX,
    gridY: shape.gridY,
    points: shape.points.map(point => [
      point[0] - minX,
      point[1] - minY
    ])
  }))
}

function buildSquareLayout(size, missingSet, prefix) {
  const layout = []
  let index = 0

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (missingSet.has(key(x, y))) continue

      layout.push({
        id: `${prefix}_c_${index}_${x}_${y}`,
        kind: 'challenge-square',
        gridX: x,
        gridY: y,
        points: [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1]
        ]
      })

      index++
    }
  }

  return normalizeToOrigin(layout)
}

function buildSquareHoleMarkers(missingSet, normalizedLayout) {
  if (!missingSet || missingSet.size === 0 || !Array.isArray(normalizedLayout) || normalizedLayout.length === 0) {
    return []
  }

  const sample = normalizedLayout[0]
  const offsetX = sample.gridX - sample.points[0][0]
  const offsetY = sample.gridY - sample.points[0][1]

  return Array.from(missingSet).map((cellKey, index) => {
    const { x, y } = parseKey(cellKey)

    return {
      id: `hole_${index}_${x}_${y}`,
      kind: 'challenge-hole',
      gridX: x,
      gridY: y,
      points: [
        [x - offsetX, y - offsetY],
        [x + 1 - offsetX, y - offsetY],
        [x + 1 - offsetX, y + 1 - offsetY],
        [x - offsetX, y + 1 - offsetY]
      ]
    }
  })
}

function buildHexLayout(radius, removedSet, prefix) {
  const layout = []
  let index = 0

  for (let q = -radius + 1; q <= radius - 1; q++) {
    for (let r = -radius + 1; r <= radius - 1; r++) {
      if (Math.abs(q + r) >= radius) continue
      if (removedSet.has(key(q, r))) continue

      const centerX = Math.sqrt(3) * (q + r / 2)
      const centerY = 1.5 * r
      const corners = []
      for (let d = 0; d < 6; d++) {
        const angle = Math.PI / 180 * (60 * d - 30)
        corners.push([
          centerX + Math.cos(angle),
          centerY + Math.sin(angle)
        ])
      }

      layout.push({
        id: `${prefix}_h_${index}_${q}_${r}`,
        kind: 'challenge-hex',
        gridX: q,
        gridY: r,
        points: corners.map(point => [Math.round(point[0] * 1000) / 1000, Math.round(point[1] * 1000) / 1000])
      })

      index++
    }
  }

  return normalizeToOrigin(layout)
}

function getLayoutMetrics(layout) {
  const xs = layout.flatMap(shape => shape.points.map(point => point[0]))
  const ys = layout.flatMap(shape => shape.points.map(point => point[1]))

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    widthUnits: Math.max(...xs) - Math.min(...xs),
    heightUnits: Math.max(...ys) - Math.min(...ys)
  }
}

export function validateChallengeLayout(layout, options = {}) {
  if (!Array.isArray(layout) || layout.length === 0) {
    return { valid: false, reason: 'EMPTY_LAYOUT' }
  }

  const cellKeys = new Set()
  const edgeUse = new Map()

  for (const shape of layout) {
    if (!shape || !Array.isArray(shape.points) || shape.points.length < 3) {
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
  const squareLike = !!options.squareLike

  while (queue.length > 0) {
    const current = parseKey(queue.shift())
    const neighbors = squareLike
      ? getSquareNeighbors(current.x, current.y)
      : getHexNeighbors(current.x, current.y)

    for (const point of neighbors) {
      const nextKey = key(point.x ?? point.q, point.y ?? point.r)
      if (!cellKeys.has(nextKey) || visited.has(nextKey)) continue
      visited.add(nextKey)
      queue.push(nextKey)
    }
  }

  if (visited.size !== cellKeys.size) {
    return { valid: false, reason: 'DISCONNECTED_LAYOUT' }
  }

  const metrics = getLayoutMetrics(layout)
  const minGridSize = options.minGridSize || 0
  if (metrics.widthUnits < minGridSize || metrics.heightUnits < minGridSize) {
    return { valid: false, reason: 'BOARD_TOO_SMALL' }
  }

  if (options.maxWidth && options.maxHeight && options.minCellSize) {
    const cellSize = Math.floor(Math.min(
      options.maxWidth / Math.max(1, metrics.widthUnits),
      options.maxHeight / Math.max(1, metrics.heightUnits)
    ))

    if (cellSize < options.minCellSize) {
      return { valid: false, reason: 'CELL_SIZE_TOO_SMALL' }
    }
  }

  return { valid: true, metrics, edgeCount: edgeUse.size }
}

export function scoreChallengeLayout(layout, segment = { size: 7 }, levelIndex = 1) {
  const metrics = getLayoutMetrics(layout)
  const density = layout.length / Math.max(1, metrics.widthUnits * metrics.heightUnits)
  const holeCount = Math.max(0, segment.size * segment.size - layout.length)
  const spread = Math.max(metrics.widthUnits, metrics.heightUnits)

  return Math.round(
    levelIndex * 12 +
    spread * 7 +
    holeCount * 11 +
    (1 - density) * 120 +
    (segment.size >= 6 ? 40 : 0)
  )
}

function getAiDifficultyForLevel(index) {
  if (index <= 10) return 'easy'
  if (index <= 35) return 'hard'
  return 'inferno'
}

function getSegmentForLevel(index) {
  return LEVEL_SEGMENTS.find(segment => index >= segment.start && index <= segment.end)
}

function createHoleSet(segment, index) {
  const size = segment.size
  const random = createRandom(`holes:${segment.start}:${index}`)
  const holes = new Set()
  const maxHoleCount = segment.boardType === 'hex'
    ? 0
    : Math.max(0, Math.floor(size * size * (segment.style === 'tiny' ? 0.25 : segment.style === 'fun-lite' ? 0.18 : segment.style === 'mid' ? 0.22 : segment.style === 'advanced' ? 0.28 : 0.3)))

  const candidates = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const isBorder = x === 0 || y === 0 || x === size - 1 || y === size - 1
      const isCenter = x === Math.floor(size / 2) && y === Math.floor(size / 2)

      if (size <= 3 && isBorder && !isCenter) continue
      if (isBorder && random() < 0.55) continue
      candidates.push({ x, y })
    }
  }

  const shuffled = shuffle(candidates, random)
  const layout = buildSquareLayout(size, holes, `tmp_${index}`)
  const targetCount = Math.min(maxHoleCount, shuffled.length)

  for (const point of shuffled) {
    if (holes.size >= targetCount) break
    holes.add(key(point.x, point.y))

    const trial = buildSquareLayout(size, holes, `trial_${index}`)
    const validation = validateChallengeLayout(trial, {
      minGridSize: 0,
      maxWidth: 9999,
      maxHeight: 9999,
      minCellSize: 1,
      squareLike: true
    })

    if (!validation.valid) {
      holes.delete(key(point.x, point.y))
    }
  }

  if (segment.size === 3 && holes.size < 2) {
    holes.clear()
    holes.add(key(1, 1))
  }

  return holes
}

function pickCells(layout, count, excludedIds = new Set(), random = Math.random) {
  return shuffle(layout.filter(cell => !excludedIds.has(cell.id)), random).slice(0, count)
}

function pickObstacleEdges(layout, count, excludedCellIds = new Set(), random = Math.random) {
  const candidates = []

  for (const cell of shuffle(layout, random)) {
    if (excludedCellIds.has(cell.id)) continue
    const sideCount = Array.isArray(cell.points) ? cell.points.length : 4
    for (let side = 0; side < sideCount; side++) {
      candidates.push({ cellId: cell.id, side })
    }
  }

  const picked = []
  const used = new Set()

  for (const item of shuffle(candidates, random)) {
    const id = `${item.cellId}:${item.side}`
    if (used.has(id)) continue
    used.add(id)
    picked.push(item)
    if (picked.length >= count) break
  }

  return picked
}

function areCellsAdjacent(a, b, boardType) {
  if (!a || !b) return false

  if (boardType === 'hex') {
    const dq = b.gridX - a.gridX
    const dr = b.gridY - a.gridY
    return getHexNeighbors(a.gridX, a.gridY)
      .some(point => point.q === a.gridX + dq && point.r === a.gridY + dr)
  }

  return Math.abs(a.gridX - b.gridX) + Math.abs(a.gridY - b.gridY) === 1
}

function pickQuantumPairs(layout, pairCount, excludedIds, boardType, random = Math.random) {
  const pool = shuffle(layout.filter(cell => !excludedIds.has(cell.id)), random)
  const pairs = []
  const used = new Set()

  for (const first of pool) {
    if (used.has(first.id)) continue

    const second = pool.find(cell => (
      cell.id !== first.id &&
      !used.has(cell.id) &&
      !areCellsAdjacent(first, cell, boardType)
    ))

    if (!second) continue

    pairs.push([first.id, second.id])
    used.add(first.id)
    used.add(second.id)

    if (pairs.length >= pairCount) break
  }

  return pairs
}

function createSquareLevel(segment, levelIndex, maxWidth, maxHeight, minCellSize) {
  const random = createRandom(`square:${levelIndex}`)
  const holes = createHoleSet(segment, levelIndex)
  const layout = buildSquareLayout(segment.size, holes, `lvl_${levelIndex}`)
  const validation = validateChallengeLayout(layout, {
    minGridSize: 0,
    maxWidth,
    maxHeight,
    minCellSize,
    squareLike: true
  })

  if (!validation.valid) {
    return null
  }

  const special = {
    boardType: 'square',
    size: segment.size,
    missingCells: Array.from(holes).map(parseKey),
    holeMarkers: buildSquareHoleMarkers(holes, layout)
  }

  const layoutMap = new Map(layout.map(cell => [key(cell.gridX, cell.gridY), cell]))
  const available = layout.slice()

  if (levelIndex >= 11 && levelIndex <= 15) {
    const doubleCells = pickCells(available, 1, new Set(), random)
    const obstacleCells = pickCells(available, 1, new Set(doubleCells.map(cell => cell.id)), random)
    const obstacleEdges = pickObstacleEdges(layout, 1, new Set(obstacleCells.map(cell => cell.id)), random)

    special.cells = [
      ...doubleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.doubleCell })),
      ...obstacleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.obstacleCell }))
    ]
    special.edges = obstacleEdges.map(item => ({ ...item, type: SPECIAL_TYPES.obstacleEdge }))
  }

  if (levelIndex >= 26 && levelIndex <= 30) {
    const doubleCells = pickCells(available, 2, new Set(), random)
    const reserved = new Set(doubleCells.map(cell => cell.id))
    const obstacleCells = pickCells(available, 1, reserved, random)
    const obstacleEdges = pickObstacleEdges(layout, 2, new Set(obstacleCells.map(cell => cell.id)), random)

    special.cells = [
      ...(special.cells || []),
      ...doubleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.doubleCell })),
      ...obstacleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.obstacleCell }))
    ]
    special.edges = [
      ...(special.edges || []),
      ...obstacleEdges.map(item => ({ ...item, type: SPECIAL_TYPES.obstacleEdge }))
    ]
  }

  if (levelIndex >= 31 && levelIndex <= 35) {
    const freezeCells = pickCells(available, 1, new Set((special.cells || []).map(cell => cell.id)), random)
    special.cells = [
      ...(special.cells || []),
      ...freezeCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.freezeCell }))
    ]
  }

  if (levelIndex >= 36 && levelIndex <= 50) {
    const reserved = new Set()
    const obstacleCells = pickCells(available, 1, reserved, random)
    obstacleCells.forEach(cell => reserved.add(cell.id))
    const doubleCells = pickCells(available, 1, reserved, random)
    doubleCells.forEach(cell => reserved.add(cell.id))
    const freezeCells = levelIndex >= 41 ? pickCells(available, 1, reserved, random) : []
    freezeCells.forEach(cell => reserved.add(cell.id))
    const bombCells = levelIndex >= 46 ? pickCells(available, 1, reserved, random) : []
    const obstacleEdges = pickObstacleEdges(layout, 2, new Set(obstacleCells.map(cell => cell.id)), random)

    special.cells = [
      ...(special.cells || []),
      ...obstacleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.obstacleCell })),
      ...doubleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.doubleCell })),
      ...freezeCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.freezeCell })),
      ...bombCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.bombCell }))
    ]
    special.edges = [
      ...(special.edges || []),
      ...obstacleEdges.map(item => ({ ...item, type: SPECIAL_TYPES.obstacleEdge }))
    ]
  }

  if (levelIndex >= 51 && levelIndex <= 80) {
    const reserved = new Set()
    const obstacleCells = pickCells(available, 2, reserved, random)
    obstacleCells.forEach(cell => reserved.add(cell.id))
    const doubleCells = pickCells(available, 2, reserved, random)
    doubleCells.forEach(cell => reserved.add(cell.id))
    const freezeCells = levelIndex >= 61 ? pickCells(available, 1, reserved, random) : []
    freezeCells.forEach(cell => reserved.add(cell.id))
    const bombCells = levelIndex >= 66 ? pickCells(available, 1, reserved, random) : []
    bombCells.forEach(cell => reserved.add(cell.id))
    const obstacleEdges = pickObstacleEdges(layout, 3, new Set(obstacleCells.map(cell => cell.id)), random)
    const quantumPairs = levelIndex >= 71 ? pickQuantumPairs(available, 2, reserved, 'square', random) : []

    special.cells = [
      ...(special.cells || []),
      ...obstacleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.obstacleCell })),
      ...doubleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.doubleCell })),
      ...freezeCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.freezeCell })),
      ...bombCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.bombCell })),
      ...quantumPairs.flatMap(pair => pair.map(id => ({ id, type: SPECIAL_TYPES.quantumCell, pairId: pair.join('__') })))
    ]
    special.edges = [
      ...(special.edges || []),
      ...obstacleEdges.map(item => ({ ...item, type: SPECIAL_TYPES.obstacleEdge }))
    ]
  }

  if (levelIndex >= 81 && levelIndex <= 99) {
    const reserved = new Set()
    const obstacleCells = pickCells(available, 2, reserved, random)
    obstacleCells.forEach(cell => reserved.add(cell.id))
    const doubleCells = pickCells(available, 2, reserved, random)
    doubleCells.forEach(cell => reserved.add(cell.id))
    const freezeCells = levelIndex >= 86 ? pickCells(available, 1, reserved, random) : []
    freezeCells.forEach(cell => reserved.add(cell.id))
    const bombCells = levelIndex >= 91 ? pickCells(available, 1, reserved, random) : []
    bombCells.forEach(cell => reserved.add(cell.id))
    const obstacleEdges = pickObstacleEdges(layout, 3, new Set(obstacleCells.map(cell => cell.id)), random)
    const quantumPairs = levelIndex >= 96 ? pickQuantumPairs(available, 2, reserved, 'square', random) : []

    special.cells = [
      ...(special.cells || []),
      ...obstacleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.obstacleCell })),
      ...doubleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.doubleCell })),
      ...freezeCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.freezeCell })),
      ...bombCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.bombCell })),
      ...quantumPairs.flatMap(pair => pair.map(id => ({ id, type: SPECIAL_TYPES.quantumCell, pairId: pair.join('__') })))
    ]
    special.edges = [
      ...(special.edges || []),
      ...obstacleEdges.map(item => ({ ...item, type: SPECIAL_TYPES.obstacleEdge }))
    ]
  }

  if (special.cells) {
    const byId = new Map()
    for (const item of special.cells) {
      if (!byId.has(item.id)) byId.set(item.id, item)
      else byId.set(item.id, { ...byId.get(item.id), ...item })
    }
    special.cells = Array.from(byId.values())
  }

  if (special.edges) {
    const byKey = new Map()
    for (const item of special.edges) {
      const edgeId = `${item.cellId}:${item.side}`
      byKey.set(edgeId, item)
    }
    special.edges = Array.from(byKey.values())
  }

  return {
    seed: `challenge:${levelIndex}`,
    levelIndex,
    layout,
    score: scoreChallengeLayout(layout, segment, levelIndex),
    aiDifficulty: getAiDifficultyForLevel(levelIndex),
    boardType: segment.boardType,
    boardSize: segment.size,
    special
  }
}

function createHexLevel(segment, levelIndex, maxWidth, maxHeight, minCellSize) {
  const random = createRandom(`hex:${levelIndex}`)
  const radius = segment.size
  const removed = new Set()
  const allCells = []

  for (let q = -radius + 1; q <= radius - 1; q++) {
    for (let r = -radius + 1; r <= radius - 1; r++) {
      if (Math.abs(q + r) >= radius) continue
      allCells.push({ q, r })
    }
  }

  const maxRemoved = Math.max(0, Math.floor(allCells.length * 0.18))
  const candidates = shuffle(allCells.filter(item => {
    const onEdge = Math.abs(item.q) === radius - 1 || Math.abs(item.r) === radius - 1 || Math.abs(item.q + item.r) === radius - 1
    return !onEdge || random() > 0.35
  }), random)

  for (const item of candidates) {
    if (removed.size >= maxRemoved) break
    removed.add(key(item.q, item.r))
  }

  const layout = buildHexLayout(radius, removed, `lvl_${levelIndex}`)
  const validation = validateChallengeLayout(layout, {
    minGridSize: 0,
    maxWidth,
    maxHeight,
    minCellSize,
    squareLike: false
  })

  if (!validation.valid) return null

  const special = {
    boardType: 'hex',
    size: radius,
    missingCells: Array.from(removed).map(parseKey)
  }

  const available = layout.slice()
  const reserved = new Set()
  const obstacleCells = pickCells(available, 2, reserved, random)
  obstacleCells.forEach(cell => reserved.add(cell.id))
  const doubleCells = pickCells(available, 2, reserved, random)
  doubleCells.forEach(cell => reserved.add(cell.id))
  const freezeCells = levelIndex >= 86 ? pickCells(available, 1, reserved, random) : []
  freezeCells.forEach(cell => reserved.add(cell.id))
  const bombCells = levelIndex >= 91 ? pickCells(available, 1, reserved, random) : []
  bombCells.forEach(cell => reserved.add(cell.id))
  const obstacleEdges = pickObstacleEdges(layout, 3, new Set(obstacleCells.map(cell => cell.id)), random)
  const quantumPairs = levelIndex >= 96 ? pickQuantumPairs(available, 2, reserved, 'hex', random) : []

  special.cells = [
    ...obstacleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.obstacleCell })),
    ...doubleCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.doubleCell })),
    ...freezeCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.freezeCell })),
    ...bombCells.map(cell => ({ id: cell.id, type: SPECIAL_TYPES.bombCell })),
    ...quantumPairs.flatMap(pair => pair.map(id => ({ id, type: SPECIAL_TYPES.quantumCell, pairId: pair.join('__') })))
  ]
  special.edges = obstacleEdges.map(item => ({ ...item, type: SPECIAL_TYPES.obstacleEdge }))

  return {
    seed: `challenge:${levelIndex}`,
    levelIndex,
    layout,
    score: scoreChallengeLayout(layout, segment, levelIndex),
    aiDifficulty: getAiDifficultyForLevel(levelIndex),
    boardType: segment.boardType,
    boardSize: radius,
    special
  }
}

function createChallengeLevel(levelIndex, options = {}) {
  const segment = getSegmentForLevel(levelIndex)
  if (!segment) return null

  const maxWidth = options.maxWidth || 320
  const maxHeight = options.maxHeight || 360
  const minCellSize = options.minCellSize || 7

  if (segment.boardType === 'hex') {
    return createHexLevel(segment, levelIndex, maxWidth, maxHeight, minCellSize)
  }

  return createSquareLevel(segment, levelIndex, maxWidth, maxHeight, minCellSize)
}

export function createChallengeLevels(options = {}) {
  const levels = []

  for (let index = 1; index <= LEVEL_COUNT; index++) {
    const level = createChallengeLevel(index, options)
    if (level) {
      level.id = `challenge_level_${index}`
      level.index = index
      levels.push(level)
    }
  }

  return levels
}

export function getChallengeLevel(index, options = {}) {
  return createChallengeLevels(options)[Math.max(0, Math.min(LEVEL_COUNT - 1, index - 1))]
}

export function applyChallengeLevelToBoard(board, level) {
  if (!board || !level) return board

  if (level.special && Array.isArray(level.special.cells)) {
    const byId = new Map(level.special.cells.map(item => [item.id, item]))

    for (const cell of board.cells.values()) {
      const spec = byId.get(cell.id)
      if (!spec) continue

      if (spec.type === SPECIAL_TYPES.obstacleCell) {
        cell.isObstacle = true
        for (const edgeId of cell.edgeIds) {
          const edge = board.getEdge(edgeId)
          if (!edge) continue
          edge.isBlocked = true
          edge.blockReason = 'cell'
        }
      } else if (spec.type === SPECIAL_TYPES.doubleCell) {
        cell.isDoubleScore = true
      } else if (spec.type === SPECIAL_TYPES.freezeCell) {
        cell.isObstacle = true
        cell.isFrozen = true
      } else if (spec.type === SPECIAL_TYPES.bombCell) {
        cell.isBomb = true
      } else if (spec.type === SPECIAL_TYPES.quantumCell) {
        cell.isQuantum = true
        cell.quantumPairId = spec.pairId || null
      }
    }
  }

  if (level.special && Array.isArray(level.special.edges)) {
    for (const item of level.special.edges) {
      const cell = board.getCell(item.cellId)
      if (!cell || !Array.isArray(cell.edgeIds)) continue
      const edgeId = cell.edgeIds[item.side]
      const edge = edgeId ? board.getEdge(edgeId) : null
      if (!edge) continue
      edge.isBlocked = true
      edge.isObstacleEdge = true
      edge.blockReason = 'challenge'
    }
  }

  board.challengeMeta = {
    ...(board.challengeMeta || {}),
    level: level.index,
    score: level.score,
    aiDifficulty: level.aiDifficulty,
    boardType: level.boardType,
    boardSize: level.boardSize,
    special: level.special || null
  }

  return board
}
