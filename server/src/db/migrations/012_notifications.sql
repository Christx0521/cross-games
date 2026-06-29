-- Notificaciones: menciones, likes, comentarios. Una fila por destinatario.

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq         BIGSERIAL UNIQUE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- destinatario
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,          -- quién la origina
  type        TEXT NOT NULL,        -- mention | post_like | post_comment | thread_comment
  entity_type TEXT NOT NULL,        -- post | thread | comment
  entity_id   UUID,
  preview     TEXT NOT NULL DEFAULT '',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, seq DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id) WHERE read_at IS NULL;
