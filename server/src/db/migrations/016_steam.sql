-- Integración con Steam: cuenta vinculada + caché de "jugando ahora".

CREATE TABLE IF NOT EXISTS steam_accounts (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  steamid64      TEXT NOT NULL UNIQUE,
  persona_name   TEXT,
  steam_avatar   TEXT,
  profile_public BOOLEAN NOT NULL DEFAULT FALSE,
  linked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS steam_presence (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  game_id    TEXT,
  game_name  TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
