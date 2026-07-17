package l2_flows

import (
	"testing"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

func TestAggregateDailyHeatmapInvalidParams(t *testing.T) {
	filter := l0_axioms.MetricsFilter{IncludeCache: true}
	if _, err := AggregateDailyHeatmap(nil, filter, 400, "tokens"); err == nil {
		t.Fatal("expected days overflow error")
	}
	if _, err := AggregateDailyHeatmap(nil, filter, 7, "latency"); err == nil {
		t.Fatal("expected metric error")
	}
}

func TestBuildDailyHeatmapResponseFillsCalendarAndLevels(t *testing.T) {
	start := time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 17, 0, 0, 0, 0, time.UTC)
	aggregates := []l0_axioms.DailyUsageAggregate{
		{Date: time.Date(2026, 7, 12, 0, 0, 0, 0, time.UTC), Tokens: 100, Cost: 1.5, Requests: 3},
		{Date: time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC), Tokens: 900, Cost: 9, Requests: 12},
	}

	resp := buildDailyHeatmapResponse(7, "tokens", start, end, aggregates, time.Date(2026, 7, 16, 12, 0, 0, 0, time.UTC))
	if len(resp.Points) != 7 {
		t.Fatalf("points=%d want 7", len(resp.Points))
	}
	if resp.StartDate != "2026-07-10" || resp.EndDate != "2026-07-16" {
		t.Fatalf("window %s..%s", resp.StartDate, resp.EndDate)
	}

	var foundHot bool
	for _, p := range resp.Points {
		if p.Date == "2026-07-12" {
			if p.Tokens != 100 || p.Requests != 3 {
				t.Fatalf("mid day payload %#v", p)
			}
			if p.Level < 1 {
				t.Fatalf("positive day level=%d", p.Level)
			}
		}
		if p.Date == "2026-07-15" {
			foundHot = true
			if p.Level < 1 {
				t.Fatalf("hot day level=%d", p.Level)
			}
		}
		if p.Date == "2026-07-11" && p.Level != 0 {
			t.Fatalf("empty day level=%d", p.Level)
		}
	}
	if !foundHot {
		t.Fatal("missing hot day")
	}
}
