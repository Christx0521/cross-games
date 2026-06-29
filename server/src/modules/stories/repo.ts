import type { PGlite } from "@electric-sql/pglite";

const ANON_ID = "00000000-0000-0000-0000-000000000000";

export interface StoryRow {
  id: string;
  seq: number;
  author_id: string;
  author_nickname: string;
  author_avatar: string | null;
  image_url: string;
  caption: string;
  created_at: string;
  seen: boolean;
}

function normalize(row: StoryRow): StoryRow {
  return { ...row, seq: Number(row.seq) };
}

export function createStoriesRepo(db: PGlite) {
  return {
    async createStory(authorId: string, imageUrl: string, caption: string): Promise<string> {
      const r = await db.query<{ id: string }>(
        "INSERT INTO stories (author_id, image_url, caption) VALUES ($1, $2, $3) RETURNING id",
        [authorId, imageUrl, caption]
      );
      return r.rows[0]!.id;
    },

    // Stories activas (no expiradas) de un conjunto de autores, en orden cronológico.
    async listActive(authorIds: string[], viewerId: string | null): Promise<StoryRow[]> {
      const r = await db.query<StoryRow>(
        `SELECT s.id, s.seq, s.author_id, u.nickname AS author_nickname, u.avatar_url AS author_avatar,
                s.image_url, s.caption, s.created_at,
                EXISTS (SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.viewer_id = $2) AS seen
         FROM stories s
         JOIN users u ON u.id = s.author_id
         WHERE s.author_id = ANY($1) AND s.expires_at > now()
         ORDER BY s.author_id, s.seq ASC`,
        [authorIds, viewerId ?? ANON_ID]
      );
      return r.rows.map(normalize);
    },

    async getById(storyId: string): Promise<{ id: string; author_id: string } | null> {
      const r = await db.query<{ id: string; author_id: string }>(
        "SELECT id, author_id FROM stories WHERE id = $1 AND expires_at > now()",
        [storyId]
      );
      return r.rows[0] ?? null;
    },

    async markViewed(storyId: string, viewerId: string): Promise<void> {
      await db.query(
        "INSERT INTO story_views (story_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [storyId, viewerId]
      );
    },

    async deleteStory(storyId: string): Promise<void> {
      await db.query("DELETE FROM stories WHERE id = $1", [storyId]);
    },
  };
}

export type StoriesRepo = ReturnType<typeof createStoriesRepo>;
