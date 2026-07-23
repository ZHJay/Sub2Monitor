import { describe, expect, it } from 'vitest'
import { getBrowserTimezone } from './browserTimezone'

describe('getBrowserTimezone', () => {
  it('returns the browser IANA timezone', () => {
    expect(getBrowserTimezone(() => 'America/Los_Angeles')).toBe('America/Los_Angeles')
  })

  it('falls back to UTC when the browser has no timezone or throws', () => {
    expect(getBrowserTimezone(() => '')).toBe('UTC')
    expect(getBrowserTimezone(() => { throw new Error('unavailable') })).toBe('UTC')
  })
})
