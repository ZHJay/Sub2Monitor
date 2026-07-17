import { describe, expect, it } from 'vitest'
import {
  buildMechanicalPath,
  buildReelStrip,
  countDigits,
  overshootForDigit,
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
  })
})

describe('planReelSpin', () => {
  it('makes rightmost digits stop earlier than left digits', () => {
    const right = planReelSpin(8, 0, false)
    const left = planReelSpin(1, 4, false)
    expect(right.delayMs).toBeLessThan(left.delayMs)
    expect(right.durationMs).toBeLessThan(left.durationMs)
    expect(right.cycles).toBeLessThan(left.cycles)
    expect(right.durationMs).toBeGreaterThanOrEqual(2000)
    expect(left.durationMs).toBeLessThanOrEqual(3000)
  })

  it('skips motion when reducedMotion is set', () => {
    expect(planReelSpin(7, 3, true)).toEqual({
      cycles: 0,
      durationMs: 0,
      delayMs: 0,
      finalIndex: 0,
    })
  })

  it('finalIndex lands on target digit; strip has headroom for overshoot', () => {
    for (const fromRight of [0, 1, 4]) {
      for (const digit of [0, 4, 9]) {
        const plan = planReelSpin(digit, fromRight, false)
        const strip = buildReelStrip(digit, plan.cycles)
        expect(strip[plan.finalIndex]).toBe(digit)
        expect(strip.length).toBe(plan.finalIndex + 2)
      }
    }
  })
})

describe('buildMechanicalPath', () => {
  it('starts at 0, overshoots past target, then settles exactly', () => {
    const finalIndex = 24
    const target = -finalIndex
    const path = buildMechanicalPath(finalIndex, 2)
    const overshoot = overshootForDigit(2)

    expect(path[0]).toEqual({ offset: 0, y: 0 })
    expect(path[path.length - 1]).toEqual({ offset: 1, y: target })

    const minY = Math.min(...path.map((p) => p.y))
    // 越过目标：比 target 更负，幅度约 8%–15% em
    expect(minY).toBeLessThan(target)
    expect(minY).toBeGreaterThanOrEqual(target - overshoot - 1e-9)
    expect(minY).toBeLessThanOrEqual(target - 0.08 + 1e-9)
  })

  it('reverses direction multiple times during settle (damped swing)', () => {
    const path = buildMechanicalPath(30, 1)
    const target = -30
    // 取 settle 段（offset > 0.72）看误差符号变化
    const settle = path.filter((p) => p.offset > 0.72)
    const signs: number[] = []
    for (const p of settle) {
      const err = p.y - target
      if (Math.abs(err) < 1e-6) continue
      const s = Math.sign(err)
      if (signs.length === 0 || signs[signs.length - 1] !== s) signs.push(s)
    }
    // 至少 2 次方向反转（3 个符号段）
    expect(signs.length).toBeGreaterThanOrEqual(3)
  })
})

describe('reelKeyframes', () => {
  it('exports linear-time keyframes ending on the exact digit slot', () => {
    const frames = reelKeyframes(24, 0)
    expect(frames[0].transform).toBe('translateY(0em)')
    expect(frames[frames.length - 1].transform).toBe('translateY(-24em)')
    expect(frames[frames.length - 1].offset).toBe(1)
    expect(frames.length).toBeGreaterThan(40)
  })
})
