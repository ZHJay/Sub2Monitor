import { describe, expect, it } from 'vitest'
import { buildHourlyProfileSummary } from './hourlyProfilePresentation'

describe('buildHourlyProfileSummary', () => {
  it('summarizes only the requested average, peak, and filtered range metrics', () => {
    expect(buildHourlyProfileSummary([
      {
        hour: '09:00', avgTokens: 1_000, peakTokens: 8_000, totalTokens: 7_000, maxTokens: 3_000, minTokens: 100,
        requests: 14, cost: 1.25, activeDays: 3,
      },
      {
        hour: '22:00', avgTokens: 300, peakTokens: 1_200, totalTokens: 2_100, maxTokens: 1_200, minTokens: 50,
        requests: 7, cost: 0.5, activeDays: 2,
      },
    ])).toEqual([
      { label: '均值', value: '650' },
      { label: '最高峰值', value: '8.00K', detail: '09:00' },
      { label: '最大值（去异常）', value: '3.00K', detail: '09:00' },
      { label: '最小值（去异常）', value: '50', detail: '22:00' },
    ])
  })
})
