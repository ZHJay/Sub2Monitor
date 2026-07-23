import { describe, expect, it } from 'vitest'
import { formatCompactCount, metricValueFontSize } from './metricValuePresentation'

describe('formatCompactCount', () => {
  it('keeps small counts as whole totals', () => {
    expect(formatCompactCount(999)).toBe('999')
    expect(formatCompactCount(12.4)).toBe('12')
  })

  it('abbreviates thousands, millions, and billions with two decimals', () => {
    expect(formatCompactCount(1_234)).toBe('1.23K')
    expect(formatCompactCount(1_234_567)).toBe('1.23M')
    expect(formatCompactCount(1_234_567_890)).toBe('1.23B')
  })
})

describe('metricValueFontSize', () => {
  it('keeps short values at the maximum size', () => {
    expect(metricValueFontSize('12345')).toBe('1.75rem')
  })

  it('shrinks medium values deterministically', () => {
    expect(metricValueFontSize('1234567890')).toBe('1.25rem')
  })

  it('clamps long values at the readable minimum', () => {
    expect(metricValueFontSize('123456789/123456789')).toBe('0.75rem')
    expect(metricValueFontSize('9'.repeat(100))).toBe('0.75rem')
  })
})
