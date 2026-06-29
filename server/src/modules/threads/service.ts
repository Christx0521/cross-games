import type { ThreadsRepo, ThreadRow, CommentRow, ThreadSort } from "./repo.ts";
import type { ForumsRepo } from "../forums/repo.ts";
import { AppError } from "../../lib/errors.ts";

const MAX_TITLE = 200;
const MAX_BODY = 8000;
const MAX_COMMENT = 4000;
const SORTS: ThreadSort[] = ["hot", "new", "top"];

export function createThreadsService(deps: { repo: ThreadsRepo; forumsRepo: ForumsRepo }) {
  const { repo, forumsRepo } = deps;

  async function ensureForum(forumId: string): Promise<void> {
    if (!(await forumsRepo.getForum(forumId))) throw new AppError(404, "forum_not_found");
  }

  function normSort(sort: string | undefined): ThreadSort {
    return SORTS.includes(sort as ThreadSort) ? (sort as ThreadSort) : "hot";
  }

  return {
    async listThreads(forumId: string, sort: string | undefined, viewerId: string | null): Promise<ThreadRow[]> {
      await ensureForum(forumId);
      return repo.listThreads(forumId, normSort(sort), viewerId);
    },

    async createThread(
      forumId: string,
      authorId: string,
      input: { title: string; body?: string; attachmentUrl?: string | null }
    ): Promise<ThreadRow> {
      await ensureForum(forumId);
      const title = input.title.trim();
      if (!title) throw new AppError(422, "empty_title");
      if (title.length > MAX_TITLE) throw new AppError(422, "title_too_long");
      const body = (input.body ?? "").trim();
      if (body.length > MAX_BODY) throw new AppError(422, "body_too_long");

      const id = await repo.createThread({
        forumId,
        authorId,
        title,
        body,
        attachmentUrl: input.attachmentUrl ?? null,
      });
      return (await repo.getThread(id, authorId))!;
    },

    async getThread(threadId: string, viewerId: string | null): Promise<ThreadRow> {
      const thread = await repo.getThread(threadId, viewerId);
      if (!thread) throw new AppError(404, "thread_not_found");
      return thread;
    },

    async listComments(threadId: string, viewerId: string | null): Promise<CommentRow[]> {
      if (!(await repo.threadExists(threadId))) throw new AppError(404, "thread_not_found");
      return repo.listComments(threadId, viewerId);
    },

    async addComment(
      threadId: string,
      authorId: string,
      input: { body: string; parentId?: string | null }
    ): Promise<CommentRow> {
      if (!(await repo.threadExists(threadId))) throw new AppError(404, "thread_not_found");
      const body = input.body.trim();
      if (!body) throw new AppError(422, "empty_comment");
      if (body.length > MAX_COMMENT) throw new AppError(422, "comment_too_long");

      const parentId = input.parentId ?? null;
      if (parentId) {
        const parentThread = await repo.getCommentThreadId(parentId);
        if (parentThread !== threadId) throw new AppError(422, "invalid_parent");
      }

      const id = await repo.createComment({ threadId, parentId, authorId, body });
      const comments = await repo.listComments(threadId, authorId);
      return comments.find((c) => c.id === id)!;
    },

    async voteThread(threadId: string, userId: string, value: number): Promise<{ score: number }> {
      if (![-1, 0, 1].includes(value)) throw new AppError(422, "invalid_vote");
      if (!(await repo.threadExists(threadId))) throw new AppError(404, "thread_not_found");
      const score = await repo.setThreadVote(threadId, userId, value);
      return { score };
    },

    async voteComment(commentId: string, userId: string, value: number): Promise<{ score: number }> {
      if (![-1, 0, 1].includes(value)) throw new AppError(422, "invalid_vote");
      if (!(await repo.getCommentThreadId(commentId))) throw new AppError(404, "comment_not_found");
      const score = await repo.setCommentVote(commentId, userId, value);
      return { score };
    },
  };
}

export type ThreadsService = ReturnType<typeof createThreadsService>;
