import type { PGlite } from "@electric-sql/pglite";

export interface SessionUser {
  id: string;
  nickname: string;
  email: string;
  is_verified: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createSessionRepo(db: PGlite) {
  return {
    async createSession(userId: string, expiresAt: Date): Promise<string> {
      const r = await db.query<{ id: string }>(
        "INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id",
        [userId, expiresAt.toISOString()]
      );
      return r.rows[0]!.id;
    },

    async findValidSession(sessionId: string): Promise<SessionUser | null> {
      if (!UUID_RE.test(sessionId)) return null;
      const r = await db.query<SessionUser>(
        `SELECT u.id, u.nickname, u.email, u.is_verified
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > now()`,
        [sessionId]
      );
      return r.rows[0] ?? null;
    },

    async deleteSession(sessionId: string): Promise<void> {
      await db.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
    },

    async deleteUserSessions(userId: string): Promise<void> {
      await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    },
  };
}

export type SessionRepo = ReturnType<typeof createSessionRepo>;
