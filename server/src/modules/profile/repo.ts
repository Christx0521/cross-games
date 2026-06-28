import type { PGlite } from "@electric-sql/pglite";

export interface ProfileRow {
  id: string;
  nickname: string;
  birth_year: number;
  avatar_url: string | null;
  description: string | null;
  country_code: string | null;
}

export function createProfileRepo(db: PGlite) {
  return {
    async findProfileByNickname(nickname: string): Promise<ProfileRow | null> {
      const r = await db.query<ProfileRow>(
        `SELECT id, nickname, birth_year, avatar_url, description, country_code
         FROM users WHERE nickname = $1`,
        [nickname]
      );
      return r.rows[0] ?? null;
    },

    async getLanguages(userId: string): Promise<string[]> {
      const r = await db.query<{ language_code: string }>(
        "SELECT language_code FROM user_languages WHERE user_id = $1 ORDER BY language_code",
        [userId]
      );
      return r.rows.map((x) => x.language_code);
    },

    async updateProfile(
      userId: string,
      input: { description: string | null; countryCode: string | null }
    ): Promise<void> {
      await db.query(
        "UPDATE users SET description = $1, country_code = $2 WHERE id = $3",
        [input.description, input.countryCode, userId]
      );
    },

    async setLanguages(userId: string, codes: string[]): Promise<void> {
      await db.query("DELETE FROM user_languages WHERE user_id = $1", [userId]);
      for (const code of codes) {
        await db.query(
          "INSERT INTO user_languages (user_id, language_code) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [userId, code]
        );
      }
    },

    async setAvatarUrl(userId: string, url: string): Promise<void> {
      await db.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [url, userId]);
    },
  };
}

export type ProfileRepo = ReturnType<typeof createProfileRepo>;
