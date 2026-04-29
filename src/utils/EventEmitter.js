export default class EventEmitter {
  constructor() {
    this.events = {}
  }

  on(type, callback) {
    if (!this.events[type]) {
      this.events[type] = []
    }

    this.events[type].push(callback)

    return () => {
      this.off(type, callback)
    }
  }

  off(type, callback) {
    const list = this.events[type]

    if (!list) return

    const index = list.indexOf(callback)

    if (index >= 0) {
      list.splice(index, 1)
    }

    if (list.length === 0) {
      delete this.events[type]
    }
  }

  once(type, callback) {
    const wrapper = payload => {
      this.off(type, wrapper)
      callback(payload)
    }

    this.on(type, wrapper)
  }

  emit(type, payload) {
    const list = this.events[type]

    if (!list) return

    const callbacks = list.slice()

    for (const callback of callbacks) {
      callback(payload)
    }
  }

  clear(type) {
    if (type) {
      delete this.events[type]
      return
    }

    this.events = {}
  }
}