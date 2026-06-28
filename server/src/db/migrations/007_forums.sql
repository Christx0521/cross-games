CREATE TABLE IF NOT EXISTS forums (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  language_code   CHAR(2) NOT NULL,
  continent       TEXT NOT NULL,
  country_code    CHAR(2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forums_filters ON forums (country_code, language_code, continent);
