package l1_blocks

import (
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

// Layer: L1 积木层
// Boundary: pure time-bucket padding for chart windows; no DB.

// maxPaddedBuckets avoids exploding "all" into multi-year hourly grids.
const maxPaddedBuckets = 800

// AlignBucket matches SQL:
// date_trunc('hour', t) + interval 'N min' * floor(minutes / N)
func AlignBucket(t time.Time, intervalMin int) time.Time {
	if intervalMin <= 0 {
		return t.Truncate(time.Hour)
	}
	hour := t.Truncate(time.Hour)
	mins := t.Minute()
	bucket := (mins / intervalMin) * intervalMin
	return hour.Add(time.Duration(bucket) * time.Minute)
}

// GenerateWindowBuckets returns every aligned bucket in [start, end] inclusive.
func GenerateWindowBuckets(start, end time.Time, intervalMin int) []time.Time {
	if intervalMin <= 0 || end.Before(start) {
		return nil
	}
	cur := AlignBucket(start, intervalMin)
	endBucket := AlignBucket(end, intervalMin)
	// Estimate capacity; clamp later by maxPaddedBuckets caller.
	est := int(endBucket.Sub(cur)/(time.Duration(intervalMin)*time.Minute)) + 2
	if est < 1 {
		est = 1
	}
	if est > maxPaddedBuckets+1 {
		est = maxPaddedBuckets + 1
	}
	out := make([]time.Time, 0, est)
	step := time.Duration(intervalMin) * time.Minute
	for !cur.After(endBucket) {
		out = append(out, cur)
		if len(out) > maxPaddedBuckets {
			return nil // signal: too dense, skip pad
		}
		next := cur.Add(step)
		if !next.After(cur) {
			break
		}
		cur = next
	}
	return out
}

// PadStackedSeriesToWindow zero-fills missing buckets so the chart x-axis
// always spans the selected window edge-to-edge (no sparse "short" axis).
// Contract: if padding would exceed maxPaddedBuckets, returns inputs unchanged.
func PadStackedSeriesToWindow(
	timestamps []time.Time,
	series []l0_axioms.TimeSeriesModelSeries,
	totals []l0_axioms.TimeSeriesPoint,
	start, end time.Time,
	intervalMin int,
) (outTS []time.Time, outSeries []l0_axioms.TimeSeriesModelSeries, outTotals []l0_axioms.TimeSeriesPoint) {
	if intervalMin <= 0 {
		return timestamps, series, totals
	}
	// Prefer the location of observed buckets so generated keys match SQL/GORM times.
	loc := end.Location()
	if len(timestamps) > 0 {
		loc = timestamps[0].Location()
	}
	if start.IsZero() {
		if len(timestamps) == 0 {
			return timestamps, series, totals
		}
		start = timestamps[0]
	}
	start = start.In(loc)
	end = end.In(loc)
	if end.Before(start) {
		end = start
	}

	buckets := GenerateWindowBuckets(start, end, intervalMin)
	if buckets == nil || len(buckets) == 0 {
		return timestamps, series, totals
	}

	// Index existing buckets by aligned unix so sparse SQL rows still map.
	idx := make(map[int64]int, len(timestamps))
	for i, ts := range timestamps {
		idx[AlignBucket(ts.In(loc), intervalMin).Unix()] = i
	}

	outTS = buckets
	outSeries = make([]l0_axioms.TimeSeriesModelSeries, len(series))
	for si, s := range series {
		vals := make([]float64, len(buckets))
		for bi, b := range buckets {
			if oi, ok := idx[b.Unix()]; ok && oi < len(s.Values) {
				vals[bi] = s.Values[oi]
			}
		}
		outSeries[si] = l0_axioms.TimeSeriesModelSeries{Model: s.Model, Values: vals}
	}

	outTotals = make([]l0_axioms.TimeSeriesPoint, len(buckets))
	totalByIdx := make(map[int64]float64, len(totals))
	for _, p := range totals {
		totalByIdx[AlignBucket(p.Timestamp.In(loc), intervalMin).Unix()] = p.Value
	}
	for i, b := range buckets {
		outTotals[i] = l0_axioms.TimeSeriesPoint{Timestamp: b, Value: totalByIdx[b.Unix()]}
	}
	return outTS, outSeries, outTotals
}
