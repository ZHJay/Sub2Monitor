package l1_blocks

import (
	"fmt"
	"time"
)

// GetTimeWindow calculates the start time based on a time range string
// Contract: Accepts "1h", "6h", "24h", "7d", "all"
// Boundary: Returns zero time for "all", otherwise calculates from now
// Why: Centralizes time range calculation logic for consistent behavior across queries
func GetTimeWindow(timeRange string) (time.Time, error) {
	now := time.Now()

	switch timeRange {
	case "1h":
		return now.Add(-1 * time.Hour), nil
	case "6h":
		return now.Add(-6 * time.Hour), nil
	case "24h":
		return now.Add(-24 * time.Hour), nil
	case "7d":
		return now.Add(-7 * 24 * time.Hour), nil
	case "all":
		// Return zero time to indicate no time filter
		return time.Time{}, nil
	default:
		return time.Time{}, fmt.Errorf("invalid time range: %s (valid: 1h, 6h, 24h, 7d, all)", timeRange)
	}
}

// GetIntervalMinutes converts an interval string to minutes
// Contract: Accepts "15min", "1h"
// Boundary: Returns error for unsupported intervals
// Why: Standardizes interval conversion for time series aggregation queries
func GetIntervalMinutes(interval string) (int, error) {
	switch interval {
	case "15min":
		return 15, nil
	case "1h":
		return 60, nil
	default:
		return 0, fmt.Errorf("invalid interval: %s (valid: 15min, 1h)", interval)
	}
}
