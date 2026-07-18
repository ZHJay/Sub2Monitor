package l1_blocks

import (
	"crypto/sha256"
	"sync"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

type sessionEntry struct {
	upstreamToken string
	userAgent     string
	expiresAt     time.Time
}

// SessionStore stores only a hash of the browser session ID and expires entries absolutely.
type SessionStore struct {
	clock   func() time.Time
	mu      sync.Mutex
	entries map[[sha256.Size]byte]sessionEntry
}

func NewSessionStore(clock func() time.Time) *SessionStore {
	if clock == nil {
		clock = time.Now
	}
	return &SessionStore{clock: clock, entries: make(map[[sha256.Size]byte]sessionEntry)}
}

func (store *SessionStore) Create(sessionID, upstreamToken, userAgent string) bool {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.removeExpiredLocked()
	if len(store.entries) >= l0_axioms.MaxActiveSessions {
		return false
	}
	store.entries[sha256.Sum256([]byte(sessionID))] = sessionEntry{
		upstreamToken: upstreamToken,
		userAgent:     userAgent,
		expiresAt:     store.clock().Add(l0_axioms.SessionTTL),
	}
	return true
}

func (store *SessionStore) Lookup(sessionID string) (string, string, bool) {
	store.mu.Lock()
	defer store.mu.Unlock()
	key := sha256.Sum256([]byte(sessionID))
	entry, exists := store.entries[key]
	if !exists || !entry.expiresAt.After(store.clock()) {
		delete(store.entries, key)
		return "", "", false
	}
	return entry.upstreamToken, entry.userAgent, true
}

func (store *SessionStore) Delete(sessionID string) {
	store.mu.Lock()
	defer store.mu.Unlock()
	delete(store.entries, sha256.Sum256([]byte(sessionID)))
}

func (store *SessionStore) removeExpiredLocked() {
	now := store.clock()
	for key, entry := range store.entries {
		if !entry.expiresAt.After(now) {
			delete(store.entries, key)
		}
	}
}
