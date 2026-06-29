import { useCallback, useEffect, useState } from "react";
import { api, API_BASE } from "../lib/api.ts";
import { getSocket } from "../lib/socket.ts";
import { useRealtime } from "../chat/RealtimeContext.tsx";
import type { OpenChat } from "../lib/nav.ts";

interface Friend {
  id: string;
  nickname: string;
  avatar_url: string | null;
}
interface Group {
  id: string;
  name: string | null;
  role: string;
}

function Avatar({ url, name, online }: { url: string | null; name: string; online?: boolean }) {
  return (
    <div className="relative shrink-0">
      {url ? (
        <img src={`${API_BASE}${url}`} alt={name} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-pink)] font-semibold">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--color-surface)] ${
            online ? "bg-[var(--color-green)]" : "bg-[var(--color-muted)]"
          }`}
        />
      )}
    </div>
  );
}

export function ChatList({
  activeId,
  onOpenChat,
  onManageGroups,
}: {
  activeId?: string;
  onOpenChat: (c: OpenChat) => void;
  onManageGroups: () => void;
}) {
  const { isOnline, unread } = useRealtime();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const load = useCallback(async () => {
    const [f, g] = await Promise.all([
      api.get<Friend[]>("/friends"),
      api.get<Group[]>("/groups"),
    ]);
    setFriends(f);
    setGroups(g);
  }, []);

  useEffect(() => {
    void load();
    const socket = getSocket();
    const refresh = () => void load();
    socket.on("friend:accepted", refresh);
    socket.on("group:added", refresh);
    return () => {
      socket.off("friend:accepted", refresh);
      socket.off("group:added", refresh);
    };
  }, [load]);

  async function openDm(nickname: string) {
    const { conversationId } = await api.post<{ conversationId: string }>("/conversations/dm", { nickname });
    onOpenChat({ conversationId, title: nickname });
  }

  const rowBase =
    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--color-surface-2)] transition-colors";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h2 className="font-bold text-[var(--color-text)]">Chats</h2>
        <button onClick={onManageGroups} className="text-sm text-[var(--color-pink)] hover:underline">
          ＋ Grupos
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {groups.length > 0 && (
          <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase text-[var(--color-muted)]">Grupos</p>
        )}
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => onOpenChat({ conversationId: g.id, title: g.name ?? "Grupo" })}
            className={`${rowBase} ${activeId === g.id ? "bg-[var(--color-surface-2)]" : ""}`}
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-purple)] font-bold shrink-0">
              #
            </div>
            <span className="flex-1 truncate text-[var(--color-text)]">{g.name}</span>
            {unread[g.id] > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-[var(--color-magenta)] text-white text-xs font-bold flex items-center justify-center">
                {unread[g.id]}
              </span>
            )}
            {g.role === "admin" && <span className="text-xs text-[var(--color-muted)]">admin</span>}
          </button>
        ))}

        <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase text-[var(--color-muted)]">Amigos</p>
        {friends.length === 0 ? (
          <p className="px-3 py-2 text-sm text-[var(--color-muted)]">
            Agrega amigos en la sección Amigos 👥
          </p>
        ) : (
          friends.map((f) => (
            <button key={f.id} onClick={() => void openDm(f.nickname)} className={rowBase}>
              <Avatar url={f.avatar_url} name={f.nickname} online={isOnline(f.id)} />
              <span className="flex-1 truncate text-[var(--color-text)]">{f.nickname}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
