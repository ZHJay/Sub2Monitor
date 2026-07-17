package l0_axioms

// MetricsFilter scopes dashboard aggregations.
// Contract: empty UserEmail means all users; IncludeCache controls token SQL.
// Invariant: filters never mutate data; they only constrain SELECT queries.
type MetricsFilter struct {
	IncludeCache bool
	UserEmail    string // empty = all users
}

// PersonalMonitorEmail is the single-user scope requested by the operator.
const PersonalMonitorEmail = "zhanghjay.ng@gmail.com"

// TokenSQL returns the Postgres token expression for the cache toggle.
// Why: sub2api total_tokens includes cache; operators also need pure input+output.
func TokenSQL(includeCache bool) string {
	if includeCache {
		return TokenTotalSQL
	}
	return TokenNoCacheSQL
}

const (
	// TokenTotalSQL matches sub2api total_tokens.
	TokenTotalSQL = "(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens)"
	// TokenNoCacheSQL is input+output only.
	TokenNoCacheSQL = "(input_tokens + output_tokens)"
)
