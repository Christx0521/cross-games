import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { Server as IOServer } from "socket.io";
import type { PGlite } from "@electric-sql/pglite";
import { env } from "./config/env.ts";
import { AppError } from "./lib/errors.ts";
import { createAuthRepo } from "./modules/auth/repo.ts";
import { createAuthService } from "./modules/auth/service.ts";
import { authRoutes } from "./modules/auth/routes.ts";
import { createSessionRepo, type SessionUser } from "./modules/auth/session.repo.ts";
import { createSessionService } from "./modules/auth/session.service.ts";
import { sessionRoutes } from "./modules/auth/session.routes.ts";
import { SESSION_COOKIE } from "./modules/auth/session.guard.ts";

declare module "fastify" {
  interface FastifyInstance {
    io: IOServer;
  }
}

declare module "socket.io" {
  interface SocketData {
    user?: SessionUser;
  }
}

export async function buildApp(opts: { db: PGlite }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie, { secret: env.SESSION_SECRET });

  const authRepo = createAuthRepo(opts.db);
  const sessionRepo = createSessionRepo(opts.db);
  const authService = createAuthService({ repo: authRepo });
  const sessionService = createSessionService({ authRepo, sessionRepo });

  const io = new IOServer(app.server, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
  });

  // Autenticación en el handshake: valida la cookie de sesión una vez al conectar.
  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.headers.cookie;
      if (!header) return next(new AppError(401, "unauthenticated"));
      const parsed = app.parseCookie(header);
      const raw = parsed[SESSION_COOKIE];
      if (!raw) return next(new AppError(401, "unauthenticated"));
      const unsigned = app.unsignCookie(raw);
      if (!unsigned.valid || !unsigned.value) return next(new AppError(401, "unauthenticated"));
      socket.data.user = await sessionService.me(unsigned.value);
      next();
    } catch {
      next(new AppError(401, "unauthenticated"));
    }
  });

  app.decorate("io", io);
  app.addHook("onClose", async () => {
    await io.close();
  });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ code: error.code, message: error.message });
    }
    if (error.validation) {
      return reply.code(400).send({ code: "invalid_request", message: error.message });
    }
    return reply.code(500).send({ code: "internal_error", message: "internal_error" });
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { service: authService });
  await app.register(sessionRoutes, { sessionService });

  return app;
}
