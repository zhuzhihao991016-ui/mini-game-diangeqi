export default class Edge {
  constructor({ id, type, x, y, q, r, direction }) {
    this.id = id

    // square 用
    this.type = type // horizontal | vertical | hex

    this.x = x
    this.y = y

    // hex 用
    this.q = q
    this.r = r
    this.direction = direction // 0~5

    this.ownerId = null
    this.adjacentCellIds = []
  }

  isClaimed() {
    return this.ownerId !== null
  }

  claim(playerId) {
    if (this.isClaimed()) {
      throw new Error(`Edge ${this.id} already claimed`)
    }

    this.ownerId = playerId
  }
}