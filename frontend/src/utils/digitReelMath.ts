// Layer: L0 公理层
// Contract: 展示串分词 + 机械滚轮时序/轨迹；动画只消费最终展示串。
// Invariant: strip[finalIndex] === 目标数字；轨迹终点 y 精确等于 -finalIndex。

export type ReelToken =
  | { kind: 'digit'; digit: number; fromRight: number; totalDigits: number }
  | { kind: 'static'; char: string }

export interface ReelSpinPlan {
  cycles: number
  durationMs: number
  delayMs: number
  finalIndex: number
}

export interface MechanicalSample {
  /** 0–1 时间进度。 */
  offset: number
  /** translateY（em），负值向下滚。 */
  y: number
}

const MIN_DURATION_MS = 2000
const MAX_DURATION_MS = 3000
const BASE_CYCLES = 3
const CYCLE_STEP = 1
const DELAY_STEP_MS = 90
const DURATION_STEP_MS = 220

/** 主旋转结束时刻（之后进入阻尼回摆）。 */
const SPIN_END = 0.72
/** 过冲幅度（数字高度比例，约 8%–15%）。 */
const OVERSHOOT_MIN = 0.08
const OVERSHOOT_MAX = 0.15

/** 拆分展示串：数字位滚动，其余字符静止。 */
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
 * 右侧先锁定：fromRight=0 更短；左侧更多圈、更长、略晚启动。
 * reducedMotion：单格定格，finalIndex=0。
 */
export function planReelSpin(
  digit: number,
  fromRight: number,
  reducedMotion: boolean
): ReelSpinPlan {
  const safeDigit = ((digit % 10) + 10) % 10
  if (reducedMotion) {
    return { cycles: 0, durationMs: 0, delayMs: 0, finalIndex: 0 }
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

/**
 * 条带覆盖到 finalIndex+1：过冲可见相邻数字，且不滚出空区。
 */
export function buildReelStrip(digit: number, cycles: number): number[] {
  const safeDigit = ((digit % 10) + 10) % 10
  if (cycles <= 0) return [safeDigit]
  const finalIndex = cycles * 10 + safeDigit
  const last = finalIndex + 1
  const strip: number[] = []
  for (let i = 0; i <= last; i += 1) strip.push(i % 10)
  return strip
}

/** 位相关过冲：右侧略小、左侧略大，仍落在 8%–15%。 */
export function overshootForDigit(fromRight: number): number {
  const raw = OVERSHOOT_MIN + fromRight * 0.012
  return Math.min(OVERSHOOT_MAX, Math.max(OVERSHOOT_MIN, raw))
}

/**
 * 机械轨迹采样（线性时间轴 + 非线性位移）。
 * Why: 不用单段 ease-out；前段高速惯性，后段阻尼振荡 2–3 次后精确归零。
 */
export function buildMechanicalPath(
  finalIndex: number,
  fromRight = 0
): MechanicalSample[] {
  const target = -finalIndex
  const overshoot = overshootForDigit(fromRight)
  // 继续滚的方向更负：先冲到 target - overshoot
  const spinEndY = target - overshoot
  const samples: MechanicalSample[] = []

  // —— 阶段 1：高速旋转 + 非线性减速，首次越过目标 ——
  const spinSamples = 36
  for (let i = 0; i <= spinSamples; i += 1) {
    const u = i / spinSamples
    const offset = u * SPIN_END
    // 前半段更快：指数接近 1，而非对称 ease
    const p = 1 - Math.pow(1 - u, 2.75)
    // 强制 +0，避免 -0 在测试/序列化中制造噪声
    const y = u === 0 ? 0 : spinEndY * p
    samples.push({ offset, y })
  }

  // —— 阶段 2：阻尼回摆（低弹性高阻尼，约 2–3 次半周期）——
  // error(0)= -overshoot；y = target + error
  const settleSamples = 28
  const decay = 5.2
  const omega = 2.35 * Math.PI // ~1.15 周期 → 约 2–3 次方向反转
  for (let i = 1; i <= settleSamples; i += 1) {
    const u = i / settleSamples
    const offset = SPIN_END + u * (1 - SPIN_END)
    const error = -overshoot * Math.exp(-decay * u) * Math.cos(omega * u)
    samples.push({ offset, y: target + error })
  }

  // 强制精确终点，消除浮点残差
  const last = samples[samples.length - 1]
  if (!last || last.offset < 1 || Math.abs(last.y - target) > 1e-9) {
    samples.push({ offset: 1, y: target })
  } else {
    last.offset = 1
    last.y = target
  }
  return samples
}

/** WAAPI 关键帧：位移已含物理曲线，整体 easing 必须 linear。 */
export function reelKeyframes(finalIndex: number, fromRight = 0): Keyframe[] {
  return buildMechanicalPath(finalIndex, fromRight).map((s) => ({
    transform: `translateY(${s.y}em)`,
    offset: s.offset,
  }))
}

/** 线性插值时间轴；位移曲线由采样点决定。 */
export const REEL_EASING = 'linear'
