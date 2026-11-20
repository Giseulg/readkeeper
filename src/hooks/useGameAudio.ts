import { useCallback, useEffect, useRef } from 'react'

const MELODY = [262, 0, 330, 392, 349, 0, 330, 294, 262, 0, 330, 392, 440, 392, 330, 0]
const EFFECTS = {
  select: [350],
  correct: [523, 784],
  wrong: [260, 196],
  pickup: [660, 880],
  count3: [523],
  count2: [659],
  count1: [784],
  verdict: [523, 659, 784, 1047],
  success: [523, 659, 784, 1047],
} as const
function tone(ctx: AudioContext, frequency: number, when: number, duration: number, volume: number, bell = false) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = bell ? 'sine' : 'triangle'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.001, when)
  gain.gain.linearRampToValueAtTime(volume, when + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, when + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(when)
  oscillator.stop(when + duration)
}

export function useGameAudio(effects: boolean, music: boolean, active: boolean) {
  const context = useRef<AudioContext | null>(null)

  const unlock = () => {
    if ((!effects && !music) || !window.AudioContext) return
    context.current ??= new AudioContext()
    void context.current.resume().catch(() => undefined)
  }

  useEffect(() => {
    const ctx = context.current
    if (!music || !active || !ctx) return
    let step = 0
    const timer = window.setInterval(() => {
      const note = MELODY[step++ % MELODY.length]
      if (note && ctx.state === 'running') tone(ctx, note, ctx.currentTime, 0.13, 0.022)
    }, 240)
    return () => window.clearInterval(timer)
  }, [music, active])

  useEffect(() => () => {
    const ctx = context.current
    context.current = null
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined)
  }, [])

  const play = useCallback((effect: keyof typeof EFFECTS) => {
    const ctx = context.current
    if (!effects || ctx?.state !== 'running') return
    const start = ctx.currentTime
    if (effect === 'count3' || effect === 'count2' || effect === 'count1' || effect === 'verdict') {
      EFFECTS[effect].forEach((note, i) => {
        const when = start + i * 0.085
        tone(ctx, note, when, 0.32, 0.1, true)
        tone(ctx, note * 2, when, 0.24, 0.025, true)
      })
      return
    }
    EFFECTS[effect].forEach((note, i) => tone(ctx, note, start + i * 0.07, 0.095, 0.09))
  }, [effects])

  return { unlock, play }
}
