import type { PGlite } from "@electric-sql/pglite";

export interface BlockedUser {
  id: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
}

export function createModerationRepo(db: PGlite) {
  return {
    async findUserByNickname(nickname: string): Promise<{ id: string } | null> {
      const r = await db.query<{ id: string }>("SELECT id FROM users WHERE nickname = $1", [nickname]);
      return r.rows[0] ?? null;
    },

    async block(blockerId: string, blockedId: string): Promise<void> {
      await db.query(
        "INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [blockerId, blockedId]
      );
    },

    async unblock(blockerId: string, blockedId: string): Promise<void> {
      await db.query("DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2", [blockerId, blockedId]);
    },

    async listBlocked(blockerId: string): Promise<BlockedUser[]> {
      const r = await db.query<BlockedUser>(
        `SELECT u.id, u.nickname, u.avatar_url, b.created_at
         FROM user_blocks b
         JOIN users u ON u.id = b.blocked_id
         WHERE b.blocker_id = $1
         ORDER BY b.created_at DESC`,
        [blockerId]
      );
      return r.rows;
    },

    // ¿Hay bloqueo en cualquiera de las dos direcciones?
    async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
      const r = await db.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [a, b]
      );
      return r.rows.length > 0;
    },

    // Todos los ids relacionados por bloqueo con el usuario (en ambas direcciones).
    async relatedBlockedIds(userId: string): Promise<string[]> {
      const r = await db.query<{ id: string }>(
        `SELECT blocked_id AS id FROM user_blocks WHERE blocker_id = $1
         UNION
         SELECT blocker_id AS id FROM user_blocks WHERE blocked_id = $1`,
        [userId]
      );
      return r.rows.map((x) => x.id);
    },

    async createReport(input: {
      reporterId: string;
      targetType: string;
      targetId: string;
      reason: string;
    }): Promise<string> {
      const r = await db.query<{ id: string }>(
        "INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4) RETURNING id",
        [input.reporterId, input.targetType, input.targetId, input.reason]
      );
      return r.rows[0]!.id;
    },
  };
}

export type ModerationRepo = ReturnType<typeof createModerationRepo>;
