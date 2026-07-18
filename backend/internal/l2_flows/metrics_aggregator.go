package l2_flows

import (
	"fmt"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l1_blocks"

	"gorm.io/gorm"
)

// resolveFilterUserID maps optional email to user_id for L1 filters.
func resolveFilterUserID(db *gorm.DB, filter l0_axioms.MetricsFilter) (int64, error) {
	if filter.UserEmail == "" {
		return 0, nil
	}
	return l1_blocks.ResolveUserID(db, filter.UserEmail)
}

// AggregateSummaryMetrics collects all dashboard summary metrics under a filter.
func AggregateSummaryMetrics(db *gorm.DB, filter l0_axioms.MetricsFilter) (*l0_axioms.MetricsSummary, error) {
	userID, err := resolveFilterUserID(db, filter)
	if err != nil {
		return nil, err
	}
	totalCost, err := l1_blocks.GetTotalCost(db, filter, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get total cost: %w", err)
	}
	hourlyCost, err := l1_blocks.GetHourlyCost(db, filter, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get hourly cost: %w", err)
	}
	tokenSummary, err := l1_blocks.GetTokenSummary(db, filter, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get token summary: %w", err)
	}
	requestCount, err := l1_blocks.GetRequestCount(db, filter, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get request count: %w", err)
	}

	return &l0_axioms.MetricsSummary{
		TotalCost:   totalCost,
		HourlyCost:  hourlyCost,
		TotalTokens: tokenSummary.TotalTokens,
		CacheHitRate: l0_axioms.CalculateCacheHitRatePercent(
			tokenSummary.CacheReadTokens,
			tokenSummary.CacheEligibleTokens,
		),
		Requests:     l0_axioms.RequestStats{Total: requestCount, Success: requestCount, Failed: 0},
		IncludeCache: filter.IncludeCache,
		UserEmail:    filter.UserEmail,
		Timestamp:    time.Now(),
	}, nil
}

// AggregateTimeSeries retrieves stacked-by-model time series under a filter.
func AggregateTimeSeries(db *gorm.DB, filter l0_axioms.MetricsFilter, timeRange, interval, metric string) (*l0_axioms.TimeSeriesResponse, error) {
	userID, err := resolveFilterUserID(db, filter)
	if err != nil {
		return nil, err
	}
	points, err := l1_blocks.GetUsageTimeSeriesByModel(db, filter, userID, timeRange, interval, metric)
	if err != nil {
		return nil, fmt.Errorf("failed to get time series: %w", err)
	}
	timestamps, series, totals := l1_blocks.BuildStackedSeries(points)

	// Zero-fill the selected window so short ranges (1h/6h) and sparse data
	// still span the full chart width instead of a truncated axis.
	start, err := l1_blocks.GetTimeWindow(timeRange)
	if err != nil {
		return nil, err
	}
	intervalMin, err := l1_blocks.GetIntervalMinutes(interval)
	if err != nil {
		return nil, err
	}
	end := time.Now()
	timestamps, series, totals = l1_blocks.PadStackedSeriesToWindow(timestamps, series, totals, start, end, intervalMin)

	return &l0_axioms.TimeSeriesResponse{
		Timestamps:   timestamps,
		Series:       series,
		Data:         totals,
		Range:        timeRange,
		Interval:     interval,
		Metric:       metric,
		IncludeCache: filter.IncludeCache,
		UserEmail:    filter.UserEmail,
	}, nil
}

// AggregateModelStats retrieves and formats model statistics under a filter.
func AggregateModelStats(db *gorm.DB, filter l0_axioms.MetricsFilter) (*l0_axioms.ModelStatsResponse, error) {
	userID, err := resolveFilterUserID(db, filter)
	if err != nil {
		return nil, err
	}
	stats, err := l1_blocks.GetUsageByModel(db, filter, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get model stats: %w", err)
	}
	return &l0_axioms.ModelStatsResponse{
		Data:         stats,
		IncludeCache: filter.IncludeCache,
		UserEmail:    filter.UserEmail,
		Timestamp:    time.Now(),
	}, nil
}
