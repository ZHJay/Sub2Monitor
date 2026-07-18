package l0_axioms

import "time"

// UsageLog represents a usage record from the sub2api database
// Contract: Maps directly to the usage_logs table structure
// Invariant: All fields are read-only; this layer never modifies database records
type UsageLog struct {
	ID                  int64     `gorm:"primaryKey;column:id"`
	UserID              int64     `gorm:"column:user_id"`
	APIKeyID            int64     `gorm:"column:api_key_id"`
	AccountID           int64     `gorm:"column:account_id"`
	RequestID           string    `gorm:"column:request_id"`
	Model               string    `gorm:"column:model"`
	InputTokens         int       `gorm:"column:input_tokens"`
	OutputTokens        int       `gorm:"column:output_tokens"`
	CacheCreationTokens int       `gorm:"column:cache_creation_tokens"`
	CacheReadTokens     int       `gorm:"column:cache_read_tokens"`
	TotalCost           float64   `gorm:"column:total_cost"`
	CreatedAt           time.Time `gorm:"column:created_at"`
}

// TableName specifies the table name for GORM
func (UsageLog) TableName() string {
	return "usage_logs"
}

// User is a minimal users-table projection for email → id resolution.
type User struct {
	ID    int64  `gorm:"primaryKey;column:id"`
	Email string `gorm:"column:email"`
}

func (User) TableName() string { return "users" }

// TimeSeriesPoint represents a single data point in a time series
// Contract: Used for charting cost/token trends over time
type TimeSeriesPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Model     string    `json:"model,omitempty"`
}

// TimeSeriesModelSeries is one model's values aligned to shared timestamps.
type TimeSeriesModelSeries struct {
	Model  string    `json:"model"`
	Values []float64 `json:"values"`
}

// ModelStats represents aggregated statistics for a specific model
// Contract: Provides per-model breakdown of usage and costs
type ModelStats struct {
	Model    string  `json:"model"`
	Cost     float64 `json:"cost"`
	Tokens   int64   `json:"tokens"`
	Requests int64   `json:"requests"`
}

// RequestStats represents request count breakdown
// Contract: Provides success/failure statistics
type RequestStats struct {
	Total   int64 `json:"total"`
	Success int64 `json:"success"`
	Failed  int64 `json:"failed"`
}

// MetricsSummary represents the dashboard summary metrics
// Contract: Aggregates all key metrics for the dashboard cards
type MetricsSummary struct {
	TotalCost    float64      `json:"totalCost"`
	HourlyCost   float64      `json:"hourlyCost"`
	TotalTokens  int64        `json:"totalTokens"`
	CacheHitRate float64      `json:"cacheHitRate"`
	Requests     RequestStats `json:"requests"`
	IncludeCache bool         `json:"includeCache"`
	UserEmail    string       `json:"userEmail,omitempty"`
	Timestamp    time.Time    `json:"timestamp"`
}

// TimeSeriesResponse represents the API response for time series data
// Contract: Series are stacked area layers; Timestamps shared across series.
type TimeSeriesResponse struct {
	Timestamps   []time.Time             `json:"timestamps"`
	Series       []TimeSeriesModelSeries `json:"series"`
	Data         []TimeSeriesPoint       `json:"data,omitempty"` // total series for legacy
	Range        string                  `json:"range"`
	Interval     string                  `json:"interval"`
	Metric       string                  `json:"metric"`
	IncludeCache bool                    `json:"includeCache"`
	UserEmail    string                  `json:"userEmail,omitempty"`
}

// ModelStatsResponse represents the API response for model statistics
// Contract: Wraps model stats with timestamp metadata
type ModelStatsResponse struct {
	Data         []ModelStats `json:"data"`
	IncludeCache bool         `json:"includeCache"`
	UserEmail    string       `json:"userEmail,omitempty"`
	Timestamp    time.Time    `json:"timestamp"`
}
