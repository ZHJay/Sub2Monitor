import { describe, expect, it } from 'vitest'
import { detectTimestampShift, buildDatasets } from './chartStackSeries'

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
