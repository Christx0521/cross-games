import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionService } from "./session.service.ts";
import type { SessionUser } from "./session.repo.ts";
import { AppError } from "../../lib/errors.ts";

export const SESSION_COOKIE = "sid";

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

export function readSessionId(req: FastifyRequest): string | null {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = req.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;
  return unsigned.value;
}

export function makeSessionGuard(sessionService: SessionService) {
  return async function sessionGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const sessionId = readSessionId(req);
    if (!sessionId) throw new AppError(401, "unauthenticated");
    req.user = await sessionService.me(sessionId);
  };
}
