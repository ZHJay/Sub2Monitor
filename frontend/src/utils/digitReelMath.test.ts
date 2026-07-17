import { describe, expect, it } from 'vitest'
import { compareDigitArrays, diffReelSlots } from './digitReelDiff'
import {
  buildPartialPath,
  buildPartialStrip,
  buildReelStrip,
  planPartialSpin,
  planReelSpin,
  reelKeyframes,
  signedDigitSteps,
  tokenizeDisplay,
} from './digitReelMath'

describe('tokenizeDisplay', () => {
  it('ranks digits from the right and keeps symbols static', () => {
    expect(tokenizeDisplay('$12.3K')).toEqual([
      { kind: 'static', char: '$' },
      { kind: 'digit', digit: 1, fromRight: 2, totalDigits: 3 },
      { kind: 'digit', digit: 2, fromRight: 1, totalDigits: 3 },
      { kind: 'static', char: '.' },
      { kind: 'digit', digit: 3, fromRight: 0, totalDigits: 3 },
      { kind: 'static', char: 'K' },
    ])
  })
})

describe('signedDigitSteps', () => {
  it('rolls up on overall increase including 9→0', () => {
    expect(signedDigitSteps(4, 7, 'up')).toBe(3)
    expect(signedDigitSteps(9, 0, 'up')).toBe(1)
    expect(signedDigitSteps(7, 4, 'down')).toBe(-3)
  })
})

describe('compareDigitArrays', () => {
  it('right-aligns and detects magnitude direction', () => {
    expect(compareDigitArrays([1, 2, 8, 4], [1, 2, 8, 7])).toBe('up')
    expect(compareDigitArrays([1, 9, 9, 9], [2, 0, 0, 0])).toBe('up')
    expect(compareDigitArrays([2, 0, 0], [9, 9])).toBe('down')
  })
})

describe('diffReelSlots', () => {
  it('first reveal uses full motion on every digit', () => {
    const r = diffReelSlots({
      previous: '',
      next: '1284',
      hasRevealed: false,
      forceFull: false,
      reducedMotion: false,
      playIds: new Map(),
    })
    const digits = r.slots.filter((s) => s.kind === 'digit')
    expect(digits.every((d) => d.kind === 'digit' && d.mode === 'full')).toBe(true)
    expect(r.hasRevealed).toBe(true)
  })

  it('only animates changed digits on refresh (1284→1287)', () => {
    const first = diffReelSlots({
      previous: '',
      next: '1284',
      hasRevealed: false,
      forceFull: false,
      reducedMotion: false,
      playIds: new Map(),
    })
    const second = diffReelSlots({
      previous: '1284',
      next: '1287',
      hasRevealed: true,
      forceFull: false,
      reducedMotion: false,
      playIds: first.playIds,
    })
    const byRight = new Map(
      second.slots
        .filter((s): s is Extract<typeof s, { kind: 'digit' }> => s.kind === 'digit')
        .map((d) => [d.fromRight, d] as const)
    )
    expect(byRight.get(0)?.mode).toBe('partial')
    expect(byRight.get(0)?.fromDigit).toBe(4)
    expect(byRight.get(0)?.digit).toBe(7)
    expect(byRight.get(0)?.steps).toBe(3)
    expect(byRight.get(1)?.mode).toBe('idle')
    expect(byRight.get(2)?.mode).toBe('idle')
    expect(byRight.get(3)?.mode).toBe('idle')
  })

  it('keeps fractional-only updates partial on the last digit', () => {
    const r = diffReelSlots({
      previous: '125.6',
      next: '125.8',
      hasRevealed: true,
      forceFull: false,
      reducedMotion: false,
      playIds: new Map([['d:0', 1], ['d:1', 1], ['d:2', 1], ['d:3', 1]]),
    })
    expect(r.slots.some((s) => s.kind === 'static' && s.char === '.')).toBe(true)
    const changed = r.slots.filter(
      (s): s is Extract<typeof s, { kind: 'digit' }> => s.kind === 'digit' && s.mode !== 'idle'
    )
    expect(changed).toHaveLength(1)
    expect(changed[0].fromRight).toBe(0)
    expect(changed[0].mode).toBe('partial')
  })
})

describe('partial path/strip', () => {
  it('plans 300–700ms and lands on |steps|', () => {
    const plan = planPartialSpin(3)
    expect(plan.durationMs).toBeGreaterThanOrEqual(300)
    expect(plan.durationMs).toBeLessThanOrEqual(700)
    expect(plan.finalIndex).toBe(3)
    expect(buildPartialStrip(4, 3)[0]).toBe(4)
    expect(buildPartialStrip(4, 3)[3]).toBe(7)
    const path = buildPartialPath(3)
    expect(path[0].y).toBe(0)
    expect(path[path.length - 1]).toEqual({ offset: 1, y: -3 })
  })
})

describe('full reel invariants', () => {
  it('strip covers finalIndex with overshoot room', () => {
    const plan = planReelSpin(4, 1, false)
    const strip = buildReelStrip(4, plan.cycles)
    expect(strip[plan.finalIndex]).toBe(4)
    expect(strip.length).toBe(plan.finalIndex + 2)
    const frames = reelKeyframes(plan.finalIndex, 1)
    expect(frames[frames.length - 1].transform).toBe(`translateY(${-plan.finalIndex}em)`)
  })
})
