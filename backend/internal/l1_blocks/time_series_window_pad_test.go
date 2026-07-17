package l1_blocks

import (
	"testing"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

func TestAlignBucket15Min(t *testing.T) {
	in := time.Date(2026, 7, 1, 10, 22, 30, 0, time.UTC)
	got := AlignBucket(in, 15)
	want := time.Date(2026, 7, 1, 10, 15, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestPadStackedSeriesToWindowFillsGaps(t *testing.T) {
	start := time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC)
	end := start.Add(45 * time.Minute)
	// Only first and last 15m buckets have data — middle two missing.
	ts := []time.Time{start, start.Add(45 * time.Minute)}
	series := []l0_axioms.TimeSeriesModelSeries{
		{Model: "a", Values: []float64{3, 7}},
	}
	totals := []l0_axioms.TimeSeriesPoint{
		{Timestamp: start, Value: 3},
		{Timestamp: start.Add(45 * time.Minute), Value: 7},
	}

	outTS, outSeries, outTotals := PadStackedSeriesToWindow(ts, series, totals, start, end, 15)
	if len(outTS) != 4 {
		t.Fatalf("buckets=%d want 4: %v", len(outTS), outTS)
	}
	if len(outSeries) != 1 || len(outSeries[0].Values) != 4 {
		t.Fatalf("series values=%v", outSeries)
	}
	if outSeries[0].Values[0] != 3 || outSeries[0].Values[1] != 0 || outSeries[0].Values[2] != 0 || outSeries[0].Values[3] != 7 {
		t.Fatalf("values=%v", outSeries[0].Values)
	}
	if len(outTotals) != 4 || outTotals[1].Value != 0 || outTotals[3].Value != 7 {
		t.Fatalf("totals=%v", outTotals)
	}
}

func TestPadStackedSeriesToWindowEmptyDataStillSpansWindow(t *testing.T) {
	start := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	end := start.Add(time.Hour)
	outTS, outSeries, outTotals := PadStackedSeriesToWindow(nil, nil, nil, start, end, 15)
	if len(outTS) != 5 { // 12:00,15,30,45,13:00
		t.Fatalf("buckets=%d want 5: %v", len(outTS), outTS)
	}
	if len(outSeries) != 0 || len(outTotals) != 5 {
		t.Fatalf("series=%d totals=%d", len(outSeries), len(outTotals))
	}
}
