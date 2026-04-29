import Player from '../player/Player'
import RuleEngine from './RuleEngine'
import TurnManager from './TurnManager'
import VictoryJudge from './VictoryJudge'

export default class GameEngine {
  constructor({ board, players }) {
    this.board = board

    this.players = players.map(player => new Player(player))

    this.turnManager = new TurnManager(this.players)
    this.ruleEngine = new RuleEngine()
    this.victoryJudge = new VictoryJudge()

    this.status = 'playing'
    this.winnerId = null
  }

  handleAction(action) {
    if (this.status !== 'playing') {
      return { success: false }
    }

    const currentPlayerId = this.getCurrentPlayerId()

    if (action.playerId !== currentPlayerId) {
      return { success: false }
    }

    const result = this.ruleEngine.applyAction({
      board: this.board,
      action
    })

    if (!result.success) {
      return { success: false }
    }

    if (!result.extraTurn) {
      this.turnManager.nextTurn()
    }

    this.updateScores()

    if (this.victoryJudge.isGameOver(this.board)) {
      this.status = 'finished'
      this.winnerId = this.victoryJudge.getWinnerId(this.players)
    }

    return {
      success: true,
      action,
      closedCells: result.closedCells,
      extraTurn: result.extraTurn
    }
  }

  getCurrentPlayerId() {
    return this.turnManager.getCurrentPlayer().id
  }

  updateScores() {
    for (const player of this.players) {
      player.score = 0
    }

    for (const cell of this.board.cells.values()) {
      if (!cell.ownerId) continue

      const player = this.players.find(p => p.id === cell.ownerId)
      if (player) {
        player.score += 1
      }
    }
  }

  getState() {
    const scores = {}

    for (const player of this.players) {
      scores[player.id] = player.score
    }

    return {
      status: this.status,
      currentPlayerId: this.getCurrentPlayerId(),
      scores,
      winnerId: this.winnerId
    }
  }
}