<template>
  <div class="rounded-2xl border border-apple-line bg-apple-surface p-5 shadow-glass backdrop-blur-xl">
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

    <!-- overflow hidden clips slide; stage opacity is driven inline for range crossfade -->
    <div class="relative h-72 overflow-hidden">
      <div ref="chartStage" class="absolute inset-0" style="opacity: 1; will-change: opacity, transform">
        <canvas ref="chartCanvas" role="img" :aria-label="chartAriaLabel"></canvas>
      </div>
      <div
        v-if="pending"
        class="pointer-events-none absolute inset-0 z-10 flex items-start justify-end p-2"
      >
        <span class="rounded-full border border-apple-line bg-apple-overlay px-2 py-1 text-[10px] text-apple-muted backdrop-blur-sm">
          updating…
        </span>
      </div>
    </div>

    <ul v-if="legendItems.length" class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      <li v-for="item in legendItems" :key="item.label" class="flex items-center gap-1.5 text-[11px] text-apple-row">
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
  CROSSFADE_MS,
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
import { applyChartChromeColors, buildTimeSeriesChartConfig } from './timeSeriesChartConfig'
import { useTheme } from '../composables/useTheme'

// Layer: L2 流程层 — slide / metric-morph / range-crossfade (never length-bridge).

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Filler, Tooltip)

const props = defineProps<{
  timestamps: string[]
  series: ModelSeries[]
  timeRange: string
  metric: string
}>()
defineEmits<{ 'update:timeRange': [value: string]; 'update:metric': [value: string] }>()

const { resolvedTheme } = useTheme()
const chartCanvas = ref<HTMLCanvasElement | null>(null)
const chartStage = ref<HTMLDivElement | null>(null)
let chartInstance: Chart<'line'> | null = null
let lastDataKey = ''
let lastTimestamps: string[] = []
let lastModelsKey = ''
/** Raw (non-cumulative) series from last paint — metric-morph bridge source. */
let lastSeriesRaw: ModelSeries[] = []
/** Metric / range of the currently painted frame. */
let lastPaintedMetric = ''
let lastPaintedRange = ''
const pending = ref(false)
let pendingRange = ''
let pendingMetric = ''
let slideTimer: number | null = null
let fadeTimer: number | null = null
let fadeGen = 0

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
    ? 'rounded-full bg-apple-green px-3 py-1.5 text-xs font-medium text-apple-green-ink'
    : 'rounded-full border border-apple-line bg-apple-surface-strong px-3 py-1.5 text-xs font-medium text-apple-muted hover:text-apple-text'
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

function clearFadeTimer() {
  if (fadeTimer != null) {
    window.clearTimeout(fadeTimer)
    fadeTimer = null
  }
}

function resetStageTransform() {
  const el = chartStage.value
  if (!el) return
  el.style.transition = 'none'
  el.style.transform = 'translateX(0)'
}

function resetStageOpacity() {
  const el = chartStage.value
  if (!el) return
  el.style.transition = 'none'
  el.style.opacity = '1'
}

/** Abort in-flight fade; optionally snap visible (metric/slide paths need a solid stage). */
function cancelCrossfade(resetOpacity = true) {
  fadeGen += 1
  clearFadeTimer()
  if (resetOpacity) resetStageOpacity()
}

function stageOpacity(): number {
  const el = chartStage.value
  if (!el) return 1
  const n = Number.parseFloat(getComputedStyle(el).opacity || '1')
  return Number.isFinite(n) ? n : 1
}

/** Force the browser to commit current inline styles before starting a transition. */
function commitStageStyle(el: HTMLElement) {
  void el.offsetWidth
}

/**
 * Begin range fade-out as soon as the pill is clicked (network still in flight).
 * Why: waiting until data arrives made the swap feel like a hard cut.
 */
function beginRangeFadeOut() {
  const el = chartStage.value
  if (!el) return
  const gen = ++fadeGen
  clearFadeTimer()
  el.style.transition = 'none'
  el.style.opacity = '1'
  commitStageStyle(el)
  requestAnimationFrame(() => {
    if (gen !== fadeGen || !chartStage.value) return
    chartStage.value.style.transition = `opacity ${CROSSFADE_MS}ms ease`
    chartStage.value.style.opacity = '0'
  })
}

