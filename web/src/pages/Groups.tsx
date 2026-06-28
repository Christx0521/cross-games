import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api.ts";
import { Card, Field, Button, Alert } from "../components/ui.tsx";

interface Group {
  id: string;
  name: string | null;
  role: string;
}

interface OpenChat {
  conversationId: string;
  title: string;
}

const MESSAGES: Record<string, string> = {
  user_not_found: "No existe ese nickname.",
  already_member: "Ya es miembro del grupo.",
  group_full: "El grupo alcanzó el tope de 20 miembros.",
  not_admin: "Solo el admin puede agregar miembros.",
  invalid_request: "Datos inválidos.",
};

export function Groups({ onBack, onOpenChat }: { onBack: () => void; onOpenChat: (chat: OpenChat) => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [addNick, setAddNick] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async () => {
    setGroups(await api.get<Group[]>("/groups"));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      await api.post("/groups", { name });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? (MESSAGES[err.code] ?? "Error.") : "Error inesperado.");
    }
  }

  async function addMember(groupId: string) {
    const nickname = (addNick[groupId] ?? "").trim();
    if (!nickname) return;
    setError("");
    setInfo("");
    try {
      await api.post(`/groups/${groupId}/members`, { nickname });
      setAddNick((s) => ({ ...s, [groupId]: "" }));
      setInfo("Miembro agregado.");
    } catch (err) {
      setError(err instanceof ApiError ? (MESSAGES[err.code] ?? "Error.") : "Error inesperado.");
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-6 text-[var(--color-pink)]">Grupos</h1>
      {error && <Alert kind="error">{error}</Alert>}
      {info && <Alert kind="success">{info}</Alert>}

      <form onSubmit={create} className="mb-6">
        <Field label="Crear grupo" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del grupo" required />
        <Button type="submit">Crear</Button>
      </form>

      <h2 className="text-sm font-semibold text-[var(--color-comment)] mb-2">Mis grupos ({groups.length})</h2>
      {groups.length === 0 ? (
        <p className="text-sm text-[var(--color-comment)] mb-4">Aún no perteneces a ningún grupo.</p>
      ) : (
        groups.map((g) => (
          <div key={g.id} className="mb-4 p-3 rounded-lg bg-[var(--color-bg)]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--color-text)]">
                {g.name}
                {g.role === "admin" && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--color-purple)] text-[var(--color-bg)]">admin</span>
                )}
              </span>
              <button onClick={() => onOpenChat({ conversationId: g.id, title: g.name ?? "Grupo" })} className="text-sm text-[var(--color-purple)] hover:underline">
                Abrir chat
              </button>
            </div>
            {g.role === "admin" && (
              <div className="flex gap-2 mt-2">
                <input
                  className="flex-1 px-2 py-1 rounded bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none"
                  placeholder="agregar por nickname"
                  value={addNick[g.id] ?? ""}
                  onChange={(e) => setAddNick((s) => ({ ...s, [g.id]: e.target.value }))}
                />
                <button onClick={() => void addMember(g.id)} className="text-sm text-[var(--color-green)] hover:underline">
                  Agregar
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <button onClick={onBack} className="w-full text-sm text-[var(--color-comment)] hover:underline">
        Volver
      </button>
    </Card>
  );
}
