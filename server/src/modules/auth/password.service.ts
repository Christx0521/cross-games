import type { AuthRepo } from "./repo.ts";
import type { SessionRepo } from "./session.repo.ts";
import { hashPassword } from "../../lib/password.ts";
import { generateCode, hashCode, verifyCode, CODE_TTL_MS } from "../../lib/code.ts";
import { sendVerificationCode } from "../../lib/email.ts";
import { AppError } from "../../lib/errors.ts";

const PURPOSE = "password_reset";
const MAX_ATTEMPTS = 5;

export function createPasswordService(deps: {
  authRepo: AuthRepo;
  sessionRepo: SessionRepo;
  now?: () => Date;
}) {
  const { authRepo, sessionRepo } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    // Anti-enumeración: responde sin lanzar exista o no la cuenta.
    async forgotPassword(email: string): Promise<void> {
      const user = await authRepo.findUserByEmail(email);
      if (!user) return;
      await authRepo.invalidateActiveCodes(user.id, PURPOSE);
      const code = generateCode();
      await authRepo.insertCode({
        userId: user.id,
        codeHash: hashCode(code, email),
        expiresAt: new Date(now().getTime() + CODE_TTL_MS),
        purpose: PURPOSE,
      });
      await sendVerificationCode(email, code);
    },

    async resetPassword(input: {
      email: string;
      code: string;
      newPassword: string;
    }): Promise<{ reset: true }> {
      const user = await authRepo.findUserByEmail(input.email);
      if (!user) throw new AppError(400, "invalid_code");

      const active = await authRepo.findActiveCode(user.id, PURPOSE);
      if (!active) throw new AppError(410, "code_expired");
      if (new Date(active.expires_at).getTime() < now().getTime()) {
        throw new AppError(410, "code_expired");
      }
      if (active.attempts >= MAX_ATTEMPTS) {
        throw new AppError(429, "too_many_attempts");
      }

      if (!verifyCode(input.code, input.email, active.code_hash)) {
        await authRepo.incrementAttempts(active.id);
        throw new AppError(400, "invalid_code");
      }

      await authRepo.consumeCode(active.id);
      await authRepo.updatePasswordHash(user.id, await hashPassword(input.newPassword));
      await sessionRepo.deleteUserSessions(user.id);
      return { reset: true };
    },
  };
}

export type PasswordService = ReturnType<typeof createPasswordService>;
