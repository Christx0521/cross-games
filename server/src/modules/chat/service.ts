import type { ChatRepo, MessageRow } from "./repo.ts";
import { encodeCursor, decodeCursor } from "./cursor.ts";
import { AppError } from "../../lib/errors.ts";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 30;
const MAX_BODY = 4000;
const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "🎮", "🔥", "😮", "😢"];

export interface HistoryPage {
  messages: MessageRow[];
  nextCursor: string | null;
}

export function createChatService(deps: { repo: ChatRepo; isBlocked?: (a: string, b: string) => Promise<boolean> }) {
  const { repo } = deps;
  const isBlocked = deps.isBlocked ?? (async () => false);

  async function ensureMember(conversationId: string, userId: string): Promise<void> {
    if (!(await repo.isMember(conversationId, userId))) {
      throw new AppError(403, "not_a_member");
    }
  }

  async function page(
    conversationId: string,
    beforeRaw: string | undefined,
    limitRaw: number | undefined,
    userId: string | null
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

    // Adjuntar reacciones agregadas a cada mensaje de la página.
    const reactions = await repo.getReactions(pageRows.map((m) => m.id), userId);
    for (const m of pageRows) m.reactions = reactions.get(m.id) ?? [];

    return { messages: pageRows.slice().reverse(), nextCursor };
  }

  return {
    async getOrCreateDm(userId: string, nickname: string): Promise<{ conversationId: string }> {
      const target = await repo.findUserByNickname(nickname);
      if (!target) throw new AppError(404, "user_not_found");
      if (target.id === userId) throw new AppError(400, "cannot_dm_self");
      if (await isBlocked(userId, target.id)) throw new AppError(403, "blocked");

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
      return page(conversationId, beforeRaw, limitRaw, userId);
    },

    // Historial de foro: lectura pública, solo valida que sea un foro.
    async getForumHistory(
      conversationId: string,
      beforeRaw: string | undefined,
      limitRaw: number | undefined,
      userId: string | null = null
    ): Promise<HistoryPage> {
      const type = await repo.getConversationType(conversationId);
      if (type !== "forum") throw new AppError(404, "forum_not_found");
      return page(conversationId, beforeRaw, limitRaw, userId);
    },

    async postMessage(
      userId: string,
      conversationId: string,
      body: string,
      attachmentUrl: string | null = null
    ): Promise<MessageRow> {
      const text = body.trim();
      if (!text && !attachmentUrl) throw new AppError(400, "empty_message");
      if (text.length > MAX_BODY) throw new AppError(422, "message_too_long");

      const type = await repo.getConversationType(conversationId);
      if (!type) throw new AppError(404, "conversation_not_found");
      // En foros cualquier usuario autenticado postea; en DM/grupo exige membresía.
      if (type !== "forum") await ensureMember(conversationId, userId);

      return repo.insertMessage(conversationId, userId, text, attachmentUrl);
    },

    // Alterna una reacción; valida emoji permitido y membresía (DM/grupo).
    async toggleReaction(
      userId: string,
      messageId: string,
      emoji: string
    ): Promise<{ added: boolean; conversationId: string }> {
      if (!ALLOWED_EMOJIS.includes(emoji)) throw new AppError(422, "invalid_emoji");
      const conversationId = await repo.getMessageConversationId(messageId);
      if (!conversationId) throw new AppError(404, "message_not_found");
      const type = await repo.getConversationType(conversationId);
      if (type !== "forum") await ensureMember(conversationId, userId);
      const added = await repo.toggleReaction(messageId, userId, emoji);
      return { added, conversationId };
    },

    getConversationType(conversationId: string): Promise<string | null> {
      return repo.getConversationType(conversationId);
    },

    async markRead(userId: string, conversationId: string): Promise<void> {
      await ensureMember(conversationId, userId);
      await repo.markRead(conversationId, userId);
    },

    getUnreadCounts(userId: string): Promise<Array<{ conversation_id: string; count: number }>> {
      return repo.getUnreadCounts(userId);
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
