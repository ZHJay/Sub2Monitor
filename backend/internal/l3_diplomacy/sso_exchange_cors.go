package l3_diplomacy

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// allowAPIOrigin permits same-origin Monitor requests and the fixed top-level API Bridge only.
func allowAPIOrigin(c *gin.Context) bool {
	origin := c.GetHeader("Origin")
	return origin == "" || origin == apiOrigin
}

func setAPIExchangeCORS(c *gin.Context) {
	noStore(c)
	if c.GetHeader("Origin") != apiOrigin {
		return
	}
	c.Header("Access-Control-Allow-Origin", apiOrigin)
	c.Header("Access-Control-Allow-Credentials", "true")
	c.Header("Vary", "Origin")
}

func (handler *APIHandler) SSOExchangePreflight(c *gin.Context) {
	if c.GetHeader("Origin") != apiOrigin || c.GetHeader("Access-Control-Request-Method") != http.MethodPost {
		c.Status(http.StatusForbidden)
		return
	}
	setAPIExchangeCORS(c)
	c.Header("Access-Control-Allow-Methods", http.MethodPost)
	c.Header("Access-Control-Allow-Headers", "Content-Type")
	c.Status(http.StatusNoContent)
}

// SSOSession confirms the current HttpOnly Monitor session after the top-level Bridge redirects back.
func (handler *APIHandler) SSOSession(c *gin.Context) {
	noStore(c)
	c.Status(http.StatusNoContent)
}
