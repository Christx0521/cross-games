import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { Server as IOServer } from "socket.io";
import type { PGlite } from "@electric-sql/pglite";
import { env } from "./config/env.ts";
import { AppError } from "./lib/errors.ts";
import { createDiskStorage } from "./lib/storage.ts";
import { createPresence } from "./lib/presence.ts";
import { createProfileRepo } from "./modules/profile/repo.ts";
import { createProfileService } from "./modules/profile/service.ts";
import { profileRoutes } from "./modules/profile/routes.ts";
import { createFriendsRepo } from "./modules/friends/repo.ts";
import { createFriendsService, type Notify } from "./modules/friends/service.ts";
import { friendsRoutes } from "./modules/friends/routes.ts";
import { createChatRepo } from "./modules/chat/repo.ts";
import { createChatService } from "./modules/chat/service.ts";
import { chatRoutes } from "./modules/chat/routes.ts";
import { createGroupsRepo } from "./modules/groups/repo.ts";
import { createGroupsService } from "./modules/groups/service.ts";
import { groupsRoutes } from "./modules/groups/routes.ts";
import { createForumsRepo } from "./modules/forums/repo.ts";
import { createForumsService } from "./modules/forums/service.ts";
import { forumsRoutes } from "./modules/forums/routes.ts";
import { createThreadsRepo } from "./modules/threads/repo.ts";
import { createThreadsService } from "./modules/threads/service.ts";
import { threadsRoutes } from "./modules/threads/routes.ts";
import { createSearchRepo } from "./modules/search/repo.ts";
import { searchRoutes } from "./modules/search/routes.ts";
import { createFeedRepo } from "./modules/feed/repo.ts";
import { createFeedService } from "./modules/feed/service.ts";
import { feedRoutes } from "./modules/feed/routes.ts";
import { createNotificationsRepo } from "./modules/notifications/repo.ts";
import { createNotificationsService } from "./modules/notifications/service.ts";
import { notificationsRoutes } from "./modules/notifications/routes.ts";
import { createModerationRepo } from "./modules/moderation/repo.ts";
import { createModerationService } from "./modules/moderation/service.ts";
import { moderationRoutes } from "./modules/moderation/routes.ts";
import { createAuthRepo } from "./modules/auth/repo.ts";
import { createAuthService } from "./modules/auth/service.ts";
import { authRoutes } from "./modules/auth/routes.ts";
import { createSessionRepo, type SessionUser } from "./modules/auth/session.repo.ts";
import { createSessionService } from "./modules/auth/session.service.ts";
import { sessionRoutes } from "./modules/auth/session.routes.ts";
import { createPasswordService } from "./modules/auth/password.service.ts";
import { passwordRoutes } from "./modules/auth/password.routes.ts";
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

  // En dev aceptamos cualquier localhost/127.0.0.1 (Vite puede usar otro puerto si 5173
  // está ocupado). En producción, solo el origen configurado.
  const corsOrigin =
    env.NODE_ENV === "production"
      ? env.WEB_ORIGIN
      : (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
          if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            cb(null, true);
          } else {
            cb(null, false);
          }
        };

  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(cookie, { secret: env.SESSION_SECRET });
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

  const uploadsDir = join(process.cwd(), "uploads");
  await app.register(fastifyStatic, { root: uploadsDir, prefix: "/uploads/" });

  const storage = createDiskStorage({ dir: uploadsDir, publicPath: "/uploads" });

  const authRepo = createAuthRepo(opts.db);
  const sessionRepo = createSessionRepo(opts.db);
  const profileRepo = createProfileRepo(opts.db);
  const friendsRepo = createFriendsRepo(opts.db);
  const moderationRepo = createModerationRepo(opts.db);
  const moderationService = createModerationService({ repo: moderationRepo });
  const chatRepo = createChatRepo(opts.db);
  const chatService = createChatService({ repo: chatRepo, isBlocked: moderationService.isBlocked });
  const groupsRepo = createGroupsRepo(opts.db);
  const forumsRepo = createForumsRepo(opts.db);
  const forumsService = createForumsService({ repo: forumsRepo, chatRepo });
  const threadsRepo = createThreadsRepo(opts.db);
  const searchRepo = createSearchRepo(opts.db);
  const feedRepo = createFeedRepo(opts.db);
  const notificationsRepo = createNotificationsRepo(opts.db);
  const authService = createAuthService({ repo: authRepo });
  const sessionService = createSessionService({ authRepo, sessionRepo });
  const passwordService = createPasswordService({ authRepo, sessionRepo });
  const profileService = createProfileService({ repo: profileRepo, storage });

  const io = new IOServer(app.server, {
    cors: { origin: corsOrigin, credentials: true },
  });

  // Autenticación en el handshake: si hay sesión válida adjunta el usuario.
  // Se permiten conexiones anónimas (lectura pública de foros); postear exige sesión.
  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.headers.cookie;
      if (header) {
        const raw = app.parseCookie(header)[SESSION_COOKIE];
        if (raw) {
          const unsigned = app.unsignCookie(raw);
          if (unsigned.valid && unsigned.value) {
            socket.data.user = await sessionService.me(unsigned.value);
          }
        }
      }
    } catch {
      // sesión inválida → conexión anónima
    }
    next();
  });

  const notify: Notify = (userId, event, payload) => {
    io.to(`user:${userId}`).emit(event, payload);
  };
  // Servicio de notificaciones + servicios que dependen de él (necesitan `notify`).
  const notificationsService = createNotificationsService({ repo: notificationsRepo, emit: notify });
  const threadsService = createThreadsService({ repo: threadsRepo, forumsRepo, notifier: notificationsService });
  const feedService = createFeedService({
    repo: feedRepo,
    friendsRepo,
    notifier: notificationsService,
    blockedIds: moderationService.blockedIds,
  });
  const friendsService = createFriendsService({ repo: friendsRepo, notify, isBlocked: moderationService.isBlocked });
  const groupsService = createGroupsService({ repo: groupsRepo, notify });

  const presence = createPresence();

  // Entrega un evento a una conversación: foros por room pública, DM/grupo por user-rooms.
  async function emitToConversation(conversationId: string, event: string, payload: unknown): Promise<void> {
    if ((await chatService.getConversationType(conversationId)) === "forum") {
      io.to(`conversation:${conversationId}`).emit(event, payload);
    } else {
      const members = await chatService.getMemberIds(conversationId);
      for (const memberId of members) io.to(`user:${memberId}`).emit(event, payload);
    }
  }

  async function broadcastPresence(userId: string, online: boolean): Promise<void> {
    const friends = await friendsRepo.listFriends(userId);
    for (const f of friends) io.to(`user:${f.id}`).emit("presence:update", { userId, online });
  }

  io.on("connection", (socket) => {
    const user = socket.data.user;
    // Usuario autenticado: room privada para notificaciones dirigidas.
    if (user) {
      socket.join(`user:${user.id}`);

      // Presencia: avisar a los amigos al conectar; enviar snapshot al recién llegado.
      const wentOnline = presence.connect(user.id);
      void (async () => {
        const friends = await friendsRepo.listFriends(user.id);
        socket.emit("presence:snapshot", { online: presence.onlineAmong(friends.map((f) => f.id)) });
        if (wentOnline) await broadcastPresence(user.id, true);
      })();

      socket.on("disconnect", () => {
        if (presence.disconnect(user.id)) void broadcastPresence(user.id, false);
      });
    }

    // Lectura pública de foros: cualquiera (incluso anónimo) se une a la room del foro.
    socket.on("forum:join", async (payload: { conversationId?: string }) => {
      try {
        const conversationId = String(payload?.conversationId ?? "");
        if ((await chatService.getConversationType(conversationId)) === "forum") {
          socket.join(`conversation:${conversationId}`);
        }
      } catch {
        // ignorar
      }
    });

    socket.on("message:send", async (payload: { conversationId?: string; body?: string }, ack?: (res: unknown) => void) => {
      if (!user) {
        ack?.({ ok: false, code: "unauthenticated" });
        return;
      }
      try {
        const conversationId = String(payload?.conversationId ?? "");
        const body = String(payload?.body ?? "");
        const msg = await chatService.postMessage(user.id, conversationId, body);
        await emitToConversation(conversationId, "message:new", msg);
        ack?.({ ok: true, message: msg });
      } catch (err) {
        const code = err instanceof AppError ? err.code : "error";
        ack?.({ ok: false, code });
      }
    });

    socket.on("reaction:toggle", async (payload: { messageId?: string; emoji?: string }, ack?: (res: unknown) => void) => {
      if (!user) {
        ack?.({ ok: false, code: "unauthenticated" });
        return;
      }
      try {
        const messageId = String(payload?.messageId ?? "");
        const emoji = String(payload?.emoji ?? "");
        const { added, conversationId } = await chatService.toggleReaction(user.id, messageId, emoji);
        await emitToConversation(conversationId, "reaction:update", { messageId, emoji, userId: user.id, added });
        ack?.({ ok: true, added });
      } catch (err) {
        ack?.({ ok: false, code: err instanceof AppError ? err.code : "error" });
      }
    });

    socket.on("typing", async (payload: { conversationId?: string }) => {
      if (!user) return;
      try {
        const conversationId = String(payload?.conversationId ?? "");
        if (!(await chatService.isMemberOf(conversationId, user.id))) return;
        const members = await chatService.getMemberIds(conversationId);
        for (const memberId of members) {
          if (memberId === user.id) continue;
          io.to(`user:${memberId}`).emit("typing", { conversationId, nickname: user.nickname });
        }
      } catch {
        // typing es best-effort; ignorar errores
      }
    });
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
  await app.register(passwordRoutes, { passwordService });
  await app.register(profileRoutes, { profileService, sessionService });
  await app.register(friendsRoutes, { friendsService, sessionService });
  await app.register(chatRoutes, {
    chatService,
    sessionService,
    storage,
    deliverMessage: (msg) => emitToConversation(msg.conversation_id, "message:new", msg),
  });
  await app.register(groupsRoutes, { groupsService, sessionService });
  await app.register(forumsRoutes, { forumsService, chatService, sessionService });
  await app.register(threadsRoutes, { threadsService, sessionService });
  await app.register(searchRoutes, { searchRepo });
  await app.register(feedRoutes, { feedService, sessionService, storage });
  await app.register(notificationsRoutes, { notificationsService, sessionService });
  await app.register(moderationRoutes, { moderationService, sessionService });

  return app;
}
