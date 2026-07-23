<template>
  <section class="rounded-2xl border border-apple-line bg-apple-surface p-5 shadow-glass backdrop-blur-xl">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-[15px] font-semibold tracking-tight text-apple-text">Hourly usage profile</h2>
        <p class="mt-1 text-xs text-apple-muted">
          过去 {{ days }} 天 · {{ timezone }} · IQR = P25–P75；箱线须为 Tukey-filtered inlier range
        </p>
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
      <dl class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <div v-for="item in summaryItems" :key="item.label" class="rounded-xl border border-apple-line bg-apple-surface-strong px-3 py-2">
          <dt class="text-[10px] uppercase tracking-[0.06em] text-apple-muted">{{ item.label }}</dt>
          <dd class="mt-1 truncate text-sm font-semibold text-apple-text">{{ item.value }}</dd>
          <p v-if="item.detail" class="mt-0.5 truncate text-[10px] text-apple-muted">{{ item.detail }}</p>
        </div>
      </dl>

      <figure class="rounded-xl border border-apple-line bg-apple-surface-strong p-3">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <figcaption class="text-[11px] uppercase tracking-[0.06em] text-apple-muted">
            Mean hourly tokens with interquartile band
          </figcaption>
          <p class="text-[10px] text-apple-muted">阴影带：P25–P75；虚线：median；实线：mean</p>
        </div>
        <div class="h-80">
          <canvas ref="canvas" role="img" :aria-label="`Mean token usage with P25 to P75 interquartile range by ${timezone} hour over the past ${days} days`"></canvas>
        </div>
      </figure>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <figure class="rounded-xl border border-apple-line bg-apple-surface-strong p-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <figcaption class="text-[11px] uppercase tracking-[0.06em] text-apple-muted">
              Hourly distribution boxplot
            </figcaption>
            <p class="text-[10px] text-apple-muted">box = IQR · line = median · dot = mean</p>
          </div>
          <div class="overflow-hidden">
            <svg
              class="h-auto w-full overflow-visible"
              :viewBox="`0 0 ${BOXPLOT_WIDTH} ${BOXPLOT_HEIGHT}`"
              role="img"
              :aria-label="`Boxplot strip of hourly token distribution over ${days} days`"
            >
              <g v-for="tick in boxPlotTicks" :key="tick.value">
                <line
                  :x1="BOXPLOT_LEFT"
                  :x2="BOXPLOT_RIGHT"
                  :y1="tick.y"
                  :y2="tick.y"
                  stroke="var(--apple-grid)"
                  stroke-width="1"
                />
                <text
                  :x="BOXPLOT_LEFT - 8"
                  :y="tick.y + 4"
                  text-anchor="end"
                  class="fill-apple-muted text-[10px]"
                >{{ tick.label }}</text>
              </g>
              <line
                :x1="BOXPLOT_LEFT"
                :x2="BOXPLOT_RIGHT"
                :y1="BOXPLOT_BOTTOM"
                :y2="BOXPLOT_BOTTOM"
                stroke="var(--apple-axis)"
                stroke-width="1"
              />
              <g v-for="box in boxPlotView" :key="box.hour">
                <line
                  :x1="box.x"
                  :x2="box.x"
                  :y1="box.yMin"
                  :y2="box.yMax"
                  stroke="rgb(var(--apple-muted))"
                  stroke-width="1.2"
                />
                <line
                  :x1="box.x - box.whiskerWidth"
                  :x2="box.x + box.whiskerWidth"
                  :y1="box.yMin"
                  :y2="box.yMin"
                  stroke="rgb(var(--apple-muted))"
                  stroke-width="1.2"
                />
                <line
                  :x1="box.x - box.whiskerWidth"
                  :x2="box.x + box.whiskerWidth"
                  :y1="box.yMax"
                  :y2="box.yMax"
                  stroke="rgb(var(--apple-muted))"
                  stroke-width="1.2"
                />
                <rect
                  :x="box.x - box.boxWidth / 2"
                  :y="box.yQ3"
                  :width="box.boxWidth"
                  :height="Math.max(1, box.yQ1 - box.yQ3)"
                  rx="2"
                  fill="rgba(48, 209, 88, 0.16)"
                  stroke="rgb(var(--apple-green))"
                  stroke-width="1"
                />
                <line
                  :x1="box.x - box.boxWidth / 2"
                  :x2="box.x + box.boxWidth / 2"
                  :y1="box.yMedian"
                  :y2="box.yMedian"
                  stroke="rgb(var(--apple-green))"
                  stroke-width="1.8"
                />
                <circle :cx="box.x" :cy="box.yMean" r="2.4" fill="#ff9f0a">
                  <title>{{ box.hour }} mean {{ box.meanLabel }}</title>
                </circle>
                <text
                  v-if="box.showHour"
                  :x="box.x"
                  :y="BOXPLOT_BOTTOM + 18"
                  text-anchor="middle"
                  class="fill-apple-muted text-[10px]"
                >{{ box.hour.replace(':00', '') }}</text>
              </g>
            </svg>
          </div>
        </figure>

        <figure class="rounded-xl border border-apple-line bg-apple-surface-strong p-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <figcaption class="text-[11px] uppercase tracking-[0.06em] text-apple-muted">
              Statistic heatmap
            </figcaption>
            <p class="text-[10px] text-apple-muted">每一行单独归一化，颜色越深表示该统计量越高</p>
          </div>
          <div class="overflow-hidden">
            <div class="space-y-1">
              <div
                v-for="row in heatmapRows"
                :key="row.label"
                class="grid items-center gap-0.5 sm:gap-1"
                :style="{ gridTemplateColumns: heatmapGridColumns }"
              >
                <div class="truncate pr-2 text-[10px] uppercase tracking-[0.04em] text-apple-muted">{{ row.label }}</div>
                <div
                  v-for="cell in row.cells"
                  :key="`${row.label}-${cell.hour}`"
                  class="h-5 rounded-[3px] border border-apple-line sm:h-6 sm:rounded-[4px]"
                  :style="{ background: heatCellBackground(cell.intensity) }"
                  :title="`${cell.hour} · ${row.label}: ${cell.label}`"
                ></div>
              </div>
              <div class="grid items-center gap-0.5 pt-1 sm:gap-1" :style="{ gridTemplateColumns: heatmapGridColumns }">
                <div></div>
                <div
                  v-for="point in points"
                  :key="`hour-${point.hour}`"
                  class="text-center text-[8px] text-apple-muted sm:text-[9px]"
                >{{ showHeatmapHour(point.hour) ? point.hour.replace(':00', '') : '' }}</div>
              </div>
            </div>
          </div>
        </figure>
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
import {
  buildHourlyProfileBoxPlotPoints,
  buildHourlyProfileHeatmapRows,
  buildHourlyProfileSummary,
  hourlyProfileScaleMax,
  type HourlyProfileBoxPlotPoint,
} from '../metrics/hourlyProfilePresentation'
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

