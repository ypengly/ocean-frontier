package db

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"time"

	_ "github.com/lib/pq"
)

// Open connects to PostgreSQL, retrying while the container starts.
func Open(ctx context.Context, url string, log *slog.Logger) (*sql.DB, error) {
	d, err := sql.Open("postgres", url)
	if err != nil {
		return nil, err
	}
	d.SetMaxOpenConns(20)
	d.SetConnMaxLifetime(30 * time.Minute)
	var last error
	for i := 0; i < 20; i++ {
		pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		last = d.PingContext(pingCtx)
		cancel()
		if last == nil {
			return d, nil
		}
		log.Warn("database not ready", "attempt", i+1, "err", last)
		time.Sleep(time.Second)
	}
	return nil, fmt.Errorf("database unreachable: %w", last)
}

// Migrate applies *.sql files in lexical order, once each.
func Migrate(ctx context.Context, d *sql.DB, dir string, log *slog.Logger) error {
	if _, err := d.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	return applyDir(ctx, d, dir, "schema_migrations", log)
}

// Seed applies seed files (idempotent SQL) once each.
func Seed(ctx context.Context, d *sql.DB, dir string, log *slog.Logger) error {
	if _, err := os.Stat(dir); err != nil {
		log.Warn("seed directory missing, skipping", "dir", dir)
		return nil
	}
	if _, err := d.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_seeds (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	return applyDir(ctx, d, dir, "schema_seeds", log)
}

func applyDir(ctx context.Context, d *sql.DB, dir, table string, log *slog.Logger) error {
	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		return err
	}
	sort.Strings(files)
	for _, f := range files {
		name := filepath.Base(f)
		var exists bool
		if err := d.QueryRowContext(ctx, fmt.Sprintf(`SELECT EXISTS (SELECT 1 FROM %s WHERE name = $1)`, table), name).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		body, err := os.ReadFile(f)
		if err != nil {
			return err
		}
		tx, err := d.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(body)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("%s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`INSERT INTO %s (name) VALUES ($1)`, table), name); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		log.Info("applied", "table", table, "file", name)
	}
	return nil
}
