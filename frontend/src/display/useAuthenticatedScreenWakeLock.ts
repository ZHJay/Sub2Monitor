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
  let authenticatedIntent = false
  watch(status, (nextStatus) => {
    if (nextStatus === 'authenticated') {
      authenticatedIntent = true
      void wakeLock.start()
    } else if (nextStatus === 'anonymous' && authenticatedIntent) {
      authenticatedIntent = false
      void wakeLock.stop()
    }
  }, { immediate: true })
  onScopeDispose(() => { void wakeLock.stop() })
}
