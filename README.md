# Cross-Games

Plataforma de chat para gamers. MVP en construcción módulo a módulo.

## Stack

- **Backend:** Node 24, TypeScript, Fastify 5, PGlite (Postgres 16 embebido), argon2id, Zod, Resend, Socket.IO.
- **Frontend:** React 19, Vite 8, Tailwind v4 (paleta Dracula), Motion.

## Requisitos

- Node 24+

## Arranque fácil (Windows)

**Doble clic en `iniciar.bat`.** La primera vez instala dependencias y crea los `.env`;
luego levanta backend (:3000) y frontend (:5173) en dos ventanas y abre el navegador
solo en http://localhost:5173. Para detener: cierra las ventanas "Servidor" y "Web".

## Arranque local (sin Docker)

```powershell
cd server; Copy-Item .env.example .env; npm install; npm run dev   # :3000 (migra solo)
cd web;    Copy-Item .env.example .env; npm install; npm run dev   # :5173
```

PGlite persiste en `server/.pgdata`. Sin `RESEND_API_KEY`, el código de verificación
se imprime en la consola del backend: `[email:dev] <email> -> código <n>`.

## Tests del backend

```powershell
cd server; npm test
```

## Arquitectura

- Monorepo con dos paquetes aislados: `server/` y `web/`.
- Backend en capas por módulo: `routes → service → repo`. SQL crudo parametrizado, sin ORM.
- Migraciones idempotentes versionadas en `server/src/db/migrations/`, aplicadas al arrancar.
- Decisiones de diseño en [docs/superpowers/specs/](docs/superpowers/specs/) y plan en [docs/superpowers/plans/](docs/superpowers/plans/).

## Estado

- **M1 — Auth (registro): completo.**
  - `POST /auth/register` (sin verificación por email: la cuenta queda lista al instante), `GET /health`.
  - IDs UUID, password argon2id, código de 7 dígitos (HMAC-SHA256, TTL 15 min, máx 5 intentos).
- **M2 — Login + sesión: completo.**
  - `POST /auth/login` (nickname o email), `POST /auth/logout`, `GET /auth/me`.
  - Cookie de sesión httpOnly firmada (SameSite=Lax), store en DB (tabla `sessions`, TTL 7 días).
  - Socket.IO valida la sesión en el handshake (`socket.data.user`).
- **M3 — Reset de password: completo.**
  - `POST /auth/forgot-password`, `POST /auth/reset-password`.
  - Código por email (purpose `password_reset`); el reset invalida todas las sesiones del usuario.
- **M4 — Perfil de usuario: completo.**
  - `GET /users/:nickname` (público, sin datos sensibles, `is_adult`), `PATCH /me/profile`, `POST /me/avatar`.
  - Avatar en disco tras interfaz `Storage` (PNG/JPEG/WebP, ≤2 MB); país (ISO) e idiomas.
- **M5 — Amigos: completo.**
  - `POST /friends/request`, `POST /friends/:id/accept`, `POST /friends/:id/reject`, `GET /friends`, `GET /friends/requests`.
  - Pares bidireccionales (auto-acepta inversa); notificación en vivo por Socket.IO (rooms `user:<id>`).
- **M6 — Motor de chat (DM): completo.**
  - `POST /conversations/dm`, `GET /conversations/:id/messages` (paginación keyset por `seq`).
  - Socket `message:send` valida membresía y emite `message:new`; `typing`. ChatView con scroll infinito y envío optimista.
- **M7 — Grupos privados: completo.**
  - `POST /groups`, `POST /groups/:id/members`, `DELETE /groups/:id/members/:userId`, `GET /groups`.
  - type=group (reutiliza el motor); solo admin gestiona; tope 20. ChatView unificado (DM/grupo/foro).
- **M8 — Foros públicos: completo.**
  - `GET /forums` y `GET /forums/:id/messages` públicos; `POST /forums` requiere sesión.
  - Filtro con país prioritario + idioma + continente. Socket permite lectura anónima en vivo (forum:join); postear exige sesión.
- **M12 — Foros estilo Reddit: completo.**
  - Hilos (post con título + cuerpo), votos ↑↓ con score y orden `hot`/`new`/`top`, y comentarios anidados con voto propio.
  - `GET /forums/:id/threads?sort=`, `POST /forums/:id/threads`, `GET /threads/:id`, `GET/POST /threads/:id/comments`, `POST /threads/:id/vote`, `POST /comments/:id/vote`.
  - Búsqueda global `GET /search?q=` (foros por nombre + usuarios por nickname). Lecturas públicas con sesión opcional (personaliza `my_vote`).

**MVP M1–M8 completo** + rediseño App Shell/Sakura + **M10 (presencia + no leídos)** + **M11 (reacciones emoji + imágenes en el chat)** + **M12 (foros estilo Reddit + búsqueda)**. Próximo: M13 (feed/muro social) y extras (menciones, stories, perfil rico, moderación). M9 (juegos) más adelante.
