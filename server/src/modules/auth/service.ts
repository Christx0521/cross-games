import type { AuthRepo } from "./repo.ts";
import { hashPassword } from "../../lib/password.ts";
import { generateCode, hashCode, verifyCode, CODE_TTL_MS } from "../../lib/code.ts";
import { sendVerificationCode } from "../../lib/email.ts";
import { AppError } from "../../lib/errors.ts";

const MAX_ATTEMPTS = 5;

export interface RegisterInput {
  nickname: string;
  email: string;
  password: string;
  birthYear: number;
}

export function createAuthService(deps: { repo: AuthRepo; now?: () => Date }) {
  const { repo } = deps;
  const now = deps.now ?? (() => new Date());

  async function issueCode(userId: string, email: string): Promise<void> {
    await repo.invalidateActiveCodes(userId);
    const code = generateCode();
    await repo.insertCode({
      userId,
      codeHash: hashCode(code, email),
      expiresAt: new Date(now().getTime() + CODE_TTL_MS),
    });
    await sendVerificationCode(email, code);
  }

  return {
    async register(input: RegisterInput): Promise<{ email: string }> {
      const age = now().getUTCFullYear() - input.birthYear;
      if (age < 18) throw new AppError(422, "underage");

      const existing = await repo.findByEmailOrNickname(input.email, input.nickname);
      if (existing) {
        if (existing.email === input.email.toLowerCase()) {
          throw new AppError(409, "email_taken");
        }
        throw new AppError(409, "nickname_taken");
      }

      const user = await repo.createUser({
        nickname: input.nickname,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        birthYear: input.birthYear,
      });
      await issueCode(user.id, user.email);
      return { email: user.email };
    },

    async verifyEmail(input: { email: string; code: string }): Promise<{ verified: true }> {
      const user = await repo.findUserByEmail(input.email);
      if (!user) throw new AppError(404, "user_not_found");

      const active = await repo.findActiveCode(user.id);
      if (!active) throw new AppError(410, "code_expired");
      if (new Date(active.expires_at).getTime() < now().getTime()) {
        throw new AppError(410, "code_expired");
      }
      if (active.attempts >= MAX_ATTEMPTS) {
        throw new AppError(429, "too_many_attempts");
      }

      if (!verifyCode(input.code, input.email, active.code_hash)) {
        await repo.incrementAttempts(active.id);
        throw new AppError(400, "invalid_code");
      }

      await repo.consumeCode(active.id);
      await repo.markVerified(user.id);
      return { verified: true };
    },

    async resendCode(email: string): Promise<void> {
      const user = await repo.findUserByEmail(email);
      if (!user || user.is_verified) return; // anti-enumeración
      await issueCode(user.id, user.email);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
