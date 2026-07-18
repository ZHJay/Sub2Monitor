package l2_flows

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l1_blocks"
)

type fakeIdentityGateway struct{ status l0_axioms.AuthorizationStatus }

func (gateway fakeIdentityGateway) Check(context.Context, string, string) l0_axioms.AuthorizationStatus {
	return gateway.status
}

type countingGateway struct {
	status        l0_axioms.AuthorizationStatus
	calls         atomic.Int32
	lastUserAgent string
}

func (gateway *countingGateway) Check(_ context.Context, _, userAgent string) l0_axioms.AuthorizationStatus {
	gateway.calls.Add(1)
	gateway.lastUserAgent = userAgent
	return gateway.status
}

func TestSSOFlowCreatesSessionOnlyForActiveAdminAndDeletesRevokedSession(t *testing.T) {
	now := time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC)
	flow := NewSSOFlow(
		l1_blocks.NewOneTimeStateStore(func() time.Time { return now }),
		l1_blocks.NewSessionStore(func() time.Time { return now }),
		fakeIdentityGateway{status: l0_axioms.AuthorizationAllowed},
	)
	flow.now = func() time.Time { return now }

	state, err := flow.IssueChallenge()
	if err != nil {
		t.Fatalf("IssueChallenge() error = %v", err)
	}
	sessionID, status := flow.Exchange(state, state, "upstream-token", "Browser User Agent")
	if status != l0_axioms.AuthorizationAllowed || sessionID == "" {
		t.Fatalf("Exchange() = (%q, %q)", sessionID, status)
	}
	if got := flow.Authorize(sessionID); got != l0_axioms.AuthorizationAllowed {
		t.Fatalf("Authorize() = %q", got)
	}

	// Cache still valid: even if gateway flips, status stays allowed until TTL.
	flow.identity = fakeIdentityGateway{status: l0_axioms.AuthorizationUnauthorized}
	if got := flow.Authorize(sessionID); got != l0_axioms.AuthorizationAllowed {
		t.Fatalf("Authorize() within recheck TTL = %q, want allowed", got)
	}

	// After TTL, revoke must take effect and drop the session.
	now = now.Add(l0_axioms.IdentityRecheckTTL + time.Second)
	if got := flow.Authorize(sessionID); got != l0_axioms.AuthorizationUnauthorized {
		t.Fatalf("Authorize() after revoke = %q", got)
	}
	if got := flow.Authorize(sessionID); got != l0_axioms.AuthorizationUnauthorized {
		t.Fatalf("revoked session was retained: %q", got)
	}
}

func TestSSOFlowCachesSuccessfulIdentityRecheck(t *testing.T) {
	now := time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC)
	gateway := &countingGateway{status: l0_axioms.AuthorizationAllowed}
	flow := NewSSOFlow(
		l1_blocks.NewOneTimeStateStore(func() time.Time { return now }),
		l1_blocks.NewSessionStore(func() time.Time { return now }),
		gateway,
	)
	flow.now = func() time.Time { return now }

	state, err := flow.IssueChallenge()
	if err != nil {
		t.Fatalf("IssueChallenge() error = %v", err)
	}
	sessionID, status := flow.Exchange(state, state, "upstream-token", "Browser User Agent")
	if status != l0_axioms.AuthorizationAllowed {
		t.Fatalf("Exchange() status = %q", status)
	}
	// Exchange + first Authorize should not both re-hit if Exchange already remembered allowed.
	if got := flow.Authorize(sessionID); got != l0_axioms.AuthorizationAllowed {
		t.Fatalf("Authorize() = %q", got)
	}
	if got := flow.Authorize(sessionID); got != l0_axioms.AuthorizationAllowed {
		t.Fatalf("Authorize() = %q", got)
	}
	// Exchange made 1 Check; two Authorize calls should use cache → still 1.
	if calls := gateway.calls.Load(); calls != 1 {
		t.Fatalf("identity checks = %d, want 1 (cached)", calls)
	}

	now = now.Add(l0_axioms.IdentityRecheckTTL + time.Second)
	if got := flow.Authorize(sessionID); got != l0_axioms.AuthorizationAllowed {
		t.Fatalf("Authorize() after TTL = %q", got)
	}
	if calls := gateway.calls.Load(); calls != 2 {
		t.Fatalf("identity checks after TTL = %d, want 2", calls)
	}
	if gateway.lastUserAgent != "Browser User Agent" {
		t.Fatalf("recheck User-Agent = %q", gateway.lastUserAgent)
	}
}

func TestSSOFlowUnavailableDoesNotDeleteSession(t *testing.T) {
	now := time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC)
	flow := NewSSOFlow(
		l1_blocks.NewOneTimeStateStore(func() time.Time { return now }),
		l1_blocks.NewSessionStore(func() time.Time { return now }),
		fakeIdentityGateway{status: l0_axioms.AuthorizationAllowed},
	)
	flow.now = func() time.Time { return now }

	state, _ := flow.IssueChallenge()
	sessionID, status := flow.Exchange(state, state, "upstream-token", "Browser User Agent")
	if status != l0_axioms.AuthorizationAllowed {
		t.Fatalf("Exchange() = %q", status)
	}

	now = now.Add(l0_axioms.IdentityRecheckTTL + time.Second)
	flow.identity = fakeIdentityGateway{status: l0_axioms.AuthorizationUnavailable}
	if got := flow.Authorize(sessionID); got != l0_axioms.AuthorizationUnavailable {
		t.Fatalf("Authorize() unavailable = %q", got)
	}

	// Session must still exist; next successful recheck works without re-login.
	flow.identity = fakeIdentityGateway{status: l0_axioms.AuthorizationAllowed}
	if got := flow.Authorize(sessionID); got != l0_axioms.AuthorizationAllowed {
		t.Fatalf("Authorize() after recovery = %q", got)
	}
}
