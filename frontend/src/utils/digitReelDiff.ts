// Layer: L0 公理层
// Contract: 右对齐比较新旧展示串数字位，产出每位 motion（full/partial/idle）。
// Why: 从右侧对齐，避免字符串下标错位导致整表误判为“全变”。

import {
  extractDigits,
  signedDigitSteps,
  tokenizeDisplay,
  type ReelMotionMode,
} from './digitReelMath'

export type MagnitudeDir = 'up' | 'down' | 'flat'

export interface DigitReelSlot {
  kind: 'digit'
  /** 稳定 key：按 fromRight，个位始终 d:0。 */
  key: string
  digit: number
  fromDigit: number
  fromRight: number
  mode: ReelMotionMode
  /** partial 有符号步数；full/idle 为 0。 */
  steps: number
  playId: number
}

export interface StaticReelSlot {
  kind: 'static'
  key: string
  char: string
}

export type ReelSlot = DigitReelSlot | StaticReelSlot

export interface DiffReelInput {
  previous: string
  next: string
  /** 组件生命周期内是否已完成首次完整揭晓。 */
  hasRevealed: boolean
  /** 显式强制完整重播（卸载重挂或外部 replay）。 */
  forceFull: boolean
  reducedMotion: boolean
  /** 各 digit key 当前 playId，未变位保持原值。 */
  playIds: Map<string, number>
}

export interface DiffReelResult {
  slots: ReelSlot[]
  playIds: Map<string, number>
  hasRevealed: boolean
}

/** 左起数字数组右对齐后逐位比较整值升降。 */
export function compareDigitArrays(prev: number[], next: number[]): MagnitudeDir {
  const len = Math.max(prev.length, next.length)
  if (len === 0) return 'flat'
  const p = leftPad(prev, len)
  const n = leftPad(next, len)
  for (let i = 0; i < len; i += 1) {
    if (n[i] > p[i]) return 'up'
    if (n[i] < p[i]) return 'down'
  }
  return 'flat'
}

function leftPad(digits: number[], len: number): number[] {
  if (digits.length >= len) return digits.slice(digits.length - len)
  return [...Array(len - digits.length).fill(0), ...digits]
}

function digitMapFromRight(digits: number[]): Map<number, number> {
  const map = new Map<number, number>()
  for (let i = 0; i < digits.length; i += 1) {
    map.set(digits.length - 1 - i, digits[i])
  }
  return map
}

/**
 * 基于 next 的显示结构生成 slots；数字位按 fromRight 与 previous 对齐。
 * 首次 / forceFull → 全员 full；其后仅变化位 partial；未变 idle。
 */
export function diffReelSlots(input: DiffReelInput): DiffReelResult {
  const { previous, next, forceFull, reducedMotion } = input
  let { hasRevealed } = input
  const playIds = new Map(input.playIds)
  const prevDigits = extractDigits(previous)
  const nextDigits = extractDigits(next)
  const prevMap = digitMapFromRight(prevDigits)
  const dir = compareDigitArrays(prevDigits, nextDigits)
  const tokens = tokenizeDisplay(next)
  const doFull = forceFull || !hasRevealed
  const slots: ReelSlot[] = []

  tokens.forEach((token, index) => {
    if (token.kind === 'static') {
      slots.push({ kind: 'static', key: `s:${index}:${token.char}`, char: token.char })
      return
    }

    const key = `d:${token.fromRight}`
    const prevDigit = prevMap.has(token.fromRight) ? prevMap.get(token.fromRight)! : null
    let mode: ReelMotionMode = 'idle'
    let fromDigit = token.digit
    let steps = 0

    if (reducedMotion) {
      mode = 'idle'
    } else if (doFull) {
      mode = 'full'
      fromDigit = token.digit
      bump(playIds, key)
    } else if (prevDigit == null) {
      // 新增位：短距滚入（上一格 → 目标），不整圈老虎机
      fromDigit = (token.digit + 9) % 10
      steps = signedDigitSteps(fromDigit, token.digit, dir === 'flat' ? 'up' : dir)
      mode = steps === 0 ? 'idle' : 'partial'
      if (mode === 'partial') bump(playIds, key)
    } else if (prevDigit === token.digit) {
      mode = 'idle'
      fromDigit = token.digit
    } else {
      fromDigit = prevDigit
      steps = signedDigitSteps(prevDigit, token.digit, dir)
      mode = 'partial'
      bump(playIds, key)
    }

    slots.push({
      kind: 'digit',
      key,
      digit: token.digit,
      fromDigit,
      fromRight: token.fromRight,
      mode,
      steps,
      playId: playIds.get(key) ?? 0,
    })
  })

  return { slots, playIds, hasRevealed: true }
}

function bump(playIds: Map<string, number>, key: string) {
  playIds.set(key, (playIds.get(key) ?? 0) + 1)
}
