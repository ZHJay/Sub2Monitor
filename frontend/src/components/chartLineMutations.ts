import type { Chart } from 'chart.js'
import {
  type StackedLineDataset,
  resampleNumbers,
} from './chartStackSeries'

// Layer: L1 积木层
// Boundary: mutates Chart.js data only; caller owns update() mode (none / morph).

/**
 * Align live series length to `targetLen` without a painted jump.
 * Contract: call only when dataset count is stable; then write real data + morph.
 */
export function reindexDatasetsToLength(
  chart: Chart<'line'>,
  targetLen: number,
  labels: string[],
): void {
  if (targetLen <= 0) return
  const datasets = chart.data.datasets as StackedLineDataset[]
  for (const ds of datasets) {
    const data = Array.isArray(ds.data) ? (ds.data as number[]) : []
    if (data.length !== targetLen) ds.data = resampleNumbers(data, targetLen)
    const raw = Array.isArray(ds.rawValues) ? ds.rawValues : []
    if (raw.length !== targetLen) ds.rawValues = resampleNumbers(raw, targetLen)
  }
  chart.data.labels = labels
  chart.update('none')
}

/** Write labels + stacked datasets; mutate in place when lengths match for morph continuity. */
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
