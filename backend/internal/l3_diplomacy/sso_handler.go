package l3_diplomacy

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l2_flows"

	"github.com/gin-gonic/gin"
)

const (
	monitorStateCookieName   = "__Host-apimonitor_sso_state"
	monitorSessionCookieName = "__Host-apimonitor_session"
	apiOrigin                = "https://burntoken.org"
	monitorOrigin            = "https://monitor.burntoken.org"
	bridgeCSP                = "default-src 'none'; script-src 'self'; connect-src https://monitor.burntoken.org; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
)

const bridgeHTML = `<!doctype html><html><head><meta charset="utf-8"><title>Sub2Monitor SSO</title></head><body><script src="/_monitor-sso/bridge.js" defer></script></body></html>`
const bridgeJavaScript = `(async function(){'use strict';const monitorOrigin='https://monitor.burntoken.org';const state=new URLSearchParams(location.search).get('state')||'';const token=localStorage.getItem('auth_token');const finish=(result)=>location.replace(monitorOrigin+'/?sso='+result);if(!token||!state){finish('login');return}try{const exchangeResponse=await fetch(monitorOrigin+'/api/auth/sso/exchange',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:state,token:token})});finish(exchangeResponse.ok?'complete':(exchangeResponse.status===401||exchangeResponse.status===403?'login':'unavailable'))}catch(error){finish('unavailable')}})();`

type exchangeRequest struct {
	State string `json:"state"`
	Token string `json:"token"`
}

func noStore(c *gin.Context) { c.Header("Cache-Control", "no-store") }

func writeHostCookie(c *gin.Context, name, value string, maxAge int, httpOnly bool) {
	http.SetCookie(c.Writer, &http.Cookie{Name: name, Value: value, Path: "/", MaxAge: maxAge, Secure: true, HttpOnly: httpOnly, SameSite: http.SameSiteStrictMode})
}

func clearStateCookie(c *gin.Context)   { writeHostCookie(c, monitorStateCookieName, "", -1, true) }
func clearSessionCookie(c *gin.Context) { writeHostCookie(c, monitorSessionCookieName, "", -1, true) }

func (handler *APIHandler) SSOChallenge(c *gin.Context) {
	state, err := handler.SSOFlow.IssueChallenge()
	if err != nil {
		noStore(c)
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Authentication temporarily unavailable"})
		return
	}
	noStore(c)
	writeHostCookie(c, monitorStateCookieName, state, int(l0_axioms.ChallengeTTL.Seconds()), true)
	c.JSON(http.StatusOK, gin.H{"state": state})
}

func (handler *APIHandler) SSOExchange(c *gin.Context) {
	if !allowAPIOrigin(c) {
		noStore(c)
		c.JSON(http.StatusForbidden, gin.H{"error": "Invalid authentication origin"})
		return
	}
	setAPIExchangeCORS(c)
	clearStateCookie(c)
	if !strings.HasPrefix(c.GetHeader("Content-Type"), "application/json") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid authentication request"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var request exchangeRequest
	decoder := json.NewDecoder(c.Request.Body)
	if decoder.Decode(&request) != nil || decoder.Decode(&struct{}{}) != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid authentication request"})
		return
	}
	cookie, _ := c.Request.Cookie(monitorStateCookieName)
	cookieState := ""
	if cookie != nil {
		cookieState = cookie.Value
	}
	sessionID, status := handler.SSOFlow.Exchange(cookieState, request.State, request.Token, c.Request.UserAgent())
	if status != l0_axioms.AuthorizationAllowed {
		handler.writeAuthorizationFailure(c, status, false)
		return
	}
	writeHostCookie(c, monitorSessionCookieName, sessionID, int(l0_axioms.SessionTTL.Seconds()), true)
	c.Status(http.StatusNoContent)
}

func (handler *APIHandler) SSOLogout(c *gin.Context) {
	cookie, _ := c.Request.Cookie(monitorSessionCookieName)
	if cookie != nil {
		handler.SSOFlow.Logout(cookie.Value)
	}
	noStore(c)
	clearSessionCookie(c)
	c.Status(http.StatusNoContent)
}

func (handler *APIHandler) SSOBridgePage(c *gin.Context) {
	if !strings.EqualFold(c.Request.Host, "burntoken.org") {
		c.Status(http.StatusNotFound)
		return
	}
	noStore(c)
	c.Header("Content-Security-Policy", bridgeCSP)
	c.Header("Referrer-Policy", "no-referrer")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(bridgeHTML))
}

func (handler *APIHandler) SSOBridgeScript(c *gin.Context) {
	if !strings.EqualFold(c.Request.Host, "burntoken.org") {
		c.Status(http.StatusNotFound)
		return
	}
	noStore(c)
	c.Header("Referrer-Policy", "no-referrer")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Data(http.StatusOK, "application/javascript; charset=utf-8", []byte(bridgeJavaScript))
}

func MonitorAuthorizationMiddleware(flow *l2_flows.SSOFlow) gin.HandlerFunc {
	return func(c *gin.Context) {
		cookie, _ := c.Request.Cookie(monitorSessionCookieName)
		status := l0_axioms.AuthorizationUnauthorized
		if cookie != nil {
			status = flow.Authorize(cookie.Value)
		}
		if status != l0_axioms.AuthorizationAllowed {
			// Why not always clear: AuthorizationUnavailable is a transient Sub2API blip;
			// wiping the cookie forces a full SSO loop on every 30s refresh under load.
			clearSession := status == l0_axioms.AuthorizationUnauthorized || status == l0_axioms.AuthorizationForbidden
			(&APIHandler{}).writeAuthorizationFailure(c, status, clearSession)
			c.Abort()
			return
		}
		c.Next()
	}
}

func (handler *APIHandler) writeAuthorizationFailure(c *gin.Context, status l0_axioms.AuthorizationStatus, clearSession bool) {
	if clearSession || status == l0_axioms.AuthorizationUnauthorized || status == l0_axioms.AuthorizationForbidden {
		clearSessionCookie(c)
	}
	noStore(c)
	switch status {
	case l0_axioms.AuthorizationForbidden:
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
	case l0_axioms.AuthorizationUnavailable:
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Authentication temporarily unavailable"})
	default:
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
	}
}
