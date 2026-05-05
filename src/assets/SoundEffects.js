import { getGameSettings } from '../state/SettingsState'

const SAMPLE_RATE = 22050

const SOUND_DEFS = {
  button: [
    { frequency: 520, duration: 0.028, volume: 0.13 },
    { frequency: 700, duration: 0.032, volume: 0.12 }
  ],
  claim: [
    { frequency: 620, duration: 0.055, volume: 0.18 },
    { frequency: 820, duration: 0.045, volume: 0.12 }
  ],
  close: [
    { frequency: 920, duration: 0.035, volume: 0.18 },
    { frequency: 1240, duration: 0.04, volume: 0.15 }
  ],
  win: [
    { frequency: 523, duration: 0.08, volume: 0.2 },
    { frequency: 659, duration: 0.08, volume: 0.2 },
    { frequency: 784, duration: 0.09, volume: 0.2 },
    { frequency: 1047, duration: 0.16, volume: 0.18 }
  ],
  lose: [
    { frequency: 392, duration: 0.1, volume: 0.17 },
    { frequency: 330, duration: 0.1, volume: 0.16 },
    { frequency: 262, duration: 0.18, volume: 0.14 }
  ]
}

class SoundEffects {
  constructor() {
    this.initialized = false
    this.enabled = true
    this.contexts = {}
    this.paths = {}
    this.lastPlayedAt = {}
  }

  play(name) {
    if (!this.enabled) return
    if (!SOUND_DEFS[name]) return

    const settings = getGameSettings()
    if (!settings.soundEnabled || settings.volume <= 0) return

    this.ensureInitialized()

    const audio = this.contexts[name]
    if (!audio) return

    const now = Date.now()
    if (now - (this.lastPlayedAt[name] || 0) < 35) return
    this.lastPlayedAt[name] = now

    try {
      audio.stop()
      audio.seek(0)
      audio.volume = settings.volume
      audio.play()
    } catch (err) {
      console.warn('play sound effect failed:', name, err)
    }
  }

  destroy() {
    for (const audio of Object.values(this.contexts)) {
      if (audio && typeof audio.destroy === 'function') {
        audio.destroy()
      }
    }

    this.contexts = {}
    this.initialized = false
  }

  ensureInitialized() {
    if (this.initialized) return
    this.initialized = true

    if (
      typeof wx === 'undefined' ||
      !wx ||
      !wx.env ||
      !wx.env.USER_DATA_PATH ||
      typeof wx.createInnerAudioContext !== 'function' ||
      typeof wx.getFileSystemManager !== 'function'
    ) {
      this.enabled = false
      return
    }

    const fs = wx.getFileSystemManager()

    for (const [name, notes] of Object.entries(SOUND_DEFS)) {
      try {
        const path = `${wx.env.USER_DATA_PATH}/dots_boxes_${name}.wav`
        fs.writeFileSync(path, createWavBuffer(notes))

        const audio = wx.createInnerAudioContext()
        audio.src = path
        audio.volume = 1
        audio.obeyMuteSwitch = false

        this.paths[name] = path
        this.contexts[name] = audio
      } catch (err) {
        console.warn('init sound effect failed:', name, err)
      }
    }
  }
}

function createWavBuffer(notes) {
  const gapSamples = Math.floor(SAMPLE_RATE * 0.012)
  const noteSamples = notes.map(note => Math.max(1, Math.floor(SAMPLE_RATE * note.duration)))
  const totalSamples = noteSamples.reduce((sum, count) => sum + count + gapSamples, 0)
  const dataSize = totalSamples * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let sampleIndex = 0
  let byteOffset = 44

  notes.forEach((note, index) => {
    const count = noteSamples[index]

    for (let i = 0; i < count; i++) {
      const envelope = getEnvelope(i, count)
      const t = sampleIndex / SAMPLE_RATE
      const wave = Math.sin(Math.PI * 2 * note.frequency * t)
      const sample = Math.max(-1, Math.min(1, wave * envelope * note.volume))

      view.setInt16(byteOffset, sample * 32767, true)
      byteOffset += 2
      sampleIndex += 1
    }

    for (let i = 0; i < gapSamples; i++) {
      view.setInt16(byteOffset, 0, true)
      byteOffset += 2
      sampleIndex += 1
    }
  })

  return buffer
}

function getEnvelope(index, total) {
  const attack = Math.max(1, Math.floor(total * 0.12))
  const release = Math.max(1, Math.floor(total * 0.35))

  if (index < attack) {
    return index / attack
  }

  const remaining = total - index
  if (remaining < release) {
    return remaining / release
  }

  return 1
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

export default new SoundEffects()
