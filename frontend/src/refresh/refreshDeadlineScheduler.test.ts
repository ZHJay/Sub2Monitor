import { describe, expect, it, vi } from 'vitest'
import { createRefreshDeadlineScheduler } from './refreshDeadlineScheduler'
import {
  deferred,
  FakeRefreshEnvironment,
  flushPromises,
} from './refreshDeadlineSchedulerTestSupport'

describe('createRefreshDeadlineScheduler', () => {
  it('refreshes immediately and again at the 30 second deadline', async () => {
    const environment = new FakeRefreshEnvironment()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    expect(refresh).toHaveBeenCalledTimes(1)
    await flushPromises()

    environment.advance(30_000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('serializes overlapping requests into one queued rerun', async () => {
    const environment = new FakeRefreshEnvironment()
    const first = deferred<void>()
    const refresh = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    void scheduler.refreshNow()
    void scheduler.refreshNow()
    expect(refresh).toHaveBeenCalledTimes(1)

    first.resolve()
    await flushPromises()
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('keeps the next deadline anchored when a refresh is slow', async () => {
    const environment = new FakeRefreshEnvironment()
    const first = deferred<void>()
    const refresh = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    environment.advance(10_000, false)
    first.resolve()
    await flushPromises()

    environment.advance(19_999)
    expect(refresh).toHaveBeenCalledTimes(1)
    environment.advance(1)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it.each(['visibilitychange', 'focus', 'online'] as const)(
    'catches up once after an overdue %s recovery event',
    async (eventType) => {
      const environment = new FakeRefreshEnvironment()
      const refresh = vi.fn().mockResolvedValue(undefined)
      const scheduler = createRefreshDeadlineScheduler(refresh, environment)

      scheduler.start()
      await flushPromises()
      if (eventType === 'visibilitychange') environment.page.setVisibility('hidden')
      environment.advance(31_000, false)

      if (eventType === 'visibilitychange') environment.page.setVisibility('visible')
      else environment.runtime.emit(eventType)
      await flushPromises()

      expect(refresh).toHaveBeenCalledTimes(2)
    },
  )

  it('does not refresh on recovery events before the deadline', async () => {
    const environment = new FakeRefreshEnvironment()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    await flushPromises()
    environment.advance(29_999, false)
    environment.page.setVisibility('visible')
    environment.runtime.emit('focus')
    environment.runtime.emit('online')
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('stops timers and removes recovery listeners', async () => {
    const environment = new FakeRefreshEnvironment()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const removePageListener = vi.spyOn(environment.page, 'removeEventListener')
    const removeRuntimeListener = vi.spyOn(environment.runtime, 'removeEventListener')
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    await flushPromises()
    scheduler.stop()
    environment.advance(60_000)
    environment.page.setVisibility('visible')
    environment.runtime.emit('focus')
    environment.runtime.emit('online')
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(removePageListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(removeRuntimeListener).toHaveBeenCalledWith('focus', expect.any(Function))
    expect(removeRuntimeListener).toHaveBeenCalledWith('online', expect.any(Function))
  })

  it('continues scheduling after a refresh rejects', async () => {
    const environment = new FakeRefreshEnvironment()
    const refresh = vi.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    await flushPromises()
    environment.advance(30_000)
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('starts a fresh 30 second deadline after a manual refresh', async () => {
    const environment = new FakeRefreshEnvironment()
    const refresh = vi.fn().mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    await flushPromises()
    environment.advance(10_000, false)
    await scheduler.refreshNow()
    expect(refresh).toHaveBeenCalledTimes(2)

    environment.advance(29_999)
    expect(refresh).toHaveBeenCalledTimes(2)
    environment.advance(1)
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('queues one catch-up when a refresh stays pending past its deadline', async () => {
    const environment = new FakeRefreshEnvironment()
    const first = deferred<void>()
    const refresh = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    environment.advance(60_000)
    expect(refresh).toHaveBeenCalledTimes(1)

    first.resolve()
    await flushPromises()

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('preserves the absolute cadence after a delayed catch-up', async () => {
    const environment = new FakeRefreshEnvironment()
    const first = deferred<void>()
    const refresh = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined)
    const scheduler = createRefreshDeadlineScheduler(refresh, environment)

    scheduler.start()
    environment.advance(35_000)
    first.resolve()
    await flushPromises()
    expect(refresh).toHaveBeenCalledTimes(2)

    environment.advance(24_999)
    expect(refresh).toHaveBeenCalledTimes(2)
    environment.advance(1)
    expect(refresh).toHaveBeenCalledTimes(3)
  })
})