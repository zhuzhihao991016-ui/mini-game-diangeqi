export default class SceneManager {
  constructor() {
    this.currentScene = null
  }

  setScene(scene) {
    if (this.currentScene) {
      this.currentScene.onExit()
    }

    this.currentScene = scene
    this.currentScene.onEnter()
  }

  update(deltaTime) {
    if (this.currentScene) {
      this.currentScene.update(deltaTime)
    }
  }

  render() {
    if (this.currentScene) {
      this.currentScene.render()
    }
  }
}