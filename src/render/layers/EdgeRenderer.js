class EdgeHitTest {
  pickEdge(x, y, boardDefinition) {
    const edges = boardDefinition.edges;
    const vertices = boardDefinition.vertices;

    let bestEdgeId = null;
    let bestDistance = Infinity;
    const threshold = 18;

    Object.keys(edges).forEach(edgeId => {
      const edge = edges[edgeId];
      const p1 = vertices[edge.vertexIds[0]];
      const p2 = vertices[edge.vertexIds[1]];
      if (!p1 || !p2) return;

      const d = this.pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
      if (d < threshold && d < bestDistance) {
        bestDistance = d;
        bestEdgeId = edgeId;
      }
    });

    return bestEdgeId;
  }

  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      return Math.hypot(px - x1, py - y1);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));

    const cx = x1 + t * dx;
    const cy = y1 + t * dy;

    return Math.hypot(px - cx, py - cy);
  }
}

module.exports = EdgeHitTest;