import type { Chart } from 'chart.js'
import type { StackedLineDataset } from './chartStackSeries'

// Layer: L1 积木层
// Boundary: mutates Chart.js data only; caller owns update() mode (none / morph).

function writeNumbersInPlace(target: number[], src: number[]): void {
  for (let i = 0; i < src.length; i++) target[i] = src[i]
}

/**
 * Write labels + stacked datasets.
 * Why in-place number copies: replacing `data` arrays makes Chart.js treat points
 * as new elements (grow-from-0 / fade-like). Mutating values keeps meta for y-morph.
 */
export function writeStackedDatasets(
  chart: Chart<'line'>,
  labels: string[],
  datasets: StackedLineDataset[],
  mutateInPlace: boolean,
): void {
  if (
    mutateInPlace
    && Array.isArray(chart.data.labels)
    && chart.data.labels.length === labels.length
  ) {
    const lbls = chart.data.labels as unknown as string[]
    for (let i = 0; i < labels.length; i++) lbls[i] = labels[i]
  } else {
    chart.data.labels = labels
  }

  if (mutateInPlace && chart.data.datasets.length === datasets.length) {
    for (let i = 0; i < datasets.length; i++) {
      const target = chart.data.datasets[i] as StackedLineDataset
      const src = datasets[i]
      target.label = src.label
      if (Array.isArray(target.data) && target.data.length === src.data.length) {
        writeNumbersInPlace(target.data as number[], src.data)
      } else {
        target.data = src.data.slice()
      }
      if (Array.isArray(target.rawValues) && target.rawValues.length === src.rawValues.length) {
        writeNumbersInPlace(target.rawValues, src.rawValues)
      } else {
        target.rawValues = src.rawValues.slice()
      }
      target.borderColor = src.borderColor
      target.backgroundColor = src.backgroundColor
      target.fill = src.fill
    }
  } else {
    chart.data.datasets = datasets
  }
}
