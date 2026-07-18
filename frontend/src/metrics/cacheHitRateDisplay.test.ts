import { describe, expect, it } from 'vitest'
import { formatCacheHitRate } from './cacheHitRateDisplay'

describe('formatCacheHitRate', () => {
  it('renders a percentage with one decimal place', () => {
    expect(formatCacheHitRate(73.44)).toBe('73.4')
  })

  it('normalizes non-finite and out-of-range values', () => {
    expect(formatCacheHitRate(Number.NaN)).toBe('0.0')
    expect(formatCacheHitRate(-1)).toBe('0.0')
    expect(formatCacheHitRate(120)).toBe('100.0')
  })
})