/** After data already matches new window, offset stage right then ease back to 0 → content slides left. */
function playSlideLeft(shiftCount: number, prevLen: number) {
  const el = chartStage.value
  if (!el || !chartInstance || shiftCount <= 0 || prevLen <= 0) return

  const area = chartInstance.chartArea
  const plotWidth = Math.max(1, area.right - area.left)
  const shiftPx = (shiftCount / prevLen) * plotWidth

  clearSlideTimer()
  el.style.transition = 'none'
  el.style.transform = `translateX(${shiftPx}px)`
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

/**
 * Range switch: fade out → write real data → fade in.
 * Invariant: never paint a resampled old polyline on the new axis (假折线).
 * Why double-rAF / reflow: setting transition+opacity in the same frame after
 * `transition: none` is coalesced by the browser into a hard cut (no animation).
 */
function playCrossfadeSwap(apply: () => void) {
  const el = chartStage.value
  const gen = ++fadeGen
  if (!el) {
    apply()
    return
  }
  clearFadeTimer()

  const fadeIn = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (gen !== fadeGen || !chartStage.value) return
        const stage = chartStage.value
        stage.style.transition = `opacity ${CROSSFADE_MS}ms ease`
        stage.style.opacity = '1'
      })
    })
  }

  const swapThenIn = () => {
    if (gen !== fadeGen) return
    apply()
    fadeIn()
    fadeTimer = null
  }

  // Already hidden (early fade-out on pill click) → swap under cover, then fade in.
  if (stageOpacity() < 0.08) {
    swapThenIn()
    return
  }

  // Mid early-fade: keep going to 0 without snapping back to full opacity (that looked like no animation / a flash).
  if (stageOpacity() < 0.99) {
    el.style.transition = `opacity ${CROSSFADE_MS}ms ease`
    el.style.opacity = '0'
    fadeTimer = window.setTimeout(swapThenIn, CROSSFADE_MS)
    return
  }

  el.style.transition = 'none'
  el.style.opacity = '1'
  commitStageStyle(el)
  requestAnimationFrame(() => {
    if (gen !== fadeGen || !chartStage.value) return
    chartStage.value.style.transition = `opacity ${CROSSFADE_MS}ms ease`
    chartStage.value.style.opacity = '0'
    fadeTimer = window.setTimeout(swapThenIn, CROSSFADE_MS)
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

function commitPaintState(metric: string, range: string, timestamps: string[], series: ModelSeries[]) {
  lastTimestamps = timestamps.slice()
  lastModelsKey = modelsKey(series)
  lastSeriesRaw = cloneSeries(series)
  lastPaintedMetric = metric
  lastPaintedRange = range
  lastDataKey = dataKey(timestamps, series, metric, range)
  pending.value = false
  pendingRange = range
  pendingMetric = metric
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
  const rangeChanged = lastPaintedRange !== '' && range !== lastPaintedRange
  const metricChanged = lastPaintedMetric !== '' && metric !== lastPaintedMetric
  const canTransition = !isFirstPaint && !canSlide && timestamps.length > 0 && series.length > 0

  resetStageTransform()

  // Range always wins: 24h→6h etc. never morph / never paint resampled old shape.
  // Do NOT cancelCrossfade(reset) here — that snaps opacity to 1 and kills the fade.
  if (canTransition && rangeChanged) {
    const ts = timestamps.slice()
    const ser = cloneSeries(series)
    playCrossfadeSwap(() => {
      if (!chartInstance) return
      setYTickFormat(chartInstance, metric)
      writeChartData(range, ts, ser, false)
      chartInstance.update('none')
      commitPaintState(metric, range, ts, ser)
    })
    return
  }

  // Non-range paths need a fully visible stage.
  cancelCrossfade(true)

  // USD↔Tokens only: y/color morph on same bucket grid.
  if (canTransition && metricChanged) {
    const labelsLen = timestamps.length
    const sameLen = lastTimestamps.length === labelsLen
    if (lastPaintedMetric) setYTickFormat(chartInstance, lastPaintedMetric)
    if (sameLen) {
      // Align Top-N re-rank so morph has continuous stack; same-range so no time resample.
      const fromSeries = bridgeSeriesForMorph(lastSeriesRaw, series, labelsLen)
      writeChartData(range, timestamps, fromSeries, false)
      chartInstance.update('none')
    }
    setYTickFormat(chartInstance, metric)
    writeChartData(range, timestamps, series, sameLen)
    chartInstance.update('morph' as 'none')
    commitPaintState(metric, range, timestamps, series)
    return
  }

  setYTickFormat(chartInstance, metric)
  writeChartData(range, timestamps, series, sameModels && chartInstance.data.datasets.length > 0)
  chartInstance.update('none')
  if (canSlide) playSlideLeft(shift, prevLen)
  commitPaintState(metric, range, timestamps, series)
}

function onControlChange() {
  // Only mark pending — do NOT reformat ticks or reflow yet.
  pending.value = true
  pendingRange = props.timeRange
  pendingMetric = props.metric
  // Range pill: start fade-out immediately so the wait is not a static hard cut.
  if (lastPaintedRange !== '' && props.timeRange !== lastPaintedRange) {
    beginRangeFadeOut()
  } else if (lastPaintedMetric !== '' && props.metric !== lastPaintedMetric) {
    // Metric morph keeps the stage visible.
    cancelCrossfade(true)
  }
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
watch(resolvedTheme, () => {
  if (!chartInstance) return
  applyChartChromeColors(chartInstance)
  chartInstance.update('none')
})

onMounted(() => nextTick(() => {
  createChart()
  if (props.timestamps.length || props.series.length) {
    applySeriesUpdate(props.metric, props.timeRange, props.timestamps, props.series)
  }
}))
onBeforeUnmount(() => {
  cancelCrossfade()
  clearSlideTimer()
  chartInstance?.destroy()
  chartInstance = null
})
</script>
