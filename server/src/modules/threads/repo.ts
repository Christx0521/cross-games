import type { PGlite } from "@electric-sql/pglite";

export type ThreadSort = "hot" | "new" | "top";

const ANON_ID = "00000000-0000-0000-0000-000000000000";

export interface ThreadRow {
  id: string;
  forum_id: string;
  author_id: string;
  author_nickname: string;
  title: string;
  body: string;
  attachment_url: string | null;
  created_at: string;
  score: number;
  comment_count: number;
  my_vote: number;
}

export interface CommentRow {
  id: string;
  thread_id: string;
  parent_id: string | null;
  author_id: string;
  author_nickname: string;
  body: string;
  created_at: string;
  score: number;
  my_vote: number;
}

// Orden de la lista de hilos. "hot" decae con el tiempo, "top" por score, "new" por fecha.
const ORDER_BY: Record<ThreadSort, string> = {
  new: "t.created_at DESC",
  top: "COALESCE(v.score, 0) DESC, t.created_at DESC",
  hot: "COALESCE(v.score, 0) / power(extract(epoch FROM (now() - t.created_at)) / 3600 + 2, 1.5) DESC, t.created_at DESC",
};

export function createThreadsRepo(db: PGlite) {
  return {
    async createThread(input: {
      forumId: string;
      authorId: string;
      title: string;
      body: string;
      attachmentUrl: string | null;
    }): Promise<string> {
      const r = await db.query<{ id: string }>(
        `INSERT INTO forum_threads (forum_id, author_id, title, body, attachment_url)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [input.forumId, input.authorId, input.title, input.body, input.attachmentUrl]
      );
      return r.rows[0]!.id;
    },

    async listThreads(forumId: string, sort: ThreadSort, viewerId: string | null): Promise<ThreadRow[]> {
      const r = await db.query<ThreadRow>(
        `SELECT t.id, t.forum_id, t.author_id, u.nickname AS author_nickname,
                t.title, t.body, t.attachment_url, t.created_at,
                COALESCE(v.score, 0)::int AS score,
                COALESCE(c.comment_count, 0)::int AS comment_count,
                COALESCE(mv.value, 0)::int AS my_vote
         FROM forum_threads t
         JOIN users u ON u.id = t.author_id
         LEFT JOIN (SELECT thread_id, SUM(value) AS score FROM thread_votes GROUP BY thread_id) v
           ON v.thread_id = t.id
         LEFT JOIN (SELECT thread_id, COUNT(*) AS comment_count FROM thread_comments GROUP BY thread_id) c
           ON c.thread_id = t.id
         LEFT JOIN thread_votes mv ON mv.thread_id = t.id AND mv.user_id = $2
         WHERE t.forum_id = $1
         ORDER BY ${ORDER_BY[sort]}
         LIMIT 100`,
        [forumId, viewerId ?? ANON_ID]
      );
      return r.rows.map(normalizeThread);
    },

    async getThread(threadId: string, viewerId: string | null): Promise<ThreadRow | null> {
      const r = await db.query<ThreadRow>(
        `SELECT t.id, t.forum_id, t.author_id, u.nickname AS author_nickname,
                t.title, t.body, t.attachment_url, t.created_at,
                COALESCE(v.score, 0)::int AS score,
                COALESCE(c.comment_count, 0)::int AS comment_count,
                COALESCE(mv.value, 0)::int AS my_vote
         FROM forum_threads t
         JOIN users u ON u.id = t.author_id
         LEFT JOIN (SELECT thread_id, SUM(value) AS score FROM thread_votes GROUP BY thread_id) v
           ON v.thread_id = t.id
         LEFT JOIN (SELECT thread_id, COUNT(*) AS comment_count FROM thread_comments GROUP BY thread_id) c
           ON c.thread_id = t.id
         LEFT JOIN thread_votes mv ON mv.thread_id = t.id AND mv.user_id = $2
         WHERE t.id = $1`,
        [threadId, viewerId ?? ANON_ID]
      );
      return r.rows[0] ? normalizeThread(r.rows[0]) : null;
    },

    async threadExists(threadId: string): Promise<boolean> {
      const r = await db.query("SELECT 1 FROM forum_threads WHERE id = $1", [threadId]);
      return r.rows.length > 0;
    },

    async listComments(threadId: string, viewerId: string | null): Promise<CommentRow[]> {
      const r = await db.query<CommentRow>(
        `SELECT c.id, c.thread_id, c.parent_id, c.author_id, u.nickname AS author_nickname,
                c.body, c.created_at,
                COALESCE(v.score, 0)::int AS score,
                COALESCE(mv.value, 0)::int AS my_vote
         FROM thread_comments c
         JOIN users u ON u.id = c.author_id
         LEFT JOIN (SELECT comment_id, SUM(value) AS score FROM comment_votes GROUP BY comment_id) v
           ON v.comment_id = c.id
         LEFT JOIN comment_votes mv ON mv.comment_id = c.id AND mv.user_id = $2
         WHERE c.thread_id = $1
         ORDER BY c.created_at ASC`,
        [threadId, viewerId ?? ANON_ID]
      );
      return r.rows.map(normalizeComment);
    },

    async createComment(input: {
      threadId: string;
      parentId: string | null;
      authorId: string;
      body: string;
    }): Promise<string> {
      const r = await db.query<{ id: string }>(
        `INSERT INTO thread_comments (thread_id, parent_id, author_id, body)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [input.threadId, input.parentId, input.authorId, input.body]
      );
      return r.rows[0]!.id;
    },

    async getCommentThreadId(commentId: string): Promise<string | null> {
      const r = await db.query<{ thread_id: string }>(
        "SELECT thread_id FROM thread_comments WHERE id = $1",
        [commentId]
      );
      return r.rows[0]?.thread_id ?? null;
    },

    // Fija el voto de un usuario sobre un hilo. value 0 lo elimina. Devuelve el score resultante.
    async setThreadVote(threadId: string, userId: string, value: number): Promise<number> {
      if (value === 0) {
        await db.query("DELETE FROM thread_votes WHERE thread_id = $1 AND user_id = $2", [threadId, userId]);
      } else {
        await db.query(
          `INSERT INTO thread_votes (thread_id, user_id, value) VALUES ($1, $2, $3)
           ON CONFLICT (thread_id, user_id) DO UPDATE SET value = EXCLUDED.value`,
          [threadId, userId, value]
        );
      }
      const r = await db.query<{ score: number }>(
        "SELECT COALESCE(SUM(value), 0)::int AS score FROM thread_votes WHERE thread_id = $1",
        [threadId]
      );
      return Number(r.rows[0]!.score);
    },

    async setCommentVote(commentId: string, userId: string, value: number): Promise<number> {
      if (value === 0) {
        await db.query("DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2", [commentId, userId]);
      } else {
        await db.query(
          `INSERT INTO comment_votes (comment_id, user_id, value) VALUES ($1, $2, $3)
           ON CONFLICT (comment_id, user_id) DO UPDATE SET value = EXCLUDED.value`,
          [commentId, userId, value]
        );
      }
      const r = await db.query<{ score: number }>(
        "SELECT COALESCE(SUM(value), 0)::int AS score FROM comment_votes WHERE comment_id = $1",
        [commentId]
      );
      return Number(r.rows[0]!.score);
    },
  };
}

function normalizeThread(row: ThreadRow): ThreadRow {
  return { ...row, score: Number(row.score), comment_count: Number(row.comment_count), my_vote: Number(row.my_vote) };
}

function normalizeComment(row: CommentRow): CommentRow {
  return { ...row, score: Number(row.score), my_vote: Number(row.my_vote) };
}

export type ThreadsRepo = ReturnType<typeof createThreadsRepo>;
