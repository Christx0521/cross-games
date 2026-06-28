import type { ForumsRepo, ForumRow, ForumFilters } from "./repo.ts";
import type { ChatRepo } from "../chat/repo.ts";
import { AppError } from "../../lib/errors.ts";

const COUNTRY_RE = /^[A-Za-z]{2}$/;
const LANG_RE = /^[A-Za-z]{2}$/;
const CONTINENTS = ["AF", "AN", "AS", "EU", "NA", "OC", "SA"];

export interface CreateForumInput {
  name: string;
  languageCode: string;
  continent: string;
  countryCode?: string | null;
}

export function createForumsService(deps: { repo: ForumsRepo; chatRepo: ChatRepo }) {
  const { repo, chatRepo } = deps;

  return {
    async createForum(input: CreateForumInput): Promise<ForumRow> {
      const name = input.name.trim();
      if (!name) throw new AppError(422, "invalid_name");
      if (!LANG_RE.test(input.languageCode)) throw new AppError(422, "invalid_language_code");
      if (!CONTINENTS.includes(input.continent)) throw new AppError(422, "invalid_continent");
      if (input.countryCode && !COUNTRY_RE.test(input.countryCode)) {
        throw new AppError(422, "invalid_country_code");
      }

      const conversationId = await chatRepo.createConversation("forum", name);
      return repo.createForum({
        conversationId,
        name,
        languageCode: input.languageCode.toLowerCase(),
        continent: input.continent,
        countryCode: input.countryCode ? input.countryCode.toUpperCase() : null,
      });
    },

    listForums(filters: ForumFilters): Promise<ForumRow[]> {
      return repo.listForums(filters);
    },

    async getForum(id: string): Promise<ForumRow> {
      const forum = await repo.getForum(id);
      if (!forum) throw new AppError(404, "forum_not_found");
      return forum;
    },
  };
}

export type ForumsService = ReturnType<typeof createForumsService>;
