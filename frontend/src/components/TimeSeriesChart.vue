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

    <div class="relative h-72 overflow-hidden">
      <!--
        Why: do NOT bind style.opacity here.
        Vue FULL_PROPS re-applies static style on every re-render (pending/legend),
        which overwrites WAAPI opacity mid range-fade → hard cut, no smooth anim.
        Opacity is owned exclusively by chartStageMotion.
      -->
      <div ref="chartStage" class="absolute inset-0">
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
  CHART_DISPLAY_POINTS,
  CROSSFADE_MS,
  SLIDE_MS,
  bridgeSeriesForMorph,
  buildDatasets,
  canLiveSlide,
  cloneSeries,
  dataKey,
  detectTimestampShift,
  formatAxisLabel,
  formatYAxisTick,
  modelsKey,
  normalizeSeriesForDisplay,
} from './chartStackSeries'
import { writeStackedDatasets } from './chartLineMutations'
import { applyChartChromeColors, buildTimeSeriesChartConfig } from './timeSeriesChartConfig'
import { createStageMotion } from './chartStageMotion'
import { useTheme } from '../composables/useTheme'

// Layer: L2 流程层 — live slide / Chart.js morph (range + metric).

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
/** Display-space raw series (length = CHART_DISPLAY_POINTS) for metric morph. */
let lastSeriesRaw: ModelSeries[] = []
let lastPaintedMetric = ''
let lastPaintedRange = ''
const pending = ref(false)
let pendingRange = ''
let pendingMetric = ''

const motion = createStageMotion({
  getStage: () => chartStage.value,
  crossfadeMs: CROSSFADE_MS,
})

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

/**
 * Persist paint identity from **API** series for dataKey stability.
 * Why: keying off resampled display endpoints made lastDataKey ≠ next props key,
 * so a second apply fired mid-fade, cancel()'d the animation, and hard-snapped.
 */
function commitPaintState(
  metric: string,
  range: string,
  apiTimestamps: string[],
  apiSeries: ModelSeries[],
  displaySeries: ModelSeries[],
) {
  lastTimestamps = apiTimestamps.slice()
  lastModelsKey = modelsKey(apiSeries)
  lastSeriesRaw = cloneSeries(displaySeries)
  lastPaintedMetric = metric
  lastPaintedRange = range
  lastDataKey = dataKey(apiTimestamps, apiSeries, metric, range)
  pending.value = false
  pendingRange = range
  pendingMetric = metric
}

function playSlideLeft(shiftCount: number, prevLen: number) {
  if (!chartInstance || shiftCount <= 0 || prevLen <= 0) return
  const area = chartInstance.chartArea
  const plotWidth = Math.max(1, area.right - area.left)
  const shiftPx = (shiftCount / prevLen) * plotWidth
  motion.playSlideLeft(shiftPx, SLIDE_MS)
}

function applySeriesUpdate(metric: string, range: string, timestamps: string[], series: ModelSeries[]) {
  if (!chartInstance) createChart()
  if (!chartInstance) return

  const display = normalizeSeriesForDisplay(timestamps, series, CHART_DISPLAY_POINTS)
  const prevTs = lastTimestamps
  const prevLen = prevTs.length
  const shift = detectTimestampShift(prevTs, timestamps)
  const sameModels = modelsKey(series) === lastModelsKey && lastModelsKey !== ''
  const rangeChanged = lastPaintedRange !== '' && range !== lastPaintedRange
  const metricChanged = lastPaintedMetric !== '' && metric !== lastPaintedMetric
  const canSlide = canLiveSlide({ rangeChanged, shift, sameModels, prevLen })
  const isFirstPaint = prevLen === 0 || chartInstance.data.datasets.length === 0 || lastSeriesRaw.length === 0
  const hasData = display.timestamps.length > 0 && display.series.length > 0
  const canTransition = !isFirstPaint && hasData

  motion.resetTransform()
  motion.cancel()

  // Range and/or USD↔Tokens: same Chart.js y-morph on fixed display grid.
  // Why: user wants curve stretch/shrink like metric switch, not opacity fade.
  // Invariant: both ends are CHART_DISPLAY_POINTS so morph is pure y (labels snap).
  // Risk: never paint a length-bridge of unequal bucket counts — only display-space.
  if (canTransition && (rangeChanged || metricChanged) && !canSlide) {
    if (metricChanged && lastPaintedMetric) {
      setYTickFormat(chartInstance, lastPaintedMetric)
    } else {
      setYTickFormat(chartInstance, metric)
    }
    // Bridge previous display y onto next model order; one none-frame then morph.
    const fromSeries = bridgeSeriesForMorph(lastSeriesRaw, display.series, CHART_DISPLAY_POINTS)
    writeChartData(range, display.timestamps, fromSeries, false)
    chartInstance.update('none')
    setYTickFormat(chartInstance, metric)
    writeChartData(range, display.timestamps, display.series, true)
    chartInstance.update('morph' as 'none')
    commitPaintState(metric, range, timestamps, series, display.series)
    return
  }

  setYTickFormat(chartInstance, metric)
  writeChartData(
    range,
    display.timestamps,
    display.series,
    sameModels && chartInstance.data.datasets.length > 0,
  )
  chartInstance.update('none')
  if (canSlide) playSlideLeft(shift, prevLen)

  if (!hasData && rangeChanged && !isFirstPaint) {
    pending.value = false
    return
  }
  commitPaintState(metric, range, timestamps, series, display.series)
}

function onControlChange() {
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
  motion.cancel()
  chartInstance?.destroy()
  chartInstance = null
})
</script>
