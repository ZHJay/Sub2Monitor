package l2_flows

import (
	"testing"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

func TestAggregateHourlyProfileInvalidDays(t *testing.T) {
	filter := l0_axioms.MetricsFilter{IncludeCache: true}
	if _, err := AggregateHourlyProfile(nil, filter, 14, "UTC"); err == nil {
		t.Fatal("expected invalid days error")
	}
}

func TestBuildHourlyProfileResponseFillsAllHours(t *testing.T) {
	resp := buildHourlyProfileResponse(30, "Asia/Shanghai", nil, time.Date(2026, 7, 23, 12, 0, 0, 0, time.UTC))
	if resp.Days != 30 {
		t.Fatalf("days=%d want 30", resp.Days)
	}
	if resp.Timezone != "Asia/Shanghai" || resp.IntervalMin != 60 {
		t.Fatalf("metadata timezone=%s interval=%d", resp.Timezone, resp.IntervalMin)
	}
	if len(resp.Points) != 24 {
		t.Fatalf("points=%d want 24", len(resp.Points))
	}
	for i, p := range resp.Points {
		wantHour := time.Date(2026, 7, 23, i, 0, 0, 0, time.UTC).Format("15:04")
		if p.Hour != wantHour {
			t.Fatalf("point %d hour=%s want %s", i, p.Hour, wantHour)
		}
		if p.AvgTokens != 0 || p.PeakTokens != 0 || p.TotalTokens != 0 || p.MaxTokens != 0 || p.MinTokens != 0 || p.Q1Tokens != 0 || p.MedianTokens != 0 || p.Q3Tokens != 0 || p.Requests != 0 || p.Cost != 0 || p.ActiveDays != 0 {
			t.Fatalf("empty point %d not zero: %#v", i, p)
		}
	}
}

func TestBuildHourlyProfileResponseCalculatesAveragePeakQuantilesAndFilteredBounds(t *testing.T) {
	resp := buildHourlyProfileResponse(7, "UTC", []l0_axioms.HourlyProfileDailyAggregate{
		{Date: "2026-07-16", Hour: 9, Tokens: 100, Requests: 2, Cost: 0.1},
		{Date: "2026-07-17", Hour: 9, Tokens: 105, Requests: 2, Cost: 0.1},
		{Date: "2026-07-18", Hour: 9, Tokens: 110, Requests: 2, Cost: 0.1},
		{Date: "2026-07-19", Hour: 9, Tokens: 115, Requests: 2, Cost: 0.1},
		{Date: "2026-07-20", Hour: 9, Tokens: 120, Requests: 2, Cost: 0.1},
		{Date: "2026-07-21", Hour: 9, Tokens: 10000, Requests: 2, Cost: 1},
		{Date: "2026-07-16", Hour: 22, Tokens: 900, Requests: 3, Cost: 0.3},
		{Date: "2026-07-17", Hour: 22, Tokens: 1200, Requests: 4, Cost: 0.2},
		{Date: "2026-07-16", Hour: 99, Tokens: 9999, Requests: 99, Cost: 9.9},
	}, time.Date(2026, 7, 23, 12, 0, 0, 0, time.UTC))

	nine := resp.Points[9]
	if nine.Hour != "09:00" {
		t.Fatalf("hour=%s want 09:00", nine.Hour)
	}
	if nine.AvgTokens != float64(10550)/7 {
		t.Fatalf("avg=%f want %f", nine.AvgTokens, float64(10550)/7)
	}
	if nine.TotalTokens != 10550 || nine.PeakTokens != 10000 || nine.MaxTokens != 120 || nine.MinTokens != 100 || nine.Q1Tokens != 100 || nine.MedianTokens != 110 || nine.Q3Tokens != 115 || nine.Requests != 12 || nine.Cost != 1.5 || nine.ActiveDays != 6 {
		t.Fatalf("unexpected 09:00 stats: %#v", nine)
	}

	twentyTwo := resp.Points[22]
	if twentyTwo.AvgTokens != 300 || twentyTwo.TotalTokens != 2100 || twentyTwo.PeakTokens != 1200 || twentyTwo.MaxTokens != 1200 || twentyTwo.MinTokens != 0 || twentyTwo.Q1Tokens != 0 || twentyTwo.MedianTokens != 0 || twentyTwo.Q3Tokens != 0 || twentyTwo.ActiveDays != 2 {
		t.Fatalf("unexpected 22:00 stats: %#v", twentyTwo)
	}

	if resp.Points[23].TotalTokens != 0 {
		t.Fatalf("invalid hour aggregate should be ignored; 23:00=%#v", resp.Points[23])
	}
}

func TestFilteredProfileBoundsDropsBothSevereTails(t *testing.T) {
	min, max := filteredProfileBounds([]int64{0, 100, 105, 110, 115, 120, 10000})
	if min != 100 || max != 120 {
		t.Fatalf("bounds=%d..%d want 100..120", min, max)
	}
}

func TestAggregateHourlyProfileRejectsInvalidTimezone(t *testing.T) {
	filter := l0_axioms.MetricsFilter{IncludeCache: true}
	if _, err := AggregateHourlyProfile(nil, filter, 7, "not/a-timezone"); err == nil {
		t.Fatal("expected invalid timezone error")
	}
}
