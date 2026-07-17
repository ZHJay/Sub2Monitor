const apiOrigin = 'https://api4kimi8.org'
const bridgePath = '/_monitor-sso/bridge'

// buildTopLevelBridgeURL contains only an opaque one-time state; upstream credentials never enter a URL.
export function buildTopLevelBridgeURL(state: string): string {
  return `${apiOrigin}${bridgePath}?state=${encodeURIComponent(state)}`
}

// startTopLevelSSO keeps the API origin first-party so Safari can access its existing localStorage token.
export function startTopLevelSSO(state: string): void {
  window.location.replace(buildTopLevelBridgeURL(state))
}
