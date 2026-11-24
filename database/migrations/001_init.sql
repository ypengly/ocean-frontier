CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 24),
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE saves (
  player_id  UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  data       JSONB NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expeditions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  zone        TEXT NOT NULL,
  submarine   TEXT NOT NULL,
  max_depth   REAL NOT NULL DEFAULT 0,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);
CREATE INDEX idx_expeditions_player ON expeditions(player_id, started_at DESC);

CREATE TABLE discoveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expedition_id UUID REFERENCES expeditions(id) ON DELETE SET NULL,
  target_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  zone          TEXT NOT NULL,
  depth         REAL NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, target_id)
);

CREATE TABLE inventory_items (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id   TEXT NOT NULL,
  quantity  INTEGER NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (player_id, item_id)
);

CREATE TABLE species (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  size_class  TEXT NOT NULL,
  zones       TEXT[] NOT NULL,
  min_depth   REAL NOT NULL,
  max_depth   REAL NOT NULL,
  description TEXT NOT NULL
);
