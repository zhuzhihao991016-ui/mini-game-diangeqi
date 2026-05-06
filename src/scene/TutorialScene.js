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
import { getActiveAppearanceTheme } from '../ui/AppearanceThemes'
import { getImageAsset, preloadImageAssets } from '../assets/ImageAssets'

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
    this.nextLabel = '继续'
    this.feedbackText = ''
    this.feedbackTimer = 0
    this.timers = []
    preloadImageAssets()
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

    this.drawBackground()

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
    const colors = this.getActiveColors()

    const x = 20
    const y = this.safeLayout.top + 50
    const w = this.width - 40
    const h = 122
    this.drawThemePanelShell(ctx, x, y, w, h, colors.primary)

    ctx.textBaseline = 'middle'
    ctx.fillStyle = colors.text
    this.drawFittedText(ctx, this.title, this.width / 2, y + 28, w - 32, 18, 13, 'bold', 'center')

    ctx.fillStyle = colors.muted
    const lines = this.wrapText(ctx, this.body, w - 36, 14, '')
    lines.slice(0, 2).forEach((line, index) => {
      this.drawFittedText(ctx, line, this.width / 2, y + 56 + index * 20, w - 36, 14, 11, '', 'center')
    })

    if (this.canNext) {
      ctx.fillStyle = colors.primary
      this.drawFittedText(ctx, this.nextLabel, this.width / 2, y + 104, w - 36, 15, 11, 'bold', 'center')
    } else if (this.hintText) {
      ctx.fillStyle = colors.primary
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
    const colors = this.getActiveColors()
    const color = playerId === 'p1' ? colors.p1 : colors.p2
    const name = playerId === 'p1' ? '你' : 'AI'
    const score = state.scores[playerId] || 0

    ctx.save()
    this.drawThemeButtonShell(ctx, { x, y, width: w, height: h, color, solid: false, compact: true })
    if (isCurrent) {
      this.roundRect(ctx, x + 3, y + 3, w - 6, h - 6, UITheme.radius.md)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()
    }

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x + 18, y + 20, 7, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = colors.text
    this.drawFittedText(ctx, name, x + 32, y + 21, w - 44, 14, 10, 'bold', 'left')
    ctx.fillStyle = colors.muted
    this.drawFittedText(ctx, `${score}/${total}`, x + w / 2, y + 43, w - 18, 13, 10, '', 'center')

    if (isCurrent) {
      ctx.fillStyle = color
      this.drawFittedText(ctx, '当前回合', x + w - 10, y + 20, w - 52, 11, 8, '', 'right')
    }

    ctx.restore()
  }

  drawTopButtons() {
    const ctx = this.ctx
    const prev = this.getPrevButton()
    const skip = this.getSkipButton()

    this.drawSmallButton(ctx, prev, '上一步', this.step > 0)
    this.drawSmallButton(ctx, skip, '跳过', true)
  }

  drawSmallButton(ctx, rect, text, enabled) {
    const colors = this.getActiveColors()
    const color = enabled ? colors.primary : colors.disabled
    ctx.save()
    this.drawThemeButtonShell(ctx, { x: rect.x, y: rect.y, width: rect.width, height: rect.height, color, solid: false, compact: true })
    ctx.fillStyle = enabled ? colors.text : colors.muted
    this.drawFittedText(ctx, text, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width - 12, 13, 9, 'bold', 'center')
    ctx.restore()
  }

  drawEndMenuButton() {
    const ctx = this.ctx
    const rect = this.getEndMenuButton()
    const colors = this.getActiveColors()

    ctx.save()
    this.drawThemeButtonShell(ctx, { x: rect.x, y: rect.y, width: rect.width, height: rect.height, color: colors.primary, solid: false })
    ctx.fillStyle = colors.primary
    this.drawFittedText(ctx, '返回菜单', rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width - 20, 15, 11, 'bold', 'center')
    ctx.restore()
  }

  drawFeedback() {
    const ctx = this.ctx
    const text = this.feedbackText || '请点击高亮的边'
    const w = Math.min(this.width - 56, 250)
    const h = 38
    const x = (this.width - w) / 2
    const y = this.layout.originY - 52
    const colors = this.getActiveColors()

    ctx.save()
    this.roundRect(ctx, x, y, w, h, UITheme.radius.md)
    ctx.fillStyle = this.withAlpha(colors.text, 0.88)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    this.drawFittedText(ctx, text, this.width / 2, y + h / 2, w - 20, 13, 10, 'bold', 'center')
    ctx.restore()
  }

  drawBackground() {
    const ctx = this.ctx
    const theme = getActiveAppearanceTheme()
    const colors = theme.colors
    const image = getImageAsset((theme.background && theme.background.imageAsset) || 'menuBackground')

    if (image && !image.failed && image.loaded) {
      const imageRatio = image.width / image.height
      const canvasRatio = this.width / this.height
      let drawW = this.width
      let drawH = this.height
      let drawX = 0
      let drawY = 0

      if (imageRatio > canvasRatio) {
        drawH = this.height
        drawW = drawH * imageRatio
        drawX = (this.width - drawW) / 2
      } else {
        drawW = this.width
        drawH = drawW / imageRatio
        drawY = (this.height - drawH) / 2
      }

      ctx.drawImage(image, drawX, drawY, drawW, drawH)
      ctx.fillStyle = theme.background.imageOverlay || 'rgba(255,255,255,0.08)'
      ctx.fillRect(0, 0, this.width, this.height)
      return
    }

    ctx.fillStyle = colors.background
    ctx.fillRect(0, 0, this.width, this.height)
  }

  drawThemePanelShell(ctx, x, y, width, height, accentColor) {
    const colors = this.getActiveColors()
    ctx.save()
    this.drawThemeButtonShell(ctx, { x, y, width, height, color: accentColor, solid: false })
    this.roundRect(ctx, x + 7, y + 7, width - 14, height - 14, UITheme.radius.md)
    ctx.fillStyle = this.withAlpha(colors.surface, 0.92)
    ctx.fill()
    ctx.strokeStyle = this.withAlpha(accentColor, 0.22)
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  drawThemeButtonShell(ctx, { x, y, width, height, color, solid = false, compact = false }) {
    const theme = getActiveAppearanceTheme()
    const style = theme.buttonStyle || 'minimal'
    const colors = theme.colors
    const radius = style === 'mechanical' || style === 'black-gold'
      ? Math.min(5, UITheme.radius.md)
      : style === 'cartoon' || style === 'panda'
        ? Math.min(14, UITheme.radius.lg)
        : UITheme.radius.md

    if (style === 'mechanical') {
      this.cutCornerRect(ctx, x, y, width, height, Math.min(10, height * 0.18))
      const gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, solid ? this.lighten(color, 0.1) : colors.surfaceTint)
      gradient.addColorStop(0.52, solid ? color : colors.surface)
      gradient.addColorStop(1, solid ? this.darken(color, 0.24) : colors.surfaceTint)
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.strokeStyle = solid ? this.lighten(color, 0.25) : color
      ctx.lineWidth = 1.8
      ctx.stroke()
      ctx.fillStyle = solid ? this.withAlpha('#FFFFFF', 0.42) : color
      ;[[x + 12, y + 12], [x + width - 12, y + 12], [x + 12, y + height - 12], [x + width - 12, y + height - 12]].forEach(([px, py]) => {
        ctx.beginPath()
        ctx.arc(px, py, 2, 0, Math.PI * 2)
        ctx.fill()
      })
      return
    }

    this.roundRect(ctx, x, y, width, height, radius)
    if (style === 'steampunk') {
      const gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, solid ? this.lighten(color, 0.2) : colors.surfaceTint)
      gradient.addColorStop(0.48, solid ? color : colors.surface)
      gradient.addColorStop(1, solid ? this.darken(color, 0.28) : colors.primaryLight)
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.strokeStyle = colors.warning
      ctx.lineWidth = 2
      ctx.stroke()
      return
    }

    if (style === 'black-gold') {
      const gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, solid ? this.lighten(color, 0.12) : '#211B10')
      gradient.addColorStop(0.45, solid ? color : '#15120B')
      gradient.addColorStop(1, solid ? this.darken(color, 0.42) : '#080808')
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.strokeStyle = colors.warning
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.strokeStyle = this.withAlpha('#FFF6D8', 0.26)
      ctx.lineWidth = 1
      this.roundRect(ctx, x + 4, y + 4, width - 8, height - 8, Math.max(2, radius - 1))
      ctx.stroke()
      return
    }

    if (style === 'cartoon') {
      this.roundRect(ctx, x, y + 3, width, height, radius)
      ctx.fillStyle = this.darken(color, solid ? 0.32 : 0.18)
      ctx.fill()
      this.roundRect(ctx, x, y, width, height - 3, radius)
      ctx.fillStyle = solid ? color : this.getCardFill(color)
      ctx.fill()
      ctx.strokeStyle = colors.text
      ctx.lineWidth = 2.4
      ctx.stroke()
      if (!compact) {
        ctx.fillStyle = this.withAlpha('#FFFFFF', solid ? 0.35 : 0.6)
        this.roundRect(ctx, x + 12, y + 8, width - 24, Math.max(5, height * 0.14), 5)
        ctx.fill()
      }
      return
    }

    if (style === 'guofeng') {
      ctx.fillStyle = solid ? color : colors.surface
      ctx.fill()
      ctx.strokeStyle = solid ? colors.warning : color
      ctx.lineWidth = solid ? 1.8 : 1.4
      ctx.stroke()
      ctx.strokeStyle = this.withAlpha(solid ? '#FFFDF6' : color, 0.45)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + 10, y + 8)
      ctx.quadraticCurveTo(x + width * 0.5, y + 2, x + width - 10, y + 8)
      ctx.stroke()
      return
    }

    if (style === 'handdrawn') {
      const paper = solid ? this.lighten(color, 0.08) : colors.surface
      const ink = solid ? this.darken(color, 0.34) : color
      this.drawSketchBlob(ctx, x + 3, y + 4, width - 3, height - 2, radius, [[0, 1], [1, 0], [-1, 1], [0, -1]])
      ctx.fillStyle = this.withAlpha(colors.text, 0.14)
      ctx.fill()
      this.drawSketchBlob(ctx, x, y, width - 2, height - 2, radius, [[0, 0], [2, -1], [-1, 1], [1, 2]])
      ctx.fillStyle = paper
      ctx.fill()
      ctx.strokeStyle = ink
      ctx.lineWidth = solid ? 2.8 : 2.2
      this.drawSketchBlob(ctx, x, y, width - 2, height - 2, radius, [[0, 0], [2, -1], [-1, 1], [1, 2]])
      ctx.stroke()
      ctx.strokeStyle = this.withAlpha(colors.text, 0.26)
      ctx.lineWidth = 1.1
      this.drawSketchBlob(ctx, x + 2, y + 2, width - 5, height - 5, Math.max(3, radius - 3), [[1, -1], [-1, 0], [0, 1], [2, 0]])
      ctx.stroke()
      ctx.strokeStyle = this.withAlpha(solid ? '#FFFFFF' : colors.warning, solid ? 0.48 : 0.56)
      ctx.lineWidth = Math.max(2, height * 0.08)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x + width * 0.18, y + height - 10)
      ctx.quadraticCurveTo(x + width * 0.48, y + height - 15, x + width * 0.82, y + height - 11)
      ctx.stroke()
      return
    }

    if (style === 'panda') {
      this.roundRect(ctx, x, y + 3, width, height, radius)
      ctx.fillStyle = this.withAlpha(colors.dot, solid ? 0.22 : 0.12)
      ctx.fill()
      this.roundRect(ctx, x, y, width, height - 3, radius)
      ctx.fillStyle = solid ? color : colors.surface
      ctx.fill()
      ctx.strokeStyle = colors.dot
      ctx.lineWidth = 2.2
      ctx.stroke()
      ctx.strokeStyle = solid ? this.withAlpha('#FFFFFF', 0.55) : colors.secondary
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + 14, y + height - 10)
      ctx.quadraticCurveTo(x + width * 0.5, y + height - 18, x + width - 14, y + height - 10)
      ctx.stroke()
      return
    }

    ctx.fillStyle = solid ? color : this.getCardFill(color)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.4
    ctx.stroke()
  }

  getCardFill(accentColor) {
    const colors = this.getActiveColors()
    if (accentColor === colors.secondary) return colors.secondaryLight
    if (accentColor === colors.warning) return colors.warningLight
    if (accentColor === colors.danger) return colors.dangerLight
    if (accentColor === colors.purple) return colors.purpleLight
    return colors.surface
  }

  getActiveColors() {
    return getActiveAppearanceTheme().colors
  }

  darken(hex, amount) {
    const raw = hex.replace('#', '')
    const num = parseInt(raw, 16)
    const r = Math.max(0, Math.floor(((num >> 16) & 255) * (1 - amount)))
    const g = Math.max(0, Math.floor(((num >> 8) & 255) * (1 - amount)))
    const b = Math.max(0, Math.floor((num & 255) * (1 - amount)))
    return `rgb(${r}, ${g}, ${b})`
  }

  lighten(hex, amount) {
    const raw = hex.replace('#', '')
    const num = parseInt(raw, 16)
    const r = Math.min(255, Math.floor(((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * amount))
    const g = Math.min(255, Math.floor(((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * amount))
    const b = Math.min(255, Math.floor((num & 255) + (255 - (num & 255)) * amount))
    return `rgb(${r}, ${g}, ${b})`
  }

  withAlpha(color, alpha) {
    if (typeof color !== 'string') return `rgba(0,0,0,${alpha})`
    if (color.startsWith('rgba')) return color
    if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
    if (!color.startsWith('#')) return color

    const raw = color.slice(1)
    if (raw.length !== 6) return color
    const num = parseInt(raw, 16)
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`
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

  drawSketchBlob(ctx, x, y, width, height, radius, jitter) {
    const r = Math.min(radius, width / 2, height / 2)
    const j = jitter || [[0, 0], [0, 0], [0, 0], [0, 0]]
    ctx.beginPath()
    ctx.moveTo(x + r + j[0][0], y + j[0][1])
    ctx.lineTo(x + width - r + j[1][0], y + j[1][1])
    ctx.quadraticCurveTo(x + width + j[1][0], y + j[1][1], x + width + j[1][0], y + r + j[1][1])
    ctx.lineTo(x + width + j[2][0], y + height - r + j[2][1])
    ctx.quadraticCurveTo(x + width + j[2][0], y + height + j[2][1], x + width - r + j[2][0], y + height + j[2][1])
    ctx.lineTo(x + r + j[3][0], y + height + j[3][1])
    ctx.quadraticCurveTo(x + j[3][0], y + height + j[3][1], x + j[3][0], y + height - r + j[3][1])
    ctx.lineTo(x + j[0][0], y + r + j[0][1])
    ctx.quadraticCurveTo(x + j[0][0], y + j[0][1], x + r + j[0][0], y + j[0][1])
    ctx.closePath()
  }

  cutCornerRect(ctx, x, y, width, height, cut) {
    ctx.beginPath()
    ctx.moveTo(x + cut, y)
    ctx.lineTo(x + width - cut, y)
    ctx.lineTo(x + width, y + cut)
    ctx.lineTo(x + width, y + height - cut)
    ctx.lineTo(x + width - cut, y + height)
    ctx.lineTo(x + cut, y + height)
    ctx.lineTo(x, y + height - cut)
    ctx.lineTo(x, y + cut)
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
    this.nextLabel = '点击屏幕继续'
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

    this.title = '认识棋盘'
    this.body = '这是 3x3 方格棋盘。每个方格都由 4 条边围成。'

    const cell = this.board.getCell('c_0_0')
    this.guide.setHighlightCell(cell)

    this.canNext = true
  }

  stepTakeTurns() {
    this.resetBoard()

    this.title = '轮流占边'
    this.body = '轮到你时，点击一条未占领的边。先试试高亮的这条边。'
    this.hintText = '点击发光的边'
    this.phase = 'waitEdge'

    this.setTargetEdge('h_0_0', 'p1', () => {
      this.title = '轮到 AI'
      this.body = '你占领了一条边。没有闭合方格时，回合会交给对手。'
      this.hintText = ''
      this.nextLabel = '点击让 AI 占边'
      this.phase = 'waitNext'
      this.canNext = true

      this.afterNext = () => {
        this.applyTutorialAction('p2', 'v_1_0')

        const edge = this.board.getEdge('v_1_0')
        this.guide.setHighlightEdge(edge)
        const pos = this.getEdgeCenter(edge)
        this.guide.setFinger(pos.x, pos.y)

        this.title = 'AI 已落子'
        this.body = '现在你已经会占边了。下一步学习怎么得分。'
        this.nextLabel = '点击屏幕继续'
        this.phase = 'waitNext'
        this.canNext = true
      }
    })
  }

  // 3 闭合格子 + 追加行动
  stepCloseCellAndExtraMove() {
    this.resetBoard()

    this.title = '闭合得分'
    this.body = '当一个方格的 4 条边都被占领时，最后落边的玩家得 1 分。'
    this.hintText = '补上最后一条边'

    this.applyTutorialAction('p1', 'h_0_0')
    this.applyTutorialAction('p2', 'v_1_0')
    this.applyTutorialAction('p1', 'h_0_1')
    this.applyTutorialAction('p2', 'h_2_0')

    this.phase = 'waitEdge'

    this.setTargetEdge('v_0_0', 'p1', () => {
      this.title = '再走一次'
      this.body = '你闭合了一个方格并得分。闭合方格后，当前玩家可以追加一次行动。'
      this.hintText = '再点一条边'
      this.setTargetEdge('h_1_0', 'p1', () => {
        this.title = '追加行动完成'
        this.body = '这次没有闭合方格，所以接下来会轮到 AI。'
        this.hintText = ''
        this.phase = 'waitNext'
        this.canNext = true
        this.resetGuide()
      })
    })
  }
  stepCloseTwoCellsAndExtraMove() {
    this.resetBoard()

    this.title = '一次多格'
    this.body = '有时候一条边会同时补完两个方格。分数会全部记给你。'
    this.hintText = '点击中间共用边'

    this.applyTutorialAction('p1', 'h_0_0')
    this.applyTutorialAction('p2', 'h_1_0')
    this.applyTutorialAction('p1', 'h_0_1')
    this.applyTutorialAction('p2', 'h_1_1')
    this.applyTutorialAction('p1', 'v_0_0')
    this.applyTutorialAction('p2', 'v_2_0')

    this.phase = 'waitEdge'

    this.setTargetEdge('v_1_0', 'p1', () => {
      this.title = '连得两分'
      this.body = '你一次闭合了两个方格，但追加行动仍然只有一次。'
      this.hintText = '用追加行动再点一条边'

      this.setTargetEdge('h_2_0', 'p1', () => {
        this.title = '规则已掌握'
        this.body = '记住：轮流占边，闭合得分，得分后再走一次。'
        this.hintText = ''
        this.phase = 'waitNext'
        this.canNext = true
        this.resetGuide()
      })
    })
  }

  stepStartFirstGame() {
    this.resetBoard()

    this.title = '开始第一局'
    this.body = '教程结束后会直接进入 3x3 入门局。你可以边玩边练刚才的规则。'
    this.nextLabel = '开始 3x3 入门局'

    this.phase = 'waitNext'
    this.canNext = true
  }

  stepStrategyTakeScore() {
    this.resetBoard()

    this.title = '策略：先拿现成分'
    this.body = '看到已经有 3 条边的方格，通常要立刻补上最后一条边得分。'
    this.hintText = '点击最后一条边拿分'

    this.applyTutorialAction('p1', 'h_0_0')
    this.applyTutorialAction('p2', 'v_1_0')
    this.applyTutorialAction('p1', 'h_0_1')
    this.applyTutorialAction('p2', 'h_2_0')

    this.guide.setHighlightCell(this.board.getCell('c_0_0'))
    this.setTargetEdge('v_0_0', 'p1', () => {
      this.title = '不要错过得分'
      this.body = '这样你拿到 1 分，而且还能再走一次。实战里要先抓住这种机会。'
      this.hintText = ''
      this.phase = 'waitNext'
      this.canNext = true
      this.resetGuide()
    })
  }

  stepStrategyAvoidThirdEdge() {
    this.resetBoard()

    this.title = '策略：别轻易送分'
    this.body = '如果你给一个方格画出第 3 条边，对手很可能下一手就补边得分。'
    this.hintText = '避开危险格，点击远处安全边'

    this.applyTutorialAction('p1', 'h_0_0')
    this.applyTutorialAction('p2', 'h_2_0')
    this.applyTutorialAction('p1', 'v_0_0')
    this.applyTutorialAction('p2', 'h_2_1')

    this.guide.setHighlightCell(this.board.getCell('c_0_0'))
    this.setTargetEdge('v_3_2', 'p1', () => {
      this.title = '先找安全边'
      this.body = '这次你没有把左上角的方格送成 3 边。初学时可以先找不会送分的边。'
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
      this.showWrongTapFeedback('现在还不能点这条边')
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
        { id: 'p1', name: '你' },
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

  showWrongTapFeedback(text = '请点击高亮的这条边') {
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
