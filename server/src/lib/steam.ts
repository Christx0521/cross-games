// Cliente de la Steam Web API. Inyectable: en producción usa fetch real,
// en tests se sustituye por un fake, y sin clave devuelve la variante
// "desactivada" (sin datos) para que la vinculación siga funcionando.

export interface SteamSummary {
  steamid: string;
  persona_name: string;
  avatar: string | null;
  profile_public: boolean;
  game_id: string | null;
  game_name: string | null;
}

export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_minutes: number;
}

export interface SteamClient {
  readonly enabled: boolean;
  getPlayerSummaries(steamids: string[]): Promise<Map<string, SteamSummary>>;
  getOwnedGames(steamid: string): Promise<SteamOwnedGame[]>;
}

// Sin clave: la integración existe pero no obtiene datos del jugador.
export function createDisabledSteamClient(): SteamClient {
  return {
    enabled: false,
    async getPlayerSummaries() {
      return new Map();
    },
    async getOwnedGames() {
      return [];
    },
  };
}

const BASE = "https://api.steampowered.com";

export function createSteamClient(apiKey: string): SteamClient {
  if (!apiKey) return createDisabledSteamClient();

  return {
    enabled: true,

    async getPlayerSummaries(steamids: string[]): Promise<Map<string, SteamSummary>> {
      const map = new Map<string, SteamSummary>();
      if (steamids.length === 0) return map;
      // La API admite hasta 100 ids por llamada.
      for (let i = 0; i < steamids.length; i += 100) {
        const batch = steamids.slice(i, i + 100);
        const url = `${BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${batch.join(",")}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = (await res.json()) as {
          response?: {
            players?: Array<{
              steamid: string;
              personaname: string;
              avatarfull?: string;
              communityvisibilitystate?: number;
              gameid?: string;
              gameextrainfo?: string;
            }>;
          };
        };
        for (const p of data.response?.players ?? []) {
          map.set(p.steamid, {
            steamid: p.steamid,
            persona_name: p.personaname,
            avatar: p.avatarfull ?? null,
            profile_public: p.communityvisibilitystate === 3,
            game_id: p.gameid ?? null,
            game_name: p.gameextrainfo ?? null,
          });
        }
      }
      return map;
    },

    async getOwnedGames(steamid: string): Promise<SteamOwnedGame[]> {
      const url = `${BASE}/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as {
        response?: { games?: Array<{ appid: number; name: string; playtime_forever: number }> };
      };
      const games = data.response?.games ?? [];
      return games
        .map((g) => ({ appid: g.appid, name: g.name, playtime_minutes: g.playtime_forever }))
        .sort((a, b) => b.playtime_minutes - a.playtime_minutes);
    },
  };
}
