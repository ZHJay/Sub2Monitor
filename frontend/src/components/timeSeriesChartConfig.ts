import {
  type ChartConfiguration,
  type TooltipItem,
} from 'chart.js'
import {
  type StackedLineDataset,
  MORPH_EASING,
  MORPH_MS,
  Y_AXIS_WIDTH_PX,
  formatMetricValue,
} from './chartStackSeries'
import { type ChartChromeColors, readChartChromeColors } from '../theme/themeTokens'

// Layer: L1 积木层
// Boundary: Chart.js option factory only; no Vue / DOM / instance lifecycle.

/**
 * Build line-chart options.
 * Contract: `getMetric` is read at tooltip time so USD/token switches stay live.
 * Invariant: default duration is 0; only update('morph') enables stretch animation.
 */
export function buildTimeSeriesChartConfig(
  getMetric: () => string,
  chrome: ChartChromeColors = readChartChromeColors(),
): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0, easing: MORPH_EASING },
      animations: {
        // Keep x stable so length-matched morph is pure y stretch/shrink.
        x: false,
        colors: {
          type: 'color',
          properties: ['borderColor', 'backgroundColor'],
        },
        numbers: {
          type: 'number',
          properties: ['y', 'base'],
        },
      },
      transitions: {
        // Named mode for USD↔Tokens only. Time-range switches use CSS crossfade, not morph.
        morph: {
          animation: { duration: MORPH_MS, easing: MORPH_EASING },
          animations: {
            colors: {
              type: 'color',
              properties: ['borderColor', 'backgroundColor'],
              duration: MORPH_MS,
              easing: MORPH_EASING,
            },
            numbers: {
              type: 'number',
              properties: ['y', 'base'],
              duration: MORPH_MS,
              easing: MORPH_EASING,
            },
          },
        },
        active: { animation: { duration: 0 } },
        resize: { animation: { duration: 0 } },
        show: { animations: { numbers: { duration: 0 } } },
        hide: { animations: { numbers: { duration: 0 } } },
      },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: chrome.tooltipBg,
          titleColor: chrome.titleColor,
          bodyColor: chrome.bodyColor,
          footerColor: chrome.titleColor,
          borderColor: chrome.borderColor,
          borderWidth: 1,
          itemSort(a, b) {
            return (a.datasetIndex ?? 0) - (b.datasetIndex ?? 0)
          },
          callbacks: {
            label(ctx) {
              const ds = ctx.dataset as StackedLineDataset
              const raw = ds.rawValues?.[ctx.dataIndex] ?? 0
              return `${ctx.dataset.label}: ${formatMetricValue(raw, getMetric())}`
            },
            footer(items: TooltipItem<'line'>[]) {
              const total = items.reduce((acc, it) => {
                const ds = it.dataset as StackedLineDataset
                return acc + (ds.rawValues?.[it.dataIndex] ?? 0)
              }, 0)
              return `Total: ${formatMetricValue(total, getMetric())}`
            },
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          // Edge-to-edge categories so 1h/6h (few buckets) span the same plot width as 24h/7d.
          offset: false,
          bounds: 'ticks',
          grid: { display: false, offset: false },
          ticks: { color: chrome.tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, align: 'inner' },
          border: { color: chrome.axisBorder },
        },
        y: {
          stacked: false,
          beginAtZero: true,
          grid: { color: chrome.gridColor },
          ticks: { color: chrome.tickColor },
          border: { color: chrome.axisBorder },
          // Lock slot width: USD `$0.12` vs Tokens `12.3M` must not resize plot/time axis.
          afterFit(axis) {
            axis.width = Y_AXIS_WIDTH_PX
          },
        },
      },
    },
  }
}

/** Apply live theme chrome to an existing Chart.js instance without rebuild. */
export function applyChartChromeColors(
  chart: { options: ChartConfiguration<'line'>['options'] },
  chrome: ChartChromeColors = readChartChromeColors(),
): void {
  const opts = chart.options
  if (!opts) return
  const tooltip = opts.plugins?.tooltip
  if (tooltip) {
    tooltip.backgroundColor = chrome.tooltipBg
    tooltip.titleColor = chrome.titleColor
    tooltip.bodyColor = chrome.bodyColor
    tooltip.footerColor = chrome.titleColor
    tooltip.borderColor = chrome.borderColor
  }
  const x = opts.scales?.x
  const y = opts.scales?.y
  if (x && 'ticks' in x && x.ticks) x.ticks.color = chrome.tickColor
  if (x && 'border' in x && x.border) x.border.color = chrome.axisBorder
  if (y && 'ticks' in y && y.ticks) y.ticks.color = chrome.tickColor
  if (y && 'grid' in y && y.grid) y.grid.color = chrome.gridColor
  if (y && 'border' in y && y.border) y.border.color = chrome.axisBorder
}
