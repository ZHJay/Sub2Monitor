package l0_axioms

// TokenSummary contains token aggregates returned by one filtered usage query.
type TokenSummary struct {
	TotalTokens         int64 `gorm:"column:total_tokens"`
	CacheReadTokens     int64 `gorm:"column:cache_read_tokens"`
	CacheEligibleTokens int64 `gorm:"column:cache_eligible_tokens"`
}

// CalculateCacheHitRatePercent returns a display-ready percentage in [0, 100].
// Contract: eligible is the sum of input, cache creation, and cache read tokens.
func CalculateCacheHitRatePercent(read, eligible int64) float64 {
	if read <= 0 || eligible <= 0 {
		return 0
	}
	if read >= eligible {
		return 100
	}
	return float64(read) / float64(eligible) * 100
}
