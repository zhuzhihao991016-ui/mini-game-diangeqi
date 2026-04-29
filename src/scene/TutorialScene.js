import BaseScene from './BaseScene'
import BoardFactory from '../core/board/BoardFactory'
import Renderer from '../render/Renderer'
import BoardRenderer from '../render/BoardRenderer'
import GuideRenderer from '../render/GuideRenderer'

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

    this.board = BoardFactory.createSquareBoard(3, 3)
    this.layout = this.createLayout()

    this.step = 0
    this.phase = 'waitNext'
    this.text = ''
    this.targetEdgeId = null
    this.canNext = false
    this.timers = []
  }

  onEnter() {
    this.inputManager.clearTouchStartHandlers()
    this.enterStep(0)

    this.inputManager.onTouchStart((x, y, rawEvent) => {
      this.handleTouch({ x, y, rawEvent })
    })
  }

  createLayout() {
    const cellSize = 80
    const boardWidth = cellSize * 3

    return {
      cellSize,
      originX: (this.width - boardWidth) / 2,
      originY: 200
    }
  }

  update(deltaTime) {
    this.guide.update(deltaTime)
  }

  render() {
    this.renderer.clear()

    this.ctx.fillStyle = '#EFEFEF'
    this.ctx.fillRect(0, 0, this.width, this.height)

    this.boardRenderer.draw({
      board: this.board,
      originX: this.layout.originX,
      originY: this.layout.originY,
      cellSize: this.layout.cellSize
    })

    this.guide.draw({
      boardRenderer: this.boardRenderer,
      board: this.board,
      originX: this.layout.originX,
      originY: this.layout.originY,
      cellSize: this.layout.cellSize
    })

    this.drawStepText()
  }

  drawStepText() {
    const ctx = this.ctx

    ctx.fillStyle = '#000'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(this.text, this.width / 2, 100)

    if (this.canNext) {
      ctx.font = '16px Arial'
      ctx.fillStyle = '#666'
      ctx.fillText('点击屏幕继续', this.width / 2, 135)
    }
  }

  handleTouch(touch) {
  
    if (this.phase === 'waitNext') {
      if (this.canNext) this.enterStep(this.step + 1)
      return
    }
  
    if (this.phase === 'waitEdge') {
      const pos = this.normalizeTouch(touch)
  
      const edge = this.getTouchedEdge(pos.x, pos.y)
  
      if (!edge || edge.id !== this.targetEdgeId) {
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
    this.phase = 'waitNext'
    this.targetEdgeId = null

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
        this.stepWinCondition()
        break
      case 5:
        this.exitTutorial()
        break
      default:
        this.exitTutorial()
        break
    }
  }

  // 1 展示棋盘
  stepShowBoard() {
    this.resetBoard()

    this.text = '这是一个 3×3 的方格棋盘，每个方格有 4 条边'

    const cell = this.board.getCell('c_0_0')
    this.guide.setHighlightCell(cell)

    this.canNext = true
  }

  // 2 玩家占边，机器占边
  stepTakeTurns() {
    this.resetBoard()

    this.text = '玩家轮流点击边进行占领，请点击高亮边'
    this.phase = 'waitEdge'

    this.setTargetEdge('h_0_0', 'p1', () => {
      this.text = '你占领了一条边，接下来机器会占领另一条边'

      this.phase = 'animating'
      this.setTimer(() => {
        this.simulateEdge('v_1_0', 'p2')

        const edge = this.board.getEdge('v_1_0')
        this.guide.setHighlightEdge(edge)
        const pos = this.getEdgeCenter(edge)
        this.guide.setFinger(pos.x, pos.y)

        this.text = '机器完成占领'
        this.phase = 'waitNext'
        this.canNext = true
      }, 700)
    })
  }

  // 3 闭合格子 + 追加行动
  stepCloseCellAndExtraMove() {
    this.resetBoard()

    this.text = '当 4 条边都被占领时，方格会被闭合'

    this.simulateEdge('h_0_0', 'p1')
    this.simulateEdge('v_1_0', 'p2')
    this.simulateEdge('h_0_1', 'p1')

    this.phase = 'waitEdge'

    this.setTargetEdge('v_0_0', 'p1', () => {
      this.board.getCell('c_0_0').ownerId = 'p1'

      this.text = '闭合格子的玩家可以再走一次'
      this.setTargetEdge('h_1_0', 'p1', () => {
        this.text = '追加行动完成'
        this.phase = 'waitNext'
        this.canNext = true
        this.resetGuide()
      })
    })
  }

  // 4 一次闭合多个格子 + 只追加一次
  stepCloseTwoCellsAndExtraMove() {
    this.resetBoard()

    this.text = '一次可以闭合多个格子，但只能追加一次行动'

    this.simulateEdge('h_0_0', 'p1')
    this.simulateEdge('h_1_0', 'p2')
    this.simulateEdge('h_0_1', 'p1')
    this.simulateEdge('h_1_1', 'p2')
    this.simulateEdge('v_0_0', 'p1')
    this.simulateEdge('v_2_0', 'p2')

    this.phase = 'waitEdge'

    this.setTargetEdge('v_1_0', 'p1', () => {
      this.board.getCell('c_0_0').ownerId = 'p1'
      this.board.getCell('c_1_0').ownerId = 'p1'

      this.text = '你一次闭合了两个方格，但只获得一次追加行动'

      this.setTargetEdge('h_2_0', 'p1', () => {
        this.text = '追加行动完成'
        this.phase = 'waitNext'
        this.canNext = true
        this.resetGuide()
      })
    })
  }

  // 5 胜负
  stepWinCondition() {
    this.resetBoard()

    this.text = '当所有格子被占满时，数量多者获胜'

    let index = 0
    for (const cell of this.board.cells.values()) {
      cell.ownerId = index % 2 === 0 ? 'p1' : 'p2'
      index++
    }

    this.phase = 'waitNext'
    this.canNext = true
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
    this.simulateEdge(edge.id, this.targetPlayerId || 'p1')

    const callback = this.afterTakeEdge
    this.afterTakeEdge = null
    this.targetEdgeId = null

    callback?.()
  }

  getTouchedEdge(x, y) {
    const tolerance = 36
  
    let nearest = null
    let nearestDistance = Infinity
  
    for (const edge of this.board.edges.values()) {
      if (edge.ownerId) continue
  
      const center = this.getEdgeCenter(edge)
      const dx = Math.abs(x - center.x)
      const dy = Math.abs(y - center.y)
      const distance = Math.sqrt(dx * dx + dy * dy)
  
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = {
          id: edge.id,
          type: edge.type,
          edgeX: edge.x,
          edgeY: edge.y,
          center,
          dx,
          dy,
          distance
        }
      }
  
      if (edge.type === 'horizontal') {
        const hit = dx <= this.layout.cellSize / 2 + tolerance && dy <= tolerance
  
        if (hit) {
          return edge
        }
      } else {
        const hit = dx <= tolerance && dy <= this.layout.cellSize / 2 + tolerance
  
        if (hit) {
          return edge
        }
      }
    }
  
    return null
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

  simulateEdge(edgeId, playerId) {
    const edge = this.board.getEdge(edgeId)
    if (!edge) return

    edge.ownerId = playerId
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
}