# Cross-Games — Rediseño UX (App Shell) + Tema Sakura

> Fecha: 2026-06-28. Solo frontend (`web/`). Cero cambios de backend, cero tests nuevos.
> Reorganiza la UI existente (login menú de botones → app real estilo WhatsApp/Discord)
> y reemplaza la paleta Dracula por una **Sakura oscura** calcada de la captura del tema.

## Objetivo

Que al entrar se sienta una red social/mensajería real: barra de secciones, lista de
conversaciones y panel de chat, con estética Sakura. Reorganiza chat, amigos, grupos,
foros y perfil; no añade features de producto (eso es el roadmap M10+).

## Paleta Sakura (tokens `@theme`, reemplazan Dracula)

| Token | Hex | Uso |
|---|---|---|
| `--color-bg` | `#1a1721` | Fondo de la app (ciruela casi negro) |
| `--color-surface` | `#251f2e` | Rail, columnas, tarjetas |
| `--color-surface-2` | `#322a3d` | Hover, burbujas recibidas, inputs |
| `--color-border` | `#3a3147` | Bordes/separadores sutiles |
| `--color-text` | `#ecdcec` | Texto principal (blanco rosado) |
| `--color-muted` | `#8b8195` | Texto secundario / comentarios |
| `--color-pink` | `#ff6ba8` | **Acento principal** (botones, activos) |
| `--color-magenta` | `#ff4d8d` | Hover / énfasis |
| `--color-purple` | `#b98cf0` | Acento secundario |
| `--color-green` | `#8fe0a8` | Éxito |
| `--color-red` | `#ff5c7a` | Error |

Se conservan los nombres ya usados por los componentes (`bg`, `surface`, `text`,
`pink`, `purple`, `green`, `red`) y se añaden `surface-2`, `border`, `muted`, `magenta`.
Los colores Dracula hardcodeados (`#282a36`) en `ui.tsx` se reemplazan por `var(--color-bg)`.

## Arquitectura de UI — App Shell de 3 zonas

```
┌────┬──────────────┬──────────────────────────┐
│rail│  columna     │   panel principal        │
│64px│  ~300px      │   (flex-1)               │
└────┴──────────────┴──────────────────────────┘
```

- **`AppShell`** (nuevo, `components/AppShell.tsx`): contenedor. Mantiene el estado
  `section: "chats" | "friends" | "forums" | "profile"` y `openChat: { conversationId, title, isForum?, forumId? } | null`.
  Renderiza el rail, la columna contextual y el panel.
- **Rail** (dentro de AppShell): logo 🌸 + botones verticales de sección (Chats, Amigos,
  Foros, Perfil) con el activo resaltado en rosa; abajo, cerrar sesión.
- **Columna contextual** (según `section`):
  - *chats*: lista combinada de **grupos** (`GET /groups`) + **amigos** (`GET /friends`);
    clic en uno → resuelve DM/abre grupo en el panel.
  - *friends*: solicitudes + lista + agregar (contenido de `Friends`).
  - *forums*: filtros (país/idioma/continente) + directorio + crear (contenido de `Forums`).
  - *profile*: accesos a "ver perfil" / "editar".
- **Panel principal**: la conversación abierta (`ChatView`), el foro, el editor de
  perfil, o un **placeholder** ("Elige un chat 🌸") cuando no hay nada seleccionado.

## Componentes a crear/modificar

- `web/src/index.css` — paleta Sakura.
- `web/src/components/ui.tsx` — quitar hardcodes Dracula; `Button` con rosa Sakura;
  añadir helper de superficie si hace falta.
- `web/src/components/AppShell.tsx` — **nuevo**: rail + 3 zonas + estado.
- `web/src/components/ChatList.tsx` — **nuevo**: columna de conversaciones (grupos + amigos).
- Adaptar a "panel" (sin `Card` centrada a pantalla completa, sin botón "Volver" propio;
  el shell gestiona navegación): `Friends`, `Groups` (panel admin embebido o fusionado
  en la sección de chats/grupos), `Forums`, `Profile`, `EditProfile`, `ChatView`.
- `web/src/App.tsx` — el `Home` (menú de botones) → `<AppShell/>`. Las pantallas de
  `Login`/`Register`/`ForgotPassword`/`ResetPassword` quedan centradas con `Card`, ya
  con tema Sakura.

## Comportamiento / datos

- Sin endpoints nuevos. La "lista de chats" se arma con `GET /groups` + `GET /friends`
  (no hay endpoint de "conversaciones recientes"; es aceptable para el MVP).
- Abrir DM: `POST /conversations/dm {nickname}` (ya existe) → `conversationId` → `ChatView`.
- Abrir grupo: usa el `id` del grupo como `conversationId` directo.
- Abrir foro: `ChatView` en modo foro (`isForum`, `forumId`) — ya soportado.
- Tiempo real: el socket compartido (`getSocket`) sigue igual; `ChatView` ya escucha
  `message:new`/`typing`.

## No incluye (roadmap posterior)

Presencia/no leídos (M10), reacciones/adjuntos (M11), foros Reddit (M12), feed (M13),
menciones/notificaciones, stories, perfil rico, moderación. Este spec es **solo** layout + tema.

## Verificación

- `npm run build` del frontend limpio (TS strict + Vite).
- Revisión visual en `localhost:5173`: rail navega entre secciones; abrir un chat de un
  amigo y de un grupo; navegar foros; editar perfil; cerrar sesión. Estética Sakura coherente.

## Terminado cuando

La app entra directo al App Shell tras login, se navega entre Chats/Amigos/Foros/Perfil
desde el rail, se abren conversaciones (DM, grupo, foro) en el panel, y todo luce con el
tema Sakura, con el build verde.