const BOXPLOT_WIDTH = 960
const BOXPLOT_HEIGHT = 178
const BOXPLOT_LEFT = 52
const BOXPLOT_RIGHT = 944
const BOXPLOT_TOP = 16
const BOXPLOT_BOTTOM = 138

const dayOptions = [7, 30, 90, 365]
const canvas = ref<HTMLCanvasElement | null>(null)
const { resolvedTheme } = useTheme()
let chart: Chart<'line'> | null = null

const summaryItems = computed(() => buildHourlyProfileSummary(props.points, props.days))
const heatmapRows = computed(() => buildHourlyProfileHeatmapRows(props.points, props.days))
const heatmapGridColumns = computed(() => `clamp(3.6rem, 18%, 6rem) repeat(${Math.max(props.points.length, 1)}, minmax(0, 1fr))`)
const boxPlotPoints = computed(() => buildHourlyProfileBoxPlotPoints(props.points))
const boxPlotScaleMax = computed(() => hourlyProfileScaleMax(boxPlotPoints.value))
const boxPlotTicks = computed(() => [0, boxPlotScaleMax.value / 2, boxPlotScaleMax.value].map((value) => ({
  value,
  y: boxPlotY(value, boxPlotScaleMax.value),
  label: formatCompactCount(value),
})))
const boxPlotView = computed(() => {
  const points = boxPlotPoints.value
  const plotWidth = BOXPLOT_RIGHT - BOXPLOT_LEFT
  const slot = plotWidth / Math.max(points.length - 1, 1)
  const boxWidth = Math.min(22, Math.max(10, slot * 0.55))
  return points.map((point, index) => {
    const x = BOXPLOT_LEFT + slot * index
    return buildBoxPlotViewPoint(point, x, boxWidth, index)
  })
})

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
          label: 'P25',
          data: props.points.map((point) => point.q1Tokens),
          borderColor: 'rgba(48, 209, 88, 0)',
          backgroundColor: 'rgba(48, 209, 88, 0)',
          borderWidth: 0,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.25,
        },
        {
          label: 'P75',
          data: props.points.map((point) => point.q3Tokens),
          borderColor: 'rgba(48, 209, 88, 0.18)',
          backgroundColor: 'rgba(48, 209, 88, 0.16)',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 3,
          fill: '-1',
          tension: 0.25,
        },
        {
          label: 'Median',
          data: props.points.map((point) => point.medianTokens),
          borderColor: '#64d2ff',
          borderDash: [4, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.2,
        },
        {
          label: 'Mean',
          data: props.points.map((point) => point.avgTokens),
          borderColor: '#30d158',
          backgroundColor: '#30d158',
          borderWidth: 2.5,
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.25,
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
            footer(items) {
              const point = props.points[items[0]?.dataIndex ?? 0]
              if (!point) return ''
              return `IQR = P25–P75 · whiskers = Tukey-filtered inlier range · active ${point.activeDays}/${props.days} days`
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

function boxPlotY(value: number, scaleMax: number): number {
  const ratio = Math.max(0, Math.min(1, value / Math.max(scaleMax, 1)))
  return BOXPLOT_BOTTOM - ratio * (BOXPLOT_BOTTOM - BOXPLOT_TOP)
}

function buildBoxPlotViewPoint(point: HourlyProfileBoxPlotPoint, x: number, boxWidth: number, index: number) {
  const yMin = boxPlotY(point.min, boxPlotScaleMax.value)
  const yMax = boxPlotY(point.max, boxPlotScaleMax.value)
  return {
    hour: point.hour,
    x,
    boxWidth,
    whiskerWidth: Math.max(4, boxWidth * 0.35),
    yMin,
    yMax,
    yQ1: boxPlotY(point.q1, boxPlotScaleMax.value),
    yMedian: boxPlotY(point.median, boxPlotScaleMax.value),
    yQ3: boxPlotY(point.q3, boxPlotScaleMax.value),
    yMean: boxPlotY(point.mean, boxPlotScaleMax.value),
    meanLabel: `${formatCompactCount(point.mean)} tokens`,
    showHour: index % 3 === 0,
  }
}

function heatCellBackground(intensity: number): string {
  const percent = Math.round(8 + Math.max(0, Math.min(1, intensity)) * 74)
  return `color-mix(in srgb, rgb(var(--apple-green)) ${percent}%, var(--apple-surface-strong))`
}

function showHeatmapHour(hour: string): boolean {
  return Number(hour.slice(0, 2)) % 3 === 0
}

watch(() => [props.points, props.loading, props.error] as const, () => nextTick(renderChart), { deep: true })
watch(resolvedTheme, () => nextTick(renderChart))

onMounted(() => nextTick(renderChart))
onBeforeUnmount(() => chart?.destroy())
</script>
