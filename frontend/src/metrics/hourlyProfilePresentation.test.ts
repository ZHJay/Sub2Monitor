import { describe, expect, it } from 'vitest'
import type { HourlyProfilePoint } from '../api/client'
import {
  buildHourlyProfileBoxPlotPoints,
  buildHourlyProfileHeatmapRows,
  buildHourlyProfileSummary,
  hourlyProfileScaleMax,
} from './hourlyProfilePresentation'

const points: HourlyProfilePoint[] = [
  {
    hour: '09:00',
    avgTokens: 1_000,
    q1Tokens: 500,
    medianTokens: 900,
    q3Tokens: 1_500,
    peakTokens: 8_000,
    totalTokens: 7_000,
    maxTokens: 3_000,
    minTokens: 100,
    requests: 14,
    cost: 1.25,
    activeDays: 7,
  },
  {
    hour: '22:00',
    avgTokens: 300,
    q1Tokens: 0,
    medianTokens: 100,
    q3Tokens: 700,
    peakTokens: 1_200,
    totalTokens: 2_100,
    maxTokens: 1_200,
    minTokens: 0,
    requests: 7,
    cost: 0.5,
    activeDays: 2,
  },
]

describe('buildHourlyProfileSummary', () => {
  it('summarizes scientific distribution metrics and active-hour coverage', () => {
    expect(buildHourlyProfileSummary(points, 7)).toEqual([
      { label: 'Mean', value: '650', detail: '24h average' },
      { label: 'Median', value: '900', detail: '09:00' },
      { label: 'Peak', value: '8.00K', detail: '09:00' },
      { label: 'IQR', value: '1.00K', detail: '09:00 P25–P75' },
      { label: 'Active coverage', value: '2/24 h', detail: '7/7 days max' },
    ])
  })
})

describe('buildHourlyProfileHeatmapRows', () => {
  it('normalizes each statistic row independently and formats sparse active-day labels', () => {
    const rows = buildHourlyProfileHeatmapRows(points, 7)

    expect(rows.map((row) => row.label)).toEqual(['Mean', 'Median', 'IQR width', 'Peak', 'Active days'])
    expect(rows[0].cells.map((cell) => cell.intensity)).toEqual([1, 0.3])
    expect(rows[2].cells.map((cell) => cell.label)).toEqual(['1.00K tokens', '700 tokens'])
    expect(rows[4].cells.map((cell) => cell.label)).toEqual(['7/7 days', '2/7 days'])
  })
})

describe('buildHourlyProfileBoxPlotPoints', () => {
  it('maps API fields into boxplot statistics and protects zero-only scales', () => {
    const boxPoints = buildHourlyProfileBoxPlotPoints(points)

    expect(boxPoints[0]).toEqual({
      hour: '09:00',
      mean: 1_000,
      q1: 500,
      median: 900,
      q3: 1_500,
      min: 100,
      max: 3_000,
      activeDays: 7,
    })
    expect(hourlyProfileScaleMax(boxPoints)).toBe(3_000)
    expect(hourlyProfileScaleMax([])).toBe(1)
  })
})
