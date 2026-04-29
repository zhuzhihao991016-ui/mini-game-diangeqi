export default class ClaimEdgeAction {
  constructor({ playerId, edgeId }) {
    this.type = 'CLAIM_EDGE'
    this.playerId = playerId
    this.edgeId = edgeId
  }
}