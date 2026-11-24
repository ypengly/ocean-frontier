package inventory

import (
	"database/sql"
	"net/http"
	"regexp"

	"oceanfrontier/internal/auth"
	"oceanfrontier/internal/httpx"
)

type Handler struct{ DB *sql.DB }

var itemRe = regexp.MustCompile(`^[a-z_]{2,32}$`)

type item struct {
	ItemID   string `json:"itemId"`
	Quantity int    `json:"quantity"`
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.PlayerFrom(r.Context())
	rows, err := h.DB.QueryContext(r.Context(), `SELECT item_id, quantity FROM inventory_items WHERE player_id=$1 ORDER BY item_id`, p.ID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not load inventory")
		return
	}
	defer rows.Close()
	out := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ItemID, &it.Quantity); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "could not read inventory")
			return
		}
		out = append(out, it)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// Put replaces the player's inventory with the supplied items inside one transaction.
func (h *Handler) Put(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.PlayerFrom(r.Context())
	var items []item
	if !httpx.DecodeJSON(w, r, &items) {
		return
	}
	if len(items) > 100 {
		httpx.WriteError(w, http.StatusBadRequest, "too many items")
		return
	}
	for _, it := range items {
		if !itemRe.MatchString(it.ItemID) || it.Quantity < 0 || it.Quantity > 100000 {
			httpx.WriteError(w, http.StatusBadRequest, "invalid item "+it.ItemID)
			return
		}
	}
	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not start transaction")
		return
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(r.Context(), `DELETE FROM inventory_items WHERE player_id=$1`, p.ID); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not update inventory")
		return
	}
	for _, it := range items {
		if it.Quantity == 0 {
			continue
		}
		if _, err := tx.ExecContext(r.Context(), `INSERT INTO inventory_items (player_id,item_id,quantity) VALUES ($1,$2,$3)`, p.ID, it.ItemID, it.Quantity); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, "could not update inventory")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not commit inventory")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}
