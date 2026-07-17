package l0_axioms

import "testing"

func TestSSOContractUsesFixedSecretLengthsAndAbsoluteLifetime(t *testing.T) {
	if ChallengeStateBytes != 16 {
		t.Fatalf("ChallengeStateBytes = %d, want 16", ChallengeStateBytes)
	}
	if SessionIDBytes != 32 {
		t.Fatalf("SessionIDBytes = %d, want 32", SessionIDBytes)
	}
	if SessionTTLMinutes != 15 {
		t.Fatalf("SessionTTLMinutes = %d, want 15", SessionTTLMinutes)
	}
	if MaxActiveSessions != 128 {
		t.Fatalf("MaxActiveSessions = %d, want 128", MaxActiveSessions)
	}
}
