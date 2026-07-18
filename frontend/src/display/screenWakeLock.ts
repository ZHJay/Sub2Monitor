export interface VisibilityPagePort extends EventTarget {
  readonly visibilityState: DocumentVisibilityState
}

export interface WakeLockSentinelPort extends EventTarget {
  readonly released: boolean
  release(): Promise<void>
}

export interface WakeLockPort {
  request(type: 'screen'): Promise<WakeLockSentinelPort>
}

export interface ScreenWakeLock {
  start(): Promise<void>
  stop(): Promise<void>
}

// Layer: L1 积木层 — owns one browser Wake Lock operation at a time.
export function createScreenWakeLock(
  page: VisibilityPagePort,
  wakeLock?: WakeLockPort,
): ScreenWakeLock {
  let active = false
  let sentinel: WakeLockSentinelPort | null = null
  let requestInFlight: Promise<void> | null = null

  function acquire(): Promise<void> {
    if (!active || page.visibilityState !== 'visible' || !wakeLock || sentinel) {
      return Promise.resolve()
    }
    if (requestInFlight) return requestInFlight
    requestInFlight = wakeLock.request('screen')
      .then(async (acquired) => {
        if (!active || page.visibilityState !== 'visible') {
          await acquired.release()
          return
        }
        sentinel = acquired
        acquired.addEventListener('release', handleRelease)
      })
      // Boundary: browser policy failures must not alter the authenticated session.
      .catch(() => undefined)
      .finally(() => { requestInFlight = null })
    return requestInFlight
  }

  function handleRelease() {
    sentinel?.removeEventListener('release', handleRelease)
    sentinel = null
    if (active && page.visibilityState === 'visible') void acquire()
  }

  function handleVisibilityChange() {
    if (active && page.visibilityState === 'visible') void acquire()
  }

  return {
    async start() {
      if (!active) page.addEventListener('visibilitychange', handleVisibilityChange)
      active = true
      return acquire()
    },
    async stop() {
      if (!active && !sentinel && !requestInFlight) return
      active = false
      page.removeEventListener('visibilitychange', handleVisibilityChange)
      await requestInFlight
      const current = sentinel
      sentinel = null
      current?.removeEventListener('release', handleRelease)
      await current?.release()
    },
  }
}
