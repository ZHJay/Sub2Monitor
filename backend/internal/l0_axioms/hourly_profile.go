package l0_axioms

import "time"

// HourlyProfilePoint is one browser-local hour bucket averaged across a historical window.
// Contract: avgTokens is totalTokens divided by the requested full-day window.
type HourlyProfilePoint struct {
	Hour        string  `json:"hour"`
	AvgTokens   float64 `json:"avgTokens"`
	TotalTokens int64   `json:"totalTokens"`
	MaxTokens   int64   `json:"maxTokens"`
	Requests    int64   `json:"requests"`
	Cost        float64 `json:"cost"`
	ActiveDays  int64   `json:"activeDays"`
}

// HourlyProfileResponse is the API payload for historical daily-hour usage shape.
type HourlyProfileResponse struct {
	Days         int                  `json:"days"`
	Timezone     string               `json:"timezone"`
	IntervalMin  int                  `json:"intervalMin"`
	Points       []HourlyProfilePoint `json:"points"`
	IncludeCache bool                 `json:"includeCache"`
	UserEmail    string               `json:"userEmail,omitempty"`
	Timestamp    time.Time            `json:"timestamp"`
}

// HourlyProfileAggregate is a raw per-hour historical aggregate before padding.
type HourlyProfileAggregate struct {
	Hour        int
	TotalTokens int64
	MaxTokens   int64
	Requests    int64
	Cost        float64
	ActiveDays  int64
}
