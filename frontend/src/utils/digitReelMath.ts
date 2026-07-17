// Layer: L0 公理层
// Contract: 把展示字符串拆成 digit/static token，并为每位算出独立滚轮时序。
// Invariant: 动画只消费最终展示串，不改动真实数值。

export type ReelToken =
  | { kind: 'digit'; digit: number; fromRight: number; totalDigits: number }
  | { kind: 'static'; char: string }

export interface ReelSpinPlan {
  /** 完整 0–9 圈数（右侧更少、左侧更多）。 */
  cycles: number
  /** 动画时长 ms。 */
  durationMs: number
  /** 启动延迟 ms（左侧稍晚）。 */
  delayMs: number
  /** 条带最终停靠的单元格下标（0-based）。 */
  finalIndex: number
}

const MIN_DURATION_MS = 1600
const MAX_DURATION_MS = 2800
const BASE_CYCLES = 3
const CYCLE_STEP = 1
const DELAY_STEP_MS = 70
const DURATION_STEP_MS = 200

/** 拆分展示串：数字位滚动，其余字符（$ . , % / K M 等）静止。 */
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
  for (const char of value) {
    if (char >= '0' && char <= '9') n += 1
  }
  return n
}

/**
 * 右侧位先锁定：fromRight=0 最短；左侧位更多圈、更长时长、略晚启动。
 * reducedMotion 时直接定格，无滚动。
 */
export function planReelSpin(
  digit: number,
  fromRight: number,
  reducedMotion: boolean
): ReelSpinPlan {
  const safeDigit = ((digit % 10) + 10) % 10
  if (reducedMotion) {
    return { cycles: 0, durationMs: 0, delayMs: 0, finalIndex: safeDigit }
  }

  const cycles = BASE_CYCLES + fromRight * CYCLE_STEP
  const durationMs = Math.min(
    MAX_DURATION_MS,
    MIN_DURATION_MS + fromRight * DURATION_STEP_MS
  )
  const delayMs = fromRight * DELAY_STEP_MS
  const finalIndex = cycles * 10 + safeDigit
  return { cycles, durationMs, delayMs, finalIndex }
}

/** 生成滚轮条带：0–9 重复 cycles 次，再接到目标数字。 */
export function buildReelStrip(digit: number, cycles: number): number[] {
  const safeDigit = ((digit % 10) + 10) % 10
  if (cycles <= 0) return [safeDigit]
  const strip: number[] = []
  for (let c = 0; c < cycles; c += 1) {
    for (let d = 0; d < 10; d += 1) strip.push(d)
  }
  strip.push(safeDigit)
  return strip
}

/** 轻微过冲后回弹的关键帧进度（视觉惯性）。 */
export function reelKeyframes(finalIndex: number): Keyframe[] {
  const end = -finalIndex
  const overshoot = end - 0.35
  return [
    { transform: 'translateY(0em)', offset: 0 },
    { transform: `translateY(${overshoot}em)`, offset: 0.9 },
    { transform: `translateY(${end}em)`, offset: 1 },
  ]
}

/** 前快后慢的 ease-out（带极轻回弹感）。 */
export const REEL_EASING = 'cubic-bezier(0.12, 0.82, 0.18, 1)'
