package l3_diplomacy

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/ZHJay/Sub2Monitor/backend/internal/l0_axioms"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l2_flows"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// APIHandler contains HTTP-bound dependencies. Authentication policy remains in SSOFlow.
type APIHandler struct {
	DB      *gorm.DB
	SSOFlow *l2_flows.SSOFlow
}

func NewAPIHandler(db *gorm.DB, ssoFlow *l2_flows.SSOFlow) *APIHandler {
	return &APIHandler{DB: db, SSOFlow: ssoFlow}
}

// parseMetricsFilter reads include_cache + user_scope/user_email query params.
// Contract: include_cache defaults true; personal → PersonalMonitorEmail;
// user_email only accepted when in AllowedScopeEmails.
func parseMetricsFilter(c *gin.Context) l0_axioms.MetricsFilter {
	includeCache := true
	if raw := c.Query("include_cache"); raw != "" {
		includeCache = raw == "1" || strings.EqualFold(raw, "true")
	}

	email := strings.TrimSpace(c.Query("user_email"))
	scope := strings.ToLower(strings.TrimSpace(c.Query("user_scope")))
	switch scope {
	case "personal", "me", "self":
		email = l0_axioms.PersonalMonitorEmail
	case "all":
		email = ""
	default:
		// Fixed allowlist only — never open-scan arbitrary emails.
		email = l0_axioms.NormalizeScopeEmail(email)
	}

	return l0_axioms.MetricsFilter{IncludeCache: includeCache, UserEmail: email}
}

func (handler *APIHandler) GetMetricsSummary(c *gin.Context) {
	summary, err := l2_flows.AggregateSummaryMetrics(handler.DB, parseMetricsFilter(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Metrics temporarily unavailable"})
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (handler *APIHandler) GetTimeSeries(c *gin.Context) {
	response, err := l2_flows.AggregateTimeSeries(
		handler.DB,
		parseMetricsFilter(c),
		c.DefaultQuery("range", "24h"),
		c.DefaultQuery("interval", "1h"),
		c.DefaultQuery("metric", "cost"),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid metrics query"})
		return
	}
	c.JSON(http.StatusOK, response)
}

func (handler *APIHandler) GetByModel(c *gin.Context) {
	response, err := l2_flows.AggregateModelStats(handler.DB, parseMetricsFilter(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Metrics temporarily unavailable"})
		return
	}
	c.JSON(http.StatusOK, response)
}

func (handler *APIHandler) GetDailyHeatmap(c *gin.Context) {
	days := 365
	if raw := c.Query("days"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			days = parsed
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid metrics query"})
			return
		}
	}
	metric := c.DefaultQuery("metric", "tokens")
	response, err := l2_flows.AggregateDailyHeatmap(handler.DB, parseMetricsFilter(c), days, metric)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid metrics query"})
		return
	}
	c.JSON(http.StatusOK, response)
}

func (handler *APIHandler) GetIntradayHeatmap(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid metrics query"})
		return
	}
	response, err := l2_flows.AggregateIntradayHeatmap(handler.DB, parseMetricsFilter(c), date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid metrics query"})
		return
	}
	c.JSON(http.StatusOK, response)
}

func (handler *APIHandler) HealthCheck(c *gin.Context) {
	sqlDB, err := handler.DB.DB()
	if err != nil || sqlDB.Ping() != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "healthy"})
}

func (handler *APIHandler) SetupRoutes(router *gin.Engine) {
	router.GET("/health", handler.HealthCheck)
	router.GET("/internal/sso/bridge", handler.SSOBridgePage)
	router.GET("/internal/sso/bridge.js", handler.SSOBridgeScript)

	auth := router.Group("/api/auth/sso")
	auth.POST("/challenge", handler.SSOChallenge)
	auth.OPTIONS("/exchange", handler.SSOExchangePreflight)
	auth.POST("/exchange", handler.SSOExchange)
	auth.GET("/session", MonitorAuthorizationMiddleware(handler.SSOFlow), handler.SSOSession)
	auth.POST("/logout", handler.SSOLogout)

	metrics := router.Group("/api/metrics")
	metrics.Use(MonitorAuthorizationMiddleware(handler.SSOFlow))
	metrics.GET("/summary", handler.GetMetricsSummary)
	metrics.GET("/timeseries", handler.GetTimeSeries)
	metrics.GET("/by-model", handler.GetByModel)
	metrics.GET("/daily-heatmap", handler.GetDailyHeatmap)
	metrics.GET("/intraday-heatmap", handler.GetIntradayHeatmap)
}
