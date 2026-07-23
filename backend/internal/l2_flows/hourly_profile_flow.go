package l2_flows

import (
	"fmt"
	"sort"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l1_blocks"

	"gorm.io/gorm"
)

var allowedHourlyProfileDays = map[int]bool{
	7:   true,
	30:  true,
	90:  true,
	365: true,
}

// AggregateHourlyProfile builds a 24-hour local-time usage profile over a historical day window.
func AggregateHourlyProfile(db *gorm.DB, filter l0_axioms.MetricsFilter, days int, timezone string) (*l0_axioms.HourlyProfileResponse, error) {
	if !allowedHourlyProfileDays[days] {
		return nil, fmt.Errorf("days must be one of 7, 30, 90, 365")
	}
	if timezone == "" {
		timezone = "UTC"
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone: %s", timezone)
	}

	userID, err := resolveFilterUserID(db, filter)
	if err != nil {
		return nil, err
	}

	now := time.Now().In(location)
	endDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location).AddDate(0, 0, 1)
	startDay := endDay.AddDate(0, 0, -days)

	aggregates, err := l1_blocks.GetHourlyProfileDailyUsage(db, filter, userID, startDay, endDay, location.String())
	if err != nil {
		return nil, err
	}

	resp := buildHourlyProfileResponse(days, location.String(), aggregates, time.Now().UTC())
	resp.IncludeCache = filter.IncludeCache
	resp.UserEmail = filter.UserEmail
	return resp, nil
}

// buildHourlyProfileResponse is pure hour padding and averaging for unit tests.
func buildHourlyProfileResponse(
	days int,
	timezone string,
	aggregates []l0_axioms.HourlyProfileDailyAggregate,
	now time.Time,
) *l0_axioms.HourlyProfileResponse {
	type hourStats struct {
		values     []int64
		total      int64
		requests   int64
		cost       float64
		activeDays int64
	}
	byHour := make(map[int]*hourStats, 24)
	for _, a := range aggregates {
		if a.Hour < 0 || a.Hour >= 24 {
			continue
		}
		stats := byHour[a.Hour]
		if stats == nil {
			stats = &hourStats{}
			byHour[a.Hour] = stats
		}
		stats.values = append(stats.values, a.Tokens)
		stats.total += a.Tokens
		stats.requests += a.Requests
		stats.cost += a.Cost
		stats.activeDays++
	}

	points := make([]l0_axioms.HourlyProfilePoint, 0, 24)
	for h := 0; h < 24; h++ {
		stats := byHour[h]
		if stats == nil {
			stats = &hourStats{}
		}
		values := append([]int64(nil), stats.values...)
		for len(values) < days {
			values = append(values, 0)
		}
		peakTokens := maxInt64(values)
		minTokens, maxTokens := filteredProfileBounds(values)
		points = append(points, l0_axioms.HourlyProfilePoint{
			Hour:        fmt.Sprintf("%02d:00", h),
			AvgTokens:   float64(stats.total) / float64(days),
			PeakTokens:  peakTokens,
			TotalTokens: stats.total,
			MaxTokens:   maxTokens,
			MinTokens:   minTokens,
			Requests:    stats.requests,
			Cost:        stats.cost,
			ActiveDays:  stats.activeDays,
		})
	}

	return &l0_axioms.HourlyProfileResponse{
		Days:        days,
		Timezone:    timezone,
		IntervalMin: 60,
		Points:      points,
		Timestamp:   now,
	}
}

// filteredProfileBounds excludes severe low/high daily-hour outliers using Tukey's 1.5×IQR fences.
// Small or zero-IQR samples preserve their raw extrema to avoid inventing a narrower range.
func filteredProfileBounds(values []int64) (int64, int64) {
	if len(values) == 0 {
		return 0, 0
	}
	sorted := append([]int64(nil), values...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	rawMin, rawMax := sorted[0], sorted[len(sorted)-1]
	if len(sorted) < 4 {
		return rawMin, rawMax
	}

	q1 := profileQuantile(sorted, 0.25)
	q3 := profileQuantile(sorted, 0.75)
	iqr := q3 - q1
	if iqr <= 0 {
		return rawMin, rawMax
	}
	lowerFence := float64(q1) - 1.5*float64(iqr)
	upperFence := float64(q3) + 1.5*float64(iqr)

	inliers := make([]int64, 0, len(sorted))
	for _, value := range sorted {
		if float64(value) >= lowerFence && float64(value) <= upperFence {
			inliers = append(inliers, value)
		}
	}
	if len(inliers) < 2 {
		return rawMin, rawMax
	}
	return inliers[0], inliers[len(inliers)-1]
}

func profileQuantile(sorted []int64, q float64) int64 {
	index := int(q * float64(len(sorted)-1))
	return sorted[index]
}

func maxInt64(values []int64) int64 {
	var max int64
	for _, value := range values {
		if value > max {
			max = value
		}
	}
	return max
}
