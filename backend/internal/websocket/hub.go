package websocket

import (
	"encoding/json"
	"log/slog"
	"math"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"oceanfrontier/internal/auth"
	"oceanfrontier/internal/httpx"
)

const (
	maxRoomSize = 8
	maxMsgBytes = 2048
	poseMinGap  = 40 * time.Millisecond // 25 Hz cap per client
)

var roomRe = regexp.MustCompile(`^[A-Za-z0-9_-]{3,24}$`)

type Hub struct {
	Auth     *auth.Service
	Log      *slog.Logger
	Origin   string
	mu       sync.Mutex
	rooms    map[string]map[*client]struct{}
	upgrader websocket.Upgrader
}

type client struct {
	id       string
	name     string
	room     string
	conn     *websocket.Conn
	send     chan []byte
	lastPose time.Time
}

type inbound struct {
	Type     string  `json:"type"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Yaw      float64 `json:"yaw"`
	Pitch    float64 `json:"pitch"`
	Speed    float64 `json:"speed"`
	TargetID string  `json:"targetId"`
	Name     string  `json:"name"`
	Text     string  `json:"text"`
}

func NewHub(a *auth.Service, log *slog.Logger, origin string) *Hub {
	h := &Hub{Auth: a, Log: log, Origin: origin, rooms: map[string]map[*client]struct{}{}}
	h.upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     func(r *http.Request) bool { o := r.Header.Get("Origin"); return o == "" || o == origin },
	}
	return h
}

func finite(vals ...float64) bool {
	for _, v := range vals {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return false
		}
	}
	return true
}

func clamp(v, lo, hi float64) float64 { return math.Max(lo, math.Min(hi, v)) }

// Serve upgrades GET /ws?room=CODE&token=JWT to a WebSocket connection.
func (h *Hub) Serve(w http.ResponseWriter, r *http.Request) {
	room := r.URL.Query().Get("room")
	if !roomRe.MatchString(room) {
		httpx.WriteError(w, http.StatusBadRequest, "room must be 3-24 letters, digits, - or _")
		return
	}
	p, err := h.Auth.Parse(r.URL.Query().Get("token"))
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "invalid or expired token")
		return
	}
	h.mu.Lock()
	if len(h.rooms[room]) >= maxRoomSize {
		h.mu.Unlock()
		httpx.WriteError(w, http.StatusConflict, "expedition room is full")
		return
	}
	h.mu.Unlock()

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	c := &client{id: p.ID, name: p.Username, room: room, conn: conn, send: make(chan []byte, 32)}
	peers := h.join(c)
	go h.writePump(c)
	welcome, _ := json.Marshal(map[string]any{"type": "welcome", "id": c.id, "peers": peers})
	c.send <- welcome
	h.broadcast(c, map[string]any{"type": "join", "id": c.id, "name": c.name})
	h.readPump(c)
}

func (h *Hub) join(c *client) []map[string]string {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[c.room] == nil {
		h.rooms[c.room] = map[*client]struct{}{}
	}
	peers := []map[string]string{}
	for other := range h.rooms[c.room] {
		peers = append(peers, map[string]string{"id": other.id, "name": other.name})
	}
	h.rooms[c.room][c] = struct{}{}
	return peers
}

func (h *Hub) leave(c *client) {
	h.mu.Lock()
	if set, ok := h.rooms[c.room]; ok {
		delete(set, c)
		if len(set) == 0 {
			delete(h.rooms, c.room)
		}
	}
	h.mu.Unlock()
	close(c.send)
	h.broadcast(c, map[string]any{"type": "leave", "id": c.id})
}

func (h *Hub) broadcast(from *client, msg map[string]any) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for other := range h.rooms[from.room] {
		if other == from {
			continue
		}
		select {
		case other.send <- data:
		default: // slow consumer: drop the frame rather than block the room
		}
	}
}

func (h *Hub) readPump(c *client) {
	defer func() {
		h.leave(c)
		_ = c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMsgBytes)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error { return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })
	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var m inbound
		if json.Unmarshal(raw, &m) != nil {
			continue
		}
		switch m.Type {
		case "pose":
			now := time.Now()
			if now.Sub(c.lastPose) < poseMinGap || !finite(m.X, m.Y, m.Z, m.Yaw, m.Pitch, m.Speed) {
				continue
			}
			c.lastPose = now
			h.broadcast(c, map[string]any{
				"type": "pose", "id": c.id,
				"x": clamp(m.X, -5000, 5000), "y": clamp(m.Y, -5000, 5), "z": clamp(m.Z, -5000, 5000),
				"yaw": m.Yaw, "pitch": clamp(m.Pitch, -1.6, 1.6), "speed": clamp(m.Speed, -50, 50),
			})
		case "discovery":
			if m.TargetID == "" || len(m.TargetID) > 64 || len(m.Name) > 80 {
				continue
			}
			h.broadcast(c, map[string]any{"type": "discovery", "id": c.id, "from": c.name, "targetId": m.TargetID, "name": m.Name})
		case "chat":
			if m.Text == "" || len(m.Text) > 200 {
				continue
			}
			h.broadcast(c, map[string]any{"type": "chat", "id": c.id, "from": c.name, "text": m.Text})
		}
	}
}

func (h *Hub) writePump(c *client) {
	ticker := time.NewTicker(25 * time.Second)
	defer func() { ticker.Stop(); _ = c.conn.Close() }()
	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				return
			}
			_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
