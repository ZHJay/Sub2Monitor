import { onScopeDispose, watch, type Ref } from 'vue'
import type { ScreenWakeLock } from './screenWakeLock'

export type AuthenticationStatus =
  | 'checking'
  | 'anonymous'
  | 'unavailable'
  | 'authenticated'

// Layer: L2 流程层 — maps the admin session lifecycle to one browser capability.
export function useAuthenticatedScreenWakeLock(
  status: Readonly<Ref<AuthenticationStatus>>,
  wakeLock: ScreenWakeLock,
) {
  watch(status, (nextStatus) => {
    if (nextStatus === 'authenticated') void wakeLock.start()
    else void wakeLock.stop()
  })
  onScopeDispose(() => { void wakeLock.stop() })
}
