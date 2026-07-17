// Layer: L0 公理层
// Contract: 展示串分词、完整/局部滚轮时序与条带；动画只消费展示串。
// Invariant: full strip[finalIndex]===digit；partial 终点 index===|steps|。

export type ReelToken =
  | { kind: 'digit'; digit: number; fromRight: number; totalDigits: number }
  | { kind: 'static'; char: string }

export type ReelMotionMode = 'full' | 'partial' | 'idle'

export interface ReelSpinPlan {
  cycles: number
  durationMs: number
  delayMs: number
  finalIndex: number
}

export interface MechanicalSample {
  offset: number
  y: number
}

const FULL_MIN_MS = 2000
const FULL_MAX_MS = 3000
const BASE_CYCLES = 3
const SPIN_END = 0.72
const FULL_OVERSHOOT_MIN = 0.08
const FULL_OVERSHOOT_MAX = 0.15

export function tokenizeDisplay(value: string): ReelToken[] {
  const text = value ?? ''
  const digitCount = countDigits(text)
  let seenFromLeft = 0
  const tokens: ReelToken[] = []
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      const fromRight = digitCount - 1 - seenFromLeft
      tokens.push({
        kind: 'digit',
        digit: Number(char),
        fromRight,
        totalDigits: digitCount,
      })
      seenFromLeft += 1
    } else {
      tokens.push({ kind: 'static', char })
    }
  }
  return tokens
}

export function countDigits(value: string): number {
  let n = 0
  for (const char of value) if (char >= '0' && char <= '9') n += 1
  return n
}

export function extractDigits(value: string): number[] {
  const out: number[] = []
  for (const char of value) if (char >= '0' && char <= '9') out.push(Number(char))
  return out
}

export function planReelSpin(
  digit: number,
  fromRight: number,
  reducedMotion: boolean
): ReelSpinPlan {
  const safeDigit = ((digit % 10) + 10) % 10
  if (reducedMotion) return { cycles: 0, durationMs: 0, delayMs: 0, finalIndex: 0 }
  const cycles = BASE_CYCLES + fromRight
  const durationMs = Math.min(FULL_MAX_MS, FULL_MIN_MS + fromRight * 220)
  const delayMs = fromRight * 90
  return { cycles, durationMs, delayMs, finalIndex: cycles * 10 + safeDigit }
}

export function buildReelStrip(digit: number, cycles: number): number[] {
  const safeDigit = ((digit % 10) + 10) % 10
  if (cycles <= 0) return [safeDigit]
  const finalIndex = cycles * 10 + safeDigit
  const strip: number[] = []
  for (let i = 0; i <= finalIndex + 1; i += 1) strip.push(i % 10)
  return strip
}

export function overshootForDigit(fromRight: number): number {
  return Math.min(FULL_OVERSHOOT_MAX, Math.max(FULL_OVERSHOOT_MIN, FULL_OVERSHOOT_MIN + fromRight * 0.012))
}

/** 采样完整机械轨迹：高速 → 过冲 → 2–3 次阻尼回摆 → 精确归位。 */
export function buildMechanicalPath(finalIndex: number, fromRight = 0): MechanicalSample[] {
  const target = -finalIndex
  const overshoot = overshootForDigit(fromRight)
  const spinEndY = target - overshoot
  const samples: MechanicalSample[] = []
  for (let i = 0; i <= 36; i += 1) {
    const u = i / 36
    const p = 1 - Math.pow(1 - u, 2.75)
    samples.push({ offset: u * SPIN_END, y: u === 0 ? 0 : spinEndY * p })
  }
  for (let i = 1; i <= 28; i += 1) {
    const u = i / 28
    const error = -overshoot * Math.exp(-5.2 * u) * Math.cos(2.35 * Math.PI * u)
    samples.push({ offset: SPIN_END + u * (1 - SPIN_END), y: target + error })
  }
  sealPath(samples, target)
  return samples
}

/**
 * 局部步进：+ 向上（数值增大方向），- 向下。
 * overallDir 由整串数字数组比较得出，保证 9→0 进位时仍向上滚一格。
 */
export function signedDigitSteps(
  from: number,
  to: number,
  overallDir: 'up' | 'down' | 'flat'
): number {
  if (from === to) return 0
  const forward = (to - from + 10) % 10
  const backward = (from - to + 10) % 10
  if (overallDir === 'up') return forward || 10
  if (overallDir === 'down') return -(backward || 10)
  return forward <= backward ? forward || 10 : -(backward || 10)
}

export function planPartialSpin(steps: number): { durationMs: number; finalIndex: number; overshoot: number } {
  const n = Math.abs(steps)
  if (n === 0) return { durationMs: 0, finalIndex: 0, overshoot: 0 }
  const durationMs = Math.min(700, Math.max(300, 300 + n * 70))
  const overshoot = Math.min(0.08, Math.max(0.03, 0.03 + n * 0.007))
  return { durationMs, finalIndex: n, overshoot }
}

/** 从 from 起沿 steps 方向铺条带，多 1 格供过冲。 */
export function buildPartialStrip(fromDigit: number, steps: number): number[] {
  const n = Math.abs(steps)
  const dir = steps >= 0 ? 1 : -1
  const from = ((fromDigit % 10) + 10) % 10
  if (n === 0) return [from]
  const strip: number[] = []
  for (let i = 0; i <= n + 1; i += 1) {
    strip.push(((from + dir * i) % 10 + 10) % 10)
  }
  return strip
}

/** 短距局部轨迹：小过冲 + 1–2 次回摆，300–700ms 量级。 */
export function buildPartialPath(steps: number): MechanicalSample[] {
  const { finalIndex, overshoot } = planPartialSpin(steps)
  const target = -finalIndex
  if (finalIndex === 0) return [{ offset: 0, y: 0 }, { offset: 1, y: 0 }]
  const spinEnd = 0.78
  const spinEndY = target - overshoot
  const samples: MechanicalSample[] = []
  for (let i = 0; i <= 20; i += 1) {
    const u = i / 20
    const p = 1 - Math.pow(1 - u, 2.2)
    samples.push({ offset: u * spinEnd, y: u === 0 ? 0 : spinEndY * p })
  }
  // 高阻尼、约 1 个周期 → 1–2 次反向
  for (let i = 1; i <= 16; i += 1) {
    const u = i / 16
    const error = -overshoot * Math.exp(-6.5 * u) * Math.cos(1.6 * Math.PI * u)
    samples.push({ offset: spinEnd + u * (1 - spinEnd), y: target + error })
  }
  sealPath(samples, target)
  return samples
}

export function reelKeyframes(finalIndex: number, fromRight = 0): Keyframe[] {
  return toKeyframes(buildMechanicalPath(finalIndex, fromRight))
}

export function partialKeyframes(steps: number): Keyframe[] {
  return toKeyframes(buildPartialPath(steps))
}

export const REEL_EASING = 'linear'

function toKeyframes(samples: MechanicalSample[]): Keyframe[] {
  return samples.map((s) => ({ transform: `translateY(${s.y}em)`, offset: s.offset }))
}

function sealPath(samples: MechanicalSample[], target: number) {
  const last = samples[samples.length - 1]
  if (!last || last.offset < 1 || Math.abs(last.y - target) > 1e-9) {
    samples.push({ offset: 1, y: target })
  } else {
    last.offset = 1
    last.y = target
  }
}
