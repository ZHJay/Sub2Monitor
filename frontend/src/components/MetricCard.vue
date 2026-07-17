<template>
  <div class="rounded-2xl border border-apple-line bg-apple-surface p-5 shadow-glass backdrop-blur-xl transition-colors hover:border-apple-line-strong">
    <div class="text-[11px] uppercase tracking-[0.06em] text-apple-muted">{{ title }}</div>
    <div class="mt-2 text-[28px] font-semibold tracking-tight text-apple-text">
      {{ formattedValue }}
      <span v-if="unit" class="ml-1 text-base font-medium text-apple-muted">{{ unit }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  title: string
  value: number | string
  unit?: string
}

const props = withDefaults(defineProps<Props>(), {
  unit: ''
})

const formattedValue = computed(() => {
  const val = props.value
  if (typeof val === 'number') {
    if (props.title.includes('Cost') || props.title.includes('$') || props.title.includes('Hourly')) {
      return `$${val.toFixed(2)}`
    }
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`
    }
    return val.toFixed(0)
  }
  return val
})
</script>
