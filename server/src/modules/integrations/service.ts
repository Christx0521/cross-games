import type { IntegrationsRepo, SteamAccountRow } from "./repo.ts";
import type { SteamClient, SteamOwnedGame } from "../../lib/steam.ts";
import { verifyCallback, type VerifyFetch } from "./openid.ts";
import { AppError } from "../../lib/errors.ts";

const PRESENCE_TTL_MS = 60_000;

export interface MyIntegration {
  linked: boolean;
  enabled: boolean; // ¿hay clave de API configurada?
  steamid64: string | null;
  persona_name: string | null;
  now_playing: string | null;
}

export interface PublicSteam {
  linked: boolean;
  persona_name: string | null;
  profile_public: boolean;
  now_playing: string | null;
}

export function createIntegrationsService(deps: {
  repo: IntegrationsRepo;
  client: SteamClient;
  now?: () => number;
}) {
  const { repo, client } = deps;
  const now = deps.now ?? (() => Date.now());

  // Refresca summary + "jugando ahora" desde Steam si hay clave y la caché expiró.
  async function ensureFresh(account: SteamAccountRow): Promise<void> {
    if (!client.enabled) return;
    const presence = await repo.getPresence(account.user_id);
    if (presence && now() - new Date(presence.fetched_at).getTime() < PRESENCE_TTL_MS) return;

    const summaries = await client.getPlayerSummaries([account.steamid64]);
    const s = summaries.get(account.steamid64);
    if (s) {
      await repo.updateSummary(account.user_id, {
        personaName: s.persona_name,
        avatar: s.avatar,
        profilePublic: s.profile_public,
      });
      await repo.setPresence(account.user_id, s.game_id, s.game_name);
    } else {
      await repo.setPresence(account.user_id, null, null);
    }
  }

  return {
    async linkFromCallback(
      userId: string,
      query: Record<string, string | undefined>,
      verifyFetch?: VerifyFetch
    ): Promise<{ steamid64: string }> {
      const steamid64 = await verifyCallback(query, verifyFetch);
      if (!steamid64) throw new AppError(400, "steam_verification_failed");
      await repo.link(userId, steamid64);
      // Primer refresco (si hay clave) para traer nick/avatar de inmediato.
      const account = await repo.getByUserId(userId);
      if (account) await ensureFresh(account);
      return { steamid64 };
    },

    async unlink(userId: string): Promise<void> {
      await repo.unlink(userId);
    },

    async getMine(userId: string): Promise<MyIntegration> {
      const account = await repo.getByUserId(userId);
      if (!account) {
        return { linked: false, enabled: client.enabled, steamid64: null, persona_name: null, now_playing: null };
      }
      await ensureFresh(account);
      const presence = await repo.getPresence(userId);
      const fresh = await repo.getByUserId(userId);
      return {
        linked: true,
        enabled: client.enabled,
        steamid64: account.steamid64,
        persona_name: fresh?.persona_name ?? null,
        now_playing: presence?.game_name ?? null,
      };
    },

    async getPublic(nickname: string): Promise<PublicSteam> {
      const userId = await repo.getUserIdByNickname(nickname);
      if (!userId) throw new AppError(404, "user_not_found");
      const account = await repo.getByUserId(userId);
      if (!account) return { linked: false, persona_name: null, profile_public: false, now_playing: null };
      await ensureFresh(account);
      const [presence, fresh] = await Promise.all([repo.getPresence(userId), repo.getByUserId(userId)]);
      return {
        linked: true,
        persona_name: fresh?.persona_name ?? null,
        profile_public: fresh?.profile_public ?? false,
        now_playing: presence?.game_name ?? null,
      };
    },

    // Juegos más jugados (vacío si no hay clave o el perfil es privado).
    async getTopGames(userId: string, limit = 6): Promise<SteamOwnedGame[]> {
      const account = await repo.getByUserId(userId);
      if (!account || !client.enabled) return [];
      const games = await client.getOwnedGames(account.steamid64);
      return games.slice(0, limit);
    },
  };
}

export type IntegrationsService = ReturnType<typeof createIntegrationsService>;
