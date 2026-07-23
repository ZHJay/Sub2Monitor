import { describe, expect, it } from 'vitest'
import { formatHourlyProfileTooltip } from './hourlyProfilePresentation'

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
})
