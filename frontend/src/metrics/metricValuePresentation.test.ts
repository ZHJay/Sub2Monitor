import { describe, expect, it } from 'vitest'
import { metricValueFontSize } from './metricValuePresentation'

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
