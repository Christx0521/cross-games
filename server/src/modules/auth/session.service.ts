import type { AuthRepo } from "./repo.ts";
import type { SessionRepo, SessionUser } from "./session.repo.ts";
import { verifyPassword } from "../../lib/password.ts";
import { AppError } from "../../lib/errors.ts";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createSessionService(deps: {
  authRepo: AuthRepo;
  sessionRepo: SessionRepo;
  now?: () => Date;
}) {
  const { authRepo, sessionRepo } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    async login(input: { identifier: string; password: string }): Promise<{
      sessionId: string;
      user: SessionUser;
    }> {
      const user = await authRepo.findUserByIdentifier(input.identifier);
      if (!user) throw new AppError(401, "invalid_credentials");

      const ok = await verifyPassword(user.password_hash, input.password);
      if (!ok) throw new AppError(401, "invalid_credentials");

      const expiresAt = new Date(now().getTime() + SESSION_TTL_MS);
      const sessionId = await sessionRepo.createSession(user.id, expiresAt);
      return {
        sessionId,
        user: {
          id: user.id,
          nickname: user.nickname,
          email: user.email,
          is_verified: user.is_verified,
        },
      };
    },

    async logout(sessionId: string): Promise<void> {
      await sessionRepo.deleteSession(sessionId);
    },

    async me(sessionId: string): Promise<SessionUser> {
      const user = await sessionRepo.findValidSession(sessionId);
      if (!user) throw new AppError(401, "unauthenticated");
      return user;
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
