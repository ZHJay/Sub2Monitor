package l0_axioms

// IntradayHeatPoint is one 30-minute bucket inside a UTC day.
// Contract: slot is HH:MM (UTC start of bucket); level 0-4 same rules as daily grid.
type IntradayHeatPoint struct {
	Slot     string  `json:"slot"`
	Tokens   int64   `json:"tokens"`
	Cost     float64 `json:"cost"`
	Requests int64   `json:"requests"`
	Level    int     `json:"level"`
}

// IntradayHeatmapResponse is the day drill-down payload (48 half-hour slots).
type IntradayHeatmapResponse struct {
	Date         string              `json:"date"`
	Timezone     string              `json:"timezone"`
	IntervalMin  int                 `json:"intervalMin"`
	Points       []IntradayHeatPoint `json:"points"`
	Levels       DailyHeatmapLevels  `json:"levels"`
	IncludeCache bool                `json:"includeCache"`
	UserEmail    string              `json:"userEmail,omitempty"`
	Timestamp    string              `json:"timestamp"`
}

// HalfHourAggregate is raw half-hour sum before level assignment.
type HalfHourAggregate struct {
	SlotIndex int
	Tokens    int64
	Cost      float64
	Requests  int64
}
