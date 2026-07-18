/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import {
  createScreenWakeLock,
  type VisibilityPagePort,
  type WakeLockPort,
  type WakeLockSentinelPort,
} from './screenWakeLock'

class FakeVisibilityPage extends EventTarget implements VisibilityPagePort {
  visibilityState: DocumentVisibilityState = 'visible'

  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

class FakeWakeLockSentinel extends EventTarget implements WakeLockSentinelPort {
  released = false
  release = vi.fn(async () => {
    if (this.released) return
    this.emitRelease()
  })

  emitRelease() {
    this.released = true
    this.dispatchEvent(new Event('release'))
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('createScreenWakeLock', () => {
  it('acquires while active and releases on stop', async () => {
    const page = new FakeVisibilityPage()
    const sentinel = new FakeWakeLockSentinel()
    const wakeLock: WakeLockPort = {
      request: vi.fn().mockResolvedValue(sentinel),
    }
    const lifecycle = createScreenWakeLock(page, wakeLock)

    await lifecycle.start()
    expect(wakeLock.request).toHaveBeenCalledWith('screen')

    await lifecycle.stop()
    expect(sentinel.release).toHaveBeenCalledOnce()
  })

  it('deduplicates concurrent acquisition attempts', async () => {
    const page = new FakeVisibilityPage()
    const sentinel = new FakeWakeLockSentinel()
    const pending = deferred<WakeLockSentinelPort>()
    const wakeLock: WakeLockPort = { request: vi.fn().mockReturnValue(pending.promise) }
    const lifecycle = createScreenWakeLock(page, wakeLock)

    const firstStart = lifecycle.start()
    const secondStart = lifecycle.start()
    expect(wakeLock.request).toHaveBeenCalledTimes(1)

    pending.resolve(sentinel)
    await Promise.all([firstStart, secondStart])
  })

  it('reacquires after browser release while visible and active', async () => {
    const page = new FakeVisibilityPage()
    const first = new FakeWakeLockSentinel()
    const second = new FakeWakeLockSentinel()
    const wakeLock: WakeLockPort = {
      request: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second),
    }
    const lifecycle = createScreenWakeLock(page, wakeLock)
    await lifecycle.start()

    first.emitRelease()

    await vi.waitFor(() => expect(wakeLock.request).toHaveBeenCalledTimes(2))
  })

  it('waits until the page is visible before reacquiring a released lock', async () => {
    const page = new FakeVisibilityPage()
    const first = new FakeWakeLockSentinel()
    const second = new FakeWakeLockSentinel()
    const wakeLock: WakeLockPort = {
      request: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second),
    }
    const lifecycle = createScreenWakeLock(page, wakeLock)
    await lifecycle.start()

    page.setVisibility('hidden')
    first.emitRelease()
    expect(wakeLock.request).toHaveBeenCalledTimes(1)

    page.setVisibility('visible')
    await vi.waitFor(() => expect(wakeLock.request).toHaveBeenCalledTimes(2))
  })

  it('releases a lock that resolves after the lifecycle has stopped', async () => {
    const page = new FakeVisibilityPage()
    const sentinel = new FakeWakeLockSentinel()
    const pending = deferred<WakeLockSentinelPort>()
    const wakeLock: WakeLockPort = { request: vi.fn().mockReturnValue(pending.promise) }
    const lifecycle = createScreenWakeLock(page, wakeLock)

    const starting = lifecycle.start()
    const stopping = lifecycle.stop()
    pending.resolve(sentinel)
    await Promise.all([starting, stopping])

    expect(sentinel.release).toHaveBeenCalledOnce()
    page.setVisibility('visible')
    expect(wakeLock.request).toHaveBeenCalledTimes(1)
  })

  it('degrades without rejecting when Wake Lock is unavailable or denied', async () => {
    const page = new FakeVisibilityPage()
    const denied: WakeLockPort = {
      request: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
    }

    await expect(createScreenWakeLock(page).start()).resolves.toBeUndefined()
    await expect(createScreenWakeLock(page, denied).start()).resolves.toBeUndefined()
  })
})
