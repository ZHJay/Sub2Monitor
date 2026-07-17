package l0_axioms

import "testing"

func TestTokenSQLCacheToggle(t *testing.T) {
	if TokenSQL(true) != TokenTotalSQL {
		t.Fatalf("cache on sql mismatch")
	}
	if TokenSQL(false) != TokenNoCacheSQL {
		t.Fatalf("cache off sql mismatch")
	}
	if TokenSQL(false) == TokenSQL(true) {
		t.Fatalf("toggle must change expression")
	}
}

func TestNormalizeScopeEmailAllowlist(t *testing.T) {
	if got := NormalizeScopeEmail("sblxx@sb.sb"); got != "sblxx@sb.sb" {
		t.Fatalf("allowed email = %q", got)
	}
	if got := NormalizeScopeEmail("SBLXX@SB.SB"); got != "sblxx@sb.sb" {
		t.Fatalf("case fold = %q", got)
	}
	if got := NormalizeScopeEmail(PersonalMonitorEmail); got != PersonalMonitorEmail {
		t.Fatalf("personal email = %q", got)
	}
	if got := NormalizeScopeEmail("not-on-list@example.com"); got != "" {
		t.Fatalf("unknown email must be rejected, got %q", got)
	}
	if !IsAllowedScopeEmail("sblxx@sb.sb") {
		t.Fatalf("sblxx should be allowed")
	}
}
