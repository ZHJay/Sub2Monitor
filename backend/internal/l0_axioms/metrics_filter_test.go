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
