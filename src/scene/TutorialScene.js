import BaseScene from './BaseScene'
import BattleScene from './BattleScene'
import BoardFactory from '../core/board/BoardFactory'
import GameEngine from '../core/engine/GameEngine'
import ClaimEdgeAction from '../core/action/ClaimEdgeAction'
import AnimationManager from '../animation/AnimationManager'
import Renderer from '../render/Renderer'
import BoardRenderer from '../render/BoardRenderer'
import GuideRenderer from '../render/GuideRenderer'
import HitTest from '../input/HitTest'
import { getSceneSafeLayout } from '../utils/SafeArea'
import UITheme from '../ui/theme'

const PLAYER_COLORS = {
  p1: UITheme.colors.p1,
  p2: UITheme.colors.p2
}

const FINAL_TUTORIAL_STEP = 6

export default class TutorialScene extends BaseScene {
  constructor({ canvas, ctx, inputManager, sceneManager, width, height }) {
    super()

    this.canvas = canvas
    this.ctx = ctx
    this.inputManager = inputManager
    this.sceneManager = sceneManager

    this.width = width
    this.height = height

    this.renderer = new Renderer(ctx, canvas)
    this.boardRenderer = new BoardRenderer(ctx)
    this.guide = new GuideRenderer(ctx)
    this.animationManager = new AnimationManager()
    this.safeLayout = getSceneSafeLayout(this.width, this.height)

    this.engine = null
    this.board = null
    this.layout = this.createLayout()
    this.hitTest = null

    this.step = 0
    this.phase = 'waitNext'
    this.title = ''
    this.body = ''
    this.hintText = ''
    this.targetEdgeId = null
    this.targetPlayerId = null
    this.afterTakeEdge = null
    this.afterNext = null
    this.canNext = false
    this.nextLabel = '\u7ee7\u7eed'
    this.feedbackText = ''
    this.feedbackTimer = 0
    this.timers = []
    this.resetBoard()
  }

  onEnter() {
    this.inputManager.clearTouchStartHandlers()
    this.enterStep(0)

    this.inputManager.onTouchStart((x, y, rawEvent) => {
      this.handleTouch({ x, y, rawEvent })
    })
  }

  createLayout() {
    const maxCellByWidth = Math.floor((this.width - 72) / 3)
    const maxCellByHeight = Math.floor((this.height - this.safeLayout.insets.top - this.safeLayout.insets.bottom - 330) / 3)
    const cellSize = Math.max(58, Math.min(80, maxCellByWidth, maxCellByHeight))
    const boardWidth = cellSize * 3

    return {
      cellSize,
      originX: (this.width - boardWidth) / 2,
      originY: Math.max(this.safeLayout.insets.top + 250, this.safeLayout.top + 170)
    }
  }

  update(deltaTime) {
    this.guide.update(deltaTime)
    this.animationManager.update(deltaTime)
    if (this.feedbackTimer > 0) this.feedbackTimer -= deltaTime
  }

  render() {
    this.renderer.clear()

    this.ctx.fillStyle = UITheme.colors.background
    this.ctx.fillRect(0, 0, this.width, this.height)

    this.boardRenderer.draw({
      board: this.board,
      originX: this.layout.originX,
      originY: this.layout.originY,
      cellSize: this.layout.cellSize,
      animationManager: this.animationManager
    })

    this.guide.draw({
      boardRenderer: this.boardRenderer,
      board: this.board,
      originX: this.layout.originX,
      originY: this.layout.originY,
      cellSize: this.layout.cellSize
    })

    this.drawHud()
    this.drawStepText()
    this.drawTopButtons()
    if (this.isFinalStep()) this.drawEndMenuButton()
    if (this.feedbackTimer > 0) this.drawFeedback()
  }

