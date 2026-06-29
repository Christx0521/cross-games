import type { FeedRepo, PostRow, PostCommentRow } from "./repo.ts";
import type { FriendsRepo } from "../friends/repo.ts";
import type { Notifier } from "../notifications/service.ts";
import { encodeCursor, decodeCursor } from "../chat/cursor.ts";
import { AppError } from "../../lib/errors.ts";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MAX_BODY = 4000;
const MAX_COMMENT = 2000;

// Notifier no-op por defecto: el servicio funciona en tests sin socket.
const NOOP_NOTIFIER: Notifier = {
  async direct() {},
  async mentions() {},
};

function snippet(text: string, max = 80): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export interface PostsPage {
  posts: PostRow[];
  nextCursor: string | null;
}

export function createFeedService(deps: { repo: FeedRepo; friendsRepo: FriendsRepo; notifier?: Notifier }) {
  const { repo, friendsRepo } = deps;
  const notifier = deps.notifier ?? NOOP_NOTIFIER;

  function resolveCursor(beforeRaw: string | undefined, limitRaw: number | undefined): { beforeSeq: number | null; limit: number } {
    const limit = Math.min(Math.max(limitRaw ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    let beforeSeq: number | null = null;
    if (beforeRaw) {
      beforeSeq = decodeCursor(beforeRaw);
      if (beforeSeq === null) throw new AppError(400, "invalid_cursor");
    }
    return { beforeSeq, limit };
  }

  function toPage(rows: PostRow[], limit: number): PostsPage {
    const hasMore = rows.length > limit;
    const posts = hasMore ? rows.slice(0, limit) : rows;
    const last = posts.at(-1);
    return { posts, nextCursor: hasMore && last ? encodeCursor(last.seq) : null };
  }

  return {
    async createPost(authorId: string, body: string, attachmentUrl: string | null = null): Promise<PostRow> {
      const text = body.trim();
      if (!text && !attachmentUrl) throw new AppError(422, "empty_post");
      if (text.length > MAX_BODY) throw new AppError(422, "post_too_long");
      const id = await repo.createPost(authorId, text, attachmentUrl);
      if (text) await notifier.mentions({ text, actorId: authorId, entityType: "post", entityId: id, preview: snippet(text) });
      return (await repo.getPost(id, authorId))!;
    },

    // Feed personal: publicaciones propias + de amigos, más recientes primero.
    async getFeed(userId: string, beforeRaw: string | undefined, limitRaw: number | undefined): Promise<PostsPage> {
      const { beforeSeq, limit } = resolveCursor(beforeRaw, limitRaw);
      const friends = await friendsRepo.listFriends(userId);
      const authorIds = [userId, ...friends.map((f) => f.id)];
      const rows = await repo.listByAuthors(authorIds, beforeSeq, limit + 1, userId);
      return toPage(rows, limit);
    },

    // Muro de un usuario por nickname (lectura pública).
    async getWall(nickname: string, viewerId: string | null, beforeRaw: string | undefined, limitRaw: number | undefined): Promise<PostsPage> {
      const targetId = await repo.getUserIdByNickname(nickname);
      if (!targetId) throw new AppError(404, "user_not_found");
      const { beforeSeq, limit } = resolveCursor(beforeRaw, limitRaw);
      const rows = await repo.listByAuthor(targetId, beforeSeq, limit + 1, viewerId);
      return toPage(rows, limit);
    },

    async deletePost(postId: string, userId: string): Promise<void> {
      const author = await repo.getPostAuthor(postId);
      if (!author) throw new AppError(404, "post_not_found");
      if (author !== userId) throw new AppError(403, "not_the_author");
      await repo.deletePost(postId);
    },

    async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; like_count: number }> {
      const author = await repo.getPostAuthor(postId);
      if (!author) throw new AppError(404, "post_not_found");
      const [liked, like_count] = await repo.toggleLike(postId, userId);
      if (liked) {
        await notifier.direct({
          recipientId: author,
          actorId: userId,
          type: "post_like",
          entityType: "post",
          entityId: postId,
          preview: "le gustó tu publicación",
        });
      }
      return { liked, like_count };
    },

    async listComments(postId: string): Promise<PostCommentRow[]> {
      if (!(await repo.getPostAuthor(postId))) throw new AppError(404, "post_not_found");
      return repo.listComments(postId);
    },

    async addComment(postId: string, authorId: string, body: string): Promise<PostCommentRow> {
      const postAuthor = await repo.getPostAuthor(postId);
      if (!postAuthor) throw new AppError(404, "post_not_found");
      const text = body.trim();
      if (!text) throw new AppError(422, "empty_comment");
      if (text.length > MAX_COMMENT) throw new AppError(422, "comment_too_long");
      const comment = await repo.createComment(postId, authorId, text);
      await notifier.direct({
        recipientId: postAuthor,
        actorId: authorId,
        type: "post_comment",
        entityType: "post",
        entityId: postId,
        preview: snippet(text),
      });
      await notifier.mentions({ text, actorId: authorId, entityType: "post", entityId: postId, preview: snippet(text) });
      return comment;
    },
  };
}

export type FeedService = ReturnType<typeof createFeedService>;
