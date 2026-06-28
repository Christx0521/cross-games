# Cross-Games — Diseño M1: Auth (registro + verificación de email)

> Fecha: 2026-06-27. Estado de partida: **repositorio vacío**. Se construye todo desde cero.
> Este documento consolida el spec maestro del proyecto para el Módulo 1 y fija las
> decisiones transversales que condicionan M2–M9.

## Decisiones transversales fijadas (válidas para todos los módulos)

| Aspecto | Decisión | Motivo |
|---|---|---|
| Motor DB (dev) | PGlite (`@electric-sql/pglite`) | Postgres 16 embebido, sin Docker |
| Tipo de IDs | **UUID** `gen_random_uuid()` | No enumerables; lo asumen los esquemas M2–M9 |
| Hash password | **argon2id** (`argon2` npm, prebuilds Windows) | Gold standard OWASP; lo asume `service.login` de M2 |
| Columna verificación | `is_verified` | Visión limpia |
| Tabla migraciones | `schema_migrations` (`name PK`, `applied_at`) | Visión limpia |
| Expiración código | 15 min | Visión |
| Validación | Zod (env) + JSON Schema inline de Fastify (requests) | Validación en el borde |
| Email | Resend + fallback a consola en dev | Sin API key imprime el código |

## Arquitectura

Monorepo con dos paquetes independientes:

```
server/   Fastify 5 + TS · PGlite · migra al arrancar     → :3000
  src/
    config/env.ts          validación de entorno (Zod)
    db/client.ts           singleton PGlite
    db/migrate.ts          runner idempotente + runMigrations()
    db/migrations/001_init.sql
    lib/code.ts            código 7 dígitos + HMAC-SHA256
    lib/password.ts        argon2id hash/verify
    lib/email.ts           adapter Resend + fallback consola
    lib/errors.ts          AppError (statusCode + code)
    modules/auth/          routes (schemas inline) → service → repo
    app.ts                 Fastify + CORS + errorHandler + Socket.IO (decorate io)
    index.ts               runMigrations() + listen
web/      React 19 + TS + Vite 6 + Tailwind v4 (Dracula)  → :5173
  src/
    lib/api.ts             cliente HTTP (ApiError tipado)
    components/ui.tsx       Card, Field, Button, Alert
    pages/Register.tsx
    pages/VerifyEmail.tsx
    App.tsx                routing por estado (register ↔ verify)
    main.tsx, index.css
```

Patrón por módulo: `routes` solo traduce HTTP + valida; `service` tiene la lógica;
`repo` toca la DB. SQL crudo parametrizado, sin ORM.

## Esquema `001_init.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname      VARCHAR(32)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  birth_year    INT          NOT NULL,
  is_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts    INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evc_user_active
  ON email_verification_codes (user_id, expires_at)
  WHERE consumed_at IS NULL;
```

Tabla de control: `schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())`.

## Seguridad M1

- **Password → argon2id** (`argon2.hash` con defaults seguros; `argon2.verify`).
- **Código de verificación**: 7 dígitos aleatorios (`crypto.randomInt`). Se persiste
  **solo el HMAC-SHA256** del código (clave `CODE_SECRET`), ligado al email.
  Comparación en tiempo constante (`timingSafeEqual`).
- **TTL**: 15 minutos (`CODE_TTL_MS`).
- **Anti-fuerza-bruta**: máx **5 intentos** por código (`attempts`) → 429. Al verificar
  con éxito se marca `consumed_at`.
- **Reenvío**: invalida el código activo previo (`consumed_at = now()`) antes de emitir uno nuevo.
- **Edad**: `currentYear - birthYear >= 18` (UTC) → si no, 422 `underage`.

## Endpoints

| Método | Ruta | Body | Resultado |
|---|---|---|---|
| POST | `/auth/register` | `nickname, email, password, birthYear` | 201 `{email}`; 422 `underage`; 409 `email_taken`/`nickname_taken` |
| POST | `/auth/verify-email` | `email, code` | `{verified:true}`; 400 `invalid_code`; 410 `code_expired`; 429 `too_many_attempts`; 404 `user_not_found` |
| POST | `/auth/resend-code` | `email` | **`{sent:true}` siempre** (anti-enumeración) |
| GET | `/health` | — | `{status:"ok"}` |

**Desviación deliberada vs spec maestro §4.3**: `resend-code` responde `{sent:true}`
exista o no la cuenta, para no filtrar qué emails están registrados. En `register` la
enumeración es inevitable por UX (hay que informar "email/nickname ya tomado").

## Frontend

- `Register.tsx`: formulario (nickname, email, password, año de nacimiento).
- `VerifyEmail.tsx`: input de código + botón de reenvío.
- Componentes Dracula reutilizables (`Card`, `Field`, `Button`, `Alert`).
- `App.tsx`: routing por estado (`register ↔ verify`).
- `lib/api.ts`: cliente HTTP con `ApiError` tipado.

## Testing

`node:test` + `app.inject` de Fastify contra **PGlite efímero en memoria** (`new PGlite()`
sin ruta → instancia limpia por test). Casos M1:

- register → 201 `{email}`
- register menor de edad → 422 `underage`
- register email/nickname duplicado → 409
- verify-email con código correcto → `{verified:true}` + `is_verified=true`
- verify-email código incorrecto → 400 `invalid_code`
- verify-email código expirado → 410 `code_expired`
- verify-email 6º intento → 429 `too_many_attempts`
- resend-code → `{sent:true}` (exista o no el email)

## Cómo correrlo (local, sin Docker)

```powershell
cd server; Copy-Item .env.example .env; npm install; npm run dev   # :3000 (migra solo)
cd web;    Copy-Item .env.example .env; npm install; npm run dev   # :5173
```
PGlite persiste en `server/.pgdata`. El código de verificación sale en la consola del backend.

## Terminado cuando

Registro 201, verificación OK, código incorrecto 400, expirado 410, duplicado 409,
menor 422, todos cubiertos por tests verdes y probado en runtime local.
