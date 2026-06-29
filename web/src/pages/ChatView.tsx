import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, API_BASE } from "../lib/api.ts";
import { getSocket } from "../lib/socket.ts";
import { type Message, type HistoryPage, REACTION_EMOJIS } from "../lib/chat.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { Alert } from "../components/ui.tsx";

export function ChatView({
  conversationId,
  title,
  onBack,
  isForum = false,
  forumId,
}: {
  conversationId: string;
  title: string;
  onBack?: () => void;
  isForum?: boolean;
  forumId?: string;
}) {
  const { user } = useAuth();
  const historyUrl = isForum
    ? `/forums/${forumId}/messages`
    : `/conversations/${conversationId}/messages`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mergeMessage = useCallback((incoming: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.seq === incoming.seq)) return prev;
      const withoutOptimistic = prev.filter(
        (m) => !(m.optimistic && m.body === incoming.body && m.sender_id === incoming.sender_id)
      );
      return [...withoutOptimistic, incoming];
    });
  }, []);

  // Carga inicial del historial.
  useEffect(() => {
    let active = true;
    api
      .get<HistoryPage>(`${historyUrl}?limit=30`)
      .then((page) => {
        if (!active) return;
        setMessages(page.messages);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
      })
      .catch(() => setError("No se pudo abrir el chat."));
    return () => {
      active = false;
    };
  }, [conversationId, historyUrl]);

  // Suscripción a mensajes, typing y reacciones.
  useEffect(() => {
    const socket = getSocket();
    if (isForum) socket.emit("forum:join", { conversationId });

    const onNew = (msg: Message) => {
      if (msg.conversation_id === conversationId) mergeMessage(msg);
    };
    const onTyping = (payload: { conversationId: string }) => {
      if (payload.conversationId !== conversationId) return;
      setTyping(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setTyping(false), 2000);
    };
    const onReaction = (p: { messageId: string; emoji: string; userId: string; added: boolean }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== p.messageId) return m;
          const reactions = [...(m.reactions ?? [])];
          const idx = reactions.findIndex((r) => r.emoji === p.emoji);
          const mineDelta = p.userId === user?.id;
          if (p.added) {
            if (idx >= 0) {
              reactions[idx] = {
                ...reactions[idx],
                count: reactions[idx].count + 1,
                mine: reactions[idx].mine || mineDelta,
              };
            } else {
              reactions.push({ emoji: p.emoji, count: 1, mine: mineDelta });
            }
          } else if (idx >= 0) {
            const count = reactions[idx].count - 1;
            if (count <= 0) reactions.splice(idx, 1);
            else reactions[idx] = { ...reactions[idx], count, mine: mineDelta ? false : reactions[idx].mine };
          }
          return { ...m, reactions };
        })
      );
    };

    socket.on("message:new", onNew);
    socket.on("typing", onTyping);
    socket.on("reaction:update", onReaction);
    return () => {
      socket.off("message:new", onNew);
      socket.off("typing", onTyping);
      socket.off("reaction:update", onReaction);
    };
  }, [conversationId, mergeMessage, isForum, user?.id]);

  async function loadOlder() {
    if (!cursor) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const page = await api.get<HistoryPage>(`${historyUrl}?limit=30&before=${encodeURIComponent(cursor)}`);
    setMessages((prev) => [...page.messages, ...prev]);
    setCursor(page.nextCursor);
    setHasMore(page.nextCursor !== null);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  function onScroll() {
    if (scrollRef.current && scrollRef.current.scrollTop === 0 && hasMore) void loadOlder();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }

  function send(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !user) return;
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      seq: Number.MAX_SAFE_INTEGER,
      conversation_id: conversationId,
      sender_id: user.id,
      sender_nickname: user.nickname,
      body: text,
      attachment_url: null,
      created_at: new Date().toISOString(),
      optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    getSocket().emit("message:send", { conversationId, body: text });
    scrollToBottom();
  }

  async function uploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api.upload(`/conversations/${conversationId}/attachment`, form);
      // el mensaje llega por socket (message:new) y se pinta
      scrollToBottom();
    } catch {
      setError("No se pudo enviar la imagen (formato PNG/JPEG/WebP, máx 2 MB).");
    }
  }

  function toggleReaction(messageId: string, emoji: string) {
    setPickerFor(null);
    getSocket().emit("reaction:toggle", { messageId, emoji });
  }

  function notifyTyping() {
    if (conversationId) getSocket().emit("typing", { conversationId });
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {onBack && (
          <button onClick={onBack} className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-lg">←</button>
        )}
        <div className="w-9 h-9 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-pink)] font-bold">
          {title.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-lg font-bold text-[var(--color-text)]">{title}</h1>
      </header>

      {error && <div className="px-5 pt-3"><Alert kind="error">{error}</Alert></div>}

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto flex flex-col gap-1 px-5 py-4">
        {hasMore && (
          <button onClick={() => void loadOlder()} className="text-xs text-[var(--color-purple)] hover:underline self-center mb-2">
            Cargar mensajes anteriores
          </button>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-1">
                {mine && !m.optimistic && (
                  <ReactButton open={pickerFor === m.id} onToggleOpen={() => setPickerFor(pickerFor === m.id ? null : m.id)} onPick={(e) => toggleReaction(m.id, e)} />
                )}
                <div
                  className={`max-w-md px-3 py-2 rounded-2xl text-sm ${
                    mine
                      ? "bg-[var(--color-pink)] text-[var(--color-bg)] rounded-br-sm"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-bl-sm"
                  } ${m.optimistic ? "opacity-60" : ""}`}
                >
                  {!mine && (
                    <span className="block text-xs text-[var(--color-purple)] mb-0.5 font-semibold">{m.sender_nickname}</span>
                  )}
                  {m.attachment_url && (
                    <img
                      src={`${API_BASE}${m.attachment_url}`}
                      alt="adjunto"
                      className="rounded-lg max-w-full max-h-64 mb-1 object-cover"
                    />
                  )}
                  {m.body && <span>{m.body}</span>}
                </div>
                {!mine && (
                  <ReactButton open={pickerFor === m.id} onToggleOpen={() => setPickerFor(pickerFor === m.id ? null : m.id)} onPick={(e) => toggleReaction(m.id, e)} />
                )}
              </div>
              {m.reactions && m.reactions.length > 0 && (
                <div className={`flex gap-1 mt-0.5 ${mine ? "justify-end" : "justify-start"}`}>
                  {m.reactions.map((r) => (
                    <button
                      key={r.emoji}
                      onClick={() => toggleReaction(m.id, r.emoji)}
                      className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        r.mine
                          ? "border-[var(--color-pink)] bg-[var(--color-surface-2)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)]"
                      } text-[var(--color-text)]`}
                    >
                      {r.emoji} {r.count}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {typing && <span className="text-xs text-[var(--color-muted)] italic">escribiendo…</span>}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-xl text-[var(--color-muted)] hover:text-[var(--color-pink)]"
          title="Adjuntar imagen"
        >
          📎
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadAttachment} />
        <input
          className="flex-1 px-4 py-2 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-pink)]"
          value={body}
          onChange={(e) => { setBody(e.target.value); notifyTyping(); }}
          placeholder="Escribe un mensaje…"
        />
        <button type="submit" className="px-5 py-2 rounded-full font-semibold bg-[var(--color-pink)] text-[var(--color-bg)] hover:bg-[var(--color-magenta)] transition-colors">
          Enviar
        </button>
      </form>
    </div>
  );
}

function ReactButton({
  open,
  onToggleOpen,
  onPick,
}: {
  open: boolean;
  onToggleOpen: () => void;
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggleOpen}
        className="opacity-0 group-hover:opacity-100 text-[var(--color-muted)] hover:text-[var(--color-pink)] text-sm transition-opacity"
        title="Reaccionar"
      >
        ☺
      </button>
      {open && (
        <div className="absolute bottom-6 z-10 flex gap-1 px-2 py-1 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-lg">
          {REACTION_EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => onPick(e)} className="hover:scale-125 transition-transform">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
