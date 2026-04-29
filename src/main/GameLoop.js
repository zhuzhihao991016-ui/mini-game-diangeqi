export default class GameLoop {
  constructor({ update, render }) {
    this.update = update
    this.render = render
    this.lastTime = 0
    this.running = false
  }

  start() {
    this.running = true

    const loop = (time) => {
      if (!this.running) return

      const deltaTime = time - this.lastTime
      this.lastTime = time

      this.update(deltaTime)
      this.render()

      requestAnimationFrame(loop)
    }

    requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
  }
}