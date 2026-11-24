package world

import (
	"context"
	"database/sql"
	"io"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"

	"oceanfrontier/internal/httpx"
)

type Service struct {
	DB            *sql.DB
	Redis         *redis.Client
	SimulationURL string
	client        *http.Client
}

func New(db *sql.DB, rdb *redis.Client, simURL string) *Service {
	return &Service{DB: db, Redis: rdb, SimulationURL: simURL, client: &http.Client{Timeout: 5 * time.Second}}
}

// Health reports the status of every dependency. It returns 503 if any is down.
func (s *Service) Health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	status := map[string]string{"backend": "ok", "postgres": "ok", "redis": "ok", "simulation": "ok"}
	code := http.StatusOK
	if err := s.DB.PingContext(ctx); err != nil {
		status["postgres"] = "down"
		code = http.StatusServiceUnavailable
	}
	if err := s.Redis.Ping(ctx).Err(); err != nil {
		status["redis"] = "down"
		code = http.StatusServiceUnavailable
	}
	if _, err := s.proxy(ctx, "/health"); err != nil {
		status["simulation"] = "down"
		code = http.StatusServiceUnavailable
	}
	httpx.WriteJSON(w, code, status)
}

func (s *Service) proxy(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.SimulationURL+path, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, io.ErrUnexpectedEOF
	}
	return body, nil
}

// Species serves the species catalogue, cached in Redis for five minutes.
func (s *Service) Species(w http.ResponseWriter, r *http.Request) {
	const key = "sim:species"
	if cached, err := s.Redis.Get(r.Context(), key).Bytes(); err == nil {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(cached)
		return
	}
	body, err := s.proxy(r.Context(), "/species")
	if err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "simulation service unavailable")
		return
	}
	_ = s.Redis.Set(r.Context(), key, body, 5*time.Minute).Err()
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

func (s *Service) Terrain(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	path := "/terrain?seed=" + sanitizeInt(q.Get("seed"), "1") + "&size=" + sanitizeInt(q.Get("size"), "65")
	body, err := s.proxy(r.Context(), path)
	if err != nil {
		httpx.WriteError(w, http.StatusBadGateway, "simulation service unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

func sanitizeInt(v, def string) string {
	if v == "" || len(v) > 9 {
		return def
	}
	for _, c := range v {
		if c < '0' || c > '9' {
			return def
		}
	}
	return v
}
