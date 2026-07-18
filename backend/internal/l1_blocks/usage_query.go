package l1_blocks

import (
	"fmt"
	"strings"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"

	"gorm.io/gorm"
)

// ResolveUserID looks up users.id by email (active rows only via unique partial index).
// Contract: empty email → (0, nil); unknown email → error.
func ResolveUserID(db *gorm.DB, email string) (int64, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return 0, nil
	}
	var user l0_axioms.User
	err := db.Model(&l0_axioms.User{}).
		Select("id, email").
		Where("LOWER(email) = ? AND deleted_at IS NULL", email).
		First(&user).Error
	if err != nil {
		return 0, fmt.Errorf("resolve user email: %w", err)
	}
	return user.ID, nil
}

func applyMetricsFilter(query *gorm.DB, filter l0_axioms.MetricsFilter, userID int64) *gorm.DB {
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	return query
}

func tokenExpr(filter l0_axioms.MetricsFilter) string {
	return l0_axioms.TokenSQL(filter.IncludeCache)
}

// GetTotalCost calculates the cumulative total cost from usage logs.
func GetTotalCost(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64) (float64, error) {
	var totalCost float64
	query := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID)
	err := query.Select("COALESCE(SUM(total_cost), 0)").Scan(&totalCost).Error
	if err != nil {
		return 0, fmt.Errorf("failed to query total cost: %w", err)
	}
	return totalCost, nil
}

// GetHourlyCost sums cost over the last 1 hour.
func GetHourlyCost(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64) (float64, error) {
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	var hourlyCost float64
	query := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID).
		Where("created_at >= ?", oneHourAgo)
	err := query.Select("COALESCE(SUM(total_cost), 0)").Scan(&hourlyCost).Error
	if err != nil {
		return 0, fmt.Errorf("failed to query hourly cost: %w", err)
	}
	return hourlyCost, nil
}

// GetTokenSummary aggregates total and cache token counters in one filtered scan.
func GetTokenSummary(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64) (l0_axioms.TokenSummary, error) {
	var summary l0_axioms.TokenSummary
	query := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID)
	selectSQL := "COALESCE(SUM" + tokenExpr(filter) + ", 0) AS total_tokens, " +
		"COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens, " +
		"COALESCE(SUM(input_tokens + cache_creation_tokens + cache_read_tokens), 0) AS cache_eligible_tokens"
	if err := query.Select(selectSQL).Scan(&summary).Error; err != nil {
		return summary, fmt.Errorf("failed to query token summary: %w", err)
	}
	return summary, nil
}

// GetRequestCount counts usage_logs rows under the filter.
func GetRequestCount(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64) (int64, error) {
	var count int64
	query := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID)
	err := query.Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("failed to query request count: %w", err)
	}
	return count, nil
}

// GetUsageTimeSeries retrieves time-bucketed aggregated data for charting.
func GetUsageTimeSeries(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64, timeRange, interval, metric string) ([]l0_axioms.TimeSeriesPoint, error) {
	startTime, err := GetTimeWindow(timeRange)
	if err != nil {
		return nil, err
	}
	intervalMinutes, err := GetIntervalMinutes(interval)
	if err != nil {
		return nil, err
	}

	query := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID)
	if !startTime.IsZero() {
		query = query.Where("created_at >= ?", startTime)
	}

	var selectClause string
	switch metric {
	case "cost":
		selectClause = fmt.Sprintf(
			"date_trunc('hour', created_at) + interval '%d minutes' * floor(extract(epoch from created_at - date_trunc('hour', created_at)) / 60 / %d) as timestamp, "+
				"COALESCE(SUM(total_cost), 0) as value",
			intervalMinutes, intervalMinutes,
		)
	case "tokens":
		selectClause = fmt.Sprintf(
			"date_trunc('hour', created_at) + interval '%d minutes' * floor(extract(epoch from created_at - date_trunc('hour', created_at)) / 60 / %d) as timestamp, "+
				"COALESCE(SUM%s, 0) as value",
			intervalMinutes, intervalMinutes, tokenExpr(filter),
		)
	default:
		return nil, fmt.Errorf("invalid metric: %s (valid: cost, tokens)", metric)
	}

	var points []l0_axioms.TimeSeriesPoint
	err = query.Select(selectClause).Group("timestamp").Order("timestamp ASC").Scan(&points).Error
	if err != nil {
		return nil, fmt.Errorf("failed to query time series: %w", err)
	}
	return points, nil
}

// GetUsageByModel aggregates usage statistics grouped by model.
func GetUsageByModel(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64) ([]l0_axioms.ModelStats, error) {
	var stats []l0_axioms.ModelStats
	query := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID)
	err := query.Select(
		"model, " +
			"COALESCE(SUM(total_cost), 0) as cost, " +
			"COALESCE(SUM" + tokenExpr(filter) + ", 0) as tokens, " +
			"COUNT(*) as requests",
	).Group("model").Order("cost DESC").Scan(&stats).Error
	if err != nil {
		return nil, fmt.Errorf("failed to query usage by model: %w", err)
	}
	return stats, nil
}

// GetDailyUsage aggregates usage_logs by UTC calendar day within [start, end).
func GetDailyUsage(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64, start, end time.Time) ([]l0_axioms.DailyUsageAggregate, error) {
	if !end.After(start) {
		return []l0_axioms.DailyUsageAggregate{}, nil
	}

	type row struct {
		Day      time.Time `gorm:"column:day"`
		Tokens   int64     `gorm:"column:tokens"`
		Cost     float64   `gorm:"column:cost"`
		Requests int64     `gorm:"column:requests"`
	}

	var rows []row
	query := applyMetricsFilter(db.Model(&l0_axioms.UsageLog{}), filter, userID)
	err := query.
		Select(`date_trunc('day', created_at AT TIME ZONE 'UTC') AS day,
			COALESCE(SUM`+tokenExpr(filter)+`, 0) AS tokens,
			COALESCE(SUM(total_cost), 0) AS cost,
			COUNT(*) AS requests`).
		Where("created_at >= ? AND created_at < ?", start, end).
		Group("day").
		Order("day ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("failed to query daily usage: %w", err)
	}

	out := make([]l0_axioms.DailyUsageAggregate, 0, len(rows))
	for _, r := range rows {
		out = append(out, l0_axioms.DailyUsageAggregate{
			Date:     r.Day.UTC(),
			Tokens:   r.Tokens,
			Cost:     r.Cost,
			Requests: r.Requests,
		})
	}
	return out, nil
}
