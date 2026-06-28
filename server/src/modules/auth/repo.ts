import type { PGlite } from "@electric-sql/pglite";

export interface UserRow {
  id: string;
  nickname: string;
  email: string;
  password_hash: string;
  birth_year: number;
  is_verified: boolean;
}

export interface CodeRow {
  id: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
}

export function createAuthRepo(db: PGlite) {
  return {
    async findUserByEmail(email: string): Promise<UserRow | null> {
      const r = await db.query<UserRow>(
        "SELECT * FROM users WHERE email = $1",
        [email.toLowerCase()]
      );
      return r.rows[0] ?? null;
    },

    async findUserByIdentifier(identifier: string): Promise<UserRow | null> {
      const r = await db.query<UserRow>(
        "SELECT * FROM users WHERE email = $1 OR nickname = $2",
        [identifier.toLowerCase(), identifier]
      );
      return r.rows[0] ?? null;
    },

    async findByEmailOrNickname(
      email: string,
      nickname: string
    ): Promise<{ email: string; nickname: string } | null> {
      const r = await db.query<{ email: string; nickname: string }>(
        "SELECT email, nickname FROM users WHERE email = $1 OR nickname = $2",
        [email.toLowerCase(), nickname]
      );
      return r.rows[0] ?? null;
    },

    async createUser(input: {
      nickname: string;
      email: string;
      passwordHash: string;
      birthYear: number;
    }): Promise<UserRow> {
      const r = await db.query<UserRow>(
        `INSERT INTO users (nickname, email, password_hash, birth_year)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [input.nickname, input.email.toLowerCase(), input.passwordHash, input.birthYear]
      );
      return r.rows[0]!;
    },

    async markVerified(userId: string): Promise<void> {
      await db.query("UPDATE users SET is_verified = TRUE WHERE id = $1", [userId]);
    },

    async invalidateActiveCodes(userId: string): Promise<void> {
      await db.query(
        "UPDATE email_verification_codes SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL",
        [userId]
      );
    },

    async insertCode(input: {
      userId: string;
      codeHash: string;
      expiresAt: Date;
    }): Promise<void> {
      await db.query(
        `INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [input.userId, input.codeHash, input.expiresAt.toISOString()]
      );
    },

    async findActiveCode(userId: string): Promise<CodeRow | null> {
      const r = await db.query<CodeRow>(
        `SELECT id, code_hash, expires_at, attempts
         FROM email_verification_codes
         WHERE user_id = $1 AND consumed_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      return r.rows[0] ?? null;
    },

    async incrementAttempts(codeId: string): Promise<void> {
      await db.query(
        "UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1",
        [codeId]
      );
    },

    async consumeCode(codeId: string): Promise<void> {
      await db.query(
        "UPDATE email_verification_codes SET consumed_at = now() WHERE id = $1",
        [codeId]
      );
    },
  };
}

export type AuthRepo = ReturnType<typeof createAuthRepo>;
