import type { PGlite } from "@electric-sql/pglite";

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface MessageRow {
  id: string;
  seq: number;
  conversation_id: string;
  sender_id: string | null;
  sender_nickname: string | null;
  body: string;
  attachment_url: string | null;
  created_at: string;
  reactions?: Reaction[];
}

// PGlite puede devolver BIGSERIAL como string; normalizamos a number.
function normalize(row: MessageRow): MessageRow {
  return { ...row, seq: Number(row.seq) };
}

export function createChatRepo(db: PGlite) {
  return {
    async findUserByNickname(nickname: string): Promise<{ id: string } | null> {
      const r = await db.query<{ id: string }>("SELECT id FROM users WHERE nickname = $1", [nickname]);
      return r.rows[0] ?? null;
    },

    async findDmBetween(a: string, b: string): Promise<string | null> {
      const r = await db.query<{ id: string }>(
        `SELECT c.id
         FROM conversations c
         JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = $1
         JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = $2
         WHERE c.type = 'dm'
         LIMIT 1`,
        [a, b]
      );
      return r.rows[0]?.id ?? null;
    },

    async createConversation(type: string, name: string | null): Promise<string> {
      const r = await db.query<{ id: string }>(
        "INSERT INTO conversations (type, name) VALUES ($1, $2) RETURNING id",
        [type, name]
      );
      return r.rows[0]!.id;
    },

    async addMember(conversationId: string, userId: string, role = "member"): Promise<void> {
      await db.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [conversationId, userId, role]
      );
    },

    async getConversationType(conversationId: string): Promise<string | null> {
      const r = await db.query<{ type: string }>(
        "SELECT type FROM conversations WHERE id = $1",
        [conversationId]
      );
      return r.rows[0]?.type ?? null;
    },

    async isMember(conversationId: string, userId: string): Promise<boolean> {
      const r = await db.query(
        "SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
        [conversationId, userId]
      );
      return r.rows.length > 0;
    },

    // Marca la conversación como leída hasta el último mensaje existente.
    async markRead(conversationId: string, userId: string): Promise<void> {
      await db.query(
        `INSERT INTO conversation_reads (conversation_id, user_id, last_read_seq, updated_at)
         VALUES ($1, $2, (SELECT COALESCE(MAX(seq), 0) FROM messages WHERE conversation_id = $1), now())
         ON CONFLICT (conversation_id, user_id)
         DO UPDATE SET last_read_seq = EXCLUDED.last_read_seq, updated_at = now()`,
        [conversationId, userId]
      );
    },

    // Cuenta mensajes no leídos (de otros) por conversación donde el usuario es miembro.
    async getUnreadCounts(userId: string): Promise<Array<{ conversation_id: string; count: number }>> {
      const r = await db.query<{ conversation_id: string; count: number }>(
        `SELECT m.conversation_id, COUNT(*)::int AS count
         FROM messages m
         JOIN conversation_members cm
           ON cm.conversation_id = m.conversation_id AND cm.user_id = $1
         LEFT JOIN conversation_reads r
           ON r.conversation_id = m.conversation_id AND r.user_id = $1
         WHERE m.sender_id <> $1 AND m.seq > COALESCE(r.last_read_seq, 0)
         GROUP BY m.conversation_id`,
        [userId]
      );
      return r.rows.map((x) => ({ conversation_id: x.conversation_id, count: Number(x.count) }));
    },

    async getMemberIds(conversationId: string): Promise<string[]> {
      const r = await db.query<{ user_id: string }>(
        "SELECT user_id FROM conversation_members WHERE conversation_id = $1",
        [conversationId]
      );
      return r.rows.map((x) => x.user_id);
    },

    async insertMessage(
      conversationId: string,
      senderId: string,
      body: string,
      attachmentUrl: string | null = null
    ): Promise<MessageRow> {
      const r = await db.query<MessageRow>(
        `INSERT INTO messages (conversation_id, sender_id, body, attachment_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, seq, conversation_id, sender_id, body, attachment_url, created_at`,
        [conversationId, senderId, body, attachmentUrl]
      );
      const sender = await db.query<{ nickname: string }>(
        "SELECT nickname FROM users WHERE id = $1",
        [senderId]
      );
      return normalize({ ...r.rows[0]!, sender_nickname: sender.rows[0]?.nickname ?? null });
    },

    async getMessageConversationId(messageId: string): Promise<string | null> {
      const r = await db.query<{ conversation_id: string }>(
        "SELECT conversation_id FROM messages WHERE id = $1",
        [messageId]
      );
      return r.rows[0]?.conversation_id ?? null;
    },

    // Alterna una reacción. Devuelve true si se añadió, false si se quitó.
    async toggleReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
      const del = await db.query(
        "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 RETURNING 1",
        [messageId, userId, emoji]
      );
      if (del.rows.length > 0) return false;
      await db.query(
        "INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)",
        [messageId, userId, emoji]
      );
      return true;
    },

    // Resumen de reacciones para un conjunto de mensajes (con flag "mine").
    async getReactions(messageIds: string[], userId: string | null): Promise<Map<string, Reaction[]>> {
      const map = new Map<string, Reaction[]>();
      if (messageIds.length === 0) return map;
      const r = await db.query<{ message_id: string; emoji: string; count: number; mine: boolean }>(
        `SELECT message_id, emoji, COUNT(*)::int AS count,
                bool_or(user_id = $2) AS mine
         FROM message_reactions
         WHERE message_id = ANY($1)
         GROUP BY message_id, emoji
         ORDER BY emoji`,
        [messageIds, userId ?? "00000000-0000-0000-0000-000000000000"]
      );
      for (const row of r.rows) {
        const list = map.get(row.message_id) ?? [];
        list.push({ emoji: row.emoji, count: Number(row.count), mine: row.mine });
        map.set(row.message_id, list);
      }
      return map;
    },

    // Página de historial en orden descendente (más nuevo primero), keyset por seq.
    async listMessages(conversationId: string, beforeSeq: number | null, limit: number): Promise<MessageRow[]> {
      if (beforeSeq !== null) {
        const r = await db.query<MessageRow>(
          `SELECT m.id, m.seq, m.conversation_id, m.sender_id, u.nickname AS sender_nickname, m.body, m.attachment_url, m.created_at
           FROM messages m
           LEFT JOIN users u ON u.id = m.sender_id
           WHERE m.conversation_id = $1 AND m.seq < $2
           ORDER BY m.seq DESC
           LIMIT $3`,
          [conversationId, beforeSeq, limit]
        );
        return r.rows.map(normalize);
      }
      const r = await db.query<MessageRow>(
        `SELECT m.id, m.seq, m.conversation_id, m.sender_id, u.nickname AS sender_nickname, m.body, m.attachment_url, m.created_at
         FROM messages m
         LEFT JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = $1
         ORDER BY m.seq DESC
         LIMIT $2`,
        [conversationId, limit]
      );
      return r.rows.map(normalize);
    },
  };
}

export type ChatRepo = ReturnType<typeof createChatRepo>;
