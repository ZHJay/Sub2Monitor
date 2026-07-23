package l0_axioms

import "time"

// HourlyProfilePoint is one browser-local hour bucket averaged across a historical window.
// Contract: avgTokens is totalTokens divided by the requested full-day window.
type HourlyProfilePoint struct {
	Hour        string  `json:"hour"`
	AvgTokens   float64 `json:"avgTokens"`
	PeakTokens  int64   `json:"peakTokens"`
	TotalTokens int64   `json:"totalTokens"`
	MaxTokens   int64   `json:"maxTokens"` // IQR-filtered upper bound.
	MinTokens   int64   `json:"minTokens"` // IQR-filtered lower bound.
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

// HourlyProfileDailyAggregate is one local calendar-day total for one hour.
type HourlyProfileDailyAggregate struct {
	Date     string
	Hour     int
	Tokens   int64
	Requests int64
	Cost     float64
}
