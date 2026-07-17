package main

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// registerFrontendRoutes serves HTML without caching so a deployment immediately selects the current hashed bundle.
func registerFrontendRoutes(router *gin.Engine, frontendDir string) {
	indexPath := filepath.Join(frontendDir, "index.html")
	router.Static("/assets", filepath.Join(frontendDir, "assets"))
	router.GET("/", noStoreHTML(indexPath))
	router.NoRoute(func(c *gin.Context) {
		if c.Request.Method == http.MethodGet && !strings.HasPrefix(c.Request.URL.Path, "/api/") {
			noStoreHTML(indexPath)(c)
			return
		}
		c.Status(http.StatusNotFound)
	})
}

func noStoreHTML(indexPath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.File(indexPath)
	}
}
