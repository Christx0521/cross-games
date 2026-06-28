import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api.ts";
import { getSocket } from "../lib/socket.ts";
import { type Message, type HistoryPage } from "../lib/chat.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { Card, Button, Alert } from "../components/ui.tsx";

export function ChatView({
  conversationId,
  title,
  onBack,
  isForum = false,
  forumId,
}: {
  conversationId: string;
  title: string;
  onBack: () => void;
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inserta mensajes evitando duplicados por seq; reemplaza optimistas propios.
  const mergeMessage = useCallback((incoming: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.seq === incoming.seq)) return prev;
      const withoutOptimistic = prev.filter(
        (m) => !(m.optimistic && m.body === incoming.body && m.sender_id === incoming.sender_id)
      );
      return [...withoutOptimistic, incoming];
    });
  }, []);

  // Cargar la primera página del historial de la conversación.
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

  // Suscripción a mensajes nuevos y typing.
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
    socket.on("message:new", onNew);
    socket.on("typing", onTyping);
    return () => {
      socket.off("message:new", onNew);
      socket.off("typing", onTyping);
    };
  }, [conversationId, mergeMessage, isForum]);

  async function loadOlder() {
    if (!conversationId || !cursor) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const page = await api.get<HistoryPage>(
      `${historyUrl}?limit=30&before=${encodeURIComponent(cursor)}`
    );
    setMessages((prev) => [...page.messages, ...prev]);
    setCursor(page.nextCursor);
    setHasMore(page.nextCursor !== null);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  function onScroll() {
    if (scrollRef.current && scrollRef.current.scrollTop === 0 && hasMore) {
      void loadOlder();
    }
  }

  function send(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !conversationId || !user) return;
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      seq: Number.MAX_SAFE_INTEGER,
      conversation_id: conversationId,
      sender_id: user.id,
      sender_nickname: user.nickname,
      body: text,
      created_at: new Date().toISOString(),
      optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    getSocket().emit("message:send", { conversationId, body: text });
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }

  function notifyTyping() {
    if (conversationId) getSocket().emit("typing", { conversationId });
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[var(--color-pink)]">{title}</h1>
        <button onClick={onBack} className="text-sm text-[var(--color-comment)] hover:underline">Volver</button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-80 overflow-y-auto flex flex-col gap-2 mb-3 pr-1"
      >
        {hasMore && (
          <button onClick={() => void loadOlder()} className="text-xs text-[var(--color-purple)] hover:underline">
            Cargar mensajes anteriores
          </button>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div
              key={m.id}
              className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                mine
                  ? "self-end bg-[var(--color-purple)] text-[var(--color-bg)]"
                  : "self-start bg-[var(--color-bg)] text-[var(--color-text)]"
              } ${m.optimistic ? "opacity-60" : ""}`}
            >
              {!mine && (
                <span className="block text-xs text-[var(--color-comment)] mb-0.5">{m.sender_nickname}</span>
              )}
              {m.body}
            </div>
          );
        })}
        {typing && <span className="text-xs text-[var(--color-comment)]">escribiendo…</span>}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-purple)]"
          value={body}
          onChange={(e) => { setBody(e.target.value); notifyTyping(); }}
          placeholder="Escribe un mensaje…"
        />
        <Button type="submit">Enviar</Button>
      </form>
    </Card>
  );
}
