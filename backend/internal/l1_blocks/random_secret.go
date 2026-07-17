package l1_blocks

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

// NewRandomBase64URL returns unpadded base64url text with exactly size bytes of CSPRNG entropy.
func NewRandomBase64URL(size int) (string, error) {
	if size <= 0 {
		return "", fmt.Errorf("random secret size must be positive")
	}
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// IsExactBase64URL verifies a canonical unpadded base64url value with the specified decoded length.
func IsExactBase64URL(value string, size int) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	return err == nil && len(decoded) == size && base64.RawURLEncoding.EncodeToString(decoded) == value
}
