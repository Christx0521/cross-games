import type { PGlite } from "@electric-sql/pglite";

export interface ForumRow {
  id: string;
  conversation_id: string;
  name: string;
  language_code: string;
  continent: string;
  country_code: string | null;
}

export interface ForumFilters {
  country?: string;
  language?: string;
  continent?: string;
}

export function createForumsRepo(db: PGlite) {
  return {
    async createForum(input: {
      conversationId: string;
      name: string;
      languageCode: string;
      continent: string;
      countryCode: string | null;
    }): Promise<ForumRow> {
      const r = await db.query<ForumRow>(
        `INSERT INTO forums (conversation_id, name, language_code, continent, country_code)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, conversation_id, name, language_code, continent, country_code`,
        [input.conversationId, input.name, input.languageCode, input.continent, input.countryCode]
      );
      return r.rows[0]!;
    },

    // Filtro con país prioritario, luego idioma y continente.
    async listForums(filters: ForumFilters): Promise<ForumRow[]> {
      const where: string[] = [];
      const params: string[] = [];
      if (filters.country) {
        params.push(filters.country.toUpperCase());
        where.push(`country_code = $${params.length}`);
      }
      if (filters.language) {
        params.push(filters.language.toLowerCase());
        where.push(`language_code = $${params.length}`);
      }
      if (filters.continent) {
        params.push(filters.continent);
        where.push(`continent = $${params.length}`);
      }
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const r = await db.query<ForumRow>(
        `SELECT id, conversation_id, name, language_code, continent, country_code
         FROM forums ${clause}
         ORDER BY country_code NULLS LAST, language_code, name`,
        params
      );
      return r.rows;
    },

    async getForum(id: string): Promise<ForumRow | null> {
      const r = await db.query<ForumRow>(
        "SELECT id, conversation_id, name, language_code, continent, country_code FROM forums WHERE id = $1",
        [id]
      );
      return r.rows[0] ?? null;
    },
  };
}

export type ForumsRepo = ReturnType<typeof createForumsRepo>;
