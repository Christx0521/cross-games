import type { PGlite } from "@electric-sql/pglite";

export interface SteamAccountRow {
  user_id: string;
  steamid64: string;
  persona_name: string | null;
  steam_avatar: string | null;
  profile_public: boolean;
  linked_at: string;
}

export interface SteamPresenceRow {
  user_id: string;
  game_id: string | null;
  game_name: string | null;
  fetched_at: string;
}

export function createIntegrationsRepo(db: PGlite) {
  return {
    async getByUserId(userId: string): Promise<SteamAccountRow | null> {
      const r = await db.query<SteamAccountRow>(
        "SELECT user_id, steamid64, persona_name, steam_avatar, profile_public, linked_at FROM steam_accounts WHERE user_id = $1",
        [userId]
      );
      return r.rows[0] ?? null;
    },

    async getUserIdByNickname(nickname: string): Promise<string | null> {
      const r = await db.query<{ id: string }>("SELECT id FROM users WHERE nickname = $1", [nickname]);
      return r.rows[0]?.id ?? null;
    },

    async link(userId: string, steamid64: string): Promise<void> {
      await db.query(
        `INSERT INTO steam_accounts (user_id, steamid64) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET steamid64 = EXCLUDED.steamid64, linked_at = now()`,
        [userId, steamid64]
      );
    },

    async unlink(userId: string): Promise<void> {
      await db.query("DELETE FROM steam_accounts WHERE user_id = $1", [userId]);
      await db.query("DELETE FROM steam_presence WHERE user_id = $1", [userId]);
    },

    async updateSummary(
      userId: string,
      input: { personaName: string; avatar: string | null; profilePublic: boolean }
    ): Promise<void> {
      await db.query(
        "UPDATE steam_accounts SET persona_name = $2, steam_avatar = $3, profile_public = $4 WHERE user_id = $1",
        [userId, input.personaName, input.avatar, input.profilePublic]
      );
    },

    async setPresence(userId: string, gameId: string | null, gameName: string | null): Promise<void> {
      await db.query(
        `INSERT INTO steam_presence (user_id, game_id, game_name, fetched_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id) DO UPDATE SET game_id = EXCLUDED.game_id, game_name = EXCLUDED.game_name, fetched_at = now()`,
        [userId, gameId, gameName]
      );
    },

    async getPresence(userId: string): Promise<SteamPresenceRow | null> {
      const r = await db.query<SteamPresenceRow>(
        "SELECT user_id, game_id, game_name, fetched_at FROM steam_presence WHERE user_id = $1",
        [userId]
      );
      return r.rows[0] ?? null;
    },
  };
}

export type IntegrationsRepo = ReturnType<typeof createIntegrationsRepo>;
