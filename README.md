# Cross-Games

Plataforma de chat para gamers. MVP en construcción módulo a módulo.

## Stack

- **Backend:** Node 24, TypeScript, Fastify 5, PGlite (Postgres 16 embebido), argon2id, Zod, Resend, Socket.IO.
- **Frontend:** React 19, Vite 8, Tailwind v4 (paleta Dracula), Motion.

## Requisitos

- Node 24+

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

- **M1 — Auth (registro + verificación de email): completo.**
  - `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-code`, `GET /health`.
  - IDs UUID, password argon2id, código de 7 dígitos (HMAC-SHA256, TTL 15 min, máx 5 intentos).
- **M2 — Login + sesión: completo.**
  - `POST /auth/login` (nickname o email), `POST /auth/logout`, `GET /auth/me`.
  - Cookie de sesión httpOnly firmada (SameSite=Lax), store en DB (tabla `sessions`, TTL 7 días).
  - Socket.IO valida la sesión en el handshake (`socket.data.user`).
- Próximos: M3 (reset password), M4 (perfil), M5 (amigos), M6 (chat), M7 (grupos), M8 (foros).
