import type { PGlite } from "@electric-sql/pglite";

export interface ForumHit {
  id: string;
  conversation_id: string;
  name: string;
  language_code: string;
  continent: string;
  country_code: string | null;
}

export interface UserHit {
  id: string;
  nickname: string;
}

// Escapa los comodines de LIKE para que el término del usuario sea literal.
function likeTerm(q: string): string {
  return `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
}

export function createSearchRepo(db: PGlite) {
  return {
    async searchForums(q: string): Promise<ForumHit[]> {
      const r = await db.query<ForumHit>(
        `SELECT id, conversation_id, name, language_code, continent, country_code
         FROM forums
         WHERE name ILIKE $1
         ORDER BY name
         LIMIT 20`,
        [likeTerm(q)]
      );
      return r.rows;
    },

    async searchUsers(q: string): Promise<UserHit[]> {
      const r = await db.query<UserHit>(
        `SELECT id, nickname
         FROM users
         WHERE nickname ILIKE $1
         ORDER BY nickname
         LIMIT 20`,
        [likeTerm(q)]
      );
      return r.rows;
    },
  };
}

export type SearchRepo = ReturnType<typeof createSearchRepo>;
