import type { PGlite } from "@electric-sql/pglite";

const ANON_ID = "00000000-0000-0000-0000-000000000000";

export interface PostRow {
  id: string;
  seq: number;
  author_id: string;
  author_nickname: string;
  author_avatar: string | null;
  body: string;
  attachment_url: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked: boolean;
}

export interface PostCommentRow {
  id: string;
  post_id: string;
  author_id: string;
  author_nickname: string;
  author_avatar: string | null;
  body: string;
  created_at: string;
}

const POST_SELECT = `
  SELECT p.id, p.seq, p.author_id, u.nickname AS author_nickname, u.avatar_url AS author_avatar,
         p.body, p.attachment_url, p.created_at,
         COALESCE(l.cnt, 0)::int AS like_count,
         COALESCE(c.cnt, 0)::int AS comment_count,
         EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $viewer) AS liked
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN (SELECT post_id, COUNT(*) AS cnt FROM post_likes GROUP BY post_id) l ON l.post_id = p.id
  LEFT JOIN (SELECT post_id, COUNT(*) AS cnt FROM post_comments GROUP BY post_id) c ON c.post_id = p.id`;

function normalize(row: PostRow): PostRow {
  return {
    ...row,
    seq: Number(row.seq),
    like_count: Number(row.like_count),
    comment_count: Number(row.comment_count),
  };
}

export function createFeedRepo(db: PGlite) {
  return {
    async getUserIdByNickname(nickname: string): Promise<string | null> {
      const r = await db.query<{ id: string }>("SELECT id FROM users WHERE nickname = $1", [nickname]);
      return r.rows[0]?.id ?? null;
    },

    async createPost(authorId: string, body: string, attachmentUrl: string | null): Promise<string> {
      const r = await db.query<{ id: string }>(
        "INSERT INTO posts (author_id, body, attachment_url) VALUES ($1, $2, $3) RETURNING id",
        [authorId, body, attachmentUrl]
      );
      return r.rows[0]!.id;
    },

    async getPost(postId: string, viewerId: string | null): Promise<PostRow | null> {
      const r = await db.query<PostRow>(
        `${POST_SELECT.replace("$viewer", "$2")} WHERE p.id = $1`,
        [postId, viewerId ?? ANON_ID]
      );
      return r.rows[0] ? normalize(r.rows[0]) : null;
    },

    // Feed keyset por seq descendente, restringido a un conjunto de autores.
    async listByAuthors(authorIds: string[], beforeSeq: number | null, limit: number, viewerId: string | null): Promise<PostRow[]> {
      const sql = `${POST_SELECT.replace("$viewer", "$2")}
        WHERE p.author_id = ANY($1) AND ($3::bigint IS NULL OR p.seq < $3)
        ORDER BY p.seq DESC
        LIMIT $4`;
      const r = await db.query<PostRow>(sql, [authorIds, viewerId ?? ANON_ID, beforeSeq, limit]);
      return r.rows.map(normalize);
    },

    async listByAuthor(authorId: string, beforeSeq: number | null, limit: number, viewerId: string | null): Promise<PostRow[]> {
      const sql = `${POST_SELECT.replace("$viewer", "$2")}
        WHERE p.author_id = $1 AND ($3::bigint IS NULL OR p.seq < $3)
        ORDER BY p.seq DESC
        LIMIT $4`;
      const r = await db.query<PostRow>(sql, [authorId, viewerId ?? ANON_ID, beforeSeq, limit]);
      return r.rows.map(normalize);
    },

    async getPostAuthor(postId: string): Promise<string | null> {
      const r = await db.query<{ author_id: string }>("SELECT author_id FROM posts WHERE id = $1", [postId]);
      return r.rows[0]?.author_id ?? null;
    },

    async deletePost(postId: string): Promise<void> {
      await db.query("DELETE FROM posts WHERE id = $1", [postId]);
    },

    // Alterna el "me gusta". Devuelve [liked, like_count].
    async toggleLike(postId: string, userId: string): Promise<[boolean, number]> {
      const del = await db.query(
        "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2 RETURNING 1",
        [postId, userId]
      );
      const liked = del.rows.length === 0;
      if (liked) {
        await db.query("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)", [postId, userId]);
      }
      const count = await db.query<{ cnt: number }>(
        "SELECT COUNT(*)::int AS cnt FROM post_likes WHERE post_id = $1",
        [postId]
      );
      return [liked, Number(count.rows[0]!.cnt)];
    },

    async listComments(postId: string): Promise<PostCommentRow[]> {
      const r = await db.query<PostCommentRow>(
        `SELECT c.id, c.post_id, c.author_id, u.nickname AS author_nickname, u.avatar_url AS author_avatar,
                c.body, c.created_at
         FROM post_comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.post_id = $1
         ORDER BY c.created_at ASC`,
        [postId]
      );
      return r.rows;
    },

    async createComment(postId: string, authorId: string, body: string): Promise<PostCommentRow> {
      const ins = await db.query<{ id: string }>(
        "INSERT INTO post_comments (post_id, author_id, body) VALUES ($1, $2, $3) RETURNING id",
        [postId, authorId, body]
      );
      const r = await db.query<PostCommentRow>(
        `SELECT c.id, c.post_id, c.author_id, u.nickname AS author_nickname, u.avatar_url AS author_avatar,
                c.body, c.created_at
         FROM post_comments c JOIN users u ON u.id = c.author_id
         WHERE c.id = $1`,
        [ins.rows[0]!.id]
      );
      return r.rows[0]!;
    },
  };
}

export type FeedRepo = ReturnType<typeof createFeedRepo>;
