package l1_blocks

import (
	"fmt"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"

	"gorm.io/gorm"
)

// GetHalfHourUsage aggregates usage into 30-minute UTC buckets for [start, end).
// Contract: returns only non-empty buckets; SlotIndex is 0..47 from day start.
// Why: powers the day drill-down contribution grid without shipping raw rows.
func GetHalfHourUsage(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64, start, end time.Time) ([]l0_axioms.HalfHourAggregate, error) {
	if !end.After(start) {
		return []l0_axioms.HalfHourAggregate{}, nil
	}

	type row struct {
		Bucket   time.Time `gorm:"column:bucket"`
		Tokens   int64     `gorm:"column:tokens"`
		Cost     float64   `gorm:"column:cost"`
		Requests int64     `gorm:"column:requests"`
	}

	var rows []row
	query := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID)
	// 30-minute buckets in UTC.
	err := query.
		Select(`date_trunc('hour', created_at AT TIME ZONE 'UTC')
			+ make_interval(mins => (floor(extract(minute from created_at AT TIME ZONE 'UTC') / 30) * 30)::int) AS bucket,
			COALESCE(SUM`+tokenExpr(filter)+`, 0) AS tokens,
			COALESCE(SUM(total_cost), 0) AS cost,
			COUNT(*) AS requests`).
		Where("created_at >= ? AND created_at < ?", start, end).
		Group("bucket").
		Order("bucket ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("failed to query half-hour usage: %w", err)
	}

	out := make([]l0_axioms.HalfHourAggregate, 0, len(rows))
	for _, r := range rows {
		bucket := r.Bucket.UTC()
		mins := bucket.Hour()*60 + bucket.Minute()
		out = append(out, l0_axioms.HalfHourAggregate{
			SlotIndex: mins / 30,
			Tokens:    r.Tokens,
			Cost:      r.Cost,
			Requests:  r.Requests,
		})
	}
	return out, nil
}
