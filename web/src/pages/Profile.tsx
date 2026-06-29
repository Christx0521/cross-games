import { useEffect, useState } from "react";
import { api, API_BASE, ApiError } from "../lib/api.ts";
import { type PublicProfile, flagEmoji } from "../lib/profile.ts";
import { type Post, type PostsPage } from "../lib/feed.ts";
import { PostCard } from "../components/PostCard.tsx";
import { Button, Alert } from "../components/ui.tsx";

export function Profile({ nickname, onEdit }: { nickname: string; onEdit?: () => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<PublicProfile>(`/users/${nickname}`)
      .then(setProfile)
      .catch((err) => setError(err instanceof ApiError ? "Perfil no encontrado." : "Error inesperado."));
    api
      .get<PostsPage>(`/users/${nickname}/posts?limit=20`)
      .then((page) => setPosts(page.posts))
      .catch(() => setPosts([]));
  }, [nickname]);

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-6 max-w-xl">
        <Alert kind="error">{error}</Alert>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-full p-6">
        <p className="text-[var(--color-muted)]">Cargando perfil…</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 max-w-xl">
      <div className="flex items-center gap-4 mb-4">
        {profile.avatar_url ? (
          <img
            src={`${API_BASE}${profile.avatar_url}`}
            alt={profile.nickname}
            className="w-24 h-24 rounded-full object-cover ring-2 ring-[var(--color-pink)]"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-4xl text-[var(--color-pink)]">
            {profile.nickname.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-pink)]">{profile.nickname}</h1>
          <div className="flex items-center gap-2 mt-1">
            {profile.country_code && <span className="text-lg">{flagEmoji(profile.country_code)}</span>}
            {profile.is_adult && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-purple)] text-[var(--color-bg)] font-semibold">
                18+
              </span>
            )}
          </div>
        </div>
      </div>

      {profile.description && <p className="mb-4 text-[var(--color-text)]">{profile.description}</p>}

      {profile.languages.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {profile.languages.map((lang) => (
            <span key={lang} className="text-xs px-2 py-1 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-muted)] uppercase">
              {lang}
            </span>
          ))}
        </div>
      )}

      {onEdit && (
        <div className="max-w-xs">
          <Button onClick={onEdit}>Editar perfil</Button>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-3">Publicaciones</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-[var(--color-comment)]">Sin publicaciones todavía.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
