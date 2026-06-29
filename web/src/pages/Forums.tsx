import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api.ts";
import { flagEmoji } from "../lib/profile.ts";
import { Field, Button, Alert } from "../components/ui.tsx";
import { VoteBar } from "../components/VoteBar.tsx";
import { ThreadView } from "./ThreadView.tsx";
import {
  type Forum,
  type Thread,
  type ThreadSort,
  type SearchResults,
  timeAgo,
} from "../lib/forum.ts";
import type { OpenChat } from "../lib/nav.ts";

const CONTINENTS: Array<{ code: string; label: string }> = [
  { code: "", label: "Todos" },
  { code: "AF", label: "África" },
  { code: "AS", label: "Asia" },
  { code: "EU", label: "Europa" },
  { code: "NA", label: "Norteamérica" },
  { code: "SA", label: "Sudamérica" },
  { code: "OC", label: "Oceanía" },
  { code: "AN", label: "Antártida" },
];

const SORTS: Array<{ id: ThreadSort; label: string }> = [
  { id: "hot", label: "🔥 Popular" },
  { id: "new", label: "🆕 Nuevo" },
  { id: "top", label: "⭐ Top" },
];

const MESSAGES: Record<string, string> = {
  invalid_continent: "Continente inválido.",
  invalid_language_code: "Idioma inválido (2 letras).",
  invalid_country_code: "País inválido (2 letras).",
  empty_title: "El título no puede estar vacío.",
  invalid_request: "Revisa los datos.",
};

export function Forums({ onOpenChat }: { onOpenChat: (c: OpenChat) => void }) {
  const [forum, setForum] = useState<Forum | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  if (threadId) {
    return <ThreadView threadId={threadId} onBack={() => setThreadId(null)} />;
  }
  if (forum) {
    return <ForumThreads forum={forum} onBack={() => setForum(null)} onOpenThread={setThreadId} />;
  }
  return <ForumBrowser onOpenForum={setForum} onOpenChat={onOpenChat} />;
}

