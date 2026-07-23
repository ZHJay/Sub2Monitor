package l2_flows

import (
	"testing"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

func TestAggregateHourlyProfileInvalidDays(t *testing.T) {
	filter := l0_axioms.MetricsFilter{IncludeCache: true}
	if _, err := AggregateHourlyProfile(nil, filter, 14); err == nil {
		t.Fatal("expected invalid days error")
	}
}

func TestBuildHourlyProfileResponseFillsAllHours(t *testing.T) {
	resp := buildHourlyProfileResponse(30, nil, time.Date(2026, 7, 23, 12, 0, 0, 0, time.UTC))
	if resp.Days != 30 {
		t.Fatalf("days=%d want 30", resp.Days)
	}
	if resp.Timezone != "UTC" || resp.IntervalMin != 60 {
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
		if p.AvgTokens != 0 || p.TotalTokens != 0 || p.MaxTokens != 0 || p.Requests != 0 || p.Cost != 0 || p.ActiveDays != 0 {
			t.Fatalf("empty point %d not zero: %#v", i, p)
		}
	}
}

func TestBuildHourlyProfileResponseCalculatesTotalsAveragesAndPeak(t *testing.T) {
	resp := buildHourlyProfileResponse(7, []l0_axioms.HourlyProfileAggregate{
		{Hour: 9, TotalTokens: 7000, MaxTokens: 3000, Requests: 14, Cost: 1.25, ActiveDays: 3},
		{Hour: 22, TotalTokens: 2100, MaxTokens: 1200, Requests: 7, Cost: 0.5, ActiveDays: 2},
		{Hour: 99, TotalTokens: 9999, MaxTokens: 9999, Requests: 99, Cost: 9.9, ActiveDays: 9},
	}, time.Date(2026, 7, 23, 12, 0, 0, 0, time.UTC))

	nine := resp.Points[9]
	if nine.Hour != "09:00" {
		t.Fatalf("hour=%s want 09:00", nine.Hour)
	}
	if nine.AvgTokens != 1000 {
		t.Fatalf("avg=%f want 1000", nine.AvgTokens)
	}
	if nine.TotalTokens != 7000 || nine.MaxTokens != 3000 || nine.Requests != 14 || nine.Cost != 1.25 || nine.ActiveDays != 3 {
		t.Fatalf("unexpected 09:00 stats: %#v", nine)
	}

	twentyTwo := resp.Points[22]
	if twentyTwo.AvgTokens != 300 || twentyTwo.TotalTokens != 2100 || twentyTwo.MaxTokens != 1200 || twentyTwo.ActiveDays != 2 {
		t.Fatalf("unexpected 22:00 stats: %#v", twentyTwo)
	}

	if resp.Points[23].TotalTokens != 0 {
		t.Fatalf("invalid hour aggregate should be ignored; 23:00=%#v", resp.Points[23])
	}
}
