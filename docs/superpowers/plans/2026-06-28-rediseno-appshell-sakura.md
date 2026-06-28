# Rediseño App Shell + Sakura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. UI sin tests
> unitarios; cada tarea termina con `npm run build` verde + verificación visual.

**Goal:** Convertir el frontend de "menú de botones" en una app real estilo WhatsApp/Discord (App Shell de 3 zonas) con tema Sakura oscuro, reorganizando chat/amigos/grupos/foros/perfil. Cero backend.

**Architecture:** `AppShell` mantiene estado `{section, openChat}` y compone rail + columna contextual + panel. Las páginas existentes se adaptan a vivir embebidas en el panel/columna. Tema vía tokens `@theme` en `index.css`.

**Tech Stack:** React 19, Vite 8, Tailwind v4, TypeScript 6 strict.

## Global Constraints

- Solo `web/`. Cero cambios de backend, cero endpoints nuevos.
- Paleta Sakura (tokens `@theme`): bg `#1a1721`, surface `#251f2e`, surface-2 `#322a3d`, border `#3a3147`, text `#ecdcec`, muted `#8b8195`, pink `#ff6ba8`, magenta `#ff4d8d`, purple `#b98cf0`, green `#8fe0a8`, red `#ff5c7a`.
- TS `strict`; `const` no `var`; functional components + hooks; props tipadas (sin `any`).
- Reutilizar endpoints existentes: `GET /groups`, `GET /friends`, `POST /conversations/dm`, `GET /forums`, `GET /users/:nickname`, `PATCH /me/profile`, `POST /me/avatar`.

---

### Task 1: Paleta Sakura + limpieza de tokens
**Files:** Modify `web/src/index.css`, `web/src/components/ui.tsx`
- `index.css`: bloque `@theme` con todos los tokens Sakura (arriba). `body` con bg/text Sakura. Scrollbars sutiles opcionales.
- `ui.tsx`: sustituir los hardcodes Dracula (`#282a36`) por `var(--color-bg)`; `Button` con `bg-[var(--color-pink)]` y hover `--color-magenta`; `Alert` con texto sobre `--color-bg`.
- **Done:** `npm run build` verde; las pantallas existentes ya se ven Sakura.

### Task 2: AppShell + Rail + placeholder
**Files:** Create `web/src/components/AppShell.tsx`
- Estado: `section: "chats"|"friends"|"forums"|"profile"` (default "chats"), `openChat: OpenChat | null`.
- Layout flex a pantalla completa (`h-screen`): rail 64px (logo 🌸 + 4 botones de sección con activo en rosa + cerrar sesión abajo usando `useAuth().logout`), columna 300px (`<aside>`), panel `flex-1`.
- Por ahora columna y panel muestran placeholders por sección.
- **Done:** build verde; el rail cambia `section`.

### Task 3: Sección Chats (ChatList + ChatView en panel)
**Files:** Create `web/src/components/ChatList.tsx`; Modify `AppShell.tsx`, `web/src/pages/ChatView.tsx`
- `ChatList`: carga `GET /groups` y `GET /friends`; muestra dos grupos ("Grupos", "Amigos") con avatar+nombre; al hacer clic en amigo → `POST /conversations/dm` → `onOpen({conversationId, title})`; en grupo → `onOpen({conversationId: group.id, title: group.name})`.
- `ChatView`: ya adaptado por props `conversationId/title/isForum/forumId`; quitar la `Card` centrada → contenedor que llena el panel (header arriba, scroll en medio, input abajo, `h-full flex flex-col`). Quitar el botón "Volver" (el shell tiene rail); dejar un header con el título.
- Panel de Chats: si `openChat` → `<ChatView/>`; si no → placeholder "Elige un chat 🌸".
- **Done:** build verde; abrir DM y grupo desde la columna, chatear en el panel.

### Task 4: Sección Amigos
**Files:** Modify `web/src/pages/Friends.tsx`, `AppShell.tsx`
- `Friends` adaptado a panel: quitar `Card` centrada y botón "Volver"; ocupar el panel con scroll. Mantiene agregar + solicitudes + lista + botón "Chatear" (que llama `onOpenChat`).
- AppShell sección "friends": columna breve o directamente el panel con `Friends`.
- **Done:** build verde; gestionar amigos desde la sección.

### Task 5: Sección Foros
**Files:** Modify `web/src/pages/Forums.tsx`, `AppShell.tsx`
- `Forums` adaptado a panel (sin Card centrada/Volver). Columna = filtros + lista; panel = foro abierto (`ChatView` modo forum) o placeholder.
- AppShell sección "forums": al elegir foro → `onOpen({conversationId, title, isForum:true, forumId})`.
- **Done:** build verde; navegar/crear/entrar a foros y postear.

### Task 6: Sección Perfil
**Files:** Modify `web/src/pages/Profile.tsx`, `web/src/pages/EditProfile.tsx`, `AppShell.tsx`
- Adaptar a panel (sin Card centrada/Volver). Sección "profile": sub-estado ver/editar dentro del panel.
- **Done:** build verde; ver y editar perfil + subir avatar desde la sección.

### Task 7: Integración final + auth Sakura
**Files:** Modify `web/src/App.tsx`; delete nothing
- `App.tsx`: el `Home` se reemplaza por `<AppShell/>`. `Gate` igual (login/register/forgot/reset centrados con `Card`, ya Sakura por Task 1). Quitar `Groups` como sección suelta si queda fusionada en Chats (o dejar acceso a crear grupo desde Chats).
- Revisar que `Groups` (crear grupo / panel admin) sea accesible — incluir un botón "+ grupo" en la columna de Chats que abra el panel de creación/gestión (reusar `Groups`).
- **Done:** build verde; recorrido completo en `localhost:5173`.

---

## Self-Review
- Paleta Sakura → Task 1 ✓. App Shell 3 zonas → Task 2 ✓. Chats(lista+panel) → Task 3 ✓.
  Amigos → Task 4 ✓. Foros → Task 5 ✓. Perfil → Task 6 ✓. Integración/auth → Task 7 ✓.
- Sin backend nuevo (usa endpoints existentes) ✓.
- Grupos: gestión/creación accesible vía Task 7 (botón en columna Chats) ✓.
- Sin placeholders de código sin resolver: cada tarea nombra archivos y comportamiento concretos; el código se produce en ejecución.
