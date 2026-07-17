package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config contains deployment settings; authorization always targets the fixed Docker-private Sub2API authority.
type Config struct {
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	ServerPort int
	GinMode    string
}

func Load() (*Config, error) {
	config := &Config{
		DBHost: getEnv("DB_HOST", "sub2api-postgres"), DBPort: getEnvInt("DB_PORT", 5432),
		DBUser: getEnv("DB_USER", "monitor_readonly"), DBPassword: getEnv("DB_PASSWORD", ""),
		DBName: getEnv("DB_NAME", "sub2api"), DBSSLMode: getEnv("DB_SSLMODE", "disable"),
		ServerPort: getEnvInt("SERVER_PORT", 8090), GinMode: getEnv("GIN_MODE", "debug"),
	}
	if config.DBPassword == "" {
		return nil, fmt.Errorf("DB_PASSWORD is required")
	}
	return config, nil
}

func (config *Config) GetDSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s", config.DBHost, config.DBPort, config.DBUser, config.DBPassword, config.DBName, config.DBSSLMode)
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func getEnvInt(key string, fallback int) int {
	if value, err := strconv.Atoi(os.Getenv(key)); err == nil && os.Getenv(key) != "" {
		return value
	}
	return fallback
}
