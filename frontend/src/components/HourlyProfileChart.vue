<template>
  <section class="rounded-2xl border border-apple-line bg-apple-surface p-5 shadow-glass backdrop-blur-xl">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-[15px] font-semibold tracking-tight text-apple-text">Hourly usage profile</h2>
        <p class="mt-1 text-xs text-apple-muted">过去 {{ days }} 天 · {{ timezone }} · 严重离群值已从最大/最小范围中剔除</p>
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
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js'
import type { HourlyProfilePoint } from '../api/client'
import { buildHourlyProfileSummary } from '../metrics/hourlyProfilePresentation'
import { formatCompactCount } from '../metrics/metricValuePresentation'
import { useTheme } from '../composables/useTheme'
import { readChartChromeColors } from '../theme/themeTokens'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip)

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
let chart: Chart<'line'> | null = null

const summaryItems = computed(() => buildHourlyProfileSummary(props.points))

function pillClass(active: boolean): string {
  return active
    ? 'rounded-full bg-apple-green px-3 py-1.5 text-xs font-medium text-apple-green-ink'
    : 'rounded-full border border-apple-line bg-apple-surface-strong px-3 py-1.5 text-xs font-medium text-apple-muted hover:text-apple-text'
}

function buildConfig(): ChartConfiguration<'line'> {
  const chrome = readChartChromeColors()
  return {
    type: 'line',
    data: {
      labels: props.points.map((point) => point.hour),
      datasets: [
        {
          label: '均值',
          data: props.points.map((point) => point.avgTokens),
          borderColor: '#30d158',
          backgroundColor: 'rgba(48, 209, 88, 0.12)',
          borderWidth: 2.5,
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.25,
        },
        {
          label: '最高峰值',
          data: props.points.map((point) => point.peakTokens),
          borderColor: '#ff9f0a',
          borderWidth: 2,
          pointRadius: 1.5,
          pointHoverRadius: 4,
          tension: 0.2,
        },
        {
          label: '最大值（去异常）',
          data: props.points.map((point) => point.maxTokens),
          borderColor: '#0a84ff',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.2,
        },
        {
          label: '最小值（去异常）',
          data: props.points.map((point) => point.minTokens),
          borderColor: '#64d2ff',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: chrome.tickColor,
            boxWidth: 12,
            usePointStyle: true,
          },
        },
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
              return `${items.dataset.label}: ${formatCompactCount(Number(items.raw))} tokens`
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
