import type { NotificationsRepo, NotificationRow } from "./repo.ts";
import { encodeCursor, decodeCursor } from "../chat/cursor.ts";
import { AppError } from "../../lib/errors.ts";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MENTION_RE = /@([A-Za-z0-9_]{3,32})/g;

// Emisor en vivo (Socket.IO) inyectado; desacopla el servicio del transporte.
export type Emit = (userId: string, event: string, payload: unknown) => void;

export interface NotificationsPage {
  notifications: NotificationRow[];
  nextCursor: string | null;
}

export interface DirectInput {
  recipientId: string;
  actorId: string;
  type: string;
  entityType: string;
  entityId: string | null;
  preview: string;
}

export interface MentionInput {
  text: string;
  actorId: string;
  entityType: string;
  entityId: string | null;
  preview: string;
}

// Lo que feed/threads necesitan para notificar, sin conocer el repo ni el socket.
export interface Notifier {
  direct(input: DirectInput): Promise<void>;
  mentions(input: MentionInput): Promise<void>;
}

// Extrae nicknames únicos de un texto (@nick), en minúsculas para deduplicar.
export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) found.add(m[1]!);
  return [...found];
}

export function createNotificationsService(deps: { repo: NotificationsRepo; emit: Emit }): Notifier & {
  list(userId: string, before: string | undefined, limit: number | undefined): Promise<NotificationsPage>;
  unreadCount(userId: string): Promise<number>;
  markAllRead(userId: string): Promise<void>;
  markRead(userId: string, id: string): Promise<void>;
} {
  const { repo, emit } = deps;

  async function persistAndEmit(input: {
    recipientId: string;
    actorId: string;
    type: string;
    entityType: string;
    entityId: string | null;
    preview: string;
  }): Promise<void> {
    // Nunca te notificas a ti mismo.
    if (input.recipientId === input.actorId) return;
    const row = await repo.create({
      userId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      preview: input.preview,
    });
    emit(input.recipientId, "notification:new", row);
  }

  return {
    async direct(input: DirectInput): Promise<void> {
      await persistAndEmit(input);
    },

    async mentions(input: MentionInput): Promise<void> {
      const nicknames = extractMentions(input.text);
      if (nicknames.length === 0) return;
      const seen = new Set<string>();
      for (const nickname of nicknames) {
        const userId = await repo.findUserIdByNickname(nickname);
        if (!userId || userId === input.actorId || seen.has(userId)) continue;
        seen.add(userId);
        await persistAndEmit({
          recipientId: userId,
          actorId: input.actorId,
          type: "mention",
          entityType: input.entityType,
          entityId: input.entityId,
          preview: input.preview,
        });
      }
    },

    async list(userId: string, before: string | undefined, limitRaw: number | undefined): Promise<NotificationsPage> {
      const limit = Math.min(Math.max(limitRaw ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
      let beforeSeq: number | null = null;
      if (before) {
        beforeSeq = decodeCursor(before);
        if (beforeSeq === null) throw new AppError(400, "invalid_cursor");
      }
      const rows = await repo.listByUser(userId, beforeSeq, limit + 1);
      const hasMore = rows.length > limit;
      const notifications = hasMore ? rows.slice(0, limit) : rows;
      const last = notifications.at(-1);
      return { notifications, nextCursor: hasMore && last ? encodeCursor(last.seq) : null };
    },

    unreadCount(userId: string): Promise<number> {
      return repo.unreadCount(userId);
    },

    markAllRead(userId: string): Promise<void> {
      return repo.markAllRead(userId);
    },

    markRead(userId: string, id: string): Promise<void> {
      return repo.markRead(userId, id);
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
