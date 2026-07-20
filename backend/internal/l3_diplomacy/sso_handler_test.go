package l3_diplomacy

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l1_blocks"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l2_flows"

	"github.com/gin-gonic/gin"
)

type alwaysAdminGateway struct{}

func (alwaysAdminGateway) Check(context.Context, string, string) l0_axioms.AuthorizationStatus {
	return l0_axioms.AuthorizationAllowed
}

func newSSOTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	flow := l2_flows.NewSSOFlow(
		l1_blocks.NewOneTimeStateStore(time.Now),
		l1_blocks.NewSessionStore(time.Now),
		alwaysAdminGateway{},
	)
	router := gin.New()
	NewAPIHandler(nil, flow).SetupRoutes(router)
	return router
}

func TestSSOChallengeExchangeSetsHostOnlySessionAndConsumesState(t *testing.T) {
	router := newSSOTestRouter()
	challengeRequest := httptest.NewRequest(http.MethodPost, "/api/auth/sso/challenge", nil)
	challengeResponse := httptest.NewRecorder()
	router.ServeHTTP(challengeResponse, challengeRequest)
	if challengeResponse.Code != http.StatusOK {
		t.Fatalf("challenge status = %d: %s", challengeResponse.Code, challengeResponse.Body.String())
	}
	stateCookie := challengeResponse.Result().Cookies()[0]
	var challenge struct {
		State string `json:"state"`
	}
	if err := json.Unmarshal(challengeResponse.Body.Bytes(), &challenge); err != nil || challenge.State == "" {
		t.Fatalf("invalid challenge response: %v %s", err, challengeResponse.Body.String())
	}

	exchangeRequest := httptest.NewRequest(http.MethodPost, "/api/auth/sso/exchange", strings.NewReader(`{"state":"`+challenge.State+`","token":"upstream-token"}`))
	exchangeRequest.Header.Set("Content-Type", "application/json")
	exchangeRequest.Header.Set("User-Agent", "Browser User Agent")
	exchangeRequest.AddCookie(stateCookie)
	exchangeResponse := httptest.NewRecorder()
	router.ServeHTTP(exchangeResponse, exchangeRequest)
	if exchangeResponse.Code != http.StatusNoContent {
		t.Fatalf("exchange status = %d: %s", exchangeResponse.Code, exchangeResponse.Body.String())
	}
	cookies := exchangeResponse.Result().Cookies()
	if len(cookies) != 2 || cookies[1].Name != monitorSessionCookieName || !cookies[1].HttpOnly || !cookies[1].Secure || cookies[1].Domain != "" {
		t.Fatalf("unexpected exchange cookies: %#v", cookies)
	}
}

func TestSSOExchangeAllowsOnlyAPIBridgeOriginAndSessionStatus(t *testing.T) {
	router := newSSOTestRouter()
	preflight := httptest.NewRequest(http.MethodOptions, "/api/auth/sso/exchange", nil)
	preflight.Header.Set("Origin", apiOrigin)
	preflight.Header.Set("Access-Control-Request-Method", http.MethodPost)
	preflightResponse := httptest.NewRecorder()
	router.ServeHTTP(preflightResponse, preflight)
	if preflightResponse.Code != http.StatusNoContent || preflightResponse.Header().Get("Access-Control-Allow-Origin") != apiOrigin || preflightResponse.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("unsafe preflight: status=%d headers=%v", preflightResponse.Code, preflightResponse.Header())
	}

	challengeResponse := httptest.NewRecorder()
	router.ServeHTTP(challengeResponse, httptest.NewRequest(http.MethodPost, "/api/auth/sso/challenge", nil))
	var challenge struct {
		State string `json:"state"`
	}
	if err := json.Unmarshal(challengeResponse.Body.Bytes(), &challenge); err != nil {
		t.Fatal(err)
	}
	exchange := httptest.NewRequest(http.MethodPost, "/api/auth/sso/exchange", strings.NewReader(`{"state":"`+challenge.State+`","token":"upstream-token"}`))
	exchange.Header.Set("Content-Type", "application/json")
	exchange.Header.Set("Origin", apiOrigin)
	exchange.Header.Set("User-Agent", "Browser User Agent")
	exchange.AddCookie(challengeResponse.Result().Cookies()[0])
	exchangeResponse := httptest.NewRecorder()
	router.ServeHTTP(exchangeResponse, exchange)
	if exchangeResponse.Code != http.StatusNoContent {
		t.Fatalf("exchange status=%d", exchangeResponse.Code)
	}

	session := httptest.NewRequest(http.MethodGet, "/api/auth/sso/session", nil)
	session.AddCookie(exchangeResponse.Result().Cookies()[1])
	sessionResponse := httptest.NewRecorder()
	router.ServeHTTP(sessionResponse, session)
	if sessionResponse.Code != http.StatusNoContent {
		t.Fatalf("session status=%d", sessionResponse.Code)
	}
}

func TestSSOBridgeRejectsUnexpectedHostAndExchangesCurrentAccessToken(t *testing.T) {
	router := newSSOTestRouter()
	request := httptest.NewRequest(http.MethodGet, "/internal/sso/bridge.js", nil)
	request.Host = "monitor.burntoken.org"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("unexpected host status = %d", response.Code)
	}

	pageRequest := httptest.NewRequest(http.MethodGet, "/internal/sso/bridge", nil)
	pageRequest.Host = "burntoken.org"
	pageResponse := httptest.NewRecorder()
	router.ServeHTTP(pageResponse, pageRequest)
	wantCSP := "default-src 'none'; script-src 'self'; connect-src https://monitor.burntoken.org; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
	if pageResponse.Code != http.StatusOK || pageResponse.Header().Get("Content-Security-Policy") != wantCSP {
		t.Fatalf("unexpected bridge page: status=%d csp=%q", pageResponse.Code, pageResponse.Header().Get("Content-Security-Policy"))
	}

	request = httptest.NewRequest(http.MethodGet, "/internal/sso/bridge.js", nil)
	request.Host = "burntoken.org"
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	script := response.Body.String()
	if response.Code != http.StatusOK ||
		!strings.Contains(script, "localStorage.getItem('auth_token')") ||
		strings.Contains(script, "refresh_token") ||
		strings.Contains(script, "/api/v1/auth/refresh") ||
		!strings.Contains(script, "JSON.stringify({state:state,token:token})") ||
		!strings.Contains(script, "finish(exchangeResponse.ok?'complete':(exchangeResponse.status===401||exchangeResponse.status===403?'login':'unavailable'))") ||
		!strings.Contains(script, "catch(error){finish('unavailable')}") ||
		response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("unexpected bridge response: %d %q", response.Code, response.Body.String())
	}
}
