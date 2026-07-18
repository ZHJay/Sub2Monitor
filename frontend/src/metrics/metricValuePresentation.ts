const MIN_METRIC_FONT_REM = 0.75
const MAX_METRIC_FONT_REM = 1.75

// Contract: only the visual font size changes; callers retain the full metric value.
export function metricValueFontSize(value: string): string {
  const length = Math.max(value.length, 1)
  const rem = Math.max(
    MIN_METRIC_FONT_REM,
    Math.min(MAX_METRIC_FONT_REM, 2.25 - length * 0.1),
  )
  return `${rem.toFixed(2)}rem`
}
