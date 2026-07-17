package l2_flows

import (
	"fmt"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l1_blocks"

	"gorm.io/gorm"
)

// AggregateIntradayHeatmap builds 48 half-hour slots for one UTC calendar day.
// Contract: date must be YYYY-MM-DD; missing slots filled with zeros/level 0.
func AggregateIntradayHeatmap(db *gorm.DB, filter l0_axioms.MetricsFilter, date string) (*l0_axioms.IntradayHeatmapResponse, error) {
	day, err := time.ParseInLocation("2006-01-02", date, time.UTC)
	if err != nil {
		return nil, fmt.Errorf("invalid date: %s", date)
	}
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.UTC)
	end := start.Add(24 * time.Hour)

	userID, err := resolveFilterUserID(db, filter)
	if err != nil {
		return nil, err
	}

	aggregates, err := l1_blocks.GetHalfHourUsage(db, filter, userID, start, end)
	if err != nil {
		return nil, err
	}

	bySlot := make(map[int]l0_axioms.HalfHourAggregate, len(aggregates))
	for _, a := range aggregates {
		if a.SlotIndex >= 0 && a.SlotIndex < 48 {
			bySlot[a.SlotIndex] = a
		}
	}

	// Reuse daily level mapper via temporary DailyHeatPoint list.
	tmp := make([]l0_axioms.DailyHeatPoint, 0, 48)
	for i := 0; i < 48; i++ {
		a := bySlot[i]
		tmp = append(tmp, l0_axioms.DailyHeatPoint{
			Date:     fmt.Sprintf("%02d:%02d", i/2, (i%2)*30),
			Tokens:   a.Tokens,
			Cost:     a.Cost,
			Requests: a.Requests,
		})
	}
	levels, leveled := l0_axioms.AssignHeatLevels(tmp)

	points := make([]l0_axioms.IntradayHeatPoint, 0, 48)
	for _, p := range leveled {
		points = append(points, l0_axioms.IntradayHeatPoint{
			Slot:     p.Date,
			Tokens:   p.Tokens,
			Cost:     p.Cost,
			Requests: p.Requests,
			Level:    p.Level,
		})
	}

	return &l0_axioms.IntradayHeatmapResponse{
		Date:         date,
		Timezone:     "UTC",
		IntervalMin:  30,
		Points:       points,
		Levels:       levels,
		IncludeCache: filter.IncludeCache,
		UserEmail:    filter.UserEmail,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
	}, nil
}
