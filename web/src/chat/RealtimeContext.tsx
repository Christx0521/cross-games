import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api.ts";
import { getSocket } from "../lib/socket.ts";
import type { Message } from "../lib/chat.ts";

interface UnreadRow {
  conversation_id: string;
  count: number;
}

interface RealtimeState {
  online: Set<string>;
  unread: Record<string, number>;
  notifUnread: number;
  isOnline: (userId: string) => boolean;
  markRead: (conversationId: string) => void;
  markNotifsRead: () => void;
  activeConversation: string | null;
  setActiveConversation: (id: string | null) => void;
}

const Ctx = createContext<RealtimeState | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [notifUnread, setNotifUnread] = useState(0);
  const activeRef = useRef<string | null>(null);
  const [, force] = useState(0);

  const setActiveConversation = useCallback((id: string | null) => {
    activeRef.current = id;
    force((n) => n + 1);
  }, []);

  const markRead = useCallback(async (conversationId: string) => {
    setUnread((u) => {
      if (!u[conversationId]) return u;
      const next = { ...u };
      delete next[conversationId];
      return next;
    });
    try {
      await api.post(`/conversations/${conversationId}/read`, {});
    } catch {
      // si falla, el badge se recalcula al recargar
    }
  }, []);

  const markNotifsRead = useCallback(() => {
    setNotifUnread(0);
    void api.post("/notifications/read", {}).catch(() => {});
  }, []);

  useEffect(() => {
    // Estado inicial de no leídos
    api
      .get<UnreadRow[]>("/conversations/unread")
      .then((rows) => setUnread(Object.fromEntries(rows.map((r) => [r.conversation_id, r.count]))))
      .catch(() => {});

    api
      .get<{ count: number }>("/notifications/unread")
      .then((r) => setNotifUnread(r.count))
      .catch(() => {});

    const socket = getSocket();

    const onSnapshot = (p: { online: string[] }) => setOnline(new Set(p.online));
    const onPresence = (p: { userId: string; online: boolean }) =>
      setOnline((prev) => {
        const next = new Set(prev);
        if (p.online) next.add(p.userId);
        else next.delete(p.userId);
        return next;
      });
    const onMessage = (m: Message) => {
      if (m.conversation_id === activeRef.current) {
        // estoy viéndolo: marcar leído en el server, sin badge
        void api.post(`/conversations/${m.conversation_id}/read`, {}).catch(() => {});
        return;
      }
      setUnread((u) => ({ ...u, [m.conversation_id]: (u[m.conversation_id] ?? 0) + 1 }));
    };

    const onNotif = () => setNotifUnread((n) => n + 1);

    socket.on("presence:snapshot", onSnapshot);
    socket.on("presence:update", onPresence);
    socket.on("message:new", onMessage);
    socket.on("notification:new", onNotif);
    return () => {
      socket.off("presence:snapshot", onSnapshot);
      socket.off("presence:update", onPresence);
      socket.off("message:new", onMessage);
      socket.off("notification:new", onNotif);
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        online,
        unread,
        notifUnread,
        isOnline: (id) => online.has(id),
        markRead,
        markNotifsRead,
        activeConversation: activeRef.current,
        setActiveConversation,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useRealtime(): RealtimeState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRealtime debe usarse dentro de RealtimeProvider");
  return ctx;
}
