import type { FastifyInstance } from "fastify";
import type { NotificationsService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard } from "../auth/session.guard.ts";

const listSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      before: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
  },
} as const;

const idParam = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
} as const;

export async function notificationsRoutes(
  fastify: FastifyInstance,
  opts: { notificationsService: NotificationsService; sessionService: SessionService }
): Promise<void> {
  const { notificationsService, sessionService } = opts;
  const guard = makeSessionGuard(sessionService);

  fastify.get<{ Querystring: { before?: string; limit?: number } }>(
    "/notifications",
    { preHandler: guard, schema: listSchema },
    async (req) => notificationsService.list(req.user!.id, req.query.before, req.query.limit)
  );

  fastify.get("/notifications/unread", { preHandler: guard }, async (req) => ({
    count: await notificationsService.unreadCount(req.user!.id),
  }));

  fastify.post("/notifications/read", { preHandler: guard }, async (req) => {
    await notificationsService.markAllRead(req.user!.id);
    return { ok: true };
  });

  fastify.post<{ Params: { id: string } }>(
    "/notifications/:id/read",
    { preHandler: guard, schema: idParam },
    async (req) => {
      await notificationsService.markRead(req.user!.id, req.params.id);
      return { ok: true };
    }
  );
}
