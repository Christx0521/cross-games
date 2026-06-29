import type { ProfileRepo } from "./repo.ts";
import { type Storage, extForMime } from "../../lib/storage.ts";
import { AppError } from "../../lib/errors.ts";

export interface PublicProfile {
  nickname: string;
  avatar_url: string | null;
  banner_url: string | null;
  description: string | null;
  country_code: string | null;
  languages: string[];
  games: string[];
  is_adult: boolean;
}

export interface UpdateProfileInput {
  description?: string | null;
  countryCode?: string | null;
  languages?: string[];
  games?: string[];
}

const COUNTRY_RE = /^[A-Za-z]{2}$/;
const LANG_RE = /^[A-Za-z]{2}$/;
const MAX_GAMES = 12;
const MAX_GAME_LEN = 60;

export function createProfileService(deps: {
  repo: ProfileRepo;
  storage?: Storage;
  now?: () => Date;
}) {
  const { repo, storage } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    async getPublicProfile(nickname: string): Promise<PublicProfile> {
      const row = await repo.findProfileByNickname(nickname);
      if (!row) throw new AppError(404, "user_not_found");
      const [languages, games] = await Promise.all([repo.getLanguages(row.id), repo.getGames(row.id)]);
      return {
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        banner_url: row.banner_url,
        description: row.description,
        country_code: row.country_code,
        languages,
        games,
        is_adult: now().getUTCFullYear() - row.birth_year >= 18,
      };
    },

    async updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
      const description =
        input.description === undefined ? null : input.description?.trim() || null;
      if (description && description.length > 280) {
        throw new AppError(422, "description_too_long");
      }

      let countryCode: string | null = null;
      if (input.countryCode) {
        if (!COUNTRY_RE.test(input.countryCode)) throw new AppError(422, "invalid_country_code");
        countryCode = input.countryCode.toUpperCase();
      }

      const languages = (input.languages ?? []).map((c) => c.toLowerCase());
      for (const code of languages) {
        if (!LANG_RE.test(code)) throw new AppError(422, "invalid_language_code");
      }

      // Juegos favoritos: texto libre, deduplicado preservando el orden.
      const rawGames = (input.games ?? []).map((g) => g.trim()).filter(Boolean);
      for (const g of rawGames) {
        if (g.length > MAX_GAME_LEN) throw new AppError(422, "game_too_long");
      }
      const games: string[] = [];
      const seen = new Set<string>();
      for (const g of rawGames) {
        const key = g.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        games.push(g);
      }
      if (games.length > MAX_GAMES) throw new AppError(422, "too_many_games");

      await repo.updateProfile(userId, { description, countryCode });
      await repo.setLanguages(userId, [...new Set(languages)]);
      await repo.setGames(userId, games);
    },

    async setAvatar(userId: string, data: Buffer, mime: string): Promise<{ avatar_url: string }> {
      if (!storage) throw new AppError(500, "storage_unavailable");
      const ext = extForMime(mime);
      if (!ext) throw new AppError(415, "unsupported_media_type");
      const url = await storage.save(data, ext);
      await repo.setAvatarUrl(userId, url);
      return { avatar_url: url };
    },

    async setBanner(userId: string, data: Buffer, mime: string): Promise<{ banner_url: string }> {
      if (!storage) throw new AppError(500, "storage_unavailable");
      const ext = extForMime(mime);
      if (!ext) throw new AppError(415, "unsupported_media_type");
      const url = await storage.save(data, ext);
      await repo.setBannerUrl(userId, url);
      return { banner_url: url };
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
