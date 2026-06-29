import type { StoriesRepo, StoryRow } from "./repo.ts";
import type { FriendsRepo } from "../friends/repo.ts";
import { AppError } from "../../lib/errors.ts";

const MAX_CAPTION = 280;

export interface StoryItem {
  id: string;
  image_url: string;
  caption: string;
  created_at: string;
  seen: boolean;
}

export interface StoryGroup {
  author: { id: string; nickname: string; avatar_url: string | null };
  stories: StoryItem[];
  has_unseen: boolean;
  is_me: boolean;
}

export function createStoriesService(deps: {
  repo: StoriesRepo;
  friendsRepo: FriendsRepo;
  blockedIds?: (userId: string) => Promise<string[]>;
}) {
  const { repo, friendsRepo } = deps;
  const blockedIds = deps.blockedIds ?? (async () => []);

  return {
    async createStory(authorId: string, imageUrl: string, caption: string): Promise<{ id: string }> {
      if (caption.length > MAX_CAPTION) throw new AppError(422, "caption_too_long");
      const id = await repo.createStory(authorId, imageUrl, caption.trim());
      return { id };
    },

    // Stories activas propias + de amigos (sin bloqueados), agrupadas por autor.
    async getActive(userId: string): Promise<StoryGroup[]> {
      const [friends, blocked] = await Promise.all([friendsRepo.listFriends(userId), blockedIds(userId)]);
      const blockedSet = new Set(blocked);
      const authorIds = [userId, ...friends.map((f) => f.id)].filter((id) => !blockedSet.has(id));
      const rows = await repo.listActive(authorIds, userId);

      const groups = new Map<string, StoryGroup>();
      for (const row of rows) {
        let g = groups.get(row.author_id);
        if (!g) {
          g = {
            author: { id: row.author_id, nickname: row.author_nickname, avatar_url: row.author_avatar },
            stories: [],
            has_unseen: false,
            is_me: row.author_id === userId,
          };
          groups.set(row.author_id, g);
        }
        g.stories.push(toItem(row));
        if (!row.seen && row.author_id !== userId) g.has_unseen = true;
      }

      // Orden: yo primero, luego con no vistas, luego el resto (más reciente primero).
      return [...groups.values()].sort((a, b) => {
        if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
        if (a.has_unseen !== b.has_unseen) return a.has_unseen ? -1 : 1;
        return lastSeq(b) - lastSeq(a);
      });
    },

    async view(storyId: string, userId: string): Promise<void> {
      const story = await repo.getById(storyId);
      if (!story) throw new AppError(404, "story_not_found");
      await repo.markViewed(storyId, userId);
    },

    async deleteStory(storyId: string, userId: string): Promise<void> {
      const story = await repo.getById(storyId);
      if (!story) throw new AppError(404, "story_not_found");
      if (story.author_id !== userId) throw new AppError(403, "not_the_author");
      await repo.deleteStory(storyId);
    },
  };
}

function toItem(row: StoryRow): StoryItem {
  return { id: row.id, image_url: row.image_url, caption: row.caption, created_at: row.created_at, seen: row.seen };
}

// Para ordenar grupos por su story más reciente usamos el id (UUID) no; usamos created_at.
function lastSeq(g: StoryGroup): number {
  const last = g.stories.at(-1);
  return last ? new Date(last.created_at).getTime() : 0;
}

export type StoriesService = ReturnType<typeof createStoriesService>;
