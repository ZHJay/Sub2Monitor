package l0_axioms

import (
	"sort"
	"time"
)

// DailyHeatPoint is one calendar day of usage for the contribution grid.
// Contract: date is UTC YYYY-MM-DD; level is 0 (empty) or 1-4 (intensity).
type DailyHeatPoint struct {
	Date     string  `json:"date"`
	Tokens   int64   `json:"tokens"`
	Cost     float64 `json:"cost"`
	Requests int64   `json:"requests"`
	Level    int     `json:"level"`
}

// DailyHeatmapLevels describes the quantile thresholds used for level mapping.
type DailyHeatmapLevels struct {
	Thresholds []int64 `json:"thresholds"`
	MaxTokens  int64   `json:"maxTokens"`
}

// DailyHeatmapResponse is the API payload for the contribution grid.
// Contract: points is a continuous UTC calendar of length Days.
type DailyHeatmapResponse struct {
	Metric       string             `json:"metric"`
	Days         int                `json:"days"`
	Timezone     string             `json:"timezone"`
	StartDate    string             `json:"startDate"`
	EndDate      string             `json:"endDate"`
	Points       []DailyHeatPoint   `json:"points"`
	Levels       DailyHeatmapLevels `json:"levels"`
	IncludeCache bool               `json:"includeCache"`
	UserEmail    string             `json:"userEmail,omitempty"`
	Timestamp    time.Time          `json:"timestamp"`
}

// DailyUsageAggregate is a raw per-day sum before level assignment.
type DailyUsageAggregate struct {
	Date     time.Time
	Tokens   int64
	Cost     float64
	Requests int64
}

// AssignHeatLevels maps positive-token samples to levels 1-4 via p25/p50/p75/p90.
// Invariant: zero-token days stay level 0; levels never exceed 4.
// Why: GitHub-like visual density should track relative activity, not absolute caps.
func AssignHeatLevels(points []DailyHeatPoint) (DailyHeatmapLevels, []DailyHeatPoint) {
	positive := make([]int64, 0, len(points))
	var maxTokens int64
	for _, p := range points {
		if p.Tokens > maxTokens {
			maxTokens = p.Tokens
		}
		if p.Tokens > 0 {
			positive = append(positive, p.Tokens)
		}
	}

	thresholds := []int64{0, 0, 0, 0}
	if len(positive) > 0 {
		sort.Slice(positive, func(i, j int) bool { return positive[i] < positive[j] })
		thresholds = []int64{
			quantileSorted(positive, 0.25),
			quantileSorted(positive, 0.50),
			quantileSorted(positive, 0.75),
			quantileSorted(positive, 0.90),
		}
	}

	out := make([]DailyHeatPoint, len(points))
	for i, p := range points {
		out[i] = p
		if p.Tokens <= 0 {
			out[i].Level = 0
			continue
		}
		switch {
		case p.Tokens >= thresholds[3]:
			out[i].Level = 4
		case p.Tokens >= thresholds[2]:
			out[i].Level = 3
		case p.Tokens >= thresholds[1]:
			out[i].Level = 2
		default:
			out[i].Level = 1
		}
	}

	return DailyHeatmapLevels{Thresholds: thresholds, MaxTokens: maxTokens}, out
}

func quantileSorted(sorted []int64, q float64) int64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return sorted[0]
	}
	// nearest-rank style index in [0, n-1]
	idx := int(q * float64(len(sorted)-1))
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}
