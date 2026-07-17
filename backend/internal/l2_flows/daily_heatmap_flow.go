package l2_flows

import (
	"fmt"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l1_blocks"

	"gorm.io/gorm"
)

const (
	defaultHeatmapDays = 365
	maxHeatmapDays     = 366
)

// AggregateDailyHeatmap builds a continuous UTC daily heatmap under a filter.
// Contract: days in [1,366]; metric tokens|cost (level always based on tokens).
// Boundary: missing days filled with zeros and level 0.
func AggregateDailyHeatmap(db *gorm.DB, filter l0_axioms.MetricsFilter, days int, metric string) (*l0_axioms.DailyHeatmapResponse, error) {
	if days <= 0 {
		days = defaultHeatmapDays
	}
	if days > maxHeatmapDays {
		return nil, fmt.Errorf("days must be <= %d", maxHeatmapDays)
	}
	if metric == "" {
		metric = "tokens"
	}
	if metric != "tokens" && metric != "cost" {
		return nil, fmt.Errorf("invalid metric: %s", metric)
	}

	userID, err := resolveFilterUserID(db, filter)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	endDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).Add(24 * time.Hour)
	startDay := endDay.AddDate(0, 0, -days)

	aggregates, err := l1_blocks.GetDailyUsage(db, filter, userID, startDay, endDay)
	if err != nil {
		return nil, err
	}

	resp := buildDailyHeatmapResponse(days, metric, startDay, endDay, aggregates, time.Now().UTC())
	resp.IncludeCache = filter.IncludeCache
	resp.UserEmail = filter.UserEmail
	return resp, nil
}

// buildDailyHeatmapResponse is pure calendar assembly for unit tests without Postgres.
func buildDailyHeatmapResponse(
	days int,
	metric string,
	startDay, endDay time.Time,
	aggregates []l0_axioms.DailyUsageAggregate,
	now time.Time,
) *l0_axioms.DailyHeatmapResponse {
	byDate := make(map[string]l0_axioms.DailyUsageAggregate, len(aggregates))
	for _, a := range aggregates {
		key := a.Date.UTC().Format("2006-01-02")
		byDate[key] = a
	}

	points := make([]l0_axioms.DailyHeatPoint, 0, days)
	for d := startDay; d.Before(endDay); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		if a, ok := byDate[key]; ok {
			points = append(points, l0_axioms.DailyHeatPoint{
				Date:     key,
				Tokens:   a.Tokens,
				Cost:     a.Cost,
				Requests: a.Requests,
			})
			continue
		}
		points = append(points, l0_axioms.DailyHeatPoint{Date: key})
	}

	levels, leveled := l0_axioms.AssignHeatLevels(points)
	return &l0_axioms.DailyHeatmapResponse{
		Metric:    metric,
		Days:      days,
		Timezone:  "UTC",
		StartDate: startDay.Format("2006-01-02"),
		EndDate:   endDay.AddDate(0, 0, -1).Format("2006-01-02"),
		Points:    leveled,
		Levels:    levels,
		Timestamp: now,
	}
}
