import type { Chart } from 'chart.js'
import type { StackedLineDataset } from './chartStackSeries'

// Layer: L1 积木层
// Boundary: mutates Chart.js data only; caller owns update() mode (none / morph).

/** Write labels + stacked datasets; mutate in place when counts match for morph continuity. */
export function writeStackedDatasets(
  chart: Chart<'line'>,
  labels: string[],
  datasets: StackedLineDataset[],
  mutateInPlace: boolean,
): void {
  chart.data.labels = labels
  if (mutateInPlace && chart.data.datasets.length === datasets.length) {
    for (let i = 0; i < datasets.length; i++) {
      const target = chart.data.datasets[i] as StackedLineDataset
      const src = datasets[i]
      target.label = src.label
      target.data = src.data
      target.rawValues = src.rawValues
      target.borderColor = src.borderColor
      target.backgroundColor = src.backgroundColor
      target.fill = src.fill
    }
  } else {
    chart.data.datasets = datasets
  }
}
