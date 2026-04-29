function generate({ rows, cols, cellSize = 88, padding = 120 }) {
  const vertices = {};
  const edges = {};
  const cells = {};

  const vertexId = (r, c) => `v_${r}_${c}`;
  const hEdgeId = (r, c) => `eh_${r}_${c}`;
  const vEdgeId = (r, c) => `ev_${r}_${c}`;
  const cellId = (r, c) => `c_${r}_${c}`;

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      vertices[vertexId(r, c)] = {
        id: vertexId(r, c),
        x: padding + c * cellSize,
        y: padding + r * cellSize
      };
    }
  }

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = hEdgeId(r, c);
      edges[id] = {
        id,
        kind: 'h',
        vertexIds: [vertexId(r, c), vertexId(r, c + 1)],
        cellIds: []
      };
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const id = vEdgeId(r, c);
      edges[id] = {
        id,
        kind: 'v',
        vertexIds: [vertexId(r, c), vertexId(r + 1, c)],
        cellIds: []
      };
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = cellId(r, c);
      const top = hEdgeId(r, c);
      const right = vEdgeId(r, c + 1);
      const bottom = hEdgeId(r + 1, c);
      const left = vEdgeId(r, c);

      const edgeIds = [top, right, bottom, left];

      cells[id] = {
        id,
        edgeIds,
        neighborCellIds: [
          r > 0 ? cellId(r - 1, c) : null,
          c < cols - 1 ? cellId(r, c + 1) : null,
          r < rows - 1 ? cellId(r + 1, c) : null,
          c > 0 ? cellId(r, c - 1) : null
        ].filter(Boolean),
        center: {
          x: padding + c * cellSize + cellSize / 2,
          y: padding + r * cellSize + cellSize / 2
        },
        polygonVertexIds: [
          vertexId(r, c),
          vertexId(r, c + 1),
          vertexId(r + 1, c + 1),
          vertexId(r + 1, c)
        ],
        meta: { row: r, col: c }
      };

      edgeIds.forEach(edgeId => {
        edges[edgeId].cellIds.push(id);
      });
    }
  }

  return {
    id: `square_${rows}x${cols}`,
    kind: 'square',
    vertices,
    edges,
    cells,
    layoutMeta: {
      rows,
      cols,
      cellSize,
      padding,
      boardWidth: cols * cellSize + padding * 2,
      boardHeight: rows * cellSize + padding * 2
    }
  };
}

module.exports = {
  generate
};