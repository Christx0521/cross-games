-- Foros estilo Reddit: hilos (posts), comentarios anidados y votos.

CREATE TABLE IF NOT EXISTS forum_threads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id       UUID NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_forum ON forum_threads (forum_id, created_at DESC);

CREATE TABLE IF NOT EXISTS thread_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES thread_comments(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_thread ON thread_comments (thread_id, created_at);

CREATE TABLE IF NOT EXISTS thread_votes (
  thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value     SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id UUID NOT NULL REFERENCES thread_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value      SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (comment_id, user_id)
);
