export default class AnimationManager {
  constructor() {
    this.edgeAnimations = new Map()
    this.cellAnimations = new Map()
    this.ripples = []
    this.particles = []
  }

  // ─── 触发动画 ───────────────────────────────────────────────

  playEdge(edgeId, playerId) {
    this.edgeAnimations.set(edgeId, {
      edgeId,
      playerId,
      time: 0,
      drawDuration: 220,   // 描线阶段时长
      flashDuration: 180,  // 描线完成后的扫光时长
    })
  }

  playCell(cellId, playerId, cx = 0.5, cy = 0.5) {
    this.cellAnimations.set(cellId, {
      cellId,
      playerId,
      cx,
      cy,
      time: 0,
      duration: 320,
    })

    // 同步触发波纹
    this.ripples.push({
      x: cx, y: cy,
      playerId,
      time: 0,
      duration: 500,
    })

    // 稍微延迟触发粒子，让弹入动作先建立存在感
    setTimeout(() => this._spawnParticles(cx, cy, playerId), 80)
  }

  // ─── 每帧更新 ───────────────────────────────────────────────

  update(deltaTime) {
    // 边
    for (const [id, anim] of this.edgeAnimations) {
      anim.time += deltaTime
      if (anim.time >= anim.drawDuration + anim.flashDuration) {
        this.edgeAnimations.delete(id)
      }
    }

    // 格子
    for (const [id, anim] of this.cellAnimations) {
      anim.time += deltaTime
      if (anim.time >= anim.duration) {
        this.cellAnimations.delete(id)
      }
    }

    // 波纹
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].time += deltaTime
      if (this.ripples[i].time >= this.ripples[i].duration) {
        this.ripples.splice(i, 1)
      }
    }

    // 粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.time += deltaTime
      p.x += p.vx * deltaTime
      p.y += p.vy * deltaTime
      if (p.time >= p.duration) {
        this.particles.splice(i, 1)
      }
    }
  }

  // ─── 查询接口 ───────────────────────────────────────────────

  /**
   * 边的描线进度 0→1
   */
  getEdgeProgress(edgeId) {
    const anim = this.edgeAnimations.get(edgeId)
    if (!anim) return 1
    return this.easeOutCubic(Math.min(1, anim.time / anim.drawDuration))
  }

  /**
   * 边的扫光信息，描线完成后触发
   * 返回 { progress: 0→1, alpha: 0→1 } 或 null（无扫光时）
   */
  getEdgeFlash(edgeId) {
    const anim = this.edgeAnimations.get(edgeId)
    if (!anim || anim.time < anim.drawDuration) return null
    const t = (anim.time - anim.drawDuration) / anim.flashDuration
    return {
      progress: this.easeInOutQuad(Math.min(1, t)), // 扫光扫过的位置
      alpha: 0.75 * (1 - Math.min(1, t)),           // 逐渐消退
    }
  }

  /**
   * 格子的缩放进度 0→1（含弹入超出感）
   */
  getCellProgress(cellId) {
    const anim = this.cellAnimations.get(cellId)
    if (!anim) return 1
    return this.easeOutBack(anim.time / anim.duration)
  }

  /**
   * 格子的白色叠加亮度：弹入瞬间闪亮，随后消退
   * 渲染层可用此值在格子上叠加白色半透明层
   */
  getCellFlashAlpha(cellId) {
    const anim = this.cellAnimations.get(cellId)
    if (!anim) return 0
    const t = anim.time / anim.duration
    // 前 30% 升至 0.5，后 70% 降回 0
    if (t < 0.3) return (t / 0.3) * 0.5
    return 0.5 * (1 - (t - 0.3) / 0.7)
  }

  /**
   * 所有活跃波纹
   * 每项包含 { x, y, playerId, radius(0→1), alpha(0→1) }
   */
  getRipples() {
    return this.ripples.map(r => {
      const t = r.time / r.duration
      return {
        x: r.x,
        y: r.y,
        playerId: r.playerId,
        radius: this.easeOutCubic(t),                       // 0→1 归一化半径
        alpha: t < 0.3 ? 1 : 1 - this.easeOutCubic((t - 0.3) / 0.7),
      }
    })
  }

  /**
   * 所有活跃粒子
   * 每项包含 { x, y, radius, alpha, playerId }
   */
  getParticles() {
    return this.particles.map(p => {
      const t = p.time / p.duration
      return {
        x: p.x,
        y: p.y,
        playerId: p.playerId,
        radius: p.radius * (1 - this.easeOutQuart(t)),
        alpha: 1 - t,
      }
    })
  }

  isEdgeAnimating(edgeId) {
    return this.edgeAnimations.has(edgeId)
  }

  isCellAnimating(cellId) {
    return this.cellAnimations.has(cellId)
  }

  isAnyAnimating() {
    return (
      this.edgeAnimations.size > 0 ||
      this.cellAnimations.size > 0 ||
      this.ripples.length > 0 ||
      this.particles.length > 0
    )
  }

  // ─── 内部方法 ───────────────────────────────────────────────

  _spawnParticles(cx, cy, playerId) {
    const count = 12
    for (let i = 0; i < count; i++) {
      // 均匀角度 + 小扰动，视觉上更自然
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const speed = 0.04 + Math.random() * 0.09   // 归一化单位/ms
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 4,             // 像素，渲染层可按棋盘尺寸缩放
        duration: 380 + Math.random() * 220,
        playerId,
        time: 0,
      })
    }
  }

  // ─── 缓动函数 ───────────────────────────────────────────────

  easeOutCubic(t) {
    t = Math.min(1, Math.max(0, t))
    return 1 - Math.pow(1 - t, 3)
  }

  easeOutBack(t) {
    t = Math.min(1, Math.max(0, t))
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }

  easeOutQuart(t) {
    t = Math.min(1, Math.max(0, t))
    return 1 - Math.pow(1 - t, 4)
  }

  easeInOutQuad(t) {
    t = Math.min(1, Math.max(0, t))
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }
}