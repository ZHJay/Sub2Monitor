export interface RefreshSchedulerEventPort extends EventTarget {}

export interface RefreshSchedulerPagePort extends RefreshSchedulerEventPort {
  readonly visibilityState: DocumentVisibilityState
}

export interface RefreshSchedulerEnvironment {
  readonly page: RefreshSchedulerPagePort
  readonly runtime: RefreshSchedulerEventPort
  now(): number
  setTimer(callback: () => void, delayMs: number): number
  clearTimer(id: number): void
  intervalMs?: number
}

export interface RefreshDeadlineScheduler {
  start(): void
  stop(): void
  refreshNow(): Promise<void>
}

// Layer: L1 积木层 — schedules one reusable asynchronous refresh operation.
export function createRefreshDeadlineScheduler(
  refresh: () => Promise<void>,
  environment: RefreshSchedulerEnvironment,
): RefreshDeadlineScheduler {
  const intervalMs = environment.intervalMs ?? 30_000
  let running = false
  let timer: number | null = null
  let inFlight: Promise<void> | null = null
  let rerunRequested = false
  let nextDeadlineMs = 0

  function advanceDeadlinePast(nowMs: number) {
    do nextDeadlineMs += intervalMs
    while (nextDeadlineMs <= nowMs)
  }

  async function execute(): Promise<void> {
    if (!running) return
    if (inFlight) {
      rerunRequested = true
      return inFlight.catch(() => undefined)
    }
    if (timer !== null) environment.clearTimer(timer)
    timer = null
    advanceDeadlinePast(environment.now())
    timer = environment.setTimer(
      () => { void execute() },
      nextDeadlineMs - environment.now(),
    )
    try {
      inFlight = refresh()
      await inFlight
    } catch {
      // Boundary: refresh errors are owned by the dashboard state, not the cadence.
    } finally {
      inFlight = null
    }
    if (!running) return
    if (rerunRequested) {
      rerunRequested = false
      return execute()
    }
  }

  function handleRecovery() {
    if (running && environment.now() >= nextDeadlineMs) void execute()
  }

  function handleVisibilityChange() {
    if (environment.page.visibilityState === 'visible') handleRecovery()
  }

  return {
    start() {
      if (running) return
      running = true
      nextDeadlineMs = environment.now()
      environment.page.addEventListener('visibilitychange', handleVisibilityChange)
      environment.runtime.addEventListener('focus', handleRecovery)
      environment.runtime.addEventListener('online', handleRecovery)
      void execute()
    },
    stop() {
      running = false
      rerunRequested = false
      environment.page.removeEventListener('visibilitychange', handleVisibilityChange)
      environment.runtime.removeEventListener('focus', handleRecovery)
      environment.runtime.removeEventListener('online', handleRecovery)
      if (timer !== null) environment.clearTimer(timer)
      timer = null
    },
    refreshNow() {
      if (!running) return Promise.resolve()
      nextDeadlineMs = environment.now()
      return execute()
    },
  }
}