  drawStepText() {
    const ctx = this.ctx

    const x = 20
    const y = this.safeLayout.top + 50
    const w = this.width - 40
    const h = 122
    this.roundRect(ctx, x, y, w, h, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.line
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.textBaseline = 'middle'
    ctx.fillStyle = UITheme.colors.text
    this.drawFittedText(ctx, this.title, this.width / 2, y + 28, w - 32, 18, 13, 'bold', 'center')

    ctx.fillStyle = UITheme.colors.muted
    const lines = this.wrapText(ctx, this.body, w - 36, 14, '')
    lines.slice(0, 2).forEach((line, index) => {
      this.drawFittedText(ctx, line, this.width / 2, y + 56 + index * 20, w - 36, 14, 11, '', 'center')
    })

    if (this.canNext) {
      ctx.fillStyle = UITheme.colors.primary
      this.drawFittedText(ctx, this.nextLabel, this.width / 2, y + 104, w - 36, 15, 11, 'bold', 'center')
    } else if (this.hintText) {
      ctx.fillStyle = UITheme.colors.primary
      this.drawFittedText(ctx, this.hintText, this.width / 2, y + 104, w - 36, 15, 11, 'bold', 'center')
    }
  }

  drawHud() {
    const state = this.engine.getState()
    const total = this.engine.getMaxScore()
    const y = this.layout.originY + this.layout.cellSize * 3 + 26
    const cardW = Math.min(138, (this.width - 56) / 2)
    const gap = 12
    const startX = (this.width - cardW * 2 - gap) / 2

    this.drawPlayerCard('p1', startX, y, cardW, total, state)
    this.drawPlayerCard('p2', startX + cardW + gap, y, cardW, total, state)
  }

  drawPlayerCard(playerId, x, y, w, total, state) {
    const ctx = this.ctx
    const h = 58
    const isCurrent = state.currentPlayerId === playerId && state.status === 'playing'
    const color = PLAYER_COLORS[playerId]
    const name = playerId === 'p1' ? '\u4f60' : 'AI'
    const score = state.scores[playerId] || 0

    ctx.save()
    this.roundRect(ctx, x, y, w, h, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = isCurrent ? color : UITheme.colors.line
    ctx.lineWidth = isCurrent ? 2 : 1
    ctx.stroke()

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x + 18, y + 20, 7, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = UITheme.colors.text
    this.drawFittedText(ctx, name, x + 32, y + 21, w - 44, 14, 10, 'bold', 'left')
    ctx.fillStyle = UITheme.colors.muted
    this.drawFittedText(ctx, `${score}/${total}`, x + w / 2, y + 43, w - 18, 13, 10, '', 'center')

    if (isCurrent) {
      ctx.fillStyle = color
      this.drawFittedText(ctx, '\u5f53\u524d\u56de\u5408', x + w - 10, y + 20, w - 52, 11, 8, '', 'right')
    }

    ctx.restore()
  }

  drawTopButtons() {
    const ctx = this.ctx
    const prev = this.getPrevButton()
    const skip = this.getSkipButton()

    this.drawSmallButton(ctx, prev, '\u4e0a\u4e00\u6b65', this.step > 0)
    this.drawSmallButton(ctx, skip, '\u8df3\u8fc7', true)
  }

  drawSmallButton(ctx, rect, text, enabled) {
    ctx.save()
    this.roundRect(ctx, rect.x, rect.y, rect.width, rect.height, UITheme.radius.md)
    ctx.fillStyle = enabled ? UITheme.colors.surface : UITheme.colors.disabled
    ctx.fill()
    ctx.strokeStyle = enabled ? UITheme.colors.line : UITheme.colors.disabled
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = enabled ? UITheme.colors.text : UITheme.colors.muted
    this.drawFittedText(ctx, text, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width - 12, 13, 9, 'bold', 'center')
    ctx.restore()
  }

  drawEndMenuButton() {
    const ctx = this.ctx
    const rect = this.getEndMenuButton()

    ctx.save()
    this.roundRect(ctx, rect.x, rect.y, rect.width, rect.height, UITheme.radius.md)
    ctx.fillStyle = UITheme.colors.surface
    ctx.fill()
    ctx.strokeStyle = UITheme.colors.primary
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.fillStyle = UITheme.colors.primary
    this.drawFittedText(ctx, '\u8fd4\u56de\u83dc\u5355', rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width - 20, 15, 11, 'bold', 'center')
    ctx.restore()
  }

  drawFeedback() {
    const ctx = this.ctx
    const text = this.feedbackText || '\u8bf7\u70b9\u51fb\u9ad8\u4eae\u7684\u8fb9'
    const w = Math.min(this.width - 56, 250)
    const h = 38
    const x = (this.width - w) / 2
    const y = this.layout.originY - 52

    ctx.save()
    this.roundRect(ctx, x, y, w, h, UITheme.radius.md)
    ctx.fillStyle = 'rgba(24, 50, 74, 0.88)'
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    this.drawFittedText(ctx, text, this.width / 2, y + h / 2, w - 20, 13, 10, 'bold', 'center')
    ctx.restore()
  }

  roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  handleTouch(touch) {
    const pos = this.normalizeTouch(touch)

    if (this.isButtonHit(this.getSkipButton(), pos.x, pos.y)) {
      if (this.isFinalStep()) {
        this.startFirstGame()
      } else {
        this.enterStep(FINAL_TUTORIAL_STEP)
      }
      return
    }

    if (this.isFinalStep() && this.isButtonHit(this.getEndMenuButton(), pos.x, pos.y)) {
      this.exitTutorial()
      return
    }

    if (this.step > 0 && this.isButtonHit(this.getPrevButton(), pos.x, pos.y)) {
      this.enterStep(this.step - 1)
      return
    }
  
    if (this.phase === 'waitNext') {
      if (this.canNext && this.afterNext) {
        const callback = this.afterNext
        this.afterNext = null
        callback()
      } else if (this.canNext) {
        this.enterStep(this.step + 1)
      }
      return
    }
  
    if (this.phase === 'waitEdge') {
      const edge = this.getTouchedEdge(pos.x, pos.y)
  
      if (!edge || edge.id !== this.targetEdgeId) {
        this.showWrongTapFeedback()
        return
      }
  
      this.onPlayerTakeEdge(edge)
    }
  }

  enterStep(step) {
    this.clearTimers()
    this.resetGuide()

    this.step = step
    this.canNext = false
    this.nextLabel = '\u70b9\u51fb\u5c4f\u5e55\u7ee7\u7eed'
    this.hintText = ''
    this.feedbackTimer = 0
    this.phase = 'waitNext'
    this.targetEdgeId = null
    this.targetPlayerId = null
    this.afterTakeEdge = null
    this.afterNext = null

    switch (step) {
      case 0:
        this.stepShowBoard()
        break
      case 1:
        this.stepTakeTurns()
        break
      case 2:
        this.stepCloseCellAndExtraMove()
        break
      case 3:
        this.stepCloseTwoCellsAndExtraMove()
        break
      case 4:
        this.stepStrategyTakeScore()
        break
      case 5:
        this.stepStrategyAvoidThirdEdge()
        break
      case 6:
        this.stepStartFirstGame()
        break
      case 7:
        this.startFirstGame()
        break
      default:
        this.exitTutorial()
        break
    }
  }

  // 1 展示棋盘
  stepShowBoard() {
    this.resetBoard()

    this.title = '\u8ba4\u8bc6\u68cb\u76d8'
    this.body = '\u8fd9\u662f 3x3 \u65b9\u683c\u68cb\u76d8\u3002\u6bcf\u4e2a\u65b9\u683c\u90fd\u7531 4 \u6761\u8fb9\u56f4\u6210\u3002'

    const cell = this.board.getCell('c_0_0')
    this.guide.setHighlightCell(cell)

    this.canNext = true
  }

  stepTakeTurns() {
    this.resetBoard()

    this.title = '\u8f6e\u6d41\u5360\u8fb9'
    this.body = '\u8f6e\u5230\u4f60\u65f6\uff0c\u70b9\u51fb\u4e00\u6761\u672a\u5360\u9886\u7684\u8fb9\u3002\u5148\u8bd5\u8bd5\u9ad8\u4eae\u7684\u8fd9\u6761\u8fb9\u3002'
    this.hintText = '\u70b9\u51fb\u53d1\u5149\u7684\u8fb9'
    this.phase = 'waitEdge'

    this.setTargetEdge('h_0_0', 'p1', () => {
      this.title = '\u8f6e\u5230 AI'
      this.body = '\u4f60\u5360\u9886\u4e86\u4e00\u6761\u8fb9\u3002\u6ca1\u6709\u95ed\u5408\u65b9\u683c\u65f6\uff0c\u56de\u5408\u4f1a\u4ea4\u7ed9\u5bf9\u624b\u3002'
      this.hintText = ''
      this.nextLabel = '\u70b9\u51fb\u8ba9 AI \u5360\u8fb9'
      this.phase = 'waitNext'
      this.canNext = true

      this.afterNext = () => {
        this.applyTutorialAction('p2', 'v_1_0')

        const edge = this.board.getEdge('v_1_0')
        this.guide.setHighlightEdge(edge)
        const pos = this.getEdgeCenter(edge)
        this.guide.setFinger(pos.x, pos.y)

        this.title = 'AI \u5df2\u843d\u5b50'
        this.body = '\u73b0\u5728\u4f60\u5df2\u7ecf\u4f1a\u5360\u8fb9\u4e86\u3002\u4e0b\u4e00\u6b65\u5b66\u4e60\u600e\u4e48\u5f97\u5206\u3002'
        this.nextLabel = '\u70b9\u51fb\u5c4f\u5e55\u7ee7\u7eed'
        this.phase = 'waitNext'
        this.canNext = true
      }
    })
  }

  // 3 闭合格子 + 追加行动
  stepCloseCellAndExtraMove() {
    this.resetBoard()

    this.title = '\u95ed\u5408\u5f97\u5206'
    this.body = '\u5f53\u4e00\u4e2a\u65b9\u683c\u7684 4 \u6761\u8fb9\u90fd\u88ab\u5360\u9886\u65f6\uff0c\u6700\u540e\u843d\u8fb9\u7684\u73a9\u5bb6\u5f97 1 \u5206\u3002'
    this.hintText = '\u8865\u4e0a\u6700\u540e\u4e00\u6761\u8fb9'

    this.applyTutorialAction('p1', 'h_0_0')
    this.applyTutorialAction('p2', 'v_1_0')
    this.applyTutorialAction('p1', 'h_0_1')
    this.applyTutorialAction('p2', 'h_2_0')

    this.phase = 'waitEdge'

    this.setTargetEdge('v_0_0', 'p1', () => {
      this.title = '\u518d\u8d70\u4e00\u6b21'
      this.body = '\u4f60\u95ed\u5408\u4e86\u4e00\u4e2a\u65b9\u683c\u5e76\u5f97\u5206\u3002\u95ed\u5408\u65b9\u683c\u540e\uff0c\u5f53\u524d\u73a9\u5bb6\u53ef\u4ee5\u8ffd\u52a0\u4e00\u6b21\u884c\u52a8\u3002'
      this.hintText = '\u518d\u70b9\u4e00\u6761\u8fb9'
      this.setTargetEdge('h_1_0', 'p1', () => {
        this.title = '\u8ffd\u52a0\u884c\u52a8\u5b8c\u6210'
        this.body = '\u8fd9\u6b21\u6ca1\u6709\u95ed\u5408\u65b9\u683c\uff0c\u6240\u4ee5\u63a5\u4e0b\u6765\u4f1a\u8f6e\u5230 AI\u3002'
        this.hintText = ''
        this.phase = 'waitNext'
        this.canNext = true
        this.resetGuide()
      })
    })
  }
  stepCloseTwoCellsAndExtraMove() {
    this.resetBoard()

    this.title = '\u4e00\u6b21\u591a\u683c'
    this.body = '\u6709\u65f6\u5019\u4e00\u6761\u8fb9\u4f1a\u540c\u65f6\u8865\u5b8c\u4e24\u4e2a\u65b9\u683c\u3002\u5206\u6570\u4f1a\u5168\u90e8\u8bb0\u7ed9\u4f60\u3002'
    this.hintText = '\u70b9\u51fb\u4e2d\u95f4\u5171\u7528\u8fb9'

    this.applyTutorialAction('p1', 'h_0_0')
    this.applyTutorialAction('p2', 'h_1_0')
    this.applyTutorialAction('p1', 'h_0_1')
    this.applyTutorialAction('p2', 'h_1_1')
    this.applyTutorialAction('p1', 'v_0_0')
    this.applyTutorialAction('p2', 'v_2_0')

    this.phase = 'waitEdge'

    this.setTargetEdge('v_1_0', 'p1', () => {
      this.title = '\u8fde\u5f97\u4e24\u5206'
      this.body = '\u4f60\u4e00\u6b21\u95ed\u5408\u4e86\u4e24\u4e2a\u65b9\u683c\uff0c\u4f46\u8ffd\u52a0\u884c\u52a8\u4ecd\u7136\u53ea\u6709\u4e00\u6b21\u3002'
      this.hintText = '\u7528\u8ffd\u52a0\u884c\u52a8\u518d\u70b9\u4e00\u6761\u8fb9'

      this.setTargetEdge('h_2_0', 'p1', () => {
        this.title = '\u89c4\u5219\u5df2\u638c\u63e1'
        this.body = '\u8bb0\u4f4f\uff1a\u8f6e\u6d41\u5360\u8fb9\uff0c\u95ed\u5408\u5f97\u5206\uff0c\u5f97\u5206\u540e\u518d\u8d70\u4e00\u6b21\u3002'
        this.hintText = ''
        this.phase = 'waitNext'
        this.canNext = true
        this.resetGuide()
      })
    })
  }

  stepStartFirstGame() {
    this.resetBoard()

    this.title = '\u5f00\u59cb\u7b2c\u4e00\u5c40'
    this.body = '\u6559\u7a0b\u7ed3\u675f\u540e\u4f1a\u76f4\u63a5\u8fdb\u5165 3x3 \u5165\u95e8\u5c40\u3002\u4f60\u53ef\u4ee5\u8fb9\u73a9\u8fb9\u7ec3\u521a\u624d\u7684\u89c4\u5219\u3002'
    this.nextLabel = '\u5f00\u59cb 3x3 \u5165\u95e8\u5c40'

    this.phase = 'waitNext'
    this.canNext = true
  }

  stepStrategyTakeScore() {
    this.resetBoard()

    this.title = '\u7b56\u7565\uff1a\u5148\u62ff\u73b0\u6210\u5206'
    this.body = '\u770b\u5230\u5df2\u7ecf\u6709 3 \u6761\u8fb9\u7684\u65b9\u683c\uff0c\u901a\u5e38\u8981\u7acb\u523b\u8865\u4e0a\u6700\u540e\u4e00\u6761\u8fb9\u5f97\u5206\u3002'
    this.hintText = '\u70b9\u51fb\u6700\u540e\u4e00\u6761\u8fb9\u62ff\u5206'

    this.applyTutorialAction('p1', 'h_0_0')
    this.applyTutorialAction('p2', 'v_1_0')
    this.applyTutorialAction('p1', 'h_0_1')
    this.applyTutorialAction('p2', 'h_2_0')

    this.guide.setHighlightCell(this.board.getCell('c_0_0'))
    this.setTargetEdge('v_0_0', 'p1', () => {
      this.title = '\u4e0d\u8981\u9519\u8fc7\u5f97\u5206'
      this.body = '\u8fd9\u6837\u4f60\u62ff\u5230 1 \u5206\uff0c\u800c\u4e14\u8fd8\u80fd\u518d\u8d70\u4e00\u6b21\u3002\u5b9e\u6218\u91cc\u8981\u5148\u6293\u4f4f\u8fd9\u79cd\u673a\u4f1a\u3002'
      this.hintText = ''
      this.phase = 'waitNext'
      this.canNext = true
      this.resetGuide()
    })
  }

  stepStrategyAvoidThirdEdge() {
    this.resetBoard()

    this.title = '\u7b56\u7565\uff1a\u522b\u8f7b\u6613\u9001\u5206'
    this.body = '\u5982\u679c\u4f60\u7ed9\u4e00\u4e2a\u65b9\u683c\u753b\u51fa\u7b2c 3 \u6761\u8fb9\uff0c\u5bf9\u624b\u5f88\u53ef\u80fd\u4e0b\u4e00\u624b\u5c31\u8865\u8fb9\u5f97\u5206\u3002'
    this.hintText = '\u907f\u5f00\u5371\u9669\u683c\uff0c\u70b9\u51fb\u8fdc\u5904\u5b89\u5168\u8fb9'

    this.applyTutorialAction('p1', 'h_0_0')
    this.applyTutorialAction('p2', 'h_2_0')
    this.applyTutorialAction('p1', 'v_0_0')
    this.applyTutorialAction('p2', 'h_2_1')

    this.guide.setHighlightCell(this.board.getCell('c_0_0'))
    this.setTargetEdge('v_3_2', 'p1', () => {
      this.title = '\u5148\u627e\u5b89\u5168\u8fb9'
      this.body = '\u8fd9\u6b21\u4f60\u6ca1\u6709\u628a\u5de6\u4e0a\u89d2\u7684\u65b9\u683c\u9001\u6210 3 \u8fb9\u3002\u521d\u5b66\u65f6\u53ef\u4ee5\u5148\u627e\u4e0d\u4f1a\u9001\u5206\u7684\u8fb9\u3002'
      this.hintText = ''
      this.phase = 'waitNext'
      this.canNext = true
      this.resetGuide()
    })
  }

  setTargetEdge(edgeId, playerId, afterTake) {
    const edge = this.board.getEdge(edgeId)

    this.targetEdgeId = edgeId
    this.targetPlayerId = playerId
    this.afterTakeEdge = afterTake

    this.guide.setHighlightEdge(edge)

    const pos = this.getEdgeCenter(edge)
    this.guide.setFinger(pos.x, pos.y)

    this.phase = 'waitEdge'
    this.canNext = false
  }

  onPlayerTakeEdge(edge) {
    const result = this.applyTutorialAction(this.targetPlayerId || this.engine.getCurrentPlayerId(), edge.id)
    if (!result || !result.success) {
      this.showWrongTapFeedback('\u73b0\u5728\u8fd8\u4e0d\u80fd\u70b9\u8fd9\u6761\u8fb9')
      return
    }

    const callback = this.afterTakeEdge
    this.afterTakeEdge = null
    this.targetEdgeId = null

    callback?.()
  }

  getTouchedEdge(x, y) {
    return this.hitTest.getEdgeByPoint(x, y)
  }

  normalizeTouch(touch) {
    let clientX = 0
    let clientY = 0  
  
    if (touch && typeof touch.x === 'number' && typeof touch.y === 'number') {
      clientX = touch.x
      clientY = touch.y
    } else {
    }
  
    if (!this.canvas.getBoundingClientRect) {
      const systemInfo = wx.getSystemInfoSync()
  
      const pos = {
        x: clientX * (this.width / systemInfo.screenWidth),
        y: clientY * (this.height / systemInfo.screenHeight)
      }
  
      return pos
    }
  
    const rect = this.canvas.getBoundingClientRect()
  
    const pos = {
      x: (clientX - rect.left) * (this.width / rect.width),
      y: (clientY - rect.top) * (this.height / rect.height)
    } 

    return {
      x: (clientX - rect.left) * (this.width / rect.width),
      y: (clientY - rect.top) * (this.height / rect.height)
    }
  }

  resetBoard() {
    this.board = BoardFactory.createSquareBoard(3, 3)
    this.engine = new GameEngine({
      board: this.board,
      players: [
        { id: 'p1', name: '\u4f60' },
        { id: 'p2', name: 'AI' }
      ]
    })
    this.animationManager = new AnimationManager()
    this.hitTest = new HitTest({
      board: this.board,
      originX: this.layout.originX,
      originY: this.layout.originY,
      cellSize: this.layout.cellSize,
      hitRange: Math.max(18, this.layout.cellSize * 0.3),
      type: 'square'
    })
  }

  resetGuide() {
    this.guide.setHighlightEdge(null)
    this.guide.setHighlightCell(null)
    this.guide.clearFinger()
  }

  getEdgeCenter(edge) {
    const size = this.layout.cellSize
    const ox = this.layout.originX
    const oy = this.layout.originY

    if (edge.type === 'horizontal') {
      return {
        x: ox + (edge.x + 0.5) * size,
        y: oy + edge.y * size
      }
    }

    return {
      x: ox + edge.x * size,
      y: oy + (edge.y + 0.5) * size
    }
  }

  applyTutorialAction(playerId, edgeId) {
    const action = new ClaimEdgeAction({ playerId, edgeId })
    const result = this.engine.handleAction(action)
    if (!result.success) return result

    this.animationManager.playEdge(edgeId, playerId)
    for (const cell of result.closedCells || []) {
      const center = this.getCellCenter(cell)
      this.animationManager.playCell(cell.id, playerId, center.x, center.y)
    }

    return result
  }

  getCellCenter(cell) {
    return {
      x: this.layout.originX + (cell.x + 0.5) * this.layout.cellSize,
      y: this.layout.originY + (cell.y + 0.5) * this.layout.cellSize
    }
  }

  showWrongTapFeedback(text = '\u8bf7\u70b9\u51fb\u9ad8\u4eae\u7684\u8fd9\u6761\u8fb9') {
    this.feedbackText = text
    this.feedbackTimer = 900

    const edge = this.targetEdgeId ? this.board.getEdge(this.targetEdgeId) : null
    if (edge) {
      this.guide.setHighlightEdge(null)
      this.setTimer(() => this.guide.setHighlightEdge(edge), 90)
    }
  }

  getPrevButton() {
    return {
      x: 20,
      y: this.safeLayout.top + 8,
      width: 82,
      height: 34
    }
  }

  getSkipButton() {
    return {
      x: this.width - 88,
      y: this.safeLayout.top + 8,
      width: 68,
      height: 34
    }
  }

  getEndMenuButton() {
    const width = Math.min(this.width - 80, 220)
    return {
      x: (this.width - width) / 2,
      y: this.layout.originY + this.layout.cellSize * 3 + 96,
      width,
      height: 42
    }
  }

  isFinalStep() {
    return this.step === FINAL_TUTORIAL_STEP
  }

  isButtonHit(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
  }

  drawFittedText(ctx, text, x, y, maxWidth, fontSize, minFontSize = 10, weight = '', align = 'center') {
    const safeText = `${text || ''}`
    let size = fontSize
    const fontWeight = weight ? `${weight} ` : ''

    while (size > minFontSize) {
      ctx.font = `${fontWeight}${size}px Arial`
      if (ctx.measureText(safeText).width <= maxWidth) break
      size -= 1
    }

    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.fillText(safeText, x, y)
  }

  wrapText(ctx, text, maxWidth, fontSize, weight = '') {
    const chars = `${text || ''}`.split('')
    const lines = []
    let line = ''
    ctx.font = `${weight ? `${weight} ` : ''}${fontSize}px Arial`

    for (const char of chars) {
      const test = line + char
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line)
        line = char
      } else {
        line = test
      }
    }

    if (line) lines.push(line)
    return lines
  }

  setTimer(fn, delay) {
    const timer = setTimeout(fn, delay)
    this.timers.push(timer)
  }

  clearTimers() {
    for (const timer of this.timers) {
      clearTimeout(timer)
    }
    this.timers = []
  }

  exitTutorial() {
    this.clearTimers()

    const MenuScene = require('./MenuScene').default

    this.sceneManager.setScene(new MenuScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height
    }))
  }

  startFirstGame() {
    this.clearTimers()

    this.sceneManager.setScene(new BattleScene({
      canvas: this.canvas,
      ctx: this.ctx,
      inputManager: this.inputManager,
      sceneManager: this.sceneManager,
      width: this.width,
      height: this.height,
      rows: 3,
      cols: 3,
      boardType: 'square',
      mode: 'ai',
      aiDifficulty: 'easy'
    }))
  }
}
