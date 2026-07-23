const MIN_METRIC_FONT_REM = 0.75
const MAX_METRIC_FONT_REM = 1.75

const COMPACT_COUNT_UNITS = [
  { suffix: 'B', value: 1_000_000_000 },
  { suffix: 'M', value: 1_000_000 },
  { suffix: 'K', value: 1_000 },
]

// Contract: compact count values use K/M/B with exactly two decimals once abbreviated.
export function formatCompactCount(value: number): string {
  const absValue = Math.abs(value)
  const unit = COMPACT_COUNT_UNITS.find((candidate) => absValue >= candidate.value)
  if (!unit) return Math.round(value).toString()
  return `${(value / unit.value).toFixed(2)}${unit.suffix}`
}

// Contract: only the visual font size changes; callers retain the full metric value.
export function metricValueFontSize(value: string): string {
  const length = Math.max(value.length, 1)
  const rem = Math.max(
    MIN_METRIC_FONT_REM,
    Math.min(MAX_METRIC_FONT_REM, 2.25 - length * 0.1),
  )
  return `${rem.toFixed(2)}rem`
}
