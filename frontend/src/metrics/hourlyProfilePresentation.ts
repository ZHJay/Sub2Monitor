import type { HourlyProfilePoint } from '../api/client'
import { formatCompactCount } from './metricValuePresentation'

export interface HourlyProfileSummaryItem {
  label: string
  value: string
  detail?: string
}

export interface HourlyProfileHeatmapCell {
  hour: string
  value: number
  label: string
  intensity: number
}

export interface HourlyProfileHeatmapRow {
  label: string
  cells: HourlyProfileHeatmapCell[]
}

export interface HourlyProfileBoxPlotPoint {
  hour: string
  mean: number
  q1: number
  median: number
  q3: number
  min: number
  max: number
  activeDays: number
}

export function buildHourlyProfileSummary(
  points: HourlyProfilePoint[],
  days = 30,
): HourlyProfileSummaryItem[] {
  const average = points.reduce((total, point) => total + point.avgTokens, 0) / Math.max(points.length, 1)
  const usedPoints = points.filter((point) => point.peakTokens > 0)
  const peak = usedPoints.reduce<HourlyProfilePoint | null>(
    (highest, point) => !highest || point.peakTokens > highest.peakTokens ? point : highest,
    null,
  )
  const median = usedPoints.reduce<HourlyProfilePoint | null>(
    (highest, point) => !highest || point.medianTokens > highest.medianTokens ? point : highest,
    null,
  )
  const widestIqr = usedPoints.reduce<HourlyProfilePoint | null>(
    (widest, point) => !widest || iqrWidth(point) > iqrWidth(widest) ? point : widest,
    null,
  )
  const hasUsage = (peak?.peakTokens ?? 0) > 0
  const activeHourCount = points.filter((point) => point.activeDays > 0).length
  const maxActiveDays = points.reduce((highest, point) => Math.max(highest, point.activeDays), 0)

  return [
    { label: 'Mean', value: formatCompactCount(average), detail: '24h average' },
    {
      label: 'Median',
      value: hasUsage && median ? formatCompactCount(median.medianTokens) : '—',
      detail: hasUsage && median ? median.hour : '',
    },
    {
      label: 'Peak',
      value: hasUsage && peak ? formatCompactCount(peak.peakTokens) : '—',
      detail: hasUsage && peak ? peak.hour : '',
    },
    {
      label: 'IQR',
      value: hasUsage && widestIqr ? formatCompactCount(iqrWidth(widestIqr)) : '—',
      detail: hasUsage && widestIqr ? `${widestIqr.hour} P25–P75` : '',
    },
    {
      label: 'Active coverage',
      value: `${activeHourCount}/24 h`,
      detail: `${maxActiveDays}/${days} days max`,
    },
  ]
}

export function buildHourlyProfileHeatmapRows(
  points: HourlyProfilePoint[],
  days = 30,
): HourlyProfileHeatmapRow[] {
  return [
    buildHeatmapRow('Mean', points, (point) => point.avgTokens, (value) => `${formatCompactCount(value)} tokens`),
    buildHeatmapRow('Median', points, (point) => point.medianTokens, (value) => `${formatCompactCount(value)} tokens`),
    buildHeatmapRow('IQR width', points, iqrWidth, (value) => `${formatCompactCount(value)} tokens`),
    buildHeatmapRow('Peak', points, (point) => point.peakTokens, (value) => `${formatCompactCount(value)} tokens`),
    buildHeatmapRow('Active days', points, (point) => point.activeDays, (value) => `${Math.round(value)}/${days} days`),
  ]
}

export function buildHourlyProfileBoxPlotPoints(points: HourlyProfilePoint[]): HourlyProfileBoxPlotPoint[] {
  return points.map((point) => ({
    hour: point.hour,
    mean: point.avgTokens,
    q1: point.q1Tokens,
    median: point.medianTokens,
    q3: point.q3Tokens,
    min: point.minTokens,
    max: point.maxTokens,
    activeDays: point.activeDays,
  }))
}

export function hourlyProfileScaleMax(points: HourlyProfileBoxPlotPoint[]): number {
  const maximum = points.reduce(
    (highest, point) => Math.max(highest, point.mean, point.q1, point.median, point.q3, point.min, point.max),
    0,
  )
  return Math.max(maximum, 1)
}

function iqrWidth(point: HourlyProfilePoint): number {
  return Math.max(0, point.q3Tokens - point.q1Tokens)
}

function buildHeatmapRow(
  label: string,
  points: HourlyProfilePoint[],
  valueForPoint: (point: HourlyProfilePoint) => number,
  labelForValue: (value: number) => string,
): HourlyProfileHeatmapRow {
  const values = points.map(valueForPoint)
  const maxValue = Math.max(...values, 0)
  return {
    label,
    cells: points.map((point, index) => {
      const value = values[index] ?? 0
      return {
        hour: point.hour,
        value,
        label: labelForValue(value),
        intensity: maxValue > 0 ? value / maxValue : 0,
      }
    }),
  }
}
