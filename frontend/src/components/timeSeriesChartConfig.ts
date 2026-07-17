import {
  type ChartConfiguration,
  type TooltipItem,
} from 'chart.js'
import {
  type StackedLineDataset,
  MORPH_EASING,
  MORPH_MS,
  formatMetricValue,
} from './chartStackSeries'

// Layer: L1 积木层
// Boundary: Chart.js option factory only; no Vue / DOM / instance lifecycle.

/**
 * Build line-chart options.
 * Contract: `getMetric` is read at tooltip time so USD/token switches stay live.
 * Invariant: default duration is 0; only update('morph') enables stretch animation.
 */
export function buildTimeSeriesChartConfig(
  getMetric: () => string,
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
        // Named mode for USD/token + time-range morphs.
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
          backgroundColor: 'rgba(28,28,30,0.96)',
          titleColor: '#f5f5f7',
          bodyColor: '#d1d1d6',
          footerColor: '#f5f5f7',
          borderColor: 'rgba(255,255,255,0.1)',
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
          ticks: { color: '#86868B', maxRotation: 0, autoSkip: true, maxTicksLimit: 8, align: 'inner' },
          border: { color: 'rgba(255,255,255,0.12)' },
        },
        y: {
          stacked: false,
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.08)' },
          ticks: { color: '#86868B' },
          border: { color: 'rgba(255,255,255,0.12)' },
        },
      },
    },
  }
}
