import type { ChartDataset } from 'chart.js'

// Layer: L1 积木层
// Boundary: pure chart series shaping; no DOM / Chart instance.

export interface ModelSeries {
  model: string
  values: number[]
}

export type StackedLineDataset = ChartDataset<'line', number[]> & { rawValues: number[] }

// Brighter solid bands (bottom purple → top light blue). Avoid near-black purples on dark UI.
const STACK_COLORS_BOTTOM_TO_TOP = [
  { fill: 'rgb(139, 92, 246)', stroke: 'rgb(167, 139, 250)' },
  { fill: 'rgb(124, 58, 237)', stroke: 'rgb(167, 139, 250)' },
  { fill: 'rgb(99, 102, 241)', stroke: 'rgb(165, 180, 252)' },
  { fill: 'rgb(79, 70, 229)', stroke: 'rgb(129, 140, 248)' },
  { fill: 'rgb(59, 130, 246)', stroke: 'rgb(147, 197, 253)' },
  { fill: 'rgb(14, 165, 233)', stroke: 'rgb(125, 211, 252)' },
  { fill: 'rgb(6, 182, 212)', stroke: 'rgb(103, 232, 249)' },
  { fill: 'rgb(56, 189, 248)', stroke: 'rgb(186, 230, 253)' },
  { fill: 'rgb(125, 211, 252)', stroke: 'rgb(224, 242, 254)' },
]

export const STACK_ID = 'models'
export const SLIDE_MS = 480
/** Metric / time-range morph duration (stretch-shrink + color). */
export const MORPH_MS = 560
export const MORPH_EASING = 'easeInOutCubic'

function colorForStackIndex(index: number, count: number): { fill: string; stroke: string } {
  const palette = STACK_COLORS_BOTTOM_TO_TOP
  if (count <= 1) return palette[palette.length - 1]
  const t = index / (count - 1)
  return palette[Math.round(t * (palette.length - 1))]
}

export function formatMetricValue(v: number, metric: string): string {
  if (metric === 'cost') return `$${v.toFixed(2)}`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return v.toFixed(0)
}

/**
 * Compact Y-axis tick labels with similar width for cost vs tokens.
 * Why: long `$1234567` vs `1M` resizes the plot and makes the time axis jump.
 */
export function formatYAxisTick(n: number, metric: string): string {
  if (!Number.isFinite(n)) return ''
  const abs = Math.abs(n)
  if (metric === 'cost') {
    if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
    if (abs >= 100) return `$${n.toFixed(0)}`
    if (abs >= 10) return `$${n.toFixed(1)}`
    return `$${n.toFixed(2)}`
  }
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

/** Fixed Y-axis slot (px) so tick-string length never resizes the time axis. */
export const Y_AXIS_WIDTH_PX = 56

export function formatAxisLabel(ts: string, range: string): string {
  const date = new Date(ts)
  if (range === '1h' || range === '6h' || range === '24h') {
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

export function dataKey(timestamps: string[], series: ModelSeries[], metric: string, range: string): string {
  const models = series.map((s) => s.model).join('|')
  const head = timestamps[0] || ''
  const tail = timestamps[timestamps.length - 1] || ''
  const n = timestamps.length
  const sum = series.reduce((acc, s) => acc + (s.values[0] || 0) + (s.values[s.values.length - 1] || 0), 0)
  return `${metric}|${range}|${n}|${head}|${tail}|${models}|${sum}`
}

export function modelsKey(series: ModelSeries[]): string {
  return series.map((s) => s.model).join('\0')
}

/** Deep-copy raw (non-cumulative) series for the next morph bridge. */
export function cloneSeries(series: ModelSeries[]): ModelSeries[] {
  return series.map((s) => ({ model: s.model, values: s.values.slice() }))
}

/**
 * Resample a polyline onto `targetLen` points via linear interpolation.
 * Why: Chart.js only morphs y when index counts match; length-changing
 * range switches need a same-length intermediate frame before animating.
 */
export function resampleNumbers(values: number[], targetLen: number): number[] {
  if (targetLen <= 0) return []
  if (values.length === 0) return new Array(targetLen).fill(0)
  if (values.length === targetLen) return values.slice()
  if (targetLen === 1) return [values[values.length - 1] ?? 0]

  const out = new Array<number>(targetLen)
  const last = values.length - 1
  for (let i = 0; i < targetLen; i++) {
    const t = (i / (targetLen - 1)) * last
    const lo = Math.floor(t)
    const hi = Math.min(last, lo + 1)
    const frac = t - lo
    const a = values[lo] ?? 0
    const b = values[hi] ?? 0
    out[i] = a + (b - a) * frac
  }
  return out
}

/**
 * Align previous raw series onto the next model order + point count.
 * Why: USD/token re-ranks Top models; range switches change membership.
 * Missing models start at 0 so morph still has a continuous stack.
 */
export function bridgeSeriesForMorph(
  previous: ModelSeries[],
  next: ModelSeries[],
  targetLen: number,
): ModelSeries[] {
  const prevByModel = new Map(previous.map((s) => [s.model, s.values]))
  return next.map((s) => ({
    model: s.model,
    values: resampleNumbers(prevByModel.get(s.model) ?? [], targetLen),
  }))
}

/** How many leading timestamps dropped from prev when window slid to next. -1 = not a pure slide. */
export function detectTimestampShift(prev: string[], next: string[]): number {
  if (!prev.length || !next.length) return -1
  if (prev[0] === next[0] && prev.length === next.length) return 0
  const k = prev.indexOf(next[0])
  if (k <= 0) return -1
  const overlap = prev.length - k
  if (overlap <= 0 || next.length < overlap) return -1
  for (let i = 0; i < overlap; i++) {
    if (prev[k + i] !== next[i]) return -1
  }
  // Sliding window usually keeps similar length; allow small length drift.
  if (Math.abs(next.length - prev.length) > Math.max(2, Math.floor(prev.length * 0.15))) return -1
  return k
}

export function buildDatasets(series: ModelSeries[]): StackedLineDataset[] {
  // Pre-accumulate y so each band is drawn between consecutive cumulative curves.
  // Why not y.stacked + fill:'stack': monotone interpolation leaves black background holes.
  const count = series.length
  if (count === 0) return []
  const len = series[0]?.values.length ?? 0
  const cumulative = new Array<number>(len).fill(0)

  return series.map((s, index) => {
    const color = colorForStackIndex(index, count)
    const rawValues = s.values.slice()
    const stackedValues = rawValues.map((v, i) => {
      const next = cumulative[i] + (Number.isFinite(v) ? v : 0)
      cumulative[i] = next
      return next
    })
    return {
      label: s.model,
      data: stackedValues,
      rawValues,
      borderColor: color.stroke,
      backgroundColor: color.fill,
      fill: index === 0 ? 'origin' : '-1',
      cubicInterpolationMode: 'monotone',
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: 6,
      borderWidth: 1.5,
      stack: STACK_ID,
      spanGaps: true,
    }
  })
}
