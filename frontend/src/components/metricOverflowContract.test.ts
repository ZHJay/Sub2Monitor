import { describe, expect, it } from 'vitest'
import metricCard from './MetricCard.vue?raw'
import rollingNumber from './RollingNumber.vue?raw'

describe('metric overflow contract', () => {
  it('contains every metric card within its grid track', () => {
    expect(metricCard).toContain('min-w-0')
    expect(metricCard).toContain('max-w-full')
    expect(metricCard).toContain('overflow-hidden')
    expect(metricCard).toContain('metricValueFontSize(formattedValue)')
  })

  it('contains every rolling number within its parent', () => {
    expect(rollingNumber).toContain('min-width: 0')
    expect(rollingNumber).toContain('max-width: 100%')
    expect(rollingNumber).toContain('overflow: hidden')
  })
})
