package l1_blocks

import (
	"crypto/subtle"
	"sync"
	"time"
)

// OneTimeStateStore retains hashes only long enough to reject replayed SSO exchanges.
type OneTimeStateStore struct {
	clock   func() time.Time
	mu      sync.Mutex
	entries map[string]time.Time
}

func NewOneTimeStateStore(clock func() time.Time) *OneTimeStateStore {
	if clock == nil {
		clock = time.Now
	}
	return &OneTimeStateStore{clock: clock, entries: make(map[string]time.Time)}
}

func (store *OneTimeStateStore) Put(state string, ttl time.Duration) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.removeExpiredLocked()
	store.entries[state] = store.clock().Add(ttl)
}

// ConsumeMatch performs the one permitted state comparison and invalidates the state first.
func (store *OneTimeStateStore) ConsumeMatch(cookieState, requestState string) bool {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.removeExpiredLocked()
	expiresAt, exists := store.entries[cookieState]
	delete(store.entries, cookieState)
	if !exists || !expiresAt.After(store.clock()) || len(cookieState) != len(requestState) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(cookieState), []byte(requestState)) == 1
}

func (store *OneTimeStateStore) removeExpiredLocked() {
	now := store.clock()
	for state, expiresAt := range store.entries {
		if !expiresAt.After(now) {
			delete(store.entries, state)
		}
	}
}
