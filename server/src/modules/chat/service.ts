import type { ChatRepo, MessageRow } from "./repo.ts";
import { encodeCursor, decodeCursor } from "./cursor.ts";
import { AppError } from "../../lib/errors.ts";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 30;
const MAX_BODY = 4000;

export interface HistoryPage {
  messages: MessageRow[];
  nextCursor: string | null;
}

export function createChatService(deps: { repo: ChatRepo }) {
  const { repo } = deps;

  async function ensureMember(conversationId: string, userId: string): Promise<void> {
    if (!(await repo.isMember(conversationId, userId))) {
      throw new AppError(403, "not_a_member");
    }
  }

  async function page(
    conversationId: string,
    beforeRaw: string | undefined,
    limitRaw: number | undefined
  ): Promise<HistoryPage> {
    const limit = Math.min(Math.max(limitRaw ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    let beforeSeq: number | null = null;
    if (beforeRaw) {
      beforeSeq = decodeCursor(beforeRaw);
      if (beforeSeq === null) throw new AppError(400, "invalid_cursor");
    }
    const rows = await repo.listMessages(conversationId, beforeSeq, limit + 1);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(last.seq) : null;
    return { messages: pageRows.slice().reverse(), nextCursor };
  }

  return {
    async getOrCreateDm(userId: string, nickname: string): Promise<{ conversationId: string }> {
      const target = await repo.findUserByNickname(nickname);
      if (!target) throw new AppError(404, "user_not_found");
      if (target.id === userId) throw new AppError(400, "cannot_dm_self");

      const existing = await repo.findDmBetween(userId, target.id);
      if (existing) return { conversationId: existing };

      const conversationId = await repo.createConversation("dm", null);
      await repo.addMember(conversationId, userId);
      await repo.addMember(conversationId, target.id);
      return { conversationId };
    },

    // Historial para DM/grupo: exige membresía.
    async getHistory(
      userId: string,
      conversationId: string,
      beforeRaw: string | undefined,
      limitRaw: number | undefined
    ): Promise<HistoryPage> {
      await ensureMember(conversationId, userId);
      return page(conversationId, beforeRaw, limitRaw);
    },

    // Historial de foro: lectura pública, solo valida que sea un foro.
    async getForumHistory(
      conversationId: string,
      beforeRaw: string | undefined,
      limitRaw: number | undefined
    ): Promise<HistoryPage> {
      const type = await repo.getConversationType(conversationId);
      if (type !== "forum") throw new AppError(404, "forum_not_found");
      return page(conversationId, beforeRaw, limitRaw);
    },

    async postMessage(userId: string, conversationId: string, body: string): Promise<MessageRow> {
      const text = body.trim();
      if (!text) throw new AppError(400, "empty_message");
      if (text.length > MAX_BODY) throw new AppError(422, "message_too_long");

      const type = await repo.getConversationType(conversationId);
      if (!type) throw new AppError(404, "conversation_not_found");
      // En foros cualquier usuario autenticado postea; en DM/grupo exige membresía.
      if (type !== "forum") await ensureMember(conversationId, userId);

      return repo.insertMessage(conversationId, userId, text);
    },

    getConversationType(conversationId: string): Promise<string | null> {
      return repo.getConversationType(conversationId);
    },

    getMemberIds(conversationId: string): Promise<string[]> {
      return repo.getMemberIds(conversationId);
    },

    isMemberOf(conversationId: string, userId: string): Promise<boolean> {
      return repo.isMember(conversationId, userId);
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
