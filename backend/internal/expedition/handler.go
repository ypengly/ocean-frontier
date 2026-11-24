package expedition

import (
	"database/sql"
	"net/http"

	"oceanfrontier/internal/auth"
	"oceanfrontier/internal/httpx"
)

type Handler struct{ DB *sql.DB }

type startReq struct {
	Zone      string `json:"zone"`
	Submarine string `json:"submarine"`
}

func (h *Handler) Start(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.PlayerFrom(r.Context())
	var req startReq
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if req.Zone == "" || req.Submarine == "" || len(req.Zone) > 40 || len(req.Submarine) > 40 {
		httpx.WriteError(w, http.StatusBadRequest, "zone and submarine are required")
		return
	}
	var id string
	err := h.DB.QueryRowContext(r.Context(), `INSERT INTO expeditions (player_id, zone, submarine) VALUES ($1,$2,$3) RETURNING id`, p.ID, req.Zone, req.Submarine).Scan(&id)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not start expedition")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]string{"expeditionId": id})
}

type discoveryReq struct {
	ExpeditionID string  `json:"expeditionId"`
	TargetID     string  `json:"targetId"`
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	Zone         string  `json:"zone"`
	Depth        float64 `json:"depth"`
}

func (h *Handler) RecordDiscovery(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.PlayerFrom(r.Context())
	var req discoveryReq
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if req.TargetID == "" || req.Name == "" || req.Category == "" || req.Zone == "" || req.Depth < 0 || req.Depth > 20000 {
		httpx.WriteError(w, http.StatusBadRequest, "targetId, name, category, zone and a valid depth are required")
		return
	}
	var exp any
	if req.ExpeditionID != "" {
		exp = req.ExpeditionID
	}
	_, err := h.DB.ExecContext(r.Context(), `
		INSERT INTO discoveries (player_id, expedition_id, target_id, name, category, zone, depth)
		VALUES ($1, NULLIF($2::text,'')::uuid, $3, $4, $5, $6, $7)
		ON CONFLICT (player_id, target_id) DO NOTHING`, p.ID, exp, req.TargetID, req.Name, req.Category, req.Zone, req.Depth)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not record discovery")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]string{"status": "recorded"})
}

type discoveryRow struct {
	TargetID     string  `json:"targetId"`
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	Zone         string  `json:"zone"`
	Depth        float64 `json:"depth"`
	DiscoveredAt string  `json:"discoveredAt"`
}

func (h *Handler) ListDiscoveries(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.PlayerFrom(r.Context())
	rows, err := h.DB.QueryContext(r.Context(), `SELECT target_id, name, category, zone, depth, to_char(discovered_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') FROM discoveries WHERE player_id=$1 ORDER BY discovered_at DESC LIMIT 500`, p.ID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not load discoveries")
		return
	}
	defer rows.Close()
	out := []discoveryRow{}
	for rows.Next() {
		var d discoveryRow
		if err := rows.Scan(&d.TargetID, &d.Name, &d.Category, &d.Zone, &d.Depth, &d.DiscoveredAt); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "could not read discoveries")
			return
		}
		out = append(out, d)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
