import type { PGlite } from "@electric-sql/pglite";

export interface ConversationRow {
  id: string;
  type: string;
  name: string | null;
}

export interface GroupSummary {
  id: string;
  name: string | null;
  role: string;
}

export function createGroupsRepo(db: PGlite) {
  return {
    async findUserByNickname(nickname: string): Promise<{ id: string } | null> {
      const r = await db.query<{ id: string }>("SELECT id FROM users WHERE nickname = $1", [nickname]);
      return r.rows[0] ?? null;
    },

    async getConversation(id: string): Promise<ConversationRow | null> {
      const r = await db.query<ConversationRow>(
        "SELECT id, type, name FROM conversations WHERE id = $1",
        [id]
      );
      return r.rows[0] ?? null;
    },

    async createGroup(name: string, creatorId: string): Promise<{ id: string; name: string }> {
      const c = await db.query<{ id: string }>(
        "INSERT INTO conversations (type, name) VALUES ('group', $1) RETURNING id",
        [name]
      );
      const id = c.rows[0]!.id;
      await db.query(
        "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'admin')",
        [id, creatorId]
      );
      return { id, name };
    },

    async getMemberRole(conversationId: string, userId: string): Promise<string | null> {
      const r = await db.query<{ role: string }>(
        "SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
        [conversationId, userId]
      );
      return r.rows[0]?.role ?? null;
    },

    // Inserta solo si hay cupo (< max) y no es ya miembro. Devuelve true si insertó.
    async addMemberIfRoom(conversationId: string, userId: string, max: number): Promise<boolean> {
      const r = await db.query<{ user_id: string }>(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         SELECT $1, $2, 'member'
         WHERE (SELECT count(*) FROM conversation_members WHERE conversation_id = $1) < $3
         ON CONFLICT DO NOTHING
         RETURNING user_id`,
        [conversationId, userId, max]
      );
      return r.rows.length > 0;
    },

    async removeMember(conversationId: string, userId: string): Promise<void> {
      await db.query(
        "DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
        [conversationId, userId]
      );
    },

    async listGroups(userId: string): Promise<GroupSummary[]> {
      const r = await db.query<GroupSummary>(
        `SELECT c.id, c.name, m.role
         FROM conversations c
         JOIN conversation_members m ON m.conversation_id = c.id
         WHERE c.type = 'group' AND m.user_id = $1
         ORDER BY c.created_at DESC`,
        [userId]
      );
      return r.rows;
    },
  };
}

export type GroupsRepo = ReturnType<typeof createGroupsRepo>;
