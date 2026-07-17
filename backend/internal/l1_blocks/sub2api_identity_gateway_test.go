package l1_blocks

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
)

type identityRoundTripper func(*http.Request) (*http.Response, error)

func (transport identityRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

func TestSub2APIIdentityGatewayChecksOnlyFixedPrivateAuthority(t *testing.T) {
	gateway := NewSub2APIIdentityGateway(&http.Client{Transport: identityRoundTripper(func(request *http.Request) (*http.Response, error) {
		if request.URL.String() != "http://sub2api:8080/api/v1/auth/me" {
			t.Fatalf("URL = %q", request.URL.String())
		}
		if request.Header.Get("Authorization") != "Bearer upstream-token" {
			t.Fatalf("Authorization = %q", request.Header.Get("Authorization"))
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"code":0,"data":{"role":"admin","status":"active"}}`)), Header: make(http.Header)}, nil
	})})

	if got := gateway.Check(context.Background(), "upstream-token"); got != l0_axioms.AuthorizationAllowed {
		t.Fatalf("Check() = %q, want allowed", got)
	}
}

func TestSub2APIIdentityGatewayNormalizesUnauthorizedAndMalformedUpstream(t *testing.T) {
	for _, testCase := range []struct {
		name   string
		status int
		body   string
		want   l0_axioms.AuthorizationStatus
	}{
		{name: "unauthorized", status: http.StatusUnauthorized, body: `{}`, want: l0_axioms.AuthorizationUnauthorized},
		{name: "non admin", status: http.StatusOK, body: `{"code":0,"data":{"role":"user","status":"active"}}`, want: l0_axioms.AuthorizationForbidden},
		{name: "malformed", status: http.StatusOK, body: `{`, want: l0_axioms.AuthorizationUnavailable},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			gateway := NewSub2APIIdentityGateway(&http.Client{Transport: identityRoundTripper(func(*http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: testCase.status, Body: io.NopCloser(strings.NewReader(testCase.body)), Header: make(http.Header)}, nil
			})})
			if got := gateway.Check(context.Background(), "token"); got != testCase.want {
				t.Fatalf("Check() = %q, want %q", got, testCase.want)
			}
		})
	}
}
