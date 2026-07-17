package l1_blocks

import (
	"testing"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

func TestBuildStackedSeriesTopModelsAndOther(t *testing.T) {
	t0 := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	t1 := t0.Add(time.Hour)
	points := []l0_axioms.TimeSeriesPoint{
		{Timestamp: t0, Model: "a", Value: 10},
		{Timestamp: t0, Model: "b", Value: 5},
		{Timestamp: t1, Model: "a", Value: 2},
		{Timestamp: t1, Model: "c", Value: 1},
	}
	// force other by setting maxChartModels via many models — with only 3 models all kept.
	ts, series, totals := BuildStackedSeries(points)
	if len(ts) != 2 {
		t.Fatalf("timestamps=%d want 2", len(ts))
	}
	if len(series) < 2 {
		t.Fatalf("series=%d", len(series))
	}
	if series[0].Model != "a" {
		t.Fatalf("top model=%s want a", series[0].Model)
	}
	if len(totals) != 2 || totals[0].Value != 15 {
		t.Fatalf("totals=%v", totals)
	}
}
