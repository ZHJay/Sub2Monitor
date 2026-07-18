<template>
  <div id="app" class="font-apple">
    <div v-if="status !== 'authenticated'" class="flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-md rounded-2xl border border-apple-line bg-apple-surface p-8 shadow-glass backdrop-blur-xl">
        <div class="mb-6 flex items-start justify-between gap-3">
          <h1 class="text-3xl font-semibold tracking-tight text-apple-text">Sub2Monitor</h1>
          <ThemeSwitcher />
        </div>
        <p v-if="status === 'checking'" class="mt-3 text-apple-muted">正在验证 Sub2API 管理员身份…</p>
        <template v-else>
          <p class="mt-3 mb-6 text-apple-muted">{{ message }}</p>
          <a
            href="https://api4kimi8.org/login"
            class="block w-full rounded-full bg-apple-green px-4 py-2.5 text-center text-sm font-semibold text-apple-green-ink transition-opacity hover:opacity-90"
          >
            前往 Sub2API 登录
          </a>
          <button
            @click="startAuthentication()"
            class="mt-3 w-full rounded-full border border-apple-line-strong px-4 py-2.5 text-sm text-apple-text transition-colors hover:bg-apple-surface-strong"
          >
            重试
          </button>
        </template>
      </div>
    </div>
    <Dashboard v-else />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Dashboard from './views/Dashboard.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import { createSSOChallenge, getSSOSession } from './api/client'
import { startTopLevelSSO } from './auth/sub2apiSsoBridge'
import { createScreenWakeLock, type WakeLockPort } from './display/screenWakeLock'
import {
  useAuthenticatedScreenWakeLock,
  type AuthenticationStatus,
} from './display/useAuthenticatedScreenWakeLock'
import { useTheme } from './composables/useTheme'

// Keep theme media listener alive on the auth gate as well.
useTheme()

const status = ref<AuthenticationStatus>('checking')
const browserWakeLock = 'wakeLock' in navigator
  ? navigator.wakeLock as unknown as WakeLockPort
  : undefined
useAuthenticatedScreenWakeLock(status, createScreenWakeLock(document, browserWakeLock))

const message = computed(() => status.value === 'unavailable'
  ? '身份服务暂时不可用，请稍后重试。'
  : '请先在 Sub2API 登录管理员账户，再返回此页面。')

async function startAuthentication(allowRedirect = true) {
  status.value = 'checking'
  try {
    await getSSOSession()
    status.value = 'authenticated'
  } catch (error: any) {
    if (error.response?.status === 503) { status.value = 'unavailable'; return }
    if (!allowRedirect) {
      status.value = new URLSearchParams(window.location.search).get('sso') === 'unavailable'
        ? 'unavailable'
        : 'anonymous'
      return
    }
    try {
      startTopLevelSSO(await createSSOChallenge())
    } catch (challengeError: any) {
      status.value = challengeError.response?.status === 503 ? 'unavailable' : 'anonymous'
    }
  }
}
function authenticationLost() { status.value = 'anonymous' }
onMounted(() => {
  window.addEventListener('apimonitor:auth-lost', authenticationLost)
  startAuthentication(!new URLSearchParams(window.location.search).has('sso'))
})
onBeforeUnmount(() => window.removeEventListener('apimonitor:auth-lost', authenticationLost))
</script>
