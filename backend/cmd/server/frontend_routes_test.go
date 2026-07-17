package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRegisterFrontendRoutesDisablesCachingForHTMLEntryPoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	frontendDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(frontendDir, "index.html"), []byte("<html>new monitor</html>"), 0o600); err != nil {
		t.Fatalf("write index: %v", err)
	}

	router := gin.New()
	registerFrontendRoutes(router, frontendDir)

	for _, path := range []string{"/", "/dashboard"} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusOK {
			t.Fatalf("%s status = %d", path, recorder.Code)
		}
		if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
			t.Fatalf("%s Cache-Control = %q, want no-store", path, got)
		}
	}
}
