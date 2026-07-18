package l2_flows

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l1_blocks"
)

// SSOFlow owns the one-time exchange and the absolute Monitor session lifecycle.
type SSOFlow struct {
	states   *l1_blocks.OneTimeStateStore
	sessions *l1_blocks.SessionStore
	identity l1_blocks.IdentityGateway
	// now is injectable for tests; production uses time.Now.
	now func() time.Time

	mu           sync.Mutex
	allowedUntil map[string]time.Time // sessionID → last successful identity recheck expiry
}

func NewSSOFlow(states *l1_blocks.OneTimeStateStore, sessions *l1_blocks.SessionStore, identity l1_blocks.IdentityGateway) *SSOFlow {
	return &SSOFlow{
		states:       states,
		sessions:     sessions,
		identity:     identity,
		now:          time.Now,
		allowedUntil: make(map[string]time.Time),
	}
}

func (flow *SSOFlow) IssueChallenge() (string, error) {
	state, err := l1_blocks.NewRandomBase64URL(l0_axioms.ChallengeStateBytes)
	if err != nil {
		return "", err
	}
	flow.states.Put(state, l0_axioms.ChallengeTTL)
	return state, nil
}

func (flow *SSOFlow) Exchange(cookieState, requestState, upstreamToken, userAgent string) (string, l0_axioms.AuthorizationStatus) {
	if !l1_blocks.IsExactBase64URL(cookieState, l0_axioms.ChallengeStateBytes) ||
		!l1_blocks.IsExactBase64URL(requestState, l0_axioms.ChallengeStateBytes) ||
		!flow.states.ConsumeMatch(cookieState, requestState) || upstreamToken == "" || strings.TrimSpace(userAgent) == "" {
		return "", l0_axioms.AuthorizationUnauthorized
	}
	if status := flow.identity.Check(context.Background(), upstreamToken, userAgent); status != l0_axioms.AuthorizationAllowed {
		return "", status
	}
	sessionID, err := l1_blocks.NewRandomBase64URL(l0_axioms.SessionIDBytes)
	if err != nil || !flow.sessions.Create(sessionID, upstreamToken, userAgent) {
		return "", l0_axioms.AuthorizationUnavailable
	}
	flow.rememberAllowed(sessionID)
	return sessionID, l0_axioms.AuthorizationAllowed
}

// Authorize revalidates against Sub2API, with a short positive cache to avoid stampeding /auth/me.
// Contract: Unauthorized/Forbidden revoke the session; Unavailable leaves the session intact.
func (flow *SSOFlow) Authorize(sessionID string) l0_axioms.AuthorizationStatus {
	if !l1_blocks.IsExactBase64URL(sessionID, l0_axioms.SessionIDBytes) {
		return l0_axioms.AuthorizationUnauthorized
	}
	token, userAgent, exists := flow.sessions.Lookup(sessionID)
	if !exists {
		flow.forgetAllowed(sessionID)
		return l0_axioms.AuthorizationUnauthorized
	}
	if flow.stillAllowed(sessionID) {
		return l0_axioms.AuthorizationAllowed
	}
	status := flow.identity.Check(context.Background(), token, userAgent)
	switch status {
	case l0_axioms.AuthorizationAllowed:
		flow.rememberAllowed(sessionID)
	case l0_axioms.AuthorizationUnauthorized, l0_axioms.AuthorizationForbidden:
		flow.forgetAllowed(sessionID)
		flow.sessions.Delete(sessionID)
	default:
		// Upstream timeout/5xx: keep session so the next poll can succeed without re-login.
		flow.forgetAllowed(sessionID)
	}
	return status
}

func (flow *SSOFlow) Logout(sessionID string) {
	flow.sessions.Delete(sessionID)
	flow.forgetAllowed(sessionID)
}

func (flow *SSOFlow) stillAllowed(sessionID string) bool {
	flow.mu.Lock()
	defer flow.mu.Unlock()
	until, ok := flow.allowedUntil[sessionID]
	return ok && flow.now().Before(until)
}

func (flow *SSOFlow) rememberAllowed(sessionID string) {
	flow.mu.Lock()
	defer flow.mu.Unlock()
	flow.allowedUntil[sessionID] = flow.now().Add(l0_axioms.IdentityRecheckTTL)
}

func (flow *SSOFlow) forgetAllowed(sessionID string) {
	flow.mu.Lock()
	defer flow.mu.Unlock()
	delete(flow.allowedUntil, sessionID)
}
