package auth

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"

	"oceanfrontier/internal/httpx"
)

type ctxKey struct{}

type Player struct {
	ID       string
	Username string
}

type Service struct {
	DB     *sql.DB
	Secret []byte
}

var usernameRe = regexp.MustCompile(`^[A-Za-z0-9_]{3,24}$`)

type credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authResponse struct {
	Token    string `json:"token"`
	PlayerID string `json:"playerId"`
	Username string `json:"username"`
}

func (s *Service) issue(p Player) (string, error) {
	claims := jwt.MapClaims{"sub": p.ID, "name": p.Username, "exp": time.Now().Add(24 * time.Hour).Unix(), "iat": time.Now().Unix()}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.Secret)
}

// Parse validates a token string and returns the player it identifies.
func (s *Service) Parse(token string) (Player, error) {
	t, err := jwt.Parse(token, func(t *jwt.Token) (any, error) { return s.Secret, nil }, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !t.Valid {
		return Player{}, errors.New("invalid token")
	}
	claims, ok := t.Claims.(jwt.MapClaims)
	if !ok {
		return Player{}, errors.New("invalid claims")
	}
	id, _ := claims["sub"].(string)
	name, _ := claims["name"].(string)
	if id == "" {
		return Player{}, errors.New("missing subject")
	}
	return Player{ID: id, Username: name}, nil
}

func (s *Service) Register(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !httpx.DecodeJSON(w, r, &c) {
		return
	}
	if !usernameRe.MatchString(c.Username) {
		httpx.WriteError(w, http.StatusBadRequest, "username must be 3-24 letters, digits or underscores")
		return
	}
	if len(c.Password) < 8 || len(c.Password) > 72 {
		httpx.WriteError(w, http.StatusBadRequest, "password must be 8-72 characters")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(c.Password), bcrypt.DefaultCost)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not create account")
		return
	}
	var id string
	err = s.DB.QueryRowContext(r.Context(), `INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id`, c.Username, string(hash)).Scan(&id)
	var pqErr *pq.Error
	if errors.As(err, &pqErr) && pqErr.Code == "23505" {
		httpx.WriteError(w, http.StatusConflict, "username already taken")
		return
	}
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not create account")
		return
	}
	p := Player{ID: id, Username: c.Username}
	tok, err := s.issue(p)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not sign token")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, authResponse{Token: tok, PlayerID: id, Username: c.Username})
}

func (s *Service) Login(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !httpx.DecodeJSON(w, r, &c) {
		return
	}
	var id, hash string
	err := s.DB.QueryRowContext(r.Context(), `SELECT id, password_hash FROM players WHERE username = $1`, c.Username).Scan(&id, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(c.Password)) != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "incorrect username or password")
		return
	}
	tok, err := s.issue(Player{ID: id, Username: c.Username})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "could not sign token")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, authResponse{Token: tok, PlayerID: id, Username: c.Username})
}

// Require rejects requests without a valid Bearer token.
func (s *Service) Require(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			httpx.WriteError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		p, err := s.Parse(strings.TrimPrefix(h, "Bearer "))
		if err != nil {
			httpx.WriteError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, p)))
	}
}

func PlayerFrom(ctx context.Context) (Player, bool) {
	p, ok := ctx.Value(ctxKey{}).(Player)
	return p, ok
}
