<template>
  <div class="min-w-0 rounded-2xl border border-apple-line bg-apple-surface p-5 shadow-glass backdrop-blur-xl transition-colors hover:border-apple-line-strong">
    <div class="text-[11px] uppercase tracking-[0.06em] text-apple-muted">{{ title }}</div>
    <div
      class="mt-2 flex min-w-0 max-w-full items-baseline overflow-hidden font-semibold tracking-tight text-apple-text"
      :style="{ fontSize: metricValueFontSize(formattedValue) }"
      :title="formattedValue"
    >
      <RollingNumber class="min-w-0 max-w-full shrink overflow-hidden" :value="formattedValue" />
      <span v-if="unit" class="ml-1 shrink-0 text-base font-medium text-apple-muted">{{ unit }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// Layer: L1 积木层 — 指标卡；刷新时由 RollingNumber 做位级差分动画。
import { computed } from 'vue'
import RollingNumber from './RollingNumber.vue'
import { metricValueFontSize } from '../metrics/metricValuePresentation'

interface Props {
  title: string
  value: number | string
  unit?: string
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
})

const formattedValue = computed(() => {
  const val = props.value
  if (typeof val === 'number') {
    if (props.title.includes('Cost') || props.title.includes('$') || props.title.includes('Hourly')) {
      return `$${val.toFixed(2)}`
    }
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`
    return val.toFixed(0)
  }
  return val
})
</script>
