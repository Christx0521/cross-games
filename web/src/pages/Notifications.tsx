import { useEffect, useState } from "react";
import { api, API_BASE } from "../lib/api.ts";
import { timeAgo } from "../lib/forum.ts";
import {
  type Notification,
  type NotificationsPage,
  notificationAction,
  notificationIcon,
} from "../lib/notifications.ts";

export function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<NotificationsPage>("/notifications?limit=30")
      .then((page) => {
        setItems(page.notifications);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch(() => setError("No se pudieron cargar los avisos."));
  }, []);

  async function loadMore() {
    if (!cursor) return;
    const page = await api.get<NotificationsPage>(`/notifications?limit=30&before=${encodeURIComponent(cursor)}`);
    setItems((prev) => [...prev, ...page.notifications]);
    setCursor(page.nextCursor);
    setHasMore(page.nextCursor !== null);
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-[var(--color-pink)]">Avisos</h1>
      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-comment)]">No tienes avisos todavía.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                n.read_at ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-2)]"
              }`}
            >
              <div className="relative shrink-0">
                {n.actor_avatar ? (
                  <img src={`${API_BASE}${n.actor_avatar}`} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-pink)] font-bold">
                    {(n.actor_nickname ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 text-sm">{notificationIcon(n.type)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-text)]">
                  <span className="font-semibold text-[var(--color-purple)]">{n.actor_nickname ?? "Alguien"}</span>{" "}
                  {notificationAction(n.type)}
                </p>
                {n.preview && <p className="text-xs text-[var(--color-comment)] truncate">{n.preview}</p>}
              </div>
              <span className="text-xs text-[var(--color-comment)] shrink-0">{timeAgo(n.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <button onClick={() => void loadMore()} className="mt-4 w-full text-sm text-[var(--color-purple)] hover:underline">
          Cargar más
        </button>
      )}
    </div>
  );
}
