import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, API_BASE, ApiError } from "../lib/api.ts";
import { getSocket } from "../lib/socket.ts";
import { Card, Field, Button, Alert } from "../components/ui.tsx";

interface Friend {
  id: string;
  nickname: string;
  avatar_url: string | null;
}
interface Request {
  friendship_id: string;
  id: string;
  nickname: string;
  avatar_url: string | null;
}

const MESSAGES: Record<string, string> = {
  user_not_found: "No existe ese nickname.",
  cannot_add_self: "No puedes agregarte a ti mismo.",
  already_friends: "Ya son amigos.",
  already_requested: "Ya enviaste una solicitud.",
  invalid_request: "Nickname inválido.",
};

function Avatar({ url, nickname }: { url: string | null; nickname: string }) {
  return url ? (
    <img src={`${API_BASE}${url}`} alt={nickname} className="w-10 h-10 rounded-full object-cover" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-comment)]">
      {nickname.charAt(0).toUpperCase()}
    </div>
  );
}

export function Friends({ onBack, onOpenChat }: { onBack: () => void; onOpenChat: (nickname: string) => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async () => {
    const [f, r] = await Promise.all([
      api.get<Friend[]>("/friends"),
      api.get<Request[]>("/friends/requests"),
    ]);
    setFriends(f);
    setRequests(r);
  }, []);

  useEffect(() => {
    void load();
    const socket = getSocket();
    const refresh = () => void load();
    socket.on("friend:request", refresh);
    socket.on("friend:accepted", refresh);
    return () => {
      socket.off("friend:request", refresh);
      socket.off("friend:accepted", refresh);
    };
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      const res = await api.post<{ status: string }>("/friends/request", { nickname });
      setInfo(res.status === "accepted" ? "¡Ya son amigos!" : "Solicitud enviada.");
      setNickname("");
      await load();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "error";
      setError(MESSAGES[code] ?? "Error inesperado.");
    }
  }

  async function accept(id: string) {
    await api.post(`/friends/${id}/accept`, {});
    await load();
  }
  async function reject(id: string) {
    await api.post(`/friends/${id}/reject`, {});
    await load();
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-6 text-[var(--color-pink)]">Amigos</h1>
      {error && <Alert kind="error">{error}</Alert>}
      {info && <Alert kind="success">{info}</Alert>}

      <form onSubmit={add} className="mb-6">
        <Field
          label="Agregar por nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="otro_jugador"
          required
        />
        <Button type="submit">Enviar solicitud</Button>
      </form>

      {requests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-comment)] mb-2">Solicitudes recibidas</h2>
          {requests.map((r) => (
            <div key={r.friendship_id} className="flex items-center gap-3 mb-2">
              <Avatar url={r.avatar_url} nickname={r.nickname} />
              <span className="flex-1 text-[var(--color-text)]">{r.nickname}</span>
              <button onClick={() => void accept(r.friendship_id)} className="text-sm text-[var(--color-green)] hover:underline">Aceptar</button>
              <button onClick={() => void reject(r.friendship_id)} className="text-sm text-[var(--color-red)] hover:underline">Rechazar</button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-comment)] mb-2">Mis amigos ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-[var(--color-comment)]">Aún no tienes amigos agregados.</p>
        ) : (
          friends.map((f) => (
            <div key={f.id} className="flex items-center gap-3 mb-2">
              <Avatar url={f.avatar_url} nickname={f.nickname} />
              <span className="flex-1 text-[var(--color-text)]">{f.nickname}</span>
              <button onClick={() => onOpenChat(f.nickname)} className="text-sm text-[var(--color-purple)] hover:underline">
                Chatear
              </button>
            </div>
          ))
        )}
      </div>

      <button onClick={onBack} className="w-full text-sm text-[var(--color-comment)] hover:underline">
        Volver
      </button>
    </Card>
  );
}
