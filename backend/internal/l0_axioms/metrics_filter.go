package l0_axioms

import "strings"

// MetricsFilter scopes dashboard aggregations.
// Contract: empty UserEmail means all users; IncludeCache controls token SQL.
// Invariant: filters never mutate data; they only constrain SELECT queries.
type MetricsFilter struct {
	IncludeCache bool
	UserEmail    string // empty = all users
}

// PersonalMonitorEmail is the legacy personal alias (user_scope=personal).
const PersonalMonitorEmail = "zhanghjay.ng@gmail.com"

// AllowedScopeEmails is the fixed multi-user scope picker.
// Contract: only these emails may appear as single-user metrics scopes.
// Why: open user_email scan is forbidden; operators choose from an allowlist.
var AllowedScopeEmails = []string{
	PersonalMonitorEmail,
	"sblxx@sb.sb",
}

// IsAllowedScopeEmail reports whether email is in AllowedScopeEmails (case-insensitive).
func IsAllowedScopeEmail(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return false
	}
	for _, allowed := range AllowedScopeEmails {
		if email == strings.ToLower(allowed) {
			return true
		}
	}
	return false
}

// NormalizeScopeEmail lowercases an allowed email, or returns "" when not allowed.
func NormalizeScopeEmail(email string) string {
	email = strings.ToLower(strings.TrimSpace(email))
	if !IsAllowedScopeEmail(email) {
		return ""
	}
	return email
}

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
