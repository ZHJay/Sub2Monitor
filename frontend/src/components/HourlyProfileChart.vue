<template>
  <section class="rounded-2xl border border-apple-line bg-apple-surface p-5 shadow-glass backdrop-blur-xl">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-[15px] font-semibold tracking-tight text-apple-text">Hourly usage profile</h2>
        <p class="mt-1 text-xs text-apple-muted">过去 {{ days }} 天 · {{ timezone }} · 每小时平均 Token</p>
      </div>
      <div class="flex gap-1">
        <button
          v-for="option in dayOptions"
          :key="option"
          type="button"
          :class="pillClass(days === option)"
          @click="$emit('update:days', option)"
        >{{ option }}d</button>
      </div>
    </div>

    <div v-if="loading" class="flex h-72 items-center justify-center text-sm text-apple-muted">Loading hourly profile…</div>
    <div v-else-if="error" class="flex h-72 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-sm text-red-300">{{ error }}</div>
    <div v-else class="space-y-4">
      <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <div v-for="item in summaryItems" :key="item.label" class="rounded-xl border border-apple-line bg-apple-surface-strong px-3 py-2">
          <dt class="text-[10px] uppercase tracking-[0.06em] text-apple-muted">{{ item.label }}</dt>
          <dd class="mt-1 truncate text-sm font-semibold text-apple-text">{{ item.value }}</dd>
          <p v-if="item.detail" class="mt-0.5 truncate text-[10px] text-apple-muted">{{ item.detail }}</p>
        </div>
      </dl>
      <div class="h-72">
        <canvas ref="canvas" role="img" :aria-label="`Average token usage by ${timezone} hour over the past ${days} days`"></canvas>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js'
import type { HourlyProfilePoint } from '../api/client'
import { buildHourlyProfileSummary, formatHourlyProfileTooltip } from '../metrics/hourlyProfilePresentation'
import { formatCompactCount } from '../metrics/metricValuePresentation'
import { useTheme } from '../composables/useTheme'
import { readChartChromeColors } from '../theme/themeTokens'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

const props = defineProps<{
  days: number
  timezone: string
  points: HourlyProfilePoint[]
  loading?: boolean
  error?: string | null
}>()
defineEmits<{ 'update:days': [value: number] }>()

const dayOptions = [7, 30, 90, 365]
const canvas = ref<HTMLCanvasElement | null>(null)
const { resolvedTheme } = useTheme()
let chart: Chart<'bar'> | null = null

const summaryItems = computed(() => buildHourlyProfileSummary(props.points, props.days))

function pillClass(active: boolean): string {
  return active
    ? 'rounded-full bg-apple-green px-3 py-1.5 text-xs font-medium text-apple-green-ink'
    : 'rounded-full border border-apple-line bg-apple-surface-strong px-3 py-1.5 text-xs font-medium text-apple-muted hover:text-apple-text'
}

function buildConfig(): ChartConfiguration<'bar'> {
  const chrome = readChartChromeColors()
  return {
    type: 'bar',
    data: {
      labels: props.points.map((point) => point.hour),
      datasets: [{
        label: '平均 Tokens',
        data: props.points.map((point) => point.avgTokens),
        backgroundColor: 'rgba(48, 209, 88, 0.65)',
        borderColor: '#30d158',
        borderWidth: 1,
        borderRadius: 5,
        maxBarThickness: 28,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: chrome.tooltipBg,
          titleColor: chrome.titleColor,
          bodyColor: chrome.bodyColor,
          footerColor: chrome.bodyColor,
          borderColor: chrome.borderColor,
          borderWidth: 1,
          callbacks: {
            title(items) {
              return `${props.points[items[0]?.dataIndex ?? 0]?.hour ?? ''} ${props.timezone}`
            },
            label(items) {
              const point = props.points[items.dataIndex]
              return point ? formatHourlyProfileTooltip(point)[0] : ''
            },
            afterLabel(items) {
              const point = props.points[items.dataIndex]
              return point ? formatHourlyProfileTooltip(point).slice(1) : []
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: chrome.tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          border: { color: chrome.axisBorder },
        },
        y: {
          beginAtZero: true,
          grid: { color: chrome.gridColor },
          ticks: {
            color: chrome.tickColor,
            callback: (value) => formatCompactCount(Number(value)),
          },
          border: { color: chrome.axisBorder },
        },
      },
    },
  }
}

function renderChart() {
  if (!canvas.value || props.loading || props.error) return
  chart?.destroy()
  chart = new Chart(canvas.value, buildConfig())
}

watch(() => [props.points, props.loading, props.error] as const, () => nextTick(renderChart), { deep: true })
watch(resolvedTheme, () => nextTick(renderChart))

onMounted(() => nextTick(renderChart))
onBeforeUnmount(() => chart?.destroy())
</script>
