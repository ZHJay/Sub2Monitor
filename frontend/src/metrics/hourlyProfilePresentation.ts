import type { HourlyProfilePoint } from '../api/client'
import { formatCompactCount } from './metricValuePresentation'

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
