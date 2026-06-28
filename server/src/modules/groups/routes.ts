import type { FastifyInstance } from "fastify";
import type { GroupsService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard } from "../auth/session.guard.ts";

const createSchema = {
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: { name: { type: "string", minLength: 1, maxLength: 80 } },
  },
} as const;

const addMemberSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  body: {
    type: "object",
    required: ["nickname"],
    additionalProperties: false,
    properties: { nickname: { type: "string", minLength: 3, maxLength: 32 } },
  },
} as const;

const removeSchema = {
  params: {
    type: "object",
    required: ["id", "userId"],
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
    },
  },
} as const;

export async function groupsRoutes(
  fastify: FastifyInstance,
  opts: { groupsService: GroupsService; sessionService: SessionService }
): Promise<void> {
  const { groupsService, sessionService } = opts;
  const guard = makeSessionGuard(sessionService);

  fastify.post<{ Body: { name: string } }>(
    "/groups",
    { preHandler: guard, schema: createSchema },
    async (req, reply) => {
      const group = await groupsService.createGroup(req.user!.id, req.body.name);
      return reply.code(201).send(group);
    }
  );

  fastify.post<{ Params: { id: string }; Body: { nickname: string } }>(
    "/groups/:id/members",
    { preHandler: guard, schema: addMemberSchema },
    async (req) => {
      await groupsService.addMember(req.user!.id, req.params.id, req.body.nickname);
      return { ok: true };
    }
  );

  fastify.delete<{ Params: { id: string; userId: string } }>(
    "/groups/:id/members/:userId",
    { preHandler: guard, schema: removeSchema },
    async (req) => {
      await groupsService.removeMember(req.user!.id, req.params.id, req.params.userId);
      return { ok: true };
    }
  );

  fastify.get("/groups", { preHandler: guard }, async (req) =>
    groupsService.listGroups(req.user!.id)
  );
}
