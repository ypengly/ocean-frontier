package player

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"oceanfrontier/internal/auth"
	"oceanfrontier/internal/httpx"
)

const maxSaveBytes = 256 * 1024

type Handler struct{ DB *sql.DB }

type savePayload struct {
	Version int             `json:"version"`
	Data    json.RawMessage `json:"data"`
}

func (h *Handler) GetSave(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.PlayerFrom(r.Context())
	var data []byte
	var version int
	err := h.DB.QueryRowContext(r.Context(), `SELECT data, version FROM saves WHERE player_id = $1`, p.ID).Scan(&data, &version)
	if errors.Is(err, sql.ErrNoRows) {
		httpx.WriteError(w, http.StatusNotFound, "no saved expedition")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not load save")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, savePayload{Version: version, Data: data})
}

func (h *Handler) PutSave(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.PlayerFrom(r.Context())
	var body savePayload
	if !httpx.DecodeJSON(w, r, &body) {
		return
	}
	if len(body.Data) == 0 || len(body.Data) > maxSaveBytes || !json.Valid(body.Data) {
		httpx.WriteError(w, http.StatusBadRequest, "save data must be valid JSON under 256 KB")
		return
	}
	if body.Version < 1 {
		body.Version = 1
	}
	_, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO saves (player_id, data, version, updated_at) VALUES ($1, $2, $3, now())
		ON CONFLICT (player_id) DO UPDATE SET data = EXCLUDED.data, version = EXCLUDED.version, updated_at = now()`,
		p.ID, []byte(body.Data), body.Version)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not write save")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}
