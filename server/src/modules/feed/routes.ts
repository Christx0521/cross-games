import type { FastifyInstance } from "fastify";
import type { FeedService } from "./service.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard, makeOptionalSession } from "../auth/session.guard.ts";
import { type Storage, extForMime } from "../../lib/storage.ts";
import { AppError } from "../../lib/errors.ts";

const pageQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    before: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: 50 },
  },
} as const;

const createSchema = {
  body: {
    type: "object",
    required: ["body"],
    additionalProperties: false,
    properties: { body: { type: "string", minLength: 1, maxLength: 4000 } },
  },
} as const;

const idParam = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
} as const;

const commentSchema = {
  params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
  body: {
    type: "object",
    required: ["body"],
    additionalProperties: false,
    properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
  },
} as const;

const wallSchema = {
  params: { type: "object", required: ["nickname"], properties: { nickname: { type: "string", minLength: 3, maxLength: 32 } } },
  querystring: pageQuery,
} as const;

export async function feedRoutes(
  fastify: FastifyInstance,
  opts: { feedService: FeedService; sessionService: SessionService; storage: Storage }
): Promise<void> {
  const { feedService, sessionService, storage } = opts;
  const guard = makeSessionGuard(sessionService);
  const optional = makeOptionalSession(sessionService);

  // Feed personal (amigos + propio).
  fastify.get<{ Querystring: { before?: string; limit?: number } }>(
    "/feed",
    { preHandler: guard, schema: { querystring: pageQuery } },
    async (req) => feedService.getFeed(req.user!.id, req.query.before, req.query.limit)
  );

  // Publicar (texto).
  fastify.post<{ Body: { body: string } }>(
    "/posts",
    { preHandler: guard, schema: createSchema },
    async (req, reply) => {
      const post = await feedService.createPost(req.user!.id, req.body.body);
      return reply.code(201).send(post);
    }
  );

  // Publicar con imagen (multipart; caption opcional en el campo "body").
  fastify.post(
    "/posts/attachment",
    { preHandler: guard },
    async (req, reply) => {
      const file = await req.file();
      if (!file) throw new AppError(400, "no_file");
      const ext = extForMime(file.mimetype);
      if (!ext) throw new AppError(415, "unsupported_media_type");
      const buf = await file.toBuffer();
      if (file.file.truncated) throw new AppError(413, "file_too_large");
      const caption =
        typeof file.fields.body === "object" && file.fields.body && "value" in file.fields.body
          ? String((file.fields.body as { value: unknown }).value ?? "")
          : "";
      const url = await storage.save(buf, ext);
      const post = await feedService.createPost(req.user!.id, caption, url);
      return reply.code(201).send(post);
    }
  );

  // Muro público de un usuario.
  fastify.get<{ Params: { nickname: string }; Querystring: { before?: string; limit?: number } }>(
    "/users/:nickname/posts",
    { preHandler: optional, schema: wallSchema },
    async (req) => feedService.getWall(req.params.nickname, req.user?.id ?? null, req.query.before, req.query.limit)
  );

  // Borrar publicación propia.
  fastify.delete<{ Params: { id: string } }>(
    "/posts/:id",
    { preHandler: guard, schema: idParam },
    async (req) => {
      await feedService.deletePost(req.params.id, req.user!.id);
      return { ok: true };
    }
  );

  // Me gusta (toggle).
  fastify.post<{ Params: { id: string } }>(
    "/posts/:id/like",
    { preHandler: guard, schema: idParam },
    async (req) => feedService.toggleLike(req.params.id, req.user!.id)
  );

  // Comentarios.
  fastify.get<{ Params: { id: string } }>(
    "/posts/:id/comments",
    { preHandler: optional, schema: idParam },
    async (req) => feedService.listComments(req.params.id)
  );

  fastify.post<{ Params: { id: string }; Body: { body: string } }>(
    "/posts/:id/comments",
    { preHandler: guard, schema: commentSchema },
    async (req, reply) => {
      const comment = await feedService.addComment(req.params.id, req.user!.id, req.body.body);
      return reply.code(201).send(comment);
    }
  );
}
