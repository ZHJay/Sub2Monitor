import type { HourlyProfilePoint } from '../api/client'
import { formatCompactCount } from './metricValuePresentation'

export interface HourlyProfileSummaryItem {
  label: string
  value: string
  detail?: string
}

export function formatHourlyProfileTooltip(point: HourlyProfilePoint): string[] {
  return [
    `平均: ${formatCompactCount(point.avgTokens)} tokens`,
    `总量: ${formatCompactCount(point.totalTokens)} tokens`,
    `峰值: ${formatCompactCount(point.maxTokens)} tokens`,
    `请求: ${formatCompactCount(point.requests)}`,
    `成本: $${point.cost.toFixed(2)}`,
    `活跃天数: ${point.activeDays}`,
  ]
}

export function buildHourlyProfileSummary(
  points: HourlyProfilePoint[],
  days: number,
): HourlyProfileSummaryItem[] {
  const totals = points.reduce((acc, point) => ({
    tokens: acc.tokens + point.totalTokens,
    requests: acc.requests + point.requests,
    cost: acc.cost + point.cost,
    activeHourDays: acc.activeHourDays + point.activeDays,
  }), { tokens: 0, requests: 0, cost: 0, activeHourDays: 0 })
  const peakAverage = points.reduce<HourlyProfilePoint | null>(
    (peak, point) => !peak || point.avgTokens > peak.avgTokens ? point : peak,
    null,
  )
  const maxSingleBucket = points.reduce(
    (peak, point) => Math.max(peak, point.maxTokens),
    0,
  )
  const hasUsage = totals.tokens > 0

  return [
    { label: '总 Tokens', value: formatCompactCount(totals.tokens) },
    { label: '日均 Tokens', value: formatCompactCount(totals.tokens / Math.max(days, 1)) },
    {
      label: '高峰时段',
      value: hasUsage ? peakAverage?.hour ?? '—' : '—',
      detail: hasUsage && peakAverage ? `均值 ${formatCompactCount(peakAverage.avgTokens)}` : '',
    },
    { label: '单日时段峰值', value: formatCompactCount(maxSingleBucket) },
    { label: '请求数', value: formatCompactCount(totals.requests) },
    {
      label: '总成本',
      value: `$${totals.cost.toFixed(2)}`,
      detail: `活跃小时天次 ${formatCompactCount(totals.activeHourDays)}`,
    },
  ]
}
