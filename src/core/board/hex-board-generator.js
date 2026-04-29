function generate({ radius = 2 }) {
  return {
    id: `hex_r${radius}`,
    kind: 'hex',
    vertices: {},
    edges: {},
    cells: {},
    layoutMeta: {
      radius
    }
  };
}

module.exports = {
  generate
};