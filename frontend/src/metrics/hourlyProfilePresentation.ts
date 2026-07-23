import type { HourlyProfilePoint } from '../api/client'
import { formatCompactCount } from './metricValuePresentation'

export interface HourlyProfileSummaryItem {
  label: string
  value: string
  detail?: string
}

export function buildHourlyProfileSummary(
  points: HourlyProfilePoint[],
): HourlyProfileSummaryItem[] {
  const average = points.reduce((total, point) => total + point.avgTokens, 0) / Math.max(points.length, 1)
  const usedPoints = points.filter((point) => point.peakTokens > 0)
  const peak = usedPoints.reduce<HourlyProfilePoint | null>(
    (highest, point) => !highest || point.peakTokens > highest.peakTokens ? point : highest,
    null,
  )
  const maximum = usedPoints.reduce<HourlyProfilePoint | null>(
    (highest, point) => !highest || point.maxTokens > highest.maxTokens ? point : highest,
    null,
  )
  const minimum = usedPoints.reduce<HourlyProfilePoint | null>(
    (lowest, point) => !lowest || point.minTokens < lowest.minTokens ? point : lowest,
    null,
  )
  const hasUsage = (peak?.peakTokens ?? 0) > 0

  return [
    { label: '均值', value: formatCompactCount(average) },
    {
      label: '最高峰值',
      value: hasUsage && peak ? formatCompactCount(peak.peakTokens) : '—',
      detail: hasUsage && peak ? peak.hour : '',
    },
    {
      label: '最大值（去异常）',
      value: hasUsage && maximum ? formatCompactCount(maximum.maxTokens) : '—',
      detail: hasUsage && maximum ? maximum.hour : '',
    },
    {
      label: '最小值（去异常）',
      value: hasUsage && minimum ? formatCompactCount(minimum.minTokens) : '—',
      detail: hasUsage && minimum ? minimum.hour : '',
    },
  ]
}
