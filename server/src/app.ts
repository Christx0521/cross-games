import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { Server as IOServer } from "socket.io";
import type { PGlite } from "@electric-sql/pglite";
import { env } from "./config/env.ts";
import { AppError } from "./lib/errors.ts";
import { createAuthRepo } from "./modules/auth/repo.ts";
import { createAuthService } from "./modules/auth/service.ts";
import { authRoutes } from "./modules/auth/routes.ts";

declare module "fastify" {
  interface FastifyInstance {
    io: IOServer;
  }
}

export async function buildApp(opts: { db: PGlite }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });

  const io = new IOServer(app.server, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
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

  const service = createAuthService({ repo: createAuthRepo(opts.db) });
  await app.register(authRoutes, { service });

  return app;
}
