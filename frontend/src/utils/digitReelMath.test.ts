import { describe, expect, it } from 'vitest'
import {
  buildReelStrip,
  countDigits,
  planReelSpin,
  reelKeyframes,
  tokenizeDisplay,
} from './digitReelMath'

describe('tokenizeDisplay', () => {
  it('keeps non-digits static and ranks digits from the right', () => {
    const tokens = tokenizeDisplay('$12.3K')
    expect(tokens).toEqual([
      { kind: 'static', char: '$' },
      { kind: 'digit', digit: 1, fromRight: 2, totalDigits: 3 },
      { kind: 'digit', digit: 2, fromRight: 1, totalDigits: 3 },
      { kind: 'static', char: '.' },
      { kind: 'digit', digit: 3, fromRight: 0, totalDigits: 3 },
      { kind: 'static', char: 'K' },
    ])
  })

  it('supports percent, slash and thousands separators', () => {
    const tokens = tokenizeDisplay('1,234/5,678%')
    const digits = tokens.filter((t) => t.kind === 'digit')
    expect(countDigits('1,234/5,678%')).toBe(8)
    expect(digits).toHaveLength(8)
    expect(digits[0]).toMatchObject({ digit: 1, fromRight: 7 })
    expect(digits[digits.length - 1]).toMatchObject({ digit: 8, fromRight: 0 })
    expect(tokens.some((t) => t.kind === 'static' && t.char === '%')).toBe(true)
  })
})

describe('planReelSpin', () => {
  it('makes rightmost digits stop earlier than left digits', () => {
    const right = planReelSpin(8, 0, false)
    const left = planReelSpin(1, 4, false)
    expect(right.delayMs).toBeLessThan(left.delayMs)
    expect(right.durationMs).toBeLessThan(left.durationMs)
    expect(right.cycles).toBeLessThan(left.cycles)
    expect(right.finalIndex % 10).toBe(8)
    expect(left.finalIndex % 10).toBe(1)
  })

  it('skips motion when reducedMotion is set', () => {
    expect(planReelSpin(7, 3, true)).toEqual({
      cycles: 0,
      durationMs: 0,
      delayMs: 0,
      finalIndex: 0,
    })
  })

  it('finalIndex always lands on a real strip cell with the target digit', () => {
    for (const fromRight of [0, 1, 4]) {
      for (const digit of [0, 4, 9]) {
        const plan = planReelSpin(digit, fromRight, false)
        const strip = buildReelStrip(digit, plan.cycles)
        expect(strip.length).toBe(plan.finalIndex + 1)
        expect(strip[plan.finalIndex]).toBe(digit)
      }
    }
  })
})

describe('buildReelStrip', () => {
  it('ends on the target digit after full cycles', () => {
    const strip = buildReelStrip(4, 2)
    // finalIndex = 2*10+4 = 24 → length 25
    expect(strip).toHaveLength(25)
    expect(strip[24]).toBe(4)
    expect(strip.slice(0, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})

describe('reelKeyframes', () => {
  it('ends exactly on the final index with a slight overshoot before settle', () => {
    const frames = reelKeyframes(24)
    expect(frames[0].transform).toBe('translateY(0em)')
    expect(String(frames[1].transform)).toContain('translateY(-24.35em)')
    expect(frames[2].transform).toBe('translateY(-24em)')
  })
})
