import Board from './Board'
import Cell from './Cell'
import Edge from './Edge'

const DEFAULT_LAYOUT = [
  {
    id: 'tri_0_0',
    kind: 'triangle',
    points: [
      [1, 0],
      [0, 1],
      [2, 1]
    ]
  },
  {
    id: 'quad_0_1',
    kind: 'quadrilateral',
    points: [
      [2, 1],
      [0, 1],
      [0, 3],
      [2, 3]
    ]
  },
  {
    id: 'hex_0_2',
    kind: 'hexagon',
    points: [
      [2, 1],
      [4, 1],
      [5, 2],
      [4, 3],
      [2, 3],
      [3, 2]
    ]
  },
  {
    id: 'tri_1_0',
    kind: 'triangle',
    points: [
      [0, 3],
      [1, 4],
      [2, 3]
    ]
  },
  {
    id: 'quad_1_1',
    kind: 'quadrilateral',
    points: [
      [2, 3],
      [4, 3],
      [4, 5],
      [1, 4]
    ]
  },
  {
    id: 'tri_1_2',
    kind: 'triangle',
    points: [
      [4, 3],
      [5, 2],
      [5, 4]
    ]
  }
]

function pointKey(point) {
  return `${point[0]}_${point[1]}`
}

function edgeKey(a, b) {
  const keyA = pointKey(a)
  const keyB = pointKey(b)

  return keyA < keyB ? `${keyA}__${keyB}` : `${keyB}__${keyA}`
}

function createEdgeId(index) {
  return `m_e_${index}`
}

function getCentroid(points) {
  const total = points.reduce((sum, point) => {
    sum.x += point[0]
    sum.y += point[1]
    return sum
  }, { x: 0, y: 0 })

  return {
    x: total.x / points.length,
    y: total.y / points.length
  }
}

function normalizeLayout(layout, cellSize, padding) {
  const vertices = new Map()
  const edgeIdsByKey = new Map()
  const edgeSegments = new Map()
  const cells = []

  layout.forEach((shape, cellIndex) => {
    const polygonVertexIds = shape.points.map(point => {
      const id = `m_v_${pointKey(point)}`

      if (!vertices.has(id)) {
        vertices.set(id, {
          id,
          x: padding + point[0] * cellSize,
          y: padding + point[1] * cellSize,
          unitX: point[0],
          unitY: point[1]
        })
      }

      return id
    })

    const edgeIds = []

    shape.points.forEach((point, index) => {
      const nextPoint = shape.points[(index + 1) % shape.points.length]
      const key = edgeKey(point, nextPoint)

      if (!edgeIdsByKey.has(key)) {
        const edgeId = createEdgeId(edgeIdsByKey.size)

        edgeIdsByKey.set(key, edgeId)
        edgeSegments.set(edgeId, {
          from: point,
          to: nextPoint
        })
      }

      edgeIds.push(edgeIdsByKey.get(key))
    })

    const centroid = getCentroid(shape.points)
    cells.push({
      id: shape.id || `m_c_${cellIndex}`,
      kind: shape.kind || `${shape.points.length}-gon`,
      edgeIds,
      polygonVertexIds,
      center: {
        x: padding + centroid.x * cellSize,
        y: padding + centroid.y * cellSize,
        unitX: centroid.x,
        unitY: centroid.y
      },
      gridX: Number.isFinite(shape.gridX) ? shape.gridX : centroid.x,
      gridY: Number.isFinite(shape.gridY) ? shape.gridY : centroid.y,
      points: shape.points.map(point => ({
        x: padding + point[0] * cellSize,
        y: padding + point[1] * cellSize,
        unitX: point[0],
        unitY: point[1]
      }))
    })
  })

  return {
    vertices,
    edgeSegments,
    cells
  }
}

function attachGeometry(board, { vertices, edgeSegments, cells }, layoutMeta) {
  board.type = 'mixed-shape'
  board.kind = 'mixed-shape'
  board.vertices = vertices
  board.layoutMeta = layoutMeta

  for (const [edgeId, segment] of edgeSegments.entries()) {
    const edge = new Edge({
      id: edgeId,
      type: 'mixed',
      x: segment.from[0],
      y: segment.from[1]
    })

    edge.x1 = layoutMeta.padding + segment.from[0] * layoutMeta.cellSize
    edge.y1 = layoutMeta.padding + segment.from[1] * layoutMeta.cellSize
    edge.x2 = layoutMeta.padding + segment.to[0] * layoutMeta.cellSize
    edge.y2 = layoutMeta.padding + segment.to[1] * layoutMeta.cellSize
    edge.unitX1 = segment.from[0]
    edge.unitY1 = segment.from[1]
    edge.unitX2 = segment.to[0]
    edge.unitY2 = segment.to[1]

    board.addEdge(edge)
  }

  cells.forEach(cellGeometry => {
    const cell = new Cell({
      id: cellGeometry.id,
      x: cellGeometry.center.unitX,
      y: cellGeometry.center.unitY,
      edgeIds: cellGeometry.edgeIds
    })

    cell.kind = cellGeometry.kind
    cell.gridX = cellGeometry.gridX
    cell.gridY = cellGeometry.gridY
    cell.center = cellGeometry.center
    cell.points = cellGeometry.points
    cell.polygonVertexIds = cellGeometry.polygonVertexIds

    board.addCell(cell)

    cell.edgeIds.forEach(edgeId => {
      board.getEdge(edgeId).adjacentCellIds.push(cell.id)
    })
  })
}

export function createMixedShapeBoard({
  layout = DEFAULT_LAYOUT,
  cellSize = 48,
  padding = 24
} = {}) {
  const geometry = normalizeLayout(layout, cellSize, padding)
  const minX = Math.min(...layout.flatMap(shape => shape.points.map(point => point[0])))
  const minY = Math.min(...layout.flatMap(shape => shape.points.map(point => point[1])))
  const maxX = Math.max(...layout.flatMap(shape => shape.points.map(point => point[0])))
  const maxY = Math.max(...layout.flatMap(shape => shape.points.map(point => point[1])))
  const widthUnits = maxX - minX
  const heightUnits = maxY - minY

  const board = new Board({
    rows: heightUnits,
    cols: widthUnits
  })

  attachGeometry(board, geometry, {
    cellSize,
    padding,
    minX,
    minY,
    widthUnits,
    heightUnits,
    boardWidth: widthUnits * cellSize + padding * 2,
    boardHeight: heightUnits * cellSize + padding * 2
  })

  return board
}

export function generate(options = {}) {
  const board = createMixedShapeBoard(options)

  return {
    id: 'mixed_shape_default',
    kind: 'mixed-shape',
    vertices: Object.fromEntries(board.vertices.entries()),
    edges: Object.fromEntries([...board.edges.entries()].map(([id, edge]) => [
      id,
      {
        id,
        kind: 'mixed',
        vertexIds: [
          `m_v_${edge.unitX1}_${edge.unitY1}`,
          `m_v_${edge.unitX2}_${edge.unitY2}`
        ],
        cellIds: [...edge.adjacentCellIds],
        line: {
          x1: edge.x1,
          y1: edge.y1,
          x2: edge.x2,
          y2: edge.y2
        }
      }
    ])),
    cells: Object.fromEntries([...board.cells.entries()].map(([id, cell]) => [
      id,
      {
        id,
        kind: cell.kind,
        edgeIds: [...cell.edgeIds],
        center: cell.center,
        polygonVertexIds: [...cell.polygonVertexIds],
        points: [...cell.points]
      }
    ])),
    layoutMeta: board.layoutMeta,
    board
  }
}

export default createMixedShapeBoard
