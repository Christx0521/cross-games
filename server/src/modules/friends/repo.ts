import type { PGlite } from "@electric-sql/pglite";

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
}

export interface FriendSummary {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

export interface FriendRequest {
  friendship_id: string;
  id: string;
  nickname: string;
  avatar_url: string | null;
}

export function createFriendsRepo(db: PGlite) {
  return {
    async findUserByNickname(nickname: string): Promise<{ id: string } | null> {
      const r = await db.query<{ id: string }>(
        "SELECT id FROM users WHERE nickname = $1",
        [nickname]
      );
      return r.rows[0] ?? null;
    },

    async findRelationship(a: string, b: string): Promise<FriendshipRow | null> {
      const r = await db.query<FriendshipRow>(
        `SELECT id, requester_id, addressee_id, status
         FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [a, b]
      );
      return r.rows[0] ?? null;
    },

    async getById(id: string): Promise<FriendshipRow | null> {
      const r = await db.query<FriendshipRow>(
        "SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = $1",
        [id]
      );
      return r.rows[0] ?? null;
    },

    async createRequest(requesterId: string, addresseeId: string): Promise<FriendshipRow> {
      const r = await db.query<FriendshipRow>(
        `INSERT INTO friendships (requester_id, addressee_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id, requester_id, addressee_id, status`,
        [requesterId, addresseeId]
      );
      return r.rows[0]!;
    },

    async accept(id: string): Promise<void> {
      await db.query(
        "UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = $1",
        [id]
      );
    },

    async deleteById(id: string): Promise<void> {
      await db.query("DELETE FROM friendships WHERE id = $1", [id]);
    },

    async listFriends(userId: string): Promise<FriendSummary[]> {
      const r = await db.query<FriendSummary>(
        `SELECT u.id, u.nickname, u.avatar_url
         FROM friendships f
         JOIN users u ON u.id = CASE
           WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
         WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)
         ORDER BY u.nickname`,
        [userId]
      );
      return r.rows;
    },

    async listRequests(userId: string): Promise<FriendRequest[]> {
      const r = await db.query<FriendRequest>(
        `SELECT f.id AS friendship_id, u.id, u.nickname, u.avatar_url
         FROM friendships f
         JOIN users u ON u.id = f.requester_id
         WHERE f.addressee_id = $1 AND f.status = 'pending'
         ORDER BY f.created_at DESC`,
        [userId]
      );
      return r.rows;
    },
  };
}

export type FriendsRepo = ReturnType<typeof createFriendsRepo>;
