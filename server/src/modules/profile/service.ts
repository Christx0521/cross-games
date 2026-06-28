import type { ProfileRepo } from "./repo.ts";
import { type Storage, extForMime } from "../../lib/storage.ts";
import { AppError } from "../../lib/errors.ts";

export interface PublicProfile {
  nickname: string;
  avatar_url: string | null;
  description: string | null;
  country_code: string | null;
  languages: string[];
  is_adult: boolean;
}

export interface UpdateProfileInput {
  description?: string | null;
  countryCode?: string | null;
  languages?: string[];
}

const COUNTRY_RE = /^[A-Za-z]{2}$/;
const LANG_RE = /^[A-Za-z]{2}$/;

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
      const languages = await repo.getLanguages(row.id);
      return {
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        description: row.description,
        country_code: row.country_code,
        languages,
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

      await repo.updateProfile(userId, { description, countryCode });
      await repo.setLanguages(userId, [...new Set(languages)]);
    },

    async setAvatar(userId: string, data: Buffer, mime: string): Promise<{ avatar_url: string }> {
      if (!storage) throw new AppError(500, "storage_unavailable");
      const ext = extForMime(mime);
      if (!ext) throw new AppError(415, "unsupported_media_type");
      const url = await storage.save(data, ext);
      await repo.setAvatarUrl(userId, url);
      return { avatar_url: url };
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
