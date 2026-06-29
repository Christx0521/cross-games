import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api.ts";
import { type Post, type PostsPage } from "../lib/feed.ts";
import { PostCard } from "../components/PostCard.tsx";
import { Alert } from "../components/ui.tsx";

export function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const page = await api.get<PostsPage>("/feed?limit=20");
    setPosts(page.posts);
    setCursor(page.nextCursor);
    setHasMore(page.nextCursor !== null);
  }, []);

  useEffect(() => {
    void load().catch(() => setError("No se pudo cargar el feed."));
  }, [load]);

  async function loadMore() {
    if (!cursor) return;
    const page = await api.get<PostsPage>(`/feed?limit=20&before=${encodeURIComponent(cursor)}`);
    setPosts((prev) => [...prev, ...page.posts]);
    setCursor(page.nextCursor);
    setHasMore(page.nextCursor !== null);
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await api.post<Post>("/posts", { body: text });
      setPosts((prev) => [created, ...prev]);
      setBody("");
    } catch {
      setError("No se pudo publicar.");
    } finally {
      setBusy(false);
    }
  }

  async function publishImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (body.trim()) form.append("body", body.trim());
      const created = await api.upload<Post>("/posts/attachment", form);
      setPosts((prev) => [created, ...prev]);
      setBody("");
    } catch {
      setError("No se pudo subir la imagen (PNG/JPEG/WebP, máx 2 MB).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto p-5">
        <h1 className="text-2xl font-bold mb-4 text-[var(--color-pink)]">Inicio</h1>
        {error && <Alert kind="error">{error}</Alert>}

        <form onSubmit={publish} className="mb-5 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <textarea
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-pink)] resize-y min-h-16"
            placeholder="¿Qué estás jugando?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
          />
          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xl text-[var(--color-muted)] hover:text-[var(--color-pink)]"
              title="Adjuntar imagen"
            >
              📎
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={publishImage} />
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="px-5 py-1.5 rounded-full font-semibold bg-[var(--color-pink)] text-[var(--color-bg)] hover:bg-[var(--color-magenta)] disabled:opacity-50"
            >
              Publicar
            </button>
          </div>
        </form>

        {posts.length === 0 ? (
          <p className="text-sm text-[var(--color-comment)]">
            Aún no hay publicaciones. ¡Publica algo o agrega amigos para ver su actividad!
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </div>
        )}

        {hasMore && (
          <button onClick={() => void loadMore()} className="mt-4 w-full text-sm text-[var(--color-purple)] hover:underline">
            Cargar más
          </button>
        )}
      </div>
    </div>
  );
}
