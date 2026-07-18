import { describe, expect, it, vi } from 'vitest'
import { createRefreshDeadlineScheduler } from './refreshDeadlineScheduler'
import {
  deferred,
  FakeRefreshEnvironment,
  flushPromises,
} from './refreshDeadlineSchedulerTestSupport'

describe('createRefreshDeadlineScheduler races', () => {
  it('does not leak a rejected in-flight promise to overlapping callers', async () => {
    const environment = new FakeRefreshEnvironment()
    const first = deferred<void>()
    const refresh = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    const overlapping = scheduler.refreshNow()
    first.reject(new Error('temporary failure'))

    await expect(overlapping).resolves.toBeUndefined()
    await flushPromises()
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale timer callback that runs after stop', async () => {
    const environment = new FakeRefreshEnvironment()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    await flushPromises()
    const staleCallback = environment.takeNextTimerCallback()
    scheduler.stop()
    staleCallback()
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
