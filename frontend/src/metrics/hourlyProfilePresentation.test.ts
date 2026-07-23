import { describe, expect, it } from 'vitest'
import { buildHourlyProfileSummary, formatHourlyProfileTooltip } from './hourlyProfilePresentation'

describe('formatHourlyProfileTooltip', () => {
  it('includes every requested hourly profile statistic', () => {
    expect(formatHourlyProfileTooltip({
      hour: '09:00',
      avgTokens: 1_250,
      totalTokens: 37_500,
      maxTokens: 8_000,
      requests: 46,
      cost: 12.5,
      activeDays: 18,
    })).toEqual([
      '平均: 1.25K tokens',
      '总量: 37.50K tokens',
      '峰值: 8.00K tokens',
      '请求: 46',
      '成本: $12.50',
      '活跃天数: 18',
    ])
  })

  it('summarizes the full period instead of only exposing the hourly average', () => {
    expect(buildHourlyProfileSummary([
      {
        hour: '09:00', avgTokens: 1_000, totalTokens: 7_000, maxTokens: 3_000,
        requests: 14, cost: 1.25, activeDays: 3,
      },
      {
        hour: '22:00', avgTokens: 300, totalTokens: 2_100, maxTokens: 1_200,
        requests: 7, cost: 0.5, activeDays: 2,
      },
    ], 7)).toEqual([
      { label: '总 Tokens', value: '9.10K' },
      { label: '日均 Tokens', value: '1.30K' },
      { label: '高峰时段', value: '09:00', detail: '均值 1.00K' },
      { label: '单日时段峰值', value: '3.00K' },
      { label: '请求数', value: '21' },
      { label: '总成本', value: '$1.75', detail: '活跃小时天次 5' },
    ])
  })
})
