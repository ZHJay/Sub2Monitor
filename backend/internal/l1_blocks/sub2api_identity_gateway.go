package l1_blocks

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

const sub2APIIdentityURL = "http://sub2api:8080/api/v1/auth/me"
const maxIdentityResponseBytes = 64 << 10

// IdentityGateway is the stable L1 contract consumed by the session flow.
type IdentityGateway interface {
	Check(context.Context, string) l0_axioms.AuthorizationStatus
}

// Sub2APIIdentityGateway queries the fixed private Sub2API authority only.
type Sub2APIIdentityGateway struct {
	client *http.Client
}

func NewSub2APIIdentityGateway(client *http.Client) *Sub2APIIdentityGateway {
	if client == nil {
		client = &http.Client{}
	}
	clientCopy := *client
	// 5s: 1GB host + swap makes Sub2API /auth/me occasionally exceed 3s; metrics then 503.
	clientCopy.Timeout = 5 * time.Second
	clientCopy.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return &Sub2APIIdentityGateway{client: &clientCopy}
}

func (gateway *Sub2APIIdentityGateway) Check(ctx context.Context, token string) l0_axioms.AuthorizationStatus {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, sub2APIIdentityURL, nil)
	if err != nil {
		return l0_axioms.AuthorizationUnavailable
	}
	request.Header.Set("Authorization", "Bearer "+token)
	response, err := gateway.client.Do(request)
	if err != nil {
		return l0_axioms.AuthorizationUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized {
		return l0_axioms.AuthorizationUnauthorized
	}
	if response.StatusCode == http.StatusForbidden {
		return l0_axioms.AuthorizationForbidden
	}
	if response.StatusCode != http.StatusOK {
		return l0_axioms.AuthorizationUnavailable
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxIdentityResponseBytes+1))
	if err != nil || len(body) > maxIdentityResponseBytes {
		return l0_axioms.AuthorizationUnavailable
	}
	var envelope struct {
		Code int `json:"code"`
		Data struct {
			Role   string `json:"role"`
			Status string `json:"status"`
		} `json:"data"`
	}
	if json.Unmarshal(body, &envelope) != nil || envelope.Code != 0 {
		return l0_axioms.AuthorizationUnavailable
	}
	if envelope.Data.Role != "admin" || envelope.Data.Status != "active" {
		return l0_axioms.AuthorizationForbidden
	}
	return l0_axioms.AuthorizationAllowed
}
