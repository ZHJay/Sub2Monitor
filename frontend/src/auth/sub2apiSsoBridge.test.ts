import { describe, expect, it } from 'vitest'
import { buildTopLevelBridgeURL } from './sub2apiSsoBridge'

describe('buildTopLevelBridgeURL', () => {
  it('places only the one-time state in the fixed API Bridge URL', () => {
    const url = buildTopLevelBridgeURL('state with / separators')
    expect(url).toBe('https://burntoken.org/_monitor-sso/bridge?state=state%20with%20%2F%20separators')
    expect(new URL(url).searchParams.has('token')).toBe(false)
    expect(url).not.toContain('monitor.burntoken.org')
  })
})
