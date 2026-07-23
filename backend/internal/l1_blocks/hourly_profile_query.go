package l1_blocks

import (
	"fmt"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"

	"gorm.io/gorm"
)

// GetHourlyProfileDailyUsage returns one non-empty local day/hour total across [start, end).
// Boundary: L2 owns empty-day padding and outlier-filtered range calculation.
func GetHourlyProfileDailyUsage(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64, start, end time.Time, timezone string) ([]l0_axioms.HourlyProfileDailyAggregate, error) {
	if !end.After(start) {
		return []l0_axioms.HourlyProfileDailyAggregate{}, nil
	}

	type row struct {
		Date     string  `gorm:"column:date"`
		Hour     int     `gorm:"column:hour"`
		Tokens   int64   `gorm:"column:tokens"`
		Requests int64   `gorm:"column:requests"`
		Cost     float64 `gorm:"column:cost"`
	}

	var rows []row
	err := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID).
		Select(`to_char(created_at AT TIME ZONE ?, 'YYYY-MM-DD') AS date,
			(extract(hour from created_at AT TIME ZONE ?))::int AS hour,
			COALESCE(SUM`+tokenExpr(filter)+`, 0) AS tokens,
			COALESCE(SUM(total_cost), 0) AS cost,
			COUNT(*) AS requests`, timezone, timezone).
		Where("created_at >= ? AND created_at < ?", start, end).
		Group("date, hour").
		Order("date ASC, hour ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("failed to query hourly profile daily usage: %w", err)
	}

	out := make([]l0_axioms.HourlyProfileDailyAggregate, 0, len(rows))
	for _, r := range rows {
		out = append(out, l0_axioms.HourlyProfileDailyAggregate{
			Date:     r.Date,
			Hour:     r.Hour,
			Tokens:   r.Tokens,
			Requests: r.Requests,
			Cost:     r.Cost,
		})
	}
	return out, nil
}
