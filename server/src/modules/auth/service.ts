import type { AuthRepo } from "./repo.ts";
import { hashPassword } from "../../lib/password.ts";
import { AppError } from "../../lib/errors.ts";

export interface RegisterInput {
  nickname: string;
  email: string;
  password: string;
  birthYear: number;
}

export function createAuthService(deps: { repo: AuthRepo; now?: () => Date }) {
  const { repo } = deps;
  const now = deps.now ?? (() => new Date());

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
      // Sin verificación por email: la cuenta queda lista para usar.
      await repo.markVerified(user.id);
      return { email: user.email };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