function ForumBrowser({
  onOpenForum,
  onOpenChat,
}: {
  onOpenForum: (f: Forum) => void;
  onOpenChat: (c: OpenChat) => void;
}) {
  const [forums, setForums] = useState<Forum[]>([]);
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [continent, setContinent] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", languageCode: "", continent: "NA", countryCode: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (country) qs.set("country", country);
    if (language) qs.set("language", language);
    if (continent) qs.set("continent", continent);
    setForums(await api.get<Forum[]>(`/forums?${qs.toString()}`));
  }, [country, language, continent]);

  useEffect(() => {
    void load();
  }, [load]);

  // Búsqueda con debounce de foros + usuarios.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setResults(await api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`));
      } catch {
        setResults(null);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function openDm(nickname: string) {
    try {
      const { conversationId } = await api.post<{ conversationId: string }>("/conversations/dm", { nickname });
      onOpenChat({ conversationId, title: nickname });
    } catch {
      setError("No se pudo abrir el chat con ese usuario.");
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/forums", {
        name: form.name,
        languageCode: form.languageCode,
        continent: form.continent,
        countryCode: form.countryCode || null,
      });
      setForm({ name: "", languageCode: "", continent: "NA", countryCode: "" });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? (MESSAGES[err.code] ?? "Error.") : "Error inesperado.");
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4 text-[var(--color-pink)]">Foros</h1>
      {error && <Alert kind="error">{error}</Alert>}

      <input
        className="w-full mb-4 px-4 py-2 rounded-full bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-pink)]"
        placeholder="🔍 Buscar foros y usuarios…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {results ? (
        <div className="mb-4">
          <SearchSection title="Foros">
            {results.forums.length === 0 ? (
              <Empty>Sin foros</Empty>
            ) : (
              results.forums.map((f) => (
                <Row key={f.id} onClick={() => onOpenForum(f)}>
                  {f.country_code && <span>{flagEmoji(f.country_code)}</span>}
                  <span className="flex-1 text-[var(--color-text)]">{f.name}</span>
                  <span className="text-xs text-[var(--color-comment)] uppercase">{f.language_code}</span>
                </Row>
              ))
            )}
          </SearchSection>
          <SearchSection title="Usuarios">
            {results.users.length === 0 ? (
              <Empty>Sin usuarios</Empty>
            ) : (
              results.users.map((u) => (
                <Row key={u.id} onClick={() => void openDm(u.nickname)}>
                  <span className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-pink)] font-bold text-sm">
                    {u.nickname.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 text-[var(--color-text)]">{u.nickname}</span>
                  <span className="text-xs text-[var(--color-purple)]">Mensaje</span>
                </Row>
              ))
            )}
          </SearchSection>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <input
              className="px-2 py-1 rounded bg-[var(--color-bg)] text-sm text-[var(--color-text)] outline-none"
              placeholder="País (PA)"
              value={country}
              maxLength={2}
              onChange={(e) => setCountry(e.target.value)}
            />
            <input
              className="px-2 py-1 rounded bg-[var(--color-bg)] text-sm text-[var(--color-text)] outline-none"
              placeholder="Idioma (es)"
              value={language}
              maxLength={2}
              onChange={(e) => setLanguage(e.target.value)}
            />
            <select
              className="px-2 py-1 rounded bg-[var(--color-bg)] text-sm text-[var(--color-text)] outline-none"
              value={continent}
              onChange={(e) => setContinent(e.target.value)}
            >
              {CONTINENTS.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            {forums.length === 0 ? (
              <p className="text-sm text-[var(--color-comment)]">No hay foros con esos filtros.</p>
            ) : (
              forums.map((f) => (
                <Row key={f.id} onClick={() => onOpenForum(f)}>
                  {f.country_code && <span>{flagEmoji(f.country_code)}</span>}
                  <span className="flex-1 text-[var(--color-text)]">{f.name}</span>
                  <span className="text-xs text-[var(--color-comment)] uppercase">{f.language_code} · {f.continent}</span>
                </Row>
              ))
            )}
          </div>

          {showCreate ? (
            <form onSubmit={create} className="mb-4 p-3 rounded-lg bg-[var(--color-bg)]">
              <Field label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Field label="Idioma (es)" value={form.languageCode} maxLength={2} onChange={(e) => setForm({ ...form, languageCode: e.target.value })} required />
              <Field label="País (PA, opcional)" value={form.countryCode} maxLength={2} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} />
              <label className="block mb-4">
                <span className="block mb-1 text-sm text-[var(--color-comment)]">Continente</span>
                <select
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] outline-none"
                  value={form.continent}
                  onChange={(e) => setForm({ ...form, continent: e.target.value })}
                >
                  {CONTINENTS.filter((c) => c.code).map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </label>
              <Button type="submit">Crear foro</Button>
            </form>
          ) : (
            <button onClick={() => setShowCreate(true)} className="mb-4 w-full text-sm text-[var(--color-purple)] hover:underline">
              + Crear un foro
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ForumThreads({
  forum,
  onBack,
  onOpenThread,
}: {
  forum: Forum;
  onBack: () => void;
  onOpenThread: (id: string) => void;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [sort, setSort] = useState<ThreadSort>("hot");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setThreads(await api.get<Thread[]>(`/forums/${forum.id}/threads?sort=${sort}`));
  }, [forum.id, sort]);

  useEffect(() => {
    void load().catch(() => setError("No se pudieron cargar los hilos."));
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    setError("");
    try {
      const created = await api.post<Thread>(`/forums/${forum.id}/threads`, { title, body: draft.body.trim() });
      setDraft({ title: "", body: "" });
      setShowCreate(false);
      onOpenThread(created.id);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Inicia sesión para publicar." : "No se pudo publicar.");
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <button onClick={onBack} className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-lg">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-[var(--color-text)] truncate">{forum.name}</h1>
          <p className="text-xs text-[var(--color-comment)] uppercase">{forum.language_code} · {forum.continent}</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-3 py-1.5 rounded-full text-sm font-semibold bg-[var(--color-pink)] text-[var(--color-bg)] hover:bg-[var(--color-magenta)]"
        >
          + Publicar
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5 max-w-2xl w-full">
        {error && <Alert kind="error">{error}</Alert>}

        {showCreate && (
          <form onSubmit={create} className="mb-4 p-3 rounded-lg bg-[var(--color-surface)]">
            <input
              className="w-full mb-2 px-3 py-2 rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-pink)]"
              placeholder="Título"
              value={draft.title}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <textarea
              className="w-full mb-2 px-3 py-2 rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-pink)] resize-y min-h-20"
              placeholder="Texto (opcional)"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
            <Button type="submit">Publicar hilo</Button>
          </form>
        )}

        <div className="flex gap-2 mb-4">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                sort === s.id
                  ? "bg-[var(--color-pink)] text-[var(--color-bg)] font-semibold"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {threads.length === 0 ? (
          <p className="text-sm text-[var(--color-comment)]">Aún no hay hilos. ¡Crea el primero!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {threads.map((t) => (
              <div
                key={t.id}
                onClick={() => onOpenThread(t.id)}
                className="flex gap-3 p-3 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] cursor-pointer"
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <ThreadVote thread={t} onChange={(score, my) => updateThread(setThreads, t.id, score, my)} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[var(--color-text)] truncate">{t.title}</h3>
                  <p className="text-xs text-[var(--color-comment)]">
                    {t.author_nickname} · {timeAgo(t.created_at)} · 💬 {t.comment_count}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Voto en la lista de hilos: optimista con rollback en error.
function ThreadVote({ thread, onChange }: { thread: Thread; onChange: (score: number, my: number) => void }) {
  async function vote(next: number) {
    const prevScore = thread.score;
    const prevMy = thread.my_vote;
    onChange(prevScore - prevMy + next, next);
    try {
      const { score } = await api.post<{ score: number }>(`/threads/${thread.id}/vote`, { value: next });
      onChange(score, next);
    } catch {
      onChange(prevScore, prevMy);
    }
  }
  return <VoteBar score={thread.score} value={thread.my_vote} onVote={vote} />;
}

function updateThread(
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>,
  id: string,
  score: number,
  my: number
): void {
  setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, score, my_vote: my } : t)));
}

function SearchSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-xs uppercase text-[var(--color-comment)] mb-1">{title}</p>
      {children}
    </div>
  );
}

function Row({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-surface-2)] cursor-pointer"
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--color-comment)]">{children}</p>;
}
