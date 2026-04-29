export default class VictoryJudge {
  isGameOver(board) {
    return board.isAllCellsClosed()
  }

  getWinnerId(players) {
    let maxScore = -1
    let winners = []

    for (const player of players) {
      if (player.score > maxScore) {
        maxScore = player.score
        winners = [player]
      } else if (player.score === maxScore) {
        winners.push(player)
      }
    }

    if (winners.length !== 1) {
      return null
    }

    return winners[0].id
  }
}