package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port          string
	DatabaseURL   string
	RedisURL      string
	JWTSecret     string
	SimulationURL string
	AllowedOrigin string
	MigrationsDir string
	SeedsDir      string
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func Load() (Config, error) {
	c := Config{
		Port:          env("BACKEND_PORT", "8080"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		RedisURL:      env("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:     os.Getenv("JWT_SECRET"),
		SimulationURL: env("SIMULATION_URL", "http://localhost:8000"),
		AllowedOrigin: env("ALLOWED_ORIGIN", "http://localhost:5173"),
		MigrationsDir: env("MIGRATIONS_DIR", "../database/migrations"),
		SeedsDir:      env("SEEDS_DIR", "/seeds"),
	}
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("DATABASE_URL is required")
	}
	if len(c.JWTSecret) < 16 {
		return c, fmt.Errorf("JWT_SECRET must be at least 16 characters")
	}
	return c, nil
}
