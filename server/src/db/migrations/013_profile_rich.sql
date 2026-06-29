-- Perfil enriquecido: banner e imagen de portada + juegos favoritos.

ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;

CREATE TABLE IF NOT EXISTS user_games (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game     TEXT NOT NULL,
  position INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, game)
);

CREATE INDEX IF NOT EXISTS idx_user_games_user ON user_games (user_id, position);
