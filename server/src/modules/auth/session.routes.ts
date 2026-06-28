import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.ts";
import type { SessionService } from "./session.service.ts";
import { SESSION_TTL_MS } from "./session.service.ts";
import { SESSION_COOKIE, makeSessionGuard, readSessionId } from "./session.guard.ts";

const loginSchema = {
  body: {
    type: "object",
    required: ["identifier", "password"],
    additionalProperties: false,
    properties: {
      identifier: { type: "string", minLength: 3, maxLength: 255 },
      password: { type: "string", minLength: 1, maxLength: 200 },
    },
  },
} as const;

export async function sessionRoutes(
  fastify: FastifyInstance,
  opts: { sessionService: SessionService }
): Promise<void> {
  const { sessionService } = opts;
  const guard = makeSessionGuard(sessionService);

  const cookieOptions = {
    signed: true,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
  };

  fastify.post<{ Body: { identifier: string; password: string } }>(
    "/auth/login",
    { schema: loginSchema },
    async (req, reply) => {
      const { sessionId, user } = await sessionService.login(req.body);
      reply.setCookie(SESSION_COOKIE, sessionId, {
        ...cookieOptions,
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      return { user };
    }
  );

  fastify.post("/auth/logout", async (req, reply) => {
    const sessionId = readSessionId(req);
    if (sessionId) await sessionService.logout(sessionId);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  fastify.get("/auth/me", { preHandler: guard }, async (req) => {
    return { user: req.user };
  });
}
