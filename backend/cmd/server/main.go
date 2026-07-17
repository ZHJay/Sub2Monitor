package main

import (
	"fmt"
	"log"

	"github.com/ZHJay/Sub2Monitor/backend/config"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l1_blocks"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l2_flows"
	"github.com/ZHJay/Sub2Monitor/backend/internal/l3_diplomacy"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load configuration: %v", err)
	}
	gin.SetMode(cfg.GinMode)
	db, err := connectDatabase(cfg)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	flow := l2_flows.NewSSOFlow(l1_blocks.NewOneTimeStateStore(nil), l1_blocks.NewSessionStore(nil), l1_blocks.NewSub2APIIdentityGateway(nil))
	handler := l3_diplomacy.NewAPIHandler(db, flow)
	router := gin.Default()
	handler.SetupRoutes(router)
	registerFrontendRoutes(router, "./frontend/dist")
	if err := router.Run(fmt.Sprintf(":%d", cfg.ServerPort)); err != nil {
		log.Fatalf("run server: %v", err)
	}
}

func connectDatabase(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.GetDSN()), &gorm.Config{Logger: logger.Default.LogMode(logger.Info)})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get database connection: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	return db, nil
}
