package l2_flows

import (
	"fmt"
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

// AggregateHourlyProfile builds a 24-hour UTC usage profile over a historical day window.
func AggregateHourlyProfile(db *gorm.DB, filter l0_axioms.MetricsFilter, days int) (*l0_axioms.HourlyProfileResponse, error) {
	if !allowedHourlyProfileDays[days] {
		return nil, fmt.Errorf("days must be one of 7, 30, 90, 365")
	}

	userID, err := resolveFilterUserID(db, filter)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	endDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).Add(24 * time.Hour)
	startDay := endDay.AddDate(0, 0, -days)

	aggregates, err := l1_blocks.GetHourlyProfileUsage(db, filter, userID, startDay, endDay)
	if err != nil {
		return nil, err
	}

	resp := buildHourlyProfileResponse(days, aggregates, time.Now().UTC())
	resp.IncludeCache = filter.IncludeCache
	resp.UserEmail = filter.UserEmail
	return resp, nil
}

// buildHourlyProfileResponse is pure hour padding and averaging for unit tests.
func buildHourlyProfileResponse(
	days int,
	aggregates []l0_axioms.HourlyProfileAggregate,
	now time.Time,
) *l0_axioms.HourlyProfileResponse {
	byHour := make(map[int]l0_axioms.HourlyProfileAggregate, len(aggregates))
	for _, a := range aggregates {
		if a.Hour >= 0 && a.Hour < 24 {
			byHour[a.Hour] = a
		}
	}

	points := make([]l0_axioms.HourlyProfilePoint, 0, 24)
	for h := 0; h < 24; h++ {
		a := byHour[h]
		points = append(points, l0_axioms.HourlyProfilePoint{
			Hour:        fmt.Sprintf("%02d:00", h),
			AvgTokens:   float64(a.TotalTokens) / float64(days),
			TotalTokens: a.TotalTokens,
			MaxTokens:   a.MaxTokens,
			Requests:    a.Requests,
			Cost:        a.Cost,
			ActiveDays:  a.ActiveDays,
		})
	}

	return &l0_axioms.HourlyProfileResponse{
		Days:        days,
		Timezone:    "UTC",
		IntervalMin: 60,
		Points:      points,
		Timestamp:   now,
	}
}
