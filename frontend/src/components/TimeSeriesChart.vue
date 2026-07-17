<template>
  <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-glass backdrop-blur-xl">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-[11px] uppercase tracking-[0.06em] text-apple-muted">Usage by model</h2>
      <div class="flex flex-wrap gap-2">
        <div class="flex gap-1">
          <button
            v-for="m in metrics"
            :key="m.value"
            @click="$emit('update:metric', m.value)"
            :class="pillClass(metric === m.value)"
          >{{ m.label }}</button>
        </div>
        <div class="flex gap-1">
          <button
            v-for="range in timeRanges"
            :key="range.value"
            @click="$emit('update:timeRange', range.value)"
            :class="pillClass(timeRange === range.value)"
          >{{ range.label }}</button>
        </div>
      </div>
    </div>

    <!-- overflow hidden clips slide; stage translates, canvas content never paints outside box -->
    <div class="relative h-72 overflow-hidden">
      <div ref="chartStage" class="absolute inset-0 will-change-transform">
        <canvas ref="chartCanvas" role="img" :aria-label="chartAriaLabel"></canvas>
      </div>
      <div
        v-if="pending"
        class="pointer-events-none absolute inset-0 z-10 flex items-start justify-end p-2"
      >
        <span class="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-apple-muted backdrop-blur-sm">
          updating…
        </span>
      </div>
    </div>

    <ul v-if="legendItems.length" class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      <li v-for="item in legendItems" :key="item.label" class="flex items-center gap-1.5 text-[11px] text-[#d1d1d6]">
        <span class="h-2.5 w-2.5 rounded-full" :style="{ background: item.color }"></span>
        <span class="max-w-[12rem] truncate">{{ item.label }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement, LineController,
  Filler, Tooltip,
} from 'chart.js'
import {
  type ModelSeries,
  type StackedLineDataset,
  SLIDE_MS,
  bridgeSeriesForMorph,
  buildDatasets,
  cloneSeries,
  dataKey,
  detectTimestampShift,
  formatAxisLabel,
  formatYAxisTick,
  modelsKey,
} from './chartStackSeries'
import { writeStackedDatasets } from './chartLineMutations'
import { buildTimeSeriesChartConfig } from './timeSeriesChartConfig'

// Layer: L2 流程层 — chart lifecycle: slide (live window) vs morph (metric/range).

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip)

const props = defineProps<{
  timestamps: string[]
  series: ModelSeries[]
  timeRange: string
  metric: string
}>()
defineEmits<{ 'update:timeRange': [value: string]; 'update:metric': [value: string] }>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
const chartStage = ref<HTMLDivElement | null>(null)
let chartInstance: Chart<'line'> | null = null
let lastDataKey = ''
let lastTimestamps: string[] = []
let lastModelsKey = ''
/** Raw (non-cumulative) series from the last painted frame — morph bridge source. */
let lastSeriesRaw: ModelSeries[] = []
/** Metric used for the currently painted Y ticks (avoid premature unit switch). */
let lastPaintedMetric = ''
const pending = ref(false)
let pendingRange = ''
let pendingMetric = ''
let slideTimer: number | null = null

const legendItems = ref<{ label: string; color: string }[]>([])

const chartAriaLabel = computed(() =>
  `${props.metric === 'cost' ? 'USD cost' : 'Tokens'} stacked by model over time`
)
const timeRanges = [
  { label: '1h', value: '1h' }, { label: '6h', value: '6h' }, { label: '24h', value: '24h' },
  { label: '7d', value: '7d' }, { label: 'All', value: 'all' },
]
const metrics = [
  { label: 'USD', value: 'cost' }, { label: 'Tokens', value: 'tokens' },
]

function pillClass(active: boolean): string {
  return active
    ? 'rounded-full bg-apple-green px-3 py-1.5 text-xs font-medium text-[#003312]'
    : 'rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-apple-muted hover:text-apple-text'
}

function syncLegend(datasets: StackedLineDataset[]) {
  legendItems.value = datasets.map((d) => ({
    label: String(d.label ?? ''),
    color: String(d.backgroundColor ?? d.borderColor ?? '#888'),
  }))
}

function setYTickFormat(chart: Chart<'line'>, metric: string) {
  const y = chart.options.scales?.y
  if (y && 'ticks' in y && y.ticks) {
    y.ticks.callback = (value) => formatYAxisTick(Number(value), metric)
  }
}

function clearSlideTimer() {
  if (slideTimer != null) {
    window.clearTimeout(slideTimer)
    slideTimer = null
  }
}

function resetStageTransform() {
  const el = chartStage.value
  if (!el) return
  el.style.transition = 'none'
  el.style.transform = 'translateX(0)'
}

