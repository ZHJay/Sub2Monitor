package l1_blocks

import (
	"fmt"
	"sort"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"

	"gorm.io/gorm"
)

const maxChartModels = 8

// GetUsageTimeSeriesByModel returns bucketed usage split by model for stacked charts.
// Contract: points include model; empty models become "unknown".
// Why: frontend stacked area needs per-model series, not only totals.
func GetUsageTimeSeriesByModel(db *gorm.DB, filter l0_axioms.MetricsFilter, userID int64, timeRange, interval, metric string) ([]l0_axioms.TimeSeriesPoint, error) {
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

	var valueExpr string
	switch metric {
	case "cost":
		valueExpr = "COALESCE(SUM(total_cost), 0)"
	case "tokens":
		valueExpr = "COALESCE(SUM" + tokenExpr(filter) + ", 0)"
	default:
		return nil, fmt.Errorf("invalid metric: %s (valid: cost, tokens)", metric)
	}

	selectClause := fmt.Sprintf(
		"date_trunc('hour', created_at) + interval '%d minutes' * floor(extract(epoch from created_at - date_trunc('hour', created_at)) / 60 / %d) as timestamp, "+
			"COALESCE(NULLIF(model, ''), 'unknown') as model, "+
			"%s as value",
		intervalMinutes, intervalMinutes, valueExpr,
	)

	var points []l0_axioms.TimeSeriesPoint
	err = query.Select(selectClause).
		Group("timestamp, model").
		Order("timestamp ASC, model ASC").
		Scan(&points).Error
	if err != nil {
		return nil, fmt.Errorf("failed to query model time series: %w", err)
	}
	return points, nil
}

// BuildStackedSeries pivots raw (timestamp, model, value) rows into chart series.
// Contract: keeps top maxChartModels models by total; remainder merges into "other".
func BuildStackedSeries(points []l0_axioms.TimeSeriesPoint) (timestamps []time.Time, series []l0_axioms.TimeSeriesModelSeries, totals []l0_axioms.TimeSeriesPoint) {
	if len(points) == 0 {
		return nil, nil, nil
	}

	// Totals per model for ranking.
	modelTotals := map[string]float64{}
	tsSet := map[int64]time.Time{}
	for _, p := range points {
		model := p.Model
		if model == "" {
			model = "unknown"
		}
		modelTotals[model] += p.Value
		tsSet[p.Timestamp.Unix()] = p.Timestamp
	}

	type ranked struct {
		model string
		total float64
	}
	rankedModels := make([]ranked, 0, len(modelTotals))
	for m, t := range modelTotals {
		rankedModels = append(rankedModels, ranked{model: m, total: t})
	}
	sort.Slice(rankedModels, func(i, j int) bool {
		if rankedModels[i].total == rankedModels[j].total {
			return rankedModels[i].model < rankedModels[j].model
		}
		return rankedModels[i].total > rankedModels[j].total
	})

	keep := map[string]bool{}
	ordered := make([]string, 0, maxChartModels+1)
	for i, r := range rankedModels {
		if i < maxChartModels {
			keep[r.model] = true
			ordered = append(ordered, r.model)
		}
	}
	hasOther := len(rankedModels) > maxChartModels
	if hasOther {
		ordered = append(ordered, "other")
	}

	// Sorted timestamps
	tsKeys := make([]int64, 0, len(tsSet))
	for k := range tsSet {
		tsKeys = append(tsKeys, k)
	}
	sort.Slice(tsKeys, func(i, j int) bool { return tsKeys[i] < tsKeys[j] })
	timestamps = make([]time.Time, 0, len(tsKeys))
	tsIndex := map[int64]int{}
	for i, k := range tsKeys {
		timestamps = append(timestamps, tsSet[k])
		tsIndex[k] = i
	}

	// matrix[model][tsIdx]
	matrix := map[string][]float64{}
	for _, m := range ordered {
		matrix[m] = make([]float64, len(timestamps))
	}
	bucketTotal := make([]float64, len(timestamps))

	for _, p := range points {
		idx, ok := tsIndex[p.Timestamp.Unix()]
		if !ok {
			continue
		}
		model := p.Model
		if model == "" {
			model = "unknown"
		}
		if !keep[model] {
			model = "other"
		}
		matrix[model][idx] += p.Value
		bucketTotal[idx] += p.Value
	}

	series = make([]l0_axioms.TimeSeriesModelSeries, 0, len(ordered))
	// Chart stack order: largest total at bottom (first in datasets with stacked y)
	// Chart.js stacks in reverse of legend often; put largest first so it sits at base like the screenshot.
	for _, m := range ordered {
		series = append(series, l0_axioms.TimeSeriesModelSeries{Model: m, Values: matrix[m]})
	}

	totals = make([]l0_axioms.TimeSeriesPoint, 0, len(timestamps))
	for i, ts := range timestamps {
		totals = append(totals, l0_axioms.TimeSeriesPoint{Timestamp: ts, Value: bucketTotal[i]})
	}
	return timestamps, series, totals
}
