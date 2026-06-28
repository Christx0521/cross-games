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

    async getHistory(
      userId: string,
      conversationId: string,
      beforeRaw: string | undefined,
      limitRaw: number | undefined
    ): Promise<HistoryPage> {
      await ensureMember(conversationId, userId);

      const limit = Math.min(Math.max(limitRaw ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
      let beforeSeq: number | null = null;
      if (beforeRaw) {
        beforeSeq = decodeCursor(beforeRaw);
        if (beforeSeq === null) throw new AppError(400, "invalid_cursor");
      }

      const rows = await repo.listMessages(conversationId, beforeSeq, limit + 1);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const last = page.at(-1);
      const nextCursor = hasMore && last ? encodeCursor(last.seq) : null;

      // Se devuelve en orden ascendente (más antiguo primero) para pintar de arriba a abajo.
      return { messages: page.slice().reverse(), nextCursor };
    },

    async postMessage(userId: string, conversationId: string, body: string): Promise<MessageRow> {
      const text = body.trim();
      if (!text) throw new AppError(400, "empty_message");
      if (text.length > MAX_BODY) throw new AppError(422, "message_too_long");
      await ensureMember(conversationId, userId);
      return repo.insertMessage(conversationId, userId, text);
    },

    getMemberIds(conversationId: string): Promise<string[]> {
      return repo.getMemberIds(conversationId);
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
