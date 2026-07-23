package l1_blocks

import (
	"fmt"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"

	"gorm.io/gorm"
)

// GetHourlyProfileUsage aggregates usage by hour in timezone across [start, end).
// Contract: returns only non-empty hours; maxTokens is the maximum single-day total for that hour.
func GetHourlyProfileUsage(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64, start, end time.Time, timezone string) ([]l0_axioms.HourlyProfileAggregate, error) {
	if !end.After(start) {
		return []l0_axioms.HourlyProfileAggregate{}, nil
	}

	type row struct {
		Hour        int     `gorm:"column:hour"`
		TotalTokens int64   `gorm:"column:total_tokens"`
		MaxTokens   int64   `gorm:"column:max_tokens"`
		Requests    int64   `gorm:"column:requests"`
		Cost        float64 `gorm:"column:cost"`
		ActiveDays  int64   `gorm:"column:active_days"`
	}

	perDayHour := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID).
		Select(`date_trunc('day', created_at AT TIME ZONE ?) AS day,
			(extract(hour from created_at AT TIME ZONE ?))::int AS hour,
			COALESCE(SUM`+tokenExpr(filter)+`, 0) AS tokens,
			COALESCE(SUM(total_cost), 0) AS cost,
			COUNT(*) AS requests`, timezone, timezone).
		Where("created_at >= ? AND created_at < ?", start, end).
		Group("day, hour")

	var rows []row
	err := db.Table("(?) AS per_day_hour", perDayHour).
		Select(`hour,
			COALESCE(SUM(tokens), 0) AS total_tokens,
			COALESCE(MAX(tokens), 0) AS max_tokens,
			COALESCE(SUM(requests), 0) AS requests,
			COALESCE(SUM(cost), 0) AS cost,
			COUNT(*) AS active_days`).
		Group("hour").
		Order("hour ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("failed to query hourly profile usage: %w", err)
	}

	out := make([]l0_axioms.HourlyProfileAggregate, 0, len(rows))
	for _, r := range rows {
		out = append(out, l0_axioms.HourlyProfileAggregate{
			Hour:        r.Hour,
			TotalTokens: r.TotalTokens,
			MaxTokens:   r.MaxTokens,
			Requests:    r.Requests,
			Cost:        r.Cost,
			ActiveDays:  r.ActiveDays,
		})
	}
	return out, nil
}
