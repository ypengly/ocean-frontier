package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"oceanfrontier/internal/auth"
	"oceanfrontier/internal/config"
	"oceanfrontier/internal/db"
	"oceanfrontier/internal/expedition"
	"oceanfrontier/internal/httpx"
	"oceanfrontier/internal/inventory"
	"oceanfrontier/internal/player"
	"oceanfrontier/internal/websocket"
	"oceanfrontier/internal/world"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		log.Error("configuration error", "err", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	database, err := db.Open(ctx, cfg.DatabaseURL, log)
	if err != nil {
		log.Error("database", "err", err)
		os.Exit(1)
	}
	defer database.Close()
	if err := db.Migrate(ctx, database, cfg.MigrationsDir, log); err != nil {
		log.Error("migrations failed", "err", err)
		os.Exit(1)
	}
	if err := db.Seed(ctx, database, cfg.SeedsDir, log); err != nil {
		log.Error("seeding failed", "err", err)
		os.Exit(1)
	}

	ropts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Error("redis url", "err", err)
		os.Exit(1)
	}
	rdb := redis.NewClient(ropts)
	defer rdb.Close()

	authSvc := &auth.Service{DB: database, Secret: []byte(cfg.JWTSecret)}
	players := &player.Handler{DB: database}
	exps := &expedition.Handler{DB: database}
	inv := &inventory.Handler{DB: database}
	worldSvc := world.New(database, rdb, cfg.SimulationURL)
	hub := websocket.NewHub(authSvc, log, cfg.AllowedOrigin)

	api := http.NewServeMux()
	api.HandleFunc("GET /health", worldSvc.Health)
	api.HandleFunc("POST /api/auth/register", authSvc.Register)
	api.HandleFunc("POST /api/auth/login", authSvc.Login)
	api.HandleFunc("GET /api/save", authSvc.Require(players.GetSave))
	api.HandleFunc("PUT /api/save", authSvc.Require(players.PutSave))
	api.HandleFunc("POST /api/expeditions", authSvc.Require(exps.Start))
	api.HandleFunc("POST /api/discoveries", authSvc.Require(exps.RecordDiscovery))
	api.HandleFunc("GET /api/discoveries", authSvc.Require(exps.ListDiscoveries))
	api.HandleFunc("GET /api/inventory", authSvc.Require(inv.Get))
	api.HandleFunc("PUT /api/inventory", authSvc.Require(inv.Put))
	api.HandleFunc("GET /api/sim/species", worldSvc.Species)
	api.HandleFunc("GET /api/sim/terrain", worldSvc.Terrain)

	root := http.NewServeMux()
	root.Handle("/ws", http.HandlerFunc(hub.Serve)) // outside the logging wrapper so the connection can be hijacked
	root.Handle("/", httpx.Chain(api, httpx.Recover(log), httpx.CORS(cfg.AllowedOrigin), httpx.Logging(log)))

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: root, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Info("backend listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server", "err", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	log.Info("backend stopped")
}
