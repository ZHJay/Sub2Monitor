import { describe, expect, it } from 'vitest'
import {
  detectTimestampShift,
  buildDatasets,
  resampleNumbers,
  bridgeSeriesForMorph,
  formatYAxisTick,
  normalizeSeriesForDisplay,
  padSeriesLayers,
  resampleTimestamps,
  canLiveSlide,
  CHART_DISPLAY_POINTS,
  CHART_STACK_LAYERS,
} from './chartStackSeries'

describe('detectTimestampShift', () => {
  it('returns 0 for identical window', () => {
    const ts = ['a', 'b', 'c']
    expect(detectTimestampShift(ts, ts)).toBe(0)
  })

  it('returns shift count when window slides forward', () => {
    const prev = ['t0', 't1', 't2', 't3']
    const next = ['t1', 't2', 't3', 't4']
    expect(detectTimestampShift(prev, next)).toBe(1)
  })

  it('returns -1 when series are unrelated', () => {
    expect(detectTimestampShift(['a', 'b'], ['x', 'y'])).toBe(-1)
  })
})

describe('canLiveSlide', () => {
  it('rejects slides when the range pill changed (subset windows look like slides)', () => {
    expect(canLiveSlide({
      rangeChanged: true,
      shift: 5,
      sameModels: true,
      prevLen: 24,
    })).toBe(false)
  })

  it('allows slides only for same-range live advance', () => {
    expect(canLiveSlide({
      rangeChanged: false,
      shift: 1,
      sameModels: true,
      prevLen: 24,
    })).toBe(true)
  })
})

describe('buildDatasets', () => {
  it('pre-stacks cumulative values and keeps raw', () => {
    const ds = buildDatasets([
      { model: 'a', values: [1, 2] },
      { model: 'b', values: [3, 4] },
    ])
    expect(ds).toHaveLength(2)
    expect(ds[0].data).toEqual([1, 2])
    expect(ds[1].data).toEqual([4, 6])
    expect(ds[0].rawValues).toEqual([1, 2])
    expect(ds[1].rawValues).toEqual([3, 4])
    expect(ds[0].fill).toBe('origin')
    expect(ds[1].fill).toBe('-1')
  })
})

describe('resampleNumbers', () => {
  it('returns a copy when length already matches', () => {
    const src = [1, 2, 3]
    const out = resampleNumbers(src, 3)
    expect(out).toEqual([1, 2, 3])
    expect(out).not.toBe(src)
  })

  it('interpolates when expanding', () => {
    expect(resampleNumbers([0, 10], 3)).toEqual([0, 5, 10])
  })

  it('interpolates when shrinking', () => {
    expect(resampleNumbers([0, 5, 10, 15], 2)).toEqual([0, 15])
  })

  it('fills zeros from empty source', () => {
    expect(resampleNumbers([], 4)).toEqual([0, 0, 0, 0])
  })
})

describe('bridgeSeriesForMorph', () => {
  it('reorders previous models onto next order and resamples length', () => {
    const previous = [
      { model: 'b', values: [0, 10] },
      { model: 'a', values: [0, 4] },
    ]
    const next = [
      { model: 'a', values: [1, 2, 3] },
      { model: 'c', values: [9, 9, 9] },
    ]
    const bridged = bridgeSeriesForMorph(previous, next, 3)
    expect(bridged.map((s) => s.model)).toEqual(['a', 'c'])
    expect(bridged[0].values).toEqual([0, 2, 4])
    expect(bridged[1].values).toEqual([0, 0, 0])
  })
})

describe('formatYAxisTick', () => {
  it('keeps cost ticks compact', () => {
    expect(formatYAxisTick(0.12, 'cost')).toBe('$0.12')
    expect(formatYAxisTick(12.5, 'cost')).toBe('$12.5')
    expect(formatYAxisTick(1500, 'cost')).toBe('$1.5K')
  })

  it('formats token ticks with K/M/B and two decimals', () => {
    expect(formatYAxisTick(900, 'tokens')).toBe('900')
    expect(formatYAxisTick(12_500, 'tokens')).toBe('12.50K')
    expect(formatYAxisTick(2_500_000, 'tokens')).toBe('2.50M')
    expect(formatYAxisTick(1_250_000_000, 'tokens')).toBe('1.25B')
  })
})

describe('normalizeSeriesForDisplay', () => {
  it('maps any window onto fixed display length', () => {
    const timestamps = ['a', 'b', 'c', 'd']
    const series = [{ model: 'm', values: [0, 10, 0, 20] }]
    const out = normalizeSeriesForDisplay(timestamps, series, 8)
    expect(out.timestamps).toHaveLength(8)
    expect(out.series[0].values).toHaveLength(8)
    expect(out.series[0].values[0]).toBe(0)
    expect(out.series[0].values[7]).toBe(20)
  })

  it('default length is CHART_DISPLAY_POINTS', () => {
    const out = normalizeSeriesForDisplay(['t0', 't1'], [{ model: 'm', values: [1, 2] }])
    expect(out.timestamps).toHaveLength(CHART_DISPLAY_POINTS)
    expect(out.series[0].values).toHaveLength(CHART_DISPLAY_POINTS)
  })
})

describe('padSeriesLayers', () => {
  it('pads to CHART_STACK_LAYERS with empty models and zeros', () => {
    const out = padSeriesLayers(
      [{ model: 'a', values: [1, 2] }],
      CHART_STACK_LAYERS,
      2,
    )
    expect(out).toHaveLength(CHART_STACK_LAYERS)
    expect(out[0]).toEqual({ model: 'a', values: [1, 2] })
    expect(out[1]).toEqual({ model: '', values: [0, 0] })
    expect(out.every((s) => s.values.length === 2)).toBe(true)
  })

  it('truncates when more than layer cap', () => {
    const series = Array.from({ length: 12 }, (_, i) => ({
      model: `m${i}`,
      values: [i],
    }))
    const out = padSeriesLayers(series, 9, 1)
    expect(out).toHaveLength(9)
    expect(out[8].model).toBe('m8')
  })
})

describe('resampleTimestamps', () => {
  it('keeps endpoints', () => {
    expect(resampleTimestamps(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'd'])
  })
})
