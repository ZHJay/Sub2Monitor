import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { ScreenWakeLock } from './screenWakeLock'
import { useAuthenticatedScreenWakeLock } from './useAuthenticatedScreenWakeLock'

describe('useAuthenticatedScreenWakeLock', () => {
  it('starts only for authenticated status and stops after auth loss', async () => {
    const status = ref<'checking' | 'authenticated' | 'anonymous'>('checking')
    const wakeLock: ScreenWakeLock = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    }
    const scope = effectScope()
    scope.run(() => useAuthenticatedScreenWakeLock(status, wakeLock))

    status.value = 'authenticated'
    await nextTick()
    expect(wakeLock.start).toHaveBeenCalledOnce()
    expect(wakeLock.stop).not.toHaveBeenCalled()

    status.value = 'anonymous'
    await nextTick()
    expect(wakeLock.stop).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('releases the lock when the owning component scope unmounts', async () => {
    const status = ref<'authenticated'>('authenticated')
    const wakeLock: ScreenWakeLock = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    }
    const scope = effectScope()
    scope.run(() => useAuthenticatedScreenWakeLock(status, wakeLock))

    scope.stop()
    await nextTick()

    expect(wakeLock.stop).toHaveBeenCalledOnce()
  })
})
