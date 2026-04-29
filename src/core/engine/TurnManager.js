export default class TurnManager {
  constructor(players) {
    this.players = players
    this.currentIndex = 0
  }

  getCurrentPlayer() {
    return this.players[this.currentIndex]
  }

  nextTurn() {
    this.currentIndex = (this.currentIndex + 1) % this.players.length
  }
}