/** After data already matches new window, offset stage right then ease back to 0 → content slides left. */
function playSlideLeft(shiftCount: number, prevLen: number) {
  const el = chartStage.value
  if (!el || !chartInstance || shiftCount <= 0 || prevLen <= 0) return

  const area = chartInstance.chartArea
  const plotWidth = Math.max(1, area.right - area.left)
  // Shift in plot coordinates only; stage is full box but overflow parent clips both sides.
  const shiftPx = (shiftCount / prevLen) * plotWidth

  clearSlideTimer()
  el.style.transition = 'none'
  el.style.transform = `translateX(${shiftPx}px)`
  // Double rAF: ensure browser paints the offset frame before transitioning to 0.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!chartStage.value) return
      chartStage.value.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      chartStage.value.style.transform = 'translateX(0)'
      slideTimer = window.setTimeout(() => {
        resetStageTransform()
        slideTimer = null
      }, SLIDE_MS + 40)
    })
  })
}

function createChart() {
  if (!chartCanvas.value) return
  chartInstance = new Chart(chartCanvas.value, buildTimeSeriesChartConfig(() => props.metric))
}

function writeChartData(range: string, timestamps: string[], series: ModelSeries[], mutateInPlace: boolean) {
  if (!chartInstance) return
  const labels = timestamps.map((ts) => formatAxisLabel(ts, range))
  const datasets = buildDatasets(series)
  writeStackedDatasets(chartInstance, labels, datasets, mutateInPlace)
  syncLegend(datasets)
}

function applySeriesUpdate(metric: string, range: string, timestamps: string[], series: ModelSeries[]) {
  if (!chartInstance) createChart()
  if (!chartInstance) return

  const prevTs = lastTimestamps
  const prevLen = prevTs.length
  const shift = detectTimestampShift(prevTs, timestamps)
  const sameModels = modelsKey(series) === lastModelsKey && lastModelsKey !== ''
  const canSlide = shift > 0 && sameModels && prevLen > 0
  const isFirstPaint = prevLen === 0 || chartInstance.data.datasets.length === 0 || lastSeriesRaw.length === 0
  // Morph any non-slide update: metric switch, range switch, or model re-rank.
  // Do NOT require sameModels — USD/token reorders Top-N; ranges change membership.
  const canMorph = !isFirstPaint && !canSlide && timestamps.length > 0 && series.length > 0

  resetStageTransform()

  if (canMorph) {
    const labels = timestamps.map((ts) => formatAxisLabel(ts, range))
    // Bridge keeps previous metric tick format so Y labels don't flash wrong units / widths.
    if (lastPaintedMetric) setYTickFormat(chartInstance, lastPaintedMetric)
    const fromSeries = bridgeSeriesForMorph(lastSeriesRaw, series, labels.length)
    writeChartData(range, timestamps, fromSeries, false)
    chartInstance.update('none')
    // Apply target unit only with target values — then morph scale + shape together.
    setYTickFormat(chartInstance, metric)
    writeChartData(range, timestamps, series, true)
    // Runtime accepts custom transition names; Chart.js typings only list built-ins.
    chartInstance.update('morph' as 'none')
  } else {
    setYTickFormat(chartInstance, metric)
    writeChartData(range, timestamps, series, sameModels && chartInstance.data.datasets.length > 0)
    // First paint / empty / slide: no Chart.js tween.
    chartInstance.update('none')
    if (canSlide) playSlideLeft(shift, prevLen)
  }

  lastTimestamps = timestamps.slice()
  lastModelsKey = modelsKey(series)
  lastSeriesRaw = cloneSeries(series)
  lastPaintedMetric = metric
  lastDataKey = dataKey(timestamps, series, metric, range)
  pending.value = false
  pendingRange = range
  pendingMetric = metric
}

function onControlChange() {
  // Only mark pending — do NOT reformat ticks or reflow yet.
  // Premature unit switch on old values makes Y labels explode/shrink and jumps the time axis.
  pending.value = true
  pendingRange = props.timeRange
  pendingMetric = props.metric
}

function onDataChange() {
  const key = dataKey(props.timestamps, props.series, props.metric, props.timeRange)
  if (key === lastDataKey) {
    pending.value = false
    return
  }
  if (pending.value && (props.timeRange !== pendingRange || props.metric !== pendingMetric)) {
    return
  }
  applySeriesUpdate(props.metric, props.timeRange, props.timestamps, props.series)
}

watch(() => [props.metric, props.timeRange] as const, () => onControlChange())
watch(() => [props.timestamps, props.series] as const, () => nextTick(() => onDataChange()), { deep: true })

onMounted(() => nextTick(() => {
  createChart()
  if (props.timestamps.length || props.series.length) {
    applySeriesUpdate(props.metric, props.timeRange, props.timestamps, props.series)
  }
}))
onBeforeUnmount(() => {
  clearSlideTimer()
  chartInstance?.destroy()
  chartInstance = null
})
</script>
