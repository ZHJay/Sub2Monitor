package l0_axioms

import "time"

const (
	// ChallengeStateBytes is the exact entropy size for a one-time SSO challenge.
	ChallengeStateBytes = 16
	// SessionIDBytes is the exact entropy size for an opaque Monitor session ID.
	SessionIDBytes = 32
	// SessionTTLMinutes is an absolute session lifetime; it must never slide on reads.
	SessionTTLMinutes = 15
	// MaxActiveSessions bounds in-memory retention of upstream credentials.
	MaxActiveSessions = 128
	// IdentityRecheckSeconds bounds how long a successful Sub2API /auth/me may be reused.
	// Why: every metrics poll used to re-hit Sub2API; under memory pressure that 3s timeout became 503.
	IdentityRecheckSeconds = 45
)

const (
	ChallengeTTL       = time.Minute
	SessionTTL         = SessionTTLMinutes * time.Minute
	IdentityRecheckTTL = IdentityRecheckSeconds * time.Second
)

// AuthorizationStatus is the stable result of an upstream active-admin check.
type AuthorizationStatus string

const (
	AuthorizationAllowed      AuthorizationStatus = "allowed"
	AuthorizationUnauthorized AuthorizationStatus = "unauthorized"
	AuthorizationForbidden    AuthorizationStatus = "forbidden"
	AuthorizationUnavailable  AuthorizationStatus = "unavailable"
)
