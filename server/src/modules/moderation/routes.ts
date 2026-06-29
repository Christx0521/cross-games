import type { FastifyInstance } from "fastify";
import type { ModerationService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard } from "../auth/session.guard.ts";

const blockSchema = {
  body: {
    type: "object",
    required: ["nickname"],
    additionalProperties: false,
    properties: { nickname: { type: "string", minLength: 3, maxLength: 32 } },
  },
} as const;

const unblockSchema = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
} as const;

const reportSchema = {
  body: {
    type: "object",
    required: ["targetType", "targetId"],
    additionalProperties: false,
    properties: {
      targetType: { type: "string", enum: ["user", "post", "thread", "comment", "message"] },
      targetId: { type: "string", format: "uuid" },
      reason: { type: "string", maxLength: 500 },
    },
  },
} as const;

export async function moderationRoutes(
  fastify: FastifyInstance,
  opts: { moderationService: ModerationService; sessionService: SessionService }
): Promise<void> {
  const { moderationService, sessionService } = opts;
  const guard = makeSessionGuard(sessionService);

  fastify.get("/blocks", { preHandler: guard }, async (req) => moderationService.listBlocked(req.user!.id));

  fastify.post<{ Body: { nickname: string } }>(
    "/blocks",
    { preHandler: guard, schema: blockSchema },
    async (req) => {
      await moderationService.block(req.user!.id, req.body.nickname);
      return { ok: true };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/blocks/:id",
    { preHandler: guard, schema: unblockSchema },
    async (req) => {
      await moderationService.unblock(req.user!.id, req.params.id);
      return { ok: true };
    }
  );

  fastify.post<{ Body: { targetType: string; targetId: string; reason?: string } }>(
    "/reports",
    { preHandler: guard, schema: reportSchema },
    async (req, reply) => {
      const r = await moderationService.report(req.user!.id, req.body);
      return reply.code(201).send(r);
    }
  );
}
