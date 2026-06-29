import type { FastifyInstance } from "fastify";
import type { ChatService } from "./service.ts";
import type { MessageRow } from "./repo.ts";
import type { SessionService } from "../auth/session.service.ts";
import { makeSessionGuard } from "../auth/session.guard.ts";
import { type Storage, extForMime } from "../../lib/storage.ts";
import { AppError } from "../../lib/errors.ts";

const dmSchema = {
  body: {
    type: "object",
    required: ["nickname"],
    additionalProperties: false,
    properties: { nickname: { type: "string", minLength: 3, maxLength: 32 } },
  },
} as const;

const messagesSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
  },
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      before: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
  },
} as const;

export async function chatRoutes(
  fastify: FastifyInstance,
  opts: {
    chatService: ChatService;
    sessionService: SessionService;
    storage: Storage;
    deliverMessage: (msg: MessageRow) => Promise<void>;
  }
): Promise<void> {
  const { chatService, sessionService, storage, deliverMessage } = opts;
  const guard = makeSessionGuard(sessionService);

  fastify.post<{ Body: { nickname: string } }>(
    "/conversations/dm",
    { preHandler: guard, schema: dmSchema },
    async (req) => chatService.getOrCreateDm(req.user!.id, req.body.nickname)
  );

  fastify.get<{ Params: { id: string }; Querystring: { before?: string; limit?: number } }>(
    "/conversations/:id/messages",
    { preHandler: guard, schema: messagesSchema },
    async (req) =>
      chatService.getHistory(req.user!.id, req.params.id, req.query.before, req.query.limit)
  );

  fastify.get("/conversations/unread", { preHandler: guard }, async (req) =>
    chatService.getUnreadCounts(req.user!.id)
  );

  fastify.post<{ Params: { id: string } }>(
    "/conversations/:id/read",
    {
      preHandler: guard,
      schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } } as const,
    },
    async (req) => {
      await chatService.markRead(req.user!.id, req.params.id);
      return { ok: true };
    }
  );

  // Subir una imagen como mensaje (reusa Storage). Crea el mensaje y lo difunde.
  fastify.post<{ Params: { id: string } }>(
    "/conversations/:id/attachment",
    { preHandler: guard },
    async (req) => {
      const file = await req.file();
      if (!file) throw new AppError(400, "no_file");
      const ext = extForMime(file.mimetype);
      if (!ext) throw new AppError(415, "unsupported_media_type");
      const buf = await file.toBuffer();
      if (file.file.truncated) throw new AppError(413, "file_too_large");
      const caption = typeof file.fields.caption === "object" && file.fields.caption && "value" in file.fields.caption
        ? String((file.fields.caption as { value: unknown }).value ?? "")
        : "";
      const url = await storage.save(buf, ext);
      const msg = await chatService.postMessage(req.user!.id, req.params.id, caption, url);
      await deliverMessage(msg);
      return msg;
    }
  );
}
