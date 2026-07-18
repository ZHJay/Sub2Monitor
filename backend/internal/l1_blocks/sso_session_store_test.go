package l1_blocks

import (
	"testing"
	"time"
)

func TestOneTimeStateStoreConsumesOnlyMatchingStateOnce(t *testing.T) {
	now := time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC)
	store := NewOneTimeStateStore(func() time.Time { return now })
	state := "0123456789abcdef"
	store.Put(state, time.Minute)

	if !store.ConsumeMatch(state, state) {
		t.Fatal("matching state was not consumed")
	}
	if store.ConsumeMatch(state, state) {
		t.Fatal("replayed state was accepted")
	}
}

func TestSessionStoreExpiresWithoutSlidingAndRejects129thSession(t *testing.T) {
	now := time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC)
	store := NewSessionStore(func() time.Time { return now })
	for index := 0; index < 128; index++ {
		if !store.Create("session-"+string(rune(index+1)), "token", "Browser User Agent") {
			t.Fatalf("session %d was unexpectedly rejected", index)
		}
	}
	if store.Create("overflow", "token", "Browser User Agent") {
		t.Fatal("129th active session was accepted")
	}

	now = now.Add(16 * time.Minute)
	if _, _, ok := store.Lookup("session-\x01"); ok {
		t.Fatal("expired session remained valid")
	}
	if !store.Create("replacement", "token", "Browser User Agent") {
		t.Fatal("expired entries were not reclaimed")
	}
}
