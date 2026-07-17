<template>
  <div
    class="inline-flex items-center rounded-full border border-apple-line bg-apple-surface-strong p-0.5 shadow-sm"
    role="radiogroup"
    aria-label="外观主题"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="preference === opt.value"
      :title="opt.title"
      class="relative flex h-8 min-w-[2.25rem] items-center justify-center rounded-full px-2.5 text-[11px] font-medium transition-all duration-200"
      :class="preference === opt.value
        ? 'bg-apple-elevated text-apple-text shadow-sm'
        : 'text-apple-muted hover:text-apple-text'"
      @click="setPreference(opt.value)"
    >
      <span class="sr-only">{{ opt.title }}</span>
      <!-- system: half-filled circle -->
      <svg v-if="opt.value === 'system'" class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 1.75a6.25 6.25 0 0 0 0 12.5V1.75Z" fill="currentColor" />
      </svg>
      <!-- light: sun -->
      <svg v-else-if="opt.value === 'light'" class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 1.5v1.25M8 13.25V14.5M1.5 8h1.25M13.25 8H14.5M3.4 3.4l.88.88M11.72 11.72l.88.88M3.4 12.6l.88-.88M11.72 4.28l.88-.88" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <!-- dark: moon -->
      <svg v-else class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M13.2 9.35A5.75 5.75 0 0 1 6.65 2.8 5.9 5.9 0 1 0 13.2 9.35Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ThemePreference } from '../theme/themePreference'
import { useTheme } from '../composables/useTheme'

// Layer: L1 积木层 — Apple-style appearance segmented control.

const { preference, setPreference } = useTheme()

const options: { value: ThemePreference; title: string }[] = [
  { value: 'system', title: '跟随系统' },
  { value: 'light', title: '浅色' },
  { value: 'dark', title: '深色' },
]
</script>
