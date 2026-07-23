package l3_diplomacy

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetHourlyProfileRejectsInvalidDays(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewAPIHandler(nil, nil)
	router.GET("/hourly-profile", handler.GetHourlyProfile)

	for _, days := range []string{"invalid", "14", "0"} {
		request := httptest.NewRequest(http.MethodGet, "/hourly-profile?days="+days, nil)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("days=%q status=%d want %d", days, response.Code, http.StatusBadRequest)
		}
	}

	request := httptest.NewRequest(http.MethodGet, "/hourly-profile?days=7&timezone=not/a-timezone", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("invalid timezone status=%d want %d", response.Code, http.StatusBadRequest)
	}
}
