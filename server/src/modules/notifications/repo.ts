import type { PGlite } from "@electric-sql/pglite";

export interface NotificationRow {
  id: string;
  seq: number;
  user_id: string;
  actor_id: string | null;
  actor_nickname: string | null;
  actor_avatar: string | null;
  type: string;
  entity_type: string;
  entity_id: string | null;
  preview: string;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  userId: string;
  actorId: string | null;
  type: string;
  entityType: string;
  entityId: string | null;
  preview: string;
}

function normalize(row: NotificationRow): NotificationRow {
  return { ...row, seq: Number(row.seq) };
}

export function createNotificationsRepo(db: PGlite) {
  return {
    async findUserIdByNickname(nickname: string): Promise<string | null> {
      const r = await db.query<{ id: string }>("SELECT id FROM users WHERE nickname = $1", [nickname]);
      return r.rows[0]?.id ?? null;
    },

    async create(input: CreateNotificationInput): Promise<NotificationRow> {
      const ins = await db.query<{ id: string }>(
        `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, preview)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [input.userId, input.actorId, input.type, input.entityType, input.entityId, input.preview]
      );
      return this.getById(ins.rows[0]!.id);
    },

    async getById(id: string): Promise<NotificationRow> {
      const r = await db.query<NotificationRow>(
        `SELECT n.id, n.seq, n.user_id, n.actor_id, u.nickname AS actor_nickname, u.avatar_url AS actor_avatar,
                n.type, n.entity_type, n.entity_id, n.preview, n.read_at, n.created_at
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_id
         WHERE n.id = $1`,
        [id]
      );
      return normalize(r.rows[0]!);
    },

    async listByUser(userId: string, beforeSeq: number | null, limit: number): Promise<NotificationRow[]> {
      const r = await db.query<NotificationRow>(
        `SELECT n.id, n.seq, n.user_id, n.actor_id, u.nickname AS actor_nickname, u.avatar_url AS actor_avatar,
                n.type, n.entity_type, n.entity_id, n.preview, n.read_at, n.created_at
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_id
         WHERE n.user_id = $1 AND ($2::bigint IS NULL OR n.seq < $2)
         ORDER BY n.seq DESC
         LIMIT $3`,
        [userId, beforeSeq, limit]
      );
      return r.rows.map(normalize);
    },

    async unreadCount(userId: string): Promise<number> {
      const r = await db.query<{ cnt: number }>(
        "SELECT COUNT(*)::int AS cnt FROM notifications WHERE user_id = $1 AND read_at IS NULL",
        [userId]
      );
      return Number(r.rows[0]!.cnt);
    },

    async markAllRead(userId: string): Promise<void> {
      await db.query(
        "UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL",
        [userId]
      );
    },

    async markRead(userId: string, id: string): Promise<void> {
      await db.query(
        "UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
        [id, userId]
      );
    },
  };
}

export type NotificationsRepo = ReturnType<typeof createNotificationsRepo>;
